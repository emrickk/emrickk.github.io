import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { makeFixtureRepo, makeFixtureDist, cleanup, run, write } from './test-helpers.mjs'
import {
  findForbiddenPaths,
  scanTextForSecrets,
  collectSecretScanSources,
  shannonEntropy,
  checkDistDir,
  extractCdnUrls,
  verifyUrls,
  extractInternalRefs,
  resolveInternalRef,
  resolveDiffBase,
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

// Git C-quotes non-ASCII paths when core.quotepath=true (the default), which
// used to hide Chinese-named files from the scan and hygiene checks.
test('collectSecretScanSources sees added lines in non-ASCII filenames despite quotepath', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  run(root, ['config', 'core.quotepath', 'true'])
  write(root, '测试.md', 'clean line\n')
  run(root, ['add', '测试.md'])
  run(root, ['commit', '-q', '-m', 'add zh-named post'])
  write(root, '测试.md', 'clean line\nghp_0123456789abcdefghijABCDEFGHIJ456789\n')
  const hit = collectSecretScanSources(root).find((s) => s.file === '测试.md')
  assert.ok(hit, 'zh-named tracked file must appear in scan sources')
  assert.ok(hit.text.includes('ghp_0123456789abcdefghijABCDEFGHIJ456789'))
})

test('collectSecretScanSources includes untracked non-ASCII filenames despite quotepath', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  run(root, ['config', 'core.quotepath', 'true'])
  write(root, '草稿.md', 'ghp_0123456789abcdefghijABCDEFGHIJ456789\n')
  const files = collectSecretScanSources(root).map((s) => s.file)
  assert.ok(files.includes('草稿.md'))
})

// Simulates a worktree branched before another session pushed: origin/main
// replaced notes.md content that HEAD still has. Diffing the working tree
// straight against origin/main presents HEAD's older, already-replaced lines
// as "+" additions, so the scan would cover content that is not local work.
function makeBehindFixture(t) {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  write(root, 'notes.md', 'stale ghp_0123456789abcdefghijABCDEFGHIJ456789\n')
  run(root, ['add', 'notes.md'])
  run(root, ['commit', '-q', '-m', 'old notes'])
  write(root, 'notes.md', 'cleaned up, token removed upstream\n')
  run(root, ['add', 'notes.md'])
  run(root, ['commit', '-q', '-m', 'remote cleanup'])
  run(root, ['remote', 'add', 'origin', root])
  run(root, ['fetch', '-q', 'origin'])
  run(root, ['checkout', '-q', '-b', 'work', 'HEAD~1'])
  return root
}

test('resolveDiffBase: up to date with the base ref keeps it as-is', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  run(root, ['remote', 'add', 'origin', root])
  run(root, ['fetch', '-q', 'origin'])
  assert.deepEqual(resolveDiffBase(root, 'origin/main'), { ref: 'origin/main', headBehind: false })
  assert.deepEqual(resolveDiffBase(root, 'HEAD'), { ref: 'HEAD', headBehind: false })
})

test('resolveDiffBase: HEAD behind origin/main resolves to the merge-base', (t) => {
  const root = makeBehindFixture(t)
  const { ref, headBehind } = resolveDiffBase(root, 'origin/main')
  assert.equal(headBehind, true)
  assert.equal(ref, run(root, ['rev-parse', 'HEAD']))
})

test('collectSecretScanSources: content replaced on origin/main is not local work and not scanned', (t) => {
  const root = makeBehindFixture(t)
  assert.deepEqual(collectSecretScanSources(root), [])
})

test('collectSecretScanSources: local edits still count when HEAD is behind origin/main', (t) => {
  const root = makeBehindFixture(t)
  write(root, 'tracked.md', 'original\nghp_0123456789abcdefghijABCDEFGHIJ456789\n') // modified tracked
  write(root, 'draft.md', 'AKIAIOSFODNN7EXAMPLE\n') // untracked
  const sources = collectSecretScanSources(root)
  const files = sources.map((s) => s.file).sort()
  assert.deepEqual(files, ['draft.md', 'tracked.md'])
  assert.ok(sources.find((s) => s.file === 'tracked.md').text.includes('ghp_'))
})

test('collectSecretScanSources: local commits ahead of the merge-base stay in scope', (t) => {
  const root = makeBehindFixture(t)
  write(root, 'local-work.md', 'ghp_0123456789abcdefghijABCDEFGHIJ456789\n')
  run(root, ['add', 'local-work.md'])
  run(root, ['commit', '-q', '-m', 'local commit with token'])
  const files = collectSecretScanSources(root).map((s) => s.file)
  assert.ok(files.includes('local-work.md'))
})

