# POWER UP RUN 2026 Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the mobile-first, single-page static POWER UP RUN 2026 site for GitHub Pages.

**Architecture:** One `index.html` with section blocks delimited by `<!-- BEGIN section: name -->` /
`<!-- END section: name -->` markers. CSS is split per component and imported by
`application.css`. JS is native ES modules: `application.js` lazy-loads a controller per
`data-controller` attribute. Event data lives in one config module.

**Tech Stack:** HTML5, CSS (custom properties, `clamp()`, 3D transforms), vanilla ES2022 modules,
Canvas 2D, inline SVG, Google Fonts (Anton, Inter). Dev only: Node 22 (`mise exec node@22.21.0 --`)
for `node:test`, Python 3 `http.server`, headless Google Chrome for screenshots.

**Spec:** `docs/superpowers/specs/2026-10-22-power-up-run-site-design.md` (read it fully first).

## Global Constraints

- Zero runtime dependencies; no build step; no npm `package.json` in the repo.
- Mobile-first: base styles for ~375px; only `min-width` media queries at `48rem`, `64rem`, `90rem`.
- `border-radius: 0` everywhere except true circles (countdown dials, markers, pulse dots).
- No horizontal scroll at any width from 320px up.
- Colours only via tokens in `tokens.css`; fonts only Anton + Inter from Google Fonts.
- Icons are inline SVG with `currentColor`.
- File names snake_case; CSS partials prefixed `_`; JS controllers `name_controller.js`.
- Every animation is cancelled or reduced under `prefers-reduced-motion: reduce`.
- Registration links use `href="https://luma.com/"` placeholder, `target="_blank" rel="noopener"`,
  and are kept in sync with `EVENT.registrationUrl` by `application.js`.
- Content works with JS disabled (reveal-hidden states only apply under `.js` on `<html>`).
- Commit messages: short imperative subject, no AI/tool attribution.

## Review Focus

- Clock edge cases: exact phase boundary instants and the after-race state must not show negative or NaN digits → covered by `event_phase_test.mjs`.
- Narrow phones (320px): the four dials, the slanted CTA, and the logo must fit without overflow → checked in Task 6 screenshots at 320px.
- Touch devices have no hover: the tilt and kit 3D effects need a non-hover state (focus/tap or idle motion) → Tasks 2 and 5.
- Reduced motion: canvas waves must render one static frame, not stop blank → Task 2.
- No-JS / slow JS: hidden-until-revealed content must still be visible → Task 1 `.js` gating, verified in Task 6.

---

### Task 1: Foundation, config, phase logic, shell

**Files:**
- Create: `index.html`, `.nojekyll`, `README.md`, `bin/server`, `bin/screenshots`
- Create: `assets/stylesheets/application.css`, `tokens.css`, `base.css`, `layout.css`,
  `components/_button.css`, `components/_section_heading.css`, `components/_nav.css`,
  `components/_footer.css`, and EMPTY stubs (one comment line) for `_hero.css`, `_countdown.css`,
  `_category.css`, `_schedule.css`, `_route_map.css`, `_runner_kit.css`, `_faq.css`
- Create: `assets/javascripts/application.js`, `config/event.js`, `lib/event_phase.js`,
  `controllers/nav_controller.js`, `controllers/reveal_controller.js`, `controllers/count_up_controller.js`
- Create: `assets/images/logos/power_up_run_logo.png` (copy `ref/logo.png`),
  `ktpc_logo.png` (copy `ref/LogoKTPC.png`), `nur_power_logo.png` (copy `ref/nur-logo.png`),
  `assets/images/favicon.svg` (orange square, white up-arrow/bolt glyph)
- Test: `test/javascripts/event_phase_test.mjs`

**Interfaces (Produces):**
- `config/event.js`: `export const EVENT = { name, tagline, registrationUrl: "https://luma.com/", registrationOpensAt: "2026-11-02T00:00:00+08:00", registrationClosesAt: "2026-11-16T23:59:59+08:00", raceStartsAt: "2026-12-04T06:30:00+08:00", venue: "KTPC Office, Kulim", capacity: 1000, category: "5KM Fun Run", fee: "FOC", schedule: [{ time: "06:00", title: "Assembly & Warm-up" }, { time: "06:30", title: "5KM Flag Off" }, { time: "08:30", title: "Prize Giving & Lucky Draw" }, { time: "11:30", title: "Grand Finale Concert" }], contact: { phone: "+60 4-000 0000", email: "info@example.com", address: "KTPC Office, Kulim, Kedah" } }`
- `lib/event_phase.js`:
  - `export function phaseAt(now: Date, event = EVENT): { phase: "before_registration"|"registration_open"|"registration_closed"|"race_day", target: Date|null, heading: string, ctaLabel: string }` — table in spec "Countdown phases"
  - `export function remaining(now: Date, target: Date|null): { days, hours, minutes, seconds, totalMs }` — integers, all ≥ 0; null target or past target → all 0
