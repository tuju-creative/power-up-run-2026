// Adds `is-revealed` once at least 15% of the element has entered the viewport.
// Optional: data-reveal-delay="ms" staggers the transition.
export default class RevealController {
  constructor(element) {
    this.element = element
  }

  connect() {
    const delay = this.element.dataset.revealDelay
    if (delay) this.element.style.setProperty("--reveal-delay", `${Number(delay)}ms`)

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduceMotion || !("IntersectionObserver" in window)) {
      this.reveal()
      return
    }

    this.observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) this.reveal()
    }, { threshold: 0.15 })
    this.observer.observe(this.element)
  }

  reveal() {
    this.observer?.disconnect()
    this.element.classList.add("is-revealed")
    // Drop the stagger delay afterwards so later hover transitions are not delayed.
    this.element.addEventListener("transitionend", () => {
      this.element.style.removeProperty("--reveal-delay")
    }, { once: true })
  }
}
