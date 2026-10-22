import { updateRegistrationLinks } from "./lib/registration_links.js"

// Boot: mark the page as JS-enabled, point registration links at Luma with phase-aware labels,
// then start a controller for every [data-controller]. Controllers live in
// ./controllers/<name>_controller.js and follow a Stimulus-like contract: default export class,
// constructor(element), connect().
const root = document.documentElement
root.classList.add("js")
root.dataset.booted = "true"

async function startController(name, element) {
  try {
    const module = await import(`./controllers/${name.replaceAll("-", "_")}_controller.js`)
    new module.default(element).connect()
  } catch (error) {
    // Never leave content hidden: reveal styles (and the steps and timeline keyed off them) wait
    // for is-revealed, which a controller that failed to load would never add.
    element.classList.add("is-revealed")
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

updateRegistrationLinks()
startControllers()
