import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { optimizeToWebp } from './optimize.mjs'

function isWebp(buf) {
  return buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
}

test('optimizeToWebp caps width at 2000 and outputs webp', async () => {
  const big = await sharp({
    create: { width: 4000, height: 3000, channels: 3, background: { r: 120, g: 80, b: 200 } },
  }).png().toBuffer()
  const out = await optimizeToWebp(big)
  assert.equal(out.width, 2000)
  assert.ok(isWebp(out.buffer), 'output should be WebP')
  assert.ok(out.bytes < big.length, 'output should be smaller than a 4000px PNG')
})

test('optimizeToWebp does not enlarge small images', async () => {
  const small = await sharp({
    create: { width: 300, height: 200, channels: 3, background: { r: 10, g: 10, b: 10 } },
  }).png().toBuffer()
  const out = await optimizeToWebp(small)
  assert.equal(out.width, 300)
})

test('optimizeToWebp embeds copyright EXIF', async () => {
  const img = await sharp({
    create: { width: 400, height: 300, channels: 3, background: { r: 60, g: 60, b: 60 } },
  }).png().toBuffer()
  const out = await optimizeToWebp(img)
  const meta = await sharp(out.buffer).metadata()
  assert.ok(meta.exif, 'webp should carry an EXIF chunk')
  assert.ok(meta.exif.toString('binary').includes('Emrick'), 'EXIF should name the author')
})

test('optimizeToWebp watermark marks the bottom-right corner', async () => {
  const img = await sharp({
    create: { width: 1200, height: 900, channels: 3, background: { r: 20, g: 20, b: 20 } },
  }).png().toBuffer()
  const plain = await optimizeToWebp(img)
  const marked = await optimizeToWebp(img, { watermark: true })
  assert.equal(marked.width, plain.width, 'watermark must not change dimensions')
  const corner = { left: 700, top: 800, width: 480, height: 80 }
  const [a, b] = await Promise.all([
    sharp(plain.buffer).extract(corner).raw().toBuffer(),
    sharp(marked.buffer).extract(corner).raw().toBuffer(),
  ])
  assert.notDeepEqual(a, b, 'bottom-right pixels should differ once marked')
})
