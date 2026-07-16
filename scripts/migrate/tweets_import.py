"""Import the X/Twitter archive into src/content/notes/, one note per tweet
or self-thread, per docs/superpowers/specs/2026-07-14-tweets-to-notes-design.md.

Filtering: retweets (full_text starting with 'RT @') and replies to other
accounts are dropped; consecutive self-replies stitch chronologically into a
single note; a self-reply chain inherits its root's fate. Transforms are
mechanical only: t.co expansion, HTML entity decode, @mention links, media
stub removal, markdown escaping. Emission is keyed by tweetId: re-runs update
in place and never duplicate; files are written only when their content
changed (iCloud sync hazard).

Outputs: markdown notes, scripts/migrate/tweets_report.txt (counts plus
flagged IDs) and scripts/migrate/tweets_media_manifest.json (archive file to
staged name and R2 key). --stage-media DIR also copies referenced photos into
DIR under their staged names for scripts/images/process.mjs --staging-dir.

Usage:
    .venv/bin/python tweets_import.py [--archive-root PATH] [--stage-media DIR]
"""
import argparse
import html
import json
import os
import re
import shutil
import sys
from datetime import timezone
from datetime import datetime

import backup_paths

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
NOTES_DIR = os.path.join(REPO, 'src', 'content', 'notes')
REPORT_PATH = os.path.join(HERE, 'tweets_report.txt')
MEDIA_MANIFEST_PATH = os.path.join(HERE, 'tweets_media_manifest.json')
CDN_NOTES_BASE = 'https://cdn.theneverless.com/notes'
CREATED_AT_FMT = '%a %b %d %H:%M:%S %z %Y'
CONVERTED_EXTS = {'.jpg', '.jpeg', '.png'}

# Markdown-significant characters escaped everywhere; list/heading markers
# only matter at line starts. Escaped punctuation renders as the literal
# character, so the note shows exactly what was tweeted.
_MD_GLOBAL = re.compile(r'([\\`*_\[\]<>~|])')
_MD_LINESTART = re.compile(r'(?m)^(\s*)([#+-])( |$)')
_MD_OL = re.compile(r'(?m)^(\s*\d+)\.( )')
FRONTMATTER_ID_RE = re.compile(r"^tweetId: '(\d+)'$", re.M)


def load_ytd(path):
    """Parse a window.YTD.<name>.part0 = [...] file into Python data."""
    with open(path, encoding='utf-8') as f:
        text = f.read()
    return json.loads(text[text.index('=') + 1:])


def load_archive(root):
    """Return (tweets, account) from an extracted archive root."""
    data_dir = os.path.join(root, 'data')
    tweets = [item['tweet'] for item in load_ytd(os.path.join(data_dir, 'tweets.js'))]
    account = load_ytd(os.path.join(data_dir, 'account.js'))[0]['account']
    return tweets, account


def parse_date(tweet):
    return datetime.strptime(tweet['created_at'], CREATED_AT_FMT)


def media_entities(tweet):
    extended = tweet.get('extended_entities') or {}
    entities = tweet.get('entities') or {}
    return extended.get('media') or entities.get('media') or []


def classify(tweets, account_id):
    """Split tweets into kept threads and dropped categories.

    Returns (threads, dropped, orphan_roots): threads are chronological
    tweet lists (root first); dropped has 'retweets', 'replies' (to other
    accounts) and 'chain' (self-replies whose root was dropped); orphan
    roots are self-replies whose parent is absent from the archive, kept
    as their own roots and listed in the report for a human look.
    """
    by_id = {t['id_str']: t for t in tweets}
    children = {}
    dropped = {'retweets': [], 'replies': [], 'chain': []}
    roots = []
    orphan_roots = []

    for t in sorted(tweets, key=parse_date):
        if t['full_text'].startswith('RT @'):
            dropped['retweets'].append(t)
            continue
        reply_uid = t.get('in_reply_to_user_id_str') or t.get('in_reply_to_user_id')
        if reply_uid and str(reply_uid) != str(account_id):
            dropped['replies'].append(t)
            continue
        if reply_uid:
            parent_id = t.get('in_reply_to_status_id_str') or t.get('in_reply_to_status_id')
            if parent_id and str(parent_id) in by_id:
                children.setdefault(str(parent_id), []).append(t)
            else:
                orphan_roots.append(t)
                roots.append(t)
            continue
        roots.append(t)

    threads = []
    claimed = set()
    for root in roots:
        chain = [root]
        claimed.add(root['id_str'])
        queue = [root['id_str']]
        while queue:
            for child in sorted(children.get(queue.pop(0), []), key=parse_date):
                if child['id_str'] not in claimed:
                    chain.append(child)
                    claimed.add(child['id_str'])
                    queue.append(child['id_str'])
        chain.sort(key=parse_date)
        threads.append(chain)

    # Self-replies never reached from a kept root inherit the drop.
    for t in tweets:
        reply_uid = t.get('in_reply_to_user_id_str') or t.get('in_reply_to_user_id')
        if (reply_uid and str(reply_uid) == str(account_id)
                and t['id_str'] not in claimed
                and not t['full_text'].startswith('RT @')):
            dropped['chain'].append(t)

    return threads, dropped, orphan_roots


