import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  deriveKey,
  keyFromUploadPath,
  publicUrl,
  snippetFor,
  rewriteUploads,
} from './references.mjs'

const BASE = 'https://cdn.anping.us'
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
  assert.equal(publicUrl('2020/02/foo.webp', BASE + '/'), 'https://cdn.anping.us/2020/02/foo.webp')
  assert.equal(snippetFor('2020/02/foo.webp', BASE, 'cap'), '![cap](https://cdn.anping.us/2020/02/foo.webp)')
})

test('rewriteUploads rewrites only /uploads refs, leaves others', () => {
  const md = 'a ![x](/uploads/2020/02/foo.jpg) b ![](/uploads/2023/03/BMW-X3-2.jpeg) c [link](/about) ../../assets/hero/2020/02/x.jpg'
  const out = rewriteUploads(md, BASE)
  assert.match(out, /!\[x\]\(https:\/\/cdn\.anping\.us\/2020\/02\/foo\.webp\)/)
  assert.match(out, /https:\/\/cdn\.anping\.us\/2023\/03\/BMW-X3-2\.webp/)
  assert.match(out, /\[link\]\(\/about\)/)          // untouched
  assert.match(out, /\.\.\/\.\.\/assets\/hero\/2020\/02\/x\.jpg/) // hero untouched
})
