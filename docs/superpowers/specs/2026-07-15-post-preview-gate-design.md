# Post preview gate

Date: 2026-07-15
Status: Approved design, pending implementation plan

## Problem

Pushing to `main` deploys to https://theneverless.com within minutes, and the owner currently has no required step that shows a changed post exactly as readers will see it before it ships. Recent deploys shipped visual bugs that were only caught on the live site: featured-card titles rendering black on black, image grids collapsing to zero width, and a broken image placeholder on a published post. `npm run release-check` validates that the build succeeds, but nothing forces anyone to look at the rendered result of the specific change being pushed.

The purpose of this feature is a review-and-edit loop: the owner browses the changed posts in the real production build, requests edits, and repeats until satisfied. Only then can release-check pass.

## Decisions already made

These were settled during brainstorming with the owner and are not open questions:

1. Local preview gate, not a staging URL and not a production draft flag.
2. Review happens in the owner's own browser against the served production build, so the review surface is 100 percent what readers will see. No automated screenshots, no Playwright dependency.
3. The gate is enforced by release-check: if preview-relevant files changed and there is no valid approval, the verdict is NO-GO.
4. Approval is a human decision. The owner may say "approved" in chat and let the session run the approve command, but the tool never self-approves.

## Components

### 1. `scripts/preview-posts.mjs` (npm script `preview-posts`)

A CLI with two modes.

**Default mode** (`npm run preview-posts`):

1. Compute the change set (see Change detection below). If it is empty, print "nothing to preview" and exit 0.
2. Run the production build (`astro build` plus Pagefind, same as `npm run build`).
3. Serve `dist/` with `astro preview` on port 4322 by default (`--port` overrides; 4322 avoids colliding with dev servers on 4321). `--host` serves on the LAN and prints the LAN URL so the owner can review on a real phone.
4. Write `.preview/review.html`: a list of review targets as absolute links into the running server, with a short reminder checklist (both languages via the toggle, dark mode, narrow window). Open it with `open` (skippable with `--no-open`).
5. Keep serving until interrupted.

**Approve mode** (`npm run preview-posts -- --approve`):

1. Recompute the change set. If empty, say so and exit 1.
2. Write `.preview/manifest.json`: `{ approvedAt, baseRef: "origin/main", files: { "<repo-relative path>": "<sha256>" } }`. Deleted files record the sentinel value `"deleted"`. `approvedAt` and `baseRef` are informational only; the check 12 comparison uses the `files` map exclusively.

No server or build is required for approve mode; it hashes the files as they are on disk.

### 2. Change detection (shared module)

Exported from `scripts/preview-posts.mjs` so release-check imports the exact same logic.

The change set is the union of `git diff --name-only` against the base (covers commits ahead of origin plus tracked working-tree edits) and untracked files from `git status --porcelain`, filtered to preview-relevant paths. When `origin/main` does not exist (test fixture repos), fall back to `HEAD`, matching the precedent in `scripts/release-check.mjs`; the base ref is injectable for tests.

Amendment (2026-07-15): the diff base is the merge-base of `HEAD` and `origin/main`, not `origin/main` itself. A checkout whose HEAD is behind origin/main (a worktree branched before another session pushed) would otherwise see the remote-only commits as phantom working-tree changes and check 12 would demand approval for content that is already deployed. The merge-base keeps local commits and edits in the change set (fail closed for real work) while excluding remote-only history; whenever the base has commits HEAD lacks, check 12 and the CLI say so explicitly instead of shrinking the change set silently.

