# Tweets to Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the owner's X/Twitter archive (228 tweets, 2010 to 2026) into a new `/notes` microblog section: importer + verifier in Python, a `notes` content collection, a single-page timeline with nav entry and RSS, media on R2 under `notes/`, and preview-gate awareness, ending in an owner browser review of the real imported notes.

**Architecture:** A Python importer (`scripts/migrate/tweets_import.py`, stdlib only) parses the archive, filters retweets and replies-to-others, stitches self-threads, applies mechanical text transforms, and emits one markdown note per tweet/thread into `src/content/notes/` keyed by `tweetId` (idempotent, write-only-if-changed), plus a media manifest and an import report; `verify_tweets.py` reconciles counts, scans for PII with runtime-derived needles, and checks CDN URLs. Astro gains a `notes` collection, a `/notes` timeline page with year headings and anchor permalinks, and `/notes/rss.xml`. The existing image pipeline gains a parameterized prefix/staging-dir mode to upload the 10 photos to R2 as `notes/<tweetId>-<n>.webp`.

**Tech Stack:** Astro 6 content collections (glob loader), plain CSS with existing theme tokens, Python 3.11 + pytest (stdlib-only runtime code), Node `node:test` for the JS pipeline and preview-gate suites, sharp + S3 client (existing) for R2.

**Spec:** docs/superpowers/specs/2026-07-14-tweets-to-notes-design.md
**Branch/worktree:** all commits on `tweets-notes` inside this worktree; never touch the main checkout.

The worktree root is referred to below as `$WT`:

```bash
WT="/Users/anping.wang/Documents/Stuff/AI Space/Personal Website/Personal Blog/blog-tweets-notes"
```

The path contains spaces: quote it everywhere. Run every command from `$WT` unless a step says otherwise.

## Project rules (embedded, non-negotiable)

- **No em-dashes** in any copy this plan produces: page text, console messages, code comments, commit messages, docs. Use commas, colons, or parentheses. Exception per spec: **imported tweet text is preserved verbatim** (it is an authentic record; whatever characters the owner tweeted stay).
- **Stage and commit in one step with explicit paths**: `git add <paths> && git commit -m "..." -- <paths>`. Never `git add -A` or `git add .`. Run `git branch --show-current` immediately before each commit and confirm it prints `tweets-notes`.
- Every commit message ends with the trailer (blank line before it):
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- **Never push. Never merge to main. Never run `npm run preview-posts -- --approve`.** Those are the owner's decisions, in a later session.
- **The archive ZIP and its extraction never enter the repo.** It lives at `Personal Website/Backup/twitter-archive/` (outside the repo). `account.js` contains the owner's private email address: never echo its contents into any committed file, log line kept in the repo, or this repo's docs. The verifier derives PII needles from it at runtime only.
- `.env.local` is git-ignored (`.env.*` rule) and must stay that way; it is copied into the worktree for the upload step and never committed.
- Python tooling matches `scripts/migrate/` conventions: stdlib-first modules, `os.path`, module-level constants, pytest tests named `test_*.py` in the same directory, run via the local venv.
- Multiple agent sessions may share this checkout family: never leave files staged between commands.

## Reality check vs the spec (corrections this plan already reflects)

1. **Domain:** the site is now `https://theneverless.com` (`astro-theme-config.ts` `config.site.url`; the spec header still says anping.us). Nothing in this feature hardcodes the site origin; the CDN stays `https://cdn.anping.us`.
2. **Branch landscape:** `bilingual-toggle` is merged and deleted; the repo runs a single-branch workflow on `main`. This feature is the sanctioned exception: its own branch `tweets-notes` in its own worktree.
3. **The archive has arrived** (extracted at `Personal Website/Backup/twitter-archive/`, with `data/tweets.js`, `data/account.js`, `data/tweets_media/`). Measured: **228 tweets** (2010:5, 2011:20, 2012:33, 2013:18, 2014:43, 2015:20, 2016:16, 2017:27, 2018:9, 2019:4, 2020:8, 2021:2, 2022:1, 2024:18, 2026:4), 6 retweets, 64 tweets with `in_reply_to_user_id` (mix of self and other), 10 tweets with media, 10 media files (9 jpg, 1 png). Account: `anpingwww` / accountId (numeric id read from account.js at runtime), never hardcoded in tooling.
4. **Open question resolved:** 228 tweets is small; `/notes` is a **single page, no pagination**.
5. **Zero videos/GIFs in the real archive** (all 10 media files are photos). The spec's video-upload and `<video controls>` path is deferred: the importer logs any non-photo media in the report ("logged and skipped, never fatal" per spec) and no video upload/embed code is built. Flagged here so it is a visible decision, not a silent deviation. If a future export contains videos, extend then.
6. **No disposable fixture notes in the repo.** The original testing story committed fixture-generated sample notes for development; since the real archive exists, `src/content/notes/` only ever contains the real import. The fixture still gates correctness, but its output goes to pytest temp dirs only.
7. **`src/ui.ts` is not runtime language-aware** (it returns static strings; bilingual swapping is done by `LangText`/`LangTitle` spans plus `lang.css`). The bilingual nav label (随记 / Notes) is therefore implemented as a `labelZh` field on the nav item rendered through `LangText`, with the English strings in `ui.ts`.
8. **Post preview gate exists now** (`scripts/preview-posts.mjs`, release-check check 12). Changed note files would currently classify as generic `site` changes; this plan teaches `classifyPath`/`reviewTargets` a `note` kind mapping to `/notes/`.
9. Release-check check 12 will be NO-GO at the end of this plan by design: the owner has not approved, and this plan never approves. That is correct behavior, not a failure.

## File structure

| Path | Action | Responsibility |
| --- | --- | --- |
| `scripts/migrate/fixtures/twitter-archive/data/tweets.js` | create | Hand-made mini archive: original, RT, reply-to-other, self-thread, quote, entity-laden, photo, photo-only, dropped chain, flagged empty |
| `scripts/migrate/fixtures/twitter-archive/data/account.js` | create | Fixture account (fake id/username/email) |
| `scripts/migrate/fixtures/twitter-archive/data/tweets_media/9006-FixA.jpg`, `9009-FixB.png` | create | Two tiny sample images |
| `scripts/migrate/backup_paths.py` | modify | Add `twitter_archive_root()` locator with env override and friendly error |
| `scripts/migrate/test_backup_paths.py` | modify | Tests for the new locator |
| `scripts/migrate/tweets_import.py` | create | Parse, filter, stitch threads, transform text, emit notes keyed by tweetId, media manifest, import report, media staging |
| `scripts/migrate/test_tweets_import.py` | create | Unit tests over the fixture |
| `scripts/migrate/verify_tweets.py` | create | Count reconciliation, note shape, PII scan (runtime needles), CDN 200 check |
| `scripts/migrate/test_verify_tweets.py` | create | Tests for reconciliation and report parsing |
| `scripts/migrate/tweets_report.txt` | create (generated) | Committed import report: counts + flagged IDs |
| `scripts/migrate/tweets_media_manifest.json` | create (generated) | Committed archive-file to staged-name/R2-key map |
| `src/content/notes/*.md` | create (generated) | The real imported notes (one per tweet/thread) |
| `src/content.config.ts` | modify | Add `notes` collection (date, tweetId, source, tweetCount) |
| `src/pages/notes/index.astro` | create | Single timeline: newest first, year headings, anchors, "on X" links |
| `src/pages/notes/rss.xml.js` | create | `/notes/rss.xml`, latest 20 |
| `src/styles/pages/notes.css` | create | Compact styling from existing tokens |
| `src/ui.ts` | modify | Notes strings (title, eyebrow, on X, empty) |
| `astro-theme-config.ts` | modify | Header nav entry with `labelZh: '随记'` |
| `src/components/Header.astro` | modify | Render bilingual nav labels via `LangText` |
| `scripts/images/references.mjs` | modify | `deriveKey` gains an optional key prefix |
| `scripts/images/references.test.mjs` | modify | Prefix tests |
| `scripts/images/process.mjs` | modify | CLI flags `--staging-dir`, `--prefix`, `--manifest`, `--no-archive` |
| `scripts/images/process.test.mjs` | modify | Prefixed dry-run test |
| `scripts/preview-posts.mjs` | modify | `note` classification; notes review at `/notes/` |
| `scripts/preview-posts.test.mjs` | modify | Note classification and target tests |
| `.claude/skills/preview-posts/SKILL.md` | modify | One line: notes map to `/notes/` |
| `.gitignore` | modify | Ignore `scripts/images/.manifest-notes.json` |

Untouched on purpose: `src/pages/rss.xml.js` (main RSS), `src/pages/posts/` (posts list), `src/pages/index.astro`. The end-of-plan diff must not include them.

---

## Task 0: Environment setup (no commit)

- [ ] Confirm the worktree and branch:

```bash
cd "$WT" && git branch --show-current && git status --short --branch | head -3
```

Expected: `tweets-notes`, clean or nearly clean tree.

- [ ] Create the migrate venv (git-ignored) and install test deps (markdownify and beautifulsoup4 keep the pre-existing WP test files importable):

```bash
cd "$WT" && python3 -m venv scripts/migrate/.venv && scripts/migrate/.venv/bin/pip install --quiet pytest markdownify beautifulsoup4 && scripts/migrate/.venv/bin/python -m pytest --version
```

Expected: a pytest version line.

- [ ] Baseline: existing migrate tests pass:

```bash
cd "$WT/scripts/migrate" && .venv/bin/python -m pytest -q
```

Expected: all pass (some tests use tmp fixtures; none require the archive).

- [ ] Ensure node deps exist: `cd "$WT" && [ -d node_modules ] || npm install`

## Task 1: Fixture mini-archive

The fixture exercises every filter and transform branch. It lives with the migrate tooling and is committed (the fake account uses `fixture@example.com`, no real PII).

- [ ] Create `scripts/migrate/fixtures/twitter-archive/data/account.js`:

