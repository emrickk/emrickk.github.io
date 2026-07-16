# Local Post Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dev-only browser page at `/_edit` on the Astro dev server for quick post edits during review: sidebar of posts (changed first), raw markdown editor with primary/sibling tabs, live iframe of the real rendered post, hash-guarded saves.

**Architecture:** An Astro integration (`scripts/post-editor/integration.mjs`) registered in `astro.config.mjs` uses only the `astro:server:setup` hook, so it exists only while `astro dev` runs and can never reach `dist/`. All file logic lives in `scripts/post-editor/api.mjs` as plain unit-testable functions; the middleware is a thin adapter. The UI is three static files (HTML, CSS, vanilla JS) served by the same middleware.

**Tech Stack:** Node 22 built-ins only (`node:fs`, `node:crypto`, `node:test`). No new npm dependencies. Reuses `computeChangeSet` and `slugForPostFile` from `scripts/preview-posts.mjs`.

**Spec:** `docs/superpowers/specs/2026-07-16-local-post-editor-design.md`

**Conventions that apply to every task:**
- Repo rule 1/6: stage with explicit paths only, and commit in a single command (`git add <paths> && git commit -m "..." -- <paths>` for new files). Verify `git branch --show-current` prints `main` before each commit.
- Repo rule 2: no em-dashes anywhere (code comments, UI copy, docs, commit messages).
- Code style in `scripts/`: no semicolons, single quotes, 2-space indent (match `scripts/preview-posts.mjs`).
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Working directory for all commands: the repo root. All 318 posts are flat files in `src/content/posts/` (no subdirectories); the listing relies on this and says so in a comment.

## File Structure

| File | Responsibility |
| --- | --- |
| `scripts/post-editor/api.mjs` | Create. Path validation, hashing, frontmatter parse, post listing, read/write with conflict detection, changed-set wrapper, request router. Pure functions, no HTTP. |
| `scripts/post-editor/api.test.mjs` | Create. `node:test` suite for everything in api.mjs. |
| `scripts/post-editor/integration.mjs` | Create. Astro integration + connect adapter: serves UI files and adapts HTTP onto `handleApiRequest`. |
| `scripts/post-editor/ui/index.html` | Create. Editor page markup. |
| `scripts/post-editor/ui/editor.css` | Create. Editor page styles. |
| `scripts/post-editor/ui/editor.js` | Create. Editor page behavior (fetch, tabs, save, conflicts, preview lang). |
| `astro.config.mjs` | Modify. Import and register the integration. |
| `package.json` | Modify. Add `test:editor` script. |
| `docs/post-editor.md` | Create. One-page runbook. |
| `CLAUDE.md` | Modify. Commands table row + architecture bullet. |

---

### Task 1: api.mjs skeleton: path validation and hashing

**Files:**
- Create: `scripts/post-editor/api.test.mjs`
- Create: `scripts/post-editor/api.mjs`

- [ ] **Step 1: Write the failing tests**

Create `scripts/post-editor/api.test.mjs`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/post-editor/api.test.mjs`
Expected: FAIL, `Cannot find module ... api.mjs`

- [ ] **Step 3: Write the implementation**

Create `scripts/post-editor/api.mjs`:

```js
// Local post editor file API. Plain functions with no HTTP surface so the
// whole module is unit-testable; scripts/post-editor/integration.mjs adapts
// them onto the Astro dev server. Writes are hash-guarded because several
// agent sessions often edit this checkout at once (see CLAUDE.md rule 6).
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, normalize } from 'node:path'
import { computeChangeSet, slugForPostFile } from '../preview-posts.mjs'

const POSTS_DIR = 'src/content/posts'

// Repo-relative markdown path inside src/content/posts/ only. Defense in
// depth for a localhost-only tool, not a hostile-network boundary.
export function validatePostPath(path) {
  if (typeof path !== 'string' || path.length === 0) return false
  if (isAbsolute(path) || path.includes('\\')) return false
  if (!/\.(md|mdx)$/.test(path)) return false
  const normalized = normalize(path)
  if (normalized.split('/').includes('..')) return false
  return normalized.startsWith(POSTS_DIR + '/')
}

