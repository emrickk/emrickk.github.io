# Image gallery for photo-run posts

**Date:** 2026-07-14
**Goal:** Posts with runs of photos (Animal Crossing, BMW X3, BMW 330i, reMarkable 2 review) render them as a compact 2-column grid with lightbox navigation, instead of full-width stacked images.

## Background

Photo runs exist in two authoring shapes today:

1. **Image-only lists** (animal-crossing-is-a-good-game.md and .zh.md, 6 images each):

   ```markdown
   * ![](https://cdn.anping.us/2020/04/a.webp)
   * ![](https://cdn.anping.us/2020/04/b.webp)
   ```

   Renders as `<ul><li><img></li>...</ul>`: full-width images with stray list bullets.

2. **Bare image paragraphs** separated by blank lines (bmw-x3-30i: one run of 14; bmw-330i: one run of 4 plus three separate 2-image pairs, so that post upgrades partially by design; remarkable-2-review: 66 images in runs up to 18; plus their .zh/.en siblings):

   ```markdown
   ![](https://cdn.anping.us/2020/09/a.webp)

   ![](https://cdn.anping.us/2020/09/b.webp)
   ```

   Renders as consecutive `<p><img></p>` elements.

Both shapes produce one full-width image per screen; the Animal Crossing post scrolls about 2,700px for six photos.

Existing building blocks this design extends rather than replaces:

- `src/components/ImageLightbox.astro` + `src/scripts/image-lightbox.ts`: click-to-fullscreen for every `.prose img` not wrapped in a link.
- `.prose .img-grid` in `src/styles/prose.css`: manual 2-up grid via an HTML wrapper.

Decisions made with Anping (2026-07-14, after live demos on the dev server):

1. Trigger: auto-detect photo runs (no frontmatter flag, no HTML wrapper, no post edits).
2. Layout: 2-column grid with a consistent 16:9 crop (demo B2).
3. Lightbox gains prev/next navigation for gallery images.

## Design

### 1. Rehype plugin: detect photo runs

New file `scripts/rehype/image-gallery.mjs`, registered in `astro.config.mjs` `markdown.rehypePlugins` after `rehypeAutolinkHeadings`. Two detection rules, both normalizing to the same output shape.

**Rule A: image-only lists (2 or more images).** A `<ul>` qualifies when it has 2 or more `<li>` children and every `<li>` contains exactly one element child, which is an `<img>` or a `<p>` whose only element child is an `<img>`, with no non-whitespace text anywhere in the item. Qualifying lists get `image-gallery` appended to their class list; the tree is otherwise untouched. `<ol>` never qualifies. Lists are the deliberate authoring convention going forward, so the threshold is low.

