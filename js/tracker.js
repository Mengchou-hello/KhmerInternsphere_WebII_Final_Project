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
            '<div class="application-msg">No applications yet. Open an internship and press Apply and track  </div>';
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

                    <div class="application-actions">
                    </div>
                    
                </li>`,
            )
          .join("") +
          '</ul>'
        }
        section.innerHTML = `<h2 class="application-section-title"> My Applications <span class="count">${list.length}</span></h2>${body}`
    }

    document.addEventListener("applications:changed", renderTracker)
    document.getElementById("tracker-section")?.addEventListener("click", (e) => {
        if(e.target.closest(".application-retry")) Applications.reload()
            
    })

    renderTracker()
    
})();