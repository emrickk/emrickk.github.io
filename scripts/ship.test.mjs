// Tests for the ship CLI. Fixture repos live in tmpdirs; the real checkout
// is never touched.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  changeSetDigest,
  commitAndPush,
  commitMessageFor,
  originStatus,
  partitionPurity,
  preflight,
  rawDiffPaths,
} from './ship.mjs'
import { checkPostPreview, hashChangeSet, writeManifest } from './preview-posts.mjs'
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

test('preflight --only scopes the change set to the selected post pair', () => {
  const fx = makeFixtureWithOrigin()
  try {
    const { root } = fx
    write(root, 'src/content/posts/alpha.md', 'alpha v2\n')
    write(root, 'src/content/posts/alpha.zh.md', 'alpha zh v2\n')
    write(root, 'src/content/posts/beta.md', 'beta v2\n')
    const full = preflight(root, { fetch: false })
    assert.equal(full.status, 'ok')
    assert.equal(full.changeSet.length, 3)
    const scoped = preflight(root, {
      fetch: false,
      only: ['src/content/posts/alpha.md', 'src/content/posts/alpha.zh.md'],
    })
    assert.equal(scoped.status, 'ok')
    assert.deepEqual(scoped.changeSet, [
      'src/content/posts/alpha.md',
      'src/content/posts/alpha.zh.md',
    ])
    assert.notEqual(scoped.digest, full.digest)
  } finally {
    cleanupWithOrigin(fx)
  }
})

test('preflight --only with no matching pending change is empty', () => {
  const fx = makeFixtureWithOrigin()
  try {
    const { root } = fx
    write(root, 'src/content/posts/beta.md', 'beta v2\n')
    const res = preflight(root, { fetch: false, only: ['src/content/posts/alpha.md'] })
    assert.equal(res.status, 'empty')
    assert.match(res.detail, /selected post/)
  } finally {
    cleanupWithOrigin(fx)
  }
})

test('checkPostPreview with a scoped change set only needs the scoped approval', () => {
  const fx = makeFixtureWithOrigin()
  try {
    const { root } = fx
    write(root, 'src/content/posts/alpha.md', 'alpha v2\n')
    write(root, 'src/content/posts/beta.md', 'beta v2\n')
    const scoped = ['src/content/posts/alpha.md']
    writeManifest(root, hashChangeSet(root, scoped), { baseRef: 'origin/main' })
    const scopedRes = checkPostPreview(root, { changeSet: scoped })
    assert.equal(scopedRes.status, 'PASS')
    assert.match(scopedRes.detail, /scoped change set/)
    const fullRes = checkPostPreview(root)
    assert.equal(fullRes.status, 'FAIL')
  } finally {
    cleanupWithOrigin(fx)
  }
})
