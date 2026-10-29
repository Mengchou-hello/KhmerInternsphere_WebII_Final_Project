/* saved.js - Member 3
   Bookmarks: Save / Unsave buttons on cards and in the modal, plus the
   "Saved Internships" list inside #saved-section.
   Load order: config.js, api-client.js, main.js, (internships.js), saved.js

   It works with any card matching CARD_SELECTOR below (Member 1's cards, with a data-id).
   Member 2: put <div id="modal-save-slot"></div> in the modal and, when it opens, run
     document.dispatchEvent(new CustomEvent('modal:open', { detail: { job } }));
   Job details are read from: getJobById(id) if Member 1 provides it,
   otherwise from data-title / data-company / data-location / data-url on the card,
   otherwise from the card's text. */
(() => {
  'use strict';

  // Which elements count as an internship card. Only these get a Save button.
  // If Member 1 uses a different card class, add it to this list.
  const CARD_SELECTOR =
    'article[data-id], .internship-card[data-id], .job-card[data-id], .card[data-id], .latest-card[data-id]';
  const SKIP_INSIDE = '#saved-section, #modal-save-slot, [class*="modal"], [role="dialog"]';
  const FALLBACK_LOGO = 'img/logo.png';

  const saved = new Map();     // jobId -> { serverId, job }
  const pending = new Set();   // jobIds with a request in flight
  const jobCache = new Map();  // jobId -> job (filled by the modal)
  let state = 'loading';       // 'loading' | 'ready' | 'error'
  let errorMsg = '';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- helpers ---------- */
  function toast(msg) {
    let t = document.querySelector('.kis-toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'kis-toast';
      t.setAttribute('role', 'alert');
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._hide);
    t._hide = setTimeout(() => t.classList.remove('show'), 4000);
  }

  function getJobFromCard(card) {
    const id = card.dataset.id;
    try {
      if (typeof getJobById === 'function') {
        const j = getJobById(id);
        if (j) return j;
      }
    } catch { /* fall through to reading the card */ }
    const text = (sel) => card.querySelector(sel)?.textContent.trim() || '';
    return {
      id,
      title: card.dataset.title || text('h2, h3, h4, .title, .card-title'),
      company: card.dataset.company || text('.company, .card-company'),
      location: card.dataset.location || text('.location, .card-location'),
      logo: card.querySelector('img')?.src || '',
      url: card.dataset.url || card.querySelector('a[href^="http"]')?.href || ''
    };
  }

  /* ---------- buttons ---------- */
  function refreshButtons() {
    document.querySelectorAll('.save-btn').forEach((btn) => {
      const id = btn.dataset.saveId;
      const busy = pending.has(id);
      const isSaved = saved.has(id);
      btn.disabled = state !== 'ready' || busy;
      btn.classList.toggle('is-saved', isSaved);
      btn.setAttribute('aria-pressed', String(isSaved));
      const label = busy ? (isSaved ? 'Removing...' : 'Saving...') : (isSaved ? 'Saved' : 'Save');
      // Only touch the DOM when the text really changed (prevents an endless observer loop)
      if (btn.textContent !== label) btn.textContent = label;
      btn.title = isSaved ? 'Click to remove from saved' : 'Save this internship';
    });
  }

  function decorateCards() {
    document.querySelectorAll(CARD_SELECTOR).forEach((card) => {
      if (card.matches(SKIP_INSIDE) || card.closest(SKIP_INSIDE)) return;
      if (card.querySelector('.save-btn')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'save-btn';
      btn.dataset.saveId = card.dataset.id;
      card.appendChild(btn);
    });
    refreshButtons();
  }

  /* ---------- server actions ---------- */
  async function loadSaved() {
    state = 'loading';
    renderSaved();
    refreshButtons();
    try {
      const records = await apiGet('saved');
      saved.clear();
      records.forEach((r) => {
        if (r.data && r.data.jobId != null) {
          saved.set(String(r.data.jobId), { serverId: r.id, job: r.data });
        }
      });
      state = 'ready';
    } catch (err) {
      state = 'error';
      errorMsg = err.message || 'Could not load your saved internships.';
    }
    renderSaved();
    refreshButtons();
  }

  async function toggle(id, job) {
    id = String(id);
    if (state !== 'ready' || pending.has(id)) return; // blocks double-clicks
    pending.add(id);
    refreshButtons();
    try {
      if (saved.has(id)) {
        await apiDelete(saved.get(id).serverId);
        saved.delete(id);
      } else {
        if (!job) throw new Error('Could not read this internship. Please try again.');
        const data = {
          jobId: id, title: job.title || '', company: job.company || '',
          location: job.location || '', logo: job.logo || '', url: job.url || ''
        };
        const rec = await apiPost('saved', data);
        saved.set(id, { serverId: rec.id, job: data });
      }
    } catch (err) {
      toast(err.message || 'Something went wrong. Please try again.');
    } finally {
      pending.delete(id);
      refreshButtons();
      renderSaved();
    }
  }

  /* ---------- Saved Internships section ---------- */
  function renderSaved() {
    const section = document.getElementById('saved-section');
    if (!section) return;
    let body;
    if (state === 'loading') {
      body = '<div class="saved-msg"><span class="saved-spinner"></span> Loading saved internships...</div>';
    } else if (state === 'error') {
      body = `<div class="saved-msg saved-error"><p>${esc(errorMsg)}</p>
        <button type="button" class="saved-retry">Retry</button></div>`;
    } else if (saved.size === 0) {
      body = '<div class="saved-msg">No saved internships yet. Press Save on any internship to add it here.</div>';
    } else {
      body = '<ul class="saved-list">' + [...saved.entries()].map(([id, { job }]) => `
        <li class="saved-item">
          <img class="saved-logo" src="${esc(job.logo || FALLBACK_LOGO)}" alt="">
          <div class="saved-info">
            <strong>${esc(job.title)}</strong>
            <span>${esc(job.company)}${job.location ? ' - ' + esc(job.location) : ''}</span>
            ${job.url ? `<a href="${esc(job.url)}" target="_blank" rel="noopener">View listing</a>` : ''}
          </div>
          <button type="button" class="saved-remove" data-remove-id="${esc(id)}"
            ${pending.has(id) ? 'disabled' : ''}>${pending.has(id) ? 'Removing...' : 'Remove'}</button>
        </li>`).join('') + '</ul>';
    }
    section.innerHTML = `<h2 class="saved-title">Saved Internships
      <span class="saved-count">${state === 'ready' ? saved.size : ''}</span></h2>${body}`;
    section.querySelectorAll('.saved-logo').forEach((img) =>
      img.addEventListener('error', () => { img.src = FALLBACK_LOGO; }, { once: true }));
  }

  /* ---------- modal hook (Member 2) ---------- */
  function mountModalButton(job) {
    if (!job || job.id == null) return;
    const slot = document.getElementById('modal-save-slot');
    if (!slot) return;
    jobCache.set(String(job.id), job);
    slot.innerHTML = `<button type="button" class="save-btn save-btn--modal" data-save-id="${esc(job.id)}"></button>`;
    refreshButtons();
  }
  document.addEventListener('modal:open', (e) => mountModalButton(e.detail?.job || e.detail));

  /* ---------- events (capture phase, so Save never opens the modal) ---------- */
  document.addEventListener('click', (e) => {
    const saveBtn = e.target.closest('.save-btn');
    if (saveBtn) {
      e.preventDefault();
      e.stopPropagation();
      const id = saveBtn.dataset.saveId;
      const card = saveBtn.closest(CARD_SELECTOR);
      toggle(id, jobCache.get(id) || (card ? getJobFromCard(card) : null));
      return;
    }
    const removeBtn = e.target.closest('.saved-remove');
    if (removeBtn) { toggle(removeBtn.dataset.removeId); return; }
    if (e.target.closest('.saved-retry')) loadSaved();
  }, true);

  /* ---------- start ---------- */
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; decorateCards(); });
  }).observe(document.body, { childList: true, subtree: true });

  renderSaved();
  decorateCards();
  loadSaved();

  window.Saved = { mountModalButton, isSaved: (id) => saved.has(String(id)) };
})();