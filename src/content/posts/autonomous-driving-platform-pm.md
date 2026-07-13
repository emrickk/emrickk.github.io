---
title: 'Product Management for Autonomous Driving Platform'
description: ''
pubDate: '2022-07-01'
heroImage: '../../assets/hero/2022/07/autonomous-driving-platform-cover.jpg'
category: 'Things'
lang: 'en'
translationKey: 'autonomous-driving-platform-pm'
titleZh: '自动驾驶平台的产品管理'
titleEn: 'Product Management for Autonomous Driving Platform'
---

In addition to defining Operational Design Domains (ODDs) for autonomous trucks, a significant portion of product management work at autonomous driving companies involves identifying and improving development and iteration processes. Product managers often utilize software solutions for these tasks. In this article, we focus on the product management methodology for efficient platform development.

The methodology is for engineering efficiency products, meaning the scope is usually designing products for users that we are paying for (e.g., the triage team, algo test engineers), not for general 2B or 2C products.

## Methodologies

* The best "new platform" is "no platform"
* The product management and design of efficiency products should only be guided by efficiency
* The design of efficiency products should be from top to bottom
* Find primary pain points for the system first, and then for users
* Design platforms based on "nodes and triggers"
* Users should be consistently educated

A well-designed efficiency platform should have:

* Quantifiable efficiency metrics
* Clear information visualization and synchronization capabilities
* Clear status visualization and synchronization capabilities
* Linear and well-defined usage processes
* Clear technical boundaries

## Executions

### The Best "New Platform" Is "No Platform"

Utilizing mature algorithms or programs to solve problems is often faster than relying on human intervention. The primary focus should be on exploring and devising solutions from a technical perspective, defining and pushing technical boundaries, rather than designing solutions based on user and developer needs and experiences.

Tools should minimize human intervention instead of adding to it. While "creating a new platform to solve this problem" may seem like the simplest and most direct solution, it is not always the best one. Understanding the essence of the problem, defining its nature (a product problem or a process problem?), and determining its importance (using the important-urgent rule) should always be the first tasks for product managers and designers.

### Product Management for Efficiency Platforms Should Only Be Guided by Efficiency

Driven by efficiency: as mentioned earlier, we hope to solve problems in a systematic and automatic way. Therefore, when a product is identified as necessary and has to be operated by engineers, our focus should be on:

* Thinking about the exit strategy of the product, meaning the ultimate automation of the product
* Minimizing the time users spend using the product. The simplest way to measure this is through the efficiency with which users complete a task.

Solely driven by efficiency: during the product management and design of internal products, numerous factors can influence the judgment of product managers and designers. These factors may include the product's ease of use, existing user habits, visual aesthetics, or even the whims of higher-ups. Designers and product managers need to remain focused, and the most effective way to guide product requirements and design is by prioritizing efficiency. Among all these factors, efficiency is the most easily quantifiable, verifiable, and refutable aspect.

Measuring efficiency:

* Time required for users to complete a unit task using the product (time spent operating the tool by humans).
* Time required for users to communicate with others to complete a unit task (time spent interacting with other humans to finish a task).
* Troubleshooting time required for users to complete a unit task.
* Machine time required for users to complete a unit task (time needed for the machine to process the task).

### The Design of Efficiency Products Should Be from Top to Bottom

When discussing efficiency, it should always focus on the efficiency of the entire system, not just a single tool. Even if Gaea Builder is outstanding, if the map CI is slow, the efficiency of map publishing will remain low. To genuinely define and enhance system efficiency, it is necessary to:

* Have a thorough understanding of the system itself
* Define goals and milestones from top to bottom, and establish product boundaries and missions.

A common mistake made by product managers and designers unfamiliar with the technical details of a system is trying to improve efficiency based on the interface. "Improving efficiency based on the interface" means that the design and product team adopts the users' mental model and attempts to identify product and process issues from the user's perspective. This approach can create an ultimate tool (in terms of ease of use), but not ultimate efficiency. Researching users should be the last step in design and product management, while understanding and defining tool and process goals should be the first step.

A key reason for top-down design is also to define the boundary. Defining the boundaries of each tool is crucial for tools that form a toolchain. Due to the continuous improvement and change in technical capabilities, product management and tool design will always be dynamic. If we keep adding features to a single tool or product, which is usually the most intuitive way to do product management, we are likely to build a monolith at the end of the day or year.

### Primary Pain Points for the System First, and Then for Users

By focusing on pain points based on processes and the autonomous driving system, we can ensure:

* A "top-down design" that remains unaffected by user perspectives
* An accurate understanding of product boundaries

Identifying pain points based on users is always the most direct and straightforward way to summarize results. Designers and product managers tend to rely on this simple and effective method, forsaking system-level thinking. After long-term product management of tools based on functionality, tools are prone to becoming monolithic, since functionality cannot define product boundaries.

### Design Products with the "Node-Trigger" Method

Products with complex interfaces, such as HMI, can easily cause product managers and designers to lose direction and focus on refining individual functions. As mentioned earlier, the sole goal of tools is to improve users' task completion efficiency (broadly defined efficiency, rather than efficiency within the tool). A tool design model based on a defined process for moving forward is necessary.

The node-trigger model:

1. Assume that tasks throughout the process can be completed by machines.
2. Define major nodes that can and cannot be completed by machines.
3. Define nodes that require human intervention.
4. Define the interaction method for human intervention triggers.

The node and trigger method can ensure that 1) efficiency goals are consistently emphasized, 2) the user's usage process is as linear as possible, and 3) the information visualization of the system can always be considered one of the highest priorities.

### Creating Synergy with Business Users

The best operational practice of efficiency products should be actively and passively defined to reduce learning costs and minimize the possibility of errors. Product managers and designers of efficiency products are responsible for defining the user's method of use, especially for non-technical background users, such as TEs and Triagers (Ant users). For these users, new design specifications and usage methods require continuous communication and education by the product team to ensure users have sufficient awareness of the product and that their usage path aligns with the design.

For technically skilled users, such as algorithm developers (Rhino users), the challenge of aligning design and user involves changing the user's existing habits. Successful operational changes often rely on product design consistency. On one hand, the product and design team must have well-established design system support and convince users to try more efficient interaction methods. On the other hand, products and users need to establish sufficient trust to help execute the design. Both of these aspects require education and communication with users to ensure implementation.

### A Little Bit More: Contrasting 2B/Internal Efficiency Products with 2C Products

For most 2C products, retention is crucial. The critical feedback indicator for retention is the amount of time users spend using the product. For internet apps that can be considered "tools," the key is to keep users in the tool for as long as possible.

However, the vision for internal efficiency products is different, and TuSimple product managers and designers sometimes overlook this. In this case, a clearly defined methodology and goal are particularly important, with creativity not always being the top priority in design.

2C products emphasize breakthroughs by using a single set of features or communities to solve a set of user scenarios or pain points, attract users, and increase retention (GMV for e-commerce). They then use the user base to discover and address more pain points. This approach is not entirely applicable to the design of internal efficiency products and processes. The "pain surface," or the pain points of the entire process from start to finish, is more important than individual "pain points" for internal efficiency products. The object of this "pain surface" is the output of the product, rather than the users, as in 2C or 2B products.

Lastly, improving the user experience of internal efficiency products can be a misleading proposition. When discussing user experience, we are considering the difference between the predetermined user usage method and the actual usage method of untrained users. For 2C products, this difference can usually be bridged through intuitive product design, while for internal efficiency products, it can be minimized through process management. Is simple and easy-to-use interaction still necessary for internal efficiency products? It is still necessary, but the threshold can be lower compared to 2C products in certain scenarios.
