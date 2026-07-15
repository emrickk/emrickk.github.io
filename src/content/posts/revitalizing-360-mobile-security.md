---
title: 'Revitalizing 360 Mobile Security: From a Mere Tool to an Emotional Companion'
description: ''
pubDate: '2018-05-01'
heroImage: '../../assets/hero/2018/05/revitalizing-360-mobile-security-cover.png'
category: 'Things'
lang: 'en'
translationKey: 'revitalizing-360-mobile-security'
titleZh: '焕新360手机卫士：从工具到情感伙伴'
titleEn: 'Revitalizing 360 Mobile Security: From a Mere Tool to an Emotional Companion'
---

## Context

The daily active users for 360 Mobile Security, a one-stop application that consists of an anti-virus, system cleaning, and other features, declined by 15%, and the 30th-day retention rate dropped by 3% from early 2016 to late 2017. Additionally, the active launch rate declined by 12%. A revisit of the vision, planning, features, and design of the application was necessary to save it.

I was the product management lead for the reviving project. Along with my design and dev team, we finished the entire project in 5 weeks.

![](https://cdn.anping.us/2026/07/r360-vision-transition.webp)

## Get Ready: Project Timeline

We have to ship out our first beta version in 45 days. A thorough schedule would significantly benefit us in achieving our goal.

<div style="overflow-x: auto; margin: var(--space-8) 0;">
<svg viewBox="0 0 1200 430" role="img" aria-label="Project timeline Gantt chart, April 12 to May 27: research, design, and development tracks running in parallel, with a quality gate on May 3 and the beta version shipped on May 27." style="font-family: var(--font-sans); display: block; width: 100%; min-width: 760px;">
<title>Project timeline Gantt chart, April 12 to May 27: research, design, and development tracks running in parallel, with a quality gate on May 3 and the beta version shipped on May 27.</title>
<rect x="131" y="84" width="1063" height="290" fill="var(--fill-quaternary)"/>
<text x="171" y="48" text-anchor="middle"><tspan font-size="13" fill="var(--label-tertiary)">APR.</tspan><tspan font-size="20" font-weight="600" fill="var(--label-secondary)">12</tspan></text>
<text x="345" y="48" text-anchor="middle"><tspan font-size="13" fill="var(--label-tertiary)">APR.</tspan><tspan font-size="20" font-weight="600" fill="var(--label-secondary)">15</tspan></text>
<text x="528" y="48" text-anchor="middle"><tspan font-size="13" fill="var(--label-tertiary)">APR.</tspan><tspan font-size="20" font-weight="600" fill="var(--label-secondary)">20</tspan></text>
<text x="669" y="48" text-anchor="middle"><tspan font-size="13" fill="var(--label-tertiary)">APR.</tspan><tspan font-size="20" font-weight="600" fill="var(--label-secondary)">22</tspan></text>
<text x="879" y="48" text-anchor="middle"><tspan font-size="13" fill="var(--label-tertiary)">MAY.</tspan><tspan font-size="20" font-weight="600" fill="var(--label-secondary)">03</tspan></text>
<text x="1113" y="48" text-anchor="middle"><tspan font-size="13" fill="var(--label-tertiary)">MAY.</tspan><tspan font-size="20" font-weight="600" fill="var(--label-secondary)">27</tspan></text>
<text x="118" y="108" text-anchor="end" font-size="15" font-weight="600" fill="var(--label-primary)">Research</text>
<text x="118" y="192" text-anchor="end" font-size="15" font-weight="600" fill="var(--label-primary)">Design</text>
<text x="118" y="286" text-anchor="end" font-size="15" font-weight="600" fill="var(--label-primary)">Develop</text>
<line x1="898" y1="84" x2="898" y2="374" stroke="rgba(235, 106, 97, 0.55)" stroke-width="1.5"/>
<line x1="1065" y1="84" x2="1065" y2="374" stroke="rgba(235, 106, 97, 0.55)" stroke-width="1.5"/>
<text x="888" y="108" text-anchor="end" font-size="15" font-weight="600" fill="var(--label-primary)">Quality</text>
<text x="1194" y="398" text-anchor="end" font-size="15" font-weight="600" fill="var(--label-primary)">Beta Version Shipped</text>
<rect x="134" y="96" width="26" height="13" rx="6.5" fill="#7fd1dc" fill-opacity="0.65"/>
<text x="169" y="102.5" dominant-baseline="central" font-size="14" fill="var(--label-secondary)">Kick Off & Schedule</text>
<rect x="162" y="129" width="141" height="13" rx="6.5" fill="#7fd1dc" fill-opacity="0.65"/>
<text x="312" y="135.5" dominant-baseline="central" font-size="14" fill="var(--label-secondary)">Actuality Research</text>
<rect x="354" y="96" width="180" height="13" rx="6.5" fill="#7fd1dc" fill-opacity="0.65"/>
<text x="543" y="102.5" dominant-baseline="central" font-size="14" fill="var(--label-secondary)">User Research</text>
<rect x="507" y="129" width="93" height="13" rx="6.5" fill="#7fd1dc" fill-opacity="0.65"/>
<text x="609" y="135.5" dominant-baseline="central" font-size="14" fill="var(--label-secondary)">Market Research</text>
<rect x="963" y="96" width="99" height="13" rx="6.5" fill="#7fd1dc" fill-opacity="0.65"/>
<text x="1071" y="102.5" dominant-baseline="central" font-size="14" fill="var(--label-secondary)">QA</text>
<rect x="540" y="182" width="99" height="13" rx="6.5" fill="#7fd1dc" fill-opacity="0.65"/>
<text x="589.5" y="172" text-anchor="middle" font-size="14" fill="var(--label-secondary)">Analysis & Vision</text>
<rect x="654" y="182" width="330" height="13" rx="6.5" fill="#7fd1dc" fill-opacity="0.65"/>
<text x="993" y="188.5" dominant-baseline="central" font-size="14" fill="var(--label-secondary)">UX / Logic Design</text>
<rect x="303" y="216" width="108" height="13" rx="6.5" fill="#7fd1dc" fill-opacity="0.65"/>
<text x="420" y="222.5" dominant-baseline="central" font-size="14" fill="var(--label-secondary)">Former Design Review</text>
<rect x="633" y="216" width="279" height="13" rx="6.5" fill="#7fd1dc" fill-opacity="0.65"/>
<text x="921" y="222.5" dominant-baseline="central" font-size="14" fill="var(--label-secondary)">Prototyping & Iteration</text>
<rect x="393" y="269" width="150" height="13" rx="6.5" fill="#7fd1dc" fill-opacity="0.65"/>
<text x="468" y="259" text-anchor="middle" font-size="14" fill="var(--label-secondary)">Technology Probe</text>
<rect x="675" y="269" width="369" height="13" rx="6.5" fill="#7fd1dc" fill-opacity="0.65"/>
<text x="1053" y="275.5" dominant-baseline="central" font-size="14" fill="var(--label-secondary)">Interface Dev.</text>
<rect x="552" y="299" width="366" height="13" rx="6.5" fill="#7fd1dc" fill-opacity="0.65"/>
<text x="927" y="305.5" dominant-baseline="central" font-size="14" fill="var(--label-secondary)">Server Dev.</text>
<rect x="411" y="329" width="339" height="13" rx="6.5" fill="#7fd1dc" fill-opacity="0.65"/>
<text x="759" y="335.5" dominant-baseline="central" font-size="14" fill="var(--label-secondary)">Performance Dev.</text>
</svg>
</div>

## Look into Data: Discover Existing Problems

The cohort analysis was the principal part of our research. We have a relatively sophisticated data collection system, and using user data to evaluate the way users interact with our app is one of the best methods to identify problems and determine our further research direction.

![](https://cdn.anping.us/2026/07/r360-weekly-user-constitution.webp)

* The percentage of new users was less than anticipated. A downtrend in the percentage of new users indicates that the rate of initial function satisfaction among new users was falling.
* A low frequency of functional usage was also a possible reason that could lead to the low two-week and four-week succession user percentages and the high return user percentage.

![](https://cdn.anping.us/2026/07/r360-freshness-degree.webp)

* We conducted more in-depth research with the help of the freshness degree of users. The steadiness of the 30th-day freshness user rate indicates that most active users are satisfied with our products.
* The previous second-day freshness user rate declined sharply compared to the first-day freshness user rate, but the +4 and later day freshness user rates were relatively steady. We suggest that it was the unfriendly function guides that caused new users to leave.

![](https://cdn.anping.us/2026/07/r360-user-access-pattern.webp)

The sharp decline in the 2nd to 3rd step user access pattern further confirmed our hypothesis.

Most functions require 3+ clicks to reach, which makes the learning cost of our product quite high and scares away new users. The conversion rate of users after two clicks declined gradually, indicating that those users knew what they were doing and were willing to do it.

## User Research: To Comprehend Users in an Emotional Way

At this phase of user research, we focused more on the use cases of our audience in addition to data, such as their usage habits, the problems they encountered, and their emotional feedback. Moreover, we hope to gather more ideas from users.

![](https://cdn.anping.us/2026/07/r360-research-methods.webp)

We synthesized our user research and user data and identified four insights that led to the heart of the matter. These realizations helped us refine our hypothesis and determine the specific areas and issues that our solution needs to target.

![](https://cdn.anping.us/2026/07/r360-four-insights.webp)

* Some users did not know when or how they should use 360 Mobile Security.
* Users became upset when a function was the reason they installed our app.
* Users experienced a lag on their phones after installing 360 Mobile Security.
* Some users complained that our product lacks functions that they want or that our competitors have.

Malfunction and performance problems can influence the retention rate and can be fixed by our R&D and QA teams alone without changes in the logic and user interface after we describe the specific situation (we made these problems our priority). Product managers then move forward to identify additional problems and new improvement points.

## Market Research: Inspired by the Market

### Competitor Analysis

We analyzed our main competitors and identified their strengths and weaknesses. We paid additional attention to their new features and experiences that are lacking in our product.

![](https://cdn.anping.us/2026/07/r360-competitor-analysis.webp)

### Industrial Analysis

We discovered several current market and user demand situations after reviewing reports issued by iResearch, QuestMobile, Analysys, and TalkingData.

![](https://cdn.anping.us/2026/07/r360-industrial-analysis.webp)

## Analysis & Vision: Combined Solutions with Innovative Ideas

We revised our current functions by combining user emotion with their potential demands. When new ideas emerged during our research, we found the direction for our new version.

![](https://cdn.anping.us/2026/07/r360-true-needs.webp)

## Prototyping & Usability Test: Do We Have the Same View as the Audience?

We redesigned our app structure by making function levels flatter and creating a clearer and more user-friendly design for new users.

We sketched medium-fi prototypes and completed usability tests with each iteration. We primarily used hotspot maps and path maps to evaluate our design. The prototypes for the eighth iteration are as follows.

![](https://cdn.anping.us/2026/07/r360-prototypes.webp)

In our eighth usability test:

* 81% of users went directly to their desired functions instead of spending time searching for them.
* The +3 click function reach rate dropped from 22% to 6%.
* The bounce rate of the main page decreased from 32% to 17%.

Afterward, we created the Hi-Fi version of our designs and sent them to the development team.

## Design: Putting Thoughts into Reality

### Give the Main Page a Feed

We redesigned our main page to be waterfall-like in order to make young users feel more comfortable exploring new features and their phone statuses.

![](https://cdn.anping.us/2026/07/r360-mainpage-feed.webp)

*The 7.0 version main page feed.*

**Ideogram:** We removed all unnecessary copywriting and redesigned the icons to be more concise. Our aim was to indicate the places where users want to go more clearly.

**Focus:** We reorganized our functions, made more room for our main features, and improved the perception of our brand image.

Structure revision makes functions easier to get in touch with.

![](https://cdn.anping.us/2026/07/r360-old-version.webp)

*Old function entry in the 6.x version.*

![](https://cdn.anping.us/2026/07/r360-new-mainpage.webp)

*New function tab on the 7.0 version main page.*

### Skins for Young Users

![](https://cdn.anping.us/2026/07/r360-skins.webp)

We represented brightness not only in our designs but also in our functions. We made our functions customizable.

![](https://cdn.anping.us/2026/07/r360-toolbox.webp)

Additionally, we redefined the functions we provided, positioning ourselves as a true and sincere friend and phone manager.

* Users can customize their desired functions in the toolbox.
* Suitable features will be promoted based on user tags and operating behaviors.
* In the 6.x version, functions were hidden in a drawer menu and were unchangeable.

![](https://cdn.anping.us/2026/07/r360-freshness-push.webp)

Combined with real-time detection and our push system, our users no longer have to worry about when to clean their phones, check for software updates, or deal with other annoying issues.

One of our advantages is that we have many safety-related features from other departments that are tightly integrated in our app, more so than in other apps.

## Data Performance: The Ultimate Way to Evaluate Our Product

We analyzed our data performance every week after shipping our beta version. After five weeks...

![](https://cdn.anping.us/2026/07/r360-data-performance.webp)

We were able to prevent our Daily Active Users from declining, and our DAUs even increased by 3.1% compared to the original data.

Finally, our 30th Day Retention Rate also increased by 3.9%, indicating that three million more users kept the 360 Mobile Security app on their phones after 30 days.

![](https://cdn.anping.us/2026/07/r360-the-end.webp)

Please feel free to try 360 Mobile Security 7.x [here](http://msoftdl.360.cn/mobile/shouji360/360safesis/360MobileSafe_7.7.4.1038.apk) with an Android phone!