export function sha256(content) {
  return createHash('sha256').update(content).digest('hex')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/post-editor/api.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/post-editor/api.mjs scripts/post-editor/api.test.mjs
git commit -m "feat(editor): add post path validation and hashing

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- scripts/post-editor/api.mjs scripts/post-editor/api.test.mjs
```

---

### Task 2: frontmatter parsing and post listing

**Files:**
- Modify: `scripts/post-editor/api.test.mjs`
- Modify: `scripts/post-editor/api.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `scripts/post-editor/api.test.mjs`:

```js
import { listPosts, parseFrontmatter } from './api.mjs'

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/post-editor/api.test.mjs`
Expected: FAIL, `parseFrontmatter` / `listPosts` not exported

- [ ] **Step 3: Write the implementation**

Append to `scripts/post-editor/api.mjs`:

```js
// Minimal frontmatter scalars: one `key: value` per line, optional single or
// double quotes. Covers every field this API returns; the full zod schema
// also has numbers and coerced dates, which the editor does not need.
export function parseFrontmatter(raw) {
  const block = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const data = {}
  if (!block) return data
  for (const line of block[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/)
    if (!kv) continue
    let value = kv[2].trim()
    const quoted = value.match(/^(['"])([\s\S]*)\1$/)
    if (quoted) {
      value = quoted[1] === '"' ? quoted[2].replace(/\\"/g, '"') : quoted[2].replace(/''/g, "'")
    }
    data[kv[1]] = value
  }
  return data
}

// Primary posts with the fields the sidebar needs. Siblings (*.en.md /
// *.zh.md) are attached to their primary, never listed on their own. Posts
// are flat files in src/content/posts today; this listing relies on that.
// pubDate strings are ISO dates, so lexicographic sort is date sort.
export function listPosts(root) {
  const files = readdirSync(join(root, POSTS_DIR)).filter((f) => /\.(md|mdx)$/.test(f))
  const siblings = new Set(files.filter((f) => /\.(en|zh)\.(md|mdx)$/.test(f)))
  const posts = []
  for (const file of files) {
    if (siblings.has(file)) continue
    const slug = slugForPostFile(file)
    const fm = parseFrontmatter(readFileSync(join(root, POSTS_DIR, file), 'utf8'))
    const sibling = ['en.md', 'zh.md', 'en.mdx', 'zh.mdx']
      .map((ext) => `${slug}.${ext}`)
      .find((f) => siblings.has(f))
    posts.push({
      slug,
      path: `${POSTS_DIR}/${file}`,
      siblingPath: sibling ? `${POSTS_DIR}/${sibling}` : null,
      title: fm.title ?? slug,
      titleZh: fm.titleZh ?? null,
      titleEn: fm.titleEn ?? null,
      pubDate: fm.pubDate ?? '',
      category: fm.category ?? null,
      lang: fm.lang ?? 'zh',
      draft: fm.draft === 'true',
    })
  }
  return posts.sort((a, b) => (a.pubDate < b.pubDate ? 1 : a.pubDate > b.pubDate ? -1 : 0))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/post-editor/api.test.mjs`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(editor): add frontmatter parsing and post listing

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- scripts/post-editor/api.mjs scripts/post-editor/api.test.mjs
```

---

### Task 3: hash-guarded read and write

**Files:**
- Modify: `scripts/post-editor/api.test.mjs`
- Modify: `scripts/post-editor/api.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `scripts/post-editor/api.test.mjs`:

```js
import { readPostFile, writePostFile } from './api.mjs'

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/post-editor/api.test.mjs`
Expected: FAIL, `readPostFile` / `writePostFile` not exported

- [ ] **Step 3: Write the implementation**

Append to `scripts/post-editor/api.mjs`:

```js
export function readPostFile(root, path) {
  if (!validatePostPath(path)) return { status: 400, body: { error: 'invalid path' } }
  const abs = join(root, path)
  if (!existsSync(abs)) return { status: 404, body: { error: 'file not found' } }
  const content = readFileSync(abs, 'utf8')
  return { status: 200, body: { path, content, hash: sha256(content) } }
}

// The editor never creates files, so the target must exist. A stale baseHash
// means another session wrote the file after this one loaded it; return the
// current state so the UI can offer reload or overwrite instead of silently
// clobbering (an overwrite is simply a second PUT with the fresh hash).
export function writePostFile(root, { path, content, baseHash } = {}) {
  if (!validatePostPath(path)) return { status: 400, body: { error: 'invalid path' } }
  if (typeof content !== 'string' || typeof baseHash !== 'string') {
    return { status: 400, body: { error: 'content and baseHash are required' } }
  }
  const abs = join(root, path)
  if (!existsSync(abs)) return { status: 404, body: { error: 'file not found' } }
  const current = readFileSync(abs, 'utf8')
  const currentHash = sha256(current)
  if (currentHash !== baseHash) {
    return {
      status: 409,
      body: { error: 'file changed on disk', currentContent: current, currentHash },
    }
  }
  writeFileSync(abs, content)
  return { status: 200, body: { path, hash: sha256(content) } }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/post-editor/api.test.mjs`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(editor): add hash-guarded post file read and write

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- scripts/post-editor/api.mjs scripts/post-editor/api.test.mjs
```

---

### Task 4: changed-set wrapper

**Files:**
- Modify: `scripts/post-editor/api.test.mjs`
- Modify: `scripts/post-editor/api.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `scripts/post-editor/api.test.mjs`. Note the git fixture comes from the existing shared helper `scripts/test-helpers.mjs`:

```js
import { changedPostPaths } from './api.mjs'
import { cleanup, makeFixtureRepo, write } from '../test-helpers.mjs'

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/post-editor/api.test.mjs`
Expected: FAIL, `changedPostPaths` not exported

- [ ] **Step 3: Write the implementation**

Append to `scripts/post-editor/api.mjs`:

```js
// computeChangeSet throws on git errors by design (the release gate must
// fail closed); for a sidebar an empty Changed group is the right
// degradation. It also excludes draft posts, which matches the review-gate
// semantics it was built for: drafts do not render, so there is nothing to
// review. An edited draft is reachable through the All posts list instead.
export function changedPostPaths(root) {
  try {
    return computeChangeSet(root).filter((p) => p.startsWith(POSTS_DIR + '/'))
  } catch {
    return []
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/post-editor/api.test.mjs`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(editor): add changed post detection for the sidebar

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- scripts/post-editor/api.mjs scripts/post-editor/api.test.mjs
```

---

### Task 5: request router

**Files:**
- Modify: `scripts/post-editor/api.test.mjs`
- Modify: `scripts/post-editor/api.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `scripts/post-editor/api.test.mjs`:

```js
import { handleApiRequest } from './api.mjs'

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
    assert.equal(handleApiRequest(root, { method: 'GET', url: '/api/nope' }).status, 404)
    assert.equal(handleApiRequest(root, { method: 'DELETE', url: '/api/file' }).status, 404)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/post-editor/api.test.mjs`
Expected: FAIL, `handleApiRequest` not exported

- [ ] **Step 3: Write the implementation**

Append to `scripts/post-editor/api.mjs`:

```js
// Router for everything under /_edit/api/. url arrives with the /_edit
// mount prefix already stripped by connect. Synchronous on purpose: every
// handler is sync, and the adapter in integration.mjs stays trivial.
export function handleApiRequest(root, { method, url, body = null }) {
  const parsed = new URL(url, 'http://localhost')
  if (method === 'GET' && parsed.pathname === '/api/posts') {
    return { status: 200, body: { posts: listPosts(root), changed: changedPostPaths(root) } }
  }
  if (method === 'GET' && parsed.pathname === '/api/file') {
    return readPostFile(root, parsed.searchParams.get('path') ?? '')
  }
  if (method === 'PUT' && parsed.pathname === '/api/file') {
    let payload
    try {
      payload = JSON.parse(body)
    } catch {
      return { status: 400, body: { error: 'invalid JSON body' } }
    }
    return writePostFile(root, payload)
  }
  return { status: 404, body: { error: 'unknown endpoint' } }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/post-editor/api.test.mjs`
Expected: PASS (16 tests)

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(editor): add api request router

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- scripts/post-editor/api.mjs scripts/post-editor/api.test.mjs
```

---

### Task 6: Astro integration and middleware adapter

**Files:**
- Create: `scripts/post-editor/integration.mjs`

No unit test: the module is a thin HTTP adapter over the fully tested api.mjs, and the dev-server wiring is exercised end to end in Task 10.

- [ ] **Step 1: Write the integration**

Create `scripts/post-editor/integration.mjs`:

```js
// Dev-only post editor, mounted at /_edit on the Astro dev server. The only
// hook is astro:server:setup, which never fires during astro build, so
// nothing here can reach dist/ or the deployed site (public repo, GitHub
// Pages). All file logic lives in api.mjs; this file is HTTP plumbing.
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleApiRequest } from './api.mjs'

