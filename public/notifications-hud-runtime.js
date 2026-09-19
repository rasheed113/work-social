(() => {
  const REPORT = 'ws-notification-report';
  const NOTE = 'ws-notification-report-note';
  const TIME = 'ws-notification-time';

  const styleReport = (article) => {
    if (!(article instanceof HTMLElement)) return;
    article.classList.add(REPORT);

    const time = article.querySelector('small');
    if (time instanceof HTMLElement) {
      time.classList.add(TIME);
      time.style.setProperty('color', '#c8ff66', 'important');
      time.style.setProperty('text-shadow', '0 0 9px rgba(200, 255, 102, .35)', 'important');
    }

    const decline = article.querySelector('.report-decline');
    const actionRow = decline instanceof HTMLElement ? decline.parentElement : null;
    if (!actionRow) return;

    const noteCandidates = Array.from(actionRow.parentElement?.children ?? []);
    const note = noteCandidates.find((el) => el instanceof HTMLElement && el !== actionRow && !el.querySelector('.report-decline'));
    if (note instanceof HTMLElement) {
      note.classList.add(NOTE);
      note.style.setProperty('color', '#ff69c8', 'important');
      note.style.setProperty('background', 'rgba(255, 47, 166, .10)', 'important');
      note.style.setProperty('border', '1px solid rgba(255, 82, 178, .24)', 'important');
      note.style.setProperty('border-radius', '10px', 'important');
      note.style.setProperty('text-shadow', '0 0 8px rgba(255, 82, 178, .22)', 'important');
    }
  };

  const scan = () => {
    document.querySelectorAll('article').forEach((article) => {
      if (article.querySelector('.report-decline')) styleReport(article);
      const time = article.querySelector('small');
      if (time instanceof HTMLElement) {
        time.classList.add(TIME);
        time.style.setProperty('color', '#c8ff66', 'important');
        time.style.setProperty('text-shadow', '0 0 9px rgba(200, 255, 102, .35)', 'important');
      }
    });
  };

  const start = () => {
    scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
