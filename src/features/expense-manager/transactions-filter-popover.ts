type FilterSelect = HTMLSelectElement;

let activeSelect: FilterSelect | null = null;
let activePopover: HTMLDivElement | null = null;
let initialized = false;

const FILTER_SELECTOR = '.expense-transactions .filters .select';

function closePopover() {
  if (activePopover) activePopover.remove();
  if (activeSelect) activeSelect.setAttribute('aria-expanded', 'false');
  activePopover = null;
  activeSelect = null;
}

function positionPopover(select: FilterSelect, popover: HTMLDivElement) {
  const rect = select.getBoundingClientRect();
  const gap = 8;
  const margin = 12;
  const width = Math.min(Math.max(rect.width, 230), window.innerWidth - margin * 2);
  let left = rect.left;
  if (left + width > window.innerWidth - margin) left = window.innerWidth - margin - width;
  if (left < margin) left = margin;

  const estimatedHeight = Math.min(360, Math.max(54, select.options.length * 46 + 18));
  const below = window.innerHeight - rect.bottom - gap;
  const above = rect.top - gap;
  const top = below >= Math.min(estimatedHeight, 300) || below >= above
    ? Math.min(rect.bottom + gap, window.innerHeight - margin - estimatedHeight)
    : Math.max(margin, rect.top - Math.min(estimatedHeight, above));

  popover.style.width = `${width}px`;
  popover.style.left = `${left}px`;
  popover.style.top = `${Math.max(margin, top)}px`;
}

function openPopover(select: FilterSelect) {
  if (activeSelect === select) {
    closePopover();
    return;
  }
  closePopover();

  const popover = document.createElement('div');
  popover.className = 'expense-filter-popover';
  popover.setAttribute('role', 'listbox');
  popover.setAttribute('aria-label', select.getAttribute('aria-label') || 'Filter options');

  Array.from(select.options).forEach((option) => {
    if (option.disabled) return;
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'expense-filter-option';
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', option.value === select.value ? 'true' : 'false');
    if (option.value === select.value) item.classList.add('is-selected');

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
      closePopover();
      select.focus({ preventScroll: true });
    });

    popover.appendChild(item);
  });

  document.body.appendChild(popover);
  activeSelect = select;
  activePopover = popover;
  select.setAttribute('aria-expanded', 'true');
  positionPopover(select, popover);
}

function handlePointerDown(event: PointerEvent) {
  const target = event.target as Element | null;
  const select = target?.closest(FILTER_SELECTOR) as FilterSelect | null;
  if (select) {
    event.preventDefault();
    event.stopPropagation();
    openPopover(select);
    select.focus({ preventScroll: true });
    return;
  }
  if (activePopover && !target?.closest('.expense-filter-popover')) closePopover();
}

function handleKeyDown(event: KeyboardEvent) {
  const select = event.target as Element | null;
  if (!(select instanceof HTMLSelectElement) || !select.matches(FILTER_SELECTOR)) return;
  if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    event.stopPropagation();
    openPopover(select);
  } else if (event.key === 'Escape' && activeSelect === select) {
    event.preventDefault();
    closePopover();
  }
}

function initialize() {
  if (initialized) return;
  initialized = true;
  document.addEventListener('pointerdown', handlePointerDown, true);
  document.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('resize', () => {
    if (activeSelect && activePopover) positionPopover(activeSelect, activePopover);
  });
  window.addEventListener('scroll', () => {
    if (activeSelect && activePopover) positionPopover(activeSelect, activePopover);
  }, true);
  const observer = new MutationObserver(() => {
    if (activeSelect && !document.body.contains(activeSelect)) closePopover();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize, { once: true });
} else {
  initialize();
}
