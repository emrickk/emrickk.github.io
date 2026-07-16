# Tweets to Notes: Importing the X/Twitter Archive as a Microblog Section

**Date:** 2026-07-14
**Status:** Design, awaiting user review
**Repo:** `emrickk/emrickk.github.io` (Astro 6, GitHub Pages, domain `anping.us`)
**Branch:** `tweets-notes` (worktree `Personal Website/Personal Blog/blog-tweets-notes/`)

## Problem

Anping's X account ([@anpingwww](https://x.com/anpingwww)) holds years of microblogging
that exists only on X. The blog is the permanent, self-owned archive of his writing
(WordPress, Lofter, and iamanping.com have already been consolidated into it), and the
Lofter blog is a cautionary tale: 188 posts, platform dead, nothing recoverable. Tweets
belong in the archive too.

But tweets are not essays. Mixing hundreds of one-liners into the 326-post stream would
drown the blog. They need their own compact home.

## Goals

1. **Complete, lossless import** of Anping's own tweets from the official X archive export.
2. **Separate presentation**: a compact `/notes` timeline, out of the main posts list and
   main RSS.
3. **Media on R2**: photos and videos served from `cdn.anping.us`, same as post images.
4. **Authentic record**: text preserved as written. No rewording, no typo fixes, no
   translation (the same rule as blog originals).
5. **Idempotent, verifiable pipeline**: re-runnable against a future, newer archive export
   without duplicating notes; a verify step reconciles counts and checks every CDN URL.

## Non-goals (YAGNI)

- Retweets and replies to other people (noise without the other half of the conversation).
- Per-note pages. Notes get anchor permalinks on the timeline instead of individual
  routes; this avoids hundreds of thin pages.
- Bilingual toggle support for notes. They render as authored, in whatever language they
  were written.
- Live X embedding, API access, or ongoing sync. This is a one-shot import, re-runnable
  by hand with a fresh archive.
- Importing likes, bookmarks, DMs, or any other archive data.

## Data source

