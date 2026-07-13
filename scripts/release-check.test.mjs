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
