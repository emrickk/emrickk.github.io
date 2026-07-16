// Tests for the post editor file API. Uses throwaway tmpdir fixtures; never
// touches the real repo's posts.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import {
  changedPostPaths,
  handleApiRequest,
  listPosts,
  parseFrontmatter,
  readPostFile,
  sha256,
  validatePostPath,
  writePostFile,
} from './api.mjs'
import { cleanup, makeFixtureRepo, write } from '../test-helpers.mjs'

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

function makePostsFixture() {
  const root = mkdtempSync(join(tmpdir(), 'post-editor-fixture-'))
  mkdirSync(join(root, 'src/content/posts'), { recursive: true })
  writeFileSync(
    join(root, 'src/content/posts/alpha.md'),
    [
      '---',
      'title: "Alpha\'s day: a test"',
      "pubDate: '2024-10-13'",
      "category: 'Journal'",
      "lang: 'en'",
      "titleZh: '阿尔法'",
      '---',
      '',
      'Body A',
      '',
    ].join('\n'),
  )
  writeFileSync(
    join(root, 'src/content/posts/alpha.zh.md'),
    "---\ntranslationKey: 'alpha'\nlang: 'zh'\n---\n\n正文\n",
  )
  writeFileSync(
    join(root, 'src/content/posts/beta.md'),
    '---\ntitle: Beta\npubDate: 2025-01-01\ndraft: true\n---\n\nBody B\n',
  )
  return root
}

test('parseFrontmatter reads quoted and bare scalars', () => {
  const fm = parseFrontmatter('---\ntitle: "A: \\"b\\""\nlang: \'zh\'\ndraft: true\n---\nbody')
  assert.equal(fm.title, 'A: "b"')
  assert.equal(fm.lang, 'zh')
  assert.equal(fm.draft, 'true')
})

test('parseFrontmatter returns empty object without frontmatter', () => {
  assert.deepEqual(parseFrontmatter('no frontmatter here'), {})
})

test('listPosts pairs siblings, skips them as primaries, sorts newest first', () => {
  const root = makePostsFixture()
  try {
    const posts = listPosts(root)
    assert.deepEqual(
      posts.map((p) => p.slug),
      ['beta', 'alpha'],
    )
    const alpha = posts.find((p) => p.slug === 'alpha')
    assert.equal(alpha.path, 'src/content/posts/alpha.md')
    assert.equal(alpha.siblingPath, 'src/content/posts/alpha.zh.md')
    assert.equal(alpha.title, "Alpha's day: a test")
    assert.equal(alpha.titleZh, '阿尔法')
    assert.equal(alpha.lang, 'en')
    assert.equal(alpha.draft, false)
    const beta = posts.find((p) => p.slug === 'beta')
    assert.equal(beta.siblingPath, null)
    assert.equal(beta.draft, true)
    assert.equal(beta.lang, 'zh')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('readPostFile returns content and hash', () => {
  const root = makePostsFixture()
  try {
    const res = readPostFile(root, 'src/content/posts/beta.md')
    assert.equal(res.status, 200)
    assert.equal(res.body.content, readFileSync(join(root, 'src/content/posts/beta.md'), 'utf8'))
    assert.equal(res.body.hash, sha256(res.body.content))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('readPostFile rejects invalid and missing paths', () => {
  const root = makePostsFixture()
  try {
    assert.equal(readPostFile(root, '../outside.md').status, 400)
    assert.equal(readPostFile(root, 'src/content/posts/nope.md').status, 404)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('writePostFile writes when baseHash matches', () => {
  const root = makePostsFixture()
  try {
    const abs = join(root, 'src/content/posts/beta.md')
    const before = readFileSync(abs, 'utf8')
    const res = writePostFile(root, {
      path: 'src/content/posts/beta.md',
      content: before + 'more\n',
      baseHash: sha256(before),
    })
    assert.equal(res.status, 200)
    assert.equal(readFileSync(abs, 'utf8'), before + 'more\n')
    assert.equal(res.body.hash, sha256(before + 'more\n'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('writePostFile returns 409 on stale hash and does not write', () => {
  const root = makePostsFixture()
  try {
    const abs = join(root, 'src/content/posts/beta.md')
    const onDisk = readFileSync(abs, 'utf8')
    const res = writePostFile(root, {
      path: 'src/content/posts/beta.md',
      content: 'my edit\n',
      baseHash: sha256('what I loaded earlier\n'),
    })
    assert.equal(res.status, 409)
    assert.equal(res.body.currentContent, onDisk)
    assert.equal(res.body.currentHash, sha256(onDisk))
    assert.equal(readFileSync(abs, 'utf8'), onDisk)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('writePostFile validates inputs', () => {
  const root = makePostsFixture()
  try {
    assert.equal(writePostFile(root, { path: '/etc/x.md', content: '', baseHash: 'h' }).status, 400)
    assert.equal(writePostFile(root, { path: 'src/content/posts/beta.md' }).status, 400)
    assert.equal(
      writePostFile(root, { path: 'src/content/posts/nope.md', content: 'x', baseHash: 'h' }).status,
      404,
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('changedPostPaths returns changed post paths only', () => {
  const root = makeFixtureRepo()
  try {
    write(root, 'src/content/posts/new-post.md', '---\ntitle: t\npubDate: 2026-01-01\n---\nbody\n')
    write(root, 'docs/notes.md', 'not a post\n')
    assert.deepEqual(changedPostPaths(root), ['src/content/posts/new-post.md'])
  } finally {
    cleanup(root)
  }
})

test('changedPostPaths degrades to empty outside a git repo', () => {
  const root = mkdtempSync(join(tmpdir(), 'post-editor-nogit-'))
  try {
    assert.deepEqual(changedPostPaths(root), [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('router serves posts list with changed set', () => {
  const root = makePostsFixture()
  try {
    const res = handleApiRequest(root, { method: 'GET', url: '/api/posts' })
    assert.equal(res.status, 200)
    assert.equal(res.body.posts.length, 2)
    assert.deepEqual(res.body.changed, [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('router serves and writes files', () => {
  const root = makePostsFixture()
  try {
    const get = handleApiRequest(root, {
      method: 'GET',
      url: '/api/file?path=' + encodeURIComponent('src/content/posts/beta.md'),
    })
    assert.equal(get.status, 200)
    const put = handleApiRequest(root, {
      method: 'PUT',
      url: '/api/file',
      body: JSON.stringify({
        path: 'src/content/posts/beta.md',
        content: 'replaced\n',
        baseHash: get.body.hash,
      }),
    })
    assert.equal(put.status, 200)
    assert.equal(readFileSync(join(root, 'src/content/posts/beta.md'), 'utf8'), 'replaced\n')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('router rejects bad JSON and unknown endpoints', () => {
  const root = makePostsFixture()
  try {
    assert.equal(handleApiRequest(root, { method: 'PUT', url: '/api/file', body: '{oops' }).status, 400)
    assert.equal(handleApiRequest(root, { method: 'PUT', url: '/api/file' }).status, 400)
    assert.equal(handleApiRequest(root, { method: 'GET', url: '/api/nope' }).status, 404)
    assert.equal(handleApiRequest(root, { method: 'DELETE', url: '/api/file' }).status, 404)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
