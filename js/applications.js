// the file is wrapped in iife (immediately invoked function execution)
(() => {
    "use strict";
    if (window.__kisApplicationLoaded) return; //never run twice
    window.__kisApplicationLoaded = true;

    // vairables
    let applicationModal = null
    let previousFocus = null
    let previousOverflow = ""
    let currentJob = null
    let modalJob = null
    const esc = window.KISCard.esc
    const pending = new Set()


    // helpers
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
        return "The free service has reached its request limit for now. Please try again later.";
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
        getErrorMsg: () => errorMsg,
        open: (job) => openApplicationModal(job),
        reload: loadApplications,
        keyOf,
        updateStatus,
        nextStatuses: (status) => TRANSITIONS[status] ?? [],
        isPending: (jobKey) => pending.has(jobKey),
        openFromRecord: (jobKey) => openFromRecord(jobKey),

    }

    loadApplications()
    console.log("application.js loaded")

    const fillForm = (form, data) => {
        const a = data.applicant || {}
        const set = (name, value) => { if (form.elements[name]) form.elements[name].value = value ?? "" }
        set("fullName", a.fullName)
        set("email", a.email)
        set("tel", a.phone)
        set("university", a.university)
        set("major", a.major)
        set("availability", a.availability)
        set("coverLetter", data.coverLetter)
        set("cvLink", data.cvLink)
        form.elements.consent.checked = true

        if (data.cv) {                                   // keep the stored CV unless a new one is chosen
            form.elements.cv.required = false
            form.querySelector("#cv-info").textContent =
                `Current file: ${data.cv.name} (${Math.round(data.cv.size / 1024)} KB). Choose a new file only to replace it.`
        }
    }

    const lockForm = (form, status) => {
        form.querySelectorAll("input, textarea").forEach((el) => { el.disabled = true })
        form.querySelector(".app-submit-btn").hidden = true
        const label = window.Tracker?.STATUS[status]?.label ?? status
        form.querySelector(".app-note").insertAdjacentHTML(
            "afterend",
            `<p class="app-readonly-note">This application can no longer be edited because it is "${esc(label)}".</p>`
        )
    }

    // render application form
    const renderApplicationForm = (job, existing = null) => {
        const originalLink = isHttpUrl(job.url)
        ? `<a class="app-original-link" href="${esc(job.url)}" target="_blank" rel="noopener noreferrer">Apply on the original listing ↗</a>`
        : ""

        const heading = existing ? `Your application: ${job.title}` : `Apply to ${job.title}`
        const progress = existing && window.Tracker
            ? `<div class="app-progress">${window.Tracker.renderStepper(existing.data)}</div>`
            : ""

        document.getElementById("application-modal-content").innerHTML =
        `<div class="detail-hero">` +
        `<img class="detail-logo" referrerpolicy="no-referrer" src="${esc(job.logo || CONFIG.FALLBACK_LOGO)}" alt="${esc(job.company)} logo">` +
        `<div class="detail-hero__text"><p class="detail-company">${esc(job.company)}</p><h2 id="app-title" class="app-modal-title">Apply to ${esc(heading)}</h2></div>` +
        `</div>` +
        progress + 
        `<form id="application-form" noValidate class="app-form">
            <div class="app-form__body">
                <p class="app-note">Demo: do not enter sensitive information</p>
                <fieldset>
                    <legend>Contact Information</legend>
                    <div class="form-group">
                        <label for="full-name">Full Name <span class="req" aria-hidden="true">*</span></label>
                        <input type="text" id="full-name" name="fullName" placeholder="e.g. Som Eoern" required autocomplete="name"
                        aria-required="true" />
                    </div>

                    <div class="form-group">
                        <label for="email">Email <span class="req" aria-hidden="true">*</span></label>
                        <input type="email" id="email" name="email" placeholder="e.g. SomEoern@gmail.com" required autocomplete="email"
                        aria-required="true"/>
                    </div>

                    <div class="form-group">
                        <label for="tel">Phone Number <span class="req" aria-hidden="true">*</span></label>
                        <input type="tel" id="tel" name="tel" placeholder="e.g. +855 123 456 789" required autocomplete="tel"
                        aria-required="true"/>
                    </div>
                </fieldset>

                <fieldset>
                    <legend>Education</legend>
                    <div class="form-group">
                        <label for="university">University <span class="req" aria-hidden="true">*</span></label>
                        <input type="text" id="university" name="university" placeholder="e.g. AUPP" required
                        aria-required="true"/>
                    </div>

                    <div class="form-group">
                        <label for="major">Major</label>
                        <input type="text" id="major" name="major" placeholder="e.g. Computer Science"
                        aria-required="false"/>
                    </div>

                    <div class="form-group">
                        <label for="availability">Availability </label>
                        <input type="date" id="availability" name="availability" aria-required="false"/>
                    </div>
                </fieldset>

                <fieldset>
                    <legend>Document</legend>
                    <div class="form-group">
                        <label for="cover-letter">Cover Letter </label>
                        <textarea id="cover-letter" name="coverLetter"
                            placeholder="Write your cover letter here (maximum 1000 characters)" maxLength="1000"
                            aria-required="false"></textarea>
                    </div>

                    <div class="form-group">
                        <label for="cv">CV (PDF, max 2 MB) <span class="req" aria-hidden="true">*</span></label>
                        <input type="file" id="cv" name="cv" accept="application/pdf,.pdf" required>
                        <p id="cv-info" class="app-file-info" aria-live="polite"></p>
                    </div>

                    <div class="form-group">
                        <label for="cv-link">CV link (optional)</label>
                        <input type="url" id="cv-link" name="cvLink" placeholder="https://drive.google.com/...">
                    </div>

                    <div class="form-group form-group--check">
                        <input type="checkbox" id="consent" name="consent" required>
                        <label for="consent">I confirm my details are correct <span class="req" aria-hidden="true">*</span></label>
                    </div>
                </fieldset>
                <div class="app-errors" aria-live="polite"></div>
            </div>

            <div class="app-form__actions">
                <button type="button" class="app-cancel-btn">Cancel</button>
                <button type="submit" class="app-submit-btn">${existing ? "Save changes" : "Submit"}</button>
            </div>
        </form>`

        if (existing) {
            const form = document.getElementById("application-form")
            fillForm(form, existing.data)
            if (existing.data.status !== "submitted") lockForm(form, existing.data.status)
        }

    }

    // read the form values into the object that will be saved
    const readForm = (form) => {
        const fd = new FormData(form)
        const val = (name) => String(fd.get(name) ?? "").trim()
        const file = form.elements.cv.files[0]
        return {
            applicant: {
                fullName: val("fullName"),
                email: val("email"),
                phone: val("tel"),
                university: val("university"),
                major: val("major"),
                availability: val("availability")
            },
            coverLetter: val("coverLetter"),
            cv: file ? { name: file.name, size: file.size, type: file.type } : null,
            cvLink: val("cvLink")
        }
    }

    // application form modal
    const buildApplicationModal = () => {
        document.body.insertAdjacentHTML(
            "beforeend",
            `<div id="application-modal" class="internship-modal" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="app-title">
                <div class="internship-modal__dialog">
                    <button class="internship-modal__close" aria-label="Close form">x</button>
                    <div id="application-modal-content"></div>
                </div>
            </div>`
        )


        applicationModal = document.getElementById("application-modal")
        applicationModal.querySelector(".internship-modal__close").addEventListener("click", closeApplicationModal)
        applicationModal.addEventListener("click", (e) => {
            if (e.target === applicationModal) closeApplicationModal()
        })

        applicationModal.addEventListener("click", (e) =>{
            if (e.target.closest(".app-cancel-btn")) closeApplicationModal()
        })

      
        applicationModal.addEventListener("submit", (e) =>{
            const form = e.target
            if (form.id !== "application-form") return
            e.preventDefault()
            if (!form.checkValidity()) {
                form.reportValidity()
                return
            }
            submitApplication(readForm(form), form)
        })
        


        applicationModal.addEventListener("change", (e) =>{
            const input = e.target

            // CV file: PDF only, 2 MB max
            if (input.id === "cv") {
                const cvInfo = document.getElementById("cv-info")
                const file = input.files[0]
                if (!file) {
                    input.setCustomValidity("")
                    cvInfo.textContent = ""
                    return
                }
                const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
                const smallEnough = file.size <= 2 * 1024 * 1024
                if (!isPdf) input.setCustomValidity("Please choose a PDF file")
                else if (!smallEnough) input.setCustomValidity("The file must be 2 MB or smaller")
                else input.setCustomValidity("")
                // validationMessage is the custom message above, or "" when the file is fine
                cvInfo.textContent = input.validationMessage || `${file.name} (${Math.round(file.size / 1024)} KB)`
                return
            }

            // CV link: optional, but if filled it must be http(s)
            if (input.id === "cv-link") {
                input.setCustomValidity(input.value && !isHttpUrl(input.value) ? "Enter a valid https link" : "")
            }
        })


        return applicationModal
    }


    // open application modal
    const openApplicationModal = (job) => {
        if (!job) return

        // no 2 modals open at the same time
        window.closeDetailModal?.()

        applicationModal = document.getElementById("application-modal") || buildApplicationModal()

        if (!applicationModal.classList.contains("is-open")) {
            previousFocus = document.activeElement
            previousOverflow = document.body.style.overflow
        }

        currentJob = job
        const existing = applications.get(keyOf(job.id, job.origin))     // undefined for a new application
        renderApplicationForm(job, existing)
        document.body.style.overflow = "hidden"
        applicationModal.classList.add("is-open")
        applicationModal.setAttribute("aria-hidden", "false")
        ;(applicationModal.querySelector("input:not(:disabled)") 
            || applicationModal.querySelector(".internship-modal__close"))?.focus()

    }

    // close application modal
    const closeApplicationModal = () => {
        if (!applicationModal || !applicationModal.classList.contains("is-open")) return

        applicationModal.classList.remove("is-open")
        applicationModal.setAttribute("aria-hidden", "true")
        document.body.style.overflow = previousOverflow

        if (previousFocus && document.contains(previousFocus) && previousFocus.focus) {
            previousFocus.focus()
        }
        previousFocus = null
        currentJob = null
    }

    const openFromRecord = (jobKey) => {
        const entry = applications.get(jobKey)
        if (!entry) return
        const d = entry.data
        openApplicationModal({
            id: d.jobId, title: d.title, company: d.company,
            location: d.location, logo: d.logo, url: d.url, origin: d.origin,
        })
    }

    async function submitApplication(payload, form) {
        if (!currentJob) return
        let jobKey = keyOf(currentJob.id, currentJob.origin)

        if (applications.has(jobKey)) return saveEdits(jobKey, payload, form)


        if (pending.has(jobKey)) return //if this job being submitted rn, return
        pending.add(jobKey)
        let submitBtn = form.querySelector(".app-submit-btn")
        submitBtn.disabled = true
        submitBtn.textContent = "Submitting..."
        form.querySelector(".app-errors").textContent = ""

        const now = new Date().toISOString()
        const data = {
            jobKey, 
            jobId: currentJob.id, 
            title: currentJob.title, 
            company: currentJob.company, 
            location: currentJob.location, 
            logo: currentJob.logo, 
            url: currentJob.url,   // snapshot of currentJob

            origin: originOf(currentJob.id, currentJob.origin),
            ...payload,                                            // applicant, coverLetter, cv, cvLink
            status: "submitted",
            submittedAt: now,
            updatedAt: now,
            history: [{ status: "submitted", at: now, note: "" }]
        }

        try{
            const rec = await apiPost("application", data)
            if (!rec || rec.id == null) throw new Error("The server did not confirm your application.")
            applications.set(jobKey, {serverId: rec.id, data})
            document.dispatchEvent(new CustomEvent("applications:changed"))
            toast("Application submitted", "ok")
            closeApplicationModal()
        } catch (err) {
            form.querySelector(".app-errors").textContent = friendly(err)
        } finally {
            pending.delete(jobKey)
            submitBtn.disabled = false
            submitBtn.textContent = "Submit"
        }

    } 

    // allowed status changes: the process only moves forward
    const TRANSITIONS = {
        submitted: ["under_review"],
        under_review: ["accepted", "rejected"],
        accepted: [],
        rejected: [],
    }
    const changed = () => document.dispatchEvent(new CustomEvent("applications:changed"))

    async function updateStatus(jobKey, next) {
        const entry = applications.get(jobKey)
        if (!entry || pending.has(jobKey)) return false
        if (!TRANSITIONS[entry.data.status]?.includes(next)) {
            toast("That status change is not allowed.")
            return false
        }

        pending.add(jobKey)
        changed()                                   // lets the buttons show as busy

        const now = new Date().toISOString()
        const newData = {
            ...entry.data,
            status: next,
            updatedAt: now,
            history: [...(entry.data.history || []), { status: next, at: now, note: "" }],
        }

        try {
            await apiPut(entry.serverId, "application", newData)
            applications.set(jobKey, { serverId: entry.serverId, data: newData })
            toast("Status updated", "ok")
            return true
        } catch (err) {
            if (isNotFound(err)) {
                applications.delete(jobKey)         // it no longer exists on the server
                toast("This application no longer exists.")
            } else {
                toast(`Could not update the status. ${friendly(err)}`)
            }
            return false
        } finally {
            pending.delete(jobKey)
            changed()
        }
    }
    async function saveEdits(jobKey, payload, form) {
        const entry = applications.get(jobKey)
        if (!entry || pending.has(jobKey)) return
        if (entry.data.status !== "submitted") {
            toast("This application can no longer be edited.")
            return
        }

        pending.add(jobKey)
        const btn = form.querySelector(".app-submit-btn")
        btn.disabled = true
        btn.textContent = "Saving..."
        form.querySelector(".app-errors").textContent = ""

        const newData = {
            ...entry.data,
            ...payload,
            cv: payload.cv ?? entry.data.cv,            // no new file chosen: keep the old one
            updatedAt: new Date().toISOString(),
        }

        try {
            await apiPut(entry.serverId, "application", newData)
            applications.set(jobKey, { serverId: entry.serverId, data: newData })
            changed()
            toast("Changes saved", "ok")
            closeApplicationModal()
        } catch (err) {
            form.querySelector(".app-errors").textContent = friendly(err)
        } finally {
            pending.delete(jobKey)
            btn.disabled = false
            btn.textContent = "Save changes"
        }
    }

    
    document.addEventListener("modal:open", (e) => {modalJob = e.detail.job})

    document.addEventListener("click", (e) => {
        const cardApply = e.target.closest(".internship-card .card-btn--apply")
        // apply button on intern card
        if (cardApply) {
            e.preventDefault()                                   
            const card = cardApply.closest(".internship-card")
            openApplicationModal(window.getJobById?.(card.dataset.id))
            return
        }    
        // apply button inside detail modal
        if (e.target.closest(".detail-apply")) {
            e.preventDefault()
            openApplicationModal(modalJob)
        }
    }, true)

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && applicationModal?.classList.contains("is-open")) closeApplicationModal()
    })

})();

