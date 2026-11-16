/* card.js - shared SVG icons + internship card markup.
   Used by internships.js, latest.js (home), detail-map.js and saved.js.
   Load AFTER config.js and BEFORE detail-map.js / saved.js. */
(() => {
  'use strict';

  const PATHS = {
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    bookmark: '<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/>',
    send: '<path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/>',
    external: '<path d="M14 3h7v7"/><path d="M21 3l-9 9"/><path d="M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>'
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const icon = (name, cls = 'ui-icon') =>
    `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${PATHS[name] || ''}</svg>`;

  const formatDate = (value, style = 'medium') => {
    if (!value) return '';
    try { return new Intl.DateTimeFormat(undefined, { dateStyle: style }).format(new Date(value)); }
    catch { return ''; }
  };
  // deadlines are plain dates (YYYY-MM-DD), so format them in UTC to avoid off-by-one days
  const formatDeadline = (value, style = 'medium') => {
    if (!value) return '';
    try { return new Intl.DateTimeFormat(undefined, { dateStyle: style, timeZone: 'UTC' }).format(new Date(value)); }
    catch { return ''; }
  };

  function infoRows(job) {
    const rows = [
      ['pin', 'Location', job.location],
      ['briefcase', 'Category', job.category],
      ['clock', 'Type', job.jobType],
      ['cash', 'Salary', job.salary]
    ];
    if (job.deadline) rows.push(['calendar', 'Apply by', formatDeadline(job.deadline)]);
    else if (job.date) rows.push(['calendar', 'Posted', formatDate(job.date)]);
    return rows.filter((row) => row[2]);
  }

  function applyButton(job) {
    if (!job.url) {
      return `<span class="card-btn card-btn--apply is-disabled" aria-disabled="true" title="No application link available">${icon('send')}<span class="btn-label">Apply</span></span>`;
    }
    const label = job.applyLabel || 'Apply on original listing';
    return `<a class="card-btn card-btn--apply" href="${esc(job.url)}" target="_blank" rel="noopener noreferrer" title="${esc(label)} (opens in a new tab)" aria-label="Apply for ${esc(job.title)} at ${esc(job.company)} (opens in a new tab)">${icon('send')}<span class="btn-label">Apply</span></a>`;
  }

  function cardHtml(job) {
    const info = infoRows(job).map(([name, label, value]) =>
      `<li>${icon(name)}<span class="card-info__label">${esc(label)}:</span> <span class="card-info__value">${esc(value)}</span></li>`).join('');
    return `
      <article class="internship-card" data-id="${esc(job.id)}" data-title="${esc(job.title)}"
        data-company="${esc(job.company)}" data-location="${esc(job.location)}" data-url="${esc(job.url)}" data-origin="${esc(job.origin || '')}" tabindex="0">
        <div class="internship-card__top">
          <img class="internship-card__logo" referrerpolicy="no-referrer" src="${esc(job.logo || CONFIG.FALLBACK_LOGO)}" alt="${esc(job.company)} logo">
          <div><p class="internship-card__company">${esc(job.company)}</p><h3>${esc(job.title)}</h3></div>
        </div>
        <ul class="card-info">${info}</ul>
        <footer class="card-actions">
          <span class="card-details">${icon('info')}View details</span>
          <div class="card-actions__btns">${applyButton(job)}</div>
        </footer>
      </article>`;
  }

  function cardsHtml(list) { return list.map(cardHtml).join(''); }

  // swap broken logos for the fallback (call after inserting cards)
  function wireLogos(container) {
    container.querySelectorAll('.internship-card__logo').forEach((image) =>
      image.addEventListener('error', () => { image.src = CONFIG.FALLBACK_LOGO; }, { once: true }));
  }

  window.KISCard = { icon, esc, formatDate, formatDeadline, cardHtml, cardsHtml, wireLogos };
})();
