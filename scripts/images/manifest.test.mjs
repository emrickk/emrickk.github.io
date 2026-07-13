import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync } from 'node:fs'
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
