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
