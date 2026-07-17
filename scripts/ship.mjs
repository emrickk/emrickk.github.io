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

// Everything a push would carry, unfiltered: worktree diff vs the base ref,
// untracked files, and the committed-only view (which catches a commit whose
// working-tree content was reverted without resetting the commit; the diff
// shows nothing for it, the push still carries it).
export function rawDiffPaths(root, baseRef) {
  const list = (args) => (git(args, { cwd: root }) || '').split('\0').filter(Boolean)
  return [
    ...new Set([
      ...list(['diff', '--no-renames', '--name-only', '-z', baseRef]),
      ...list(['ls-files', '--others', '--exclude-standard', '-z']),
      ...list(['diff', '--no-renames', '--name-only', '-z', `${baseRef}...HEAD`]),
    ]),
  ].sort()
}

// ahead counts commits that exist only on origin/main.
export function originStatus(root) {
  const hasOrigin = Boolean(
    git(['rev-parse', '--verify', '-q', 'origin/main'], { cwd: root, allowFail: true }),
  )
  if (!hasOrigin) return { hasOrigin, ahead: 0 }
  const counts = git(['rev-list', '--left-right', '--count', 'origin/main...main'], { cwd: root })
  return { hasOrigin, ahead: Number(counts.split(/\s+/)[0] || '0') }
}

// Spec step 1. Returns a plain result so every branch is testable:
// status 'abort' (exit 1), 'empty' (exit 0), or 'ok' with changeSet and
// digest. Fetch failures warn and fall back to the last-known origin/main.
export function preflight(root, { fetch = true } = {}) {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root })
  if (branch !== 'main') {
    return { status: 'abort', detail: `on branch ${branch}; ship only runs on main` }
  }
  if (fetch && originStatus(root).hasOrigin) {
    try {
      git(['fetch', 'origin'], { cwd: root })
    } catch {
      console.error('warning: could not fetch origin; comparing against the last-known origin/main')
    }
  }
  const { hasOrigin, ahead } = originStatus(root)
  if (hasOrigin && ahead > 0) {
    return {
      status: 'abort',
      detail:
        `origin/main has ${ahead} commit(s) not in local main; ` +
        'reconcile in a Claude session (or git pull --rebase when comfortable) before shipping',
    }
  }
  const baseRef = resolveBaseRef(root)
  const { other } = partitionPurity(rawDiffPaths(root, baseRef))
  if (other.length > 0) {
    return {
      status: 'abort',
      detail:
        'ship only publishes post edits, but these changed too:\n  ' +
        other.join('\n  ') +
        '\nhandle this in a Claude session instead',
    }
  }
  const changeSet = computeChangeSet(root, { baseRef })
  if (changeSet.length === 0) {
    return { status: 'empty', detail: 'nothing to ship', baseRef }
  }
  return { status: 'ok', baseRef, changeSet, digest: changeSetDigest(hashChangeSet(root, changeSet)) }
}

// The only git mutations in ship: one explicit-path commit and one push.
// The trailer marks agent-driven runs (CLAUDECODE is set in Claude Code's
// shell); owner-run ships produce a plain authored commit.
export function commitAndPush(
  root,
  changeSet,
  { message, trailer = Boolean(process.env.CLAUDECODE), push = true } = {},
) {
  const body = trailer
    ? `${message}\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
    : message
  git(['add', '--', ...changeSet], { cwd: root })
  git(['commit', '-q', '-m', body, '--', ...changeSet], { cwd: root })
  const sha = git(['rev-parse', 'HEAD'], { cwd: root })
  if (push) git(['push', '-q', 'origin', 'main'], { cwd: root })
  return sha
}

// Tracks the currently spawned preview server so a signal (Ctrl+C, external
// SIGTERM) can still stop it even though it bypasses the `finally` in main.
// Only ever set by the CLI entry's signal handlers; importing this module
// for its exports never touches it.
let activeServer = null

// The preview server is spawned detached (its own process group) because npx
// is the direct child and astro the grandchild; killing just npx orphans the
// server on the port. Killing the negated pid signals the whole group.
function stopServer(server) {
  if (!server || server.exitCode !== null || server.signalCode !== null) return
  try {
    process.kill(-server.pid, 'SIGTERM')
  } catch {
    server.kill()
  }
}

// Poll until the preview server answers, so the review link works when it is
// printed. Never fatal: the owner can still decline if it never comes up.
async function waitForServer(url, { intervalMs = 500, timeoutMs = 15000 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(intervalMs) })
      return true
    } catch {
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
  }
  return false
}

async function watchDeploy(root, sha, slugs) {
  const deadline = Date.now() + 5 * 60 * 1000
  while (Date.now() < deadline) {
    let runs
    try {
      runs = JSON.parse(
        execFileSync(
          'gh',
          ['run', 'list', '--workflow', 'deploy.yml', '--limit', '1', '--json', 'status,conclusion,headSha'],
          { cwd: root, encoding: 'utf8' },
        ),
      )
    } catch {
      console.log('gh unavailable; watch the deploy at ' + ACTIONS_URL)
      return
    }
    const run = runs[0]
    if (run && run.headSha === sha && run.status === 'completed') {
      if (run.conclusion === 'success') {
        console.log('deploy complete:')
        for (const slug of slugs) console.log(`  https://theneverless.com/posts/${slug}/`)
      } else {
        console.log(`deploy finished with conclusion ${run.conclusion}; inspect ${ACTIONS_URL}`)
      }
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 10000))
  }
  console.log('deploy watch timed out after 5 minutes; check ' + ACTIONS_URL)
}

