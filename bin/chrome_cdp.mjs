// Shared by bin/screenshots.mjs and bin/og_image.mjs: a static server for the repo root and a
// headless Chrome driven over the DevTools protocol. Dependency-free (Node 22 fetch/WebSocket).
import { spawn } from "node:child_process"
import { createServer } from "node:http"
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { extname, join, normalize, resolve } from "node:path"

export const ROOT = resolve(import.meta.dirname, "..")
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".ico": "image/x-icon" }

// Serves the repo root on a free port. Resolves to { url(path), close() }.
export async function serveRepo() {
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
  const origin = `http://127.0.0.1:${server.address().port}`
  return { url: (path) => `${origin}/${path.replace(/^\//, "")}`, close: () => server.close() }
}

// Starts headless Chrome with a throwaway profile and connects to its first page.
// Resolves to the page's CDP session plus close(), which also stops Chrome.
export async function launchChrome() {
  const profile = mkdtempSync(join(tmpdir(), "chrome-cdp-"))
  const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
    "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" })
  const stop = async () => {
    chrome.kill()
    await sleep(200)
    rmSync(profile, { recursive: true, force: true })
  }
  try {
    const port = await devToolsPort(profile)
    const target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page")
    const cdp = await connect(target.webSocketDebuggerUrl)
    return { ...cdp, close: async () => { cdp.close(); await stop() } }
  } catch (error) {
    await stop()
    throw error
  }
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

// CDP session. `problems` collects console errors/warnings, exceptions, log errors and failed
// requests (once Runtime, Log and Network are enabled).
async function connect(url) {
  const ws = new WebSocket(url)
  await new Promise((r, j) => { ws.addEventListener("open", r); ws.addEventListener("error", j) })
  let id = 0
  const pending = new Map()
  const waiters = []
  const problems = []
  const requests = new Map()
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
    } else if (method === "Network.requestWillBeSent") {
      requests.set(params.requestId, params.request.url)
    } else if (method === "Network.loadingFailed" && !params.canceled) {
      problems.push(`request failed: ${params.errorText || params.blockedReason} ${params.type} ${requests.get(params.requestId) ?? ""}`.trim())
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