const UI_DIR = join(dirname(fileURLToPath(import.meta.url)), 'ui')
const UI_FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/editor.css': ['editor.css', 'text/css; charset=utf-8'],
  '/editor.js': ['editor.js', 'text/javascript; charset=utf-8'],
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

async function handle(root, req, res) {
  const url = req.url === '' ? '/' : req.url
  if (url.startsWith('/api/')) {
    const body = req.method === 'PUT' ? await readBody(req) : null
    const result = handleApiRequest(root, { method: req.method, url, body })
    res.statusCode = result.status
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(result.body))
    return
  }
  const uiFile = UI_FILES[url.split('?')[0]]
  if (req.method === 'GET' && uiFile) {
    res.statusCode = 200
    res.setHeader('content-type', uiFile[1])
    res.end(await readFile(join(UI_DIR, uiFile[0])))
    return
  }
  res.statusCode = 404
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify({ error: 'not found' }))
}

export default function postEditor() {
  return {
    name: 'post-editor',
    hooks: {
      'astro:server:setup': ({ server }) => {
        const root = server.config.root
        server.middlewares.use('/_edit', (req, res, next) => {
          handle(root, req, res).catch(next)
        })
      },
    },
  }
}
```

- [ ] **Step 2: Sanity-check the module loads**

Run: `node -e "import('./scripts/post-editor/integration.mjs').then((m) => console.log(typeof m.default))"`
Expected: `function`

- [ ] **Step 3: Commit**

```bash
git add scripts/post-editor/integration.mjs
git commit -m "feat(editor): add dev-only astro integration and middleware

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- scripts/post-editor/integration.mjs
```

---

### Task 7: editor UI

**Files:**
- Create: `scripts/post-editor/ui/index.html`
- Create: `scripts/post-editor/ui/editor.css`
- Create: `scripts/post-editor/ui/editor.js`

No unit test (single-user localhost UI, per spec); verified manually in Task 10. Reminder: no em-dashes in any UI string.

- [ ] **Step 1: Create `scripts/post-editor/ui/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Post editor</title>
    <link rel="stylesheet" href="/_edit/editor.css" />
  </head>
  <body>
    <div id="app">
      <aside id="sidebar">
        <h1>Post editor</h1>
        <input id="filter" type="search" placeholder="Filter posts" />
        <div id="post-list"></div>
      </aside>
      <main id="main">
        <div id="toolbar">
          <div id="tabs"></div>
          <button id="save" type="button" disabled>Save</button>
        </div>
        <div id="banner" hidden></div>
        <div id="panes">
          <textarea id="editor" spellcheck="false" disabled placeholder="Pick a post from the list."></textarea>
          <iframe id="preview" title="Post preview"></iframe>
        </div>
      </main>
    </div>
    <script type="module" src="/_edit/editor.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `scripts/post-editor/ui/editor.css`**