test('findForbiddenPaths flags forbidden paths with non-ASCII names despite quotepath', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  run(root, ['config', 'core.quotepath', 'true'])
  write(root, 'image-staging/照片.jpg', 'binary-ish\n')
  run(root, ['add', '-f', 'image-staging/照片.jpg'])
  assert.ok(findForbiddenPaths(root).includes('image-staging/照片.jpg'))
})

test('checkDistDir passes a clean fixture dist', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  const dist = makeFixtureDist(root)
  assert.deepEqual(checkDistDir(dist, { minPages: 1 }).failures, [])
})

test('checkDistDir fails on stale /uploads/ references', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  const dist = makeFixtureDist(root, {
    extraHtml: { 'posts/bad/index.html': '<img src="/uploads/2020/02/old.jpg">' },
  })
  const { failures } = checkDistDir(dist, { minPages: 1 })
  assert.ok(failures.some((f) => f.includes('/uploads/')))
})

test('checkDistDir fails on stale cdn.anping.us references', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  const dist = makeFixtureDist(root, {
    extraHtml: { 'posts/bad/index.html': '<img src="https://cdn.anping.us/2020/02/old.webp">' },
  })
  const { failures } = checkDistDir(dist, { minPages: 1 })
  assert.ok(failures.some((f) => f.includes('cdn.anping.us')))
})

test('checkDistDir fails on localhost URLs in attributes', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  const dist = makeFixtureDist(root, {
    extraHtml: { 'posts/bad/index.html': '<a href="http://localhost:4321/x">dev</a>' },
  })
  const { failures } = checkDistDir(dist, { minPages: 1 })
  assert.ok(failures.some((f) => f.includes('localhost')))
})

test('checkDistDir fails on missing rss, sitemap, or pagefind', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  const dist = makeFixtureDist(root, { omit: ['rss.xml', 'pagefind/pagefind.js'] })
  const { failures } = checkDistDir(dist, { minPages: 1 })
  assert.ok(failures.some((f) => f.includes('rss.xml')))
  assert.ok(failures.some((f) => f.includes('pagefind')))
})

test('checkDistDir enforces the minimum page count', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  const dist = makeFixtureDist(root)
  const { failures } = checkDistDir(dist, { minPages: 300 })
  assert.ok(failures.some((f) => f.includes('expected at least 300')))
})

test('extractCdnUrls finds unique CDN URLs across markup', () => {
  const html = `
    <img src="https://cdn.theneverless.com/2020/02/a.webp">
    <img src="https://cdn.theneverless.com/2020/02/a.webp">
    <a href="https://cdn.theneverless.com/2023/03/b.webp?ssl=1">x</a>
    <a href="https://example.com/c.webp">not ours</a>`
  const urls = extractCdnUrls(html)
  assert.deepEqual(urls.sort(), [
    'https://cdn.theneverless.com/2020/02/a.webp',
    'https://cdn.theneverless.com/2023/03/b.webp?ssl=1',
  ])
})

test('verifyUrls reports non-200s and passes 200s', async (t) => {
  const server = createServer((req, res) => {
    res.statusCode = req.url === '/ok.webp' ? 200 : 404
    res.end()
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  t.after(() => server.close())
  const base = `http://127.0.0.1:${server.address().port}`
  const failures = await verifyUrls([`${base}/ok.webp`, `${base}/missing.webp`], { retries: 0 })
  assert.equal(failures.length, 1)
  assert.match(failures[0].url, /missing\.webp/)
  assert.match(failures[0].error, /404/)
})

test('extractInternalRefs keeps root-relative refs, drops externals and fragments', () => {
  const html = `
    <a href="/posts/a/">a</a>
    <a href="/about#top">about</a>
    <a href="https://example.com/x">ext</a>
    <a href="//cdn.example.com/y">protocol-relative</a>
    <a href="#local">frag</a>
    <img src="/pagefind/pagefind.js">`
  assert.deepEqual(extractInternalRefs(html).sort(), ['/about', '/pagefind/pagefind.js', '/posts/a/'])
})

test('resolveInternalRef maps directory URLs to index.html and blocks traversal', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  const dist = makeFixtureDist(root)
  assert.equal(resolveInternalRef('/', dist), true)
  assert.equal(resolveInternalRef('/posts/a/', dist), true)
  assert.equal(resolveInternalRef('/posts/a', dist), true)
  assert.equal(resolveInternalRef('/pagefind/pagefind.js', dist), true)
  assert.equal(resolveInternalRef('/missing/', dist), false)
  assert.equal(resolveInternalRef('/../outside', dist), false)
})
