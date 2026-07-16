import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const MAX_WIDTH = 2000
const WEBP_QUALITY = 80

// Watermark: "© NeVeRtheLeSs" in Futura Medium, white at ~35% opacity with a
// soft shadow, baked into scripts/images/watermark-neverless.png at a 400px em.
// Sized relative to the SHORT side of the output: perception tracks image
// height, so a width-based mark overwhelms landscapes and panoramas while
// looking right on portraits. 3% of min(w, h) keeps portraits at the approved
// size and shrinks wide frames proportionally. Margin scales with the em so
// the corner geometry is identical at every size.
const WATERMARK_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'watermark-neverless.png')
const WATERMARK_SOURCE_EM = 400
const WATERMARK_EM_RATIO = 0.03
const WATERMARK_MARGIN_EM = 2 / 3

const EXIF_TAGS = {
  IFD0: {
    Artist: 'Emrick',
    Copyright: '(c) Emrick, NeVeRtheLeSs (theneverless.com), all rights reserved',
  },
}

async function watermarkLayer(outWidth, outHeight) {
  const em = WATERMARK_EM_RATIO * Math.min(outWidth, outHeight)
  const scale = em / WATERMARK_SOURCE_EM
  const meta = await sharp(WATERMARK_FILE).metadata()
  const margin = Math.max(4, Math.round(em * WATERMARK_MARGIN_EM))
  return sharp(WATERMARK_FILE)
    .resize({ width: Math.max(1, Math.round(meta.width * scale)) })
    .extend({ right: margin, bottom: margin, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}

export async function optimizeToWebp(
  input,
  { maxWidth = MAX_WIDTH, quality = WEBP_QUALITY, watermark = false } = {},
) {
  let pipeline = sharp(input, { failOn: 'error' })
    .rotate() // apply EXIF orientation before metadata is stripped
    .resize({ width: maxWidth, withoutEnlargement: true })

  if (watermark) {
    // Resolve output dimensions first so the overlay can be scaled to them.
    const resized = await pipeline.png().toBuffer()
    const { width, height } = await sharp(resized).metadata()
    const overlay = await watermarkLayer(width, height)
    pipeline = sharp(resized).composite([{ input: overlay, gravity: 'southeast' }])
  }

  const { data, info } = await pipeline
    .keepIccProfile()
    .withExif(EXIF_TAGS)
    .webp({ quality })
    .toBuffer({ resolveWithObject: true })
  return { buffer: data, width: info.width, height: info.height, bytes: data.length }
}
