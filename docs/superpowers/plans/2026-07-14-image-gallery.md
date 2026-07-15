# Image Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Photo runs in posts render as a 2-column 16:9 grid with lightbox prev/next navigation, driven by build-time auto-detection (no post edits).

**Architecture:** A rehype plugin tags image-only lists (2+ images) with an `image-gallery` class and collapses runs of 3+ bare image paragraphs into the same structure. CSS in `prose.css` renders the grid. The existing lightbox script gains gallery grouping, prev/next buttons, arrow keys, and a counter.

**Tech Stack:** Astro 6 markdown pipeline (rehype/HAST), plain CSS, TypeScript DOM script, `node:test`.

**Spec:** `docs/superpowers/specs/2026-07-14-image-gallery-design.md`

**Repo rules that override generic habits (CLAUDE.md):** stage and commit in ONE step with explicit paths (`git commit -m "..." -- <paths>`), never `git add`; no em-dashes anywhere user-facing including commit messages; never push to `main` (rule 5); re-verify the branch is `main` before each commit (rule 6, concurrent sessions).

---

## File structure

| File | Responsibility |
| --- | --- |
| Create `scripts/rehype/image-gallery.mjs` | Detection rules A and B, pure HAST transform, no dependencies |
| Create `scripts/rehype/image-gallery.test.mjs` | Unit tests, hand-built HAST fixtures, `node:test` |
| Modify `package.json` | Add `test:rehype` script |
| Modify `astro.config.mjs` | Register the plugin after `rehypeAutolinkHeadings` |
| Modify `src/styles/prose.css` | `.prose ul.image-gallery` grid rules, next to `.img-grid` (after line 310) |
| Modify `src/components/ImageLightbox.astro` | Prev/next buttons and counter element |
| Modify `src/styles/components/image-lightbox.css` | Nav button and counter styles |
| Modify `src/scripts/image-lightbox.ts` | Gallery grouping, navigation, focus trap |
| Modify `CLAUDE.md`, `docs/images.md` | Command row, authoring note |

---

### Task 1: Rehype plugin (TDD)

**Files:**
- Create: `scripts/rehype/image-gallery.test.mjs`
- Create: `scripts/rehype/image-gallery.mjs`
- Modify: `package.json:42` (scripts block)

- [ ] **Step 1: Add the test script to package.json**

In the `scripts` block, after the `"test:images"` line, add:

```json
"test:rehype": "node --test \"scripts/rehype/*.test.mjs\"",
```

- [ ] **Step 2: Write the failing tests**

