---
title: 'Red Packet Assistant: Making Red Packet Grabbing Even More Fun'
description: ''
pubDate: '2017-02-01'
heroImage: '../../assets/hero/2017/02/wechat-red-packet-assistant-cover.png'
category: 'Things'
lang: 'en'
translationKey: 'wechat-red-packet-assistant'
titleZh: '红包助手：让抢红包更有乐趣'
titleEn: 'Red Packet Assistant: Making Red Packet Grabbing Even More Fun'
---

## Context

According to our survey, over half of Chinese internet users spend more than an hour daily collecting red packets on WeChat during the Chinese New Year holiday season, making it an enjoyable and engaging means of celebrating with family and friends. However, 55% of surveyed users reported feeling that their family members are overly enthusiastic about collecting red packets.

I was the Product Manager for this project and worked alongside our designer Yang and developers Dong and Guo. The project took place in early 2017 and took a total of three weeks from start to release.

## Before Start: What Is "Grabbing Red Packets"?

During the Chinese New Year, people often form group chats with their contacts on WeChat, where someone will typically distribute a limited number of red packets to the group. Other members then compete to "grab" one of these packets.

The monetary value within each packet is random, and the total number of red packets shared is usually fewer than the number of group chat participants. Consequently, the amount of money one can acquire depends largely on luck and the speed with which one grabs a red packet, contributing to the excitement of the red packet grabbing activity.

## Vision: Balancing Red Packets and Life

Individuals may experience disappointment if they fail to secure a red packet. However, dedicating an excessive amount of time to staring at smartphones in pursuit of red packets may result in people neglecting their families, potentially causing conflicts among family members (my parents' multiple big fights lol, for example).

Our product aims to strike a balance between these aspects, enabling our users to enjoy the red packet experience while still spending quality time with their families during the Chinese New Year celebration.

## User Journey: What Challenges Might a Typical User Face?

We gathered behavioral data from 121 typical WeChat users aged between 22 and 40 using a research learning spiral approach. We closely observed user behavior and emotional changes before and after their interactions with WeChat to identify their pain points.

![](https://cdn.theneverless.com/2026/07/wechat-rpa-user-journey.webp)

## Function Map: Aligning Our Features with User Needs

We established our core functionalities and further developed secondary features, with the primary objective of ensuring the seamless performance of the main components and interactions with WeChat.

![](https://cdn.theneverless.com/2026/07/wechat-rpa-function-map.webp)

## Use Cases: Monetization and Promotions

![](https://cdn.theneverless.com/2026/07/wechat-rpa-use-cases.webp)

## Realization: Creating Prototypes and Selecting the Optimal Solution

We created several prototypes, and by combining the results of the medium-fidelity prototype A/B tests with the technical implementation challenges, we selected the following plan as our optimal solution. The assistant shipped as a feature within 360 Mobile Security, and we use a floating window to interact with WeChat when users are grabbing red packets.

![](https://cdn.theneverless.com/2026/07/wechat-rpa-prototypes.webp)

### Unique Red Packet Notifications

We utilized computer vision to differentiate red packet notifications from standard ones, and a custom sound was implemented to accompany red packet notifications.

### Extra Emojis and Memes

We introduced a floating ball and floating windows for selecting and sending emojis, ensuring a fun and gratifying experience for our users as they share amusing emojis with friends and family. The objective of our emoji chooser is to showcase selected emojis while offering a seamless experience when selecting and sending them.

Based on our usability tests, we discovered that while floating windows may display limited content, they are the most effective means of avoiding the sense of disconnect caused by switching between WeChat and our app.

### Recording and Sharing

Using only numbers to track such interesting activities is as dull as a marble. To make the recordings more engaging, we implemented achievements. We designed over fifteen achievements and five sharing H5 activities.

## Final Design: Released Product

It's always important to prioritize the happiness of our users :-)

We implemented the following features to enhance user experience:

* Improved notification pop-up
* Customized notification sound
* Convenient floating emoji windows
* Sharing activities
* Achievements

![](https://cdn.theneverless.com/2026/07/wechat-rpa-final-design.webp)

## Data Performance: Have We Really Brought Happiness to Our Users?

We analyzed our data performance after the release of our product.

* **Peak daily active users** during Chinese New Year 2017: **12,000,000 users**
* **Number of red packets grabbed** during Chinese New Year 2017: **251,002,000 packets**
* **Number of emojis and memes sent out** in 2017: **8,890,000 times**

![](https://cdn.theneverless.com/2026/07/wechat-rpa-data-performance.webp)

In addition to analyzing our data performance, I am proud to say that it's the feedback from our users that has made a significant impact:

> "Thanks to Red Packet Assistant, I was able to spend more time with my family."

Our goal is to use technology and the internet to help users focus on their lives, rather than waste too much time on mobile phones. We have helped over 10 million Red Packet Assistant users achieve this balance.

Please feel free to try Red Packet Assistant by downloading 360 Mobile Security [here](http://msoftdl.360.cn/mobile/shouji360/360safesis/360MobileSafe_7.7.4.1038.apk)!
