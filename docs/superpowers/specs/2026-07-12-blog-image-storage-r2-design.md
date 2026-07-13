# Blog Image Storage — Cloudflare R2 CDN + NAS Archive

**Date:** 2026-07-12
**Status:** Design — awaiting user review
**Repo:** `emrickk/emrickk.github.io` (Astro 6, GitHub Pages, domain `anping.us`)

## Problem

The blog commits images directly into the git repo (`public/uploads/YYYY/MM/`) and
serves them raw from GitHub Pages. Today that is 186 files / ~23 MB — fine. But the
author expects to add many photos at ~10 MB each, eventually **5–10 GB of originals**.
That approach cannot scale:

- **GitHub Pages caps a published site at 1 GB** and soft-limits bandwidth at ~100 GB/mo.
- **Git stores every version of every file forever**, so gigabytes of images (and their
  re-edits) permanently bloat `.git` and slow every clone and CI build.
- Files in `public/uploads` are served **unoptimized** — a 10 MB upload ships to readers
  as 10 MB.

## Goals

1. **Preserve full-resolution originals** durably (an archive, not just what's on the blog).
2. **Serve small, optimized derivatives** to readers (fast pages, low bandwidth).
3. **Keep the git repo lean** — media lives outside it.
4. **Simple day-to-day authoring**: drop files in a folder, run one command, paste a snippet.
5. **~$0 cost** at personal-blog scale.

## Non-goals (YAGNI)

- On-the-fly / on-demand image resizing (Cloudflare Images). Pre-generating with `sharp`
  is simpler and free.
- A fully automated file-watcher. Explicit `npm run images` was chosen.
- Astro remote-image processing (`image.remotePatterns`). Posts reference pre-optimized
  external URLs via plain markdown `![](…)`; Astro does not need to touch them.
- Automated NAS archiving over SSH. The NAS's interactive SSH is currently broken;
  archiving uses an SMB mount (which works) or a local fallback, decoupled from serving.

## Architecture

Two independent layers:

```
Author drops a 10 MB photo
        │
        ├─► ARCHIVE:  full-res original ─► NAS (SMB mount)         [durable, cold]
        │                                   └─ off-site backup (future)
        │
        └─► SERVE:    sharp → resize ≤2000px, WebP q80 ─► Cloudflare R2 bucket
                                                            served via cdn.anping.us
                                                            (zero egress, free ≤10 GB)
                                                                   │
                                          post references https://cdn.anping.us/…  ─► reader
```

- **Archive layer** — originals on the NAS (hardware already owned, $0). A single copy is
  not a backup; an off-site copy (e.g. NAS→Backblaze B2 sync) is a follow-up, out of scope
  for this spec but noted.
- **Serving layer** — optimized WebP derivatives in **Cloudflare R2**, a bucket served at
  `cdn.anping.us`. R2's free tier (10 GB storage, **zero egress fees**) covers this
  indefinitely; because derivatives are optimized (~200–500 KB), even thousands of images
  stay well under 10 GB.

The big, growing number (originals) lives on owned hardware for free; the only thing a
cloud provider ever bills for (served derivatives) stays small by construction.

## Components

### 1. DNS migration to Cloudflare (one-time, user-performed)

`anping.us` moves from GoDaddy DNS to **Cloudflare DNS** (registration stays at GoDaddy).
This is required for an R2 custom domain and is a free upgrade. Records to recreate in
Cloudflare, all **DNS-only (grey cloud)** so GitHub Pages can serve its own TLS cert:

| Type  | Name        | Value                                             |
|-------|-------------|---------------------------------------------------|
| A     | `anping.us` | `185.199.108.153`                                 |
| A     | `anping.us` | `185.199.109.153`                                 |
| A     | `anping.us` | `185.199.110.153`                                 |
| A     | `anping.us` | `185.199.111.153`                                 |
| CNAME | `www`       | `emrickk.github.io`                               |
| CNAME | `cdn`       | *auto-created by R2 "Connect Domain"*             |

(Optional AAAA records: `2606:50c0:8000::153` … `8003::153`.) Verified working before the
GoDaddy nameserver switch is finalized, so the live site never blips.

### 2. R2 bucket + credentials (one-time, user-performed)

- Enable R2 (requires a payment card on file; free tier is genuinely $0).
- Create bucket `anping-blog-images`.
- Connect custom domain `cdn.anping.us` (auto-creates the `cdn` DNS record since the zone
  is on Cloudflare).
- Create a **scoped API token** (Object Read & Write, this bucket only). Copy account ID,
  access key, secret into `.env.local`.

### 3. Image pipeline — `scripts/images/process.mjs` (built here)

Node ESM script, invoked via `npm run images`. **Purpose:** turn staged originals into
archived + served + reference-ready images.

- **Input:** files dropped in `image-staging/` (git-ignored).
- **Per file:**
  1. **Archive** the original: copy to `NAS_ARCHIVE_PATH` (an SMB mount). If unset or
     unreachable, fall back to local `originals/` (git-ignored) and warn — never block.
  2. **Optimize** with `sharp`: resize to max width **2000px** (`withoutEnlargement`),
     encode **WebP quality 80**, strip EXIF. Yields ~200–500 KB.
  3. **Upload** to R2 under key `YYYY/MM/<basename>.webp` with
     `Cache-Control: public, max-age=31536000, immutable`.
  4. **Print** the paste-ready snippet: `![](https://cdn.anping.us/2026/07/name.webp)`.
- **Idempotent:** a git-ignored `scripts/images/.manifest.json` maps content-hash → key;
  already-uploaded files are skipped, and hash collisions on a different name are flagged.
- **Config:** read from `.env.local` (below). Missing required vars → clear error, abort.
- **Dependencies:** `sharp` (present) + an S3 client for R2 (`@aws-sdk/client-s3`, or the
  lighter `aws4fetch`). Uses Node built-ins otherwise.

### 4. Backfill / migration — `scripts/images/migrate.mjs` (built here, one-time)

Moves the existing 186 images out of the repo.

- **Dry-run first** (default): print every planned upload and every markdown edit; change
  nothing.
- **Apply:** for each file in `public/uploads/**`, optimize→WebP→upload to R2 under the
  **same path** (`2020/02/foo.jpg` → key `2020/02/foo.webp`). Then rewrite references in
  `src/content/**`: `/uploads/<path>.<ext>` → `https://cdn.anping.us/<path>.webp`.
- **Verify:** confirm a sample of migrated URLs return 200 from `cdn.anping.us`.
- **Only after success**, `git rm -r public/uploads` + commit. Repo working tree shrinks.
- Purging old image blobs from git *history* (`git filter-repo`) is an **optional**,
  clearly-flagged separate step (it rewrites history) — not run automatically.

### 5. Config, secrets, and wiring (built here)

- `.env.example` gains: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
  `R2_BUCKET=anping-blog-images`, `R2_PUBLIC_BASE=https://cdn.anping.us`,
  `NAS_ARCHIVE_PATH=` (optional).
- Real secrets go in `.env.local`, already covered by the existing `.env.*` git-ignore.
- `package.json` scripts: `"images": "node scripts/images/process.mjs"`,
  `"images:migrate": "node scripts/images/migrate.mjs"`.
- Add `image-staging/`, `originals/`, `scripts/images/.manifest.json` to `.gitignore`.
- A short runbook at `docs/images.md`: setup, daily use, troubleshooting.

## Data flow

**Daily authoring:** drop photos → `npm run images` → originals archived to NAS,
derivatives on R2 → paste printed `![](https://cdn.anping.us/…)` snippets into the post →
`git commit` (post text only; no image bytes) → deploy.

**Migration (one-time):** `npm run images:migrate` (dry-run) → review → apply → verify
sample → remove `public/uploads` → commit → deploy.

## Error handling & idempotency

- Missing/invalid R2 env vars → abort with an actionable message.
- NAS path unreachable → warn, use local `originals/` fallback, continue serving pipeline.
- Upload failure → retry (2×); report failed files; do **not** emit/rewrite references for them.
- Re-runs are safe: manifest skips already-uploaded content; migration is dry-run-by-default
  and never deletes `public/uploads` until uploads are verified.

## Testing

- **Unit (pure functions, `node:test`):** the reference-rewrite function
  (`/uploads/x.jpg` → `https://cdn.anping.us/x.webp`) across markdown edge cases; the key
  derivation (`path`,`date` → `YYYY/MM/name.webp`).
- **Integration:** run `process.mjs` on one fixture image → assert output is WebP, ≤ target
  size, ≤ 2000px wide, and a HEAD to the resulting URL returns 200.
- **Migration:** dry-run against a copy of `public/uploads`, assert planned edits match a
  golden sample before any live apply.

## Rollout sequence

**User (I provide exact steps + values):**
1. Create/sign into Cloudflare; enable R2 (add card).
2. Create bucket `anping-blog-images`; create scoped API token.
3. Add `anping.us` to Cloudflare, recreate the records in §1, switch nameservers at GoDaddy.
4. Connect custom domain `cdn.anping.us` to the bucket.
5. Paste credentials into `.env.local`.

**Me (code — can be built in parallel with the above; uploads work via API before the
custom domain is live):**
6. Build `process.mjs`, `migrate.mjs`, config, scripts, tests, runbook.
7. Run migration (dry-run → apply) once credentials + domain are live.
8. Verify sample loads via `cdn.anping.us`; remove `public/uploads`; commit; deploy.

## Future roadmap (beyond this spec)

- **Off-site backup** of NAS originals (3-2-1) — e.g. scheduled NAS→Backblaze B2 sync.
- **>10 GB of derivatives** (unlikely): R2 paid is $0.015/GB-mo, still zero egress (~$1.50/mo
  for 100 GB). Originals never touch R2, so this stays small.
- **On-demand responsive sizes** via Cloudflare Image Resizing, only if pre-generating ever
  becomes a chore.

## Resolved decisions

| Decision | Choice |
|---|---|
| Serving | Cloudflare R2 + `cdn.anping.us` (zero egress, free ≤10 GB) |
| Archive | NAS via SMB; local fallback; off-site backup later |
| Optimization | `sharp` → ≤2000px, WebP q80, strip EXIF |
| Custom domain | Move `anping.us` DNS to Cloudflare (registrar stays GoDaddy) |
| Authoring | `image-staging/` folder + `npm run images` |
| Language | Node (reuses `sharp`, ties into npm) — existing Python `scripts/migrate` is unrelated finished tooling |