Create `scripts/rehype/image-gallery.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import rehypeImageGallery from './image-gallery.mjs';

const el = (tagName, properties = {}, children = []) => ({
  type: 'element',
  tagName,
  properties,
  children,
});
const text = (value) => ({ type: 'text', value });
const img = (src = 'https://cdn.anping.us/x.webp') => el('img', { src, alt: '' });
const a = (...children) => el('a', { href: 'http://emrick.us/x' }, children);
const p = (...children) => el('p', {}, children);
const li = (...children) => el('li', {}, children);
const ul = (...children) => el('ul', {}, children);
const ol = (...children) => el('ol', {}, children);
const root = (...children) => ({ type: 'root', children });

const run = (tree) => {
  rehypeImageGallery()(tree);
  return tree;
};
const classes = (node) => node.properties?.className ?? [];
const tags = (tree) => tree.children.filter((c) => c.type === 'element').map((c) => c.tagName);

test('rule A: tight image list of 2 gains the gallery class', () => {
  const list = ul(li(img()), li(img()));
  run(root(list));
  assert.deepEqual(classes(list), ['image-gallery']);
});

test('rule A: loose list (p-wrapped images) gains the gallery class', () => {
  const list = ul(li(p(img())), li(p(img())), li(p(img())));
  run(root(list));
  assert.deepEqual(classes(list), ['image-gallery']);
});

test('rule A: whitespace text nodes inside the list are tolerated', () => {
  const list = ul(text('\n'), li(img()), text('\n'), li(img()), text('\n'));
  run(root(list));
  assert.deepEqual(classes(list), ['image-gallery']);
});

test('rule A: a list item with text is rejected', () => {
  const list = ul(li(img()), li(img(), text('caption')));
  run(root(list));
  assert.deepEqual(classes(list), []);
});

test('rule A: link-wrapped images are rejected (mit-coasters shape)', () => {
  const list = ul(li(a(img())), li(a(img())), li(a(img())), li(a(img())));
  run(root(list));
  assert.deepEqual(classes(list), []);
});

test('rule A: ordered lists never qualify', () => {
  const list = ol(li(img()), li(img()), li(img()));
  run(root(list));
  assert.deepEqual(classes(list), []);
});

test('rule A: a single-image list is rejected', () => {
  const list = ul(li(img()));
  run(root(list));
  assert.deepEqual(classes(list), []);
});

test('rule B: a run of 3 image paragraphs becomes a gallery list', () => {
  const tree = root(p(img('a')), text('\n'), p(img('b')), text('\n'), p(img('c')));
  run(tree);
  assert.deepEqual(tags(tree), ['ul']);
  const gallery = tree.children.find((c) => c.type === 'element');
  assert.deepEqual(classes(gallery), ['image-gallery']);
  assert.equal(gallery.children.length, 3);
  assert.ok(gallery.children.every((item) => item.tagName === 'li' && item.children[0].tagName === 'img'));
  assert.deepEqual(
    gallery.children.map((item) => item.children[0].properties.src),
    ['a', 'b', 'c'],
  );
});

test('rule B: a run of 2 image paragraphs is left alone', () => {
  const tree = root(p(img()), text('\n'), p(img()));
  run(tree);
  assert.deepEqual(tags(tree), ['p', 'p']);
});

test('rule B: a text paragraph splits runs; each side judged separately', () => {
  const tree = root(
    p(img()), text('\n'), p(img()),
    text('\n'), p(text('between')), text('\n'),
    p(img('d')), text('\n'), p(img('e')), text('\n'), p(img('f')),
  );
  run(tree);
  assert.deepEqual(tags(tree), ['p', 'p', 'p', 'ul']);
});

test('rule B: runs at document start and end both convert', () => {
  const tree = root(
    p(img()), p(img()), p(img()),
    p(text('middle')),
    p(img()), p(img()), p(img()),
  );
  run(tree);
  assert.deepEqual(tags(tree), ['ul', 'p', 'ul']);
});

test('rule B: link-wrapped image paragraphs never join a run', () => {
  const tree = root(p(img()), p(a(img())), p(img()));
  run(tree);
  assert.deepEqual(tags(tree), ['p', 'p', 'p']);
});

test('rule B: paragraphs with an image plus text are not bare', () => {
  const tree = root(p(img()), p(img(), text('note')), p(img()));
  run(tree);
  assert.deepEqual(tags(tree), ['p', 'p', 'p']);
});

test('nested containers are transformed (run inside blockquote)', () => {
  const quote = el('blockquote', {}, [p(img()), p(img()), p(img())]);
  run(root(quote));
  assert.deepEqual(quote.children.map((c) => c.tagName), ['ul']);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test:rehype`
Expected: FAIL, `Cannot find module ... scripts/rehype/image-gallery.mjs`

- [ ] **Step 4: Write the plugin**

Create `scripts/rehype/image-gallery.mjs`:

