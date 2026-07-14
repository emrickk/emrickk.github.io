# Blog Safety Tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Also follow superpowers:test-driven-development.

**Goal:** Add a git-based checkpoint/restore CLI and an agent-executed release checklist to the blog repo, per the spec at `docs/superpowers/specs/2026-07-12-blog-safety-tooling-design.md`.

**Architecture:** Two zero-dependency Node CLIs under `scripts/` (matching the `scripts/images/` conventions), two project skills under `.claude/skills/`, a SessionStart hook in `.claude/settings.json`, and a Safety section in CLAUDE.md. Checkpoints are commits stored under local-only `refs/checkpoints/` refs, built with a temporary index so HEAD, branches, the real index, and working files are never touched.

**Tech Stack:** Node >= 22 (`node:child_process`, `node:test`, global `fetch`), git plumbing (`add -A` into `GIT_INDEX_FILE`, `write-tree`, `commit-tree`, `update-ref`, `for-each-ref`, `restore --source`).

**Worktree:** `/Users/anping.wang/Documents/Stuff/AI Space/Personal Website/Personal Blog/blog-safety-tooling`, branch `safety-tooling`. All commands below run from this directory. Repo rules apply: stage explicit paths only, no em-dashes in docs/messages, never push.

**Code style:** single quotes, no semicolons, `export function` named exports, CLI entry guard `if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)` (see `scripts/images/process.mjs:69`).

---

## File map

| File | Responsibility |
|---|---|
| `scripts/checkpoint.mjs` | Checkpoint CLI: save, list, diff, restore, prune |
| `scripts/checkpoint.test.mjs` | node:test suite for the checkpoint CLI |
| `scripts/release-check.mjs` | Release checklist CLI: checks 1 to 10, verdict, exit code |
| `scripts/release-check.test.mjs` | node:test suite for the checklist's testable internals |
| `scripts/test-helpers.mjs` | Shared test fixtures: temp git repos, fixture dist trees |
| `scripts/release-check-allowlist.json` | Secret-scan false-positive allowlist (regex patterns only) |
| `.claude/settings.json` | SessionStart auto-checkpoint hook |
| `.claude/skills/checkpoint/SKILL.md` | Agent-facing doc for the checkpoint tool |
| `.claude/skills/release-check/SKILL.md` | Agent workflow: run script, browser smoke test, verdict |
| `package.json` | Add `checkpoint`, `release-check`, `test:safety` scripts |
| `CLAUDE.md` | New Safety section |

---

### Task 0: Baseline

- [ ] **Step 0.1: Install dependencies in the worktree**

Run: `cd "/Users/anping.wang/Documents/Stuff/AI Space/Personal Website/Personal Blog/blog-safety-tooling" && npm ci`
Expected: clean install, no errors.

- [ ] **Step 0.2: Verify the existing test suite passes**

Run: `npm run test:images`
Expected: all tests pass (the R2 live test may self-skip without credentials). If this fails, stop and report; do not build on a broken baseline.

---

### Task 1: Checkpoint core (save + list)

**Files:**
- Create: `scripts/test-helpers.mjs`
- Create: `scripts/checkpoint.test.mjs`
- Create: `scripts/checkpoint.mjs`

- [ ] **Step 1.1: Create the fixture helper**

`scripts/test-helpers.mjs`:

```js
// Test fixtures for the safety tooling suites. Creates throwaway git repos
// and dist trees under the OS tmpdir; never touches the real repo.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

export function run(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

export function write(root, rel, content) {
  const p = join(root, rel)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, content)
}

export function makeFixtureRepo() {
  const root = mkdtempSync(join(tmpdir(), 'blog-safety-fixture-'))
  run(root, ['init', '-q', '-b', 'main'])
  run(root, ['config', 'user.email', 'test@local'])
  run(root, ['config', 'user.name', 'test'])
  write(root, '.gitignore', 'ignored.txt\nnode_modules/\n')
  write(root, 'tracked.md', 'original\n')
  run(root, ['add', '.gitignore', 'tracked.md'])
  run(root, ['commit', '-q', '-m', 'init'])
  return root
}

export function cleanup(root) {
  rmSync(root, { recursive: true, force: true })
}

// Minimal valid dist tree for release-check output tests. Pass overrides to
// plant violations or omit required files.
export function makeFixtureDist(root, { omit = [], extraHtml = {} } = {}) {
  const dist = join(root, 'dist')
  const files = {
    'index.html': '<html><body><a href="/posts/a/">a</a></body></html>',
    'posts/a/index.html':
      '<html><body><img src="https://cdn.anping.us/2020/02/foo.webp"><a href="/">home</a></body></html>',
    'rss.xml': '<rss><channel><title>t</title></channel></rss>',
    'sitemap-index.xml': '<sitemapindex></sitemapindex>',
    'pagefind/pagefind.js': '// pagefind stub',
    ...extraHtml,
  }
  for (const [rel, content] of Object.entries(files)) {
    if (omit.includes(rel)) continue
    write(root, join('dist', rel), content)
  }
  return dist
}
```

- [ ] **Step 1.2: Write failing tests for save**

