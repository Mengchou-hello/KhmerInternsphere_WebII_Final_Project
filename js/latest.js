/* latest.js - Member 3
   "Latest internships" on home.html and index.html (3 to 6 listings).
   Needs a container with id="latest-list". Load after config.js, api-client.js and main.js.
   Add css/latest.css for the card styles. Remotive must be credited (done below).
   If Member 1's renderCards(list, container) exists it is used; otherwise simple
   cards are drawn here so the home page never depends on another member. */
(() => {
  'use strict';
  const box = document.getElementById('latest-list');
  if (!box) return;

  const COUNT = 6;
  if (!document.querySelector('.latest-source')) {
    box.insertAdjacentHTML('afterend',
      '<p class="latest-source">Jobs via <a href="https://remotive.com" target="_blank" rel="noopener">Remotive</a></p>');
  }
  const FALLBACK_LOGO = 'img/logo.png';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const normalize = (j) => ({
    id: String(j.id),
    title: j.title,
    company: j.company_name,
    location: j.candidate_required_location || 'Remote',
    category: j.category,
    jobType: j.job_type,
    logo: j.company_logo || '',
    url: j.url,
    description: j.description,
    date: j.publication_date
  });

  const simpleCards = (list) => list.map((job) => `
    <article class="latest-card" data-id="${esc(job.id)}">
      <img class="latest-logo" src="${esc(job.logo || FALLBACK_LOGO)}" alt="${esc(job.company)} logo">
      <h3>${esc(job.title)}</h3>
      <p class="latest-company">${esc(job.company)}</p>
      <p class="latest-location">${esc(job.location)}</p>
      <a class="latest-apply" href="${esc(job.url)}" target="_blank" rel="noopener">View listing</a>
    </article>`).join('');

  function show(list) {
    box.innerHTML = '';
    if (typeof renderCards === 'function') {
      try { renderCards(list, box); } catch { /* use the simple cards below */ }
    }
    if (!box.children.length) box.innerHTML = simpleCards(list);
    box.querySelectorAll('img').forEach((img) =>
      img.addEventListener('error', () => { img.src = FALLBACK_LOGO; }, { once: true }));
  }

  async function loadLatest() {
    box.innerHTML = '<p class="latest-msg">Loading latest internships...</p>';
    try {
      const jobs = await fetchRemotiveJobs({ search: 'internship', limit: 100 });
      let list = (jobs || []).filter((j) => /intern/i.test(j.title) || j.job_type === 'internship');
      if (list.length < 3) list = jobs || [];
      list = list.slice(0, COUNT).map(normalize);
      if (!list.length) {
        box.innerHTML = '<p class="latest-msg">No internships found right now. Please check back soon.</p>';
        return;
      }
      show(list);
    } catch {
      box.innerHTML = `<div class="latest-msg latest-error">
        <p>Could not load internships. Please check your connection and try again.</p>
        <button type="button" class="latest-retry">Retry</button></div>`;
      box.querySelector('.latest-retry').addEventListener('click', loadLatest);
    }
  }
  loadLatest();
})();