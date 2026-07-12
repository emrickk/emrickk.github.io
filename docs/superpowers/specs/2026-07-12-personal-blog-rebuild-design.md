# Personal Blog Rebuild — Design Spec

- **Date:** 2026-07-12
- **Status:** Draft for review
- **Owner:** Emrick
- **Scope:** Personal blog only. The owner's separate professional portfolio site is explicitly out of scope.

## Summary

Rebuild the personal blog (formerly `emrick.us`, WordPress, titled "NeVeRtheLeSs") as a static
Astro site using the [astro-tone](https://github.com/hanityx/astro-tone) theme (MIT), hosted on
GitHub Pages. All historical content is migrated from the verified local backup. Future posts are
written as Markdown files and published by git push.

## Background

The original WordPress host (shared hosting at 43.225.44.155, SonderCloud HK) no longer serves the
site; the domain `emrick.us` still resolves but the server returns a bare nginx 404. A complete
backup exists locally and was audited on 2026-07-11:

| Source artifact | Path | Verified contents |
|---|---|---|
| Database dump | `../db/emrickus_wp.sql` (8.4 MB, completed 2026-06-05) | 318 published posts (2005-09-18 → 2023-03-01), 22 private posts, 6 pages, 222 approved comments, 351 media records, 303 revisions, 2 users (Emrick, Fiona) |
| Media files | `../site/wp-content/uploads/` | 1,897 files, 130 MB. All 194 image references found in post bodies resolve. 3 DB media records lack files — verified orphans (attached to nothing). |
| Site files | `../site/` | WordPress core + themes + plugins (needed only as provenance; not migrated) |

(Paths relative to this repo's parent, `…/AI Space/website/`.)

Content language is predominantly Chinese (2005–2018) with long-form English essays (2018–2023).

## Goals

1. Every published post from the backup is readable on the new site with images intact.
2. The owner can publish a new post by adding one Markdown file (directly or via Claude Code).
3. Historical comments are preserved and displayed; new comments are possible via giscus.
4. Zero servers, databases, or renewals required to keep the site alive.
5. Private content never enters the public repo.

## Non-goals

- Rebuilding the owner's separate portfolio site.
- Preserving old emrick.us URLs or redirects (the old site is already offline; the blog moves to a
  new domain).
- Migrating spam comments (1,267), post revisions, Jetpack artifacts, or feedback-form entries.
- Custom visual design in this phase (theme defaults first; restyling happens after the owner
  provides style examples — separate follow-up work).

## Decisions already made (with owner, 2026-07-11)

| Topic | Decision |
|---|---|
| Authoring | Markdown files + git push (no CMS layer) |
| Generator/theme | Astro 6 + astro-tone template (owner's pick) |
| Hosting | GitHub Pages via GitHub Actions; live on `<user>.github.io[/repo]` first |
| Domain | A brand-new domain, purchased by owner later; attaching it is a follow-up DNS task |
| Private posts (22) | Convert to Markdown, store only in local `…/website/private-posts/` — never committed |
| Old comments (222) | Migrate; render read-only under their posts |
| New comments | giscus (GitHub Discussions), supported natively by the theme |

## Architecture

```
…/AI Space/website/
├── db/emrickus_wp.sql          # migration input (stays outside repo)
├── site/wp-content/uploads/    # migration input (stays outside repo)
├── private-posts/              # migration output: 22 private posts (stays outside repo)
└── blog/                       # THIS repo → pushed to GitHub
    ├── docs/superpowers/specs/     # this spec
    ├── scripts/migrate/            # one-time migration scripts (kept for provenance)
    ├── src/content/posts/*.md      # 318 migrated posts + all future posts
    ├── src/data/comments/*.json    # historical comments, keyed by post slug
    ├── src/components/ArchivedComments.astro   # read-only comment renderer (added to theme)
    ├── public/uploads/YYYY/MM/…    # migrated images (only files actually referenced)
    └── .github/workflows/deploy.yml  # build + deploy to GitHub Pages
```

The theme is vendored into this repo from the astro-tone template (standard "use template" flow);
we then apply migration output and the one custom component on top. Theme configuration lives in
`astro-theme-config.ts`.

## Component: migration pipeline (`scripts/migrate/`)

One-time Python scripts, re-runnable and idempotent (output regenerated from scratch each run).
The SQL dump is parsed directly (parser already written and proven during the audit — no MySQL
server needed).

**Per published post (318):**
1. **Frontmatter mapping:** `post_title` → `title` (fallback below), `post_date` → `pubDate`,
   first category → `category`, `description` left empty (theme tolerates it; can be filled later).
   No author field: all published posts are implicitly attributed to the owner (intentional —
   single-owner blog; the second account's writing lives in the private set).
2. **Untitled posts (~80):** `title` = post date as `YYYY-MM-DD` (matches the owner's own 无题
   convention). N same-day untitled posts get `·2` … `·N` suffixes in post-ID order.
3. **Slug:** WordPress `post_name` if it is non-empty ASCII; otherwise `YYYY-MM-DD-p<ID>`.
   Slug collisions resolved by appending `-p<ID>`.
4. **Body:** WordPress HTML → Markdown (html-to-markdown conversion; `<!--more-->` markers
   dropped; embedded HTML that doesn't convert cleanly is left as inline HTML, which Astro
   renders fine).
5. **Images:** every `emrick.us/wp-content/uploads/...` reference rewritten to
   `/uploads/YYYY/MM/<file>`; the referenced file (original, not resized variants where the
   original exists) copied to `public/uploads/`. External-host references (mostly dead smiley
   icons from smzdm.com etc.) are stripped when the URL is a known dead emoticon host, otherwise
   left as-is.
6. **Encoding:** dump is utf8mb4 read as UTF-8 with `errors='replace'`; any post containing a
   replacement character (U+FFFD) is flagged in the migration report for manual review.

**Categories:** extracted from `wp_terms`/`wp_term_taxonomy`/`wp_term_relationships`. The script
emits `scripts/migrate/category-mapping.csv` (old category → new category, one per post using the
post's first category; uncategorized → 随笔). The owner reviews/edits this file once; the script
consumes it on re-run. This is the single deliberate human-review checkpoint in the pipeline.

**Comments (222 approved):** exported to `src/data/comments/<slug>.json` as
`[{author, date, body}]`. **Only comments attached to migrated published posts are exported** —
comments on private posts or pages stay out of the repo (the migration report shows the resulting
count, which may be <222). **Commenter emails and IP addresses are dropped at export** — they
must never appear in the public repo. Spam and unapproved comments are not exported.

**Private posts (22):** same conversion, written to `…/website/private-posts/` (outside the repo).
Belt-and-braces: `.gitignore` also excludes `private-posts/` in case the folder is ever moved in.

**Pages (6):** "About" and "About Me" are merged into the theme's about/home blurb. The other
four (Archive, Leave Comments, 减肥, About the Blog) are superseded by theme features or archived
to `private-posts/` alongside the private content.

**Migration report:** the script prints and saves counts (posts in/out, images copied, comments
exported, flagged posts) to `scripts/migrate/report.txt` for the verification step.

## Component: archived comments display

`ArchivedComments.astro` loads `src/data/comments/<slug>.json` when it exists and renders a
"历史评论 / Archived comments" section under the post body, styled with the theme's existing CSS
tokens (works in dark mode). It renders nothing when no file exists. giscus (new comments) mounts
below it using the theme's built-in option once enabled.

## Deployment

- GitHub Actions workflow using the official `withastro/action` → GitHub Pages.
- `site`/`base` in the Astro config set from the repo name at scaffold time (root if the repo is
  `<user>.github.io`, `/repo-name/` otherwise); revisited once when the custom domain attaches.
- Node 22.12+ pinned in the workflow (theme requirement).

Inputs needed from the owner at scaffold time (not blockers for migration work): GitHub account
/repo name; later, two one-time clicks to enable Discussions + giscus, and the new domain's DNS.

## Site configuration defaults

- Site title: **NeVeRtheLeSs** (carried over; owner may rename with the new domain — one-line
  config change).
- Language: content is mixed; UI chrome stays in the theme's default English, page `lang`
  attribute `zh-CN`. Revisit during the styling phase.
- RSS, sitemap, search: theme defaults (all on).

## Verification / acceptance criteria

1. `src/content/posts/` contains exactly 318 files; migration report counts match the audit.
2. Every image path referenced in migrated Markdown resolves to a file in `public/uploads/`
   (scripted check, zero misses).
3. `npm run check`, `npm run build` pass; Pagefind index builds.
4. Sample render review: ≥10 posts spanning 2005–2023 (weighted toward 2005–2008 where encoding
   risk concentrates) compared side-by-side with the original HTML from the dump.
5. Zero occurrences of commenter emails/IPs or `private-posts` content in the repo
   (scripted grep before first push).
6. Comments render under a post that has them; nothing renders under one that doesn't.
7. Local preview (`npm run preview`) click-through by the owner before the repo is pushed
   public / Pages goes live.

## Risks & mitigations

- **Encoding damage in oldest posts** → U+FFFD flagging + weighted sample review (V4).
- **Category sprawl** (WP categories accumulated over 18 years) → single human-reviewed mapping
  file rather than guessing in code.
- **Theme is young (19 stars)** → acceptable: it's MIT, vendored into our repo (no runtime
  dependency on upstream), and content is portable Markdown if we ever switch themes.
- **Accidental publication of private content** → private output written outside the repo,
  `.gitignore` guard, scripted pre-push grep (V5).
