# Blog Safety Tooling: Checkpoints + Release Checklist

**Date:** 2026-07-12
**Status:** Design, awaiting user review
**Repo:** `emrickk/emrickk.github.io` (Astro 6, GitHub Pages, domain `anping.us`)
**Branch:** `safety-tooling` (cut from `main`; nothing merged or pushed without the owner's go-ahead)

## 1. Goal

Two safety features for the blog, both living in this repo:

1. **Checkpoints.** A snapshot-and-revert system so any change to repo files (by the owner, by Claude, or by a script that rewrites hundreds of posts) can be rolled back to a known-good state at file level.
2. **Release checklist.** An agent-executed pre-push verification suite that ends in a clear go/no-go verdict. Pushing to `main` (which auto-deploys to anping.us) remains a human decision; the checklist's job is to make that decision safe.

## 2. Context and constraints

- Deploys are automatic on push to `main` via `.github/workflows/deploy.yml`. There is no staging environment. The pre-push moment is therefore the last safe point to catch problems.
- The repo is public. No secrets, tokens, or reports containing sensitive data may be committed.
- Repo rules (CLAUDE.md): stage explicit paths only, no em-dashes in user-facing copy, never commit `.env.local` / `image-staging/` / `originals/` / `scripts/images/.manifest.json`.
- Post images live on Cloudflare R2 (`cdn.anping.us`), not in the repo. R2 state is out of scope for checkpoints (uploads are additive; the bucket rarely needs revert).
- Existing conventions: Node >= 22, plain `.mjs` scripts under `scripts/`, tests with `node:test`, npm scripts as entry points.

## 3. Component 1: Checkpoint script (`scripts/checkpoint.mjs`)

A zero-dependency Node CLI, exposed as `npm run checkpoint`. Subcommands:

### 3.1 `save [label] [--auto <trigger>] [--quiet]`

Creates a snapshot of the entire working tree: every tracked file plus every untracked file, **excluding** anything matched by `.gitignore` (so `.env.local`, `node_modules/`, `image-staging/`, `originals/`, `dist/` are never captured).

Mechanism: build the snapshot with a **temporary index file** (`GIT_INDEX_FILE` pointing into the scratch/tmp area), `git add -A` into that index, `git write-tree`, then `git commit-tree` with the current `HEAD` as parent. Store the resulting commit as a ref under:

```
refs/checkpoints/<UTC timestamp YYYYMMDD-HHMMSS>-<slug(label)>
```

Properties this guarantees:

- The real index, `HEAD`, branch pointers, and working files are **never touched**. A checkpoint is invisible to `git status`, `git log`, and branch listings.
- Refs under `refs/checkpoints/` are local only. Standard `git push` never sends them, and the public repo never sees them.
- The commit message records metadata: label, trigger (`manual`, `session-start`, `release-check`, `pre-restore`), branch name, and `HEAD` sha at save time.
- **Dedup:** if the new tree hash equals the tree of the most recent checkpoint, skip creating a duplicate (exit 0, message "no changes since last checkpoint"). This keeps auto-triggers from piling up identical snapshots.
- **Auto-prune on save:** keep the newest 50 checkpoints unconditionally; beyond 50, delete refs older than 30 days.
- Works on a repo with no commits yet (no `HEAD` parent) by creating a parentless snapshot commit. Edge case only; this repo has history.

### 3.2 `list`

Prints checkpoints newest first: id (short), age, label, trigger, branch, and a one-line change summary versus the current working tree (`N files differ` computed via `git diff --stat` against the checkpoint tree, or "matches current state").

### 3.3 `diff <id> [-- <path>...]`

Shows what changed between a checkpoint and the current working tree. Default `--stat` summary; `--full` for the complete patch. `<id>` accepts the full ref name, the timestamp prefix, or a unique substring of the label.

### 3.4 `restore <id> [-- <path>...]`

Makes working files match the snapshot:

- **Full restore (no paths):** every file in the checkpoint is written back, and files that exist now but not in the checkpoint are deleted. Ignored files are never touched (the restore set is exactly the checkpoint tree plus currently non-ignored files).
- **Partial restore (with paths):** only the named files/directories are restored; nothing is deleted outside them.

Safety rails, in order:

1. Refuse to run if a merge, rebase, cherry-pick, or bisect is in progress (check for `MERGE_HEAD`, `rebase-merge/`, `rebase-apply/`, `CHERRY_PICK_HEAD`, `BISECT_LOG` in the git dir).
2. Automatically `save` a `pre-restore` checkpoint of the current state first, so every restore is itself revertible.
3. Print a summary of what will change (files modified / added / deleted) and require `--yes` to proceed non-interactively; without `--yes`, prompt for confirmation on a TTY and abort otherwise.

Restore changes **file contents only**. It does not move `HEAD`, rewrite branches, or un-commit anything. If bad changes were already committed, restoring the files still works; the owner then commits the restored state (or uses `git revert`, see section 6).

### 3.5 `prune [--keep <n>] [--days <d>]`

Manual prune with the same defaults as auto-prune (50 / 30 days). Always keeps at least the 5 newest regardless of age.

## 4. Component 2: Automatic triggers

1. **Session start:** `.claude/settings.json` in the repo gains a `SessionStart` hook running `node scripts/checkpoint.mjs save session-start --auto session-start --quiet`. Every Claude session opened in this repo starts from a restorable state. Dedup (3.1) makes this a no-op when nothing changed. The hook must be fast (target under 2 seconds on this repo) and must never block a session on failure: any error exits 0 with a one-line warning.
2. **Release check:** the release checklist's first step is always a checkpoint (trigger `release-check`).
3. **Manual:** the `/checkpoint` skill (section 5.3) and `npm run checkpoint save` are available to the owner and to agents before any risky operation.

## 5. Component 3: Release checklist

### 5.1 Deterministic checks (`scripts/release-check.mjs`)

A Node CLI, `npm run release-check [-- --full]`. Runs numbered checks, prints PASS / FAIL / SKIP per check with a reason, exits non-zero if any check fails. Quick mode:

| # | Check | Detail |
|---|---|---|
| 1 | Checkpoint | `checkpoint save release-check` succeeded (or dedup no-op) |
| 2 | Git hygiene | No forbidden files tracked or staged (`.env.local`, `image-staging/`, `originals/`, `scripts/images/.manifest.json`); working tree state printed for the report |
| 3 | Secret scan | Uncommitted changes and commits not on `origin/main` contain no high-entropy tokens or known credential patterns (AWS/R2 keys, `ghp_`/`github_pat_`, private key blocks, `SECRET_ACCESS_KEY=` style assignments). Heuristic, with a documented allowlist file for false positives |
| 4 | Types | `npm run check` (astro check) |
| 5 | Lint | `npm run lint` and `npm run lint:css` |
| 6 | Build | `npm run build` (includes Pagefind index) |
| 7 | Image tests | `npm run test:images` (R2 live test self-skips without credentials, reported as SKIP) |
| 8 | Built output | In `dist/`: no `/uploads/` references, no `localhost` or `127.0.0.1` URLs, `rss.xml` and `sitemap-index.xml` exist and are non-empty, page count within sanity bounds (at least 300 HTML pages), Pagefind index present |

Full mode adds:

| # | Check | Detail |
|---|---|---|
| 9 | CDN images | Extract every `cdn.anping.us` URL from `dist/` (HTML and RSS), HEAD each with bounded concurrency (10 parallel, 2 retries), report every non-200 |
| 10 | Internal links | Every internal `href`/`src` in `dist/` HTML resolves to a file in `dist/` (with `/path/` to `/path/index.html` normalization); anchors-only and external links skipped |

Checks 4 to 7 reuse the existing npm scripts rather than reimplementing them. The script is safe to run repeatedly and makes no network calls except in check 9.

### 5.2 Agent-executed layer (`/release-check` skill)

A project skill at `.claude/skills/release-check/SKILL.md`. When invoked (`/release-check` or `/release-check full`), the agent:

1. Runs `scripts/release-check.mjs` (with `--full` when requested) and parses the results.
2. **Full mode only:** starts the built site preview and drives a browser smoke test: homepage renders with correct post list, one image-bearing post loads with images from `cdn.anping.us`, Pagefind search returns results for a known query, the language toggle switches title and body, the giscus comment iframe is present, dark mode renders. Takes a screenshot as proof. The preview must serve `dist/` (the production build), not the dev server.
3. Synthesizes a single report in chat: table of every check with PASS/FAIL/SKIP, the screenshot (full mode), and a final verdict line: **GO: safe to push** or **NO-GO** with the blocking items listed first.
4. **Never pushes, merges, or tags.** The skill text states this explicitly; the checklist ends at the verdict.

Reports are chat-only. Nothing is written to the repo (public repo; also avoids report churn in git).

### 5.3 `/checkpoint` skill

A thin project skill at `.claude/skills/checkpoint/SKILL.md` documenting the four operations with exact commands, when to checkpoint (before mass rewrites, before merges, before running unfamiliar scripts), and the restore safety rails. It exists so any future agent session discovers the tool and uses it instead of inventing ad-hoc backups.

## 6. Post-deploy rollback (documentation, not code)

If a bad state reaches `main` and deploys to anping.us: `git revert <bad commit(s)>` on `main`, push, and the existing Pages workflow redeploys the previous good state in a few minutes. This procedure is documented in the release-check skill and in CLAUDE.md's new Safety section, with the distinction spelled out: checkpoints cover pre-push file state; `git revert` covers post-push history.

## 7. Repo integration

- `package.json`: add `"checkpoint": "node scripts/checkpoint.mjs"` and `"release-check": "node scripts/release-check.mjs"`; test scripts join the existing pattern (`"test:safety": "node --test scripts/checkpoint.test.mjs scripts/release-check.test.mjs"`).
- `.claude/settings.json`: SessionStart hook (section 4). The currently untracked `.claude/launch.json` stays untracked; only `settings.json` and `skills/` are committed.
- `CLAUDE.md`: new short "Safety" section pointing at both tools, the two skills, and the rollback procedure.
- No changes to CI workflows.

## 8. Testing

`node:test`, following `scripts/images/*.test.mjs` conventions. All tests run against **temporary git repos created in the test** (never this repo), via a fixture helper.

**checkpoint.test.mjs:**
- save captures tracked modifications and untracked files; ignored files excluded
- save leaves `git status`, index, and HEAD byte-identical
- dedup: second save with no changes creates no new ref
- list and diff report the expected files
- full restore round-trip: mutate, save, mutate again (including adding a new file), restore, tree matches snapshot exactly (new file deleted)
- partial restore touches only named paths
- restore refuses during an in-progress merge
- restore auto-creates the pre-restore checkpoint
- prune keeps newest 50 and the 5-newest floor

**release-check.test.mjs:**
- forbidden-file detection (fixture repo with `.env.local` staged)
- secret scan catches a planted fake key and respects the allowlist
- built-output checks against a small fixture `dist/` (missing rss, `/uploads/` reference, localhost URL each fail; clean fixture passes)
- link extraction and normalization for check 10
- CDN check tested against a local HTTP stub server, not live R2

Checks 4 to 7 (delegated npm scripts) are not re-tested; they have their own tooling.

## 9. Error handling

- Both scripts exit non-zero on failure with a one-line human-readable reason; no stack traces for expected failures.
- The SessionStart hook never blocks a session (section 4.1).
- `restore` and `prune` are the only destructive operations; both have rails (confirmation, pre-restore checkpoint, keep-floor).
- If `git` is missing or the cwd is not the blog repo root, fail immediately with a clear message.

## 10. Out of scope

- R2 bucket revert or object versioning
- Whole-folder backup copies
- CI workflow changes
- Auto-push or auto-merge of any kind
- Reverting git history (checkpoints restore files; history stays append-only)

## 11. Merge plan

Everything lands on branch `safety-tooling` in the `blog-safety-tooling` worktree. The owner reviews and merges to `main` when ready (this tooling has no conflicts with content work; it only adds files plus two `package.json` scripts and a CLAUDE.md section).
