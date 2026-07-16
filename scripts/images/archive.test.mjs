import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs'
import { archiveOriginal } from './archive.mjs'

test('falls back to local dir when NAS path is null', () => {
  const work = mkdtempSync(join(tmpdir(), 'arch-'))
  try {
    const src = join(work, 'photo.jpg')
    writeFileSync(src, 'bytes')
    const res = archiveOriginal(src, { nasArchivePath: null }, { localFallbackDir: join(work, 'originals') })
    assert.equal(res.location, 'local')
    assert.ok(existsSync(res.dest))
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
})

test('re-archiving identical content is a no-op; different content refuses', () => {
  const work = mkdtempSync(join(tmpdir(), 'arch-'))
  try {
    const src = join(work, 'IMG_1234.jpg')
    writeFileSync(src, 'trip one')
    const dir = join(work, 'originals')
    const first = archiveOriginal(src, { nasArchivePath: null }, { localFallbackDir: dir })
    const again = archiveOriginal(src, { nasArchivePath: null }, { localFallbackDir: dir })
    assert.equal(again.skipped, true)
    // A different photo under a recycled camera name must not replace the
    // only archived copy of the first one.
    writeFileSync(src, 'trip two, same counter')
    assert.throws(
      () => archiveOriginal(src, { nasArchivePath: null }, { localFallbackDir: dir }),
      /refusing to overwrite/,
    )
    assert.equal(readFileSync(first.dest, 'utf8'), 'trip one')
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
})

test('uses NAS path when it exists', () => {
  const work = mkdtempSync(join(tmpdir(), 'arch-'))
  try {
    const src = join(work, 'photo.jpg')
    writeFileSync(src, 'bytes')
    const nas = join(work, 'nas')
    mkdirSync(nas)
    const res = archiveOriginal(src, { nasArchivePath: nas }, { localFallbackDir: join(work, 'originals') })
    assert.equal(res.location, 'nas')
    assert.equal(res.dest, join(nas, 'photo.jpg'))
    assert.ok(existsSync(res.dest))
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
})
