#!/usr/bin/env python3
"""Derive a heroImage for each post from its FIRST body image.

For every post in src/content/posts/*.md this:

1. Finds the first body reference to /uploads/YYYY/MM/<file> whose extension is an
   image (jpe?g|png|gif|webp|bmp). convert_posts.emitted_img_re matches *any*
   uploads ref (including .pdf/.mp3/.zip attachments), so we reuse that canonical
   detector and then filter by extension.
2. Copies public/uploads/<rel> -> src/assets/hero/<rel> (created only when the
   destination is missing or its bytes differ — the repo is iCloud-synced, so we
   avoid needless writes).
3. Inserts  heroImage: '../../assets/hero/<rel>'  into the post frontmatter, after
   the pubDate line (falling back to the category line). The path is RELATIVE to
   the post file because the content schema types heroImage as image(), which must
   resolve to a real file under src/ — NOT a /public URL.

The whole run is idempotent: posts that already carry a heroImage line are left
untouched, and unchanged assets/posts are not rewritten.
"""
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from convert_posts import emitted_img_re  # noqa: E402  (needs HERE on sys.path)

REPO_ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
POSTS_DIR = os.path.join(REPO_ROOT, 'src', 'content', 'posts')
UPLOADS_DIR = os.path.join(REPO_ROOT, 'public', 'uploads')
HERO_DIR = os.path.join(REPO_ROOT, 'src', 'assets', 'hero')

# Image extensions we accept as a hero. Deliberately excludes non-image upload
# refs like .mp3/.pdf/.zip that share the /uploads/ path.
IMAGE_EXT_RE = re.compile(r'\.(?:jpe?g|png|gif|webp|bmp)$', re.IGNORECASE)

HERO_KEY_RE = re.compile(r'\s*heroImage\s*:')
PUBDATE_KEY_RE = re.compile(r'\s*pubDate\s*:')
CATEGORY_KEY_RE = re.compile(r'\s*category\s*:')


def first_image_ref(body):
    """Return the first /uploads ref with an image extension as 'YYYY/MM/<file>'.

    Uses convert_posts.emitted_img_re (which matches any uploads ref) and keeps
    the first match whose extension is an image; returns None if none qualify.
    """
    for match in emitted_img_re().finditer(body):
        rel = match.group(1)
        if IMAGE_EXT_RE.search(rel):
            return rel
    return None


def build_hero_line(rel):
    """The exact frontmatter line for a given 'YYYY/MM/<file>' hero path."""
    return f"heroImage: '../../assets/hero/{rel}'"


def _frontmatter_bounds(lines):
    """Return (open_idx, close_idx) of the '---' fences, or None if no frontmatter."""
    if not lines or lines[0].strip() != '---':
        return None
    for i in range(1, len(lines)):
        if lines[i].strip() == '---':
            return 0, i
    return None


def has_hero_image(text):
    """True if the frontmatter already declares a heroImage."""
    lines = text.split('\n')
    bounds = _frontmatter_bounds(lines)
    if bounds is None:
        return False
    _, close = bounds
    return any(HERO_KEY_RE.match(l) for l in lines[1:close])


def insert_hero_image(text, rel):
    """Insert a heroImage frontmatter line for `rel`, idempotently.

    Placed after the pubDate line (falling back to category, else the end of the
    frontmatter). If a heroImage line already exists, the text is returned
    unchanged so re-running never duplicates or replaces it.
    """
    lines = text.split('\n')
    bounds = _frontmatter_bounds(lines)
    if bounds is None:
        return text
    _, close = bounds
    fm = lines[1:close]

    if any(HERO_KEY_RE.match(l) for l in fm):
        return text

    pub_idx = cat_idx = None
    for idx, line in enumerate(fm):
        if pub_idx is None and PUBDATE_KEY_RE.match(line):
            pub_idx = idx
        if cat_idx is None and CATEGORY_KEY_RE.match(line):
            cat_idx = idx

    if pub_idx is not None:
        insert_at = pub_idx + 1
    elif cat_idx is not None:
        insert_at = cat_idx + 1
    else:
        insert_at = len(fm)

    new_fm = fm[:insert_at] + [build_hero_line(rel)] + fm[insert_at:]
    new_lines = [lines[0]] + new_fm + lines[close:]
    return '\n'.join(new_lines)


def _split_body(text):
    """Return the post body (everything after the closing frontmatter fence)."""
    lines = text.split('\n')
    bounds = _frontmatter_bounds(lines)
    if bounds is None:
        return text
    _, close = bounds
    return '\n'.join(lines[close + 1:])


def _files_differ(src, dst):
    if not os.path.exists(dst):
        return True
    if os.path.getsize(src) != os.path.getsize(dst):
        return True
    with open(src, 'rb') as a, open(dst, 'rb') as b:
        return a.read() != b.read()


def copy_if_changed(src, dst):
    """Copy src -> dst only when dst is missing or differs. Returns True if copied."""
    if not _files_differ(src, dst):
        return False
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)
    return True


def main():
    post_files = sorted(
        os.path.join(POSTS_DIR, f)
        for f in os.listdir(POSTS_DIR)
        if f.endswith('.md') or f.endswith('.mdx')
    )

    updated = []
    copied = 0
    already = 0
    no_image = 0
    missing = []

    for path in post_files:
        with open(path, encoding='utf-8') as fh:
            text = fh.read()

        if has_hero_image(text):
            already += 1
            continue

        rel = first_image_ref(_split_body(text))
        if rel is None:
            no_image += 1
            continue

        src = os.path.join(UPLOADS_DIR, rel)
        if not os.path.isfile(src):
            missing.append((os.path.basename(path), rel))
            continue

        if copy_if_changed(src, os.path.join(HERO_DIR, rel)):
            copied += 1

        new_text = insert_hero_image(text, rel)
        if new_text != text:
            with open(path, 'w', encoding='utf-8') as fh:
                fh.write(new_text)
            updated.append((os.path.basename(path), rel))

    print(f'Posts scanned:            {len(post_files)}')
    print(f'Already had heroImage:    {already}')
    print(f'No body image:            {no_image}')
    print(f'Posts updated:            {len(updated)}')
    print(f'Assets copied:            {copied}')
    if missing:
        print(f'\nSKIPPED (first image missing on disk): {len(missing)}')
        for name, rel in missing:
            print(f'  {name}: {rel}')

    if os.path.isdir(HERO_DIR):
        total = sum(
            os.path.getsize(os.path.join(root, f))
            for root, _, files in os.walk(HERO_DIR)
            for f in files
        )
        print(f'\nsrc/assets/hero total size: {total / 1024 / 1024:.2f} MB')


if __name__ == '__main__':
    main()
