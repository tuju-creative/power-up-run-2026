// Renders bin/og_image.html to assets/images/og_image.png (1200x630) with headless Chrome.
// Usage (via bin/og_image): node bin/og_image.mjs
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { ROOT, launchChrome, serveRepo, sleep } from "./chrome_cdp.mjs"

const OUT = join(ROOT, "assets", "images", "og_image.png")
const server = await serveRepo()
const cdp = await launchChrome()
try {
  await cdp.send("Page.enable")
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false })
  await cdp.navigate(server.url("bin/og_image.html"))
  await cdp.evaluate("new Promise((resolve) => { const check = () => window.drawn ? resolve(true) : setTimeout(check, 50); check() })")
  await sleep(200)
  const shot = await cdp.send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 1200, height: 630, scale: 1 } })
  writeFileSync(OUT, Buffer.from(shot.data, "base64"))
  console.log(OUT)
} finally {
  await cdp.close()
  server.close()
}