```css
* {
  box-sizing: border-box;
}
html,
body {
  height: 100%;
  margin: 0;
}
body {
  font: 14px/1.5 system-ui, sans-serif;
  color: #e6e6e6;
  background: #1e1f22;
}
#app {
  display: grid;
  grid-template-columns: 300px 1fr;
  height: 100vh;
}
#sidebar {
  border-right: 1px solid #333;
  overflow-y: auto;
  padding: 12px;
}
#sidebar h1 {
  font-size: 15px;
  margin: 0 0 10px;
}
#sidebar h2 {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #999;
  margin: 16px 0 6px;
}
#filter {
  width: 100%;
  padding: 6px 8px;
  background: #2a2b2e;
  border: 1px solid #3a3b3e;
  border-radius: 6px;
  color: inherit;
}
.post-item {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: 0;
  border-radius: 6px;
  padding: 6px 8px;
  color: inherit;
  cursor: pointer;
  font: inherit;
}
.post-item:hover {
  background: #2a2b2e;
}
.post-item.active {
  background: #35363a;
}
.post-item small {
  display: block;
  color: #8a8a8a;
}
.empty {
  color: #8a8a8a;
  font-size: 12px;
  margin: 4px 0;
}
#main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
#toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid #333;
}
#tabs {
  display: flex;
  gap: 4px;
  flex: 1;
}
.tab {
  background: none;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 4px 10px;
  color: #aaa;
  cursor: pointer;
  font: inherit;
}
.tab.active {
  background: #2a2b2e;
  color: #fff;
  border-color: #3a3b3e;
}
#save {
  padding: 5px 14px;
  border-radius: 6px;
  border: 1px solid #3a3b3e;
  background: #2f6feb;
  color: #fff;
  cursor: pointer;
  font: inherit;
}
#save:disabled {
  background: #2a2b2e;
  color: #777;
  cursor: default;
}
#banner {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  background: #4a3a12;
  border-bottom: 1px solid #6b5518;
}
#banner button {
  font: inherit;
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid #8a6d1f;
  background: #5c4a17;
  color: #fff;
  cursor: pointer;
}
#panes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  flex: 1;
  min-height: 0;
}
#editor {
  resize: none;
  border: 0;
  border-right: 1px solid #333;
  background: #1e1f22;
  color: #e6e6e6;
  padding: 14px;
  font: 13px/1.6 ui-monospace, 'SF Mono', Menlo, monospace;
  outline: none;
  white-space: pre-wrap;
}
#preview {
  border: 0;
  background: #fff;
  width: 100%;
  height: 100%;
}
```

