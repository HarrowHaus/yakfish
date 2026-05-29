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

### 5. Granularity slider → a **zoom / density dial** (resolution and per-screen density
are one axis). Detents: **raw headlines · deduped stories · topic clusters**, default =
middle. The **sparse end approaches one item per screen** — so the "deck" feel is just
the zoomed-in extreme, not a separate mode. Position shown by a notch; line-count changes
as it moves. (`@saved` etc. are filters in the typing field, not granularity.)

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

### A. In-hand gesture tuning (the only design unknown)
Damping strength, reach overlap (how much context carries between reaches), haptic
intensity, the firmness of the line detent, and the exact input binding. These are
feel calls — prototype and tune on a device; don't over-specify on paper.

### B. Your-side errands (non-code) — owner action
- Secure handles: GitHub org, X, Instagram (brand as yak.fish / Yakfish, never bare "Yak").
- Free knockout search on "Yakfish" — USPTO (TESS) + EUIPO — in classes 9/38/41/42.
- Pay an attorney for clearance only on the finalist(s) if/when you scale.