```js
// Build-time gallery detection for photo runs. Two rules, one output shape:
// Rule A: a <ul> whose every <li> holds exactly one unlinked <img>
//         (2 or more items) gains the image-gallery class.
// Rule B: a run of 3 or more consecutive bare image paragraphs is replaced
//         by a <ul class="image-gallery"> with one <li><img></li> per image.
// Linked images (<a><img></a>) never qualify: the lightbox skips them, so a
// cropped tile would navigate away instead of zooming.
// Spec: docs/superpowers/specs/2026-07-14-image-gallery-design.md

const GALLERY_CLASS = 'image-gallery';
const MIN_LIST_IMAGES = 2;
const MIN_PARAGRAPH_RUN = 3;

function isWhitespaceText(node) {
  return node.type === 'text' && node.value.trim() === '';
}

// The node's single element child, or null when the node has more than one
// element child or any non-whitespace text.
function onlyElementChild(node) {
  let found = null;
  for (const child of node.children ?? []) {
    if (isWhitespaceText(child)) continue;
    if (child.type !== 'element') return null;
    if (found) return null;
    found = child;
  }
  return found;
}

// The single unlinked <img> inside a list item, unwrapping one <p>.
function listItemImage(item) {
  let child = onlyElementChild(item);
  if (child && child.tagName === 'p') child = onlyElementChild(child);
  return child && child.tagName === 'img' ? child : null;
}

function qualifiesAsListGallery(list) {
  const items = (list.children ?? []).filter((child) => !isWhitespaceText(child));
  if (items.length < MIN_LIST_IMAGES) return false;
  return items.every(
    (item) => item.type === 'element' && item.tagName === 'li' && listItemImage(item),
  );
}

function isBareImageParagraph(node) {
  return (
    node.type === 'element' &&
    node.tagName === 'p' &&
    onlyElementChild(node)?.tagName === 'img'
  );
}

function addGalleryClass(node) {
  const props = (node.properties ??= {});
  const existing = props.className;
  if (Array.isArray(existing)) {
    if (!existing.includes(GALLERY_CLASS)) existing.push(GALLERY_CLASS);
  } else if (typeof existing === 'string') {
    props.className = existing.split(/\s+/).concat(GALLERY_CLASS);
  } else {
    props.className = [GALLERY_CLASS];
  }
}

function buildGallery(paragraphs) {
  return {
    type: 'element',
    tagName: 'ul',
    properties: { className: [GALLERY_CLASS] },
    children: paragraphs.map((paragraph) => ({
      type: 'element',
      tagName: 'li',
      properties: {},
      children: [onlyElementChild(paragraph)],
    })),
  };
}

function transform(parent) {
  if (!parent.children) return;

  // Rule B: collapse qualifying paragraph runs among this parent's children.
  const next = [];
  let run = []; // bare image paragraphs in the current run
  let pending = []; // the run's nodes including interior whitespace text

  const flush = () => {
    if (run.length >= MIN_PARAGRAPH_RUN) next.push(buildGallery(run));
    else next.push(...pending);
    run = [];
    pending = [];
  };

  for (const child of parent.children) {
    if (isBareImageParagraph(child)) {
      run.push(child);
      pending.push(child);
    } else if (run.length > 0 && isWhitespaceText(child)) {
      pending.push(child);
    } else {
      flush();
      next.push(child);
    }
  }
  flush();
  parent.children = next;

  // Rule A on lists, recursion everywhere else.
  for (const child of parent.children) {
    if (child.type !== 'element') continue;
    if (child.tagName === 'ul' && qualifiesAsListGallery(child)) {
      addGalleryClass(child);
    } else {
      transform(child);
    }
  }
}

export default function rehypeImageGallery() {
  return (tree) => transform(tree);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:rehype`
Expected: PASS, 14 tests

- [ ] **Step 6: Commit (single step, explicit paths, verify branch is main first)**

```bash
git branch --show-current
git commit -m "Add rehype image-gallery plugin with tests

Rule A tags image-only lists of 2+; rule B collapses runs of 3+ bare
image paragraphs into a gallery list. Linked images never qualify.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- scripts/rehype/image-gallery.mjs scripts/rehype/image-gallery.test.mjs package.json
```

---

### Task 2: Wire the plugin and add the grid CSS

**Files:**
- Modify: `astro.config.mjs:9-11` (imports) and `:43-53` (rehypePlugins)
- Modify: `src/styles/prose.css` (insert after the `.img-grid` media query block, line 310)

- [ ] **Step 1: Register the plugin**

In `astro.config.mjs`, add the import after the `rehype-slug` import (line 9):

```js
import rehypeImageGallery from './scripts/rehype/image-gallery.mjs';
```

Add the plugin at the end of `markdown.rehypePlugins`, after the `rehypeAutolinkHeadings` entry:

```js
  markdown: {
    rehypePlugins: [
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        {
          behavior: 'append',
          properties: { ariaHidden: true, tabIndex: -1, class: 'heading-anchor' },
          content: { type: 'text', value: '#' },
        },
      ],
      rehypeImageGallery,
    ],
  },
```

