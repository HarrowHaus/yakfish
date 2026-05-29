# CONTRIBUTING.md — conventions for building yak.fish

For Claude Code (and any human) working in this repo. Read `CLAUDE.md` for the hard
product constraints; this file is *how to work*, not *what to build*.

## Build order

1. **Backend** — `lib/build-news.js` + `lib/parse-rss.js`: pull → **cluster** (the
   `ARCHITECTURE.md` §3 fix, not URL-only dedup) → stable ids → strip to four fields →
   emit `public/cache/latest.json` + `public/archive/*.jsonl`.
2. **Renderer** — `public/{index.html,styles.css,app.js}`: the river + the dive
   (`PRODUCT.md`), against the §6 data model. Can be built against a fixture before the
   backend is done.
3. **Deploy plumbing** — `.github/workflows/build.yml` (cron build) + PWA. The budget
   check (`scripts/check-budget.mjs`, `.github/workflows/budget.yml`) is already here.
4. **Paid tier** — `functions/rss-proxy`, `functions/verify` (`ARCHITECTURE.md` §7–8).

Renderer and backend share exactly one contract: the story schema in `ARCHITECTURE.md`
§6. Honor it on both sides and they compose.

## Model routing (cost)

Tokens are the only cost; route work to the cheapest model that gets the same result.

- **Opus 4.8** — only the clustering algorithm and the SSRF proxy design. Use
  `opusplan` for those sessions (Opus plans, Sonnet executes).
- **Sonnet 4.6** — default for all other implementation (renderer, YAML, PWA, feeds).
- **Haiku 4.5** — chores only: commits, pushes, `npm install`, formatting, file moves,
  running the budget check. Route these through the `committer` subagent (Haiku) or
  `/model haiku` for the step.

Never run a whole session on Opus by default. When unsure, Sonnet; escalate to Opus
only when Sonnet visibly struggles on genuinely hard reasoning.

## Commits

- Small, focused commits; one logical change each.
- Conventional-commit style: `feat:`, `fix:`, `chore:`, `docs:`, `build:`.
- The `committer` subagent (Haiku) stages, writes the message, commits, and pushes.
  It must never edit source files.
- Every push auto-deploys via Cloudflare Pages, so don't push a broken shell — the
  budget check and a quick local load are the gate.

## Hard checks before any push

- **Leanness tripwire:** `node scripts/check-budget.mjs` passes (shell under the chosen
  ceiling; news payload excluded and capped separately). CI enforces it. The number is a
  bloat alarm, movable if leanness is served — not a sacred figure.
- **Field discipline:** no field beyond headline/source/time/link in any emitted JSON
  (`ARCHITECTURE.md` §5).
- **No telemetry / analytics / trackers** were added (`CLAUDE.md`). Agents add these by
  reflex — don't.
- **Reduced motion:** every animation is gated behind `prefers-reduced-motion`.
- **Vanilla:** nothing reaching the browser depends on a framework or a remote script;
  fonts are local.

## What not to do (these undo the product — see `CLAUDE.md`)

No AI/summarization, no ranking/recommendation/personalization, no infinite scroll or
autoplay, no accounts or server-side user DB, no ads/trackers/telemetry, no ledes/
snippets/images, no build framework for the page, no new runtime network dependency
beyond the static JSON and the paid RSS proxy.

## Tests

Match `ARCHITECTURE.md` §11. Put fixtures in `test/fixtures/` (a multi-host cluster, a
single-source story, a malformed feed). A `test-runner` subagent on Sonnet is a good
cheap way to keep the suite green.
