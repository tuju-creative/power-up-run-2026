// Runner's kit tile: a tap (or Enter / Space) toggles `is-active`, which gives touch and
// keyboard users the same lift-and-turn that hover gives a mouse. Other tiles in the same
// grid are switched off so only one stays raised. The tile is exposed as a toggle button
// (role, aria-pressed, aria-label from the caption).
export default class KitController {
  constructor(element) {
    this.element = element
    this.toggle = this.toggle.bind(this)
    this.onKeydown = this.onKeydown.bind(this)
  }

  connect() {
    const caption = this.element.closest("figure")?.querySelector("figcaption")?.textContent.trim()
    this.element.setAttribute("role", "button")
    if (caption) this.element.setAttribute("aria-label", caption)
    this.element.setAttribute("aria-pressed", "false")
    this.element.addEventListener("click", this.toggle)
    this.element.addEventListener("keydown", this.onKeydown)
  }

  toggle() {
    const active = !this.element.classList.contains("is-active")
    this.element.closest(".kit")?.querySelectorAll(".kit-tile.is-active").forEach((tile) => {
      tile.classList.remove("is-active")
      tile.setAttribute("aria-pressed", "false")
    })
    this.element.classList.toggle("is-active", active)
    this.element.setAttribute("aria-pressed", String(active))
  }

  onKeydown(event) {
    if (event.key !== "Enter" && event.key !== " ") return
    event.preventDefault() // Space would otherwise scroll the page
    this.toggle()
  }
}
