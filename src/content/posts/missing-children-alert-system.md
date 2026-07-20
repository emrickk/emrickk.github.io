---
title: "Missing Children Alert System: China's First AMBER-Alert-Like System"
description: 'A missing-children alert system built on 360 Mobile Security''s push channel, reaching the right users without disturbing them: 109 children rescued by 2019.'
pubDate: '2016-05-01'
heroImage: '../../assets/hero/2016/05/missing-children-alert-system-cover.png'
category: 'Things'
lang: 'en'
translationKey: 'missing-children-alert-system'
---

An AMBER-Alert-like notification system for lost-found children, based on the push message system of 360 Mobile Security.

## Context

In 2015, 1,427 children were reported missing in China. Unfortunately, law enforcement agencies have limited avenues for effectively reaching a broad user base. Furthermore, there is a significant need for an accessible method that allows the public to provide valuable information to assist police in their efforts.

I was part of the product team that initiated the project. My part was to design the notification logic.

![](https://cdn.theneverless.com/2026/07/mcas-alert-scenario.webp)

## Before Start: Previous Efforts and Initiatives

The Ministry of Public Security has collaborated with Alibaba to create an information platform, yet additional applications are necessary to engage a wider audience. However, it is essential to address the current notification system employed by the platform, as it tends to be intrusive and disruptive for users.

## Vision: The Objectives Remain Consistent

To effectively rescue more missing children, an alert system must incorporate the following features:

* A seamless, integrated notification system
* Broad user reach for maximum exposure
* Long-term usability and user engagement

## Our Solution: Employing a Push Notification System to Engage Users

We have diligently worked to ensure our design is both clear and concise.

![](https://cdn.theneverless.com/2026/07/mcas-design-versions.webp)

*From left to right: the 1st, 2nd, and 3rd versions.*

The user interface features only push notifications accompanied by a dedicated page displaying detailed information about the missing child, as well as contact information for the responsible officer or pertinent authorities.

## The Challenge: Engage a Wider Audience Without Causing Disturbance

If users receive push notifications that are irrelevant, such as incidents occurring far from their location, or if they are inundated with excessive notifications, it may become bothersome and deter them from using the service.

On the other hand, being overly cautious may lead to reduced system effectiveness. As such, accurately identifying the appropriate users is crucial for the success of the system.

### Identifying Scopes

Based on the time the child went missing and the hypothetical vehicle they could take, we can figure out several possible areas, and pick users from those areas to send our customized push messages.

![](https://cdn.theneverless.com/2026/07/mcas-scope-identification.webp)

### Identifying Other Elements

We can obtain user tags based on the apps they have installed and their in-app behavior within the 360 suite of applications. The selection covers behavioral, occupational, social, and psychological attributes, together with emergency level identifications.

![](https://cdn.theneverless.com/2026/07/mcas-user-attributes.webp)

Upon a child being reported missing, the initial notification will be dispatched to users within a specified range. Subsequent push notifications will be selectively sent to users, taking into consideration their specific characteristics and the degree of urgency.

## Final Product: Distinct Push Notifications for Varied Users

![](https://cdn.theneverless.com/2026/07/mcas-persona-notifications.webp)

Since the launch of our system, we have successfully assisted in rescuing **109 children** as of 2019! Among them, 9 were rescued thanks to the proactive efforts of our dedicated users.
