import sharp from 'sharp'

const MAX_WIDTH = 2000
const WEBP_QUALITY = 80

export async function optimizeToWebp(input, { maxWidth = MAX_WIDTH, quality = WEBP_QUALITY } = {}) {
  const { data, info } = await sharp(input, { failOn: 'error' })
    .rotate() // apply EXIF orientation before metadata is stripped
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer({ resolveWithObject: true })
  return { buffer: data, width: info.width, height: info.height, bytes: data.length }
}