```js
window.YTD.account.part0 = [
  {
    "account" : {
      "email" : "fixture@example.com",
      "createdVia" : "web",
      "username" : "fixtureuser",
      "accountId" : "424242",
      "createdAt" : "2010-08-03T04:10:42.000Z",
      "accountDisplayName" : "Fixture"
    }
  }
]
```

- [ ] Create `scripts/migrate/fixtures/twitter-archive/data/tweets.js` (12 tweets; the `{"tweet": {...}}` wrapper and `edit_info` noise mirror the real archive):

```js
window.YTD.tweets.part0 = [
  { "tweet" : {
      "edit_info" : { "initial" : { "editTweetIds" : [ "9001" ], "editsRemaining" : "5", "isEditEligible" : false } },
      "id_str" : "9001",
      "created_at" : "Thu Aug 05 09:00:00 +0000 2010",
      "full_text" : "Hello world, the first note.",
      "entities" : { "hashtags" : [ ], "user_mentions" : [ ], "urls" : [ ] }
  } },
  { "tweet" : {
      "id_str" : "9002",
      "created_at" : "Sat Mar 05 12:00:00 +0000 2011",
      "full_text" : "RT @somebody: reposted wisdom",
      "entities" : { "hashtags" : [ ], "user_mentions" : [ { "screen_name" : "somebody" } ], "urls" : [ ] }
  } },
  { "tweet" : {
      "id_str" : "9003",
      "created_at" : "Sun Mar 06 12:00:00 +0000 2011",
      "in_reply_to_user_id_str" : "555000",
      "in_reply_to_status_id_str" : "111",
      "full_text" : "@stranger totally agree",
      "entities" : { "hashtags" : [ ], "user_mentions" : [ { "screen_name" : "stranger" } ], "urls" : [ ] }
  } },
  { "tweet" : {
      "id_str" : "9004",
      "created_at" : "Sun Jan 01 10:00:00 +0000 2012",
      "full_text" : "Thread start: counting down.",
      "entities" : { "hashtags" : [ ], "user_mentions" : [ ], "urls" : [ ] }
  } },
  { "tweet" : {
      "id_str" : "9005",
      "created_at" : "Sun Jan 01 10:05:00 +0000 2012",
      "in_reply_to_user_id_str" : "424242",
      "in_reply_to_status_id_str" : "9004",
      "full_text" : "Thread middle.",
      "entities" : { "hashtags" : [ ], "user_mentions" : [ ], "urls" : [ ] }
  } },
  { "tweet" : {
      "id_str" : "9006",
      "created_at" : "Sun Jan 01 10:10:00 +0000 2012",
      "in_reply_to_user_id_str" : "424242",
      "in_reply_to_status_id_str" : "9005",
      "full_text" : "Thread end, with a photo. https://t.co/mediaA",
      "entities" : { "hashtags" : [ ], "user_mentions" : [ ], "urls" : [ ],
        "media" : [ { "url" : "https://t.co/mediaA", "media_url_https" : "https://pbs.twimg.com/media/FixA.jpg", "type" : "photo" } ] },
      "extended_entities" : {
        "media" : [ { "url" : "https://t.co/mediaA", "media_url_https" : "https://pbs.twimg.com/media/FixA.jpg", "type" : "photo" } ] }
  } },
  { "tweet" : {
      "id_str" : "9007",
      "created_at" : "Fri Feb 15 08:30:00 +0000 2013",
      "full_text" : "Quoting this gem https://t.co/qt1",
      "entities" : { "hashtags" : [ ], "user_mentions" : [ ],
        "urls" : [ { "url" : "https://t.co/qt1", "expanded_url" : "https://x.com/someone/status/777" } ] }
  } },
  { "tweet" : {
      "id_str" : "9008",
      "created_at" : "Thu Jul 24 09:30:00 +0000 2014",
      "full_text" : "Fun &amp; games &lt;3 with *stars*, _underscores_, [brackets], `ticks`, #tag and @mention_1 https://t.co/link1",
      "entities" : { "hashtags" : [ { "text" : "tag" } ],
        "user_mentions" : [ { "screen_name" : "mention_1" } ],
        "urls" : [ { "url" : "https://t.co/link1", "expanded_url" : "https://example.com/a_(b)?q=1&x=2" } ] }
  } },
  { "tweet" : {
      "id_str" : "9009",
      "created_at" : "Wed May 20 18:00:00 +0000 2015",
      "full_text" : "https://t.co/mediaB",
      "entities" : { "hashtags" : [ ], "user_mentions" : [ ], "urls" : [ ],
        "media" : [ { "url" : "https://t.co/mediaB", "media_url_https" : "https://pbs.twimg.com/media/FixB.png", "type" : "photo" } ] },
      "extended_entities" : {
        "media" : [ { "url" : "https://t.co/mediaB", "media_url_https" : "https://pbs.twimg.com/media/FixB.png", "type" : "photo" } ] }
  } },
  { "tweet" : {
      "id_str" : "9010",
      "created_at" : "Mon Aug 15 10:00:00 +0000 2016",
      "in_reply_to_user_id_str" : "555000",
      "in_reply_to_status_id_str" : "222",
      "full_text" : "@stranger chain root that is itself a reply",
      "entities" : { "hashtags" : [ ], "user_mentions" : [ { "screen_name" : "stranger" } ], "urls" : [ ] }
  } },
  { "tweet" : {
      "id_str" : "9011",
      "created_at" : "Mon Aug 15 10:05:00 +0000 2016",
      "in_reply_to_user_id_str" : "424242",
      "in_reply_to_status_id_str" : "9010",
      "full_text" : "chain continuation lost with its root",
      "entities" : { "hashtags" : [ ], "user_mentions" : [ ], "urls" : [ ] }
  } },
  { "tweet" : {
      "id_str" : "9012",
      "created_at" : "Sat Apr 01 07:00:00 +0000 2017",
      "full_text" : "https://t.co/gone",
      "entities" : { "hashtags" : [ ], "user_mentions" : [ ], "urls" : [ ],
        "media" : [ { "url" : "https://t.co/gone", "media_url_https" : "https://pbs.twimg.com/media/GoneC.jpg", "type" : "photo" } ] },
      "extended_entities" : {
        "media" : [ { "url" : "https://t.co/gone", "media_url_https" : "https://pbs.twimg.com/media/GoneC.jpg", "type" : "photo" } ] }
  } }
]
```

Fixture ledger (the tests assert exactly this): 12 total = 7 kept (9001 + thread 9004/9005/9006 + 9007 + 9008 + 9009) + 1 retweet (9002) + 3 replies dropped (9003; 9010 reply-to-other root; 9011 chain continuation, also counted `chain_dropped`) + 1 flagged empty (9012: media stub only, media file absent). 5 notes emitted.

- [ ] Generate the two tiny images with sharp (already a dependency):

```bash
cd "$WT" && mkdir -p scripts/migrate/fixtures/twitter-archive/data/tweets_media && node -e "
const sharp = require('sharp')
Promise.all([
  sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 200, g: 90, b: 40 } } })
    .jpeg({ quality: 70 }).toFile('scripts/migrate/fixtures/twitter-archive/data/tweets_media/9006-FixA.jpg'),
  sharp({ create: { width: 48, height: 64, channels: 3, background: { r: 40, g: 90, b: 200 } } })
    .png().toFile('scripts/migrate/fixtures/twitter-archive/data/tweets_media/9009-FixB.png'),
]).then(() => console.log('fixture images written'))
"
```

Expected: `fixture images written`; both files exist and are under 2 KB.

- [ ] Commit:

```bash
cd "$WT" && git branch --show-current && git add scripts/migrate/fixtures && git commit -m "test(migrate): add twitter archive fixture for the tweets importer

Hand-made mini archive covering original, retweet, reply-to-other,
self-thread, dropped chain, quote tweet, entity-laden text, photo,
photo-only and flagged-empty cases, with a fake account (no real PII).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- scripts/migrate/fixtures
```

## Task 2: Archive locator in `backup_paths.py` (TDD)

- [ ] Append failing tests to `scripts/migrate/test_backup_paths.py`:

```python
def _make_twitter_archive(root):
    data_dir = root / 'data'
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / 'tweets.js').write_text('window.YTD.tweets.part0 = []\n', encoding='utf-8')
    return str(root)


def test_twitter_archive_env_override_wins(tmp_path, monkeypatch):
    fake_repo = tmp_path / 'nowhere' / 'repo'
    fake_repo.mkdir(parents=True)
    monkeypatch.setattr(backup_paths, 'REPO', str(fake_repo))
    env_root = tmp_path / 'env-archive'
    _make_twitter_archive(env_root)
    monkeypatch.setenv('TWITTER_ARCHIVE_ROOT', str(env_root))
    assert backup_paths.twitter_archive_root() == os.path.abspath(str(env_root))


def test_twitter_archive_backup_sibling_found(tmp_path, monkeypatch):
    monkeypatch.delenv('TWITTER_ARCHIVE_ROOT', raising=False)
    repo = tmp_path / 'Personal Website' / 'Personal Blog' / 'blog'
    repo.mkdir(parents=True)
    _make_twitter_archive(tmp_path / 'Personal Website' / 'Backup' / 'twitter-archive')
    monkeypatch.setattr(backup_paths, 'REPO', str(repo))
    root = backup_paths.twitter_archive_root()
    assert root.endswith(os.path.join('Backup', 'twitter-archive'))


def test_twitter_archive_missing_raises_friendly_error(tmp_path, monkeypatch):
    monkeypatch.delenv('TWITTER_ARCHIVE_ROOT', raising=False)
    fake_repo = tmp_path / 'nowhere' / 'repo'
    fake_repo.mkdir(parents=True)
    monkeypatch.setattr(backup_paths, 'REPO', str(fake_repo))
    with pytest.raises(RuntimeError) as exc_info:
        backup_paths.twitter_archive_root()
    message = str(exc_info.value)
    assert 'twitter-archive' in message
    assert 'TWITTER_ARCHIVE_ROOT' in message
    assert 'data/tweets.js' in message
```

- [ ] Run and watch them fail:

```bash
cd "$WT/scripts/migrate" && .venv/bin/python -m pytest test_backup_paths.py -q
```

