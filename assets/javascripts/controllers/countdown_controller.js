import { phaseAt, remaining } from "../lib/event_phase.js"
import { updateRegistrationLinks } from "../lib/registration_links.js"
import { DIAL_MAX, SEGMENTS, countdownSummary, litSegments, msUntilNextSecond, pad2, segmentPath } from "../lib/countdown_dial.js"

// Hero countdown: four segmented dials plus a phase-driven heading.
// Ticks on each wall-clock second and re-reads the phase every tick, so the heading, target and
// every registration link label (lib/registration_links.js) switch live at each boundary. The
// visible dials are aria-hidden; screen readers get [data-countdown-summary], plain visually
// hidden text whose wording only changes once a minute. It is deliberately not a live region,
// so nothing is announced while the page sits open.
//
// Targets: [data-countdown-heading], [data-countdown-unit] dials (each with
// [data-countdown-ring] svg and [data-countdown-value]), [data-countdown-summary].
const SVG_NS = "http://www.w3.org/2000/svg"
const RING = { cx: 100, cy: 100, inner: 80, outer: 97 }
const TICK_SLACK_MS = 15 // land just after the second boundary so flooring reads the new second

const LEAVE = [
  { transform: "translateY(0) rotateX(0deg)", opacity: 1 },
  { transform: "translateY(-38%) rotateX(80deg)", opacity: 0 }
]
const ENTER = [
  { transform: "translateY(38%) rotateX(-80deg)", opacity: 0 },
  { transform: "translateY(0) rotateX(0deg)", opacity: 1 }
]
const LEAVE_TIMING = { duration: 320, easing: "cubic-bezier(0.55, 0, 1, 0.45)", fill: "forwards" }
const ENTER_TIMING = { duration: 560, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }

export default class CountdownController {
  constructor(element) {
    this.element = element
  }

  connect() {
    this.heading = this.element.querySelector("[data-countdown-heading]")
    this.summary = this.element.querySelector("[data-countdown-summary]")
    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    this.dials = [...this.element.querySelectorAll("[data-countdown-unit]")].map((element) => this.buildDial(element))

    this.tick = this.tick.bind(this)
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.stop()
      else this.tick()
    })

    this.render(false)
    this.armRings()
    this.schedule()
  }

  // Ticking

  tick() {
    this.render(!this.reduceMotion.matches)
    this.schedule()
  }

  schedule() {
    this.stop()
    this.timer = setTimeout(this.tick, msUntilNextSecond(Date.now()) + TICK_SLACK_MS)
  }

  stop() {
    clearTimeout(this.timer)
  }

  render(animate) {
    const now = new Date()
    const { phase, target, heading } = phaseAt(now)
    const time = remaining(now, target)

    if (phase !== this.phase) {
      this.phase = phase
      this.element.dataset.phase = phase
      if (this.heading) this.heading.textContent = heading
      updateRegistrationLinks(phase)
    }

    this.dials.forEach((dial) => {
      const value = time[dial.unit]
      this.showDigits(dial, pad2(value), animate)
      dial.lit = litSegments(value, DIAL_MAX[dial.unit])
      if (this.ringsArmed) this.showLit(dial)
    })

    const summary = countdownSummary(heading, time, target !== null)
    if (this.summary && this.summary.textContent !== summary) this.summary.textContent = summary
  }

  // Rings light up with a sweep the first time the countdown is on screen.
  armRings() {
    const arm = () => {
      this.ringsArmed = true
      requestAnimationFrame(() => this.dials.forEach((dial) => this.showLit(dial)))
    }
    if (this.reduceMotion.matches || !("IntersectionObserver" in window)) {
      arm()
      return
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect()
        arm()
      }
    }, { threshold: 0.3 })
    observer.observe(this.element)
  }

  // Dials

  buildDial(element) {
    const ring = element.querySelector("[data-countdown-ring]")
    const value = element.querySelector("[data-countdown-value]")
    const segments = []
    const fragment = document.createDocumentFragment()

    for (let index = 0; index < SEGMENTS; index++) {
      // Colour runs orange-deep -> orange -> amber -> yellow around the ring in three bands;
      // CSS mixes the band's two tokens by --t.
      const position = (index / (SEGMENTS - 1)) * 3
      const band = Math.min(2, Math.floor(position))
      const segment = document.createElementNS(SVG_NS, "path")
      segment.setAttribute("class", "dial__segment")
      segment.setAttribute("d", segmentPath(index, SEGMENTS, RING))
      segment.dataset.band = band
      segment.style.setProperty("--t", (position - band).toFixed(3))
      segment.style.setProperty("--i", index)
      segments.push(segment)
      fragment.append(segment)
    }
    ring?.append(fragment)
    if (value) value.textContent = ""

    return { unit: element.dataset.countdownUnit, value, segments, slots: [], text: "", lit: 0, shown: 0 }
  }

  showLit(dial) {
    const { segments, lit, shown } = dial
    for (let index = Math.min(lit, shown); index < Math.max(lit, shown); index++) {
      segments[index].classList.toggle("is-lit", index < lit)
    }
    segments[shown - 1]?.classList.remove("is-head")
    segments[lit - 1]?.classList.add("is-head")
    dial.shown = lit
  }

  showDigits(dial, text, animate) {
    if (!dial.value || text === dial.text) return

    if (dial.slots.length !== text.length) {
      dial.slots = [...text].map((character) => {
        const slot = document.createElement("span")
        slot.className = "dial__digit"
        slot.append(this.glyph(character))
        return slot
      })
      dial.value.replaceChildren(...dial.slots)
    } else {
      [...text].forEach((character, index) => this.flip(dial.slots[index], character, animate))
    }
    dial.text = text
  }

  flip(slot, character, animate) {
    slot.querySelectorAll("[data-leaving]").forEach((glyph) => glyph.remove())
    const current = slot.firstElementChild
    if (current?.textContent === character) return

    const next = this.glyph(character)
    slot.append(next)
    if (!current) return
    if (!animate || typeof current.animate !== "function") {
      current.remove()
      return
    }

    current.dataset.leaving = ""
    current.animate(LEAVE, LEAVE_TIMING).onfinish = () => current.remove()
    next.animate(ENTER, ENTER_TIMING)
  }

  glyph(character) {
    const glyph = document.createElement("span")
    glyph.className = "dial__glyph"
    glyph.textContent = character
    return glyph
  }
}
