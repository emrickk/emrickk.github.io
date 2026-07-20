import { getCollection, type CollectionEntry } from 'astro:content';

export type Lang = 'zh' | 'en';

/** Per-language display text for a post, resolved by `resolveLangText`. */
export interface LangText {
  titleZh?: string;
  titleEn?: string;
  descriptionZh?: string;
  descriptionEn?: string;
}

/**
 * Map of `${translationKey}:${lang}` -> sibling translation entry, used to
 * find the non-original-language body and display text for a post.
 */
export async function buildTranslationMap(): Promise<Map<string, CollectionEntry<'translations'>>> {
  const entries = await getCollection('translations');
  const map = new Map<string, CollectionEntry<'translations'>>();
  for (const e of entries) {
    map.set(`${e.data.translationKey}:${e.data.lang}`, e);
  }
  return map;
}

/**
 * Resolve the zh/en display text for a post. The post's own language comes
 * from its `title`/`description`; the other language from the sibling
 * translation's frontmatter. Missing values stay undefined so callers keep
 * their `fallback` behavior (LangTitle falls back to the primary title).
 */
export function resolveLangText(
  data: { title: string; description?: string; lang?: Lang; translationKey?: string },
  tmap: Map<string, CollectionEntry<'translations'>>
): LangText {
  const orig: Lang = data.lang ?? 'zh';
  const other: Lang = orig === 'zh' ? 'en' : 'zh';
  const sibling = data.translationKey ? tmap.get(`${data.translationKey}:${other}`) : undefined;
  const own = { title: data.title, description: data.description };
  const sib = { title: sibling?.data.title, description: sibling?.data.description };
  const [zh, en] = orig === 'zh' ? [own, sib] : [sib, own];
  return {
    titleZh: zh.title,
    titleEn: en.title,
    descriptionZh: zh.description,
    descriptionEn: en.description,
  };
}
