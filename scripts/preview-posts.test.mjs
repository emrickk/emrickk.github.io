// Tests for the post preview gate. Fixture repos live in the OS tmpdir via
// test-helpers.mjs; nothing here touches the real repo.
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import {
  classifyPath,
  computeChangeSet,
  isDraftPost,
  primaryPostPath,
  REPRESENTATIVE_POST,
  resolveBaseRef,
  reviewTargets,
  slugForPostFile,
} from './preview-posts.mjs'
import { cleanup, makeFixtureRepo, run, write } from './test-helpers.mjs'

const FM = '---\ntitle: T\ndescription: D\npubDate: 2026-01-01\n---\n'

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

test('computeChangeSet: modified, untracked, deleted, and irrelevant paths', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  write(root, 'src/content/posts/alpha.md', FM + 'v1\n')
  write(root, 'src/content/posts/gone.md', FM + 'v1\n')
  run(root, ['add', 'src/content/posts/alpha.md', 'src/content/posts/gone.md'])
  run(root, ['commit', '-q', '-m', 'posts'])
  write(root, 'src/content/posts/alpha.md', FM + 'v2\n') // modified tracked
  write(root, 'src/content/posts/beta.md', FM + 'new\n') // untracked
  write(root, 'src/styles/x.css', 'body{}\n') // untracked site-wide
  write(root, 'docs/notes.md', 'irrelevant\n') // untracked irrelevant
  write(root, 'tracked.md', 'changed\n') // modified tracked irrelevant
  rmSync(join(root, 'src/content/posts/gone.md')) // deleted tracked
  assert.deepEqual(computeChangeSet(root, { baseRef: 'HEAD' }), [
    'src/content/posts/alpha.md',
    'src/content/posts/beta.md',
    'src/content/posts/gone.md',
    'src/styles/x.css',
  ])
})

test('computeChangeSet: draft posts and their siblings are excluded', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  write(root, 'src/content/posts/wip.md', '---\ntitle: T\ndraft: true\n---\nbody\n')
  write(root, 'src/content/posts/wip.en.md', 'english body\n')
  write(root, 'src/content/posts/live.md', FM + 'body\n')
  assert.deepEqual(computeChangeSet(root, { baseRef: 'HEAD' }), ['src/content/posts/live.md'])
})

test('isDraftPost reads the primary frontmatter, missing file is not draft', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  write(root, 'src/content/posts/wip.md', '---\ndraft: true\n---\n')
  write(root, 'src/content/posts/live.md', FM)
  assert.equal(isDraftPost(root, 'src/content/posts/wip.md'), true)
  assert.equal(isDraftPost(root, 'src/content/posts/wip.en.md'), true)
  assert.equal(isDraftPost(root, 'src/content/posts/live.md'), false)
  assert.equal(isDraftPost(root, 'src/content/posts/absent.md'), false)
})

test('resolveBaseRef falls back to HEAD without origin/main', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  assert.equal(resolveBaseRef(root), 'HEAD')
})

test('reviewTargets: posts map to their pages, siblings to the primary page', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  write(root, 'src/content/posts/alpha.md', FM)
  write(root, 'src/content/posts/beta.md', FM)
  write(root, 'src/content/posts/beta.en.md', 'english\n')
  assert.deepEqual(
    reviewTargets(root, ['src/content/posts/alpha.md', 'src/content/posts/beta.en.md']),
    ['/posts/alpha/', '/posts/beta/'],
  )
})

test('reviewTargets: deleted primary goes to the homepage, deleted sibling to the post', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  write(root, 'src/content/posts/beta.md', FM)
  // gone.md does not exist on disk; beta.en.md does not exist but beta.md does
  assert.deepEqual(
    reviewTargets(root, ['src/content/posts/gone.md', 'src/content/posts/beta.en.md']),
    ['/', '/posts/beta/'],
  )
})

test('reviewTargets: site-wide changes add homepage and the representative post', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  write(root, 'src/content/posts/alpha.md', FM)
  assert.deepEqual(
    reviewTargets(root, ['src/content/posts/alpha.md', 'src/styles/x.css']),
    ['/', '/posts/alpha/', `/posts/${REPRESENTATIVE_POST}/`],
  )
})