- [ ] **Step 3: Create `scripts/post-editor/ui/editor.js`**

```js
// Editor page behavior. Same-origin with the dev server, so the preview
// iframe is scriptable: language switching sets data-lang directly (the
// mechanism LangToggle.astro uses) plus localStorage so reloads persist.
const state = {
  posts: [],
  changed: new Set(),
  post: null,
  tab: null,
  files: {},
  activePath: null,
}

const $ = (id) => document.getElementById(id)
const listEl = $('post-list')
const editorEl = $('editor')
const previewEl = $('preview')
const saveEl = $('save')
const tabsEl = $('tabs')
const bannerEl = $('banner')
const filterEl = $('filter')

async function api(url, options) {
  const res = await fetch('/_edit/api' + url, options)
  return { status: res.status, body: await res.json() }
}

function tabPath(post, which) {
  return which === 'primary' ? post.path : post.siblingPath
}

function tabLang(post, which) {
  if (which === 'primary') return post.lang
  return post.lang === 'zh' ? 'en' : 'zh'
}

function isDirty() {
  const f = state.files[state.activePath]
  return f ? editorEl.value !== f.savedContent : false
}

function confirmDiscard() {
  return !isDirty() || window.confirm('Discard unsaved changes to this file?')
}

function showBanner(text) {
  bannerEl.replaceChildren(document.createTextNode(text))
  bannerEl.hidden = false
}

function hideBanner() {
  bannerEl.hidden = true
  bannerEl.replaceChildren()
}

function isChanged(post) {
  return state.changed.has(post.path) || (post.siblingPath && state.changed.has(post.siblingPath))
}

function postButton(post) {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'post-item' + (state.post === post ? ' active' : '')
  const title = document.createElement('span')
  title.textContent = post.titleZh || post.title
  const meta = document.createElement('small')
  meta.textContent = post.pubDate + (post.draft ? ' · draft' : '')
  btn.append(title, meta)
  btn.addEventListener('click', () => openPost(post))
  return btn
}

function renderList() {
  const q = filterEl.value.trim().toLowerCase()
  const match = (p) =>
    !q ||
    p.slug.toLowerCase().includes(q) ||
    (p.title || '').toLowerCase().includes(q) ||
    (p.titleZh || '').toLowerCase().includes(q) ||
    (p.titleEn || '').toLowerCase().includes(q)
  const changed = state.posts.filter((p) => isChanged(p) && match(p))
  const rest = state.posts.filter((p) => !isChanged(p) && match(p))
  const nodes = []
  const heading = (text) => {
    const h = document.createElement('h2')
    h.textContent = text
    return h
  }
  nodes.push(heading('Changed'))
  if (changed.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'empty'
    empty.textContent = 'Nothing changed vs origin/main.'
    nodes.push(empty)
  } else {
    nodes.push(...changed.map(postButton))
  }
  nodes.push(heading('All posts'))
  nodes.push(...rest.map(postButton))
  listEl.replaceChildren(...nodes)
}

function renderTabs() {
  tabsEl.replaceChildren()
  const post = state.post
  if (!post) return
  const tabs = post.siblingPath ? ['primary', 'sibling'] : ['primary']
  for (const which of tabs) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'tab' + (state.tab === which ? ' active' : '')
    const name = tabPath(post, which).split('/').pop()
    btn.textContent = which === state.tab && isDirty() ? name + ' *' : name
    btn.addEventListener('click', () => {
      if (which !== state.tab) openTab(which)
    })
    tabsEl.append(btn)
  }
}

function updateDirtyUi() {
  saveEl.disabled = !state.activePath || !isDirty()
  renderTabs()
}

function setPreviewLang(lang) {
  localStorage.setItem('lang', lang)
  const doc = previewEl.contentDocument
  if (doc && doc.documentElement) doc.documentElement.setAttribute('data-lang', lang)
}

async function openTab(which) {
  if (!confirmDiscard()) return
  const post = state.post
  const path = tabPath(post, which)
  state.tab = which
  state.activePath = path
  if (!state.files[path]) {
    const { status, body } = await api('/file?path=' + encodeURIComponent(path))
    if (status !== 200) {
      showBanner('Could not load ' + path + ': ' + body.error)
      return
    }
    state.files[path] = { hash: body.hash, savedContent: body.content }
  }
  editorEl.value = state.files[path].savedContent
  editorEl.disabled = false
  hideBanner()
  setPreviewLang(tabLang(post, which))
  updateDirtyUi()
}

async function openPost(post) {
  if (!confirmDiscard()) return
  state.post = post
  state.files = {}
  state.activePath = null
  previewEl.src = '/posts/' + post.slug + '/'
  await openTab('primary')
  renderList()
}

async function refreshChanged() {
  const { status, body } = await api('/posts')
  if (status !== 200) return
  state.changed = new Set(body.changed)
  renderList()
}

function showConflict(path, body) {
  bannerEl.replaceChildren()
  const msg = document.createElement('span')
  msg.textContent = path + ' changed on disk while you were editing.'
  const reload = document.createElement('button')
  reload.type = 'button'
  reload.textContent = 'Reload from disk'
  reload.addEventListener('click', () => {
    if (!window.confirm('Replace your editor text with the file on disk?')) return
    const f = state.files[path]
    f.hash = body.currentHash
    f.savedContent = body.currentContent
    if (state.activePath === path) editorEl.value = body.currentContent
    hideBanner()
    updateDirtyUi()
  })
  const overwrite = document.createElement('button')
  overwrite.type = 'button'
  overwrite.textContent = 'Overwrite'
  overwrite.addEventListener('click', () => {
    state.files[path].hash = body.currentHash
    hideBanner()
    save()
  })
  bannerEl.append(msg, reload, overwrite)
  bannerEl.hidden = false
}

async function save() {
  const path = state.activePath
  const f = state.files[path]
  if (!f || !isDirty()) return
  const { status, body } = await api('/file', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path, content: editorEl.value, baseHash: f.hash }),
  })
  if (status === 409) {
    showConflict(path, body)
    return
  }
  if (status !== 200) {
    showBanner('Save failed: ' + body.error)
    return
  }
  f.hash = body.hash
  f.savedContent = editorEl.value
  hideBanner()
  updateDirtyUi()
  refreshChanged()
  // HMR usually reloads the post page on its own; this delayed reload is the
  // fallback that guarantees the preview never goes stale.
  setTimeout(() => {
    try {
      previewEl.contentWindow.location.reload()
    } catch {
      previewEl.src = previewEl.src
    }
  }, 600)
}

async function init() {
  const { status, body } = await api('/posts')
  if (status !== 200) {
    showBanner('Could not load posts: ' + body.error)
    return
  }
  state.posts = body.posts
  state.changed = new Set(body.changed)
  renderList()
}

filterEl.addEventListener('input', renderList)
editorEl.addEventListener('input', updateDirtyUi)
saveEl.addEventListener('click', save)
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault()
    save()
  }
})
window.addEventListener('beforeunload', (e) => {
  if (isDirty()) e.preventDefault()
})
init()
```

