// Sticky nav: scrolled state, mobile overlay menu, and current-section highlighting.
const SCROLLED_AFTER_PX = 24
const DESKTOP_QUERY = "(min-width: 64rem)"

export default class NavController {
  constructor(element) {
    this.element = element
  }

  connect() {
    this.toggle = this.element.querySelector("[data-nav-toggle]")
    this.links = [...this.element.querySelectorAll('a[href^="#"]')]

    this.onScroll = this.onScroll.bind(this)
    this.onKeydown = this.onKeydown.bind(this)

    window.addEventListener("scroll", this.onScroll, { passive: true })
    document.addEventListener("keydown", this.onKeydown)
    this.toggle?.addEventListener("click", () => this.setOpen(!this.isOpen()))
    this.links.forEach((link) => link.addEventListener("click", () => this.setOpen(false)))
    window.matchMedia(DESKTOP_QUERY).addEventListener("change", (event) => {
      if (event.matches) this.setOpen(false)
    })

    this.onScroll()
    this.observeSections()
  }

  isOpen() {
    return this.element.classList.contains("is-open")
  }

  setOpen(open) {
    this.element.classList.toggle("is-open", open)
    document.documentElement.classList.toggle("nav-open", open)
    this.toggle?.setAttribute("aria-expanded", String(open))
    this.toggle?.setAttribute("aria-label", open ? "Close menu" : "Open menu")
  }

  onKeydown(event) {
    if (event.key === "Escape" && this.isOpen()) {
      this.setOpen(false)
      this.toggle?.focus()
    }
  }

  onScroll() {
    this.element.classList.toggle("is-scrolled", window.scrollY > SCROLLED_AFTER_PX)

    // The footer is short; mark it current once the page bottom is reached.
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
    if (atBottom && window.scrollY > 0) this.setCurrent("contact")
  }

  observeSections() {
    if (!("IntersectionObserver" in window)) return
    const sections = document.querySelectorAll("main section[id], footer[id]")
    // A thin band across the middle of the viewport decides which section is "current".
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) this.setCurrent(entry.target.id)
      })
    }, { rootMargin: "-45% 0px -54% 0px" })
    sections.forEach((section) => observer.observe(section))
  }

  setCurrent(id) {
    this.links.forEach((link) => {
      if (link.getAttribute("href") === `#${id}`) {
        link.setAttribute("aria-current", "true")
      } else {
        link.removeAttribute("aria-current")
      }
    })
  }
}
