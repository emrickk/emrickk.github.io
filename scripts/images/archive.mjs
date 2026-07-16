import { mkdirSync, copyFileSync, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

// The archive is the only full-resolution copy once staging is cleaned, so an
// existing file is never overwritten: identical content is a no-op re-run,
// different content under the same name (recycled camera counters like
// IMG_1234.jpg) is an error the operator resolves by renaming.
function copyInto(dir, inputPath, name, location) {
  const dest = path.join(dir, name)
  if (existsSync(dest)) {
    if (readFileSync(dest).equals(readFileSync(inputPath))) return { dest, location, skipped: true }
    throw new Error(
      `refusing to overwrite archived original ${dest} with different content; rename ${name} and re-run`,
    )
  }
  mkdirSync(path.dirname(dest), { recursive: true })
  copyFileSync(inputPath, dest)
  return { dest, location }
}

export function archiveOriginal(inputPath, config, { localFallbackDir = 'originals' } = {}) {
  const name = path.basename(inputPath)
  const nas = config.nasArchivePath
  if (nas && existsSync(nas)) return copyInto(nas, inputPath, name, 'nas')
  return copyInto(localFallbackDir, inputPath, name, 'local')
}
