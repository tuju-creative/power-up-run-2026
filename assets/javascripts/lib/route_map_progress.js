// Pure helpers for the route map: how far the stage has scrolled into view, the tilted plane's
// transform at that progress, how much of the route is drawn and where the runner dot is.

// The plane lies tilted back at progress 0 and is flat at progress 1.
export const PLANE_START = { rotateX: 55, rotateZ: -8, scale: 0.9 }

// One lap of the runner dot.
export const LOOP_MS = 12000

// Progress runs 0 -> 1 while the stage's top edge travels from the bottom of the viewport up
// through `span` of the viewport height. With the default 0.4 the map is flat once its top is at
// 60%, above where a nav jump to #route-map leaves it (about 47-59% across common screens).
const SCROLL_SPAN = 0.4

export function clamp01(value) {
  if (!(value > 0)) return 0
  return value > 1 ? 1 : value
}

export function scrollProgress({ top, viewportHeight, span = SCROLL_SPAN }) {
  const distance = viewportHeight * span
  if (!(distance > 0)) return 1
  return clamp01((viewportHeight - top) / distance)
}

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function planeTransform(progress) {
  const remaining = 1 - easeInOutCubic(clamp01(progress))
  return {
    rotateX: round(PLANE_START.rotateX * remaining, 2),
    rotateZ: round(PLANE_START.rotateZ * remaining, 2),
    scale: round(1 - (1 - PLANE_START.scale) * remaining, 4)
  }
}

// "none" once flat, so the settled map is not left on a 3D layer (keeps its text crisp).
export function planeTransformCss(progress) {
  if (clamp01(progress) >= 1) return "none"
  const { rotateX, rotateZ, scale } = planeTransform(progress)
  return `rotateX(${rotateX}deg) rotateZ(${rotateZ}deg) scale(${scale})`
}

// stroke-dashoffset for a path dashed at its own length: the drawn share follows progress.
export function drawOffset(progress, length) {
  return length * (1 - clamp01(progress))
}

// Distance along the path for a runner that laps it every `periodMs`.
export function loopDistance(elapsedMs, length, periodMs = LOOP_MS) {
  return ((elapsedMs % periodMs) / periodMs) * length
}

function round(value, places) {
  const factor = 10 ** places
  return Math.round(value * factor) / factor + 0 // + 0 turns -0 into 0
}
