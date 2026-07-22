---
name: writing-posts
description: How post prose gets written, edited, and checked on this blog. Use whenever writing, drafting, rewriting, or translating a post, applying the owner's dictated or pasted edits, syncing a sibling translation, reviewing any draft headed for the site, or when the owner asks what you think of a post.
---

# Writing posts

One skill for the whole loop: writing, the owner's edits, and the AI-tell check. Its instructions are mode-specific. Do not blend permissions from one mode into another.

**The owner outranks this file.** His lexicon (矫情, 意林, 爹味儿, 看图说话, 鹦鹉学舌, imagination) catches sensibility-level failures no checklist can see, and his final prose overrides every rule here: when he writes warm, follow him. When rules conflict with his rules or his prose, his side wins.

## Choose the mode first

| Request | Mode | Default action |
| --- | --- | --- |
| "What do you think?" or critique | Reader reaction | Respond with an honest read. Change no files. |
| Apply pasted or dictated edits | Faithful application | Pasted wording is applied verbatim; dictated wording is composed per Applying dictated edits. Plus required sibling/frontmatter sync and unambiguous mechanics. |
| Draft, rewrite, restructure, or translate | Composition | Write within the requested scope, following the post's topic, material, and register. |
| Check for AI tells | Lint review | Report findings only. Change no prose unless the owner then asks. |

A review request is not permission to edit. An edit request is not permission to polish nearby prose. If a request could fit more than one mode, state the interpretation and take the less mutating one.

## Writing

### 1. Every article has a topic

An article is built around a topic. It is never assembled by reading the photos one by one and stitching their descriptions together; the photos serve the topic, not the other way around.

If you do not know what the topic should be, ask the owner. Do not invent one silently, and do not start writing without one.

### 2. The topic is usually implicit

When the owner gives a topic, it does not need to be stated outright in the text. The topic is reflected by the things the article talks about: what it chooses to mention, dwell on, and leave out. Do not announce the theme; let the selection of material carry it.

### 3. A topic is often a thread, or two

The owner tends to design a post as one or more threads (主线) running through the piece, sometimes braided against each other, with the ending as the place where they touch. (Example: florence runs a Medici thread against an ordinary-people thread; the last line is the only spot the two meet.)

When he describes a design out loud, map it against the existing draft before writing anything: usually most of the material already carries it. Say which scenes serve which thread, and point at the real gaps instead of proposing a rewrite.

### 4. A rewrite changes the frame, not the material

When the owner asks for a ground-up rewrite, the topic and structure are what change. His scenes, jokes, facts, and photos in their existing order all stay unless he explicitly changes the material. Save a labeled checkpoint before overwriting a full post. After writing, run the production preview, hand him its link, and name the structural choices he may want to reverse.

### 5. Build from his words

When he dictates a thesis or a line and asks you to write it in, compose from his spoken words wherever possible: his vocabulary and the shape of his jokes are the material, not a script to transplant verbatim (mechanics in Applying dictated edits). Disclose content-bearing additions and interpretive choices, not routine punctuation or other mechanics. Prose that is genuinely yours (for example, an English sync of his zh rewrite) is declared as yours, and he looks at it before it ships.

### 6. Treat language siblings as one post, not as literal copies

- Preserve the same facts, scenes, jokes, image order, and overall temperature, but let each language be idiomatic.
- When an edit changes meaning, reflect that change in the sibling. A language-specific wording or mechanics fix does not require an artificial matching edit.
- Keep the primary file's `title`, `titleZh`, `titleEn`, `description`, `descriptionZh`, and `descriptionEn` aligned with the two bodies. Keep the sibling file's `title` aligned with its language title. The site renders shared metadata from the primary file.
- If a proper name, fact, or ambiguous phrase cannot be translated confidently from the post or a checkable source, flag it instead of filling from memory.

### Voice

The rules below never substitute for reading him: the current post and his published posts in `src/content/posts/` are the primary references for how he writes. Take style feedback live in the session; fold durable lessons into this file in the open, through his review, never into private memory.

## The owner's edits

In faithful-application mode, the owner's prose is his. The work around it is accurate placement, mechanical accuracy, required sibling sync, and honest flagging. Never reword what he wrote or polish surrounding prose unless he asks.

### Applying dictated edits

His edits usually arrive as voice dictation: mixed zh/en, sometimes garbled, sometimes with several takes of the same sentence.

