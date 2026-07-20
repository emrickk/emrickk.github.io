---
title: 'Product Management Methodology for Internal Tools'
description: 'A product management methodology for internal tools, written during my time at TuSimple: the best tool is no tool, and efficiency is the only guide.'
pubDate: '2022-06-05'
category: 'Things'
lang: 'en'
translationKey: 'tusimple-pm-methodology'
---

*I wrote this document on my TuSimple anniversary. I revised it and posted it here as today is already my second anniversary at TuSimple. Time flies!*

# **Methodologies**

* The best tool is no tool

- The product management/design for internal tools should only be guided by efficiency

- The design of the tool should be from top to bottom

- Find pain points based on processes, not users

- Design tools based on nodes and triggers

- Users should be consistently educated

A well-designed tool should have:

* Quantifiable efficiency metrics

- Good information visualization and synchronization capabilities

- Good status visualization and synchronization capabilities

- Linear and well-defined usage processes

- Clear tool boundaries

# **Regarding methodology:**

## **The best tool is no tool**

* Using mature algorithms or programs to solve problems is often faster than humans. Exploring and devising solutions from a technical perspective and defining and pushing technical boundaries should be the main and primary point of entry, rather than designing solutions based on user/developer needs and experiences. Tools should minimize human intervention rather than adding to it. "Let's create a new platform to solve this problem" is always the simplest and most direct solution, but it is not always the best solution. Understanding the essence of the problem, defining the nature of the problem (product problem or process problem?), and the importance of the problem (important-urgent rule) are always the first things that product managers and designers should do.

In terms of execution:

* Another important role of product managers and designers must be users.

- Try to hire designers and products with technical expertise and a background in STEM.

- Subdivide responsibilities, with technical designers and product managers defining the product, and non-technical designers and product managers executing the design.

## **The product management/design for internal tools should only be guided by efficiency**

* Guided by efficiency: As mentioned earlier, the best tool should be no tool. Therefore, when there must be a tool, our direction should be to 1. Minimize the time the tool exists, and 2. Minimize the time users spend using the tool. The simplest way to measure this is through the efficiency with which users complete a task.

- Only guided by efficiency: During the product management and design of internal tools, there is always a lot of noise that can affect the judgment of the product manager/designer. For example, the tool's ease of use, existing user usage habits, the visual aesthetics of the tool, and the boss's whimsical ideas. Design and product managers need to focus, and the only effective way to guide product requirements and design is through efficiency, which is the most easily quantifiable/verifiable/falsifiable in these noises (agree).

In terms of execution:

* Clearly define the "overall-subdivision" definition of the current tool and process before beginning product management and design.

- Efficiency must be recorded and quantified as much as possible.

- Clearly define the check indicators and time points for periodic efficiency improvement.

Efficiency measurement:

* The time required for users to complete a unit task with the tool (the time humans operate the tool)

- The time required for users to communicate with humans to complete a unit task (the time spent communicating with other humans to complete a task)

- The troubleshooting time required for users to complete a unit task

- The machine time required for users to complete a unit task (the time required for the machine to process the task)

## **The design of internal tools should be top-down.**

* When talking about efficiency, it should always be the efficiency of the system, not the efficiency of a single tool. Even if Gaea Builder is amazing, if the map CI is slow, the efficiency of map publishing will still be low. To truly define and improve the efficiency of the system, it is necessary to 1) have a sufficient understanding of the system itself, and 2) define goals and milestones from top to bottom, define product boundaries and missions.

- The most common mistake that product managers/designers who are not familiar with the technical details of the system make is trying to improve efficiency based on the interface. "Improving efficiency based on the interface" means that the design/product team puts themselves in the same mental model as the users and tries to find problems with the product and process from the user's perspective. This approach can only create an ultimate tool, not ultimate efficiency. Researching users should be the last step in design and product management, and understanding and defining tool and process goals should be the first step.

- Addendum to the first point: The definition of each tool boundary is crucial for tools that form a toolchain. Due to the continuous improvement and change of technical capabilities, product management and tool design will always be dynamic. Specific functions must be added and managed based on clear boundary definitions.

In terms of execution:

* High-level planning of tools needs to be continuously defined and updated with TLMs.

- It is still necessary to hire product managers who understand technology.

- Product managers and designers must always stay closely connected to users and products.

- Continuous information synchronization and interviews.

- Continuous use and summary of products.

## **Look for pain points based on processes, not users.**

* Only by looking for pain points based on processes can we ensure 1) "top-down design" that is not affected by user perspectives, and 2) accurately grasp the boundaries of the tool.

