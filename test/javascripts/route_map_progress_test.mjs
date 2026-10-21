import { test } from "node:test"
import assert from "node:assert/strict"
import {
  LOOP_MS,
  PLANE_START,
  clamp01,
  drawOffset,
  easeInOutCubic,
  loopDistance,
  planeTransform,
  planeTransformCss,
  scrollProgress
} from "../../assets/javascripts/lib/route_map_progress.js"

test("clamp01 keeps values inside 0..1 and maps NaN to 0", () => {
  assert.equal(clamp01(-0.5), 0)
  assert.equal(clamp01(0.4), 0.4)
  assert.equal(clamp01(3), 1)
  assert.equal(clamp01(Number.NaN), 0)
})

test("scrollProgress is 0 while the stage is below the viewport", () => {
  assert.equal(scrollProgress({ top: 1200, viewportHeight: 800 }), 0)
  assert.equal(scrollProgress({ top: 800, viewportHeight: 800 }), 0)
})

test("scrollProgress rises linearly and reaches 1 once the top is at 60% of the viewport", () => {
  assert.equal(scrollProgress({ top: 640, viewportHeight: 800 }), 0.5)
  assert.equal(scrollProgress({ top: 480, viewportHeight: 800 }), 1)
  assert.equal(scrollProgress({ top: -2000, viewportHeight: 800 }), 1)
})

test("scrollProgress honours a custom span and guards a zero viewport", () => {
  assert.equal(scrollProgress({ top: 400, viewportHeight: 800, span: 1 }), 0.5)
  assert.equal(scrollProgress({ top: 0, viewportHeight: 0 }), 1)
})

test("easeInOutCubic is symmetric and pinned at the ends", () => {
  assert.equal(easeInOutCubic(0), 0)
  assert.equal(easeInOutCubic(0.5), 0.5)
  assert.equal(easeInOutCubic(1), 1)
  assert.ok(easeInOutCubic(0.25) < 0.25)
  assert.ok(Math.abs(easeInOutCubic(0.25) + easeInOutCubic(0.75) - 1) < 1e-12)
})

test("planeTransform starts tilted and eases to flat", () => {
  assert.deepEqual(PLANE_START, { rotateX: 55, rotateZ: -8, scale: 0.9 })
  assert.deepEqual(planeTransform(0), PLANE_START)
  assert.deepEqual(planeTransform(1), { rotateX: 0, rotateZ: 0, scale: 1 })

  const middle = planeTransform(0.5)
  assert.equal(middle.rotateX, 27.5)
  assert.equal(middle.rotateZ, -4)
  assert.equal(middle.scale, 0.95)
})

test("planeTransform clamps out-of-range progress", () => {
  assert.deepEqual(planeTransform(-1), PLANE_START)
  assert.deepEqual(planeTransform(2), { rotateX: 0, rotateZ: 0, scale: 1 })
})

test("planeTransformCss writes the tilted transform and drops it once flat", () => {
  assert.equal(planeTransformCss(0), "rotateX(55deg) rotateZ(-8deg) scale(0.9)")
  assert.equal(planeTransformCss(0.5), "rotateX(27.5deg) rotateZ(-4deg) scale(0.95)")
  assert.equal(planeTransformCss(1), "none")
})

test("drawOffset hides the whole path at 0 and none of it at 1", () => {
  assert.equal(drawOffset(0, 1600), 1600)
  assert.equal(drawOffset(0.25, 1600), 1200)
  assert.equal(drawOffset(1, 1600), 0)
  assert.equal(drawOffset(5, 1600), 0)
})

test("loopDistance runs once round the path every 12 seconds", () => {
  assert.equal(LOOP_MS, 12000)
  assert.equal(loopDistance(0, 1600), 0)
  assert.equal(loopDistance(3000, 1600), 400)
  assert.equal(loopDistance(12000, 1600), 0)
  assert.equal(loopDistance(18000, 1600), 800)
  assert.equal(loopDistance(1000, 100, 4000), 25)
})
