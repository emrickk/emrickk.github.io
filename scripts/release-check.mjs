#!/usr/bin/env node
// Release checklist: deterministic pre-push checks with a go/no-go verdict.
// Quick mode: checks 1-8. Full mode (--full): adds CDN and internal link checks.
// This script never pushes, merges, or tags.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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

export function findForbiddenPaths(root) {
  const tracked = git(['ls-files'], { cwd: root })
  const staged = git(['diff', '--cached', '--name-only'], { cwd: root })
  const all = new Set([...tracked.split('\n'), ...staged.split('\n')].filter(Boolean))
  return [...all].filter((p) => FORBIDDEN_PATHS.some((f) => f.re.test(p))).sort()
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

export const CHECKS = [
  { num: 1, name: 'checkpoint', run: checkCheckpoint },
  { num: 2, name: 'git hygiene', run: checkHygiene },
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
