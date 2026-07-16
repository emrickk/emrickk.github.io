#!/usr/bin/env node
// Release checklist: deterministic pre-push checks with a go/no-go verdict.
// Quick mode: checks 1-9 and 12. Full mode (--full): adds CDN and internal link checks.
// This script never pushes, merges, or tags.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { checkPostPreview } from './preview-posts.mjs'

export const FORBIDDEN_PATHS = [
  { name: 'env file', re: /^\.env(?!\.example$)/ },
  { name: 'image staging', re: /^image-staging\// },
  { name: 'originals', re: /^originals\// },
  { name: 'images manifest', re: /^scripts\/images\/\.manifest\.json$/ },
]

function git(args, { cwd, allowFail = false } = {}) {
  try {
    return execFileSync('git', args, {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
    }).replace(/\n$/, '')
  } catch (err) {
    if (allowFail) return null
    throw new Error(`git ${args.join(' ')} failed: ${err.stderr ? String(err.stderr).trim() : err.message}`)
  }
}

// -z output with NUL splitting keeps non-ASCII paths verbatim (default
// core.quotepath=true would C-quote them and break the regex matches).
export function findForbiddenPaths(root) {
  const tracked = git(['ls-files', '-z'], { cwd: root })
  const staged = git(['diff', '--cached', '--name-only', '-z'], { cwd: root })
  const all = new Set([...tracked.split('\0'), ...staged.split('\0')].filter(Boolean))
  return [...all].filter((p) => FORBIDDEN_PATHS.some((f) => f.re.test(p))).sort()
}

export const SECRET_PATTERNS = [
  { name: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'github-token', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b/g },
  { name: 'github-pat', re: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/g },
  { name: 'private-key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  {
    name: 'credential-assignment',
    re: /\b[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|ACCESS_KEY|PRIVATE_KEY)[A-Z0-9_]*\s*[=:]\s*['"][A-Za-z0-9+/_=-]{16,}['"]/gi,
  },
  { name: 'high-entropy', re: /\b[A-Za-z0-9+/=_-]{40,}\b/g, entropy: 4.5 },
]

// docs/superpowers/ and the release-check test file contain planted example
// tokens by design; excluding them avoids guaranteed false positives.
const SCAN_SKIP = /^docs\/superpowers\/|^scripts\/release-check\.test\.mjs$|(?:^|\/)(?:package-lock\.json|.*\.lock)$|\.(?:png|jpe?g|webp|gif|ico|woff2?|ttf|otf|pdf|zip|gz|mp[34])$/i

export function shannonEntropy(s) {
  const freq = {}
  for (const ch of s) freq[ch] = (freq[ch] || 0) + 1
  let e = 0
  for (const n of Object.values(freq)) {
    const p = n / s.length
    e -= p * Math.log2(p)
  }
  return e
}

export function scanTextForSecrets(text, file, allowlist) {
  const findings = []
  for (const { name, re, entropy } of SECRET_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const match = m[0]
      if (entropy && shannonEntropy(match) < entropy) continue
      if (allowlist.some((a) => a.test(`${file}:${match}`))) continue
      const line = text.slice(0, m.index).split('\n').length
      findings.push({ file, line, pattern: name, redacted: `${match.slice(0, 4)}...(${match.length} chars)` })
    }
  }
  return findings
}

export function loadAllowlist(root) {
  const p = join(root, 'scripts', 'release-check-allowlist.json')
  if (!existsSync(p)) return []
  return JSON.parse(readFileSync(p, 'utf8')).allow.map((s) => new RegExp(s))
}

// Scan scope: lines added relative to origin/main (committed or not) plus
// every untracked file. Falls back to HEAD when origin/main is absent.
export function collectSecretScanSources(root) {
  const sources = []
  const base = git(['rev-parse', '--verify', '-q', 'origin/main'], { cwd: root, allowFail: true }) ? 'origin/main' : 'HEAD'
  // core.quotepath=off keeps non-ASCII paths raw in the +++ b/ headers; the
  // default C-quoting would make them unparseable and skip those files.
  const diff = git(['-c', 'core.quotepath=off', 'diff', '--no-renames', '--unified=0', base], { cwd: root, allowFail: true }) || ''
  let file = null
  const added = new Map()
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ b/')) { file = line.slice(6); continue }
    if (line.startsWith('+++')) { file = null; continue }
    if (file && !SCAN_SKIP.test(file) && line.startsWith('+') && !line.startsWith('+++')) {
      added.set(file, (added.get(file) || '') + line.slice(1) + '\n')
    }
  }
  for (const [f, text] of added) sources.push({ file: f, text })
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z'], { cwd: root }) || ''
  for (const f of untracked.split('\0').filter(Boolean)) {
    if (SCAN_SKIP.test(f)) continue
    const p = join(root, f)
    if (!existsSync(p) || statSync(p).size > 1024 * 1024) continue
    sources.push({ file: f, text: readFileSync(p, 'utf8') })
  }
  return sources
}

function checkSecrets(root) {
  const allowlist = loadAllowlist(root)
  const findings = collectSecretScanSources(root).flatMap((s) => scanTextForSecrets(s.text, s.file, allowlist))
  if (findings.length) {
    const lines = findings.map((f) => `${f.file}:${f.line} ${f.pattern} ${f.redacted}`)
    return { status: 'FAIL', detail: `possible secrets:\n${lines.join('\n')}\n(false positive? add a pattern to scripts/release-check-allowlist.json)` }
  }
  return { status: 'PASS', detail: 'no credential patterns in new or untracked content' }
}

function checkCheckpoint(root) {
  const cli = fileURLToPath(new URL('./checkpoint.mjs', import.meta.url))
  const out = execFileSync('node', [cli, 'save', 'release-check', '--auto', 'release-check'], {
    cwd: root, encoding: 'utf8',
  }).trim()
  return { status: 'PASS', detail: out }
}

function checkHygiene(root) {
  const hits = findForbiddenPaths(root)
  if (hits.length) return { status: 'FAIL', detail: `forbidden paths tracked or staged: ${hits.join(', ')}` }
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root })
  const dirty = git(['status', '--porcelain'], { cwd: root })
  const state = dirty ? `${dirty.split('\n').length} uncommitted change(s)` : 'clean tree'
  return { status: 'PASS', detail: `branch ${branch}, ${state}` }
}

