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

function svgEl<T extends keyof SVGElementTagNameMap>(tag: T) {
  return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

function addText(svg: SVGSVGElement, text: string, x: number, y: number, size = 7, fill = '#8192ae', weight = '800', anchor = 'start') {
  const node = svgEl('text');
  node.setAttribute('x', String(x)); node.setAttribute('y', String(y)); node.setAttribute('fill', fill); node.setAttribute('font-size', String(size)); node.setAttribute('font-weight', weight); node.setAttribute('text-anchor', anchor); node.textContent = text; svg.appendChild(node);
}

function addDefs(svg: SVGSVGElement, id: string) {
  const defs = svgEl('defs'); const glow = svgEl('filter'); glow.id = `${id}-glow`; glow.setAttribute('x', '-80%'); glow.setAttribute('y', '-80%'); glow.setAttribute('width', '260%'); glow.setAttribute('height', '260%'); const blur = svgEl('feGaussianBlur'); blur.setAttribute('stdDeviation', '3'); blur.setAttribute('result', 'blur'); glow.appendChild(blur); defs.appendChild(glow); svg.insertBefore(defs, svg.firstChild);
}

function numericText(value: string) { return Number(value.replace(/[^0-9.-]/g, '') || 0); }

function buildHealthMap(container: Element, todayEntries: number, weekEntries: number, remaining: number) {
  if (container.querySelector('.wo-live-map-health')) return;
  const width = 620; const height = 180; const centerY = 82;
  const svg = svgEl('svg'); svg.classList.add('wo-live-map-health'); svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-label', 'Worker overall health intelligence map'); addDefs(svg, 'health-map');
  addText(svg, 'LIVE POSITION MAP', 16, 14, 7, '#8192ae', '900');
  const workActive = todayEntries > 0; const financeAhead = remaining < 0;
  const nodes = [
    { label: 'WORK', state: workActive ? 'ACTIVE' : weekEntries > 0 ? 'QUIET' : 'EMPTY', value: `${todayEntries} today`, x: 118, color: workActive ? '#bef264' : '#67e8f9' },
    { label: 'HEALTH', state: workActive || weekEntries > 0 ? 'LIVE' : 'QUIET', value: 'REAL SIGNAL', x: 310, color: workActive || weekEntries > 0 ? '#67e8f9' : '#94a3b8' },
    { label: 'FINANCE', state: financeAhead ? 'AHEAD' : remaining > 0 ? 'OPEN' : 'BALANCED', value: money(Math.abs(remaining)), x: 502, color: financeAhead ? '#fbbf24' : remaining > 0 ? '#c4b5fd' : '#bef264' },
  ];
  const path = svgEl('path'); path.setAttribute('d', `M118 ${centerY} C190 ${centerY - 38},230 ${centerY + 38},310 ${centerY} S430 ${centerY - 38},502 ${centerY}`); path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'rgba(255,255,255,.16)'); path.setAttribute('stroke-width', '2'); path.setAttribute('stroke-dasharray', '4 7'); svg.appendChild(path);
  nodes.forEach((node, index) => { const glow = svgEl('circle'); glow.setAttribute('cx', String(node.x)); glow.setAttribute('cy', String(centerY)); glow.setAttribute('r', index === 1 ? '39' : '32'); glow.setAttribute('fill', node.color); glow.setAttribute('fill-opacity', index === 1 ? '.11' : '.055'); glow.setAttribute('filter', 'url(#health-map-glow)'); svg.appendChild(glow); const circle = svgEl('circle'); circle.setAttribute('cx', String(node.x)); circle.setAttribute('cy', String(centerY)); circle.setAttribute('r', index === 1 ? '29' : '25'); circle.setAttribute('fill', 'rgba(7,17,30,.97)'); circle.setAttribute('stroke', node.color); circle.setAttribute('stroke-width', index === 1 ? '2.5' : '2'); svg.appendChild(circle); addText(svg, node.label, node.x, centerY - 8, 7, '#9aaac0', '900', 'middle'); addText(svg, node.state, node.x, centerY + 3, 8, '#f5fbff', '950', 'middle'); addText(svg, node.value, node.x, centerY + 14, 6, node.color, '900', 'middle'); });
  addText(svg, financeAhead ? 'RECEIVED AHEAD · REAL FINANCE SIGNAL' : remaining > 0 ? 'BALANCE OPEN · REAL FINANCE SIGNAL' : 'BALANCED · REAL FINANCE SIGNAL', width / 2, 145, 7, financeAhead ? '#fbbf24' : '#67e8f9', '950', 'middle');
  container.querySelector('.wo-health-map-anchor')?.replaceWith(svg);
}

