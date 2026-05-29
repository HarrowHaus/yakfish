# BUILD_PLAN.md — relaying the build to Claude Code

You are not building this by hand and you are not writing build instructions. You are
**orchestrating an AI executor by relaying handoffs.** Each handoff tells Claude Code two
things only: **which docs to read, and which phase to proceed with.** The docs are the
spec; the prompt is just the pointer. That's the whole method.

### Where the prompts are
**Right here in this file**, one per handoff, in the blocks marked **`PASTE ↓`**. Copy a
block verbatim into Claude Code. Nothing else to write — if you ever feel the urge to
describe *how* to build something, stop: that detail already lives in the docs the prompt
names, and restating it only creates drift.

### The three roles
- **Planner (me, in the Claude app):** wrote the spec, routes the models, fixes the plan
  when a report comes back wrong.
- **Relay (you):** set the model, paste the handoff, run the one-line check, report back.
  You are the *only* channel between Planner and Executor — your report is my eyes.
- **Executor (Claude Code, on your machine):** reads the named docs and proceeds with the
  named phase.

### The relay loop (every handoff)
1. I give you a handoff (model + PASTE block + the report line).
2. You set the model, paste the block, let it run.
3. You run the acceptance line (it's in `ROADMAP.md` for that phase).
4. You report back one line: **done + the numbers**, or **paste the error verbatim**.
5. I hand you the next handoff (or a fix).

Keep it tight: short reports, real numbers, errors pasted whole.

---

## Model routing (why this is cheap)

Tokens are the only cost — hosting, cron, CI, deploy, GDELT are all free tiers. So the
rule is: **don't spend Opus where Sonnet gets the identical result.**

| Handoff | Model to set | Why |
|---|---|---|
| Phase 2 clustering · Phase 3 traverse feel · Phase 5 SSRF guard | **`opusplan`** | Reasoning changes the outcome; a wrong call is expensive. Opus plans, Sonnet executes. |
| Everything else in 1–5 + cross-cutting | **`sonnet`** | The spec is already written; Sonnet follows it cleanly. |
| Commits, pushes, installs, file moves, running the budget check | **`haiku`** (the `committer` subagent) | Pure mechanics; ~15× cheaper, no quality loss. |

Set it per session: `claude --model opusplan` or `claude --model sonnet`; switch by hand
with `/model haiku`. The `committer` subagent (made in Phase 0) auto-routes chores to
Haiku. Don't run Opus for a whole session out of habit — that's the main way to overpay.

---

## One folder = one repo = the deploy

One local folder is the git repo; push to GitHub; Cloudflare Pages auto-deploys on every
push (output `public/`). No second copy, nothing to keep in sync. "Deploy" = "Claude Code
pushed." The handoff package (these `.md` files + `reference/` + `scripts/` +
`.github/`) lives at the repo root so the Executor reads them as context; `CLAUDE.md`
auto-loads.

---

## PHASE 0 — Setup  ·  you, ~15 min, one-time (not a handoff)

This part is yours — it's auth + a dashboard click-through, not worth delegating.

1. **Folder = repo, package inside it.**
   ```bash
   mkdir yakfish && cd yakfish
   # copy the entire yakfish-handoff/ contents into here
   git init
   ```
2. **GitHub repo + push.**
   ```bash
   gh auth login
   gh repo create yakfish --private --source=. --remote=origin
   git add -A && git commit -m "handoff package" && git push -u origin main
   ```
3. **Cloudflare Pages (web UI, ~5 min):** dashboard → Workers & Pages → Create → Pages →
   Connect to Git → pick `yakfish` → build output `public/` → Save & Deploy. Functions in
   `functions/` deploy automatically.
4. **Open the folder in Claude Code.** Confirm it sees `CLAUDE.md` (auto-loads).
5. **Make the cheap committer subagent** (paste to Claude Code):
   > Create a subagent named `committer` that uses the haiku model. Its only job: stage
   > changes, write a one-line conventional-commit message, commit, and push to origin. It
   > must never edit source files.

**Report to Planner:** `M0 done, repo <url>, Cloudflare connected.`

---

## Order & parallelism

`ROADMAP.md` is the source of truth for dependencies. Recommended single-track order:
**Phase 1 → 2 → 3 → 4 → cross-cutting → 5.** Phase 1 ships the rebranded existing app
early (de-risks deploy). Phases 2 and 3 are parallel if you run two Claude Code sessions
(their only contract is the §6 story schema); sequential is fine too. Phase 5 (paid) is
independent and lowest priority — ship the free wire first.