Expected: 3 failures (`AttributeError: ... twitter_archive_root`).

- [ ] Append to `scripts/migrate/backup_paths.py`:

```python
def twitter_archive_root():
    """Return the extracted X/Twitter archive root (must contain data/tweets.js).

    Resolution order (first hit wins):
      1. env TWITTER_ARCHIVE_ROOT                       -- explicit override
      2. <repo>/../../Backup/twitter-archive            -- current layout:
         repo under Personal Website/Personal Blog/, archive extracted at
         Personal Website/Backup/twitter-archive

    Raises RuntimeError listing every path tried if none match.
    """
    candidates = []
    env = os.environ.get('TWITTER_ARCHIVE_ROOT')
    if env:
        candidates.append(('env TWITTER_ARCHIVE_ROOT', os.path.abspath(env)))
    candidates.append(('<repo>/../../Backup/twitter-archive',
                       os.path.abspath(os.path.join(REPO, '..', '..', 'Backup', 'twitter-archive'))))
    tried = []
    for label, path in candidates:
        tried.append(f'{label} -> {path}')
        if os.path.isfile(os.path.join(path, 'data', 'tweets.js')):
            return path
    raise RuntimeError(
        'Could not locate the extracted X/Twitter archive (looked for data/tweets.js under):\n  '
        + '\n  '.join(tried)
        + '\nExtract the X archive ZIP to Personal Website/Backup/twitter-archive/ '
        'or set TWITTER_ARCHIVE_ROOT to override.'
    )
```

- [ ] Re-run: `cd "$WT/scripts/migrate" && .venv/bin/python -m pytest test_backup_paths.py -q`. Expected: all pass.
- [ ] Sanity check against the real archive: `cd "$WT/scripts/migrate" && .venv/bin/python -c "import backup_paths; print(backup_paths.twitter_archive_root())"`. Expected: the real path under `Personal Website/Backup/twitter-archive`.
- [ ] Commit:

```bash
cd "$WT" && git branch --show-current && git add scripts/migrate/backup_paths.py scripts/migrate/test_backup_paths.py && git commit -m "feat(migrate): locate the extracted twitter archive

twitter_archive_root() finds Personal Website/Backup/twitter-archive
(TWITTER_ARCHIVE_ROOT overrides) and fails with a friendly message
listing every tried path when the archive is absent.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- scripts/migrate/backup_paths.py scripts/migrate/test_backup_paths.py
```

## Task 3: Importer `tweets_import.py` (TDD)

- [ ] Create `scripts/migrate/test_tweets_import.py` first (failing):

```python
import json
import os

import tweets_import
from tweets_import import (
    build_notes, classify, emit, escape_md, load_archive, parse_date,
    render_note, transform_text, write_if_changed,
)

FIXTURE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures', 'twitter-archive')


def _load():
    return load_archive(FIXTURE)


def _built():
    tweets, account = _load()
    media_root = os.path.join(FIXTURE, 'data', 'tweets_media')
    return build_notes(tweets, account, media_root)


def test_load_archive_parses_ytd_wrappers():
    tweets, account = _load()
    assert len(tweets) == 12
    assert account['username'] == 'fixtureuser'
    assert account['accountId'] == '424242'


def test_classify_filters_and_chains():
    tweets, account = _load()
    threads, dropped, orphan_roots = classify(tweets, account['accountId'])
    root_ids = sorted(chain[0]['id_str'] for chain in threads)
    assert root_ids == ['9001', '9004', '9007', '9008', '9009', '9012']
    assert [t['id_str'] for t in dropped['retweets']] == ['9002']
    assert sorted(t['id_str'] for t in dropped['replies']) == ['9003', '9010']
    assert [t['id_str'] for t in dropped['chain']] == ['9011']
    assert orphan_roots == []


def test_thread_stitching_is_chronological():
    tweets, account = _load()
    threads, _dropped, _orphans = classify(tweets, account['accountId'])
    thread = next(chain for chain in threads if chain[0]['id_str'] == '9004')
    assert [t['id_str'] for t in thread] == ['9004', '9005', '9006']


def test_transform_entity_laden_text():
    tweets, _account = _load()
    t = next(x for x in tweets if x['id_str'] == '9008')
    out = transform_text(t)
    assert out == (
        'Fun & games \\<3 with \\*stars\\*, \\_underscores\\_, '
        '\\[brackets\\], \\`ticks\\`, #tag and '
        '[@mention_1](https://x.com/mention_1) '
        'https://example.com/a_(b)?q=1&x=2'
    )


def test_transform_quote_tweet_keeps_plain_link():
    tweets, _account = _load()
    t = next(x for x in tweets if x['id_str'] == '9007')
    assert transform_text(t) == 'Quoting this gem https://x.com/someone/status/777'


def test_escape_md_line_starts():
    assert escape_md('- item') == '\\- item'
    assert escape_md('+ item') == '\\+ item'
    assert escape_md('# not a heading') == '\\# not a heading'
    assert escape_md('1. item') == '1\\. item'
    assert escape_md('mid - dash stays') == 'mid - dash stays'


def test_build_notes_counts_and_bodies():
    notes, counts, manifest_rows, details = _built()
    assert counts == {
        'archive_total': 12,
        'kept_tweets': 7,
        'notes_emitted': 5,
        'retweets_dropped': 1,
        'replies_dropped': 3,
        'chain_dropped': 1,
        'empties_flagged': 1,
        'orphan_roots': 0,
        'media_photos': 2,
        'media_missing': 1,
        'media_skipped_nonphoto': 0,
    }
    assert counts['archive_total'] == (counts['kept_tweets'] + counts['retweets_dropped']
                                       + counts['replies_dropped'] + counts['empties_flagged'])
    assert details['empties_flagged'] == ['9012']
    assert details['media_missing'] == ['9012-GoneC.jpg']
    thread = next(n for n in notes if n['tweetId'] == '9004')
    assert thread['tweetCount'] == 3
    assert thread['source'] == 'https://x.com/fixtureuser/status/9004'
    assert thread['body'] == (
        'Thread start: counting down.\n\n'
        'Thread middle.\n\n'
        'Thread end, with a photo.\n\n'
        '![](https://cdn.anping.us/notes/9006-1.webp)'
    )
    photo_only = next(n for n in notes if n['tweetId'] == '9009')
    assert photo_only['body'] == '![](https://cdn.anping.us/notes/9009-1.webp)'
    assert manifest_rows == [
        {'archive': '9006-FixA.jpg', 'staged': '9006-1.jpg',
         'key': 'notes/9006-1.webp', 'url': 'https://cdn.anping.us/notes/9006-1.webp'},
        {'archive': '9009-FixB.png', 'staged': '9009-1.png',
         'key': 'notes/9009-1.webp', 'url': 'https://cdn.anping.us/notes/9009-1.webp'},
    ]


def test_render_note_frontmatter():
    notes, _c, _m, _d = _built()
    note = next(n for n in notes if n['tweetId'] == '9001')
    assert render_note(note) == (
        "---\n"
        "date: '2010-08-05T09:00:00.000Z'\n"
        "tweetId: '9001'\n"
        "source: 'https://x.com/fixtureuser/status/9001'\n"
        "tweetCount: 1\n"
        "---\n"
        "\n"
        "Hello world, the first note.\n"
    )


def test_emit_names_files_from_utc_and_suffixes_collisions(tmp_path):
    notes, _c, _m, _d = _built()
    out = str(tmp_path / 'notes')
    written = emit(notes, out)
    assert written == 5
    names = sorted(os.listdir(out))
    assert '20100805-090000.md' in names
    assert '20120101-100000.md' in names
    clone = dict(notes[0], tweetId='9999')
    emit([notes[0], clone], out)
    assert '20100805-090000-2.md' in os.listdir(out)


def test_emit_is_idempotent_and_write_only_if_changed(tmp_path):
    notes, _c, _m, _d = _built()
    out = str(tmp_path / 'notes')
    assert emit(notes, out) == 5
    assert emit(notes, out) == 0
    path = os.path.join(out, '20100805-090000.md')
    with open(path, encoding='utf-8') as f:
        before = f.read()
    assert write_if_changed(path, before) is False
    assert write_if_changed(path, before + 'x') is True


def test_emit_rekeys_existing_files_by_tweet_id(tmp_path):
    notes, _c, _m, _d = _built()
    out = str(tmp_path / 'notes')
    emit(notes, out)
    edited = [dict(n, body=n['body'] + '\n\nappended') if n['tweetId'] == '9001' else n for n in notes]
    assert emit(edited, out) == 1
    with open(os.path.join(out, '20100805-090000.md'), encoding='utf-8') as f:
        assert 'appended' in f.read()
```

- [ ] Run and watch it fail: `cd "$WT/scripts/migrate" && .venv/bin/python -m pytest test_tweets_import.py -q`. Expected: `ModuleNotFoundError: No module named 'tweets_import'`.

- [ ] Create `scripts/migrate/tweets_import.py`:

```python
"""Import the X/Twitter archive into src/content/notes/, one note per tweet
or self-thread, per docs/superpowers/specs/2026-07-14-tweets-to-notes-design.md.

Filtering: retweets (full_text starting with 'RT @') and replies to other
accounts are dropped; consecutive self-replies stitch chronologically into a
single note; a self-reply chain inherits its root's fate. Transforms are
mechanical only: t.co expansion, HTML entity decode, @mention links, media
stub removal, markdown escaping. Emission is keyed by tweetId: re-runs update
in place and never duplicate; files are written only when their content
changed (iCloud sync hazard).

Outputs: markdown notes, scripts/migrate/tweets_report.txt (counts plus
flagged IDs) and scripts/migrate/tweets_media_manifest.json (archive file to
staged name and R2 key). --stage-media DIR also copies referenced photos into
DIR under their staged names for scripts/images/process.mjs --staging-dir.

Usage:
    .venv/bin/python tweets_import.py [--archive-root PATH] [--stage-media DIR]
"""
import argparse
import html
import json
import os
import re
import shutil
import sys
from datetime import timezone
from datetime import datetime

import backup_paths

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
NOTES_DIR = os.path.join(REPO, 'src', 'content', 'notes')
REPORT_PATH = os.path.join(HERE, 'tweets_report.txt')
MEDIA_MANIFEST_PATH = os.path.join(HERE, 'tweets_media_manifest.json')
CDN_NOTES_BASE = 'https://cdn.anping.us/notes'
CREATED_AT_FMT = '%a %b %d %H:%M:%S %z %Y'
CONVERTED_EXTS = {'.jpg', '.jpeg', '.png'}

# Markdown-significant characters escaped everywhere; list/heading markers
# only matter at line starts. Escaped punctuation renders as the literal
# character, so the note shows exactly what was tweeted.
_MD_GLOBAL = re.compile(r'([\\`*_\[\]<>~|])')
_MD_LINESTART = re.compile(r'(?m)^(\s*)([#+-])( |$)')
_MD_OL = re.compile(r'(?m)^(\s*\d+)\.( )')
_MENTION_RE = re.compile(r'@([A-Za-z0-9_]{1,15})')
FRONTMATTER_ID_RE = re.compile(r"^tweetId: '(\d+)'$", re.M)