- [ ] **Step 4: Commit**

```bash
git add scripts/post-editor/ui/index.html scripts/post-editor/ui/editor.css scripts/post-editor/ui/editor.js
git commit -m "feat(editor): add editor ui

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- scripts/post-editor/ui/index.html scripts/post-editor/ui/editor.css scripts/post-editor/ui/editor.js
```

---

### Task 8: register the integration and the test script

**Files:**
- Modify: `astro.config.mjs` (imports block and `integrations` array)
- Modify: `package.json` (scripts block)

- [ ] **Step 1: Register the integration**

In `astro.config.mjs` (this file uses semicolons; match it), add to the imports:

```js
import postEditor from './scripts/post-editor/integration.mjs';
```

and add `postEditor()` at the end of the `integrations` array:

```js
  integrations: [
    expressiveCode(toneExpressiveCodeOptions),
    mdx(),
    sitemap({
      filter: (page) => !sitemapExcludedPaths.has(withoutConfiguredBase(new URL(page).pathname)),
    }),
    postEditor(),
  ],
```

- [ ] **Step 2: Add the test script**

In `package.json`, after `"test:rehype"`, add:

```json
    "test:editor": "node --test scripts/post-editor/api.test.mjs",
```

- [ ] **Step 3: Verify the suite and the config**

