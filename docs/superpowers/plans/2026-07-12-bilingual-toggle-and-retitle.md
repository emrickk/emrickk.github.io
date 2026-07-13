# Bilingual Toggle + Retitle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Theme tasks (1–6) are executed inline with build + browser verification; the batch (Task 7) runs as a Workflow fan-out. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Give every one of the 318 posts a switchable English + Chinese body and title (header toggle), and replace the 124 date-only titles with real titles derived from content — without changing any URL.

**Architecture:** Paired Markdown files — each post keeps its primary file (original language, unchanged slug/URL) and gains a sibling `<slug>.<lang>.md` with the translated body. Two content collections (`posts` = primaries only, `translations` = siblings). A `LangToggle` mirrors the existing `ThemeToggle` (sets `data-lang` on `<html>`, persists to `localStorage`), and CSS shows the active language. Titles are localized into `titleZh`/`titleEn` frontmatter and swap everywhere via a shared `LangTitle` component.

**Tech Stack:** Astro 5 content collections (glob loader), TypeScript, plain CSS with `data-*` attribute toggles, inline `is:inline` scripts (no framework), Python 3.11 + pytest for deterministic content migration, a Workflow fan-out for LLM translation.

## Global Constraints

- **Never change a post's slug, filename stem, URL, `pubDate`, or `category`.** URLs must stay identical.
- **Source of truth is GitHub `origin/main`;** all work stays on branch `bilingual-toggle`; **nothing is pushed** until the user reviews and says go.
- **Preserve body formatting exactly** in translations: every line break, blank line, trailing `\`, `\_\_\_` underscore run, and raw entity.
- **Every localized-title field is optional in the schema** so the site builds at every partial state; the theme falls back to `title` when a localized title is missing.
- **Translation voice:** faithful and literary, never literal-machine; keep classical/poetic register; keep names/proper nouns; add nothing, omit nothing.
- **localStorage key:** `'lang'`. **Root attribute:** `data-lang` ∈ `{zh, en, auto}`. **Toggle button id:** `lang-toggle`.
- Verify with the project's own commands: `npm run check` (astro check), `npm run build` (astro build + pagefind), and the Browser preview tools. Python: `pytest scripts/migrate/`.

---

### Task 1: Content schema + collections + deterministic frontmatter

**Files:**
- Modify: `src/content.config.ts`
- Create: `scripts/migrate/add_bilingual_frontmatter.py`
- Test: `scripts/migrate/test_add_bilingual_frontmatter.py`

**Interfaces:**
- Produces: `posts` collection entries now carry optional `lang: 'zh'|'en'`, `translationKey: string`, `titleZh?: string`, `titleEn?: string`. New `translations` collection with `translationKey: string`, `lang: 'zh'|'en'`, `title: string`.
- Produces: every primary `.md` gains `lang` and `translationKey: <slug>` frontmatter (idempotent).

- [ ] **Step 1: Write the failing migration test**

```python
# scripts/migrate/test_add_bilingual_frontmatter.py
import textwrap
from add_bilingual_frontmatter import detect_lang, add_fields

def test_detect_lang_chinese():
    assert detect_lang("折戟沉沙铁未消") == "zh"

def test_detect_lang_english():
    assert detect_lang("The quick brown fox.") == "en"

def test_add_fields_injects_lang_and_key_idempotently():
    src = textwrap.dedent("""\
        ---
        title: '水'
        description: ''
        pubDate: '2006-10-03'
        category: 'Journal'
        ---

        折戟沉沙铁未消，自将磨洗认前朝。
        """)
    out = add_fields(src, slug="be-water")
    assert "lang: 'zh'" in out
    assert "translationKey: 'be-water'" in out
    # idempotent: running twice does not duplicate
    assert add_fields(out, slug="be-water") == out
    # body untouched
    assert "折戟沉沙铁未消，自将磨洗认前朝。" in out
    # existing keys preserved
    assert "title: '水'" in out
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scripts/migrate && python -m pytest test_add_bilingual_frontmatter.py -v`
Expected: FAIL with `ModuleNotFoundError` / `ImportError: cannot import name`.

- [ ] **Step 3: Write the migration script**

```python
# scripts/migrate/add_bilingual_frontmatter.py
"""Add `lang` and `translationKey` frontmatter to primary post files. Idempotent."""
import re, sys
from pathlib import Path

