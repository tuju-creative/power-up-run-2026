# POWER UP RUN 2026 — Event Site Design

## Intent

A single-page static event site for POWER UP RUN 2026, hosted on GitHub Pages. Its job is to
make people want to run and send them to the Luma registration page. Visual direction follows
`ref/Frame 2.png` (section order, orange halftone energy, logo, segmented circular countdown),
with the generous whitespace of cowayrun.com.my.

## Facts (source: `ref/Screenshot 2026-10-22 at 3.54.36 AM.png`, `ref/logo.png`)

| key | value |
|---|---|
| Event | POWER UP RUN 2026 — "Run Today. Brighten Tomorrow." |
| Race day | 4 December 2026, KTPC Office, Kulim |
| Organisers | Kulim Technology Park Corporation (KTPC) & NUR Power |
| Registration period | 2–16 November 2026 |
| Capacity | 1000 participants |
| Category | 5KM Fun Run (only category) |
| Fee | FOC (free) |
| Confirmation | Email confirmation / QR code |

The mockup's "10km / RM 30.00" content is superseded by the table above.

## Decisions

- **Stack:** plain HTML/CSS/JS, zero runtime dependencies, no build step. ES modules served as-is.
  `.nojekyll` at root so GitHub Pages serves files verbatim.
- **Mobile-first:** base CSS targets a 360–420px phone; layouts grow via `min-width` media
  queries only (`48rem` tablet, `64rem` desktop, `90rem` wide). No `max-width` media queries.
  Fluid type and spacing via `clamp()`. Touch targets ≥ 44px. 3D pointer effects fall back to
  device orientation or a gentle idle animation on touch devices.
- **Shape:** `border-radius: 0` on every component. Circles only where the element *is* a circle
  (countdown dials, map markers, pulse dots, social icon discs if used).
- **Whitespace:** section padding `clamp(6rem, 12vw, 11rem)` block; content max-width ~72rem,
  text measure ≤ 60ch.
- **Fonts (Google Fonts):** `Anton` (display, uppercase headings, numerals), `Inter`
  (body/UI, 400/600/800).
- **Icons:** inline SVG only, `currentColor`, `aria-hidden="true"` when decorative.
- **Colour tokens:** `--color-orange #E8642A`, `--color-orange-deep #D2491A`,
  `--color-amber #F5A623`, `--color-yellow #FFD200`, `--color-paper #FFFBF7`,
  `--color-ink #1E1B18`, `--color-ink-soft #5A534D`, `--color-line #EADFD6`, `--color-night #141210`
  (footer/countdown dial faces).
- **Motion:** micro-interactions on every interactive element; scroll reveals; CSS 3D
  (`perspective`, `preserve-3d`). All motion disabled/reduced under
  `prefers-reduced-motion: reduce`. Animate only `transform`/`opacity` (and canvas).
- **Registration CTA:** points to `EVENT.registrationUrl` in `assets/javascripts/config/event.js`
  (placeholder `https://luma.com/` until the real event link is supplied); opens in new tab
  with `rel="noopener"`. The HTML `href` carries the same placeholder so it works without JS.

## File layout (Rails conventions: snake_case, grouped by type, `application.*` manifests)

```
index.html
.nojekyll
README.md
assets/
  stylesheets/
    application.css             manifest (@import in order)
    tokens.css  base.css  layout.css
    components/_nav.css _hero.css _countdown.css _button.css _section_heading.css
               _category.css _schedule.css _route_map.css _runner_kit.css _faq.css _footer.css
  javascripts/
    application.js              boots controllers for every [data-controller]
    config/event.js             single source of event data
    lib/event_phase.js          pure phase/countdown logic (unit-tested)
    controllers/*_controller.js nav, countdown, halftone_waves, tilt, reveal, count_up,
                                route_map, faq
  images/
    logos/power_up_run_logo.png ktpc_logo.png nur_power_logo.png
    kit/t_shirt.svg finisher_medal.svg tote_bag.svg timing_chip.svg
    illustrations/runner.svg
    favicon.svg
test/javascripts/event_phase_test.mjs   node:test
```

