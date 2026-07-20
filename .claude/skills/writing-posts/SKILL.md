---
name: writing-posts
description: How post prose gets written, edited, and checked on this blog. Use when writing, rewriting, or translating a post, applying the owner's dictated or pasted edits, or checking a draft for AI tells.
---

# Writing posts

One skill for the whole loop: writing, the owner's edits, and the checks before handoff. Its instructions are mode-specific. Do not blend permissions from one mode into another.

**The owner outranks this file.** His lexicon (矫情, 意林, 爹味儿, 看图说话, 鹦鹉学舌, 四不像, imagination) catches sensibility-level failures no checklist can see, and his final prose overrides every rule here: when he writes warm, follow him. When rules conflict with his rules or his prose, his side wins.

## Choose the mode first

| Request | Mode | Default action |
| --- | --- | --- |
| Apply pasted or dictated edits | Faithful application | Pasted wording is applied verbatim; dictated wording is composed into clean prose at the post's register, keeping his load-bearing words. Plus required sibling/frontmatter sync and unambiguous mechanics. |
| Draft, rewrite, restructure, or translate | Composition | Follow the Composing sequence within the requested scope. |
| Check for AI tells | Lint review | Report findings only: quoted phrase plus a one-line reason, borderline ones marked "your call". Change no prose unless the owner then asks. |

A review request is not permission to edit. An edit request is not permission to polish nearby prose. If a request could fit more than one mode, state the interpretation and take the less mutating one.

## Writing

### 1. Every article has a topic

An article is built around a topic, never assembled by reading the photos one by one and stitching their descriptions together; the photos serve the topic, not the other way around. If you do not know what the topic should be, ask the owner: do not invent one silently, and do not start writing without one.

### 2. The topic is usually implicit

A topic does not need to be stated outright in the text. It is reflected by the things the article talks about: what it chooses to mention, dwell on, and leave out. Do not announce the theme; let the selection of material carry it.

### 3. A topic is often a thread, or two

The owner tends to design a post as one or more threads (主线) running through the piece, sometimes braided against each other, with the ending as the place where they touch. (Example: florence runs a Medici thread against an ordinary-people thread; the last line is the only spot the two meet.)

### Voice

Concrete material carries the feeling. Facts, objects, physical experience, and dry turns do the work. Interpretation is allowed when the surrounding material earns it. The prose should feel natural rather than polished into symmetry.

The current post and his published posts in `src/content/posts/` are the primary references for how he writes, but published posts are evidence of range, not templates: match the current post's register before importing habits from another post. Take style feedback live in the session; fold durable lessons into this file in the open, through his review, never into private memory.

## Composing

The sequence for any authorized draft, rewrite, or translation:

1. Read the whole post and all the source material (his dictation, the photos, the existing draft).
2. State the topic in one sentence. If none can be written, stop and ask. If the topic was inferred rather than given, disclose the sentence at handoff so he can veto it before reading the draft.
3. Map the scenes to one or two threads.
4. Identify the real gaps without inventing material; when he hands a design to an existing post, usually most of the material already carries it.
5. Write the authorized passage or post fresh, as one continuous hand; patched hybrids accrete into 四不像. His scenes and dictated lines are material to compose from, not sentences to transplant. Save a labeled checkpoint before overwriting a full post.
6. Compare the draft with the post's strongest passages for temperature and rhythm.
7. Only now check the draft for AI tells. Write from the topic, the material, and the voice; the tells check is a final diagnostic pass, never a sentence-generation recipe.

At handoff: the preview link (see preview-posts), the structural choices he may want to reverse, and content-bearing additions or interpretive choices disclosed (not routine mechanics). Prose that is genuinely yours, an English sync of his zh rewrite for example, is declared as yours; he sees it before it ships.

## Hard invariants

These hold for every post, every genre:

- Never invent facts, scenes, sensations, or people the owner did not supply. Missing material is a gap to report, not a space to fill.
- A rewrite changes the frame, not the material: his scenes, jokes, facts, and photos in their existing order all stay unless he explicitly changes them.

## Defaults

Owner-verdict-backed (blind tests plus his own rewrites, 2026-07-16/17), but learned on travel essays; the current post's own register outranks any of them:

- A declarative or quotable line stays when the adjacent concrete material pays for it; cut it only when it floats. Default to keeping, and never give it its own standalone paragraph; fold it into the scene it belongs to.
- When a change of place or time would feel unmoored, give it a physical transition, in the simplest phrasing (从穹顶下来，走到老宫).
- Fix a repetition or a rotating label only when the replacement is at least as vivid; natural repetition stays.
- Do not narrate the photography itself; photos punctuate the post, the post does not discuss its photos as photos.
- Concision cuts frames and summaries, never flavor words: 难得, 终于, 高处的 and their kin carry the feeling inside factual sentences and stay.
- Three-item lists only when the three items are literally true and each earns its place; two usually beat three.
- Vary how paragraphs end; break a run of same-shape sentences. Short fragments are his style, not a defect.

## Proofread before every handoff

Before handing over a preview link, proofread every changed sibling in full, not just the lines touched: zh punctuation, CJK-Latin spacing, casing, duplicated words, photo alt text made stale or wrong by the edit, and frontmatter sync. Mechanics only. Pre-existing empty or thin alt text the edit did not touch is not mechanics: flag it once, and author new alt text (descriptive, in the file's language) only when he asks or when composing a post.

Report in two buckets and keep them separate:

- **Fixed (mechanics only)**: what was corrected, with before/after for wording-sensitive cases; repeated typographic fixes summarized once.
- **Flagged, your call**: anything that might be deliberate (a repetition, a name, a fact). Do not touch these.

## Shipping

Nothing reaches `main`, and so the live site, without the preview gate and the owner's approval (see preview-posts, ship-posts, release-check); working commits on a gate branch in its own worktree are fine. An initial request to publish is not approval: the signal is an explicit "approved", "push", "ship it", or "go" after he has reviewed the preview.

This file is co-edited with the owner; changes to it go through his review.
