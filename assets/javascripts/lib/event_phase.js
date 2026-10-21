import { EVENT } from "../config/event.js"

// Which phase of the event timeline `now` falls in, and what the countdown should show.
// Boundaries: opens <= now <= closes is open; now >= race start is race day.
export function phaseAt(now, event = EVENT) {
  const opens = new Date(event.registrationOpensAt)
  const closes = new Date(event.registrationClosesAt)
  const race = new Date(event.raceStartsAt)

  if (now < opens) {
    return { phase: "before_registration", target: opens, heading: "Registration opens in", ctaLabel: "Get notified" }
  }
  if (now <= closes) {
    return { phase: "registration_open", target: closes, heading: "Registration closes in", ctaLabel: "Register now" }
  }
  if (now < race) {
    return { phase: "registration_closed", target: race, heading: "Race day in", ctaLabel: "View event" }
  }
  return { phase: "race_day", target: null, heading: "It's race day!", ctaLabel: "View event" }
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
