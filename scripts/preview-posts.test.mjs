// Tests for the post preview gate. Fixture repos live in the OS tmpdir via
// test-helpers.mjs; nothing here touches the real repo.
import assert from 'node:assert/strict'
import test from 'node:test'
import { classifyPath, primaryPostPath, slugForPostFile } from './preview-posts.mjs'

test('classifyPath: post content files', () => {
  assert.equal(classifyPath('src/content/posts/venice.md'), 'post')
  assert.equal(classifyPath('src/content/posts/venice.en.md'), 'post')
  assert.equal(classifyPath('src/content/posts/2008-04-03-p960.mdx'), 'post')
})

test('classifyPath: site-wide files', () => {
  assert.equal(classifyPath('src/styles/prose.css'), 'site')
  assert.equal(classifyPath('src/components/LangTitle.astro'), 'site')
  assert.equal(classifyPath('src/content.config.ts'), 'site')
  assert.equal(classifyPath('public/favicon.svg'), 'site')
  assert.equal(classifyPath('astro.config.mjs'), 'site')
  assert.equal(classifyPath('package.json'), 'site')
  assert.equal(classifyPath('package-lock.json'), 'site')
})

test('classifyPath: irrelevant files', () => {
  assert.equal(classifyPath('docs/images.md'), null)
  assert.equal(classifyPath('scripts/release-check.mjs'), null)
  assert.equal(classifyPath('.github/workflows/deploy.yml'), null)
  assert.equal(classifyPath('README.md'), null)
})

test('slugForPostFile strips extension and language suffix', () => {
  assert.equal(slugForPostFile('src/content/posts/venice.md'), 'venice')
  assert.equal(slugForPostFile('src/content/posts/venice.en.md'), 'venice')
  assert.equal(slugForPostFile('src/content/posts/venice.zh.mdx'), 'venice')
  assert.equal(slugForPostFile('src/content/posts/2013-02-15111954.md'), '2013-02-15111954')
})

test('primaryPostPath maps siblings to the primary file', () => {
  assert.equal(primaryPostPath('src/content/posts/venice.en.md'), 'src/content/posts/venice.md')
  assert.equal(primaryPostPath('src/content/posts/venice.zh.mdx'), 'src/content/posts/venice.mdx')
  assert.equal(primaryPostPath('src/content/posts/venice.md'), 'src/content/posts/venice.md')
})
