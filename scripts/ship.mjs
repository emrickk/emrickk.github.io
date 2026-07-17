// One-command publish for post edits: chains checkpoint, purity check,
// production preview, owner approval, release checks, commit, push, and a
// deploy watch. Two entry points share this file: the owner runs it
// interactively, and the ship-posts skill drives it with --preflight then
// --yes --digest after the owner approves in chat. Spec:
// docs/superpowers/specs/2026-07-16-ship-command-design.md
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import { git, save } from './checkpoint.mjs'
import {
  computeChangeSet,
  hashChangeSet,
  renderReviewPage,
  resolveBaseRef,
  reviewTargets,
  slugForPostFile,
  writeManifest,
} from './preview-posts.mjs'
import { runChecks, verdict } from './release-check.mjs'

const POSTS_PREFIX = 'src/content/posts/'
const ACTIONS_URL = 'https://github.com/emrickk/emrickk.github.io/actions'
const USAGE =
  'usage: npm run ship -- [--preflight] [--yes --digest <d>] [--message <msg>] [--port N] [--no-open]'

export function partitionPurity(paths) {
  return {
    posts: paths.filter((p) => p.startsWith(POSTS_PREFIX)).sort(),
    other: paths.filter((p) => !p.startsWith(POSTS_PREFIX)).sort(),
  }
}

// Freshness token binding an approval to the exact reviewed content: 12 hex
// chars of a sha256 over the sorted path:hash entries, newline-joined. Not a
// security boundary.
export function changeSetDigest(files) {
  const entries = Object.keys(files)
    .sort()
    .map((p) => `${p}:${files[p]}`)
  return createHash('sha256').update(entries.join('\n')).digest('hex').slice(0, 12)
}

export function commitMessageFor(changeSet) {
  const slugs = [...new Set(changeSet.map((p) => slugForPostFile(p)))]
  return `post: update ${slugs.join(', ')}`
}
