"""Acceptance gate for the tweets -> notes import.

T1: fresh recomputation from the archive reconciles exactly (archive total =
kept + dropped retweets + dropped replies incl. chain + flagged empties) and
matches the committed tweets_report.txt. T2: notes on disk match (count,
frontmatter shape, unique tweetIds, tweetCount sum). T3: PII scan of emitted
files with needles derived at RUNTIME from account.js (this file never embeds
them). T4: every CDN URL referenced by notes returns HTTP 200 (skippable
before the media upload with --skip-cdn).

`npm run build` is the fourth spec check; run it from the repo root after
this script passes.

Usage:
    .venv/bin/python verify_tweets.py [--archive-root PATH] [--skip-cdn]
"""
import argparse
import glob
import os
import re
import sys
import urllib.request

import backup_paths
from tweets_import import build_notes, load_archive

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
NOTES_DIR = os.path.join(REPO, 'src', 'content', 'notes')
REPORT_PATH = os.path.join(HERE, 'tweets_report.txt')
MANIFEST_PATH = os.path.join(HERE, 'tweets_media_manifest.json')

EMAIL_RE = re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
CDN_RE = re.compile(r'https://cdn\.theneverless\.com/[^\s)"\']+')
NOTE_FM_RE = re.compile(
    r"\A---\n"
    r"date: '\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z'\n"
    r"tweetId: '(\d+)'\n"
    r"source: 'https://x\.com/[A-Za-z0-9_]+/status/\1'\n"
    r"tweetCount: (\d+)\n"
    r"---\n\n")

_results = []


def check(name, ok, details=None):
    _results.append((name, ok))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}")
    for line in (details or [])[:50]:
        print(f'    {line}')
    extra = len(details or []) - 50
    if extra > 0:
        print(f'    ... and {extra} more')
    return ok


def parse_report(path):
    parsed = {}
    with open(path, encoding='utf-8') as f:
        for line in f:
            m = re.match(r'^([a-z_]+):\s*(-?\d+)\s*$', line)
            if m:
                parsed[m.group(1)] = int(m.group(2))
    return parsed


def reconcile(counts):
    """Identity check; returns a list of problems (empty means OK)."""
    expected = (counts['kept_tweets'] + counts['retweets_dropped']
                + counts['replies_dropped'] + counts['empties_flagged'])
    if counts['archive_total'] != expected:
        return [f"archive_total {counts['archive_total']} != "
                f"kept+retweets+replies+empties = {expected}"]
    return []


def account_needles(account):
    """PII needles derived at runtime so this file never embeds them.

    Mirrors verify.py's _dump_email_needles exclusion: a needle that already
    occurs inside public strings (the public username, x.com source URLs,
    the CDN host) was always public, so a hit could never indicate a leak.
    """
    email = (account.get('email') or '').lower()
    local = email.split('@', 1)[0]
    public = ' '.join([
        (account.get('username') or '').lower(),
        'https://x.com/',
        'https://cdn.theneverless.com/',
    ])
    return sorted(n for n in {email, local} if len(n) >= 5 and n not in public)


def t1_counts(archive_root):
    tweets, account = load_archive(archive_root)
    media_root = os.path.join(archive_root, 'data', 'tweets_media')
    _notes, counts, _rows, _details = build_notes(tweets, account, media_root)
    problems = reconcile(counts)
    check('T1a: recomputed counts reconcile exactly', not problems, problems)
    reported = parse_report(REPORT_PATH) if os.path.isfile(REPORT_PATH) else {}
    mismatches = [f'{k}: report has {reported.get(k)}, recomputed {v}'
                  for k, v in counts.items() if reported.get(k) != v]
    check('T1b: tweets_report.txt matches a fresh recomputation',
          not mismatches, mismatches)
    return counts, account


def t2_notes(counts):
    files = sorted(glob.glob(os.path.join(NOTES_DIR, '*.md')))
    n = counts['notes_emitted']
    check(f'T2a: exactly {n} notes in src/content/notes/', len(files) == n,
          None if len(files) == n else [f'found {len(files)}'])
    ids, tweet_sum, bad = [], 0, []
    for path in files:
        with open(path, encoding='utf-8') as f:
            m = NOTE_FM_RE.match(f.read())
        if not m:
            bad.append(os.path.relpath(path, REPO))
            continue
        ids.append(m.group(1))
        tweet_sum += int(m.group(2))
    check('T2b: every note has the exact frontmatter shape', not bad, bad)
    dupes = sorted({i for i in ids if ids.count(i) > 1})
    check('T2c: tweetId unique across all notes', not dupes, dupes)
    check(f"T2d: tweetCount sums to kept_tweets ({counts['kept_tweets']})",
          tweet_sum == counts['kept_tweets'], [f'sum is {tweet_sum}'])
    return files


def t3_pii(files, account):
    scope = list(files)
    for extra in (REPORT_PATH, MANIFEST_PATH):
        if os.path.isfile(extra):
            scope.append(extra)
    loaded = []
    for path in scope:
        with open(path, encoding='utf-8', errors='replace') as f:
            loaded.append((path, f.read()))
    email_hits = [f'{os.path.relpath(p, REPO)}: "{m.group(0)}"'
                  for p, text in loaded for m in EMAIL_RE.finditer(text)]
    check('T3a: zero email-pattern matches in emitted files',
          not email_hits, email_hits)
    needles = account_needles(account)
    needle_hits = [f'{os.path.relpath(p, REPO)}: needle hit'
                   for p, text in loaded for n in needles if n in text.lower()]
    check(f'T3b: zero hits for {len(needles)} account-derived needles',
          not needle_hits, needle_hits)


def t4_cdn(files, skip):
    urls = sorted({u for path in files
                   for u in CDN_RE.findall(open(path, encoding='utf-8').read())})
    if skip:
        print(f'[SKIP] T4: CDN check over {len(urls)} URL(s) (--skip-cdn)')
        return
    misses = []
    for url in urls:
        # Cloudflare blocks the default urllib User-Agent with a 403; any
        # non-default value clears it.
        request = urllib.request.Request(
            url, method='HEAD', headers={'User-Agent': 'theneverless-verify/1.0'})
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                if response.status != 200:
                    misses.append(f'{url}: HTTP {response.status}')
        except Exception as err:  # noqa: BLE001 - any failure is a miss
            misses.append(f'{url}: {err}')
    check(f'T4: all {len(urls)} CDN URLs return HTTP 200', not misses, misses)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive-root',
                        help='Archive location override (default: auto-locate).')
    parser.add_argument('--skip-cdn', action='store_true',
                        help='Skip the CDN 200 check (for pre-upload runs).')
    args = parser.parse_args()
    try:
        root = args.archive_root or backup_paths.twitter_archive_root()
    except RuntimeError as err:
        print(err)
        sys.exit(1)
    counts, account = t1_counts(root)
    files = t2_notes(counts)
    t3_pii(files, account)
    t4_cdn(files, args.skip_cdn)
    print()
    print('--- summary ---')
    for name, ok in _results:
        print(f"[{'PASS' if ok else 'FAIL'}] {name}")
    all_passed = all(ok for _, ok in _results)
    print()
    print('RESULT:', 'ALL PASS' if all_passed else 'FAIL')
    sys.exit(0 if all_passed else 1)


if __name__ == '__main__':
    main()
