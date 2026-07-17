# Local post editor

A dev-only editing page for quick post edits during review. It exists only
while the dev server runs; production builds contain nothing from it.

## Using it

1. `npm run dev` (pick your own free port when sessions share this checkout:
   `npm run dev -- --port 4567`)
2. Open `http://localhost:<port>/_edit`

The sidebar lists changed posts first (relative to origin/main, same
detection as the preview gate, so drafts never appear there), then all posts
newest first with a filter box. Opening a post loads the raw file,
frontmatter included, with a tab for the sibling translation when one
exists. The right pane is the real rendered post from the same dev server;
it follows the language of the file you are editing.

Save with the button or Cmd+S. The preview reloads on save. Frontmatter
mistakes show up as Astro's own error overlay in the preview, which is the
same error the build would give.

## Conflicts

Saves are hash-guarded. If another session changed the file after you loaded
it, the save returns a conflict banner instead of overwriting: "Reload from
disk" replaces your editor text with the file on disk (it warns first; your
text is not kept anywhere), "Overwrite" saves your text over the newer file.

## Shipping your edits

Two ways, one pipeline:

- **Terminal**: `npm run ship`. It verifies only post files changed, builds the
  production site and opens the review page, asks one `approve these N file(s)
  and ship? [y/N]`,
  then runs the release checklist, commits your post files, pushes, and watches
  the deploy until your posts are live.
- **Conversation**: open any Claude Code session and say "push my edits". The
  ship-posts skill walks the same gates: you get the production review link,
  you say "approved" (or "push"), and it ships.

Either way the approval is bound to exactly the content you reviewed: if
anything changes in between (say another session edits a post), ship aborts
instead of publishing something unseen. Manual fallback, should you ever need
it: `npm run preview-posts`, then `npm run preview-posts -- --approve`, then
`npm run release-check`, then commit the post files and push.

## Interaction with the preview gate

Saving a post changes its content hash, which invalidates any preview-posts
approval covering that file. That is the intended gate behavior: edited
posts need a fresh review before release-check goes GO.

## Where things live

- `scripts/post-editor/integration.mjs`: dev-server middleware (the only
  Astro hook used is astro:server:setup, which never fires in builds)
- `scripts/post-editor/api.mjs`: file API, unit-tested by
  `npm run test:editor`
- `scripts/post-editor/ui/`: the page itself (plain HTML, CSS, JS)
