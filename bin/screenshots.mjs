// Real-time headless Chrome screenshots over the DevTools protocol (no virtual time, so
// IntersectionObserver, rAF and transitions all run). For each width it scrolls through the page
// so scroll reveals fire, returns to the top, then saves a full-page PNG, checks for horizontal
// overflow and collects console errors, uncaught exceptions and failed requests.
//
// Usage (via bin/screenshots): node bin/screenshots.mjs [--no-js] [--reduce] [--widths=320,375]
// Output: tmp/screenshots/w<width>[_nojs][_reduce].png. Exits 1 on overflow or console errors.
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { ROOT, launchChrome, serveRepo, sleep } from "./chrome_cdp.mjs"

const OUT = join(ROOT, "tmp", "screenshots")
const HEIGHTS = { 320: 568, 375: 812, 768: 1024, 1024: 768, 1440: 900 }

const args = process.argv.slice(2)
const noJs = args.includes("--no-js")
const reduce = args.includes("--reduce")
const widths = (args.find((a) => a.startsWith("--widths="))?.split("=")[1] ?? "320,375,768,1440").split(",").map(Number)
const suffix = `${noJs ? "_nojs" : ""}${reduce ? "_reduce" : ""}`

mkdirSync(OUT, { recursive: true })
const server = await serveRepo()
const pageUrl = server.url("index.html")
let failed = false
let cdp

try {
  cdp = await launchChrome()
  await cdp.send("Runtime.enable")
  await cdp.send("Page.enable")
  await cdp.send("Log.enable")
  await cdp.send("Network.enable")
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true })
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: reduce ? "reduce" : "no-preference" }] })
  await cdp.send("Emulation.setScriptExecutionDisabled", { value: noJs })

  for (const width of widths) {
    const height = HEIGHTS[width] ?? 900
    const name = `w${width}${suffix}`
    cdp.problems.length = 0
    await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 })
    await cdp.navigate(pageUrl)
    await cdp.evaluate("document.fonts.ready.then(() => true)")
    await sleep(800)

    // Scroll down in steps so every reveal and count-up fires, then return to the top.
    const scrollHeight = await cdp.evaluate("document.documentElement.scrollHeight")
    for (let y = 0; y <= scrollHeight; y += Math.round(height * 0.5)) {
      await cdp.evaluate(`scrollTo({ top: ${y}, behavior: "instant" })`)
      await sleep(120)
    }
    await sleep(600)
    await cdp.evaluate(`scrollTo({ top: 0, behavior: "instant" })`)
    await sleep(1400) // reveal transitions (900ms plus stagger) settle

    const overflow = await cdp.evaluate(`(${overflowCheck})(${width})`)
    const { cssContentSize } = await cdp.send("Page.getLayoutMetrics")
    const shot = await cdp.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height: Math.ceil(cssContentSize.height), scale: 1 }
    })
    const file = join(OUT, `${name}.png`)
    writeFileSync(file, Buffer.from(shot.data, "base64"))

    // With scripts disabled, DevTools blocks script fetches (the modulepreloads) by CSP: expected.
    const problems = cdp.problems.filter((p) => !(noJs && p.startsWith("request failed: csp Script")))
    const ok = overflow.offenders.length === 0
    console.log(`${name}: ${file} (${width}x${Math.ceil(cssContentSize.height)})`)
    console.log(`  overflow: scrollWidth=${overflow.scrollWidth} innerWidth=${overflow.innerWidth} ${ok ? "ok" : "FAIL"}`)
    overflow.offenders.forEach((o) => console.log(`    ${o}`))
    if (problems.length) problems.forEach((p) => console.log(`  ${p}`))
    else console.log("  console: clean")
    if (!ok || problems.length) failed = true
  }
} catch (error) {
  console.error(error)
  failed = true
} finally {
  await cdp?.close()
  server.close()
}
process.exit(failed ? 1 : 0)

// Runs in the page. Flags the document scrolling sideways, and any element whose right edge
// passes the viewport unless an ancestor below <body> clips it (body itself clips overflow-x,
// which would otherwise hide real problems). Compares against the requested width, not
// innerWidth: mobile emulation widens the layout viewport to fit overflowing content.
function overflowCheck(width) {
  const limit = width + 0.5
  const clipped = (element) => {
    for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node)
      if (style.overflowX !== "visible" && node.getBoundingClientRect().right <= limit) return true
      if (style.position === "fixed" && style.visibility === "hidden") return true
    }
    return false
  }
  const describe = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${el.classList.length ? `.${[...el.classList].join(".")}` : ""}`
  const offenders = [...document.body.querySelectorAll("*")]
    .filter((el) => el.getBoundingClientRect().right > limit && el.getClientRects().length && !clipped(el))
    .slice(0, 10)
    .map((el) => `${describe(el)} right=${Math.round(el.getBoundingClientRect().right)}`)
  const scrollWidth = document.documentElement.scrollWidth
  if (innerWidth !== width) offenders.unshift(`layout viewport widened to ${innerWidth}px`)
  if (scrollWidth > width) offenders.unshift(`document scrollWidth ${scrollWidth} > ${width}`)
  return { scrollWidth, innerWidth, offenders }
}
