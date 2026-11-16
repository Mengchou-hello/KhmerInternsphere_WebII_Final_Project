/* Member 1: live internship listings shared with detail, saved, and home features.
   Load AFTER card.js. Supports deep links like internships.html?job=local-3&source=cambodia
   (used by "View details" in the Saved list and on the home page). */
(() => {
  'use strict';

  const grid = document.getElementById('internshipGrid');
  if (!grid) return;

  const params = new URLSearchParams(location.search);
  const requestedJobId = params.get('job');
  const sourceParam = params.get('source');
  const initialSource = ['cambodia', 'remote'].includes(sourceParam) ? sourceParam : CONFIG.DEFAULT_SOURCE;
  const state = { jobs: [], search: '', location: '', category: '', source: initialSource };
  const sourceSelect = document.getElementById('source-filter');
  const escapeHtml = window.KISCard.esc;
  const lower = (value) => String(value ?? '').toLowerCase();

  function getJobById(id) {
    return state.jobs.find((job) => String(job.id) === String(id));
  }

  function getFilteredJobs() {
    const keyword = state.search.trim().toLowerCase();
    return state.jobs.filter((job) => {
      const matchesKeyword = !keyword || [job.title, job.company, job.location, job.category]
        .some((value) => lower(value).includes(keyword));
      return matchesKeyword
        && (!state.location || job.location === state.location)
        && (!state.category || job.category === state.category);
    });
  }

  // cards: bullet-style info + Save / Apply icon buttons (markup lives in card.js)
  function renderCards(list, container = grid) {
    container.innerHTML = KISCard.cardsHtml(list);
    KISCard.wireLogos(container);
  }

  function render() {
    const list = getFilteredJobs();
    document.getElementById('results-count').textContent = `${list.length} internship${list.length === 1 ? '' : 's'} found`;
    grid.hidden = list.length === 0;
    const empty = document.getElementById('internship-empty');
    empty.textContent = state.jobs.length
      ? 'No internships match these filters. Try clearing them.'
      : 'No internship listings are available right now. Please check back soon.';
    empty.hidden = list.length !== 0;
    if (list.length) renderCards(list);
  }

  function showFeedNotice(text) {
    let notice = document.getElementById('feed-notice');
    if (!text) { notice?.remove(); return; }
    if (!notice) {
      notice = document.createElement('p');
      notice.id = 'feed-notice';
      notice.className = 'listing-state listing-notice';
      document.getElementById('results-count').insertAdjacentElement('beforebegin', notice);
    }
    notice.textContent = text;
  }

  function populateFilters() {
    const setOptions = (id, values, label) => {
      const select = document.getElementById(id);
      select.innerHTML = `<option value="">All ${label}</option>` + [...values].sort().map((value) =>
        `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
    };
    setOptions('location-filter', new Set(state.jobs.map((job) => job.location)), 'locations');
    setOptions('category-filter', new Set(state.jobs.map((job) => job.category)), 'categories');
  }

  let pendingJobId = requestedJobId; // only open the deep-linked job once

  async function fetchInternships() {
    grid.hidden = true;
    document.getElementById('internship-loading').hidden = false;
    document.getElementById('internship-error').hidden = true;
    document.getElementById('internship-empty').hidden = true;
    const requestedSource = state.source;
    try {
      const feed = await getInternshipFeed({ source: requestedSource });
      if (requestedSource !== state.source) return; // the student switched source while this was loading
      state.jobs = feed.jobs;
      showFeedNotice(feed.notice);
      window.KISInternships = state.jobs;
      populateFilters();
      render();
      if (pendingJobId) {
        const requestedJob = getJobById(pendingJobId);
        pendingJobId = null;
        if (requestedJob) setTimeout(() => window.openDetailModal?.(requestedJob), 0);
        else showFeedNotice('That internship is no longer listed (it may have passed its deadline).');
      }
    } catch (error) {
      if (requestedSource !== state.source) return;
      document.getElementById('results-count').textContent = '';
      document.getElementById('internship-error-text').textContent = error.message || 'Unable to load internships.';
      document.getElementById('internship-error').hidden = false;
    } finally {
      if (requestedSource === state.source) document.getElementById('internship-loading').hidden = true;
    }
  }

  function resetFilters() {
    state.search = ''; state.location = ''; state.category = '';
    document.getElementById('internship-search').value = '';
    document.getElementById('location-filter').value = '';
    document.getElementById('category-filter').value = '';
  }

  let debounceTimer;
  document.getElementById('internship-search').addEventListener('input', (event) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { state.search = event.target.value; render(); }, 300);
  });
  document.getElementById('location-filter').addEventListener('change', (event) => { state.location = event.target.value; render(); });
  document.getElementById('category-filter').addEventListener('change', (event) => { state.category = event.target.value; render(); });
  document.getElementById('clear-filters').addEventListener('click', () => { resetFilters(); render(); });
  document.getElementById('internship-retry').addEventListener('click', fetchInternships);
  if (sourceSelect) {
    sourceSelect.value = state.source;
    sourceSelect.addEventListener('change', (event) => {
      state.source = event.target.value;
      state.jobs = [];
      resetFilters();
      fetchInternships();
    });
  }

  window.getJobById = getJobById;
  window.renderCards = renderCards;
  window.fetchInternships = fetchInternships;
  fetchInternships();
})();
