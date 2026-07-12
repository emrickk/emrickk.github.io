"""Export historical WordPress comments into per-post JSON files, published posts only.

Pipeline: parse dump -> keep approved comments -> keep only comments whose
post belongs to a migrated published post (via convert_posts.published_slug_map,
so the post -> slug mapping can never drift from what convert_posts.py wrote) ->
write src/data/comments/<slug>.json -> persist scripts/migrate/report.txt.

PRIVACY: the dump's wp_comments rows carry the commenter's email, url, and IP
(columns 3/4/5). Those are never read into the output dict below — only
author/date/body (columns 2/6/8) are copied. This is the single choke point
where PII would leak if a field were ever added; keep it that way.

SECURITY: bodies stay as HTML (the comments component renders them with
set:html to preserve paragraphs/links/emoticons), so every body is passed
through sanitize_body() before writing: script-capable elements are removed
and event-handler / javascript: attributes are defused.
"""
import json
import os
import re

from bs4 import BeautifulSoup

from convert_posts import published_slug_map
from wp_parser import load_dump
import backup_paths

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
DUMP_PATH = backup_paths.dump_path()
COMMENTS_DIR = os.path.join(REPO, 'src', 'data', 'comments')
REPORT_PATH = os.path.join(HERE, 'report.txt')
MANIFEST_PATH = os.path.join(HERE, '.comments_manifest.txt')


# Elements that can execute or embed active content; removed tag + content.
_DANGEROUS_TAGS = ('script', 'style', 'iframe', 'object', 'embed')
# Collapses whitespace/control chars so "java\nscript:" can't sneak past the check.
_WS_RE = re.compile(r'[\s\x00-\x1f]+')


def sanitize_body(html):
    """Defuse script vectors in a comment body while leaving benign HTML alone.

    - <script>/<style>/<iframe>/<object>/<embed> are removed entirely (tag + content).
    - on* event-handler attributes are stripped; href/src values whose scheme is
      javascript: are replaced with '#'.
    - Benign markup (p, a, em, strong, blockquote, img, br, ...) passes through.

    Returns the ORIGINAL string byte-identical when nothing dangerous was found
    (no re-serialization), so sanitizing the existing archive never churns clean
    files — BeautifulSoup's serializer would otherwise normalize harmless things
    like '<br />' vs '<br/>' and rewrite all 82 files for nothing.
    """
    soup = BeautifulSoup(html or '', 'html.parser')
    dirty = False
    for el in soup.find_all(_DANGEROUS_TAGS):
        el.decompose()
        dirty = True
    for el in soup.find_all(True):
        for attr in list(el.attrs):
            if attr.lower().startswith('on'):
                del el.attrs[attr]
                dirty = True
            elif attr.lower() in ('href', 'src'):
                val = el.attrs[attr]
                if isinstance(val, str) and _WS_RE.sub('', val).lower().startswith('javascript:'):
                    el.attrs[attr] = '#'
                    dirty = True
    return str(soup) if dirty else html


def _load_manifest():
    if os.path.exists(MANIFEST_PATH):
        with open(MANIFEST_PATH, encoding='utf-8') as f:
            return [line.strip() for line in f if line.strip()]
    return []


def _sync_output(files):
    """Write the generated comment files, touching the filesystem as little as
    possible: only rewrite a file if its content actually changed, and only
    delete previously-generated files (per the manifest) that dropped out of
    the current slug set — never a file this script didn't write. Mirrors
    convert_posts._sync_output's write-only-if-changed + prune pattern, which
    matters here too: this repo lives in an iCloud-synced folder.
    """
    for slug in _load_manifest():
        if slug not in files:
            path = os.path.join(COMMENTS_DIR, f'{slug}.json')
            if os.path.exists(path):
                os.remove(path)
    for slug, content in files.items():
        path = os.path.join(COMMENTS_DIR, f'{slug}.json')
        if os.path.exists(path):
            with open(path, encoding='utf-8') as f:
                if f.read() == content:
                    continue
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)


def _write_manifest(slugs):
    content = ''.join(slug + '\n' for slug in slugs)
    if os.path.exists(MANIFEST_PATH):
        with open(MANIFEST_PATH, encoding='utf-8') as f:
            if f.read() == content:
                return
    with open(MANIFEST_PATH, 'w', encoding='utf-8') as f:
        f.write(content)


def _write_report(n_exported, n_excluded):
    line = f'comments_exported: {n_exported}'
    if os.path.exists(REPORT_PATH):
        with open(REPORT_PATH, encoding='utf-8') as f:
            lines = f.read().split('\n')
    else:
        lines = ['']

    replaced = False
    for i, existing in enumerate(lines):
        if existing.startswith('comments_exported:'):
            lines[i] = line
            replaced = True
            break
    if not replaced:
        # Insert alongside the other summary lines at the top of the report
        # (matches convert_posts.py's report layout: summary lines first,
        # then a blank line, then detail sections).
        insert_at = 0
        for i, existing in enumerate(lines):
            if existing == '':
                insert_at = i
                break
            insert_at = i + 1
        lines.insert(insert_at, line)

    content = '\n'.join(lines)
    if not content.endswith('\n'):
        content += '\n'
    if os.path.exists(REPORT_PATH):
        with open(REPORT_PATH, encoding='utf-8') as f:
            if f.read() == content:
                return
    with open(REPORT_PATH, 'w', encoding='utf-8') as f:
        f.write(content)


def export_all():
    dump = load_dump(DUMP_PATH)
    slug_map = published_slug_map(dump)  # {post_id: slug}, published posts only

    approved = [c for c in dump['wp_comments'] if c[10] == '1']
    excluded = 0

    by_slug = {}
    for c in approved:
        pid = c[1]
        slug = slug_map.get(pid)
        if slug is None:
            excluded += 1  # comment on a private post, a page, or an unmigrated post
            continue
        by_slug.setdefault(slug, []).append({
            'author': c[2] or '',
            'date': c[6] or '',
            'body': sanitize_body(c[8] or ''),
        })

    os.makedirs(COMMENTS_DIR, exist_ok=True)

    out_files = {}
    n_exported = 0
    for slug, comments in by_slug.items():
        comments.sort(key=lambda c: c['date'])  # chronological; flattens threads
        n_exported += len(comments)
        out_files[slug] = json.dumps(comments, ensure_ascii=False, indent=2) + '\n'

    _sync_output(out_files)
    _write_manifest(out_files)
    _write_report(n_exported, excluded)

    return n_exported


if __name__ == '__main__':
    n = export_all()
    print(f'comments_exported={n}')