function buildFinanceProgress(container: Element) {
  const existing = container.querySelector('.wo-live-finance-progress');
  existing?.remove();
  const finance = container.querySelector('.wo-fin');
  if (!finance) return;
  const boxes = Array.from(finance.querySelectorAll('.wo-finbox strong')) as HTMLElement[];
  if (boxes.length < 3) return;
  const earned = numericText(boxes[1].textContent || boxes[0].textContent || '0');
  const received = numericText(boxes[2].textContent || '0');
  const ratio = earned > 0 ? received / earned : received > 0 ? 1 : 0;
  const coverage = earned > 0 ? ratio * 100 : 0;
  const remainingText = container.querySelector('.wo-rem')?.textContent || '';
  const remaining = numericText(remainingText);
  const ahead = remainingText.includes('-') || received > earned;
  const width = 620; const height = 184; const trackX = 38; const trackY = 72; const trackW = 544; const trackH = 24;
  const svg = svgEl('svg'); svg.classList.add('wo-live-finance-progress'); svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-label', 'Worker overall finance progress'); addDefs(svg, 'finance-progress');
  const defs = svg.querySelector('defs');
  const grad = svgEl('linearGradient'); grad.id = 'finance-progress-gradient'; grad.setAttribute('x1','0%'); grad.setAttribute('x2','100%'); const stops=[['0%','#22d3ee'],['48%','#3b82f6'],['78%','#8b5cf6'],['100%','#ec4899']]; stops.forEach(([offset,color])=>{const s=svgEl('stop');s.setAttribute('offset',offset);s.setAttribute('stop-color',color);defs?.appendChild(s)});
  const overflow = svgEl('linearGradient'); overflow.id='finance-overflow-gradient'; overflow.setAttribute('x1','0%'); overflow.setAttribute('x2','100%'); [['0%','#fbbf24'],['100%','#fb7185']].forEach(([offset,color])=>{const s=svgEl('stop');s.setAttribute('offset',offset);s.setAttribute('stop-color',color);defs?.appendChild(s)});
  addText(svg,'FINANCE COVERAGE PROGRESS',16,16,7,'#8192ae','950');
  addText(svg,earned>0?`${coverage.toFixed(1)}% RECEIVED / EARNED`:'NO EARNED BASE',604,16,7,ahead?'#fbbf24':'#67e8f9','950','end');
  const glow = svgEl('rect'); glow.setAttribute('x',String(trackX)); glow.setAttribute('y',String(trackY)); glow.setAttribute('width',String(trackW)); glow.setAttribute('height',String(trackH)); glow.setAttribute('rx','12'); glow.setAttribute('fill','url(#finance-progress-gradient)'); glow.setAttribute('opacity','.2'); glow.setAttribute('filter','url(#finance-progress-glow)'); svg.appendChild(glow);
  const bg = svgEl('rect'); bg.setAttribute('x',String(trackX)); bg.setAttribute('y',String(trackY)); bg.setAttribute('width',String(trackW)); bg.setAttribute('height',String(trackH)); bg.setAttribute('rx','12'); bg.setAttribute('fill','rgba(255,255,255,.055)'); bg.setAttribute('stroke','rgba(255,255,255,.09)'); svg.appendChild(bg);
  const fill = svgEl('rect'); fill.setAttribute('x',String(trackX)); fill.setAttribute('y',String(trackY)); fill.setAttribute('width',String(trackW)); fill.setAttribute('height',String(trackH)); fill.setAttribute('rx','12'); fill.setAttribute('fill','url(#finance-progress-gradient)'); fill.setAttribute('opacity','.92'); svg.appendChild(fill);
  const earnedRatio = received > 0 ? Math.min(earned / received,1) : 0;
  const markerX = trackX + trackW * earnedRatio;
  const marker = svgEl('line'); marker.setAttribute('x1',String(markerX)); marker.setAttribute('x2',String(markerX)); marker.setAttribute('y1',String(trackY-12)); marker.setAttribute('y2',String(trackY+trackH+12)); marker.setAttribute('stroke','#f8fbff'); marker.setAttribute('stroke-width','2'); marker.setAttribute('stroke-dasharray','3 4'); svg.appendChild(marker);
  const dot = svgEl('circle'); dot.setAttribute('cx',String(markerX)); dot.setAttribute('cy',String(trackY+trackH/2)); dot.setAttribute('r','6'); dot.setAttribute('fill','#fff'); dot.setAttribute('stroke','#22d3ee'); dot.setAttribute('stroke-width','3'); svg.appendChild(dot);
  addText(svg,'EARNED',trackX,124,7,'#91a4c2','900'); addText(svg,money(earned),trackX,137,10,'#67e8f9','950');
  addText(svg,'RECEIVED',trackX+trackW,124,7,'#91a4c2','900','end'); addText(svg,money(received),trackX+trackW,137,10,'#f0abfc','950','end');
  addText(svg,ahead ? `RECEIVED AHEAD · ${money(Math.abs(remaining))}` : remaining === 0 ? 'BALANCED · RECEIVED MATCHES EARNED' : `BALANCE OPEN · ${money(Math.abs(remaining))}`, width/2,165,7,ahead?'#fbbf24':'#67e8f9','950','middle');
  finance.insertAdjacentElement('afterend',svg);
}

