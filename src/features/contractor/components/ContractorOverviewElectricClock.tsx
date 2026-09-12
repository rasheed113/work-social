import { useEffect, useState } from 'react';

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
        // Weather is optional; the clock remains fully functional without location permission.
      }
    }, () => undefined, { enableHighAccuracy: false, maximumAge: 15 * 60 * 1000, timeout: 7000 });
    return () => { cancelled = true; };
  }, []);

  const time = now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const date = now.toLocaleDateString('en-PK', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  const weatherLine = weather
    ? `☀ ${weather.zone} · ${weather.temperature.toFixed(0)}°C · ${weatherText(weather.code)} · WIND ${weather.wind.toFixed(0)} KM/H`
    : '☁ WEATHER · ALLOW LOCATION FOR LIVE CONDITIONS';
  const items = [`📅 ${date}`, weatherLine, '⚡ WORK SOCIAL · LIVE COMMAND CENTER'];

  return <section className="coec" aria-label="Live digital clock and weather">
    <div className="coec-glow" aria-hidden="true" />
    <div className="coec-label"><i />LIVE</div>
    <div className="coec-time-shell">
      <span className="coec-time" aria-label={`Current time ${time}`}>{time}</span>
    </div>
    <div className="coec-window"><div className="coec-track">{[...items, ...items].map((item, index) => <span key={`${item}-${index}`}>{item}<b>·</b></span>)}</div></div>
  </section>;
}

const styles = `.coec{position:relative;display:flex;align-items:center;min-height:31px;margin:0 0 4px;overflow:hidden;border:1px solid rgba(148,163,184,.16);border-radius:12px;background:linear-gradient(105deg,rgba(5,12,27,.98),rgba(17,24,48,.94) 52%,rgba(10,15,32,.98));box-shadow:0 8px 22px rgba(2,6,23,.18),0 0 20px rgba(183,255,0,.1),inset 0 1px 0 rgba(255,255,255,.1),inset 0 -7px 15px rgba(0,0,0,.25)}.coec:before,.coec:after{content:"";position:absolute;z-index:4;top:0;bottom:0;width:28px;pointer-events:none}.coec:before{left:0;background:linear-gradient(90deg,#07101f,transparent)}.coec:after{right:0;background:linear-gradient(270deg,#07101f,transparent)}.coec-glow{position:absolute;inset:-20px;pointer-events:none;background:radial-gradient(circle at 20% 50%,rgba(183,255,0,.22),transparent 22%),radial-gradient(circle at 75% 50%,rgba(139,92,246,.1),transparent 27%);filter:blur(9px)}.coec-label{position:relative;z-index:5;display:flex;align-items:center;gap:6px;flex:0 0 auto;height:25px;margin-left:3px;padding:0 10px;border-radius:9px;background:linear-gradient(135deg,rgba(30,41,72,.98),rgba(49,46,129,.9));border:1px solid rgba(255,255,255,.11);box-shadow:0 5px 13px rgba(0,0,0,.25),inset 0 1px 0 rgba(255,255,255,.13);color:#f8fbff;font-size:7px;font-weight:950;letter-spacing:.13em}.coec-label i{width:5px;height:5px;border-radius:50%;background:#b7ff00;box-shadow:0 0 6px #b7ff00,0 0 14px rgba(183,255,0,.9),0 0 22px rgba(183,255,0,.55);animation:coec-live 1.8s ease-in-out infinite}.coec-time-shell{position:relative;z-index:5;flex:0 0 auto;display:flex;align-items:center;min-width:84px;height:25px;margin-left:7px;padding:0 7px;border-radius:8px;background:radial-gradient(circle at 50% 50%,rgba(183,255,0,.18),rgba(183,255,0,.04) 52%,transparent 76%);box-shadow:inset 0 0 12px rgba(183,255,0,.12),0 0 12px rgba(183,255,0,.18),0 0 24px rgba(183,255,0,.1)}.coec-time{display:block!important;color:#b7ff00!important;-webkit-text-fill-color:#b7ff00!important;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:10px;font-weight:950;letter-spacing:.07em;font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased;text-shadow:0 0 1px #b7ff00,0 0 4px #b7ff00,0 0 9px #b7ff00,0 0 16px rgba(183,255,0,1),0 0 28px rgba(132,204,22,.95),0 0 42px rgba(163,230,53,.72),0 0 58px rgba(163,230,53,.4);filter:drop-shadow(0 0 5px rgba(183,255,0,1));animation:coec-electric 2.4s steps(1,end) infinite}.coec-window{position:relative;z-index:2;min-width:0;flex:1;overflow:hidden;height:29px;display:flex;align-items:center;mask-image:linear-gradient(90deg,transparent,#000 18px,#000 calc(100% - 18px),transparent);-webkit-mask-image:linear-gradient(90deg,transparent,#000 18px,#000 calc(100% - 18px),transparent)}.coec-track{display:flex;width:max-content;align-items:center;animation:coec-scroll 18s linear infinite;will-change:transform}.coec-track span{display:inline-flex;align-items:center;gap:9px;padding-left:17px;color:#67e8f9;font-size:7px;font-weight:900;letter-spacing:.055em;white-space:nowrap;text-shadow:0 0 12px currentColor}.coec-track span:nth-child(3n+2){color:#6ee7b7}.coec-track span:nth-child(3n){color:#c4b5fd}.coec-track b{font-size:10px;opacity:.45;color:#cbd5e1;text-shadow:none}@keyframes coec-live{0%,100%{opacity:.5;transform:scale(.82)}50%{opacity:1;transform:scale(1.18)}}@keyframes coec-electric{0%,84%,100%{opacity:1;text-shadow:0 0 1px #b7ff00,0 0 4px #b7ff00,0 0 9px #b7ff00,0 0 16px rgba(183,255,0,1),0 0 28px rgba(132,204,22,.95),0 0 42px rgba(163,230,53,.72),0 0 58px rgba(163,230,53,.4)}86%{opacity:.72;text-shadow:0 0 2px #b7ff00,0 0 7px #b7ff00,0 0 16px rgba(183,255,0,.95),0 0 28px rgba(132,204,22,.8)}88%{opacity:1}90%{opacity:.82}92%{opacity:1}}@keyframes coec-scroll{from{transform:translate3d(0,0,0)}to{transform:translate3d(-50%,0,0)}}@media(max-width:620px){.coec{min-height:29px;margin-bottom:3px}.coec-label{height:23px;padding:0 8px;font-size:6px}.coec-time-shell{min-width:76px;height:23px;margin-left:5px;padding:0 5px}.coec-time{font-size:9px}.coec-track span{font-size:6.5px;padding-left:14px;gap:7px}}@media(prefers-reduced-motion:reduce){.coec-label i,.coec-time{animation:none!important}.coec-track{animation:coec-scroll 18s linear infinite!important}}`;

if (typeof document !== 'undefined' && !document.getElementById('coec-styles')) {
  const style = document.createElement('style');
  style.id = 'coec-styles';
  style.textContent = styles;
  document.head.appendChild(style);
}