- Looking for pain points based on users is always the most direct and easy way to summarize results. Designers and product managers are prone to dependence on this simple and effective method and give up thinking at the system level. After long-term product management of tools based on functionality, tools are prone to becoming a monolith because functionality cannot define product boundaries.

# **Design tools using the "node-trigger" method.**

* Internal tools with complex interfaces, such as HMI, are easy for product managers and designers to lose their direction and indulge in polishing many single functions. As mentioned earlier, the only goal of tools is to improve the efficiency of users completing tasks (broadly defined efficiency, rather than efficiency within the tool). A tool design model based on a defined process for moving forward will be necessary.

Node-trigger model:

* Assume that tasks throughout the process can be completed by machines.

- Define major nodes that can and cannot be completed by machines.

- Define nodes that must be intervened by humans.

- Define the interaction method for human intervention triggers.

The node and trigger method can ensure that 1) efficiency goals are always emphasized, 2) the user's usage process is always defined as linearly as possible, and 3) the information elements of a good tool are always considered as one of the highest priorities.

## **Continuously educate users.**

* The usage of internal tools should be actively and passively defined in order to reduce learning costs and minimize the possibility of errors.

- The product managers and designers of internal tools fulfill the responsibility of defining the user's method of use, especially for non-technical background users, such as TE and Triggers (Ant users). For these users, new design specifications and usage methods require continuous communication and education by the product team to ensure that users have sufficient awareness of the product and that their usage path is consistent with the design.

- For technically skilled users, such as algorithm developers (Rhino users), the difficulty of aligning design and user is transferred to changing the user's existing usage habits. Successful change in user habits often relies on product design consistency. On the one hand, the product and design team must have a sufficiently established design system support and convince users to try more efficient interaction methods. On the other hand, products and users need to establish sufficient trust to help execute the design. Both of these require education and communication with users to ensure execution.

## **Criteria for excellent tools:**

* Definition of tool boundaries.
  + The definition of tool boundaries relates to the completeness of the tool chain and the maintainability of the tool.

- In addition, as mentioned earlier, the ideal users of internal tools should have no users, followed by machines, and then interns. The meaning of interns is that the learning cost of any tool will be as low as possible. However, due to the nature of Tucson tools, the learning barrier of tools will always remain relatively high. A defined and simplified task chain that completes a single task is a way to continuously reduce barriers that can be defined and validated by the tool boundary's clear definition and necessary boundary adjustments.

# **Other random ideas:**

* For 2C products, retention is the key. The important feedback indicator for retention, or in other words, the amount of time a user spends using the product, is essential. In fact, all internet apps can be considered "tools," and no matter what problem they solve, whether it's a flashlight or solving physiological loneliness for users, the key is to keep users in the tool for as long as possible. The vision of internal tools is completely the opposite, but product managers and designers often forget this. In this case, a clearly defined methodology and goal are particularly important, and creativity and creativity are often not the highest priority in design.

* 2C products emphasize breakthroughs and using a single feature or community that solves pain points well, attracts users, and increases retention. Then, they use the user base to discover and solve more pain points.

* However, this is not entirely applicable to the design of internal tools and processes. The "pain points" of internal tools are not as important; the solution to the "pain surface," that is, the pain points of the entire process from start to finish, is more important.

- In addition, this "pain surface" is not aimed at "users" like 2C/2B products. The object of this "pain surface" is the output of the tool.

* After all, the internal tool is essentially about experience or performance, both of which are part of the experience.

- The 2C methodology of a single breakthrough is also the reason why I initially attempted a bottom-up approach to map planning, but now it is clear that it does not work. This is also the reason why the deck for map planning last October could not be written well.

* Improving the user experience of internal tools is a false proposition.
  + When we talk about user experience, we are actually discussing the difference between the predetermined user usage method and the actual usage method of uneducated users. For 2C products, this difference can only be achieved through intuitive product design, while for internal tools, this difference can be minimized through process management.

- So, is a simple and easy-to-use interface still necessary for internal tools? It is still necessary, but compared to external products, the threshold will be much lower. Internal tools should always focus on presenting information and system status clearly. Provide a non-intuitive interface to improve efficiency, not to please users.

- The biggest similarity between internal tools and 2C products is that both spend money to acquire users (acquiring new customers vs. hiring people to work). The difference is that for 2C products, whether the user stays or not is decided by the user, while for internal tools, whether the user stays or not is decided by the company. For internal tools, users are paid to use it, which means that ease of use should not be the highest priority even in terms of retention theory.

- User experience should always be a means, not the goal of product management.
