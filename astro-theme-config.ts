type NavItem = {
  label: string;
  href: string;
  /** Optional zh label; when set the header renders a toggle-aware pair. */
  labelZh?: string;
};

/**
 * astro-theme-config.ts
 *
 * Central configuration for the Tone theme.
 * Most site-level customization should happen in this file.
 */

const config = {
  site: {
    /** Production origin, used for canonical links, sitemap, and Open Graph metadata. */
    url: 'https://theneverless.com',
    /** Subpath such as '/repo-name'. Keep empty when deploying at a domain root. */
    base: '',
    lang: 'zh-CN',
    locale: 'zh_CN',
    dateLocale: 'zh-CN',
    title: 'NeVeRtheLeSs',
    logoLabel: 'NeVeRtheLeSs',
    description: '2005 年至今的个人博客 · personal blog since 2005',
    /** Language-specific descriptions shown on the homepage hero; they swap with the EN·中 toggle. */
    descriptionZh: '一些成果：常常随机，时而混乱，很少算得上完成。',
    descriptionEn: 'Some outcomes here: often random, sometimes chaotic, rarely ready.',
    author: 'NeVeRtheLeSs',
    /** Optional absolute or root-relative image URL for homepage/search/about social previews. */
    defaultOgImage: '/og.png',
  },

  // The logo already links to `/`. Add items here if you want visible header links.
  // Example: [{ label: 'Posts', href: '/posts' }, { label: 'About', href: '/about' }]
  nav: [
    { label: 'Posts', labelZh: '文章', href: '/posts' },
    { label: 'Notes', labelZh: '随记', href: '/notes' },
  ] as NavItem[],

  // Footer links stay visible by default so readers have a stable way to move around.
  footerNav: [
    { label: 'Posts', href: '/posts' },
    { label: 'About', href: '/about' },
    { label: 'Search', href: '/search' },
  ] as NavItem[],

  content: {
    categoryOrder: [
      'Journal',
      'Things',
      'Prodigal',
      'Words',
      'Repost',
      'Fiona',
    ],
    /**
     * Bilingual display names for post categories; they swap with the EN·中
     * toggle. Frontmatter keeps the raw key. Unmapped categories (e.g. Fiona)
     * show the raw key in both languages.
     */
    categoryLabels: {
      Words: { zh: '文字', en: 'Words' },
      Journal: { zh: '日志', en: 'Journal' },
      Repost: { zh: '转载', en: 'Repost' },
      Things: { zh: '东西', en: 'Things' },
      Prodigal: { zh: '败家', en: 'Splurges' },
    } as Record<string, { zh: string; en: string }>,
  },

  behavior: {
    smoothScroll: true,
  },

  comments: {
    // One-line switch after you fill the giscus values:
    // mode: 'off'           -> no comments
    // mode: 'giscus'        -> original giscus theme
    // mode: 'giscus-custom' -> Tone custom giscus theme
    // Local preview can also use PUBLIC_GISCUS_MODE and PUBLIC_GISCUS_* in .env.local.
    mode: 'giscus-custom',
    provider: 'giscus',
    giscus: {
      repo: 'emrickk/emrickk.github.io',
      repoId: 'R_kgDOTWatYA',
      category: 'Announcements',
      categoryId: 'DIC_kwDOTWatYM4DBD9Y',
      mapping: 'pathname',
      strict: '0',
      reactionsEnabled: '1',
      emitMetadata: '0',
      inputPosition: 'bottom',
      theme: 'preferred_color_scheme',
      customLightTheme: '/giscus-light.css',
      customDarkTheme: '/giscus-dark.css',
      lang: 'en',
      loading: 'eager',
    },
  },

  social: {
    website: '', // e.g. 'https://your-site.com'
    email: '', // e.g. 'hello@your-site.com'
    linkedin: '', // e.g. 'https://www.linkedin.com/in/yourhandle'
    github: '', // e.g. 'https://github.com/yourhandle'
  },

  about: {
    /** Profile image URL. Leave empty to use the text-only About layout. */
    profileImage: '',
    name: 'NeVeRtheLeSs',
    /** Every {zh, en} pair below swaps with the EN·中 toggle. */
    role: { zh: '懒癌晚期', en: 'Terminally lazy' },
    location: { zh: '地球某处', en: 'Somewhere on Earth' },
    focus: { zh: '生活、想法与碎碎念', en: 'Life, thoughts, and asides' },
    lead: {
      zh: '一个从 2005 年写到现在的个人博客。写了二十多年，内容却比你想象的少得多，所以其实也没那么深。',
      en: "Started in 2005, yet with far less here than you would expect from a blog past twenty. So, not that deep after all.",
    },
    headline: ['Still waters', 'run deep.'],
    statementLabel: { zh: '关于博客', en: 'About the Blog' },
    statementTitle: { zh: '写的东西其实不想被你看', en: 'Not really meant to be read' },
    statement: {
      zh: '这里没有固定的主题，只是我随手写下在想什么、在做什么，以及对生活的一些总结和反思。而且你从最新一篇文章大概也能看出来：取决于你来的时间，这个博客多半已经停更几个月了。',
      en: 'No fixed topics here. I just write down whatever I am thinking about, whatever I am doing, and the occasional summing-up or reflection on life. And as the latest post probably shows, depending on when you visit, this blog has most likely been on pause for a few months already.',
    },
    careerLabel: { zh: '关于我', en: 'About Me' },
    career: [
      {
        period: { zh: '2005', en: '2005' },
        title: { zh: '开始写博客', en: 'Started the blog' },
        description: {
          zh: '一切从这里开始。',
          en: 'Where all of this began.',
        },
      },
      {
        period: { zh: '2018', en: '2018' },
        title: { zh: '传送到地球另一端', en: 'Teleported across the Earth' },
        description: {
          zh: '把自己传送到了地球的另一边，落在一所叫 MIT 的大学。',
          en: 'Teleported myself to the other side of the Earth, landing at a university called MIT.',
        },
      },
      {
        period: { zh: '2026', en: '2026' },
        title: { zh: '为下一代造产品', en: 'Building for the next generation' },
        description: {
          zh: '在做一些为下一代准备的事：打造下一代的产品。',
          en: 'Doing something for the next generation: building next-generation products.',
        },
      },
    ],
    interests: [
      { zh: '把想说的话写下来，哪怕没人看', en: 'Writing down what I want to say, even if nobody reads it' },
      { zh: '慢慢写、慢慢更新的那点耐心', en: 'The patience to write slowly and update slowly' },
      { zh: '过去很多年里留下来的旧文字', en: 'Old words left behind from many years past' },
    ],
    interestsLabel: { zh: '关于', en: 'Notes' },
    interestsHeading: { zh: '这里都写些什么', en: 'What gets written here' },
  },
};

export default config;
