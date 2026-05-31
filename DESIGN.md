# DESIGN.md — the form of yak.fish

Read `CLAUDE.md` and `PRODUCT.md` first. This is the visual/interaction form. It
reconciles the two earlier bibles: **the data law from PRODUCT_BASIS is the ethos;
it is rendered through the calm form described here.** Where the old build said
"wire," it now says **yak.fish**.

## The reconciliation (resolves the old conflict)

- **The law (non-negotiable, from PRODUCT_BASIS):** headlines verbatim, never
  summarized or rewritten; one line per story; only headline + source + time + link
  exist per item. yak.fish surfaces what exists and withholds judgment. (Source health
  is *not* part of the surface — a down feed is simply absent; status stays internal.)
- **The form (this document):** that law, rendered calm — a quiet, legible,
  time-aware page rather than a deliberately ugly table. Calm is the *render*; the
  law is the *spine*. Neither overrides the other.

## Two faces, minimum files

- **Recursive Variable** — wordmark, UI, filter, timestamps, source lines. yak.fish's
  identity is a *coordinate* in axis space, not a font name. **Wordmark preset (revised):
  `wght≈540, CASL≈0, MONO≈0.55, slnt 0, CRSV 0`** — *linear* (CASL 0, an instrument not a
  toy; the old CASL 0.85 read cutesy and off-tone), a *monospace lean* (MONO 0.55 gives
  "yak.fish" an even, measured cadence fitting a URL-form wordmark and the wire lineage,
  without looking like literal code), *medium* weight (calmer than 620), upright. Exact
  values eyeball-tuned on screen. A full-mono preset (`MONO 1`) is used for data — see the
  axes section below.
- **Atkinson Hyperlegible** (static) — headlines and body. Legibility-engineered.
  **Headlines stay static** — never carry variable-axis state — both for legibility
  and to keep the two-face discipline. Headline state (read, saved) shows through
  tint/position only.
- **Budget:** one Recursive variable file + Atkinson. Subset both; **drop Atkinson
  italics** (roughly halves the ~380 KB). Shell stays ≤ 512 KB (`CLAUDE.md`).

## One chromatic variable: `--dim`, time-of-day

A single OKLCH variable drives the page's color across the day. **The page background
*is* the dim state** — no bar or slider displays it (the v14 chromatic bar and the
right-edge scroll slider are both removed). It is **comfort, not mood**: each hour's state
is justified by what the eye needs then.

**A continuous circadian curve, grounded in prior art (not arbitrary keyframes):**
- *f.lux / Night Shift* — the color-temperature ramp: ~5500K warm-daylight midday →
  ~3400K halogen dusk → ~2200K ember deep night. Warmth rises as the sun falls.
- *Solarized* — the discipline: controlled perceptual-lightness deltas, deliberately low
  saturation. Steal the rigor, not the colors.
- *Kindle amber warm light / e-ink paper* — the surface is **warm paper**, never stark
  `#fff` (harsh) and **never blue-black** (dead, and blue light at night is anti-comfort —
  the v14 "ink black / night indigo" sin). Day = warm paper-white; night = warm ember.
- *OKLCH* — perceptually uniform, so the curve interpolates without the v14 banding.

**Discipline rules (exact, therefore invisible):**
- **Hue stays warm.** Night/dusk/dawn in the amber band (H ≈ 55–85); midday only nears
  neutral (low chroma, H ≈ 85–90). **Never** cross into cold blue.
- **Chroma is a whisper on the field** — ≤ ~0.05 on bg/ink surfaces. The cool-counterpoint
  accent is the one licensed exception: up to ~0.15 by day (vivid), softening at night.
- **Contrast rides a band** — ΔL ≈ 0.65–0.70 midday (alert, ambient-legible) easing to
  ≈ 0.45–0.50 at night (gentle on a dark-adapted eye). Never harsh, never washed out.
- **Continuous by the minute** off the local clock (clock, not geolocation — privacy).