function npmRun(root, script) {
  try {
    execFileSync('npm', ['run', script], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
    })
    return { status: 'PASS', detail: `npm run ${script}` }
  } catch (err) {
    const tail = [String(err.stdout || ''), String(err.stderr || '')].join('\n').trim().split('\n').slice(-15).join('\n')
    return { status: 'FAIL', detail: `npm run ${script} failed:\n${tail}` }
  }
}

function checkLint(root) {
  const eslint = npmRun(root, 'lint')
  if (eslint.status === 'FAIL') return eslint
  const css = npmRun(root, 'lint:css')
  if (css.status === 'FAIL') return css
  return { status: 'PASS', detail: 'eslint and stylelint' }
}

export function walkFiles(dir, exts) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walkFiles(p, exts))
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(p)
  }
  return out
}

export function checkDistDir(dist, { minPages = 300 } = {}) {
  const failures = []
  if (!existsSync(dist)) return { failures: ['dist/ missing (build first)'], htmlCount: 0 }
  const htmlFiles = walkFiles(dist, ['.html'])
  if (htmlFiles.length < minPages) {
    failures.push(`only ${htmlFiles.length} HTML pages, expected at least ${minPages}`)
  }
  for (const rel of ['rss.xml', 'sitemap-index.xml']) {
    const p = join(dist, rel)
    if (!existsSync(p) || statSync(p).size === 0) failures.push(`${rel} missing or empty`)
  }
  if (!existsSync(join(dist, 'pagefind', 'pagefind.js'))) failures.push('pagefind index missing')
  const scanFiles = [...htmlFiles, ...walkFiles(dist, ['.xml'])]
  for (const p of scanFiles) {
    const text = readFileSync(p, 'utf8')
    const rel = p.slice(dist.length + 1)
    if (text.includes('/uploads/')) failures.push(`${rel}: stale /uploads/ reference`)
    if (text.includes('cdn.anping.us')) failures.push(`${rel}: stale cdn.anping.us reference (domain expires; use cdn.theneverless.com)`)
    if (/(?:href|src)=["']https?:\/\/(?:localhost|127\.0\.0\.1)/.test(text)) failures.push(`${rel}: localhost URL`)
  }
  return { failures, htmlCount: htmlFiles.length }
}

function checkBuiltOutput(root) {
  const { failures, htmlCount } = checkDistDir(join(root, 'dist'))
  if (failures.length) {
    return { status: 'FAIL', detail: failures.slice(0, 20).join('\n') + (failures.length > 20 ? `\n... and ${failures.length - 20} more` : '') }
  }
  return { status: 'PASS', detail: `${htmlCount} pages, rss + sitemap + pagefind present, no stale references` }
}

export function extractCdnUrls(text) {
  const urls = new Set()
  for (const m of text.matchAll(/https:\/\/cdn\.theneverless\.com\/[^\s"'<>()\\]+/g)) urls.add(m[0])
  return [...urls]
}

export async function verifyUrls(urls, { concurrency = 10, retries = 2, timeoutMs = 10000 } = {}) {
  const queue = [...urls]
  const failures = []
  async function worker() {
    while (queue.length) {
      const url = queue.shift()
      let lastErr = null
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) })
          if (res.status === 200) { lastErr = null; break }
          lastErr = `HTTP ${res.status}`
        } catch (err) {
          lastErr = err.name === 'TimeoutError' ? 'timeout' : err.message
        }
        if (attempt < retries) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
      }
      if (lastErr) failures.push({ url, error: lastErr })
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) || 1 }, worker))
  return failures
}

