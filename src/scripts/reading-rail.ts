import { mountTocRail, type TocRailInstance } from 'toc-rail';

let rail: TocRailInstance | null = null;
let isBound = false;
let langObserverBound = false;

// Bilingual posts render both language bodies inside #prose-content; the rail
// must only list headings from the body the EN·中 toggle is showing.
function activeLang(prose: HTMLElement): 'zh' | 'en' | null {
  const l = document.documentElement.getAttribute('data-lang');
  if (l === 'zh' || l === 'en') return l;
  const orig = prose.querySelector(':scope > div.lang[data-orig]');
  if (orig) return orig.classList.contains('lang-zh') ? 'zh' : 'en';
  return null;
}

export function initReadingRail() {
  rail?.unmount();
  rail = null;

  const prose = document.querySelector<HTMLElement>('#prose-content');
  if (!prose) return;

  const hasDualBody = prose.querySelector(':scope > div.lang') !== null;
  let headings = '#prose-content h2[id], #prose-content h3[id]';
  if (hasDualBody) {
    const lang = activeLang(prose) ?? 'zh';
    headings = `#prose-content div.lang-${lang} h2[id], #prose-content div.lang-${lang} h3[id]`;
  }

  const activeOffset = Math.round(window.innerHeight * 0.5);

  rail = mountTocRail({
    content: prose,
    headings,
    title: false,
    ariaLabel: 'Post outline',
    progressMode: 'content',
    activeBoundary: 'viewport-end',
    activeOffset,
    edge: {
      afterBoundary: 'viewport-end',
      afterOffset: 120,
    },
    minWidth: 1220,
    topOffset: 52,
  });

  if (hasDualBody && !langObserverBound) {
    langObserverBound = true;
    new MutationObserver(() => initReadingRail()).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-lang'],
    });
  }
}

export function mountReadingRailForPosts() {
  if (isBound) {
    initReadingRail();
    return;
  }

  isBound = true;
  initReadingRail();
}
