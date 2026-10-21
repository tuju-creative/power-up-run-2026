// FAQ accordion on top of native <details>. Without JS the `name="faq"` attribute already gives
// one-open-at-a-time. With JS we take over so the open and close can animate: the height is
// animated with the Web Animations API, siblings are closed (animated) when one opens, and under
// prefers-reduced-motion everything is instant.
const DURATION = 320
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)"

export default class FaqController {
  constructor(element) {
    this.element = element
    this.animations = new WeakMap()
    this.onClick = this.onClick.bind(this)
  }

  connect() {
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    this.items = Array.from(this.element.querySelectorAll("details"))
    // The native exclusive group would close siblings instantly; we close them ourselves.
    this.items.forEach((item) => item.removeAttribute("name"))
    this.items.forEach((item) => {
      item.querySelector("summary").addEventListener("click", (event) => this.onClick(event, item))
    })
  }

  onClick(event, item) {
    event.preventDefault()
    if (item.open && !this.isClosing(item)) {
      this.close(item)
    } else {
      this.items.forEach((other) => { if (other !== item && other.open) this.close(other) })
      this.open(item)
    }
  }

  isClosing(item) {
    return item.dataset.state === "closing"
  }

  open(item) {
    const summary = item.querySelector("summary")
    const from = this.currentHeight(item) ?? summary.offsetHeight
    this.cancel(item)
    item.open = true
    item.dataset.state = "opening"
    if (this.reducedMotion.matches) return this.settle(item)

    item.style.overflow = "hidden"
    const to = this.fullHeight(item)
    this.run(item, from, to, () => this.settle(item))
  }

  close(item) {
    const summary = item.querySelector("summary")
    const from = this.currentHeight(item) ?? item.offsetHeight
    this.cancel(item)
    if (this.reducedMotion.matches) {
      item.open = false
      return this.settle(item)
    }

    item.dataset.state = "closing"
    item.style.overflow = "hidden"
    this.run(item, from, summary.offsetHeight, () => {
      item.open = false
      this.settle(item)
    })
  }

  // Height of an item mid-animation, or null if it is not animating.
  currentHeight(item) {
    return this.animations.has(item) ? item.getBoundingClientRect().height : null
  }

  fullHeight(item) {
    item.style.height = "auto"
    const height = item.offsetHeight
    item.style.height = ""
    return height
  }

  run(item, from, to, done) {
    const animation = item.animate(
      { height: [`${from}px`, `${to}px`] },
      { duration: DURATION, easing: EASING }
    )
    this.animations.set(item, animation)
    animation.onfinish = () => { if (this.animations.get(item) === animation) done() }
    animation.oncancel = () => {}
  }

  cancel(item) {
    const animation = this.animations.get(item)
    if (!animation) return
    this.animations.delete(item)
    animation.cancel()
  }

  settle(item) {
    this.animations.delete(item)
    item.style.height = ""
    item.style.overflow = ""
    delete item.dataset.state
  }
}
