"""Acceptance gate for the WordPress -> Astro migration.

Runs every scripted check the migration must pass before a human does the final
preview click-through: V1 (counts), V2 (image refs resolve), V5a (PII), V5b
(private-post title leakage), V6 (comment JSON shape), and V-extra (comment
file count + archived-comments section count in the built site).

Each check prints PASS/FAIL (with failure detail) as it runs. The process
exits 0 only if every check passed.

Usage:
    .venv/bin/python verify.py [--skip-dist]

--skip-dist forces the dist/-dependent half of V-extra to be skipped, e.g. to
run this pre-build. Without the flag, that half runs automatically when
dist/posts/ exists and is skipped (with a note, not a failure) when it
doesn't -- so the default invocation is safe to run before the first
`npm run build` too.
"""
import argparse
import glob
import json
import os
import re
import subprocess
import sys

from convert_posts import emitted_img_re, make_title
from wp_parser import load_dump
import backup_paths

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
POSTS_DIR = os.path.join(REPO, 'src', 'content', 'posts')
COMMENTS_DIR = os.path.join(REPO, 'src', 'data', 'comments')
UPLOADS_DIR = os.path.join(REPO, 'public', 'uploads')
DIST_POSTS_DIR = os.path.join(REPO, 'dist', 'posts')
REPORT_PATH = os.path.join(HERE, 'report.txt')
DUMP_PATH = backup_paths.dump_path()

EMAIL_RE = re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
# Shape make_title() gives untitled posts ('YYYY-MM-DD' or 'YYYY-MM-DD·N');
# these are non-distinctive placeholders, not real title text, and legitimately
# collide with unrelated posts published the same day -- exclude them from V5b.
DATE_TITLE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}(·\d+)?$')
ARCHIVED_SECTION_NEEDLE = '<section class="archived-comments"'
# Extensions skipped when scanning git-tracked files for leaked private-post
# titles: binary content that text search has no business reading.
BINARY_EXTS = {
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp', '.woff', '.woff2',
    '.ttf', '.eot', '.pdf', '.zip', '.mp4', '.mp3', '.wav',
}

_results = []  # (name, passed)


def check(name, ok, details=None):
    _results.append((name, ok))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}")
    for line in (details or [])[:50]:
        print(f'    {line}')
    extra = len(details or []) - 50
    if extra > 0:
        print(f'    ... and {extra} more')
    return ok


