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

function svgEl<T extends keyof SVGElementTagNameMap>(tag: T) {
  return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

function addText(svg: SVGSVGElement, text: string, x: number, y: number, size = 7, fill = '#8192ae', weight = '800', anchor = 'start') {
  const node = svgEl('text');
  node.setAttribute('x', String(x));
  node.setAttribute('y', String(y));
  node.setAttribute('fill', fill);
  node.setAttribute('font-size', String(size));
  node.setAttribute('font-weight', weight);
  node.setAttribute('text-anchor', anchor);
  node.textContent = text;
  svg.appendChild(node);
}

function addDefs(svg: SVGSVGElement, id: string) {
  const defs = svgEl('defs');
  const glow = svgEl('filter');
  glow.id = `${id}-glow`;
  glow.setAttribute('x', '-80%');
  glow.setAttribute('y', '-80%');
  glow.setAttribute('width', '260%');
  glow.setAttribute('height', '260%');
  const blur = svgEl('feGaussianBlur');
  blur.setAttribute('stdDeviation', '3');
  blur.setAttribute('result', 'blur');
  glow.appendChild(blur);
  defs.appendChild(glow);
  svg.insertBefore(defs, svg.firstChild);
}

function buildWorkFlowMap(container: Element) {
  if (container.querySelector('.wo-live-map-flow')) return;
  const nodes = Array.from(container.querySelectorAll<HTMLElement>('.wo-node'));
  if (nodes.length < 2) return;

  const values = nodes.map(node => numericText(node.querySelector('b')?.textContent || '0'));
  const labels = nodes.map(node => node.querySelector('small')?.textContent?.split(' · ')[0] || 'WORK');
  const max = Math.max(1, ...values);
  const width = 620;
  const height = 150;
  const centerX = width / 2;
  const centerY = 72;
  const radiusX = 218;
  const radiusY = 45;

  const svg = svgEl('svg');
  svg.classList.add('wo-live-map-flow');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-label', 'Worker work intelligence map');
  addDefs(svg, 'flow-map');

  const grid = svgEl('path');
  grid.setAttribute('d', `M28 ${centerY} H${width - 28} M${centerX} 20 V124`);
  grid.setAttribute('stroke', 'rgba(103,232,249,.08)');
  grid.setAttribute('stroke-width', '1');
  grid.setAttribute('stroke-dasharray', '3 8');
  svg.appendChild(grid);

  const title = svgEl('text');
  title.setAttribute('x', '16'); title.setAttribute('y', '14');
  title.setAttribute('fill', '#8192ae'); title.setAttribute('font-size', '7'); title.setAttribute('font-weight', '900');
  title.textContent = 'LIVE WORK INTELLIGENCE MAP';
  svg.appendChild(title);

  const points = values.map((value, index) => {
    const angle = values.length === 2 ? (index === 0 ? Math.PI : 0) : Math.PI + (Math.PI * index) / (values.length - 1);
    return { x: centerX + Math.cos(angle) * radiusX, y: centerY + Math.sin(angle) * radiusY, value };
  });

  points.forEach(point => {
    const connector = svgEl('path');
    connector.setAttribute('d', `M ${centerX} ${centerY} Q ${(centerX + point.x) / 2} ${(centerY + point.y) / 2 - 8} ${point.x} ${point.y}`);
    connector.setAttribute('fill', 'none'); connector.setAttribute('stroke', 'rgba(103,232,249,.26)'); connector.setAttribute('stroke-width', '1.5');
    svg.appendChild(connector);
  });

  const halo = svgEl('circle');
  halo.setAttribute('cx', String(centerX)); halo.setAttribute('cy', String(centerY)); halo.setAttribute('r', '27');
  halo.setAttribute('fill', 'rgba(34,211,238,.07)'); halo.setAttribute('stroke', 'rgba(103,232,249,.35)'); halo.setAttribute('stroke-width', '1');
  svg.appendChild(halo);
  addText(svg, 'WORK', centerX, centerY - 2, 8, '#dffbff', '950', 'middle');
  addText(svg, `${values.reduce((a, b) => a + b, 0).toLocaleString('en-PK')}`, centerX, centerY + 11, 8, '#67e8f9', '950', 'middle');

  points.forEach((point, index) => {
    const r = 10 + (point.value / max) * 7;
    const glow = svgEl('circle');
    glow.setAttribute('cx', String(point.x)); glow.setAttribute('cy', String(point.y)); glow.setAttribute('r', String(r + 7));
    glow.setAttribute('fill', 'rgba(124,58,237,.08)'); glow.setAttribute('filter', 'url(#flow-map-glow)');
    svg.appendChild(glow);

    const dot = svgEl('circle');
    dot.setAttribute('cx', String(point.x)); dot.setAttribute('cy', String(point.y)); dot.setAttribute('r', String(r));
    dot.setAttribute('fill', 'rgba(7,17,30,.95)'); dot.setAttribute('stroke', index % 2 ? '#a78bfa' : '#67e8f9'); dot.setAttribute('stroke-width', '2');
    svg.appendChild(dot);
    addText(svg, labels[index], point.x, point.y - 2, 6, '#9aaac0', '900', 'middle');
    addText(svg, point.value.toLocaleString('en-PK'), point.x, point.y + 8, 7, '#f5fbff', '950', 'middle');
  });

  container.parentElement?.insertBefore(svg, container.nextSibling);
}

function buildVolumeMap(container: Element) {
  if (container.querySelector('.wo-live-map-volume')) return;
  const cards = Array.from(container.querySelectorAll<HTMLElement>('.wo-v'));
  if (!cards.length) return;

  const pairs = [
    { label: 'TODAY', current: numericText(cards[0]?.querySelector('strong')?.textContent || '0'), previous: numericText(cards[1]?.querySelector('strong')?.textContent || '0') },
    { label: 'WEEK', current: numericText(cards[2]?.querySelector('strong')?.textContent || '0'), previous: numericText(cards[3]?.querySelector('strong')?.textContent || '0') },
    { label: 'MONTH', current: numericText(cards[4]?.querySelector('strong')?.textContent || '0'), previous: numericText(cards[5]?.querySelector('strong')?.textContent || '0') },
  ];
  const width = 620;
  const height = 160;
  const centerX = width / 2;
  const centerY = 76;
  const max = Math.max(1, ...pairs.flatMap(pair => [pair.current, pair.previous]));
  const svg = svgEl('svg');
  svg.classList.add('wo-live-map-volume');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-label', 'Worker work volume comparison map');
  addDefs(svg, 'volume-map');
  addText(svg, 'CURRENT VS PREVIOUS PERIOD', 16, 14, 7, '#8192ae', '900');

  const ring = svgEl('circle');
  ring.setAttribute('cx', String(centerX)); ring.setAttribute('cy', String(centerY)); ring.setAttribute('r', '30');
  ring.setAttribute('fill', 'rgba(124,58,237,.08)'); ring.setAttribute('stroke', 'rgba(167,139,250,.35)');
  svg.appendChild(ring);
  addText(svg, 'VOLUME', centerX, centerY - 2, 7, '#ddd6fe', '950', 'middle');
  addText(svg, pairs.reduce((sum, pair) => sum + pair.current, 0).toLocaleString('en-PK'), centerX, centerY + 11, 8, '#67e8f9', '950', 'middle');

  pairs.forEach((pair, index) => {
    const angle = -Math.PI / 2 + (index - 1) * (Math.PI / 3);
    const x = centerX + Math.cos(angle) * 190;
    const y = centerY + Math.sin(angle) * 52;
    const currentLen = 48 + (pair.current / max) * 48;
    const previousLen = 28 + (pair.previous / max) * 28;

    const connector = svgEl('path');
    connector.setAttribute('d', `M ${centerX} ${centerY} L ${x} ${y}`);
    connector.setAttribute('stroke', 'rgba(255,255,255,.08)'); connector.setAttribute('stroke-width', '1'); connector.setAttribute('stroke-dasharray', '2 6'); connector.setAttribute('fill', 'none');
    svg.appendChild(connector);

    const node = svgEl('circle');
    node.setAttribute('cx', String(x)); node.setAttribute('cy', String(y)); node.setAttribute('r', '21');
    node.setAttribute('fill', 'rgba(7,17,30,.96)'); node.setAttribute('stroke', index === 1 ? '#a78bfa' : '#67e8f9'); node.setAttribute('stroke-width', '2');
    svg.appendChild(node);
    addText(svg, pair.label, x, y - 2, 6, '#9aaac0', '900', 'middle');
    addText(svg, pair.current.toLocaleString('en-PK'), x, y + 9, 8, '#f5fbff', '950', 'middle');

    const current = svgEl('line');
    current.setAttribute('x1', String(x - currentLen / 2)); current.setAttribute('x2', String(x + currentLen / 2)); current.setAttribute('y1', String(y + 31)); current.setAttribute('y2', String(y + 31));
    current.setAttribute('stroke', '#67e8f9'); current.setAttribute('stroke-width', '4'); current.setAttribute('stroke-linecap', 'round');
    svg.appendChild(current);
    const previous = svgEl('line');
    previous.setAttribute('x1', String(x - previousLen / 2)); previous.setAttribute('x2', String(x + previousLen / 2)); previous.setAttribute('y1', String(y + 39)); previous.setAttribute('y2', String(y + 39));
    previous.setAttribute('stroke', '#64748b'); previous.setAttribute('stroke-width', '3'); previous.setAttribute('stroke-linecap', 'round');
    svg.appendChild(previous);
  });

  addText(svg, 'CURRENT', 18, height - 11, 6, '#67e8f9', '900');
  addText(svg, 'PREVIOUS', 74, height - 11, 6, '#64748b', '900');
  container.insertBefore(svg, container.firstChild);
}

function buildFinanceMap(container: Element) {
  if (container.querySelector('.wo-live-map-finance')) return;
  const boxes = Array.from(container.querySelectorAll<HTMLElement>('.wo-finbox'));
  if (boxes.length < 3) return;
  const earnings = numericText(boxes[0].querySelector('strong')?.textContent || '0');
  const received = numericText(boxes[2].querySelector('strong')?.textContent || '0');
  const remaining = earnings - received;
  const width = 620;
  const height = 160;
  const centerX = width / 2;
  const centerY = 78;
  const svg = svgEl('svg');
  svg.classList.add('wo-live-map-finance');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-label', 'Worker finance intelligence map');
  addDefs(svg, 'finance-map');
  addText(svg, 'MONEY FLOW POSITION', 16, 14, 7, '#8192ae', '900');

  const nodes = [
    { label: 'EARNINGS', value: earnings, x: 110, color: '#67e8f9' },
    { label: 'RECEIVED', value: received, x: 310, color: '#a78bfa' },
    { label: 'POSITION', value: remaining, x: 510, color: remaining < 0 ? '#fbbf24' : '#bef264' },
  ];

  const path = svgEl('path');
  path.setAttribute('d', `M110 ${centerY} C190 ${centerY - 34},230 ${centerY + 34},310 ${centerY} S430 ${centerY - 34},510 ${centerY}`);
  path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'rgba(103,232,249,.24)'); path.setAttribute('stroke-width', '2'); path.setAttribute('stroke-dasharray', '5 7');
  svg.appendChild(path);

  nodes.forEach(node => {
    const glow = svgEl('circle');
    glow.setAttribute('cx', String(node.x)); glow.setAttribute('cy', String(centerY)); glow.setAttribute('r', '34');
    glow.setAttribute('fill', node.color); glow.setAttribute('fill-opacity', '.05'); glow.setAttribute('filter', 'url(#finance-map-glow)');
    svg.appendChild(glow);
    const circle = svgEl('circle');
    circle.setAttribute('cx', String(node.x)); circle.setAttribute('cy', String(centerY)); circle.setAttribute('r', '25');
    circle.setAttribute('fill', 'rgba(7,17,30,.96)'); circle.setAttribute('stroke', node.color); circle.setAttribute('stroke-width', '2');
    svg.appendChild(circle);
    addText(svg, node.label, node.x, centerY - 3, 6, '#9aaac0', '900', 'middle');
    addText(svg, money(node.value), node.x, centerY + 9, 7, '#f5fbff', '950', 'middle');
  });

  addText(svg, remaining < 0 ? 'RECEIVED IS AHEAD OF EARNINGS' : remaining > 0 ? 'EARNINGS STILL OPEN' : 'LEDGER IS BALANCED', centerX, 135, 7, remaining < 0 ? '#fbbf24' : '#67e8f9', '950', 'middle');
  container.parentElement?.insertBefore(svg, container);
}

