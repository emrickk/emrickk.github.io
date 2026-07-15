#!/usr/bin/env node
// Post preview gate: build the production site, serve it for the owner to
// review changed posts in a real browser, and record approval as content
// hashes so release-check check 12 can enforce that nothing preview-relevant
// ships unseen. Design: docs/superpowers/specs/2026-07-15-post-preview-gate-design.md
// This script never pushes and never approves on its own.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

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

// Must track Astro's glob-loader id generation (the route is post.id). For
// dotted or nested filenames, check what ids Astro actually generates rather
// than trusting this filename-minus-extension shorthand.
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
// output and manifest comparison. -z output with NUL splitting keeps
// non-ASCII paths verbatim (default core.quotepath=true would C-quote them
// and they would silently fail classifyPath). The diff call fails closed:
// a git error throws, and release-check turns the throw into a FAIL, rather
// than shrinking the change set to untracked-only.
export function computeChangeSet(root, { baseRef = resolveBaseRef(root) } = {}) {
  const diff = git(['diff', '--no-renames', '--name-only', '-z', baseRef], { cwd: root }) || ''
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z'], { cwd: root }) || ''
  const all = new Set([...diff.split('\0'), ...untracked.split('\0')].filter(Boolean))
  return [...all]
    .filter((path) => {
      const kind = classifyPath(path)
      if (kind === null) return false
      if (kind === 'post' && isDraftPost(root, path)) return false
      return true
    })
    .sort()
}

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
