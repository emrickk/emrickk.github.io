// Tests for the post editor file API. Uses throwaway tmpdir fixtures; never
// touches the real repo's posts.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { sha256, validatePostPath } from './api.mjs'

test('validatePostPath accepts post markdown paths', () => {
  assert.equal(validatePostPath('src/content/posts/foo.md'), true)
  assert.equal(validatePostPath('src/content/posts/foo.zh.md'), true)
  assert.equal(validatePostPath('src/content/posts/foo.mdx'), true)
})

test('validatePostPath rejects everything else', () => {
  assert.equal(validatePostPath(''), false)
  assert.equal(validatePostPath('src/content/posts/foo.txt'), false)
  assert.equal(validatePostPath('src/content/notes/foo.md'), false)
  assert.equal(validatePostPath('src/content/posts/../../../etc/passwd.md'), false)
  assert.equal(validatePostPath('/etc/passwd.md'), false)
  assert.equal(validatePostPath('src\\content\\posts\\foo.md'), false)
  assert.equal(validatePostPath('src/content/posts.md'), false)
  assert.equal(validatePostPath(42), false)
})

test('sha256 matches node crypto reference', () => {
  const reference = createHash('sha256').update('hello\n').digest('hex')
  assert.equal(sha256('hello\n'), reference)
})
