// the file is wrapped in iife (immediately invoked function execution)
(() => {  
    "use strict";
    if (window.__kisApplicationLoaded) return; //never run twice
    window.__kisApplicationLoaded = true;

    // identity helpers 
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
    // error helpers
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
    const applications = new Map()
    let state = "loading"
    let errorMsg = ""

    const loadApplications = async () => {
        try{
            state = "loading"
            const rows = await apiGet("application")
            const valid = (rows) =>
                rows.filter((r) => r && r.id != null && r.data && r.data.jobId != null);
    
            applications.clear()
            
            valid(rows).forEach((r) => {
                applications.set(keyOf(r.data.jobId, r.data.origin),
                {serverId: r.id, data: r.data})
            })
            state = "ready"
            errorMsg = ""

        } catch (err) {
            state = "error"
            errorMsg = friendly(err)
        } finally {
            document.dispatchEvent(new CustomEvent("applications:changed"))

        }
    }

    window.Applications = {
        get: (jobKey) => applications.get(jobKey),
        list: () => [...applications.values()],
        getState: () => state,
        reload: loadApplications,
    }

    loadApplications()
    console.log("application.js loaded")
    
})();

