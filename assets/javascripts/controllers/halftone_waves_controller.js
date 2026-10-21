// Halftone ribbons on a <canvas>: a hex grid of dots whose radius follows two or three drifting
// "ribbons" (a sine-warped centre line with a soft envelope and silk-like stripes). Colour runs
// orange-deep -> orange -> amber -> yellow (read from the CSS tokens) along each ribbon and
// toward its fringe. Dots near a mouse pointer swell.
// - DPR-aware (capped at 2), resized by ResizeObserver.
// - Pauses while offscreen (IntersectionObserver) or while the tab is hidden.
// - Reduced motion: draws a single static frame (redrawn on resize).
// - Coarse pointers (phones) render at ~30fps.
// - Elements in the same section marked [data-halftone-clear] keep dots off themselves (with a
//   soft edge), so text stays legible where ribbons pass behind it.
const TAU = Math.PI * 2
const DPR_CAP = 2
const WIDE_QUERY = "(min-width: 64rem)"
const SPACING_PX = { base: 10, wide: 12 }
const MAX_RADIUS = 0.56 // share of the grid spacing; neighbours just touch at full intensity
const MIN_RADIUS_PX = 0.8
const COLOUR_TOKENS = ["--color-orange-deep", "--color-orange", "--color-amber", "--color-yellow"]
const COLOUR_STEPS = 24
const POINTER_RADIUS_PX = 170
const POINTER_SWELL = 0.7
const POINTER_GLOW = 0.28 // faint dots appear around the pointer even between ribbons
const INTRO_MS = 1800
const STATIC_TIME_S = 7
const COARSE_FRAME_MS = 1000 / 30
const REACH = 2.6 // envelope cut-off, in ribbon half-widths
const TOP_FADE_PX = 140 // dots shrink toward the top edge so the overlaid nav stays legible
const CLEAR_FEATHER_PX = 56

// Two shapes per ribbon, blended by the canvas aspect ratio: a tall phone hero and a wide desktop
// hero. y0/y1: centre line height (share of canvas height) at the left and right edges.
// width/amp: share of the canvas's shorter side. above/below: envelope falloff on each side.
// toneStart/toneEnd: colour (0 orange-deep .. 1 yellow) at the left and right ends.
const RIBBONS = [
  { // top right
    portrait: { y0: -0.2, y1: 0.14, width: 0.3, amp: 0.09, freq: 0.55, speed: 0.2, phase: 0.4, above: 2.4, below: 1.1, stripes: 5.5, stripeSpeed: 0.45, toneStart: 0.8, toneEnd: 0.02 },
    landscape: { y0: -1.15, y1: 0.56, width: 0.15, amp: 0.05, freq: 0.85, speed: 0.2, phase: 0.4, above: 2.4, below: 1.1, stripes: 5.5, stripeSpeed: 0.45, toneStart: 0.8, toneEnd: 0.02 }
  },
  { // bottom left
    portrait: { y0: 0.6, y1: 0.82, width: 0.34, amp: 0.1, freq: 0.5, speed: -0.17, phase: 2.1, above: 1.1, below: 2.4, stripes: 5, stripeSpeed: -0.4, toneStart: 0.02, toneEnd: 0.9 },
    landscape: { y0: 0.4, y1: 1.18, width: 0.2, amp: 0.06, freq: 0.75, speed: -0.17, phase: 2.1, above: 1.1, below: 2.4, stripes: 5, stripeSpeed: -0.4, toneStart: 0.02, toneEnd: 0.9 }
  },
  { // thin accent under the bottom ribbon
    portrait: { y0: 0.9, y1: 1.04, width: 0.14, amp: 0.08, freq: 0.7, speed: 0.24, phase: 4.2, above: 1.6, below: 1.6, stripes: 7, stripeSpeed: 0.6, toneStart: 0.4, toneEnd: 1 },
    landscape: { y0: 0.72, y1: 1.42, width: 0.07, amp: 0.05, freq: 1, speed: 0.24, phase: 4.2, above: 1.6, below: 1.6, stripes: 7, stripeSpeed: 0.6, toneStart: 0.4, toneEnd: 1 }
  }
]

