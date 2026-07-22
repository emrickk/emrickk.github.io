import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import sharp from 'sharp'
import { dropImages } from './drop.mjs'

test('dropImages() dry-run stages a copy and yields a cdn snippet', async () => {
  const work = mkdtempSync(join(tmpdir(), 'drop-'))
  try {
    const png = await sharp({
      create: { width: 640, height: 480, channels: 3, background: { r: 4, g: 5, b: 6 } },
    }).png().toBuffer()
    const source = join(work, 'Dropped Photo.png')
    writeFileSync(source, png)

    const snippets = await dropImages([source], {
      dryRun: true,
      manifestPath: join(work, '.manifest.json'),
      log: () => {},
      now: new Date('2026-07-21T00:00:00Z'),
    })
    assert.equal(snippets.length, 1)
    assert.equal(snippets[0], '![](https://cdn.theneverless.com/2026/07/Dropped-Photo.webp)')
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
})

test('dropImages() rejects unsupported extensions by name', async () => {
  await assert.rejects(
    dropImages(['/tmp/whatever.webp'], { dryRun: true, log: () => {} }),
    /jpg.*png only, got: whatever\.webp/,
  )
})

test('dropImages() rejects an empty file list', async () => {
  await assert.rejects(dropImages([], { dryRun: true, log: () => {} }), /No image files/)
})
