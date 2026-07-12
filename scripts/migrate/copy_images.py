"""Copy WordPress upload images referenced by emitted post markdown into public/uploads/.

Scans src/content/posts/*.md for local image refs and copies each referenced
file from the read-only WordPress backup (site/wp-content/uploads/) into
public/uploads/, preserving the YYYY/MM/filename structure. Never modifies
the source uploads directory.

The ref pattern is imported from convert_posts.py's emitted_img_re() (the
authoritative scan used when the posts were generated) rather than
reimplemented here, so the two scripts cannot drift out of sync. That regex
uses a negative lookbehind `(?<![\\w.%~:-])` to reject '/uploads/' occurrences
embedded inside longer external URLs (e.g. Jetpack proxies like
i0.wp.com/emrick.us/wp-content/uploads/...), which a naive `/uploads/(...)`
regex would incorrectly match.
"""
import os
import shutil
import sys

from convert_posts import emitted_img_re

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
UPLOADS = os.path.abspath(os.path.join(REPO, '..', 'site', 'wp-content', 'uploads'))
POSTS = os.path.join(REPO, 'src', 'content', 'posts')
DEST = os.path.join(REPO, 'public', 'uploads')

img_re = emitted_img_re()

refs = set()
for fn in os.listdir(POSTS):
    if fn.endswith('.md'):
        body = open(os.path.join(POSTS, fn), encoding='utf-8').read()
        refs.update(img_re.findall(body))

missing = []
for rel in sorted(refs):
    src = os.path.join(UPLOADS, rel)
    if not os.path.exists(src):
        missing.append(rel)
        continue
    dst = os.path.join(DEST, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)

print(f'copied={len(refs) - len(missing)} missing={len(missing)}')
if missing:
    print('Missing refs:', file=sys.stderr)
    for rel in missing:
        print(f'  {rel}', file=sys.stderr)
sys.exit(1 if missing else 0)
