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
