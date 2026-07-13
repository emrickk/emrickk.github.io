import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
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
