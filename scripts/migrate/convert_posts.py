"""Convert WordPress posts (from the SQL dump) into Markdown files with frontmatter.

Pipeline: parse dump -> resolve title/slug/category per post -> HTML body ->
Markdown -> write src/content/posts/<slug>.md -> persist scripts/migrate/report.txt.
"""
import os
import re
from collections import defaultdict
from urllib.parse import unquote, urlparse

from markdownify import markdownify as md

from categories import build_mapping, post_categories
from wp_parser import load_dump
import backup_paths

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
DUMP_PATH = backup_paths.dump_path()
UPLOADS_ROOT = backup_paths.uploads_root()
POSTS_DIR = os.path.join(REPO, 'src', 'content', 'posts')
REPORT_PATH = os.path.join(HERE, 'report.txt')
MANIFEST_PATH = os.path.join(HERE, '.posts_manifest.txt')

# WordPress emoticon plugins whose image host has gone dark; the images themselves
# are decorative and worthless once dead, so the whole <img> tag is dropped.
DEAD_HOSTS = {'smzdm.com', 'res.smzdm.com', 'www.smzdm.com', 'angelived.org', 'www.zbiy.com'}

COMMENT_RE = re.compile(r'<!--.*?-->', re.DOTALL)
IMG_TAG_RE = re.compile(r'<img\b[^>]*>', re.IGNORECASE)
SRC_ATTR_RE = re.compile(r'src\s*=\s*["\']([^"\']+)["\']', re.IGNORECASE)

# Matches emrick.us upload references with optional scheme/www, anchored so it does
# NOT match the host embedded inside a different proxy URL (e.g. i0.wp.com/emrick.us/...),
# which is left alone as an "other external ref".
LOCAL_IMG_RE = re.compile(
    r'(?<![\w./])(?:https?://)?(?:www\.)?emrick\.us/wp-content/uploads/'
    r'(\d{4})/(\d{2})/([^\s"\'<>)]+)',
    re.IGNORECASE,
)
SIZE_SUFFIX_RE = re.compile(r'^(.*)-\d+x\d+(\.[A-Za-z0-9]+)$')
SLUG_OK_RE = re.compile(r'[a-z0-9_-]+')
PARA_SPLIT_RE = re.compile(r'\n\s*\n+')
HTML_TAG_RE = re.compile(r'</?[a-zA-Z]')
# A line starting with 3+ tildes/backticks opens a CommonMark code fence; posts use
# such runs as plain-text visual dividers (e.g. post 962's ~~~~~), so they must be
# escaped in the tag-free chunk path or the rest of the post renders as code.
FENCE_LINE_RE = re.compile(r'^(\s*)([~`]{3,})', re.MULTILINE)


def emitted_img_re():
    """Regex for local upload refs in EMITTED markdown.

    The lookbehind rejects matches whose '/uploads/' sits inside a longer URL path
    (e.g. Jetpack proxies: i0.wp.com/emrick.us/wp-content/uploads/... are external
    refs left as-is by design and must not count as local images). Built per-call
    because the ref prefix depends on BASE_PREFIX.
    """
    prefix = re.escape(os.environ.get('BASE_PREFIX', ''))
    return re.compile(
        r'(?<![\w.%~:-])' + prefix + r'/uploads/(\d{4}/\d{2}/[^)\s"\'<>\]?#]+)')


def make_title(rows):
    """rows: iterable of (post_id, date_str, title).

    Returns {post_id: title} for posts whose title is empty/whitespace only.
    Untitled posts get the post date 'YYYY-MM-DD' as title; N untitled posts sharing
    the same calendar day get '·2'..'·N' suffixes, assigned in post-ID order
    (the first of the day gets no suffix).
    """
    by_day = defaultdict(list)
    for pid, date_str, title in rows:
        if (title or '').strip():
            continue
        day = (date_str or '').split(' ')[0]
        by_day[day].append(pid)

    result = {}
    for day, pids in by_day.items():
        for i, pid in enumerate(sorted(pids, key=lambda x: int(x))):
            result[pid] = day if i == 0 else f'{day}·{i + 1}'
    return result


def make_slug(name, date, pid, taken):
    """name: WordPress post_name (raw, possibly percent-encoded or empty).
    date: 'YYYY-MM-DD'. pid: post ID string. taken: set of slugs already assigned.

    Pure-ASCII means letters/digits/hyphens/underscores after lowercasing; a '%' in
    the name means it's percent-encoded (i.e. not meaningfully ASCII) and is treated
    as non-ASCII even though the raw bytes happen to be ASCII characters.
    """
    slug = None
    if name and '%' not in name:
        lowered = name.lower()
        if SLUG_OK_RE.fullmatch(lowered):
            slug = lowered
    if slug is None:
        slug = f'{date}-p{pid}'
    if slug in taken:
        slug = f'{slug}-p{pid}'
    return slug


def is_slug_collision(name, date, pid, taken):
    """True when the BASE slug (what make_slug picks with nothing taken) is already
    assigned. This is the pre-resolution check the report records — testing the
    post-resolution slug against `taken` would never fire."""
    return make_slug(name, date, pid, set()) in taken


