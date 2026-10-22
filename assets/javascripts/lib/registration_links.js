import { EVENT } from "../config/event.js"
import { ctaLabel, phaseAt } from "./event_phase.js"

// Points every a[data-registration-link] at EVENT.registrationUrl and sets the text of its
// [data-registration-label] for the phase. The attribute's value picks the wording ("short" or
// "long", see ctaLabel). The label text written in index.html is the no-JS default.
// Called at boot by application.js and again by the countdown whenever the phase changes.
export function updateRegistrationLinks(phase = phaseAt(new Date()).phase, root = document) {
  root.querySelectorAll("a[data-registration-link]").forEach((link) => {
    link.href = EVENT.registrationUrl
    const label = link.querySelector("[data-registration-label]")
    if (label) label.textContent = ctaLabel(phase, label.dataset.registrationLabel)
  })
}
