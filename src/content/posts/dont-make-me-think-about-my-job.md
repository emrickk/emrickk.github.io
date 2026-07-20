---
title: 'Don''t Make Me Think (About My Job): Sincerity, Expertise, and B2B Product Design'
description: 'How "don''t make me think" gets misapplied on Alibaba.com: define the buyer''s decision, earn domain expertise, and build sincere B2B products.'
pubDate: '2025-08-17'
heroImage: '../../assets/hero/2025/08/dont-make-me-think-cover.webp'
category: 'Things'
lang: 'en'
translationKey: 'dont-make-me-think-about-my-job'
---

> *Originally shared internally with the Alibaba.com product team. All examples are based on public information, and any sensitive data has been anonymized.*

Steve Krug's *Don't Make Me Think* is a foundational text in web design. Its core principle, that an interface should be so intuitive it requires no thought, has become product design canon. But on a platform like Alibaba.com, that principle is often misapplied. Not due to a lack of effort, but because of a misalignment in how we define "usability" in a certainty-driven B2B environment.

## The Phantom Buyer: Designing for a Fictional "B2B Beginner"

One common approach I've seen is equating "easy to use" with "understandable by a total beginner." So we optimize for a hypothetical B2B novice. The result: information that feels superficial to experienced users and confusing to new ones. As a result, we see a significant portion of retained users bypass the product flow entirely and just send inquiries to sellers.

The goal of usability should never be "think less about B2B trade." It should be: "spend less time processing irrelevant noise and more time finding the right signal, and getting actionable answers fast."

## Define the Decision, Not Just the Information

Before we talk about usability, we need to define what exactly we're trying to make easier. In B2B, we're not just designing for task completion or clickthroughs. We're designing around purchase decisions: real money, long delivery cycles, and operational impact.

The question isn't: should we design for a newbie dropshipper or an enterprise buyer? The real question is: what decision does the user need to make?

Without clearly defining that decision, we start designing for a "phantom user": someone with no domain knowledge, who just clicks around based on UI aesthetics. And soon, our product logic revolves around this phantom. In the end, we fail both new users and expert buyers.

Let's look at the CE certificate example:

![](https://cdn.theneverless.com/2026/07/b2b-ce-certificate.webp)

On the product detail page, the CE section features a long explanation of what CE is. It takes about 40 seconds to read (150 words/min). But this doesn't help anyone:

* Experienced buyers don't need a definition of CE. They just want to know: **Does this product have a valid CE certificate?** A simple Yes/No lets them complete a compliance checklist.
* New buyers don't benefit from general info either. What they care about is context: "Do I need CE for my country?" "Does this expire?" "Is it for this product or the whole store?" They're also worried about fraud: CE certificates vary wildly in format, and many are fake.

None of those questions are answered in the current UI.

Without defining the decision, we end up with low-value content and no clarity. The goal isn't to block user thinking; it's to focus user attention on what matters for their decision. Otherwise, users will bypass product logic altogether.

## The Fallacy of "Benevolent Dictatorship"

You need domain expertise before you earn the right to simplify. But many PMs lean on Apple-style "benevolent dictatorship": trust me, I've done the research, this is the optimal experience.

That approach assumes:

1. The stakes are low, and mistakes are reversible
2. The hidden info is still accurate and stable

Apple can hide complexity because failure means mild user frustration (say, not finding AirDrop). On Alibaba.com, hiding critical info means a buyer fails to complete a purchase or makes a costly mistake. When that happens, they don't retry; they bounce or go offline.

Complexity doesn't disappear. It's offloaded to the buyer and the seller. And the buyer ends up flying blind through supplier chat.

That's not "benevolent." That's just authoritarian. And it's a product choice made without the expertise to back it.

If you want to simplify the world for your users, you have to first understand the one they live in, and the business decisions they face.

## Common Sense Has to Be Earned

To know what matters to buyers, PMs must develop domain awareness. You don't have to be a procurement pro, but you do need to earn the right to think on their behalf.

This can't come from one-off "place a buyer order" campaigns. Those are a nice start, but some PMs treat them like UX theater. True product judgment comes from repeated, deliberate practice.

Imagine if every PM had to answer this question every day:

> "If I were spending $500 / $5,000 / $50,000 on this platform, which of these three sellers would I choose, and why?"

Or:

> "Why did this Mexico-based buyer talk to 20 suppliers and choose a small Yiwu factory? What happened?"

This kind of thinking would fundamentally reshape our product. PMs would feel the pain their own features create. The CE certificate issue wouldn't exist. We'd understand what it's like for a small Mexican buyer to try to silently complete an order.

We'd start demanding better tools, not for abstract personas, but for use cases we've lived through.

This is how you bridge the empathy gap. It's how you stop being a UI designer and become a decision-enabling product owner.

## 🎶 Russian Roulette Is Not the Same Without a Gun

*(yes, that's a Lady Gaga reference, you're welcome)*

## Sincerity: Build Products That Actually Help, Not Just Look Good

This brings us to the heart of the issue: sincerity.

A sincere product is built with value creation in mind. It asks: "Does this feature help buyers make better, more profitable decisions?"

Too often, we build with growth-hack logic: "How can we make the number go up? New design? Change the user funnel?"

That's how we get what Steve Krug calls "dishonest design." For example:

![](https://cdn.theneverless.com/2026/07/b2b-shipping-options.webp)

It looks great. It probably increased conversion in an A/B test. But functionally?

* Premium shipping is more expensive than Standard, but somehow slower?
* We proudly show that 80% of orders miss the 11-day mark, and call it "Alibaba.com Logistics"?

This isn't helping buyers decide. It's making them solve a puzzle, one that doesn't need to exist. A sincere design would show clear cost-speed tradeoffs, suppress low-confidence data, and avoid visual traps.

This is what real usability looks like.

## PMs Shouldn't Satisfice

The problem is even worse in our LLM features. Many of these were rushed out of fear of missing the AI wave. The result? Cluttered screens, weak UX, and zero real help.

![](https://cdn.theneverless.com/2026/07/b2b-llm-description.webp)

Here's one example: an auto-generated 79-word description that takes 30 seconds to read.

* How much useful info is in there?
* How many vague adjectives like "high quality," "durable," or "unique"?

This isn't content. It's filler. And it's lazy product work. We treat LLM as magic, don't design for structure, don't tune prompts, and hide behind "MVP" as an excuse to ship.

Yes, building something truly good is hard. And we face real resource constraints. But Krug's idea that "users satisfice" has been misused. It's an observation about user behavior, not a license for PMs to cut corners.

Our job is to make sure the best option is the first one they see. If we also satisfice, if we settle for "just works" because "best" is too hard, we've already failed.

If we never move beyond V1, the real value stays locked in a "next phase" that never comes.

## Generative AI Should Replace Hunting, Not Just Rewrite the Page

Before LLMs, the only tool we had was UI simplification. That era is over.

The real potential of AI isn't "better text." It's a new interface paradigm: the LLM *is* the interface.

Imagine:

* Product data is analyzed and guided at listing time
* Traffic allocation is based on real product and seller quality
* LLMs understand that "cost-effective" in Mexico means total landed cost post-customs, not unit price
* They account for dynamic US tariffs and compute pricing accordingly

LLMs can:

* Offer insights to small business buyers
* Pre-generate compliance docs for corporate buyers
* Even provide a little emotional support, like a good seller would

That's what *Don't Make Me Think* actually looks like in 2025: a system that thinks for the user, so they can finally act like a decision-maker, not a data scavenger.

But that shift won't start with AI. It starts with us.

From building interfaces to building expertise.