`scripts/checkpoint.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { makeFixtureRepo, cleanup, run, write } from './test-helpers.mjs'
import { save, listCheckpoints } from './checkpoint.mjs'

test('save captures tracked changes and untracked files, excludes ignored', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  write(root, 'tracked.md', 'changed\n')
  write(root, 'new-post.md', 'untracked content\n')
  write(root, 'ignored.txt', 'never captured\n')
  const { id, created } = save(root, { label: 'test', quiet: true })
  assert.equal(created, true)
  const files = run(root, ['ls-tree', '-r', '--name-only', `refs/checkpoints/${id}`]).split('\n')
  assert.ok(files.includes('tracked.md'))
  assert.ok(files.includes('new-post.md'))
  assert.ok(!files.includes('ignored.txt'))
  const content = run(root, ['show', `refs/checkpoints/${id}:tracked.md`])
  assert.equal(content, 'changed')
})

test('save leaves git status, index, and HEAD untouched', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  write(root, 'tracked.md', 'dirty\n')
  write(root, 'new.md', 'x\n')
  const before = {
    status: run(root, ['status', '--porcelain']),
    head: run(root, ['rev-parse', 'HEAD']),
    branch: run(root, ['rev-parse', '--abbrev-ref', 'HEAD']),
  }
  save(root, { label: 'test', quiet: true })
  assert.equal(run(root, ['status', '--porcelain']), before.status)
  assert.equal(run(root, ['rev-parse', 'HEAD']), before.head)
  assert.equal(run(root, ['rev-parse', '--abbrev-ref', 'HEAD']), before.branch)
})

test('save dedups when nothing changed since the last checkpoint', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  write(root, 'tracked.md', 'v2\n')
  const first = save(root, { label: 'one', quiet: true })
  assert.equal(first.created, true)
  const second = save(root, { label: 'two', quiet: true })
  assert.equal(second.created, false)
  assert.equal(second.id, first.id)
  assert.equal(listCheckpoints(root).length, 1)
})

test('same-second saves with changes get distinct ids', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  write(root, 'tracked.md', 'v2\n')
  const a = save(root, { label: 'fast', quiet: true })
  write(root, 'tracked.md', 'v3\n')
  const b = save(root, { label: 'fast', quiet: true })
  assert.notEqual(a.id, b.id)
  assert.equal(listCheckpoints(root).length, 2)
})

test('list returns newest first with metadata', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  write(root, 'tracked.md', 'v2\n')
  save(root, { label: 'alpha', trigger: 'manual', quiet: true })
  write(root, 'tracked.md', 'v3\n')
  save(root, { label: 'beta', trigger: 'session-start', quiet: true })
  const list = listCheckpoints(root)
  assert.equal(list.length, 2)
  assert.equal(list[0].label, 'beta')
  assert.equal(list[0].trigger, 'session-start')
  assert.equal(list[0].branch, 'main')
  assert.equal(list[1].label, 'alpha')
})
```

- [ ] **Step 1.3: Run tests to verify they fail**

Run: `node --test scripts/checkpoint.test.mjs`
Expected: FAIL (cannot find module `./checkpoint.mjs`).

- [ ] **Step 1.4: Implement the core**

`scripts/checkpoint.mjs`:

```js
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

export function prune(root, { keep = KEEP_COUNT, days = KEEP_DAYS, quiet = false } = {}) {
  const all = listCheckpoints(root)
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  const floor = Math.max(keep, KEEP_FLOOR)
  const doomed = all.filter((c, i) => i >= floor && c.date.getTime() < cutoff)
  for (const c of doomed) git(['update-ref', '-d', c.refname], { cwd: root })
  if (!quiet && doomed.length) console.log(`pruned ${doomed.length} checkpoint(s)`)
  return doomed.length
}
```

(`prune` lands now because `save` calls it; its own tests come in Task 4.)

- [ ] **Step 1.5: Run tests to verify they pass**

Run: `node --test scripts/checkpoint.test.mjs`
Expected: 5 tests PASS.

- [ ] **Step 1.6: Commit**

```bash
git add scripts/test-helpers.mjs scripts/checkpoint.mjs scripts/checkpoint.test.mjs
git commit -m "feat(safety): checkpoint save and list via hidden refs"
```

---

### Task 2: Checkpoint id resolution + diff

**Files:**
- Modify: `scripts/checkpoint.mjs`
- Modify: `scripts/checkpoint.test.mjs`

- [ ] **Step 2.1: Write failing tests**

Append to `scripts/checkpoint.test.mjs` (add `resolveId, diffCheckpoint` to the import from `./checkpoint.mjs`):

```js
test('resolveId matches exact, substring, rejects ambiguous and missing', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  write(root, 'tracked.md', 'v2\n')
  const a = save(root, { label: 'before-merge', quiet: true })
  write(root, 'tracked.md', 'v3\n')
  save(root, { label: 'before-rewrite', quiet: true })
  assert.equal(resolveId(root, a.id).id, a.id)
  assert.equal(resolveId(root, 'merge').id, a.id)
  assert.throws(() => resolveId(root, 'before'), /ambiguous/)
  assert.throws(() => resolveId(root, 'nope-xyz'), /no checkpoint matches/)
})

test('diffCheckpoint reports changes between checkpoint and working tree', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  const { id } = save(root, { label: 'base', quiet: true })
  write(root, 'tracked.md', 'changed after checkpoint\n')
  const stat = diffCheckpoint(root, id)
  assert.match(stat, /tracked\.md/)
  assert.match(stat, /1 file changed/)
  const full = diffCheckpoint(root, id, { full: true })
  assert.match(full, /\+changed after checkpoint/)
})
```

- [ ] **Step 2.2: Run tests to verify the new ones fail**

Run: `node --test scripts/checkpoint.test.mjs`
Expected: the two new tests FAIL (functions not exported); the earlier 5 still PASS.

- [ ] **Step 2.3: Implement**

Add to `scripts/checkpoint.mjs`:

```js
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
```

- [ ] **Step 2.4: Run tests to verify they pass**

Run: `node --test scripts/checkpoint.test.mjs`
Expected: 7 tests PASS.

- [ ] **Step 2.5: Commit**

```bash
git add scripts/checkpoint.mjs scripts/checkpoint.test.mjs
git commit -m "feat(safety): checkpoint id resolution and diff"
```

---

### Task 3: Restore

**Files:**
- Modify: `scripts/checkpoint.mjs`
- Modify: `scripts/checkpoint.test.mjs`

- [ ] **Step 3.1: Write failing tests**

