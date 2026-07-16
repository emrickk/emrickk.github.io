const ui = {
  backLink: '← All Posts',
  readingTime: (n: number) => `${n} min read`,
  updated: 'Updated',
  relatedPosts: 'Related',
  allPosts: 'All Posts →',
  postNav: {
    label: 'Post navigation',
    older: '← Older',
    newer: 'Newer →',
  },
  postsEyebrow: 'Archive',
  postsTitle: 'All Posts',
  heroTitle: 'Keep thinking.',
  heroTitleLine2: '',
  viewAll: 'All Posts →',
  readLink: 'Read →',
  postFeed: {
    all: 'All',
    filterLabel: 'Filter posts by category',
    previousCategories: 'Scroll categories left',
    nextCategories: 'Scroll categories right',
    searchLabel: 'Search posts',
    empty: 'No posts match this filter.',
    more: 'Load more',
    read: 'Read',
  },
  notes: {
    eyebrow: 'Microblog',
    title: 'Notes',
    description: '2010 年至今的微博客存档 · microblog archive from X/Twitter',
    onX: 'on X',
    empty: 'No notes yet.',
  },
};

export function getUiText() {
  return ui;
}