- [ ] **Step 2: Add the grid CSS**

In `src/styles/prose.css`, directly after the `.img-grid` mobile media query (closes at line 310), insert:

```css
/* Auto-detected photo galleries: image-only lists and long image runs.
   Classes are added at build time by scripts/rehype/image-gallery.mjs. */
.prose ul.image-gallery {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
  margin-block: var(--space-6);
  padding: 0;
  list-style: none;
}

.prose ul.image-gallery li {
  margin: 0;
  padding: 0;
}

.prose ul.image-gallery li p {
  margin: 0;
}

.prose ul.image-gallery img {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  margin: 0;
}
```

- [ ] **Step 3: Verify in the dev server**

Run the dev server via the `blog-dev` launch config (this repo's `.claude/launch.json`, port 4399; the AI Space root launch.json also has `blog-dev-b` with autoPort). Check:

- `/posts/animal-crossing-is-a-good-game/`: six photos render as a 2-column grid, no list bullets (rule A).
- `/posts/bmw-x3-30i/`: the 14-photo run renders as a grid (rule B).
- `/posts/bmw-330i/`: the 4-photo run is a grid; the three 2-photo pairs stay full-width (by design).
- `/posts/mit-coasters/`: unchanged bulleted list of linked images.
- `/posts/aiyou-user-growth/`: chart pairs unchanged, full-width.
- Toggle dark mode and a 375px viewport on the animal-crossing post.

- [ ] **Step 4: Gate the plugin tests in release-check**

Now that the plugin affects production builds, its tests must gate releases. In `scripts/release-check.mjs`, in the `CHECKS` array after the `image tests` entry (line 289), add:

```js
  { num: 8, name: 'rehype tests', run: (root) => npmRun(root, 'test:rehype') },
```

and renumber the subsequent entries (built output 9, CDN images 10, internal links 11). Run `npm run test:safety` afterward; if any release-check test pins the old numbering, update it to match.

- [ ] **Step 5: Run checks**

Run: `npm run lint:css` and `npm run check` and `npm run test:safety`
Expected: all clean

- [ ] **Step 6: Commit**

```bash
git branch --show-current
git commit -m "Render auto-detected photo galleries as 2-column grids

Register the rehype plugin and style ul.image-gallery next to the
existing img-grid helper: 16:9 crops, object-fit cover, two columns
at every viewport width. Release-check now runs the plugin tests.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- astro.config.mjs src/styles/prose.css scripts/release-check.mjs
```

---

### Task 3: Lightbox gallery navigation

**Files:**
- Modify: `src/components/ImageLightbox.astro`
- Modify: `src/styles/components/image-lightbox.css`
- Modify: `src/scripts/image-lightbox.ts`

- [ ] **Step 1: Add nav buttons and counter to the dialog markup**

In `src/components/ImageLightbox.astro`, inside `.lightbox-inner`, after the close button and before `<img id="lightbox-img" ...>`, add:

```astro
    <button type="button" class="lightbox-nav lightbox-prev" aria-label="Previous image" hidden>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M10 2 4 8l6 6"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"></path>
      </svg>
    </button>
    <button type="button" class="lightbox-nav lightbox-next" aria-label="Next image" hidden>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="m6 2 6 6-6 6"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"></path>
      </svg>
    </button>
```

After the `<p id="lightbox-caption" ...>` line, add the counter as a sibling (spec: caption and counter never share a line):

```astro
    <p id="lightbox-counter" class="lightbox-counter" hidden></p>
```

- [ ] **Step 2: Style the nav buttons and counter**

In `src/styles/components/image-lightbox.css`, after the `.lightbox-close:hover` rule (line 62), add:

```css
.lightbox-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  color: white;
  cursor: pointer;
  z-index: 1;
  transition: background var(--duration-fast) var(--ease-out);
}

.lightbox-nav:hover {
  background: rgba(255, 255, 255, 0.26);
}

.lightbox-prev {
  left: -22px;
}

.lightbox-next {
  right: -22px;
}

@media (max-width: 600px) {
  .lightbox-prev {
    left: 6px;
  }

  .lightbox-next {
    right: 6px;
  }
}
```

After the `.lightbox-caption` rule (line 79), add:

```css
.lightbox-counter {
  margin: 0;
  font-size: var(--text-footnote);
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
}
```

- [ ] **Step 3: Extend the lightbox script**

Replace the body of `src/scripts/image-lightbox.ts` with:

```ts
export function mountImageLightbox() {
  const dialog = document.getElementById('lightbox');
  if (!(dialog instanceof HTMLDialogElement) || dialog.dataset.lightboxReady === 'true') return;
  dialog.dataset.lightboxReady = 'true';

  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCap = document.getElementById('lightbox-caption');
  const lightboxCount = document.getElementById('lightbox-counter');
  const closeBtn = dialog.querySelector('.lightbox-close');
  const prevBtn = dialog.querySelector('.lightbox-prev');
  const nextBtn = dialog.querySelector('.lightbox-next');

  if (
    !(lightboxImg instanceof HTMLImageElement) ||
    !(lightboxCap instanceof HTMLParagraphElement) ||
    !(lightboxCount instanceof HTMLParagraphElement) ||
    !(closeBtn instanceof HTMLButtonElement) ||
    !(prevBtn instanceof HTMLButtonElement) ||
    !(nextBtn instanceof HTMLButtonElement)
  ) {
    return;
  }

  let previousFocus: Element | null = null;
  let gallery: HTMLImageElement[] = [];
  let galleryIndex = 0;

  const restorePage = () => {
    document.body.style.overflow = '';
    if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
    previousFocus = null;
    gallery = [];
  };

  const closeLightbox = () => {
    if (dialog.open) dialog.close();
  };

  const sourceFor = (img: HTMLImageElement) =>
    img.getAttribute('data-src') ?? img.currentSrc ?? img.src;

  const captionFor = (img: HTMLImageElement) =>
    img.nextElementSibling?.tagName === 'EM'
      ? ((img.nextElementSibling as HTMLElement).textContent ?? '')
      : '';

  const showImage = (img: HTMLImageElement) => {
    lightboxImg.src = sourceFor(img);
    lightboxImg.alt = img.alt;
    const caption = captionFor(img);
    lightboxCap.textContent = caption;
    lightboxCap.hidden = !caption;
    const inGallery = gallery.length > 1;
    lightboxCount.textContent = inGallery ? `${galleryIndex + 1} / ${gallery.length}` : '';
    lightboxCount.hidden = !inGallery;
    prevBtn.hidden = !inGallery;
    nextBtn.hidden = !inGallery;
  };

  const showAt = (index: number) => {
    galleryIndex = (index + gallery.length) % gallery.length;
    showImage(gallery[galleryIndex]);
  };

  const openLightbox = (img: HTMLImageElement) => {
    previousFocus = document.activeElement;
    const galleryRoot = img.closest('ul.image-gallery');
    gallery = galleryRoot ? [...galleryRoot.querySelectorAll<HTMLImageElement>('img')] : [];
    galleryIndex = Math.max(0, gallery.indexOf(img));
    showImage(img);
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    closeBtn.focus({ preventScroll: true });
  };

  document.querySelectorAll<HTMLImageElement>('.prose img').forEach((img) => {
    if (img.closest('a') || img.dataset.lightboxBound === 'true') return;
    img.dataset.lightboxBound = 'true';
    img.classList.add('is-zoomable');
    img.setAttribute('tabindex', '0');
    img.setAttribute('role', 'button');
    img.setAttribute('aria-haspopup', 'dialog');
    img.setAttribute('aria-label', `${img.alt || 'Image'} preview`);

    const open = () => openLightbox(img);

    img.addEventListener('click', open);
    img.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });

  closeBtn.addEventListener('click', closeLightbox);
  prevBtn.addEventListener('click', () => showAt(galleryIndex - 1));
  nextBtn.addEventListener('click', () => showAt(galleryIndex + 1));
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeLightbox();
  });
  dialog.addEventListener('keydown', (event) => {
    if (gallery.length > 1 && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault();
      showAt(event.key === 'ArrowLeft' ? galleryIndex - 1 : galleryIndex + 1);
      return;
    }
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const controls = [closeBtn, prevBtn, nextBtn].filter((button) => !button.hidden);
    const at = controls.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.shiftKey ? -1 : 1;
    controls[(at + step + controls.length) % controls.length].focus({ preventScroll: true });
  });
  dialog.addEventListener('close', restorePage);
}
```

What changed vs the old file: `openLightbox` takes the clicked `img` and derives the gallery group via `img.closest('ul.image-gallery')`; `showImage`/`showAt` centralize src/alt/caption/counter updates with wrap-around; prev/next buttons and ArrowLeft/ArrowRight only act when a group of 2+ exists; the Tab trap cycles across whichever of close/prev/next are visible; `restorePage` clears the group. Standalone images behave exactly as before (nav and counter stay hidden).

- [ ] **Step 4: Verify in the dev server**

On `/posts/animal-crossing-is-a-good-game/` (desktop viewport):

- Click the first grid tile: lightbox opens the full uncropped image, counter shows `1 / 6`, both arrows visible.
- Click next twice: counter `3 / 6`, image changes.
- Press ArrowLeft twice: back to `1 / 6`. ArrowLeft again wraps to `6 / 6`.
- Press Tab repeatedly: focus cycles close, prev, next, close.
- Press Escape: dialog closes, focus returns to the tile.
- Open a standalone prose image on another post (for example the single images in `/posts/remarkable-2-review/` between galleries): no arrows, no counter.

- [ ] **Step 5: Run checks**

Run: `npm run check` and `npm run lint` and `npm run lint:css`
Expected: all clean

- [ ] **Step 6: Commit**

```bash
git branch --show-current
git commit -m "Add prev/next navigation to the lightbox for galleries

Opening an image inside ul.image-gallery records the group: chevron
buttons, ArrowLeft/ArrowRight with wrap-around, a position counter
under the caption, and a focus trap across the visible controls.
Standalone images keep the old single-image behavior.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- src/components/ImageLightbox.astro src/styles/components/image-lightbox.css src/scripts/image-lightbox.ts
```

---

### Task 4: Documentation

**Files:**
- Modify: `CLAUDE.md` (commands table)
- Modify: `docs/images.md` (authoring flow)

- [ ] **Step 1: Add the test command to CLAUDE.md**

In the commands table, after the `test:images` row, add:

```markdown
| `npm run test:rehype` | Rehype plugin test suite (image gallery detection) |
```

- [ ] **Step 2: Document the authoring convention in docs/images.md**

Add a short subsection to the daily authoring flow:

```markdown
### Photo galleries

A markdown list where every item is a bare image renders as a 2-column
gallery with lightbox navigation (2+ images). Legacy runs of 3+ bare
image paragraphs are auto-converted at build time. To keep images
full-width instead, add any text to a list item or between paragraphs.
Linked images never become gallery tiles. Detection lives in
`scripts/rehype/image-gallery.mjs`.
```

- [ ] **Step 3: Commit**

```bash
git branch --show-current
git commit -m "Document the photo gallery convention and test command

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- CLAUDE.md docs/images.md
```

---

### Task 5: Full verification (no push)

- [ ] **Step 1: Full test and check suite**

Run: `npm run test:rehype && npm run check && npm run lint && npm run lint:css`
Expected: all pass

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: builds clean (includes Pagefind). Spot-check `dist/posts/animal-crossing-is-a-good-game/index.html` contains `image-gallery` and `dist/posts/mit-coasters/index.html` does not.

- [ ] **Step 3: Manual pass per the spec's testing section**

Dev server or `npm run preview`: animal-crossing (en and zh via the language toggle), bmw-x3-30i, bmw-330i, remarkable-2-review at desktop and 375px, light and dark; aiyou-user-growth and mit-coasters unchanged; lightbox behaviors from Task 3 Step 4.

- [ ] **Step 4: Stop**

Do NOT push and do NOT run release-check yet. Report results to Anping; pushing to `main` needs the double confirmation containing the word "push" (blog push protocol), and release-check runs then.
