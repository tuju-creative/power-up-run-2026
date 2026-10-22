# POWER UP RUN 2026

Static event site for POWER UP RUN 2026 (5KM Fun Run, KTPC Office, Kulim, 4 December 2026), hosted
on GitHub Pages. Plain HTML, CSS and ES modules: no build step, no dependencies.

## Run locally

```sh
bin/server            # http://localhost:8000 (PORT=3000 bin/server to change)
bin/screenshots       # full-page headless Chrome shots at 320/375/768/1440 into tmp/screenshots/
mise exec node@22.21.0 -- node --test "test/javascripts/*_test.mjs"   # unit tests
```

`bin/screenshots` scrolls through the page so scroll reveals fire, then saves a full-page PNG per
width, checks for horizontal overflow and reports console errors and failed requests (non-zero
exit on any problem). `--no-js` and `--reduce` shoot with JavaScript off or reduced motion on;
`--widths=375,1440` limits the widths. Needs Google Chrome (or `CHROME=/path/to/chrome`).

## Change the Luma registration link

Edit `registrationUrl` in `assets/javascripts/config/event.js`. At load, every
`a[data-registration-link]` gets that URL. The `href` written in `index.html` is a fallback for
when JavaScript is off, so update the `https://luma.com/` placeholder there too (search for
`data-registration-link`).

Other event data (dates, schedule, capacity, contact) lives in the same file. The footer contact
details in `index.html` mirror `EVENT.contact`; update both.

## Layout

```
index.html                       page; each section sits between BEGIN/END section markers
assets/stylesheets/application.css   manifest that @imports tokens, base, layout, components/
assets/javascripts/application.js    boots a controller for every [data-controller]
assets/javascripts/controllers/      <name>_controller.js (constructor(element), connect())
assets/javascripts/lib/event_phase.js   countdown phase and remaining-time logic
test/javascripts/                node:test unit tests
```

## Deploy

Push to the branch GitHub Pages serves. `.nojekyll` makes Pages serve files as-is.
