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
  identity is a *coordinate* in axis space, not a font name (wordmark preset
  wght≈620, CASL≈0.85, MONO 0, slnt 0; a mono preset wght≈400, CASL 0, MONO 1 for
  filter/timestamps/sources).
- **Atkinson Hyperlegible** (static) — headlines and body. Legibility-engineered.
  **Headlines stay static** — never carry variable-axis state — both for legibility
  and to keep the two-face discipline. Headline state (read, saved) shows through
  tint/position only.
- **Budget:** one Recursive variable file + Atkinson. Subset both; **drop Atkinson
  italics** (roughly halves the ~380 KB). Shell stays ≤ 512 KB (`CLAUDE.md`).

## One chromatic variable: `--dim`, time-of-day

A single OKLCH variable drives the page's color temperature/brightness across the day.
**The page background *is* the dim state** — so there is no separate bar or slider to
display it (a control whose job is to show the chromatic state would duplicate the page
itself, and a standing adjust-control would be unearned chrome sitting unused). The v14
chromatic bar under the wordmark is **removed**; the right-edge scroll slider is
**removed** (no free scroll → nothing to point at).

- **Automatic by default.** `--dim` is computed from the device's **local clock** —
  warmer/dimmer toward night, cooler/brighter by day. No one touches it; comfort served
  automatically is the most latent (best) form.
- **Adjust by folding onto the wordmark.** The wordmark's color already *is* the
  current `--dim` (time-of-day), so the wordmark is the handle: **grab it and drag** to
  nudge the dim. A transient chromatic track surfaces only *while* dragging and dissolves
  on release — zero at-rest footprint. (Exact gesture/throw is in-hand tuning.)
- **Automatic is the resting state, not a toggle.** There is **no "return to automatic"
  button or text** (that would be unearned). Instead: the override is **session-scoped,
  not persisted** — every fresh open re-reads the clock and is automatic again. (Change
  from v14, which persists `wire.dim`; stop persisting it.) Within a session, the
  automatic clock value is a **felt detent** in the drag — snap to it to hand control back.
- **Still at rest.** Nothing breathes, glows, or pulses. **`prefers-reduced-motion`
  freezes all of it** and every other animation.

## Equal weight (anti-domination, as a visual law)

Nothing is sized, weighted, or amplified for being "loud." A story carried by forty
outlets and one carried by a single outlet render at the **same visual weight**.
There is **no volume-sizing**, no headline-weight-as-importance, no urgency/breaking
marker (`DECISIONS.md`). The only honest coverage signal is host count, and it is
*felt* via dive depth (`PRODUCT.md`), never rendered as emphasis or order.

## The font axes as state channels (used intuitively)

Recursive's axes may carry below-perceptible state — *felt, not read* — within a
small channel budget (~3–4 visual channels, ~3 levels each; lean on position, the
strongest channel). Examples in use: timestamp `CASL` decays with age; source line
tints subtly with recency. Keep each channel below the threshold where it "shouts";
if it reads as emphasis, it's too much. **None of this may encode importance or
reorder anything** — equal weight holds.

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
legend, the filter syntax, and the manual `--dim` reset.

## What the page is

At rest: a quiet, time-tinted, chronological **river** of headlines in Atkinson, with
a Recursive yak.fish wordmark and a filter bar, on a background that drifts with the
day. No homepage, no grain, no decorative motion, no chrome that isn't earned. You
open onto the **new/old line** — the seen/unseen boundary — and **gesture down** to
traverse the new toward it; the line is the floor, so the river is finishable and the
caught-up state is often empty. The articles — and the few earned controls — are the
whole design.
