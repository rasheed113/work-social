(() => {
  const SELECTOR = '.wo-ticker';
  const categories = ['WORK', 'FINANCE', 'HEALTH', 'PROGRESS'];
  const SPEED_PX_PER_SECOND = 72;
  const ROTATE_MS = 7000;
  let active = 0;
  let lastSignature = '';
  let initialized = false;
  let frameId = 0;
  let lastFrameTime = 0;
  let offset = 0;
  let groupWidth = 0;
  let nextRotation = 0;

  const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
  const read = (selector, root = document) => clean(root.querySelector(selector)?.textContent);

  function buildItems(root) {
    const work = [
      read('.wo-stat.cyan strong', root) ? `Overall work volume ${read('.wo-stat.cyan strong', root)}` : '',
      read('.wo-stat.violet strong', root) ? `Work value ${read('.wo-stat.violet strong', root)}` : '',
      read('.wo-stat.lime strong', root) ? `${read('.wo-stat.lime strong', root)} real work entries` : '',
      read('.wo-field-footer b', root) ? read('.wo-field-footer b', root) : '',
    ].filter(Boolean);

    const finance = [
      read('.wo-finbox:nth-child(1) strong', root) ? `Work earnings ${read('.wo-finbox:nth-child(1) strong', root)}` : '',
      read('.wo-finbox:nth-child(3) strong', root) ? `Earned ${read('.wo-finbox:nth-child(3) strong', root)}` : '',
      read('.wo-finbox:nth-child(5) strong', root) ? `Received ${read('.wo-finbox:nth-child(5) strong', root)}` : '',
      read('.wo-rem', root) ? read('.wo-rem', root) : '',
    ].filter(Boolean);

    const healthCard = root.querySelector('.wo-health-card');
    const healthText = healthCard ? clean(healthCard.textContent) : '';
    const health = [
      healthText.includes('WORK ACTIVE') ? 'Work health is active today' : healthText.includes('WORK QUIET') ? 'Work health is quiet today' : 'No recent work signal',
      healthText.includes('BALANCE OPEN') ? 'Financial health: balance open' : healthText.includes('RECEIVED AHEAD') ? 'Financial health: received ahead' : healthText.includes('BALANCED') ? 'Financial health: balanced' : '',
      healthText.match(/\d+ real entr(?:y|ies) today/)?.[0] || '',
    ].filter(Boolean);

    const progress = [
      read('.wo-field-core strong', root) ? `Living work field: ${read('.wo-field-core strong', root)} pcs this month` : '',
      read('.wo-prism-value strong', root) ? `Work volume prism: ${read('.wo-prism-value strong', root)} pcs overall` : '',
      read('.wo-prism-meta b', root) ? read('.wo-prism-meta b', root) : '',
      read('.wo-field-footer b', root) ? read('.wo-field-footer b', root) : '',
    ].filter(Boolean);

    return { WORK: work, FINANCE: finance, HEALTH: health, PROGRESS: progress };
  }

  function signature(groups) {
    return JSON.stringify(groups);
  }

  function itemHtml(items) {
    const safeItems = items?.length ? items : ['Live Worker data is loading'];
    return safeItems
      .map((item, i) => `<span class="ws-live-ticker-item ws-live-ticker-tone-${i % 6}">${item}</span>`)
      .join('<i class="ws-live-ticker-separator">◆</i>');
  }

  function measure(ticker) {
    const firstGroup = ticker.querySelector('.ws-live-ticker-group');
    if (!firstGroup) return;
    groupWidth = firstGroup.getBoundingClientRect().width;
    if (groupWidth > 0) offset %= groupWidth;
  }

  function render(force = false) {
    const ticker = document.querySelector(SELECTOR);
    const root = document.querySelector('.wo');
    if (!ticker || !root) return;

    const groups = buildItems(root);
    const sig = signature(groups);
    if (!force && sig === lastSignature) return;
    lastSignature = sig;

    ticker.classList.add('ws-live-ticker');
    ticker.setAttribute('aria-label', 'Worker Overview live intelligence ticker');
    ticker.innerHTML = `
      <span class="ws-live-ticker-label" aria-hidden="true"><span class="ws-live-ticker-dot"></span><b>${categories[active]}</b></span>
      <span class="ws-live-ticker-window"><span class="ws-live-ticker-track">
        <span class="ws-live-ticker-group">${itemHtml(groups.WORK)}<i class="ws-live-ticker-separator">◆</i>${itemHtml(groups.FINANCE)}<i class="ws-live-ticker-separator">◆</i>${itemHtml(groups.HEALTH)}<i class="ws-live-ticker-separator">◆</i>${itemHtml(groups.PROGRESS)}<i class="ws-live-ticker-separator">◆</i></span>
        <span class="ws-live-ticker-group" aria-hidden="true">${itemHtml(groups.WORK)}<i class="ws-live-ticker-separator">◆</i>${itemHtml(groups.FINANCE)}<i class="ws-live-ticker-separator">◆</i>${itemHtml(groups.HEALTH)}<i class="ws-live-ticker-separator">◆</i>${itemHtml(groups.PROGRESS)}<i class="ws-live-ticker-separator">◆</i></span>
      </span></span>
    `;

    offset = 0;
    requestAnimationFrame(() => measure(ticker));
  }

  function rotateLabel(now) {
    if (!nextRotation) nextRotation = now + ROTATE_MS;
    if (now < nextRotation) return;
    active = (active + 1) % categories.length;
    nextRotation += ROTATE_MS;
    const label = document.querySelector(`${SELECTOR} .ws-live-ticker-label b`);
    if (label) label.textContent = categories[active];
  }

  function animate(now) {
    if (!lastFrameTime) lastFrameTime = now;
    const delta = Math.min(50, now - lastFrameTime);
    lastFrameTime = now;

    const ticker = document.querySelector(SELECTOR);
    const track = ticker?.querySelector('.ws-live-ticker-track');
    if (track && groupWidth > 0) {
      offset = (offset + (delta / 1000) * SPEED_PX_PER_SECOND) % groupWidth;
      track.style.transform = `translate3d(${-offset}px, 0, 0)`;
    }

    rotateLabel(now);
    frameId = requestAnimationFrame(animate);
  }

  function boot() {
    if (initialized) return;
    initialized = true;

    const observer = new MutationObserver(() => render());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    const wait = window.setInterval(() => {
      if (document.querySelector(SELECTOR)) {
        window.clearInterval(wait);
        render(true);
        nextRotation = performance.now() + ROTATE_MS;
        if (!frameId) frameId = requestAnimationFrame(animate);
      }
    }, 120);

    window.addEventListener('resize', () => {
      const ticker = document.querySelector(SELECTOR);
      if (ticker) requestAnimationFrame(() => measure(ticker));
    }, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
