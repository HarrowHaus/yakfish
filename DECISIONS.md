# DECISIONS.md — why yak.fish is the way it is

The *what* lives in `PRODUCT.md`, `DESIGN.md`, `ARCHITECTURE.md`. This file is the
*why*, including the paths we deliberately rejected, so the reasoning survives the
handoff and isn't accidentally undone by a "helpful" change.

## Core stance

- **Function is the invariant; form is rebuilt from it.** We reduce a thing to what
  it *does*, then rebuild a form around that — we don't accept the medium's default
  (e.g. the reverse-chronological infinite feed) just because it's there.
- **The crowd of sources is the intelligence; yak.fish only reflects it.** yak.fish
  counts; it never judges. This is the root of "no algorithm," "equal weight," and
  "non-editorial."

## Egress-first, finishable — *why*

A link aggregator owns no content; its honest job is to send you somewhere else,
well. So success is a fast, well-chosen departure and a return at a natural cadence,
**not** dwell time. This is why the surface is **finishable** (a real bottom, a
"caught up" state) and why we **reject** infinite scroll, autoplay, streaks,
notifications-back, and any time-on-site metric. Finishability is also a moral
signature: the shape itself states how we treat attention.

**Leaving means a new tab, never an in-app render layer.** Tapping a host opens the
source in a new tab (`target="_blank" rel="noopener noreferrer"`); yakfish stays open
underneath and you return to it with the story now marked read. We do **not** render the
source inside a yakfish frame/iframe, for three converging reasons: (1) *technical* —
nearly all publishers send `X-Frame-Options`/CSP `frame-ancestors` and refuse being
framed, so it can't work without scraping + re-rendering their content, which is the
content-ownership line we won't cross; (2) *legal* — wrapping another publisher's article
in our chrome is the framing/substitution trap (the *Meltwater* "subscription-substitute"
finding); (3) *ethos* — an in-app layer is retention, the opposite of honest egress. The
"preview" is the four fields; the decision to leave is made on the headline.

## Non-editorial — *why*, and what we rejected

yak.fish surfaces what exists and withholds judgment. Rejected paths:

- **Urgency / "breaking" / importance flags — rejected.** Marking something urgent
  is an editorial agenda leaking into the form; showing an agenda is itself an
  agenda. The person decides what matters.
- **Volume-sizing (bigger = more-covered) — rejected.** It amplifies the loud and
  violates equal weight. Host count is real, but it is *felt* through dive depth, not
  rendered as size or order (`PRODUCT.md`, `DESIGN.md`).
- **Disagreement-foregrounding (show where sources differ) — rejected.** It looks
  neutral but is editorial framing; it decides for the reader what's contested.

## Hard product constraints — *why*

- **No AI/LLM/summarization:** summarizing is judging and rewriting; it also creates
  copyright exposure. Headlines stand verbatim.
- **No accounts / no server DB:** privacy, permanence, and cost. All personal state
  is `localStorage`. Nothing about a person leaves their device.
- **No ads / no trackers / no telemetry:** the product is a space to think and leave,
  not to be measured. Removing the metric removes the temptation to optimize for it.
- **Lean, vanilla, localStorage = permanence:** cheap enough to run effectively forever.
  Leanness (no bloat, no build chain, no server parts) is the actual law; any byte ceiling
  is a self-chosen bloat tripwire expressing it, not a rule unto itself (the "512 KB club"
  was a proxy for this value, not a yakfish law). The real risk to a project like this is
  the maker stopping (cf. Fraidycat); low cost and no moving parts make permanence
  achievable.

## Clustering, not URL-dedup — *why we changed it*

The old build dedups by URL only, which can't group the same story across different
hosts (different URLs). That left host-count ≈ 1 everywhere, which would make the dive never pause at the
hosts and clustering never form — i.e. the central mechanic
wouldn't work. So the backend must cluster stories (mechanically, no AI), then dedup
identical URLs within a cluster. Details in `ARCHITECTURE.md` §3.

## Field discipline (headline + source + time + link only) — *why*

This is both ethos and law, and the legal footing is well-defined (see
`reference/handoff-hardening.md` Area 5):

- **Clearly safe:** linking out (CJEU *Svensson* 2014; US treats links as references);
  bare headline + source + timestamp (headlines are uncopyrightable short phrases —
  *Feist* 1991, 37 C.F.R. §202.1(a), Copyright Office Circular 34); attributed
  aggregation (hot-news misappropriation is largely preempted — *Barclays Capital v.
  Theflyonthewall*, 2d Cir. 2011).
