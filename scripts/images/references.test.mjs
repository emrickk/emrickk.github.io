import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  deriveKey,
  keyFromUploadPath,
  publicUrl,
  snippetFor,
  rewriteUploads,
} from './references.mjs'

const BASE = 'https://cdn.theneverless.com'
const JULY = new Date('2026-07-12T12:00:00Z')

test('deriveKey builds YYYY/MM/<sanitized>.webp for new uploads', () => {
  assert.equal(deriveKey('IMG 1.JPG', JULY), '2026/07/IMG-1.webp')
  assert.equal(deriveKey('café.png', JULY), '2026/07/caf.webp')
})

test('keyFromUploadPath preserves path, swaps only the extension', () => {
  assert.equal(keyFromUploadPath('2020/02/foo.jpg'), '2020/02/foo.webp')
  assert.equal(keyFromUploadPath('2020/02/bar.PNG'), '2020/02/bar.webp')
  assert.equal(keyFromUploadPath('2023/03/BMW-X3-2.jpeg'), '2023/03/BMW-X3-2.webp')
})

test('publicUrl + snippetFor compose a clean URL', () => {
  assert.equal(publicUrl('2020/02/foo.webp', BASE + '/'), 'https://cdn.theneverless.com/2020/02/foo.webp')
  assert.equal(snippetFor('2020/02/foo.webp', BASE, 'cap'), '![cap](https://cdn.theneverless.com/2020/02/foo.webp)')
})

test('rewriteUploads rewrites only /uploads refs, leaves others', () => {
  const md = 'a ![x](/uploads/2020/02/foo.jpg) b ![](/uploads/2023/03/BMW-X3-2.jpeg) c [link](/about) ../../assets/hero/2020/02/x.jpg'
  const out = rewriteUploads(md, BASE)
  assert.match(out, /!\[x\]\(https:\/\/cdn\.theneverless\.com\/2020\/02\/foo\.webp\)/)
  assert.match(out, /https:\/\/cdn\.theneverless\.com\/2023\/03\/BMW-X3-2\.webp/)
  assert.match(out, /\[link\]\(\/about\)/)          // untouched
  assert.match(out, /\.\.\/\.\.\/assets\/hero\/2020\/02\/x\.jpg/) // hero untouched
})

test('deriveKey: lossy sanitize gets the content hash, lossless names stay clean', () => {
  const h1 = '0123456789abcdef'
  const h2 = 'fedcba9876543210'
  // ASCII names never pick up a hash suffix, even when one is available.
  assert.equal(deriveKey('IMG 1.JPG', JULY, null, h1), '2026/07/IMG-1.webp')
  // Distinct CJK names used to sanitize to the same degenerate key.
  assert.equal(deriveKey('北京 01.jpg', JULY, null, h1), '2026/07/01-01234567.webp')
  assert.notEqual(deriveKey('北京 01.jpg', JULY, null, h1), deriveKey('上海 01.jpg', JULY, null, h2))
  // A fully-stripped name is carried by the hash alone; without one, 'img'.
  assert.equal(deriveKey('照片.jpg', JULY, null, h1), '2026/07/01234567.webp')
  assert.equal(deriveKey('照片.jpg', JULY), '2026/07/img.webp')
})

test('deriveKey with a prefix replaces the date path', () => {
  assert.equal(deriveKey('123-1.jpg', JULY, 'notes'), 'notes/123-1.webp')
  assert.equal(deriveKey('123-2.PNG', JULY, 'notes/'), 'notes/123-2.webp')
  assert.equal(deriveKey('IMG 1.JPG', JULY, null), '2026/07/IMG-1.webp')
})
