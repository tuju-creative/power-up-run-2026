// Counts an integer up from 0 to data-count-up-to when the element scrolls into view.
// Keep the final value as the element's text in the HTML so it reads correctly without JS.
const DURATION_MS = 1200

export default class CountUpController {
  constructor(element) {
    this.element = element
  }

  connect() {
    this.target = Number(this.element.dataset.countUpTo)
    if (!Number.isFinite(this.target)) return

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduceMotion || !("IntersectionObserver" in window)) {
      this.render(this.target)
      return
    }

    this.render(0)
    this.observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        this.observer.disconnect()
        this.start()
      }
    }, { threshold: 0.3 })
    this.observer.observe(this.element)
  }

  start() {
    const startedAt = performance.now()
    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / DURATION_MS)
      const eased = 1 - Math.pow(1 - progress, 3)
      this.render(this.target * eased)
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  render(value) {
    this.element.textContent = String(Math.round(value))
  }
}
