# Image gallery for photo-run posts

**Date:** 2026-07-14
**Goal:** Posts with runs of photos (Animal Crossing, BMW X3, BMW 330i, reMarkable 2 review) render them as a compact 2-column grid with lightbox navigation, instead of full-width stacked images inside a bulleted list.

## Background

Photo runs are currently authored as markdown lists of images:

```markdown
* ![](https://cdn.anping.us/2020/04/a.webp)
* ![](https://cdn.anping.us/2020/04/b.webp)
```

This renders as `<ul><li><img></li>...</ul>`: full-width images with stray list bullets, one image per screen. The Animal Crossing post scrolls about 2,700px for six photos; the reMarkable review has 66 images. Four posts (eight files counting `.zh`/`.en` siblings) contain runs of 3 or more images today.

Existing building blocks this design extends rather than replaces:

- `src/components/ImageLightbox.astro` + `src/scripts/image-lightbox.ts`: click-to-fullscreen for every `.prose img`.
- `.prose .img-grid` in `src/styles/prose.css`: manual 2-up grid via an HTML wrapper.

Decisions made with Anping (2026-07-14, after live demos on the dev server):

1. Trigger: auto-detect image-only lists (no frontmatter flag, no HTML wrapper).
2. Layout: 2-column grid with a consistent 16:9 crop (demo B2).
3. Lightbox gains prev/next navigation for gallery images.

## Design

### 1. Rehype plugin: detect image-only lists

New file `scripts/rehype/image-gallery.mjs`, registered in `astro.config.mjs` `markdown.rehypePlugins` after `rehypeAutolinkHeadings`.

A `<ul>` qualifies as a gallery when:

- it has 2 or more `<li>` children, and
- every `<li>` contains exactly one element child, which is an `<img>`, or a `<p>` or `<a>` whose only element child is an `<img>`, and
- no `<li>` contains non-whitespace text.

Qualifying lists get `image-gallery` appended to their class list. Nothing else in the tree changes: no restructuring, markdown sources untouched, `<ol>` never qualifies. Non-qualifying lists (any text in any item) are left alone, which is also the author's escape hatch: captioning any item turns the gallery back into a normal list.

The plugin applies to both `.md` and `.mdx`, and to translation sibling bodies (`*.zh.md` / `*.en.md`), since all flow through the same markdown pipeline. RSS output gains the class attribute on those lists, which feed readers ignore; the feed still shows an ordinary list of images.

### 2. CSS: the grid

In `src/styles/prose.css`, next to the existing `.img-grid` block:

- `.prose ul.image-gallery`: `list-style: none`, `padding: 0`, `display: grid`, `grid-template-columns: 1fr 1fr`, `gap: var(--space-2)`, `margin-block: var(--space-6)`.
- `.prose ul.image-gallery li`: `margin: 0`.
- `.prose ul.image-gallery img`: `width: 100%`, `aspect-ratio: 16 / 9`, `object-fit: cover`, `margin: 0`.

Two columns at all viewport widths: verified in the demo that 2-up 16:9 tiles stay legible at 375px. Existing `.prose img` border, radius, and background rules continue to apply. The `.img-grid` helper is unchanged and remains available for deliberate side-by-side pairs inside prose.

Crops lose part of each frame (notably portrait photos in the BMW and reMarkable posts); the lightbox always shows the full uncropped image, verified in the demo.

### 3. Lightbox: gallery navigation

Changes to `src/scripts/image-lightbox.ts` and `src/components/ImageLightbox.astro` (plus `src/styles/components/image-lightbox.css`):

- When an image inside `ul.image-gallery` is opened, the lightbox records the ordered list of that gallery's images and the current index.
- New prev/next buttons in the dialog (chevron icons, styled like the existing close button) and ArrowLeft/ArrowRight key handling. Navigation wraps around.
- A counter, for example `3 / 6`, renders in the caption area beneath the image; per-image `alt` and `em` captions still swap in as today.
- Prev/next buttons are hidden when the lightbox is opened from a standalone (non-gallery) image; behavior there is unchanged.
- The existing focus trap (currently Tab always refocuses the close button) cycles across close/prev/next when the nav is visible.

## Out of scope

- Masonry, filmstrip, or per-post layout options.
- Configurable crop ratio or column count (can be added later as modifier classes if a post needs it).
- Touch swipe gestures in the lightbox.
- Any edits to post markdown files: existing posts upgrade automatically.
- Hero images (`src/assets/hero/`) and the R2 image pipeline.

## Testing

- Plugin unit tests in `scripts/rehype/image-gallery.test.mjs` (`node:test`, same pattern as `npm run test:images`): qualifying tight list, qualifying loose list (`p`-wrapped), linked images, list with a text item rejected, `ol` rejected, single-image list rejected.
- Manual pass on the dev server: animal-crossing (en + zh), bmw-x3-30i, remarkable-2-review at desktop and 375px, light and dark themes.
- Lightbox: open from grid tile, arrow keys, wrap-around, counter, Escape and backdrop close, focus restore; standalone image unchanged.
- `npm run check`, `lint`, `lint:css`, `build`, then `release-check` before any push (rule 5 applies as always).

## Risks

- False positives: any existing image-only list becomes a gallery. Today that set is exactly the photo-run posts this is for; the escape hatch (any text in an item) covers future exceptions.
- The current checkout is the `bilingual-toggle` branch, which is behind `origin/main`. Branch choice for implementation (fresh branch off `main` vs stacking on `bilingual-toggle`) is decided with Anping before implementation starts.
