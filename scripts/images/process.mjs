import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { loadEnvFile, loadConfig } from './config.mjs'
import { optimizeToWebp } from './optimize.mjs'
import { archiveOriginal } from './archive.mjs'
import { makeClient, putObject } from './r2.mjs'
import { loadManifest, saveManifest, hasHash, addEntry, hashBuffer } from './manifest.mjs'
import { deriveKey, snippetFor } from './references.mjs'

const DEFAULT_STAGING = 'image-staging'
const DEFAULT_MANIFEST = 'scripts/images/.manifest.json'
const IMG_RE = /\.(jpe?g|png)$/i
const DEFAULT_BASE = 'https://cdn.anping.us'

function listStaged(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .map((f) => path.join(dir, f))
    .filter((p) => statSync(p).isFile() && IMG_RE.test(p))
    .sort()
}

export async function run({
  stagingDir = DEFAULT_STAGING,
  manifestPath = DEFAULT_MANIFEST,
  dryRun = false,
  config = null,
  now = new Date(),
  log = console.log,
} = {}) {
  const files = listStaged(stagingDir)
  const base = config?.publicBase ?? DEFAULT_BASE
  const client = config && !dryRun ? makeClient(config) : null
  const manifest = loadManifest(manifestPath)
  const snippets = []

  for (const file of files) {
    const original = readFileSync(file)
    const hash = hashBuffer(original)
    if (hasHash(manifest, hash)) {
      const key = manifest[hash].key
      log(`↻ skip (already uploaded): ${path.basename(file)} -> ${key}`)
      snippets.push(snippetFor(key, base))
      continue
    }
    const key = deriveKey(path.basename(file), now)
    if (!dryRun && config) {
      const arch = archiveOriginal(file, config)
      log(`  archived original -> ${arch.dest} (${arch.location})`)
    }
    const { buffer, width, bytes } = await optimizeToWebp(file)
    if (dryRun || !config) {
      log(`  [dry-run] ${key} (${width}px, ${(bytes / 1024).toFixed(0)} KB)`)
    } else {
      await putObject(client, config.bucket, key, buffer, 'image/webp')
      addEntry(manifest, hash, key, now.toISOString())
      log(`  ✓ uploaded ${key} (${width}px, ${(bytes / 1024).toFixed(0)} KB)`)
    }
    snippets.push(snippetFor(key, base))
  }

  if (!dryRun && config) saveManifest(manifestPath, manifest)
  return { snippets, count: files.length }
}

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const dryRun = process.argv.includes('--dry-run')
  loadEnvFile()
  const config = dryRun ? null : loadConfig()
  run({ dryRun, config })
    .then(({ snippets, count }) => {
      if (count === 0) {
        console.log(`No images in ${DEFAULT_STAGING}/. Drop .jpg/.jpeg/.png there and re-run.`)
        return
      }
      console.log('\nPaste into your post:\n')
      console.log(snippets.join('\n'))
    })
    .catch((err) => {
      console.error(err.message)
      process.exit(1)
    })
}