def _strip_dead_images(html):
    """Remove whole <img> tags whose src host is a dead emoticon host."""
    def repl(m):
        tag = m.group(0)
        msrc = SRC_ATTR_RE.search(tag)
        if msrc and urlparse(msrc.group(1)).netloc.lower() in DEAD_HOSTS:
            return ''
        return tag
    return IMG_TAG_RE.sub(repl, html)


def rewrite_images(html, uploads_root):
    """Rewrite emrick.us upload image refs to {BASE_PREFIX}/uploads/<Y>/<M>/<file>,
    stripping a '-WxH' size suffix when the original (un-suffixed) file exists on disk.

    Returns (rewritten_html, used) where `used` is a set of 'Y/M/file' strings for
    every local image actually referenced (post-rewrite filename).
    """
    base_prefix = os.environ.get('BASE_PREFIX', '')
    used = set()

    def repl(m):
        year, month, raw_name = m.group(1), m.group(2), m.group(3)
        name = unquote(raw_name)
        for sep in ('?', '#'):
            if sep in name:
                name = name.split(sep, 1)[0]
        candidate = name
        sm = SIZE_SUFFIX_RE.match(name)
        if sm:
            desized = sm.group(1) + sm.group(2)
            if os.path.isfile(os.path.join(uploads_root, year, month, desized)):
                candidate = desized
        used.add(f'{year}/{month}/{candidate}')
        return f'{base_prefix}/uploads/{year}/{month}/{candidate}'

    out = LOCAL_IMG_RE.sub(repl, html)
    return out, used


def yaml_single_quote(s):
    return "'" + (s or '').replace("'", "''") + "'"


def convert_body(html, uploads_root):
    """WordPress HTML -> Markdown body text (string). See module docstring.

    Image accounting deliberately does NOT flow through here: the single source of
    truth for images_used is the emitted-markdown scan in convert_all (via
    emitted_img_re), because markdownify may discard refs that only lived in
    attribute noise. Task 5's copy step must scan the emitted .md files the same way.
    """
    html = html or ''
    html = _strip_dead_images(html)
    html, _ = rewrite_images(html, uploads_root)
    html = COMMENT_RE.sub('', html)  # drops <!--more--> and all Gutenberg block markers

    # Classic-era bodies are wpautop plain text: a blank line is the ONLY paragraph
    # separator WordPress recognizes. Feeding the whole body to markdownify at once
    # collapses blank lines (BeautifulSoup/markdownify normalize inter-tag whitespace),
    # so split on blank lines ourselves first and convert chunk-by-chunk.
    parts = []
    for chunk in PARA_SPLIT_RE.split(html):
        chunk = chunk.strip()
        if not chunk:
            continue
        is_plain = not HTML_TAG_RE.search(chunk)
        out = md(chunk, heading_style='ATX').strip()
        if out and is_plain:
            # wpautop rendered intra-paragraph single \n as <br>. CommonMark treats a
            # lone \n as a soft break, which joins CJK lines with NOTHING between them,
            # destroying verse/stanza structure — so emit backslash hard breaks.
            # Only for tag-free chunks: HTML chunks already get hard breaks from
            # markdownify's <br> handling and must not be double-processed (this also
            # keeps <pre>/<code> content out of reach automatically).
            out = FENCE_LINE_RE.sub(r'\1\\\2', out)  # ~~~ / ``` dividers stay literal
            out = out.replace('\n', '\\\n')
        if out:
            parts.append(out)
    return '\n\n'.join(parts)


def published_slug_map(dump):
    """Return {post_id: slug} for every migrated published post.

    Pure function (no filesystem writes) that mirrors the slug-resolution logic
    in convert_all()'s main loop, so other scripts (e.g. export_comments.py) can
    obtain the same post -> slug mapping without a side-channel file. Slug
    resolution depends only on post_name/date/pid/collision order, not on title
    or body, so this is a faithful, cheap re-derivation.
    """
    posts = [p for p in dump['wp_posts'] if p[20] == 'post' and p[7] == 'publish']
    posts.sort(key=lambda p: int(p[0]))  # deterministic, post-ID order

    taken_slugs = set()
    slug_map = {}
    for p in posts:
        pid, date_full, name_raw = p[0], p[2], p[11] or ''
        date = (date_full or '').split(' ')[0]
        slug = make_slug(name_raw, date, pid, taken_slugs)
        taken_slugs.add(slug)
        slug_map[pid] = slug
    return slug_map


def _load_manifest():
    if os.path.exists(MANIFEST_PATH):
        with open(MANIFEST_PATH, encoding='utf-8') as f:
            return [line.strip() for line in f if line.strip()]
    return []


