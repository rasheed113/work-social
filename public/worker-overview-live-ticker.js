(() => {
  const SELECTOR = '.wo-ticker';
  const categories = ['WORK', 'FINANCE', 'HEALTH', 'PROGRESS'];
  let active = 0;
  let initialized = false;

  const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
  const read = (selector, root = document) => clean(root.querySelector(selector)?.textContent);

  function buildItems(root) {
    const work = [
      read('.wo-stat.cyan strong', root) ? `Overall work volume ${read('.wo-stat.cyan strong', root)}` : '',
      read('.wo-stat.violet strong', root) ? `Work value ${read('.wo-stat.violet strong', root)}` : '',
      read('.wo-stat.lime strong', root) ? `${read('.wo-stat.lime strong', root)} real work entries` : '',
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
    ].filter(Boolean);

    return { WORK: work, FINANCE: finance, HEALTH: health, PROGRESS: progress };
  }

  function hasWorkerData(groups) {
    return categories.some((category) => groups[category]?.length);
  }

  function flattenGroups(groups) {
    return categories.flatMap((category) => {
      const items = groups[category]?.length ? groups[category] : [`${category} data is loading`];
      return items.map((item) => `${category} · ${item}`);
    });
  }

  function paintTrack(ticker, groups) {
    const track = ticker.querySelector('.ws-live-ticker-track');
    if (!track) return;

    const items = flattenGroups(groups);
    const html = items
      .map((item, i) => `<span class="ws-live-ticker-item ws-live-ticker-tone-${i % 6}">${item}</span>`)
      .join('<i class="ws-live-ticker-separator">◆</i>');

    // Build the two identical halves once. The animated track itself is never
    // replaced again, so data hydration/category rotation cannot restart it.
    track.innerHTML = `<span class="ws-live-ticker-group">${html}</span><span class="ws-live-ticker-group" aria-hidden="true">${html}</span>`;

    const group = track.querySelector('.ws-live-ticker-group');
    if (!group) return;
    const groupWidth = group.getBoundingClientRect().width || 1;
    const pixelsPerSecond = 58;
    const duration = Math.max(18, groupWidth / pixelsPerSecond);
    track.style.setProperty('--ws-ticker-group-width', `${groupWidth}px`);
    track.style.setProperty('--ws-ticker-duration', `${duration}s`);
  }

  function rotateLabelAtLoop(ticker) {
    const track = ticker.querySelector('.ws-live-ticker-track');
    if (!track) return;
    track.addEventListener('animationiteration', () => {
      active = (active + 1) % categories.length;
      const label = ticker.querySelector('.ws-live-ticker-label b');
      if (label) label.textContent = categories[active];
    });
  }

  function initialize(root, ticker, groups) {
    if (initialized) return;
    initialized = true;

    ticker.classList.add('ws-live-ticker');
    ticker.setAttribute('aria-label', 'Worker Overview live intelligence ticker');
    ticker.innerHTML = `
      <span class="ws-live-ticker-label" aria-hidden="true"><span class="ws-live-ticker-dot"></span><b>${categories[active]}</b></span>
      <span class="ws-live-ticker-window"><span class="ws-live-ticker-track"></span></span>
    `;

    paintTrack(ticker, groups);
    rotateLabelAtLoop(ticker);
  }

  function boot() {
    const wait = window.setInterval(() => {
      if (initialized) {
        window.clearInterval(wait);
        return;
      }

      const root = document.querySelector('.wo');
      const ticker = document.querySelector(SELECTOR);
      if (!root || !ticker) return;

      const groups = buildItems(root);
      if (!hasWorkerData(groups)) return;

      window.clearInterval(wait);
      initialize(root, ticker, groups);
    }, 120);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();