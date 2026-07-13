import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeFixtureRepo, cleanup, run, write } from './test-helpers.mjs'
import { save, listCheckpoints, resolveId, diffCheckpoint, restore } from './checkpoint.mjs'

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
