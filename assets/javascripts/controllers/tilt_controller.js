// 3D tilt toward the pointer, with layered depth.
// - The element rotates via --tilt-rx / --tilt-ry (CSS applies them); --tilt-nx / --tilt-ny
//   (-1..1) and --tilt-glare (0..1) are exposed for parallax and shine layers.
// - Children with data-tilt-depth="px" get --tilt-z for translateZ.
// - Pointer movement is tracked across the nearest [data-tilt-area] ancestor (or the element);
//   leaving it eases back to rest.
// - Touch screens: device orientation when it works without a permission prompt, otherwise an
//   idle float (CSS class is-floating). Reduced motion: no tilt at all.
const MAX_DEGREES = 10
const SMOOTHING = 0.12
const REACH = 0.6 // full tilt at this share of the area's half-size from the element's centre
const ORIENTATION_RANGE_DEGREES = 20
const BASELINE_DRIFT = 0.02

export default class TiltController {
  constructor(element) {
    this.element = element
  }

  connect() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    this.element.querySelectorAll("[data-tilt-depth]").forEach((layer) => {
      layer.style.setProperty("--tilt-z", `${Number(layer.dataset.tiltDepth) || 0}px`)
    })

    this.area = this.element.closest("[data-tilt-area]") ?? this.element
    this.current = { x: 0, y: 0 }
    this.target = { x: 0, y: 0 }
    this.frame = this.frame.bind(this)

    this.area.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "touch") this.aimAt(event.clientX, event.clientY)
    }, { passive: true })
    this.area.addEventListener("pointerleave", () => this.aim(0, 0))
    window.addEventListener("blur", () => this.aim(0, 0))

    if (window.matchMedia("(hover: none)").matches) this.startTouchMode()
  }

  aimAt(clientX, clientY) {
    // Measure the untransformed parent so the rotation itself does not skew the centre.
    const origin = (this.element.parentElement ?? this.element).getBoundingClientRect()
    const area = this.area.getBoundingClientRect()
    this.aim(
      (clientX - (origin.left + origin.width / 2)) / ((area.width / 2) * REACH),
      (clientY - (origin.top + origin.height / 2)) / ((area.height / 2) * REACH)
    )
  }

  aim(x, y) {
    this.target = { x: clamp(x), y: clamp(y) }
    if (!this.pending) this.pending = requestAnimationFrame(this.frame)
  }

  frame() {
    this.pending = null
    this.current.x += (this.target.x - this.current.x) * SMOOTHING
    this.current.y += (this.target.y - this.current.y) * SMOOTHING

    const settled = Math.abs(this.target.x - this.current.x) < 0.001 && Math.abs(this.target.y - this.current.y) < 0.001
    if (settled) this.current = { ...this.target }

    const { x, y } = this.current
    const style = this.element.style
    style.setProperty("--tilt-rx", `${(-y * MAX_DEGREES).toFixed(2)}deg`)
    style.setProperty("--tilt-ry", `${(x * MAX_DEGREES).toFixed(2)}deg`)
    style.setProperty("--tilt-nx", x.toFixed(3))
    style.setProperty("--tilt-ny", y.toFixed(3))
    style.setProperty("--tilt-glare", Math.min(1, Math.hypot(x, y)).toFixed(3))

    if (!settled) this.pending = requestAnimationFrame(this.frame)
  }

  // Touch: float until a real orientation reading arrives. iOS gates the event behind a
  // permission prompt (requestPermission), so it keeps the float there.
  startTouchMode() {
    this.element.classList.add("is-floating")
    const Orientation = window.DeviceOrientationEvent
    if (!Orientation || typeof Orientation.requestPermission === "function") return

    window.addEventListener("deviceorientation", (event) => this.onOrientation(event), { passive: true })
  }

  onOrientation({ beta, gamma }) {
    if (beta == null || gamma == null) return

    // The baseline drifts toward the current posture, so however the phone is held it re-centres.
    this.baseline ??= { beta, gamma }
    this.baseline.beta += (beta - this.baseline.beta) * BASELINE_DRIFT
    this.baseline.gamma += (gamma - this.baseline.gamma) * BASELINE_DRIFT

    this.element.classList.remove("is-floating")
    this.aim(
      (gamma - this.baseline.gamma) / ORIENTATION_RANGE_DEGREES,
      (beta - this.baseline.beta) / ORIENTATION_RANGE_DEGREES
    )
  }
}

function clamp(value) {
  return Math.max(-1, Math.min(1, value))
}
