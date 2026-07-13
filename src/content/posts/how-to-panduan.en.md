---
translationKey: 'how-to-panduan'
lang: 'en'
title: 'When Interest Is Gone, How Can You Tell?'
---

Toutiao is still pushing me all kinds of car news even after I've bought the car..

Gave the solution some thought

**----Summary----**

Score the user's browsing and interaction behaviors across different topics/channels, weight the scores by "time elapsed until now," and use the resulting scores to judge the user's behavioral trajectory and points of interest. When a score changes abruptly, combine it with the prior trajectory to judge whether the user has "completed the car purchase" and adjust the recommended news accordingly.

**----Full Version----**

**User pain point**: the app does a poor job of recognizing when a long-running interest ends abruptly. This document takes car buying as its example. **Rough idea:** use two typical user behaviors to judge whether the car-buying process has ended

* The user's trajectory overlaps with "heavy browsing of reviews across many car models--heavy browsing of reviews of a single model--checking price information" (the model is chosen and the purchase is near, so demand for car-shopping news starts to decline)
* A sudden drop in attention to car-related news (the purchase is complete, and demand for car-shopping news falls to its lowest point)

**Implementation approach (feel free to skip this section):**

* Assign different point values to the user's browsing and interaction behaviors within each subcategory, weight them by how long ago they happened, and judge the user's current interests by the resulting scores. Use shifts in interest to judge the user's behavioral trajectory and anticipate their likely next step. (This implements the judgment for behavior 1 above.)
* Compute the average fluctuation of the user's interest scores; when an interest is predicted to decline and its resulting score swings sharply negative, conclude that a long-running interest has come to an abrupt end (this implements the judgment for behavior 2 above) (no data behind this one; the assumption is that for most users, interests normally grow or shift smoothly)

**Concrete implementation:** an example:

|  |  |  |  |
| --- | --- | --- | --- |
| Judging from active user actions | | Judging from passive user behavior | |
| Behavior | Weighted score | Behavior | Weighted score |
| Clicking the "x" button on a news item | Count \* -20 | Number of news items browsed in the channel/topic | Unit count \* 10 |
| Removing the channel from My Channels | -20 | Time spent browsing the channel/topic | Unit time \* 10 |
| Moving the channel toward the back of the list | -20 | Time spent reading comments in the channel/topic | Unit time \* 5 |
| Deleting saved items from the channel/topic | -20 | User trajectory score | 0.8 |

*Chinese users generally have no habit of actively disliking content, so when it does happen it is necessarily a strong act of content intervention, which is why it scores highest; channel-level browsing is the most direct signal of whether a user's interest has shifted, so it also scores high; browsing of individual news items comes in such huge volume that the data changes slowly, hence the low per-unit score*

* While the user keeps browsing car news, the channel's score, weighted by how recently each behavior occurred, keeps climbing, and shifts in the content they read allow the user's trajectory to be judged. If the user has already completed the browsing trajectory in idea 1, lower the weight of related news and be ready for the user to complete the purchase and for demand to plunge

* When the score for car news is seen to drop, judge whether the purchase has been completed based on the prior trajectory and the size of the drop, and start cutting way back on pushes of car-shopping, price-comparison, and similar news

Note 1: news categories can be further subdivided by channel and content, which would make it easier to judge user behavior from fluctuations in the resulting scores. It would also help with later recommendations of news on car care/maintenance and the like.

Note 2: the approach of having new users select their own attributes, since it cannot (or cannot easily) be changed, is bound to affect later judgments of user interest, especially interest within a given period or moment, so this approach is not used

Note 3: the pre-purchase trajectory is drawn from iResearch's 2014 research report on the car-buying behavior of Chinese internet users. The other user behaviors and interests mentioned in this piece have no concrete data behind them; they were all decided off the top of my head.
