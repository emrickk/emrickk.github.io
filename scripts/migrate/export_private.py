"""Export WordPress private posts and superseded pages into a LOCAL, NEVER-COMMITTED
archive outside the repo.

Pipeline: parse dump -> reuse convert_posts's title/slug/body helpers -> write
private-posts/*.md under the backup root located via backup_paths.py (outside
the repo, NOT inside it) -> never touch anything under the repo working tree.

WHAT GETS WRITTEN (27 files total):
  - The 22 `post` rows with status=private -> one .md each, same frontmatter
    shape as convert_posts.py's published output PLUS a `status: private` line.
  - 4 pages superseded by theme features (Archive, Leave Comments, 减肥,
    About the Blog) -> one .md each with `status: archived-page`.
  - The "About" and "About Me" pages -> merged into a single _about-source.md
    (plain concatenation under '## About' / '## About Me' headings) for
    Task 8 to draw on when writing the site's about blurb.

IMAGES: bodies go through convert_posts.convert_body(), which rewrites emrick.us
upload URLs to the same '/uploads/<Y>/<M>/<file>' form used by published posts.
That rewrite is purely textual — it never copies a file. Any rewritten ref whose
target is NOT already present in the repo's public/uploads/ (i.e. wasn't already
copied over for a published post) is left pointing at nothing; the original file
stays safely in the read-only WordPress backup (site/wp-content/uploads/) and is
NEVER copied into the repo for private content. Such refs are only reported to
stdout when this script is run directly — never written into the repo's shared
scripts/migrate/report.txt, which is git-tracked.

PRIVACY / SAFETY:
  - PRIVATE_DIR resolves outside the repo, under the backup root (see
    backup_paths.py); this module performs no writes, deletes, or reads
    anywhere under REPO except the read-only imports of
    convert_posts/categories/wp_parser and reading public/uploads/ to
    check file existence (never writing there).
  - This script must never write to scripts/migrate/report.txt: that file is
    git-tracked and shared with convert_posts.py/export_comments.py, and mixing
    private-content bookkeeping into it would be a leak vector.
"""
import os

from categories import build_mapping, post_categories
from convert_posts import (UPLOADS_ROOT, convert_body, emitted_img_re,
                            make_slug, make_title, yaml_single_quote)
from wp_parser import load_dump
import backup_paths

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
DUMP_PATH = backup_paths.dump_path()
PUBLIC_UPLOADS = os.path.join(REPO, 'public', 'uploads')

# Deliberately OUTSIDE the repo, in the read-only backup tree — these files
# must NEVER be committed. Do not move this under REPO.
PRIVATE_DIR = backup_paths.private_posts_dir()
MANIFEST_PATH = os.path.join(PRIVATE_DIR, '.manifest.txt')  # also outside the repo

# Pages superseded by theme features; archived standalone with status: archived-page.
ARCHIVED_PAGE_TITLES = ('Archive', 'Leave Comments', '减肥', 'About the Blog')
# Pages merged into a single source file for Task 8's about blurb.
ABOUT_TITLES = ('About', 'About Me')


def _missing_image_refs(body):
    """Y/M/file refs rewritten into `body` that aren't in the repo's public/uploads/.

    Purely a reporting aid — never mutates `body` and never copies anything.
    De-duplicated: the same ref commonly appears twice in one body (e.g. an
    <a> wrapping an <img> with the same URL in both href and src).
    """
    return sorted({ref for ref in emitted_img_re().findall(body)
                   if not os.path.isfile(os.path.join(PUBLIC_UPLOADS, ref))})


def _load_manifest():
    if os.path.exists(MANIFEST_PATH):
        with open(MANIFEST_PATH, encoding='utf-8') as f:
            return [line.strip() for line in f if line.strip()]
    return []


def _sync_output(files):
    """Write-only-if-changed, scoped entirely to PRIVATE_DIR (mirrors
    convert_posts._sync_output's iCloud-friendly pattern: minimal churn, and
    only ever deletes files this script itself previously wrote per the
    manifest — never a file it didn't write).
    """
    os.makedirs(PRIVATE_DIR, exist_ok=True)
    for slug in _load_manifest():
        if slug not in files:
            path = os.path.join(PRIVATE_DIR, f'{slug}.md')
            if os.path.exists(path):
                os.remove(path)
    for slug, content in files.items():
        path = os.path.join(PRIVATE_DIR, f'{slug}.md')
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