POSTS_DIR = Path(__file__).resolve().parents[2] / "src" / "content" / "posts"
CJK = re.compile(r"[一-鿿]")

def detect_lang(text: str) -> str:
    return "zh" if CJK.search(text or "") else "en"

def _split(src: str):
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", src, re.DOTALL)
    if not m:
        raise ValueError("no frontmatter")
    return m.group(1), m.group(2)

def add_fields(src: str, slug: str) -> str:
    fm, body = _split(src)
    lines = fm.split("\n")
    has_lang = any(l.startswith("lang:") for l in lines)
    has_key = any(l.startswith("translationKey:") for l in lines)
    lang = detect_lang(body)
    additions = []
    if not has_lang:
        additions.append(f"lang: '{lang}'")
    if not has_key:
        additions.append(f"translationKey: '{slug}'")
    if additions:
        lines = lines + additions
    return "---\n" + "\n".join(lines) + "\n---\n" + body

def main():
    changed = 0
    for f in sorted(POSTS_DIR.glob("*.md")):
        # skip sibling translation files (none exist yet, but stay safe)
        if re.search(r"\.(en|zh)\.md$", f.name):
            continue
        slug = f.name[:-3]
        src = f.read_text(encoding="utf-8")
        out = add_fields(src, slug=slug)
        if out != src:
            f.write_text(out, encoding="utf-8")
            changed += 1
    print(f"updated {changed} files")

if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd scripts/migrate && python -m pytest test_add_bilingual_frontmatter.py -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the migration over all posts**

Run: `cd scripts/migrate && python add_bilingual_frontmatter.py`
Expected: `updated 318 files`. Verify: `grep -L "translationKey:" ../../src/content/posts/*.md` prints nothing.

- [ ] **Step 6: Update the content config**

Rewrite `src/content.config.ts` to (a) narrow `posts` to exclude siblings, (b) add optional bilingual fields, (c) add a `translations` collection:

```ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  loader: glob({
    base: './src/content/posts',
    pattern: ['**/*.{md,mdx}', '!**/*.{en,zh}.{md,mdx}'],
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      heroImage: z.optional(image()),
      focusEffect: z.literal('scroll-dark').optional(),
      category: z.string().optional(),
      homeFeatured: z.boolean().default(false),
      homeHeroOrder: z.number().int().positive().optional(),
      homeOrder: z.number().int().positive().optional(),
      draft: z.boolean().default(false),
      lang: z.enum(['zh', 'en']).optional(),
      translationKey: z.string().optional(),
      titleZh: z.string().optional(),
      titleEn: z.string().optional(),
    }),
});

const translations = defineCollection({
  loader: glob({
    base: './src/content/posts',
    pattern: '**/*.{en,zh}.{md,mdx}',
  }),
  schema: z.object({
    translationKey: z.string(),
    lang: z.enum(['zh', 'en']),
    title: z.string().optional(),
  }),
});

export const collections = { posts, translations };
```

- [ ] **Step 7: Verify build still works (no siblings yet)**

Run: `npm run check && npm run build`
Expected: build succeeds; post count unchanged (318 routes). Commit.

```bash
git add src/content.config.ts src/content/posts scripts/migrate/add_bilingual_frontmatter.py scripts/migrate/test_add_bilingual_frontmatter.py
git commit -m "Add bilingual schema + lang/translationKey frontmatter"
```

---

### Task 2: Translation helpers + LangTitle component

**Files:**
- Create: `src/utils/translations.ts`
- Create: `src/components/LangTitle.astro`

**Interfaces:**
- Produces: `type Lang = 'zh' | 'en'`; `pickTitle(data, lang): string`; `buildTranslationMap(): Promise<Map<string, CollectionEntry<'translations'>>>` keyed by `translationKey`.
- Produces: `<LangTitle zh en orig fallback tag class />` rendering two spans, tagging the `orig` one with `data-orig`.

