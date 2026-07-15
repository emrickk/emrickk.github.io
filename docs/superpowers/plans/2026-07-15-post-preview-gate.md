# Post Preview Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local preview gate: `npm run preview-posts` serves the production build for the owner to review changed posts in their own browser, approval is recorded as content hashes, and release-check check 12 goes NO-GO when preview-relevant changes lack a matching approval.

**Architecture:** One new script `scripts/preview-posts.mjs` holds all logic: pure classification/slug helpers, git-based change-set computation, review-target mapping, sha256 manifest handling, the release-check check function, and a thin CLI (build, serve `dist/` with `astro preview`, write a review page, or `--approve`). `scripts/release-check.mjs` imports the check function and adds it to `CHECKS`. Tests follow the existing `node:test` + fixture-repo pattern in `scripts/test-helpers.mjs`.

**Tech Stack:** Node 22 built-ins only (`node:child_process`, `node:crypto`, `node:fs`, `node:os`, `node:path`, `node:url`, `node:util`), git, existing `astro build`/`astro preview`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-15-post-preview-gate-design.md` (read it first; decisions there are settled).

**Project rules that bind every task** (from CLAUDE.md):
- No em-dashes anywhere user-facing: console messages, docs, commit messages, the review page HTML.
- Stage and commit in one step with explicit paths: `git add <paths> && git commit -m "..." -- <paths>`. Never `git add -A` or `git add .`. Never leave files staged.
- Verify `git branch --show-current` prints `main` before each commit.
- Do NOT push. Do NOT run `npm run preview-posts -- --approve` against this real repo: the working tree carries other sessions' changes and approval is the owner's act.

## File structure

| File | Action | Responsibility |
| --- | --- | --- |
| `scripts/preview-posts.mjs` | Create | All preview-gate logic + CLI (single focused module, mirrors `checkpoint.mjs` style) |
| `scripts/preview-posts.test.mjs` | Create | Full unit coverage of the exported functions |
| `scripts/release-check.mjs` | Modify | Import `checkPostPreview`, append check 12, update header comment |
| `package.json` | Modify | Add `preview-posts` script; add the new test file to `test:safety` |
| `.gitignore` | Modify | Ignore `.preview/` |
| `.claude/skills/preview-posts/SKILL.md` | Create | Agent workflow instructions |
| `.claude/skills/release-check/SKILL.md` | Modify | Document check 12 |
| `CLAUDE.md` | Modify | Commands table row + Safety section line |

---

### Task 1: Path classification and slug helpers

**Files:**
- Create: `scripts/preview-posts.mjs`
- Create: `scripts/preview-posts.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `scripts/preview-posts.test.mjs`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "$(git rev-parse --show-toplevel)" && node --test scripts/preview-posts.test.mjs`
Expected: FAIL, cannot find module `./preview-posts.mjs`

- [ ] **Step 3: Write the minimal implementation**

Create `scripts/preview-posts.mjs`:

```js
#!/usr/bin/env node
// Post preview gate: build the production site, serve it for the owner to
// review changed posts in a real browser, and record approval as content
// hashes so release-check check 12 can enforce that nothing preview-relevant
// ships unseen. Design: docs/superpowers/specs/2026-07-15-post-preview-gate-design.md
// This script never pushes and never approves on its own.

// Image-heavy exemplar reviewed whenever a site-wide file changes. Update it
// when a better exemplar post exists.
export const REPRESENTATIVE_POST = 'springtime-in-patagonia'

const POST_RE = /^src\/content\/posts\/[^/]+\.(?:md|mdx)$/
const SITE_RE = /^(?:src|public)\/|^(?:astro\.config\.mjs|package\.json|package-lock\.json)$/

// 'post' renders at /posts/<slug>/; 'site' can change any page; null never
// affects the deployed site. Post files must win over the src/ prefix rule.
export function classifyPath(path) {
  if (POST_RE.test(path)) return 'post'
  if (SITE_RE.test(path)) return 'site'
  return null
}

export function slugForPostFile(path) {
  return path
    .split('/')
    .pop()
    .replace(/\.(?:md|mdx)$/, '')
    .replace(/\.(?:en|zh)$/, '')
}

