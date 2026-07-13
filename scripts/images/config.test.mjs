import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadConfig } from './config.mjs'

const good = {
  R2_ACCOUNT_ID: 'acct',
  R2_ACCESS_KEY_ID: 'key',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET: 'anping-blog-images',
  R2_PUBLIC_BASE: 'https://cdn.anping.us/',
}

test('loadConfig normalizes and returns config', () => {
  const c = loadConfig(good)
  assert.equal(c.publicBase, 'https://cdn.anping.us') // trailing slash stripped
  assert.equal(c.bucket, 'anping-blog-images')
  assert.equal(c.accountId, 'acct')
  assert.equal(c.nasArchivePath, null) // NAS_ARCHIVE_PATH unset
})

test('loadConfig throws listing every missing var', () => {
  const bad = { ...good }
  delete bad.R2_BUCKET
  delete bad.R2_SECRET_ACCESS_KEY
  assert.throws(() => loadConfig(bad), /R2_BUCKET/)
  assert.throws(() => loadConfig(bad), /R2_SECRET_ACCESS_KEY/)
})