export function extractInternalRefs(html) {
  const refs = new Set()
  for (const m of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
    const v = m[1]
    if (!v.startsWith('/') || v.startsWith('//')) continue
    const clean = v.split('#')[0].split('?')[0]
    if (clean) refs.add(clean)
  }
  return [...refs]
}

export function resolveInternalRef(ref, dist) {
  let decoded
  try {
    decoded = decodeURIComponent(ref)
  } catch {
    return false
  }
  const abs = resolve(join(dist, ...decoded.split('/').filter(Boolean)))
  const distAbs = resolve(dist)
  if (abs !== distAbs && !abs.startsWith(distAbs + sep)) return false
  if (existsSync(abs)) {
    return statSync(abs).isDirectory() ? existsSync(join(abs, 'index.html')) : true
  }
  return existsSync(abs + '.html')
}

async function checkCdnImages(root) {
  const dist = join(root, 'dist')
  if (!existsSync(dist)) return { status: 'FAIL', detail: 'dist/ missing (build first)' }
  const urls = new Set()
  for (const p of walkFiles(dist, ['.html', '.xml'])) {
    for (const u of extractCdnUrls(readFileSync(p, 'utf8'))) urls.add(u)
  }
  const failures = await verifyUrls([...urls])
  if (failures.length) {
    return { status: 'FAIL', detail: failures.slice(0, 20).map((f) => `${f.error} ${f.url}`).join('\n') }
  }
  return { status: 'PASS', detail: `${urls.size} CDN URLs all return 200` }
}

function checkInternalLinks(root) {
  const dist = join(root, 'dist')
  if (!existsSync(dist)) return { status: 'FAIL', detail: 'dist/ missing (build first)' }
  const broken = []
  for (const p of walkFiles(dist, ['.html'])) {
    const rel = p.slice(dist.length + 1)
    for (const ref of extractInternalRefs(readFileSync(p, 'utf8'))) {
      if (!resolveInternalRef(ref, dist)) broken.push(`${rel}: ${ref}`)
    }
  }
  if (broken.length) {
    return { status: 'FAIL', detail: broken.slice(0, 20).join('\n') + (broken.length > 20 ? `\n... and ${broken.length - 20} more` : '') }
  }
  return { status: 'PASS', detail: 'all internal links resolve' }
}

export const CHECKS = [
  { num: 1, name: 'checkpoint', run: checkCheckpoint },
  { num: 2, name: 'git hygiene', run: checkHygiene },
  { num: 3, name: 'secret scan', run: checkSecrets },
  { num: 4, name: 'types (astro check)', run: (root) => npmRun(root, 'check') },
  { num: 5, name: 'lint', run: checkLint },
  { num: 6, name: 'build', run: (root) => npmRun(root, 'build') },
  { num: 7, name: 'image tests', run: (root) => npmRun(root, 'test:images') },
  { num: 8, name: 'rehype tests', run: (root) => npmRun(root, 'test:rehype') },
  { num: 9, name: 'built output', run: checkBuiltOutput },
  { num: 10, name: 'CDN images', full: true, run: checkCdnImages },
  { num: 11, name: 'internal links', full: true, run: checkInternalLinks },
  { num: 12, name: 'post preview', run: (root) => checkPostPreview(root) },
]

export async function runChecks(root, { full = false } = {}) {
  const results = []
  for (const check of CHECKS) {
    if (check.full && !full) continue
    const started = Date.now()
    let result
    try {
      result = await check.run(root, { full })
    } catch (err) {
      result = { status: 'FAIL', detail: err.message }
    }
    result.num = check.num
    result.name = check.name
    result.seconds = ((Date.now() - started) / 1000).toFixed(1)
    console.log(`[${check.num}] ${check.name}: ${result.status} (${result.seconds}s)`)
    if (result.detail) console.log(`    ${String(result.detail).split('\n').join('\n    ')}`)
    results.push(result)
  }
  return results
}

export function verdict(results) {
  const failed = results.filter((r) => r.status === 'FAIL')
  return failed.length === 0
    ? `VERDICT: GO (${results.length} checks, no failures)`
    : `VERDICT: NO-GO (${failed.length} failing: ${failed.map((r) => `#${r.num} ${r.name}`).join(', ')})`
}

// CLI entry (pathToFileURL handles spaces in the repo path)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const full = process.argv.includes('--full')
  const root = git(['rev-parse', '--show-toplevel'])
  if (!existsSync(join(root, 'astro.config.mjs'))) {
    console.error('run from the blog repo root')
    process.exit(1)
  }
  runChecks(root, { full }).then((results) => {
    console.log('\n' + verdict(results))
    process.exit(results.some((r) => r.status === 'FAIL') ? 1 : 0)
  })
}