- Controller contract: `export default class XController { constructor(element) { this.element = element } connect() {} }`; `application.js` adds class `js` to `<html>`, then for each `[data-controller]` (space-separated names) does `import(\`./controllers/${name}_controller.js\`)` and `new C(el).connect()`; failures log `console.warn` and never throw. Also sets every `a[data-registration-link]` href to `EVENT.registrationUrl`.
- `reveal_controller`: on any element; adds `is-revealed` when ≥15% intersects (once). CSS: `.js [data-controller~="reveal"]` starts `opacity:0; translateY(2rem)`; `.is-revealed` transitions in. Supports `data-reveal-delay="ms"`.
- `count_up_controller`: element with `data-count-up-to="1000"`; counts from 0 when revealed, 1200ms ease-out; reduced motion → final value immediately.
- `nav_controller`: on `<header>`; toggles `is-scrolled` after 24px scroll; burger button `[data-nav-toggle]` toggles `is-open` + `aria-expanded`; closes on link click and Escape; sets `aria-current="true"` on the link whose section is in view.
- `index.html` skeleton: `<header data-controller="nav">`, then `<main>` with section blocks, each wrapped in BEGIN/END markers, in order: `hero` (`<section id="home">`), `registration` (`id="registration"`), `event_details` (`id="event-details"`), `route_map` (`id="route-map"`), `runner_kit` (`id="runner-kit"`), `faq` (`id="faq"`); then `<footer id="contact">`. Non-foundation blocks contain only the section element with its heading (using `.section-heading`) and a `<!-- content: Task N -->` comment.
- CSS primitives (layout.css/_button.css/_section_heading.css): `.container` (max-width 72rem, inline padding `clamp(1.25rem, 5vw, 3rem)`), `.section` (block padding `clamp(6rem, 12vw, 11rem)`), `.section-heading` (eyebrow `.section-heading__eyebrow` + Anton title with an animated orange bar), `.button` + `.button--primary` (skewed `-12deg` parallelogram, content counter-skewed, hover: shine sweep + arrow nudge, active: press), `.visually-hidden`.
- Spacing scale tokens `--space-1..--space-9`, type scale `--step--1..--step-6` (fluid clamp).
- `bin/server`: `python3 -m http.server ${PORT:-8000}` from repo root.
- `bin/screenshots`: shell script; serves on a free port, runs headless Chrome (`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --headless=new --hide-scrollbars --window-size=W,H --screenshot=...`) for widths 320, 375, 768, 1440 (height 4000; a `--virtual-time-budget=4000`), writes to `tmp/screenshots/` (git-ignored).

- [ ] **Step 1: Write failing tests** in `test/javascripts/event_phase_test.mjs` (node:test + assert):
  - `phaseAt(new Date("2026-10-22T12:00:00+08:00")).phase === "before_registration"` and its target equals opens date, heading "Registration opens in", ctaLabel "Get notified"
  - at exactly `2026-11-02T00:00:00+08:00` → `registration_open`, target = closes, ctaLabel "Register now"
  - at `2026-11-16T23:59:59+08:00` → `registration_open`; at `2026-11-17T00:00:00+08:00` → `registration_closed`, target = race, heading "Race day in"
  - at `2026-12-04T06:30:00+08:00` → `race_day`, target null, heading "It's race day!"
  - `remaining(new Date("2026-11-01T22:58:30+08:00"), new Date("2026-11-02T00:00:00+08:00"))` → `{days:0,hours:1,minutes:1,seconds:30}`
  - `remaining(now, pastDate)` and `remaining(now, null)` → all zeros, `totalMs === 0`
  - 3 days 4h 5m 6s difference → `{days:3,hours:4,minutes:5,seconds:6}`
