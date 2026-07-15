#!/usr/bin/env node
// Post preview gate: build the production site, serve it for the owner to
// review changed posts in a real browser, and record approval as content
// hashes so release-check check 12 can enforce that nothing preview-relevant
// ships unseen. Design: docs/superpowers/specs/2026-07-15-post-preview-gate-design.md
// This script never pushes and never approves on its own.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
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
