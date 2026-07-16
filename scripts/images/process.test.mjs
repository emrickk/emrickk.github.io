import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import sharp from 'sharp'
import { run } from './process.mjs'

test('run() dry-run yields cdn webp snippets without creds', async () => {
  const work = mkdtempSync(join(tmpdir(), 'proc-'))
  try {
    const staging = join(work, 'image-staging')
    const png = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 1, g: 2, b: 3 } },
    }).png().toBuffer()
    // mkdir + write fixture
    const { mkdirSync } = await import('node:fs')
    mkdirSync(staging, { recursive: true })
    writeFileSync(join(staging, 'My Photo.png'), png)

    const res = await run({
      stagingDir: staging,
      manifestPath: join(work, '.manifest.json'),
      dryRun: true,
      now: new Date('2026-07-12T00:00:00Z'),
      log: () => {},
    })
    assert.equal(res.count, 1)
    assert.equal(res.snippets[0], '![](https://cdn.theneverless.com/2026/07/My-Photo.webp)')
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
})

test('run() with a prefix and custom staging dir yields notes/ snippets', async () => {
  const work = mkdtempSync(join(tmpdir(), 'proc-notes-'))
  try {
    const staging = join(work, 'staged-notes')
    const jpg = await sharp({
      create: { width: 320, height: 240, channels: 3, background: { r: 9, g: 9, b: 9 } },
    }).jpeg().toBuffer()
    const { mkdirSync } = await import('node:fs')
    mkdirSync(staging, { recursive: true })
    writeFileSync(join(staging, '9006-1.jpg'), jpg)

    const res = await run({
      stagingDir: staging,
      manifestPath: join(work, '.manifest.json'),
      dryRun: true,
      prefix: 'notes',
      now: new Date('2026-07-15T00:00:00Z'),
      log: () => {},
    })
    assert.equal(res.count, 1)
    assert.equal(res.snippets[0], '![](https://cdn.theneverless.com/notes/9006-1.webp)')
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
})