- [ ] **Step 2:** Run `mise exec node@22.21.0 -- node --test test/javascripts/` → FAIL (module missing)
- [ ] **Step 3:** Implement `config/event.js` and `lib/event_phase.js`
- [ ] **Step 4:** Re-run → PASS
- [ ] **Step 5:** Build tokens/base/layout/button/section_heading CSS, nav (mobile overlay menu first, inline links from 64rem), footer (logos on white band, contact list with inline SVG icons for phone/mail/pin, social icons Facebook/Instagram/TikTok as `href="#"`, copyright 2026), application.js, nav/reveal/count_up controllers, logos, favicon, `.nojekyll`, README (how to run, where to change Luma URL), `bin/*` (chmod +x), `.gitignore` (`.DS_Store`, `tmp/`, `.workflow/`).
- [ ] **Step 6:** Run `bin/screenshots`; view the 375 and 1440 images; nav + footer render, no console errors (also check via `--enable-logging=stderr --v=0` grep for "Uncaught").
- [ ] **Step 7:** Commit `Add site foundation, event config and phase logic`

### Task 2: Hero — halftone waves, 3D logo, countdown, CTA

**Files:** Modify `index.html` (hero block only), `components/_hero.css`, `components/_countdown.css`.
Create `controllers/halftone_waves_controller.js`, `controllers/tilt_controller.js`, `controllers/countdown_controller.js`.

**Interfaces:** Consumes `phaseAt`, `remaining`, `EVENT`, `.button--primary`, reveal. Produces nothing for others.

- [ ] Halftone waves: full-bleed `<canvas>` behind hero, DPR-aware (cap 2), resizes with `ResizeObserver`. Dot grid (spacing ~10px mobile / 12px desktop); dot radius driven by 2–3 summed sine "ribbons" sweeping diagonally (top-right and bottom-left, like Frame 1), colour interpolated orange-deep → orange → amber → yellow along the ribbon; slow drift; dots near the pointer swell slightly. Pauses when offscreen (IntersectionObserver) or tab hidden. Reduced motion → draw one static frame.
- [ ] Logo: `<h1>` contains the logo `<img alt="Power Up Run 2026 — 04 Dec 2026, KTPC Office, Kulim">` and visually-hidden text. `tilt_controller` on a wrapper: pointer position → `rotateX/rotateY` up to 10deg with rAF smoothing; layered depth via `translateZ` children (`data-tilt-depth`); on touch devices use `deviceorientation` if available without permission prompt, else idle float animation. Reset on leave. Reduced motion → no tilt.
- [ ] Tagline "RUN TODAY. BRIGHTEN TOMORROW." (Anton, orange) and "Organised by Kulim Technology Park Corporation (KTPC) & NUR Power".
- [ ] Countdown: `<div data-controller="countdown">` with `[data-countdown-heading]` and four dials (Days/Hours/Minutes/Seconds). Each dial is a circle: dark `--color-night` face, outer ring of 60 SVG segments (lit proportion = value / max: days/30 cap, hours/24, minutes/60, seconds/60) lit in orange→yellow gradient, Anton two-digit number with a flip/slide micro-animation on change, label below. 2×2 grid on phones (dial ~ 40vw max 9rem), single row from 48rem (dial up to 12rem). Dials tilt slightly in 3D (`rotateX(8deg)`) and straighten on hover. `aria-live="polite"` only on a visually-hidden summary updated each minute (not every second). Ticks every second aligned to wall clock; uses `phaseAt(new Date())` each tick so phase transitions happen live.
- [ ] CTA row: `.button--primary` link `data-registration-link` with label from `ctaLabel` (default HTML "Register now") joined to a skewed date tag "04 DEC 2026" (Anton, white on orange-deep). Scroll cue arrow animated at bottom.
- [ ] Verify with `bin/screenshots` at 320/375/1440: no overflow, dials fit. Temporarily confirm phase text by checking the heading reads "Registration opens in" (today is before 2 Nov).
- [ ] Commit `Build hero with halftone waves, 3D logo and countdown`

### Task 3: Registration and Event Details

**Files:** Modify `index.html` (registration + event_details blocks), `components/_category.css`, `components/_schedule.css`. Create `assets/images/illustrations/runner.svg`.

- [ ] Registration: section heading "Run Category"; one large square card (white, hairline border, offset hard orange shadow that shifts on hover with a slight 3D lift). Card header band orange: "5KM FUN RUN". Body: big "FREE" (Anton) + "Registration fee: FOC"; stat row of three: `1000` (count_up) "Runners", "2–16 NOV" "Registration", "EMAIL / QR" "Confirmation" — stacked on phones, 3-up from 48rem. Below: "How to register" 3-step strip with numbered squares and inline SVG icons (laptop, mail/QR, flag), connector line that draws on reveal; CTA button `data-registration-link` "Register on Luma".
- [ ] Event Details: heading "Event Details", subline "Friday, 4 December 2026 · KTPC Office, Kulim". Timeline from `EVENT.schedule` rendered statically in HTML (keep in sync with config; comment says so): vertical line that draws (scaleY) on reveal; each item has a circle node that pops, Anton time, title. Runner SVG illustration: flat geometric runner in orange/ink/amber with motion lines, gentle bob animation; below the timeline on phones, side-by-side from 64rem.
- [ ] Verify screenshots 375/1440; commit `Add run category and event details sections`

