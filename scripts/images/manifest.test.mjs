import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync, writeFileSync } from 'node:fs'
import { loadManifest, hasHash, addEntry, saveManifest, hashBuffer } from './manifest.mjs'

test('manifest round-trips and dedupes by content hash', () => {
  const p = join(tmpdir(), `manifest-${process.pid}.json`)
  try {
    assert.deepEqual(loadManifest(p), {})
    const h = hashBuffer(Buffer.from('hello world'))
    const m = addEntry({}, h, '2026/07/x.webp', '2026-07-12T00:00:00.000Z')
    saveManifest(p, m)
    const reloaded = loadManifest(p)
    assert.ok(hasHash(reloaded, h))
    assert.equal(reloaded[h].key, '2026/07/x.webp')
    assert.equal(hasHash(reloaded, hashBuffer(Buffer.from('different'))), false)
  } finally {
    rmSync(p, { force: true })
  }
})

test('loadManifest throws on a corrupt manifest instead of resetting dedupe state', () => {
  const p = join(tmpdir(), `manifest-corrupt-${process.pid}.json`)
  try {
    writeFileSync(p, '{not json')
    assert.throws(() => loadManifest(p), /cannot be parsed/)
  } finally {
    rmSync(p, { force: true })
  }
})

test('saveManifest merges entries written by a concurrent run', () => {
  const p = join(tmpdir(), `manifest-merge-${process.pid}.json`)
  try {
    // Run A saves its entry, then run B (which loaded before A saved) saves
    // only its own; A's entry must survive B's save.
    saveManifest(p, { aaaa: { key: '2026/07/a.webp', uploadedAt: 't1' } })
    saveManifest(p, { bbbb: { key: '2026/07/b.webp', uploadedAt: 't2' } })
    const m = loadManifest(p)
    assert.ok(hasHash(m, 'aaaa'))
    assert.ok(hasHash(m, 'bbbb'))
  } finally {
    rmSync(p, { force: true })
  }
})
