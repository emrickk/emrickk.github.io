# Blog Image Storage (Cloudflare R2 + NAS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move blog images out of the git repo — serve optimized WebP derivatives from Cloudflare R2 at `cdn.anping.us`, archive full-res originals to the NAS, driven by a one-command Node pipeline.

**Architecture:** A small set of focused Node ESM modules under `scripts/images/`: pure helpers (config, key/URL derivation, dedupe manifest) plus thin I/O wrappers (sharp optimize, R2 upload, NAS archive), composed by two CLIs — `process.mjs` (daily authoring) and `migrate.mjs` (one-time backfill of the existing 186 `public/uploads` images). Posts reference `https://cdn.anping.us/…` URLs via plain markdown.

**Tech Stack:** Node 22 ESM, `sharp` (already present), `@aws-sdk/client-s3` (R2 is S3-compatible), `node:test` for tests.

## Global Constraints

- **Node 22.12.0** (`.nvmrc`); all new scripts are ESM `.mjs`.
- **Only one new dependency:** `@aws-sdk/client-s3`. Reuse existing `sharp`. Do NOT add `dotenv` — load env via `process.loadEnvFile('.env.local')`.
- **Optimization:** WebP **quality 80**, **max width 2000px**, `withoutEnlargement: true`, auto-orient (`.rotate()`) then strip EXIF (sharp default).
- **R2:** public base `https://cdn.anping.us`, bucket `anping-blog-images`, upload header `Cache-Control: public, max-age=31536000, immutable`, content type `image/webp`.
- **Secrets** live only in `.env.local` (already git-ignored via `.env.*`); document them in `.env.example`.
- **Migration scope:** `public/uploads/**` only (jpg/jpeg/png). Hero images in `src/assets/hero/**` are OUT of scope — they stay put and remain Astro-optimized.
- **Working-tree hygiene:** the repo is on branch `bilingual-toggle` with many unrelated uncommitted post edits. **Every `git add` in this plan uses explicit file paths** — never `git add -A`/`.` — so no unrelated file is ever staged.
- **Tests:** `node:test` + `node:assert/strict`, run via `npm run test:images` (`node --test scripts/images/`).

---

## File Structure

```
scripts/images/
  config.mjs         # loadEnvFile(), loadConfig(env) -> validated config object
  references.mjs     # pure: deriveKey, keyFromUploadPath, publicUrl, snippetFor, rewriteUploads
  optimize.mjs       # optimizeToWebp(input, opts) -> { buffer, width, height, bytes }
  manifest.mjs       # hashBuffer, loadManifest, hasHash, addEntry, saveManifest
  r2.mjs             # makeClient(config), objectExists, putObject
  archive.mjs        # archiveOriginal(inputPath, config, opts) -> { dest, location }
  process.mjs        # daily CLI: exports run(opts); staging -> archive/optimize/upload/print
  migrate.mjs        # one-time CLI: exports planMigration/applyMigration; dry-run default
  config.test.mjs
  references.test.mjs
  optimize.test.mjs
  manifest.test.mjs
  archive.test.mjs
  process.test.mjs
  migrate.test.mjs
docs/images.md       # runbook + user setup guide (Cloudflare, DNS, R2)
```

Tasks 1–6 and 8–10 are fully buildable/testable **offline**. Tasks 7 (live upload path) and 11 (live migration apply) require the user's Cloudflare R2 setup to be complete; each is marked accordingly.

---

## Task 1: Scaffolding, config loader, env + ignore + scripts

**Files:**
- Modify: `package.json` (add dependency + npm scripts)
- Modify: `.gitignore` (ignore staging/originals/manifest)
- Modify: `.env.example` (document R2 vars)
- Create: `scripts/images/config.mjs`
- Test: `scripts/images/config.test.mjs`

**Interfaces:**
- Produces: `loadEnvFile(path='.env.local'): void` and `loadConfig(env=process.env): { accountId, accessKeyId, secretAccessKey, bucket, publicBase, nasArchivePath }`. `publicBase` has any trailing slash stripped; `nasArchivePath` is `null` when unset.

