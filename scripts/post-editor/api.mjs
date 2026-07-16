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
