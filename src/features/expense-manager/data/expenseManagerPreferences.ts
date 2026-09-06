export const EXPENSE_MANAGER_PREFERENCES_KEY = 'work-social:expense-manager:preferences';

export interface ExpenseManagerPreferences {
  backgroundColor: string;
  actionBarColor: string;
  actionBarImage: string;
  visibleCards: Record<string, boolean>;
}

export const OVERVIEW_CARD_DEFINITIONS = [
  ['total-balance', 'Total balance'],
  ['income', 'Income'],
  ['expenses', 'Expenses'],
  ['net', 'Net'],
  ['spending', 'Spending'],
  ['top-spending', 'Top spending'],
  ['account-snapshot', 'Account snapshot'],
  ['recent-transactions', 'Recent transactions'],
  ['budgets', 'Budgets'],
  ['financial-insight', 'Financial Insight'],
  ['financial-health', 'Financial health'],
] as const;

export const DEFAULT_EXPENSE_MANAGER_PREFERENCES: ExpenseManagerPreferences = {
  backgroundColor: '#f8fafc',
  actionBarColor: '#ffffff',
  actionBarImage: '',
  visibleCards: Object.fromEntries(OVERVIEW_CARD_DEFINITIONS.map(([key]) => [key, true])),
};

export function readExpenseManagerPreferences(): ExpenseManagerPreferences {
  if (typeof window === 'undefined') return DEFAULT_EXPENSE_MANAGER_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(EXPENSE_MANAGER_PREFERENCES_KEY);
    if (!raw) return DEFAULT_EXPENSE_MANAGER_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<ExpenseManagerPreferences>;
    return {
      ...DEFAULT_EXPENSE_MANAGER_PREFERENCES,
      ...parsed,
      visibleCards: { ...DEFAULT_EXPENSE_MANAGER_PREFERENCES.visibleCards, ...(parsed.visibleCards ?? {}) },
    };
  } catch {
    return DEFAULT_EXPENSE_MANAGER_PREFERENCES;
  }
}

export function writeExpenseManagerPreferences(next: ExpenseManagerPreferences) {
  window.localStorage.setItem(EXPENSE_MANAGER_PREFERENCES_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('expense-manager-preferences-change', { detail: next }));
}

export function updateExpenseManagerPreferences(patch: Partial<ExpenseManagerPreferences>) {
  const current = readExpenseManagerPreferences();
  const next: ExpenseManagerPreferences = {
    ...current,
    ...patch,
    visibleCards: patch.visibleCards ? { ...current.visibleCards, ...patch.visibleCards } : current.visibleCards,
  };
  writeExpenseManagerPreferences(next);
  return next;
}

const titleToKey = new Map(OVERVIEW_CARD_DEFINITIONS.map(([key, title]) => [title.toLowerCase(), key]));

function identifyCard(card: HTMLElement): string | null {
  const explicit = card.querySelector<HTMLElement>('.expense-overview__card-title')?.textContent?.trim();
  if (explicit) return titleToKey.get(explicit.toLowerCase()) ?? null;
  const eyebrow = card.querySelector<HTMLElement>('.expense-overview__eyebrow')?.textContent?.trim();
  if (eyebrow) return titleToKey.get(eyebrow.toLowerCase()) ?? null;
  const metric = card.querySelector<HTMLElement>('.expense-overview__metric-label')?.textContent?.trim();
  return metric ? titleToKey.get(metric.toLowerCase()) ?? null : null;
}

function navigate(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function enhanceOverviewToolbar() {
  const toolbar = document.querySelector<HTMLElement>('.expense-overview__toolbar');
  if (!toolbar || toolbar.dataset.activityReady === 'true') return;
  toolbar.dataset.activityReady = 'true';
  const wrapper = document.createElement('div');
  wrapper.className = 'expense-overview__activity-links';
  wrapper.setAttribute('aria-label', 'Activity periods');
  wrapper.innerHTML = `
    <span class="expense-overview__activity-label">Activity</span>
    ${['today:Today’s activity', 'week:This week', 'month:This month', 'ytd:Year to date', 'up-to-date:Up to date', 'end-of-month:End of month'].map((item) => {
      const [id, label] = item.split(':');
      return `<button type="button" data-activity-period="${id}">${label}<span aria-hidden="true">→</span></button>`;
    }).join('')}
    <button type="button" class="expense-overview__settings-link" data-overview-settings>More <span aria-hidden="true">→</span> <span aria-hidden="true">⚙</span><span class="sr-only">Settings</span></button>
  `;
  toolbar.insertAdjacentElement('afterend', wrapper);
  wrapper.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const activity = target.closest<HTMLButtonElement>('[data-activity-period]');
    if (activity) navigate(`/expense-manager/activity?period=${activity.dataset.activityPeriod}`);
    if (target.closest('[data-overview-settings]')) navigate('/expense-manager/settings');
  });
}