// Sibling translation bodies (<slug>.en.md / <slug>.zh.md) render inside the
// primary post's page; frontmatter like draft lives on the primary only.
export function primaryPostPath(path) {
  return path.replace(/\.(?:en|zh)\.(md|mdx)$/, '.$1')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/preview-posts.test.mjs`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add scripts/preview-posts.mjs scripts/preview-posts.test.mjs && git commit -m "feat(preview): add path classification and slug helpers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- scripts/preview-posts.mjs scripts/preview-posts.test.mjs
```

---

### Task 2: Change-set computation (git, drafts, base-ref fallback)

**Files:**
- Modify: `scripts/preview-posts.mjs`
- Modify: `scripts/preview-posts.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `scripts/preview-posts.test.mjs` (extend the import list from `./preview-posts.mjs` with `computeChangeSet, isDraftPost, resolveBaseRef`, and add the helpers import):

```js
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, makeFixtureRepo, run, write } from './test-helpers.mjs'

const FM = '---\ntitle: T\ndescription: D\npubDate: 2026-01-01\n---\n'

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/preview-posts.test.mjs`
Expected: FAIL, `computeChangeSet` is not exported

- [ ] **Step 3: Write the implementation**

Add to `scripts/preview-posts.mjs` (imports go at the top of the file, below the header comment):

```js
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
```

```js
function git(args, { cwd, allowFail = false } = {}) {
  try {
    return execFileSync('git', args, {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
    }).replace(/\n$/, '')
  } catch (err) {
    if (allowFail) return null
    throw new Error(`git ${args.join(' ')} failed: ${err.stderr ? String(err.stderr).trim() : err.message}`)
  }
}

// Drafts are excluded from the build, so there is nothing to review; a draft
// flip back to false re-enters the change set as a normal edit.
export function isDraftPost(root, path) {
  const p = join(root, primaryPostPath(path))
  if (!existsSync(p)) return false
  const fm = readFileSync(p, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/)
  return fm ? /^draft:\s*true\s*$/m.test(fm[1]) : false
}

// Same fallback as release-check's secret scan: origin/main when it exists
// (the deployed state), HEAD otherwise (fresh clones, test fixtures).
export function resolveBaseRef(root) {
  return git(['rev-parse', '--verify', '-q', 'origin/main'], { cwd: root, allowFail: true })
    ? 'origin/main'
    : 'HEAD'
}

