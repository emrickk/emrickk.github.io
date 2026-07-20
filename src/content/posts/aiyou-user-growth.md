---
title: 'From 0 to 200,000 DAUs: The User Growth Journey of Aiyou'
description: 'How the game-assistance app Aiyou grew from zero to 200,000 daily active users: retention checks, user surveys, and low-cost growth experiments starting with Kwai.'
pubDate: '2018-12-01'
heroImage: '../../assets/hero/2018/12/aiyou-user-growth-cover.png'
category: 'Things'
lang: 'en'
translationKey: 'aiyou-user-growth'
---

## Before We Start: Some Contexts

Aiyou (Chinese name: 爱游穿梭机) is a game-assistance app that uses screen reading and touch simulation to help users perform repetitive tasks, without disrupting game balance.

![](https://cdn.theneverless.com/2026/07/aiyou-auto-task.webp)

At launch, we gained around 50,000 organic users. However, as the user base expanded, the percentage of new users began to decline. To maintain healthy growth, we needed to explore new acquisition channels.

I was the co-founder of the app and led product management, design, and user growth efforts. The project ran from early 2018 to early 2019, culminating in the app's acquisition.

## Getting Started: What Made It Challenging?

As a self-funded project in its early days, Aiyou didn't have the resources to invest in traditional marketing methods like App Store Optimization or Steam-feed promotions for visibility.

That meant we had to find low-cost, high-exposure growth channels that aligned with our target user group. It sounded nearly impossible.

But that's how our growth journey began.

## Preparations: Ensuring the Product Was Ready

Aiyou had a clear aha moment (the point when users realized the value of the product) and a simple user flow. We knew that once users used Aiyou to farm coins in games, they would love it.

But there was one prerequisite: we needed to make sure the product was stable, accessible, and easy to understand before scaling our growth efforts.

### Retention and Usage Data

As we continued to fix bugs and expand compatibility across more phone models, our new user retention rate improved significantly.

By the time we were ready to promote the app, our day-two retention rate had surpassed 30%, well above the industry average. From a new user perspective, the product was ready for scale.

![](https://cdn.theneverless.com/2026/07/aiyou-retention-data.webp)

On the active user side, the average usage of game-related features reached 3.1 times per day, indicating strong satisfaction with the product. With high engagement among active users, we saw this as the right time to promote and expand our reach.

### Attitude of Users

Our team was based in Beijing, but most of our active users were located in second- and third-tier cities, making in-person interviews difficult. To gather feedback, my development team and I conducted online surveys and reviewed user comments from app stores like Wandoujia and Yingyongbao.

The survey had two parts: one for key users, and one for general users. We shared the key user survey in QQ groups (similar in format to WhatsApp groups). For general users, we embedded the survey directly into the app, making sure it appeared in a way that didn't interrupt the user experience.

We carefully selected survey entry points and questions to avoid interfering with the user's next action, especially in cases where users weren't navigating toward a specific function.

![](https://cdn.theneverless.com/2026/07/aiyou-flow-sketch.webp)

![](https://cdn.theneverless.com/2026/07/aiyou-whiteboard.webp)

We analyzed the user flow and data of our product, finding two places where we could place our questionnaires.

![](https://cdn.theneverless.com/2026/07/aiyou-survey-entrances.webp)

We utilized cloud configuration to set up our banner and developed a detailed page using React Native, enabling us to push updates to users within a few hours.

To ensure maximum accuracy and relevance, most of our survey questions were derived from actual user behaviors, rather than hypothetical scenarios. Given the discerning attitudes of free software users in China, we opted for objective questions instead of subjective ones. For example, instead of asking if users would recommend Aiyou to their friends, we asked if they had actually recommended it during the past two weeks.

Furthermore, we were mindful of avoiding questions that could be easily answered through data analysis, as we did not wish to waste our users' time.

Some questions are as follows:

* How many times did you use Aiyou during the past week?
* If you didn't use Aiyou, is it because you are using apps that have similar functions?
* If it is not because you are using other similar apps, why didn't you use Aiyou?
* The first time you used Aiyou, could you find the desired functions directly?
* If not, why did you fail to find your desired functions?
* Did you encounter any issues during your last use?

In just two days, we received 200 valid questionnaires, which provided significant insights into our users' attitudes.

Our survey results revealed that the majority of users did not experience any frustrating issues while using Aiyou, and believed that it improved their overall gaming experience. Based on these findings, we decided to proceed with our promotions.

## North Star: To Define Our Data Goal

We set a growth equation for our product:

> **New installed users who used Aiyou at least once** × **2nd-day retention rate**, on top of **our active users (stable)**

To us, acquiring active users is the ultimate goal, and thus, the new active user indicator is our guiding star - the one metric that truly matters.

## Promotions Outside Our Product: Early-Stage Preparations for Centralized Promotion

### Persona

![](https://cdn.theneverless.com/2026/07/aiyou-persona.webp)

Typical user:

* Age range: 14-21
* Gender: 82% male
* Geographic location: mostly from second-tier or third-tier cities and villages
* Interests: pop culture and content-oriented
* Financial status: low consumption ability

To optimize our promotion efforts, we divided our methods into two categories: those targeting our current user base, and those targeting potential users outside our current user base.

Due to the effectiveness of centralized promotion activities, we have prioritized these methods over others.

However, we understand the importance of product and performance optimizations and will consider implementing these once we have accumulated a larger user base. We have excluded certain methods, such as relocation and internal optimization, as our product has a short usage flow and provides a satisfactory user experience.

### Promotional Platforms Analysis

To effectively reach our teenage target audience, we discovered that conventional advertising methods like in-app recommendations or email promotions were not suitable. Furthermore, such methods were costly. Instead, we conducted extensive research and tested over 60 apps that are popular among young users.

After analyzing user feedback and data using the MICE framework (Match, Impact, Cost, and Ease), we opted for several short video apps, including Kwai, which has over 1 billion monthly active users, and Tieba, a Reddit-like app. Based on our evaluation, we selected Kwai as our first advertising platform. Daily active user data was sourced from Questmobile.

![](https://cdn.theneverless.com/2026/07/aiyou-platform-comparison.webp)

*Above are platforms we compared.*

## Begin Our Discovery: Agile Testings

Kwai's algorithm gives priority to videos uploaded by a user's followers, and videos are promoted to the 'hot' page once the uploader has sufficient followers. To increase visibility and reach more users, we collaborated with several popular streamers who have a large following, and paid them to upload our videos to Kwai.

To determine which factors contribute to the popularity or lack thereof of our videos, we utilized the variables-control method to eliminate unrelated variables. We selected five uploaders with similar numbers of fans and styles, and varied only one factor per video (such as style, copywriting, or promoting functions) to isolate the effects of each variable. Kwai's primary video styles are often unrefined but popular among users in second- and third-tier cities.

![](https://cdn.theneverless.com/2026/07/aiyou-kwai-videos.webp)

We established a set of key performance indicators (KPIs) for our videos, including views, shares, and click-through rates. To optimize our videos and test their effectiveness, we conducted A/B tests and made revisions based on the function being promoted. We experimented with different scripts, backgrounds, and interactive features to identify the most effective approach.

Thanks to Kwai's low upload barriers, we were able to publish over ten videos per day. On our 30th video, we received a pleasant surprise when it was promoted by Kwai's operation team and received over 300,000 views in a single night, bringing in more than 7,000 new users.

Through continued experimentation, we identified several consistent principles that make our videos popular and even led to their promotion by Kwai's operation team. We summarized the main positive and negative factors that contribute to the creation and promotion of successful videos.

**Main positive factors:**

* Active user interaction builds trust.
* Videos should focus on highlighting the app's aha-functions.
* Tailor content to match the interests of the target audience.

**Main negative factors:**

* Users dislike advertisements, so promotional content should avoid advertising-like descriptions and images.
* Motion and humor in videos work better than text-based content.
* Encourage users to search for the app on Baidu instead of relying on QR codes.

Following our successful promotion on Kwai, we expanded our promotion methods to other similar short-video platforms and increased our video publication frequency. We now regularly upload 5-7 videos a day across various platforms, and as a result, we have gained an additional 10,000-15,000 new users per day. To achieve this, we identified popular platforms among our target audience and optimized our video content to align with the interests of those users.

We also experimented with different types of content, such as mini-games and interactive quizzes, to further engage users and encourage them to share our videos with their friends.

## Optimize and Continue: Constant Centralized Promotions

As our user base grew, we realized that we needed more streamers to promote our app and continue our new user growth. However, the cost of hiring additional streamers was not feasible for us.

By January 2018, our daily active user count had reached 150,000, with 400,000 banner ad views on our main page each day. To reduce costs and utilize our existing traffic advantage, we decided to delegate tasks such as platform selection, content creation, and publish timing to streamers. Streamers have more expertise in these areas, but popular ones often charge high fees.

To solve this problem, we launched an H5 activity called 'I wanna be a creator' to attract and recruit talented streamers who can optimize our promotion methods and reduce costs.

![](https://cdn.theneverless.com/2026/07/aiyou-influencer-poster.webp)

[I Want to Be an Influencer (click to read more)](/posts/wanna-be-creator/)

Up to now, we got more than 100,000 new users through this activity. To make this article concise, I made this activity a single project.

## And... Other Attempts

Although we had previously designed and released several H5 activities, they did not yield the desired results of increasing exposure and downloads for Aiyou.

These activities were not directly related to Aiyou's core functions and did not attract as many new users as expected. As a result, we decided to focus on activities that more closely aligned with our product's value proposition.

The 'I Want to Be an Internet Star' activity has proven to be highly effective in recruiting new users and optimizing our promotion methods. However, given our limited team resources, it is challenging to design and manage new activities frequently.

Some of the activities that I have previously designed include...

### H5 Activity: Test What Kind of ChiJi Player You Are!

We utilized the popularity of Chiji, a famous mobile game in China, to develop a testing activity that aimed to encourage users to share their test results and promote our brand. Despite our users' enjoyment of both the testing activity and the Chiji game, the content of this activity was not directly related to our product's core functions.

Consequently, while the share ratio of this activity reached 13%, the number of new users we gained was lower than our initial expectations, despite the high page view count of the activity. This experience taught us the significance of creating activities that are more closely aligned with our product's value proposition and essential features.

![](https://cdn.theneverless.com/2026/07/aiyou-chiji-sketch.webp)

![](https://cdn.theneverless.com/2026/07/aiyou-chiji-screens.webp)

*We designed 8 questions and 6 results depending on the choice of answers. A large number of users who viewed this activity tried more than 3 times to see different results.*

### H5 Activity: I Am the PUBG Winner!

We obtained valuable insights from our 'What Kind of Chiji Player Are You' test activity. By creating fake winning screenshots that appealed to users' vanity and guiding viewers to download our product with the promise of helping them become real winners in their games, we saw a significant increase in the download transfer rate compared to our previous activities.

However, we recognize that the success of this activity was due in part to our ability to generate unique and engaging ideas, which can be difficult to sustain over time. While this activity brought in new users for a limited period, we need to develop more sustainable and scalable methods for promoting our product in the long term.

![](https://cdn.theneverless.com/2026/07/aiyou-pubg-screens.webp)

We assisted our users in creating personalized winning screenshots that included their usernames. On the final page of the activity, we encouraged viewers to download our product by promising that with the help of Aiyou, they could become actual winners in their games.

To be continued...

## Reflections

* Consistently summarizing and learning new methods is crucial for rapidly pushing a project forward. It's important to design sustainable activities that can consistently attract new users to avoid fluctuations in daily active users, which can negatively impact the product's evaluation.
* Engaging users in the activity design process can lead to successful ideas that product managers may not have considered and bring the product closer to the users.
