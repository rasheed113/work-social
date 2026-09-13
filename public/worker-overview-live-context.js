(() => {
  const PROGRESS_TICKER_SELECTOR = '.wo-ticker';
  const CONTEXT_TICKER_CLASS = 'wslc-context-ticker';
  const CONTEXT_ROW_CLASS = 'wslc-context-row';
  const SPEED_PX_PER_SECOND = 54;
  const WEATHER_REFRESH_MS = 15 * 60 * 1000;
  let initialized = false;
  let frameId = 0;
  let lastFrameTime = 0;
  let offset = 0;
  let groupWidth = 0;
  let currentWeather = null;

  const formatDate = (now) => now.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric', year:'numeric' });
  const weatherText = (code) => ({0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',48:'Rime fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',56:'Light freezing drizzle',57:'Freezing drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',66:'Light freezing rain',67:'Freezing rain',71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',80:'Light showers',81:'Showers',82:'Heavy showers',85:'Light snow showers',86:'Snow showers',95:'Thunderstorm',96:'Thunderstorm with hail',99:'Thunderstorm with heavy hail'})[Number(code)] || 'Current weather';
  const weatherIcon = (code) => { const n=Number(code); if(n===0)return '☀'; if([1,2].includes(n))return '◐'; if([3,45,48].includes(n))return '☁'; if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(n))return '◒'; if([71,73,75,77,85,86].includes(n))return '❄'; if([95,96,99].includes(n))return 'ϟ'; return '•'; };
  const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]);

  function findWelcome() {
    return Array.from(document.querySelectorAll('h1')).find((el) => /^Welcome back,/i.test((el.textContent || '').trim())) || null;
  }

  function ensureClock() {
    const clock = document.querySelector('.wo-clock');
    if (!clock) return null;
    clock.classList.add('wslc-clock-banner');
    return clock;
  }

  function ensureContextTicker() {
    const progressTicker = document.querySelector(PROGRESS_TICKER_SELECTOR);
    const welcome = findWelcome();
    const clock = ensureClock();
    if (!progressTicker || !welcome || !progressTicker.parentElement) return null;
    let row = progressTicker.parentElement.querySelector(`.${CONTEXT_ROW_CLASS}`);
    if (!row) {
      row = document.createElement('div');
      row.className = CONTEXT_ROW_CLASS;
    }
    let ticker = row.querySelector(`.${CONTEXT_TICKER_CLASS}`);
    if (!ticker) {
      ticker = document.createElement('div');
      ticker.className = CONTEXT_TICKER_CLASS;
      ticker.setAttribute('aria-label', 'Live date and weather');
    }
    if (row.parentElement !== progressTicker.parentElement || row.nextElementSibling !== progressTicker) {
      progressTicker.parentElement.insertBefore(row, progressTicker);
    }
    if (clock && clock.parentElement !== row) row.insertBefore(clock, ticker);
    if (ticker.parentElement !== row) row.appendChild(ticker);
    return ticker;
  }

  function itemHtml(dateText) {
    const weatherMarkup = currentWeather
      ? `<span class="wslc-weather"><b>${escapeHtml(weatherIcon(currentWeather.code))}</b> ${escapeHtml(currentWeather.place)} · ${escapeHtml(currentWeather.temperature)}°C · ${escapeHtml(weatherText(currentWeather.code))}</span>`
      : '<span class="wslc-weather wslc-weather-muted"><b>⌖</b> Weather appears when location access is enabled</span>';
    return `<span class="wslc-item wslc-date">${escapeHtml(dateText)}</span><i>◆</i>${weatherMarkup}<i>◆</i>`;
  }

  function renderContextTicker() {
    const ticker = ensureContextTicker();
    if (!ticker) return;
    const content = itemHtml(formatDate(new Date()));
    ticker.classList.add('wslc-context-ticker');
    ticker.innerHTML = `<span class="wslc-window"><span class="wslc-track"><span class="wslc-group">${content}</span><span class="wslc-group" aria-hidden="true">${content}</span></span></span>`;
    groupWidth = 0;
    requestAnimationFrame(() => measure(ticker));
  }

  function measure(ticker) {
    const group = ticker.querySelector('.wslc-group');
    if (!group) return;
    groupWidth = group.getBoundingClientRect().width;
    if (groupWidth > 0) offset = -groupWidth;
  }

  async function loadWeather() {
    if (!navigator.geolocation) return;
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
        currentWeather = { place:result?.name || result?.admin1 || 'Current location', temperature:Math.round(Number(weatherData.current?.temperature_2m)), code:Number(weatherData.current?.weather_code) };
        renderContextTicker();
      } catch { /* keep date ticker; never invent weather */ }
    }, () => { /* location denied: keep weather absent rather than showing fake data */ }, { enableHighAccuracy:false, maximumAge:10*60*1000, timeout:10000 });
  }

  function animate(now) {
    if (!lastFrameTime) lastFrameTime = now;
    const delta = Math.min(50, now - lastFrameTime);
    lastFrameTime = now;
    ensureClock();
    const ticker = ensureContextTicker();
    const track = ticker?.querySelector('.wslc-track');
    if (track && groupWidth > 0) {
      offset += (delta / 1000) * SPEED_PX_PER_SECOND;
      if (offset >= 0) offset = -groupWidth;
      track.style.transform = `translate3d(${offset}px,0,0)`;
    }
    frameId = requestAnimationFrame(animate);
  }

  function boot() {
    if (initialized) return;
    initialized = true;
    const wait = window.setInterval(() => {
      if (!document.querySelector(PROGRESS_TICKER_SELECTOR)) return;
      if (!findWelcome()) return;
      window.clearInterval(wait);
      ensureClock();
      renderContextTicker();
      loadWeather();
      window.setInterval(loadWeather, WEATHER_REFRESH_MS);
      if (!frameId) frameId = requestAnimationFrame(animate);
    }, 120);
    window.addEventListener('resize', () => {
      const ticker = document.querySelector(`.${CONTEXT_TICKER_CLASS}`);
      if (ticker) requestAnimationFrame(() => measure(ticker));
    }, { passive:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
})();