def load_ytd(path):
    """Parse a window.YTD.<name>.part0 = [...] file into Python data."""
    with open(path, encoding='utf-8') as f:
        text = f.read()
    return json.loads(text[text.index('=') + 1:])


def load_archive(root):
    """Return (tweets, account) from an extracted archive root."""
    data_dir = os.path.join(root, 'data')
    tweets = [item['tweet'] for item in load_ytd(os.path.join(data_dir, 'tweets.js'))]
    account = load_ytd(os.path.join(data_dir, 'account.js'))[0]['account']
    return tweets, account


def parse_date(tweet):
    return datetime.strptime(tweet['created_at'], CREATED_AT_FMT)


def media_entities(tweet):
    extended = tweet.get('extended_entities') or {}
    entities = tweet.get('entities') or {}
    return extended.get('media') or entities.get('media') or []


def classify(tweets, account_id):
    """Split tweets into kept threads and dropped categories.

    Returns (threads, dropped, orphan_roots): threads are chronological
    tweet lists (root first); dropped has 'retweets', 'replies' (to other
    accounts) and 'chain' (self-replies whose root was dropped); orphan
    roots are self-replies whose parent is absent from the archive, kept
    as their own roots and listed in the report for a human look.
    """
    by_id = {t['id_str']: t for t in tweets}
    children = {}
    dropped = {'retweets': [], 'replies': [], 'chain': []}
    roots = []
    orphan_roots = []

    for t in sorted(tweets, key=parse_date):
        if t['full_text'].startswith('RT @'):
            dropped['retweets'].append(t)
            continue
        reply_uid = t.get('in_reply_to_user_id_str') or t.get('in_reply_to_user_id')
        if reply_uid and str(reply_uid) != str(account_id):
            dropped['replies'].append(t)
            continue
        if reply_uid:
            parent_id = t.get('in_reply_to_status_id_str') or t.get('in_reply_to_status_id')
            if parent_id and str(parent_id) in by_id:
                children.setdefault(str(parent_id), []).append(t)
            else:
                orphan_roots.append(t)
                roots.append(t)
            continue
        roots.append(t)

    threads = []
    claimed = set()
    for root in roots:
        chain = [root]
        claimed.add(root['id_str'])
        queue = [root['id_str']]
        while queue:
            for child in sorted(children.get(queue.pop(0), []), key=parse_date):
                if child['id_str'] not in claimed:
                    chain.append(child)
                    claimed.add(child['id_str'])
                    queue.append(child['id_str'])
        chain.sort(key=parse_date)
        threads.append(chain)

    # Self-replies never reached from a kept root inherit the drop.
    for t in tweets:
        reply_uid = t.get('in_reply_to_user_id_str') or t.get('in_reply_to_user_id')
        if (reply_uid and str(reply_uid) == str(account_id)
                and t['id_str'] not in claimed
                and not t['full_text'].startswith('RT @')):
            dropped['chain'].append(t)

    return threads, dropped, orphan_roots


def escape_md(text):
    text = _MD_GLOBAL.sub(r'\\\1', text)
    text = _MD_LINESTART.sub(r'\1\\\2\3', text)
    return _MD_OL.sub(r'\1\\.\2', text)


def transform_text(tweet):
    """Mechanical transforms only, never editorial. Tokenizing URLs and
    mentions first keeps escape_md() away from inserted markdown."""
    text = tweet['full_text']
    entities = tweet.get('entities') or {}
    tokens = {}

    for m in media_entities(tweet):
        text = text.replace(m.get('url', ''), '')

    for i, u in enumerate(entities.get('urls') or []):
        token = f'\x00U{i}\x00'
        tokens[token] = u.get('expanded_url') or u.get('url')
        text = text.replace(u['url'], token)

    text = html.unescape(text)

    def _mention(m):
        token = f'\x00M{len(tokens)}\x00'
        tokens[token] = f'[@{m.group(1)}](https://x.com/{m.group(1)})'
        return token

    text = _MENTION_RE.sub(_mention, text)
    text = escape_md(text)
    for token, replacement in tokens.items():
        text = text.replace(token, replacement)
    return re.sub(r'[ \t]+\n', '\n', text).strip()


def media_lines(tweet, media_root, details):
    """Image lines and manifest rows for a tweet's photos. Non-photo media
    (video, animated_gif) is logged and skipped, never fatal: the real
    archive contains zero of them. Missing files keep the text and note
    the absence."""
    lines, rows = [], []
    for n, m in enumerate(media_entities(tweet), start=1):
        media_type = m.get('type', 'photo')
        if media_type != 'photo':
            details['media_skipped_nonphoto'].append(f"{tweet['id_str']} ({media_type})")
            continue
        remote = m.get('media_url_https') or m.get('media_url') or ''
        base = remote.rsplit('/', 1)[-1]
        ext = os.path.splitext(base)[1].lower()
        archive_name = f"{tweet['id_str']}-{base}"
        if not os.path.isfile(os.path.join(media_root, archive_name)):
            details['media_missing'].append(archive_name)
            continue
        out_ext = '.webp' if ext in CONVERTED_EXTS else ext
        url = f"{CDN_NOTES_BASE}/{tweet['id_str']}-{n}{out_ext}"
        lines.append(f'![]({url})')
        rows.append({'archive': archive_name,
                     'staged': f"{tweet['id_str']}-{n}{ext}",
                     'key': f"notes/{tweet['id_str']}-{n}{out_ext}",
                     'url': url})
    return lines, rows


def build_notes(tweets, account, media_root):
    """Filter, stitch and transform. Returns (notes, counts, manifest_rows,
    details). Genuinely empty results (no text, no renderable media) are
    flagged for a human call, not emitted."""
    threads, dropped, orphan_roots = classify(tweets, account['accountId'])
    details = {
        'empties_flagged': [],
        'media_missing': [],
        'media_skipped_nonphoto': [],
        'orphan_roots': [t['id_str'] for t in orphan_roots],
        'chain_dropped': [t['id_str'] for t in dropped['chain']],
    }
    notes, manifest_rows = [], []
    kept = 0
    for chain in threads:
        blocks, rows = [], []
        for t in chain:
            text = transform_text(t)
            lines, tweet_rows = media_lines(t, media_root, details)
            rows.extend(tweet_rows)
            piece = '\n\n'.join(p for p in [text, '\n'.join(lines)] if p)
            if piece:
                blocks.append(piece)
        body = '\n\n'.join(blocks)
        if not body:
            details['empties_flagged'].extend(t['id_str'] for t in chain)
            continue
        kept += len(chain)
        manifest_rows.extend(rows)
        first = chain[0]
        notes.append({
            'date': parse_date(first),
            'tweetId': first['id_str'],
            'source': f"https://x.com/{account['username']}/status/{first['id_str']}",
            'tweetCount': len(chain),
            'body': body,
        })
    counts = {
        'archive_total': len(tweets),
        'kept_tweets': kept,
        'notes_emitted': len(notes),
        'retweets_dropped': len(dropped['retweets']),
        'replies_dropped': len(dropped['replies']) + len(dropped['chain']),
        'chain_dropped': len(dropped['chain']),
        'empties_flagged': len(details['empties_flagged']),
        'orphan_roots': len(orphan_roots),
        'media_photos': len(manifest_rows),
        'media_missing': len(details['media_missing']),
        'media_skipped_nonphoto': len(details['media_skipped_nonphoto']),
    }
    return notes, counts, manifest_rows, details


def render_note(note):
    iso = note['date'].astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')
    return ('---\n'
            f"date: '{iso}'\n"
            f"tweetId: '{note['tweetId']}'\n"
            f"source: '{note['source']}'\n"
            f"tweetCount: {note['tweetCount']}\n"
            '---\n'
            '\n'
            f"{note['body']}\n")


def existing_by_tweet_id(notes_dir):
    out = {}
    if not os.path.isdir(notes_dir):
        return out
    for name in sorted(os.listdir(notes_dir)):
        if not name.endswith('.md'):
            continue
        path = os.path.join(notes_dir, name)
        with open(path, encoding='utf-8') as f:
            m = FRONTMATTER_ID_RE.search(f.read())
        if m:
            out[m.group(1)] = path
    return out


def write_if_changed(path, content):
    if os.path.isfile(path):
        with open(path, encoding='utf-8') as f:
            if f.read() == content:
                return False
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    return True


def emit(notes, notes_dir):
    """Write notes keyed by tweetId; returns how many files changed."""
    os.makedirs(notes_dir, exist_ok=True)
    existing = existing_by_tweet_id(notes_dir)
    taken = {os.path.basename(p) for p in existing.values()}
    written = 0
    for note in sorted(notes, key=lambda n: n['date']):
        path = existing.get(note['tweetId'])
        if path is None:
            base = note['date'].astimezone(timezone.utc).strftime('%Y%m%d-%H%M%S')
            name, suffix = base + '.md', 2
            while name in taken:
                name = f'{base}-{suffix}.md'
                suffix += 1
            taken.add(name)
            path = os.path.join(notes_dir, name)
        if write_if_changed(path, render_note(note)):
            written += 1
    return written


