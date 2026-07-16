---
translationKey: 'revitalizing-360-mobile-security'
lang: 'zh'
title: '焕新360手机卫士：从工具到情感伙伴'
---

## 背景

360手机卫士是一款集杀毒、系统清理等功能于一体的应用。从2016年初到2017年底，它的日活跃用户下降了15%，第30日留存率下降了3%，主动启动率也下降了12%。要挽救这款产品，必须重新审视它的愿景、规划、功能与设计。

我是这个焕新项目的产品负责人。带着设计和开发团队，我们用5周时间完成了整个项目。

![](https://cdn.theneverless.com/2026/07/r360-vision-transition.webp)

## 准备就绪：项目排期

我们必须在45天内发布第一个测试版。一份周密的排期表对达成目标大有裨益。

<div style="overflow-x: auto; margin: var(--space-8) 0;">
<svg viewBox="0 0 1200 430" role="img" aria-label="项目排期甘特图，4月12日至5月27日：研究、设计、开发三条线并行推进，5月3日进入质量阶段，5月27日测试版发布。" style="font-family: var(--font-sans); display: block; width: 100%; min-width: 760px;">
<title>项目排期甘特图，4月12日至5月27日：研究、设计、开发三条线并行推进，5月3日进入质量阶段，5月27日测试版发布。</title>
<rect x="131" y="84" width="1063" height="290" fill="var(--fill-quaternary)"/>
<text x="171" y="48" text-anchor="middle"><tspan font-size="13" fill="var(--label-tertiary)">4月</tspan><tspan font-size="20" font-weight="600" fill="var(--label-secondary)">12日</tspan></text>
<text x="345" y="48" text-anchor="middle"><tspan font-size="13" fill="var(--label-tertiary)">4月</tspan><tspan font-size="20" font-weight="600" fill="var(--label-secondary)">15日</tspan></text>
<text x="528" y="48" text-anchor="middle"><tspan font-size="13" fill="var(--label-tertiary)">4月</tspan><tspan font-size="20" font-weight="600" fill="var(--label-secondary)">20日</tspan></text>
<text x="669" y="48" text-anchor="middle"><tspan font-size="13" fill="var(--label-tertiary)">4月</tspan><tspan font-size="20" font-weight="600" fill="var(--label-secondary)">22日</tspan></text>
<text x="879" y="48" text-anchor="middle"><tspan font-size="13" fill="var(--label-tertiary)">5月</tspan><tspan font-size="20" font-weight="600" fill="var(--label-secondary)">3日</tspan></text>
<text x="1113" y="48" text-anchor="middle"><tspan font-size="13" fill="var(--label-tertiary)">5月</tspan><tspan font-size="20" font-weight="600" fill="var(--label-secondary)">27日</tspan></text>
<text x="118" y="108" text-anchor="end" font-size="15" font-weight="600" fill="var(--label-primary)">研究</text>
<text x="118" y="192" text-anchor="end" font-size="15" font-weight="600" fill="var(--label-primary)">设计</text>
<text x="118" y="286" text-anchor="end" font-size="15" font-weight="600" fill="var(--label-primary)">开发</text>
<line x1="898" y1="84" x2="898" y2="374" stroke="rgba(235, 106, 97, 0.55)" stroke-width="1.5"/>
<line x1="1065" y1="84" x2="1065" y2="374" stroke="rgba(235, 106, 97, 0.55)" stroke-width="1.5"/>
<text x="888" y="108" text-anchor="end" font-size="15" font-weight="600" fill="var(--label-primary)">质量</text>
<text x="1194" y="398" text-anchor="end" font-size="15" font-weight="600" fill="var(--label-primary)">测试版发布</text>
<rect x="134" y="96" width="26" height="13" rx="6.5" fill="#7fd1dc" fill-opacity="0.65"/>
<text x="169" y="102.5" dominant-baseline="central" font-size="14" fill="var(--label-secondary)">启动与排期</text>
<rect x="162" y="129" width="141" height="13" rx="6.5" fill="#7fd1dc" fill-opacity="0.65"/>
<text x="312" y="135.5" dominant-baseline="central" font-size="14" fill="var(--label-secondary)">现状调研</text>
<rect x="354" y="96" width="180" height="13" rx="6.5" fill="#7fd1dc" fill-opacity="0.65"/>
<text x="543" y="102.5" dominant-baseline="central" font-size="14" fill="var(--label-secondary)">用户研究</text>
<rect x="507" y="129" width="93" height="13" rx="6.5" fill="#7fd1dc" fill-opacity="0.65"/>
<text x="609" y="135.5" dominant-baseline="central" font-size="14" fill="var(--label-secondary)">市场研究</text>
<rect x="963" y="96" width="99" height="13" rx="6.5" fill="#7fd1dc" fill-opacity="0.65"/>
<text x="1071" y="102.5" dominant-baseline="central" font-size="14" fill="var(--label-secondary)">QA</text>
<rect x="540" y="182" width="99" height="13" rx="6.5" fill="#7fd1dc" fill-opacity="0.65"/>
<text x="589.5" y="172" text-anchor="middle" font-size="14" fill="var(--label-secondary)">分析与愿景</text>
<rect x="654" y="182" width="330" height="13" rx="6.5" fill="#7fd1dc" fill-opacity="0.65"/>
<text x="993" y="188.5" dominant-baseline="central" font-size="14" fill="var(--label-secondary)">交互 / 逻辑设计</text>
<rect x="303" y="216" width="108" height="13" rx="6.5" fill="#7fd1dc" fill-opacity="0.65"/>
<text x="420" y="222.5" dominant-baseline="central" font-size="14" fill="var(--label-secondary)">旧版设计回顾</text>
<rect x="633" y="216" width="279" height="13" rx="6.5" fill="#7fd1dc" fill-opacity="0.65"/>
<text x="921" y="222.5" dominant-baseline="central" font-size="14" fill="var(--label-secondary)">原型与迭代</text>
<rect x="393" y="269" width="150" height="13" rx="6.5" fill="#7fd1dc" fill-opacity="0.65"/>
<text x="468" y="259" text-anchor="middle" font-size="14" fill="var(--label-secondary)">技术预研</text>
<rect x="675" y="269" width="369" height="13" rx="6.5" fill="#7fd1dc" fill-opacity="0.65"/>
<text x="1053" y="275.5" dominant-baseline="central" font-size="14" fill="var(--label-secondary)">界面开发</text>
<rect x="552" y="299" width="366" height="13" rx="6.5" fill="#7fd1dc" fill-opacity="0.65"/>
<text x="927" y="305.5" dominant-baseline="central" font-size="14" fill="var(--label-secondary)">服务端开发</text>
<rect x="411" y="329" width="339" height="13" rx="6.5" fill="#7fd1dc" fill-opacity="0.65"/>
<text x="759" y="335.5" dominant-baseline="central" font-size="14" fill="var(--label-secondary)">性能开发</text>
</svg>
</div>

## 深入数据：发现现存问题

同期群分析是我们研究的核心。我们拥有相对完善的数据收集体系，而通过用户数据来评估用户与应用的交互方式，是发现问题、确定后续研究方向的最佳方法之一。

<div style="overflow-x: auto; margin: var(--space-8) 0;">
<svg viewBox="0 0 1200 585" role="img" aria-label="堆叠柱状图，每周用户构成：新用户占比从10月第一周的59%降至3月第一周的29%，跨周连续活跃用户占比上升。" style="font-family: var(--font-sans); display: block; width: 100%; min-width: 720px;">
<title>堆叠柱状图，每周用户构成：新用户占比从10月第一周的59%降至3月第一周的29%，跨周连续活跃用户占比上升。</title>
<text x="1180" y="34" text-anchor="end" font-size="20" fill="var(--label-secondary)">每周用户构成</text>
<line x1="95" y1="470" x2="1180" y2="470" stroke="var(--separator)" stroke-width="1"/>
<text x="85" y="475" text-anchor="end" font-size="14" fill="var(--label-tertiary)">0%</text>
<line x1="95" y1="370" x2="1180" y2="370" stroke="var(--separator)" stroke-width="1"/>
<text x="85" y="375" text-anchor="end" font-size="14" fill="var(--label-tertiary)">25%</text>
<line x1="95" y1="270" x2="1180" y2="270" stroke="var(--separator)" stroke-width="1"/>
<text x="85" y="275" text-anchor="end" font-size="14" fill="var(--label-tertiary)">50%</text>
<line x1="95" y1="170" x2="1180" y2="170" stroke="var(--separator)" stroke-width="1"/>
<text x="85" y="175" text-anchor="end" font-size="14" fill="var(--label-tertiary)">75%</text>
<line x1="95" y1="70" x2="1180" y2="70" stroke="var(--separator)" stroke-width="1"/>
<text x="85" y="75" text-anchor="end" font-size="14" fill="var(--label-tertiary)">100%</text>
<rect x="153.4" y="464.8" width="64" height="5.2" fill="#d04040"/>
<rect x="153.4" y="435.2" width="64" height="29.6" fill="#de5b3d"/>
<rect x="153.4" y="402.8" width="64" height="32.4" fill="#ec7940"/>
<rect x="153.4" y="311.6" width="64" height="91.2" fill="#f0934d"/>
<rect x="153.4" y="305.6" width="64" height="6.0" fill="#f3b465"/>
<rect x="153.4" y="70.0" width="64" height="235.6" fill="#f7d373"/>
<text x="185.4" y="496" text-anchor="middle" font-size="14" font-style="italic" fill="var(--label-secondary)">10月第一周</text>
<rect x="334.3" y="450.0" width="64" height="20.0" fill="#d04040"/>
<rect x="334.3" y="417.6" width="64" height="32.4" fill="#de5b3d"/>
<rect x="334.3" y="379.2" width="64" height="38.4" fill="#ec7940"/>
<rect x="334.3" y="332.0" width="64" height="47.2" fill="#f0934d"/>
<rect x="334.3" y="305.6" width="64" height="26.4" fill="#f3b465"/>
<rect x="334.3" y="70.0" width="64" height="235.6" fill="#f7d373"/>
<text x="366.3" y="496" text-anchor="middle" font-size="14" font-style="italic" fill="var(--label-secondary)">11月第一周</text>
<rect x="515.1" y="447.2" width="64" height="22.8" fill="#d04040"/>
<rect x="515.1" y="432.4" width="64" height="14.8" fill="#de5b3d"/>
<rect x="515.1" y="417.6" width="64" height="14.8" fill="#ec7940"/>
<rect x="515.1" y="332.0" width="64" height="85.6" fill="#f0934d"/>
<rect x="515.1" y="267.2" width="64" height="64.8" fill="#f3b465"/>
<rect x="515.1" y="70.0" width="64" height="197.2" fill="#f7d373"/>
<text x="547.1" y="496" text-anchor="middle" font-size="14" font-style="italic" fill="var(--label-secondary)">12月第一周</text>
<rect x="695.9" y="447.2" width="64" height="22.8" fill="#d04040"/>
<rect x="695.9" y="438.4" width="64" height="8.8" fill="#de5b3d"/>
<rect x="695.9" y="412.0" width="64" height="26.4" fill="#ec7940"/>
<rect x="695.9" y="300.0" width="64" height="112.0" fill="#f0934d"/>
<rect x="695.9" y="244.0" width="64" height="56.0" fill="#f3b465"/>
<rect x="695.9" y="70.0" width="64" height="174.0" fill="#f7d373"/>
<text x="727.9" y="496" text-anchor="middle" font-size="14" font-style="italic" fill="var(--label-secondary)">1月第一周</text>
<rect x="876.8" y="429.2" width="64" height="40.8" fill="#d04040"/>
<rect x="876.8" y="367.2" width="64" height="62.0" fill="#de5b3d"/>
<rect x="876.8" y="337.6" width="64" height="29.6" fill="#ec7940"/>
<rect x="876.8" y="231.6" width="64" height="106.0" fill="#f0934d"/>
<rect x="876.8" y="205.2" width="64" height="26.4" fill="#f3b465"/>
<rect x="876.8" y="70.0" width="64" height="135.2" fill="#f7d373"/>
<text x="908.8" y="496" text-anchor="middle" font-size="14" font-style="italic" fill="var(--label-secondary)">2月第一周</text>
<rect x="1057.6" y="405.6" width="64" height="64.4" fill="#d04040"/>
<rect x="1057.6" y="379.2" width="64" height="26.4" fill="#de5b3d"/>
<rect x="1057.6" y="326.0" width="64" height="53.2" fill="#ec7940"/>
<rect x="1057.6" y="222.8" width="64" height="103.2" fill="#f0934d"/>
<rect x="1057.6" y="187.6" width="64" height="35.2" fill="#f3b465"/>
<rect x="1057.6" y="70.0" width="64" height="117.6" fill="#f7d373"/>
<text x="1089.6" y="496" text-anchor="middle" font-size="14" font-style="italic" fill="var(--label-secondary)">3月第一周</text>
<rect x="110" y="512" width="16" height="16" fill="#f7d373"/>
<text x="132" y="525" font-size="14" font-style="italic" fill="var(--label-secondary)">新用户</text>
<rect x="207" y="512" width="16" height="16" fill="#f3b465"/>
<text x="229" y="525" font-size="14" font-style="italic" fill="var(--label-secondary)">昨日用户</text>
<rect x="319" y="512" width="16" height="16" fill="#f0934d"/>
<text x="341" y="525" font-size="14" font-style="italic" fill="var(--label-secondary)">本周回流用户</text>
<rect x="110" y="545" width="16" height="16" fill="#ec7940"/>
<rect x="132" y="545" width="16" height="16" fill="#de5b3d"/>
<rect x="154" y="545" width="16" height="16" fill="#d04040"/>
<text x="182" y="558" font-size="14" font-style="italic" fill="var(--label-secondary)">跨周连续活跃用户</text>
<text x="1180" y="525" text-anchor="end" font-size="14" font-style="italic" fill="var(--label-tertiary)">*每周新增用户的绝对数量保持稳定</text>
</svg>
</div>

- 新用户占比低于预期。新用户比例的下行趋势说明，新用户对初始功能的满意率正在下降。
- 功能使用频率偏低也是一个可能的原因，它会导致两周和四周的存续用户占比偏低、回流用户占比偏高。

![](https://cdn.theneverless.com/2026/07/r360-freshness-degree.webp)

- 我们借助用户新鲜度指标做了更深入的研究。第30日新鲜度用户比例保持平稳，说明大多数活跃用户对我们的产品是满意的。
- 相比第1日，第2日的新鲜度用户比例出现骤降，但第4日及之后的数据相对平稳。我们推测，是不友好的功能引导把新用户劝退了。

![](https://cdn.theneverless.com/2026/07/r360-user-access-pattern.webp)

用户访问路径中第2步到第3步的急剧下滑，进一步验证了我们的假设。

大多数功能需要点击3次以上才能到达，这让产品的学习成本变得很高，把新用户吓跑了。而两次点击之后用户的转化率是缓慢下降的，说明这些用户清楚自己在做什么，也愿意继续操作。

## 用户研究：从情感层面理解用户

在这个阶段的用户研究中，除了数据，我们更关注用户的使用场景，比如他们的使用习惯、遇到的问题以及情绪反馈。同时，我们也希望从用户那里收集更多的想法。

![](https://cdn.theneverless.com/2026/07/r360-research-methods.webp)

我们把用户研究与用户数据加以综合，提炼出四个直指问题核心的洞察。这些洞察帮助我们修正了假设，明确了解决方案需要瞄准的具体方向和问题。

![](https://cdn.theneverless.com/2026/07/r360-four-insights.webp)

- 一些用户不知道什么时候、该怎么使用360手机卫士。
- 当某个功能正是用户装机的理由时，它出问题会让用户格外恼火。
- 用户安装360手机卫士后，手机出现了卡顿。
- 一些用户抱怨产品缺少他们想要的功能，或竞品已有的功能。

故障和性能问题会影响留存率，而这类问题只需我们向研发和测试团队描述清楚具体情况，不需要改动逻辑和界面就能修复（我们把这些问题列为最高优先级）。产品经理则继续向前，去寻找更多问题和新的改进点。

## 市场研究：从市场中获取灵感

### 竞品分析

我们分析了主要竞争对手，梳理出它们的优势与短板，并格外留意那些我们产品尚且缺失的新功能和新体验。

![](https://cdn.theneverless.com/2026/07/r360-competitor-analysis.webp)

### 行业分析

在研读了艾瑞、QuestMobile、易观和TalkingData发布的报告后，我们对当前的市场格局和用户需求有了新的认识。

<div style="display: flex; flex-wrap: wrap; gap: var(--space-4); margin: var(--space-8) 0;">
<div style="flex: 1 1 280px; background: var(--fill-tertiary); border-radius: var(--radius-lg); padding: var(--space-4) var(--space-5);"><div style="font-weight: var(--weight-semibold); font-size: var(--text-subheadline); color: var(--color-accent); margin-bottom: var(--space-2);">iResearch 艾瑞</div><div style="font-size: var(--text-callout); line-height: var(--leading-relaxed); color: var(--label-secondary);">用 <em>Apple HIG</em> 来设计 Android 应用，比使用 <em>MD 规范</em>更加流行。</div></div>
<div style="flex: 1 1 280px; background: var(--fill-tertiary); border-radius: var(--radius-lg); padding: var(--space-4) var(--space-5);"><div style="font-weight: var(--weight-semibold); font-size: var(--text-subheadline); color: var(--color-accent); margin-bottom: var(--space-2);">QuestMobile</div><div style="font-size: var(--text-callout); line-height: var(--leading-relaxed); color: var(--label-secondary);">系统级的用户需求正在快速衰减。用户比以往更关注内容，也更不愿意去思考功能的逻辑。</div></div>
<div style="flex: 1 1 280px; background: var(--fill-tertiary); border-radius: var(--radius-lg); padding: var(--space-4) var(--space-5);"><div style="font-weight: var(--weight-semibold); font-size: var(--text-subheadline); color: var(--color-accent); margin-bottom: var(--space-2);">TalkingData</div><div style="font-size: var(--text-callout); line-height: var(--leading-relaxed); color: var(--label-secondary);">4G 网络的普及与多样化的流量套餐，让用户越来越有必要关注流量管理。设备平均性能的提升，也让常驻在线的功能成为可能。</div></div>
<div style="flex: 1 1 280px; background: var(--fill-tertiary); border-radius: var(--radius-lg); padding: var(--space-4) var(--space-5);"><div style="font-weight: var(--weight-semibold); font-size: var(--text-subheadline); color: var(--color-accent); margin-bottom: var(--space-2);">易观 Analysys</div><div style="font-size: var(--text-callout); line-height: var(--leading-relaxed); color: var(--label-secondary);">年轻人更愿意使用腾讯手机管家，或者干脆不使用手机安全类应用，而不是选择 360 手机卫士。</div></div>
</div>

## 分析与愿景：让解决方案与创新想法相结合

我们把用户情感与潜在需求结合起来，修订了现有功能。研究过程中不断涌现的新想法，也为新版本指明了方向。

![](https://cdn.theneverless.com/2026/07/r360-true-needs.webp)

## 原型与可用性测试：我们和用户看到的是同一个产品吗？

我们重新设计了应用结构，把功能层级变得更扁平，为新用户提供更清晰、更友好的设计。

我们绘制了中保真原型，并在每次迭代后进行可用性测试，主要用热点图和路径图来评估设计。第八轮迭代的原型如下。

![](https://cdn.theneverless.com/2026/07/r360-prototypes.webp)

在第八轮可用性测试中：

- 81%的用户直接找到了想要的功能，而不再需要花时间寻找。
- 需要3次以上点击才能到达功能的比例从22%降到了6%。
- 主页跳出率从32%降到了17%。

随后，我们完成了高保真设计稿，并交付给开发团队。

## 设计：把想法变成现实

### 给主页一个信息流

我们把主页重新设计成瀑布流式，让年轻用户能更自在地探索新功能和手机状态。

![](https://cdn.theneverless.com/2026/07/r360-mainpage-feed.webp)

_7.0版本的主页信息流。_

**图形化：** 我们删掉了所有多余的文案，把图标重新设计得更简练，目的是让用户想去的地方一目了然。

**聚焦：** 我们重新组织了功能结构，给主要功能留出更多空间，同时强化品牌形象的感知。

结构上的修订让功能更加触手可及。

![](https://cdn.theneverless.com/2026/07/r360-old-version.webp)

_6.x旧版本的功能入口。_

![](https://cdn.theneverless.com/2026/07/r360-new-mainpage.webp)

_7.0版本主页上的新功能页签。_

### 为年轻用户准备的皮肤

![](https://cdn.theneverless.com/2026/07/r360-skins.webp)

我们不仅在设计上体现明快，也把这种明快带进了功能：我们让功能变得可定制。

![](https://cdn.theneverless.com/2026/07/r360-toolbox.webp)

同时，我们重新定义了所提供的功能，把自己定位成一位真诚的朋友和手机管家。

- 用户可以在工具箱里定制自己想要的功能。
- 系统会根据用户标签和操作行为，推荐合适的功能。
- 而在6.x版本中，功能都藏在抽屉菜单里，且无法更改。

![](https://cdn.theneverless.com/2026/07/r360-freshness-push.webp)

配合实时检测和推送系统，用户再也不用操心什么时候清理手机、检查软件更新，或者处理其他烦人的琐事。

我们的一大优势在于，应用里深度集成了许多来自其他部门的安全能力，这一点远超其他同类应用。

## 数据表现：评估产品的终极方式

测试版上线后，我们每周分析一次数据表现。五周之后……

<div style="display: flex; flex-direction: column; gap: var(--space-4); margin: var(--space-8) 0;">
<div style="background: var(--fill-quaternary); border-radius: var(--radius-xl); padding: var(--space-5) var(--space-6);"><div style="margin: 0 0 var(--space-3); font-size: var(--text-title-3); font-weight: var(--weight-bold); color: var(--label-primary);">DAU / 回流用户改善</div><div style="font-size: var(--text-headline); font-style: italic; color: var(--label-secondary); margin: var(--space-1) 0;">回流用户占比<strong>提升 11%</strong></div><div style="font-size: var(--text-headline); font-style: italic; color: var(--label-secondary); margin: var(--space-1) 0;">DAU 由下滑 15% 转为<strong>增长 1.1%</strong></div></div>
<div style="background: var(--fill-quaternary); border-radius: var(--radius-xl); padding: var(--space-5) var(--space-6);"><div style="margin: 0 0 var(--space-3); font-size: var(--text-title-3); font-weight: var(--weight-bold); color: var(--label-primary);">留存改善</div><div style="overflow-x: auto;"><svg viewBox="0 0 1080 350" role="img" aria-label="分组柱状图，留存改善：次日留存 7.0 Beta 版 39.1%，6.x 版 33.9%，行业平均 30.0%；7日留存 18.1%、13.7%、11.0%；30日留存 8.9%、5.0%、5.5%。" style="font-family: var(--font-sans); display: block; width: 100%; min-width: 620px;">
<title>分组柱状图，留存改善：次日留存 7.0 Beta 版 39.1%，6.x 版 33.9%，行业平均 30.0%；7日留存 18.1%、13.7%、11.0%；30日留存 8.9%、5.0%、5.5%。</title>
<line x1="40" y1="300" x2="1040" y2="300" stroke="var(--separator)" stroke-width="1.5"/>
<rect x="129.7" y="58.0" width="46" height="242.0" fill="#01b1c0"/>
<text x="152.7" y="48.0" text-anchor="middle" font-size="15" fill="var(--label-secondary)">39.1%</text>
<rect x="183.7" y="90.1" width="46" height="209.9" fill="#e3573c"/>
<text x="206.7" y="80.1" text-anchor="middle" font-size="15" fill="var(--label-secondary)">33.9%</text>
<rect x="237.7" y="114.3" width="46" height="185.7" fill="#ffa600"/>
<text x="260.7" y="104.3" text-anchor="middle" font-size="15" fill="var(--label-secondary)">30.0%</text>
<text x="206.7" y="328" text-anchor="middle" font-size="15" fill="var(--label-secondary)">次日留存</text>
<rect x="463.0" y="188.0" width="46" height="112.0" fill="#01b1c0"/>
<text x="486.0" y="178.0" text-anchor="middle" font-size="15" fill="var(--label-secondary)">18.1%</text>
<rect x="517.0" y="215.2" width="46" height="84.8" fill="#e3573c"/>
<text x="540.0" y="205.2" text-anchor="middle" font-size="15" fill="var(--label-secondary)">13.7%</text>
<rect x="571.0" y="231.9" width="46" height="68.1" fill="#ffa600"/>
<text x="594.0" y="221.9" text-anchor="middle" font-size="15" fill="var(--label-secondary)">11.0%</text>
<text x="540.0" y="328" text-anchor="middle" font-size="15" fill="var(--label-secondary)">7日留存</text>
<rect x="796.3" y="244.9" width="46" height="55.1" fill="#01b1c0"/>
<text x="819.3" y="234.9" text-anchor="middle" font-size="15" fill="var(--label-secondary)">8.9%</text>
<rect x="850.3" y="269.0" width="46" height="31.0" fill="#e3573c"/>
<text x="873.3" y="259.0" text-anchor="middle" font-size="15" fill="var(--label-secondary)">5.0%</text>
<rect x="904.3" y="266.0" width="46" height="34.0" fill="#ffa600"/>
<text x="927.3" y="256.0" text-anchor="middle" font-size="15" fill="var(--label-secondary)">5.5%</text>
<text x="873.3" y="328" text-anchor="middle" font-size="15" fill="var(--label-secondary)">30日留存</text>
</svg></div><div style="margin-top: var(--space-2);"><span style="display: inline-flex; align-items: center; gap: 6px; margin-right: var(--space-4); font-size: var(--text-footnote); color: var(--label-secondary);"><span style="width: 11px; height: 11px; border-radius: 50%; background: #01b1c0; display: inline-block;"></span>7.0 Beta 版留存率</span><span style="display: inline-flex; align-items: center; gap: 6px; margin-right: var(--space-4); font-size: var(--text-footnote); color: var(--label-secondary);"><span style="width: 11px; height: 11px; border-radius: 50%; background: #e3573c; display: inline-block;"></span>6.x 版留存率</span><span style="display: inline-flex; align-items: center; gap: 6px; margin-right: var(--space-4); font-size: var(--text-footnote); color: var(--label-secondary);"><span style="width: 11px; height: 11px; border-radius: 50%; background: #ffa600; display: inline-block;"></span>行业平均</span></div></div>
<div style="background: var(--fill-quaternary); border-radius: var(--radius-xl); padding: var(--space-5) var(--space-6);"><div style="margin: 0 0 var(--space-3); font-size: var(--text-title-3); font-weight: var(--weight-bold); color: var(--label-primary);">用户积极行为改善</div><div style="display: flex; flex-wrap: wrap; gap: var(--space-4); margin-bottom: var(--space-4);">
<div style="flex: 1 1 220px;"><span style="font-size: 1.9rem; font-weight: var(--weight-bold); color: var(--label-primary);">4.1</span> <span style="font-size: var(--text-headline); color: var(--label-primary);">个活跃功能</span><div style="font-size: var(--text-footnote); font-style: italic; color: var(--label-tertiary); margin-top: 2px;">7.0 Beta 版人均功能使用</div></div>
<div style="flex: 1 1 220px;"><span style="font-size: 1.9rem; font-weight: var(--weight-bold); color: var(--label-primary);">2.9</span> <span style="font-size: var(--text-headline); color: var(--label-primary);">个活跃功能</span><div style="font-size: var(--text-footnote); font-style: italic; color: var(--label-tertiary); margin-top: 2px;">6.x 版人均功能使用</div></div>
</div><svg viewBox="0 0 460 230" role="img" aria-label="柱状对比图，功能使用频次改善：改版前每天 2.6 次，改版后每天 3.9 次。" style="font-family: var(--font-sans); display: block; width: 100%; max-width: 340px;">
<title>柱状对比图，功能使用频次改善：改版前每天 2.6 次，改版后每天 3.9 次。</title>
<line x1="20" y1="190" x2="440" y2="190" stroke="var(--separator)" stroke-width="1.5"/>
<rect x="130" y="97.1" width="64" height="92.9" fill="#ffa600"/>
<text x="162" y="69.1" text-anchor="middle" font-size="17" font-weight="600" font-style="italic" fill="var(--label-primary)">改版前</text>
<text x="162" y="87.1" text-anchor="middle" font-size="14" font-style="italic" fill="var(--label-secondary)">2.6 次/天</text>
<rect x="280" y="50.7" width="64" height="139.3" fill="#e3573c"/>
<text x="312" y="22.7" text-anchor="middle" font-size="17" font-weight="600" font-style="italic" fill="var(--label-primary)">改版后</text>
<text x="312" y="40.7" text-anchor="middle" font-size="14" font-style="italic" fill="var(--label-secondary)">3.9 次/天</text>
</svg><div style="text-align: center; font-size: var(--text-subheadline); font-weight: var(--weight-semibold); color: var(--label-primary); margin-top: var(--space-1);">功能使用频次改善</div></div>
</div>

我们成功止住了日活跃用户的下滑，DAU甚至比原先增长了3.1%。

最终，第30日留存率也提升了3.9%，这意味着有三百万名用户在30天后仍把360手机卫士留在手机里。

![](https://cdn.theneverless.com/2026/07/r360-the-end.webp)

欢迎用安卓手机[点击这里](http://msoftdl.360.cn/mobile/shouji360/360safesis/360MobileSafe_7.7.4.1038.apk)体验360手机卫士7.x！