Anchor states (OKLCH bg / ink, low-chroma throughout — eyeball-tuned, interpolate between):
**bg / ink / accent (L C H) — every resting anchor holds ΔL ≥ ~0.55; accent is the cool
counterpoint, circadian:**
- deep night ~02:00 (~2200K): bg `0.16 0.020 62` · ink `0.80 0.016 72` · accent `0.68 0.050 198`
  — light-on-dark; muted-teal relief, smallest chroma (precision in near-darkness)
- dawn ~05:30 (~2700K): bg `0.20 0.026 56` · ink `0.82 0.018 66` · accent `0.70 0.080 210`
  — still dark, warming; **accent clearest/bluest** (real dawn light is blue)
- morning ~09:00 (~5000K): bg `0.94 0.012 92` · ink `0.26 0.012 82` · accent `0.48 0.130 232`
  — dark-on-light, clean; clear cool blue (clarity, alertness)
- midday ~12:30 (~5500K): bg `0.96 0.008 94` · ink `0.23 0.008 84` · accent `0.46 0.150 236`
  — peak ΔL; warm-cream-read-as-white + accent most vivid (max complementary)
- afternoon ~15:30 (~4500K): bg `0.90 0.018 82` · ink `0.27 0.014 76` · accent `0.48 0.120 222`
  — the lean: field warms toward gold, accent retreats blue→teal
- golden dusk ~19:00 (~3000K): bg `0.85 0.032 72` · ink `0.28 0.020 62` · accent `0.50 0.110 196`
  — **light, not mid-gray**; the warm/cool **duet** (field richest) + P3 reach
- evening ~22:00 (~2400K): bg `0.25 0.028 60` · ink `0.82 0.020 70` · accent `0.70 0.060 200`
  — light-on-dark; diminuendo, cool note softening back to muted teal

**No resting anchor in the lightness dead zone (~0.40–0.68).** The polarity flips
(light-on-dark ↔ dark-on-light) **fast, between anchors, timed to actual sunrise/sunset** —
shape the `--t`→L curve steep through the middle so no hour rests in the unreadable valley
(this was the dawn ΔL≈0.14 failure). Accent must also clear its APCA target against `--bg`
(darken the daytime accent a touch if links read weak). All values are baked, eyeball-tuned
on screen — adjust within the discipline, never breaking it.

**The palette is DERIVED, not chosen — that is what makes it invisible-bold.** It should
read as *inevitable* (the eye recognizes real light), never as *designed*. The derivation,
in layers:
- **Spine = the Planckian locus.** Each hour's hue/chroma is the actual chromaticity of
  light at that hour's color temperature (~2200K firelight deep night → ~3000K golden hour
  → ~5500K noon), read off the black-body curve through CIE into OKLCH. Not "a nice warm" —
  the literal color of fire and daylight. The chroma arc is therefore physical, not taste:
  it peaks where daylight peaks (dusk).
