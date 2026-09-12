import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase/client';

type RangeKey = 'today' | '7d' | '30d';
type Point = { bucket_at: string; taken_pieces: number; completed_pieces: number; activity_events: number };
type Totals = { taken_pieces: number; completed_pieces: number; activity_events: number };
type IntelligencePayload = { bucket_unit?: 'hour' | 'day'; series?: Point[]; current?: Totals; previous?: Totals };
type Props = { remainingPieces: number };

const ranges: Array<{ key: RangeKey; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
];

const num = (value: unknown) => Math.max(0, Number(value) || 0);
const pcs = (value: unknown) => num(value).toLocaleString('en-PK', { maximumFractionDigits: 0 });
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const changePct = (current: number, previous: number) => previous > 0 ? ((current - previous) / previous) * 100 : null;

function periodBounds(range: RangeKey) {
  const end = new Date();
  const start = new Date(end);
  if (range === 'today') start.setHours(0, 0, 0, 0);
  else start.setDate(start.getDate() - (range === '7d' ? 7 : 30));
  const duration = end.getTime() - start.getTime();
  const previousStart = new Date(start.getTime() - duration);
  return { start, end, previousStart, previousEnd: start };
}

function formatBucket(value: string, unit: 'hour' | 'day') {
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-PK', unit === 'hour' ? { hour: 'numeric', minute: '2-digit' } : { day: 'numeric', month: 'short' }).format(date);
}

function formatComparison(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  return `${value >= 0 ? '+' : ''}${value.toFixed(0)}%`;
}

function Signal({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'positive' | 'pressure' | 'neutral' }) {
  return <div className="wsi-signal"><span className={`wsi-signal-dot ${tone}`} aria-hidden="true" /><div><div className="wsi-signal-label">{label}</div><div className="wsi-signal-value">{value}</div></div></div>;
}

