# One-command publish for post edits (npm run ship)

Date: 2026-07-16
Status: Approved by owner (design conversation), pending spec review

## Purpose

After editing posts (typically in the /_edit editor), the owner publishes with a single
memorable command instead of the four-step manual sequence (preview, approve, release-check,
commit and push). `npm run ship` chains the existing gates in order with one human
confirmation in the middle. It automates the sequence, not the judgment: the owner still
looks at the production build and still says yes.

Explicitly out of scope (YAGNI): shipping anything other than post files (no hero images,
notes, templates, config, or dependency changes), auto-rebase or merge when origin/main has
moved, non-interactive or CI mode, partial shipping (choosing a subset of changed posts).

## Constraints

- Rule 5: pushing to main is a human decision. The owner running ship and answering `y` is
  that decision; ship never runs unattended and aborts on anything but an explicit `y`.
- The preview gate's meaning is preserved: the owner reviews the real production build in a
  browser before approving, exactly like `npm run preview-posts`.
- Reuse the existing safety tooling as libraries; do not fork their logic. Everything needed
  is already exported: `computeChangeSet`, `reviewTargets`, `renderReviewPage`,
  `hashChangeSet`, `writeManifest` (scripts/preview-posts.mjs), `runChecks`, `verdict`
  (scripts/release-check.mjs), `save` and `repoRoot` (scripts/checkpoint.mjs).
- Repo rules: explicit-path staging only, no em-dashes anywhere, scripts/ code style
  (no semicolons, single quotes).
- Several agent sessions share this checkout; ship must never sweep up their work.

## The command

`npm run ship` runs `node scripts/ship.mjs`. Flags: `--message <msg>` overrides the commit
message; `--port <n>` overrides the review server port (default 4322, matching preview-posts);
`--no-open` skips opening the browser (prints the URL instead).

### Step 1: preflight (abort early, change nothing)

1. Checkpoint: `save(root, { trigger: 'ship' })`.
2. Branch must be `main`, else abort.
3. `git fetch origin`. If origin/main is ahead of or diverged from local main, abort with:
   the count of remote commits and the advice to reconcile in a Claude session (or
   `git pull --rebase` when comfortable). Ship never rewrites history.
4. Change set: `computeChangeSet(root)` (vs origin/main; includes committed-ahead commits,
   working-tree edits, and untracked files).
   - Empty: print "nothing to ship" and exit 0.
   - Partition into post files (paths under `src/content/posts/`) and everything else.
     If "everything else" is non-empty, abort listing those paths and naming the fallback
     (a Claude session). This guarantees ship only ever publishes post content.
5. Local commits that are already on main but unpushed (committed-ahead state) are allowed
   only if they also touch only `src/content/posts/`; otherwise the partition above catches
   them and ship aborts. (The diff vs origin/main sees committed and uncommitted changes
   identically, so no extra logic is needed; this line documents the behavior.)

### Step 2: review (build, serve, look)

1. Build: run `npm run build` (production build including Pagefind); abort on failure.
2. Serve `dist/` on the chosen port with a minimal static file server (same behavior as
   preview-posts' internal server: path-safe, index.html resolution, 404 otherwise).
3. Write the review page via `reviewTargets` + `renderReviewPage` to `.preview/review.html`
   and open it (macOS `open`), unless `--no-open`.
4. Prompt on stdin: `approve these N file(s) and ship? [y/N]` after printing the exact file
   list. Any answer except `y` stops the server and exits 0 with nothing recorded.

### Step 3: gate

1. On `y`: record the approval, `writeManifest(root, hashChangeSet(root, changeSet),
   { baseRef })`, identical to `npm run preview-posts -- --approve`.
2. Stop the review server, then run `runChecks(root)` (quick mode) and print the per-check
   table like the release-check CLI does. If `verdict(results)` is not GO, print the failing
   checks and abort. Nothing has been committed at this point; the recorded approval is
   harmless (it voids itself on the next file change).

### Step 4: ship

1. Stage and commit exactly the post files from the change set, in one command, explicit
   paths only. Default message: `post: update <slug>` for one post (slug via
   `slugForPostFile`), `post: update <slug1>, <slug2>, ...` for several, deduplicated when a
   primary and its sibling both changed. `--message` overrides. The commit body carries the
   standard Co-Authored-By trailer only when ship is driven by an agent; when the owner runs
   it directly there is no trailer (plain authored commit).
2. Push `origin main`.
3. Watch the GitHub Pages deploy: poll `gh run list --workflow deploy.yml` for the pushed
   SHA until completed (timeout 5 minutes), then print the live URL of each shipped post
   (`https://theneverless.com/posts/<slug>/`) and exit 0. If `gh` is unavailable or the
   watch times out, print the Actions URL and exit 0 anyway; the push already succeeded and
   the deploy outcome is observable there.

## Error handling

Every abort prints one plain-language paragraph: what was found, why ship stopped, what to
do next. Abort exit code is 1 for real failures (dirty preflight, NO-GO, build failure) and
0 for clean declines (nothing to ship, answered N). The review server always stops on exit
(try/finally). Ship never touches files outside `.preview/` and git state, and its only git
mutations are the single commit and the push in step 4.

## Testing

`scripts/ship.test.mjs` (`node:test`, fixture repos from scripts/test-helpers.mjs), added to
the `test:safety` suite, covering the pure decision logic:

- Change-set partition: posts-only sets pass; mixed sets abort with the offending paths.
- Commit message generation: single post, multiple posts, primary + sibling deduplication,
  `--message` override.
- Preflight: non-main branch aborts; behind origin/main aborts; empty change set is a clean
  exit.

The interactive path (serve, prompt, push) is exercised manually; the components it chains
(preview approval hashing, release checks) already have their own suites.

## Documentation

- docs/post-editor.md: replace the manual publish description with a "Shipping your edits"
  section centered on `npm run ship` (keeping the manual steps as a fallback footnote).
- CLAUDE.md commands table: one row for `npm run ship`.