def write_report(counts, details):
    lines = [f'{k}: {v}' for k, v in counts.items()]
    for name in ('empties_flagged', 'media_missing', 'media_skipped_nonphoto',
                 'orphan_roots', 'chain_dropped'):
        if details[name]:
            lines += ['', f'# {name}']
            lines += [f'  {item}' for item in details[name]]
    write_if_changed(REPORT_PATH, '\n'.join(lines) + '\n')


def stage_media(manifest_rows, media_root, dest):
    os.makedirs(dest, exist_ok=True)
    for row in manifest_rows:
        shutil.copyfile(os.path.join(media_root, row['archive']),
                        os.path.join(dest, row['staged']))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive-root',
                        help='Archive location override (default: auto-locate).')
    parser.add_argument('--stage-media', metavar='DIR',
                        help='Also copy referenced photos into DIR under their staged names.')
    args = parser.parse_args()
    try:
        root = args.archive_root or backup_paths.twitter_archive_root()
    except RuntimeError as err:
        print(err)
        return 1
    tweets, account = load_archive(root)
    media_root = os.path.join(root, 'data', 'tweets_media')
    notes, counts, manifest_rows, details = build_notes(tweets, account, media_root)
    written = emit(notes, NOTES_DIR)
    write_report(counts, details)
    write_if_changed(MEDIA_MANIFEST_PATH, json.dumps(manifest_rows, indent=2) + '\n')
    if args.stage_media:
        stage_media(manifest_rows, media_root, args.stage_media)
        print(f'staged {len(manifest_rows)} media file(s) -> {args.stage_media}')
    for key, value in counts.items():
        print(f'{key}: {value}')
    print(f'note files written or updated: {written}')
    reconciled = counts['archive_total'] == (
        counts['kept_tweets'] + counts['retweets_dropped']
        + counts['replies_dropped'] + counts['empties_flagged'])
    print('reconciliation:', 'OK' if reconciled else 'MISMATCH')
    return 0 if reconciled else 1


if __name__ == '__main__':
    sys.exit(main())
```

- [ ] Run the tests to green:

```bash
cd "$WT/scripts/migrate" && .venv/bin/python -m pytest test_tweets_import.py -q
```

Expected: all pass (11 tests).

- [ ] Prove the friendly missing-archive failure end to end (env points at an empty dir):

```bash
cd "$WT/scripts/migrate" && TWITTER_ARCHIVE_ROOT=/tmp/definitely-absent .venv/bin/python -c "
import backup_paths
try:
    backup_paths.twitter_archive_root()
except RuntimeError as e:
    print(e)
" | head -5
```

Wait: the env override candidate fails, but the real archive exists at the repo-relative candidate, so this prints the real path instead of the error. That is correct locator behavior; the friendly-error path is covered by `test_twitter_archive_missing_raises_friendly_error`. Skip this manual step if the output is a real path.

- [ ] Commit:

```bash
cd "$WT" && git branch --show-current && git add scripts/migrate/tweets_import.py scripts/migrate/test_tweets_import.py && git commit -m "feat(migrate): add the tweets importer

Parses the YTD archive, drops retweets and replies to others, stitches
self-threads chronologically, applies mechanical text transforms
(t.co expansion, entity decode, mention links, media stub removal,
markdown escaping), and emits notes keyed by tweetId with
write-only-if-changed. Also emits the media manifest, the import
report with count reconciliation, and a media staging mode.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- scripts/migrate/tweets_import.py scripts/migrate/test_tweets_import.py
```

## Task 4: Verifier `verify_tweets.py` (TDD)

- [ ] Create `scripts/migrate/test_verify_tweets.py` first (failing):

```python
import os

import verify_tweets


def test_reconcile_accepts_matching_counts():
    counts = {'archive_total': 12, 'kept_tweets': 7, 'retweets_dropped': 1,
              'replies_dropped': 3, 'empties_flagged': 1}
    assert verify_tweets.reconcile(counts) == []


def test_reconcile_reports_mismatch():
    counts = {'archive_total': 13, 'kept_tweets': 7, 'retweets_dropped': 1,
              'replies_dropped': 3, 'empties_flagged': 1}
    problems = verify_tweets.reconcile(counts)
    assert len(problems) == 1
    assert '13' in problems[0]


def test_parse_report_reads_count_lines_only(tmp_path):
    report = tmp_path / 'tweets_report.txt'
    report.write_text('archive_total: 12\nkept_tweets: 7\n\n# empties_flagged\n  9012\n',
                      encoding='utf-8')
    parsed = verify_tweets.parse_report(str(report))
    assert parsed == {'archive_total': 12, 'kept_tweets': 7}


def test_account_needles_derive_from_email():
    needles = verify_tweets.account_needles({'email': 'Fixture@Example.com'})
    assert 'fixture@example.com' in needles
    assert 'fixture' in needles
    assert all(len(n) >= 5 for n in needles)


def test_account_needles_exclude_already_public_strings():
    needles = verify_tweets.account_needles(
        {'email': 'fixtureuser@example.com', 'username': 'fixtureuser'})
    assert 'fixtureuser' not in needles
    assert 'fixtureuser@example.com' in needles
```

- [ ] Run: `cd "$WT/scripts/migrate" && .venv/bin/python -m pytest test_verify_tweets.py -q`. Expected: `ModuleNotFoundError`.

- [ ] Create `scripts/migrate/verify_tweets.py`:

```python
"""Acceptance gate for the tweets -> notes import.

T1: fresh recomputation from the archive reconciles exactly (archive total =
kept + dropped retweets + dropped replies incl. chain + flagged empties) and
matches the committed tweets_report.txt. T2: notes on disk match (count,
frontmatter shape, unique tweetIds, tweetCount sum). T3: PII scan of emitted
files with needles derived at RUNTIME from account.js (this file never embeds
them). T4: every CDN URL referenced by notes returns HTTP 200 (skippable
before the media upload with --skip-cdn).

`npm run build` is the fourth spec check; run it from the repo root after
this script passes.

Usage:
    .venv/bin/python verify_tweets.py [--archive-root PATH] [--skip-cdn]
"""
import argparse
import glob
import os
import re
import sys
import urllib.request

import backup_paths
from tweets_import import build_notes, load_archive

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
NOTES_DIR = os.path.join(REPO, 'src', 'content', 'notes')
REPORT_PATH = os.path.join(HERE, 'tweets_report.txt')
MANIFEST_PATH = os.path.join(HERE, 'tweets_media_manifest.json')

EMAIL_RE = re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
CDN_RE = re.compile(r'https://cdn\.anping\.us/[^\s)"\']+')
NOTE_FM_RE = re.compile(
    r"\A---\n"
    r"date: '\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z'\n"
    r"tweetId: '(\d+)'\n"
    r"source: 'https://x\.com/[A-Za-z0-9_]+/status/\1'\n"
    r"tweetCount: (\d+)\n"
    r"---\n\n")

_results = []


def check(name, ok, details=None):
    _results.append((name, ok))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}")
    for line in (details or [])[:50]:
        print(f'    {line}')
    extra = len(details or []) - 50
    if extra > 0:
        print(f'    ... and {extra} more')
    return ok


def parse_report(path):
    parsed = {}
    with open(path, encoding='utf-8') as f:
        for line in f:
            m = re.match(r'^([a-z_]+):\s*(-?\d+)\s*$', line)
            if m:
                parsed[m.group(1)] = int(m.group(2))
    return parsed


def reconcile(counts):
    """Identity check; returns a list of problems (empty means OK)."""
    expected = (counts['kept_tweets'] + counts['retweets_dropped']
                + counts['replies_dropped'] + counts['empties_flagged'])
    if counts['archive_total'] != expected:
        return [f"archive_total {counts['archive_total']} != "
                f"kept+retweets+replies+empties = {expected}"]
    return []


def account_needles(account):
    """PII needles derived at runtime so this file never embeds them.

    Mirrors verify.py's _dump_email_needles exclusion: a needle that already
    occurs inside public strings (the public username, x.com source URLs,
    the CDN host) was always public, so a hit could never indicate a leak.
    """
    email = (account.get('email') or '').lower()
    local = email.split('@', 1)[0]
    public = ' '.join([
        (account.get('username') or '').lower(),
        'https://x.com/',
        'https://cdn.anping.us/',
    ])
    return sorted(n for n in {email, local} if len(n) >= 5 and n not in public)


def t1_counts(archive_root):
    tweets, account = load_archive(archive_root)
    media_root = os.path.join(archive_root, 'data', 'tweets_media')
    _notes, counts, _rows, _details = build_notes(tweets, account, media_root)
    problems = reconcile(counts)
    check('T1a: recomputed counts reconcile exactly', not problems, problems)
    reported = parse_report(REPORT_PATH) if os.path.isfile(REPORT_PATH) else {}
    mismatches = [f'{k}: report has {reported.get(k)}, recomputed {v}'
                  for k, v in counts.items() if reported.get(k) != v]
    check('T1b: tweets_report.txt matches a fresh recomputation',
          not mismatches, mismatches)
    return counts, account


def t2_notes(counts):
    files = sorted(glob.glob(os.path.join(NOTES_DIR, '*.md')))
    n = counts['notes_emitted']
    check(f'T2a: exactly {n} notes in src/content/notes/', len(files) == n,
          None if len(files) == n else [f'found {len(files)}'])
    ids, tweet_sum, bad = [], 0, []
    for path in files:
        with open(path, encoding='utf-8') as f:
            m = NOTE_FM_RE.match(f.read())
        if not m:
            bad.append(os.path.relpath(path, REPO))
            continue
        ids.append(m.group(1))
        tweet_sum += int(m.group(2))
    check('T2b: every note has the exact frontmatter shape', not bad, bad)
    dupes = sorted({i for i in ids if ids.count(i) > 1})
    check('T2c: tweetId unique across all notes', not dupes, dupes)
    check(f"T2d: tweetCount sums to kept_tweets ({counts['kept_tweets']})",
          tweet_sum == counts['kept_tweets'], [f'sum is {tweet_sum}'])
    return files


