import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  // Primary posts only — exclude `*.en.md` / `*.zh.md` sibling translations so
  // routes, list views, and RSS come from primaries and URLs stay unchanged.
  loader: glob({
    base: './src/content/posts',
    pattern: ['**/*.{md,mdx}', '!**/*.{en,zh}.{md,mdx}'],
  }),
  // Type-check frontmatter using a schema
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      // Transform string to Date object
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      heroImage: z.optional(image()),
      showHero: z.boolean().default(false),
      focusEffect: z.literal('scroll-dark').optional(),
      category: z.string().optional(),
      homeFeatured: z.boolean().default(false),
      homeHeroOrder: z.number().int().positive().optional(),
      homeOrder: z.number().int().positive().optional(),
      draft: z.boolean().default(false),
      // Bilingual support. `lang` is the post's original language.
      // `titleZh` / `titleEn` are optional so the site builds at any partial
      // translation state; the theme falls back to `title` when one is missing.
      lang: z.enum(['zh', 'en']).optional(),
      translationKey: z.string().optional(),
      titleZh: z.string().optional(),
      titleEn: z.string().optional(),
      descriptionZh: z.string().optional(),
      descriptionEn: z.string().optional(),
    }),
});

const translations = defineCollection({
  // Sibling translation bodies: `<slug>.en.md` / `<slug>.zh.md`.
  loader: glob({
    base: './src/content/posts',
    pattern: '**/*.{en,zh}.{md,mdx}',
  }),
  schema: z.object({
    translationKey: z.string(),
    lang: z.enum(['zh', 'en']),
    title: z.string().optional(),
  }),
});

export const collections = { posts, translations };
