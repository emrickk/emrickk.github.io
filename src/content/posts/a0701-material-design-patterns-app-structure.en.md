---
translationKey: 'a0701-material-design-patterns-app-structure'
lang: 'en'
title: 'App Structure in Material Design'
---

This post is a translation of the App structure chapter in the Patterns section of Material Design. It doesn't carry over the corresponding images, so please head over to the original page to gawk at them yourself ([portal](https://www.google.com/design/spec/patterns/app-structure.html#app-structure-top-level-navigation-strategies))**Foreword: app structure**The content and tasks you want to show your users shape your app's structure. For example:

* A structure focused on a single task (a calculator or a game, say)
* A structure containing a navigation bar with limited functions (as opposed to the deep navigation of the next item) (a dialer app with contacts, say)
* A structure containing complex data browsing and deep navigation (an email app with folders, say)

*This post covers*

* *Start screen (not the welcome page) strategies*
* *Top-level navigation bar (presumably the navigation at the very top of the screen? top-level) strategies*
* *Combined-style navigation bar strategies*

 **Start screen**The start screen is the first thing users lay eyes on after opening the app, so it should be useful to new and old users alike. UX optimization should unfold around what a typical user would do.

* **Put content up front:** make content the main component of your start screen. Make it look nice, and make the layout responsive
* **Pin the navigation and action buttons:** consider using the APP BAR approach to present navigation controls, including Tab switching, search, and the like
* **Focus on functionality:** make the navigation pointing to important functions more prominent, and play down the less-used ones. Use flat responsive buttons to bring your app's main content forward

**Top-level navigation design strategies**Use top-level navigation to introduce your APP's most essential functions. Make it simple or make it complicated, as you see fit. **A few thoughts on embedded navigation**An app with a simple structure can use an embedded navigation to fit its content, though doing so also cuts into the display space available for content **The embedded navigation approach is recommended for:**

* Apps with a strong primary view and little content swapping
* Apps used to complete fairly consistent tasks
* Apps that don't see heavy use

**Tabs (TABS)**Tabs are meant for use between a small number of equally important views (view, which you could also translate as concept; take the gist). This thing can boost top-level navigation's presence in an APP with a shallow hierarchy or one without many functions. Tabs occupy a very prominent position, so we recommend keeping tab text relatively short. **This approach is recommended for:**

* Apps that switch views frequently
* Apps with a small number of top-level views
* Apps that need to push different views into the spotlight in turn

**Use on mobile**For apps with only one level of navigation, text tabs at the top will do. Three or four TABs at the absolute most, or else on small-screen devices users will have to scroll back and forth (scrooling) to switch to the tab they want. **Use on tablets and desktop**Not much use for it; to be filled in later (I suspect this will be left unfinished **Side navigation and drawer navigation**If you want to display a lot of navigation labels at once, you'll have to use side navigation. This thing may or may not be paired with a navigation drawer. The drawer, though, really is an efficient way to switch away from lower-level screens (the body of a news story, say). And it isn't the least bit annoying: it doesn't show up on screen unless you press it. Apps with only one home page should list the most frequently used navigation paths at the very top of the drawer, for the user's convenience **This approach is recommended for:**

* Apps with many top-level views
* Apps that need to jump quickly between unrelated views
* Apps with deep navigation structures
* Apps that don't want rarely visited pages hogging the spotlight

**Use on mobile and tablets**The navigation drawer is normally closed, and only opens temporarily when selected (meaning once you've picked, it tucks itself back away (as if that needed saying **Use on desktop devices**Not much use for it; to be filled in later (I suspect this will be left unfinished **Combined navigation bar strategies****In-context navigation***(In-context navigation; it really ought to mean navigation where "what you tap opens as a new page of content," or navigation linked to content. I don't know how to translate it)*When used together with tabs and drawer navigation, in-context navigation lets users move quickly within a set of related data (or images and such). Used for:

* Linking songs to an artist
* Moving around between recent items and history
* Linking a user's submissions (post) to their profile page

The up arrow is used to return to the previous level **Side navigation combined with tabs**Navigation with two levels can be presented by combining side navigation with tabs Illustration: [![patterns_navigation_threelevel1](https://cdn.anping.us/2020/02/patterns_navigation_threelevel1.webp)    ![patterns_navigation_threelevel2](https://cdn.anping.us/2020/02/patterns_navigation_threelevel2.webp)](https://cdn.anping.us/2020/02/patterns_navigation_threelevel1.webp) *The one on the left is In-context navigation, and at the top left of the right image is.. the up button ( up arrow )*
