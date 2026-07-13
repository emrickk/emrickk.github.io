import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
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
