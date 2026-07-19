// Client half of the protected-posts feature. The build
// (scripts/rehype/protected-content.mjs) replaces a protected post body with
// empty [data-protected-content] blocks carrying an AES-256-GCM payload;
// this script asks for the password, derives the key with PBKDF2-SHA256,
// and swaps the decrypted HTML back in. Bilingual posts have two blocks
// (one per language body); one password unlocks both.

const STORAGE_PREFIX = 'protected-post:';
const UNLOCKED_EVENT = 'protected-post:unlocked';

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function decryptBlock(block: HTMLElement, password: string): Promise<string> {
  const { salt, iv, ct, iterations } = block.dataset;
  if (!salt || !iv || !ct) throw new Error('protected block is missing its payload');

  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: fromBase64(salt),
      iterations: Number(iterations) || 600000,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(iv) },
    key,
    fromBase64(ct)
  );
  return new TextDecoder().decode(plain);
}

export function mountProtectedPost() {
  const gate = document.querySelector<HTMLElement>('[data-protected-gate]');
  const blocks = [...document.querySelectorAll<HTMLElement>('[data-protected-content]')];
  if (!gate || blocks.length === 0 || gate.dataset.gateReady === 'true') return;
  gate.dataset.gateReady = 'true';

  const form = gate.querySelector('form');
  const input = gate.querySelector<HTMLInputElement>('input[type="password"]');
  const errorNote = gate.querySelector<HTMLElement>('[data-gate-error]');
  const submit = gate.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!form || !input || !errorNote || !submit) return;

  const storageKey = STORAGE_PREFIX + window.location.pathname;

  const unlock = async (password: string, remember: boolean) => {
    // Decrypt every block before touching the DOM so a wrong password
    // never reveals half a post.
    const bodies = await Promise.all(blocks.map((block) => decryptBlock(block, password)));
    blocks.forEach((block, i) => {
      block.innerHTML = bodies[i];
    });
    if (remember) {
      try {
        sessionStorage.setItem(storageKey, password);
      } catch {
        /* private mode: persistence unavailable */
      }
    }
    gate.remove();
    // Late-added content: lightbox, image loading states, and the reading
    // rail listen for this to pick up the decrypted body.
    document.dispatchEvent(new CustomEvent(UNLOCKED_EVENT));
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const password = input.value;
    if (!password) return;
    submit.disabled = true;
    errorNote.hidden = true;
    unlock(password, true).catch(() => {
      submit.disabled = false;
      errorNote.hidden = false;
      input.select();
    });
  });

  // Same-tab return visits: retry the password that worked before.
  let saved: string | null = null;
  try {
    saved = sessionStorage.getItem(storageKey);
  } catch {
    /* private mode: persistence unavailable */
  }
  if (saved) {
    unlock(saved, false).catch(() => {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        /* private mode: persistence unavailable */
      }
    });
  }
}