Run: `npm run test:editor`
Expected: PASS (16 tests)

Run: `npm run check`
Expected: exits 0 (config still type-checks)

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(editor): register dev-only post editor integration

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- astro.config.mjs package.json
```

---

### Task 9: documentation

**Files:**
- Create: `docs/post-editor.md`
- Modify: `CLAUDE.md` (commands table and Architecture section)

- [ ] **Step 1: Create `docs/post-editor.md`**

```markdown
# Local post editor

A dev-only editing page for quick post edits during review. It exists only
while the dev server runs; production builds contain nothing from it.

## Using it

1. `npm run dev` (pick your own free port when sessions share this checkout:
   `npm run dev -- --port 4567`)
2. Open `http://localhost:<port>/_edit`

The sidebar lists changed posts first (relative to origin/main, same
detection as the preview gate, so drafts never appear there), then all posts
newest first with a filter box. Opening a post loads the raw file,
frontmatter included, with a tab for the sibling translation when one
exists. The right pane is the real rendered post from the same dev server;
it follows the language of the file you are editing.

Save with the button or Cmd+S. The preview reloads on save. Frontmatter
mistakes show up as Astro's own error overlay in the preview, which is the
same error the build would give.

## Conflicts

Saves are hash-guarded. If another session changed the file after you loaded
it, the save returns a conflict banner instead of overwriting: "Reload from
disk" replaces your editor text with the file on disk (it warns first; your
text is not kept anywhere), "Overwrite" saves your text over the newer file.

