---
name: release-check
description: Run the pre-push release checklist and deliver a go/no-go verdict before anything is pushed to main (which auto-deploys to anping.us). Use whenever a push or merge to main is being considered.
---

# Release checklist

Pushing to `main` deploys to https://anping.us within minutes. This checklist is the gate: it ends in a GO or NO-GO verdict. **Never push, merge, or tag as part of this workflow.** The owner pushes; your job ends at the verdict.

## Quick mode (default)

1. Run `npm run release-check` from the repo root. It saves a checkpoint, then runs git hygiene, secret scan, types, lint, build, image tests, rehype tests, and built-output verification (checks 1 to 9).
2. Report the per-check results and the verdict.

## Full mode

1. Run `npm run release-check -- --full` (adds check 10: every cdn.anping.us URL in the built site must return HTTP 200, and check 11: every internal link must resolve).
2. After the script passes, smoke-test the production build in a browser. Serve `dist/` with `npm run preview` (never the dev server), then verify:
   - homepage renders with the post list
   - one image-heavy post loads and its images come from cdn.anping.us
   - search returns results (Pagefind)
   - the language toggle switches title and body
   - the giscus comment iframe is present on a post
   - dark mode renders correctly
3. Capture a screenshot as proof and include it in the report.

## Report format

A table of every check with PASS / FAIL / SKIP and a one-line detail, the screenshot in full mode, then exactly one of:

- `VERDICT: GO, safe to push` (all checks passed)
- `VERDICT: NO-GO` with the blocking items listed first

## Choosing a mode

Full mode before anything that touches many posts, images, templates, or dependencies. Quick mode is acceptable for single-post edits and typo fixes.

## If a bad deploy reaches anping.us

`git revert <bad commit>` on `main`, push (with the owner's go-ahead), and the Pages workflow redeploys the previous good state in a few minutes. Checkpoints cover pre-push file state; `git revert` covers post-push history.