- Reconstruct repeated takes into one sentence instead of applying both. When one take clearly replaces another, the later take wins; when that is unclear, flag it.
- Dictation is raw material, not finished prose (owner, 2026-07-18: verbatim transcription reads as 鹦鹉学舌). Speech carries spoken fillers (看起来就和……一样), doubled starts (two 大家 in one breath), and calques of his own English (会是我最后的选择 from "it will be my last choice"); these are natural in talk and dead on the page. Compose each dictated idea into a sentence at the post's register, keeping his load-bearing words and the shape of his jokes.
- Present every composed line as a pair, 原话 → 成句, for him to strike or keep before it ships. Where the transcription forced a guess, list the guess the same way.
- Only what he wrote is verbatim: typed or pasted sentences, and prose already standing in the post, remain under never-reword.
- Sync meaning and metadata across language siblings according to Writing rule 6.

### Proofread before every handoff

Before handing over a preview link, proofread every changed sibling in full, not just the lines touched: zh punctuation, CJK-Latin spacing, casing, duplicated words, photo alt text (stale after the edit, or empty; every photo gets descriptive alt text in the file's language), and frontmatter sync. Mechanics only.

Report in two buckets and keep them separate:

- **Fixed (mechanics only)**: what was corrected, with before/after for wording-sensitive cases. Summarize repeated typographic fixes once. Wording stays untouched.
- **Flagged, your call**: anything that might be deliberate (a repetition, a name, a fact). Do not touch these.

### When he asks what you think

"What do you think about the X post" asks for a reader's reaction, not an edit pass. Give the honest read: what works and why, quibbles as observations with reasoning, mechanical findings last. Change nothing until he asks.

## Drafting rules (owner-verdict-backed: blind tests plus his own rewrites, 2026-07-16/17)

When writing or rewriting post prose, not just reviewing it:

- Judge the whole piece before any line. Identify the post's register from its own strongest passages and keep every paragraph at that temperature; a locally rule-correct edit that makes one paragraph drier or warmer than its neighbors is worse than the keep. Concision AND consistency, never concision alone (owner, 2026-07-16).
- A declarative or quotable line stays when the adjacent concrete material pays for it; cut it only when it floats. Default to keeping. Never give a quotable line its own standalone paragraph; fold it into the scene it belongs to.
- When a change of place or time would otherwise feel unmoored, give it a physical transition, and use the simplest phrasing (从穹顶下来，走到老宫).
- First person only when it lands in an object or a dry turn (倒是脚，第二天明显比第一天酸). Never add reaction shots, asides, or self-commentary; such insertions went 0 for 6 in blind tests. Micro-touches are the ceiling: an 😂 on an existing joke, a precision fix like 一位妈妈.
- Fix a repetition or a rotating label only when the replacement is at least as vivid as the original; natural repetition stays.
- Never narrate the photography itself (which frames survived, what the camera was really after); photos punctuate the post, the post does not discuss its photos as photos.
- Never add a silence beat (谁都不说话, 谁也不说话); it stages atmosphere instead of rendering it, and both instances were cut on sight in the 2026-07-16 Florence rewrite.
- Concision means cutting frames and summaries, never shaving flavor words: 难得, 终于, 高处的 and their kin carry the feeling inside factual sentences and stay.
- The restraint rules kill fake warmth, not warmth. Second person and even personification are in-voice when they render felt physical experience (先从脚下的石头里感觉到凉意); deadpan self-aware winks are in-voice (（这挨着吗？）); earnest meta frames are not (这个故事里诚实的部分是). Never edit a piece colder than its own temperature.
- Endings never summarize or moralize. Stopping is always safe; a soft landing is allowed only on a concrete personal wry beat (反正我在舒服的家里等着), never on a thesis.
- Three-item lists only when the three items are literally true and each earns its place; two usually beat three.
- Vary how paragraphs end; break a run of same-shape sentences.

### First-draft tells (owner-quoted critique, 2026-07-16)

Three signals regenerate in every first draft no matter how much prior feedback exists; they are sanded off per piece, not learned away. Strip-check any drafted prose against them before it goes to the owner:

- **Lesson-shaped endings**: the moral extracted and clicked shut (这大概就是佛罗伦萨教人的事……). His 爹味儿 label; the endings rule above applies.
- **Repeated cinematic metaphors**: 像-simile pileups, the same move used twice (a view framed as an artwork, twice in one post), casting lines (那天的日落，是配角). The owner's 矫情 test names the smell: any line that sounds like it wants to be quoted is suspect. Keep it only when the concrete material pays for it, as the quotable-line rule above requires.
- **Perfectly balanced sentences**: manicured tricolons, balanced-paradox epigrams ("Absurd, and completely coherent"), escalating negations landing on a fragment ("no dove, no gilded clouds, not even glass. Just the sun."). Lumpy beats shapely.

## AI-tell review mode

Use these patterns in two distinct ways:

- **Composition self-check:** before handing over prose you authored, strip the first-draft tells from your own new language while preserving the owner's material and register.
- **Lint-review mode:** when reviewing existing prose, detection only. Report findings as quoted phrase + pattern name + one-line reason. Never bulk-rewrite; edits go through the owner's normal review loop.

The phrases below are candidate triggers, not banned words. A match is a finding only when it performs the listed pattern in context.

### Chinese patterns

| Pattern | Watch for |
| --- | --- |
| 夸大意义 | 标志着, 见证了, 是……的证明/体现, 关键时刻, 深深植根于, 不可磨灭的印记 |
| AI 词汇 | 此外, 值得注意的是, 至关重要, 深入探讨, 赋能, 打造, 格局, 交织, 织锦, 充满活力, 彰显 |
| 系动词回避 | 作为/充当/拥有/设有 where 是/有 is truer |
| 否定式排比 | 不仅……更是……, 这不仅仅是……而是…… |
| 三段式 | Three parallel items where two or four are truer (海浪、礁石和雾号声交织在一起) |
| 肤浅分析尾巴 | Sentence tails that fake depth: 展现了……, 彰显了……, 折射出……, 象征着……, 营造出……的氛围 |
| 宣传语言 | 令人叹为观止, 鬼斧神工, 丰富的（比喻）, 迷人的, 坐落于, 必游之地 |
| 模糊归因 | 专家认为, 有人指出, 行业报告显示, with no checkable source |
| 同义词循环 | Rotating labels for one referent (主人公/主要角色/中心人物); flag only mechanical rotation, a label that adds information stays |
| 虚假范围 | 从X到Y where X and Y sit on no real scale |
| 填充短语 | 在这个时间点, 为了实现这一目标, 值得一提的是, 具有……的能力 |
| 空泛积极结尾 | 未来可期, 收获了成长, 继续追求, 见证更多的美好 |
| 格式痕迹 | Bold inline-header bullets (**X：** …), decorative emoji on headings/lists, em-dashes (already banned by repo rule 2) |

### English patterns (translations)

| Pattern | Watch for |
| --- | --- |
| Inflated significance | stands as a testament, marks a pivotal moment, underscores, rich tapestry, ever-evolving landscape |
| AI vocabulary | moreover, furthermore, delve, seamless, robust, vibrant, crucial, foster, showcase |
| Negative parallelism | not just X, but Y; it isn't about X, it's about Y |
| Rule of three | forced triads of adjectives or clauses |
| Vague attribution | experts say, observers note, industry reports show, with no checkable source |
| -ing analysis tails | trailing participles that fake depth: …, highlighting…, …, reflecting…, …, ensuring… |
| Generic endings | The future looks bright, an unforgettable experience, In conclusion |

### Do NOT flag

- 😂 and wry domestic humor: explicitly welcome in this blog.
- Short fragments and punchy sentences: concision is his style, not a tell.
- Curly or CJK quotes (「」 ""): correct Chinese typography, not a tell.
- Three-item lists that are literally true (a real shopping list). Flag the mechanism only when it fakes rhythm or depth.
- Repetition the owner wrote deliberately.

When a lint-review finding is borderline, report it marked "borderline, your call" instead of silently fixing or silently passing it.

### Output format

In lint-review mode, give numbered findings in text order, each: quoted phrase, pattern name, one-line reason. End with any plausible candidates you deliberately passed, not an exhaustive list of absent patterns. No quality scores, no rewritten full text.

## Shipping

Nothing commits or pushes from a writing or editing session without the preview gate and the owner's approval (see preview-posts, ship-posts, release-check). An initial request to publish is not approval. After the owner has received and reviewed the production-preview link, an explicit "approved", "push", "ship it", or "go" is the approval signal that starts the gate chain.

## Source

The AI-tell patterns are distilled from [op7418/humanizer-zh](https://github.com/op7418/humanizer-zh) (MIT, by 歸藏), itself based on Wikipedia's "Signs of AI writing" (WikiProject AI Cleanup). Patterns that conflict with this blog's style (emoji ban, curly-quote ban, 50-point rubric, bulk-rewrite workflow) were deliberately dropped.

This file is co-edited with the owner; changes to it go through his review.
