type NavItem = {
  label: string;
  href: string;
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
    url: 'https://anping.us',
    /** Subpath such as '/repo-name'. Keep empty when deploying at a domain root. */
    base: '',
    lang: 'zh-CN',
    locale: 'zh_CN',
    dateLocale: 'zh-CN',
    title: 'NeVeRtheLeSs',
    logoLabel: 'NeVeRtheLeSs',
    description: '2005 年至今的个人博客 · personal blog since 2005',
    /** Language-specific descriptions shown on the homepage hero; they swap with the EN·中 toggle. */
    descriptionZh: '这里是思考的一些成果：不太丑、不太随机、也不太混乱。',
    descriptionEn: 'Here are some of the outcomes: not too ugly, not too random, not too chaotic.',
    author: 'NeVeRtheLeSs',
    /** Optional absolute or root-relative image URL for homepage/search/about social previews. */
    defaultOgImage: '/og.png',
  },

  // The logo already links to `/`. Add items here if you want visible header links.
  // Example: [{ label: 'Posts', href: '/posts' }, { label: 'About', href: '/about' }]
  nav: [] as NavItem[],

  // Footer links stay visible by default so readers have a stable way to move around.
  footerNav: [
    { label: 'Posts', href: '/posts' },
    { label: 'About', href: '/about' },
    { label: 'Search', href: '/search' },
  ] as NavItem[],

  content: {
    categoryOrder: [
      'Design',
      'Getting Started',
      'Markdown',
      'Open Source',
      'Systems',
      'Notes',
      'Research',
      'Performance',
      'MDX',
    ],
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
        period: { zh: '2005 至今', en: '2005 to now' },
        title: { zh: '一直在写', en: 'Still writing' },
        description: {
          zh: '从学生时代写到现在，断断续续，很多年了：博客还在，人也还在。',
          en: 'Writing since my student days, on and off, for many years now: the blog is still here, and so am I.',
        },
      },
      {
        period: { zh: '日常', en: 'Day to day' },
        title: { zh: '碎碎念', en: 'Asides' },
        description: {
          zh: '生活里随手记下的想法和琐事，没什么章法，也不追热点。',
          en: 'Thoughts and small things jotted down from everyday life, with no particular method and no chasing of trends.',
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
