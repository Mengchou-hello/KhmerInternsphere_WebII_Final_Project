/* Client-side validation for the contact form (there is no email backend). */
(() => {
  "use strict";
  const form = document.getElementById("contact-form");
  if (!form) return;

  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  // Accepts +855 96 345 678, +85596345678, 096 345 678, 096-345-678, 023 123 456, 0961234567
  const isCambodianPhone = (value) =>
    /^(?:\+855|0)[1-9]\d{7,8}$/.test(String(value).replace(/[\s.-]/g, ""));
  const PHONE_HINT = "Use a Cambodian number such as +855 96 345 678 or 096 345 678.";

  const rules = {
    "student-name": (value) => (value.trim() ? "" : "Please enter your name."),
    "student-email": (value) =>
      !value.trim()
        ? "Please enter your email address."
        : EMAIL_PATTERN.test(value.trim())
          ? ""
          : "Please enter a valid email address, like name@example.com.",
    "student-phone": (value) =>
      !value.trim() ? "Please enter your phone number." : isCambodianPhone(value) ? "" : PHONE_HINT,
    "student-message": (value) => (value.trim() ? "" : "Please enter a message."),
    // optional fields: only checked when something was typed
    "company-email": (value) =>
      !value.trim() || EMAIL_PATTERN.test(value.trim()) ? "" : "Please enter a valid email address.",
    "company-phone": (value) =>
      !value.trim() || isCambodianPhone(value) ? "" : PHONE_HINT,
  };

  // only the fields that really exist on the page (a missing id can never crash the script)
  const fields = Object.keys(rules)
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  function showError(field, message) {
    let error = document.getElementById(`${field.id}-error`);
    if (!error) {
      error = document.createElement("p");
      error.id = `${field.id}-error`;
      error.className = "field-error";
      field.insertAdjacentElement("afterend", error);
    }
    error.textContent = message;
    field.classList.toggle("has-error", Boolean(message));
    field.setAttribute("aria-invalid", String(Boolean(message)));
  }

  // returns true when the field is valid
  function validate(field) {
    const message = rules[field.id](field.value);
    showError(field, message);
    return !message;
  }

  function clearSuccess() {
    const success = document.getElementById("contact-success");
    if (success) success.textContent = "";
  }

  function showSuccess() {
    let success = document.getElementById("contact-success");
    if (!success) {
      success = document.createElement("p");
      success.id = "contact-success";
      success.className = "contact-success";
      success.setAttribute("role", "status");
      const button = form.querySelector(".submit-btn");
      if (button) button.insertAdjacentElement("beforebegin", success);
      else form.appendChild(success);
    }
    success.textContent = "Thank you! Your message is valid. This demo does not send emails.";
  }

  fields.forEach((field) => {
    field.setAttribute("aria-describedby", `${field.id}-error`);
    field.addEventListener("blur", () => validate(field));
    field.addEventListener("input", () => {
      clearSuccess();
      // re-check while typing once an error is showing, so it disappears as soon as it is fixed
      if (field.getAttribute("aria-invalid") === "true") validate(field);
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    clearSuccess();

    // validate EVERY field (map, not every/some, which would stop at the first invalid one)
    const results = fields.map((field) => ({ field, valid: validate(field) }));
    const firstInvalid = results.find((result) => !result.valid);
    if (firstInvalid) {
      firstInvalid.field.focus();
      return;
    }

    form.reset();
    fields.forEach((field) => showError(field, "")); // clear any leftover error state
    showSuccess();
  });
})();
