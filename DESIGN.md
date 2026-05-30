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
- **Chroma is a whisper** — ≤ ~0.05 on surfaces, the link/active signal ≤ ~0.12.
- **Contrast rides a band** — ΔL ≈ 0.65–0.70 midday (alert, ambient-legible) easing to
  ≈ 0.45–0.50 at night (gentle on a dark-adapted eye). Never harsh, never washed out.
- **Continuous by the minute** off the local clock (clock, not geolocation — privacy).

Anchor states (OKLCH bg / ink, low-chroma throughout — eyeball-tuned, interpolate between):
- deep night ~02:00 (~2200K): bg `oklch(0.17 0.022 60)` · ink `oklch(0.72 0.018 70)`
- morning ~09:00 (~5000K): bg `oklch(0.93 0.012 85)` warm paper · ink `oklch(0.25 0.010 80)`
- midday ~12:30 (~5500K): bg `oklch(0.95 0.008 88)` · ink `oklch(0.22 0.008 80)` (peak ΔL)
- golden dusk ~19:00 (~3000K): bg `oklch(0.58 0.045 65)` · ink `oklch(0.26 0.020 60)`
- evening ~22:00 (~2400K): bg `oklch(0.30 0.030 60)` · ink `oklch(0.74 0.020 70)`

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
