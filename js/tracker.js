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
        let body;
        if (state === "loading") {
            body =
            '<div class="application-msg" role="status"><span class="saved-spinner"></span> Loading your applications...</div>';
        } else if (state === "error") {
            body = 
            `<div class="application-msg application-error" role="alert"><p>${esc(errorMsg)}</p>` +
            '<button type="button" class="application-retry retry-btn">Try again</button></div>';
        } else if (state.length === 0) {
            body = 
            '<div class="application-msg">No applications yet. Open an internship and press Apply <div>';
        } else {
            body =
            '<ul class="application-list">' +
            [...applications.entries()]
                .map(
                    ([id, { job }]) => `
                <li class="application-item">
                    <img class="application-logo" referrerpolicy="no-referrer" src="${esc(job.logo || FALLBACK_LOGO)}" alt="">
                    <title></title>
                    <label></label>
                    
                </li>`,
            )
          .join("") +
          '</ul>'
        }
    }
})();