def _sync_output(files):
    """Write the generated posts, touching the filesystem as little as possible.

    `files`: {slug: full_file_content}. Only files whose content actually changed
    are written, and only previously-generated files (manifest) that dropped out of
    the slug set are deleted — never files this script didn't write (theme samples).
    Minimal churn matters beyond politeness: this repo lives in an iCloud-synced
    folder, and a delete-then-rewrite of 318 files races the sync daemon, which
    resurrects in-flight copies as 'name 2.md' conflict artifacts.
    """
    for slug in _load_manifest():
        if slug not in files:
            path = os.path.join(POSTS_DIR, f'{slug}.md')
            if os.path.exists(path):
                os.remove(path)
    for slug, content in files.items():
        path = os.path.join(POSTS_DIR, f'{slug}.md')
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


# Summary-line prefixes owned by OTHER migration scripts that also write into
# report.txt (e.g. export_comments.py). _write_report rebuilds the file from
# scratch, so these lines must be carried over or a standalone convert_all()
# re-run would silently drop them until the other script runs again.
_FOREIGN_REPORT_PREFIXES = ('comments_exported:',)


def _write_report(report):
    preserved = []
    if os.path.exists(REPORT_PATH):
        with open(REPORT_PATH, encoding='utf-8') as f:
            preserved = [line for line in f.read().split('\n')
                         if line.startswith(_FOREIGN_REPORT_PREFIXES)]
    lines = [
        f"posts_written: {report['posts_written']}",
        f"images_used: {len(report['images_used'])}",
        f"flagged_fffd: {len(report['flagged_fffd'])}",
        f"slug_collisions: {len(report['slug_collisions'])}",
    ] + preserved + [
        '',
        'Flagged posts (body contains U+FFFD):',
    ]
    lines += [f'  {pid}' for pid in report['flagged_fffd']] or ['  (none)']
    lines += ['', 'Slug collisions (post_id -> final slug):']
    lines += [f'  {pid} -> {slug}' for pid, slug in report['slug_collisions']] or ['  (none)']
    lines += ['', 'Images used (Y/M/file):']
    lines += [f'  {img}' for img in sorted(report['images_used'])] or ['  (none)']
    content = '\n'.join(lines) + '\n'
    if os.path.exists(REPORT_PATH):
        with open(REPORT_PATH, encoding='utf-8') as f:
            if f.read() == content:
                return
    with open(REPORT_PATH, 'w', encoding='utf-8') as f:
        f.write(content)


def convert_all():
    dump = load_dump(DUMP_PATH)
    posts = [p for p in dump['wp_posts'] if p[20] == 'post' and p[7] == 'publish']
    posts.sort(key=lambda p: int(p[0]))  # deterministic, post-ID order

    cats = post_categories(dump)
    mapping = build_mapping(cats)

    rows = [(p[0], p[2], p[5]) for p in posts]
    untitled_titles = make_title(rows)
    slug_map = published_slug_map(dump)

    os.makedirs(POSTS_DIR, exist_ok=True)

    taken_slugs = set()
    images_used = set()
    flagged_fffd = []
    slug_collisions = []
    out_files = {}  # slug -> full file content, written in one pass at the end
    img_re = emitted_img_re()

    for p in posts:
        pid, date_full, title_raw, name_raw = p[0], p[2], p[5] or '', p[11] or ''
        date = (date_full or '').split(' ')[0]
        title = untitled_titles.get(pid, title_raw)

        # Collision bookkeeping (for the report) still needs the running `taken`
        # set built incrementally; the resolved slug itself comes from the
        # shared published_slug_map() so the two never drift apart.
        collided = is_slug_collision(name_raw, date, pid, taken_slugs)
        slug = slug_map[pid]
        if collided:
            slug_collisions.append((pid, slug))
        taken_slugs.add(slug)

        old_cat = cats.get(pid, '')
        category = mapping[old_cat] if old_cat else '随笔'  # 随笔

        content = p[4] or ''
        if '�' in content:
            flagged_fffd.append(pid)
        body = convert_body(content, UPLOADS_ROOT)
        # Report images from the refs actually present in the EMITTED markdown, not
        # from what rewrite_images saw mid-pipeline: markdownify discards refs living
        # only in attribute noise (e.g. data-* attrs), and those must not inflate the
        # count that Task 5's copy step and the verification gate consume.
        images_used |= set(img_re.findall(body))

        frontmatter = (
            '---\n'
            f'title: {yaml_single_quote(title)}\n'
            "description: ''\n"
            f"pubDate: '{date}'\n"
            f'category: {yaml_single_quote(category)}\n'
            '---\n\n'
        )
        out_files[slug] = frontmatter + body + '\n'

    # Fail loudly if any slug was assigned twice: a duplicate means one post's file
    # silently overwrote another's, and the 318-file downstream count would still pass.
    assert len(taken_slugs) == len(posts) and len(out_files) == len(posts), (
        f'{len(posts)} posts produced only {len(taken_slugs)} distinct slugs — '
        f'slug resolution let two posts share a filename')

    _sync_output(out_files)
    _write_manifest(out_files)

    report = {
        'posts_written': len(posts),
        'images_used': images_used,
        'flagged_fffd': flagged_fffd,
        'slug_collisions': slug_collisions,
    }
    _write_report(report)
    return report


if __name__ == '__main__':
    print(convert_all())