Every handoff below is the **same shape**: read these docs, proceed with this phase,
follow them exactly (don't restate or invent), it's a refactor not a greenfield (use
ROADMAP's KEEP/CHANGE/ADD/REMOVE), obey CLAUDE.md, commit via `committer`, report a line.

---

## HANDOFF — Phase 1: rebrand + ship the existing app  ·  set `sonnet`

**PASTE ↓**
> Read `CLAUDE.md` and the **Phase 1** section of `ROADMAP.md`. Proceed with Phase 1
> exactly as written there. This is a refactor of the existing v=14 app — use ROADMAP's
> KEEP/CHANGE/ADD/REMOVE, modify the real files, don't create from scratch. Obey every
> NEVER/ALWAYS in `CLAUDE.md`. When the Phase 1 checks in ROADMAP pass, commit via the
> `committer` subagent and report: "Phase 1 done — live at <pages url>, rebranded."

---

## HANDOFF — Phase 2: backend correctness  ·  set `opusplan`

**PASTE ↓**
> Read `CLAUDE.md`, the **Phase 2** section of `ROADMAP.md`, `ARCHITECTURE.md` (§1, §3,
> §5, §6), and `SOURCES.md`. Proceed with Phase 2 exactly as written there — those docs
> are the spec; follow them, don't restate or invent. Refactor the existing
> `lib/build-news.js`/`lib/parse-rss.js` (KEEP/CHANGE/ADD/REMOVE in ROADMAP), not a
> rewrite. Obey every NEVER/ALWAYS in `CLAUDE.md`. Show me a sample of `latest.json`
> before committing; when the Phase 2 checks pass, commit via `committer` and report:
> "Phase 2 done — N stories, M multi-source clusters."

---

## HANDOFF — Phase 3: the river, the dive, auto-dim, folded functions  ·  set `opusplan`

**PASTE ↓**
> Read `CLAUDE.md`, the **Phase 3** section of `ROADMAP.md`, `PRODUCT.md`, and
> `DESIGN.md`. Proceed with Phase 3 exactly as written there — those docs are the spec
> (the reach-based traverse, the dive, the zoom/density dial, the no-chrome auto-dim, the
> folded functions, the removals); follow them precisely, don't restate or invent.
> Refactor the existing `public/index.html`/`styles.css`/`app.js`. If the real backend
> isn't ready, build against a fixture `latest.json` matching `ARCHITECTURE.md` §6. Gate
> ALL motion behind `prefers-reduced-motion`. Obey every NEVER/ALWAYS in `CLAUDE.md`. When
> the Phase 3 checks pass, commit via `committer` and report: "Phase 3 done — river +
> dive render, reduced-motion static."

---

## HANDOFF — Phase 4: sources hardening  ·  set `sonnet`

**Relay first:** paste the repo's current `feeds.json` to the Planner so the exact
down-list is triaged (the Planner can't see your repo). Then:

**PASTE ↓**
> Read `CLAUDE.md`, the **Phase 4** section of `ROADMAP.md`, `SOURCES.md`, and
> `ARCHITECTURE.md` §1b. Proceed with Phase 4 exactly as written there. Rewrite
> `feeds.json` per SOURCES.md (replace the Google News feeds and dead CNN feeds; never
> store a `news.google.com` URL as a link-out). Obey every NEVER/ALWAYS in `CLAUDE.md`.
> Run a build to confirm `latest.json` stays populated; when the Phase 4 checks pass,
> commit via `committer` and report: "Phase 4 done — no opaque link-outs, build populated."

---

## HANDOFF — cross-cutting: PWA, budget CI, field guard, OPML  ·  set `sonnet` (chores `haiku`)

**PASTE ↓**
> Read `CLAUDE.md`, the **CROSS-CUTTING** section of `ROADMAP.md`, `ARCHITECTURE.md` §9,
> and `CONTRIBUTING.md`. Proceed with the cross-cutting items exactly as written there
> (PWA manifest + service worker; wire in the provided `scripts/check-budget.mjs` +
> `.github/workflows/budget.yml` — do not edit those; the field-discipline guard; OPML +
> JSON export/import). The build cron (`.github/workflows/build.yml`) also belongs here
> per §9. Obey every NEVER/ALWAYS in `CLAUDE.md`. Commit via `committer` and report:
> "Cross-cutting done — PWA installable, budget CI green, OPML round-trips."

---

## HANDOFF — Phase 5: paid tier (proxy + license)  ·  set `opusplan`

Independent; do after the free wire is live.

**PASTE ↓**
> Read `CLAUDE.md`, the **Phase 5** section of `ROADMAP.md`, and `ARCHITECTURE.md` §7–§8.
> Proceed with Phase 5 exactly as written there. Implement `functions/rss-proxy` and
> `functions/verify` per the spec — the SSRF guard is the part that must be exactly right
> (http/https only, block private/internal/loopback/link-local, timeout, size cap, no
> disallowed redirects), license-gated, rate-limited, edge-cached, client-fetch-first
> hybrid. Show me the allow/deny logic before wiring the rest. Obey every NEVER/ALWAYS in
> `CLAUDE.md`. When the Phase 5 checks pass, commit via `committer` and report: "Phase 5
> done — proxy rejects internal/non-http, license gate + rate limit live."

---

## If a report comes back wrong

Paste me the error or the surprising output verbatim. I adjust the doc or the routing and
hand you a corrected handoff — you never debug it by hand. The spec is the thing we fix;
the Executor just re-reads it.
