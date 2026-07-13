import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { makeFixtureRepo, makeFixtureDist, cleanup, run, write } from './test-helpers.mjs'
import {
  findForbiddenPaths,
  scanTextForSecrets,
  collectSecretScanSources,
  shannonEntropy,
} from './release-check.mjs'

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