- [ ] **Step 1: Write the helper**

```ts
// src/utils/translations.ts
import { getCollection, type CollectionEntry } from 'astro:content';

export type Lang = 'zh' | 'en';

export function pickTitle(
  data: { title: string; titleZh?: string; titleEn?: string },
  lang: Lang
): string {
  return lang === 'en' ? (data.titleEn ?? data.title) : (data.titleZh ?? data.title);
}

/** Map translationKey -> sibling entry, for the non-original language body. */
export async function buildTranslationMap(): Promise<
  Map<string, CollectionEntry<'translations'>>
> {
  const entries = await getCollection('translations');
  const map = new Map<string, CollectionEntry<'translations'>>();
  for (const e of entries) map.set(`${e.data.translationKey}:${e.data.lang}`, e);
  return map;
}
```

- [ ] **Step 2: Write LangTitle component**

```astro
---
// src/components/LangTitle.astro
interface Props {
  zh?: string;
  en?: string;
  orig: 'zh' | 'en';
  fallback: string;
  tag?: keyof HTMLElementTagNameMap;
  class?: string;
}
const { zh, en, orig, fallback, tag: Tag = 'span', class: cls } = Astro.props;
const zhText = zh ?? fallback;
const enText = en ?? fallback;
---
<Tag class:list={['lang-title', cls]}>
  <span class="lang lang-zh" data-orig={orig === 'zh' ? '' : undefined}>{zhText}</span
  ><span class="lang lang-en" data-orig={orig === 'en' ? '' : undefined}>{enText}</span>
</Tag>
```

- [ ] **Step 3: Verify types**

Run: `npm run check`
Expected: no new errors. Commit.

```bash
git add src/utils/translations.ts src/components/LangTitle.astro
git commit -m "Add translation helpers and LangTitle component"
```

---

### Task 3: LangToggle component + early data-lang script + global CSS

**Files:**
- Create: `src/components/LangToggle.astro`
- Modify: `src/components/Header.astro` (add `<LangToggle />` inside `.nav-right`, before `<ThemeToggle />`)
- Modify: `src/components/BaseHead.astro` (add the pre-paint `data-lang` init script + global `.lang` CSS)

**Interfaces:**
- Consumes: `data-lang` on `<html>`, `localStorage['lang']`.
- Produces: a working global language switch with three states (`zh`, `en`, `auto`); CSS that hides non-active `.lang` elements.

- [ ] **Step 1: Add the pre-paint init script to `BaseHead.astro`**

Insert an `is:inline` script that runs before body paint (mirror the theme init if one exists there):

```html
<script is:inline>
  (function () {
    try {
      var stored = localStorage.getItem('lang');
      var lang = stored;
      if (!lang) {
        var nav = (navigator.language || '').toLowerCase();
        if (nav.indexOf('zh') === 0) lang = 'zh';
        else if (nav.indexOf('en') === 0) lang = 'en';
        else lang = 'auto';
      }
      document.documentElement.setAttribute('data-lang', lang);
    } catch (e) {
      document.documentElement.setAttribute('data-lang', 'auto');
    }
  })();
</script>
```

- [ ] **Step 2: Add global `.lang` visibility CSS**

Add to `BaseHead.astro` (or the global stylesheet it imports) a global style block:

```css
/* Language toggle visibility */
:root[data-lang='en'] .lang-zh { display: none; }
:root[data-lang='zh'] .lang-en { display: none; }
:root[data-lang='auto'] .lang:not([data-orig]) { display: none; }
/* keep inline title spans inline */
.lang-title .lang { display: inline; }
:root[data-lang='en'] .lang-title .lang-zh,
:root[data-lang='zh'] .lang-title .lang-en,
:root[data-lang='auto'] .lang-title .lang:not([data-orig]) { display: none; }
```

- [ ] **Step 3: Write LangToggle (mirror ThemeToggle)**