Append (add `restore` to the import; also add `import { execFileSync } from 'node:child_process'` and `import { fileURLToPath } from 'node:url'` at the top of the test file). Subprocess spawns must use `fileURLToPath`, never `URL.pathname`: this repo's path contains a space ("AI Space") which `.pathname` leaves percent-encoded and node then cannot find the module.

```js
test('full restore round-trips: modified reverted, new file deleted', async (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  write(root, 'tracked.md', 'good state\n')
  write(root, 'keeper.md', 'exists at checkpoint\n')
  const { id } = save(root, { label: 'good', quiet: true })
  write(root, 'tracked.md', 'bad edit\n')
  write(root, 'junk.md', 'created after checkpoint\n')
  write(root, 'ignored.txt', 'ignored survives restore\n')
  const result = await restore(root, id, { yes: true, quiet: true })
  assert.ok(result.restored >= 2)
  assert.equal(readFileSync(join(root, 'tracked.md'), 'utf8'), 'good state\n')
  assert.equal(readFileSync(join(root, 'keeper.md'), 'utf8'), 'exists at checkpoint\n')
  assert.ok(!existsSync(join(root, 'junk.md')))
  assert.ok(existsSync(join(root, 'ignored.txt')))
})

test('partial restore only touches named paths', async (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  write(root, 'a.md', 'a1\n')
  write(root, 'b.md', 'b1\n')
  const { id } = save(root, { label: 'base', quiet: true })
  write(root, 'a.md', 'a2\n')
  write(root, 'b.md', 'b2\n')
  await restore(root, id, { yes: true, quiet: true, paths: ['a.md'] })
  assert.equal(readFileSync(join(root, 'a.md'), 'utf8'), 'a1\n')
  assert.equal(readFileSync(join(root, 'b.md'), 'utf8'), 'b2\n')
})

test('restore creates a pre-restore checkpoint first', async (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  const { id } = save(root, { label: 'base', quiet: true })
  write(root, 'tracked.md', 'about to be reverted\n')
  const result = await restore(root, id, { yes: true, quiet: true })
  assert.ok(result.preRestoreId)
  const pre = run(root, ['show', `refs/checkpoints/${result.preRestoreId}:tracked.md`])
  assert.equal(pre, 'about to be reverted')
})

test('restore refuses during an in-progress merge', async (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  const { id } = save(root, { label: 'base', quiet: true })
  write(root, '.git/MERGE_HEAD', 'deadbeef\n')
  await assert.rejects(() => restore(root, id, { yes: true, quiet: true }), /MERGE_HEAD/)
})

test('restore without --yes aborts on non-TTY and changes nothing', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  const { id } = save(root, { label: 'base', quiet: true })
  write(root, 'tracked.md', 'unconfirmed edit\n')
  const cli = fileURLToPath(new URL('./checkpoint.mjs', import.meta.url))
  assert.throws(() => execFileSync('node', [cli, 'restore', id], { cwd: root, encoding: 'utf8' }))
  assert.equal(readFileSync(join(root, 'tracked.md'), 'utf8'), 'unconfirmed edit\n')
})

test('restore is a no-op when tree already matches', async (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  const { id } = save(root, { label: 'base', quiet: true })
  const result = await restore(root, id, { yes: true, quiet: true })
  assert.equal(result.restored, 0)
})
```

Note for the MERGE_HEAD test: writing to the literal `.git/MERGE_HEAD` is correct for a top-level fixture repo. Do not compute the git dir via `rev-parse --absolute-git-dir` and slice against the fixture root: on macOS the tmpdir is a symlink (`/var` vs `/private/var`) and the slice produces a garbage path.

- [ ] **Step 3.2: Run tests to verify the new ones fail**

Run: `node --test scripts/checkpoint.test.mjs`
Expected: new tests FAIL (`restore` not exported); prior 7 PASS. (The non-TTY test needs the CLI entry from Task 4; it is acceptable for it to keep failing until Step 4.3. If so, note it and continue.)

- [ ] **Step 3.3: Implement restore**

Add to `scripts/checkpoint.mjs`:

```js
export function assertNoOperationInProgress(root) {
  const gitDir = git(['rev-parse', '--absolute-git-dir'], { cwd: root })
  for (const marker of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'BISECT_LOG', 'rebase-merge', 'rebase-apply']) {
    if (existsSync(join(gitDir, marker))) {
      throw new Error(`refusing to restore: ${marker} present (finish or abort that operation first)`)
    }
  }
}

export function restorePlan(root, query, paths = []) {
  const ckpt = resolveId(root, query)
  const cur = workingTreeHash(root)
  const args = ['diff', '--no-renames', '--name-status', cur, `${ckpt.sha}^{tree}`]
  if (paths.length) args.push('--', ...paths)
  const out = git(args, { cwd: root })
  const changes = !out
    ? []
    : out.split('\n').map((line) => {
        const [status, ...rest] = line.split('\t')
        return { status: status[0], path: rest[rest.length - 1] }
      })
  return { ckpt, changes }
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function removeEmptyDirs(root, rel) {
  let dir = rel
  while (dir && dir !== '.' && dir !== '/') {
    try {
      rmdirSync(join(root, dir))
    } catch {
      return
    }
    dir = dirname(dir)
  }
}

export async function restore(root, query, { paths = [], yes = false, quiet = false } = {}) {
  assertNoOperationInProgress(root)
  const { ckpt, changes } = restorePlan(root, query, paths)
  if (changes.length === 0) {
    if (!quiet) console.log('working tree already matches the checkpoint')
    return { restored: 0 }
  }
  if (!quiet) {
    const counts = { M: 0, A: 0, D: 0 }
    for (const c of changes) counts[c.status] = (counts[c.status] || 0) + 1
    console.log(`restore from ${ckpt.id} (${ckpt.trigger}, branch ${ckpt.branch}):`)
    console.log(`  ${counts.M || 0} overwritten, ${counts.A || 0} recreated, ${counts.D || 0} deleted`)
    for (const c of changes.slice(0, 20)) console.log(`  ${c.status} ${c.path}`)
    if (changes.length > 20) console.log(`  ... and ${changes.length - 20} more`)
  }
  if (!yes) {
    if (!process.stdin.isTTY) {
      throw new Error('refusing to restore without confirmation, re-run with --yes')
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const answer = (await rl.question(`Restore ${changes.length} file(s)? [y/N] `)).trim().toLowerCase()
    rl.close()
    if (answer !== 'y' && answer !== 'yes') {
      console.log('aborted')
      return { restored: 0, aborted: true }
    }
  }
  const pre = save(root, { label: 'pre-restore', trigger: 'pre-restore', quiet: true })
  const writeBack = changes.filter((c) => c.status !== 'D').map((c) => c.path)
  const remove = changes.filter((c) => c.status === 'D').map((c) => c.path)
  for (const batch of chunk(writeBack, 200)) {
    git(['restore', '--worktree', `--source=${ckpt.sha}`, '--', ...batch], { cwd: root })
  }
  for (const p of remove) {
    rmSync(join(root, p), { force: true })
    removeEmptyDirs(root, dirname(p))
  }
  if (!quiet) {
    console.log(`restored ${changes.length} file(s) from ${ckpt.id}`)
    console.log(`undo with: node scripts/checkpoint.mjs restore ${pre.id}`)
  }
  return { restored: changes.length, preRestoreId: pre.id }
}
```