def t3_pii(files, account):
    scope = list(files)
    for extra in (REPORT_PATH, MANIFEST_PATH):
        if os.path.isfile(extra):
            scope.append(extra)
    loaded = []
    for path in scope:
        with open(path, encoding='utf-8', errors='replace') as f:
            loaded.append((path, f.read()))
    email_hits = [f'{os.path.relpath(p, REPO)}: "{m.group(0)}"'
                  for p, text in loaded for m in EMAIL_RE.finditer(text)]
    check('T3a: zero email-pattern matches in emitted files',
          not email_hits, email_hits)
    needles = account_needles(account)
    needle_hits = [f'{os.path.relpath(p, REPO)}: needle hit'
                   for p, text in loaded for n in needles if n in text.lower()]
    check(f'T3b: zero hits for {len(needles)} account-derived needles',
          not needle_hits, needle_hits)


def t4_cdn(files, skip):
    urls = sorted({u for path in files
                   for u in CDN_RE.findall(open(path, encoding='utf-8').read())})
    if skip:
        print(f'[SKIP] T4: CDN check over {len(urls)} URL(s) (--skip-cdn)')
        return
    misses = []
    for url in urls:
        request = urllib.request.Request(url, method='HEAD')
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                if response.status != 200:
                    misses.append(f'{url}: HTTP {response.status}')
        except Exception as err:  # noqa: BLE001 - any failure is a miss
            misses.append(f'{url}: {err}')
    check(f'T4: all {len(urls)} CDN URLs return HTTP 200', not misses, misses)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive-root',
                        help='Archive location override (default: auto-locate).')
    parser.add_argument('--skip-cdn', action='store_true',
                        help='Skip the CDN 200 check (for pre-upload runs).')
    args = parser.parse_args()
    try:
        root = args.archive_root or backup_paths.twitter_archive_root()
    except RuntimeError as err:
        print(err)
        sys.exit(1)
    counts, account = t1_counts(root)
    files = t2_notes(counts)
    t3_pii(files, account)
    t4_cdn(files, args.skip_cdn)
    print()
    print('--- summary ---')
    for name, ok in _results:
        print(f"[{'PASS' if ok else 'FAIL'}] {name}")
    all_passed = all(ok for _, ok in _results)
    print()
    print('RESULT:', 'ALL PASS' if all_passed else 'FAIL')
    sys.exit(0 if all_passed else 1)


if __name__ == '__main__':
    main()
```

- [ ] Run to green: `cd "$WT/scripts/migrate" && .venv/bin/python -m pytest test_verify_tweets.py -q`. Expected: 5 pass.
- [ ] Commit:

```bash
cd "$WT" && git branch --show-current && git add scripts/migrate/verify_tweets.py scripts/migrate/test_verify_tweets.py && git commit -m "feat(migrate): add the tweets import verifier

Reconciles counts against a fresh recomputation and the committed
report, validates note frontmatter shape and tweetId uniqueness,
scans for PII with needles derived at runtime from account.js, and
checks every CDN URL returns 200 (skippable before upload).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- scripts/migrate/verify_tweets.py scripts/migrate/test_verify_tweets.py
```

## Task 5: Notes content collection

- [ ] Edit `src/content.config.ts`. Add after the `translations` collection:

```ts
const notes = defineCollection({
  // Microblog notes imported from the X/Twitter archive by
  // scripts/migrate/tweets_import.py. One file per tweet or self-thread,
  // keyed by tweetId; bodies are verbatim tweet text (mechanical
  // transforms only). No titles, no drafts, no bilingual siblings.
  loader: glob({
    base: './src/content/notes',
    pattern: '**/*.md',
  }),
  schema: z.object({
    date: z.coerce.date(),
    tweetId: z.string(),
    source: z.string().url(),
    tweetCount: z.number().int().positive(),
  }),
});
```

And change the export line to:

```ts
export const collections = { posts, translations, notes };
```

- [ ] Create the directory so the loader has a base before the real import lands (removed again in Task 6's commit):

```bash
cd "$WT" && mkdir -p src/content/notes && touch src/content/notes/.gitkeep
```

- [ ] Verify: `cd "$WT" && npm run check`. Expected: 0 errors (warnings about an empty collection are fine).
- [ ] Commit:

```bash
cd "$WT" && git branch --show-current && git add src/content.config.ts src/content/notes/.gitkeep && git commit -m "feat(notes): add the notes content collection

Frontmatter per the spec: date, tweetId (idempotency key), source URL
on x.com, and tweetCount for stitched self-threads.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- src/content.config.ts src/content/notes/.gitkeep
```

## Task 6: The real import run

The archive is present at `Personal Website/Backup/twitter-archive/`. Expected ballpark from measurement: 228 total, 6 retweets, some of the 64 replies dropped, roughly 150 to 180 notes emitted. Exact numbers come from the report; do not force them.

- [ ] Checkpoint first (mass content write):

```bash
cd "$WT" && npm run checkpoint -- save
```

Expected: a saved checkpoint ref is printed.

- [ ] Run the importer:

```bash
cd "$WT" && scripts/migrate/.venv/bin/python scripts/migrate/tweets_import.py
```

Expected output: the counts block ending in `reconciliation: OK`, with `archive_total: 228`, `retweets_dropped: 6`, `media_photos: 10` (or 10 minus any missing), and `note files written or updated:` equal to `notes_emitted`.

- [ ] Read `scripts/migrate/tweets_report.txt`. Give any `empties_flagged`, `orphan_roots`, `media_missing` or `media_skipped_nonphoto` IDs a human look (open the tweet via `https://x.com/anpingwww/status/<id>` if needed) and record anything surprising for the owner review. Do not edit note bodies.
- [ ] Spot-check three emitted notes by eye (one plain, one thread with `tweetCount > 1`, one with an image line): frontmatter shape, verbatim text, CDN URLs under `https://cdn.anping.us/notes/`.
- [ ] Verify (CDN skipped, media not uploaded yet):

```bash
cd "$WT" && scripts/migrate/.venv/bin/python scripts/migrate/verify_tweets.py --skip-cdn
```

Expected: `RESULT: ALL PASS` with T4 skipped. Note: T3a hard-fails if any tweet body contains a literal email address; that is the gate working as intended. Surface such a hit to the owner for a human call (keep or drop that note), never edit the verbatim text to pass the check.

- [ ] Idempotency proof, then build:

```bash
cd "$WT" && scripts/migrate/.venv/bin/python scripts/migrate/tweets_import.py | grep 'written or updated'
cd "$WT" && npm run build
```

Expected: `note files written or updated: 0`; the build succeeds (images 404 on the CDN is expected until Task 9 and does not affect the build).

- [ ] Remove the placeholder and commit the real notes plus generated artifacts:

```bash
cd "$WT" && rm src/content/notes/.gitkeep && git branch --show-current && git add src/content/notes scripts/migrate/tweets_report.txt scripts/migrate/tweets_media_manifest.json && git commit -m "feat(notes): import the 2010-2026 X/Twitter archive as notes

Real import run: one markdown note per kept tweet or self-thread,
media manifest for the R2 upload, and the reconciled import report.
Tweet text is preserved verbatim as an authentic record.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- src/content/notes scripts/migrate/tweets_report.txt scripts/migrate/tweets_media_manifest.json
```

(`git add src/content/notes` also stages the `.gitkeep` deletion; `git status --short` afterward must be clean of anything notes-related.)

## Task 7: `/notes` page, nav entry, notes RSS

- [ ] Add notes strings to `src/ui.ts`, after the `postFeed` object inside `ui`:

```ts
  notes: {
    eyebrow: 'Microblog',
    title: 'Notes',
    description: '2010 年至今的微博客存档 · microblog archive from X/Twitter',
    onX: 'on X',
    empty: 'No notes yet.',
  },
```

- [ ] Create `src/styles/pages/notes.css`:

```css
.notes-main {
  max-width: var(--max-width-wide);
  margin: 0 auto;
  padding: var(--space-20) var(--space-6) var(--space-24);
}

.notes-header {
  max-width: var(--max-width-content);
  padding-bottom: var(--space-10);
}

.notes-label.eyebrow-accent {
  margin: 0 0 var(--space-2);
  font-weight: var(--weight-accent-label);
}

.notes-title {
  font-size: clamp(2.125rem, 5vw, 2.875rem);
  font-weight: 650;
  letter-spacing: -0.016em;
  margin: 0;
  line-height: 1.04;
}

.notes-timeline {
  max-width: var(--max-width-content);
}

.notes-year {
  font-size: var(--text-title-3);
  font-weight: var(--weight-semibold);
  color: var(--label-primary);
  margin: var(--space-12) 0 var(--space-2);
}

.note {
  padding: var(--space-6) 0;
  border-top: 1px solid var(--separator);
  scroll-margin-top: calc(var(--nav-height) + var(--space-6));
}

.note:target {
  background: color-mix(in srgb, var(--separator) 24%, transparent);
}

.note-meta {
  display: flex;
  align-items: baseline;
  gap: var(--space-4);
  margin-bottom: var(--space-2);
}

.note-anchor {
  font-size: var(--text-footnote);
  color: var(--label-tertiary);
  text-decoration: none;
}

.note-anchor:hover {
  color: var(--label-primary);
}

.note-source {
  margin-left: auto;
  font-size: var(--text-footnote);
  color: var(--label-tertiary);
  text-decoration: none;
}

.note-source:hover {
  color: var(--label-primary);
}

.note-body {
  font-size: var(--text-callout);
  line-height: 1.7;
  color: var(--label-primary);
  overflow-wrap: anywhere;
}

.note-body p {
  margin: 0 0 var(--space-3);
}

.note-body p:last-child {
  margin-bottom: 0;
}

.note-body img {
  max-width: min(100%, 28rem);
  height: auto;
  border-radius: var(--radius-md);
  margin-top: var(--space-2);
}

.notes-empty {
  color: var(--label-secondary);
}

@media (max-width: 600px) {
  .notes-main {
    padding: var(--space-12) var(--space-4) var(--space-16);
  }
}
```