export default class HalftoneWavesController {
  constructor(element) {
    this.element = element
  }

  connect() {
    this.canvas = this.element
    this.context = this.canvas.getContext("2d")
    if (!this.context) return

    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    this.frameInterval = window.matchMedia("(pointer: coarse)").matches ? COARSE_FRAME_MS : 0
    this.palette = this.readPalette()
    this.pointer = { clientX: 0, clientY: 0, x: 0, y: 0, strength: 0, active: false }
    this.elapsed = 0
    this.onScreen = true
    this.clearZones = []
    this.frame = this.frame.bind(this)

    new ResizeObserver(() => this.resize()).observe(this.canvas)
    this.watchClearZones()
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        this.onScreen = entries.at(-1).isIntersecting
        this.update()
      }).observe(this.canvas)
    }
    document.addEventListener("visibilitychange", () => this.update())
    this.reduceMotion.addEventListener("change", () => this.update())

    window.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return
      this.pointer.clientX = event.clientX
      this.pointer.clientY = event.clientY
      this.pointer.active = true
    }, { passive: true })
    window.addEventListener("pointerout", (event) => {
      if (!event.relatedTarget) this.pointer.active = false // left the window
    })
    window.addEventListener("blur", () => { this.pointer.active = false })
  }

  // Lifecycle

  update() {
    const running = this.onScreen && !document.hidden && !this.reduceMotion.matches
    if (running && !this.request) {
      this.lastTime = null
      this.request = requestAnimationFrame(this.frame)
    } else if (!running && this.request) {
      cancelAnimationFrame(this.request)
      this.request = null
    }
    if (this.reduceMotion.matches) this.drawStatic()
  }

  frame(now) {
    this.request = requestAnimationFrame(this.frame)
    if (this.lastTime != null && now - this.lastFrame < this.frameInterval - 2) return

    const delta = this.lastTime == null ? 0 : Math.min(100, now - this.lastTime)
    this.lastTime = now
    this.lastFrame = now
    this.elapsed += delta

    this.trackPointer()
    this.draw(this.elapsed / 1000, this.introFade(), true)
  }

  // Dots grow in over the first moments (ease-out cubic).
  introFade() {
    return 1 - Math.pow(1 - Math.min(1, this.elapsed / INTRO_MS), 3)
  }

  drawStatic() {
    if (this.width) this.draw(STATIC_TIME_S, 1, false)
  }

  resize() {
    const { width, height } = this.canvas.getBoundingClientRect()
    if (!width || !height) return

    const ratio = Math.min(window.devicePixelRatio || 1, DPR_CAP)
    this.canvas.width = Math.round(width * ratio)
    this.canvas.height = Math.round(height * ratio)
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0)
    this.width = width
    this.height = height
    this.spacing = window.matchMedia(WIDE_QUERY).matches ? SPACING_PX.wide : SPACING_PX.base
    this.ribbons = ribbonsFor(width, height)
    this.buildGrid()
    this.measureClearZones()

    // Resizing clears the canvas: repaint at once so it never flashes blank.
    if (this.reduceMotion.matches) this.drawStatic()
    else this.draw(this.elapsed / 1000, this.introFade(), true)
    this.update()
  }

  // Hex grid. Columns sit at half-spacing steps so ribbon centre lines can be evaluated once per
  // column per frame rather than once per dot.
  buildGrid() {
    const spacing = this.spacing
    const rowStep = spacing * 0.866
    const rows = Math.ceil(this.height / rowStep) + 1
    const columns = Math.ceil(this.width / spacing) + 1
    const xs = []
    const ys = []
    const columnIndex = []

    for (let row = 0; row < rows; row++) {
      const offset = row % 2
      for (let column = 0; column < columns; column++) {
        xs.push(column * spacing + offset * spacing / 2)
        ys.push(row * rowStep)
        columnIndex.push(column * 2 + offset)
      }
    }

    this.dotX = Float32Array.from(xs)
    this.dotY = Float32Array.from(ys)
    this.dotColumn = Uint16Array.from(columnIndex)
    this.columnCount = columns * 2
    const size = this.columnCount * this.ribbons.length
    this.centre = new Float32Array(size)
    this.inverseWidth = new Float32Array(size)
    this.stripePhase = new Float32Array(size)
    this.tone = new Float32Array(size)
  }

  // Clear zones: re-measured when they resize, after fonts load and when a scroll reveal settles
  // (reveal moves its element while it fades in). Rects are canvas-relative, so scrolling needs no
  // re-measure.
  watchClearZones() {
    const section = this.canvas.closest("section") ?? document.body
    this.clearElements = [...section.querySelectorAll("[data-halftone-clear]")]
    if (!this.clearElements.length) return

    const remeasure = () => {
      this.measureClearZones()
      if (this.reduceMotion.matches) this.drawStatic()
    }
    const observer = new ResizeObserver(remeasure)
    this.clearElements.forEach((element) => observer.observe(element))
    document.fonts?.ready.then(remeasure)
    section.addEventListener("transitionend", (event) => {
      if (event.propertyName === "transform" && event.target.matches('[data-controller~="reveal"]')) remeasure()
    })
  }

  measureClearZones() {
    if (!this.clearElements?.length) return
    const area = this.canvas.getBoundingClientRect()
    this.clearZones = this.clearElements
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({
        left: rect.left - area.left,
        top: rect.top - area.top,
        right: rect.right - area.left,
        bottom: rect.bottom - area.top
      }))
  }

  // 0 inside a clear zone, easing to 1 at CLEAR_FEATHER_PX outside it.
  clearance(x, y) {
    let nearest = CLEAR_FEATHER_PX
    for (const zone of this.clearZones) {
      const dx = Math.max(zone.left - x, 0, x - zone.right)
      const dy = Math.max(zone.top - y, 0, y - zone.bottom)
      if (dx >= nearest || dy >= nearest) continue
      nearest = Math.min(nearest, Math.sqrt(dx * dx + dy * dy))
    }
    return smoothstep(nearest / CLEAR_FEATHER_PX)
  }

  // Drawing

  draw(time, fade, withPointer) {
    const { context, width, height, spacing, ribbons } = this
    if (!width) return

    this.evaluateRibbons(time)

    const maxRadius = spacing * MAX_RADIUS * fade
    const paths = Array.from({ length: COLOUR_STEPS }, () => null)
    const pointer = this.pointer
    const usePointer = withPointer && pointer.strength > 0.01
    const pointerRadiusSquared = POINTER_RADIUS_PX * POINTER_RADIUS_PX
    const columnCount = this.columnCount
    const count = this.dotX.length

    for (let n = 0; n < count; n++) {
      const x = this.dotX[n]
      const y = this.dotY[n]
      const column = this.dotColumn[n]
      let intensity = 0
      let toneSum = 0

      for (let r = 0; r < ribbons.length; r++) {
        const index = r * columnCount + column
        const d = (y - this.centre[index]) * this.inverseWidth[index]
        if (d > REACH || d < -REACH) continue

        const ribbon = ribbons[r]
        const envelope = Math.exp(-d * d * (d < 0 ? ribbon.above : ribbon.below))
        const stripe = 0.5 + 0.5 * Math.sin(d * ribbon.stripes + this.stripePhase[index])
        const value = envelope * (0.32 + 0.68 * stripe * stripe)
        intensity += value
        toneSum += value * (this.tone[index] + (1 - envelope) * 0.45 + (1 - stripe) * 0.12)
      }

      let tone = intensity > 0 ? toneSum / intensity : 0.7
      let radius = intensity > 0 ? maxRadius * Math.pow(Math.min(1, intensity), 0.85) : 0

      if (usePointer) {
        const dx = x - pointer.x
        const dy = y - pointer.y
        const distanceSquared = dx * dx + dy * dy
        if (distanceSquared < pointerRadiusSquared) {
          const falloff = 1 - Math.sqrt(distanceSquared) / POINTER_RADIUS_PX
          const swell = falloff * falloff * pointer.strength
          radius = radius * (1 + POINTER_SWELL * swell) + maxRadius * POINTER_GLOW * swell
          if (intensity <= 0) tone = 0.75
        }
      }

      if (radius < MIN_RADIUS_PX) continue
      if (y < TOP_FADE_PX) radius *= smoothstep(y / TOP_FADE_PX)
      if (this.clearZones.length) radius *= this.clearance(x, y)
      if (radius < MIN_RADIUS_PX) continue
      radius = Math.min(radius, spacing * 0.75)

      const bucket = Math.min(COLOUR_STEPS - 1, Math.max(0, Math.round(tone * (COLOUR_STEPS - 1))))
      const path = paths[bucket] ??= new Path2D()
      path.moveTo(x + radius, y)
      path.arc(x, y, radius, 0, TAU)
    }

    context.clearRect(0, 0, width, height)
    paths.forEach((path, bucket) => {
      if (!path) return
      context.fillStyle = this.palette[bucket]
      context.fill(path)
    })
  }

  // Per column: each ribbon's centre line, local half-width, stripe phase and tone.
  evaluateRibbons(time) {
    const { width, height, ribbons, columnCount, spacing } = this
    const shortSide = Math.min(width, height)

    ribbons.forEach((ribbon, r) => {
      const slope = (height * (ribbon.y1 - ribbon.y0)) / width
      const perpendicular = 1 / Math.sqrt(1 + slope * slope)
      const amplitude = ribbon.amp * shortSide
      const baseWidth = ribbon.width * shortSide

      for (let column = 0; column < columnCount; column++) {
        const u = (column * spacing) / 2 / width
        const index = r * columnCount + column
        const wave = TAU * ribbon.freq * u + ribbon.phase
        this.centre[index] = height * (ribbon.y0 + (ribbon.y1 - ribbon.y0) * u)
          + amplitude * Math.sin(wave + time * ribbon.speed)
          + amplitude * 0.35 * Math.sin(wave * 2.3 - time * ribbon.speed * 1.4)
        const halfWidth = baseWidth * (1 + 0.28 * Math.sin(TAU * 0.6 * u + time * 0.3 + ribbon.phase))
        this.inverseWidth[index] = perpendicular / halfWidth
        this.stripePhase[index] = u * 5 - time * ribbon.stripeSpeed
        this.tone[index] = ribbon.toneStart + (ribbon.toneEnd - ribbon.toneStart) * u
      }
    })
  }

  trackPointer() {
    const pointer = this.pointer
    const rect = this.canvas.getBoundingClientRect()
    const x = pointer.clientX - rect.left
    const y = pointer.clientY - rect.top
    const inside = pointer.active && x >= 0 && y >= 0 && x <= rect.width && y <= rect.height

    if (inside && pointer.strength < 0.01) {
      pointer.x = x
      pointer.y = y
    } else {
      pointer.x += (x - pointer.x) * 0.18
      pointer.y += (y - pointer.y) * 0.18
    }
    pointer.strength += ((inside ? 1 : 0) - pointer.strength) * 0.08
  }

  // Colour ramp from the CSS tokens. Assigning to fillStyle normalises any CSS colour to #rrggbb.
  readPalette() {
    const styles = getComputedStyle(this.canvas)
    const stops = COLOUR_TOKENS.map((token) => {
      this.context.fillStyle = "#000" // reset: an unparsable value would keep the previous stop
      this.context.fillStyle = styles.getPropertyValue(token).trim() || "#000"
      return hexToRgb(this.context.fillStyle)
    })

    return Array.from({ length: COLOUR_STEPS }, (_, step) => {
      const position = (step / (COLOUR_STEPS - 1)) * (stops.length - 1)
      const index = Math.min(stops.length - 2, Math.floor(position))
      const mix = position - index
      const [r, g, b] = stops[index].map((channel, i) => Math.round(channel + (stops[index + 1][i] - channel) * mix))
      return `rgb(${r} ${g} ${b})`
    })
  }
}

function ribbonsFor(width, height) {
  const blend = Math.min(1, Math.max(0, (width / height - 0.45) / (1.6 - 0.45)))
  return RIBBONS.map(({ portrait, landscape }) => {
    const ribbon = {}
    for (const key of Object.keys(portrait)) ribbon[key] = portrait[key] + (landscape[key] - portrait[key]) * blend
    return ribbon
  })
}

function smoothstep(t) {
  return t * t * (3 - 2 * t)
}

function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}
