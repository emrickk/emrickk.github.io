// Build-time encryption for password-protected posts (frontmatter
// `protected: true`). Runs last in the rehype chain: the fully processed
// tree (heading anchors, galleries, raw HTML) is serialized, encrypted with
// AES-256-GCM, and replaced by one empty <div data-protected-content> that
// carries the payload in attributes. src/scripts/protected-post.ts decrypts
// it in the browser with Web Crypto after the reader enters the password.
//
// Key: PBKDF2-SHA256 over the password from POST_PASSWORD (.env.local
// locally, a GitHub Actions secret in deploys). Salt and IV are derived
// deterministically (salt from the file's repo-relative path, IV from an
// HMAC of the plaintext under the key) so unchanged posts encrypt to
// byte-identical output across builds. GCM stays safe: the key changes with
// the path and the IV changes with the plaintext, so a key/IV pair is never
// reused for two different messages.
//
// The password gates the rendered site only. This repository is public, so
// the markdown source of a protected post is still readable on GitHub.

import { createCipheriv, createHash, createHmac, pbkdf2Sync } from 'node:crypto';
import path from 'node:path';
import { toHtml } from 'hast-util-to-html';

export const PBKDF2_ITERATIONS = 600000;

export function encryptHtml(html, password, saltSeed) {
  const salt = createHash('sha256')
    .update(`protected-post-salt:${saltSeed}`)
    .digest()
    .subarray(0, 16);
  const key = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256');
  const iv = createHmac('sha256', key).update(html).digest().subarray(0, 12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  // Web Crypto's AES-GCM expects the auth tag appended to the ciphertext.
  const ciphertext = Buffer.concat([cipher.update(html, 'utf8'), cipher.final(), cipher.getAuthTag()]);
  return {
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

export default function rehypeProtectedContent(options = {}) {
  const { password } = options;

  return (tree, file) => {
    const frontmatter = file.data?.astro?.frontmatter ?? {};
    if (frontmatter.protected !== true) return;

    const filePath = file.path ?? '';
    if (filePath.endsWith('.mdx')) {
      throw new Error(`protected posts must be plain .md, not .mdx: ${filePath}`);
    }
    if (!password) {
      throw new Error(
        `${filePath} has protected: true but no password is configured. ` +
          'Set POST_PASSWORD in .env.local (local builds) and as a GitHub Actions secret (deploys).',
      );
    }

    const saltSeed = file.cwd ? path.relative(file.cwd, filePath) : filePath;
    const html = toHtml(tree, { allowDangerousHtml: true });
    const { salt, iv, ciphertext } = encryptHtml(html, password, saltSeed);

    tree.children = [
      {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['protected-content'],
          dataProtectedContent: '',
          dataSalt: salt,
          dataIv: iv,
          dataCt: ciphertext,
          dataIterations: String(PBKDF2_ITERATIONS),
        },
        children: [],
      },
    ];
  };
}
