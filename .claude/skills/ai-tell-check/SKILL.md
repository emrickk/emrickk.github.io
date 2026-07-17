---
name: ai-tell-check
description: Use when reviewing or drafting post prose (Chinese or English) before it goes to owner review, when translating a post, or when any text headed for the site might carry AI-flavored writing patterns. Complements the owner's style rules; does not replace them.
---

# AI-tell check

Two modes for post prose. **Review mode**: a detection checklist for AI-flavored writing patterns; run it as a lint pass on drafts and translations before the owner reviews them. **Drafting mode**: owner-verdict-backed rules for writing or rewriting post prose (see Drafting rules below).

Two hard rules:

1. **In review mode, detection only.** Report findings as quoted phrase + pattern name + one-line reason. Never bulk-rewrite; edits go through the owner's normal review loop.
2. **The owner outranks this file, in both modes.** His lexicon (矫情, 意林, 爹味儿, 看图说话, imagination) catches sensibility-level failures the checklist cannot see, and his final prose overrides every rule here: when he writes warm, follow him. When rules conflict with his rules or his prose, his side wins.

## Chinese patterns

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

## English patterns (translations)

| Pattern | Watch for |
| --- | --- |
| Inflated significance | stands as a testament, marks a pivotal moment, underscores, rich tapestry, ever-evolving landscape |
| AI vocabulary | moreover, furthermore, delve, seamless, robust, vibrant, crucial, foster, showcase |
| Negative parallelism | not just X, but Y; it isn't about X, it's about Y |
| Rule of three | forced triads of adjectives or clauses |
| Vague attribution | experts say, observers note, industry reports show, with no checkable source |
| -ing analysis tails | trailing participles that fake depth: …, highlighting…, …, reflecting…, …, ensuring… |
| Generic endings | The future looks bright, an unforgettable experience, In conclusion |

## Do NOT flag

- 😂 and wry domestic humor: explicitly welcome in this blog.
- Short fragments and punchy sentences: concision is his style, not a tell.
- Curly or CJK quotes (「」 ""): correct Chinese typography, not a tell.
- Three-item lists that are literally true (a real shopping list). Flag the mechanism only when it fakes rhythm or depth.
- Repetition the owner wrote deliberately.

When a finding is borderline, report it marked "borderline, your call" instead of silently fixing or silently passing it.

## Drafting rules (owner-verdict-backed: blind tests plus his own rewrites, 2026-07-16/17)

When writing or rewriting post prose, not just reviewing it:

- Judge the whole piece before any line. Identify the post's register from its own strongest passages and keep every paragraph at that temperature; a locally rule-correct edit that makes one paragraph drier or warmer than its neighbors is worse than the keep. Concision AND consistency, never concision alone (owner, 2026-07-16).
- A declarative or quotable line STAYS when the adjacent concrete material pays for it; cut it only when it floats. Default to keeping. Never give a quotable line its own standalone paragraph; fold it into the scene it belongs to.
- Every scene change needs a physical transition, and the simplest phrasing wins (从穹顶下来，走到老宫).
- First person only when it lands in an object or a dry turn (倒是脚，第二天明显比第一天酸). Never add reaction shots, asides, or self-commentary; such insertions went 0 for 6 in blind tests. Micro-touches are the ceiling: an 😂 on an existing joke, a precision fix like 一位妈妈.
- Fix a repetition or a rotating label only when the replacement is at least as vivid as the original; natural repetition stays.
- Never narrate the photography itself (which frames survived, what the camera was really after); photos punctuate the post, the post does not discuss its photos as photos.
- Concision means cutting frames and summaries, never shaving flavor words: 难得, 终于, 高处的 and their kin carry the feeling inside factual sentences and stay.
- The restraint rules kill fake warmth, not warmth. Second person and even personification are in-voice when they render felt physical experience (先从脚下的石头里感觉到凉意); deadpan self-aware winks are in-voice (（这挨着吗？）); earnest meta frames are not (这个故事里诚实的部分是). Never edit a piece colder than its own temperature.
- Endings never summarize or moralize. Stopping is always safe; a soft landing is allowed only on a concrete personal wry beat (反正我在舒服的家里等着), never on a thesis.
- Three-item lists only when the three items are literally true and each earns its place; two usually beat three.
- Vary how paragraphs end; break a run of same-shape sentences.

## Output format

Numbered findings in text order, each: quoted phrase, pattern name, one-line reason. End with the list of anything considered and passed. No quality scores, no rewritten full text.

## Source

Distilled from [op7418/humanizer-zh](https://github.com/op7418/humanizer-zh) (MIT, by 歸藏), itself based on Wikipedia's "Signs of AI writing" (WikiProject AI Cleanup). Patterns that conflict with this blog's style (emoji ban, curly-quote ban, 50-point rubric, bulk-rewrite workflow) were deliberately dropped.
