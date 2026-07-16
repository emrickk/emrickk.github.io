# Post-wide lightbox navigation with touch swipe

**Date:** 2026-07-15
**Goal:** Opening any photo in a post lets the reader browse every photo in that post: swipe on touch screens, visible edge arrows plus arrow keys on desktop.

## Background

The lightbox (`src/components/ImageLightbox.astro`, `src/scripts/image-lightbox.ts`, `src/styles/components/image-lightbox.css`) already has prev/next buttons, ArrowLeft/ArrowRight handling, a counter, wrap-around, and a Tab focus cycle. But navigation only activates when the opened image sits inside a `ul.image-gallery` produced at build time by `scripts/rehype/image-gallery.mjs` (image-only lists, or runs of 3 or more bare image paragraphs).

Travel photo posts interleave photos with caption lines (`<p><img><em>caption</em></p>`) and prose, so almost every photo in them is standalone: the lightbox opens with no navigation at all. Touch swipe was explicitly out of scope in the 2026-07-14 image gallery spec; this design picks both gaps up.

Two structural facts that shape the design:

1. A post page has exactly one `.prose` container (`#prose-content` in `PostLayout.astro`); archived comments and other page chrome are outside it.
2. Bilingual posts render both language bodies into that container (`src/pages/posts/[...slug].astro` emits `div.lang.lang-zh` and `div.lang.lang-en`; CSS hides the inactive one). A browse set built from all `.prose` images would therefore double-count every photo.

Decisions made with Anping (2026-07-15):

1. Browse set: every photo in the post, in reading order, not just the surrounding gallery block.
2. Phone: swipe navigates, and the edge arrows stay visible as a discoverability hint.

## Design

All changes live in `src/scripts/image-lightbox.ts`. No markup, CSS, or rehype plugin changes are expected; `ul.image-gallery` remains solely responsible for grid layout in the post body.

### 1. Browse set: every zoomable photo in the visible language body

`openLightbox` builds the browse set fresh at open time instead of reading the surrounding gallery:

- Browse root: the clicked image's `closest('.lang')` container when the post is bilingual, otherwise the `.prose` container. The reader can only click a visible image, so this is always the language they are reading.
- Browse set: the root's bound images (the bind pass already marks every unlinked `.prose img` with `data-lightbox-bound`), in `querySelectorAll` document order, which matches reading order.
- `galleryIndex` is the clicked image's position in that set.

Consequences:

- The counter reads position out of all photos in the post body, for example `7 / 22`.
- Prev/next, arrow keys, and swipe work from any photo whenever the body has 2 or more photos; navigation crosses captions, prose, and gallery boundaries. Single-photo posts show no navigation, as today.
- Wrap-around navigation is kept (existing modulo behavior).
- Captions and alt text keep swapping per photo via the existing `sourceFor`/`captionFor` helpers; photos without captions hide the caption line.
- Link-wrapped images stay excluded from both zoom and the browse set (clicking them navigates, by design).
- Collecting at open time also means no stale state: the set always reflects the current DOM.

### 2. Touch swipe

A touch handler on the dialog:

- Single finger only; a second finger cancels the gesture so pinch behavior is untouched.
- On release, navigate prev/next when the horizontal displacement is at least 48px and clearly dominates the vertical (roughly `|dx| > 1.5 * |dy|`); otherwise do nothing.
- A completed swipe suppresses the click event that follows `touchend`, so a swipe can never trigger the existing tap-on-backdrop-to-close handler.
- No drag-follow animation: the image swaps instantly, exactly as with arrows and keys. Drag physics is where library-grade complexity starts and is out of scope.

### 3. Arrows and keys

Unchanged. `.lightbox-nav` already repositions to the viewport edges at 600px and below and shows whenever the browse set has 2 or more photos, which now includes phones and standalone photos. ArrowLeft/ArrowRight handling is already correct.

## Out of scope

- Drag-follow or spring animation, and pinch-to-zoom inside the lightbox.
- Preloading neighboring images (possible later nicety).
- The /notes timeline: it does not mount the lightbox today and that does not change.
- Any edits to post markdown, the rehype gallery plugin, markup, or CSS.

## Testing

There is no unit-test harness for browser scripts (`test:images` and `test:rehype` cover the pipelines and are unaffected). Verification is in the browser against the built site:

- Desktop: open from a standalone captioned photo, from a gallery tile, and from the first and last photo of a post; arrows, arrow keys, wrap-around, counter correctness against the post's photo count, Tab cycle across close/prev/next, Escape, backdrop click, focus restore on close. Verify a bilingual post counts only the visible language's photos, in both languages.
- Mobile (device emulation, then Anping's real phone via `preview-posts -- --host`): swipe both directions, vertical pan does not navigate, a swipe never closes the dialog, arrows remain tappable, single-photo post shows no arrows.
- `npm run check`, `lint`, `build`; the script ships on every post page, so the post preview gate applies (check 12), then `release-check` before any push (rule 5 as always).

## Risks

- `sourceFor` reads `currentSrc` when there is no `data-src`; photos far down the page may not have loaded yet when reached via browsing (lazy loading), so the fallback to `src` must keep working for images the browser has not fetched. The existing helper already has that fallback; the matrix above exercises it by browsing immediately after opening the first photo.
- Concurrent agent sessions share this checkout on `main` (repo rules 6 to 8). Implementation commits land with explicit paths in single stage-and-commit steps; nothing deploys without Anping's push decision.
