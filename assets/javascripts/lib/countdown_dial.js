// Pure helpers for the hero countdown dials: how much of each ring is lit, the spoken summary,
// tick alignment and the ring's segment geometry.
export const SEGMENTS = 60

// A dial's ring is full at this value. Days cap at 30 so a long wait shows a full ring.
export const DIAL_MAX = { days: 30, hours: 24, minutes: 60, seconds: 60 }

export function litSegments(value, max, segments = SEGMENTS) {
  if (!(max > 0)) return 0
  const clamped = Math.min(Math.max(value, 0), max)
  return Math.round((clamped / max) * segments)
}

export function pad2(value) {
  return String(Math.max(0, Math.floor(value))).padStart(2, "0")
}

// Milliseconds until the next whole wall-clock second, in (0, 1000].
export function msUntilNextSecond(nowMs) {
  return 1000 - (nowMs % 1000)
}

// "Registration opens in 10 days, 4 hours and 1 minute." Zero units are left out ("2 hours",
// not "2 hours and 0 minutes") and so are seconds, so the text only changes once a minute.
// Without a target the heading stands alone ("It's race day!").
export function countdownSummary(heading, time, hasTarget = true) {
  if (!hasTarget) return heading

  const words = [["day", time.days], ["hour", time.hours], ["minute", time.minutes]]
    .filter(([, value]) => value > 0)
    .map(([unit, value]) => `${value} ${unit}${value === 1 ? "" : "s"}`)
  if (!words.length) return `${heading} less than a minute.`

  return `${heading} ${joinWords(words)}.`
}

function joinWords(words) {
  if (words.length === 1) return words[0]
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`
}

// SVG path for ring segment `index` of `count`, clockwise from 12 o'clock. Each segment is a
// straight-edged wedge between the inner and outer radius, leaving a gap to its neighbours.
export function segmentPath(index, count, { cx, cy, inner, outer, fill = 0.68 }) {
  const step = (Math.PI * 2) / count
  const centre = index * step - Math.PI / 2
  const half = (step * fill) / 2
  const point = (radius, angle) => `${round(cx + radius * Math.cos(angle))} ${round(cy + radius * Math.sin(angle))}`

  return `M${point(inner, centre - half)}L${point(outer, centre - half)}L${point(outer, centre + half)}L${point(inner, centre + half)}Z`
}

function round(value) {
  return Math.round(value * 100) / 100
}
