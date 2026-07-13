# Bilingual Toggle + Retitle — Design Spec

**Date:** 2026-07-12
**Repo:** `emrickk/emrickk.github.io` (anping.us), Astro blog
**Branch:** `bilingual-toggle` (nothing pushed until user reviews and approves)

## 1. Goal

Two changes to the blog's content and theme:

1. **Bilingual bodies.** Every one of the 318 posts gets **both an English and a Chinese version** of its body, switchable with a header **[ EN | 中文 ]** toggle.
2. **Real titles.** The **124 posts whose titles are just dates** get a real title derived from their content. Every post ends up with **both a Chinese and an English title**, and the title switches with the toggle.

## 2. The archive, in numbers

- 318 posts, spanning 2005–2023 (peak 2013–2014).
- **292 Chinese-origin bodies**, 26 English-origin.
- Titles: **124 date-like** (need derivation), 194 real titles (171 Chinese, 23 English).
- Categories: Words (101), Journal (90), Repost (71), Prodigal (18), Things (16), Fiona (14), 随笔 (8).
- Bodies are short (avg ~30 lines) but many are poetry/prose with fragile formatting (manual line breaks `\`, `\_\_\_` underscores, raw entities).

## 3. Source of truth

GitHub `origin/main` is the source of truth. Verified in sync on 2026-07-12: local `main` == `origin/main` (0 ahead / 0 behind, no diff, clean tree) after `git fetch`. Work happens on branch `bilingual-toggle`. **Nothing is pushed** until the user reviews the finished result and says go.

## 4. Locked decisions

| Decision | Choice |
|---|---|
| Bilingual format | **Language toggle** (not stacked in one page; not `/en` `/zh` routing) |
| Default language on load | **Browser language, else the post's original language** |
| Reposts (71) | **Translated too** (best-effort; they are others' words) |
| Title behavior | **Localized** — both zh + en title per post; title switches with the body, including in list views |

## 5. Title rules

- **Real existing title (194 posts):** kept as the title in its own language. The other-language title is produced by translating/adapting it — concise and faithful, not literal.
- **Date-like title (124 posts):** derive a real title from the post's content, in the post's original language; then produce the other-language title.
- **Result:** every post has a `titleZh` and a `titleEn`. The toggle shows the title matching the active language everywhere titles appear (post H1, homepage, archive, search).

## 6. Content model — paired Markdown files

- **Primary file** (existing, e.g. `be-water.md`): slug, URL, and original-language body **unchanged**. Frontmatter gains:
  - `lang: 'zh' | 'en'` — the post's original language
  - `translationKey: <slug>` — stable id linking the pair
  - `titleZh`, `titleEn` — both titles live here
  - existing `title` retained as the original-language title (back-compat / RSS / SEO fallback)
- **Sibling translation file** `src/content/posts/<slug>.<lang>.md`: holds the **translated body** only, with minimal frontmatter (`translationKey`, `lang`).
- The `posts` collection glob is narrowed to **exclude** `*.{en,zh}.md`, so routes and list views come only from primaries — **URLs are untouched**. Sibling bodies load via a second `translations` collection.

**Why paired files instead of both languages in one file:** the posts are full of fragile formatting. Keeping each language as its own clean `.md` avoids MDX/parsing surprises. Each file stays internally consistent (its body is one language).

## 7. Theme changes

- **`LangToggle.astro`** — mirrors `ThemeToggle.astro`: sets `data-lang` on `<html>`, persists to `localStorage['lang']`, syncs aria, uses a `MutationObserver`. Placed in `Header.astro` beside the theme toggle.
- **Inline head script** (like the theme's) sets initial `data-lang` before paint, in this order:
  1. If `localStorage['lang']` is set → use it (the user has chosen).
  2. Else if `navigator.language` starts with `zh` → `zh`.
  3. Else if it starts with `en` → `en`.
  4. Else (neither, e.g. a French browser) → **`auto`**: each post and each list title renders in **its own original language** until the user toggles. This is how "else the post's original language" is honored under a single global toggle. In `auto` mode, CSS shows the `.lang` wrapper tagged `data-orig` and hides the other; once the user toggles, `data-lang` becomes an explicit `zh`/`en` and is persisted.
- **`[...slug].astro`** — load the primary + its sibling; render **both** bodies into `<div class="lang lang-zh">` and `<div class="lang lang-en">`, tagging the original-language wrapper with `data-orig`. Pass both titles to the layout; H1 renders both in lang spans (the original tagged `data-orig`).
- **List/feed/featured/search** — render both title spans per item (the original tagged `data-orig`); CSS toggles which shows.
- **CSS** — explicit modes: `:root[data-lang='en'] .lang-zh { display: none }` and the mirror for zh. Auto mode: `:root[data-lang='auto'] .lang:not([data-orig]) { display: none }`. Initial `data-lang` set early so there is no flash.
- **RSS / `<title>` / OpenGraph** (non-toggling contexts) — use the **original-language** title.

## 8. Translation principles

- Faithful and **literary**, never literal-machine.
- Preserve every line break, blank line, and formatting token (`\`, `\_\_\_`, entities) exactly.
- Keep the poetic/classical register where it exists (e.g. 水's Red Cliff quatrain).
- Keep names and proper nouns intact; add nothing, omit nothing.
- Reposts: best-effort; flag any that are well-known works where a canonical translation may be preferable.
- Titles: concise, evocative, faithful to the content; derived (date) titles should capture the piece's essence.

## 9. Execution sequencing

1. **Scaffold theme** — schema + collections + `LangToggle` + page/list rendering + CSS.
2. **Convert ~5 representative posts** by hand — a Chinese poem, a Chinese journal entry, an English-origin post, a date-titled post, and a repost.
3. **Run the dev server**; user reviews the toggle mechanism **and** the translation voice. Iterate until approved.
4. **Batch the rest (~313)** via a Workflow fan-out: one agent per post produces the translated body + both titles (schema-validated), writes the sibling file, and updates primary frontmatter.
5. **Verify** — `astro build` passes; spot-check rendering; produce a change report.
6. **Hand over** the branch (unpushed). User reviews. Then push/merge.

## 10. Review & handoff

- Deliverables: theme changes + ~636 content files (318 primaries updated, 318 new siblings), plus a short report listing what changed, sample screenshots, and any flagged posts (ambiguous origin, untranslatable, possible issues).
- Nothing is pushed. User reviews on the `bilingual-toggle` branch, approves, then push/merge.

## 11. Out of scope (YAGNI)

- No `/en` `/zh` routing or hreflang overhaul — single toggle, canonical URLs unchanged.
- No re-categorization or taxonomy cleanup (separate concern).
- No new posts.
- No pruning/deletion of posts.

## 12. Risks / watch-items

- **Fragile formatting** in poetry — mitigated by keeping siblings as plain `.md` and verifying the build.
- **Literary/classical translation quality** — mitigated by sample-first approval, a literary translation prompt, and full user review before push.
- **Large token spend** for 318 translations — acceptable under the current working mode.
- **Non-toggling title contexts** (RSS, `<title>`, OG) — resolved by defaulting to the original-language title.