export function WorkerOverallHealthCard({ todayEntries, weekEntries, remaining }: Props) {
  const work = workSignal(todayEntries, weekEntries);
  const finance = financeSignal(Number(remaining || 0));

  useEffect(() => {
    const root = document.querySelector('.wo');
    if (!root) return;
    buildWorkFlowMap(root.querySelector('.wo-flow') || root);
    buildVolumeMap(root.querySelector('.wo-volume') || root);
    buildFinanceMap(root.querySelector('.wo-fin') || root);
  }, [todayEntries, weekEntries, remaining]);

  return (
    <section className="wo-card wo-health-card">
      <style>{`.wo-health-card{position:relative;overflow:hidden}.wo-health-card:before{content:"";position:absolute;inset:-70px -45px auto auto;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(34,211,238,.2),rgba(124,58,237,.08) 42%,transparent 70%);pointer-events:none}.wo-health-card:after{content:"";position:absolute;inset:auto -20px -90px auto;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(167,139,250,.13),transparent 68%);pointer-events:none}.wo-health-grid{position:relative;z-index:1;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px}.wo-health-signal{position:relative;min-height:92px;padding:12px;border-radius:17px;background:linear-gradient(145deg,rgba(255,255,255,.065),rgba(255,255,255,.025));border:1px solid rgba(255,255,255,.1);box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 10px 24px rgba(0,0,0,.12);overflow:hidden}.wo-health-signal:before{content:"";position:absolute;top:0;left:0;width:34px;height:2px;background:currentColor;box-shadow:0 0 14px currentColor;opacity:.9}.wo-health-signal:after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:currentColor;opacity:.38}.wo-health-signal small{display:block;font-size:6px;color:#8192ae;font-weight:950;letter-spacing:.14em}.wo-health-signal strong{display:block;margin-top:7px;font-size:10px;letter-spacing:.02em}.wo-health-signal span{display:block;margin-top:5px;font-size:7px;color:#9aaac0;line-height:1.4}.wo-health-signal.lime{color:#bef264}.wo-health-signal.cyan{color:#67e8f9}.wo-health-signal.violet{color:#c4b5fd}.wo-health-signal.amber{color:#fbbf24}.wo-health-signal.muted{color:#94a3b8}.wo-health-note{position:relative;z-index:1;margin-top:9px;padding:9px 10px;border:1px solid rgba(34,211,238,.1);border-left:3px solid #22d3ee;border-radius:11px;background:linear-gradient(90deg,rgba(34,211,238,.07),rgba(34,211,238,.02));color:#91a2bd;font-size:7px;line-height:1.5}.wo-live-map-flow,.wo-live-map-volume,.wo-live-map-finance{display:block;width:100%;height:auto;margin-top:12px;padding:7px;border:1px solid rgba(255,255,255,.08);border-radius:18px;background:radial-gradient(circle at 50% 50%,rgba(124,58,237,.09),rgba(255,255,255,.025) 45%,rgba(255,255,255,.012));box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 12px 28px rgba(0,0,0,.16)}.wo-live-map-finance{margin-bottom:10px}@media(max-width:400px){.wo-health-grid{grid-template-columns:1fr}}`}</style>
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