```astro
---
// src/components/LangToggle.astro
---
<button
  type="button"
  class="lang-toggle"
  id="lang-toggle"
  aria-label="Switch language"
  title="Switch language / 切换语言"
>
  <span class="lang-toggle-label" data-lang-en>EN</span>
  <span class="lang-toggle-label" data-lang-zh>中</span>
</button>

<script is:inline>
  (function () {
    function mount() {
      var root = document.documentElement;
      var btn = document.getElementById('lang-toggle');
      if (!(btn instanceof HTMLButtonElement) || btn.dataset.langReady === 'true') return;
      btn.dataset.langReady = 'true';

      function resolved() {
        var l = root.getAttribute('data-lang');
        if (l === 'zh' || l === 'en') return l;
        // auto -> treat as en for the toggle's "next" decision
        return 'en';
      }
      btn.addEventListener('click', function () {
        var next = resolved() === 'en' ? 'zh' : 'en';
        root.setAttribute('data-lang', next);
        try { localStorage.setItem('lang', next); } catch (e) {}
      });
    }
    if (document.readyState === 'loading')
      document.addEventListener('DOMContentLoaded', mount, { once: true });
    else mount();
  })();
</script>

<style>
.lang-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  height: 2rem;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--label-secondary);
  font-size: var(--text-footnote, 0.8rem);
  font-weight: var(--weight-semibold);
  transition: color var(--duration-fast) var(--ease-out);
  flex-shrink: 0;
}
.lang-toggle:hover { color: var(--label-primary); }
.lang-toggle:focus-visible { outline: 1px solid currentColor; outline-offset: 0.25rem; }
/* show the label for the language the button will switch TO */
:root[data-lang='en'] .lang-toggle [data-lang-en],
:root[data-lang='auto'] .lang-toggle [data-lang-en] { display: none; }
:root[data-lang='zh'] .lang-toggle [data-lang-zh] { display: none; }
</style>
```

Note: the button shows the *other* language's label (a hint of what a click does). In `auto`, show `中` (clicking goes to zh→ no; clicking goes to en's opposite). Adjust during browser verification so the visible label reads naturally.

- [ ] **Step 4: Wire into Header**

In `src/components/Header.astro`, import and place before `<ThemeToggle />`:

```astro
import LangToggle from './LangToggle.astro';
```
```astro
      <LangToggle />
      <ThemeToggle />
```

- [ ] **Step 5: Verify in the browser**

Run: `npm run build` then start the preview via the Browser pane (`preview_start {name}` for the dev server). Verify with browser tools:
- Toggle button appears in header.
- Clicking flips `document.documentElement.getAttribute('data-lang')` between `en`/`zh`.
- Reload preserves the choice (localStorage).
- No layout shift / flash on load.

Commit.

```bash
git add src/components/LangToggle.astro src/components/Header.astro src/components/BaseHead.astro
git commit -m "Add language toggle, pre-paint init, and visibility CSS"
```

---

### Task 4: Render both bodies + both titles on the post page

**Files:**
- Modify: `src/pages/posts/[...slug].astro`
- Modify: `src/layouts/PostLayout.astro`

**Interfaces:**
- Consumes: `buildTranslationMap()`, `pickTitle`, `LangTitle`, primary `lang`/`titleZh`/`titleEn`.
- Produces: post page with two body wrappers (`.lang.lang-zh` / `.lang.lang-en`, original tagged `data-orig`) and a bilingual H1.

- [ ] **Step 1: Load + render the sibling body in `[...slug].astro`**

Update the frontmatter script to fetch the sibling translation entry and render both. Replace the single `<Content />` usage:

