import { mkdirSync, copyFileSync, existsSync } from 'node:fs'
import path from 'node:path'

export function archiveOriginal(inputPath, config, { localFallbackDir = 'originals' } = {}) {
  const name = path.basename(inputPath)
  const nas = config.nasArchivePath
  if (nas && existsSync(nas)) {
    const dest = path.join(nas, name)
    mkdirSync(path.dirname(dest), { recursive: true })
    copyFileSync(inputPath, dest)
    return { dest, location: 'nas' }
  }
  mkdirSync(localFallbackDir, { recursive: true })
  const dest = path.join(localFallbackDir, name)
  copyFileSync(inputPath, dest)
  return { dest, location: 'local' }
}
