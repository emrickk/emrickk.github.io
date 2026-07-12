# Personal Blog Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the 318-post WordPress backup to a static Astro site (astro-tone theme) in this repo, deployable to GitHub Pages, with historical comments preserved and private content kept out of the repo.

**Architecture:** One-time Python migration pipeline (`scripts/migrate/`) reads `../db/emrickus_wp.sql` and `../site/wp-content/uploads/` directly and emits Markdown posts, comment JSON, copied images, and a local-only private archive. The astro-tone theme is vendored into this repo; one custom component (`ArchivedComments.astro`) renders migrated comments.

**Tech Stack:** Astro 6 + astro-tone (Node ≥22.12; local Node is v26.5), Python 3 (stdlib + markdownify + beautifulsoup4 + pytest in a local venv), GitHub Actions → GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-07-12-personal-blog-rebuild-design.md` — all content rules (titles, slugs, categories, PII, private handling) are defined there and restated per task below.

**Paths used throughout** (relative to repo root `…/AI Space/website/blog/`):
- `DUMP = ../db/emrickus_wp.sql`
- `UPLOADS = ../site/wp-content/uploads/`
- `PRIVATE_OUT = ../private-posts/` (outside the repo — never committed)

**Audit ground truth** (verify against these): 318 published posts, 22 private posts, 6 pages,
222 approved comments, 351 attachments, 2 users. wp_posts columns (WP 5.x): 0 ID, 1 author,
2 date, 4 content, 5 title, 7 status, 11 name(slug), 17 parent, 18 guid, 20 type.
wp_comments columns: 0 ID, 1 post_ID, 2 author, 3 email, 4 url, 5 IP, 6 date, 8 body, 10 approved.

---

### Task 1: Vendor the astro-tone theme into this repo

**Files:**
- Create: entire theme tree at repo root (from `hanityx/astro-tone@main`)
- Create: `.gitignore` additions (`node_modules/`, `dist/`, `.astro/`, `scripts/migrate/.venv/`, `private-posts/`)

- [ ] **Step 1: Clone theme to a temp dir and copy in (don't overwrite `docs/` or `.git/`)**

```bash
cd "<repo-root>"  # …/website/blog
git clone --depth 1 https://github.com/hanityx/astro-tone.git /tmp/astro-tone-vendor
rsync -a --exclude '.git' /tmp/astro-tone-vendor/ ./
rm -rf /tmp/astro-tone-vendor
```

- [ ] **Step 2: Append ignore rules**

```bash
printf 'node_modules/\ndist/\n.astro/\nscripts/migrate/.venv/\nprivate-posts/\n' >> .gitignore
```

- [ ] **Step 3: Install and verify the theme builds untouched**

Run: `npm install && npm run build`
Expected: build succeeds, `dist/` created, Pagefind index generated. (Sample posts stay in place until Task 4 Step 6 so the theme remains buildable throughout.)

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Vendor astro-tone theme (MIT, hanityx/astro-tone@main)"
```

---

### Task 2: SQL dump parser module with tests

**Files:**
- Create: `scripts/migrate/wp_parser.py`
- Test: `scripts/migrate/test_wp_parser.py`

- [ ] **Step 1: Create venv and install deps**

```bash
python3 -m venv scripts/migrate/.venv
scripts/migrate/.venv/bin/pip install markdownify beautifulsoup4 pytest
```

