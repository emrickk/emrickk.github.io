export function mountImageLightbox() {
  const dialog = document.getElementById('lightbox');
  if (!(dialog instanceof HTMLDialogElement) || dialog.dataset.lightboxReady === 'true') return;
  dialog.dataset.lightboxReady = 'true';

  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxCap = document.getElementById('lightbox-caption');
  const lightboxCount = document.getElementById('lightbox-counter');
  const closeBtn = dialog.querySelector('.lightbox-close');
  const prevBtn = dialog.querySelector('.lightbox-prev');
  const nextBtn = dialog.querySelector('.lightbox-next');

  if (
    !(lightboxImg instanceof HTMLImageElement) ||
    !(lightboxCap instanceof HTMLParagraphElement) ||
    !(lightboxCount instanceof HTMLParagraphElement) ||
    !(closeBtn instanceof HTMLButtonElement) ||
    !(prevBtn instanceof HTMLButtonElement) ||
    !(nextBtn instanceof HTMLButtonElement)
  ) {
    return;
  }

  let previousFocus: Element | null = null;
  let gallery: HTMLImageElement[] = [];
  let galleryIndex = 0;

  const restorePage = () => {
    document.body.style.overflow = '';
    if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
    previousFocus = null;
    gallery = [];
  };

  const closeLightbox = () => {
    if (dialog.open) dialog.close();
  };

  const sourceFor = (img: HTMLImageElement) =>
    img.getAttribute('data-src') ?? (img.currentSrc || img.src);

  const captionFor = (img: HTMLImageElement) =>
    img.nextElementSibling?.tagName === 'EM'
      ? ((img.nextElementSibling as HTMLElement).textContent ?? '')
      : '';

  const showImage = (img: HTMLImageElement) => {
    lightboxImg.src = sourceFor(img);
    lightboxImg.alt = img.alt;
    const caption = captionFor(img);
    lightboxCap.textContent = caption;
    lightboxCap.hidden = !caption;
    const inGallery = gallery.length > 1;
    lightboxCount.textContent = inGallery ? `${galleryIndex + 1} / ${gallery.length}` : '';
    lightboxCount.hidden = !inGallery;
    prevBtn.hidden = !inGallery;
    nextBtn.hidden = !inGallery;
  };

  const showAt = (index: number) => {
    if (gallery.length < 2) return;
    galleryIndex = (index + gallery.length) % gallery.length;
    showImage(gallery[galleryIndex]);
  };

  const openLightbox = (img: HTMLImageElement) => {
    previousFocus = document.activeElement;
    // Browse every bound photo in the language body being read. Bilingual posts
    // render both bodies into .prose; only the visible one can be clicked, so
    // scoping to the clicked image's .lang container avoids double-counting.
    const browseRoot = img.closest('.lang') ?? img.closest('.prose');
    gallery = browseRoot
      ? [...browseRoot.querySelectorAll<HTMLImageElement>('img[data-lightbox-bound]')]
      : [img];
    galleryIndex = Math.max(0, gallery.indexOf(img));
    showImage(img);
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    closeBtn.focus({ preventScroll: true });
  };

  document.querySelectorAll<HTMLImageElement>('.prose img').forEach((img) => {
    if (img.closest('a') || img.dataset.lightboxBound === 'true') return;
    img.dataset.lightboxBound = 'true';
    img.classList.add('is-zoomable');
    img.setAttribute('tabindex', '0');
    img.setAttribute('role', 'button');
    img.setAttribute('aria-haspopup', 'dialog');
    img.setAttribute('aria-label', `${img.alt || 'Image'} preview`);

    const open = () => openLightbox(img);

    img.addEventListener('click', open);
    img.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });

  closeBtn.addEventListener('click', closeLightbox);
  prevBtn.addEventListener('click', () => showAt(galleryIndex - 1));
  nextBtn.addEventListener('click', () => showAt(galleryIndex + 1));

  // Threshold swipe for touch screens: single finger, mostly horizontal,
  // at least 48px. A completed swipe suppresses the click that can follow
  // touchend so it never hits the backdrop-close below. A second finger
  // cancels the gesture and suppresses nothing.
  let touchStartX = 0;
  let touchStartY = 0;
  let touchActive = false;
  let suppressClick = false;

  dialog.addEventListener(
    'touchstart',
    (event) => {
      suppressClick = false;
      touchActive = event.touches.length === 1;
      if (!touchActive) return;
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
    },
    { passive: true },
  );

  dialog.addEventListener(
    'touchend',
    (event) => {
      if (!touchActive) return;
      touchActive = false;
      if (gallery.length < 2) return;
      const dx = event.changedTouches[0].clientX - touchStartX;
      const dy = event.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) < 48 || Math.abs(dx) <= 1.5 * Math.abs(dy)) return;
      suppressClick = true;
      showAt(dx < 0 ? galleryIndex + 1 : galleryIndex - 1);
    },
    { passive: true },
  );

  dialog.addEventListener('click', (event) => {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (event.target === dialog) closeLightbox();
  });
  dialog.addEventListener('keydown', (event) => {
    if (
      gallery.length > 1 &&
      (event.key === 'ArrowLeft' || event.key === 'ArrowRight') &&
      !event.altKey &&
      !event.metaKey &&
      !event.ctrlKey
    ) {
      event.preventDefault();
      showAt(event.key === 'ArrowLeft' ? galleryIndex - 1 : galleryIndex + 1);
      return;
    }
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const controls = [closeBtn, prevBtn, nextBtn].filter((button) => !button.hidden);
    const at = controls.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.shiftKey ? -1 : 1;
    controls[(at + step + controls.length) % controls.length].focus({ preventScroll: true });
  });
  dialog.addEventListener('close', restorePage);
}
