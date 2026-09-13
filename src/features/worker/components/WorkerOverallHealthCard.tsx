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

function buildFinanceOrbit(container: Element) {
  const existing = container.querySelector('.wo-live-finance-orbit');
  existing?.remove();
  const finance = container.querySelector('.wo-fin');
  if (!finance) return;
  const boxes = Array.from(finance.querySelectorAll('.wo-finbox strong')) as HTMLElement[];
  if (boxes.length < 3) return;

  // Read the already-rendered authoritative finance values. This visual layer does not calculate accounting state.
  const earned = numericText(boxes[1].textContent || boxes[0].textContent || '0');
  const received = numericText(boxes[2].textContent || '0');
  const coverage = earned > 0 ? (received / earned) * 100 : 0;
  const remainingText = container.querySelector('.wo-rem')?.textContent || '';
  const remaining = numericText(remainingText);
  const ahead = remaining < 0 || received > earned;
  const delta = Math.abs(remaining);

  const width = 620; const height = 264; const cx = width / 2; const cy = 132;
  const svg = svgEl('svg');
  svg.classList.add('wo-live-finance-orbit');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-label', 'Worker financial orbit showing earned, received and live financial position');
  addDefs(svg, 'finance-orbit');

  const defs = svg.querySelector('defs');
  const grad = svgEl('linearGradient'); grad.id = 'finance-orbit-energy'; grad.setAttribute('x1','0%'); grad.setAttribute('y1','0%'); grad.setAttribute('x2','100%'); grad.setAttribute('y2','100%');
  [['0%','#22d3ee'],['38%','#3b82f6'],['68%','#8b5cf6'],['100%','#ec4899']].forEach(([offset,color]) => { const s=svgEl('stop'); s.setAttribute('offset',offset); s.setAttribute('stop-color',color); grad.appendChild(s); }); defs?.appendChild(grad);
  const coreGrad = svgEl('radialGradient'); coreGrad.id = 'finance-orbit-core';
  [['0%','#ec4899'],['38%','#8b5cf6'],['72%','#2563eb'],['100%','#07111e']].forEach(([offset,color]) => { const s=svgEl('stop'); s.setAttribute('offset',offset); s.setAttribute('stop-color',color); coreGrad.appendChild(s); }); defs?.appendChild(coreGrad);
  const soft = svgEl('filter'); soft.id = 'finance-orbit-soft'; soft.setAttribute('x','-100%'); soft.setAttribute('y','-100%'); soft.setAttribute('width','300%'); soft.setAttribute('height','300%'); const blur=svgEl('feGaussianBlur'); blur.setAttribute('stdDeviation','8'); soft.appendChild(blur); defs?.appendChild(soft);

  addText(svg, 'FINANCIAL ORBIT', 16, 16, 7, '#8192ae', '950');
  addText(svg, earned > 0 ? `${coverage.toFixed(1)}% COVERAGE` : 'NO EARNED BASE', width - 16, 16, 7, ahead ? '#fbbf24' : '#67e8f9', '950', 'end');

  const halo = svgEl('circle'); halo.setAttribute('cx',String(cx)); halo.setAttribute('cy',String(cy)); halo.setAttribute('r','92'); halo.setAttribute('fill','url(#finance-orbit-energy)'); halo.setAttribute('fill-opacity','.10'); halo.setAttribute('filter','url(#finance-orbit-soft)'); svg.appendChild(halo);
  [58,78,98].forEach((r, i) => { const ring=svgEl('circle'); ring.setAttribute('cx',String(cx)); ring.setAttribute('cy',String(cy)); ring.setAttribute('r',String(r)); ring.setAttribute('fill','none'); ring.setAttribute('stroke',i===1?'url(#finance-orbit-energy)':'rgba(255,255,255,.12)'); ring.setAttribute('stroke-width',i===1?'2.4':'1.2'); ring.setAttribute('stroke-dasharray',i===0?'2 9':i===1?'5 11':'12 8'); ring.setAttribute('opacity',i===1?'1':'.7'); if(i===1) ring.style.animation='woOrbitSpin 18s linear infinite'; if(i===2) ring.style.animation='woOrbitSpinReverse 28s linear infinite'; svg.appendChild(ring); });

  const core = svgEl('circle'); core.setAttribute('cx',String(cx)); core.setAttribute('cy',String(cy)); core.setAttribute('r','49'); core.setAttribute('fill','url(#finance-orbit-core)'); core.setAttribute('stroke','rgba(255,255,255,.24)'); core.setAttribute('stroke-width','1.5'); core.setAttribute('filter','url(#finance-orbit-glow)'); svg.appendChild(core);
  const inner = svgEl('circle'); inner.setAttribute('cx',String(cx)); inner.setAttribute('cy',String(cy)); inner.setAttribute('r','40'); inner.setAttribute('fill','rgba(4,10,22,.72)'); inner.setAttribute('stroke','rgba(255,255,255,.12)'); svg.appendChild(inner);

  addText(svg, ahead ? 'RECEIVED AHEAD' : remaining === 0 ? 'BALANCED' : 'BALANCE OPEN', cx, cy - 13, 8, ahead ? '#fbbf24' : '#67e8f9', '950', 'middle');
  addText(svg, money(delta), cx, cy + 7, 16, '#f8fbff', '950', 'middle');
  addText(svg, ahead ? 'LIVE FINANCIAL POSITION' : 'LIVE FINANCIAL POSITION', cx, cy + 23, 6, '#a9b8cc', '850', 'middle');

  const orbitPath = svgEl('circle'); orbitPath.setAttribute('cx',String(cx)); orbitPath.setAttribute('cy',String(cy)); orbitPath.setAttribute('r','78'); orbitPath.setAttribute('fill','none'); orbitPath.setAttribute('stroke','rgba(255,255,255,.04)'); orbitPath.setAttribute('stroke-width','1'); svg.appendChild(orbitPath);
  const receivedDot = svgEl('circle'); receivedDot.setAttribute('cx',String(cx+78)); receivedDot.setAttribute('cy',String(cy)); receivedDot.setAttribute('r','5'); receivedDot.setAttribute('fill','#ec4899'); receivedDot.setAttribute('filter','url(#finance-orbit-glow)'); receivedDot.style.transformOrigin=`${cx}px ${cy}px`; receivedDot.style.animation='woOrbitSpin 7s linear infinite'; svg.appendChild(receivedDot);
  const earnedDot = svgEl('circle'); earnedDot.setAttribute('cx',String(cx-78)); earnedDot.setAttribute('cy',String(cy)); earnedDot.setAttribute('r','4'); earnedDot.setAttribute('fill','#22d3ee'); earnedDot.setAttribute('filter','url(#finance-orbit-glow)'); earnedDot.style.transformOrigin=`${cx}px ${cy}px`; earnedDot.style.animation='woOrbitSpinReverse 11s linear infinite'; svg.appendChild(earnedDot);

  const particles = [
    [cx-104,cy-48,'#22d3ee'],[cx+108,cy-31,'#3b82f6'],[cx+101,cy+48,'#8b5cf6'],[cx-92,cy+54,'#ec4899'],[cx+18,cy-103,'#67e8f9'],[cx-31,cy+104,'#a78bfa']
  ];
  particles.forEach(([x,y,color],i)=>{const p=svgEl('circle'); p.setAttribute('cx',String(x)); p.setAttribute('cy',String(y)); p.setAttribute('r',i%2?'2.5':'2'); p.setAttribute('fill',String(color)); p.setAttribute('opacity','.85'); p.style.animation=`woEnergyPulse ${1.8+i*.23}s ease-in-out infinite alternate`; svg.appendChild(p);});

  addText(svg, 'EARNED', 48, 221, 7, '#91a4c2', '900'); addText(svg, money(earned), 48, 236, 10, '#67e8f9', '950');
  addText(svg, 'RECEIVED', width-48, 221, 7, '#91a4c2', '900', 'end'); addText(svg, money(received), width-48, 236, 10, '#f0abfc', '950', 'end');
  addText(svg, 'ENERGY SOURCE', 48, 249, 5.5, '#5eead4', '850'); addText(svg, 'CHARGED FLOW', width-48, 249, 5.5, '#f0abfc', '850', 'end');

  finance.insertAdjacentElement('afterend', svg);
}

