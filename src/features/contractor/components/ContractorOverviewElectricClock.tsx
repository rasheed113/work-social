import { useEffect, useMemo, useRef, useState } from 'react';

type Weather = { temperature: number; code: number; wind: number; zone: string };

function weatherText(code: number) {
  if (code === 0) return 'CLEAR';
  if ([1, 2, 3].includes(code)) return 'CLOUDY';
  if ([45, 48].includes(code)) return 'FOG';
  if ([51, 53, 55, 56, 57].includes(code)) return 'DRIZZLE';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'RAIN';
  if ([95, 96, 99].includes(code)) return 'STORM';
  return 'WEATHER';
}

export function ContractorOverviewElectricClock() {
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<Weather | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(coords.latitude)}&longitude=${encodeURIComponent(coords.longitude)}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`);
        if (!response.ok) return;
        const data = await response.json() as { current?: { temperature_2m?: number; weather_code?: number; wind_speed_10m?: number }; timezone?: string };
        if (cancelled || !data.current) return;
        setWeather({
          temperature: Number(data.current.temperature_2m ?? 0),
          code: Number(data.current.weather_code ?? 0),
          wind: Number(data.current.wind_speed_10m ?? 0),
          zone: (data.timezone?.split('/').pop() ?? 'LOCAL').replaceAll('_', ' ').toUpperCase(),
        });
      } catch {
        // Weather is optional; the clock remains functional without location permission.
      }
    }, () => undefined, { enableHighAccuracy: false, maximumAge: 15 * 60 * 1000, timeout: 7000 });
    return () => { cancelled = true; };
  }, []);

  const time = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const date = now.toLocaleDateString('en-PK', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  const weatherLine = weather
    ? `☀ ${weather.zone} · ${weather.temperature.toFixed(0)}°C · ${weatherText(weather.code)} · WIND ${weather.wind.toFixed(0)} KM/H`
    : '☁ WEATHER · ALLOW LOCATION FOR LIVE CONDITIONS';
  const items = useMemo(() => [`📅 ${date}`, weatherLine, '⚡ WORK SOCIAL · LIVE COMMAND CENTER'], [date, weatherLine]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    let last = performance.now();
    let offset = 0;
    const speed = 24;

    const tick = (timestamp: number) => {
      const elapsed = Math.min(64, timestamp - last);
      last = timestamp;
      offset += (speed * elapsed) / 1000;
      const halfWidth = track.scrollWidth / 2;
      if (halfWidth > 0 && offset >= halfWidth) offset -= halfWidth;
      track.style.transform = `translate3d(${-offset}px,0,0)`;
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [items]);

  return <section className="coec" aria-label="Live digital clock and weather">
    <div className="coec-glow" aria-hidden="true" />
    <div className="coec-label"><i />LIVE</div>
    <time className="coec-time" dateTime={now.toISOString()}>{time}</time>
    <div className="coec-window"><div ref={trackRef} className="coec-track">{[...items, ...items].map((item, index) => <span key={`${item}-${index}`}>{item}<b>·</b></span>)}</div></div>
  </section>;
}

const styles = `.coec{position:relative;display:flex;align-items:center;min-height:31px;margin:0 0 4px;overflow:hidden;border:1px solid rgba(183,255,0,.22);border-radius:12px;background:linear-gradient(105deg,rgba(4,10,18,.99),rgba(12,22,17,.97) 52%,rgba(7,14,12,.99));box-shadow:0 8px 22px rgba(2,6,23,.22),0 0 14px rgba(183,255,0,.055),inset 0 1px 0 rgba(255,255,255,.1),inset 0 -7px 15px rgba(0,0,0,.28)}.coec:before,.coec:after{content:"";position:absolute;z-index:4;top:0;bottom:0;width:30px;pointer-events:none}.coec:before{left:0;background:linear-gradient(90deg,#06100b,transparent)}.coec:after{right:0;background:linear-gradient(270deg,#06100b,transparent)}.coec-glow{position:absolute;inset:-24px;pointer-events:none;background:radial-gradient(circle at 17% 50%,rgba(183,255,0,.10),transparent 25%),radial-gradient(circle at 78% 50%,rgba(34,211,238,.045),transparent 28%);filter:blur(12px)}.coec-label{position:relative;z-index:5;display:flex;align-items:center;gap:6px;flex:0 0 auto;height:25px;margin-left:3px;padding:0 10px;border-radius:9px;background:linear-gradient(135deg,rgba(21,36,17,.98),rgba(38,61,15,.94));border:1px solid rgba(183,255,0,.2);box-shadow:0 5px 13px rgba(0,0,0,.3),0 0 8px rgba(183,255,0,.055),inset 0 1px 0 rgba(255,255,255,.13);color:#d9ff8a;font-size:7px;font-weight:950;letter-spacing:.13em}.coec-label i{width:5px;height:5px;border-radius:50%;background:#b7ff00;box-shadow:0 0 4px #b7ff00,0 0 8px rgba(183,255,0,.65);animation:coec-live 1.4s steps(2,end) infinite}.coec-time{position:relative;z-index:5;flex:0 0 auto;min-width:78px;margin-left:8px;color:#b7ff00;font-size:10px;font-weight:950;letter-spacing:.07em;font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased;text-shadow:0 0 1px rgba(183,255,0,.9),0 0 4px rgba(183,255,0,.65),0 0 9px rgba(132,204,22,.35);filter:drop-shadow(0 0 2px rgba(183,255,0,.35));animation:coec-electric 2.4s steps(1,end) infinite}.coec-window{position:relative;z-index:2;min-width:0;flex:1;overflow:hidden;height:29px;display:flex;align-items:center;mask-image:linear-gradient(90deg,transparent,#000 18px,#000 calc(100% - 18px),transparent);-webkit-mask-image:linear-gradient(90deg,transparent,#000 18px,#000 calc(100% - 18px),transparent)}.coec-track{display:flex;width:max-content;align-items:center;will-change:transform}.coec-track span{display:inline-flex;align-items:center;gap:9px;padding-left:17px;color:#b7ff00;font-size:7px;font-weight:900;letter-spacing:.055em;white-space:nowrap;text-shadow:0 0 5px currentColor}.coec-track span:nth-child(3n+2){color:#6ee7b7}.coec-track span:nth-child(3n){color:#c4b5fd}.coec-track b{font-size:10px;opacity:.45;color:#d9ff8a;text-shadow:none}@keyframes coec-live{0%,100%{opacity:.4;transform:scale(.78)}50%{opacity:1;transform:scale(1.2)}}@keyframes coec-electric{0%,18%,20%,48%,50%,100%{opacity:1}19%,49%{opacity:.78}70%{opacity:.94}}@media(max-width:620px){.coec{min-height:29px;margin-bottom:3px}.coec-label{height:23px;padding:0 8px;font-size:6px}.coec-time{font-size:9px;min-width:72px;margin-left:6px}.coec-track span{font-size:6.5px;padding-left:14px;gap:7px}}`;

if (typeof document !== 'undefined') {
  const existing = document.getElementById('coec-styles');
  if (existing) existing.remove();
  const style = document.createElement('style');
  style.id = 'coec-styles';
  style.textContent = styles;
  document.head.appendChild(style);
}