export async function main(values) {
  const root = git(['rev-parse', '--show-toplevel'])
  if (values.yes && !values.digest) {
    console.error('--yes requires --digest <d> from a prior --preflight run')
    console.error(USAGE)
    return 1
  }
  save(root, { trigger: 'ship', quiet: true })
  const pre = preflight(root)
  if (pre.status === 'abort') {
    console.error(pre.detail)
    return 1
  }
  if (pre.status === 'empty') {
    console.log(pre.detail)
    return 0
  }
  console.log(`post change(s) vs ${pre.baseRef} (${pre.changeSet.length}):`)
  for (const p of pre.changeSet) console.log('  ' + p)
  console.log(`changeset digest: ${pre.digest}`)
  if (values.preflight) return 0

  let server = null
  try {
    if (!values.yes) {
      // The build also runs inside release-check later; the duplication is
      // the accepted cost of reusing the gates unmodified.
      console.log('\nbuilding production output...')
      const build = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' })
      if (build.status !== 0) {
        console.error('build failed; fix it before shipping')
        return 1
      }
      const reviewFile = join(root, '.preview', 'review.html')
      mkdirSync(join(root, '.preview'), { recursive: true })
      writeFileSync(
        reviewFile,
        renderReviewPage(reviewTargets(root, pre.changeSet), { host: 'localhost', port: values.port }),
      )
      server = spawn('npx', ['astro', 'preview', '--port', values.port], {
        cwd: root,
        stdio: ['ignore', 'ignore', 'inherit'],
        detached: true,
      })
      server.on('error', (err) => {
        console.error(`could not start the preview server: ${err.message}`)
      })
      activeServer = server
      if (!(await waitForServer(`http://localhost:${values.port}/`))) {
        console.error('warning: the review server did not come up; you can still answer N')
      }
      console.log(`\nreview page: ${reviewFile}`)
      console.log(`server: http://localhost:${values.port}/`)
      if (!values['no-open']) spawnSync('open', [reviewFile])
      const rl = createInterface({ input: process.stdin, output: process.stdout })
      const answer = (
        await rl.question(`\napprove these ${pre.changeSet.length} file(s) and ship? [y/N] `)
      ).trim()
      rl.close()
      if (answer !== 'y') {
        console.log('not approved; nothing recorded')
        return 0
      }
    }

    // Freshness check, both modes: the approval binds to exactly the
    // reviewed content. A concurrent session's post edit (or any new
    // non-post change) landing after the review aborts here.
    const approved = values.yes ? values.digest : pre.digest
    const now = preflight(root, { fetch: false })
    if (now.status !== 'ok' || now.digest !== approved) {
      console.error(
        'the tree changed since the review (another session?); nothing recorded, start over',
      )
      return 1
    }
    writeManifest(root, hashChangeSet(root, now.changeSet), { baseRef: now.baseRef })
    console.log('approval recorded')
    if (server) {
      stopServer(server)
      server = null
      activeServer = null
    }

    console.log('\nrunning release checks...')
    const results = await runChecks(root)
    const summary = verdict(results)
    console.log('\n' + summary)
    if (!summary.startsWith('VERDICT: GO')) return 1

    const sha = commitAndPush(root, now.changeSet, {
      message: values.message || commitMessageFor(now.changeSet),
    })
    console.log(`pushed ${sha.slice(0, 7)} to origin/main`)
    await watchDeploy(root, sha, [...new Set(now.changeSet.map((p) => slugForPostFile(p)))])
    return 0
  } finally {
    stopServer(server)
    activeServer = null
  }
}

// CLI entry (pathToFileURL handles spaces in the repo path)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let values
  try {
    ({ values } = parseArgs({
      options: {
        message: { type: 'string' },
        port: { type: 'string', default: '4322' },
        'no-open': { type: 'boolean', default: false },
        preflight: { type: 'boolean', default: false },
        yes: { type: 'boolean', default: false },
        digest: { type: 'string' },
      },
    }))
  } catch (err) {
    console.error(err.message)
    console.error(USAGE)
    process.exit(1)
  }
  // A signal death (Ctrl+C at the prompt, an external SIGTERM) bypasses the
  // `finally` in main; stop the detached preview server here so it never
  // gets orphaned on the port.
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      stopServer(activeServer)
      process.exit(130)
    })
  }
  main(values).then(
    (code) => process.exit(code),
    (err) => {
      console.error(err.message)
      process.exit(1)
    },
  )
}
