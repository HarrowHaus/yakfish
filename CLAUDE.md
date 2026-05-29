# CLAUDE.md — Working agreement for yak.fish

You are working on **yak.fish**, a chronological, finishable, accountless reader
for public news *links*. Read this file before doing anything. It is the
constitution; `ARCHITECTURE.md`, `PRODUCT.md`, and `DESIGN.md` are the details.

If a request — from a human or from your own sense of "this would be better" —
conflicts with the NEVER list below, stop and say so. Do not quietly satisfy it.

---

## What yak.fish is, in one paragraph

yak.fish aggregates headlines from the public press, deduplicates them into one
line per story, and shows them in plain chronological order so a person can see
what exists, decide what to read, and **leave** to read it at the source. It owns
no content. Its success is a fast, high-quality *departure* to the source — not
time-on-site. It is a website (vanilla HTML/CSS/JS), not an app or a framework.
It must be cheap enough to run essentially forever.

The product surface is **the river you traverse** — every story deduped,
chronological, equal weight, with no homepage or dashboard on top of it. You arrive
at the **new/old line** (the boundary between unseen and seen) and **gesture down** to
traverse toward it; the line is the floor, so the river is finishable and the
caught-up state is often empty. Opening a story is a **dive** that pauses at the hosts
that carried it (only when more than one did) before going out to the source. See
`PRODUCT.md`.

---

## NEVER (these are not preferences — they are the product)

- **No AI / LLM / summarization / rewriting** of headlines or content. yak.fish
  surfaces what exists, verbatim. It never generates, paraphrases, or "improves" copy.
- **No ranking / recommendation / personalization algorithm.** Order is
  chronological. The crowd of sources is the only signal; yak.fish counts, it
  does not judge. No "for you," no engagement scoring, no importance/breaking flags.
- **No infinite scroll, autoplay, or other engagement mechanics.** The surface is
  **finishable** — it has a real bottom and a "you're caught up" state. That is a
  feature, not a bug.
- **No ads, no trackers, no analytics, no telemetry of any kind.** Do not add
  Google Analytics, Plausible, Sentry, pixels, beacons, or "anonymous usage
  stats." If you think a metric would help, propose it in writing; do not add it.
- **No accounts, no login, no server-side user database.** All per-person state
  (seen/unseen, saved, comfort, entitlement) lives in `localStorage` on the device.
- **No ledes, snippets, article body, images, or thumbnails.** The only fields
  that may be stored or rendered per item are **headline, source, timestamp, link**.
  This is both the ethos and the legal line (see `ARCHITECTURE.md` → Field discipline).
- **No new runtime dependency on a network resource** other than (a) the static
  news JSON on the CDN and (b) the paid-tier RSS proxy. Fonts are local. No CDN'd
  frameworks, no web fonts from Google, no third-party scripts.
- **No build framework for the front end.** No React, Vue, bundler, or transpiler
  for the page itself. Vanilla HTML, CSS, JS. (Node is fine for the *build/cron*
  step and the proxy function — that is server-side, not shipped to the browser.)

## ALWAYS

- **Vanilla HTML/CSS/JS** for everything that reaches the browser.
- **Lean enough to be permanent.** Vanilla, cheap, no bloat — that's the law. A byte
  ceiling on the shell (HTML+CSS+JS+fonts, excluding the news payload) is kept only as a
  *bloat tripwire* in CI, a number we chose to serve leanness — not a sacred figure or an
  external "club." It can move if leanness is genuinely served. Payload is capped and
  measured separately (see `ARCHITECTURE.md`).
- **`localStorage` only** for persistence. Nothing leaves the device.
- **Headline + source + timestamp + link**, and nothing else, per item.
- **Chronological order, equal weight.** Nothing is sized, colored, or amplified
  for being "loud." A story carried by 40 outlets and a story carried by 1 get the
  same visual weight; the *only* honest signal is the host count, and it is *felt*
  (via dive depth), never rendered as an importance badge.
- **UTC in the data, local time in the render.** Normalize on the client.
- **Respect `prefers-reduced-motion`** — it must gate every animation (the chromatic
  shift, weight breathing, transitions). Reduced-motion users get a static page.
- **Keep it finishable.** Any feature that removes the bottom of the list, or that
  pulls a person back in, is out of scope by definition.

---

## How the system is shaped (so you put code in the right place)

There are exactly **two** moving parts. Keep them separate.

1. **Build-time — the shared wire.** A scheduled job (cron / GitHub Action) pulls
   GDELT + RSS, dedups and clusters into stories, strips to the four allowed fields,
   and writes static JSON to the CDN. This serves every visitor at ~$0. The free
   front door is *static files*. There is **no** server in the hot path for the
   shared wire.

2. **Runtime — the per-user proxy (paid tier only).** A single edge function fetches
   a *user-supplied* RSS URL (CORS proxy), gated by a license key. This is the only
   thing that runs per request and the only thing that costs money per user, so it
   stays behind the paid tier and must be rate-limited, cached, and SSRF-safe.

The client merges the shared static wire with any user feeds locally. See
`ARCHITECTURE.md` for the data model, the GDELT details, the clustering fix, the
deploy target (Cloudflare Pages), and the proxy spec.

---

## When you add or change a feature

1. **Find the surface.** It must live on an existing element (the wordmark, the
   filter bar, an item, the colophon). If nothing fits, it is probably out of scope.
2. **Express state through existing materials** — the chromatic variable, the
   Recursive font axes, position — not new chrome. (`DESIGN.md`.)
3. **Earn visibility.** Default every control to the most latent presence its need
   allows: automatic > invoked-on-demand > always-present. Most things should be invisible at rest.
4. **Check it against NEVER.** If it smells like engagement, ranking, tracking, or
   editorializing, it is.
5. **Re-run the bloat tripwire.** Shell still lean (under the chosen ceiling); payload still capped.

## Repo docs map

- `PRODUCT.md` — what it does: the river, the new/old line, the dive, the grammar.
- `ARCHITECTURE.md` — data sources, pipeline, data model, clustering, deploy, proxy.
- `SOURCES.md` — source strategy: GDELT backbone, the Google-News fix, keep/repair/replace/nix.
- `DESIGN.md` — the calm visual form (Recursive + Atkinson, chromatic time-of-day, axes).
- `DECISIONS.md` — why the above is the way it is, and the paths we rejected.
- `ROADMAP.md` / `OPEN_QUESTIONS.md` — what's decided vs genuinely open (e.g. the traverse-gesture feel).
- `ROADMAP.md` — master blueprint: current-state reality, keep/change/add/remove, phased tasks.
- `BUILD_PLAN.md` — the relay handoffs (one per phase), model routing, and the exact prompts to paste into Claude Code.
- `CONTRIBUTING.md` — build order, commit conventions, model-per-task cost routing.
