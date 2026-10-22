import { EVENT } from "../config/event.js"

// Registration link labels per phase. "short" fits the hero and footer buttons; "long" names Luma
// where the link sits under the registration steps. Every [data-registration-link] reads these.
const CTA_LABELS = {
  before_registration: { short: "Get notified", long: "Get notified on Luma" },
  registration_open: { short: "Register now", long: "Register on Luma" },
  registration_closed: { short: "View event", long: "View event on Luma" },
  race_day: { short: "View event", long: "View event on Luma" }
}

export function ctaLabel(phase, variant = "short") {
  const labels = CTA_LABELS[phase]
  return labels[variant] ?? labels.short
}

// Which phase of the event timeline `now` falls in, and what the countdown should show.
// Boundaries: opens <= now <= closes is open; now >= race start is race day.
export function phaseAt(now, event = EVENT) {
  const opens = new Date(event.registrationOpensAt)
  const closes = new Date(event.registrationClosesAt)
  const race = new Date(event.raceStartsAt)

  if (now < opens) return describe("before_registration", opens, "Registration opens in")
  if (now <= closes) return describe("registration_open", closes, "Registration closes in")
  if (now < race) return describe("registration_closed", race, "Race day in")
  return describe("race_day", null, "It's race day!")
}

function describe(phase, target, heading) {
  return { phase, target, heading, ctaLabel: ctaLabel(phase) }
}

// Whole-unit time left until `target`. Never negative; null or past target gives zeros.
export function remaining(now, target) {
  const totalMs = target ? Math.max(0, target.getTime() - now.getTime()) : 0
  const totalSeconds = Math.floor(totalMs / 1000)
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalMs
  }
}
