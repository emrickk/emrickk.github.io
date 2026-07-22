// Fast-lane checks for scoped publishes (ship --fast): validate exactly the
// files being shipped, in place of the full release checklist. The rationale
// and consequence model live in the ship spec; the short version is that the
// deploy build on GitHub Actions remains the final gate, the live site never
// breaks on a failed deploy, and these checks catch the realistic ways a
// post file can fail that build (frontmatter shape, hero path, protected
// mismatch) plus accidental secrets, in well under a second.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { parseFrontmatter } from './post-editor/api.mjs'
import { loadAllowlist, scanTextForSecrets } from './release-check.mjs'

const SIBLING_RE = /\.(zh|en)\.(md|mdx)$/
const LANGS = ['zh', 'en']

function normalizeBool(value) {
  if (value === undefined || value === '') return false
  return String(value) === 'true'
}

// Path of the counterpart translation file on disk, or null when none exists.
export function siblingOnDisk(root, relPath) {
  const sibling = SIBLING_RE.test(relPath)
    ? [relPath.replace(SIBLING_RE, '.$2')]
    : LANGS.map((lang) => relPath.replace(/\.(md|mdx)$/, `.${lang}.$1`))
  for (const candidate of sibling) {
    if (candidate !== relPath && existsSync(path.join(root, candidate))) return candidate
  }
  return null
}

// Frontmatter shape of one post file against the collection contract in
// src/content.config.ts. Deliberately pragmatic: required fields, date
// parseability, hero existence, protected parity with the on-disk sibling.
export function validatePostFile(root, relPath) {
  const errors = []
  const abs = path.join(root, relPath)
  if (!existsSync(abs)) return [`${relPath}: file not found`]
  const raw = readFileSync(abs, 'utf8')
  if (!/^---\r?\n/.test(raw)) return [`${relPath}: no frontmatter block`]
  const fm = parseFrontmatter(raw)

  const requireString = (key) => {
    if (fm[key] === undefined || String(fm[key]).trim() === '') {
      errors.push(`${relPath}: missing required field ${key}`)
    }
  }

  if (SIBLING_RE.test(relPath)) {
    requireString('translationKey')
    if (!LANGS.includes(fm.lang)) {
      errors.push(`${relPath}: lang must be zh or en`)
    }
  } else {
    requireString('title')
    requireString('description')
    requireString('pubDate')
    if (fm.pubDate && Number.isNaN(Date.parse(fm.pubDate))) {
      errors.push(`${relPath}: pubDate does not parse as a date (${fm.pubDate})`)
    }
    if (fm.updatedDate && Number.isNaN(Date.parse(fm.updatedDate))) {
      errors.push(`${relPath}: updatedDate does not parse as a date (${fm.updatedDate})`)
    }
    if (fm.lang && !LANGS.includes(fm.lang)) {
      errors.push(`${relPath}: lang must be zh or en`)
    }
    if (fm.heroImage) {
      const heroAbs = path.resolve(path.dirname(abs), fm.heroImage)
      if (!existsSync(heroAbs)) {
        errors.push(`${relPath}: heroImage not found on disk (${fm.heroImage})`)
      }
    }
  }

  // protected must match between the pair or the build refuses the post
  const siblingPath = siblingOnDisk(root, relPath)
  if (siblingPath) {
    const siblingFm = parseFrontmatter(readFileSync(path.join(root, siblingPath), 'utf8'))
    if (normalizeBool(fm.protected) !== normalizeBool(siblingFm.protected)) {
      errors.push(
        `${relPath}: protected flag differs from ${siblingPath}; set it in both files`,
      )
    }
  }

  return errors
}

// All fast-lane findings for a scoped change set: frontmatter shape per
// file plus a secret scan limited to the shipped files. Empty array = go.
export function runFastChecks(root, changeSet) {
  const errors = changeSet.flatMap((relPath) => validatePostFile(root, relPath))
  const allowlist = loadAllowlist(root)
  for (const relPath of changeSet) {
    const abs = path.join(root, relPath)
    if (!existsSync(abs)) continue
    for (const finding of scanTextForSecrets(readFileSync(abs, 'utf8'), relPath, allowlist)) {
      errors.push(`${finding.file}:${finding.line} possible secret ${finding.pattern} ${finding.redacted}`)
    }
  }
  return errors
}
