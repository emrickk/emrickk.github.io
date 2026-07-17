# Ship Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One-command publishing for post edits: `npm run ship` (interactive) and a `ship-posts` repo skill so "push my edits" works in any Claude Code conversation, both driving the same gate pipeline with digest-bound approvals.

**Architecture:** A single CLI, `scripts/ship.mjs`, built from small exported functions (purity check on the raw diff, change-set digest, preflight, commit-and-push) plus a main flow that chains the existing safety tooling as libraries: checkpoint `save`, preview-posts' change-set/manifest/review-page functions, release-check's `runChecks`/`verdict`. The skill is a markdown runbook that drives the CLI with `--preflight` then `--yes --digest <d>`.

**Tech Stack:** Node 22 built-ins (`node:child_process`, `node:crypto`, `node:readline/promises`, `node:util` parseArgs, `node:test`). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-16-ship-command-design.md` (read it; it is authoritative on behavior).

**Conventions for every task:**
- Rule 1/6: stage with explicit paths and commit in one command (`git add <paths> && git commit -m "..." -- <paths>`). Verify `git branch --show-current` prints `main` before each commit.
- Rule 2: no em-dashes anywhere (code, prompts, skill text, docs, commit messages).
- scripts/ style: no semicolons, single quotes, 2-space indent (match scripts/preview-posts.mjs).
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Tests run with `node --test scripts/ship.test.mjs`. Fixtures come from `scripts/test-helpers.mjs` (`makeFixtureRepo`, `run`, `write`, `cleanup`); they are throwaway tmpdir repos, never the real checkout.

## File Structure

| File | Responsibility |
| --- | --- |
| `scripts/ship.mjs` | Create. Exported helpers (digest, purity, preflight, commit-and-push) plus the CLI main flow. |
| `scripts/ship.test.mjs` | Create. `node:test` suite: unit tests for helpers, CLI-level tests for flag handling and the stale-digest abort. |
| `.claude/skills/ship-posts/SKILL.md` | Create. Agent runbook for "push my edits". |
| `.claude/skills/preview-posts/SKILL.md` | Modify. One cross-reference line (two manifest writers). |
| `package.json` | Modify. `"ship"` script; add ship.test.mjs to `test:safety`. |
| `docs/post-editor.md` | Modify. "Shipping your edits" section. |
| `CLAUDE.md` | Modify. Commands row + Safety line. |

Reused exports (verified present): `git`, `save` (scripts/checkpoint.mjs); `computeChangeSet`, `hashChangeSet`, `renderReviewPage`, `resolveBaseRef`, `reviewTargets`, `slugForPostFile`, `writeManifest` (scripts/preview-posts.mjs); `runChecks`, `verdict` (scripts/release-check.mjs). `runChecks` prints its own per-check lines, so ship only prints the verdict. Both library CLIs have main guards; importing them is side-effect free.

---

### Task 1: pure helpers: digest, commit message, purity partition

**Files:**
- Create: `scripts/ship.test.mjs`
- Create: `scripts/ship.mjs`

- [ ] **Step 1: Write the failing tests**

Create `scripts/ship.test.mjs`:

```js
// Tests for the ship CLI. Fixture repos live in tmpdirs; the real checkout
// is never touched.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { changeSetDigest, commitMessageFor, partitionPurity } from './ship.mjs'

test('changeSetDigest is stable, order-independent, and 12 hex chars', () => {
  const a = changeSetDigest({ 'src/content/posts/a.md': 'h1', 'src/content/posts/b.md': 'h2' })
  const b = changeSetDigest({ 'src/content/posts/b.md': 'h2', 'src/content/posts/a.md': 'h1' })
  assert.equal(a, b)
  assert.match(a, /^[0-9a-f]{12}$/)
})

test('changeSetDigest changes when any entry changes', () => {
  const base = changeSetDigest({ 'src/content/posts/a.md': 'h1' })
  assert.notEqual(changeSetDigest({ 'src/content/posts/a.md': 'h2' }), base)
  assert.notEqual(changeSetDigest({ 'src/content/posts/a.md': 'h1', 'src/content/posts/b.md': 'h2' }), base)
})

test('commitMessageFor dedupes primary and sibling into one slug', () => {
  assert.equal(
    commitMessageFor(['src/content/posts/alpha.md', 'src/content/posts/alpha.zh.md']),
    'post: update alpha',
  )
  assert.equal(
    commitMessageFor(['src/content/posts/alpha.md', 'src/content/posts/beta.md']),
    'post: update alpha, beta',
  )
})

