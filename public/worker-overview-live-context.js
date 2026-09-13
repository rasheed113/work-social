(() => {
  const SELECTOR = '.wo-ticker';
  const SPEED_PX_PER_SECOND = 54;
  const WEATHER_REFRESH_MS = 15 * 60 * 1000;
  let initialized = false;
  let frameId = 0;
  let lastFrameTime = 0;
  let offset = 0;
  let groupWidth = 0;

  const formatDate = (now) => now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const weatherText = (code) => ({0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',48:'Rime fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',56:'Light freezing drizzle',57:'Freezing drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',66:'Light freezing rain',67:'Freezing rain',71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',80:'Light showers',81:'Showers',82:'Heavy showers',85:'Light snow showers',86:'Snow showers',95:'Thunderstorm',96:'Thunderstorm with hail',99:'Thunderstorm with heavy hail'})[Number(code)] || 'Current weather';
  const weatherIcon = (code) => { const n=Number(code); if(n===0)return '☀'; if([1,2].includes(n))return '◐'; if([3,45,48].includes(n))return '☁'; if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(n))return '◒'; if([71,73,75,77,85,86].includes(n))return '❄'; if([95,96,99].includes(n))return 'ϟ'; return '•'; };
  const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]);

  function itemHtml(dateText, weather) {
    const weatherMarkup = weather
      ? `<span class="wslc-weather"><b>${escapeHtml(weatherIcon(weather.code))}</b> ${escapeHtml(weather.place)} · ${escapeHtml(weather.temperature)}°C · ${escapeHtml(weatherText(weather.code))}</span>`
      : '<span class="wslc-weather wslc-weather-muted"><b>⌖</b> Weather appears when location access is enabled</span>';
    return `<span class="wslc-item wslc-date">${escapeHtml(dateText)}</span><i>◆</i>${weatherMarkup}<i>◆</i>`;
  }

  function renderTicker(weather = null) {
    const ticker = document.querySelector(SELECTOR);
    if (!ticker) return;
    const content = itemHtml(formatDate(new Date()), weather);
    ticker.classList.add('wslc-ticker');
    ticker.setAttribute('aria-label', 'Live date and weather ticker');
    ticker.innerHTML = `<span class="wslc-label"><span class="wslc-dot"></span><b>LIVE</b></span><span class="wslc-window"><span class="wslc-track"><span class="wslc-group">${content}</span><span class="wslc-group" aria-hidden="true">${content}</span></span></span>`;
    offset = 0;
    groupWidth = 0;
    requestAnimationFrame(() => measure(ticker));
  }

  function measure(ticker) {
    const group = ticker.querySelector('.wslc-group');
    if (!group) return;
    groupWidth = group.getBoundingClientRect().width;
    if (groupWidth > 0) offset %= groupWidth;
  }

  async function loadWeather() {
    if (!navigator.geolocation) return renderTicker(null);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const { latitude, longitude } = coords;
        const params = new URLSearchParams({ latitude:String(latitude), longitude:String(longitude), current:'temperature_2m,weather_code', timezone:'auto' });
        const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
        if (!weatherResponse.ok) throw new Error('Weather request failed');
        const weatherData = await weatherResponse.json();
        const geoParams = new URLSearchParams({ latitude:String(latitude), longitude:String(longitude), count:'1', language:'en', format:'json' });
        const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/reverse?${geoParams}`);
        const geoData = geoResponse.ok ? await geoResponse.json() : null;
        const result = geoData?.results?.[0];
        renderTicker({ place:result?.name || result?.admin1 || 'Current location', temperature:Math.round(Number(weatherData.current?.temperature_2m)), code:Number(weatherData.current?.weather_code) });
      } catch { renderTicker(null); }
    }, () => renderTicker(null), { enableHighAccuracy:false, maximumAge:10*60*1000, timeout:10000 });
  }

  function animate(now) {
    if (!lastFrameTime) lastFrameTime = now;
    const delta = Math.min(50, now - lastFrameTime);
    lastFrameTime = now;
    const ticker = document.querySelector(SELECTOR);
    const track = ticker?.querySelector('.wslc-track');
    if (track && groupWidth > 0) {
      offset -= (delta / 1000) * SPEED_PX_PER_SECOND;
      if (offset <= -groupWidth) offset += groupWidth;
      track.style.transform = `translate3d(${offset}px,0,0)`;
    }
    frameId = requestAnimationFrame(animate);
  }

  function boot() {
    if (initialized) return;
    initialized = true;
    const wait = window.setInterval(() => {
      if (!document.querySelector(SELECTOR)) return;
      window.clearInterval(wait);
      renderTicker(null);
      loadWeather();
      window.setInterval(loadWeather, WEATHER_REFRESH_MS);
      if (!frameId) frameId = requestAnimationFrame(animate);
    }, 120);
    window.addEventListener('resize', () => { const ticker=document.querySelector(SELECTOR); if(ticker) requestAnimationFrame(() => measure(ticker)); }, { passive:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
})();
