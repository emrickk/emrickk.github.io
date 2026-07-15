# Blog images: setup & daily use

## One-time setup (Cloudflare + DNS)

1. **Cloudflare account**: create/sign in at dash.cloudflare.com.
2. **Enable R2** (R2 -> Overview -> add a payment card; the free tier is $0: 10 GB, zero egress).
3. **Create bucket** named `anping-blog-images`.
4. **Move anping.us DNS to Cloudflare:** add the site in Cloudflare, then recreate these records, all **DNS only (grey cloud)**:

   | Type  | Name        | Value               |
   |-------|-------------|---------------------|
   | A     | `anping.us` | `185.199.108.153`   |
   | A     | `anping.us` | `185.199.109.153`   |
   | A     | `anping.us` | `185.199.110.153`   |
   | A     | `anping.us` | `185.199.111.153`   |
   | CNAME | `www`       | `emrickk.github.io` |

   Then at GoDaddy, change the nameservers to the two Cloudflare nameservers shown in the dashboard. Wait for "Active", confirm https://anping.us still loads.
5. **Connect the custom domain** to the bucket: R2 -> `anping-blog-images` -> Settings -> Custom Domains -> add `cdn.anping.us` (Cloudflare auto-creates the DNS record).
6. **Create an API token:** R2 -> Manage API Tokens -> Object Read & Write, scoped to `anping-blog-images`. Copy the Account ID, Access Key ID, Secret.
7. **Local creds:** `cp .env.example .env.local` and fill `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. Optionally set `NAS_ARCHIVE_PATH` to your mounted SMB share (e.g. `/Volumes/photo/blog-originals`).
8. **Smoke test:** `npm run test:images`. The R2 live test should now run (not skip).

## Daily use

1. Drop full-size photos into `image-staging/`.
2. `npm run images`: archives originals to the NAS, uploads optimized WebP to R2, prints markdown snippets.
3. Paste the snippets into your post, delete the staged files, commit the post.

### Photo galleries

A markdown list where every item is a bare image renders as a 2-column
gallery with lightbox navigation (2+ images). Legacy runs of 3+ bare
image paragraphs are auto-converted at build time. To keep images
full-width instead, add any text to a list item or between paragraphs.
Linked images never become gallery tiles. Detection lives in
`scripts/rehype/image-gallery.mjs`. For a deliberate side-by-side
pair inside prose (charts, before/after), the manual
`<div class="img-grid">` wrapper is still the right tool: it keeps
original aspect ratios and collapses to one column on phones, while
galleries crop to 16:9 and stay two-up everywhere.

## One-time migration of existing images

1. `npm run images:migrate` (dry-run): review the planned uploads/edits.
2. `npm run images:migrate -- --apply`: uploads all `public/uploads` images and rewrites references.
3. Spot-check: open a migrated post locally (`npm run dev`) and confirm images load from `cdn.anping.us`.
4. Remove the now-unused files: `git rm -r public/uploads && git commit -m "chore(images): serve uploads from R2"`.
5. (Optional) purge old image blobs from git history with `git filter-repo`: a separate, deliberate step.

## Troubleshooting

- **Images 404 on cdn.anping.us:** custom domain not connected, or DNS not yet "Active".
- **`Missing required env vars`:** `.env.local` absent or incomplete.
- **Originals landing in `originals/` instead of the NAS:** `NAS_ARCHIVE_PATH` unset or the SMB share isn't mounted.

Note: Astro caches rendered markdown in `node_modules/.astro` and `.astro`.
Edits to `scripts/rehype/image-gallery.mjs` do NOT invalidate that cache,
so after changing the plugin, delete both cache folders before trusting
`npm run build` output (verified 2026-07-14: a stale cache shipped builds
without a plugin change that the dev server was already showing).