- [ ] Create `src/pages/notes/index.astro`:

```astro
---
import '../../styles/pages/notes.css';
import { type CollectionEntry, getCollection, render } from 'astro:content';
import FormattedDate from '../../components/FormattedDate.astro';
import BaseLayout from '../../layouts/BaseLayout.astro';
import { getUiText } from '../../ui';

const tr = getUiText();

const notes = (await getCollection('notes')).sort(
  (a, b) => b.data.date.valueOf() - a.data.date.valueOf()
);

type Rendered = Awaited<ReturnType<typeof render>>;
type Entry = { note: CollectionEntry<'notes'>; Content: Rendered['Content'] };

const entries: Entry[] = [];
for (const note of notes) {
  const { Content } = await render(note);
  entries.push({ note, Content });
}

const byYear = new Map<number, Entry[]>();
for (const entry of entries) {
  const year = entry.note.data.date.getUTCFullYear();
  const group = byYear.get(year);
  if (group) group.push(entry);
  else byYear.set(year, [entry]);
}
const years = [...byYear.keys()];
---

<BaseLayout title={tr.notes.title} description={tr.notes.description}>
  <main id="main-content" class="notes-main">
    <div class="notes-header">
      <p class="notes-label eyebrow-accent">{tr.notes.eyebrow}</p>
      <h1 class="notes-title">{tr.notes.title}</h1>
    </div>
    <div class="notes-timeline">
      {
        years.map((year) => (
          <section class="notes-year-group" aria-label={String(year)}>
            <h2 class="notes-year">{year}</h2>
            {(byYear.get(year) ?? []).map(({ note, Content }) => (
              <article class="note" id={note.data.tweetId}>
                <header class="note-meta">
                  <a class="note-anchor" href={`#${note.data.tweetId}`}>
                    <FormattedDate date={note.data.date} />
                  </a>
                  <a class="note-source" href={note.data.source} target="_blank" rel="noopener noreferrer">
                    {tr.notes.onX}
                  </a>
                </header>
                <div class="note-body">
                  <Content />
                </div>
              </article>
            ))}
          </section>
        ))
      }
      {entries.length === 0 && <p class="notes-empty">{tr.notes.empty}</p>}
    </div>
  </main>
</BaseLayout>
```

- [ ] Create `src/pages/notes/rss.xml.js`:

```js
import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_LANG, SITE_TITLE } from '../../consts';
import { withBase } from '../../utils/paths';

const MENTION_LINK_RE = /\[(@[^\]]+)\]\([^)]+\)/g;
const MD_UNESCAPE_RE = /\\([\\`*_[\]<>~|#+.-])/g;

// Notes have no titles: use the first text line (markdown escapes undone,
// mention links reduced to their handles) truncated to about 60 characters,
// or the date for media-only notes.
export function itemTitle(note) {
  const firstLine = (note.body ?? '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('!['));
  if (!firstLine) return note.data.date.toISOString().slice(0, 10);
  const plain = firstLine.replace(MENTION_LINK_RE, '$1').replace(MD_UNESCAPE_RE, '$1');
  return plain.length > 60 ? `${plain.slice(0, 59)}…` : plain;
}

export async function GET(context) {
  const notes = (await getCollection('notes'))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .slice(0, 20);

  return rss({
    title: `${SITE_TITLE} · Notes`,
    description: 'Microblog archive from X/Twitter',
    site: new URL(withBase('/notes/'), context.site),
    customData: `<language>${SITE_LANG}</language>`,
    items: notes.map((note) => ({
      title: itemTitle(note),
      description: note.body ?? '',
      pubDate: note.data.date,
      link: withBase(`/notes/#${note.data.tweetId}`),
    })),
  });
}
```

- [ ] Nav entry. In `astro-theme-config.ts`, change the `NavItem` type and the `nav` array:

```ts
type NavItem = {
  label: string;
  href: string;
  /** Optional zh label; when set the header renders a toggle-aware pair. */
  labelZh?: string;
};
```

```ts
  // The logo already links to `/`. Add items here if you want visible header links.
  // Example: [{ label: 'Posts', href: '/posts' }, { label: 'About', href: '/about' }]
  nav: [{ label: 'Notes', labelZh: '随记', href: '/notes' }] as NavItem[],
```

(随记 is the spec's default proposal; the owner may rename it at the preview.)

- [ ] In `src/components/Header.astro`, add the import and make labels toggle-aware. Import block gains:

```astro
import LangText from './LangText.astro';
```

Replace the nav-links line:

```astro
{navItems.map((item) => <HeaderLink href={item.href}>{item.label}</HeaderLink>)}
```

with:

```astro
{
  navItems.map((item) => (
    <HeaderLink href={item.href}>
      {item.labelZh ? <LangText text={{ zh: item.labelZh, en: item.label }} /> : item.label}
    </HeaderLink>
  ))
}
```

- [ ] Verify main RSS and posts list are untouched: `cd "$WT" && git diff --stat -- src/pages/rss.xml.js src/pages/posts src/pages/index.astro` prints nothing.
- [ ] Verify:

```bash
cd "$WT" && npm run check && npm run lint && npm run lint:css && npm run build
```

Expected: all clean; the build emits `/notes/index.html` and `/notes/rss.xml`. Then confirm content:

```bash
cd "$WT" && grep -c '<article class="note"' dist/notes/index.html && grep -c '<item>' dist/notes/rss.xml
```

Expected: the note count from the report, and `20`.

- [ ] Commit:

```bash
cd "$WT" && git branch --show-current && git add src/pages/notes src/styles/pages/notes.css src/ui.ts astro-theme-config.ts src/components/Header.astro && git commit -m "feat(notes): add the /notes timeline, header nav entry and notes RSS

