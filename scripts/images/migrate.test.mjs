import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { planMigration } from './migrate.mjs'

test('planMigration maps uploads to webp keys and finds markdown edits', () => {
  const work = mkdtempSync(join(tmpdir(), 'mig-'))
  try {
    const uploadsDir = join(work, 'uploads')
    const contentDir = join(work, 'content')
    mkdirSync(join(uploadsDir, '2020', '02'), { recursive: true })
    mkdirSync(join(contentDir, 'posts'), { recursive: true })
    writeFileSync(join(uploadsDir, '2020', '02', 'foo.jpg'), 'x')
    writeFileSync(join(uploadsDir, '2020', '02', 'bar.png'), 'y')
    writeFileSync(
      join(contentDir, 'posts', 'p1.md'),
      'body ![a](/uploads/2020/02/foo.jpg) and ![](/uploads/2020/02/bar.png)\n',
    )
    writeFileSync(join(contentDir, 'posts', 'p2.md'), 'no images here\n')

    const { uploads, edits } = planMigration({ uploadsDir, contentDir, base: 'https://cdn.anping.us' })
    assert.deepEqual(uploads.map((u) => u.key).sort(), ['2020/02/bar.webp', '2020/02/foo.webp'])
    assert.equal(edits.length, 1)
    assert.equal(edits[0].replacements, 2)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
})