**Rule B: bare image paragraph runs (3 or more images).** A run of 3 or more consecutive sibling `<p>` elements, each containing exactly one `<img>` and no non-whitespace text (whitespace-only text nodes between paragraphs are ignored), is replaced by a `<ul class="image-gallery">` with one `<li><img></li>` per image. The threshold is 3 because this rule is a heuristic over legacy content: it catches the photo-run posts while leaving 2-image pairs alone (aiyou-user-growth has chart pairs that should stay full-width; deliberate 2-ups remain the manual `.img-grid`'s job).

**Linked images never qualify** under either rule. An `<img>` wrapped in `<a>` cannot open the lightbox (the existing script skips linked images), so turning it into a cropped tile would navigate away instead of zooming. Consequence: mit-coasters.md / .zh.md, whose 4-image list is link-wrapped, keeps its current rendering. Those links point at the dead emrick.us domain and are a separate content cleanup, out of scope here.

**Escape hatches for authors:** add any text to a list item (rule A) or between paragraphs (rule B) and the images render as ordinary full-width prose images.

The plugin applies to `.md`, `.mdx`, and translation sibling bodies (`*.zh.md` / `*.en.md`), since all flow through the same markdown pipeline. RSS is unaffected: the feed (`src/pages/rss.xml.js`) emits only title, description, date, and link, never rendered post bodies.

### 2. CSS: the grid

In `src/styles/prose.css`, next to the existing `.img-grid` block:

- `.prose ul.image-gallery`: `list-style: none`, `padding: 0`, `display: grid`, `grid-template-columns: 1fr 1fr`, `gap: var(--space-2)`, `margin-block: var(--space-6)`.
- `.prose ul.image-gallery li`: `margin: 0`.
- `.prose ul.image-gallery img`: `width: 100%`, `aspect-ratio: 16 / 9`, `object-fit: cover`, `margin: 0`.

Two columns at all viewport widths: verified in the demo that 2-up 16:9 tiles stay legible at 375px. Existing `.prose img` border, radius, and background rules continue to apply. The `.img-grid` helper is unchanged.

Crops lose part of each frame (notably portrait photos in the BMW and reMarkable posts); the lightbox always shows the full uncropped image, verified in the demo.

### 3. Lightbox: gallery navigation

Changes to `src/scripts/image-lightbox.ts` and `src/components/ImageLightbox.astro` (plus `src/styles/components/image-lightbox.css`):

- When an image inside `ul.image-gallery` is opened, the lightbox records the ordered list of that gallery's images and the current index.
- New prev/next buttons in the dialog (chevron icons, styled like the existing close button) and ArrowLeft/ArrowRight key handling. Navigation wraps around.
- A counter, for example `3 / 6`, renders as its own element beneath the caption paragraph (a sibling, so caption text and counter never share a line); per-image `alt` and `em` captions still swap in as today.
- Prev/next buttons are hidden when the lightbox is opened from a standalone (non-gallery) image; behavior there is unchanged.
- The existing focus trap (currently Tab always refocuses the close button) cycles across close/prev/next when the nav is visible.

## Out of scope

- Masonry, filmstrip, or per-post layout options.
- Configurable crop ratio or column count (can be added later as modifier classes if a post needs it).
- Touch swipe gestures in the lightbox.
- Any edits to post markdown files: existing posts upgrade automatically via the two detection rules.
- Fixing mit-coasters' dead emrick.us links (separate content task).
- Hero images (`src/assets/hero/`) and the R2 image pipeline.

## Testing

- Plugin unit tests in `scripts/rehype/image-gallery.test.mjs`, run by a new npm script `"test:rehype": "node --test \"scripts/rehype/*.test.mjs\""` (same pattern as `test:images`; neither existing test script runs files outside its own glob, so the new script is required for the tests to execute at all). Cases: qualifying tight list, qualifying loose list (p-wrapped), list with a text item rejected, link-wrapped images rejected (mit-coasters shape), `ol` rejected, single-image list rejected, paragraph run of 3 wrapped, paragraph run of 2 left alone, run broken by a text paragraph split correctly, run at start/end of document.
- Manual pass on the dev server: animal-crossing (en + zh), bmw-x3-30i, bmw-330i, remarkable-2-review at desktop and 375px, light and dark themes; aiyou-user-growth and mit-coasters unchanged.
- Lightbox: open from grid tile, arrow keys, wrap-around, counter, Escape and backdrop close, focus restore; standalone image unchanged.
- `npm run check`, `lint`, `lint:css`, `test:rehype`, `build`, then `release-check` before any push (rule 5 applies as always).

## Risks

- Rule B rewrites structure (paragraphs become a list) across legacy posts. Blast radius measured 2026-07-14: at threshold 3 the affected set is exactly bmw-x3-30i, bmw-330i, remarkable-2-review and their siblings. The escape hatches make any future exception a one-line author fix.
- Concurrent agent sessions share this checkout on `main` (single-branch workflow, repo rules 6 to 8). Implementation commits land on `main` with explicit paths in single stage-and-commit steps; nothing is pushed without Anping's go-ahead, so local commits cannot deploy.
