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
const img = (src = 'https://cdn.theneverless.com/x.webp') => el('img', { src, alt: '' });
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

test('rule A: a tagged gallery list keeps role="list" for VoiceOver', () => {
  const list = ul(li(img()), li(img()));
  run(root(list));
  assert.equal(list.properties.role, 'list');
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

test('rule B: a built gallery list has role="list" for VoiceOver', () => {
  const tree = root(p(img('a')), text('\n'), p(img('b')), text('\n'), p(img('c')));
  run(tree);
  const gallery = tree.children.find((c) => c.type === 'element');
  assert.equal(gallery.properties.role, 'list');
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