Semantics note: `--name-status` of `cur -> ckpt` means `A` = present in the checkpoint but not now (recreate), `D` = present now but not in the checkpoint (delete), `M` = differs (overwrite). Ignored files never appear on either side because both trees are built with the same `.gitignore`-respecting snapshot.

- [ ] **Step 3.4: Run tests, expect all but possibly the non-TTY test to pass**

Run: `node --test scripts/checkpoint.test.mjs`

- [ ] **Step 3.5: Commit**

```bash
git add scripts/checkpoint.mjs scripts/checkpoint.test.mjs
git commit -m "feat(safety): checkpoint restore with rails (pre-restore snapshot, guards, confirmation)"
```

---

### Task 4: Prune tests + CLI entry

**Files:**
- Modify: `scripts/checkpoint.mjs`
- Modify: `scripts/checkpoint.test.mjs`

- [ ] **Step 4.1: Write failing tests**

Append (add `prune` to the import):

```js
test('prune keeps the newest N and honors the 5-newest floor', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  for (let i = 0; i < 8; i++) {
    write(root, 'tracked.md', `v${i}\n`)
    save(root, { label: `cp${i}`, quiet: true })
  }
  // Nothing old enough: prune deletes nothing even with keep=0
  assert.equal(prune(root, { keep: 0, days: 30, quiet: true }), 0)
  // days=0 makes everything "old"; floor of 5 newest still survives
  assert.equal(prune(root, { keep: 0, days: 0, quiet: true }), 3)
  assert.equal(listCheckpoints(root).length, 5)
})

test('CLI usage error exits non-zero', () => {
  const cli = fileURLToPath(new URL('./checkpoint.mjs', import.meta.url))
  assert.throws(() => execFileSync('node', [cli, 'bogus-command'], { encoding: 'utf8' }))
})
```

Timing note: `days: 0` means the cutoff is "now", so all checkpoints qualify by age. No sleeping or clock mocking needed.

- [ ] **Step 4.2: Run tests to verify the new ones fail**

Run: `node --test scripts/checkpoint.test.mjs`
Expected: CLI test FAILS (no entry point yet, command exits 0 doing nothing). Prune test may already pass; that is fine.

- [ ] **Step 4.3: Implement the CLI entry**

Append to `scripts/checkpoint.mjs`:

```js
const USAGE = `usage: node scripts/checkpoint.mjs <command>

  save [label] [--auto <trigger>] [--quiet]   snapshot the working tree
  list                                        show checkpoints, newest first
  diff <id> [--full] [-- <path>...]           compare checkpoint to current files
  restore <id> [--yes] [-- <path>...]         make files match the checkpoint
  prune [--keep <n>] [--days <d>]             delete old checkpoints (floor: 5 newest)

<id> accepts the full id from list or any unique substring of it.
Via npm, flags only reach the script after a double dash: npm run checkpoint -- restore <id> --yes`

function ago(date) {
  const mins = Math.round((Date.now() - date.getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`
  return `${Math.round(mins / 1440)}d ago`
}

function splitPathArgs(argv) {
  const sep = argv.indexOf('--')
  return sep === -1 ? { args: argv, paths: [] } : { args: argv.slice(0, sep), paths: argv.slice(sep + 1) }
}

function flagValue(args, flag) {
  const i = args.indexOf(flag)
  return i === -1 ? null : args[i + 1]
}

async function main(argv) {
  const { args, paths } = splitPathArgs(argv)
  const [command, ...rest] = args
  const quiet = args.includes('--quiet')
  const root = repoRoot()
  if (command === 'save') {
    const label = rest.find((a) => !a.startsWith('--') && a !== flagValue(args, '--auto'))
    save(root, { label, trigger: flagValue(args, '--auto') || 'manual', quiet })
  } else if (command === 'list') {
    const list = listCheckpoints(root)
    if (list.length === 0) return console.log('no checkpoints yet (npm run checkpoint save)')
    const cur = workingTreeHash(root)
    for (const c of list) {
      const stat = git(['diff', '--shortstat', `${c.sha}^{tree}`, cur], { cwd: root })
      const drift = stat ? stat.trim() : 'matches current state'
      console.log(`${c.id}  ${ago(c.date)}  [${c.trigger}]  branch ${c.branch}  ${drift}`)
    }
  } else if (command === 'diff') {
    console.log(diffCheckpoint(root, rest.filter((a) => !a.startsWith('--'))[0], { full: args.includes('--full'), paths }))
  } else if (command === 'restore') {
    await restore(root, rest.filter((a) => !a.startsWith('--'))[0], { yes: args.includes('--yes'), quiet, paths })
  } else if (command === 'prune') {
    const n = prune(root, {
      keep: flagValue(args, '--keep') ? Number(flagValue(args, '--keep')) : undefined,
      days: flagValue(args, '--days') ? Number(flagValue(args, '--days')) : undefined,
      quiet,
    })
    if (!quiet && n === 0) console.log('nothing to prune')
  } else {
    console.error(USAGE)
    process.exit(command ? 1 : 0)
  }
}

