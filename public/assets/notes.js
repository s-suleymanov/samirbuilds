// Measure rendered height so wrapping on smaller screens is handled too.
for (const card of document.querySelectorAll('.note-card')) {
  const body = card.querySelector('.note-body');
  const button = card.querySelector('.note-toggle');
  let expanded = false;
  function update() {
    const limit = parseFloat(getComputedStyle(document.documentElement).fontSize) * 14;
    const long = body.scrollHeight > limit + 1;
    button.hidden = !long;
    body.classList.toggle('is-collapsed', long && !expanded);
    button.setAttribute('aria-expanded', String(expanded));
    button.textContent = expanded ? 'See less' : 'See more';
    // Prevent keyboard focus from reaching links hidden by the clipped preview.
    for (const link of body.querySelectorAll('a')) {
      const clipped = long && !expanded && link.getBoundingClientRect().bottom > body.getBoundingClientRect().top + limit;
      if (clipped) {
        if (!link.hasAttribute('data-original-tabindex')) link.dataset.originalTabindex = link.getAttribute('tabindex') ?? '';
        link.tabIndex = -1;
      } else if (link.hasAttribute('data-original-tabindex')) {
        const original = link.dataset.originalTabindex;
        if (original === '') link.removeAttribute('tabindex');
        else link.setAttribute('tabindex', original);
        delete link.dataset.originalTabindex;
      }
    }
  }
  button.addEventListener('click', () => { expanded = !expanded; update(); });
  new ResizeObserver(update).observe(body);
  body.querySelectorAll('img').forEach(image => image.addEventListener('load', update));
  document.fonts.ready.then(update);
  update();
}
