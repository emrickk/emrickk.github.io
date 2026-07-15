// Tests for the post preview gate. Fixture repos live in the OS tmpdir via
// test-helpers.mjs; nothing here touches the real repo.
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import {
  checkPostPreview,
  classifyPath,
  computeChangeSet,
  hashChangeSet,
  isDraftPost,
  manifestDiff,
  primaryPostPath,
  readManifest,
  REPRESENTATIVE_POST,
  resolveBaseRef,
  reviewTargets,
  slugForPostFile,
  writeManifest,
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

test('resolveBaseRef returns origin/main when it exists', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  run(root, ['remote', 'add', 'origin', root])
  run(root, ['fetch', '-q', 'origin'])
  assert.equal(resolveBaseRef(root), 'origin/main')
})

test('isDraftPost handles CRLF frontmatter', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  write(root, 'src/content/posts/crlf.md', '---\r\ntitle: T\r\ndraft: true\r\n---\r\nbody\r\n')
  assert.equal(isDraftPost(root, 'src/content/posts/crlf.md'), true)
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

test('hashChangeSet: sha256 per file, deleted sentinel for missing files', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  write(root, 'src/content/posts/alpha.md', 'abc')
  const files = hashChangeSet(root, ['src/content/posts/alpha.md', 'src/content/posts/gone.md'])
  // sha256 of "abc"
  assert.equal(files['src/content/posts/alpha.md'], 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  assert.equal(files['src/content/posts/gone.md'], 'deleted')
})

test('manifest round-trip and exact-match comparison', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  write(root, 'src/content/posts/alpha.md', 'v1')
  const files = hashChangeSet(root, ['src/content/posts/alpha.md'])
  writeManifest(root, files, { baseRef: 'HEAD' })
  const manifest = readManifest(root)
  assert.equal(manifest.baseRef, 'HEAD')
  assert.ok(manifest.approvedAt)
  assert.deepEqual(manifestDiff(files, manifest), [])
})

test('manifestDiff reports edits, additions, and removals', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  write(root, 'src/content/posts/alpha.md', 'v1')
  write(root, 'src/content/posts/beta.md', 'v1')
  writeManifest(root, hashChangeSet(root, ['src/content/posts/alpha.md', 'src/content/posts/beta.md']), { baseRef: 'HEAD' })
  const manifest = readManifest(root)
  write(root, 'src/content/posts/alpha.md', 'v2')
  const current = hashChangeSet(root, ['src/content/posts/alpha.md', 'src/content/posts/gamma.md'])
  const problems = manifestDiff(current, manifest)
  assert.deepEqual(problems.sort(), [
    'src/content/posts/alpha.md: changed since approval',
    'src/content/posts/beta.md: approved but no longer in the change set',
    'src/content/posts/gamma.md: not covered by the approval',
  ])
})

test('readManifest returns null when missing or invalid', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  assert.equal(readManifest(root), null)
  write(root, '.preview/manifest.json', 'not json')
  assert.equal(readManifest(root), null)
})

test('computeChangeSet: non-ASCII filenames survive git path quoting', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  write(root, 'src/content/posts/停了一百年的船.md', FM + 'body\n')
  assert.deepEqual(computeChangeSet(root, { baseRef: 'HEAD' }), [
    'src/content/posts/停了一百年的船.md',
  ])
  assert.equal(checkPostPreview(root, { baseRef: 'HEAD' }).status, 'FAIL')
})

test('checkPostPreview: SKIP, FAIL without approval, PASS after, FAIL after edit', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  const opts = { baseRef: 'HEAD' }

  assert.equal(checkPostPreview(root, opts).status, 'SKIP')

  write(root, 'src/content/posts/alpha.md', FM + 'v1\n')
  const noManifest = checkPostPreview(root, opts)
  assert.equal(noManifest.status, 'FAIL')
  assert.match(noManifest.detail, /npm run preview-posts/)

  writeManifest(root, hashChangeSet(root, computeChangeSet(root, opts)), { baseRef: 'HEAD' })
  const approved = checkPostPreview(root, opts)
  assert.equal(approved.status, 'PASS')

  write(root, 'src/content/posts/alpha.md', FM + 'v2\n')
  const stale = checkPostPreview(root, opts)
  assert.equal(stale.status, 'FAIL')
  assert.match(stale.detail, /changed since approval/)
})

test('checkPostPreview truncates long problem lists', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  const opts = { baseRef: 'HEAD' }
  const names = []
  for (let i = 0; i < 12; i++) {
    const name = `src/content/posts/post-${String(i).padStart(2, '0')}.md`
    names.push(name)
    write(root, name, FM + 'v1\n')
  }
  writeManifest(root, hashChangeSet(root, computeChangeSet(root, opts)), { baseRef: 'HEAD' })
  for (const name of names) write(root, name, FM + 'v2\n')
  const stale = checkPostPreview(root, opts)
  assert.equal(stale.status, 'FAIL')
  assert.match(stale.detail, /and 2 more/)
})

test('checkPostPreview: approved deletion passes until the file returns', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  const opts = { baseRef: 'HEAD' }
  write(root, 'src/content/posts/doomed.md', FM + 'body\n')
  run(root, ['add', 'src/content/posts/doomed.md'])
  run(root, ['commit', '-q', '-m', 'add doomed'])
  rmSync(join(root, 'src/content/posts/doomed.md'))
  const files = hashChangeSet(root, computeChangeSet(root, opts))
  assert.equal(files['src/content/posts/doomed.md'], 'deleted')
  writeManifest(root, files, { baseRef: 'HEAD' })
  assert.equal(checkPostPreview(root, opts).status, 'PASS')
  write(root, 'src/content/posts/doomed.md', FM + 'back from the dead\n')
  assert.equal(checkPostPreview(root, opts).status, 'FAIL')
})
