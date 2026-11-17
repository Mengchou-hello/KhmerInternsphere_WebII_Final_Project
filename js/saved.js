/* saved.js - Member 3
   Bookmarks: Save / Unsave buttons on cards and in the modal, plus the
   "Saved Internships" list inside #saved-section.
   Load order: config.js, api-client.js, card.js, (internships.js), detail-map.js, saved.js

   Storage: the shared restful-api.dev list is the ONLY place bookmarks live. Every page
   (home.html and internships.html) loads this same file, so both read and write the same records.
     - GET  (apiGet('saved'))   on every page load  -> restores Saved buttons + the Saved list
     - POST (apiPost('saved'))  on Save              -> record name is "KIS-saved" (team prefix added by api-client)
     - DELETE (apiDelete(id))   on Unsave            -> uses the SERVER record id, never the internship id
   If the server cannot be reached the button is NOT marked Saved and a friendly message is shown,
   so the screen never claims something is saved that is not. (Older versions fell back to
   localStorage, which is why bookmarks vanished after a refresh; anything an old version left in
   localStorage is uploaded once, then removed.)

   Removing a saved internship (card, modal or Saved list) asks for confirmation first;
   "View details" opens our own detail view (Apply is a separate button). */
(() => {
  "use strict";
  if (window.__kisSavedLoaded) return; // never attach the listeners / observer twice
  window.__kisSavedLoaded = true;

  const CARD_SELECTOR =
    "article[data-id], .internship-card[data-id], .job-card[data-id], .card[data-id], .latest-card[data-id]";
  const SKIP_INSIDE =
    '#saved-section, #modal-save-slot, [class*="modal"], [role="dialog"]';
  const FALLBACK_LOGO = "img/logo.png";
  const LEGACY_LOCAL_KEY = "kis-saved-internships"; // only read once to migrate old saves, never used to store new ones
  const ID_INDEX_KEY = "kis-saved-ids"; // ONLY the server record ids (no bookmark data): lets this browser ask the API for its own records if list-all is blocked
  const MIN_QUIET_RELOAD_MS = 300000; // the free API allows ~50 requests/day, so background re-reads are rare

  // jobKey -> { serverId, serverIds, job }. serverIds lists every server record for the job (normally one).
  const saved = new Map();
  const pending = new Set();
  const jobCache = new Map();
  let state = "loading"; // 'loading' | 'ready' | 'error'
  let errorMsg = "";
  let confirmOpen = false;
  let loadingNow = false;
  let migrating = false;
  let lastLoadAt = 0;

  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const icon = (name) => (window.KISCard ? window.KISCard.icon(name) : "");
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /* ---------- identity: one key per internship, whichever feed it came from ---------- */
  // Local (data/internships.json) ids are "local-<n>"; Remotive ids are plain numbers.
  function originOf(id, origin) {
    if (origin === "cambodia" || origin === "remote") return origin;
    return String(id).startsWith("local-") ? "cambodia" : "remote";
  }
  function keyOf(rawId, origin) {
    const id = String(rawId);
    return originOf(id, origin) === "cambodia" && !id.startsWith("local-")
      ? `local-${id}`
      : id;
  }
  const sourceOf = (origin) => (origin === "cambodia" ? "local" : "remotive");

  // the record we POST: team prefix, internship id, title, company, location and source (+ what the Saved list needs)
  function buildData(id, job) {
    const origin = originOf(id, job.origin);
    return {
      prefix: CONFIG.TEAM_PREFIX,
      jobId: id,
      title: job.title || "",
      company: job.company || "",
      location: job.location || "",
      source: sourceOf(origin), // 'remotive' or 'local' (data/internships.json)
      origin,
      logo: job.logo || "",
      url: job.url || "",
    };
  }

  /* ---------- helpers ---------- */
  function toast(msg, kind) {
    let t = document.querySelector(".kis-toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "kis-toast";
      t.setAttribute("role", "alert");
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.toggle("kis-toast--ok", kind === "ok");
    t.classList.add("show");
    clearTimeout(t._hide);
    t._hide = setTimeout(() => t.classList.remove("show"), 4000);
  }

  const statusOf = (err) => {
    const m = /\((\d{3})\)/.exec((err && err.message) || "");
    return m ? Number(m[1]) : 0;
  };
  const isNotFound = (err) => statusOf(err) === 404;
  function friendly(err) {
    const status = statusOf(err);
    if (status === 429)
      return "The free bookmark service has reached its request limit for now. Please try again later.";
    return (err && err.message) || "Something went wrong. Please try again.";
  }
  function readIds() {
    try {
      const l = JSON.parse(localStorage.getItem(ID_INDEX_KEY));
      return Array.isArray(l) ? l.map(String) : [];
    } catch {
      return [];
    }
  }
  function writeIds(ids) {
    try {
      localStorage.setItem(
        ID_INDEX_KEY,
        JSON.stringify([...new Set(ids.map(String))]),
      );
    } catch {
      /* storage blocked: list-all still works */
    }
  }
  const rememberId = (id) => writeIds([...readIds(), id]);
  const forgetId = (id) => writeIds(readIds().filter((x) => x !== String(id)));

  function getJobFromCard(card) {
    const id = card.dataset.id;
    try {
      if (typeof getJobById === "function") {
        const j = getJobById(id);
        if (j) return j;
      }
    } catch {
      /* fall through to reading the card */
    }
    const text = (sel) => card.querySelector(sel)?.textContent.trim() || "";
    return {
      id,
      title: card.dataset.title || text("h2, h3, h4, .title, .card-title"),
      company: card.dataset.company || text(".company, .card-company"),
      location: card.dataset.location || text(".location, .card-location"),
      logo: card.querySelector("img")?.src || "",
      url:
        card.dataset.url || card.querySelector('a[href^="http"]')?.href || "",
      origin: card.dataset.origin || "",
    };
  }

  // internal link to our own detail view (never the external job site)
  function detailHref(id, job) {
    const origin = originOf(id, job.origin);
    return `internships.html?job=${encodeURIComponent(id)}&source=${encodeURIComponent(origin)}`;
  }

  /* ---------- confirmation dialog ---------- */
  function confirmRemove(job) {
    if (confirmOpen) return Promise.resolve(false);
    confirmOpen = true;
    return new Promise((resolve) => {
      const previous = document.activeElement;
      const overlay = document.createElement("div");
      overlay.className = "kis-confirm";
      overlay.setAttribute("role", "alertdialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-labelledby", "kis-confirm-title");
      overlay.setAttribute("aria-describedby", "kis-confirm-text");
      overlay.innerHTML = `
        <div class="kis-confirm__box">
          <div class="kis-confirm__icon">${icon("trash")}</div>
          <h2 class="kis-confirm__title" id="kis-confirm-title">Remove from saved?</h2>
          <p class="kis-confirm__text" id="kis-confirm-text"></p>
          <div class="kis-confirm__actions">
            <button type="button" class="kis-confirm__btn kis-confirm__btn--cancel">Keep it</button>
            <button type="button" class="kis-confirm__btn kis-confirm__btn--danger">${icon("trash")}<span>Yes, remove</span></button>
          </div>
        </div>`;
      const name = job && job.title ? `"${job.title}"` : "this internship";
      overlay.querySelector("#kis-confirm-text").textContent =
        `Are you sure you want to remove ${name} from your saved internships? You can save it again at any time.`;
      document.body.appendChild(overlay);

      const [cancelBtn, removeBtn] =
        overlay.querySelectorAll(".kis-confirm__btn");
      const finish = (result) => {
        document.removeEventListener("keydown", onKey, true);
        overlay.remove();
        confirmOpen = false;
        if (previous && previous.focus) previous.focus();
        resolve(result);
      };
      function onKey(e) {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          finish(false);
          return;
        }
        if (e.key === "Tab") {
          // keep focus inside the dialog
          e.preventDefault();
          (document.activeElement === cancelBtn
            ? removeBtn
            : cancelBtn
          ).focus();
        }
      }
      document.addEventListener("keydown", onKey, true);
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) finish(false);
      });
      cancelBtn.addEventListener("click", () => finish(false));
      removeBtn.addEventListener("click", () => finish(true));
      cancelBtn.focus(); // safest default: keep the bookmark
    });
  }

  /* ---------- buttons ---------- */
  function refreshButtons() {
    document.querySelectorAll(".save-btn").forEach((btn) => {
      const id = btn.dataset.saveId;
      const busy = pending.has(id);
      const isSaved = saved.has(id);
      btn.disabled = state === "loading" || busy; // in 'error' the button stays clickable: a click retries
      btn.classList.toggle("is-saved", isSaved);
      btn.classList.toggle("is-busy", busy || state === "loading");
      btn.setAttribute("aria-busy", String(busy || state === "loading"));
      btn.setAttribute("aria-pressed", String(isSaved));
      const label = busy
        ? isSaved
          ? "Removing..."
          : "Saving..."
        : isSaved
          ? "Saved"
          : "Save";
      const html = `${icon("bookmark")}<span class="btn-label">${label}</span>`;
      if (btn.dataset.rendered !== html) {
        btn.innerHTML = html;
        btn.dataset.rendered = html;
      }
      btn.title =
        state === "loading"
          ? "Loading your saved internships..."
          : state === "error"
            ? "Could not load saved internships - click to retry"
            : isSaved
              ? "Saved - click to remove"
              : "Save this internship";
      btn.setAttribute(
        "aria-label",
        isSaved ? "Remove from saved internships" : "Save this internship",
      );
    });
  }

  function decorateCards() {
    document.querySelectorAll(CARD_SELECTOR).forEach((card) => {
      if (card.matches(SKIP_INSIDE) || card.closest(SKIP_INSIDE)) return;
      if (card.querySelector(".save-btn")) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "save-btn";
      btn.dataset.saveId = card.dataset.id;
      const slot = card.querySelector(".card-actions__btns");
      if (slot) slot.prepend(btn);
      else card.appendChild(btn);
    });
    refreshButtons();
  }

  /* ---------- server access (GET / POST / DELETE through api-client.js) ---------- */
  // Only our team's records (KIS- prefix) that really describe an internship.
  // 1) GET the shared list (apiGet filters on the prefix).
  // 2) If the service refuses list-all (405/403/404), ask it for our own records by id instead.
  async function listByIds(ids) {
    if (!ids.length) return [];
    const query = ids.map((i) => `id=${encodeURIComponent(i)}`).join("&");
    const rows = await apiRequest(`${CONFIG.API_BASE}?${query}`);
    if (!Array.isArray(rows))
      throw new Error("Unexpected reply from the saved-internships service.");
    return rows.filter(
      (o) =>
        o &&
        typeof o.name === "string" &&
        o.name === `${CONFIG.TEAM_PREFIX}saved`,
    );
  }
  async function fetchRecords(attempts = 1) {
    let lastErr;
    const valid = (rows) =>
      rows.filter((r) => r && r.id != null && r.data && r.data.jobId != null);
    for (let i = 0; i < attempts; i++) {
      try {
        // 1) Ask for OUR records by id first: small, fast, and it survives a refresh
        //    even when the shared list-all call is slow, truncated or blocked.
        const ids = readIds();
        let rows = [];
        if (ids.length) {
          try {
            rows = valid(await listByIds(ids));
          } catch (idErr) {
            if (statusOf(idErr) === 429) throw idErr;
            rows = [];
          }
        }
        // 2) Nothing found by id (new browser, cleared storage): fall back to list-all.
        if (!rows.length) {
          rows = valid(await apiGet("saved"));
        }
        // Only ADD ids. Never overwrite the index with a shorter list, or one bad
        // reply would wipe every remembered bookmark.
        writeIds([...readIds(), ...rows.map((r) => r.id)]);
        return rows;
      } catch (err) {
        lastErr = err;
        if (statusOf(err) >= 400 && statusOf(err) < 500) break; // permanent / rate-limit: retrying only wastes requests
        if (i < attempts - 1) await sleep(800);
      }
    }
    throw lastErr;
  }

  function entryFromRecords(records) {
    const first = records[0];
    return {
      serverId: first.id,
      serverIds: records.map((r) => r.id),
      job: first.data,
    };
  }

  async function loadSaved({ silent = false } = {}) {
    if (loadingNow) return;
    loadingNow = true;
    if (!silent || state !== "ready") {
      state = "loading";
      renderSaved();
      refreshButtons();
    }
    try {
      const records = await fetchRecords(2);
      const grouped = new Map(); // jobKey -> records (also collapses accidental duplicates)
      records.forEach((r) => {
        const key = keyOf(r.data.jobId, r.data.origin);
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key).push(r);
      });
      const inFlight = new Map([...saved].filter(([key]) => pending.has(key)));
      saved.clear();
      grouped.forEach((recs, key) => saved.set(key, entryFromRecords(recs)));
      inFlight.forEach((entry, key) => {
        if (!saved.has(key)) saved.set(key, entry);
      });
      state = "ready";
      errorMsg = "";
    } catch (err) {
      if (silent && state === "ready") {
        loadingNow = false;
        return;
      } // keep what is on screen, try again later
      state = "error";
      errorMsg = `We could not load your saved internships. ${friendly(err)}`;
    } finally {
      loadingNow = false;
      lastLoadAt = Date.now();
    }
    renderSaved();
    refreshButtons();
    if (state === "ready") migrateLegacy();
  }

  // Bookmarks that an older version kept only in this browser are uploaded once, then forgotten.
  async function migrateLegacy() {
    if (migrating) return;
    let legacy;
    try {
      legacy = JSON.parse(localStorage.getItem(LEGACY_LOCAL_KEY));
      if (!Array.isArray(legacy) || !legacy.length) {
        localStorage.removeItem(LEGACY_LOCAL_KEY);
        return;
      }
      localStorage.removeItem(LEGACY_LOCAL_KEY); // claim them first so a second tab does not upload them again
    } catch {
      return;
    }
    migrating = true;
    const failed = [];
    try {
      for (const old of legacy) {
        if (!old || old.jobId == null) continue;
        const key = keyOf(old.jobId, old.origin);
        if (saved.has(key)) continue; // already on the server
        try {
          const data = buildData(key, old);
          const rec = await apiPost("saved", data);
          if (!rec || rec.id == null) throw new Error("no id");
          rememberId(rec.id);
          saved.set(key, { serverId: rec.id, serverIds: [rec.id], job: data });
        } catch {
          failed.push(old);
        }
      }
      if (failed.length) {
        try {
          localStorage.setItem(LEGACY_LOCAL_KEY, JSON.stringify(failed));
        } catch {
          /* ignore */
        }
      }
    } finally {
      migrating = false;
      renderSaved();
      refreshButtons();
    }
  }

  async function addBookmark(id, known) {
    if (!known) {
      toast("Could not read this internship. Please try again.");
      return;
    }
    pending.add(id); // set synchronously, so a fast double-click can never start a second save
    refreshButtons();
    renderSaved();
    try {
      const data = buildData(id, known);
      const rec = await apiPost("saved", data);
      if (!rec || rec.id == null)
        throw new Error("The server did not confirm the save.");
      rememberId(rec.id);
      saved.set(id, { serverId: rec.id, serverIds: [rec.id], job: data });
      toast("Saved. You can find it under Saved Internships.", "ok");
    } catch (err) {
      saved.delete(id);
      toast(`Could not save this internship. ${friendly(err)}`);
    } finally {
      pending.delete(id);
      refreshButtons();
      renderSaved();
    }
  }

  async function removeBookmark(id) {
    const entry = saved.get(id);
    if (!entry) return;
    pending.add(id);
    refreshButtons();
    renderSaved();
    try {
      for (const serverId of [...entry.serverIds]) {
        // the SERVER record id(s), not the internship id
        try {
          await apiDelete(serverId);
        } catch (err) {
          if (!isNotFound(err)) throw err;
        } // already deleted elsewhere = fine
        forgetId(serverId);
        entry.serverIds = entry.serverIds.filter((s) => s !== serverId);
      }
      saved.delete(id);
      toast("Removed from saved internships.", "ok");
    } catch (err) {
      toast(`Could not remove this internship. ${friendly(err)}`);
    } finally {
      pending.delete(id);
      refreshButtons();
      renderSaved();
    }
  }

  async function toggle(id, job) {
    id = String(id);
    if (state === "error") {
      toast("Reconnecting to your saved internships...");
      loadSaved();
      return;
    }
    if (state !== "ready" || pending.has(id)) return;

    if (saved.has(id)) {
      // ask before removing a bookmark (card button, modal button and the Saved list all come through here)
      const sure = await confirmRemove(saved.get(id)?.job);
      if (!sure || pending.has(id) || !saved.has(id)) return;
      return removeBookmark(id);
    }
    return addBookmark(id, job || jobCache.get(id));
  }

  /* ---------- Saved Internships section ---------- */
  function renderSaved() {
    const section = document.getElementById("saved-section");
    if (!section) return; // pages without the list (home) still share the same bookmarks and button state
    let body;
    if (state === "loading") {
      body =
        '<div class="saved-msg" role="status"><span class="saved-spinner"></span> Loading saved internships...</div>';
    } else if (state === "error") {
      body =
        `<div class="saved-msg saved-error" role="alert"><p>${esc(errorMsg)}</p>` +
        '<button type="button" class="saved-retry saved-btn">Try again</button></div>';
    } else if (saved.size === 0) {
      body =
        '<div class="saved-msg">No saved internships yet. Press Save on any internship to add it here.</div>';
    } else {
      body =
        '<ul class="saved-list">' +
        [...saved.entries()]
          .map(
            ([id, { job }]) => `
        <li class="saved-item">
          <img class="saved-logo" referrerpolicy="no-referrer" src="${esc(job.logo || FALLBACK_LOGO)}" alt="">
          <div class="saved-info">
            <strong>${esc(job.title)}</strong>
            <span>${esc(job.company)}${job.location ? " - " + esc(job.location) : ""}</span>
          </div>
          <div class="saved-actions">
            <a class="saved-btn saved-btn--view" data-view-id="${esc(id)}" href="${esc(detailHref(id, job))}">${icon("info")}<span>View details</span></a>
            ${job.url ? `<a class="saved-btn saved-btn--apply" href="${esc(job.url)}" target="_blank" rel="noopener noreferrer" title="Apply on the original listing (opens in a new tab)">${icon("send")}<span>Apply</span></a>` : ""}
            <button type="button" class="saved-remove saved-btn saved-btn--remove" data-remove-id="${esc(id)}"
              ${pending.has(id) ? "disabled" : ""}>${icon("trash")}<span>${pending.has(id) ? "Removing..." : "Remove"}</span></button>
          </div>
        </li>`,
          )
          .join("") +
        "</ul>";
    }
    section.innerHTML = `<h2 class="saved-title">Saved Internships
      <span class="saved-count">${state === "ready" ? saved.size : ""}</span></h2>${body}`;
    section.querySelectorAll(".saved-logo").forEach((img) =>
      img.addEventListener(
        "error",
        () => {
          img.src = FALLBACK_LOGO;
        },
        { once: true },
      ),
    );
  }

  /* ---------- modal hook (Member 2) ---------- */
  function mountModalButton(job) {
    if (!job || job.id == null) return;
    const slot = document.getElementById("modal-save-slot");
    if (!slot) return;
    jobCache.set(String(job.id), job);
    slot.innerHTML = `<button type="button" class="save-btn save-btn--modal" data-save-id="${esc(job.id)}"></button>`;
    refreshButtons();
  }
  document.addEventListener("modal:open", (e) =>
    mountModalButton(e.detail?.job || e.detail),
  );

  /* ---------- events (capture phase, so Save never opens the modal) ---------- */
  document.addEventListener(
    "click",
    (e) => {
      const saveBtn = e.target.closest(".save-btn");
      if (saveBtn) {
        e.preventDefault();
        e.stopPropagation();
        const id = saveBtn.dataset.saveId;
        const card = saveBtn.closest(CARD_SELECTOR);
        toggle(id, jobCache.get(id) || (card ? getJobFromCard(card) : null));
        return;
      }
      const removeBtn = e.target.closest(".saved-remove");
      if (removeBtn) {
        toggle(removeBtn.dataset.removeId);
        return;
      }

      // "View details" in the Saved list: open our own detail popup when the job is on this page,
      // otherwise follow the link to internships.html?job=ID (which opens the popup after loading)
      const viewLink = e.target.closest(".saved-btn--view");
      if (viewLink) {
        const job =
          typeof window.getJobById === "function"
            ? window.getJobById(viewLink.dataset.viewId)
            : null;
        if (job && typeof window.openDetailModal === "function") {
          e.preventDefault();
          window.openDetailModal(job);
        }
        return;
      }
      if (e.target.closest(".saved-retry")) loadSaved();
    },
    true,
  );

  // Keep this page in step with the other page/tab: when it becomes visible again (tab switch, or the
  // browser's back/forward cache restoring an old copy), quietly re-read the server list.
  function reloadQuietly() {
    if (state === "error") {
      loadSaved();
      return;
    }
    if (state !== "ready" || pending.size || confirmOpen || migrating) return;
    if (Date.now() - lastLoadAt < MIN_QUIET_RELOAD_MS) return;
    loadSaved({ silent: true });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") reloadQuietly();
  });
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) {
      lastLoadAt = 0;
      reloadQuietly();
    }
  });

  /* ---------- start ---------- */
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      decorateCards();
    });
  }).observe(document.body, { childList: true, subtree: true });

  renderSaved();
  decorateCards();
  loadSaved();

  window.Saved = {
    mountModalButton,
    isSaved: (id) => saved.has(String(id)),
    reload: loadSaved,
  };
})();