- **The line not to cross:** copying the **lede / "heart" of the article** is the
  *AP v. Meltwater* (S.D.N.Y. 2013) trap — Meltwater reproduced headline + lede + a hit
  sentence and lost on fair use as a subscription-substitute. So: **never** reproduce
  the opening sentence, a snippet, an image, or a summary.
- **EU:** the DSM Directive **Article 15** press-publishers' right **expressly exempts
  hyperlinks and "very short extracts"** — headline-plus-link is built to sit inside
  that carve-out, which is another reason to carry **no snippet text at all**.

So we store and render only the four fields and **strip everything else at build time**
(`build-news.js` currently lets `description`/`socialimage` through — that must be
removed), not merely trust the renderer. This also independently justifies retiring
**Google News RSS** as a *commercial* dependency: its terms aren't a clear redistribution
grant (gray), whereas **GDELT grants redistribution explicitly** with attribution.

## GDELT via raw files, not the query API — *why*

The GDELT **DOC query API** has no SLA and 503s/ rate-limits (verified: a sustained 503
window while the **raw file server returned 200 in 124 ms**, serving the latest
`*.gkg.csv.zip`). So ingest GDELT from its **raw 15-minute files** on
`data.gdeltproject.org` (static downloads), not the query API. This (1) fixes reliability
— static fetches don't fall over like the hosted query service; (2) unlocks the **GKG**
(themes/entities) that powers event-level multi-host clustering — Clustering v2 comes
*with* the raw move, not as a separate project; (3) removes the 1-request-per-5s rate
limit entirely. Pair it with **direct-publisher RSS as the always-on floor** (independent
of GDELT — it carried the wire at 217 stories during a real GDELT outage) and keep the
GDELT→RSS→last-good→JSONL fallback. Nothing free matches GDELT's free + redistributable +
global + entity-granular combination, so the move is to consume it *robustly*, not replace
it. This is a sourcing refinement, not a product rescope.

## Deploy: Cloudflare Pages — *why*

Unlimited static bandwidth at ~$0 for the static front door; Pages Functions cover
the proxy and license-verify. The old Vercel/Netlify endpoints conflate the shared
wire with a per-request serverless call (wrong shape and wrong host) and are retired.
The shared wire is build-time → static → CDN; the only per-request cost is the paid
RSS proxy.

## Comfort served automatically — *why*

Eye comfort genuinely varies by hour and by person, so the option must exist — but
served *automatically* (by the local clock) is more latent and therefore better than
a standing control. Hence: automatic `--dim` by default, adjustable by dragging the
wordmark (transient, no standing bar), session-scoped with no "return to automatic" text
— automatic is the resting state, not a mode (`DESIGN.md`). Comfort is judged by the need
it serves, not its look.

## Earned chrome — *why some old elements are cut*

Every element must serve a real, otherwise-unmet need that actually arises in use,
and take the most latent presence that need allows. By that test, the old fetch
weight-breath and scroll-velocity slant are decorative (they encode nothing the
person needs) and default to removal. The filter bar, the save gesture, and comfort
all pass the test and stay. The **notched zoom dial** also fails it — it spent pixels
at rest to display a state the content already shows; cut in favor of a **gesture**
(pinch on mobile; command bar + keyboard on desktop), zero at-rest chrome.

## Zoom layers = GDELT-native containment; topic is a facet, not a depth — *why (anti-bloat)*

The zoom levels read GDELT's own relational schema (`article ⊂ event ⊂ thread`):
article = GKG record; **story = a GlobalEventID** (GDELT itself joins the covering
articles via the Mentions table — ground truth, not our heuristic); thread = events
linked over time by shared entities/themes (the only constructed level — conservative,
never tone). Two rules prevent bloat: **(1)** a level counts only if it is *strict
containment* (anything else is a different axis); **(2)** a level appears only where it
*merges something real* (auto-collapse → no empty rungs; honest ~1 level until the
GKG/Events ingestion lands). So zoom only ever *reduces* toward finishable.
**Topic / CAMEO category is a facet, not a rung** — "everything about X" is a sideways
*filter pivot* on the command surface, never a deeper zoom; folding it into the depth
gesture would overload one control with two navigations. Depth (pinch/containment) and
facet (filter) stay orthogonal. Details in `ARCHITECTURE.md` §3a. (See `PRODUCT.md`.)

## The name — *why yak.fish*