function applyOverviewCardVisibility(root: ParentNode = document) {
  const preferences = readExpenseManagerPreferences();
  root.querySelectorAll<HTMLElement>('.expense-overview__grid > .expense-overview__card').forEach((card) => {
    const key = identifyCard(card);
    if (!key) return;
    card.dataset.preferenceCard = key;
    card.hidden = preferences.visibleCards[key] === false;
  });
}

function luminance(hex: string) {
  const value = hex.replace('#', '');
  if (value.length !== 6) return 1;
  const rgb = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
  const linear = rgb.map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function applyTheme() {
  if (typeof document === 'undefined') return;
  const preferences = readExpenseManagerPreferences();
  document.querySelectorAll<HTMLElement>('.expense-manager-page').forEach((page) => {
    page.style.background = preferences.backgroundColor;
  });
  document.querySelectorAll<HTMLElement>('.expense-manager-navigation__shell').forEach((shell) => {
    const image = preferences.actionBarImage;
    shell.style.background = image
      ? `linear-gradient(rgba(255,255,255,.62),rgba(255,255,255,.62)), url(${image}) center/cover`
      : preferences.actionBarColor;
    const dark = image ? false : luminance(preferences.actionBarColor) < 0.35;
    shell.querySelectorAll<HTMLElement>('.expense-manager-navigation__item,.expense-manager-navigation__more-button').forEach((item) => {
      item.style.color = dark ? '#f8fafc' : '#475569';
    });
  });
}

function injectStyles() {
  if (document.getElementById('expense-manager-preference-styles')) return;
  const style = document.createElement('style');
  style.id = 'expense-manager-preference-styles';
  style.textContent = `
    .expense-overview__card[hidden]{display:none!important}
    .expense-overview__activity-links{width:min(1120px,100%);margin:-4px auto 14px;padding:9px 10px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;border:1px solid rgba(148,163,184,.14);border-radius:14px;background:rgba(255,255,255,.7);box-shadow:0 5px 15px rgba(15,23,42,.035)}
    .expense-overview__activity-label{margin-right:2px;color:#64748b;font-size:9px;font-weight:900;letter-spacing:.09em;text-transform:uppercase}
    .expense-overview__activity-links button{display:inline-flex;align-items:center;gap:5px;min-height:30px;padding:0 8px;border:1px solid rgba(148,163,184,.13);border-radius:9px;background:#fff;color:#475569;font:inherit;font-size:9px;font-weight:800;cursor:pointer;transition:background .14s ease,border-color .14s ease,transform .14s ease}
    .expense-overview__activity-links button:hover{background:#eff6ff;border-color:rgba(37,99,235,.18);color:#1d4ed8;transform:translateY(-1px)}
    .expense-overview__activity-links button span{color:#2563eb;font-size:11px}
    .expense-overview__activity-links .expense-overview__settings-link{margin-left:auto;background:#172033;color:#fff;border-color:#172033}
    .expense-overview__activity-links .expense-overview__settings-link span{color:inherit}
    .sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
    @media(max-width:700px){.expense-overview__activity-links{align-items:stretch;padding:8px;gap:5px}.expense-overview__activity-label{width:100%;margin-bottom:1px}.expense-overview__activity-links button{flex:1 1 calc(50% - 5px);justify-content:space-between}.expense-overview__activity-links .expense-overview__settings-link{flex:1 1 100%;margin-left:0}}
  `;
  document.head.appendChild(style);
}

function applyAll(root: ParentNode = document) {
  injectStyles();
  applyTheme();
  applyOverviewCardVisibility(root);
  enhanceOverviewToolbar();
}

if (typeof window !== 'undefined') {
  applyAll();
  const observer = new MutationObserver(() => applyAll());
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('storage', (event) => {
    if (event.key === EXPENSE_MANAGER_PREFERENCES_KEY) applyAll();
  });
  window.addEventListener('expense-manager-preferences-change', () => applyAll());
}