// CLI entry (pathToFileURL handles spaces in the repo path)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
}
```

- [ ] **Step 4.4: Run the full checkpoint suite**

Run: `node --test scripts/checkpoint.test.mjs`
Expected: all 15 tests PASS (including the deferred non-TTY test from Task 3).

- [ ] **Step 4.5: Commit**

```bash
git add scripts/checkpoint.mjs scripts/checkpoint.test.mjs
git commit -m "feat(safety): checkpoint prune and CLI entry"
```

---

### Task 5: Wire checkpoint into the repo

**Files:**
- Modify: `package.json` (scripts block)
- Create: `.claude/settings.json`
- Create: `.claude/skills/checkpoint/SKILL.md`

- [ ] **Step 5.1: Add npm scripts**

In `package.json` scripts, after `"test:images"`:

```json
"checkpoint": "node scripts/checkpoint.mjs",
"test:safety": "node --test scripts/checkpoint.test.mjs scripts/release-check.test.mjs"
```

(`test:safety` will fail until Task 6 creates the second file; that is expected and gets verified in Task 6.)

- [ ] **Step 5.2: Create the SessionStart hook**

`.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node scripts/checkpoint.mjs save session-start --auto session-start --quiet || true",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 5.3: Create the checkpoint skill**

`.claude/skills/checkpoint/SKILL.md`:

```markdown
---
name: checkpoint
description: Save or restore file-level checkpoints of this repo. Use before any risky operation (mass content rewrites, merges, running unfamiliar scripts) and to revert bad changes without touching git history.
---

# Checkpoints

Snapshots of the entire working tree (tracked and untracked files, `.gitignore` respected) stored as hidden local git refs. They never appear in `git status` or `git log`, are never pushed, and restoring never moves HEAD or any branch: it only makes files match the snapshot.

## Commands

| Command | Effect |
| --- | --- |
| `npm run checkpoint save [label]` | Snapshot now (no-op if nothing changed) |
| `npm run checkpoint list` | Show checkpoints, newest first, with drift vs current files |
| `node scripts/checkpoint.mjs diff <id>` | What changed since the checkpoint (`--full` for the patch) |
| `node scripts/checkpoint.mjs restore <id> --yes` | Make all files match the snapshot |
| `node scripts/checkpoint.mjs restore <id> --yes -- <path>` | Restore only the named paths |

`<id>` is any unique substring of an id from `list`. For `diff` and `restore`, invoke the script with `node` directly as shown: plain `npm run checkpoint restore <id> --yes` does NOT work because npm swallows `--yes` and the first `--`, which can silently turn a partial restore into a full one. (`npm run checkpoint -- restore <id> --yes -- <path>` also works.)

## Rules for agents

1. Save a checkpoint (with a descriptive label) before: mass rewrites of posts, merges, dependency upgrades, or running any script that edits many files.
2. A full restore deletes files created after the snapshot. Restore always saves a `pre-restore` checkpoint first, so a mistaken restore is itself undoable: `node scripts/checkpoint.mjs restore <pre-restore-id> --yes`.
3. Restores are refused mid-merge/rebase. Finish or abort that operation first.
4. Auto-checkpoints happen at session start (hook) and at the start of every release check. Do not rely on them for labeled save points.
```

- [ ] **Step 5.4: Manual verification in the real worktree**

```bash
npm run checkpoint save wiring-test
npm run checkpoint list
time npm run checkpoint save wiring-test-2   # expect dedup no-op, well under 2s
node scripts/checkpoint.mjs bogus; echo "exit=$?"   # expect usage + exit=1
```

Expected: first save creates an id, second reports "no changes", timing under 2 seconds, usage error exits 1.

- [ ] **Step 5.5: Commit**

```bash
git add package.json .claude/settings.json .claude/skills/checkpoint/SKILL.md
git commit -m "feat(safety): checkpoint npm script, session-start hook, agent skill"
```

---

### Task 6: Release-check scaffold (runner + checks 1 and 2)

**Files:**
- Create: `scripts/release-check.mjs`
- Create: `scripts/release-check.test.mjs`

- [ ] **Step 6.1: Write failing tests**

`scripts/release-check.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { makeFixtureRepo, makeFixtureDist, cleanup, run, write } from './test-helpers.mjs'
import { findForbiddenPaths } from './release-check.mjs'

test('findForbiddenPaths flags tracked or staged forbidden files', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  assert.deepEqual(findForbiddenPaths(root), [])
  write(root, '.env.local', 'R2_SECRET=whatever\n')
  write(root, 'image-staging/x.jpg', 'binary-ish\n')
  run(root, ['add', '-f', '.env.local', 'image-staging/x.jpg'])
  const hits = findForbiddenPaths(root)
  assert.ok(hits.includes('.env.local'))
  assert.ok(hits.includes('image-staging/x.jpg'))
})

test('findForbiddenPaths allows .env.example', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  write(root, '.env.example', 'R2_SECRET=\n')
  run(root, ['add', '.env.example'])
  assert.deepEqual(findForbiddenPaths(root), [])
})
```

- [ ] **Step 6.2: Run to verify failure**

Run: `node --test scripts/release-check.test.mjs`
Expected: FAIL (module not found).

