/* detail-map.js - Member 2
   Internship detail modal + Nominatim geocoding + Leaflet map.

   Load order: config.js, card.js, Leaflet, (internships.js or latest.js), detail-map.js, saved.js

   Public API
     openDetailModal(job)   open the modal for one normalized job
     closeDetailModal()     close it
     geocode(address)       Promise -> { lat, lon, label } or null

   Hooks for teammates
     #modal-save-slot       Member 3 mounts the Save button (listens to the "modal:open" event)
     #modal-apply-slot      Member 4 can replace the Apply link with the in-app application button
     "modal:open" event     document.dispatchEvent, detail: { job } */
(() => {
  "use strict";
  if (window.__kisDetailLoaded) return; // never attach the listeners twice
  window.__kisDetailLoaded = true;

  const { icon, esc: escapeHtml, formatDate, formatDeadline } = window.KISCard;
  const fallbackLogo = CONFIG.FALLBACK_LOGO;

  const MIN_GAP_MS = 1000; // Nominatim policy: at most 1 request per second
  const TIMEOUT_MS = 10000; // a hung request must never block the queue
  const unmappable = /^(remote|worldwide|anywhere|global|not specified|n\/a|-)$/i;
  const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || ""));

  /* ---------------- geocoding: cache + in-flight dedupe + 1 req/s queue ---------------- */
  const cache = new Map(); // lowercase address -> coords | null (only real answers, never failures)
  const inFlight = new Map(); // lowercase address -> Promise (same address asked twice = one request)
  let queue = Promise.resolve();
  let lastRequestAt = 0;
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function lookup(query) {
    const gap = Math.max(0, MIN_GAP_MS - (Date.now() - lastRequestAt));
    if (gap) await sleep(gap);
    lastRequestAt = Date.now();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const url = new URL(CONFIG.NOMINATIM_URL);
      url.search = new URLSearchParams({ q: query, format: "json", limit: "1" });
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 429) lastRequestAt = Date.now() + 5000; // rate limited: back off
        throw new Error(`Location service unavailable (${response.status}).`);
      }
      const result = await response.json();
      const place = Array.isArray(result) ? result[0] : null;
      const lat = place ? Number(place.lat) : NaN;
      const lon = place ? Number(place.lon) : NaN;
      return Number.isFinite(lat) && Number.isFinite(lon)
        ? { lat, lon, label: place.display_name || query }
        : null;
    } finally {
      clearTimeout(timer);
    }
  }

  function geocode(address) {
    const query = String(address || "").trim();
    const key = query.toLowerCase();
    if (!query || unmappable.test(query)) return Promise.resolve(null);
    if (cache.has(key)) return Promise.resolve(cache.get(key));
    if (inFlight.has(key)) return inFlight.get(key);

    const task = queue.then(() => lookup(query));
    queue = task.catch(() => {}); // a failed lookup must NOT poison the queue for later ones
    const result = task
      .then((coords) => {
        cache.set(key, coords);
        return coords;
      }, () => null) // failure: show the fallback, and do not cache it so the next open retries
      .finally(() => inFlight.delete(key));
    inFlight.set(key, result);
    return result;
  }

  /* ---------------- description -> short bullet points (text only, never raw HTML) ---------------- */
  function descriptionBullets(html) {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    const items = [];
    const clean = (text) => String(text).replace(/\s+/g, " ").trim();
    const push = (text) => {
      const value = clean(text);
      if (value) items.push(value);
    };
    const sentences = (text) => clean(text).replace(/([.!?])\s+(?=[A-Z0-9])/g, "$1\n").split("\n");

    const blocks = doc.body.querySelectorAll("li, p");
    if (blocks.length) {
      blocks.forEach((element) => {
        if (element.tagName === "P" && element.closest("li")) return;
        if (element.tagName === "LI") push(element.textContent);
        else sentences(element.textContent).forEach(push);
      });
    } else {
      sentences(doc.body.textContent || "").forEach(push);
    }
    return items.slice(0, 40);
  }

  /* ---------------- map + modal state ---------------- */
  let map = null;
  let openToken = 0; // bumps on every open/close, so a slow lookup can never draw into the wrong modal
  let previousOverflow = "";
  let previousFocus = null;

  const byId = (id) => document.getElementById(id);
  const isOpen = () => Boolean(byId("internship-detail-modal")?.classList.contains("is-open"));

  function destroyMap() {
    if (map) {
      map.remove(); // avoids "Map container is already initialized"
      map = null;
    }
  }

  function closeDetailModal() {
    const modal = byId("internship-detail-modal");
    if (!modal || !modal.classList.contains("is-open")) return;
    openToken++;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = previousOverflow;
    destroyMap();
    if (previousFocus && document.contains(previousFocus) && previousFocus.focus) previousFocus.focus();
    previousFocus = null;
  }

  async function showMap(job, token) {
    const status = byId("detail-map-status");
    const container = byId("detail-map");
    if (!status || !container) return;

    const location = String(job.location || "").trim();
    if (!location || unmappable.test(location)) {
      status.textContent = "Location not available for map.";
      container.hidden = true;
      return;
    }

    status.textContent = "Finding this location…";
    container.hidden = true;
    const coordinates = await geocode(location);
    if (token !== openToken) return; // closed, or another job was opened meanwhile

    if (!coordinates) {
      status.textContent = "Location not available for map.";
      return;
    }
    if (!window.L) {
      status.textContent = "Map library is unavailable.";
      return;
    }

    try {
      container.hidden = false;
      destroyMap();
      map = L.map(container).setView([coordinates.lat, coordinates.lon], 10);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);
      L.marker([coordinates.lat, coordinates.lon]).addTo(map).bindPopup(escapeHtml(job.location));
      requestAnimationFrame(() => map && map.invalidateSize());
      status.textContent = coordinates.label;
    } catch {
      destroyMap();
      container.hidden = true;
      status.textContent = "The map could not be displayed.";
    }
  }

  function buildModalShell() {
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div id="internship-detail-modal" class="internship-modal" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="detail-title"><div class="internship-modal__dialog"><button type="button" class="internship-modal__close" aria-label="Close details">×</button><div id="internship-modal-content"></div></div></div>`,
    );
    const modal = byId("internship-detail-modal");
    modal.querySelector(".internship-modal__close").addEventListener("click", closeDetailModal);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeDetailModal(); // overlay click
    });
    return modal;
  }

  function openDetailModal(job) {
    if (!job) return;
    const modal = byId("internship-detail-modal") || buildModalShell();

    if (!modal.classList.contains("is-open")) {
      previousOverflow = document.body.style.overflow;
      previousFocus = document.activeElement;
    }
    const token = ++openToken;
    destroyMap();
    document.body.style.overflow = "hidden";
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");

    // key facts grid
    const facts = [
      ["pin", "Location", job.location],
      ["briefcase", "Category", job.category],
      ["clock", "Job type", job.jobType],
      ["cash", "Salary", job.salary],
    ];
    if (job.deadline) facts.push(["calendar", "Apply by", formatDeadline(job.deadline, "long")]);
    else if (job.date) facts.push(["calendar", "Posted", formatDate(job.date, "long")]);
    const factsHtml = facts
      .filter((fact) => fact[2])
      .map(
        ([name, label, value]) =>
          `<div class="detail-fact"><dt>${icon(name, "detail-icon")}${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`,
      )
      .join("");

    const bullets = descriptionBullets(job.description);
    const descriptionHtml = bullets.length
      ? `<div class="detail-description"><ul>${bullets.map((text) => `<li>${escapeHtml(text)}</li>`).join("")}</ul></div>`
      : `<p class="detail-description detail-description--empty">No description was provided. Use Apply to read the original listing.</p>`;

    const sourceLine = job.source
      ? `<p class="detail-source">Source: ${escapeHtml(job.source)}${job.verifiedOn ? ` · checked ${escapeHtml(formatDate(job.verifiedOn, "long"))}` : ""}</p>`
      : "";

    const applyTitle = job.applyLabel || "Apply on original listing";
    const applyHtml = isHttpUrl(job.url)
      ? `<a class="detail-apply" href="${escapeHtml(job.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(applyTitle)} (opens in a new tab)" aria-label="Apply for ${escapeHtml(job.title)} (opens in a new tab)">${icon("send", "detail-icon")}<span>Apply now</span></a>`
      : "";

    // <div>s on purpose: the site-wide header/footer rules must not style the title area or button row
    byId("internship-modal-content").innerHTML =
      `<div class="detail-hero">` +
      `<img class="detail-logo" referrerpolicy="no-referrer" src="${escapeHtml(job.logo || fallbackLogo)}" alt="${escapeHtml(job.company)} logo">` +
      `<div class="detail-hero__text"><p class="detail-company">${escapeHtml(job.company)}</p><h2 id="detail-title" class="detail-title">${escapeHtml(job.title)}</h2></div>` +
      `</div>` +
      `<div class="detail-body">` +
      `<dl class="detail-facts">${factsHtml}</dl>` +
      `<div class="detail-section"><h3 class="detail-section__title">About this internship</h3>${descriptionHtml}${sourceLine}</div>` +
      `<div class="detail-section"><h3 class="detail-section__title">Location</h3>` +
      `<p class="detail-location">${icon("pin", "detail-icon")}<span>${escapeHtml(job.location || "Not specified")}</span></p>` +
      `<div id="detail-map" class="detail-map" hidden></div>` +
      `<p id="detail-map-status" class="detail-map-status">Finding this location…</p></div>` +
      `</div>` +
      // display:contents keeps the existing button-row CSS working while giving Member 4 a stable slot
      `<div class="detail-actions"><div id="modal-save-slot"></div><div id="modal-apply-slot" style="display:contents">${applyHtml}</div></div>`;

    const logo = modal.querySelector(".detail-logo");
    logo.addEventListener("error", () => { logo.src = fallbackLogo; }, { once: true });
    modal.querySelector(".detail-body").scrollTop = 0;
    modal.querySelector(".internship-modal__close").focus();

    document.dispatchEvent(new CustomEvent("modal:open", { detail: { job } }));
    showMap(job, token);
  }

  /* ---------------- events ---------------- */
  const CARD_SELECTOR = ".internship-card[data-id], .latest-card[data-id]";

  // event delegation: one listener serves every card, including cards rendered later
  document.addEventListener("click", (event) => {
    if (event.target.closest(".save-btn, a, button, input, select")) return;
    const card = event.target.closest(CARD_SELECTOR);
    if (card) openDetailModal(window.getJobById?.(card.dataset.id));
  });

  document.addEventListener("keydown", (event) => {
    if (isOpen()) {
      if (event.key === "Escape") {
        closeDetailModal();
        return;
      }
      if (event.key === "Tab") {
        // keep keyboard focus inside the dialog
        const focusable = [
          ...byId("internship-detail-modal").querySelectorAll("a[href], button:not([disabled])"),
        ].filter((element) => element.offsetParent !== null || element === document.activeElement);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      return;
    }
    // keyboard: Enter / Space on a focused card opens its details
    if ((event.key === "Enter" || event.key === " ") && event.target.matches?.(CARD_SELECTOR)) {
      event.preventDefault();
      openDetailModal(window.getJobById?.(event.target.dataset.id));
    }
  });

  window.openDetailModal = openDetailModal;
  window.closeDetailModal = closeDetailModal;
  window.geocode = geocode;
})();