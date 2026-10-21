import { test } from "node:test"
import assert from "node:assert/strict"
import { EVENT } from "../../assets/javascripts/config/event.js"
import { phaseAt, remaining } from "../../assets/javascripts/lib/event_phase.js"

const at = (iso) => new Date(iso)

test("before registration opens", () => {
  const result = phaseAt(at("2026-10-22T12:00:00+08:00"))
  assert.equal(result.phase, "before_registration")
  assert.equal(result.target.getTime(), at(EVENT.registrationOpensAt).getTime())
  assert.equal(result.heading, "Registration opens in")
  assert.equal(result.ctaLabel, "Get notified")
})

test("registration opens exactly at the opening instant", () => {
  const result = phaseAt(at("2026-11-02T00:00:00+08:00"))
  assert.equal(result.phase, "registration_open")
  assert.equal(result.target.getTime(), at(EVENT.registrationClosesAt).getTime())
  assert.equal(result.heading, "Registration closes in")
  assert.equal(result.ctaLabel, "Register now")
})

test("one millisecond before opening is still before registration", () => {
  assert.equal(phaseAt(at("2026-11-01T23:59:59.999+08:00")).phase, "before_registration")
})

test("registration is still open at the closing second", () => {
  assert.equal(phaseAt(at("2026-11-16T23:59:59+08:00")).phase, "registration_open")
})

test("registration is closed from the next midnight", () => {
  const result = phaseAt(at("2026-11-17T00:00:00+08:00"))
  assert.equal(result.phase, "registration_closed")
  assert.equal(result.target.getTime(), at(EVENT.raceStartsAt).getTime())
  assert.equal(result.heading, "Race day in")
  assert.equal(result.ctaLabel, "View event")
})

test("race day at the start time has no target", () => {
  const result = phaseAt(at("2026-12-04T06:30:00+08:00"))
  assert.equal(result.phase, "race_day")
  assert.equal(result.target, null)
  assert.equal(result.heading, "It's race day!")
  assert.equal(result.ctaLabel, "View event")
})

test("remaining splits the difference into units", () => {
  const result = remaining(at("2026-11-01T22:58:30+08:00"), at("2026-11-02T00:00:00+08:00"))
  assert.deepEqual(
    { days: result.days, hours: result.hours, minutes: result.minutes, seconds: result.seconds },
    { days: 0, hours: 1, minutes: 1, seconds: 30 }
  )
})

test("remaining handles days", () => {
  const now = at("2026-11-01T00:00:00+08:00")
  const target = new Date(now.getTime() + ((3 * 24 + 4) * 60 + 5) * 60000 + 6000)
  const result = remaining(now, target)
  assert.deepEqual(
    { days: result.days, hours: result.hours, minutes: result.minutes, seconds: result.seconds },
    { days: 3, hours: 4, minutes: 5, seconds: 6 }
  )
})

test("remaining is zero for past targets and null", () => {
  const now = at("2026-11-01T00:00:00+08:00")
  const zero = { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 }
  assert.deepEqual(remaining(now, at("2026-10-01T00:00:00+08:00")), zero)
  assert.deepEqual(remaining(now, null), zero)
  assert.deepEqual(remaining(now, now), zero)
})