- [ ] **Step 6.3: Implement the scaffold**

`scripts/release-check.mjs`:

```js
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
```

- [ ] **Step 6.4: Run tests to verify they pass**

Run: `node --test scripts/release-check.test.mjs`
Expected: 2 tests PASS. Also run `npm run test:safety`, expected: both suites pass now.

- [ ] **Step 6.5: Commit**

```bash
git add scripts/release-check.mjs scripts/release-check.test.mjs
git commit -m "feat(safety): release-check runner with checkpoint and hygiene checks"
```

---

### Task 7: Secret scan (check 3)

**Files:**
- Modify: `scripts/release-check.mjs`
- Modify: `scripts/release-check.test.mjs`
- Create: `scripts/release-check-allowlist.json`

- [ ] **Step 7.1: Create the allowlist file**

`scripts/release-check-allowlist.json`:

```json
{
  "comment": "Secret-scan false-positive allowlist. Each entry is a regex tested against 'file:matchedText'. Patterns only, never paste an actual matched secret in here (this repo is public).",
  "allow": []
}
```

- [ ] **Step 7.2: Write failing tests**

Append to `scripts/release-check.test.mjs` (extend the release-check import with `scanTextForSecrets, collectSecretScanSources, shannonEntropy`):

```js
test('scanTextForSecrets catches known credential shapes', () => {
  const text = [
    'aws AKIAIOSFODNN7EXAMPLE key',
    'gh ghp_0123456789abcdefghijABCDEFGHIJ456789',
    '-----BEGIN OPENSSH PRIVATE KEY-----',
    'export R2_SECRET_ACCESS_KEY="abcdef0123456789abcdef0123456789"',
  ].join('\n')
  const findings = scanTextForSecrets(text, 'notes.md', [])
  const names = findings.map((f) => f.pattern)
  assert.ok(names.includes('aws-access-key'))
  assert.ok(names.includes('github-token'))
  assert.ok(names.includes('private-key'))
  assert.ok(names.includes('credential-assignment'))
  for (const f of findings) assert.ok(!f.redacted.includes('EXAMPLE'), 'matches must be redacted')
})

test('allowlist suppresses findings by file:match regex', () => {
  const text = 'aws AKIAIOSFODNN7EXAMPLE key'
  assert.equal(scanTextForSecrets(text, 'notes.md', [/notes\.md:AKIAIOSFODNN7EXAMPLE/]).length, 0)
  assert.equal(scanTextForSecrets(text, 'notes.md', [/other\.md:/]).length, 1)
})

test('entropy check flags random base64 but not hex hashes or prose', () => {
  assert.ok(shannonEntropy('kJ8v2LqPzX4nR7wYtB3mF6hD9sG1cV5aQ0eU') > 4.5)
  assert.ok(shannonEntropy('5e3b1f4a9c2d8e7f6a5b4c3d2e1f0a9b8c7d6e5f') < 4.5)
  const hexLine = 'commit 5e3b1f4a9c2d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f'
  assert.equal(scanTextForSecrets(hexLine, 'log.md', []).filter((f) => f.pattern === 'high-entropy').length, 0)
})

test('collectSecretScanSources includes untracked files, skips binaries and lockfiles', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  write(root, 'draft.md', 'ghp_0123456789abcdefghijABCDEFGHIJ456789\n')
  write(root, 'package-lock.json', '{"integrity": "sha512-abc"}\n')
  write(root, 'photo.webp', 'fake binary\n')
  const sources = collectSecretScanSources(root)
  const files = sources.map((s) => s.file)
  assert.ok(files.includes('draft.md'))
  assert.ok(!files.includes('package-lock.json'))
  assert.ok(!files.includes('photo.webp'))
})
```

- [ ] **Step 7.3: Run to verify failure, then implement**

Add to `scripts/release-check.mjs`:

```js
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
  const diff = git(['diff', '--no-renames', '--unified=0', base], { cwd: root, allowFail: true }) || ''
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
  const untracked = git(['ls-files', '--others', '--exclude-standard'], { cwd: root }) || ''
  for (const f of untracked.split('\n').filter(Boolean)) {
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
```

Register in `CHECKS`: `{ num: 3, name: 'secret scan', run: checkSecrets },`

- [ ] **Step 7.4: Run tests to verify they pass, then commit**

Run: `npm run test:safety`

```bash
git add scripts/release-check.mjs scripts/release-check.test.mjs scripts/release-check-allowlist.json
git commit -m "feat(safety): secret scan with allowlist (check 3)"
```

---

### Task 8: Delegated checks 4 to 7

**Files:**
- Modify: `scripts/release-check.mjs`

These are thin wrappers over existing npm scripts; no unit tests (their tooling already has them). Integration is verified in Task 12.

- [ ] **Step 8.1: Implement**

Add to `scripts/release-check.mjs`:

```js
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
```

Register in `CHECKS` (after check 3):

```js
  { num: 4, name: 'types (astro check)', run: (root) => npmRun(root, 'check') },
  { num: 5, name: 'lint', run: checkLint },
  { num: 6, name: 'build', run: (root) => npmRun(root, 'build') },
  { num: 7, name: 'image tests', run: (root) => npmRun(root, 'test:images') },
```

- [ ] **Step 8.2: Sanity-run one wrapper and commit**

Run: `node -e "import('./scripts/release-check.mjs').then(async (m) => console.log(await m.CHECKS.find((c) => c.num === 4).run(process.cwd())))"`
Expected: `{ status: 'PASS', ... }` (astro check passes on this branch).

```bash
git add scripts/release-check.mjs
git commit -m "feat(safety): delegate type, lint, build, image checks (checks 4-7)"
```

---

### Task 9: Built-output checks (check 8)

**Files:**
- Modify: `scripts/release-check.mjs`
- Modify: `scripts/release-check.test.mjs`

- [ ] **Step 9.1: Write failing tests**