def escape_md(text):
    text = _MD_GLOBAL.sub(r'\\\1', text)
    text = _MD_LINESTART.sub(r'\1\\\2\3', text)
    return _MD_OL.sub(r'\1\\.\2', text)


def transform_text(tweet):
    """Mechanical transforms only, never editorial. Tokenizing URLs and
    mentions first keeps escape_md() away from inserted markdown."""
    text = tweet['full_text']
    entities = tweet.get('entities') or {}
    tokens = {}

    for m in media_entities(tweet):
        text = text.replace(m.get('url', ''), '')

    for i, u in enumerate(entities.get('urls') or []):
        token = f'\x00U{i}\x00'
        tokens[token] = u.get('expanded_url') or u.get('url')
        text = text.replace(u['url'], token)

    text = html.unescape(text)

    # Linkify only the mentions Twitter itself recorded in user_mentions:
    # a blanket @word regex also matched emoticons like @_@ and produced
    # bogus links. Screen names match case-insensitively as typed, with a
    # guard against matching inside a longer username.
    for mention in entities.get('user_mentions') or []:
        screen_name = mention.get('screen_name')
        if not screen_name:
            continue
        pattern = re.compile('@' + re.escape(screen_name) + r'(?![A-Za-z0-9_])',
                             re.IGNORECASE)

        def _mention(m, screen_name=screen_name):
            token = f'\x00M{len(tokens)}\x00'
            tokens[token] = f'[{m.group(0)}](https://x.com/{screen_name})'
            return token

        text = pattern.sub(_mention, text)

    text = escape_md(text)
    for token, replacement in tokens.items():
        text = text.replace(token, replacement)
    return re.sub(r'[ \t]+\n', '\n', text).strip()


def media_lines(tweet, media_root, details):
    """Image lines and manifest rows for a tweet's photos. Non-photo media
    (video, animated_gif) is logged and skipped, never fatal: the real
    archive contains zero of them. Missing files keep the text and note
    the absence."""
    lines, rows = [], []
    for n, m in enumerate(media_entities(tweet), start=1):
        media_type = m.get('type', 'photo')
        if media_type != 'photo':
            details['media_skipped_nonphoto'].append(f"{tweet['id_str']} ({media_type})")
            continue
        remote = m.get('media_url_https') or m.get('media_url') or ''
        base = remote.rsplit('/', 1)[-1]
        ext = os.path.splitext(base)[1].lower()
        archive_name = f"{tweet['id_str']}-{base}"
        if not os.path.isfile(os.path.join(media_root, archive_name)):
            details['media_missing'].append(archive_name)
            continue
        out_ext = '.webp' if ext in CONVERTED_EXTS else ext
        url = f"{CDN_NOTES_BASE}/{tweet['id_str']}-{n}{out_ext}"
        lines.append(f'![]({url})')
        rows.append({'archive': archive_name,
                     'staged': f"{tweet['id_str']}-{n}{ext}",
                     'key': f"notes/{tweet['id_str']}-{n}{out_ext}",
                     'url': url})
    return lines, rows


def build_notes(tweets, account, media_root):
    """Filter, stitch and transform. Returns (notes, counts, manifest_rows,
    details). Genuinely empty results (no text, no renderable media) are
    flagged for a human call, not emitted."""
    threads, dropped, orphan_roots = classify(tweets, account['accountId'])
    details = {
        'empties_flagged': [],
        'media_missing': [],
        'media_skipped_nonphoto': [],
        'orphan_roots': [t['id_str'] for t in orphan_roots],
        'chain_dropped': [t['id_str'] for t in dropped['chain']],
    }
    notes, manifest_rows = [], []
    kept = 0
    for chain in threads:
        blocks, rows = [], []
        for t in chain:
            text = transform_text(t)
            lines, tweet_rows = media_lines(t, media_root, details)
            rows.extend(tweet_rows)
            piece = '\n\n'.join(p for p in [text, '\n'.join(lines)] if p)
            if piece:
                blocks.append(piece)
        body = '\n\n'.join(blocks)
        if not body:
            details['empties_flagged'].extend(t['id_str'] for t in chain)
            continue
        kept += len(chain)
        manifest_rows.extend(rows)
        first = chain[0]
        notes.append({
            'date': parse_date(first),
            'tweetId': first['id_str'],
            'source': f"https://x.com/{account['username']}/status/{first['id_str']}",
            'tweetCount': len(chain),
            'body': body,
        })
    counts = {
        'archive_total': len(tweets),
        'kept_tweets': kept,
        'notes_emitted': len(notes),
        'retweets_dropped': len(dropped['retweets']),
        'replies_dropped': len(dropped['replies']) + len(dropped['chain']),
        'chain_dropped': len(dropped['chain']),
        'empties_flagged': len(details['empties_flagged']),
        'orphan_roots': len(orphan_roots),
        'media_photos': len(manifest_rows),
        'media_missing': len(details['media_missing']),
        'media_skipped_nonphoto': len(details['media_skipped_nonphoto']),
    }
    return notes, counts, manifest_rows, details


