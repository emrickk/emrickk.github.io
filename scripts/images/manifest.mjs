import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'

export function hashBuffer(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

export function loadManifest(path) {
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return {}
  }
}

export function hasHash(manifest, hash) {
  return Object.prototype.hasOwnProperty.call(manifest, hash)
}

export function addEntry(manifest, hash, key, uploadedAt) {
  manifest[hash] = { key, uploadedAt }
  return manifest
}

export function saveManifest(path, manifest) {
  writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n')
}