- **Design for the *adapted* eye (the mind's-eye mechanism).** Chromatic adaptation
  (von Kries) neutralizes a unified cast within ~60s, so the absolute warmth adapts away —
  design the **relationships that survive adaptation** (the residual ink/bg/accent
  differences). The field then reads *neutral but alive*, never "tinted." This is why it
  sits perfectly rather than pops.
- **Corrections past OKLCH** (OKLCH is uniform in lightness only): **counter-rotate hue
  with lightness** (Bezold–Brücke) so bg→ink→accent read as *one* light source, not a hue
  that drifts; exploit **Helmholtz–Kohlrausch** so the accent **glows at the same lightness
  as the ink** (lit, not brighter); **mesopic/Purkinje tuning** at night picks the warm
  angle that stays *luminous* to a dark-adapting eye instead of going muddy.
- **Every hour is its own composition — its own flourish, not one shared peak.** Each
  state expresses a different facet of how light *actually* behaves at that hour, so they
  are individuated by truth and unified by the shared derivation. The arc across the day:
  - *Deep night ~02:00* — **precision in near-darkness**: smallest chroma, near-monochrome
    ember, separation carried by value, the single warm note at the exact mesopic/Purkinje
    angle that stays luminous instead of muddy. Restraint *is* the boldness.
  - *Dawn ~05:30* — **the cool note at its clearest**, because real dawn light is blue
    (civil twilight): the still-dark warm field against its bluest accent — the most *alive*
    state, warm and cool in true tension.
  - *Morning ~09:00* — **clarity**: the Bezold–Brücke correction held tightest, one clean
    directional light, zero hue drift; the cool accent crisp and clear against warm paper.
  - *Midday ~12:30* — **invisible warmth at peak brightness**: a warm cream the adapted eye
    reads as white but the body reads as paper (never stark `#fff`); H–K accent glow.
  - *Afternoon ~15:30* — **the lean**: hue begins rotating toward gold, chroma starts to
    rise — the day tipping, felt before seen.
  - *Golden dusk ~19:00* — **the crescendo, a warm/cool duet**: the warm field at its
    richest *with* the cool accent in complementary counterpoint (P3 reach here, graceful
    sRGB clamp) — maximum chromatic life, exactly where daylight is richest.
  - *Evening ~22:00* — **the diminuendo**: a controlled chroma step-down from the peak, hue
    settling, contrast easing to the night band — resolution, not mere dimming.
- **One cool-counterpoint accent — structural, not decoration.** A near-monochrome warm
  field neutralizes under adaptation within ~60s; a single cool note is **what keeps the
  warmth reading as warm** (simultaneous contrast + the adaptation reference). It is
  complementary to the field, lives **only on interactivity** (links / focus / the dive —
  never on content, so equal weight holds), and its relationship is **circadian**: bluest at
  dawn (true twilight), vivid by day, a warm/cool duet at dusk, a soft muted teal at night
  (never a melatonin blue; tiny in area, so the screen stays warm). **Value carries the
  composition; the field's hue stays a whisper — the accent is the single licensed note of
  real chroma.**
  Because the Planckian spine is *continuous*, minutes between anchors are samples of the
  same physically-real curve — not dumb blends — so an hour visited at 16:40 is as composed
  as one at 15:30. Every hour visited, the same polish.

These corrections are an **appearance model run once at build time**; the output is the
handful of baked OKLCH anchors below. No CAM16, no color library, no math at runtime —
**nth-degree in derivation, vanilla on the page.**

**Dim is light, not layout.** `--dim` changes only color/luminance — **never** leading,
density, measure, tracking, or any metric that touches layout. (Earlier draft tied a
"comfort posture" to the hour; killed — because the wordmark day-scrub makes dim
user-draggable, any layout-tied metric would *reflow under the finger*. The light in the
room changes; the furniture does not move. Restraint that holds even under a finger
dragging the whole day across the screen is the kind that disappears.)

**The engine (vanilla, lean, one scalar):** a single day-phase var **`--t` (0→1)**, registered
via **CSS `@property`** as a typed `<number>` so it tweens natively. Tiny JS sets `--t` from
an **inlined solar-position calc** (coarse latitude from the *timezone* — no geolocation, no
permission prompt). Everything derives from `--t` in CSS: **bg via `color-mix(in oklch, …)`**
between anchors; **ink/signal/borders via relative color syntax** (`oklch(from var(--bg)
calc(l - Δ) calc(c + δ) h)`) so the composition rules hold automatically; ****the baked anchors are the *only*
thing the runtime sees** (the Planckian + appearance-model derivation happens at build time).
Hold contrast to a constant **APCA target** (Lc ~75 body /
~90 wordmark) by solving the ink-L delta as bg shifts (swap to native `contrast-color()` when
baseline). Honor `prefers-reduced-motion` / `prefers-contrast: more` / `prefers-color-scheme`
and offer a P3/HDR-gamut variant; `@supports` fallback to a discrete OKLCH set. No color
libraries, no SunCalc dependency — inline the math.

**Adjust = a horizontal day-scrub on the wordmark.** The wordmark's color already *is* the
current `--dim`, so it is the handle: **drag it left↔right to scrub the day** (dawn ← →
night) — *horizontal because it is time, and time reads horizontally.* A transient track
surfaces only while dragging and dissolves on release; the clock value is a **felt detent**
— snap to it to hand control back. Override is **session-scoped, not persisted** (every
open re-reads the clock); **no "return to automatic" text** (unearned).
`prefers-reduced-motion` freezes all transition.

## Equal weight (anti-domination, as a visual law)

Nothing is sized, weighted, or amplified for being "loud." A story carried by forty
outlets and one carried by a single outlet render at the **same visual weight**.
There is **no volume-sizing**, no headline-weight-as-importance, no urgency/breaking
marker (`DECISIONS.md`). The only honest coverage signal is host count, and it is
*felt* via dive depth (`PRODUCT.md`), never rendered as emphasis or order.

## The variable axes as static, semantic channels

The axes are **utilized — but only to encode fixed distinctions, never animated, never
decorative** (we already killed weight-breath and slant-on-scroll; no axis decays with
age — chronological position already carries recency, and a decaying axis was flashy):
- **`MONO` is the data/prose axis.** Monospace (`MONO 1`) for every *datum* — timestamps,
  source/host names, the URL, counts: precise, tabular, machine-truth (the provenance
  lineage). Proportional for human reading text. The axis itself *says* "record vs language."
- **`wght` is static structural hierarchy** — wordmark > labels > timestamps. **Never**
  used to rank or emphasize stories; equal weight holds.
- **`CASL` is held near 0 (linear)** for the instrument register; it is not modulated.
Headlines stay static Atkinson; their state (read, saved) shows via tint/position only.

## The wordmark

- **Tap** = refresh + scroll-to-top (when scrolled).
- **Double-tap** = focus the filter.
- **Long-press** = focus mode (the diff — `PRODUCT.md`).
- **Drag** = adjust `--dim` (you grab the time-of-day color and pull; transient track,
  snaps to the auto detent — see the `--dim` section).
- **Color** = the time-of-day `--dim` (so identity also tells the hour).

## Removed as unearned chrome (the superposition pass)

Cut, because each either duplicates state already carried elsewhere or animates without
encoding anything needed:
- **The right-edge scroll slider** — obsolete with reach-advance; nothing to point at.
- **The persistent chromatic dim bar** — the page background already *is* the dim state;
  adjust folds onto the wordmark drag (see `--dim`).
- **The grain / `feTurbulence` substrate** — its only real signal (fetch staleness/error)
  is already on the wordmark; the rest is texture. Removing it also buys back shell bytes.
- **Wordmark weight-breath on fetch** and **slant on scroll-velocity** — decorative motion
  that encodes nothing a person needs.

Rule going forward (`DECISIONS.md` → earned chrome): a surface earns its pixels only if
it carries state not already legible elsewhere, and it should take the most latent
presence that allows — summoned by use, gone on release.

## Layout

Fluid via `clamp()` between 360 px and 1240 px (Utopia spirit — design as a
continuous function of viewport, not a set of breakpoints). The colophon is reached
by overscrolling past the bottom (or `?`), and carries the rules, the keyboard/touch
legend, the filter syntax, and the manual `--dim` reset. It **retracts smoothly on the
way back up** — it mirrors its own reveal transition (slides/fades closed as you scroll
toward the river), never snapping shut; `prefers-reduced-motion` makes both directions
instant.

## What the page is

At rest: a quiet, time-tinted, chronological **river** of headlines in Atkinson, with
a Recursive yak.fish wordmark and a filter bar, on a background that drifts with the
day. No homepage, no grain, no decorative motion, no chrome that isn't earned. You
open onto the **new/old line** — the seen/unseen boundary — and **gesture down** to
traverse the new toward it; the line is the floor, so the river is finishable and the
caught-up state is often empty. The articles — and the few earned controls — are the
whole design.

---

## 2026-05-30 — Interaction model LOCK: the river basis, granularity, MOVE + MARK

This section is the authoritative interaction form. It supersedes earlier scattered
references to a *save* state/gesture and to a multi-rung zoom (see `DECISIONS.md`
2026-05-30 lock). Where this conflicts with text above, this wins.

### The river — simple basis
A **single line through time**. One axis (time), one item per thing (echoes folded),
newest at one end, a floor (the tide = caught up) at the other. The atomic unit is **the
item** (one deduped thing). Nothing on the surface ranks; order is time alone.

### Granularity = altitude (continuous), not a dial
Three natural strata, revealed by *distance*, time always the landmark:
- **density** (pulled back) — items too small to read; the rhythm/shape of news over time;
- **items** (reading distance) — one line per thing: headline · time · host;
- **echoes** (dived in) — one item's sources, each a door out; multiplicity lives only here.
Self-similar law: *approach a unit → it reveals its constituents; withdraw → they form a
shape.* Altitude reveals the density the item aggregates into; the dive reveals the echoes
it resolves into. Continuous and spatial — never a mode toggle. This is what avoids the
disorientation that retired the old zoom dial: one stratum at a time, chosen by distance.

### Two primitives: MOVE and MARK
**MOVE (navigation)**
- **Pan** — travel along time; bounded by the floor (caught up) and now. Not infinite scroll;
  edges are *felt* (rubber-band + the tide line) to make finishability tactile.
- **Altitude** — density ↔ items ↔ echoes, reached two ways: implicitly by **speed**
  (the SDAZ coupling: flick fast → rise to density + travel far; slow-drag → descend to
  readable) and explicitly by **pinch** (out → detail, in → shape). The phone's native
  pinch finally does what it's for.
- **Dive** — descend into one item; its echoes fan out as doors.

**MARK (commands)** — press an object → it previews its directional consequences as
**feedforward** → flick to commit.
- **Tap = open** — the dominant act (egress) gets the simplest gesture.
- **Item**: hold = dive; a radial fan covers the rare verbs (filter-to-this, mark-seen,
  share-to-OS).
- **Host**: source-scoped mark — filter-to-this-source. (Manual mute is **cut**; source
  dominance is handled by the automatic flood-cap + positive filter.)
- **Wordmark (home nucleus)**: global marks — free-text filter (the one place typing earns
  its place), jump-to-now / jump-to-floor, focus mode, day-scrub (drag wordmark horizontally;
  retained from the dim system).

### Feedforward, not labels (self-revelation without text)
The fan never shows words; it shows the **consequence beginning** as you pull toward a
direction (Djajadiningrat 2002; Vermeulen 2013 — trigger → preview → exit):
- pull toward **open** → the host lifts, the door cracks;
- toward **filter-to-this** → the rest of the river dims away, leaving what would remain;
- toward **mark-seen** → the line settles to the seen tint and the tide advances;
- toward **share** → the OS share/reading-list sheet lifts in (the "save" hand-off).
Release commits; pull back / lift-outside cancels. The novice's slow pull is the same motion
as the expert's fast flick (rehearsal). Previews render in the **existing `--accent` and
motion language** — feedforward adds *no new chrome*; it is the surface deforming.

### The object is the menu
No radial floats free in space. The pressed item/host/time **deforms**, and its own zones
become the directional targets. The command surface has no independent existence — it lives
inside the object, which is what keeps it collapsed into the superfunction rather than bolted
beside it. One gesture grammar (press → preview → flick) holds at every altitude: a dense
moment (macro), an item (mid), an echo (micro). Direction = command; distance = depth.

### Text earns its place — the law
Allowed when it **is the content**: the headline (news), the one free-text filter string
(the user's own query), the time/host (data). Disallowed as a **control label**
(Save/Mute/Follow/Filter as words) — those become gesture + feedforward. **No first-run text
hint for now**: feedforward carries all self-revelation, and every surviving verb (open, dive,
filter, mark-seen, share) previews on the surface. Revisit only if a verb proves unlearnable by
preview alone.

### Consequences for the existing DOM/state
- **`is-saved` state is retired** from the surface; "save" routes to the OS reading-list /
  share sheet (egress), not an internal collection. `is-read` (the tide) is the only
  intrinsic item state and is mostly set automatically by crossing.
- Headline state now shows **read** only (via tint/position); there is no saved tint.