```astro
---
import { type CollectionEntry, getCollection, render } from 'astro:content';
import readingTimeLib from 'reading-time';
import PostLayout from '../../layouts/PostLayout.astro';
import { buildTranslationMap } from '../../utils/translations';

export async function getStaticPaths() {
  const allPosts = (await getCollection('posts'))
    .filter((p) => !p.data.draft)
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
  return allPosts.map((post) => ({
    params: { slug: post.id },
    props: {
      post,
      relatedPosts: allPosts
        .filter((p) => p.id !== post.id)
        .sort((a, b) => {
          const sa = a.data.category && a.data.category === post.data.category ? 1 : 0;
          const sb = b.data.category && b.data.category === post.data.category ? 1 : 0;
          if (sa !== sb) return sb - sa;
          return b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
        })
        .slice(0, 3),
    },
  }));
}

interface Props {
  post: CollectionEntry<'posts'>;
  relatedPosts: CollectionEntry<'posts'>[];
}
const { post, relatedPosts } = Astro.props;
const orig = post.data.lang ?? 'zh';
const otherLang = orig === 'zh' ? 'en' : 'zh';

const { Content } = await render(post);

const tmap = await buildTranslationMap();
const sibling = tmap.get(`${post.data.translationKey}:${otherLang}`);
const Sibling = sibling ? (await render(sibling)).Content : null;

const readingTime = Math.max(1, Math.round(readingTimeLib(post.body ?? '').minutes));
---

<PostLayout
  {...post.data}
  slug={post.id}
  readingTime={readingTime}
  focusEffect={post.data.focusEffect}
  relatedPosts={relatedPosts}
  origLang={orig}
>
  <div class="lang lang-{orig}" data-orig>
    <Content />
  </div>
  {Sibling && (
    <div class={`lang lang-${otherLang}`}>
      <Sibling />
    </div>
  )}
</PostLayout>
```

- [ ] **Step 2: Render bilingual H1 in `PostLayout.astro`**

Add `titleZh`, `titleEn`, `origLang` to `PostLayout`'s Props, and replace the single title heading with `LangTitle`. Locate the existing `<h1>` that prints `title` and swap it:

```astro
import LangTitle from '../components/LangTitle.astro';
```
```astro
<LangTitle tag="h1" zh={titleZh} en={titleEn} orig={origLang} fallback={title} class="post-title" />
```

Keep the existing `<title>`/OG (in `BaseHead`) reading `title` (original language) — do not change those.

- [ ] **Step 3: Verify build + type check**

Run: `npm run check && npm run build`
Expected: PASS. (No siblings yet ⇒ posts render original body only, H1 falls back to `title` for the missing language — this is the intended graceful state.)

Commit.

```bash
git add "src/pages/posts/[...slug].astro" src/layouts/PostLayout.astro
git commit -m "Render both language bodies and bilingual title on post page"
```

---

### Task 5: Localize titles in list/feed/featured/search; keep RSS on original

**Files:**
- Modify: `src/components/PostFeed.astro`, `src/components/FeaturedPostGrid.astro`
- Modify: `src/pages/index.astro`, `src/pages/posts/index.astro`, `src/pages/search.astro`
- Modify: `src/components/SearchPalette.astro` and/or `src/scripts/post-feed.ts` / search index source
- Leave unchanged: `src/pages/rss.xml.js` (uses original `title`)

**Interfaces:**
- Consumes: `LangTitle`, primary `titleZh`/`titleEn`/`lang`.
- Produces: every place a post title is shown in list/card context renders both spans, so titles swap with the toggle.

- [ ] **Step 1: Replace post-title output in each list/card component**

Wherever a component prints `post.data.title` (or `entry.data.title`) as a card/list heading, replace with:

```astro
<LangTitle zh={post.data.titleZh} en={post.data.titleEn} orig={post.data.lang ?? 'zh'} fallback={post.data.title} />
```

Import `LangTitle` at the top of each file. Do this in `PostFeed.astro`, `FeaturedPostGrid.astro`, and any inline title rendering in `index.astro` / `posts/index.astro`.

- [ ] **Step 2: Handle client-side search titles**

Inspect `SearchPalette.astro` / `src/scripts/post-feed.ts` for how search results/titles are produced (pagefind index vs. a JSON list). If titles come from a data array, include `titleZh`/`titleEn`/`lang` in that array and render both spans in the result template; the same CSS hides the inactive one. If search indexes rendered HTML (pagefind over `dist`), the bilingual spans are already in the DOM — verify the inactive-language text is not surfaced as a duplicate match (acceptable if it is; note it).

- [ ] **Step 3: Verify in the browser**

