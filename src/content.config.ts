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
      // Password-protected body: encrypted at build time by
      // scripts/rehype/protected-content.mjs. Bilingual posts must set this
      // in the sibling translation too. Runbook: docs/protected-posts.md.
      protected: z.boolean().default(false),
      // Bilingual support. `lang` is the post's original language; `title`
      // and `description` above are in that language. The other language's
      // title, description, and body live in the sibling translation file.
      lang: z.enum(['zh', 'en']).optional(),
      translationKey: z.string().optional(),
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
    // Display title/description for this language. Optional so a post builds
    // mid-translation; the theme falls back to the primary's title/description.
    title: z.string().optional(),
    description: z.string().optional(),
    // Must match the primary post's flag; posts/[...slug].astro enforces it.
    protected: z.boolean().default(false),
  }),
});

const notes = defineCollection({
  // Microblog notes imported from the X/Twitter archive by
  // scripts/migrate/tweets_import.py. One file per tweet or self-thread,
  // keyed by tweetId; bodies are verbatim tweet text (mechanical
  // transforms only). No titles, no drafts, no bilingual siblings.
  loader: glob({
    base: './src/content/notes',
    pattern: '**/*.md',
  }),
  schema: z.object({
    date: z.coerce.date(),
    tweetId: z.string(),
    source: z.string().url(),
    tweetCount: z.number().int().positive(),
  }),
});

export const collections = { posts, translations, notes };
