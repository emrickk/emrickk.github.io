# Post-Wide Lightbox Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Opening any photo in a post lets the reader browse every photo in that post: swipe on touch screens, edge arrows plus arrow keys on desktop.

**Architecture:** The lightbox UI (arrows, counter, arrow keys, focus cycle) already exists and only its browse scope changes: `openLightbox` collects every bound photo in the visible language body instead of only the surrounding `ul.image-gallery`. A small touch handler on the dialog adds threshold swipe. Everything lives in one file, `src/scripts/image-lightbox.ts`.

**Tech Stack:** Astro 6, vanilla TypeScript (no framework, no new dependencies), native `<dialog>`.

**Spec:** `docs/superpowers/specs/2026-07-15-lightbox-post-wide-navigation-design.md`. Read it first; the Background section explains the bilingual double-count hazard that shapes Task 1.

**Testing note:** This repo has no unit-test harness for browser scripts (`test:images` and `test:rehype` cover the Node pipelines and are unaffected). Per the approved spec, verification is in the browser. Each task therefore ends in a scripted browser check instead of a unit test. Use the Claude preview tools or Playwright (see `.claude/launch.json`); any dev server works.

**Repo rules that apply (CLAUDE.md):** no em-dashes in code comments or commit messages; stage and commit in a single step with explicit paths; never push, the owner pushes after a GO verdict.

---

## File Structure

- Modify: `src/scripts/image-lightbox.ts` (the only source change)
- No changes: `src/components/ImageLightbox.astro`, `src/styles/components/image-lightbox.css`, `scripts/rehype/image-gallery.mjs`

---

### Task 1: Post-wide browse set

**Files:**
- Modify: `src/scripts/image-lightbox.ts:66-77` (the `openLightbox` function)

- [ ] **Step 1: Replace the gallery collection in `openLightbox`**

Current code:

```ts
const openLightbox = (img: HTMLImageElement) => {
  previousFocus = document.activeElement;
  const galleryRoot = img.closest('ul.image-gallery');
  gallery = galleryRoot
    ? [...galleryRoot.querySelectorAll<HTMLImageElement>('img')].filter((i) => !i.closest('a'))
    : [];
  galleryIndex = Math.max(0, gallery.indexOf(img));
  showImage(img);
  dialog.showModal();
  document.body.style.overflow = 'hidden';
  closeBtn.focus({ preventScroll: true });
};
```

Replace with:

```ts
const openLightbox = (img: HTMLImageElement) => {
  previousFocus = document.activeElement;
  // Browse every bound photo in the language body being read. Bilingual posts
  // render both bodies into .prose; only the visible one can be clicked, so
  // scoping to the clicked image's .lang container avoids double-counting.
  const browseRoot = img.closest('.lang') ?? img.closest('.prose');
  gallery = browseRoot
    ? [...browseRoot.querySelectorAll<HTMLImageElement>('img[data-lightbox-bound]')]
    : [img];
  galleryIndex = Math.max(0, gallery.indexOf(img));
  showImage(img);
  dialog.showModal();
  document.body.style.overflow = 'hidden';
  closeBtn.focus({ preventScroll: true });
};
```

Why this is correct: the bind pass (same file, the `.prose img` loop) sets `data-lightbox-bound` only on unlinked images, so link-wrapped images are excluded without a filter; `querySelectorAll` returns document order, which is reading order; single-language posts have no `.lang` wrapper, so the `.prose` fallback covers them. `showImage` already derives arrow/counter visibility from `gallery.length > 1`, so no other function changes.

- [ ] **Step 2: Type-check and lint**

Run: `npm run check && npm run lint`
Expected: both pass with no new errors.

- [ ] **Step 3: Verify in the browser (desktop behavior)**

Start the dev server and open a bilingual travel post, for example `/posts/springtime-in-patagonia/`. Verify:

1. Click a standalone captioned photo mid-post: arrows and a counter appear (previously they did not), and the counter total equals the number of photos in the post body.
2. ArrowRight/ArrowLeft walk photos in reading order, crossing captions and prose; captions swap per photo and hide for photos without one.
3. Next from the last photo wraps to the first.
4. Toggle language, reopen a photo: the counter total is that body's own photo count, not the sum of both.
5. Open a photo from a gallery grid post (for example `/posts/bmw-x3-30i/`): navigation now spans the whole post body, not just the grid.
6. Escape and backdrop click still close; Tab still cycles close/prev/next; focus returns to the opened image on close.

Expected: all six pass.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(lightbox): browse every post photo, scoped to the visible language body

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- src/scripts/image-lightbox.ts
```

---

### Task 2: Touch swipe with click suppression

**Files:**
- Modify: `src/scripts/image-lightbox.ts:99-104` (listener block: add touch handlers, adjust the dialog click handler)

- [ ] **Step 1: Add the touch handlers and suppression flag**

Insert immediately after the `nextBtn.addEventListener(...)` line, replacing the existing `dialog.addEventListener('click', ...)` block:

```ts
// Threshold swipe for touch screens: single finger, mostly horizontal,
// at least 48px. A completed swipe suppresses the click that can follow
// touchend so it never hits the backdrop-close below. A second finger
// cancels the gesture and suppresses nothing.
let touchStartX = 0;
let touchStartY = 0;
let touchActive = false;
let suppressClick = false;