- **Post content**: `src/content/posts/*.md` and `*.mdx`. The slug is the filename minus extension, with a trailing `.en` or `.zh` stripped (sibling translation bodies map to the primary post's page). Each changed or added post contributes the review target `/posts/<slug>/`. A deleted post contributes the homepage instead (it should disappear from lists). A post whose current frontmatter has `draft: true` is not preview-relevant at all (no target, no hash entry): it is excluded from the build, so there is nothing to review; flipping `draft` back to false re-includes the file as a normal change.
- **Site-wide**: any other change under `src/` or `public/`, or to `astro.config.mjs`, `package.json`, or `package-lock.json`. Any site-wide change adds two review targets: the homepage `/` and one designated image-heavy representative post (a named constant in the script, currently `springtime-in-patagonia`; update it when a better exemplar exists).
- Everything else (`docs/`, `scripts/`, `.github/`, dotfiles) is not preview-relevant.

The change set used for hashing is the full list of preview-relevant changed files, not just posts, so a CSS edit after approval also invalidates it.

### 3. Release-check integration

New entry in the `CHECKS` array of `scripts/release-check.mjs`: `{ num: 12, name: 'post preview' }`, running in quick mode (it is cheap; it does not build or serve anything).

Logic:

- Recompute the change set with the shared module.
- Empty change set: SKIP with detail "no preview-relevant changes". Typo fixes in docs and script changes stay fast.
- Non-empty: `.preview/manifest.json` must exist and its `files` map must exactly equal the current change set (same keys, same hashes, deletions included). Match: PASS. Missing or mismatched: FAIL with detail "changed files not covered by an approved preview; run npm run preview-posts, review in the browser, then npm run preview-posts -- --approve".

Because approval is keyed to content hashes, any edit after approval, by the owner or by a concurrent agent session, voids it automatically. `.preview/` is a shared last-writer-wins directory across sessions, which is the intended semantics: only the latest approval of the current bytes counts.

**Amendment (2026-07-15): coverage semantics, not exact-match.** The original exact-match rule failed in practice: committing approved files (with identical, owner-reviewed bytes) removes them from the change set once the base ref advances, and every such file flipped check 12 to NO-GO with "approved but no longer in the change set", forcing a pointless re-approval (observed while shipping the CDN domain migration, where committing 364 of 367 approved files voided the approval). The rule is now: every file in the current change set must appear in the manifest with a matching hash (unchanged, conservative), and approved entries absent from the current change set are ignored. A file only leaves the change set when its content settles back into the base ref (approved bytes committed, or the edit reverted), becomes a draft, or stops being site-significant; in every case nothing unreviewed can ship from it, and re-editing it puts it back in the change set where the hash check applies. Check 12's PASS detail notes how many approved files have settled out of the change set.

### 4. Skill: `.claude/skills/preview-posts/SKILL.md`

Instructions for agent sessions: when post or template work is heading toward a push, run `npm run preview-posts`, hand the owner the review URL (or LAN URL for phone review), apply requested edits, rebuild and re-review until the owner is satisfied, then run approve mode only after the owner explicitly approves in chat. Never approve unprompted. Point out that release-check will NO-GO without this.

### 5. Housekeeping

- `.gitignore`: add `.preview/` under the repo-specific additions block.
- CLAUDE.md: add `npm run preview-posts` to the commands table and a line in the Safety section.
- `.claude/skills/release-check/SKILL.md`: document check 12 and the remediation path.

## Testing

`scripts/preview-posts.test.mjs`, run with `node --test`, added to the `test:safety` npm script alongside the checkpoint and release-check suites. Coverage:

- Path classification: post files, sibling `.en`/`.zh` files, site-wide paths, irrelevant paths.
- Slug derivation, including the `.en`/`.zh` suffix rule. For filenames containing other dots, assert against the ids Astro's glob loader actually generates rather than assuming "filename minus extension" (no current post has a dotted basename, but the test oracle should match Astro, not the spec's shorthand).
- Draft handling: a changed post with `draft: true` produces no target and no hash entry.
- Review-target mapping, including the deleted-post and site-wide cases.
- Manifest write, hash comparison, and invalidation when a file changes or the change set gains or loses a file. Use temp git repos, following the pattern in `scripts/checkpoint.test.mjs`.
- Check 12 behavior: SKIP on empty set, FAIL on missing or stale manifest, PASS on exact match.

The build-and-serve path is thin orchestration over `npm run build` and `astro preview` and is exercised manually, not unit-tested.

## Out of scope

- Staging deploys or preview URLs (Cloudflare Pages). Revisit only if reviewing away from the LAN becomes a real need.
- Automated screenshots or visual diffing.
- Using the existing `draft` frontmatter flag for previews.
- Any change to the push rules: pushing remains a human decision after a GO verdict (CLAUDE.md rule 5).