Append (extend import with `checkDistDir`):

```js
test('checkDistDir passes a clean fixture dist', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  const dist = makeFixtureDist(root)
  assert.deepEqual(checkDistDir(dist, { minPages: 1 }).failures, [])
})

test('checkDistDir fails on stale /uploads/ references', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  const dist = makeFixtureDist(root, {
    extraHtml: { 'posts/bad/index.html': '<img src="/uploads/2020/02/old.jpg">' },
  })
  const { failures } = checkDistDir(dist, { minPages: 1 })
  assert.ok(failures.some((f) => f.includes('/uploads/')))
})

test('checkDistDir fails on localhost URLs in attributes', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  const dist = makeFixtureDist(root, {
    extraHtml: { 'posts/bad/index.html': '<a href="http://localhost:4321/x">dev</a>' },
  })
  const { failures } = checkDistDir(dist, { minPages: 1 })
  assert.ok(failures.some((f) => f.includes('localhost')))
})

test('checkDistDir fails on missing rss, sitemap, or pagefind', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  const dist = makeFixtureDist(root, { omit: ['rss.xml', 'pagefind/pagefind.js'] })
  const { failures } = checkDistDir(dist, { minPages: 1 })
  assert.ok(failures.some((f) => f.includes('rss.xml')))
  assert.ok(failures.some((f) => f.includes('pagefind')))
})

test('checkDistDir enforces the minimum page count', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  const dist = makeFixtureDist(root)
  const { failures } = checkDistDir(dist, { minPages: 300 })
  assert.ok(failures.some((f) => f.includes('expected at least 300')))
})
```

- [ ] **Step 9.2: Run to verify failure, then implement**

Add to `scripts/release-check.mjs`:

```js
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
```

Register: `{ num: 8, name: 'built output', run: checkBuiltOutput },`

- [ ] **Step 9.3: Run tests and commit**

Run: `npm run test:safety`

```bash
git add scripts/release-check.mjs scripts/release-check.test.mjs
git commit -m "feat(safety): built-output verification (check 8)"
```

---

### Task 10: Full mode (checks 9 and 10)

**Files:**
- Modify: `scripts/release-check.mjs`
- Modify: `scripts/release-check.test.mjs`

- [ ] **Step 10.1: Write failing tests**

Append (extend import with `extractCdnUrls, verifyUrls, extractInternalRefs, resolveInternalRef`; add `import { createServer } from 'node:http'` at top):

```js
test('extractCdnUrls finds unique CDN URLs across markup', () => {
  const html = `
    <img src="https://cdn.anping.us/2020/02/a.webp">
    <img src="https://cdn.anping.us/2020/02/a.webp">
    <a href="https://cdn.anping.us/2023/03/b.webp?ssl=1">x</a>
    <a href="https://example.com/c.webp">not ours</a>`
  const urls = extractCdnUrls(html)
  assert.deepEqual(urls.sort(), [
    'https://cdn.anping.us/2020/02/a.webp',
    'https://cdn.anping.us/2023/03/b.webp?ssl=1',
  ])
})

test('verifyUrls reports non-200s and passes 200s', async (t) => {
  const server = createServer((req, res) => {
    res.statusCode = req.url === '/ok.webp' ? 200 : 404
    res.end()
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  t.after(() => server.close())
  const base = `http://127.0.0.1:${server.address().port}`
  const failures = await verifyUrls([`${base}/ok.webp`, `${base}/missing.webp`], { retries: 0 })
  assert.equal(failures.length, 1)
  assert.match(failures[0].url, /missing\.webp/)
  assert.match(failures[0].error, /404/)
})

test('extractInternalRefs keeps root-relative refs, drops externals and fragments', () => {
  const html = `
    <a href="/posts/a/">a</a>
    <a href="/about#top">about</a>
    <a href="https://example.com/x">ext</a>
    <a href="//cdn.example.com/y">protocol-relative</a>
    <a href="#local">frag</a>
    <img src="/pagefind/pagefind.js">`
  assert.deepEqual(extractInternalRefs(html).sort(), ['/about', '/pagefind/pagefind.js', '/posts/a/'])
})

