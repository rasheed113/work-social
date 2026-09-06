import { useMemo, useState } from 'react';
import {
  OVERVIEW_CARD_DEFINITIONS,
  readExpenseManagerPreferences,
  updateExpenseManagerPreferences,
} from '../data/expenseManagerPreferences';

interface ExpenseManagerSettingsPageProps { onNavigate: (path: string) => void; }

const COLORS = [
  ['White', '#ffffff'],
  ['Black', '#111827'],
  ['Green', '#047857'],
  ['Blue', '#2563eb'],
  ['Indigo', '#4f46e5'],
  ['Teal', '#0f766e'],
  ['Slate', '#475569'],
  ['Rose', '#be123c'],
  ['Amber', '#b45309'],
  ['Violet', '#7c3aed'],
] as const;

export function ExpenseManagerSettingsPage({ onNavigate }: ExpenseManagerSettingsPageProps) {
  const [preferences, setPreferences] = useState(readExpenseManagerPreferences);
  const cardCount = useMemo(() => Object.values(preferences.visibleCards).filter(Boolean).length, [preferences.visibleCards]);

  const update = (patch: Parameters<typeof updateExpenseManagerPreferences>[0]) => {
    setPreferences(updateExpenseManagerPreferences(patch));
  };

  const handleImage = (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 2_500_000) {
      window.alert('Please choose an image smaller than 2.5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update({ actionBarImage: typeof reader.result === 'string' ? reader.result : '' });
    reader.readAsDataURL(file);
  };

  return <section className="expense-manager-settings" aria-label="Overview personalization settings">
    <style>{`
      .expense-manager-settings{width:min(860px,100%);margin:0 auto;padding:0 2px 110px}
      .expense-manager-settings__back{display:inline-flex;align-items:center;gap:6px;margin:0 0 10px;padding:7px 9px;border:1px solid rgba(148,163,184,.16);border-radius:10px;background:rgba(255,255,255,.76);color:#475569;font:inherit;font-size:10px;font-weight:850;cursor:pointer;box-shadow:0 4px 12px rgba(15,23,42,.045)}
      .expense-manager-settings__hero{position:relative;margin-bottom:14px;padding:15px 16px;border:1px solid rgba(148,163,184,.18);border-radius:20px;background:linear-gradient(145deg,rgba(255,255,255,.96),rgba(248,250,252,.88));box-shadow:0 16px 34px rgba(15,23,42,.08),inset 0 1px 0 rgba(255,255,255,.95);overflow:hidden}.expense-manager-settings__hero::after{content:'';position:absolute;right:-45px;top:-55px;width:150px;height:150px;border-radius:50%;background:radial-gradient(circle,rgba(37,99,235,.12),transparent 68%);pointer-events:none}.expense-manager-settings__eyebrow{position:relative;z-index:1;color:#2563eb;font-size:9px;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.expense-manager-settings__hero-copy{position:relative;z-index:1;margin:4px 0 0;color:#475569;font-size:10px;font-weight:700;line-height:1.5}
      .expense-manager-settings__section{margin-top:12px;padding:15px;border:1px solid rgba(148,163,184,.16);border-radius:18px;background:rgba(255,255,255,.9);box-shadow:0 10px 25px rgba(15,23,42,.05)}
      .expense-manager-settings__section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.expense-manager-settings__section-head h2{margin:0;color:#172033;font-size:14px;font-weight:950}.expense-manager-settings__section-head p{margin:3px 0 0;color:#94a3b8;font-size:9px;font-weight:650;line-height:1.4}.expense-manager-settings__count{padding:5px 8px;border-radius:999px;background:#eff6ff;color:#2563eb;font-size:8px;font-weight:900;white-space:nowrap}
      .expense-manager-settings__swatches{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.expense-manager-settings__swatch{position:relative;display:flex;align-items:center;gap:8px;min-width:0;min-height:40px;padding:7px 9px;border:1px solid rgba(148,163,184,.18);border-radius:13px;background:linear-gradient(145deg,#fff,#f8fafc);color:#334155;font:inherit;font-size:9px;font-weight:850;text-align:left;cursor:pointer;box-shadow:0 4px 9px rgba(15,23,42,.045),inset 0 1px 0 rgba(255,255,255,.95);transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease,background .16s ease}.expense-manager-settings__swatch:hover{transform:translateY(-1px);border-color:rgba(37,99,235,.3);box-shadow:0 7px 14px rgba(15,23,42,.08),inset 0 1px 0 rgba(255,255,255,.95)}.expense-manager-settings__swatch:active{transform:translateY(1px);box-shadow:0 2px 5px rgba(15,23,42,.07),inset 0 1px 2px rgba(15,23,42,.04)}.expense-manager-settings__swatch[data-active=true]{border-color:rgba(37,99,235,.55);background:linear-gradient(145deg,#f8fbff,#eef5ff);box-shadow:0 0 0 2px rgba(37,99,235,.08),0 7px 15px rgba(37,99,235,.1),inset 0 1px 0 rgba(255,255,255,.95)}.expense-manager-settings__swatch-dot{width:22px;height:22px;flex:0 0 22px;border-radius:7px;border:1px solid rgba(15,23,42,.14);box-shadow:inset 0 1px 1px rgba(255,255,255,.45),0 2px 4px rgba(15,23,42,.1)}.expense-manager-settings__swatch-check{display:none;margin-left:auto;width:17px;height:17px;align-items:center;justify-content:center;border-radius:50%;background:#2563eb;color:#fff;font-size:9px;font-weight:950;box-shadow:0 2px 5px rgba(37,99,235,.25)}.expense-manager-settings__swatch[data-active=true] .expense-manager-settings__swatch-check{display:inline-flex}
      .expense-manager-settings__custom{display:flex;align-items:center;gap:8px;margin-top:10px}.expense-manager-settings__custom input{width:42px;height:32px;padding:2px;border:1px solid rgba(148,163,184,.2);border-radius:8px;background:#fff}.expense-manager-settings__custom label{color:#64748b;font-size:9px;font-weight:750}
      .expense-manager-settings__image{display:grid;gap:9px}.expense-manager-settings__upload{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px;border:1px dashed rgba(37,99,235,.22);border-radius:13px;background:#f8fbff}.expense-manager-settings__upload label{color:#334155;font-size:10px;font-weight:850}.expense-manager-settings__upload input{max-width:190px;font-size:9px}.expense-manager-settings__clear{justify-self:start;border:0;background:transparent;color:#be123c;font:inherit;font-size:9px;font-weight:850;cursor:pointer}.expense-manager-settings__preview{height:72px;border-radius:13px;border:1px solid rgba(148,163,184,.16);background-position:center;background-size:cover;box-shadow:inset 0 1px 0 rgba(255,255,255,.8)}
      .expense-manager-settings__cards{display:grid;gap:7px}.expense-manager-settings__card{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 11px;border:1px solid rgba(148,163,184,.12);border-radius:13px;background:#fff}.expense-manager-settings__card-name{color:#334155;font-size:10px;font-weight:850}.expense-manager-settings__toggle{position:relative;width:40px;height:22px;flex:0 0 40px;border:0;border-radius:999px;background:#cbd5e1;cursor:pointer;transition:background .16s ease}.expense-manager-settings__toggle::after{content:'';position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(15,23,42,.18);transition:transform .16s ease}.expense-manager-settings__toggle[data-on=true]{background:#2563eb}.expense-manager-settings__toggle[data-on=true]::after{transform:translateX(18px)}.expense-manager-settings__toggle:focus-visible{outline:2px solid rgba(37,99,235,.4);outline-offset:2px}
      @media(max-width:560px){.expense-manager-settings__swatches{grid-template-columns:repeat(2,minmax(0,1fr))}.expense-manager-settings__upload{align-items:flex-start;flex-direction:column}.expense-manager-settings__upload input{max-width:100%}}
    `}</style>
    <button type="button" className="expense-manager-settings__back" onClick={() => onNavigate('/expense-manager')}>‹ Overview</button>
    <header className="expense-manager-settings__hero"><span className="expense-manager-settings__eyebrow">Dashboard personalization</span><p className="expense-manager-settings__hero-copy">Personalize the Expense Manager workspace. Changes are saved on this device and apply to the Overview immediately.</p></header>

    <section className="expense-manager-settings__section">
      <div className="expense-manager-settings__section-head"><div><h2>Background color</h2><p>Choose the page surface behind your dashboard.</p></div></div>
      <div className="expense-manager-settings__swatches">{COLORS.map(([name, value]) => <button type="button" className="expense-manager-settings__swatch" data-active={preferences.backgroundColor === value} key={value} onClick={() => update({ backgroundColor: value })}><span className="expense-manager-settings__swatch-dot" style={{ background: value }} /><span>{name}</span><span className="expense-manager-settings__swatch-check" aria-hidden="true">✓</span></button>)}</div>
      <div className="expense-manager-settings__custom"><label htmlFor="expense-bg-color">Custom color</label><input id="expense-bg-color" type="color" value={preferences.backgroundColor} onChange={(event) => update({ backgroundColor: event.target.value })} /></div>
    </section>

    <section className="expense-manager-settings__section">
      <div className="expense-manager-settings__section-head"><div><h2>Action bar color</h2><p>Style the Expense Manager navigation bar.</p></div></div>
      <div className="expense-manager-settings__swatches">{COLORS.map(([name, value]) => <button type="button" className="expense-manager-settings__swatch" data-active={!preferences.actionBarImage && preferences.actionBarColor === value} key={`action-${value}`} onClick={() => update({ actionBarColor: value, actionBarImage: '' })}><span className="expense-manager-settings__swatch-dot" style={{ background: value }} /><span>{name}</span><span className="expense-manager-settings__swatch-check" aria-hidden="true">✓</span></button>)}</div>
      <div className="expense-manager-settings__custom"><label htmlFor="expense-action-color">Custom color</label><input id="expense-action-color" type="color" value={preferences.actionBarColor} onChange={(event) => update({ actionBarColor: event.target.value, actionBarImage: '' })} /></div>
      <div className="expense-manager-settings__image"><div className="expense-manager-settings__upload"><label htmlFor="expense-action-image">Gallery image</label><input id="expense-action-image" type="file" accept="image/*" onChange={(event) => handleImage(event.target.files?.[0])} /></div>{preferences.actionBarImage && <><div className="expense-manager-settings__preview" style={{ backgroundImage: `url(${preferences.actionBarImage})` }} /><button type="button" className="expense-manager-settings__clear" onClick={() => update({ actionBarImage: '' })}>Remove gallery image</button></>}</div>
    </section>

    <section className="expense-manager-settings__section">
      <div className="expense-manager-settings__section-head"><div><h2>Dashboard cards</h2><p>Show or hide every Overview card individually.</p></div><span className="expense-manager-settings__count">{cardCount}/{OVERVIEW_CARD_DEFINITIONS.length} visible</span></div>
      <div className="expense-manager-settings__cards">{OVERVIEW_CARD_DEFINITIONS.map(([key, label]) => { const visible = preferences.visibleCards[key] !== false; return <div className="expense-manager-settings__card" key={key}><span className="expense-manager-settings__card-name">{label}</span><button type="button" className="expense-manager-settings__toggle" data-on={visible} aria-pressed={visible} aria-label={`${visible ? 'Hide' : 'Show'} ${label}`} onClick={() => update({ visibleCards: { [key]: !visible } })} /></div>; })}</div>
    </section>
  </section>;
}