Chosen for sound: a punchy, nonsensical-but-good `[word].[word-TLD]` string where the
land-animal + fish smash is the point. `.fish` is an open gTLD. It deliberately
creates its own frame rather than describing the product (not "news/wire/calm"),
which are surface words. Brand consistently as **yak.fish / Yakfish**, never bare
"Yak" (which brushes Yik Yak). This is the meta-art stance: absorb prior art as
material; don't name yourself after the category.

---

## 2026-05-30 — Interaction & sourcing LOCK (supersedes/refines the zoom-rung, clustering, save, and "GDELT raw files" entries above)

A full conceptual pass reduced the product to its irreducible form. Where this entry
conflicts with an earlier one, **this entry wins**; the earlier reasoning is retained
above for lineage.

### What yak.fish is — the superfunction
RSS, the reader, and link-aggregation are three crippled halves of one act: **catching up.**
RSS = the *manual* version (you subscribe/manage); the reader = the *dwell* version (keeps
you in-app); aggregation = the *collapse* version (many → one stream). Strip the labor and
the dwell and the meta-form is: *become current with the public world, completely, with no
setup, then leave for what matters.* yak.fish is that catch-up function made native — not a
reader, not RSS, not an aggregator. It is a **public utility that resolves a live stream of
public links into one finite, account-free, time-ordered surface you become current with and
leave**, operated as a bounded zoomable timeline by touch.
Negation set: not a publication (owns nothing), not a feed (finite/flat/calm vs
infinite/ranked/sticky), not a reader (the doorway, not the room), not a dashboard
(resolution happened before you arrived), not a news app (news is instance one).
Unifying fact: **economics = ethics = form are one fact** — one computation broadcast
identically to everyone is *why* it is free at scale (no per-user work), *why* it is a public
commons (same for all, no profile), and *why* the surface is flat/calm (nothing to
personalize or rank).

### The river — simple basis (LOCKED)
The river is **a single line through time**: one axis (time), one item per thing (echoes
folded), newest at one end, a floor (the tide = caught up) at the other. That is the whole
macro form. Everything else is approach and exit.

### Granularity = altitude, not a dial (SUPERSEDES the article⊂event⊂thread zoom-rung model)
The earlier "zoom layers = GDELT containment (article ⊂ event ⊂ thread)" multi-rung model is
**retired as a user-facing structure** (the dial was already cut for disorientation; the
multi-rung concept goes with it). Granularity is now **a continuous function of altitude**,
time always the landmark, three natural strata revealed by distance:
- **pull back → density** — items too small to read; the *shape* of news over time (rhythm);
- **reading distance → items** — one line per thing (headline, time, host);
- **dive in → echoes** — one item's sources, each a door out; multiplicity lives only here.
One pattern at every scale: *approach a unit → it reveals its constituents; withdraw → they
form a shape.* One primitive (the item); altitude reveals the density it aggregates into; the
dive reveals the echoes it resolves into. Continuous, spatial, time-anchored — never a mode
toggle (this is why it won't disorient where the dial did: one stratum at a time, chosen by
distance, time constant). The event→sources containment survives *as the dive*; the
constructed "thread" level is deferred indefinitely.

### Aggregation = echo-fold, not semantic clustering at launch (REFINES "clustering, not URL-dedup")
Aggregation is **resolution, not comparison.** Launch basis = **fold echoes**: canonical-URL
dedup (param-strip + rel=canonical/AMP) + conservative near-identical-title match
(SimHash/MinHash, biased to *under*-merge). Kills wire-syndication repeats cheaply and
deterministically — no embeddings, no topic model, no state machine. Multiplicity survives
only as a whisper ("also at …") on the **dive**, never as surface comparison/magnitude chrome.
Full cross-source semantic clustering ("same event, different words") is **not** done at
launch; it needs the GDELT GKG/Events layer and is a later, optional power-feature.
Accepted consequence: `multiSourceCount`/host-count may be ~1 for many items at launch; the
dive simply has fewer doors until the GKG layer lands. **This does not block ship.**