## Interaction with the preview gate

Saving a post changes its content hash, which invalidates any preview-posts
approval covering that file. That is the intended gate behavior: edited
posts need a fresh review before release-check goes GO.

## Where things live

- `scripts/post-editor/integration.mjs`: dev-server middleware (the only
  Astro hook used is astro:server:setup, which never fires in builds)
- `scripts/post-editor/api.mjs`: file API, unit-tested by
  `npm run test:editor`
- `scripts/post-editor/ui/`: the page itself (plain HTML, CSS, JS)
```

- [ ] **Step 2: Update CLAUDE.md**

In the commands table, after the `npm run test:rehype` row, add:

```markdown
| `npm run test:editor` | Post editor API test suite (`node:test`) |
```

In the Architecture section, add a bullet after the `scripts/migrate/` bullet:

```markdown
- **Local post editor**: `/_edit` on the dev server (dev-only Astro integration in `scripts/post-editor/`, zero build footprint). Runbook: [docs/post-editor.md](docs/post-editor.md).
```

- [ ] **Step 3: Commit**

```bash
git add docs/post-editor.md
git commit -m "docs(editor): add post editor runbook and CLAUDE.md entries

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- docs/post-editor.md CLAUDE.md
```

---

### Task 10: end-to-end verification

**Files:** none (verification only)

Use the preview_* tools (or a manually started dev server) on an explicit free port; other sessions may hold the default port. Per project memory, shared `.astro`/Vite caches can wedge dev servers: if startup misbehaves, restart your own server rather than reusing another session's.

- [ ] **Step 1: Start the dev server and open the editor**

Start `npm run dev -- --port 4620` (or preview_start with an equivalent launch config). Fetch `http://localhost:4620/_edit`.
Expected: HTML containing `Post editor`. If it returns Astro's 404 page instead, the middleware ran after Astro's router; fix by prepending the layer in `astro:server:setup`:

```js
server.middlewares.stack.unshift({
  route: '/_edit',
  handle: (req, res, next) => {
    handle(root, req, res).catch(next)
  },
})
```

(and remove the `server.middlewares.use` call), then re-verify.

- [ ] **Step 2: Verify the API on the real repo**

- `GET /_edit/api/posts`: returns roughly 318 posts; spot-check one bilingual post has `siblingPath`; `changed` lists only paths under `src/content/posts/`.
- `GET /_edit/api/file?path=src/content/posts/california-little-patagonia.md`: 200 with content and hash.
- `GET /_edit/api/file?path=../package.json`: 400.

- [ ] **Step 3: Verify the editing loop in the browser**

In the editor page: open a post, confirm the preview iframe shows the rendered post; switch to the sibling tab, confirm the preview language flips; type a change, confirm the dirty marker and enabled Save; save, confirm the change lands in the file (`git diff -- <path>`) and the preview reloads with the edit visible.

- [ ] **Step 4: Verify the conflict path**

With unsaved changes in the editor for file X, append a line to X from the shell (`echo change >> <path>`), then save in the editor.
Expected: conflict banner with Reload from disk and Overwrite. Choose Reload from disk, confirm the shell's line appears in the editor. Then revert all verification edits (`git restore -- <paths>` or a checkpoint restore) and confirm `git status` is clean of them.

- [ ] **Step 5: Verify zero build footprint**

Run: `npm run build`
Expected: build succeeds; `dist/_edit` does not exist; `grep -ri "_edit" dist --include="*.html" -l` returns nothing.

- [ ] **Step 6: Run the full quality bar**

Run: `npm run test:editor && npm run test:safety && npm run check && npm run lint`
Expected: all pass.

- [ ] **Step 7: Report**

No commit in this task. Summarize verification evidence (screenshots or fetched output) for the owner. Do not push: pushing to main is the owner's call (CLAUDE.md rule 5), and astro.config.mjs changes are preview-relevant, so release-check will require a preview approval before any push.
