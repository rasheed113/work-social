(() => {
  const PROGRESS_TICKER_SELECTOR = '.wo-ticker';
  const PORTAL_CLASS = 'wslc-context-portal';
  const SOURCE_CLOCK_CLASS = 'wslc-source-clock';
  const SPEED_PX_PER_SECOND = 54;
  const WEATHER_REFRESH_MS = 15 * 60 * 1000;
  let initialized = false;
  let frameId = 0;
  let lastFrameTime = 0;
  let offset = 0;
  let groupWidth = 0;
  let currentWeather = null;
  let portal = null;
  let portalHost = null;

  const formatDate = (now) => now.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric', year:'numeric' });
  const weatherText = (code) => ({0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Foggy',48:'Rime fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',56:'Light freezing drizzle',57:'Freezing drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',66:'Light freezing rain',67:'Freezing rain',71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',80:'Light showers',81:'Showers',82:'Heavy showers',85:'Light snow showers',86:'Snow showers',95:'Thunderstorm',96:'Thunderstorm with hail',99:'Thunderstorm with heavy hail'})[Number(code)] || 'Current weather';
  const weatherIcon = (code) => { const n=Number(code); if(n===0)return '☀'; if([1,2].includes(n))return '◐'; if([3,45,48].includes(n))return '☁'; if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(n))return '◒'; if([71,73,75,77,85,86].includes(n))return '❄'; if([95,96,99].includes(n))return 'ϟ'; return '•'; };
  const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]);

  function findWelcome() {
    return Array.from(document.querySelectorAll('h1')).find((el) => /^Welcome back,/i.test((el.textContent || '').trim())) || null;
  }

  function findClock() {
    return document.querySelector('.wo-clock');
  }

  function itemHtml(dateText) {
    const weatherMarkup = currentWeather
      ? `<span class="wslc-weather"><b>${escapeHtml(weatherIcon(currentWeather.code))}</b> ${escapeHtml(currentWeather.place)} · ${escapeHtml(currentWeather.temperature)}°C · ${escapeHtml(weatherText(currentWeather.code))}</span>`
      : '<span class="wslc-weather wslc-weather-muted"><b>⌖</b> Weather appears when location access is enabled</span>';
    return `<span class="wslc-item wslc-date">${escapeHtml(dateText)}</span><i>◆</i>${weatherMarkup}<i>◆</i>`;
  }

  function ensurePortal() {
    const sourceClock = findClock();
    const progressTicker = document.querySelector(PROGRESS_TICKER_SELECTOR);
    const welcome = findWelcome();
    const hero = sourceClock?.closest('.wo-hero');
    if (!sourceClock || !progressTicker || !welcome || !hero) return null;

    sourceClock.classList.add(SOURCE_CLOCK_CLASS);
    if (!portal || !portal.isConnected || portalHost !== hero) {
      document.querySelectorAll(`.${PORTAL_CLASS}`).forEach((el) => el.remove());
      portal = document.createElement('div');
      portal.className = PORTAL_CLASS;
      portal.setAttribute('aria-label', 'Live date and weather');
      const clockClone = sourceClock.cloneNode(true);
      clockClone.classList.remove(SOURCE_CLOCK_CLASS);
      clockClone.classList.add('wslc-clock-banner');
      portal.appendChild(clockClone);
      const ticker = document.createElement('div');
      ticker.className = 'wslc-context-ticker';
      ticker.innerHTML = `<span class="wslc-window"><span class="wslc-track"><span class="wslc-group"></span><span class="wslc-group" aria-hidden="true"></span></span></span>`;
      portal.appendChild(ticker);
      hero.appendChild(portal);
      portalHost = hero;
      renderTicker();
    }
    return portal;
  }

  function positionPortal() {
    const sourceClock = findClock();
    const hero = sourceClock?.closest('.wo-hero');
    if (!portal || !sourceClock || !hero || portalHost !== hero) return;
    const clockRect = sourceClock.getBoundingClientRect();
    const heroRect = hero.getBoundingClientRect();
    portal.style.left = `${Math.round(clockRect.left - heroRect.left)}px`;
    portal.style.top = `${Math.round(clockRect.top - heroRect.top - 4)}px`;
    portal.style.width = `${Math.max(0, Math.round(heroRect.right - clockRect.left))}px`;
    const sourceTime = sourceClock.querySelector('.wo-time')?.textContent?.trim();
    const clonedTime = portal.querySelector('.wo-time');
    if (sourceTime && clonedTime) clonedTime.textContent = sourceTime;
  }

  function renderTicker() {
    if (!portal) return;
    const groups = portal.querySelectorAll('.wslc-group');
    if (groups.length < 2) return;
    const content = itemHtml(formatDate(new Date()));
    groups[0].innerHTML = content;
    groups[1].innerHTML = content;
    groupWidth = 0;
    requestAnimationFrame(measure);
  }

  function measure() {
    const group = portal?.querySelector('.wslc-group');
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
        renderTicker();
      } catch { /* keep date ticker; never invent weather */ }
    }, () => {}, { enableHighAccuracy:false, maximumAge:10*60*1000, timeout:10000 });
  }

  function animate(now) {
    if (!lastFrameTime) lastFrameTime = now;
    const delta = Math.min(50, now - lastFrameTime);
    lastFrameTime = now;
    const current = ensurePortal();
    if (current) {
      positionPortal();
      const track = current.querySelector('.wslc-track');
      if (track && groupWidth > 0) {
        offset += (delta / 1000) * SPEED_PX_PER_SECOND;
        if (offset >= 0) offset = -groupWidth;
        track.style.transform = `translate3d(${offset}px,0,0)`;
      }
    }
    frameId = requestAnimationFrame(animate);
  }

  function boot() {
    if (initialized) return;
    initialized = true;
    const wait = window.setInterval(() => {
      if (!document.querySelector(PROGRESS_TICKER_SELECTOR)) return;
      if (!findWelcome() || !findClock()) return;
      window.clearInterval(wait);
      ensurePortal();
      positionPortal();
      loadWeather();
      window.setInterval(loadWeather, WEATHER_REFRESH_MS);
      if (!frameId) frameId = requestAnimationFrame(animate);
    }, 120);
    window.addEventListener('resize', () => {
      positionPortal();
      requestAnimationFrame(measure);
    }, { passive:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
})();