- [ ] **Step 1: Install the R2 client dependency**

Run:
```bash
npm install @aws-sdk/client-s3
```
Expected: `package.json` gains `"@aws-sdk/client-s3"` under dependencies; no error.

- [ ] **Step 2: Write the failing test**

Create `scripts/images/config.test.mjs`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadConfig } from './config.mjs'

const good = {
  R2_ACCOUNT_ID: 'acct',
  R2_ACCESS_KEY_ID: 'key',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET: 'anping-blog-images',
  R2_PUBLIC_BASE: 'https://cdn.anping.us/',
}

test('loadConfig normalizes and returns config', () => {
  const c = loadConfig(good)
  assert.equal(c.publicBase, 'https://cdn.anping.us') // trailing slash stripped
  assert.equal(c.bucket, 'anping-blog-images')
  assert.equal(c.accountId, 'acct')
  assert.equal(c.nasArchivePath, null) // NAS_ARCHIVE_PATH unset
})

test('loadConfig throws listing every missing var', () => {
  const bad = { ...good }
  delete bad.R2_BUCKET
  delete bad.R2_SECRET_ACCESS_KEY
  assert.throws(() => loadConfig(bad), /R2_BUCKET/)
  assert.throws(() => loadConfig(bad), /R2_SECRET_ACCESS_KEY/)
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test scripts/images/config.test.mjs`
Expected: FAIL — cannot find module `./config.mjs`.

- [ ] **Step 4: Implement `config.mjs`**

Create `scripts/images/config.mjs`:
```js
import process from 'node:process'

const REQUIRED = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_PUBLIC_BASE',
]

// Load .env.local if present. Absent file is fine (rely on ambient env).
export function loadEnvFile(path = '.env.local') {
  try {
    process.loadEnvFile(path)
  } catch {
    // no local env file — that's OK for dry-runs and CI
  }
}

export function loadConfig(env = process.env) {
  const missing = REQUIRED.filter((k) => !env[k] || String(env[k]).trim() === '')
  if (missing.length > 0) {
    throw new Error(
      `Missing required env vars: ${missing.join(', ')}. ` +
        `Copy .env.example to .env.local and fill them in.`,
    )
  }
  return {
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET,
    publicBase: env.R2_PUBLIC_BASE.replace(/\/+$/, ''),
    nasArchivePath: env.NAS_ARCHIVE_PATH?.trim() || null,
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test scripts/images/config.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 6: Add npm scripts**

In `package.json` `"scripts"`, add:
```json
"images": "node scripts/images/process.mjs",
"images:migrate": "node scripts/images/migrate.mjs",
"test:images": "node --test scripts/images/"
```

- [ ] **Step 7: Extend `.gitignore`**

Append to `.gitignore`:
```
# blog image pipeline
image-staging/
originals/
scripts/images/.manifest.json
```

- [ ] **Step 8: Document env vars in `.env.example`**

Append to `.env.example`:
```
# Cloudflare R2 image storage (values from the R2 dashboard; real secrets go in .env.local)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=anping-blog-images
R2_PUBLIC_BASE=https://cdn.anping.us
# Optional: SMB-mounted NAS folder for full-res originals (falls back to local originals/ if unset)
NAS_ARCHIVE_PATH=
```

- [ ] **Step 9: Commit**

```bash
git add scripts/images/config.mjs scripts/images/config.test.mjs package.json package-lock.json .gitignore .env.example
git commit -m "feat(images): config loader, R2 dep, env + ignore scaffolding"
```

---

## Task 2: Reference helpers (key derivation + markdown rewrite)

**Files:**
- Create: `scripts/images/references.mjs`
- Test: `scripts/images/references.test.mjs`

**Interfaces:**
- Produces:
  - `deriveKey(originalName: string, date: Date): string` — sanitizes the basename; `IMG 1.JPG` + 2026-07 → `2026/07/IMG-1.webp`. Used for NEW uploads.
  - `keyFromUploadPath(relPath: string): string` — preserves the path exactly, only swapping a jpg/jpeg/png extension for `.webp`; `2020/02/foo.JPG` → `2020/02/foo.webp`. Used for migration (must map existing refs 1:1).
  - `publicUrl(key: string, base: string): string`
  - `snippetFor(key: string, base: string, alt=''): string` → `![alt](<url>)`
  - `rewriteUploads(markdown: string, base: string): string` — rewrites `/uploads/<path>.<ext>` → `<base>/<key>`.

- [ ] **Step 1: Write the failing test**

Create `scripts/images/references.test.mjs`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  deriveKey,
  keyFromUploadPath,
  publicUrl,
  snippetFor,
  rewriteUploads,
} from './references.mjs'

const BASE = 'https://cdn.anping.us'
const JULY = new Date('2026-07-12T12:00:00Z')

test('deriveKey builds YYYY/MM/<sanitized>.webp for new uploads', () => {
  assert.equal(deriveKey('IMG 1.JPG', JULY), '2026/07/IMG-1.webp')
  assert.equal(deriveKey('café.png', JULY), '2026/07/caf.webp')
})

test('keyFromUploadPath preserves path, swaps only the extension', () => {
  assert.equal(keyFromUploadPath('2020/02/foo.jpg'), '2020/02/foo.webp')
  assert.equal(keyFromUploadPath('2020/02/bar.PNG'), '2020/02/bar.webp')
  assert.equal(keyFromUploadPath('2023/03/BMW-X3-2.jpeg'), '2023/03/BMW-X3-2.webp')
})

test('publicUrl + snippetFor compose a clean URL', () => {
  assert.equal(publicUrl('2020/02/foo.webp', BASE + '/'), 'https://cdn.anping.us/2020/02/foo.webp')
  assert.equal(snippetFor('2020/02/foo.webp', BASE, 'cap'), '![cap](https://cdn.anping.us/2020/02/foo.webp)')
})

test('rewriteUploads rewrites only /uploads refs, leaves others', () => {
  const md = 'a ![x](/uploads/2020/02/foo.jpg) b ![](/uploads/2023/03/BMW-X3-2.jpeg) c [link](/about) ../../assets/hero/2020/02/x.jpg'
  const out = rewriteUploads(md, BASE)
  assert.match(out, /!\[x\]\(https:\/\/cdn\.anping\.us\/2020\/02\/foo\.webp\)/)
  assert.match(out, /https:\/\/cdn\.anping\.us\/2023\/03\/BMW-X3-2\.webp/)
  assert.match(out, /\[link\]\(\/about\)/)          // untouched
  assert.match(out, /\.\.\/\.\.\/assets\/hero\/2020\/02\/x\.jpg/) // hero untouched
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/images/references.test.mjs`
Expected: FAIL — cannot find module `./references.mjs`.

- [ ] **Step 3: Implement `references.mjs`**

Create `scripts/images/references.mjs`:
```js
import path from 'node:path'

const CONVERT_EXT = new Set(['.jpg', '.jpeg', '.png'])

function sanitize(name) {
  return name.normalize('NFC').replace(/\s+/g, '-').replace(/[^\w.\-]/g, '')
}

function outExtFor(ext) {
  return CONVERT_EXT.has(ext.toLowerCase()) ? '.webp' : ext.toLowerCase()
}

// For NEW uploads: sanitized basename under the current year/month.
export function deriveKey(originalName, date) {
  const ext = path.extname(originalName)
  const base = sanitize(path.basename(originalName, ext))
  const yyyy = String(date.getUTCFullYear())
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${yyyy}/${mm}/${base}${outExtFor(ext)}`
}

// For migration: keep the exact path, swap only the extension.
export function keyFromUploadPath(relPath) {
  const ext = path.extname(relPath)
  return relPath.slice(0, relPath.length - ext.length) + outExtFor(ext)
}

export function publicUrl(key, base) {
  return `${base.replace(/\/+$/, '')}/${key}`
}

export function snippetFor(key, base, alt = '') {
  return `![${alt}](${publicUrl(key, base)})`
}

export function rewriteUploads(markdown, base) {
  return markdown.replace(
    /\/uploads\/([^\s)"']+\.(?:jpe?g|png|gif|webp|svg))/gi,
    (_m, rel) => publicUrl(keyFromUploadPath(rel), base),
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/images/references.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/images/references.mjs scripts/images/references.test.mjs
git commit -m "feat(images): key derivation and markdown reference rewrite"
```

---

## Task 3: Image optimization (sharp → WebP)

**Files:**
- Create: `scripts/images/optimize.mjs`
- Test: `scripts/images/optimize.test.mjs`

**Interfaces:**
- Produces: `optimizeToWebp(input: string|Buffer, opts?: { maxWidth?: number, quality?: number }): Promise<{ buffer: Buffer, width: number, height: number, bytes: number }>`. Default maxWidth 2000, quality 80.

- [ ] **Step 1: Write the failing test**

Create `scripts/images/optimize.test.mjs`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import sharp from 'sharp'
import { optimizeToWebp } from './optimize.mjs'

function isWebp(buf) {
  return buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
}

test('optimizeToWebp caps width at 2000 and outputs webp', async () => {
  const big = await sharp({
    create: { width: 4000, height: 3000, channels: 3, background: { r: 120, g: 80, b: 200 } },
  }).png().toBuffer()
  const out = await optimizeToWebp(big)
  assert.equal(out.width, 2000)
  assert.ok(isWebp(out.buffer), 'output should be WebP')
  assert.ok(out.bytes < big.length, 'output should be smaller than a 4000px PNG')
})

test('optimizeToWebp does not enlarge small images', async () => {
  const small = await sharp({
    create: { width: 300, height: 200, channels: 3, background: { r: 10, g: 10, b: 10 } },
  }).png().toBuffer()
  const out = await optimizeToWebp(small)
  assert.equal(out.width, 300)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/images/optimize.test.mjs`
Expected: FAIL — cannot find module `./optimize.mjs`.

- [ ] **Step 3: Implement `optimize.mjs`**

Create `scripts/images/optimize.mjs`:
```js
import sharp from 'sharp'

const MAX_WIDTH = 2000
const WEBP_QUALITY = 80

export async function optimizeToWebp(input, { maxWidth = MAX_WIDTH, quality = WEBP_QUALITY } = {}) {
  const { data, info } = await sharp(input, { failOn: 'error' })
    .rotate() // apply EXIF orientation before metadata is stripped
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer({ resolveWithObject: true })
  return { buffer: data, width: info.width, height: info.height, bytes: data.length }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/images/optimize.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/images/optimize.mjs scripts/images/optimize.test.mjs
git commit -m "feat(images): sharp WebP optimization (<=2000px, q80)"
```

---

## Task 4: Dedupe manifest

**Files:**
- Create: `scripts/images/manifest.mjs`
- Test: `scripts/images/manifest.test.mjs`

**Interfaces:**
- Produces:
  - `hashBuffer(buf: Buffer): string` (sha256 hex)
  - `loadManifest(path: string): object` (empty `{}` if missing/corrupt)
  - `hasHash(manifest, hash): boolean`
  - `addEntry(manifest, hash, key, uploadedAt): object`
  - `saveManifest(path, manifest): void`

- [ ] **Step 1: Write the failing test**

Create `scripts/images/manifest.test.mjs`:
```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/images/manifest.test.mjs`
Expected: FAIL — cannot find module `./manifest.mjs`.

- [ ] **Step 3: Implement `manifest.mjs`**

Create `scripts/images/manifest.mjs`:
```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/images/manifest.test.mjs`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add scripts/images/manifest.mjs scripts/images/manifest.test.mjs
git commit -m "feat(images): content-hash dedupe manifest"
```

---

## Task 5: NAS archive with local fallback

**Files:**
- Create: `scripts/images/archive.mjs`
- Test: `scripts/images/archive.test.mjs`

**Interfaces:**
- Produces: `archiveOriginal(inputPath: string, config: { nasArchivePath: string|null }, opts?: { localFallbackDir?: string }): { dest: string, location: 'nas'|'local' }`. Copies to NAS when `nasArchivePath` is set AND exists; otherwise to `localFallbackDir` (default `originals`).

- [ ] **Step 1: Write the failing test**

Create `scripts/images/archive.test.mjs`:
```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/images/archive.test.mjs`
Expected: FAIL — cannot find module `./archive.mjs`.

- [ ] **Step 3: Implement `archive.mjs`**

Create `scripts/images/archive.mjs`:
```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/images/archive.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/images/archive.mjs scripts/images/archive.test.mjs
git commit -m "feat(images): NAS archive with local fallback"
```

---

## Task 6: R2 client wrapper

**Files:**
- Create: `scripts/images/r2.mjs`
- Test: `scripts/images/r2.test.mjs`

**Interfaces:**
- Consumes: `config` from Task 1.
- Produces:
  - `makeClient(config): S3Client`
  - `objectExists(client, bucket, key): Promise<boolean>`
  - `putObject(client, bucket, key, buffer, contentType): Promise<void>` (sets the immutable Cache-Control header)

The test is a **live smoke test** that self-skips when no R2 credentials are present, so it is green offline and exercises the real API once creds exist.

- [ ] **Step 1: Write the (self-skipping) test**

Create `scripts/images/r2.test.mjs`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadEnvFile, loadConfig } from './config.mjs'
import { makeClient, putObject, objectExists } from './r2.mjs'

loadEnvFile()
let config = null
try { config = loadConfig() } catch { /* no creds -> skip below */ }

test('put then head round-trips against R2 (live)', { skip: config ? false : 'no R2 creds in env' }, async () => {
  const client = makeClient(config)
  const key = `_smoketest/hello-${process.pid}.txt`
  await putObject(client, config.bucket, key, Buffer.from('hi'), 'text/plain')
  assert.equal(await objectExists(client, config.bucket, key), true)
  assert.equal(await objectExists(client, config.bucket, `_smoketest/missing-${process.pid}`), false)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/images/r2.test.mjs`
Expected: FAIL — cannot find module `./r2.mjs` (the test body itself would skip, but the import fails first).

- [ ] **Step 3: Implement `r2.mjs`**

Create `scripts/images/r2.mjs`:
```js
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

export function makeClient(config) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
}

export async function objectExists(client, bucket, key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
    return true
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound') return false
    throw err
  }
}

export async function putObject(client, bucket, key, buffer, contentType) {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )
}
```

- [ ] **Step 4: Run test to verify it passes (skips offline)**

Run: `node --test scripts/images/r2.test.mjs`
Expected: PASS with the test reported as skipped (`no R2 creds in env`) when offline; PASS executing the round-trip once creds are in `.env.local`.

- [ ] **Step 5: Commit**

```bash
git add scripts/images/r2.mjs scripts/images/r2.test.mjs
git commit -m "feat(images): R2 S3-compatible client wrapper"
```

---

## Task 7: Daily pipeline CLI (`process.mjs`)

**Files:**
- Create: `scripts/images/process.mjs`
- Test: `scripts/images/process.test.mjs`

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: `run(opts): Promise<{ snippets: string[], count: number }>` where `opts = { stagingDir='image-staging', manifestPath='scripts/images/.manifest.json', dryRun=false, config=null, now=new Date(), log=console.log }`. In `dryRun` mode it optimizes and returns snippets **without** archiving or uploading (offline-testable). The file also runs as a CLI when executed directly.

- [ ] **Step 1: Write the failing test (offline dry-run)**

Create `scripts/images/process.test.mjs`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import sharp from 'sharp'
import { run } from './process.mjs'

test('run() dry-run yields cdn webp snippets without creds', async () => {
  const work = mkdtempSync(join(tmpdir(), 'proc-'))
  try {
    const staging = join(work, 'image-staging')
    const png = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 1, g: 2, b: 3 } },
    }).png().toBuffer()
    // mkdir + write fixture
    const { mkdirSync } = await import('node:fs')
    mkdirSync(staging, { recursive: true })
    writeFileSync(join(staging, 'My Photo.png'), png)

    const res = await run({
      stagingDir: staging,
      manifestPath: join(work, '.manifest.json'),
      dryRun: true,
      now: new Date('2026-07-12T00:00:00Z'),
      log: () => {},
    })
    assert.equal(res.count, 1)
    assert.equal(res.snippets[0], '![](https://cdn.anping.us/2026/07/My-Photo.webp)')
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/images/process.test.mjs`
Expected: FAIL — cannot find module `./process.mjs`.

- [ ] **Step 3: Implement `process.mjs`**

Create `scripts/images/process.mjs`:
```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/images/process.test.mjs`
Expected: PASS (1 test).

- [ ] **Step 5: Full suite green**

Run: `npm run test:images`
Expected: all tests PASS (R2 live test skipped offline).

- [ ] **Step 6: Commit**

```bash
git add scripts/images/process.mjs scripts/images/process.test.mjs
git commit -m "feat(images): daily upload pipeline CLI (npm run images)"
```

---

## Task 8: Migration CLI (`migrate.mjs`) — dry-run plan

**Files:**
- Create: `scripts/images/migrate.mjs`
- Test: `scripts/images/migrate.test.mjs`

**Interfaces:**
- Consumes: `references.mjs`, `optimize.mjs`, `r2.mjs`.
- Produces:
  - `planMigration(opts): { uploads: {file,key}[], edits: {file,replacements}[], base }` — pure reads only (offline-testable).
  - `applyMigration(opts): Promise<{ uploaded, edited }>` — optimizes+uploads, then rewrites markdown (Task 11 runs this).
  - Runs as CLI: dry-run by default; `--apply` performs the migration.

- [ ] **Step 1: Write the failing test (offline plan)**

Create `scripts/images/migrate.test.mjs`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { planMigration } from './migrate.mjs'

test('planMigration maps uploads to webp keys and finds markdown edits', () => {
  const work = mkdtempSync(join(tmpdir(), 'mig-'))
  try {
    const uploadsDir = join(work, 'uploads')
    const contentDir = join(work, 'content')
    mkdirSync(join(uploadsDir, '2020', '02'), { recursive: true })
    mkdirSync(join(contentDir, 'posts'), { recursive: true })
    writeFileSync(join(uploadsDir, '2020', '02', 'foo.jpg'), 'x')
    writeFileSync(join(uploadsDir, '2020', '02', 'bar.png'), 'y')
    writeFileSync(
      join(contentDir, 'posts', 'p1.md'),
      'body ![a](/uploads/2020/02/foo.jpg) and ![](/uploads/2020/02/bar.png)\n',
    )
    writeFileSync(join(contentDir, 'posts', 'p2.md'), 'no images here\n')

    const { uploads, edits } = planMigration({ uploadsDir, contentDir, base: 'https://cdn.anping.us' })
    assert.deepEqual(uploads.map((u) => u.key).sort(), ['2020/02/bar.webp', '2020/02/foo.webp'])
    assert.equal(edits.length, 1)
    assert.equal(edits[0].replacements, 2)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/images/migrate.test.mjs`
Expected: FAIL — cannot find module `./migrate.mjs`.

- [ ] **Step 3: Implement `migrate.mjs`**

Create `scripts/images/migrate.mjs`:
```js
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
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

// CLI entry
if (import.meta.url === `file://${process.argv[1]}`) {
  const apply = process.argv.includes('--apply')
  if (!apply) {
    const { uploads, edits } = planMigration()
    console.log(`DRY RUN — no changes made.\n`)
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test scripts/images/migrate.test.mjs`
Expected: PASS (1 test).

- [ ] **Step 5: Verify the real dry-run reports the existing 186 images**

Run: `node scripts/images/migrate.mjs`
Expected: prints `Would upload 186 images to R2.` and lists the markdown files containing `/uploads/` refs. No files changed.

- [ ] **Step 6: Commit**

```bash
git add scripts/images/migrate.mjs scripts/images/migrate.test.mjs
git commit -m "feat(images): migration CLI (dry-run plan + apply)"
```

---

## Task 9: Runbook + user setup guide (`docs/images.md`)

**Files:**
- Create: `docs/images.md`

**Interfaces:** none (documentation).

- [ ] **Step 1: Write the runbook**

Create `docs/images.md` with these sections (fill with the exact values below):

````markdown
# Blog images: setup & daily use

## One-time setup (Cloudflare + DNS)

1. **Cloudflare account** → create/sign in at dash.cloudflare.com.
2. **Enable R2** (R2 → Overview → add a payment card; the free tier is $0: 10 GB, zero egress).
3. **Create bucket** named `anping-blog-images`.
4. **Move anping.us DNS to Cloudflare:** add the site in Cloudflare, then recreate these records — all **DNS only (grey cloud)**:

   | Type  | Name        | Value               |
   |-------|-------------|---------------------|
   | A     | `anping.us` | `185.199.108.153`   |
   | A     | `anping.us` | `185.199.109.153`   |
   | A     | `anping.us` | `185.199.110.153`   |
   | A     | `anping.us` | `185.199.111.153`   |
   | CNAME | `www`       | `emrickk.github.io` |

   Then at GoDaddy, change the nameservers to the two Cloudflare nameservers shown in the dashboard. Wait for "Active", confirm https://anping.us still loads.
5. **Connect the custom domain** to the bucket: R2 → `anping-blog-images` → Settings → Custom Domains → add `cdn.anping.us` (Cloudflare auto-creates the DNS record).
6. **Create an API token:** R2 → Manage API Tokens → Object Read & Write, scoped to `anping-blog-images`. Copy the Account ID, Access Key ID, Secret.
7. **Local creds:** `cp .env.example .env.local` and fill `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. Optionally set `NAS_ARCHIVE_PATH` to your mounted SMB share (e.g. `/Volumes/photo/blog-originals`).
8. **Smoke test:** `npm run test:images` — the R2 live test should now run (not skip).

## Daily use

1. Drop full-size photos into `image-staging/`.
2. `npm run images` — archives originals to the NAS, uploads optimized WebP to R2, prints markdown snippets.
3. Paste the snippets into your post, delete the staged files, commit the post.

## One-time migration of existing images

1. `npm run images:migrate` (dry-run) — review the planned uploads/edits.
2. `npm run images:migrate -- --apply` — uploads all `public/uploads` images and rewrites references.
3. Spot-check: open a migrated post locally (`npm run dev`) and confirm images load from `cdn.anping.us`.
4. Remove the now-unused files: `git rm -r public/uploads && git commit -m "chore(images): serve uploads from R2"`.
5. (Optional) purge old image blobs from git history with `git filter-repo` — separate, deliberate step.

## Troubleshooting

- **Images 404 on cdn.anping.us:** custom domain not connected, or DNS not yet "Active".
- **`Missing required env vars`:** `.env.local` absent or incomplete.
- **Originals landing in `originals/` instead of the NAS:** `NAS_ARCHIVE_PATH` unset or the SMB share isn't mounted.
````

- [ ] **Step 2: Commit**

```bash
git add docs/images.md
git commit -m "docs(images): setup guide and runbook"
```

---

## Task 10: Verify full suite + README pointer

**Files:**
- Modify: `README.md` (add a one-line pointer to `docs/images.md`)

- [ ] **Step 1: Run the whole image suite**

Run: `npm run test:images`
Expected: all PASS; R2 live test skipped if `.env.local` has no creds.

- [ ] **Step 2: Add a README pointer**

Add under an appropriate section in `README.md`:
```markdown
## Images

Blog images are served from Cloudflare R2 (`cdn.anping.us`) with originals archived to the NAS. See [docs/images.md](docs/images.md) for setup and daily workflow.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: link image workflow from README"
```

---

## Task 11: Live cutover — REQUIRES user's R2 setup complete

**Precondition:** Tasks 1–10 merged, and the user has finished `docs/images.md` steps 1–7 (bucket live, `cdn.anping.us` connected, `.env.local` filled).

**Files:**
- Modify: `src/content/posts/**` (reference rewrites, performed by `migrate.mjs --apply`)
- Delete: `public/uploads/**`

- [ ] **Step 1: Confirm credentials work**

Run: `npm run test:images`
Expected: the R2 live test executes and PASSES (no longer skipped).

- [ ] **Step 2: Dry-run the migration**

Run: `npm run images:migrate`
Expected: `Would upload 186 images to R2.` plus the list of markdown files.

- [ ] **Step 3: Apply the migration**

Run: `npm run images:migrate -- --apply`
Expected: 186 `✓` upload lines, then `✎` per edited markdown file, then `Done: uploaded 186, edited N files.`

- [ ] **Step 4: Verify a sample renders from R2**

Run: `npm run dev`, open a post that had images, confirm they load from `https://cdn.anping.us/…` (check the Network tab / element `src`).

Also spot-check one URL directly:
```bash
curl -sI https://cdn.anping.us/2023/03/BMW-X3-2.webp | head -n1
```
Expected: `HTTP/2 200`.

- [ ] **Step 5: Remove uploads from the repo and commit (rewrites + deletion together)**

```bash
git add src/content
git rm -r public/uploads
git commit -m "chore(images): migrate uploads to R2, drop in-repo images"
```

- [ ] **Step 6: Build to confirm nothing references the removed files**

Run: `npm run build`
Expected: build succeeds; no broken-image / missing-asset errors.

---

## Self-Review

**Spec coverage:**
- Archive layer (NAS + local fallback) → Task 5, wired in Task 7. ✓
- Serving layer (R2 optimized WebP) → Tasks 3, 6, 7. ✓
- Keep repo lean (remove uploads) → Task 11. ✓
- Simple authoring (`npm run images`, staging folder) → Task 7. ✓
- ~$0 cost / config (bucket, base, cache header) → Tasks 1, 6. ✓
- DNS migration exact records → Task 9 runbook. ✓
- One-time backfill (dry-run → apply, rewrite refs) → Tasks 8, 11. ✓
- Idempotency / dedupe manifest → Task 4, used in Task 7. ✓
- Non-goals (no watcher, no on-the-fly resize, no Astro remotePatterns, no SSH archiving) → respected; nothing added. ✓
- Migration scope = `public/uploads` only, hero images untouched → Task 8 (`uploadsDir` only) + rewrite regex targets `/uploads/` only (Task 2 test asserts hero refs untouched). ✓

**Placeholder scan:** no TBD/TODO; every code and command step is complete. ✓

**Type consistency:** `loadConfig` shape (Task 1) is consumed unchanged by `makeClient`/`archiveOriginal`/`run`/`applyMigration`. `deriveKey`/`keyFromUploadPath`/`rewriteUploads`/`snippetFor` signatures defined in Task 2 are used consistently in Tasks 7 and 8. `optimizeToWebp` return `{buffer,width,height,bytes}` used consistently in Tasks 7 and 8. `putObject(client,bucket,key,buffer,contentType)` and `makeClient(config)` signatures match across Tasks 6, 7, 8. ✓
