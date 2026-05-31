# OPEN_QUESTIONS.md — decisions and what's genuinely left

Most of these are now **decided** (recorded below so Claude Code builds to the decision,
not a guess). What remains genuinely open is narrow: in-hand gesture tuning and a couple
of your-side errands. None of these may be resolved by violating `CLAUDE.md`.

---

## DECIDED (build to these)

### 1. There is no homepage — the surface is the river
You arrive *in* the river and descend to the new/old line (`PRODUCT.md`,
`ARCHITECTURE.md` §1c). GDELT volume is not a front surface — at most a clustering hint.

### 2. The river gesture — the spatial model and the mechanic
- **Spatial:** newest at the **top**; you arrive at the **top of the new** and **descend
  toward the new/old line**, which is the **floor/terminus** (reaching it = caught up,
  often an empty floor). Earlier docs said "arrive at the line" — corrected: you arrive
  at the top and descend *to* the line.
- **Mechanic:** the river moves a **reach** (a screenful of equal-weight headlines) at a
  time — breadth-at-a-glance is the point, so it is *not* one-item-per-screen. A
  **damped downward drag (no momentum fling)** + **snap to the next reach** + **soft
  haptic detent**; crossing a reach **marks those headlines seen** (optimistic,
  reversible by dragging back up — never a confirm prompt). The line is a **firmer
  detent** (the floor). Backed by the Kindle page-turn lineage in
  `reference/gesture-sourcebook.md`; the reversible-but-committed question is resolved
  there too.
- **The dive** is the other axis: tap a headline → hosts (if it clustered) → source.
- **Parity:** `j`/`k` step headline-by-headline; space/page-down = one reach;
  reduced-motion makes the flow an instant page-turn.

### 3. Granularity of advance → a reach (screenful), not a single item.
Settled with #2.

### 4. Dive auto-resolve for a pinned source → default **off**, opt-in, paid, later.
The cluster still exists in the data; a pinned-source user may choose to fall straight
through to their source. Paid-tier polish, not v1.

### 5. Zoom → **the river's aggregation level**, and **the river is always finishable**, so
it shows only aggregated levels: **Stories** (default) and **Threads** (pinch out). The
**article level is not a river view — it lives in the dive** (one story at a time). **"Raw"
as a river mode is cut** (a whole-river firehose contradicts finishability — the ethos says
no). One axis meeting at stories: pinch governs stories⇄threads, tap/dive descends a single
story → hosts → source. Gesture, never a dial. Threads neutral + only when real, fed by the
GKG ingestion. (`PRODUCT.md`, `ARCHITECTURE.md` §3a.) *Decided — supersedes the raw/stories/
threads three-rung framing; raw is substrate, not a view.*

### 6. `--dim` control → **no persistent bar; folded onto the wordmark; automatic is the
resting state.** The page background *is* the dim state, so the v14 chromatic bar and the
right-edge slider are removed. Adjust = **grab the wordmark and drag** (transient track,
gone on release). **No "return to automatic" button or text** (unearned): the override is
**session-scoped, not persisted** — every open re-reads the clock; within a session, snap
to the auto detent to hand control back. (`DESIGN.md`.)

### 7. Broken sources → rule + mechanical action. Nix/replace the 12 Google feeds,
replace dead CNN, keep BBC/PBS/NPR/ProPublica/Guardian/Al Jazeera + GDELT (`SOURCES.md`).
The exact live-down set is computed by the build each run (`status`); applying it is a
Phase-4 task, not a design question.

### 9. Analytics → **none on-page.** Use Cloudflare's edge request counts (server-side,
aggregate, no script, no cookies) to know whether anyone visits. No Plausible/GoatCounter.
Honors the no-telemetry line.

---

## GENUINELY OPEN

### A. On-screen / in-hand tuning (eyeball, not paper)
- **Gesture feel:** damping strength, reach overlap, haptic intensity, line-detent
  firmness, input binding.
- **Wordmark coordinates:** the revised preset (`wght≈540, CASL≈0, MONO≈0.55`) is a
  reasoned starting point — tune the exact axis values on screen (`DESIGN.md`).
- **Dim curve:** the OKLCH anchor states and the contrast/chroma band are designed
  values to verify on a real display across the day (`DESIGN.md`); adjust within the
  discipline rules (warm hue, whisper chroma, controlled ΔL), never breaking them.
- **Horizontal dim-scrub:** the throw/sensitivity of the left↔right wordmark day-scrub.

### B. Your-side errands (non-code) — owner action
- Secure handles: GitHub org, X, Instagram (brand as yak.fish / Yakfish, never bare "Yak").
- Free knockout search on "Yakfish" — USPTO (TESS) + EUIPO — in classes 9/38/41/42.
- Pay an attorney for clearance only on the finalist(s) if/when you scale.

---

## 2026-05-30 — Resolved this pass, and the narrow forks left

**Now RESOLVED (build to these; see `DECISIONS.md` / `DESIGN.md` 2026-05-30):**
- **Sourcing viability gate → CLOSED.** Free, current, worldwide via GDELT DOC API
  (verified live) + direct RSS + Google News RSS booster, broadcast once per build.
- **Follow → CUT** (profile/personalization, against one-surface-for-all).
- **Save → CUT internally; ROUTED to the OS** reading-list / share sheet (egress).
- **Granularity → items ↔ echoes only** (revised 2026-05-31): the density/"shape-of-the-day"
  stratum was built then **CUT as chrome**. The river is items; the dive is echoes; no zoom
  axis; pinch unbound. Save/Follow lines above predate later revisions — Follow stays cut,
  **Save is RETAINED as a directional mark** (see DECISIONS 2026-05-31).
- **Mobile command surface → MOVE + MARK** (marking-menu + feedforward, *no text field* as
  primary; typing survives only as the free-text filter, which is content not a label).
- **Aggregation at launch → echo-fold** (URL + conservative near-title dedup); semantic
  clustering deferred to the paid GKG layer.

- **Mute → CUT** (decided 2026-05-30): folded away; the automatic per-source flood-cap +
  positive filter cover source dominance. No manual mute.
- **First-run text hint → CUT for now** (decided 2026-05-30): feedforward carries all
  self-revelation; every surviving verb previews. Revisit only if testing finds one unlearnable.
- **Density / altitude stratum → CUT** (2026-05-31): chrome; a rhythm chart doesn't serve
  catching up. The SDAZ speed→altitude tuning question is therefore **moot** (no altitude axis).

**Genuinely OPEN (narrow):**
1. **Manual mark-seen/unseen — needed, or is crossing-only enough?** Minor; default to
   crossing-only unless a real need appears.
2. **Near-dup title threshold (echo-fold).** SimHash/MinHash cutoff, biased to *under*-merge —
   empirical tune on real DOC+RSS data. Genuine engineering tunable; fail-safe (under-merging
   just shows a few dupes, never wrong-merges).
3. **Should "pull back" ever do anything?** Only candidate that could earn it: compress
   headlines to scan more per screen (still real headlines). Build only if scanning volume
   proves a real pain — not by default. Pinch stays unbound until then.