### Task 4: Route Map

**Files:** Modify `index.html` (route_map block), `components/_route_map.css`. Create `controllers/route_map_controller.js`.

- [ ] Heading "Route Map", subline "5KM loop starting and finishing at KTPC Office, Kulim".
- [ ] Inline SVG (viewBox ~ 800×600) stylised map: paper ground, soft green park shapes, a lake, grey road network with white centre dashes, a few building blocks, street labels (fictional-neutral: "Jalan KTPC", "Lebuh Teknologi", etc.). Route: thick orange path loop with km markers 1–4 (small circles with numbers), start/finish marker (circle + pulse ring) labelled "Start / Finish · KTPC Office". Legend below the map (route, km marker, start/finish, water station icon at km 2.5).
- [ ] `route_map_controller`: wrapper has `perspective`; map plane starts `rotateX(55deg) rotateZ(-8deg) scale(.9)` and eases to flat as it scrolls through the viewport (scroll-linked via rAF reading bounding rect, clamped 0–1); route path draws via `stroke-dashoffset` tied to the same progress; after fully drawn, a runner dot loops along the path (`getPointAtLength`, 12s loop). Paused when offscreen. Reduced motion → flat map, path fully drawn, no dot motion.
- [ ] Note "Illustrative route — final route will be announced." Mobile: map full width with horizontal padding 0 allowed; labels remain ≥ 11px rendered.
- [ ] Verify screenshots; commit `Add animated 3D route map`

### Task 5: Runner's Kit and FAQ

**Files:** Modify `index.html` (runner_kit + faq blocks), `components/_runner_kit.css`, `components/_faq.css`. Create `assets/images/kit/t_shirt.svg`, `finisher_medal.svg`, `tote_bag.svg`, `timing_chip.svg`, `controllers/faq_controller.js`.

- [ ] Kit SVGs: flat illustrations, brand palette, each including a simplified "POWER UP RUN" mark (no text smaller than legible; a bolt/arrow glyph is fine). Medal: amber/yellow disc with ribbon in orange; tote: natural canvas with orange print; tee: orange tee; chip: dark chip with orange strap.
- [ ] Kit grid: 2 columns phones, 4 from 64rem. Each item is a square tile (`tabindex="0"`) with soft paper background; inner stage with `perspective`; hover/focus: item lifts (`translateZ`) and turns (`rotateY(-14deg) rotateX(6deg)`), a floor shadow shrinks; medal does a full `rotateY(360deg)` spin; on touch, tap toggles the `is-active` state. Caption below (Anton): T-Shirt, Finisher Medal, Tote Bag, Timing Chip.
- [ ] FAQ: questions and answers per spec section 7. `<details name="faq">` items; `faq_controller` closes siblings, animates open/close height via Web Animations API (reduced motion → instant). Summary: square row, hairline border, chevron SVG rotates 180deg; open item gets orange left bar. Answers use facts from the spec only.
- [ ] Verify screenshots; commit `Add runner's kit and FAQ sections`

### Task 6: Integration review and polish

Fresh reviewer (did not build Tasks 1–5) on the merged branch.

- [ ] `mise exec node@22.21.0 -- node --test test/javascripts/` passes.
- [ ] `bin/screenshots` at 320/375/768/1440: no horizontal overflow (also check via JS `document.documentElement.scrollWidth <= innerWidth` using headless Chrome `--dump-dom` on an injected check, or a CDP script in scratch), consistent spacing rhythm across sections, no rounded corners on rectangular components (grep CSS for `border-radius` — only `50%` on true circles).
- [ ] No console errors; page readable with JS disabled (Chrome `--blink-settings=scriptEnabled=false` screenshot).
- [ ] Reduced motion: emulate via CDP or review each controller's `matchMedia` guard.
- [ ] A11y: one `h1`, headings in order, alt text, focus-visible styles, `aria-expanded` on burger, contrast of ink-on-paper and white-on-orange for text sizes used (white on #E8642A only for ≥ 18.66px bold / Anton display).
- [ ] Fix issues found; commit `Polish layout, accessibility and motion fallbacks`