def export_all():
    dump = load_dump(DUMP_PATH)
    cats = post_categories(dump)
    mapping = build_mapping(cats)

    private_posts = sorted(
        (p for p in dump['wp_posts'] if p[20] == 'post' and p[7] == 'private'),
        key=lambda p: int(p[0]))
    pages_by_title = {p[5]: p for p in dump['wp_posts'] if p[20] == 'page'}

    rows = [(p[0], p[2], p[5]) for p in private_posts]
    untitled_titles = make_title(rows)

    taken_slugs = set()   # shared across private posts + archived pages: one flat namespace
    out_files = {}         # slug -> full file content
    titles_written = {}    # slug -> (title, kind), for the run summary only
    missing_images = {}    # slug -> [Y/M/file, ...] not present in repo public/uploads

    # 22 private posts -> same frontmatter shape as published posts, plus status: private.
    for p in private_posts:
        pid, date_full, title_raw, name_raw = p[0], p[2], p[5] or '', p[11] or ''
        date = (date_full or '').split(' ')[0]
        title = untitled_titles.get(pid, title_raw)
        slug = make_slug(name_raw, date, pid, taken_slugs)
        taken_slugs.add(slug)

        old_cat = cats.get(pid, '')
        category = mapping[old_cat] if old_cat else '随笔'
        body = convert_body(p[4] or '', UPLOADS_ROOT)
        missing = _missing_image_refs(body)
        if missing:
            missing_images[slug] = missing

        out_files[slug] = (
            '---\n'
            f'title: {yaml_single_quote(title)}\n'
            "description: ''\n"
            f"pubDate: '{date}'\n"
            f'category: {yaml_single_quote(category)}\n'
            'status: private\n'
            '---\n\n' + body + '\n')
        titles_written[slug] = (title, 'private-post')

    # 4 pages superseded by theme features -> archived standalone, one file each.
    for title in ARCHIVED_PAGE_TITLES:
        p = pages_by_title[title]
        pid, date_full, name_raw = p[0], p[2], p[11] or ''
        date = (date_full or '').split(' ')[0]
        slug = make_slug(name_raw, date, pid, taken_slugs)
        taken_slugs.add(slug)

        body = convert_body(p[4] or '', UPLOADS_ROOT)
        missing = _missing_image_refs(body)
        if missing:
            missing_images[slug] = missing

        out_files[slug] = (
            '---\n'
            f'title: {yaml_single_quote(title)}\n'
            "description: ''\n"
            f"pubDate: '{date}'\n"
            'status: archived-page\n'
            '---\n\n' + body + '\n')
        titles_written[slug] = (title, 'archived-page')

    # "About" + "About Me" -> merged plain-text source file (no frontmatter);
    # Task 8 draws on this for the site's about blurb.
    about_parts = []
    for title in ABOUT_TITLES:
        p = pages_by_title[title]
        body = convert_body(p[4] or '', UPLOADS_ROOT)
        missing = _missing_image_refs(body)
        if missing:
            missing_images.setdefault('_about-source', []).extend(missing)
        about_parts.append(f'## {title}\n\n{body}\n')
    out_files['_about-source'] = '\n'.join(about_parts)
    titles_written['_about-source'] = ('About + About Me (merged)', 'about-source')

    # Fail loudly rather than silently write fewer files than expected.
    assert len(out_files) == 27, (
        f'expected 27 output files (22 private posts + 4 archived pages + '
        f'_about-source.md), got {len(out_files)}')

    _sync_output(out_files)
    _write_manifest(out_files)

    return {
        'files_written': len(out_files),
        'titles': titles_written,
        'missing_images': missing_images,
    }


if __name__ == '__main__':
    report = export_all()
    print(f"files_written={report['files_written']}")
    print(f"private_dir={PRIVATE_DIR}")
    n_missing = sum(len(v) for v in report['missing_images'].values())
    print(f'image_refs_not_in_public_uploads={n_missing}')
    if report['missing_images']:
        print('(refs left pointing at nothing; source file stays in the WP backup)')
        for slug, refs in sorted(report['missing_images'].items()):
            for ref in refs:
                print(f'  {slug}: {ref}')
