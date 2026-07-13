import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { keyFromUploadPath, rewriteUploads } from './references.mjs'
import { optimizeToWebp } from './optimize.mjs'
import { makeClient, putObject } from './r2.mjs'
import { loadEnvFile, loadConfig } from './config.mjs'

const IMG_RE = /\.(jpe?g|png)$/i
const MD_RE = /\.mdx?$/i
const UPLOADS_REF_RE = /\/uploads\/[^\s)"']+\.(?:jpe?g|png|gif|webp|svg)/gi

function walk(dir, keep) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(p, keep))
    else if (keep(p)) out.push(p)
  }
  return out
}

export function planMigration({ uploadsDir = 'public/uploads', contentDir = 'src/content', base = 'https://cdn.anping.us' } = {}) {
  const uploads = walk(uploadsDir, (p) => IMG_RE.test(p)).map((file) => ({
    file,
    key: keyFromUploadPath(path.relative(uploadsDir, file)),
  }))
  const edits = []
  for (const file of walk(contentDir, (p) => MD_RE.test(p))) {
    const before = readFileSync(file, 'utf8')
    const after = rewriteUploads(before, base)
    if (after !== before) {
      edits.push({ file, replacements: (before.match(UPLOADS_REF_RE) || []).length })
    }
  }
  return { uploads, edits, base }
}

export async function applyMigration({ uploadsDir = 'public/uploads', contentDir = 'src/content', config, log = console.log } = {}) {
  const base = config.publicBase
  const { uploads, edits } = planMigration({ uploadsDir, contentDir, base })
  const client = makeClient(config)
  for (const { file, key } of uploads) {
    const { buffer, bytes } = await optimizeToWebp(file)
    await putObject(client, config.bucket, key, buffer, 'image/webp')
    log(`✓ ${key} (${(bytes / 1024).toFixed(0)} KB)`)
  }
  for (const { file } of edits) {
    writeFileSync(file, rewriteUploads(readFileSync(file, 'utf8'), base))
    log(`✎ ${file}`)
  }
  return { uploaded: uploads.length, edited: edits.length }
}

// CLI entry (pathToFileURL handles spaces in the repo path)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const apply = process.argv.includes('--apply')
  if (!apply) {
    const { uploads, edits } = planMigration()
    console.log(`DRY RUN: no changes made.\n`)
    console.log(`Would upload ${uploads.length} images to R2.`)
    console.log(`Would edit ${edits.length} markdown files:`)
    for (const e of edits) console.log(`  ${e.file} (${e.replacements} refs)`)
    console.log(`\nRe-run with --apply to perform the migration.`)
  } else {
    loadEnvFile()
    const config = loadConfig()
    applyMigration({ config })
      .then(({ uploaded, edited }) => console.log(`\nDone: uploaded ${uploaded}, edited ${edited} files.`))
      .catch((err) => { console.error(err.message); process.exit(1) })
  }
}
