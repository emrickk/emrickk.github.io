import { getCollection, type CollectionEntry } from 'astro:content';

export type Lang = 'zh' | 'en';

/** The title to show for a given language, falling back to the original `title`. */
export function pickTitle(
  data: { title: string; titleZh?: string; titleEn?: string },
  lang: Lang
): string {
  return lang === 'en' ? (data.titleEn ?? data.title) : (data.titleZh ?? data.title);
}

/**
 * Map of `${translationKey}:${lang}` -> sibling translation entry, used to
 * find the non-original-language body for a post.
 */
export async function buildTranslationMap(): Promise<
  Map<string, CollectionEntry<'translations'>>
> {
  const entries = await getCollection('translations');
  const map = new Map<string, CollectionEntry<'translations'>>();
  for (const e of entries) {
    map.set(`${e.data.translationKey}:${e.data.lang}`, e);
  }
  return map;
}