dialog.addEventListener(
  'touchstart',
  (event) => {
    suppressClick = false;
    touchActive = event.touches.length === 1;
    if (!touchActive) return;
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
  },
  { passive: true },
);

dialog.addEventListener(
  'touchend',
  (event) => {
    if (!touchActive) return;
    touchActive = false;
    if (gallery.length < 2) return;
    const dx = event.changedTouches[0].clientX - touchStartX;
    const dy = event.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) < 48 || Math.abs(dx) <= 1.5 * Math.abs(dy)) return;
    suppressClick = true;
    showAt(dx < 0 ? galleryIndex + 1 : galleryIndex - 1);
  },
  { passive: true },
);

dialog.addEventListener('click', (event) => {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  if (event.target === dialog) closeLightbox();
});
```

Behavior notes for the implementer: swipe left (dx negative) advances to the next photo, matching native photo viewers. Tapping the arrow buttons is safe: the tap's dx is near zero, so the touchend handler does nothing and the button's own click fires normally. Both listeners are passive; nothing calls `preventDefault`, so pinch and native scrolling are untouched.

- [ ] **Step 2: Type-check and lint**

Run: `npm run check && npm run lint`
Expected: both pass. If `Touch`/`TouchEvent` types are missing, the `dom` lib is absent from tsconfig; stop and surface that instead of adding casts (it is present today).

- [ ] **Step 3: Verify swipe with synthetic touch events**

With the lightbox open on a multi-photo post, run in the browser console (or `preview_eval`):

```js
(() => {
  const dialog = document.getElementById('lightbox');
  const mk = (x, y) => new Touch({ identifier: 1, target: dialog, clientX: x, clientY: y });
  const fire = (type, x, y) =>
    dialog.dispatchEvent(
      new TouchEvent(type, {
        bubbles: true,
        touches: type === 'touchend' ? [] : [mk(x, y)],
        changedTouches: [mk(x, y)],
      }),
    );
  const counter = () => document.getElementById('lightbox-counter').textContent;
  const before = counter();
  fire('touchstart', 300, 400);
  fire('touchend', 180, 410); // 120px left, 10px down: swipe left
  const afterLeft = counter();
  fire('touchstart', 300, 400);
  fire('touchend', 300, 300); // pure vertical: no navigation
  const afterVertical = counter();
  return { before, afterLeft, afterVertical, dialogStillOpen: dialog.open };
})();
```

Expected: `afterLeft` is `before` advanced by one (wrapping at the end), `afterVertical` equals `afterLeft`, and `dialogStillOpen` is `true`. Then repeat the first pair with `fire('touchend', 420, 410)` and confirm the counter goes back (swipe right = previous). Finally click the backdrop (the dialog element itself, outside the image) and confirm the lightbox still closes: suppression must not eat real clicks.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(lightbox): navigate photos with touch swipe

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- src/scripts/image-lightbox.ts
```

---

### Task 3: Production build, full matrix, and the ship gates

**Files:** none modified; verification and gates only.

- [ ] **Step 1: Build**

Run: `npm run build`
Expected: build succeeds (Pagefind step included).

- [ ] **Step 2: Full matrix against the production build**

Serve `dist/` with `npm run preview` (never the dev server for this step) and run the spec's matrix:

- Desktop: open from a standalone captioned photo, a gallery tile, and the first and last photo of a post; arrows, arrow keys, wrap-around, counter totals, Tab cycle, Escape, backdrop click, focus restore. Both languages of a bilingual post.
- Mobile emulation (390px, touch): swipe both directions, vertical pan does not navigate, a swipe never closes the dialog, arrows remain tappable at the screen edges, counter visible.
- A post with a single photo, if one is handy, shows no arrows; otherwise confirm on any post by checking a photo-less section is unaffected.

Expected: every line passes. Fix and re-verify before proceeding; @superpowers:verification-before-completion applies.

- [ ] **Step 3: Owner preview gate**

Invoke the @preview-posts skill (`npm run preview-posts`). The changed script ships on every post page, so the gate applies. Caution: this checkout is shared by concurrent sessions; approve mode covers every preview-relevant change in the tree. If the file list at approve time contains post edits from other sessions that the owner has not reviewed, stop and run the gate from a dedicated worktree instead (the preview-gate worktree flow used on 2026-07-15 for the yosemite edits). Offer `-- --host` so the owner can test swipe on their real phone. Only run `-- --approve` after the owner explicitly approves.

- [ ] **Step 4: Release check**

Invoke the @release-check skill (`npm run release-check`, quick mode is acceptable for this single-script change). Expected: `VERDICT: GO, safe to push`. Report the verdict; the owner decides the push (repo rule 5). Never push.