def context_snippet(text, start, end, width=80):
    pad = max(0, (width - (end - start)) // 2)
    lo = max(0, start - pad)
    hi = min(len(text), end + pad)
    return text[lo:hi].replace('\n', '\\n')


def v1_counts():
    md_files = glob.glob(os.path.join(POSTS_DIR, '*.md'))
    n_md = len(md_files)
    check('V1a: exactly 318 .md files in src/content/posts/', n_md == 318,
          None if n_md == 318 else [f'found {n_md}'])

    expected = {
        'posts_written': 318,
        'images_used': 186,
        'comments_exported': 183,
        'flagged_fffd': 0,
        'slug_collisions': 0,
    }
    if not os.path.isfile(REPORT_PATH):
        check('V1b: report.txt counts match expected', False,
              [f'{REPORT_PATH} not found'])
        return

    parsed = {}
    with open(REPORT_PATH, encoding='utf-8') as f:
        for line in f:
            m = re.match(r'^(\w+):\s*(-?\d+)\s*$', line)
            if m:
                parsed[m.group(1)] = int(m.group(2))

    details = []
    ok = True
    for key, want in expected.items():
        got = parsed.get(key)
        line_ok = got == want
        ok = ok and line_ok
        marker = '' if line_ok else '  <-- MISMATCH'
        details.append(f'{key}: expected {want}, got {got}{marker}')
    check('V1b: report.txt counts (posts_written/images_used/comments_exported/'
          'flagged_fffd/slug_collisions)', ok, details)


def v2_image_refs():
    img_re = emitted_img_re()
    misses = []
    total_refs = 0
    for path in sorted(glob.glob(os.path.join(POSTS_DIR, '*.md'))):
        with open(path, encoding='utf-8') as f:
            text = f.read()
        for m in img_re.finditer(text):
            total_refs += 1
            rel = m.group(1)
            if not os.path.isfile(os.path.join(UPLOADS_DIR, rel)):
                misses.append(f'{os.path.relpath(path, REPO)}: /uploads/{rel}')
    check(f'V2: every /uploads/ ref resolves under public/uploads/ ({total_refs} refs checked)',
          len(misses) == 0, misses)


def _load_pii_scope_files():
    return (sorted(glob.glob(os.path.join(POSTS_DIR, '*.md'))) +
            sorted(glob.glob(os.path.join(COMMENTS_DIR, '*.json'))))


def v5a_pii():
    files = _load_pii_scope_files()
    loaded = []
    for path in files:
        with open(path, encoding='utf-8', errors='replace') as f:
            loaded.append((path, f.read()))

    email_hits = []
    for path, text in loaded:
        for m in EMAIL_RE.finditer(text):
            snippet = context_snippet(text, m.start(), m.end())
            email_hits.append(f'{os.path.relpath(path, REPO)}: "{m.group(0)}"  context: ...{snippet}...')
    check('V5a-email: zero email-pattern matches in src/content/posts/ + src/data/comments/',
          len(email_hits) == 0, email_hits)

    # Needles are the local parts of every email address stored in the dump
    # (user accounts, admin_email, commenter emails), derived at RUNTIME so
    # this file never embeds the PII fragments it exists to keep out of the
    # public repo. The dump itself stays outside the repo.
    needles = _dump_email_needles()
    needle_hits = []
    for needle in needles:
        for path, text in loaded:
            start = 0
            while True:
                idx = text.find(needle, start)
                if idx == -1:
                    break
                snippet = context_snippet(text, idx, idx + len(needle))
                needle_hits.append(f'{os.path.relpath(path, REPO)}: "{needle}"  context: ...{snippet}...')
                start = idx + 1
    check(f'V5a-needles: zero hits for {len(needles)} dump-derived email local-parts',
          len(needle_hits) == 0, needle_hits)


def _dump_email_needles():
    """Local parts (len >= 5) of emails the pipeline actually handled:
    wp_users accounts plus APPROVED comments (spam was never exported, and
    its generic local-parts false-positive against ordinary prose).
    Local parts that already occur inside the blog's own published post
    content are excluded: those strings were always public, so a match
    cannot indicate a leak (e.g. the owner's old domain name).
    """
    dump = load_dump(DUMP_PATH)
    emails = set()
    for u in dump['wp_users']:
        if u[4] and '@' in u[4]:
            emails.add(u[4])
    for c in dump['wp_comments']:
        if c[10] == '1' and c[3] and '@' in c[3]:
            emails.add(c[3])
    published_text = '\n'.join(
        (p[4] or '').lower() for p in dump['wp_posts']
        if p[20] == 'post' and p[7] == 'publish')
    locals_ = {e.split('@', 1)[0].lower() for e in emails}
    return sorted(lp for lp in locals_
                  if len(lp) >= 5 and lp not in published_text)


def _private_post_titles():
    """The 22 private post titles, computed at runtime from the SQL dump
    (mirrors export_private.py's own title resolution -- never hardcoded here).
    """
    dump = load_dump(DUMP_PATH)
    private_posts = sorted(
        (p for p in dump['wp_posts'] if p[20] == 'post' and p[7] == 'private'),
        key=lambda p: int(p[0]))
    rows = [(p[0], p[2], p[5]) for p in private_posts]
    untitled = make_title(rows)
    titles = []
    for p in private_posts:
        pid, title_raw = p[0], p[5] or ''
        titles.append(untitled.get(pid, title_raw))
    return titles


def v5b_private_leak():
    try:
        titles = _private_post_titles()
    except OSError as e:
        check('V5b: private-post title leakage', False, [f'could not load dump: {e}'])
        return

    check('V5b-count: exactly 22 private post titles computed from the dump',
          len(titles) == 22, None if len(titles) == 22 else [f'got {len(titles)}: {titles}'])

    distinctive = sorted({
        t.strip() for t in titles
        if t.strip() and len(t.strip()) >= 4 and not DATE_TITLE_RE.match(t.strip())
    })

    tracked = subprocess.run(
        ['git', 'ls-files'], cwd=REPO, capture_output=True, text=True, check=True,
    ).stdout.splitlines()

    path_hits = [p for p in tracked if 'private-posts' in p]
    check("V5b-path: no tracked path contains 'private-posts'", len(path_hits) == 0, path_hits)

    leak_hits = []
    for rel in tracked:
        ext = os.path.splitext(rel)[1].lower()
        if ext in BINARY_EXTS:
            continue
        abspath = os.path.join(REPO, rel)
        try:
            with open(abspath, encoding='utf-8', errors='ignore') as f:
                text = f.read()
        except OSError:
            continue
        for title in distinctive:
            idx = text.find(title)
            if idx != -1:
                snippet = context_snippet(text, idx, idx + len(title))
                leak_hits.append(f'{rel}: title "{title}"  context: ...{snippet}...')

    check(f'V5b-leak: none of the {len(distinctive)} distinctive private post titles '
          f'appear in any git-tracked file', len(leak_hits) == 0, leak_hits)


def v6_comments():
    post_slugs = {os.path.splitext(os.path.basename(p))[0]
                  for p in glob.glob(os.path.join(POSTS_DIR, '*.md'))}
    json_files = sorted(glob.glob(os.path.join(COMMENTS_DIR, '*.json')))

    parse_errors = []
    shape_errors = []
    order_errors = []
    slug_errors = []
    parsed = {}

    for path in json_files:
        rel = os.path.relpath(path, REPO)
        try:
            with open(path, encoding='utf-8') as f:
                data = json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            parse_errors.append(f'{rel}: {e}')
            continue
        parsed[path] = data

    check(f'V6a: all {len(json_files)} comment JSON files parse', len(parse_errors) == 0, parse_errors)

    for path, data in parsed.items():
        rel = os.path.relpath(path, REPO)
        if not isinstance(data, list) or len(data) == 0:
            kind = type(data).__name__
            length = len(data) if isinstance(data, list) else 'n/a'
            shape_errors.append(f'{rel}: expected non-empty array, got {kind} len={length}')
            continue
        for i, item in enumerate(data):
            keys = set(item.keys()) if isinstance(item, dict) else None
            if keys != {'author', 'date', 'body'}:
                got = sorted(keys) if keys is not None else type(item).__name__
                shape_errors.append(f'{rel}[{i}]: keys={got}, expected exactly author/date/body')

    check('V6b: every comment array is non-empty with objects of exactly {author,date,body}',
          len(shape_errors) == 0, shape_errors)

    for path, data in parsed.items():
        if not isinstance(data, list):
            continue
        rel = os.path.relpath(path, REPO)
        prev = None
        for i, item in enumerate(data):
            date = item.get('date') if isinstance(item, dict) else None
            if date is None:
                continue
            if prev is not None and date < prev:
                order_errors.append(f'{rel}: index {i} date {date!r} < previous {prev!r}')
            prev = date

    check('V6c: dates ascending within each comment file', len(order_errors) == 0, order_errors)

    for path in json_files:
        slug = os.path.splitext(os.path.basename(path))[0]
        if slug not in post_slugs:
            slug_errors.append(f'{os.path.relpath(path, REPO)}: no matching src/content/posts/{slug}.md')

    check('V6d: every comment filename matches an existing post slug', len(slug_errors) == 0, slug_errors)


def vextra_comment_counts(skip_dist):
    json_files = glob.glob(os.path.join(COMMENTS_DIR, '*.json'))
    check('V-extra-a: exactly 82 comment JSON files', len(json_files) == 82,
          None if len(json_files) == 82 else [f'found {len(json_files)}'])

    if skip_dist:
        print('[SKIP] V-extra-b: archived-comments section count in dist/ (--skip-dist)')
        return
    if not os.path.isdir(DIST_POSTS_DIR):
        print('[SKIP] V-extra-b: archived-comments section count in dist/ '
              '(dist/posts/ not found; run again after `npm run build`)')
        return

    count = 0
    for slug_dir in sorted(os.listdir(DIST_POSTS_DIR)):
        index_path = os.path.join(DIST_POSTS_DIR, slug_dir, 'index.html')
        if not os.path.isfile(index_path):
            continue
        with open(index_path, encoding='utf-8', errors='replace') as f:
            if ARCHIVED_SECTION_NEEDLE in f.read():
                count += 1

    check('V-extra-b: <section class="archived-comments"> element appears in exactly '
          '82 built post pages', count == 82, None if count == 82 else [f'found {count}'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--skip-dist', action='store_true',
                         help='Skip the dist/-dependent half of V-extra (for pre-build runs).')
    args = parser.parse_args()

    v1_counts()
    v2_image_refs()
    v5a_pii()
    v5b_private_leak()
    v6_comments()
    vextra_comment_counts(args.skip_dist)

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
