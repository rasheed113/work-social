const ROOT_SELECTOR = '.expense-overview';
const CARD_SELECTOR = '.expense-overview__grid > .expense-overview__card';
const READY_ATTR = 'data-overview-collapsible-ready';
const TARGET_TITLES = new Set(['Top spending', 'Account snapshot', 'Recent transactions']);

function cardTitle(card: HTMLElement) {
  const explicitTitle = card.querySelector<HTMLElement>('.expense-overview__card-title')?.textContent?.trim();
  if (explicitTitle) return explicitTitle;
  const eyebrow = card.querySelector<HTMLElement>('.expense-overview__eyebrow')?.textContent?.trim();
  if (eyebrow) return eyebrow;
  const metricLabel = card.querySelector<HTMLElement>('.expense-overview__metric-label')?.textContent?.trim();
  if (metricLabel) return metricLabel;
  return '';
}

function enhanceCard(card: HTMLElement) {
  if (card.hasAttribute(READY_ATTR) || card.classList.contains('expense-overview__empty')) return;
  const title = cardTitle(card);
  if (!TARGET_TITLES.has(title)) return;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'expense-overview__collapse-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-label', `Expand ${title}`);
  toggle.innerHTML = '<span class="expense-overview__collapse-icon" aria-hidden="true">⌃</span>';
  toggle.addEventListener('click', () => {
    const expanded = card.classList.toggle('is-expanded');
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} ${title}`);
  });

  const head = card.querySelector<HTMLElement>('.expense-overview__card-head');
  if (head) {
    head.appendChild(toggle);
    head.classList.add('expense-overview__card-head--collapsible');
  } else {
    card.appendChild(toggle);
  }
  card.setAttribute(READY_ATTR, 'true');
}

function enhance(root: ParentNode = document) {
  if (root instanceof HTMLElement && root.matches(CARD_SELECTOR)) enhanceCard(root);
  root.querySelectorAll<HTMLElement>(CARD_SELECTOR).forEach(enhanceCard);
}

enhance();
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.matches(ROOT_SELECTOR) || node.closest(ROOT_SELECTOR)) enhance(node);
    });
  }
});
observer.observe(document.body, { childList: true, subtree: true });
