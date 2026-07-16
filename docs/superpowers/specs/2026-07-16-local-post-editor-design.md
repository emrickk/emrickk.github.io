# Local post editor design

Date: 2026-07-16
Status: Approved by owner (design conversation), pending spec review

## Purpose

A local, browser-based editing page for quick edits during post review. The owner opens a post,
edits the markdown in one pane, and sees the real rendered post in the other. It complements the
preview-first review workflow: line tweaks without opening a code editor.

Explicitly out of scope (YAGNI): creating new posts, frontmatter form UI, image upload,
CodeMirror or any rich editor dependency (possible later upgrade), the notes collection,
bulk metadata editing.

## Constraints

- The site is static and deploys to GitHub Pages from a public repo. Nothing editor-related may
  exist in the production build output (`dist/`) or in any published page.
- Several agent sessions often work in this checkout at once; concurrent file edits are normal
  and must not be silently clobbered.
- No new npm dependencies.
- Repo rules apply: no em-dashes in user-facing copy, explicit-path commits only.

## Architecture

A small Astro integration at `scripts/post-editor/integration.mjs`, registered in
`astro.config.mjs`. It uses only the `astro:server:setup` hook, which fires for `astro dev` and
never during `astro build`, to attach Vite dev-server middleware. Zero build footprint by
construction: no page, endpoint, or asset is added to the site itself.

The middleware serves two things on the running dev server (default `npm run dev` port):

1. `GET /_edit` and its static assets: the editor UI (plain HTML, CSS, and vanilla JS from
   `scripts/post-editor/ui/`, no framework, no build step).
2. A JSON file API under `/_edit/api/` (see below).

Running the editor requires nothing beyond `npm run dev`; open `http://localhost:<port>/_edit`.

## File API

All handlers live in `scripts/post-editor/api.mjs` as plain functions (request in, response out)
so they are unit-testable without a server. The middleware is a thin adapter.

- `GET /_edit/api/posts`
  Returns the post list: for each primary post (`src/content/posts/*.md`, excluding `*.en.md` and
  `*.zh.md` siblings), the repo-relative path, slug, `title`, `titleZh`, `titleEn`, `pubDate`,
  `category`, `lang`, `draft`, and the sibling path when a `<slug>.en.md` or `<slug>.zh.md`
  translation file exists. Frontmatter is read with a minimal YAML-frontmatter parse (string and
  boolean scalar fields only, which is all the schema uses); no new dependency.
  Also returns `changed`: the set of repo-relative paths that differ from `origin/main`, computed
  by importing `computeChangeSet` from `scripts/preview-posts.mjs` (already exported), filtered to
  `src/content/posts/`. Falls back to an empty set if git or `origin/main` is unavailable.

- `GET /_edit/api/file?path=<repo-relative>`
  Returns `{ path, content, hash }` where `hash` is the SHA-256 of the raw file bytes.

- `PUT /_edit/api/file` with JSON body `{ path, content, baseHash }`
  Recomputes the current file hash. If it does not equal `baseHash`, responds `409` with
  `{ error, currentContent, currentHash }` so the UI can offer reload or overwrite (an overwrite
  is a second PUT with the fresh hash). On match, writes the file (UTF-8) and returns the new
  hash. `baseHash: null` is only valid for a file that does not exist yet, which this tool never
  does, so in practice a missing or wrong `baseHash` is always a 409 or 400.

Path validation, applied to every file endpoint: the path must be repo-relative, must resolve
(after normalization, rejecting `..` and absolute paths) inside `src/content/posts/`, and must
end in `.md` or `.mdx`. Anything else is a `400`. The dev server binds to localhost as usual;
this validation is defense in depth, not a security boundary for a hostile network.

Errors (bad JSON, missing file, write failure) return JSON `{ error }` with 400, 404, or 500.

## Editor UI

Single page, three regions:

- **Sidebar (left):** a "Changed" group on top listing posts whose primary or sibling file is in
  the change set (this is what you are reviewing), then "All posts" sorted by `pubDate`
  descending, with a filter box matching slug, `title`, `titleZh`, and `titleEn`.
- **Editor pane:** a monospace `<textarea>` holding the entire raw file, frontmatter included.
  Native undo, wrap on. Above it, tabs: the primary file and, when present, the sibling
  translation. Switching tabs with unsaved changes prompts before discarding. A dirty marker
  shows on the tab and the Save button. Cmd+S (and Ctrl+S) saves; `beforeunload` guards unsaved
  changes.
- **Preview pane:** an iframe of the real post page, `/posts/<slug>/`, served by the same dev
  server. On tab switch the editor sets the post language directly on the same-origin iframe
  document (`data-lang` on `<html>`, plus `localStorage['lang']` so it survives reloads),
  matching the file being edited. After a successful save, Astro HMR reloads the page content;
  as a fallback the editor also reloads the iframe once the PUT succeeds, so the preview never
  goes stale. Frontmatter or schema mistakes surface as Astro's own dev error overlay inside the
  iframe, which is accurate feedback.

Conflict handling in the UI: a 409 response shows a banner naming the file, with two actions,
"Reload from disk" (replaces editor content, keeps a copy of your text on the clipboard is NOT
promised; it simply warns first) and "Overwrite" (re-sends with the fresh hash). No merge UI.

Styling is self-contained in the editor page and does not import site CSS.

## Interaction with existing safety tooling

- Saving a post changes its content hash, which invalidates any preview-posts approval for that
  file. That is the existing, intended gate behavior; no changes to preview-posts or
  release-check are needed.
- The editor writes only inside `src/content/posts/`; hero images, theme code, and config are
  out of reach.

## Testing

`scripts/post-editor/api.test.mjs` (plus helpers as needed) using `node:test`, wired as
`npm run test:editor`, covering:

- Path validation: accepts posts paths, rejects traversal, absolute paths, non-post paths,
  non-markdown extensions.
- Conflict detection: PUT with stale `baseHash` returns 409 and does not write; matching hash
  writes and returns the new hash.
- Post listing: frontmatter fields extracted, siblings paired with primaries, `*.en.md` and
  `*.zh.md` never listed as primaries, changed set filtered to posts.

The UI is exercised manually (it targets exactly one user on localhost); no browser test harness.

## Documentation

- `docs/post-editor.md`: one-page runbook (what it is, how to open it, conflict behavior,
  the preview-approval note).
- CLAUDE.md commands table: one row for `/_edit` under `npm run dev`, and one for
  `npm run test:editor`.
