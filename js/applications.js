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
        getErrorMsg: () => errorMsg,
        open: (job) => openApplicationModal(job),
        reload: loadApplications,
    }

    loadApplications()
    console.log("application.js loaded")


    // render application form
    const renderApplicationForm = (job) => {
        document.getElementById("application-modal-content").innerHTML =
        `<div class="detail-hero">` +
        `<img class="detail-logo" referrerpolicy="no-referrer" src="${esc(job.logo || CONFIG.FALLBACK_LOGO)}" alt="${esc(job.company)} logo">` +
        `<div class="detail-hero__text"><p class="detail-company">${esc(job.company)}</p><h2 id="app-title" class="app-modal-title">Apply to ${esc(job.title)}</h2></div>` +
        `</div>` +
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
                <button type="submit" class="app-submit-btn">Submit</button>
            </div>
        </form>`
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
            console.log(readForm(form))
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
        renderApplicationForm(job)
        document.body.style.overflow = "hidden"
        applicationModal.classList.add("is-open")
        applicationModal.setAttribute("aria-hidden", "false")
        applicationModal.querySelector("input")?.focus()
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

    // add the "Apply & track" button to the detail modal
    document.addEventListener("modal:open", (e) => {
        modalJob = e.detail.job
        const slot = document.getElementById("modal-apply-slot")
        if (!slot) return
        slot.insertAdjacentHTML(
            "afterbegin",
            `<button type="button" class="detail-apply" data-apply-open>Apply &amp; track</button>`
        )
    })

    document.addEventListener("click", (e) => {
        if (e.target.closest("[data-apply-open]")) openApplicationModal(modalJob)
    })
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && applicationModal?.classList.contains("is-open")) closeApplicationModal()
    })

})();