### Sourcing — free, current, worldwide, VERIFIED LIVE (REFINES "GDELT via raw files, not the query API")
Re-verified 2026-05-30: the **GDELT DOC 2.0 API** (`api.gdeltproject.org/api/v2/doc/doc`) is
**live and free** — it returned its own throttle notice (HTTP 429, "limit requests to one
every 5 seconds," with maintainer contact). The connection-timeout 503s observed are
caller/proxy artifacts of hitting it too fast, **not** an outage. Operating constraint:
**~1 request / 5 s / IP** — irrelevant in the broadcast model (one query per build serves all
users).
The earlier "use raw files, not the query API" decision is **refined, not reversed**:
- **Launch sourcing = the FREE layer:** GDELT DOC API (global/multilingual breadth, queried
  once per build) + **direct-publisher RSS** (always-on, dependency-free floor) + Google News
  RSS (booster only; subject to the field-discipline caveat). Dedupe by URL.
- **Raw 15-min files + GKG/BigQuery = the later PAID power-layer** (entity/theme facets, true
  cross-source clustering) — added only if justified (~$20–150/mo + data-ops). Not required
  to ship.
Net: launch is genuinely free, worldwide, and current — the sourcing gate is closed.
Honest residuals: DOC machine-coding noise (we ignore tone/CAMEO), Google News RSS unofficial
(booster only), no single free source is 100% complete.

### Verbs reduced to the irreducible set (SUPERSEDES "the save gesture … stays")
Test each verb: *does it serve "become current and leave," or quietly rebuild dwell/profile?*
- **Follow — CUT.** Persistent per-user subscription = personalization/profile; against
  one-surface-for-all.
- **Save — CUT as an internal feature; ROUTED TO THE OS.** A keep-pile points back into the
  app (dwell), against egress. The real need (scan now / read later) is handed to the
  platform's reading-list / share sheet: "save" becomes "leave into your OS reading list."
  yak.fish owns no collection; stateless beyond the tide. (Supersedes the earlier "save
  gesture … stays.")
- **Mute — CUT** (decided 2026-05-30, same day). The automatic per-source **flood-cap**
  (`FLOOD_CAP_PER_SOURCE`, structural and identical for everyone) already handles one source
  dominating; manual mute was a personal, persistent, subtractive override — state pointing back
  into the app, against one-surface-for-all. Source dominance is handled by the flood-cap +
  positive filter; there is no manual mute.
- **Survivors — the irreducible command set: `open · dive · filter`.** Intrinsic state = **the
  tide (seen/unseen)** only, mostly automatic (crossing marks seen). Plus **share-to-OS** (the
  "save" hand-off). No follow, no internal save, no mute.

### All navigation + menus collapse to two primitives: MOVE + MARK (LOCKED)
Absorbs marking menus (Kurtenbach & Buxton 1991; M3 Gesture Menu 2018), the ZUI/SDAZ
(Igarashi & Hinckley), and feedforward (Djajadiningrat 2002; Vermeulen 2013) — then expands
past them.
- **MOVE (navigation):** pan = travel time (bounded by floor + now); altitude =
  density↔items↔echoes via *speed* (SDAZ coupling) and *pinch* (explicit); dive = descend into
  one item's echoes.
- **MARK (commands):** press an object → it previews its directional consequences as
  **feedforward, never text** → flick to commit. **Tap = open** (egress, the dominant act,
  simplest gesture). Item: hold = dive; radial fan = rare verbs (filter-to-this, mark-seen,
  share-to-OS). Host: source-scoped mark (filter-to-this-source; mute is cut). Wordmark (home
  nucleus): global marks — free-text filter, jump-to-now / jump-to-floor, focus, day-scrub.
- **Three expansions past textbook marking menus (absorb + expand, not copy):**
  1. **Feedforward replaces labels** — the fan shows consequences beginning, not words.
  2. **The object is the menu** — nothing floats in space; the item/host/time deforms and its
     own zones are the targets. The command surface has no independent existence (collapsed
     into the superfunction).
  3. **One gesture grammar at every altitude** — press→preview→flick works on a dense moment
     (macro), an item (mid), an echo (micro); the interaction is as self-similar as the river.
     Direction = command (mark); distance = depth (dive/altitude); one gesture family — flick
     out to command, press in to descend.

### Text earns its place — the law (LOCKED)
**Text is allowed when it IS the content; never when it NAMES a control.** Earns it: the
headline (the news), the one free-text filter string (the user's own query), the time/host
(data). Fails: "Save/Mute/Follow/Filter" as labels — replaced by gesture + feedforward.
Novice self-revelation is **feedforward** (preview the consequence), not text labels.
**No first-run text hint for now** (decided 2026-05-30, same day): feedforward carries *all*
self-revelation. Every surviving verb (open, dive, filter, mark-seen, share) has a previewable
on-surface consequence, so no function-word is needed. Revisit only if testing finds a verb
genuinely unlearnable by preview alone.
