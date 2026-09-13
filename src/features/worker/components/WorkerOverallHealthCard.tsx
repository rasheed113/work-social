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

export function WorkerOverallHealthCard({ todayEntries, weekEntries, remaining }: Props) {
  const work = workSignal(todayEntries, weekEntries); const finance = financeSignal(Number(remaining || 0));
  useEffect(() => { const root = document.querySelector('.wo'); if (!root) return; const card = root.querySelector('.wo-health-card'); if (card) buildHealthMap(card, todayEntries, weekEntries, Number(remaining || 0)); }, [todayEntries, weekEntries, remaining]);
  return (
    <section className="wo-card wo-health-card">
      <style>{`.wo-health-card{position:relative;overflow:hidden}.wo-health-card:before{content:"";position:absolute;inset:-70px -45px auto auto;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(34,211,238,.2),rgba(124,58,237,.08) 42%,transparent 70%);pointer-events:none}.wo-health-card:after{content:"";position:absolute;inset:auto -20px -90px auto;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(167,139,250,.13),transparent 68%);pointer-events:none}.wo-health-map-anchor{display:block;height:180px;margin-top:12px}.wo-live-map-health{display:block;width:100%;height:auto;padding:7px;border:1px solid rgba(255,255,255,.08);border-radius:18px;background:radial-gradient(circle at 50% 50%,rgba(124,58,237,.09),rgba(255,255,255,.025) 45%,rgba(255,255,255,.012));box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 12px 28px rgba(0,0,0,.16)}.wo-health-note{position:relative;z-index:1;margin-top:9px;padding:9px 10px;border:1px solid rgba(34,211,238,.1);border-left:3px solid #22d3ee;border-radius:11px;background:linear-gradient(90deg,rgba(34,211,238,.07),rgba(34,211,238,.02));color:#91a2bd;font-size:7px;line-height:1.5}.wo-health-grid{display:none}@media(max-width:400px){.wo-health-map-anchor{height:180px}}`}</style>
      <div className="wo-eyebrow">04 · OVERALL HEALTH INTELLIGENCE</div>
      <h2>Real position map</h2>
      <p className="wo-muted">Live Worker health is expressed as connected work and finance signals — no artificial score.</p>
      <div className="wo-health-map-anchor" />
      <div className="wo-health-note">Real Worker data only. Work activity and finance position are connected visually without introducing a hidden health score or Contractor-domain data.</div>
    </section>
  );
}
