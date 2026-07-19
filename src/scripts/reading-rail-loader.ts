import { initReadingRail, mountReadingRailForPosts } from './reading-rail';

const railQuery = '(min-width: 1220px)';
let mounted = false;
let listening = false;
const railMediaQuery = window.matchMedia(railQuery);

function mountReadingRailWhenWide() {
  if (mounted || !railMediaQuery.matches) return;
  mounted = true;
  mountReadingRailForPosts();
}

export function mountReadingRailLoader() {
  mountReadingRailWhenWide();

  if (listening) return;
  listening = true;
  railMediaQuery.addEventListener('change', (event) => {
    if (event.matches) mountReadingRailWhenWide();
  });
  // Protected posts add their headings after decryption; rebuild the rail.
  document.addEventListener('protected-post:unlocked', () => {
    if (mounted) initReadingRail();
  });
}
