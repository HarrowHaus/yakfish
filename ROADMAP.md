# ROADMAP.md — the master build blueprint for yak.fish

The single map for **both** the Relay (you) and the Executor (Claude Code). It says
what already exists, what changes, and in what order — as phases (each a relay handoff in `BUILD_PLAN.md`) →
tasks with checkboxes. `BUILD_PLAN.md` holds the exact paste-in prompts; the other
docs hold the spec. **This is a refactor of an existing working app, not a greenfield
build** — read "Current state" before anything else.

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done. Tick them as you go.

---

## Current state (verified from the real repo zip, v=14)

The repo is a **working app** called "wire" / "PUBLIC WIRE DATABASE." It already has:

- **Backend** (`lib/build-news.js`): pulls GDELT DOC 2.0 (`mode=artlist`) + RSS;
  normalizes to a rich record; computes per-source status (ok/error/disabled, latency);
  **URL-dedup only, by design** (keeps each publisher's record); already computes
  `dupeKey = section:normalizeTitle(title)` on every article **but never groups by it**.
  Helpers exist: `lib/{parse-rss,url,hash,text}.js`.
- **Renderer** (`public/app.js` ~38 KB, `index.html`, `styles.css` ~19 KB): sticky
  wordmark (tap/double-tap/long-press), chromatic `--dim` bar (drag), filter input
  (`@source`/`@section`/`@saved`), vertical scroll slider, per-article state
  (read / saved / new-since-visit pulse / time-tint / CASL decay), grain, colophon via
  overscroll, keyboard (`/ esc j k gg s o ?`). Already tracks `lastVisitISO`,
  `hasVisitedBefore`; already has `clusterKey(title)`, `computeTimeOfDay()`,
  `mapHoursToDim()`. Endpoint chain: `/api/news` → `/.netlify/functions/news` →
  `cache/news.json` (static fallback already works).
- **Data** (`public/cache/news.json` ~1.55 MB / ~721 records): one big file,
  `{ product, updatedAt, sources[], articles[] }`.
- **Sources** (`public/feeds.json`, 39 sources): 12 Google News RSS (aggregator),
  ~17 direct publishers (BBC, PBS, NPR, ProPublica, Guardian, Al Jazeera, CNN),
  10 GDELT queries. All enabled; "down" = runtime fetch failure, computed per build.
- **Deploy**: Vercel (`api/news.js`, `vercel.json`), Netlify
  (`netlify/functions/news.mjs`, `netlify.toml`), GitHub Pages
  (`.github/workflows/pages.yml`), JSONL archive (`scripts/archive-news.mjs`,
  `.github/workflows/archive.yml`). Portable-by-design (PRODUCT_BASIS "Release object").
- **Docs**: `PRODUCT_BASIS.md` (the data law), `DATABASE_BOUNDARY.md` (when to add a DB),
  `DESIGN.md` (the v=14 calm/chromatic system), `docs/*` (deploy/run guides).

**Implication:** clustering, the new/old line, and automatic dim are not new builds —
their substrate exists (`dupeKey`, `clusterKey`, `lastVisitISO`, `computeTimeOfDay`).
The work is to wire them up and shift the model, then add the genuinely new pieces
(the dive, PWA, paid tier).

## The reconciliation (resolves the "database vs river" tension)

`PRODUCT_BASIS.md` says: a severe database — keep every publisher's record;
syndication *is* the data. The yak.fish river/dive is a **read-model on top of that
record table**, not a replacement:

- **Data layer (unchanged law):** keep every record; URL-dedup only; provenance intact.
- **Read model (the river):** group records into one **story** per `dupeKey` for display.
- **The dive:** expands a story back into its member records — the hosts. Single-record
  story → no hosts pause → straight to source.

Records in the data; stories in the view. The `dupeKey` already computed at build is the
join key. No law is broken.

---

## KEEP / CHANGE / ADD / REMOVE (against the real files)

**KEEP as-is** (already correct):
- Vanilla HTML/CSS/JS, no framework; two faces; `--dim` OKLCH; `clamp()` fluid layout.
- Wordmark + filter + per-article state + keyboard + colophon + localStorage-only.
- GDELT + RSS pull; per-source status (kept **internal**, for maintenance only — not reader-facing).
- The static `cache/news.json` fallback path.

**CHANGE** (modify what's there):
- Brand `wire` → **yak.fish** (wordmark text, `<title>`, meta, colophon, README, `product`).
- **Group records into stories** at the read-model boundary using the existing `dupeKey`
  (build-side) / `clusterKey` (client-side) — pick one home (build preferred). Emit
  `sources[]` per story (`ARCHITECTURE.md` §6). This lights up the dive.
- **`--dim` default = automatic from local clock** (use existing `computeTimeOfDay`).
  Remove the persistent bar; the page background *is* the state. Adjust = drag the
  wordmark (transient); override is **session-scoped, not persisted**; no
  "return to automatic" text — snap to the auto detent (`DESIGN.md`). Stop persisting
  `wire.dim`.
- **Field discipline:** stop carrying `description`/`socialimage` through the build
  (`build-news.js` `normalizeArticle`/`normalizeGdeltArticle`) — strip to
  headline/source/time/link (`ARCHITECTURE.md` §5).
- **Payload split:** `news.json` → small `latest.json` + `archive/*.jsonl`
  (the archive script already exists; repurpose it).
- **Deploy primary → Cloudflare Pages** (static + Functions). Keep portability: the
  static-cache path already supports it; Vercel/Netlify configs can stay as optional
  alternates rather than be deleted (respects PRODUCT_BASIS "Release object").

**ADD** (genuinely new):
- The **dive** UI: tap a story → if `sources.length > 1` show the hosts (tap one) → out;
  else straight to source. (Currently tap opens directly.)
- The **committed-advance traverse** + explicit **new/old line** anchor (currently plain
  scroll + new-pulse). Most design-open — see `OPEN_QUESTIONS.md`.
- **PWA** manifest + service worker (Safari 7-day storage; `ARCHITECTURE.md` §9).
- **OPML import/export** (+ JSON state export) — the portability backbone a real RSS
  replacement must speak (`ARCHITECTURE.md` §8). Optional paid sync via the user's own store.
- **GDELT→RSS→last-good→JSONL fallback chain** so a GDELT outage never hard-fails (`ARCHITECTURE.md` §10).
- **Filter = universal command surface** — fold granularity/zoom, focus, jump, and mute
  into the one typed input (no settings screen). The competitive wedge (`PRODUCT.md`).
- **URL view-state** — encode the *shareable* view (filter/zoom/section) in the URL;
  keep read/saved private in `localStorage`, never in the URL (`PRODUCT.md`).
- **Source mute** — `-@source` + long-press a source line (mirror of save); free; removes
  a source from the reader's river. Anti-domination by user choice (`PRODUCT.md`).
- **Per-source flood cap** — build-side, content-blind: shapes the deduped default only,
  overflow recoverable at the raw end of the zoom dial. Equal weight made structural
  (`PRODUCT.md`). Decided — in.
- **Leave = new tab** (`target=_blank rel=noopener`), never an iframe/render layer
  (`DECISIONS.md`).
- **Bloat tripwire CI** (`scripts/check-budget.mjs` + `.github/workflows/budget.yml` —
  provided): a self-chosen leanness ceiling, not a "512 KB club" rule.
- **Paid tier**: Cloudflare Pages Functions `rss-proxy` + `verify` (`ARCHITECTURE.md` §7–8).

**REMOVE / RETIRE**:
- The 12 **Google News RSS** feeds (opaque URLs, Google's selection) → replace per
  `SOURCES.md`. The dead **CNN `rss.cnn.com`** feeds → replace.
- **The right-edge scroll slider** — obsolete with reach-advance (no free scroll to
  point at). Remove.
- **The persistent chromatic dim bar** under the wordmark — the page background already
  *is* the dim state; adjust folds onto a wordmark drag, transient, session-scoped, no
  "return to automatic" text. Remove the bar (`DESIGN.md`).
- **The grain / `feTurbulence` substrate** — its only signal (fetch staleness/error) is
  already on the wordmark; remove it (also buys back shell bytes).
- **Wordmark weight-breath on fetch** and **slant on scroll-velocity** — decorative
  motion encoding nothing needed. Remove.
- **Broken-pipe / source-health visibility** — the v14 down-indicator and any
  provenance/pipe-type surface. A down feed is just absent from the river; status stays
  internal for maintenance. Do not revive or expand it.

---

## The phases (sequenced; checkboxes to track)

### PHASE 0 — Setup  · you, one-time  ·  (`BUILD_PLAN.md` M0)
- [ ] One folder = git repo; drop this handoff package + the existing repo files in.
- [ ] Private GitHub repo; push.
- [ ] Connect Cloudflare Pages (build output `public/`); auto-deploy on push.
- [ ] Open in Claude Code; confirm `CLAUDE.md` loads; make the Haiku `committer` subagent.

### PHASE 1 — Rebrand + retarget + ship the existing app  · model: `sonnet`, chores `haiku`
Goal: yak.fish is **live on Cloudflare** as the existing working list, fast. No new mechanics yet.
- [ ] Rename `wire` → `yak.fish` across `index.html` (`<title>`, wordmark, meta),
      `styles.css`, `app.js` (localStorage keys: migrate `wire.*` → `yakfish.*` with a
      one-time read-old-write-new), colophon, `README.md`, `package.json` `name`,
      `product` field in `build-news.js`.
- [ ] Confirm the static-cache path serves on Cloudflare Pages (no serverless needed for
      the free wire). Leave Vercel/Netlify configs in place but unused.
- [ ] Budget check passes (`node scripts/check-budget.mjs`).
- [ ] Push → verify the live Pages URL renders the current list rebranded.
- **Depends on:** Phase 0. **Parallel:** none (do first; it de-risks deploy early).

### PHASE 2 — Backend correctness  · model: `opusplan` (clustering), `sonnet` (rest)
Goal: the data feeds the river/dive correctly and honestly.
- [ ] **Cluster into stories** using `dupeKey`: group records, emit a story object with
      `sources[]` per `ARCHITECTURE.md` §6, keep stable `id` (the existing `stableHash`).
      Keep the underlying records (the data law) — clustering is the read model. *(Opus.)*
- [ ] **Strip fields** in `normalizeArticle`/`normalizeGdeltArticle`: drop `description`,
      `socialimage`, any image/snippet — headline/source/time/link only. *(Sonnet.)*
- [ ] **Split payload**: emit `public/cache/latest.json` (capped) + `archive/*.jsonl`;
      reuse `scripts/archive-news.mjs`. Update the client endpoint chain to load
      `latest.json`. *(Sonnet.)*
- [ ] Verify: a known multi-host story collapses to one story with correct `sources[]`;
      ids stable across two builds; no stripped field present in output.
- [ ] Add the **GDELT→RSS-registry→last-good→JSONL** fallback so a GDELT outage degrades
      gracefully (never publish empty). *(Sonnet.)*
- [ ] **Per-source flood cap** (content-blind) on the deduped-default view: no source
      exceeds the cap per window; overflow stays available at the raw zoom end — not
      deleted. Equal weight made structural (`PRODUCT.md`, `DESIGN.md`). *(Sonnet.)*
- **Depends on:** Phase 0. **Parallel with Phase 3** (share only the §6 schema). *(Opus only
  for the clustering step; everything else Sonnet.)*

### PHASE 3 — The river, the dive, and auto-dim  · model: `opusplan` (feel), `sonnet` (build)
Goal: the product shift — from scroll list to the river + dive. Most design-open.
- [ ] **The dive:** tap a story → if `sources.length > 1`, show the hosts (apprehend, tap
      one) → out; else straight to source. Build the host view from `sources[]`. *(Sonnet.)*
- [ ] **New/old line:** make `lastVisitISO` an explicit anchor in the stream (arrive at the
      seen/unseen boundary); reaching it = caught up (finishable floor). *(opusplan.)*
- [ ] **Reach-based traverse:** arrive at the **top of the new**, descend to the
      **new/old line** (the floor). A **damped downward drag (no momentum fling)** snaps to
      the next **reach** (a screenful), soft haptic detent, crossing a reach marks those
      headlines seen (reversible by dragging back up, never a confirm prompt); the line is
      a firmer detent. NOT one-item-per-screen. Validate feel before locking
      (`PRODUCT.md`, `OPEN_QUESTIONS.md` §2). *(opusplan.)*
- [ ] **Granularity = zoom/density dial:** raw headlines · deduped stories (default) ·
      topic clusters; the sparse end approaches one item per screen. Legible by a notch
      (`PRODUCT.md`). *(Sonnet.)*
- [ ] **Auto-dim, no chrome:** **remove** the persistent dim bar and the right-edge scroll
      slider. `--dim` default from `computeTimeOfDay()` (the page background IS the state);
      adjust = **drag the wordmark** (transient track, gone on release); **session-scoped,
      not persisted** (stop persisting `wire.dim`); **no "return to automatic" text** — snap
      to the auto detent. Also remove grain, wordmark weight-breath, scroll-slant. Gate ALL
      motion behind `prefers-reduced-motion` (`DESIGN.md`). *(Sonnet.)*
- [ ] **Command surface + URL view-state + source mute** (`PRODUCT.md` Folded functions):
      the filter input absorbs commands (zoom, focus, jump, mute); shareable *view* config
      encodes in the URL (read/saved stay private); mute via `-@source` / long-press a
      source name (long-press a headline stays save). Egress opens the source in a **new
      tab** (`rel=noopener`), never an in-app layer. *(Sonnet.)*
- **Depends on:** Phase 2's §6 schema (for the dive). **Parallel with Phase 2** if built
  against a fixture.

### PHASE 4 — Sources hardening  · model: `sonnet`  ·  (`SOURCES.md`)
Goal: clean, real-URL sources; no second editorial layer.
- [ ] Replace the **12 Google News** feeds with the direct-publisher set in `SOURCES.md`
      (or resolve their redirects + extract real source — preferred is replace).
- [ ] Replace dead **CNN `rss.cnn.com`** feeds.
- [ ] Run a build; confirm no `news.google.com` URL is ever a stored link-out; confirm
      `latest.json` stays populated.
- **Depends on:** Phase 2. **Do before** relying on the wire in public.

### PHASE 5 — Paid tier  · model: `opusplan` (SSRF), `sonnet` (impl)  ·  (`ARCHITECTURE.md` §7–8)
Goal: accountless power features; the only per-user cost, kept safe + cheap.
- [ ] `functions/rss-proxy`: SSRF-safe (http/https only, block internal IPs, timeout,
      size cap), license-gated, rate-limited, edge-cached. *(opusplan for the guard.)*
- [ ] `functions/verify`: license-key → entitlement; client caches in localStorage.
- [ ] Wire "paste a feed URL to add" into the filter bar (paid).
- **Depends on:** Phase 1 live. **Independent** of 2/3/4; lowest priority.

### CROSS-CUTTING (any time after Phase 1)
- [ ] **PWA**: `manifest.webmanifest` + service worker (shell cache-first, `latest.json`
      network-first). *(Sonnet.)*
- [ ] **Budget CI**: drop in `scripts/check-budget.mjs` + `.github/workflows/budget.yml`
      (provided); confirm it runs on push. *(Haiku.)*
- [ ] **Field-discipline guard**: a tiny test asserting the emitted JSON has only the four
      allowed fields. *(Sonnet.)*
- [ ] **OPML + JSON export/import**: read/write OPML for feeds, JSON for saved/pins/settings;
      bundle as the portable state file. *(Sonnet.)*

---

## Dependency graph / what runs in parallel

```
Phase 0 (you)
   │
   ▼
Phase 1  rebrand + ship  ──────────────► (yak.fish live early — de-risks deploy)
   │
   ├─────────────┬───────────────────────────── parallel ─────────────┐
   ▼             ▼                                                     ▼
Phase 2       Phase 3                                              Phase 5
backend       river+dive+auto-dim                                  paid tier
(share §6 schema)                                                  (independent)
   │             │
   └──────┬──────┘
          ▼
      Phase 4  sources hardening
```

- **Phase 2 ∥ Phase 3:** different files; the only contract is the §6 story schema. Run
  two Claude Code sessions for true parallelism, or sequence them solo.
- **Phase 5** is independent — ship the free wire (Phases 1–4) first.
- **Recommended solo order:** 0 → 1 → 2 → 3 → 4 → (cross-cutting PWA/CI) → 5.

## Model routing recap (cost)

Opus 4.8 (via `opusplan`) only for: clustering (Phase 2), the traverse feel (Phase 3),
the SSRF proxy (Phase 5). Sonnet for all other implementation. Haiku for commits/pushes/
installs/formatting via the `committer` subagent. Full rationale in `BUILD_PLAN.md` and
`CONTRIBUTING.md`.

## How this maps to the kickoff prompts

`BUILD_PLAN.md` carries one paste-in **handoff** per phase here, mapped **1:1 by phase
number** (Phase 1 → "HANDOFF — Phase 1", etc.), plus a cross-cutting handoff. Each prompt
only tells the Executor *which docs to read and which phase to proceed with* — the spec
stays here, so the prompt can't drift. Everything is a refactor: this ROADMAP's
KEEP/CHANGE/ADD/REMOVE lens — i.e. "modify the existing file" rather than "create from
scratch." (The Planner will hand you per-phase prompts updated to the refactor framing.)
```
