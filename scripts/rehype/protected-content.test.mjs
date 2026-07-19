import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { toHtml } from 'hast-util-to-html';
import rehypeProtectedContent, { PBKDF2_ITERATIONS } from './protected-content.mjs';

const el = (tagName, properties = {}, children = []) => ({
  type: 'element',
  tagName,
  properties,
  children,
});
const text = (value) => ({ type: 'text', value });
const root = (...children) => ({ type: 'root', children });

const PASSWORD = 'correct horse battery staple';

const sampleTree = () =>
  root(
    el('h2', { id: 'day-one' }, [text('Day one 第一天')]),
    el('p', {}, [text('A secret paragraph with a photo.')]),
    el('img', { src: 'https://cdn.theneverless.com/x.webp', alt: '' }),
  );

const file = (path, frontmatter, cwd = '/repo') => ({
  path,
  cwd,
  data: { astro: { frontmatter } },
});

const run = (tree, vfile, password = PASSWORD) => {
  rehypeProtectedContent({ password })(tree, vfile);
  return tree;
};

// Mirrors src/scripts/protected-post.ts so the tests prove the browser side
// can decrypt what the build side produced.
async function decryptLikeClient(properties, password) {
  const b64 = (v) => Uint8Array.from(Buffer.from(v, 'base64'));
  const material = await webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const key = await webcrypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: b64(properties.dataSalt),
      iterations: Number(properties.dataIterations),
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  const plain = await webcrypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64(properties.dataIv) },
    key,
    b64(properties.dataCt),
  );
  return new TextDecoder().decode(plain);
}

test('a file without protected: true is left untouched', () => {
  const tree = sampleTree();
  const expected = JSON.stringify(tree);
  run(tree, file('/repo/src/content/posts/open.md', { title: 'Open' }));
  assert.equal(JSON.stringify(tree), expected);
});

test('a protected file is replaced by a single empty payload div', () => {
  const tree = run(sampleTree(), file('/repo/src/content/posts/secret.md', { protected: true }));
  assert.equal(tree.children.length, 1);
  const div = tree.children[0];
  assert.equal(div.tagName, 'div');
  assert.deepEqual(div.children, []);
  assert.equal(div.properties.dataIterations, String(PBKDF2_ITERATIONS));
  for (const key of ['dataSalt', 'dataIv', 'dataCt']) {
    assert.equal(typeof div.properties[key], 'string');
    assert.ok(div.properties[key].length > 0, `${key} present`);
  }
});

test('no plaintext survives anywhere in the transformed tree', () => {
  const tree = run(sampleTree(), file('/repo/src/content/posts/secret.md', { protected: true }));
  const serialized = JSON.stringify(tree);
  assert.ok(!serialized.includes('secret paragraph'));
  assert.ok(!serialized.includes('第一天'));
  assert.ok(!serialized.includes('cdn.theneverless.com'));
});

test('the client decrypt path recovers the exact serialized HTML', async () => {
  const expectedHtml = toHtml(sampleTree(), { allowDangerousHtml: true });
  const tree = run(sampleTree(), file('/repo/src/content/posts/secret.md', { protected: true }));
  const html = await decryptLikeClient(tree.children[0].properties, PASSWORD);
  assert.equal(html, expectedHtml);
});

test('raw HTML nodes in the tree are serialized, not dropped', async () => {
  const tree = root(
    { type: 'raw', value: '<em class="wp">legacy markup</em>' },
    el('p', {}, [text('after')]),
  );
  run(tree, file('/repo/src/content/posts/secret.md', { protected: true }));
  const html = await decryptLikeClient(tree.children[0].properties, PASSWORD);
  assert.ok(html.includes('<em class="wp">legacy markup</em>'));
});

test('the wrong password fails to decrypt', async () => {
  const tree = run(sampleTree(), file('/repo/src/content/posts/secret.md', { protected: true }));
  await assert.rejects(decryptLikeClient(tree.children[0].properties, 'wrong password'));
});

test('output is deterministic for unchanged content and path', () => {
  const vfile = () => file('/repo/src/content/posts/secret.md', { protected: true });
  const a = run(sampleTree(), vfile());
  const b = run(sampleTree(), vfile());
  assert.deepEqual(a.children[0].properties, b.children[0].properties);
});

test('salt differs per file so sibling bodies never share a key', () => {
  const a = run(sampleTree(), file('/repo/src/content/posts/secret.md', { protected: true }));
  const b = run(sampleTree(), file('/repo/src/content/posts/secret.en.md', { protected: true }));
  assert.notEqual(a.children[0].properties.dataSalt, b.children[0].properties.dataSalt);
});

test('salt is derived from the repo-relative path, not the absolute one', () => {
  const a = run(sampleTree(), file('/ci/src/content/posts/secret.md', { protected: true }, '/ci'));
  const b = run(
    sampleTree(),
    file('/laptop/src/content/posts/secret.md', { protected: true }, '/laptop'),
  );
  assert.equal(a.children[0].properties.dataSalt, b.children[0].properties.dataSalt);
});

test('a protected post without a configured password fails the build', () => {
  const transform = rehypeProtectedContent({});
  assert.throws(
    () => transform(sampleTree(), file('/repo/src/content/posts/secret.md', { protected: true })),
    /POST_PASSWORD/,
  );
});

test('a protected .mdx post is rejected', () => {
  assert.throws(
    () => run(sampleTree(), file('/repo/src/content/posts/secret.mdx', { protected: true })),
    /plain \.md/,
  );
});