export function WorkerOverallHealthCard({ todayEntries, weekEntries, remaining }: Props) {
  const work = workSignal(todayEntries, weekEntries); const finance = financeSignal(Number(remaining || 0));
  useEffect(() => { const root = document.querySelector('.wo'); if (!root) return; const card = root.querySelector('.wo-health-card'); if (card) buildHealthMap(card, todayEntries, weekEntries, Number(remaining || 0)); const financeCard = Array.from(root.querySelectorAll('.wo-card')).find(node => node.textContent?.includes('WORK → EARNING → RECEIVED')); if (financeCard) { financeCard.querySelector('.wo-actions')?.remove(); buildFinanceProgress(financeCard); } }, [todayEntries, weekEntries, remaining]);
  return (
    <section className="wo-card wo-health-card">
      <style>{`.wo-health-card{position:relative;overflow:hidden}.wo-health-card:before{content:"";position:absolute;inset:-70px -45px auto auto;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(34,211,238,.2),rgba(124,58,237,.08) 42%,transparent 70%);pointer-events:none}.wo-health-card:after{content:"";position:absolute;inset:auto -20px -90px auto;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(167,139,250,.13),transparent 68%);pointer-events:none}.wo-health-map-anchor{display:block;height:180px;margin-top:12px}.wo-live-map-health{display:block;width:100%;height:auto;padding:7px;border:1px solid rgba(255,255,255,.08);border-radius:18px;background:radial-gradient(circle at 50% 50%,rgba(124,58,237,.09),rgba(255,255,255,.025) 45%,rgba(255,255,255,.012));box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 12px 28px rgba(0,0,0,.16)}.wo-live-finance-progress{display:block;width:100%;height:auto;margin-top:10px;padding:7px;border:1px solid rgba(255,255,255,.08);border-radius:18px;background:linear-gradient(145deg,rgba(34,211,238,.055),rgba(124,58,237,.075),rgba(236,72,153,.045));box-shadow:inset 0 1px 0 rgba(255,255,255,.055),0 14px 32px rgba(0,0,0,.18)}.wo-health-note{position:relative;z-index:1;margin-top:9px;padding:9px 10px;border:1px solid rgba(34,211,238,.1);border-left:3px solid #22d3ee;border-radius:11px;background:linear-gradient(90deg,rgba(34,211,238,.07),rgba(34,211,238,.02));color:#91a2bd;font-size:7px;line-height:1.5}.wo-health-grid{display:none}@media(max-width:400px){.wo-health-map-anchor{height:180px}}`}</style>
      <div className="wo-eyebrow">04 · OVERALL HEALTH INTELLIGENCE</div>
      <h2>Real position map</h2>
      <p className="wo-muted">Live Worker health is expressed as connected work and finance signals — no artificial score.</p>
      <div className="wo-health-map-anchor" />
      <div className="wo-health-note">Real Worker data only. Work activity and finance position are connected visually without introducing a hidden health score or Contractor-domain data.</div>
    </section>
  );
}
