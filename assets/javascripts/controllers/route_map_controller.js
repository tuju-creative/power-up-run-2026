import { drawOffset, loopDistance, planeTransformCss, scrollProgress } from "../lib/route_map_progress.js"

// Scroll-linked route map. As the stage scrolls into view its plane eases from tilted to flat
// and the route strokes draw in step; markers ([data-route-map-at] = share of the route) pop in
// as the line reaches them. Once fully drawn, a runner dot laps the route every 12s.
// - One rAF-throttled update: passive scroll/resize listeners only mark the progress dirty.
// - Paused while offscreen (IntersectionObserver) or while the tab is hidden.
// - Reduced motion: flat map, route fully drawn, no runner (also when the setting changes).
// The markup's resting state is the flat, drawn map, so it reads fine without JS.
export default class RouteMapController {
  constructor(element) {
    this.element = element
  }

  connect() {
    this.plane = this.element.querySelector("[data-route-map-plane]")
    this.track = this.element.querySelector("[data-route-map-track]")
    this.strokes = [...this.element.querySelectorAll("[data-route-map-draw]")]
    this.markers = [...this.element.querySelectorAll("[data-route-map-at]")]
      .map((element) => ({ element, at: Number(element.dataset.routeMapAt) }))
    this.runner = this.element.querySelector("[data-route-map-runner]")
    if (!this.plane || !this.track?.getTotalLength) return

    this.length = this.track.getTotalLength()
    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    this.onScreen = !("IntersectionObserver" in window)
    this.progress = null
    this.elapsed = 0
    this.lastTime = null
    this.frame = this.frame.bind(this)

    const markDirty = () => {
      this.dirty = true
      this.schedule()
    }
    window.addEventListener("scroll", markDirty, { passive: true })
    window.addEventListener("resize", markDirty, { passive: true })
    document.addEventListener("visibilitychange", () => this.sync())
    this.reduceMotion.addEventListener("change", () => this.sync())
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        this.onScreen = entries.at(-1).isIntersecting
        this.sync()
      }, { rootMargin: "15% 0px" }).observe(this.element)
    }

    this.sync()
  }

  get running() {
    return this.onScreen && !document.hidden && !this.reduceMotion.matches
  }

  // Lifecycle

  sync() {
    if (this.reduceMotion.matches) {
      this.settle()
      return
    }

    if (!this.element.classList.contains("is-live")) {
      this.strokes.forEach((stroke) => { stroke.style.strokeDasharray = `${this.length} ${this.length}` })
      this.element.classList.add("is-live")
      this.render(this.measure()) // set the starting pose now, before it scrolls into view
    }
    this.element.classList.toggle("is-paused", !this.running)
    this.dirty = true
    this.schedule()
  }

  schedule() {
    if (this.running && !this.request) this.request = requestAnimationFrame(this.frame)
  }

  frame(now) {
    this.request = null
    if (!this.running) {
      this.lastTime = null
      return
    }

    if (this.dirty) {
      this.dirty = false
      this.render(this.measure())
    }

    if (this.progress >= 1) {
      this.advanceRunner(now)
      this.request = requestAnimationFrame(this.frame)
    } else {
      this.lastTime = null
    }
  }

  // Rendering

  measure() {
    const { top } = this.element.getBoundingClientRect()
    return scrollProgress({ top, viewportHeight: window.innerHeight })
  }

  render(progress) {
    if (progress === this.progress) return
    this.progress = progress

    this.plane.style.transform = planeTransformCss(progress)
    const offset = drawOffset(progress, this.length)
    this.strokes.forEach((stroke) => { stroke.style.strokeDashoffset = offset })
    this.markers.forEach(({ element, at }) => element.classList.toggle("is-passed", progress >= at))
    this.element.classList.toggle("is-tilted", progress < 1)
    this.element.classList.toggle("is-running", progress >= 1)
  }

  advanceRunner(now) {
    if (!this.runner) return
    const delta = this.lastTime == null ? 0 : Math.min(100, now - this.lastTime)
    this.lastTime = now
    this.elapsed += delta

    const point = this.track.getPointAtLength(loopDistance(this.elapsed, this.length))
    this.runner.setAttribute("transform", `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`)
  }

  // Reduced motion: back to the markup's resting state (flat, drawn, no runner).
  settle() {
    if (this.request) cancelAnimationFrame(this.request)
    this.request = null
    this.progress = null
    this.lastTime = null
    this.plane.style.removeProperty("transform")
    this.strokes.forEach((stroke) => {
      stroke.style.removeProperty("stroke-dasharray")
      stroke.style.removeProperty("stroke-dashoffset")
    })
    this.element.classList.remove("is-live", "is-tilted", "is-running", "is-paused")
  }
}