export function ContractorWorkIntelligence({ remainingPieces }: Props) {
  const [range, setRange] = useState<RangeKey>('7d');
  const [payload, setPayload] = useState<IntelligencePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      const { start, end, previousStart, previousEnd } = periodBounds(range);
      const result = await supabase.rpc('get_contractor_work_intelligence_phase2', {
        p_start: start.toISOString(),
        p_end: end.toISOString(),
        p_previous_start: previousStart.toISOString(),
        p_previous_end: previousEnd.toISOString(),
      });
      if (cancelled) return;
      if (result.error) {
        console.error('get_contractor_work_intelligence_phase2 failed', result.error);
        setPayload(null);
        setError('Work movement could not be loaded.');
      } else {
        setPayload((result.data ?? null) as IntelligencePayload | null);
      }
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [range]);

  const model = useMemo(() => {
    const series = Array.isArray(payload?.series) ? payload!.series!.map(point => ({ bucket_at: point.bucket_at, taken_pieces: num(point.taken_pieces), completed_pieces: num(point.completed_pieces), activity_events: num(point.activity_events) })) : [];
    const current = { taken_pieces: num(payload?.current?.taken_pieces), completed_pieces: num(payload?.current?.completed_pieces), activity_events: num(payload?.current?.activity_events) };
    const previous = { taken_pieces: num(payload?.previous?.taken_pieces), completed_pieces: num(payload?.previous?.completed_pieces), activity_events: num(payload?.previous?.activity_events) };
    const completedChange = changePct(current.completed_pieces, previous.completed_pieces);
    const takenChange = changePct(current.taken_pieces, previous.taken_pieces);
    const activityChange = changePct(current.activity_events, previous.activity_events);
    const momentum = completedChange !== null ? completedChange : activityChange;
    const max = Math.max(1, ...series.flatMap(point => [point.taken_pieces, point.completed_pieces]));
    const unit: 'hour' | 'day' = payload?.bucket_unit === 'hour' ? 'hour' : 'day';
    return { series, current, previous, completedChange, takenChange, activityChange, momentum, max, unit };
  }, [payload]);

  const width = 760;
  const height = 230;
  const padX = 18;
  const padY = 24;
  const chartWidth = width - padX * 2;
  const chartHeight = height - padY * 2;
  const points = model.series;
  const x = (index: number) => points.length <= 1 ? width / 2 : padX + (index / (points.length - 1)) * chartWidth;
  const y = (value: number) => padY + chartHeight - (clamp(value / model.max, 0, 1) * chartHeight);
  const takenPath = points.map((point, index) => `${index ? 'L' : 'M'} ${x(index).toFixed(2)} ${y(point.taken_pieces).toFixed(2)}`).join(' ');
  const completedPath = points.map((point, index) => `${index ? 'L' : 'M'} ${x(index).toFixed(2)} ${y(point.completed_pieces).toFixed(2)}`).join(' ');
  const takenArea = points.length > 1 ? `${takenPath} L ${x(points.length - 1)} ${height - padY} L ${x(0)} ${height - padY} Z` : '';
  const completedArea = points.length > 1 ? `${completedPath} L ${x(points.length - 1)} ${height - padY} L ${x(0)} ${height - padY} Z` : '';
  const noHistory = points.length === 0;
  const sparse = points.length === 1;
  const comparisonText = model.completedChange === null ? 'NO PRIOR COMPLETION' : `${formatComparison(model.completedChange)} COMPLETED`;
  const momentumText = model.momentum === null ? 'NO BASELINE' : `${model.momentum >= 0 ? '↑' : '↓'} ${Math.abs(model.momentum).toFixed(0)}%`;
  const momentumTone = model.momentum === null ? 'neutral' : model.momentum >= 0 ? 'positive' : 'pressure';
  const baselineState = model.completedChange === null;

  return <section className="wsi" aria-labelledby="wsi-title">
    <style>{`
      .wsi{position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.94);border-radius:26px;padding:17px;background:linear-gradient(145deg,rgba(255,255,255,.92),rgba(239,246,255,.82) 54%,rgba(245,243,255,.9));box-shadow:0 26px 58px rgba(15,23,42,.09),0 8px 22px rgba(79,70,229,.06),inset 0 1px 0 rgba(255,255,255,.98);color:#172033}.wsi:before{content:"";position:absolute;inset:-80px auto auto 42%;width:260px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(34,211,238,.14),transparent 68%);pointer-events:none}.wsi-head{position:relative;display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.wsi-kicker{font-size:8px;font-weight:950;letter-spacing:.2em;color:#4f46e5}.wsi-title{margin:4px 0 0;font-size:21px;line-height:1.05;letter-spacing:-.045em;font-weight:950}.wsi-copy{margin:5px 0 0;max-width:540px;font-size:10px;line-height:1.45;color:#64748b;font-weight:750}.wsi-ranges{display:flex;gap:5px;padding:4px;border:1px solid rgba(148,163,184,.15);border-radius:13px;background:rgba(255,255,255,.55);box-shadow:inset 0 1px 0 #fff}.wsi-range{min-height:30px;padding:0 9px;border:0;border-radius:9px;background:transparent;color:#64748b;font:inherit;font-size:8px;font-weight:950;cursor:pointer}.wsi-range[aria-pressed=true]{background:linear-gradient(145deg,#eef2ff,#e0e7ff);color:#4338ca;box-shadow:0 5px 12px rgba(79,70,229,.1),inset 0 1px 0 #fff}.wsi-range:focus-visible{outline:2px solid rgba(99,102,241,.75);outline-offset:2px}.wsi-stage{position:relative;margin-top:14px;padding:10px 8px 6px;border:1px solid rgba(255,255,255,.82);border-radius:21px;background:linear-gradient(180deg,rgba(248,250,252,.64),rgba(239,246,255,.48));box-shadow:inset 0 1px 0 rgba(255,255,255,.92),inset 0 -12px 30px rgba(79,70,229,.025)}.wsi-chart{display:block;width:100%;height:auto;overflow:visible}.wsi-grid{stroke:rgba(100,116,139,.12);stroke-width:1}.wsi-axis{fill:#94a3b8;font-size:9px;font-weight:800}.wsi-taken-area{fill:url(#wsiTakenArea)}.wsi-done-area{fill:url(#wsiDoneArea)}.wsi-taken{fill:none;stroke:#4f46e5;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 4px 6px rgba(79,70,229,.2))}.wsi-done{fill:none;stroke:#10b981;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 3px 5px rgba(16,185,129,.18))}.wsi-point{stroke:#fff;stroke-width:2}.wsi-empty-chart{min-height:170px;display:grid;place-items:center;text-align:center;padding:22px}.wsi-empty-title{font-size:13px;font-weight:950;letter-spacing:-.02em}.wsi-empty-copy{margin:5px auto 0;max-width:390px;font-size:9px;line-height:1.5;color:#64748b;font-weight:750}.wsi-sparse-point{width:14px;height:14px;margin:0 auto 9px;border-radius:50%;background:linear-gradient(145deg,#4f46e5,#06b6d4);box-shadow:0 0 0 7px rgba(79,70,229,.09),0 8px 18px rgba(79,70,229,.2)}.wsi-legend{display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin:4px 5px 0}.wsi-legend-item{display:flex;align-items:center;gap:6px;font-size:8px;color:#64748b;font-weight:900}.wsi-legend-line{width:19px;height:3px;border-radius:99px}.wsi-legend-line.taken{background:#4f46e5}.wsi-legend-line.done{background:#10b981}.wsi-event-count{margin-left:auto;color:#94a3b8}.wsi-signals{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}.wsi-signal{display:flex;gap:8px;align-items:center;min-width:0;padding:9px 10px;border-radius:14px;border:1px solid rgba(255,255,255,.9);background:rgba(255,255,255,.58);box-shadow:inset 0 1px 0 #fff,0 8px 17px rgba(15,23,42,.035)}.wsi-signal-dot{width:7px;height:7px;flex:0 0 7px;border-radius:50%;background:#94a3b8;box-shadow:0 0 0 4px rgba(148,163,184,.1)}.wsi-signal-dot.positive{background:#10b981;box-shadow:0 0 0 4px rgba(16,185,129,.1)}.wsi-signal-dot.pressure{background:#f59e0b;box-shadow:0 0 0 4px rgba(245,158,11,.11)}.wsi-signal-label{font-size:7px;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8;font-weight:950}.wsi-signal-value{margin-top:2px;font-size:11px;color:#334155;font-weight:950;overflow-wrap:anywhere}.wsi-foot{position:relative;display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;margin-top:9px;padding:10px 11px;border-radius:16px;background:linear-gradient(145deg,rgba(239,246,255,.72),rgba(245,243,255,.68));border:1px solid rgba(129,140,248,.13);box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 8px 18px rgba(79,70,229,.035);overflow:hidden}.wsi-foot.baseline{background:linear-gradient(135deg,rgba(238,242,255,.86),rgba(236,254,255,.72) 55%,rgba(245,243,255,.84));border-color:rgba(99,102,241,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 10px 22px rgba(79,70,229,.07)}.wsi-foot.baseline:before{content:"";position:absolute;right:-24px;top:-42px;width:120px;height:100px;border-radius:50%;background:radial-gradient(circle,rgba(34,211,238,.2),transparent 70%);pointer-events:none}.wsi-foot-cell{position:relative;display:flex;align-items:center;min-width:0}.wsi-foot-mark{width:8px;height:8px;flex:0 0 8px;margin-right:8px;border-radius:50%;background:#94a3b8;box-shadow:0 0 0 4px rgba(148,163,184,.1)}.wsi-foot-mark.positive{background:#10b981;box-shadow:0 0 0 4px rgba(16,185,129,.11)}.wsi-foot-mark.pressure{background:#f59e0b;box-shadow:0 0 0 4px rgba(245,158,11,.12)}.wsi-foot-mark.neutral{background:#6366f1;box-shadow:0 0 0 4px rgba(99,102,241,.1)}.wsi-momentum,.wsi-comparison{font-size:7px;color:#64748b;font-weight:950;letter-spacing:.12em;white-space:nowrap}.wsi-momentum strong,.wsi-comparison strong{margin-left:7px;color:#4338ca;font-size:11px;letter-spacing:0}.wsi-comparison{text-align:right}.wsi-comparison strong{color:#475569}.wsi-foot.baseline .wsi-comparison strong{color:#0f766e}.wsi-error{padding:20px;text-align:center;font-size:9px;color:#64748b;font-weight:800}.wsi-loading{min-height:240px;display:grid;place-items:center;font-size:9px;color:#64748b;font-weight:850}@media(max-width:700px){.wsi-head{flex-direction:column}.wsi-ranges{align-self:stretch}.wsi-range{flex:1}.wsi-signals{grid-template-columns:1fr 1fr}.wsi-signal:last-child{grid-column:1/-1}.wsi-foot{grid-template-columns:1fr;align-items:flex-start}.wsi-comparison{text-align:left}.wsi-foot.baseline{padding:10px}}@media(max-width:430px){.wsi{padding:13px;border-radius:22px}.wsi-title{font-size:19px}.wsi-stage{padding:7px 4px 4px}.wsi-axis{font-size:8px}.wsi-signals{grid-template-columns:1fr}.wsi-signal:last-child{grid-column:auto}.wsi-foot{padding:9px 10px}}@media(prefers-reduced-motion:reduce){.wsi *{scroll-behavior:auto!important;animation:none!important;transition:none!important}}
    `}</style>
    <div className="wsi-head"><div><div className="wsi-kicker">WORK INTELLIGENCE</div><h2 id="wsi-title" className="wsi-title">How work is actually moving.</h2><p className="wsi-copy">Real taken work and real completed output, bucketed only where records exist. No synthetic history fills the surface.</p></div><div className="wsi-ranges" role="group" aria-label="Work intelligence time range">{ranges.map(item => <button key={item.key} className="wsi-range" type="button" aria-pressed={range===item.key} onClick={()=>setRange(item.key)}>{item.label}</button>)}</div></div>
    {loading ? <div className="wsi-stage wsi-loading" aria-label="Loading work intelligence">Reading real work movement…</div> : error ? <div className="wsi-stage wsi-error" role="alert">{error}</div> : <>
      <div className="wsi-stage">{noHistory ? <div className="wsi-empty-chart"><div><div className="wsi-empty-title">INSUFFICIENT HISTORY</div><div className="wsi-empty-copy">There are no real work records in this selected period. Additional recorded work is required before movement can be shown.</div></div></div> : sparse ? <div className="wsi-empty-chart"><div><div className="wsi-sparse-point" aria-hidden="true"/><div className="wsi-empty-title">ONE REAL MOVEMENT POINT</div><div className="wsi-empty-copy">The selected period contains one timestamped movement point. A trend is intentionally not drawn until more real history exists.</div><div className="wsi-axis" style={{marginTop:9}}>{formatBucket(points[0].bucket_at, model.unit)} · {pcs(points[0].completed_pieces)} completed · {pcs(points[0].taken_pieces)} taken</div></div></div> : <svg className="wsi-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Real work movement chart showing taken and completed pieces over the selected period"><defs><linearGradient id="wsiTakenArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#4f46e5" stopOpacity=".22"/><stop offset="1" stopColor="#4f46e5" stopOpacity="0"/></linearGradient><linearGradient id="wsiDoneArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#10b981" stopOpacity=".18"/><stop offset="1" stopColor="#10b981" stopOpacity="0"/></linearGradient></defs>{[0,.25,.5,.75,1].map(f=><line key={f} className="wsi-grid" x1={padX} x2={width-padX} y1={y(model.max*f)} y2={y(model.max*f)}/>)}{takenArea&&<path className="wsi-taken-area" d={takenArea}/>} {completedArea&&<path className="wsi-done-area" d={completedArea}/>} {takenPath&&<path className="wsi-taken" d={takenPath}/>} {completedPath&&<path className="wsi-done" d={completedPath}/>} {points.map((point,index)=><g key={point.bucket_at}><circle className="wsi-point" cx={x(index)} cy={y(point.taken_pieces)} r={point.taken_pieces>0?3.5:2.5} fill="#4f46e5"><title>{formatBucket(point.bucket_at,model.unit)} · Taken {pcs(point.taken_pieces)} · Completed {pcs(point.completed_pieces)} · {pcs(point.activity_events)} real events</title></circle>{point.completed_pieces>0&&<circle className="wsi-point" cx={x(index)} cy={y(point.completed_pieces)} r="3.5" fill="#10b981"/>}</g>)}{points.filter((_,index)=>index===0||index===points.length-1||index===Math.floor((points.length-1)/2)).map((point,index)=>{const original=points.indexOf(point);return <text key={`${point.bucket_at}-${index}`} className="wsi-axis" x={x(original)} y={height-5} textAnchor={original===0?'start':original===points.length-1?'end':'middle'}>{formatBucket(point.bucket_at,model.unit)}</text>})}</svg>}
      {!noHistory&&!sparse&&<div className="wsi-legend"><span className="wsi-legend-item"><span className="wsi-legend-line taken"/>Taken work</span><span className="wsi-legend-item"><span className="wsi-legend-line done"/>Completed output</span><span className="wsi-legend-item wsi-event-count">{pcs(model.current.activity_events)} real events</span></div>}
      </div>
      <div className="wsi-signals" aria-label="Work intelligence signals"><Signal label="Work volume" value={`${pcs(model.current.taken_pieces)} pcs${model.takenChange===null?'':` · ${formatComparison(model.takenChange)}`}`} tone={model.takenChange===null?'neutral':model.takenChange>=0?'positive':'pressure'}/><Signal label="Completed movement" value={`${pcs(model.current.completed_pieces)} pcs${model.completedChange===null?'':` · ${formatComparison(model.completedChange)}`} tone={model.completedChange===null?'neutral':model.completedChange>=0?'positive':'pressure'}/><Signal label="Current pressure" value={`${pcs(remainingPieces)} pcs remaining`} tone={remainingPieces>0?'pressure':'positive'}/></div>
      <div className={`wsi-foot ${baselineState ? 'baseline' : ''}`} aria-label={baselineState ? 'Completion comparison baseline state' : 'Work momentum comparison'}><div className="wsi-foot-cell"><span className={`wsi-foot-mark ${momentumTone}`} aria-hidden="true"/><div className="wsi-momentum">WORK MOMENTUM <strong>{momentumText}</strong></div></div><div className="wsi-foot-cell"><span className={`wsi-foot-mark ${model.completedChange === null ? 'neutral' : model.completedChange >= 0 ? 'positive' : 'pressure'}`} aria-hidden="true"/><div className="wsi-comparison">{baselineState ? 'COMPLETION BASELINE' : 'COMPLETION COMPARISON'} <strong>{comparisonText}</strong></div></div></div>
    </>}
  </section>;
}
