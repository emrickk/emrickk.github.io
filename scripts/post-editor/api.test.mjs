// Tests for the post editor file API. Uses throwaway tmpdir fixtures; never
// touches the real repo's posts.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { listPosts, parseFrontmatter, sha256, validatePostPath } from './api.mjs'

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
