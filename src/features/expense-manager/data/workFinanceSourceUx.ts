const WORK_PAYMENT = 'Work • Payment Received';
const WORK_ADVANCE = 'Work • Advance Received';

function sourceLabel(name: string) {
  if (name === WORK_PAYMENT) return 'Payment Received';
  if (name === WORK_ADVANCE) return 'Advance Received';
  return null;
}

function enhanceRows(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('.expense-transactions .row').forEach((row) => {
    if (row.dataset.workFinanceEnhanced === '1') return;
    const name = row.querySelector<HTMLElement>('.name')?.textContent?.trim() ?? '';
    const label = sourceLabel(name);
    if (!label) return;
    row.dataset.workFinanceEnhanced = '1';
    row.classList.add('work-finance-row');
    const main = row.querySelector<HTMLElement>('.main');
    if (!main) return;
    const badge = document.createElement('span');
    badge.className = 'work-finance-source-badge';
    badge.textContent = `FROM WORK · ${label}`;
    badge.setAttribute('aria-label', `Source: Work, ${label}`);
    main.appendChild(badge);
  });
}

function enhanceDetail(root: ParentNode) {
  const detail = root.querySelector<HTMLElement>('.expense-transactions .detail');
  if (!detail || detail.dataset.workFinanceDetailEnhanced === '1') return;
  const note = [...detail.querySelectorAll<HTMLElement>('.detail-cell')]
    .find((cell) => cell.querySelector('span')?.textContent?.trim() === 'Note')
    ?.querySelector('strong')?.textContent?.trim() ?? '';
  const label = sourceLabel(note);
  if (!label) return;
  detail.dataset.workFinanceDetailEnhanced = '1';
  const top = detail.querySelector<HTMLElement>('.detail-top');
  if (!top) return;
  const source = document.createElement('div');
  source.className = 'work-finance-detail-source';
  const icon = document.createElement('span');
  icon.className = 'work-finance-detail-source__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '↗';
  const copy = document.createElement('span');
  const strong = document.createElement('strong');
  strong.textContent = 'From Work';
  const small = document.createElement('small');
  small.textContent = `${label} automatically recorded as Finance Income`;
  copy.append(strong, small);
  source.append(icon, copy);
  top.insertAdjacentElement('afterend', source);
}

function injectStyles() {
  if (document.getElementById('work-finance-source-ux-styles')) return;
  const style = document.createElement('style');
  style.id = 'work-finance-source-ux-styles';
  style.textContent = `
    .expense-transactions .row.work-finance-row{position:relative;background:linear-gradient(90deg,rgba(16,185,129,.055),transparent 58%)}
    .expense-transactions .row.work-finance-row:hover{background:linear-gradient(90deg,rgba(16,185,129,.085),rgba(37,99,235,.025))}
    .expense-transactions .row.work-finance-row .mark{background:linear-gradient(145deg,rgba(16,185,129,.16),rgba(5,150,105,.08));color:#047857;box-shadow:inset 0 1px 0 rgba(255,255,255,.65),0 5px 14px rgba(5,150,105,.1)}
    .expense-transactions .row.work-finance-row .name{color:#064e3b}
    .expense-transactions .row.work-finance-row .amount[data-type=income]{color:#047857;text-shadow:0 1px 0 rgba(255,255,255,.7)}
    .work-finance-source-badge{display:inline-flex;align-items:center;width:max-content;max-width:100%;margin-top:5px;padding:3px 7px;border:1px solid rgba(16,185,129,.18);border-radius:999px;background:rgba(236,253,245,.92);color:#047857;font-size:8px;line-height:1.1;font-weight:950;letter-spacing:.06em;text-transform:uppercase;box-shadow:inset 0 1px 0 rgba(255,255,255,.75)}
    .work-finance-detail-source{display:flex;align-items:center;gap:10px;margin:12px 0 2px;padding:10px 11px;border:1px solid rgba(16,185,129,.18);border-radius:15px;background:linear-gradient(135deg,rgba(236,253,245,.98),rgba(240,253,250,.72));box-shadow:inset 0 1px 0 rgba(255,255,255,.8)}
    .work-finance-detail-source__icon{width:31px;height:31px;flex:0 0 31px;display:grid;place-items:center;border-radius:10px;background:rgba(16,185,129,.13);color:#047857;font-size:15px;font-weight:950}
    .work-finance-detail-source strong{display:block;color:#065f46;font-size:10px;font-weight:950;letter-spacing:.04em;text-transform:uppercase}
    .work-finance-detail-source small{display:block;margin-top:2px;color:#4b7c70;font-size:9px;line-height:1.35;font-weight:700}
    @media(max-width:560px){.work-finance-source-badge{font-size:7px;padding:3px 6px}.work-finance-detail-source{margin-top:10px}}
  `;
  document.head.appendChild(style);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  injectStyles();
  const run = () => { enhanceRows(document); enhanceDetail(document); };
  run();
  const observer = new MutationObserver(run);
  observer.observe(document.body, { childList: true, subtree: true });
}