export function WorkerOverallHealthCard({ todayEntries, weekEntries, remaining }: Props) {
  const work = workSignal(todayEntries, weekEntries); const finance = financeSignal(Number(remaining || 0));
  useEffect(() => { const root = document.querySelector('.wo'); if (!root) return; const card = root.querySelector('.wo-health-card'); if (card) buildHealthMap(card, todayEntries, weekEntries, Number(remaining || 0)); const financeCard = root.querySelector('.wo-fin')?.closest('.wo-card'); if (financeCard) { financeCard.querySelector('.wo-actions')?.remove(); buildFinanceOrbit(financeCard); } }, [todayEntries, weekEntries, remaining]);
  return (
    <section className="wo-card wo-health-card">
      <style>{`.wo-health-card{position:relative;overflow:hidden}.wo-health-card:before{content:"";position:absolute;inset:-70px -45px auto auto;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(34,211,238,.2),rgba(124,58,237,.08) 42%,transparent 70%);pointer-events:none}.wo-health-card:after{content:"";position:absolute;inset:auto -20px -90px auto;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(167,139,250,.13),transparent 68%);pointer-events:none}.wo-health-map-anchor{display:block;height:180px;margin-top:12px}.wo-live-map-health{display:block;width:100%;height:auto;padding:7px;border:1px solid rgba(255,255,255,.08);border-radius:18px;background:radial-gradient(circle at 50% 50%,rgba(124,58,237,.09),rgba(255,255,255,.025) 45%,rgba(255,255,255,.012));box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 12px 28px rgba(0,0,0,.16)}.wo-live-finance-orbit{display:block;width:100%;height:auto;margin-top:10px;padding:7px;border:1px solid rgba(255,255,255,.1);border-radius:20px;background:radial-gradient(circle at 50% 48%,rgba(59,130,246,.10),rgba(124,58,237,.075) 35%,rgba(236,72,153,.045) 62%,rgba(255,255,255,.012) 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 18px 38px rgba(15,23,42,.2)}.wo-live-finance-orbit text{font-family:inherit;letter-spacing:.03em}@keyframes woOrbitSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}@keyframes woOrbitSpinReverse{from{transform:rotate(360deg)}to{transform:rotate(0deg)}}@keyframes woEnergyPulse{from{opacity:.25;transform:scale(.75)}to{opacity:1;transform:scale(1.35)}}.wo-health-note{position:relative;z-index:1;margin-top:9px;padding:9px 10px;border:1px solid rgba(34,211,238,.1);border-left:3px solid #22d3ee;border-radius:11px;background:linear-gradient(90deg,rgba(34,211,238,.07),rgba(34,211,238,.02));color:#91a2bd;font-size:7px;line-height:1.5}.wo-health-grid{display:none}@media(max-width:400px){.wo-health-map-anchor{height:180px}.wo-live-finance-orbit{margin-top:8px}}@media(prefers-reduced-motion:reduce){.wo-live-finance-orbit *{animation:none!important}}`}</style>
      <div className="wo-eyebrow">04 · OVERALL HEALTH INTELLIGENCE</div>
      <h2>Real position map</h2>
      <p className="wo-muted">Live Worker health is expressed as connected work and finance signals — no artificial score.</p>
      <div className="wo-health-map-anchor" />
      <div className="wo-health-note">Real Worker data only. Work activity and finance position are connected visually without introducing a hidden health score or Contractor-domain data.</div>
    </section>
  );
}
