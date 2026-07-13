import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadEnvFile, loadConfig } from './config.mjs'
import { makeClient, putObject, objectExists } from './r2.mjs'

loadEnvFile()
let config = null
try { config = loadConfig() } catch { /* no creds -> skip below */ }

test('put then head round-trips against R2 (live)', { skip: config ? false : 'no R2 creds in env' }, async () => {
  const client = makeClient(config)
  const key = `_smoketest/hello-${process.pid}.txt`
  await putObject(client, config.bucket, key, Buffer.from('hi'), 'text/plain')
  assert.equal(await objectExists(client, config.bucket, key), true)
  assert.equal(await objectExists(client, config.bucket, `_smoketest/missing-${process.pid}`), false)
})
