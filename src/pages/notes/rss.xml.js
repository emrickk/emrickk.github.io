import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE_LANG, SITE_TITLE } from '../../consts';
import { withBase } from '../../utils/paths';

const MENTION_LINK_RE = /\[(@[^\]]+)\]\([^)]+\)/g;
const MD_UNESCAPE_RE = /\\([\\`*_[\]<>~|#+.-])/g;

// Undo the importer's mechanical markdown: mention links reduced to their
// handles, punctuation escapes removed.
function cleanText(text) {
  return text.replace(MENTION_LINK_RE, '$1').replace(MD_UNESCAPE_RE, '$1');
}

// Notes have no titles: use the first text line (cleaned) truncated to about
// 60 characters, or the date for media-only notes. The truncation counts
// code points, not UTF-16 units, so an emoji at the boundary stays whole.
export function itemTitle(note) {
  const firstLine = (note.body ?? '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('!['));
  if (!firstLine) return note.data.date.toISOString().slice(0, 10);
  const plain = cleanText(firstLine);
  const chars = Array.from(plain);
  return chars.length > 60 ? `${chars.slice(0, 59).join('')}…` : plain;
}

// Feed readers get plain text, not raw markdown: image lines dropped,
// mention links and escapes cleaned like the title.
export function itemDescription(note) {
  const lines = (note.body ?? '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('!['));
  return cleanText(lines.join('\n')).trim();
}

export async function GET(context) {
  const notes = (await getCollection('notes'))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .slice(0, 20);

  return rss({
    title: `${SITE_TITLE} · Notes`,
    description: 'Microblog archive from X/Twitter',
    site: new URL(withBase('/notes/'), context.site),
    customData: `<language>${SITE_LANG}</language>`,
    // Item links are fragments on the timeline page; without this the rss
    // package appends a slash after the fragment and the anchor never
    // matches. The slash the site convention wants sits before the '#'.
    trailingSlash: false,
    items: notes.map((note) => ({
      title: itemTitle(note),
      description: itemDescription(note),
      pubDate: note.data.date,
      link: withBase(`/notes/#${note.data.tweetId}`),
    })),
  });
}