The official X archive export (X Settings, Your account, "Download an archive of your
data"; X prepares a ZIP within about 24 to 48 hours). It is the only complete source:
the live timeline exposes roughly the most recent 3,200 tweets, and the API is paid.

Relevant contents:

- `data/tweets.js`: every tweet as JSON wrapped in a JS assignment
  (`window.YTD.tweets.part0 = [...]`). Strip the prefix, parse as JSON.
- `data/tweets_media/`: photo and video files named `<tweetId>-<mediaKey>.<ext>`.
- `data/account.js`: the account's own `accountId` and `username`, used to distinguish
  self-replies from replies to others.

The extracted archive lives **outside the repo** at
`Personal Website/Backup/twitter-archive/`, like the WordPress dump. Scripts locate it
via a small path module, following the `scripts/migrate/backup_paths.py` pattern.

## Content model

New Astro content collection `src/content/notes/`, one markdown file per note.

- **Filename / slug:** `YYYYMMDD-HHMMSS.md` from the (first) tweet's UTC timestamp, with
  a `-2` style suffix on the rare collision.
- **Frontmatter:**
  - `date`: full ISO timestamp of the (first) tweet.
  - `tweetId`: string ID of the (first) tweet; the idempotency key.
  - `source`: `https://x.com/anpingwww/status/<tweetId>`.
  - `tweetCount`: number of tweets stitched in (1 for a single tweet).
- **Body transforms** (mechanical only, never editorial):
  - t.co links expanded to their real URLs via the archive's `entities.urls` map.
  - HTML entities decoded (`&amp;`, `&lt;`, `&gt;`).
  - `@mentions` linked to `https://x.com/<handle>`.
  - Hashtags left as plain text.
  - Markdown-significant characters in tweet text (`*`, `_`, `[`, `<`, backticks, etc.)
    escaped on emission, so the rendered note shows exactly the characters that were
    tweeted. The fixture includes a tweet exercising this.
  - Media t.co stubs removed from the text; media rendered from frontmatter-adjacent
    markdown image references pointing at the CDN.
- **Threads:** consecutive self-replies (a tweet whose `in_reply_to_status_id` is another
  of Anping's tweets) are stitched chronologically into one note, one paragraph per
  tweet.

## Filtering

From the full archive, keep a tweet when it is an original or part of a self-thread:

- **Drop retweets:** `full_text` beginning with `RT @` (how classic retweets appear in
  the archive).
- **Drop replies to others:** `in_reply_to_user_id` present and not the account's own ID.
- **Keep quote tweets:** they are original writing; the quoted tweet's URL stays as a
  plain link.
- **Keep media-only tweets** (photo with no text). If a tweet is genuinely empty after
  transforms and has no media, it is not emitted; it is listed in the import report for
  a human call.
- **Orphaned self-replies inherit their root's fate:** a chain of self-replies is kept
  only when its root tweet is a kept original. If the root was a reply to someone else
  (and therefore dropped), the whole chain is dropped as part of that conversation, and
  the report lists it so a human can rescue anything substantial.

The verify step must reconcile exactly: archive total = kept + dropped retweets +
dropped replies (including dropped chain continuations) + flagged empties.

## Pages

- **`/notes`**: a single timeline page, newest first, grouped under year headings. Each
  entry shows the full text inline (tweets are short; no excerpts), any media, a
  date-stamped anchor permalink (`/notes#<tweetId>`), and a small "on X" link to the
  original. If the real volume makes one page unwieldy, paginate by year; decide when
  the archive arrives.
- **Nav:** a "Notes" link in the site header. Nav items live in `astro-theme-config.ts`
  (`config.nav`, rendered by `src/components/Header.astro`), so the entry is added
  there; any language-aware label strings additionally go through `src/ui.ts` (zh label
  proposal: 随记; owner may rename).
- **Feeds:** main RSS unchanged (`src/pages/rss.xml.js` already filters to the posts
  collection). New `/notes/rss.xml` with the latest 20 notes. Notes have no titles, so
  each item's title is the first line of text truncated to about 60 characters, or the
  date for media-only notes.
- **Styling:** compact list reusing existing theme tokens; visually quieter than post
  listings.

## Media

- **Photos:** processed by the existing image pipeline conventions (sharp, WebP q80,
  max 2000px) and uploaded to R2 under a `notes/` prefix:
  `https://cdn.anping.us/notes/<tweetId>-<n>.webp`. The pipeline in `scripts/images/`
  gains a parameterized prefix/source-dir mode rather than a parallel copy.
- **Videos and X GIFs** (X GIFs are mp4 files): uploaded to R2 `notes/` as mp4 and
  embedded with a `<video controls>` element. Volume is expected to be small; R2 free
  tier covers any plausible personal scale.
- **Originals:** archive media files are preserved in the twitter-archive backup folder;
  they follow the same NAS archiving flow as post originals, out of band.

## Pipeline

New importer at `scripts/migrate/tweets_import.py` (Python, matching the existing
migration tooling), plus `scripts/migrate/verify_tweets.py`.

Import steps:

1. Locate and parse the archive (`tweets.js`, `account.js`).
2. Filter per the rules above; build self-thread chains.
3. Transform text (t.co expansion, entity decode, mention links, media stub removal).
4. Emit markdown to `src/content/notes/`, keyed by `tweetId`: re-runs update in place,
   never duplicate. Write-only-if-changed (iCloud sync hazard).
5. Emit a media manifest for the image pipeline, and an import report: counts by
   category, flagged empties, unknown media types (logged and skipped, never fatal),
   media files referenced by tweets but missing from the archive (text kept, absence
   noted).

Verify steps (run after import and after media upload):

1. Count reconciliation against the raw archive.
2. Every CDN URL referenced by notes returns HTTP 200.
3. PII scan of emitted files, reusing the runtime needle-derivation approach from
   `scripts/migrate/verify.py`.
4. `npm run build` passes with the collection populated.

## Testing

A hand-made fixture (mini `tweets.js` with an original, a retweet, a reply to someone
else, a self-thread, a quote tweet, an entity-laden tweet, and a photo tweet, plus one
or two sample images) lives with the migrate tooling. Unit tests cover parse, filter,
thread stitching, and text transforms. The full pipeline plus `/notes` page styling is
built and reviewed against this fixture **before** the real archive arrives, so the
real run is just pointing the importer at the ZIP contents.

## Workflow and safety

- All work on branch `tweets-notes` in the dedicated worktree; the main checkout (busy
  with content-audit work on `bilingual-toggle`) stays untouched.
- `npm run checkpoint` before mass content writes; `npm run release-check` before
  handoff. Repo rules apply: explicit-path staging, no em-dashes in copy (imported
  tweet text is exempt: it is preserved verbatim as an authentic record), public-repo
  hygiene, and the owner performs all pushes.
- The archive ZIP and its extraction never enter the repo.

## Open questions

- Real archive volume (tweet count, media count, videos) is unknown until the ZIP
  arrives; it decides single-page vs year-paginated `/notes` and nothing else.
- The zh nav label (随记 proposed) awaits the owner's taste.