def render_note(note):
    iso = note['date'].astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
    return ('---\n'
            f"date: '{iso}'\n"
            f"tweetId: '{note['tweetId']}'\n"
            f"source: '{note['source']}'\n"
            f"tweetCount: {note['tweetCount']}\n"
            '---\n'
            '\n'
            f"{note['body']}\n")


def existing_by_tweet_id(notes_dir):
    out = {}
    if not os.path.isdir(notes_dir):
        return out
    for name in sorted(os.listdir(notes_dir)):
        if not name.endswith('.md'):
            continue
        path = os.path.join(notes_dir, name)
        with open(path, encoding='utf-8') as f:
            m = FRONTMATTER_ID_RE.search(f.read())
        if m:
            out[m.group(1)] = path
    return out


def write_if_changed(path, content):
    if os.path.isfile(path):
        with open(path, encoding='utf-8') as f:
            if f.read() == content:
                return False
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    return True


def emit(notes, notes_dir):
    """Write notes keyed by tweetId; returns how many files changed."""
    os.makedirs(notes_dir, exist_ok=True)
    existing = existing_by_tweet_id(notes_dir)
    taken = {os.path.basename(p) for p in existing.values()}
    written = 0
    for note in sorted(notes, key=lambda n: n['date']):
        path = existing.get(note['tweetId'])
        if path is None:
            base = note['date'].astimezone(timezone.utc).strftime('%Y%m%d-%H%M%S')
            name, suffix = base + '.md', 2
            while name in taken:
                name = f'{base}-{suffix}.md'
                suffix += 1
            taken.add(name)
            path = os.path.join(notes_dir, name)
        if write_if_changed(path, render_note(note)):
            written += 1
    return written


def write_report(counts, details):
    lines = [f'{k}: {v}' for k, v in counts.items()]
    for name in ('empties_flagged', 'media_missing', 'media_skipped_nonphoto',
                 'orphan_roots', 'chain_dropped'):
        if details[name]:
            lines += ['', f'# {name}']
            lines += [f'  {item}' for item in details[name]]
    write_if_changed(REPORT_PATH, '\n'.join(lines) + '\n')


def stage_media(manifest_rows, media_root, dest):
    os.makedirs(dest, exist_ok=True)
    for row in manifest_rows:
        shutil.copyfile(os.path.join(media_root, row['archive']),
                        os.path.join(dest, row['staged']))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive-root',
                        help='Archive location override (default: auto-locate).')
    parser.add_argument('--stage-media', metavar='DIR',
                        help='Also copy referenced photos into DIR under their staged names.')
    args = parser.parse_args()
    try:
        root = args.archive_root or backup_paths.twitter_archive_root()
    except RuntimeError as err:
        print(err)
        return 1
    tweets, account = load_archive(root)
    media_root = os.path.join(root, 'data', 'tweets_media')
    notes, counts, manifest_rows, details = build_notes(tweets, account, media_root)
    written = emit(notes, NOTES_DIR)
    write_report(counts, details)
    write_if_changed(MEDIA_MANIFEST_PATH, json.dumps(manifest_rows, indent=2) + '\n')
    if args.stage_media:
        stage_media(manifest_rows, media_root, args.stage_media)
        print(f'staged {len(manifest_rows)} media file(s) -> {args.stage_media}')
    for key, value in counts.items():
        print(f'{key}: {value}')
    print(f'note files written or updated: {written}')
    reconciled = counts['archive_total'] == (
        counts['kept_tweets'] + counts['retweets_dropped']
        + counts['replies_dropped'] + counts['empties_flagged'])
    print('reconciliation:', 'OK' if reconciled else 'MISMATCH')
    return 0 if reconciled else 1


if __name__ == '__main__':
    sys.exit(main())