test('resolveInternalRef maps directory URLs to index.html and blocks traversal', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  const dist = makeFixtureDist(root)
  assert.equal(resolveInternalRef('/', dist), true)
  assert.equal(resolveInternalRef('/posts/a/', dist), true)
  assert.equal(resolveInternalRef('/posts/a', dist), true)
  assert.equal(resolveInternalRef('/pagefind/pagefind.js', dist), true)
  assert.equal(resolveInternalRef('/missing/', dist), false)
  assert.equal(resolveInternalRef('/../outside', dist), false)
})
```

- [ ] **Step 10.2: Run to verify failure, then implement**

Add to `scripts/release-check.mjs`:

```js
export function extractCdnUrls(text) {
  const urls = new Set()
  for (const m of text.matchAll(/https:\/\/cdn\.anping\.us\/[^\s"'<>()\\]+/g)) urls.add(m[0])
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
```

Register (note the `full: true` flag the runner already respects):

```js
  { num: 9, name: 'CDN images', full: true, run: checkCdnImages },
  { num: 10, name: 'internal links', full: true, run: checkInternalLinks },
```

- [ ] **Step 10.3: Run tests and commit**

Run: `npm run test:safety`
Expected: all tests in both suites PASS.

```bash
git add scripts/release-check.mjs scripts/release-check.test.mjs
git commit -m "feat(safety): full-mode CDN and internal link checks (checks 9-10)"
```

---

### Task 11: Wire release-check into the repo

**Files:**
- Modify: `package.json`
- Create: `.claude/skills/release-check/SKILL.md`
- Modify: `CLAUDE.md`

- [ ] **Step 11.1: Add the npm script**

In `package.json` scripts, next to `"checkpoint"`:

```json
"release-check": "node scripts/release-check.mjs",
```

- [ ] **Step 11.2: Create the release-check skill**

`.claude/skills/release-check/SKILL.md`:

```markdown
---
name: release-check
description: Run the pre-push release checklist and deliver a go/no-go verdict before anything is pushed to main (which auto-deploys to anping.us). Use whenever a push or merge to main is being considered.
---

# Release checklist

Pushing to `main` deploys to https://anping.us within minutes. This checklist is the gate: it ends in a GO or NO-GO verdict. **Never push, merge, or tag as part of this workflow.** The owner pushes; your job ends at the verdict.

## Quick mode (default)

1. Run `npm run release-check` from the repo root. It saves a checkpoint, then runs git hygiene, secret scan, types, lint, build, image tests, and built-output verification (checks 1 to 8).
2. Report the per-check results and the verdict.

## Full mode

1. Run `npm run release-check -- --full` (adds check 9: every cdn.anping.us URL in the built site must return HTTP 200, and check 10: every internal link must resolve).
2. After the script passes, smoke-test the production build in a browser. Serve `dist/` with `npm run preview` (never the dev server), then verify:
   - homepage renders with the post list
   - one image-heavy post loads and its images come from cdn.anping.us
   - search returns results (Pagefind)
   - the language toggle switches title and body
   - the giscus comment iframe is present on a post
   - dark mode renders correctly
3. Capture a screenshot as proof and include it in the report.

## Report format

A table of every check with PASS / FAIL / SKIP and a one-line detail, the screenshot in full mode, then exactly one of:

- `VERDICT: GO, safe to push` (all checks passed)
- `VERDICT: NO-GO` with the blocking items listed first

## Choosing a mode

Full mode before anything that touches many posts, images, templates, or dependencies. Quick mode is acceptable for single-post edits and typo fixes.

## If a bad deploy reaches anping.us

`git revert <bad commit>` on `main`, push (with the owner's go-ahead), and the Pages workflow redeploys the previous good state in a few minutes. Checkpoints cover pre-push file state; `git revert` covers post-push history.
```

- [ ] **Step 11.3: Add the Safety section to CLAUDE.md**

In the Commands table, add:

```markdown
| `npm run checkpoint` | Working-tree snapshots: `save` / `list` / `diff` / `restore` (see Safety) |
| `npm run release-check` | Pre-push checklist, `-- --full` adds CDN + link verification (see Safety) |
| `npm run test:safety` | Test suite for the two safety CLIs |
```

After the Architecture section, add:

```markdown
## Safety

- **Checkpoints** (`npm run checkpoint`, skill: `.claude/skills/checkpoint/`): file-level snapshots of the working tree in hidden local refs. Auto-saved at session start (hook in `.claude/settings.json`) and by every release check. Restore before push mistakes become deploy mistakes.
- **Release checklist** (`npm run release-check`, skill: `.claude/skills/release-check/`): required before any push to `main`. Ends in GO / NO-GO; pushing remains a human decision (rule 5).
- **Post-deploy rollback**: `git revert` the bad commit(s) on `main` and push; the Pages workflow redeploys the previous good state.
```

- [ ] **Step 11.4: Commit**

```bash
git add package.json .claude/skills/release-check/SKILL.md CLAUDE.md
git commit -m "feat(safety): release-check npm script, agent skill, CLAUDE.md safety section"
```

---

### Task 12: Integration verification (real runs)

No new files. This task validates against reality and fixes any constant that does not match the actual build output.

- [ ] **Step 12.1: Full unit suite**

Run: `npm run test:safety`
Expected: every test passes.

- [ ] **Step 12.2: Real quick run**

Run: `npm run release-check`
Expected: checks 1 to 8 PASS and `VERDICT: GO`. Watch for:
- check 8 filename assumptions (`rss.xml`, `sitemap-index.xml`): if the real build emits different names, fix the constants in `checkDistDir` and the fixture in `test-helpers.mjs`, re-run tests, and note it.
- secret scan false positives from docs or translation files: add a narrowly scoped regex to `scripts/release-check-allowlist.json` with a comment-worthy pattern, never a matched string.

- [ ] **Step 12.3: Real full run**

Run: `npm run release-check -- --full`
Expected: checks 9 and 10 also PASS (about 223 CDN URLs, all 200). Non-200s here mean a real problem; investigate rather than suppress.

- [ ] **Step 12.4: Hook rehearsal**

Run: `time (node scripts/checkpoint.mjs save session-start --auto session-start --quiet || true)`
Expected: exit 0, under 2 seconds. Then `npm run checkpoint list` shows the session-start entry (or dedup kept the previous one).

- [ ] **Step 12.5: Restore rehearsal in the real repo (safe)**

```bash
npm run checkpoint save rehearsal
printf 'temp line\n' >> README.md
node scripts/checkpoint.mjs restore rehearsal --yes
git diff --stat README.md   # expect: no diff, README.md restored
```

Expected: README.md back to its committed content; a `pre-restore` checkpoint exists in `list`.

- [ ] **Step 12.6: Commit any integration fixes**

```bash
git add <only the files actually adjusted>
git commit -m "fix(safety): align checks with real build output"
```

(Skip if nothing needed adjusting.)

---

### Task 13: Final review pass

- [ ] **Step 13.1: Self-review the diff**

Run: `git log --oneline main..HEAD && git diff main --stat`
Confirm: only the files in the File map (plus the spec and this plan) changed; no em-dashes in docs or messages (`git diff main -- '*.md' | grep '^+' | grep -c $'\xe2\x80\x94'` returns 0); nothing forbidden staged.

- [ ] **Step 13.2: Run everything one last time**

Run: `npm run test:safety && npm run release-check`
Expected: green across the board.

- [ ] **Step 13.3: Report**

Summarize for the owner: what was built, the checkpoint ids created during testing, how to run both tools, and that merging `safety-tooling` to `main` is their call (rule 5). Do not push.
