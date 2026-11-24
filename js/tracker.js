(() => {
    "use strict";
    if (window.__kisTrackerLoaded) return;
    window.__kisTrackerLoaded = true;

    console.log("tracker.js loaded")

    // helper
    const esc = window.KISCard.esc

    // statuses
    const STATUS = {
        submitted: {label: "Submitted"},
        under_review: {label: "Under review"},
        accepted: {label: "Accepted"},
        rejected: {label: "Rejected"}
    }

    const ACTION_LABEL = {
        under_review: "Mark as under review",
        accepted: "Mark as accepted",
        rejected: "Mark as rejected",
    }


    const renderStepper = (data) => {
        const s = data.status
        const decided = s === "accepted" || s === "rejected"
        const steps = [
            { key: "submitted",    label: "Submitted",    done: true,           cls: "" },
            { key: "under_review", label: "Under review", done: s !== "submitted", cls: "" },
            { key: "final",        label: decided ? STATUS[s].label : "Decision", done: decided, cls: decided ? `is-${s}` : "" },
        ]
        const current = s === "submitted" ? "submitted" : s === "under_review" ? "under_review" : "final"
        const dateOf = (key) => {
            const hit = (data.history || []).find((h) =>
                key === "final" ? h.status === "accepted" || h.status === "rejected" : h.status === key)
            return hit ? KISCard.formatDate(hit.at) : ""
        }

        return `<ol class="app-stepper" aria-label="Application progress">` +
            steps.map((st) => {
                const classes = ["app-step", st.done && "is-done", st.key === current && "is-current", st.cls].filter(Boolean).join(" ")
                const when = dateOf(st.key)
                return `<li class="${classes}"${st.key === current ? ' aria-current="step"' : ""}>
                    <span class="app-step__dot"></span>
                    <span class="app-step__label">${esc(st.label)}</span>
                    ${when ? `<span class="app-step__date">${esc(when)}</span>` : ""}
                </li>`
            }).join("") + `</ol>`
    }
    window.Tracker = { renderStepper, STATUS }      // 6b reuses this inside the form


    const renderTracker = () => {
        const section = document.getElementById("tracker-section")
        
        if (!section) return;
        let state = Applications.getState()
        const list = Applications.list()

        let body;
        if (state === "loading") {
            body =
            '<div class="application-msg" role="status"> <span class="saved-spinner"></span> Loading your applications...</div>';
        } else if (state === "error") {
            body = 
            `<div class="application-msg application-error" role="alert"><p>${esc(Applications.getErrorMsg())}</p><button type="button" class="application-retry retry-btn">Try again</button></div>`;
        } else if (list.length === 0) {
            body = 
            '<div class="application-msg">No applications yet. Open an internship and press Apply  </div>';
        } else {
            body =
            '<ul class="application-list">' +
                list.map(
                    ({ data }) => `
                <li class="application-item" >
                    <img class="application-logo" referrerpolicy="no-referrer" src="${esc(data.logo || CONFIG.FALLBACK_LOGO)}" alt="">

                    <div class="application-info">
                        <strong class="application-title"> ${esc(data.title) }</strong>
                        <span class="application-company"> ${esc(data.company)} </span>
                        <span class="application-date"> Submitted  ${KISCard.formatDate(data.submittedAt)}</span>
                    </div>

                    <span class="status-badge status-badge--${data.status}"> 
                        ${STATUS[data.status]?.label ?? "Unknown"}
                    </span>

                    ${renderStepper(data)}
                    <div class="application-actions">
                        <button type="button" class="app-btn" data-view-job="${esc(data.jobKey)}">View / edit</button>
                        ${Applications.nextStatuses(data.status).map((next) => `
                            <button type="button" class="app-btn" data-set-status="${next}" data-job-key="${esc(data.jobKey)}"
                                ${Applications.isPending(data.jobKey) ? "disabled" : ""}>${ACTION_LABEL[next]}</button>`).join("")}
                    </div>
                </li>`,
            )
          .join("") +
          '</ul>'
        }
        section.innerHTML = `<h2 class="application-section-title"> My Applications <span class="count">${list.length}</span></h2>${body}`
    }

    const decorateCards = () => {
    document.querySelectorAll(".internship-card[data-id]").forEach((card) => {
        const app = Applications.get(Applications.keyOf(card.dataset.id, card.dataset.origin))
        const badge = card.querySelector(".card-status")
        const applyBtn = card.querySelector(".card-btn--apply")
        const name = `${card.dataset.title} at ${card.dataset.company}`

        if (applyBtn) {
            const text = app ? "Applied" : "Apply"
            const aria = app ? `You applied for ${name}` : `Apply for ${name}`
            const label = applyBtn.querySelector(".btn-label")
            if (label && label.textContent !== text) label.textContent = text
            if (applyBtn.getAttribute("aria-label") !== aria) applyBtn.setAttribute("aria-label", aria)
            if (applyBtn.title !== aria) applyBtn.title = aria
        }

        if (!app) { badge?.remove(); return }

        const status = app.data.status
        if (badge?.dataset.status === status) return      // nothing changed: don't touch the DOM

        const el = badge || document.createElement("span")
        el.dataset.status = status
        el.className = `status-badge card-status status-badge--${status}`
        el.textContent = STATUS[status]?.label ?? "Unknown"
        if (!badge) card.prepend(el)
        })  
    }

    document.addEventListener("applications:changed", () => {
        renderTracker()
        decorateCards()
    })

    document.addEventListener("modal:open", (e) => {
        const job = e.detail?.job
        const app = job && Applications.get(Applications.keyOf(job.id, job.origin))
        if (!app) return
        const status = app.data.status
        document.querySelector("#internship-modal-content .detail-hero__text")?.insertAdjacentHTML(
            "beforeend",
            `<span class="status-badge status-badge--${status}">${esc(STATUS[status]?.label ?? "Unknown")}</span>`
        )
    })


    document.addEventListener("click", (e) => {
        if (e.target.closest(".application-retry")) Applications.reload()

        const statusBtn = e.target.closest("[data-set-status]")
        if (statusBtn) Applications.updateStatus(statusBtn.dataset.jobKey, statusBtn.dataset.setStatus)
        
        const viewBtn = e.target.closest("[data-view-job]")
        if (viewBtn) Applications.openFromRecord(viewBtn.dataset.viewJob)

    })

    const grid = document.getElementById("internshipGrid")
    if (grid) new MutationObserver(decorateCards).observe(grid, { childList: true })  // direct children only

    renderTracker()
    decorateCards()

    
})();