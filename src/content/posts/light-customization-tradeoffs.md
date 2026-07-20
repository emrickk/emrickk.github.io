---
title: 'Balancing Capability and Product Compromise in Light Customization'
description: 'How the Alibaba.com Light Customization project should balance capability limits against product compromise, with full transactionalization as the guiding principle.'
pubDate: '2024-06-01'
heroImage: '../../assets/hero/2024/06/light-customization-tradeoffs-cover.jpg'
category: 'Things'
lang: 'en'
translationKey: 'light-customization-tradeoffs'
---

## Context

We are currently developing the **Light Customization** project on Alibaba.com. Within the team, there are two major schools of thought:

1. **Full transactionalization.** This view argues that we should require sellers to upload complete product and customization data onto Alibaba.com, building a more advanced and structured **Editor**. The goal is to enable users to place orders or complete customizations *without any communication*.
2. **Lightweight entry.** This perspective suggests the platform should focus only on being an entry point, providing matching and filtering tools while leaving detailed customization and communication to sellers themselves.

This document discusses how we should balance between **capability compromise** (platform and tool limitations) and **product compromise** (experience and flow trade-offs) during the development of Light Customization.

## Follow-up Product Strategy

The guiding principle for our product direction and trade-offs should be **"full transactionalization."**

> Before the order is placed, we should minimize communication latency. Ideally, users can complete customization and transaction instantly, with little or no interaction.

### Seller Incentives vs. Seller Boundaries

When making decisions that involve seller input (e.g., defining customization attributes per product or via templates), we should **not prematurely assume** that sellers "won't cooperate."

* Seller incentives should be explored through **traffic control mechanisms**, not rigid assumptions.
* The key question to validate is: *At what point does a seller requirement become too cumbersome to scale?*

### Building Seller Capabilities vs. Historical Burdens

Since **full transactionalization** has become a firm direction, seller capability-building and tool design should be defined under the premise of **transactional efficiency**.

* In cases like "new customization fields are incompatible with previous ones," we should design for the **post-transactional future**, rather than compromise for backward compatibility.

### Product Scope Compromise vs. User Flow Compromise

As a full-category trading platform, Alibaba.com cannot instantly deploy every capability or achieve every long-term goal. When current platform capabilities cannot support the ideal user journey, we should:

* **Redefine the covered product or service scope**, rather than compromise the long-term vision.
* For example, if our Editor cannot yet support complete customization expression and users must still inquire, we should focus on **categories or sellers capable of minimizing communication**, rather than abandon the pursuit of "communication-free light customization."

### User Behavior Migration to the Platform Should Be the Top Priority

Payment represents the strongest form of user intent and is the anchor for improving conversion. When balancing **user experience** against **data collection**, we should lean toward **actively capturing user behavior on the platform**, as long as it does not harm user experience.

* After a user expresses customization intent, we must **offer payment capabilities** and use payment data to identify bottlenecks in the current flow, not give up on guiding users toward completing payment.

## Implications for the Light Customization Project

1. **Clarify stage goals and define "Light Customization."**

   * In the current stage, the goal is to enable *structured communication* and reduce communication latency.
   * The long-term goal is *"zero communication, fully transactional customization."*
2. **Provide posting capabilities based on future seller efficiency.**

   * Build **batch template posting** instead of per-product modification.
3. **Clearly define the scope and target industries for Light Customization.**

   * Provide **certainty** in customization capability, logistics, and pricing.
   * Do not abandon efforts to structure and reduce uncertainty; we should not hand information certainty entirely over to sellers.
4. **Increase certainty and confidence on the product detail page.**

   * Help users reduce the latency between *having a customization need* and *passing that need to the seller*.
5. **Enable payment and expand payment-ready scenarios.**

   * Provide the ability to pay directly, fix bad cases within the current flow, and continue expanding the set of light customization scenarios where payment can be completed immediately.
