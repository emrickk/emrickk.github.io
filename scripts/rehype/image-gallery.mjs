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