Single page, newest first with year headings, anchor permalinks by
tweetId, on X source links, compact styling from existing tokens.
Nav label renders as a bilingual pair (随记 / Notes). New feed at
/notes/rss.xml with the latest 20 notes; main RSS unchanged.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- src/pages/notes src/styles/pages/notes.css src/ui.ts astro-theme-config.ts src/components/Header.astro
```

## Task 8: Image pipeline parameterized prefix/source-dir mode (TDD)

- [ ] Add failing tests. In `scripts/images/references.test.mjs` append:

```js
test('deriveKey with a prefix replaces the date path', () => {
  assert.equal(deriveKey('123-1.jpg', JULY, 'notes'), 'notes/123-1.webp')
  assert.equal(deriveKey('123-2.PNG', JULY, 'notes/'), 'notes/123-2.webp')
  assert.equal(deriveKey('IMG 1.JPG', JULY, null), '2026/07/IMG-1.webp')
})
```

In `scripts/images/process.test.mjs` append:

```js
test('run() with a prefix and custom staging dir yields notes/ snippets', async () => {
  const work = mkdtempSync(join(tmpdir(), 'proc-notes-'))
  try {
    const staging = join(work, 'staged-notes')
    const jpg = await sharp({
      create: { width: 320, height: 240, channels: 3, background: { r: 9, g: 9, b: 9 } },
    }).jpeg().toBuffer()
    const { mkdirSync } = await import('node:fs')
    mkdirSync(staging, { recursive: true })
    writeFileSync(join(staging, '9006-1.jpg'), jpg)

    const res = await run({
      stagingDir: staging,
      manifestPath: join(work, '.manifest.json'),
      dryRun: true,
      prefix: 'notes',
      now: new Date('2026-07-15T00:00:00Z'),
      log: () => {},
    })
    assert.equal(res.count, 1)
    assert.equal(res.snippets[0], '![](https://cdn.anping.us/notes/9006-1.webp)')
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
})
```

- [ ] Run and watch the new tests fail: `cd "$WT" && npm run test:images`. Expected: 2 failures (prefix argument ignored).

- [ ] Implement. In `scripts/images/references.mjs` replace `deriveKey`:

```js
// For NEW uploads: sanitized basename under the current year/month, or under
// a fixed key prefix (e.g. 'notes') when one is given.
export function deriveKey(originalName, date, prefix = null) {
  const ext = path.extname(originalName)
  const base = sanitize(path.basename(originalName, ext))
  if (prefix) return `${prefix.replace(/\/+$/, '')}/${base}${outExtFor(ext)}`
  const yyyy = String(date.getUTCFullYear())
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${yyyy}/${mm}/${base}${outExtFor(ext)}`
}
```

In `scripts/images/process.mjs`:
  - `run()` options gain `prefix = null` and `archive = true`.
  - The key derivation line becomes `const key = deriveKey(path.basename(file), now, prefix)`.
  - The archive call is gated: `if (!dryRun && config && archive) { ... }` (notes originals already live in the twitter-archive backup, spec: out of band).
  - CLI entry: replace the entire existing CLI block with the version below. It keeps the trailing `.then()/.catch()` chain exactly as it is today (only the arg parsing and the empty-dir message change), so upload errors still print and exit non-zero:

```js
// CLI entry (pathToFileURL handles spaces in the repo path)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argValue = (flag) => {
    const i = process.argv.indexOf(flag)
    return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null
  }

  const dryRun = process.argv.includes('--dry-run')
  const stagingDir = argValue('--staging-dir') ?? DEFAULT_STAGING
  const manifestPath = argValue('--manifest') ?? DEFAULT_MANIFEST
  const prefix = argValue('--prefix')
  const archive = !process.argv.includes('--no-archive')
  loadEnvFile()
  const config = dryRun ? null : loadConfig()
  run({ dryRun, config, stagingDir, manifestPath, prefix, archive })
    .then(({ snippets, count }) => {
      if (count === 0) {
        console.log(`No images in ${stagingDir}/. Drop .jpg/.jpeg/.png there and re-run.`)
        return
      }
      console.log('\nPaste into your post:\n')
      console.log(snippets.join('\n'))
    })
    .catch((err) => {
      console.error(err.message)
      process.exit(1)
    })
}
```

- [ ] Run to green: `cd "$WT" && npm run test:images`. Expected: all pass (the R2 live test self-skips without credentials).
- [ ] Commit:

```bash
cd "$WT" && git branch --show-current && git add scripts/images/references.mjs scripts/images/process.mjs scripts/images/references.test.mjs scripts/images/process.test.mjs && git commit -m "feat(images): parameterized prefix, staging dir and manifest for the pipeline

deriveKey accepts a fixed key prefix (notes/ uploads) instead of the
date path; the CLI gains --staging-dir, --prefix, --manifest and
--no-archive so the notes import reuses the pipeline instead of a
parallel copy.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- scripts/images/references.mjs scripts/images/process.mjs scripts/images/references.test.mjs scripts/images/process.test.mjs
```

## Task 9: Upload the 10 photos to R2 and verify the CDN

Credentials: `.env.local` is git-ignored and absent from this worktree. Copy it from the main checkout; it must never be committed (the `.env.*` gitignore rule already covers it; do not weaken that rule).

- [ ] Copy credentials and stage media into a private dir (the shared `image-staging/` stays untouched; concurrent sessions use it). The main checkout has moved on disk before: re-verify the `.env.local` source path at execution time, and if it is absent, stop, locate the current main checkout (or ask the owner) before proceeding. A failed copy aborts this whole upload task:

```bash
ENV_SRC="/Users/anping.wang/Documents/Stuff/AI Space/Personal Website/Personal Blog/Personal Blog/.env.local"
[ -f "$ENV_SRC" ] || { echo "ABORT: .env.local not found at $ENV_SRC (main checkout moved?); do not continue this task"; false; }
cp "$ENV_SRC" "$WT/.env.local"
mkdir -p /tmp/notes-media-staging
cd "$WT" && scripts/migrate/.venv/bin/python scripts/migrate/tweets_import.py --stage-media /tmp/notes-media-staging
ls /tmp/notes-media-staging
```

Expected: `staged 10 media file(s) -> /tmp/notes-media-staging` (or 10 minus report misses), files named `<tweetId>-<n>.<ext>`, plus `note files written or updated: 0` (idempotent re-run).

- [ ] Dry-run the upload first and eyeball the keys:

```bash
cd "$WT" && node scripts/images/process.mjs --dry-run --staging-dir /tmp/notes-media-staging --prefix notes --manifest scripts/images/.manifest-notes.json
```

Expected: one `[dry-run] notes/<tweetId>-<n>.webp (...)` line per file, no other prefixes.

- [ ] Real upload (uses a notes-specific dedupe manifest, git-ignored in the next step; `--no-archive` because originals stay in the twitter-archive backup):

```bash
cd "$WT" && node scripts/images/process.mjs --staging-dir /tmp/notes-media-staging --prefix notes --manifest scripts/images/.manifest-notes.json --no-archive
```

Expected: `✓ uploaded notes/<tweetId>-<n>.webp` per file.

- [ ] Full verification including the CDN check, then a build:

```bash
cd "$WT" && scripts/migrate/.venv/bin/python scripts/migrate/verify_tweets.py && npm run build
```

Expected: `RESULT: ALL PASS` (T4 checks each CDN URL for HTTP 200) and a clean build.

- [ ] Ignore the notes dedupe manifest: append to the `# blog image pipeline` block in `.gitignore`:

```
scripts/images/.manifest-notes.json
```

- [ ] Confirm nothing sensitive is trackable: `cd "$WT" && git status --short` must show neither `.env.local` nor `.manifest-notes.json`.
- [ ] Commit:

```bash
cd "$WT" && git branch --show-current && git add .gitignore && git commit -m "chore(images): ignore the notes upload manifest

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- .gitignore
```

## Task 10: Preview gate learns about notes (TDD)

- [ ] Add failing tests to `scripts/preview-posts.test.mjs`:

```js
test('classifyPath: note content files', () => {
  assert.equal(classifyPath('src/content/notes/20140724-093000.md'), 'note')
  assert.equal(classifyPath('src/content/notes/20140724-093000-2.md'), 'note')
  // Nested or non-markdown paths fall back to the site-wide bucket.
  assert.equal(classifyPath('src/content/notes/nested/x.md'), 'site')
})

test('reviewTargets: note changes map to the notes timeline', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  write(root, 'src/content/posts/alpha.md', FM)
  assert.deepEqual(
    reviewTargets(root, ['src/content/notes/20100805-090000.md', 'src/content/posts/alpha.md']),
    ['/notes/', '/posts/alpha/'],
  )
})

test('reviewTargets: a deleted note still reviews the timeline', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  assert.deepEqual(reviewTargets(root, ['src/content/notes/20100805-090000.md']), ['/notes/'])
})

test('checkPostPreview: an unapproved note change fails', (t) => {
  const root = makeFixtureRepo()
  t.after(() => cleanup(root))
  write(root, 'src/content/notes/20100805-090000.md', "---\ndate: '2010-08-05T09:00:00.000Z'\ntweetId: '9001'\nsource: 'https://x.com/u/status/9001'\ntweetCount: 1\n---\n\nbody\n")
  assert.equal(checkPostPreview(root, { baseRef: 'HEAD' }).status, 'FAIL')
})
```

- [ ] Run and watch them fail: `cd "$WT" && node --test scripts/preview-posts.test.mjs`. Expected: the four new tests fail (`'site'` where `'note'` expected, targets contain `/` and the representative post).

- [ ] Implement in `scripts/preview-posts.mjs`. Below `POST_RE` add:

```js
const NOTE_RE = /^src\/content\/notes\/[^/]+\.(?:md|mdx)$/
```

Update `classifyPath` (comment included):

```js
// 'post' renders at /posts/<slug>/; 'note' renders on the /notes/ timeline;
// 'site' can change any page; null never affects the deployed site. Content
// files must win over the generic src/ prefix rule.
export function classifyPath(path) {
  if (POST_RE.test(path)) return 'post'
  if (NOTE_RE.test(path)) return 'note'
  if (SITE_RE.test(path)) return 'site'
  return null
}
```

Update the loop body in `reviewTargets` (notes have no per-note pages, so any note change, including a deletion, reviews the timeline):

```js
  for (const path of changeSet) {
    const kind = classifyPath(path)
    if (kind === 'post') {
      if (existsSync(join(root, primaryPostPath(path)))) targets.add(`/posts/${slugForPostFile(path)}/`)
      else targets.add('/')
    } else if (kind === 'note') {
      targets.add('/notes/')
    } else {
      targets.add('/')
      targets.add(`/posts/${REPRESENTATIVE_POST}/`)
    }
  }
```

(`computeChangeSet` needs no change: the draft exclusion is already gated on `kind === 'post'` and notes have no draft flag.)

- [ ] Run to green: `cd "$WT" && npm run test:safety`. Expected: all pass.
- [ ] Update `.claude/skills/preview-posts/SKILL.md`: at the end of the first paragraph under the heading (after "any later edit voids it automatically."), add the sentence:

```
Changed notes under src/content/notes/ review at /notes/ (the timeline is their only page).
```

- [ ] Commit:

```bash
cd "$WT" && git branch --show-current && git add scripts/preview-posts.mjs scripts/preview-posts.test.mjs .claude/skills/preview-posts/SKILL.md && git commit -m "feat(preview): map note changes to the /notes review target

Changed files under src/content/notes/ classify as notes and review on
the /notes/ timeline instead of the generic site-wide bucket.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" -- scripts/preview-posts.mjs scripts/preview-posts.test.mjs .claude/skills/preview-posts/SKILL.md
```

## Task 11: Owner preview trial (final task, no approve, no merge, no push)

- [ ] Full test sweep first:

```bash
cd "$WT/scripts/migrate" && .venv/bin/python -m pytest -q
cd "$WT" && npm run test:images && npm run test:rehype && npm run test:safety && npm run check && npm run lint && npm run lint:css
```

Expected: everything green.

- [ ] Serve the production build for the owner (headless session, so `--no-open`; add `-- --port 4323` if 4322 is taken by another session):

```bash
cd "$WT" && npm run preview-posts -- --no-open
```

Expected: the change list (notes, pages, scripts), a successful build, then `review page: .../.preview/review.html` and `server: http://localhost:4322/`. The review page lists `/`, `/notes/`, and `/posts/springtime-in-patagonia/` (the latter two because site-wide files changed).

- [ ] Hand the owner `http://localhost:4322/notes/` (plus the review page path). The owner checks, in their own browser:
  - the full timeline: newest first, year headings match the report's distribution (2014 the largest year);
  - anchors: clicking a date sets `/notes#<tweetId>` and the entry highlights; a hard reload on that URL scrolls correctly under the sticky header;
  - "on X" links open the original tweets;
  - the 10 images load from `https://cdn.anping.us/notes/`;
  - both languages via the EN·中 toggle (nav shows 随记 / Notes; note bodies stay as authored);
  - dark mode, and a narrow window or real phone (`npm run preview-posts -- --host` prints a LAN URL if wanted);
  - `/notes/rss.xml` renders with 20 items and sane titles;
  - the homepage and one post page look unchanged;
  - flagged report items (empties, orphan roots, missing media, if any): owner decides whether anything needs rescuing, in a follow-up.
- [ ] Iterate: apply requested edits (styling and label changes only; note bodies stay verbatim), re-run `npm run preview-posts -- --no-open`, repeat until the owner is satisfied. Commit each iteration with explicit paths as in Task 7.
- [ ] STOP HERE. Explicitly out of scope for this plan: `npm run preview-posts -- --approve` (owner's call, later), `npm run release-check` GO, merging `tweets-notes` to `main`, pushing. Release-check check 12 will report NO-GO until the owner approves; that is the gate doing its job.

## Post-plan notes for the merge session (not tasks)

- Merging to `main` happens in a later session with the owner: preview approval, `npm run release-check` (add `-- --full` for the CDN link sweep), and the owner's explicit push go-ahead (rules 5 and 7 in CLAUDE.md).
- `verify_tweets.py` and the importer stay re-runnable against a future, newer archive export: re-extraction to the same Backup path, re-run, re-verify; tweetId keying means updates land in place.
- The zh nav label 随记 is a proposal; renaming it is a one-line change in `astro-theme-config.ts` at the owner's word.
