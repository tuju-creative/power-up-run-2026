// Real-time headless Chrome screenshots over the DevTools protocol (no virtual time, so
// IntersectionObserver, rAF and transitions all run). For each width it scrolls through the page
// so scroll reveals fire, returns to the top, then saves a full-page PNG, checks for horizontal
// overflow and collects console errors, uncaught exceptions and failed requests.
//
// Usage (via bin/screenshots): node bin/screenshots.mjs [--no-js] [--reduce] [--widths=320,375]
// Output: tmp/screenshots/w<width>[_nojs][_reduce].png. Exits 1 on overflow or console errors.
import { spawn } from "node:child_process"
import { createServer } from "node:http"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { extname, join, normalize, resolve } from "node:path"

const ROOT = resolve(import.meta.dirname, "..")
const OUT = join(ROOT, "tmp", "screenshots")
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const HEIGHTS = { 320: 568, 375: 812, 768: 1024, 1024: 768, 1440: 900 }
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".ico": "image/x-icon" }

const args = process.argv.slice(2)
const noJs = args.includes("--no-js")
const reduce = args.includes("--reduce")
const widths = (args.find((a) => a.startsWith("--widths="))?.split("=")[1] ?? "320,375,768,1440").split(",").map(Number)
const suffix = `${noJs ? "_nojs" : ""}${reduce ? "_reduce" : ""}`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

mkdirSync(OUT, { recursive: true })

// Static file server for the repo root.
const server = createServer((request, response) => {
  const path = normalize(decodeURIComponent(new URL(request.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "")
  let file = join(ROOT, path)
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html")
  if (!file.startsWith(ROOT) || !existsSync(file)) {
    response.writeHead(404).end("not found")
    return
  }
  response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" })
  response.end(readFileSync(file))
})
await new Promise((r) => server.listen(0, "127.0.0.1", r))
const pageUrl = `http://127.0.0.1:${server.address().port}/index.html`

// Chrome with a throwaway profile; the DevTools port is read from DevToolsActivePort.
const profile = mkdtempSync(join(tmpdir(), "screenshots-"))
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
  "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" })

let failed = false
try {
  const port = await devToolsPort(profile)
  const target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page")
  const cdp = await connect(target.webSocketDebuggerUrl)
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

    const ok = overflow.offenders.length === 0
    console.log(`${name}: ${file} (${width}x${Math.ceil(cssContentSize.height)})`)
    console.log(`  overflow: scrollWidth=${overflow.scrollWidth} innerWidth=${overflow.innerWidth} ${ok ? "ok" : "FAIL"}`)
    overflow.offenders.forEach((o) => console.log(`    ${o}`))
    if (cdp.problems.length) cdp.problems.forEach((p) => console.log(`  ${p}`))
    else console.log("  console: clean")
    if (!ok || cdp.problems.length) failed = true
  }
  cdp.close()
} catch (error) {
  console.error(error)
  failed = true
} finally {
  chrome.kill()
  server.close()
  await sleep(200)
  rmSync(profile, { recursive: true, force: true })
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

async function devToolsPort(dir) {
  const file = join(dir, "DevToolsActivePort")
  for (let i = 0; i < 100; i++) {
    if (existsSync(file)) {
      const port = readFileSync(file, "utf8").split("\n")[0]
      if (port) return port
    }
    await sleep(100)
  }
  throw new Error("Chrome did not start (set CHROME to the browser binary)")
}

async function connect(url) {
  const ws = new WebSocket(url)
  await new Promise((r, j) => { ws.addEventListener("open", r); ws.addEventListener("error", j) })
  let id = 0
  const pending = new Map()
  const waiters = []
  const problems = []
  ws.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data)
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)
      message.error ? reject(new Error(message.error.message)) : resolve(message.result)
      return
    }
    const { method, params } = message
    if (method === "Runtime.consoleAPICalled" && ["error", "warning", "assert"].includes(params.type)) {
      problems.push(`console.${params.type}: ${params.args.map((a) => a.value ?? a.description).join(" ")}`)
    } else if (method === "Runtime.exceptionThrown") {
      problems.push(`exception: ${params.exceptionDetails.exception?.description ?? params.exceptionDetails.text}`)
    } else if (method === "Log.entryAdded" && ["error", "warning"].includes(params.entry.level)) {
      problems.push(`log.${params.entry.level}: ${params.entry.text}${params.entry.url ? ` (${params.entry.url})` : ""}`)
    } else if (method === "Network.loadingFailed" && !params.canceled) {
      problems.push(`request failed: ${params.errorText}`)
    }
    waiters.filter((w) => w.method === method).forEach((w) => { waiters.splice(waiters.indexOf(w), 1); w.resolve(params) })
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
  const waitFor = (method) => new Promise((resolve) => waiters.push({ method, resolve }))
  return {
    problems,
    send,
    close: () => ws.close(),
    async navigate(url) {
      const loaded = waitFor("Page.loadEventFired")
      await send("Page.navigate", { url })
      await loaded
    },
    async evaluate(expression) {
      const { result, exceptionDetails } = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
      if (exceptionDetails) throw new Error(`evaluate failed: ${exceptionDetails.text}`)
      return result.value
    }
  }
}
