# CLAUDE.md

Guidance for AI agents and new contributors working in this repository.

## What this is

Personal blog "NeVeRtheLeSs" (2005 to present, 318 posts, Chinese with English in progress). Astro 6 + the astro-tone theme. Deploys to GitHub Pages via `.github/workflows/deploy.yml` on every push to `main`; served at https://theneverless.com (DNS on Cloudflare, registration at GoDaddy; anping.us 301-redirects here, and images stay on https://cdn.anping.us).

## Commands

| Command | Action |
| --- | --- |
| `npm run dev` / `build` / `preview` | Standard Astro workflow (build also runs Pagefind) |
| `npm run check` / `lint` / `lint:css` / `format` | Type check, ESLint, Stylelint, Prettier |
| `npm run images` | Daily image pipeline: optimize + upload staged photos (see below) |
| `npm run images:migrate` | One-time backfill CLI, already executed; dry-run by default |
| `npm run test:images` | Image pipeline test suite (`node:test`); the R2 live test self-skips without credentials |
| `npm run test:rehype` | Rehype plugin test suite (image gallery detection) |
| `npm run checkpoint` | Working-tree snapshots: `save` / `list` / `diff` / `restore` (see Safety) |
| `npm run release-check` | Pre-push checklist, `-- --full` adds CDN + link verification (see Safety) |
| `npm run test:safety` | Test suite for the two safety CLIs |

## Architecture

- **Posts** live in `src/content/posts/*.md`.
- **Images are NOT in this repo.** They are served from Cloudflare R2 at `https://cdn.anping.us` (bucket `anping-blog-images`). Full-resolution originals are archived outside the repo (NAS or a local git-ignored `originals/` folder). The pipeline lives in `scripts/images/`; the complete runbook, including the daily authoring flow and Cloudflare setup, is [docs/images.md](docs/images.md).
- Exception: hero images in `src/assets/hero/` are Astro-optimized at build time and are deliberately outside the R2 pipeline. New covers must meet the minimum size spec in [docs/images.md](docs/images.md) (roughly 2400x1260 wide or 1600x1600 square, lightly compressed) or they render blurry in the home cards.
- Pipeline credentials go in `.env.local` (git-ignored); the variable names are documented in `.env.example`. Without credentials, dry-run modes and all but one test still work.
- `scripts/migrate/` is finished WordPress-migration tooling (Python). Design history lives in `docs/`, including `docs/superpowers/specs/` and `docs/superpowers/plans/`.

## Safety

- **Checkpoints** (`npm run checkpoint`, skill: `.claude/skills/checkpoint/`): file-level snapshots of the working tree in hidden local refs. Auto-saved at session start (hook in `.claude/settings.json`) and by every release check. Restore before push mistakes become deploy mistakes.
- **Release checklist** (`npm run release-check`, skill: `.claude/skills/release-check/`): required before any push to `main`. Ends in GO / NO-GO; pushing remains a human decision (rule 5).
- **Post-deploy rollback**: `git revert` the bad commit(s) on `main` and push; the Pages workflow redeploys the previous good state.

## Project status (last updated 2026-07-14)

- **Image storage on R2: complete.** All post images (217 objects) are on R2, every post references `cdn.anping.us`, and `public/uploads/` has been removed from the repo.
- **Bilingual toggle: complete and live.** Every post has zh/en titles and sibling bodies. The long-lived `bilingual-toggle` branch was merged and deleted on 2026-07-14; do not recreate it.
- **Single-branch workflow.** All day-to-day work happens on `main` in this checkout. A long-running independent track gets its own branch in its own worktree (`git worktree add`), like `tweets-notes`; it never shares this checkout.

## Rules

1. Stage explicit paths only. Never `git add -A` or `git add .`.
2. No em-dashes in user-facing copy: posts, docs, console messages, commit messages. Use commas, colons, or parentheses.
3. Never commit: `.env.local`, `image-staging/`, `originals/`, `scripts/images/.manifest.json` (all git-ignored; keep them that way).
4. This is a public repository. No secrets, tokens, or personal data in commits. Blog content (posts, comments, media) is all-rights-reserved; only the theme code is MIT. See README.
5. Deploys are automatic on push to `main`. Do not push or merge to `main` without the owner's go-ahead.
6. Multiple agent sessions often work in this checkout at the same time. Stage and commit in a single step with explicit paths (`git commit -m "..." -- <paths>`); never leave files staged between commands, and re-verify the current branch before any HEAD-relative mutation.
7. Never move a branch that is checked out in any worktree from outside that worktree (no `git update-ref`, `git branch -f`, or `git reset` on it from elsewhere). To advance the checked-out branch, run `git merge --ff-only <commit>` inside its checkout, so the index and working tree move together with the ref. Compare-and-swap `git update-ref refs/heads/X <new> <expected-old>` remains the right tool for branches that are NOT checked out anywhere.
8. If `git status` suddenly shows mass staged deletions (or modifications) of files you did not touch, stop: that is the signature of rule 7 being violated (the checked-out branch was moved from outside; the index and working tree were left behind). It is not data loss. Confirm the files exist in HEAD (`git ls-tree HEAD -- <path>`), then repair with `git restore --source=HEAD --staged --worktree -- <paths>`. Never commit or "clean up" such a state.