Controllers follow a Stimulus-like contract without the library: each module default-exports a
class with `constructor(element)` and `connect()`; `application.js` maps `data-controller="name"`
to `controllers/name_controller.js` via dynamic `import()`.

## Sections (single page, in order; anchors in parentheses)

1. **Nav** — sticky, transparent over hero, paper background + hairline after scroll. Links:
   Home (#home), Registration (#registration), Route Map (#route-map), FAQ (#faq),
   Contact (#contact). Mobile: full-screen square overlay menu, animated burger→close.
   Active link underline tracks the section in view.
2. **Hero (#home)** — min-height 100svh. Canvas halftone dot waves in orange→yellow that drift
   slowly and react to the pointer. Logo with 3D pointer tilt + layered depth. Tagline
   "RUN TODAY. BRIGHTEN TOMORROW." and the organiser line. Countdown: four circular segmented dials
   (Days / Hours / Minutes / Seconds; four dials, which stack 2×2 on phones and sit in one row from 48rem).
   Dial segments light up proportionally; digits flip on change. CTA: slanted (skewed) "REGISTER NOW"
   button joined to a "04 DEC 2026" tag.
3. **Registration (#registration)** — "Run Category" card: 5KM FUN RUN, FREE, 1000 slots, period
   2–16 Nov 2026, confirmation by email/QR. Large numerals count up when revealed. Three-step
   "How to register" strip (Register on Luma → Receive email + QR → Show QR on race day). CTA repeat.
4. **Event Details** — race-day timeline that draws itself on scroll, beside an SVG runner
   illustration (no photo). Placeholder schedule (editable in `config/event.js`):
   06:00 Assembly & Warm-up · 06:30 5KM Flag Off · 08:30 Prize Giving & Lucky Draw ·
   11:30 Grand Finale Concert. Venue: KTPC Office, Kulim.
5. **Route Map (#route-map)** — stylised SVG map (roads, greenery, labels) on a plane tilted in
   3D (`rotateX`) that flattens as it scrolls in; the 5km loop path draws itself, a dot "runner"
   travels the loop, pulsing start/finish marker at KTPC Office. Labelled "Illustrative route —
   final route to be announced."
6. **Runner's Kit** — four SVG illustrations: T-shirt, finisher medal, tote bag, timing chip.
   3D lift/turn on hover/focus; medal spins on its Y axis. Two-column grid on phones, four from 64rem.
7. **FAQ (#faq)** — `<details>`/`<summary>` accordion, one open at a time, animated height and
   chevron. Questions: Is registration free? · How many runners can join? · When does
   registration open and close? · How do I get my confirmation? · What is in the runner's kit? ·
   Is there parking available? (answer: details will be shared by email before race day) ·
   Can I change my category? (only one category: 5KM Fun Run).
8. **Footer (#contact)** — organiser logos (KTPC, NUR Power), contact block (placeholders:
   phone, email, address "KTPC Office, Kulim, Kedah"), social icons, final CTA, copyright.

## Countdown phases (`lib/event_phase.js`)

All times are Malaysia time (UTC+08:00):
- `registrationOpensAt` 2026-11-02T00:00+08:00
- `registrationClosesAt` 2026-11-16T23:59:59+08:00
- `raceStartsAt` 2026-12-04T06:30+08:00

| now | phase | countdown target | heading | CTA label |
|---|---|---|---|---|
| < opens | `before_registration` | opens | Registration opens in | Get notified |
| opens ≤ now ≤ closes | `registration_open` | closes | Registration closes in | Register now |
| closes < now < race | `registration_closed` | race | Race day in | View event |
| ≥ race | `race_day` | — (dials show 00) | It's race day! | View event |

## Verification

- `node --test test/javascripts/` passes (phase boundaries, remaining-time math, never negative).
- Headless Chrome screenshots at 375, 768, 1440 widths look right and have no horizontal scroll.
- No console errors; page works (content and CTA visible) with JS disabled.
- `prefers-reduced-motion` stops waves/spins/draw animations.
- All images have alt text; one `h1`; landmark structure; visible focus styles; colour contrast AA
  for body text.
