import { useEffect } from 'react';

type Props = {
  todayEntries: number;
  weekEntries: number;
  remaining: string | number;
};

function money(value: string | number) {
  return `PKR ${Number(value || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
}

function workSignal(todayEntries: number, weekEntries: number) {
  if (todayEntries > 0) return { label: 'WORK ACTIVE', detail: `${todayEntries} real entr${todayEntries === 1 ? 'y' : 'ies'} today`, tone: 'lime' };
  if (weekEntries > 0) return { label: 'WORK QUIET', detail: `${weekEntries} real entr${weekEntries === 1 ? 'y' : 'ies'} this week`, tone: 'cyan' };
  return { label: 'NO RECENT WORK', detail: 'No real Worker work entries this week', tone: 'muted' };
}

function financeSignal(remaining: number) {
  if (remaining > 0) return { label: 'BALANCE OPEN', detail: `${money(remaining)} remaining`, tone: 'violet' };
  if (remaining < 0) return { label: 'RECEIVED AHEAD', detail: `${money(Math.abs(remaining))} above earnings`, tone: 'amber' };
  return { label: 'BALANCED', detail: 'Received equals recorded earnings', tone: 'lime' };
}

function numericText(value: string) {
  const cleaned = value.replace(/[^0-9.-]/g, '');
  return Number(cleaned || 0);
}

function addChartTitle(svg: SVGSVGElement, text: string) {
  const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  title.setAttribute('x', '12');
  title.setAttribute('y', '15');
  title.setAttribute('fill', '#8192ae');
  title.setAttribute('font-size', '8');
  title.setAttribute('font-weight', '800');
  title.textContent = text;
  svg.appendChild(title);
}

function buildVolumeChart(container: Element) {
  if (container.querySelector('.wo-live-chart-volume')) return;
  const cards = Array.from(container.querySelectorAll<HTMLElement>('.wo-v'));
  if (!cards.length) return;

  const values = cards.map(card => numericText(card.querySelector('strong')?.textContent || '0'));
  const max = Math.max(1, ...values);
  const width = 620;
  const height = 170;
  const left = 18;
  const right = 12;
  const top = 27;
  const bottom = 34;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const points = values.map((value, index) => {
    const x = left + (cards.length === 1 ? plotW / 2 : (plotW * index) / (cards.length - 1));
    const y = top + plotH - (value / max) * plotH;
    return { x, y };
  });

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('wo-live-chart-volume');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-label', 'Overall Worker work volume trend');

  addChartTitle(svg, 'REAL WORK VOLUME TREND');

  for (let i = 0; i < 3; i += 1) {
    const y = top + (plotH * i) / 2;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(left));
    line.setAttribute('x2', String(width - right));
    line.setAttribute('y1', String(y));
    line.setAttribute('y2', String(y));
    line.setAttribute('stroke', 'rgba(255,255,255,.08)');
    line.setAttribute('stroke-width', '1');
    svg.appendChild(line);
  }

  const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const areaPath = `M ${points[0].x} ${top + plotH} ${points.map(point => `L ${point.x} ${point.y}`).join(' ')} L ${points[points.length - 1].x} ${top + plotH} Z`;
  area.setAttribute('d', areaPath);
  area.setAttribute('fill', 'url(#woVolumeArea)');
  svg.appendChild(area);

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  gradient.id = 'woVolumeArea';
  gradient.setAttribute('x1', '0');
  gradient.setAttribute('x2', '0');
  gradient.setAttribute('y1', '0');
  gradient.setAttribute('y2', '1');
  const stopA = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stopA.setAttribute('offset', '0');
  stopA.setAttribute('stop-color', '#22d3ee');
  stopA.setAttribute('stop-opacity', '.28');
  const stopB = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stopB.setAttribute('offset', '1');
  stopB.setAttribute('stop-color', '#7c3aed');
  stopB.setAttribute('stop-opacity', '0');
  gradient.append(stopA, stopB);
  defs.appendChild(gradient);
  svg.insertBefore(defs, svg.firstChild);

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  line.setAttribute('points', points.map(point => `${point.x},${point.y}`).join(' '));
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', '#67e8f9');
  line.setAttribute('stroke-width', '3');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('stroke-linejoin', 'round');
  line.setAttribute('filter', 'drop-shadow(0 0 5px rgba(34,211,238,.65))');
  svg.appendChild(line);

  cards.forEach((card, index) => {
    const point = points[index];
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', String(point.x));
    dot.setAttribute('cy', String(point.y));
    dot.setAttribute('r', '5');
    dot.setAttribute('fill', '#07111e');
    dot.setAttribute('stroke', index % 2 ? '#a78bfa' : '#67e8f9');
    dot.setAttribute('stroke-width', '3');
    svg.appendChild(dot);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', String(point.x));
    label.setAttribute('y', String(height - 11));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', '#8192ae');
    label.setAttribute('font-size', '7');
    label.setAttribute('font-weight', '800');
    label.textContent = card.querySelector('small')?.textContent || '';
    svg.appendChild(label);
  });

  container.insertBefore(svg, container.firstChild);
}

function buildFinanceChart(container: Element) {
  if (container.querySelector('.wo-live-chart-finance')) return;
  const boxes = Array.from(container.querySelectorAll<HTMLElement>('.wo-finbox'));
  if (boxes.length < 3) return;

  const earnings = numericText(boxes[0].querySelector('strong')?.textContent || '0');
  const received = numericText(boxes[2].querySelector('strong')?.textContent || '0');
  const max = Math.max(1, earnings, received);
  const width = 620;
  const height = 142;
  const barW = 74;
  const baseline = 104;
  const chartTop = 30;
  const scale = (value: number) => Math.max(4, (Math.max(0, value) / max) * (baseline - chartTop));

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('wo-live-chart-finance');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-label', 'Worker earnings versus received finance chart');
  addChartTitle(svg, 'EARNINGS VS RECEIVED');

  const base = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  base.setAttribute('x1', '72');
  base.setAttribute('x2', String(width - 72));
  base.setAttribute('y1', String(baseline));
  base.setAttribute('y2', String(baseline));
  base.setAttribute('stroke', 'rgba(255,255,255,.12)');
  base.setAttribute('stroke-width', '1');
  svg.appendChild(base);

  const items = [
    { label: 'EARNINGS', value: earnings, x: width * .27, color: '#67e8f9' },
    { label: 'RECEIVED', value: received, x: width * .73, color: '#a78bfa' },
  ];

  items.forEach(item => {
    const h = scale(item.value);
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', String(item.x - barW / 2));
    rect.setAttribute('y', String(baseline - h));
    rect.setAttribute('width', String(barW));
    rect.setAttribute('height', String(h));
    rect.setAttribute('rx', '10');
    rect.setAttribute('fill', item.color);
    rect.setAttribute('fill-opacity', '.8');
    rect.setAttribute('filter', `drop-shadow(0 0 8px ${item.color})`);
    svg.appendChild(rect);

    const value = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    value.setAttribute('x', String(item.x));
    value.setAttribute('y', String(Math.max(24, baseline - h - 8)));
    value.setAttribute('text-anchor', 'middle');
    value.setAttribute('fill', '#eef6ff');
    value.setAttribute('font-size', '8');
    value.setAttribute('font-weight', '900');
    value.textContent = money(item.value);
    svg.appendChild(value);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', String(item.x));
    label.setAttribute('y', '125');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', '#8192ae');
    label.setAttribute('font-size', '7');
    label.setAttribute('font-weight', '800');
    label.textContent = item.label;
    svg.appendChild(label);
  });

  container.parentElement?.insertBefore(svg, container);
}

function buildWorkFlowChart(container: Element) {
  if (container.querySelector('.wo-live-chart-flow')) return;
  const nodes = Array.from(container.querySelectorAll<HTMLElement>('.wo-node'));
  if (nodes.length < 2) return;
  const values = nodes.map(node => numericText(node.querySelector('b')?.textContent || '0'));
  const max = Math.max(1, ...values);
  const width = 620;
  const height = 110;
  const left = 16;
  const right = 16;
  const top = 16;
  const bottom = 22;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const points = values.map((value, index) => ({
    x: left + (plotW * index) / Math.max(1, values.length - 1),
    y: top + plotH - (value / max) * plotH,
  }));

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('wo-live-chart-flow');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-label', 'Recent Worker work quantity chart');
  addChartTitle(svg, 'RECENT REAL WORK');

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  line.setAttribute('points', points.map(point => `${point.x},${point.y}`).join(' '));
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', '#c4b5fd');
  line.setAttribute('stroke-width', '3');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('stroke-linejoin', 'round');
  line.setAttribute('filter', 'drop-shadow(0 0 6px rgba(167,139,250,.7))');
  svg.appendChild(line);

  points.forEach((point, index) => {
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', String(point.x));
    dot.setAttribute('cy', String(point.y));
    dot.setAttribute('r', '5');
    dot.setAttribute('fill', '#07111e');
    dot.setAttribute('stroke', '#67e8f9');
    dot.setAttribute('stroke-width', '3');
    svg.appendChild(dot);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', String(point.x));
    label.setAttribute('y', String(height - 7));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', '#8192ae');
    label.setAttribute('font-size', '7');
    label.textContent = nodes[index].querySelector('small')?.textContent?.split(' · ')[0] || '';
    svg.appendChild(label);
  });

  container.parentElement?.insertBefore(svg, container.nextSibling);
}

export function WorkerOverallHealthCard({ todayEntries, weekEntries, remaining }: Props) {
  const work = workSignal(todayEntries, weekEntries);
  const finance = financeSignal(Number(remaining || 0));

  useEffect(() => {
    const root = document.querySelector('.wo');
    if (!root) return;
    buildWorkFlowChart(root.querySelector('.wo-flow') || root);
    buildVolumeChart(root.querySelector('.wo-volume') || root);
    buildFinanceChart(root.querySelector('.wo-fin') || root);
  }, [todayEntries, weekEntries, remaining]);

  return (
    <section className="wo-card wo-health-card">
      <style>{`.wo-health-card{position:relative;overflow:hidden}.wo-health-card:before{content:"";position:absolute;inset:-70px -45px auto auto;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(34,211,238,.2),rgba(124,58,237,.08) 42%,transparent 70%);pointer-events:none}.wo-health-card:after{content:"";position:absolute;inset:auto -20px -90px auto;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(167,139,250,.13),transparent 68%);pointer-events:none}.wo-health-grid{position:relative;z-index:1;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px}.wo-health-signal{position:relative;min-height:92px;padding:12px;border-radius:17px;background:linear-gradient(145deg,rgba(255,255,255,.065),rgba(255,255,255,.025));border:1px solid rgba(255,255,255,.1);box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 10px 24px rgba(0,0,0,.12);overflow:hidden}.wo-health-signal:before{content:"";position:absolute;top:0;left:0;width:34px;height:2px;background:currentColor;box-shadow:0 0 14px currentColor;opacity:.9}.wo-health-signal:after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:currentColor;opacity:.38}.wo-health-signal small{display:block;font-size:6px;color:#8192ae;font-weight:950;letter-spacing:.14em}.wo-health-signal strong{display:block;margin-top:7px;font-size:10px;letter-spacing:.02em}.wo-health-signal span{display:block;margin-top:5px;font-size:7px;color:#9aaac0;line-height:1.4}.wo-health-signal.lime{color:#bef264}.wo-health-signal.cyan{color:#67e8f9}.wo-health-signal.violet{color:#c4b5fd}.wo-health-signal.amber{color:#fbbf24}.wo-health-signal.muted{color:#94a3b8}.wo-health-note{position:relative;z-index:1;margin-top:9px;padding:9px 10px;border:1px solid rgba(34,211,238,.1);border-left:3px solid #22d3ee;border-radius:11px;background:linear-gradient(90deg,rgba(34,211,238,.07),rgba(34,211,238,.02));color:#91a2bd;font-size:7px;line-height:1.5}.wo-live-chart-volume,.wo-live-chart-finance,.wo-live-chart-flow{display:block;width:100%;height:auto;margin-top:12px;padding:7px;border:1px solid rgba(255,255,255,.08);border-radius:16px;background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.015));box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 10px 24px rgba(0,0,0,.14)}.wo-live-chart-flow{margin-top:12px}.wo-live-chart-finance{margin-bottom:10px}.wo-volume>.wo-live-chart-volume{grid-column:1/-1}.wo-live-chart-volume+ .wo-v{margin-top:0}@media(max-width:400px){.wo-health-grid{grid-template-columns:1fr}.wo-health-signal{min-height:82px}}`}</style>
      <div className="wo-eyebrow">04 · OVERALL HEALTH INTELLIGENCE</div>
      <h2>Real position signals</h2>
      <p className="wo-muted">Health is derived from live Worker work activity and the authoritative overall finance position — no artificial score.</p>
      <div className="wo-health-grid">
        <div className={`wo-health-signal ${work.tone}`}>
          <small>WORK SIGNAL</small>
          <strong>{work.label}</strong>
          <span>{work.detail}</span>
        </div>
        <div className={`wo-health-signal ${finance.tone}`}>
          <small>FINANCE SIGNAL</small>
          <strong>{finance.label}</strong>
          <span>{finance.detail}</span>
        </div>
      </div>
      <div className="wo-health-note">No hidden health score, no guessed completion, and no Contractor-domain data. These signals describe only what the current real Worker data supports.</div>
    </section>
  );
}
