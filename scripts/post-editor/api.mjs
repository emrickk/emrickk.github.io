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
