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
    descriptionZh: '2005 年至今的个人博客',
    descriptionEn: 'Personal blog since 2005',
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
    role: '懒癌晚期 · terminally lazy',
    location: '互联网某处 · Somewhere online',
    focus: '生活、想法与碎碎念 · life, thoughts, and asides',
    lead: '一个从 2005 年断断续续写到现在的个人博客。写的东西其实不想被你看，但既然来了 —— still waters run deep。',
    headline: ['Still waters', 'run deep.'],
    statementLabel: '关于博客 · About',
    statementTitle: '写的东西其实不想被你看',
    statement:
      '这里是 NeVeRtheLeSs，一个从 2005 年写到现在的个人博客。没什么正经主题，随手记下生活、想法和一些碎碎念。断更是常态（懒癌晚期），但一直没舍得删。',
    careerLabel: '关于我 · About Me',
    career: [
      {
        period: '2005 至今',
        title: '一直在写 · Still writing',
        description:
          '从学生时代写到现在，断断续续，很多年了 —— 博客还在，人也还在。',
      },
      {
        period: '日常',
        title: '碎碎念 · Notes',
        description:
          '生活里随手记下的想法和琐事，没什么章法，也不追热点。',
      },
    ],
    interests: [
      '把想说的话写下来，哪怕没人看',
      '慢慢写、慢慢更新的那点耐心',
      '过去很多年里留下来的旧文字',
    ],
    interestsLabel: '关于 · Notes',
    interestsHeading: '这里都写些什么',
  },
};

export default config;
