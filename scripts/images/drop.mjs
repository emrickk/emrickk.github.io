// Editor drop hook: push one or more images through the R2 pipeline and
// print the markdown snippet(s) on stdout, one per line. Everything else
// (progress, dedupe notes, archive destinations) goes to stderr, so a
// caller like Astro Editor's imageDropCommand can insert stdout verbatim.
//
// Uses a private temp staging dir per invocation: image-staging/ is shared
// across concurrent sessions and must not see these files. Dedupe still
// works because the shared manifest records content hashes.
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { loadEnvFile, loadConfig } from './config.mjs'
import { run } from './process.mjs'

const SUPPORTED_RE = /\.(jpe?g|png)$/i

export async function dropImages(
  files,
  {
    dryRun = false,
    manifestPath = undefined,
    log = (...args) => console.error(...args),
    now = new Date(),
  } = {},
) {
  if (files.length === 0) {
    throw new Error('No image files given')
  }
  const unsupported = files.filter((f) => !SUPPORTED_RE.test(f))
  if (unsupported.length > 0) {
    throw new Error(
      `Pipeline handles .jpg/.jpeg/.png only, got: ${unsupported
        .map((f) => path.basename(f))
        .join(', ')}`,
    )
  }

  const staging = mkdtempSync(path.join(tmpdir(), 'wlog-drop-'))
  try {
    for (const file of files) {
      copyFileSync(file, path.join(staging, path.basename(file)))
    }
    loadEnvFile()
    const config = dryRun ? null : loadConfig()
    const options = { stagingDir: staging, dryRun, config, log, now }
    if (manifestPath) options.manifestPath = manifestPath
    const { snippets } = await run(options)
    return snippets
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
}

// CLI entry (pathToFileURL handles spaces in the repo path)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dryRun = process.argv.includes('--dry-run')
  const files = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  if (files.length === 0) {
    console.error('Usage: node scripts/images/drop.mjs [--dry-run] <image> [image...]')
    process.exit(2)
  }
  dropImages(files, { dryRun })
    .then((snippets) => {
      console.log(snippets.join('\n'))
    })
    .catch((err) => {
      console.error(err.message)
      process.exit(1)
    })
}
