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
    let confirmOpen = false


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
        withdraw,

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
                ${existing ? `<button type="button" class="app-withdraw-btn">Withdraw</button>` : ""}
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

    // form validation
    const NAME_RE = /^\p{L}[\p{L}\p{M}\s'.-]*$/u
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
    const PHONE_RE = /^\+?[\d\s().-]+$/

    const todayStr = () =>
        new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)

    // order here = order the form is checked, and the first bad field gets focus
    const VALIDATORS = {
        fullName: (el) => {
            const v = el.value.trim()
            if (!v) return "Enter your full name."
            if (v.length < 2) return "Your name must be at least 2 characters."
            if (!NAME_RE.test(v)) return "Use letters, spaces, hyphens or apostrophes only."
            return ""
        },
        email: (el) => {
            const v = el.value.trim()
            if (!v) return "Enter your email address."
            if (!EMAIL_RE.test(v)) return "Enter a valid email, e.g. name@example.com."
            return ""
        },
        tel: (el) => {
            const v = el.value.trim()
            const digits = v.replace(/\D/g, "")
            if (!v) return "Enter your phone number."
            if (!PHONE_RE.test(v) || digits.length < 8 || digits.length > 15)
                return "Enter a valid phone number, e.g. +855 12 345 678."
            return ""
        },
        university: (el) => {
            const v = el.value.trim()
            if (!v) return "Enter your university."
            if (v.length < 2) return "University name is too short."
            return ""
        },
        major: (el) => (el.value.trim().length > 80 ? "Major must be 80 characters or fewer." : ""),
        availability: (el) => {
            const v = el.value
            if (!v) return ""
            const stored = applications.get(keyOf(currentJob?.id, currentJob?.origin))?.data.applicant?.availability
            if (v < todayStr() && v !== stored) return "Choose today or a future date."
            if (v > "2100-01-01") return "Enter a valid date."
            return ""
        },
        coverLetter: (el) =>
            el.value.length > 1000 ? "Cover letter must be 1000 characters or fewer." : "",
        cv: (el) => {
            const file = el.files[0]
            if (!file) return el.required ? "Attach your CV as a PDF." : ""
            const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
            if (!isPdf) return "Please choose a PDF file."
            if (file.size === 0) return "That file is empty."
            if (file.size > 2 * 1024 * 1024) return "The file must be 2 MB or smaller."
            return ""
        },
        cvLink: (el) => {
            const v = el.value.trim()
            return v && !isHttpUrl(v) ? "Enter a valid link starting with https://" : ""
        },
        consent: (el) => (el.checked ? "" : "Please confirm your details are correct."),
    }

    const errorBoxOf = (el) => {
        const group = el.closest(".form-group")
        let box = group.querySelector(".app-field-error")
        if (!box) {
            box = document.createElement("p")
            box.className = "app-field-error"
            box.id = `${el.id}-error`
            group.appendChild(box)
        }
        return box
    }

    const validateField = (el) => {
        const rule = VALIDATORS[el.name]
        if (!rule || el.disabled) return true
        const msg = rule(el)
        const box = errorBoxOf(el)
        el.setCustomValidity(msg)
        box.textContent = msg
        el.classList.toggle("is-invalid", !!msg)
        if (msg) {
            el.setAttribute("aria-invalid", "true")
            el.setAttribute("aria-describedby", box.id)
        } else {
            el.removeAttribute("aria-invalid")
            el.removeAttribute("aria-describedby")
        }
        return !msg
    }

    const validateForm = (form) => {
        let firstBad = null
        for (const name of Object.keys(VALIDATORS)) {
            const el = form.elements[name]
            if (el && !validateField(el) && !firstBad) firstBad = el
        }
        form.querySelector(".app-errors").textContent = firstBad ? "Please fix the highlighted fields." : ""
        firstBad?.focus()
        return !firstBad
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
            if (e.target.closest(".app-withdraw-btn") && currentJob) {
                withdraw(keyOf(currentJob.id, currentJob.origin))
            }
        })

      
        applicationModal.addEventListener("submit", (e) =>{
            const form = e.target
            if (form.id !== "application-form") return
            e.preventDefault()
            if (!validateForm) return
            submitApplication(readForm(form), form)
        })
        


        // validate when the user leaves a text field
        applicationModal.addEventListener("focusout", (e) => {
            const el = e.target
            if (el.name in VALIDATORS && !["file", "checkbox"].includes(el.type)) validateField(el)
        })

        // once a field is marked invalid, re-check on every keystroke so the error clears as they fix it
        applicationModal.addEventListener("input", (e) => {
            const el = e.target
            if (el.classList.contains("is-invalid")) validateField(el)
            if (el.id === "cover-letter") {
                const counter = document.getElementById("cover-counter")
                if (counter) counter.textContent = `${form.elements.coverLetter.value.length} / 1000`
            }
        })

        // files, checkbox and date pickers fire change, not blur
        applicationModal.addEventListener("change", (e) => {
            const el = e.target
            if (!(el.name in VALIDATORS)) return
            const ok = validateField(el)
            if (el.id === "cv") {
                const file = el.files[0]
                if (file) {
                    document.getElementById("cv-info").textContent =
                        ok ? `${file.name} (${Math.round(file.size / 1024)} KB)` : ""
                }
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
            // document.dispatchEvent(new CustomEvent("applications:changed"))
            toast("Application submitted", "ok")
            closeApplicationModal()
        } catch (err) {
            form.querySelector(".app-errors").textContent = friendly(err)
        } finally {
            pending.delete(jobKey)
            document.dispatchEvent(new CustomEvent("applications:changed"))
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


    function confirmWithdraw(data) {
        if (confirmOpen) return Promise.resolve(false)
        confirmOpen = true
        return new Promise((resolve) => {
            const previous = document.activeElement
            const overlay = document.createElement("div")
            overlay.className = "kis-confirm"
            overlay.setAttribute("role", "alertdialog")
            overlay.setAttribute("aria-modal", "true")
            overlay.setAttribute("aria-labelledby", "kis-confirm-title")
            overlay.setAttribute("aria-describedby", "kis-confirm-text")
            overlay.innerHTML = `
                <div class="kis-confirm__box">
                    <h2 class="kis-confirm__title" id="kis-confirm-title">Withdraw application?</h2>
                    <p class="kis-confirm__text" id="kis-confirm-text"></p>
                    <div class="kis-confirm__actions">
                        <button type="button" class="kis-confirm__btn kis-confirm__btn--cancel">Keep application</button>
                        <button type="button" class="kis-confirm__btn kis-confirm__btn--danger"><span>Yes, withdraw</span></button>
                    </div>
                </div>`
            const name = data && data.title ? `"${data.title}"` : "this internship"
            overlay.querySelector("#kis-confirm-text").textContent =
                `Withdraw your application to ${name}? Its progress will be deleted. You can apply again later.`
            document.body.appendChild(overlay)

            const [cancelBtn, withdrawBtn] = overlay.querySelectorAll(".kis-confirm__btn")
            const finish = (result) => {
                document.removeEventListener("keydown", onKey, true)
                overlay.remove()
                confirmOpen = false
                if (previous && previous.focus) previous.focus()
                resolve(result)
            }
            function onKey(e) {
                if (e.key === "Escape") {
                    e.preventDefault()
                    e.stopPropagation()          // so the form modal underneath doesn't also close
                    finish(false)
                    return
                }
                if (e.key === "Tab") {
                    e.preventDefault()
                    e.stopPropagation()
                    ;(document.activeElement === cancelBtn ? withdrawBtn : cancelBtn).focus()
                }
            }
            document.addEventListener("keydown", onKey, true)
            overlay.addEventListener("click", (e) => { if (e.target === overlay) finish(false) })
            cancelBtn.addEventListener("click", () => finish(false))
            withdrawBtn.addEventListener("click", () => finish(true))
            cancelBtn.focus()                    // safest default: keep the application
        })
    }

    // after a re-render the focused button may be gone, so put focus somewhere sensible
    function restoreFocus(jobKey) {
        if (document.activeElement && document.activeElement !== document.body) return
        const btn = [...document.querySelectorAll('[data-withdraw-job]')]
            .find((b) => b.dataset.key === jobKey)
        const target = btn || document.querySelector("#tracker-section .application-section-title")
        if (!target) return
        if (!target.matches("button, a, input")) target.tabIndex = -1
        target.focus()
    }

    async function withdraw(jobKey) {
        const entry = applications.get(jobKey)
        if (!entry) return { ok: false, reason: "not-found" }
        if (pending.has(jobKey)) return { ok: false, reason: "busy" }

        if (!(await confirmWithdraw(entry.data))) return { ok: false, reason: "cancelled" }

        // the state may have changed while the dialog was open
        if (!applications.has(jobKey) || pending.has(jobKey)) return { ok: false, reason: "busy" }

        pending.add(jobKey)
        changed()                                   // lets the buttons show as busy

        let failed = false
        try {
            await apiDelete(entry.serverId)         // server id, not the job key
        } catch (err) {
            if (!isNotFound(err)) {                 // 404 = already gone, which counts as success
                failed = true
                const msg = `Could not withdraw the application. ${friendly(err)}`
                toast(msg)
                const box = applicationModal?.classList.contains("is-open")
                    ? applicationModal.querySelector(".app-errors") : null
                if (box) box.textContent = msg
            }
        }
        pending.delete(jobKey)

        if (failed) {                               // keep the record, nothing was deleted
            changed()
            restoreFocus(jobKey)
            return { ok: false, reason: "error" }
        }

        applications.delete(jobKey)                 // only remove locally after the server confirms
        changed()
        toast("Application withdrawn", "ok")
        if (currentJob && keyOf(currentJob.id, currentJob.origin) === jobKey) closeApplicationModal()
        restoreFocus(jobKey)
        return { ok: true }
    }


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
            // changed()
            toast("Changes saved", "ok")
            closeApplicationModal()
        } catch (err) {
            form.querySelector(".app-errors").textContent = friendly(err)
        } finally {
            pending.delete(jobKey)
            changed()
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
        if (!applicationModal?.classList.contains("is-open")) return
        if (e.key === "Escape") { closeApplicationModal(); return }
        if (e.key !== "Tab") return

        const focusables = [...applicationModal.querySelectorAll(
            'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)'
        )].filter((el) => el.getClientRects().length > 0)
        if (!focusables.length) { e.preventDefault(); return }

        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (!applicationModal.contains(document.activeElement)) {
            e.preventDefault(); first.focus()
        } else if (e.shiftKey && document.activeElement === first) {
            e.preventDefault(); last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault(); first.focus()
        }
    })

})();

