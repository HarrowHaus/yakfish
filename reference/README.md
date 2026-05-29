# reference/ — the sourcebook behind the decisions

**Context, not spec.** Binding decisions live in the top-level docs. If a report and a
top-level doc disagree, the top-level doc wins. These back the *why*. All three present:

1. **`prior-art-landscape.md`** — Prior-Art & Competitive-Landscape Sourcebook (RSS
   readers, calm-news, clustering/dedup, business/sustainability models, technical
   prior art). Backs `DECISIONS.md` and the positioning in `PRODUCT.md`.
2. **`handoff-hardening.md`** — Cost, monetization, accountless sync, legal risk,
   PWA/resilience. Backs `ARCHITECTURE.md` §7–§10, `SOURCES.md`, and the legal rationale
   in `DECISIONS.md`. **Note:** its Area 1 (renaming) is superseded — **yak.fish** is
   settled; ignore that section.
3. **`gesture-sourcebook.md`** — "Dethroning Scroll": the scroll-property space, the
   Fitts/Hick physics floor, committed-advance vs scroll (TikTok snap-swipe + Kindle
   tap-zones as the proven thumb-equivalent of `j`/`k`), the channel budget (~3–4 visual
   + 1 haptic), and the resolution of reversible-vs-committed (feel committed, stay
   reversible via non-blocking undo). Backs the river/dive traverse in `PRODUCT.md` and
   the state-channel discipline in `DESIGN.md`.

To add or update a report: paste it into a file here and commit (the Haiku `committer`
subagent is fine — it's a chore).