// Preview-relevant files changed relative to the base ref: committed-ahead
// and working-tree edits (git diff) plus untracked files. Sorted for stable
// output and manifest comparison.
export function computeChangeSet(root, { baseRef = resolveBaseRef(root) } = {}) {
  const diff = git(['diff', '--no-renames', '--name-only', baseRef], { cwd: root, allowFail: true }) || ''
  const untracked = git(['ls-files', '--others', '--exclude-standard'], { cwd: root }) || ''
  const all = new Set([...diff.split('\n'), ...untracked.split('\n')].filter(Boolean))
  return [...all]
    .filter((path) => {
      const kind = classifyPath(path)
      if (kind === null) return false
      if (kind === 'post' && isDraftPost(root, path)) return false
      return true
    })
    .sort()
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/preview-posts.test.mjs`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add scripts/preview-posts.mjs scripts/preview-posts.test.mjs && git commit -m "feat(preview): compute preview-relevant change set from git

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- scripts/preview-posts.mjs scripts/preview-posts.test.mjs
```

---

### Task 3: Review targets

**Files:**
- Modify: `scripts/preview-posts.mjs`
- Modify: `scripts/preview-posts.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append (extend the module import with `reviewTargets, REPRESENTATIVE_POST`):

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/preview-posts.test.mjs`
Expected: FAIL, `reviewTargets` is not exported

- [ ] **Step 3: Write the implementation**

```js
// Pages the owner must look at for a given change set. A deleted primary post
// sends review to the homepage (the post should vanish from lists); a deleted
// sibling still renders on the surviving primary page. Site-wide changes get
// the homepage plus one image-heavy exemplar. Sorted and deduplicated, '/'
// first.
export function reviewTargets(root, changeSet) {
  const targets = new Set()
  for (const path of changeSet) {
    if (classifyPath(path) === 'post') {
      if (existsSync(join(root, primaryPostPath(path)))) targets.add(`/posts/${slugForPostFile(path)}/`)
      else targets.add('/')
    } else {
      targets.add('/')
      targets.add(`/posts/${REPRESENTATIVE_POST}/`)
    }
  }
  return [...targets].sort()
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/preview-posts.test.mjs`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add scripts/preview-posts.mjs scripts/preview-posts.test.mjs && git commit -m "feat(preview): map change sets to review targets

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- scripts/preview-posts.mjs scripts/preview-posts.test.mjs
```

---

### Task 4: Hashes and the approval manifest

**Files:**
- Modify: `scripts/preview-posts.mjs`
- Modify: `scripts/preview-posts.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append (extend the module import with `hashChangeSet, manifestDiff, readManifest, writeManifest`):

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/preview-posts.test.mjs`
Expected: FAIL, `hashChangeSet` is not exported

- [ ] **Step 3: Write the implementation**

Extend the `node:fs` import with `mkdirSync, writeFileSync` and add `import { createHash } from 'node:crypto'`. Then:

```js
export function hashChangeSet(root, changeSet) {
  const files = {}
  for (const path of changeSet) {
    const p = join(root, path)
    files[path] = existsSync(p)
      ? createHash('sha256').update(readFileSync(p)).digest('hex')
      : 'deleted'
  }
  return files
}

function manifestPath(root) {
  return join(root, '.preview', 'manifest.json')
}

// approvedAt and baseRef are informational only; enforcement compares the
// files map exclusively.
export function writeManifest(root, files, { baseRef }) {
  mkdirSync(join(root, '.preview'), { recursive: true })
  writeFileSync(manifestPath(root), JSON.stringify({ approvedAt: new Date().toISOString(), baseRef, files }, null, 2) + '\n')
}

export function readManifest(root) {
  try {
    const parsed = JSON.parse(readFileSync(manifestPath(root), 'utf8'))
    return parsed && parsed.files && typeof parsed.files === 'object' ? parsed : null
  } catch {
    return null
  }
}

// Empty result means the approved map exactly equals the current one.
export function manifestDiff(currentFiles, manifest) {
  const approved = manifest.files
  const problems = []
  for (const [path, hash] of Object.entries(currentFiles)) {
    if (!(path in approved)) problems.push(`${path}: not covered by the approval`)
    else if (approved[path] !== hash) problems.push(`${path}: changed since approval`)
  }
  for (const path of Object.keys(approved)) {
    if (!(path in currentFiles)) problems.push(`${path}: approved but no longer in the change set`)
  }
  return problems
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/preview-posts.test.mjs`
Expected: PASS (16 tests)

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add scripts/preview-posts.mjs scripts/preview-posts.test.mjs && git commit -m "feat(preview): record and compare approval manifests

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- scripts/preview-posts.mjs scripts/preview-posts.test.mjs
```

---

### Task 5: The release-check check function

**Files:**
- Modify: `scripts/preview-posts.mjs`
- Modify: `scripts/preview-posts.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append (extend the module import with `checkPostPreview`):

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test scripts/preview-posts.test.mjs`
Expected: FAIL, `checkPostPreview` is not exported

- [ ] **Step 3: Write the implementation**

```js
const REMEDIATION = 'run npm run preview-posts, review in the browser, then npm run preview-posts -- --approve'

// Release-check check 12. Cheap: git plus hashing, no build or server.
export function checkPostPreview(root, { baseRef } = {}) {
  const changeSet = computeChangeSet(root, baseRef ? { baseRef } : {})
  if (changeSet.length === 0) return { status: 'SKIP', detail: 'no preview-relevant changes' }
  const manifest = readManifest(root)
  if (!manifest) {
    return { status: 'FAIL', detail: `${changeSet.length} preview-relevant change(s) with no approval; ${REMEDIATION}` }
  }
  const problems = manifestDiff(hashChangeSet(root, changeSet), manifest)
  if (problems.length) {
    const shown = problems.slice(0, 10).join('\n')
    const more = problems.length > 10 ? `\n... and ${problems.length - 10} more` : ''
    return { status: 'FAIL', detail: `${shown}${more}\n${REMEDIATION}` }
  }
  return { status: 'PASS', detail: `${changeSet.length} changed file(s) covered by preview approval` }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test scripts/preview-posts.test.mjs`
Expected: PASS (17 tests)

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add scripts/preview-posts.mjs scripts/preview-posts.test.mjs && git commit -m "feat(preview): add checkPostPreview gate function

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- scripts/preview-posts.mjs scripts/preview-posts.test.mjs
```

---

### Task 6: Wire check 12 into release-check

**Files:**
- Modify: `scripts/release-check.mjs` (header comment lines 2-3, `CHECKS` array at line 282)
- Modify: `scripts/preview-posts.test.mjs`

- [ ] **Step 1: Write the failing test**

Append:

```js
test('release-check exposes post preview as quick-mode check 12', async () => {
  const { CHECKS } = await import('./release-check.mjs')
  const entry = CHECKS.find((c) => c.num === 12)
  assert.ok(entry, 'check 12 missing from CHECKS')
  assert.equal(entry.name, 'post preview')
  assert.notEqual(entry.full, true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/preview-posts.test.mjs`
Expected: FAIL, "check 12 missing from CHECKS"

- [ ] **Step 3: Implement**

In `scripts/release-check.mjs`:

1. Update the header comment (line 3): `// Quick mode: checks 1-9 and 12. Full mode (--full): adds CDN and internal link checks.`
2. Add the import near the other imports: `import { checkPostPreview } from './preview-posts.mjs'`
3. Append to `CHECKS`:

```js
  { num: 12, name: 'post preview', run: (root) => checkPostPreview(root) },
```

- [ ] **Step 4: Run the full safety suites**

Run: `node --test scripts/preview-posts.test.mjs scripts/checkpoint.test.mjs scripts/release-check.test.mjs`
Expected: all PASS (the release-check suite must not regress)

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add scripts/release-check.mjs scripts/preview-posts.test.mjs && git commit -m "feat(release-check): add check 12, post preview approval

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- scripts/release-check.mjs scripts/preview-posts.test.mjs
```

---

### Task 7: CLI (default mode and approve mode)

**Files:**
- Modify: `scripts/preview-posts.mjs`
- Modify: `scripts/preview-posts.test.mjs`

The build-and-serve path is thin orchestration and is exercised manually (per spec). Only `renderReviewPage` gets a unit test.

- [ ] **Step 1: Write the failing test**

Append (extend the module import with `renderReviewPage`):

```js
test('renderReviewPage links every target against the given host and port', () => {
  const html = renderReviewPage(['/', '/posts/alpha/'], { host: 'localhost', port: '4322' })
  assert.match(html, /href="http:\/\/localhost:4322\/"/)
  assert.match(html, /href="http:\/\/localhost:4322\/posts\/alpha\/"/)
  assert.match(html, /dark mode/i)
  assert.match(html, /language/i)
  assert.doesNotMatch(html, /\u2014/) // no em-dashes in user-facing copy
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test scripts/preview-posts.test.mjs`
Expected: FAIL, `renderReviewPage` is not exported

- [ ] **Step 3: Implement the review page and the CLI**

Extend imports: `spawn, spawnSync` from `node:child_process`, `networkInterfaces` from `node:os`, `pathToFileURL` from `node:url`, `parseArgs` from `node:util`. Then add:

```js
export function renderReviewPage(targets, { host, port }) {
  const items = targets
    .map((t) => `      <li><a href="http://${host}:${port}${t}" target="_blank">${t}</a></li>`)
    .join('\n')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Post preview review</title>
<style>
  body { font: 16px/1.6 system-ui, sans-serif; max-width: 40rem; margin: 3rem auto; padding: 0 1rem; }
  li { margin: 0.4rem 0; }
</style>
</head>
<body>
<h1>Review these pages</h1>
<ul>
${items}
</ul>
<h2>Checklist</h2>
<ul>
  <li>Both languages (use the language toggle)</li>
  <li>Dark mode and light mode</li>
  <li>A narrow window or a real phone</li>
  <li>Images load and grids lay out correctly</li>
</ul>
<p>When everything looks right, approve with: <code>npm run preview-posts -- --approve</code></p>
</body>
</html>
`
}

function localIp() {
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) return a.address
    }
  }
  return null
}

// CLI entry (pathToFileURL handles spaces in the repo path)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({
    options: {
      approve: { type: 'boolean', default: false },
      port: { type: 'string', default: '4322' },
      host: { type: 'boolean', default: false },
      'no-open': { type: 'boolean', default: false },
    },
  })
  const root = git(['rev-parse', '--show-toplevel'])
  const baseRef = resolveBaseRef(root)
  const changeSet = computeChangeSet(root, { baseRef })

  if (values.approve) {
    if (changeSet.length === 0) {
      console.error('nothing to approve: no preview-relevant changes vs ' + baseRef)
      process.exit(1)
    }
    writeManifest(root, hashChangeSet(root, changeSet), { baseRef })
    console.log(`approved ${changeSet.length} file(s); release-check check 12 passes until any of them change`)
    process.exit(0)
  }

  if (changeSet.length === 0) {
    console.log('nothing to preview: no preview-relevant changes vs ' + baseRef)
    process.exit(0)
  }
  console.log(`preview-relevant changes vs ${baseRef} (${changeSet.length}):`)
  for (const p of changeSet) console.log('  ' + p)

  console.log('\nbuilding production output...')
  const build = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' })
  if (build.status !== 0) {
    console.error('build failed; fix it before previewing')
    process.exit(build.status ?? 1)
  }

  const host = values.host ? localIp() || 'localhost' : 'localhost'
  const targets = reviewTargets(root, changeSet)
  const reviewFile = join(root, '.preview', 'review.html')
  mkdirSync(join(root, '.preview'), { recursive: true })
  writeFileSync(reviewFile, renderReviewPage(targets, { host, port: values.port }))

  const serverArgs = ['astro', 'preview', '--port', values.port]
  if (values.host) serverArgs.push('--host')
  const server = spawn('npx', serverArgs, { cwd: root, stdio: 'inherit' })

  console.log(`\nreview page: ${reviewFile}`)
  console.log(`server: http://${host}:${values.port}/`)
  console.log('when everything looks right: npm run preview-posts -- --approve')
  console.log('stop the server with Ctrl+C\n')
  if (!values['no-open']) spawnSync('open', [reviewFile])

  server.on('exit', (code) => process.exit(code ?? 0))
}
```

- [ ] **Step 4: Run the tests, then verify the CLI manually**

Run: `node --test scripts/preview-posts.test.mjs`
Expected: PASS (19 tests)

Manual smoke test in the real repo (do NOT run `--approve`):

```bash
node scripts/preview-posts.mjs --no-open --port 4323 &
code=000
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4323/ || true)
  [ "$code" = "200" ] && break
  sleep 5
done
echo "status=$code"
kill %1
```

Expected: the script lists the current change set (this checkout usually has post edits in flight), runs a full build (can take a few minutes, hence the poll loop), prints the review page path and server URL, and the loop ends with `status=200`. Also `cat .preview/review.html` and confirm the target list looks sane.

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add scripts/preview-posts.mjs scripts/preview-posts.test.mjs && git commit -m "feat(preview): add preview-posts CLI with review page and approve mode

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- scripts/preview-posts.mjs scripts/preview-posts.test.mjs
```

---

### Task 8: npm scripts and .gitignore

**Files:**
- Modify: `package.json` (scripts block)
- Modify: `.gitignore` (repo-specific additions block)

- [ ] **Step 1: Edit package.json**

Add below the `"preview"` script line:

```json
    "preview-posts": "node scripts/preview-posts.mjs",
```

Change the `test:safety` line to:

```json
    "test:safety": "node --test scripts/checkpoint.test.mjs scripts/release-check.test.mjs scripts/preview-posts.test.mjs",
```

- [ ] **Step 2: Edit .gitignore**

In the `# repo-specific additions` block, add:

```
.preview/
```

- [ ] **Step 3: Verify**

Run: `npm run test:safety`
Expected: all three suites PASS

Run: `git check-ignore .preview/manifest.json`
Expected: prints the path (it is ignored)

- [ ] **Step 4: Commit**

```bash
git branch --show-current
git add package.json .gitignore && git commit -m "chore(preview): wire preview-posts into npm scripts and gitignore

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- package.json .gitignore
```

---

### Task 9: Skill and docs

**Files:**
- Create: `.claude/skills/preview-posts/SKILL.md`
- Modify: `.claude/skills/release-check/SKILL.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Create `.claude/skills/preview-posts/SKILL.md`**

```markdown
---
name: preview-posts
description: Serve the production build so the owner can review changed posts in their own browser before anything ships. Use whenever post or template work is heading toward a push to main; release-check check 12 is NO-GO without an approval from this flow.
---

# Post preview

The owner reviews every preview-relevant change in a real browser against the real production build before it can ship. Approval is recorded as content hashes in `.preview/manifest.json` (git-ignored); any later edit voids it automatically.

## Workflow

1. Run `npm run preview-posts`. It builds, serves `dist/` on port 4322, and opens `.preview/review.html` listing every page to review. Use `--host` to print a LAN URL for review on a real phone, `--port` to avoid a collision, `--no-open` in headless sessions.
2. Hand the owner the review link(s). They browse the actual site: both languages, dark mode, narrow width.
3. Apply any edits the owner requests, then run the preview again (rebuild picks up the changes). Repeat until the owner is satisfied.
4. Only after the owner explicitly approves (for example says "approved" in chat), run `npm run preview-posts -- --approve`. Never approve unprompted, and never approve changes the owner has not seen.
5. Release-check check 12 verifies the approval covers the exact current files. It SKIPs when nothing preview-relevant changed.

## Rules

- Approval is the owner's decision. The tool never self-approves and neither do you.
- `.preview/` is shared across concurrent sessions, last writer wins; an approval only ever covers the current bytes, so concurrent edits void it naturally.
- This gate does not replace the release checklist or the push rule: pushing stays a human decision after a GO verdict.
```

- [ ] **Step 2: Update `.claude/skills/release-check/SKILL.md`**

In the "Quick mode (default)" section, change the sentence listing the checks from "(checks 1 to 9)" to "(checks 1 to 9, plus check 12: post preview approval)". After the numbered list, add:

```markdown
If check 12 fails, preview-relevant files changed without an owner-approved preview: run `npm run preview-posts`, let the owner review in the browser, then `npm run preview-posts -- --approve` once they approve (see the preview-posts skill).
```

- [ ] **Step 3: Update `CLAUDE.md`**

Add a row to the commands table after the `npm run dev` row:

```markdown
| `npm run preview-posts` | Build and serve the site for owner review of changed posts; `-- --approve` records the approval (see Safety) |
```

Add to the Safety section, after the release checklist bullet:

```markdown
- **Post preview gate** (`npm run preview-posts`, skill: `.claude/skills/preview-posts/`): the owner reviews every changed post in the browser against the production build; approval is hash-keyed in git-ignored `.preview/` and release-check check 12 is NO-GO without it.
```

- [ ] **Step 4: Verify docs render sanely and contain no em-dashes**

Run: `grep -n $'\xe2\x80\x94' CLAUDE.md .claude/skills/preview-posts/SKILL.md .claude/skills/release-check/SKILL.md docs/superpowers/plans/2026-07-15-post-preview-gate.md; echo "exit=$?"`
Expected: no matches, `exit=1` (the grep pattern is the em-dash as escaped UTF-8 bytes so neither this plan nor the command itself can self-match)

- [ ] **Step 5: Commit**

```bash
git branch --show-current
git add .claude/skills/preview-posts/SKILL.md .claude/skills/release-check/SKILL.md CLAUDE.md && git commit -m "docs(preview): document the post preview gate and skill

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- .claude/skills/preview-posts/SKILL.md .claude/skills/release-check/SKILL.md CLAUDE.md
```

---

### Task 10: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full test run**

Run: `npm run test:safety && npm run test:images && npm run test:rehype && npm run lint`
Expected: all PASS (lint must accept the new script; fix any style complaints, the repo lints `*.mjs` at the root only per the lint script glob `"*.mjs"` plus `src/`, so `scripts/` files follow the existing conventions of neighboring scripts)

- [ ] **Step 2: Check 12 behaves correctly in the real repo**

Run: `node -e "import(String(new URL('file://' + process.cwd().replaceAll(' ', '%20') + '/scripts/preview-posts.mjs'))).then(m => console.log(JSON.stringify(m.checkPostPreview(process.cwd()), null, 2)))"`

Simpler alternative from the repo root:

```bash
node --input-type=module -e "
import { checkPostPreview } from './scripts/preview-posts.mjs'
console.log(JSON.stringify(checkPostPreview(process.cwd()), null, 2))
"
```

Expected: `FAIL` if the working tree has unapproved post changes (correct: nobody has previewed them), or `SKIP` if the tree is clean of preview-relevant changes. Do NOT approve to make it pass.

- [ ] **Step 3: Report**

Summarize for the owner: what was built, the commands, and that the first real use is the next post push (release-check will now demand a preview approval). Do not push; pushing this tooling to main is the owner's call after a release-check GO.
