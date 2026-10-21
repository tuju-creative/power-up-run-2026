import { test } from "node:test"
import assert from "node:assert/strict"
import {
  DIAL_MAX,
  SEGMENTS,
  countdownSummary,
  litSegments,
  msUntilNextSecond,
  pad2,
  segmentPath
} from "../../assets/javascripts/lib/countdown_dial.js"

test("dial maxima: days capped at 30, hours 24, minutes and seconds 60", () => {
  assert.deepEqual(DIAL_MAX, { days: 30, hours: 24, minutes: 60, seconds: 60 })
  assert.equal(SEGMENTS, 60)
})

test("litSegments lights the value's share of 60 segments", () => {
  assert.equal(litSegments(10, DIAL_MAX.days), 20)
  assert.equal(litSegments(30, DIAL_MAX.minutes), 30)
  assert.equal(litSegments(59, DIAL_MAX.seconds), 59)
  assert.equal(litSegments(0, DIAL_MAX.hours), 0)
})

test("litSegments rounds to the nearest segment", () => {
  assert.equal(litSegments(23, DIAL_MAX.hours), 58) // 57.5
  assert.equal(litSegments(1, DIAL_MAX.hours), 3) // 2.5
  assert.equal(litSegments(1, DIAL_MAX.days), 2)
})

test("litSegments caps days at a full ring and never goes negative", () => {
  assert.equal(litSegments(45, DIAL_MAX.days), 60)
  assert.equal(litSegments(-3, DIAL_MAX.days), 0)
  assert.equal(litSegments(5, 0), 0)
})

test("pad2 gives at least two digits", () => {
  assert.equal(pad2(4), "04")
  assert.equal(pad2(0), "00")
  assert.equal(pad2(12), "12")
  assert.equal(pad2(120), "120")
})

test("msUntilNextSecond waits for the next wall-clock second", () => {
  assert.equal(msUntilNextSecond(1_000), 1000)
  assert.equal(msUntilNextSecond(1_250), 750)
  assert.equal(msUntilNextSecond(1_999), 1)
})

test("countdownSummary reads days, hours and minutes", () => {
  const time = { days: 10, hours: 4, minutes: 1, seconds: 30 }
  assert.equal(countdownSummary("Registration opens in", time), "Registration opens in 10 days, 4 hours and 1 minute.")
})

test("countdownSummary drops leading zero units and keeps inner zeros", () => {
  assert.equal(countdownSummary("Race day in", { days: 0, hours: 2, minutes: 0, seconds: 9 }), "Race day in 2 hours and 0 minutes.")
  assert.equal(countdownSummary("Race day in", { days: 0, hours: 0, minutes: 1, seconds: 0 }), "Race day in 1 minute.")
  assert.equal(countdownSummary("Race day in", { days: 1, hours: 0, minutes: 0, seconds: 0 }), "Race day in 1 day, 0 hours and 0 minutes.")
})

test("countdownSummary in the final minute and with no target", () => {
  assert.equal(countdownSummary("Registration closes in", { days: 0, hours: 0, minutes: 0, seconds: 42 }), "Registration closes in less than a minute.")
  assert.equal(countdownSummary("It's race day!", { days: 0, hours: 0, minutes: 0, seconds: 0 }, false), "It's race day!")
})

test("countdownSummary only changes when the minute changes", () => {
  const a = countdownSummary("Race day in", { days: 3, hours: 2, minutes: 7, seconds: 59 })
  const b = countdownSummary("Race day in", { days: 3, hours: 2, minutes: 7, seconds: 0 })
  assert.equal(a, b)
})

test("segmentPath draws a closed four-point wedge; segment 0 is centred at 12 o'clock", () => {
  const ring = { cx: 100, cy: 100, inner: 80, outer: 100 }
  const path = segmentPath(0, 60, ring)
  assert.match(path, /^M[\d.-]+ [\d.-]+L[\d.-]+ [\d.-]+L[\d.-]+ [\d.-]+L[\d.-]+ [\d.-]+Z$/)
  const xs = [...path.matchAll(/([\d.-]+) ([\d.-]+)/g)].map((m) => Number(m[1]))
  const ys = [...path.matchAll(/([\d.-]+) ([\d.-]+)/g)].map((m) => Number(m[2]))
  assert.ok(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - 100) < 0.01, "centred on x")
  assert.ok(Math.max(...ys) <= 20.5 && Math.min(...ys) >= 0, "sits in the top band")
})

test("segmentPath for the quarter segment sits at 3 o'clock", () => {
  const path = segmentPath(15, 60, { cx: 100, cy: 100, inner: 80, outer: 100 })
  const points = [...path.matchAll(/([\d.-]+) ([\d.-]+)/g)].map((m) => [Number(m[1]), Number(m[2])])
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  assert.ok(Math.min(...xs) > 175 && Math.max(...xs) <= 200.01, "on the right-hand side")
  assert.ok(Math.abs((Math.min(...ys) + Math.max(...ys)) / 2 - 100) < 0.01, "centred on y")
})
