// Test fixtures for the safety tooling suites. Creates throwaway git repos
// and dist trees under the OS tmpdir; never touches the real repo.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

export function run(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

export function write(root, rel, content) {
  const p = join(root, rel)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, content)
}

export function makeFixtureRepo() {
  const root = mkdtempSync(join(tmpdir(), 'blog-safety-fixture-'))
  run(root, ['init', '-q', '-b', 'main'])
  run(root, ['config', 'user.email', 'test@local'])
  run(root, ['config', 'user.name', 'test'])
  write(root, '.gitignore', 'ignored.txt\nnode_modules/\n')
  write(root, 'tracked.md', 'original\n')
  run(root, ['add', '.gitignore', 'tracked.md'])
  run(root, ['commit', '-q', '-m', 'init'])
  return root
}

export function cleanup(root) {
  rmSync(root, { recursive: true, force: true })
}

// Minimal valid dist tree for release-check output tests. Pass overrides to
// plant violations or omit required files.
export function makeFixtureDist(root, { omit = [], extraHtml = {} } = {}) {
  const dist = join(root, 'dist')
  const files = {
    'index.html': '<html><body><a href="/posts/a/">a</a></body></html>',
    'posts/a/index.html':
      '<html><body><img src="https://cdn.anping.us/2020/02/foo.webp"><a href="/">home</a></body></html>',
    'rss.xml': '<rss><channel><title>t</title></channel></rss>',
    'sitemap-index.xml': '<sitemapindex></sitemapindex>',
    'pagefind/pagefind.js': '// pagefind stub',
    ...extraHtml,
  }
  for (const [rel, content] of Object.entries(files)) {
    if (omit.includes(rel)) continue
    write(root, join('dist', rel), content)
  }
  return dist
}
