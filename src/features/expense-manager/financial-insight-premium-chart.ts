const ROOT = '.expense-financial-intelligence__card--insight';
const SVG = '.expense-candle__svg';
const READY = 'data-premium-trend-ready';

function moneyFromTitle(title: string): number | null {
  const match = title.match(/·\s*(?:[A-Z]{3}\s+)?([\d,]+(?:\.\d+)?)\s+total/i);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

function enhance(card: HTMLElement) {
  if (card.getAttribute(READY) === 'true') return;
  const svg = card.querySelector<SVGSVGElement>(SVG);
  if (!svg) return;
  const groups = [...svg.querySelectorAll<SVGGElement>('.expense-candle__bar')];
  const points = groups.map((group) => {
    const title = group.querySelector('title')?.textContent ?? '';
    const date = title.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? '';
    const value = moneyFromTitle(title);
    return date && value !== null ? { date, value } : null;
  }).filter((point): point is { date: string; value: number } => Boolean(point));
  if (!points.length) return;

  const width = 920;
  const height = 300;
  const left = 42;
  const right = 20;
  const top = 24;
  const bottom = 42;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const max = Math.max(...points.map((p) => p.value), 1);
  const step = points.length === 1 ? plotW / 2 : plotW / (points.length - 1);
  const x = (i: number) => points.length === 1 ? left + plotW / 2 : left + i * step;
  const y = (value: number) => top + plotH - (value / max) * plotH;
  const path = points.map((p, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(p.value)}`).join(' ');
  const area = `${path} L ${x(points.length - 1)} ${top + plotH} L ${x(0)} ${top + plotH} Z`;
  const labels = points.map((p, i) => i % Math.max(1, Math.ceil(points.length / 6)) === 0 ? `<text x="${x(i)}" y="${height - 16}" text-anchor="middle" class="expense-trend__label">${new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${p.date}T12:00:00`))}</text>` : '').join('');
  const dots = points.map((p, i) => `<g class="expense-trend__point"><circle cx="${x(i)}" cy="${y(p.value)}" r="${i === points.length - 1 ? 5 : 4}"><title>${p.date} · ${p.value.toLocaleString()} expense total</title></circle></g>`).join('');

  svg.innerHTML = `<defs><linearGradient id="expenseTrendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" class="expense-trend__fill-start"/><stop offset="100%" class="expense-trend__fill-end"/></linearGradient></defs><line x1="${left}" x2="${width - right}" y1="${top + plotH}" y2="${top + plotH}" class="expense-trend__axis"/><line x1="${left}" x2="${width - right}" y1="${top + plotH / 2}" y2="${top + plotH / 2}" class="expense-trend__grid"/><path d="${area}" class="expense-trend__area"/><path d="${path}" class="expense-trend__line" fill="none"/>${dots}${labels}`;

  const title = card.querySelector('.expense-candle__title');
  if (title) title.textContent = 'Daily spending trend';
  const eyebrow = card.querySelector('.expense-candle__eyebrow');
  if (eyebrow) eyebrow.textContent = `${points.length} active day${points.length === 1 ? '' : 's'}`;
  card.querySelector('.expense-candle__ohlc')?.remove();
  const hint = card.querySelector('.expense-candle__hint');
  if (hint) hint.textContent = 'Tap a point to inspect that day’s real persisted expense activity.';
  card.setAttribute(READY, 'true');
}

function scan(root: ParentNode = document) {
  if (root instanceof HTMLElement && root.matches(ROOT)) enhance(root);
  root.querySelectorAll<HTMLElement>(ROOT).forEach(enhance);
}

scan();
new MutationObserver((mutations) => mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
  if (node instanceof HTMLElement) scan(node);
}))).observe(document.body, { childList: true, subtree: true });
