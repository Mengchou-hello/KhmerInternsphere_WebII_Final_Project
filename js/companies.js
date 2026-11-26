(() => {
  'use strict';
  const container = document.getElementById('company-list');
  if (!container) return;
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const fallbackLogo = CONFIG.FALLBACK_LOGO;
  let companies = new Map();

  function renderCompanies() {
    container.innerHTML = [...companies.values()].map((company) => `<article class="live-company-card" data-company="${escapeHtml(company.name)}" tabindex="0"><img src="${escapeHtml(company.logo || fallbackLogo)}" alt="${escapeHtml(company.name)} logo"><div><h2>${escapeHtml(company.name)}</h2><p>${company.jobs.length} open internship${company.jobs.length === 1 ? '' : 's'}</p></div><span aria-hidden="true">›</span></article>`).join('');
    container.querySelectorAll('img').forEach((image) => image.addEventListener('error', () => { image.src = fallbackLogo; }, { once: true }));
  }

  function closeCompanyModal() {
    document.getElementById('company-detail-modal')?.remove();
    document.body.style.overflow = '';
  }

  function openCompany(companyName) {
    const company = companies.get(companyName);
    if (!company) return;
    closeCompanyModal();
    document.body.insertAdjacentHTML('beforeend', `<div id="company-detail-modal" class="company-detail-modal" role="dialog" aria-modal="true" aria-labelledby="company-detail-title"><section><button type="button" class="company-detail-modal__close" aria-label="Close company details">×</button><header><img src="${escapeHtml(company.logo || fallbackLogo)}" alt="${escapeHtml(company.name)} logo"><div><h2 id="company-detail-title">${escapeHtml(company.name)}</h2><p>${company.jobs.length} internship${company.jobs.length === 1 ? '' : 's'} listed</p></div></header><div class="company-job-list">${company.jobs.map((job) => `<article><h3>${escapeHtml(job.title)}</h3><p>${escapeHtml(job.location)} · ${escapeHtml(job.category)}</p><a href="internships.html?job=${encodeURIComponent(job.id)}">View internship details</a></article>`).join('')}</div></section></div>`);
    document.body.style.overflow = 'hidden';
    const modal = document.getElementById('company-detail-modal');
    modal.querySelector('button').focus();
    modal.querySelector('button').addEventListener('click', closeCompanyModal);
    modal.addEventListener('click', (event) => { if (event.target === modal) closeCompanyModal(); });
  }

  async function loadCompanies() {
    container.innerHTML = '<p class="company-state">Loading companies from live internships…</p>';
    try {
      const jobs = (await getInternshipFeed()).jobs;
      companies = jobs.reduce((grouped, job) => {
        const current = grouped.get(job.company) || { name: job.company, logo: job.logo, jobs: [] };
        current.jobs.push(job);
        grouped.set(job.company, current);
        return grouped;
      }, new Map());
      if (!companies.size) { container.innerHTML = '<p class="company-state">No companies have internship listings right now. Please check back soon.</p>'; return; }
      renderCompanies();
    } catch (error) {
      container.innerHTML = `<div class="company-state company-state--error"><p>${escapeHtml(error.message || 'Unable to load companies.')}</p><button type="button" id="company-retry">Retry</button></div>`;
      document.getElementById('company-retry').addEventListener('click', loadCompanies);
    }
  }

  container.addEventListener('click', (event) => {
    const card = event.target.closest('[data-company]');
    if (card) openCompany(card.dataset.company);
  });
  container.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { const card = event.target.closest('[data-company]'); if (card) { event.preventDefault(); openCompany(card.dataset.company); } }
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeCompanyModal(); });
  loadCompanies();
})();