- [ ] **Step 2: Write the failing test (against the real dump — it's the fixture)**

```python
# scripts/migrate/test_wp_parser.py
from wp_parser import load_dump

def _d():
    return load_dump('../../../db/emrickus_wp.sql')  # resolved relative to this file

def test_counts_match_audit():
    d = _d()
    posts = [p for p in d['wp_posts'] if p[20] == 'post']
    assert sum(1 for p in posts if p[7] == 'publish') == 318
    assert sum(1 for p in posts if p[7] == 'private') == 22
    assert sum(1 for p in d['wp_posts'] if p[20] == 'page' and p[7] == 'publish') == 6
    assert sum(1 for c in d['wp_comments'] if c[10] == '1') == 222

def test_escapes_unescaped():
    d = _d()
    # No raw MySQL escape sequences may survive parsing
    assert not any("\\'" in (p[4] or '') for p in d['wp_posts'])
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd scripts/migrate && .venv/bin/pytest test_wp_parser.py -v`
Expected: FAIL with `ModuleNotFoundError: wp_parser`

- [ ] **Step 4: Write the parser** (port of the audit-proven parser; state-machine tuple splitter)

```python
# scripts/migrate/wp_parser.py
"""Parse INSERT statements from a MySQL dump without a MySQL server."""
import os

TABLES = ('wp_posts', 'wp_comments', 'wp_users', 'wp_postmeta',
          'wp_terms', 'wp_term_taxonomy', 'wp_term_relationships')

def parse_tuples(line):
    rows, i, n = [], line.index('('), len(line)
    while i < n:
        if line[i] != '(':
            i += 1; continue
        i += 1
        fields, buf, in_str = [], [], False
        while i < n:
            c = line[i]
            if in_str:
                if c == '\\':
                    esc = line[i+1]
                    buf.append({'n':'\n','t':'\t','r':'\r','0':'\0',
                                '\\':'\\',"'":"'",'"':'"'}.get(esc, esc))
                    i += 2; continue
                if c == "'": in_str = False; i += 1; continue
                buf.append(c); i += 1; continue
            if c == "'": in_str = True; buf.append(''); i += 1; continue
            if c == ',':
                s = ''.join(buf); fields.append(None if s == 'NULL' else s)
                buf = []; i += 1; continue
            if c == ')':
                s = ''.join(buf); fields.append(None if s == 'NULL' else s)
                rows.append(fields); i += 1; break
            buf.append(c); i += 1
    return rows

def load_dump(path):
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), path)
    out = {t: [] for t in TABLES}
    with open(path, encoding='utf-8', errors='replace') as f:
        for line in f:
            for t in TABLES:
                if line.startswith(f'INSERT INTO `{t}`'):
                    out[t].extend(parse_tuples(line)); break
    return out
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd scripts/migrate && .venv/bin/pytest test_wp_parser.py -v`
Expected: 2 passed

- [ ] **Step 6: Commit**

```bash
git add scripts/migrate && git commit -m "Add WordPress SQL dump parser with audit-count tests"
```

---

### Task 3: Category extraction and mapping file

**Files:**
- Create: `scripts/migrate/categories.py`
- Test: `scripts/migrate/test_categories.py`
- Output: `scripts/migrate/category-mapping.csv` (committed; the owner's one review checkpoint)

- [ ] **Step 1: Write the failing test**

```python
# scripts/migrate/test_categories.py
from wp_parser import load_dump
from categories import post_categories, build_mapping

def test_every_published_post_gets_one_category():
    d = load_dump('../../../db/emrickus_wp.sql')
    cats = post_categories(d)          # {post_id: first_category_name}
    pub = [p[0] for p in d['wp_posts'] if p[20] == 'post' and p[7] == 'publish']
    mapping = build_mapping(cats)      # {old_name: new_name}; build_mapping maps
    for pid in pub:                    # uncategorized/未分类/'' -> 随笔 itself
        old = cats.get(pid, '')
        new = mapping[old] if old else '随笔'   # KeyError/empty = real failure
        assert new and new.strip()
```

- [ ] **Step 2: Run to verify it fails** — Expected: `ModuleNotFoundError: categories`

- [ ] **Step 3: Implement**

```python
# scripts/migrate/categories.py
"""Map WordPress categories to the theme's single-category scheme."""
import csv, os

HERE = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(HERE, 'category-mapping.csv')

def post_categories(dump):
    terms = {t[0]: t[1] for t in dump['wp_terms']}                 # term_id -> name
    tax = {}                                                        # tt_id -> (taxonomy, term name)
    for row in dump['wp_term_taxonomy']:                            # tt_id, term_id, taxonomy, ...
        tax[row[0]] = (row[2], terms.get(row[1], ''))
    out = {}
    for rel in dump['wp_term_relationships']:                       # object_id, tt_id, order
        kind, name = tax.get(rel[1], ('', ''))
        if kind == 'category' and rel[0] not in out:
            out[rel[0]] = name
    return out

def build_mapping(cats):
    """Load owner-editable CSV if present; else generate identity mapping and write it."""
    if os.path.exists(CSV_PATH):
        with open(CSV_PATH, encoding='utf-8') as f:
            return {r['old']: r['new'] for r in csv.DictReader(f)}
    names = sorted(set(cats.values()) - {''})
    mapping = {n: ('随笔' if n.lower() in ('uncategorized', '未分类') else n) for n in names}
    with open(CSV_PATH, 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['old', 'new']); w.writeheader()
        for old, new in mapping.items():
            w.writerow({'old': old, 'new': new})
    return mapping
```

- [ ] **Step 4: Run tests** — Expected: PASS; `category-mapping.csv` now exists.

- [ ] **Step 5: Print the generated mapping for the owner** (surface in chat for review; owner may edit the CSV any time and re-run Task 4)

- [ ] **Step 6: Commit**

```bash
git add scripts/migrate && git commit -m "Add category extraction and owner-editable mapping file"
```

---

### Task 4: Post converter (HTML → Markdown with frontmatter)

**Files:**
- Create: `scripts/migrate/convert_posts.py`
- Test: `scripts/migrate/test_convert_posts.py`
- Output: `src/content/posts/*.md` (318 files)

**Rules (from spec):**
- Frontmatter: `title`, `description: ''`, `pubDate: YYYY-MM-DD`, `category` (mapped). No author field.
- Untitled/empty title → title = `YYYY-MM-DD`; N same-day untitled posts get `·2`…`·N` suffixes in post-ID order.
- Slug: `post_name` if non-empty pure-ASCII, else `YYYY-MM-DD-p<ID>`; collisions append `-p<ID>`.
- Body: markdownify with `heading_style='ATX'`; drop `<!--more-->`; strip `<img>` whose src host is a dead emoticon host (`smzdm.com`, `res.smzdm.com`, `angelived.org`, `www.zbiy.com`); leave other external refs as-is.
- Image refs matching `emrick.us/wp-content/uploads/<Y>/<M>/<file>` (any scheme/host casing) → `{BASE_PREFIX}/uploads/<Y>/<M>/<file>`, stripping `-WxH` size suffix when the original file exists in `UPLOADS`. `BASE_PREFIX` is an env var, **default empty** (root base). It exists because Astro does not prepend `base` to absolute URLs in Markdown: if Task 10 ever deploys under a non-root base (project repo without custom domain), set `BASE_PREFIX=/repo-name` and re-run Tasks 4–5 (idempotent).
- Escape/quote frontmatter strings safely (YAML single-quote style, `''` doubling).
- Posts whose parsed body contains U+FFFD are still converted but listed in the report.

- [ ] **Step 1: Write failing tests for the three hard rules**

```python
# scripts/migrate/test_convert_posts.py
from convert_posts import make_title, make_slug, rewrite_images

def test_untitled_same_day_suffixes():
    rows = [('101', '2013-04-18 10:00:00', ''), ('102', '2013-04-18 11:00:00', ''),
            ('103', '2013-04-18 12:00:00', '')]
    titles = make_title(rows)   # {id: title} for untitled posts, ID order
    assert titles == {'101': '2013-04-18', '102': '2013-04-18·2', '103': '2013-04-18·3'}

def test_slug_ascii_or_dated():
    assert make_slug('remarkable-2', '2021-03-14', '1604', set()) == 'remarkable-2'
    assert make_slug('%e6%97%a0%e9%a2%98', '2013-04-18', '853', set()) == '2013-04-18-p853'
    assert make_slug('', '2005-09-18', '96', set()) == '2005-09-18-p96'

def test_image_rewrite_strips_size_variant(tmp_path):
    (tmp_path / '2020' / '11').mkdir(parents=True)
    (tmp_path / '2020' / '11' / 'kb.jpg').write_bytes(b'x')
    html = '<img src="https://emrick.us/wp-content/uploads/2020/11/kb-300x200.jpg">'
    out, used = rewrite_images(html, uploads_root=str(tmp_path))
    assert '/uploads/2020/11/kb.jpg' in out and used == {'2020/11/kb.jpg'}
```

- [ ] **Step 2: Run to verify failure** — Expected: `ModuleNotFoundError: convert_posts`

- [ ] **Step 3: Implement `convert_posts.py`** — functions `make_title`, `make_slug`, `rewrite_images`, plus `convert_all()` that wires parser + categories + markdownify, writes `src/content/posts/<slug>.md`, returns a report dict (`posts_written`, `images_used`, `flagged_fffd`, `slug_collisions`), **and persists it to `scripts/migrate/report.txt`** (counts plus the full flagged-post and collision lists — the spec's named deliverable, consumed by Task 9). Frontmatter emitted exactly as:

```yaml
---
title: '<escaped>'
description: ''
pubDate: 'YYYY-MM-DD'
category: '<mapped>'
---
```

- [ ] **Step 4: Run unit tests** — Expected: 3 passed

- [ ] **Step 5: Run the full conversion**

Run: `cd scripts/migrate && .venv/bin/python -c "from convert_posts import convert_all; print(convert_all())"`
Expected: `posts_written == 318` and `report.txt` written.

- [ ] **Step 6: Delete the theme's sample posts and sample assets now** (the 318 real posts keep the build valid from here on)

Run: `npm run build` — Expected: pass. Then `ls src/content/posts/*.md | wc -l` — Expected: exactly 318.

- [ ] **Step 7: Commit**

```bash
git add -A src/content/posts scripts/migrate && git commit -m "Convert 318 WordPress posts to Markdown; remove theme samples"
```

---

### Task 5: Copy referenced images into `public/uploads/`

**Files:**
- Create: `scripts/migrate/copy_images.py` (consumes `images_used` from the converter run; re-derivable by scanning `src/content/posts/*.md` for `/uploads/` refs)
- Output: `public/uploads/YYYY/MM/*`

- [ ] **Step 1: Implement copy + verify in one script**

```python
# scripts/migrate/copy_images.py
import os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
UPLOADS = os.path.abspath(os.path.join(REPO, '..', 'site', 'wp-content', 'uploads'))
POSTS = os.path.join(REPO, 'src', 'content', 'posts')
DEST = os.path.join(REPO, 'public', 'uploads')

refs = set()
for fn in os.listdir(POSTS):
    if fn.endswith('.md'):
        body = open(os.path.join(POSTS, fn), encoding='utf-8').read()
        refs.update(re.findall(r'/uploads/(\d{4}/\d{2}/[^)\s"\']+)', body))
missing = []
for rel in sorted(refs):
    src = os.path.join(UPLOADS, rel)
    if not os.path.exists(src):
        missing.append(rel); continue
    dst = os.path.join(DEST, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)
print(f'copied={len(refs)-len(missing)} missing={len(missing)}')
sys.exit(1 if missing else 0)
```

- [ ] **Step 2: Run it**

Run: `cd scripts/migrate && .venv/bin/python copy_images.py`
Expected: `missing=0`, exit 0 (audit guarantees every in-body ref resolves).

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate/copy_images.py public/uploads && git commit -m "Copy referenced media into public/uploads"
```

---

### Task 6: Comments export (published posts only, zero PII)

**Files:**
- Create: `scripts/migrate/export_comments.py`
- Test: `scripts/migrate/test_export_comments.py`
- Output: `src/data/comments/<slug>.json`

- [ ] **Step 1: Write failing test**

```python
# scripts/migrate/test_export_comments.py
import json, os, glob
from export_comments import export_all

def test_export_scope_and_pii():
    n = export_all()
    assert 0 < n <= 222                        # only comments on migrated published posts
    for f in glob.glob('../../src/data/comments/*.json'):
        for c in json.load(open(f)):
            assert set(c) == {'author', 'date', 'body'}   # no email/IP/url keys, ever
```

- [ ] **Step 2: Run to verify failure** — Expected: `ModuleNotFoundError`

- [ ] **Step 3: Implement** — approved (`c[10]=='1'`) comments whose `post_ID` is in the published-post slug map, **obtained by importing `convert_posts` and re-deriving it** (scripts are idempotent; no side-channel file); write `[{author, date, body}]` sorted by date.

- [ ] **Step 4: Run tests** — Expected: PASS. Append the exported count to `scripts/migrate/report.txt` (spec allows <222).

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate src/data/comments && git commit -m "Export historical comments (published posts only, PII stripped)"
```

---

### Task 7: Private posts and pages → local archive (outside repo)

**Files:**
- Create: `scripts/migrate/export_private.py`
- Output: `../private-posts/*.md` (22 private posts + 4 archived pages) — **outside the repo**

- [ ] **Step 1: Implement** — same conversion as Task 4 (reuse its functions) for `post` rows with status `private` (22) and the pages Archive, Leave Comments, 减肥, About the Blog; write to `PRIVATE_OUT` with a `status: private` frontmatter line. About + About Me page text goes into a single `../private-posts/_about-source.md` for Task 8 to draw from.

- [ ] **Step 2: Run and verify**

Run: `cd scripts/migrate && .venv/bin/python export_private.py && ls ../../../private-posts/*.md | wc -l`
Expected: 27 files (22 + 4 + `_about-source.md`).

- [ ] **Step 3: Verify nothing leaked into the repo**

Run: `git status --porcelain | grep -c private || echo CLEAN`
Expected: `CLEAN` (also protected by `.gitignore` from Task 1).

- [ ] **Step 4: Commit (script only)**

```bash
git add scripts/migrate/export_private.py && git commit -m "Add private-content exporter (writes outside repo)"
```

---

### Task 8: Theme integration — ArchivedComments, config, sample cleanup

**Files:**
- Create: `src/components/ArchivedComments.astro`
- Modify: the theme's post layout (locate at execution: the file rendering post bodies under `src/layouts/` or `src/pages/posts/`; insert component after the article body, before giscus mount)
- Modify: `astro-theme-config.ts` (title `NeVeRtheLeSs`, description, `lang: zh-CN` where supported)

- [ ] **Step 1: Write the component**

```astro
---
// src/components/ArchivedComments.astro
interface Props { slug: string }
const { slug } = Astro.props;
const files = import.meta.glob('../data/comments/*.json');
const key = `../data/comments/${slug}.json`;
let comments: { author: string; date: string; body: string }[] = [];
if (files[key]) comments = ((await files[key]()) as any).default;
---
{comments.length > 0 && (
  <section class="archived-comments">
    <h2>历史评论 · Archived comments</h2>
    {comments.map((c) => (
      <div class="archived-comment">
        <p class="meta"><strong>{c.author}</strong> · <time>{c.date}</time></p>
        <p class="body">{c.body}</p>
      </div>
    ))}
  </section>
)}
<style>
  .archived-comments { margin-top: 3rem; border-top: 1px solid var(--border, #8884); padding-top: 1rem; }
  .archived-comment { margin: 1rem 0; }
  .meta { opacity: 0.7; font-size: 0.9em; }
</style>
```

- [ ] **Step 2: Wire into the post layout, passing the post slug**

- [ ] **Step 3: Update `astro-theme-config.ts` and write About content** from `../private-posts/_about-source.md` (samples already removed in Task 4)

- [ ] **Step 4: Type-check, build, and check both directions**

Run: `npm run check && npm run build && grep -l 'archived-comments' dist/posts/*/index.html | wc -l`
Expected: check and build pass; count equals number of posts that have comment JSON; spot-check one post without comments contains no `archived-comments` section.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Add ArchivedComments component and site config"
```

---

### Task 9: Verification suite + owner preview (gate)

**Files:**
- Create: `scripts/migrate/verify.py` (scripted acceptance criteria V1–V3, V5, V6 from the spec)

- [ ] **Step 1: Implement `verify.py`** — asserts: exactly 318 migrated post files **and counts match `scripts/migrate/report.txt`** (V1); every `/uploads/` ref resolves under `public/uploads/` (V2); zero email-pattern matches (`[\w.+-]+@[\w-]+\.[\w.]+`) in `src/content/posts/` and `src/data/comments/` except an allowlist (owner's own addresses if any appear in post bodies — surface for decision) and zero occurrences of private post titles in the repo (V5); comment JSON schema check (V6).

- [ ] **Step 2: Run the full acceptance gate (V1–V3, V5, V6)**

Run: `cd scripts/migrate && .venv/bin/python verify.py && cd ../.. && npm run check && npm run build`
Expected: verify.py exits 0; `npm run check` and `npm run build` pass (V3).

- [ ] **Step 3: Sample render review** — `npm run preview`, open ≥10 posts spanning 2005/2008/2013/2014/2020/2023 (weighted old) side-by-side with dump HTML; fix converter and re-run Tasks 4–6 if defects found (scripts are idempotent).

- [ ] **Step 4: Owner click-through gate** — owner reviews the local preview and the `category-mapping.csv`; **do not push anywhere until approved**.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate/verify.py && git commit -m "Add scripted acceptance checks"
```

---

### Task 10: Publish to GitHub Pages (after owner gate)

**Owner inputs needed:** personal GitHub username; empty repo created under it; SSH public key added to the personal account (key already generated: `~/.ssh/id_ed25519_personal_github.pub`, alias `github-personal` configured).

- [ ] **Step 1: Set `site`/`base` in `astro.config.mjs`** — **pinned decision: the site deploys at root base.** Either the repo is named `<user>.github.io` (user site) or the custom domain is attached at launch; both give root base and the `/uploads/` refs are correct as-is. Only if the owner insists on a project repo with no domain: set `base: '/repo-name'`, run `BASE_PREFIX=/repo-name` re-run of Tasks 4–5, and rebuild. Rebuild to confirm either way.

- [ ] **Step 2: Point remote and push**

```bash
git remote add origin git@github-personal:<user>/<repo>.git
git push -u origin main
```

- [ ] **Step 3: Enable Pages** — repo Settings → Pages → Source: GitHub Actions (theme ships `.github/workflows/deploy.yml`). Owner clicks or confirms.

- [ ] **Step 4: Verify live site** — fetch the Pages URL, check home + one 2005 post + one 2023 post + search.

- [ ] **Step 5: giscus (owner, 2 clicks)** — enable Discussions on the repo, install the giscus app; then set the giscus block in `astro-theme-config.ts`, push, verify a comment box renders.

- [ ] **Step 6: Commit any config change and tag**

```bash
git tag v1-migration-complete && git push --tags
```

**Deferred (separate follow-ups, not this plan):** custom domain purchase + DNS/CNAME; restyling from the owner's style examples; portfolio site.
