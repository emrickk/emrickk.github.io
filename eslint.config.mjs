import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import astroPlugin from 'eslint-plugin-astro';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astroPlugin.configs.recommended,
  {
    files: ['*.mjs', 'src/**/*.js'],
    languageOptions: {
      globals: {
        Response: 'readonly',
        URL: 'readonly',
      },
    },
  },
  // The safety CLIs, image pipeline, and editor API run under Node; the
  // editor UI runs in the browser. Both are release tooling and get linted
  // like the site code.
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['scripts/post-editor/ui/*.js'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['dist/', '.astro/', 'node_modules/'],
  },
];
