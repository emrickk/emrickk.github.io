#!/usr/bin/env node
// Checkpoint CLI: snapshot and restore working-tree files via hidden git refs.
// Snapshots live under refs/checkpoints/ (local only, never pushed). Saving
// and restoring never move HEAD, branches, or the real index.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync, rmdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createInterface } from 'node:readline/promises'

const REF_PREFIX = 'refs/checkpoints/'
const KEEP_COUNT = 50
const KEEP_DAYS = 30
const KEEP_FLOOR = 5
// Deterministic ident so commit-tree never depends on user git config
const IDENT = {
  GIT_AUTHOR_NAME: 'checkpoint',
  GIT_AUTHOR_EMAIL: 'checkpoint@local',
  GIT_COMMITTER_NAME: 'checkpoint',
  GIT_COMMITTER_EMAIL: 'checkpoint@local',
}

export function git(args, { cwd, env, allowFail = false } = {}) {
  try {
    return execFileSync('git', args, {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    }).replace(/\n$/, '')
  } catch (err) {
    if (allowFail) return null
    const stderr = err.stderr ? String(err.stderr).trim() : err.message
    throw new Error(`git ${args.join(' ')} failed: ${stderr}`)
  }
}

export function repoRoot(cwd = process.cwd()) {
  const root = git(['rev-parse', '--show-toplevel'], { cwd, allowFail: true })
  if (!root) throw new Error('not inside a git repository')
  return root
}

// Hash the full working tree (tracked + untracked, .gitignore respected)
// using a temporary index so the real index is never touched.
export function workingTreeHash(root) {
  const tmp = mkdtempSync(join(tmpdir(), 'checkpoint-'))
  try {
    const env = { ...IDENT, GIT_INDEX_FILE: join(tmp, 'index') }
    git(['add', '-A'], { cwd: root, env })
    return git(['write-tree'], { cwd: root, env })
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

export function slug(text) {
  const s = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return s || 'checkpoint'
}

function timestampId(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return (
    `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}` +
    `-${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}`
  )
}

export function listCheckpoints(root) {
  const out = git(
    ['for-each-ref', '--sort=-refname',
      '--format=%(refname)%09%(objectname)%09%(creatordate:iso-strict)', REF_PREFIX],
    { cwd: root },
  )
  if (!out) return []
  return out.split('\n').map((line) => {
    const [refname, sha, date] = line.split('\t')
    const body = git(['log', '-1', '--format=%B', sha], { cwd: root })
    const meta = {}
    for (const m of body.matchAll(/^(label|trigger|branch|head): (.*)$/gm)) meta[m[1]] = m[2]
    return { id: refname.slice(REF_PREFIX.length), refname, sha, date: new Date(date), ...meta }
  })
}

export function save(root, { label, trigger = 'manual', quiet = false } = {}) {
  const tree = workingTreeHash(root)
  const existing = listCheckpoints(root)
  if (existing.length > 0) {
    const latestTree = git(['rev-parse', `${existing[0].sha}^{tree}`], { cwd: root })
    if (latestTree === tree) {
      if (!quiet) console.log(`no changes since last checkpoint (${existing[0].id})`)
      return { id: existing[0].id, created: false }
    }
  }
  const head = git(['rev-parse', '--verify', '-q', 'HEAD'], { cwd: root, allowFail: true })
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root, allowFail: true }) || 'unknown'
  const cleanLabel = slug(label || trigger)
  const message = [
    `checkpoint: ${cleanLabel}`, '',
    `label: ${cleanLabel}`, `trigger: ${trigger}`, `branch: ${branch}`, `head: ${head || 'none'}`,
  ].join('\n')
  const args = ['commit-tree', tree, '-m', message]
  if (head) args.splice(2, 0, '-p', head)
  const sha = git(args, { cwd: root, env: IDENT })
  let id = `${timestampId()}-${cleanLabel}`
  let n = 2
  while (git(['rev-parse', '--verify', '-q', REF_PREFIX + id], { cwd: root, allowFail: true }) !== null) {
    id = `${timestampId()}-${cleanLabel}-${n++}`
  }
  git(['update-ref', REF_PREFIX + id, sha], { cwd: root })
  prune(root, { quiet: true })
  if (!quiet) console.log(`checkpoint saved: ${id}`)
  return { id, created: true }
}

export function resolveId(root, query) {
  if (!query) throw new Error('missing checkpoint id (run: npm run checkpoint list)')
  const all = listCheckpoints(root)
  const exact = all.find((c) => c.id === query)
  if (exact) return exact
  const matches = all.filter((c) => c.id.includes(query))
  if (matches.length === 1) return matches[0]
  if (matches.length === 0) throw new Error(`no checkpoint matches "${query}" (run: npm run checkpoint list)`)
  throw new Error(`"${query}" is ambiguous, matches: ${matches.map((c) => c.id).join(', ')}`)
}

export function diffCheckpoint(root, query, { full = false, paths = [] } = {}) {
  const ckpt = resolveId(root, query)
  const cur = workingTreeHash(root)
  const args = ['diff', '--no-renames', ...(full ? [] : ['--stat']), `${ckpt.sha}^{tree}`, cur]
  if (paths.length) args.push('--', ...paths)
  return git(args, { cwd: root })
}

export function prune(root, { keep = KEEP_COUNT, days = KEEP_DAYS, quiet = false } = {}) {
  const all = listCheckpoints(root)
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const floor = Math.max(keep, KEEP_FLOOR)
  const doomed = all.filter((c, i) => i >= floor && c.date.getTime() < cutoff)
  for (const c of doomed) git(['update-ref', '-d', c.refname], { cwd: root })
  if (!quiet && doomed.length) console.log(`pruned ${doomed.length} checkpoint(s)`)
  return doomed.length
}
