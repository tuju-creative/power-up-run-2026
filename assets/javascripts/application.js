import { EVENT } from "./config/event.js"

// Boot: mark the page as JS-enabled, wire registration links, then start a controller for
// every [data-controller]. Controllers live in ./controllers/<name>_controller.js and follow a
// Stimulus-like contract: default export class, constructor(element), connect().
const root = document.documentElement
root.classList.add("js")
root.dataset.booted = "true"

function wireRegistrationLinks() {
  document.querySelectorAll("a[data-registration-link]").forEach((link) => {
    link.href = EVENT.registrationUrl
  })
}

async function startController(name, element) {
  try {
    const module = await import(`./controllers/${name.replaceAll("-", "_")}_controller.js`)
    new module.default(element).connect()
  } catch (error) {
    console.warn(`Controller "${name}" failed to start`, error)
  }
}

function startControllers() {
  document.querySelectorAll("[data-controller]").forEach((element) => {
    element.dataset.controller.split(/\s+/).filter(Boolean).forEach((name) => {
      startController(name, element)
    })
  })
}

wireRegistrationLinks()
startControllers()
