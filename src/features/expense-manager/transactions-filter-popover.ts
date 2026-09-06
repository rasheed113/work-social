type FilterSelect = HTMLSelectElement;

let activeSelect: FilterSelect | null = null;
let activePopover: HTMLDivElement | null = null;
let initialized = false;
const triggers = new Map<FilterSelect, HTMLButtonElement>();
const FILTER_SELECTOR = '.expense-transactions .filters .select';

function closePopover() {
  activePopover?.remove();
  activePopover = null;
  activeSelect = null;
  triggers.forEach((trigger) => trigger.setAttribute('aria-expanded', 'false'));
}

function positionPopover(select: FilterSelect, popover: HTMLDivElement) {
  const rect = select.getBoundingClientRect();
  const margin = 12;
  const gap = 8;
  const width = Math.min(Math.max(rect.width, 230), window.innerWidth - margin * 2);
  const left = Math.max(margin, Math.min(rect.left, window.innerWidth - margin - width));
  const estimatedHeight = Math.min(360, Math.max(58, select.options.length * 46 + 18));
  const below = window.innerHeight - rect.bottom - gap;
  const top = below >= Math.min(estimatedHeight, 280)
    ? Math.min(rect.bottom + gap, window.innerHeight - margin - estimatedHeight)
    : Math.max(margin, rect.top - Math.min(estimatedHeight, rect.top - margin));
  popover.style.width = `${width}px`;
  popover.style.left = `${left}px`;
  popover.style.top = `${Math.max(margin, top)}px`;
}

function syncTrigger(select: FilterSelect) {
  const trigger = triggers.get(select);
  if (!trigger) return;
  const selected = select.options[select.selectedIndex];
  const label = trigger.querySelector('.expense-filter-trigger__label');
  if (label) label.textContent = selected?.textContent?.trim() || '';
}

function openPopover(select: FilterSelect) {
  if (activeSelect === select) { closePopover(); return; }
  closePopover();

  const popover = document.createElement('div');
  popover.className = 'expense-filter-popover';
  popover.setAttribute('role', 'listbox');
  popover.setAttribute('aria-label', select.getAttribute('aria-label') || 'Filter options');

  Array.from(select.options).forEach((option) => {
    if (option.disabled) return;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `expense-filter-option${option.value === select.value ? ' is-selected' : ''}`;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', option.value === select.value ? 'true' : 'false');

    const label = document.createElement('span');
    label.className = 'expense-filter-option__label';
    label.textContent = option.textContent?.trim() || '';
    item.appendChild(label);

    if (option.value === select.value) {
      const check = document.createElement('span');
      check.className = 'expense-filter-option__check';
      check.setAttribute('aria-hidden', 'true');
      check.textContent = '✓';
      item.appendChild(check);
    }

    item.addEventListener('click', () => {
      if (select.value !== option.value) {
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      syncTrigger(select);
      closePopover();
      triggers.get(select)?.focus({ preventScroll: true });
    });
    popover.appendChild(item);
  });

  document.body.appendChild(popover);
  activeSelect = select;
  activePopover = popover;
  triggers.get(select)?.setAttribute('aria-expanded', 'true');
  positionPopover(select, popover);
}

function buildTrigger(select: FilterSelect) {
  if (triggers.has(select)) { syncTrigger(select); return; }
  select.style.opacity = '0';
  select.style.pointerEvents = 'none';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'expense-filter-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.tabIndex = select.tabIndex;
  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    openPopover(select);
  });

  const label = document.createElement('span');
  label.className = 'expense-filter-trigger__label';
  trigger.appendChild(label);
  const chevron = document.createElement('span');
  chevron.className = 'expense-filter-trigger__chevron';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.textContent = '⌄';
  trigger.appendChild(chevron);

  const parent = select.parentElement;
  if (!parent) return;
  if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
  parent.appendChild(trigger);
  triggers.set(select, trigger);
  syncTrigger(select);
}

function syncAll() {
  document.querySelectorAll<FilterSelect>(FILTER_SELECTOR).forEach(buildTrigger);
  triggers.forEach((trigger, select) => {
    if (!document.body.contains(select)) { trigger.remove(); triggers.delete(select); }
    else syncTrigger(select);
  });
}

function initialize() {
  if (initialized) return;
  initialized = true;
  syncAll();
  document.addEventListener('keydown', (event) => {
    const trigger = (event.target as Element | null)?.closest('.expense-filter-trigger') as HTMLButtonElement | null;
    if (!trigger) return;
    const select = [...triggers.entries()].find(([, value]) => value === trigger)?.[0];
    if (!select) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openPopover(select);
    } else if (event.key === 'Escape' && activePopover) {
      event.preventDefault();
      closePopover();
    }
  }, true);
  document.addEventListener('click', (event) => {
    const target = event.target as Element | null;
    if (activePopover && !target?.closest('.expense-filter-popover') && !target?.closest('.expense-filter-trigger')) closePopover();
  }, true);
  window.addEventListener('resize', () => { if (activeSelect && activePopover) positionPopover(activeSelect, activePopover); });
  window.addEventListener('scroll', () => { if (activeSelect && activePopover) positionPopover(activeSelect, activePopover); }, true);
  new MutationObserver(() => syncAll()).observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
else initialize();
