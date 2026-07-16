import path from 'node:path'

const CONVERT_EXT = new Set(['.jpg', '.jpeg', '.png'])

function sanitize(name) {
  return name.normalize('NFC').replace(/\s+/g, '-').replace(/[^\w.\-]/g, '')
}

function outExtFor(ext) {
  return CONVERT_EXT.has(ext.toLowerCase()) ? '.webp' : ext.toLowerCase()
}

// For NEW uploads: sanitized basename under the current year/month, or under
// a fixed key prefix (e.g. 'notes') when one is given. Sanitizing strips
// non-ASCII, so distinct CJK filenames can sanitize to the same (or an
// empty) base; when sanitizing was lossy the content hash disambiguates the
// key instead of letting two different photos collide on one R2 object.
export function deriveKey(originalName, date, prefix = null, contentHash = null) {
  const ext = path.extname(originalName)
  const raw = path.basename(originalName, ext)
  let base = sanitize(raw)
  const lossless = base === raw.normalize('NFC').replace(/\s+/g, '-')
  if (!lossless || !/[A-Za-z0-9]/.test(base)) {
    const trimmed = base.replace(/^[-_.]+|[-_.]+$/g, '')
    const suffix = contentHash ? contentHash.slice(0, 8) : null
    base = [trimmed, suffix].filter(Boolean).join('-') || 'img'
  }
  if (prefix) return `${prefix.replace(/\/+$/, '')}/${base}${outExtFor(ext)}`
  const yyyy = String(date.getUTCFullYear())
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${yyyy}/${mm}/${base}${outExtFor(ext)}`
}

// For migration: keep the exact path, swap only the extension.
export function keyFromUploadPath(relPath) {
  const ext = path.extname(relPath)
  return relPath.slice(0, relPath.length - ext.length) + outExtFor(ext)
}

export function publicUrl(key, base) {
  return `${base.replace(/\/+$/, '')}/${key}`
}

export function snippetFor(key, base, alt = '') {
  return `![${alt}](${publicUrl(key, base)})`
}

export function rewriteUploads(markdown, base) {
  return markdown.replace(
    /\/uploads\/([^\s)"']+\.(?:jpe?g|png|gif|webp|svg))/gi,
    (_m, rel) => publicUrl(keyFromUploadPath(rel), base),
  )
}
