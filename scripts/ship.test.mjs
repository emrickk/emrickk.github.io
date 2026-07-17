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