Run: `npm run build`, preview, and with browser tools confirm on the homepage and `/posts`:
- Titles show one language at a time and swap when the toggle is clicked.
- Date-titled posts still show their `title` fallback for now (no localized title until Task 6/7).

Commit.

```bash
git add src/components src/pages
git commit -m "Localize post titles across list, feed, featured, and search"
```

---

### Task 6: Convert ~5 representative sample posts + REVIEW GATE

**Files:**
- Create: 5 sibling files `src/content/posts/<slug>.<lang>.md`
- Modify: those 5 primaries' frontmatter (`titleZh`, `titleEn`; update `title` if it was date-only)

**Interfaces:**
- Produces: 5 fully-bilingual posts demonstrating the mechanism and the translation voice.

- [ ] **Step 1: Choose 5 representative posts**

Pick one each: a Chinese classical/poetic post (`be-water.md` / 水), a Chinese journal entry, an English-origin post, a date-titled post (from the 124), and a `Repost`. Record their slugs.

- [ ] **Step 2: For each, hand-write the translation**

For a Chinese-origin post `slug.md`:
- Create `src/content/posts/slug.en.md`:
```md
---
translationKey: 'slug'
lang: 'en'
title: '<English title>'
---

<English body — faithful, literary, same line breaks/blank lines>
```
- Edit `slug.md` frontmatter: add `titleZh: '<Chinese title>'` and `titleEn: '<English title>'`. If `title` was a date, set `title` to the derived Chinese title (and `titleZh` equals it).

For the English-origin post, mirror with a `.zh.md` sibling and `titleZh`.

- [ ] **Step 3: Build + verify each sample in the browser**

Run: `npm run build`, preview, and with browser tools confirm for each sample:
- Toggle switches body AND title between languages.
- Formatting (line breaks, poetry) is intact in both.
- URL is unchanged.

- [ ] **Step 4: Commit and hand to user (GATE)**

```bash
git add src/content/posts
git commit -m "Add 5 bilingual sample posts for review"
```

Present the running site + screenshots. **STOP. Do not proceed to Task 7 until the user approves both the toggle mechanism and the translation voice.** Incorporate any voice/format feedback into the Task 7 translation prompt.

---

### Task 7: Batch-translate the remaining ~313 posts (Workflow fan-out)

**Files:**
- Create: `scripts/migrate/write_translation.py` + `scripts/migrate/test_write_translation.py` (deterministic writer/validator)
- Create (transient): a Workflow script that fans out one translation agent per post
- Create: ~313 sibling files + modify ~313 primaries' frontmatter

**Interfaces:**
- Consumes: primary post files needing translation (those without a sibling).
- Produces: for each post, a sibling body file + `titleZh`/`titleEn` on the primary (+ updated `title` for date-titled posts).

- [ ] **Step 1: Write the deterministic writer/validator (TDD)**

```python
# scripts/migrate/test_write_translation.py
import textwrap
from write_translation import upsert_titles, is_date_title, sibling_name

def test_is_date_title():
    assert is_date_title("2014-08-17")
    assert is_date_title("20080404")
    assert not is_date_title("水")

def test_sibling_name():
    assert sibling_name("be-water", "en") == "be-water.en.md"

def test_upsert_titles_sets_both_and_replaces_date_title():
    src = textwrap.dedent("""\
        ---
        title: '2014-08-17'
        description: ''
        pubDate: '2014-08-17'
        category: 'Repost'
        lang: 'zh'
        translationKey: '448'
        ---

        请别看穿我的心事
        """)
    out = upsert_titles(src, title_zh='别看穿我的心事', title_en='Do Not See Through My Heart')
    assert "titleZh: '别看穿我的心事'" in out
    assert "titleEn: 'Do Not See Through My Heart'" in out
    # date title replaced by the original-language (zh) title
    assert "title: '别看穿我的心事'" in out
    assert "title: '2014-08-17'" not in out
```

Implement `write_translation.py` with `is_date_title`, `sibling_name`, `upsert_titles(src, title_zh, title_en)` (sets `titleZh`/`titleEn`; if existing `title` is a date, replaces it with the original-language title per `lang`), and `write_sibling(slug, lang, title, body)`. Run `pytest` to green.

