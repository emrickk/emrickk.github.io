# NeVeRtheLeSs

2005 年至今的个人博客 · personal blog since 2005.

Built with [Astro](https://astro.build) and the [astro-tone](https://github.com/hanityx/astro-tone) theme, migrated from an 18-year WordPress archive (318 posts, 183 archived comments). Migration tooling lives in `scripts/migrate/`; design docs in `docs/`.

## Commands

| Command | Action |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Local dev server |
| `npm run build` | Build the site + Pagefind search index |
| `npm run preview` | Preview the production build |

Deploys to GitHub Pages via `.github/workflows/deploy.yml` on push to `main`.

## Writing a new post

Add a Markdown file to `src/content/posts/`:

```markdown
---
title: 'Post title'
description: ''
pubDate: '2026-07-12'
category: 'Journal'
---

Body in Markdown. Images go in `public/uploads/` and are referenced as `/uploads/...`.
```

## License

Theme source code: MIT (see `LICENSE`, © Tone contributors).
**All blog content — posts under `src/content/posts/`, archived comments under `src/data/comments/`, and media under `public/uploads/` — is © the blog owner, all rights reserved.** The MIT license does not apply to the content.