test('partitionPurity splits post paths from everything else', () => {
  const { posts, other } = partitionPurity([
    'src/content/posts/a.md',
    'docs/x.md',
    'astro.config.mjs',
    'src/content/posts/a.zh.md',
  ])
  assert.deepEqual(posts, ['src/content/posts/a.md', 'src/content/posts/a.zh.md'])
  assert.deepEqual(other, ['astro.config.mjs', 'docs/x.md'])
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/ship.test.mjs`
Expected: FAIL, `Cannot find module ... ship.mjs`

- [ ] **Step 3: Write the implementation**

Create `scripts/ship.mjs`:

```js
// One-command publish for post edits: chains checkpoint, purity check,
// production preview, owner approval, release checks, commit, push, and a
// deploy watch. Two entry points share this file: the owner runs it
// interactively, and the ship-posts skill drives it with --preflight then
// --yes --digest after the owner approves in chat. Spec:
// docs/superpowers/specs/2026-07-16-ship-command-design.md
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { git, save } from './checkpoint.mjs'
import {
  computeChangeSet,
  hashChangeSet,
  renderReviewPage,
  resolveBaseRef,
  reviewTargets,
  slugForPostFile,
  writeManifest,
} from './preview-posts.mjs'
import { runChecks, verdict } from './release-check.mjs'

const POSTS_PREFIX = 'src/content/posts/'
const ACTIONS_URL = 'https://github.com/emrickk/emrickk.github.io/actions'
const USAGE =
  'usage: npm run ship -- [--preflight] [--yes --digest <d>] [--message <msg>] [--port N] [--no-open]'

export function partitionPurity(paths) {
  return {
    posts: paths.filter((p) => p.startsWith(POSTS_PREFIX)).sort(),
    other: paths.filter((p) => !p.startsWith(POSTS_PREFIX)).sort(),
  }
}

// Freshness token binding an approval to the exact reviewed content: 12 hex
// chars of a sha256 over the sorted path:hash entries, newline-joined. Not a
// security boundary.
export function changeSetDigest(files) {
  const entries = Object.keys(files)
    .sort()
    .map((p) => `${p}:${files[p]}`)
  return createHash('sha256').update(entries.join('\n')).digest('hex').slice(0, 12)
}

export function commitMessageFor(changeSet) {
  const slugs = [...new Set(changeSet.map((p) => slugForPostFile(p)))]
  return `post: update ${slugs.join(', ')}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/ship.test.mjs`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/ship.mjs scripts/ship.test.mjs
git commit -m "feat(ship): add digest, commit message, and purity helpers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- scripts/ship.mjs scripts/ship.test.mjs
```

---

### Task 2: git views: raw diff paths and origin status

**Files:**
- Modify: `scripts/ship.test.mjs`
- Modify: `scripts/ship.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `scripts/ship.test.mjs` (imports go at the top: add `originStatus, rawDiffPaths` to the ship.mjs import, plus `import { cleanup, makeFixtureRepo, run, write } from './test-helpers.mjs'`; ship.test.mjs lives in scripts/, so the helper path is `./test-helpers.mjs`):

```js
import { originStatus, rawDiffPaths } from './ship.mjs'
import { cleanup, makeFixtureRepo, run, write } from './test-helpers.mjs'

// Fixture repo with a local bare origin, pushed and fetched, so origin/main
// exists and push works.
function makeFixtureWithOrigin() {
  const root = makeFixtureRepo()
  const bare = mkdtempSync(join(tmpdir(), 'ship-origin-'))
  run(bare, ['init', '-q', '--bare', '-b', 'main', '.'])
  run(root, ['remote', 'add', 'origin', bare])
  run(root, ['push', '-q', 'origin', 'main'])
  run(root, ['fetch', '-q', 'origin'])
  return { root, bare }
}

function cleanupWithOrigin({ root, bare }) {
  cleanup(root)
  rmSync(bare, { recursive: true, force: true })
}

test('rawDiffPaths sees worktree, untracked, and committed-then-reverted changes', () => {
  const fx = makeFixtureWithOrigin()
  try {
    const { root } = fx
    write(root, 'src/content/posts/new.md', 'untracked post\n')
    write(root, 'tracked.md', 'worktree edit\n')
    const originalDocs = 'v1\n'
    write(root, 'docs/x.md', originalDocs)
    run(root, ['add', 'docs/x.md'])
    run(root, ['commit', '-q', '-m', 'docs v1'])
    run(root, ['push', '-q', 'origin', 'main'])
    run(root, ['fetch', '-q', 'origin'])
    write(root, 'docs/x.md', 'v2\n')
    run(root, ['add', 'docs/x.md'])
    run(root, ['commit', '-q', '-m', 'docs v2'])
    write(root, 'docs/x.md', originalDocs)
    const paths = rawDiffPaths(root, 'origin/main')
    assert.ok(paths.includes('src/content/posts/new.md'), 'untracked file seen')
    assert.ok(paths.includes('tracked.md'), 'worktree edit seen')
    assert.ok(paths.includes('docs/x.md'), 'committed-then-reverted change seen')
  } finally {
    cleanupWithOrigin(fx)
  }
})

test('originStatus reports missing origin and remote-ahead counts', () => {
  const noOrigin = makeFixtureRepo()
  try {
    assert.equal(originStatus(noOrigin).hasOrigin, false)
  } finally {
    cleanup(noOrigin)
  }
  const fx = makeFixtureWithOrigin()
  try {
    const { root } = fx
    assert.deepEqual(originStatus(root), { hasOrigin: true, ahead: 0 })
    write(root, 'tracked.md', 'about to be remote-only\n')
    run(root, ['add', 'tracked.md'])
    run(root, ['commit', '-q', '-m', 'remote-only commit'])
    run(root, ['push', '-q', 'origin', 'main'])
    run(root, ['reset', '-q', '--hard', 'HEAD~1'])
    run(root, ['fetch', '-q', 'origin'])
    assert.deepEqual(originStatus(root), { hasOrigin: true, ahead: 1 })
  } finally {
    cleanupWithOrigin(fx)
  }
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/ship.test.mjs`
Expected: FAIL, `rawDiffPaths` / `originStatus` not exported

- [ ] **Step 3: Write the implementation**

Append to `scripts/ship.mjs`:

```js
// Everything a push would carry, unfiltered: worktree diff vs the base ref,
// untracked files, and the committed-only view (which catches a commit whose
// working-tree content was reverted without resetting the commit; the diff
// shows nothing for it, the push still carries it).
export function rawDiffPaths(root, baseRef) {
  const list = (args) => (git(args, { cwd: root }) || '').split('\0').filter(Boolean)
  return [
    ...new Set([
      ...list(['diff', '--no-renames', '--name-only', '-z', baseRef]),
      ...list(['ls-files', '--others', '--exclude-standard', '-z']),
      ...list(['diff', '--no-renames', '--name-only', '-z', `${baseRef}...HEAD`]),
    ]),
  ].sort()
}

// ahead counts commits that exist only on origin/main.
export function originStatus(root) {
  const hasOrigin = Boolean(
    git(['rev-parse', '--verify', '-q', 'origin/main'], { cwd: root, allowFail: true }),
  )
  if (!hasOrigin) return { hasOrigin, ahead: 0 }
  const counts = git(['rev-list', '--left-right', '--count', 'origin/main...main'], { cwd: root })
  return { hasOrigin, ahead: Number(counts.split(/\s+/)[0] || '0') }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/ship.test.mjs`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(ship): add raw diff and origin status views

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- scripts/ship.mjs scripts/ship.test.mjs
```

---

### Task 3: preflight

**Files:**
- Modify: `scripts/ship.test.mjs`
- Modify: `scripts/ship.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `scripts/ship.test.mjs` (add `preflight` to the ship.mjs import). The post file content matters: `computeChangeSet` drops draft posts, so the fixture post must not be a draft.

```js
const POST_BODY = "---\ntitle: 'New post'\npubDate: '2026-07-16'\n---\n\nbody\n"

test('preflight aborts off main and when origin is ahead', () => {
  const fx = makeFixtureWithOrigin()
  try {
    const { root } = fx
    run(root, ['checkout', '-q', '-b', 'topic'])
    const offMain = preflight(root, { fetch: false })
    assert.equal(offMain.status, 'abort')
    assert.match(offMain.detail, /branch topic/)
    run(root, ['checkout', '-q', 'main'])
    write(root, 'tracked.md', 'remote-only\n')
    run(root, ['add', 'tracked.md'])
    run(root, ['commit', '-q', '-m', 'remote-only'])
    run(root, ['push', '-q', 'origin', 'main'])
    run(root, ['reset', '-q', '--hard', 'HEAD~1'])
    const behind = preflight(root)
    assert.equal(behind.status, 'abort')
    assert.match(behind.detail, /origin\/main has 1 commit/)
  } finally {
    cleanupWithOrigin(fx)
  }
})

test('preflight aborts on non-post changes, listing them', () => {
  const fx = makeFixtureWithOrigin()
  try {
    const { root } = fx
    write(root, 'src/content/posts/new.md', POST_BODY)
    write(root, 'docs/notes.md', 'not a post\n')
    const res = preflight(root)
    assert.equal(res.status, 'abort')
    assert.match(res.detail, /docs\/notes\.md/)
    assert.doesNotMatch(res.detail, /new\.md/)
  } finally {
    cleanupWithOrigin(fx)
  }
})

test('preflight returns empty on a clean tree and ok with digest on post changes', () => {
  const fx = makeFixtureWithOrigin()
  try {
    const { root } = fx
    assert.equal(preflight(root).status, 'empty')
    write(root, 'src/content/posts/new.md', POST_BODY)
    const res = preflight(root)
    assert.equal(res.status, 'ok')
    assert.deepEqual(res.changeSet, ['src/content/posts/new.md'])
    assert.match(res.digest, /^[0-9a-f]{12}$/)
  } finally {
    cleanupWithOrigin(fx)
  }
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/ship.test.mjs`
Expected: FAIL, `preflight` not exported

- [ ] **Step 3: Write the implementation**

Append to `scripts/ship.mjs`:

```js
// Spec step 1. Returns a plain result so every branch is testable:
// status 'abort' (exit 1), 'empty' (exit 0), or 'ok' with changeSet and
// digest. Fetch failures warn and fall back to the last-known origin/main.
export function preflight(root, { fetch = true } = {}) {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root })
  if (branch !== 'main') {
    return { status: 'abort', detail: `on branch ${branch}; ship only runs on main` }
  }
  if (fetch && originStatus(root).hasOrigin) {
    try {
      git(['fetch', 'origin'], { cwd: root })
    } catch {
      console.error('warning: could not fetch origin; comparing against the last-known origin/main')
    }
  }
  const { hasOrigin, ahead } = originStatus(root)
  if (hasOrigin && ahead > 0) {
    return {
      status: 'abort',
      detail:
        `origin/main has ${ahead} commit(s) not in local main; ` +
        'reconcile in a Claude session (or git pull --rebase when comfortable) before shipping',
    }
  }
  const baseRef = resolveBaseRef(root)
  const { other } = partitionPurity(rawDiffPaths(root, baseRef))
  if (other.length > 0) {
    return {
      status: 'abort',
      detail:
        'ship only publishes post edits, but these changed too:\n  ' +
        other.join('\n  ') +
        '\nhandle this in a Claude session instead',
    }
  }
  const changeSet = computeChangeSet(root, { baseRef })
  if (changeSet.length === 0) {
    return { status: 'empty', detail: 'nothing to ship', baseRef }
  }
  return { status: 'ok', baseRef, changeSet, digest: changeSetDigest(hashChangeSet(root, changeSet)) }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/ship.test.mjs`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(ship): add preflight with purity and origin checks

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- scripts/ship.mjs scripts/ship.test.mjs
```

---

### Task 4: commit and push

**Files:**
- Modify: `scripts/ship.test.mjs`
- Modify: `scripts/ship.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `scripts/ship.test.mjs` (add `commitAndPush` to the ship.mjs import):

```js
test('commitAndPush commits exactly the given paths and pushes to origin', () => {
  const fx = makeFixtureWithOrigin()
  try {
    const { root, bare } = fx
    write(root, 'src/content/posts/new.md', POST_BODY)
    write(root, 'src/content/posts/other.md', POST_BODY)
    const sha = commitAndPush(root, ['src/content/posts/new.md'], {
      message: 'post: update new',
      trailer: false,
    })
    assert.equal(run(bare, ['rev-parse', 'main']), sha)
    const committed = run(root, ['show', '--name-only', '--format=', 'HEAD']).split('\n').filter(Boolean)
    assert.deepEqual(committed, ['src/content/posts/new.md'])
    const status = run(root, ['status', '--porcelain'])
    assert.match(status, /other\.md/)
    assert.doesNotMatch(run(root, ['log', '-1', '--format=%B']), /Co-Authored-By/)
  } finally {
    cleanupWithOrigin(fx)
  }
})

test('commitAndPush adds the agent trailer when asked', () => {
  const fx = makeFixtureWithOrigin()
  try {
    const { root } = fx
    write(root, 'src/content/posts/new.md', POST_BODY)
    commitAndPush(root, ['src/content/posts/new.md'], { message: 'post: update new', trailer: true })
    assert.match(run(root, ['log', '-1', '--format=%B']), /Co-Authored-By: Claude Fable 5/)
  } finally {
    cleanupWithOrigin(fx)
  }
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/ship.test.mjs`
Expected: FAIL, `commitAndPush` not exported

- [ ] **Step 3: Write the implementation**

Append to `scripts/ship.mjs`:

```js
// The only git mutations in ship: one explicit-path commit and one push.
// The trailer marks agent-driven runs (CLAUDECODE is set in Claude Code's
// shell); owner-run ships produce a plain authored commit.
export function commitAndPush(
  root,
  changeSet,
  { message, trailer = Boolean(process.env.CLAUDECODE), push = true } = {},
) {
  const body = trailer
    ? `${message}\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
    : message
  git(['add', '--', ...changeSet], { cwd: root })
  git(['commit', '-q', '-m', body, '--', ...changeSet], { cwd: root })
  const sha = git(['rev-parse', 'HEAD'], { cwd: root })
  if (push) git(['push', '-q', 'origin', 'main'], { cwd: root })
  return sha
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/ship.test.mjs`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(ship): add explicit-path commit and push

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- scripts/ship.mjs scripts/ship.test.mjs
```

---

### Task 5: CLI main flow, deploy watch, npm scripts

**Files:**
- Modify: `scripts/ship.mjs`
- Modify: `scripts/ship.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing CLI-level tests**

Append to `scripts/ship.test.mjs`. These run the CLI as a child process against fixtures; they exercise flag handling, the preflight exit, and the stale-digest abort (which must happen before the approval manifest is written). Add to the top imports: `import { execFileSync } from 'node:child_process'` and `import { fileURLToPath } from 'node:url'`.

Deliberate omission: the `--message` override is not CLI-tested because exercising it end to end requires a real push; the message parameter itself is covered by the Task 4 `commitAndPush` tests, and the flag is a one-expression fallback in `main`.

```js
const SHIP = fileURLToPath(new URL('./ship.mjs', import.meta.url))

function runShip(root, args) {
  try {
    const stdout = execFileSync('node', [SHIP, ...args], { cwd: root, encoding: 'utf8' })
    return { code: 0, stdout, stderr: '' }
  } catch (err) {
    return { code: err.status, stdout: String(err.stdout || ''), stderr: String(err.stderr || '') }
  }
}

test('cli: --yes without --digest is a usage error', () => {
  const fx = makeFixtureWithOrigin()
  try {
    const res = runShip(fx.root, ['--yes'])
    assert.equal(res.code, 1)
    assert.match(res.stderr, /--yes requires --digest/)
  } finally {
    cleanupWithOrigin(fx)
  }
})

test('cli: --preflight prints the change set and digest, writes no manifest', () => {
  const fx = makeFixtureWithOrigin()
  try {
    const { root } = fx
    write(root, 'src/content/posts/new.md', POST_BODY)
    const res = runShip(root, ['--preflight'])
    assert.equal(res.code, 0)
    assert.match(res.stdout, /src\/content\/posts\/new\.md/)
    assert.match(res.stdout, /changeset digest: [0-9a-f]{12}/)
    assert.equal(existsSync(join(root, '.preview', 'manifest.json')), false)
  } finally {
    cleanupWithOrigin(fx)
  }
})

test('cli: --yes with a stale digest aborts before writing the manifest', () => {
  const fx = makeFixtureWithOrigin()
  try {
    const { root } = fx
    write(root, 'src/content/posts/new.md', POST_BODY)
    const res = runShip(root, ['--yes', '--digest', '000000000000'])
    assert.equal(res.code, 1)
    assert.match(res.stderr, /tree changed since the review/)
    assert.equal(existsSync(join(root, '.preview', 'manifest.json')), false)
  } finally {
    cleanupWithOrigin(fx)
  }
})

test('cli: --preflight aborts with exit 1 on mixed changes', () => {
  const fx = makeFixtureWithOrigin()
  try {
    const { root } = fx
    write(root, 'src/content/posts/new.md', POST_BODY)
    write(root, 'docs/notes.md', 'not a post\n')
    const res = runShip(root, ['--preflight'])
    assert.equal(res.code, 1)
    assert.match(res.stderr, /docs\/notes\.md/)
  } finally {
    cleanupWithOrigin(fx)
  }
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/ship.test.mjs`
Expected: the four new `cli:` tests FAIL (the CLI has no main yet, so `node ship.mjs` exits 0 doing nothing); the 11 unit tests still pass.

- [ ] **Step 3: Write the main flow**

Append to `scripts/ship.mjs`:

```js
async function watchDeploy(root, sha, slugs) {
  const deadline = Date.now() + 5 * 60 * 1000
  while (Date.now() < deadline) {
    let runs
    try {
      runs = JSON.parse(
        execFileSync(
          'gh',
          ['run', 'list', '--workflow', 'deploy.yml', '--limit', '1', '--json', 'status,conclusion,headSha'],
          { cwd: root, encoding: 'utf8' },
        ),
      )
    } catch {
      console.log('gh unavailable; watch the deploy at ' + ACTIONS_URL)
      return
    }
    const run = runs[0]
    if (run && run.headSha === sha && run.status === 'completed') {
      if (run.conclusion === 'success') {
        console.log('deploy complete:')
        for (const slug of slugs) console.log(`  https://theneverless.com/posts/${slug}/`)
      } else {
        console.log(`deploy finished with conclusion ${run.conclusion}; inspect ${ACTIONS_URL}`)
      }
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 10000))
  }
  console.log('deploy watch timed out after 5 minutes; check ' + ACTIONS_URL)
}

export async function main(values) {
  const root = git(['rev-parse', '--show-toplevel'])
  if (values.yes && !values.digest) {
    console.error('--yes requires --digest <d> from a prior --preflight run')
    console.error(USAGE)
    return 1
  }
  save(root, { trigger: 'ship', quiet: true })
  const pre = preflight(root)
  if (pre.status === 'abort') {
    console.error(pre.detail)
    return 1
  }
  if (pre.status === 'empty') {
    console.log(pre.detail)
    return 0
  }
  console.log(`post change(s) vs ${pre.baseRef} (${pre.changeSet.length}):`)
  for (const p of pre.changeSet) console.log('  ' + p)
  console.log(`changeset digest: ${pre.digest}`)
  if (values.preflight) return 0

  let server = null
  try {
    if (!values.yes) {
      // The build also runs inside release-check later; the duplication is
      // the accepted cost of reusing the gates unmodified.
      console.log('\nbuilding production output...')
      const build = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' })
      if (build.status !== 0) {
        console.error('build failed; fix it before shipping')
        return 1
      }
      const reviewFile = join(root, '.preview', 'review.html')
      mkdirSync(join(root, '.preview'), { recursive: true })
      writeFileSync(
        reviewFile,
        renderReviewPage(reviewTargets(root, pre.changeSet), { host: 'localhost', port: values.port }),
      )
      server = spawn('npx', ['astro', 'preview', '--port', values.port], {
        cwd: root,
        stdio: ['ignore', 'ignore', 'inherit'],
      })
      console.log(`\nreview page: ${reviewFile}`)
      console.log(`server: http://localhost:${values.port}/`)
      if (!values['no-open']) spawnSync('open', [reviewFile])
      const rl = createInterface({ input: process.stdin, output: process.stdout })
      const answer = (
        await rl.question(`\napprove these ${pre.changeSet.length} file(s) and ship? [y/N] `)
      ).trim()
      rl.close()
      if (answer !== 'y') {
        console.log('not approved; nothing recorded')
        return 0
      }
    }

    // Freshness check, both modes: the approval binds to exactly the
    // reviewed content. A concurrent session's post edit (or any new
    // non-post change) landing after the review aborts here.
    const approved = values.yes ? values.digest : pre.digest
    const now = preflight(root, { fetch: false })
    if (now.status !== 'ok' || now.digest !== approved) {
      console.error(
        'the tree changed since the review (another session?); nothing recorded, start over',
      )
      return 1
    }
    writeManifest(root, hashChangeSet(root, now.changeSet), { baseRef: now.baseRef })
    console.log('approval recorded')
    if (server) {
      server.kill()
      server = null
    }

    console.log('\nrunning release checks...')
    const results = await runChecks(root)
    const summary = verdict(results)
    console.log('\n' + summary)
    if (!summary.startsWith('VERDICT: GO')) return 1

    const sha = commitAndPush(root, now.changeSet, {
      message: values.message || commitMessageFor(now.changeSet),
    })
    console.log(`pushed ${sha.slice(0, 7)} to origin/main`)
    await watchDeploy(root, sha, [...new Set(now.changeSet.map((p) => slugForPostFile(p)))])
    return 0
  } finally {
    if (server) server.kill()
  }
}

// CLI entry (pathToFileURL handles spaces in the repo path)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let values
  try {
    ({ values } = parseArgs({
      options: {
        message: { type: 'string' },
        port: { type: 'string', default: '4322' },
        'no-open': { type: 'boolean', default: false },
        preflight: { type: 'boolean', default: false },
        yes: { type: 'boolean', default: false },
        digest: { type: 'string' },
      },
    }))
  } catch (err) {
    console.error(err.message)
    console.error(USAGE)
    process.exit(1)
  }
  main(values).then(
    (code) => process.exit(code),
    (err) => {
      console.error(err.message)
      process.exit(1)
    },
  )
}
```

- [ ] **Step 4: Add the npm scripts**

In `package.json`: add after the `"release-check"` line:

```json
    "ship": "node scripts/ship.mjs",
```

and extend `"test:safety"` to:

```json
    "test:safety": "node --test scripts/checkpoint.test.mjs scripts/release-check.test.mjs scripts/preview-posts.test.mjs scripts/ship.test.mjs",
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test scripts/ship.test.mjs`
Expected: PASS (15 tests)

Run: `npm run test:safety`
Expected: PASS (67 existing + 15 new = 82 tests)

- [ ] **Step 6: Commit**

```bash
git add scripts/ship.mjs scripts/ship.test.mjs package.json
git commit -m "feat(ship): add cli main flow, deploy watch, and npm scripts

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- scripts/ship.mjs scripts/ship.test.mjs package.json
```

---

### Task 6: the ship-posts skill

**Files:**
- Create: `.claude/skills/ship-posts/SKILL.md`
- Modify: `.claude/skills/preview-posts/SKILL.md`

- [ ] **Step 1: Create `.claude/skills/ship-posts/SKILL.md`** with exactly:

```markdown
---
name: ship-posts
description: Publish the owner's post edits to production through the full gate chain with one owner approval. Use when the owner asks to push, ship, or publish their post edits, for example "push my edits", "ship my posts", or "publish what I changed in the editor". Only handles changes to src/content/posts/; anything else falls back to the normal session workflow.
---

# Ship posts

One conversation-driven publish of the owner's post edits. The machinery is
`npm run ship` (scripts/ship.mjs); this skill is the runbook for driving it.
The approval is digest-bound: ship refuses to publish content the owner did
not review.

## Workflow

1. Run `npm run ship -- --preflight`. If it aborts (wrong branch, origin
   moved, non-post files changed), surface its message to the owner and fall
   back to the normal session workflow; do not improvise around it. On
   success, note the printed file list and the `changeset digest` value.
2. Run `npm run preview-posts` on an explicit free port (`-- --port N
   --no-open` in headless sessions) and give the owner the review link along
   with the file list from step 1. This is the production build, not the dev
   render.
3. Wait for the owner's explicit approval in chat ("approved", "push",
   "ship it") given AFTER they have the link. The initial "push my edits"
   request is the request, not the approval; never treat it as both.
4. Stop the preview server, then run `npm run ship -- --yes --digest <d>`
   with the digest from step 1. If it aborts with "tree changed since the
   review", something (likely another session) edited posts meanwhile: start
   over from step 1 so the owner reviews the new state. Never retry with a
   fresh digest the owner has not seen.
5. Report the release-check results and the live post URLs that ship prints.

## Rules

- `--yes` may only ever follow an owner approval message in this
  conversation, given after step 2's link. No approval message, no ship.
- A digest abort always restarts from step 1; the digest exists precisely so
  approvals cannot drift onto unreviewed content.
- Pushing stays the owner's decision (CLAUDE.md rule 5); this flow just
  compresses the mechanics after they make it.
```

- [ ] **Step 2: Add the cross-reference to `.claude/skills/preview-posts/SKILL.md`**

At the end of the `## Rules` section, add this bullet:

```markdown
- `npm run ship` (skill: ship-posts) records the same manifest-based approval as part of its
  one-command flow, so `.preview/manifest.json` has two writers; both bind approval to exact
  content hashes.
```

- [ ] **Step 3: Check both files for em-dashes**

Run: `grep -n $'—' .claude/skills/ship-posts/SKILL.md .claude/skills/preview-posts/SKILL.md`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/ship-posts/SKILL.md
git commit -m "feat(ship): add ship-posts skill for conversational publishing

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- .claude/skills/ship-posts/SKILL.md .claude/skills/preview-posts/SKILL.md
```

---

### Task 7: documentation

**Files:**
- Modify: `docs/post-editor.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update docs/post-editor.md**

Add this section right after the "## Conflicts" section (before "## Interaction with the preview gate"):

```markdown
## Shipping your edits

Two ways, one pipeline:

- **Terminal**: `npm run ship`. It verifies only post files changed, builds the
  production site and opens the review page, asks one `approve and ship? [y/N]`,
  then runs the release checklist, commits your post files, pushes, and watches
  the deploy until your posts are live.
- **Conversation**: open any Claude Code session and say "push my edits". The
  ship-posts skill walks the same gates: you get the production review link,
  you say "approved" (or "push"), and it ships.

Either way the approval is bound to exactly the content you reviewed: if
anything changes in between (say another session edits a post), ship aborts
instead of publishing something unseen. Manual fallback, should you ever need
it: `npm run preview-posts`, then `npm run preview-posts -- --approve`, then
`npm run release-check`, then commit the post files and push.
```

- [ ] **Step 2: Update CLAUDE.md**

a. Commands table, after the `npm run release-check` row, add:

```markdown
| `npm run ship` | One-command publish for post edits: review, approve, release-check, commit, push (see Safety) |
```

b. Safety section, add after the post preview gate bullet:

```markdown
- **Ship** (`npm run ship`, skill: `.claude/skills/ship-posts/`): one-command publish for changes that touch only `src/content/posts/`; chains checkpoint, preview review, approval, release-check, commit, and push with the approval digest-bound to the reviewed content. Anything beyond post files still goes through the full manual flow.
```

- [ ] **Step 3: Check for em-dashes**

Run: `grep -n $'—' docs/post-editor.md CLAUDE.md`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git commit -m "docs(ship): document the ship command and skill

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- docs/post-editor.md CLAUDE.md
```

---

### Task 8: verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suites**

Run: `npm run test:safety && npm run test:editor && npm run check && npm run lint`
Expected: all pass (82 safety tests including the 15 ship tests).

- [ ] **Step 2: Real-repo preflight behavior**

Run: `npm run ship -- --preflight`
Expected right now: exit 1 listing the unpushed non-post files (the spec and plan docs, the ship implementation files themselves). This is the purity check working as designed: ship refuses to carry non-post commits. Verify the listed paths match `git diff --name-only origin/main` plus untracked files, and that no `.preview/manifest.json` was written by the run.

- [ ] **Step 3: Interactive smoke of the decline path (optional but cheap)**

Not possible to smoke the happy path without a real post edit and a push, which is the owner's call. The decline path can be smoked once the repo state is posts-only after this work ships: `npm run ship`, answer `N`, confirm exit 0 and nothing recorded. Record in the report that the first real interactive run doubles as the acceptance test.

- [ ] **Step 4: Style and hygiene sweep**

Run: `grep -rn $'—' scripts/ship.mjs scripts/ship.test.mjs .claude/skills/ship-posts/ docs/post-editor.md`
Expected: no output.
Run: `git status --porcelain`
Expected: clean (all work committed with explicit paths).

- [ ] **Step 5: Report**

Summarize evidence for the owner. Do not push: the work includes scripts/, docs/, package.json, and CLAUDE.md changes, so by ship's own rules it goes out through a normal session push with the owner's go-ahead (and check 12 will require a preview approval since package.json changed... verify: only a non-build script was added, so packageJsonAffectsSite is false and check 12 may SKIP; report whatever release-check actually says).
