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
