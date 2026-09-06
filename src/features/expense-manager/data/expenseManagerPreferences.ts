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
  backgroundColor: '#ffffff',
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
  const balanceCard = document.querySelector<HTMLElement>('.expense-overview__grid > .expense-overview__balance');
  if (!toolbar || !balanceCard || toolbar.dataset.activityReady === 'true') return;
  toolbar.dataset.activityReady = 'true';

  const wrapper = document.createElement('section');
  wrapper.className = 'expense-overview__activity-card';
  wrapper.setAttribute('aria-label', 'Activity');
  wrapper.innerHTML = `
    <div class="expense-overview__activity-head">
      <div>
        <p class="expense-overview__activity-eyebrow">Activity</p>
        <h2 class="expense-overview__activity-title">Financial activity</h2>
        <p class="expense-overview__activity-copy">Open a focused view for each reporting period.</p>
      </div>
    </div>
    <div class="expense-overview__activity-list">
      ${[
        'today:Today’s activity',
        'week:This week',
        'month:This month',
        'ytd:Year to date',
        'up-to-date:Up to date',
        'end-of-month:End of month',
      ].map((item) => {
        const [id, label] = item.split(':');
        return `<div class="expense-overview__activity-row"><span>${label}</span><button type="button" data-activity-period="${id}">Activity</button></div>`;
      }).join('')}
    </div>
    <div class="expense-overview__activity-footer">
      <span>More</span>
      <button type="button" data-overview-settings aria-label="Open Settings"><span aria-hidden="true">⚙</span> Settings</button>
    </div>
  `;
  balanceCard.insertAdjacentElement('afterend', wrapper);
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
    .expense-overview__activity-card{grid-column:1 / -1;min-width:0;width:100%;margin:0 0 18px;padding:24px 22px 16px;box-sizing:border-box;border:1px solid rgba(148,163,184,.18);border-radius:22px;background:linear-gradient(145deg,rgba(255,255,255,.97),rgba(248,250,252,.92));box-shadow:0 16px 36px rgba(15,23,42,.09),inset 0 1px 0 rgba(255,255,255,.96);overflow:hidden}
    .expense-overview__activity-head{padding:1px 2px 15px}
    .expense-overview__activity-eyebrow{margin:0 0 5px;color:#64748b;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
    .expense-overview__activity-title{margin:0;color:#172033;font-size:20px;font-weight:950;letter-spacing:-.035em;line-height:1.15;white-space:nowrap}
    .expense-overview__activity-copy{margin:5px 0 0;color:#94a3b8;font-size:10px;font-weight:650;line-height:1.4}
    .expense-overview__activity-list{display:grid;gap:7px;min-width:0}
    .expense-overview__activity-row{min-height:46px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 4px 0 13px;border:1px solid rgba(148,163,184,.12);border-radius:13px;background:rgba(255,255,255,.72);box-sizing:border-box;min-width:0}
    .expense-overview__activity-row>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#334155;font-size:11px;font-weight:800}
    .expense-overview__activity-row button{flex:0 0 auto;min-width:82px;height:31px;padding:0 13px;border:1px solid rgba(37,99,235,.14);border-radius:9px;background:#eff6ff;color:#1d4ed8;font:inherit;font-size:9px;font-weight:900;cursor:pointer;box-shadow:0 4px 10px rgba(37,99,235,.06);transition:transform .14s ease,background .14s ease,border-color .14s ease}
    .expense-overview__activity-row button:hover{transform:translateY(-1px);background:#dbeafe;border-color:rgba(37,99,235,.25)}
    .expense-overview__activity-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding:11px 3px 0;border-top:1px solid rgba(148,163,184,.12);color:#64748b;font-size:10px;font-weight:900}
    .expense-overview__activity-footer button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:32px;padding:0 13px;border:1px solid rgba(148,163,184,.16);border-radius:9px;background:#172033;color:#fff;font:inherit;font-size:9px;font-weight:900;cursor:pointer;box-shadow:0 5px 12px rgba(15,23,42,.12);transition:transform .14s ease,background .14s ease}
    .expense-overview__activity-footer button:hover{transform:translateY(-1px);background:#0f172a}
    .expense-overview__activity-footer button span{font-size:12px;line-height:1}
    .sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
    @media(max-width:700px){.expense-overview__activity-card{padding:20px 13px 13px;border-radius:19px}.expense-overview__activity-title{font-size:18px}.expense-overview__activity-row{min-height:46px;padding-left:11px}.expense-overview__activity-row button{min-width:78px}}
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