- [ ] **Step 2: Define the per-post translation schema + Workflow**

Workflow script (`scripts/migrate/translate.workflow.js`, run via the Workflow tool) — pipeline over the list of primaries lacking a sibling. Each agent receives the primary's raw frontmatter title + body + `lang`, and returns schema-validated JSON:

```
TRANSLATION_SCHEMA = {
  type: 'object',
  required: ['titleZh', 'titleEn', 'translatedBody', 'flags'],
  properties: {
    titleZh: { type: 'string' },      // Chinese title (derive from content if original was a date)
    titleEn: { type: 'string' },      // English title
    translatedBody: { type: 'string' }, // body in the OTHER language, formatting preserved exactly
    flags: { type: 'array', items: { type: 'string' } } // e.g. "well-known-work", "ambiguous", "untranslatable-pun"
  }
}
```

Agent prompt embeds the Global Constraints translation rules verbatim + any voice feedback from Task 6. The Workflow writes results to a JSON journal; a final deterministic pass calls `write_translation.py` to create siblings + update primaries. (Deterministic file-writing is kept OUT of the agents to keep them idempotent and reviewable.)

- [ ] **Step 3: Run the batch**

Fan out with concurrency; accumulate results. Then run the writer over all results.
Expected: ~313 new siblings; every primary now has `titleZh` + `titleEn`.

- [ ] **Step 4: Validate**

Run a validator: every primary has a sibling in the other language, both title fields present, no remaining date-only `title`, sibling body non-empty and line-count within ±1 structural sanity of a paragraph-preserving translation. Then:

Run: `npm run check && npm run build`
Expected: 318 routes build; pagefind indexes; no schema errors.

- [ ] **Step 5: Commit**

```bash
git add src/content/posts scripts/migrate/write_translation.py scripts/migrate/test_write_translation.py
git commit -m "Translate remaining posts: bilingual bodies + localized titles"
```

---

### Task 8: Final verification + handoff report (no push)

**Files:**
- Create: `docs/superpowers/plans/2026-07-12-bilingual-handoff-report.md`

- [ ] **Step 1: Full gate**

Run: `npm run check && npm run build && npm run lint`
Expected: all pass.

- [ ] **Step 2: Browser spot-check**

Preview and verify with browser tools across ~6 posts (poem, journal, English-origin, date-titled, repost, long post) + homepage + `/posts` + search: toggle switches body + title, formatting intact, default language follows browser, choice persists, URLs unchanged.

- [ ] **Step 3: Write the handoff report**

Summarize: counts (posts translated, titles derived), the flagged posts from Task 7 (well-known works, ambiguous, anything needing a human eye), screenshots, and the exact push/merge command for when the user approves. List anything intentionally left for the user to decide.

- [ ] **Step 4: Hand over**

Present the branch `bilingual-toggle` (unpushed), the report, and screenshots. **Do not push.** Wait for the user's go-ahead, then push/merge.

---

## Self-Review

- **Spec coverage:** toggle (T3), paired-file model + schema (T1), helpers (T2), both bodies on post page (T4), localized titles everywhere incl. list/search (T4/T5), RSS/OG on original (T4/T5), default-language resolution incl. `auto` (T3), reposts translated (T7 includes all), date-title derivation (T7 `upsert_titles`), sample-first gate (T6), no-push handoff (T8). All covered.
- **Placeholder scan:** none — code shown for each non-mechanical step; mechanical replacements (title spans across N files) are specified with the exact snippet to substitute.
- **Type consistency:** `pickTitle`, `buildTranslationMap` (key format `translationKey:lang`), `LangTitle` props (`zh/en/orig/fallback/tag/class`), frontmatter fields (`lang/translationKey/titleZh/titleEn`) used consistently across T1–T7.
- **Known adaptation:** this is a content+theme project with no JS unit-test runner installed; JS/Astro verification is `astro check` + `astro build` + Browser tools, while deterministic Python migration keeps real pytest coverage (matching the existing `scripts/migrate` harness).
