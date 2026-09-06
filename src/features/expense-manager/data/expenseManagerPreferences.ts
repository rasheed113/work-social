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

function applyOverviewCardVisibility(root: ParentNode = document) {
  const preferences = readExpenseManagerPreferences();
  root.querySelectorAll<HTMLElement>('.expense-overview__grid > .expense-overview__card').forEach((card) => {
    const key = identifyCard(card);
    if (!key) return;
    card.dataset.preferenceCard = key;
    card.hidden = preferences.visibleCards[key] === false;
  });
}

function applyTheme() {
  if (typeof document === 'undefined') return;
  const preferences = readExpenseManagerPreferences();
  document.querySelectorAll<HTMLElement>('.expense-manager-page').forEach((page) => {
    page.style.background = preferences.backgroundColor;
  });
  document.querySelectorAll<HTMLElement>('.expense-manager-navigation__shell').forEach((shell) => {
    shell.style.background = preferences.actionBarImage
      ? `linear-gradient(rgba(255,255,255,.72),rgba(255,255,255,.72)), url(${preferences.actionBarImage}) center/cover`
      : preferences.actionBarColor;
  });
}

function applyAll(root: ParentNode = document) {
  applyTheme();
  applyOverviewCardVisibility(root);
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
