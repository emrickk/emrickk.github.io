---
title: 'Forming Fast Product Problem-solving Iterations'
description: 'Forming fast product problem-solving iterations at TuSimple: shared context, maximized participation in decision-making, quick experiments, and expectation management.'
pubDate: '2023-01-03'
heroImage: '../../assets/hero/2023/01/fast-product-iterations-cover.jpg'
category: 'Things'
lang: 'en'
translationKey: 'fast-product-iterations'
---

### Scope of the Article

In this article, I am focusing on the decision-making process of an efficient product problem-solving cycle. Of course, a product management team with high-quality talent is a prerequisite, and I will cover it in another article. Focus and clear alignment of priorities for the product team with the company's priorities are also important, as TuSimple is still a research company and we do not have customer demands as our prioritization principle. The RICE model generally does not work well here.

*Note: One can argue that the product team can identify internal users as customers and conduct prioritization. Please refer to* [*my other article*](/posts/autonomous-driving-platform-pm/) *for my thoughts.*

### Definition

1. High efficiency is achieved under the prerequisite of delivering high-quality products.
2. High-quality products are identified by achieving pre-identified goals.
3. The goals should be either binary or quantitative: solving an existing or future pain point (or not), and improving a data metric (or not).

In this article, within TuSimple's context, I define efficiency as the time from a pain point emerging to the time that the acceptance criteria have been met, or the theoretical problem-solving prerequisites have been met. For example, if we find the disengagement rate increased during the past 30 days, the definition of done for the efficiency cycle should be the release of the new algorithm changes that theoretically solve the false disengagement issue.

### Modeling

The essence of the problem-solving model: building a model is essentially building a workflow for decision-making. A typical problem-solving cycle in TuSimple is to:

1. Identify priorities: determine which problems to focus on.
2. Identify problems and solutions: understand the root cause and how to solve it.
3. Communicate and execute the solution, and verify the resolution of the problems.

I consider stakeholders in the problem-solving process as forming a "thinking group" (not groupthink, lol) and believe that a highly efficient problem-solving cycle can be transferred and consists of three parts:

* Pre-decision: the phase where all stakeholders reach the same context and mental readiness about the problem, and form their individual solutions for the problem.
* Decision-making: the phase where solutions are communicated, and agreements are reached on directions.
* Post-decision: the phase where the solution, in terms of execution, is formalized and executed.

### Difficulties

The achievement of maximized efficiency in this model depends on:

* A standardized understanding of the problem scope
* Maximized involvement in the decision-making process, meaning maxing out the total intelligence of the thinking group
* Reaching agreements among stakeholders; disagreements can be caused by different understandings of the problem scope

Also, the lack of a passive feedback loop, or failures in the installation of the decision-making process during the post-decision execution phase, can lead to:

* Excessive small changes to the product (Ship of Theseus)
* Underachievement of the product goals ("we didn't achieve this because of XYZ, and it's not my fault")
* Failures in achieving the expected outcome

### Solutions and Implementations

They are not prioritized, but rather based on the order of the three steps mentioned above:

#### Keep Contexts Handy

Here, by context, I refer to product items and action items.

###### Context about the Product

* User research docs, PRDs, designs, and data collection docs
* PRDs and design should be up-to-date and match online product logic
* Materials should be on Confluence instead of scattered on Google Drive to ensure accessibility
* Problem descriptions
* Jira tickets or descriptions from Pagers should be shared and made public

###### Context about the Role

* Keep a list of stakeholders so that we also know who to reach out to, especially for products such as HMI

#### Maximize Participation in Thinking

* Avoid being dependent thinkers

  + Build your own source of truth: gather product managers' own understanding of problems, especially those two-sided problems with public interactions or non-tech users
  + Ingest context provided by researchers and developers: dig into the reasoning, instead of only conclusions
* Encourage solution-oriented thinking

  + Focus on the improvement of the system. Highly dependent systems design, such as AV development, often triggers users to find problems in operations instead of the systems, as human operators are easier to blame for mistakes. Yet solving people problems has a much lower priority
* Be nice to people, but not to people's ideas

  + Expect and lead debates and challenges. Don't be frightened by challenges, and don't be afraid of coming up with challenges for others. It's common to "care for others' feelings," but that is essentially self-protection

#### Run the Experiments and Get the Data

* Identify the hypothesis

  + Refer to the research guideline
* Don't forget the simulation ecosystem

  + Creating logic and scenarios in the sim system can be boring but is essential for the baseline to be created
* Do not expect a perfect solution from the beginning

  + Instead, use a spiral or progressive design method to get quick wins, and solve the problem systematically when you can achieve both simultaneously

#### Manage Expectations

* Manage your time
* Manage the expected outcome of a meeting or a testing
* Manage the expected product delivery for users
