# PRODUCT.md — what yak.fish is and how it behaves

Read `CLAUDE.md` first. This document defines the product; `ARCHITECTURE.md` is how
it's built and `DESIGN.md` is how it looks.

## The one sentence

yak.fish shows the public press as one deduplicated, chronological, finishable list
of headlines so a person can see what exists, decide what to read, and **leave to
read it at the source**. It delivers *decisions about what to read*, not content.

## The atom

The unit is a **link tuple**: headline, source, time, link. Tuples about the same
event are clustered into a **story** (`ARCHITECTURE.md` §3). A story carries its
`sources[]` — the hosts that ran it. The person's act is: triage → click out → return.

## Economics (the inversion that defines every other choice)

Feeds optimize time-on-platform. yak.fish optimizes the **opposite**: minimize time
on yak.fish, maximize the quality of the departure. Success = a fast, well-chosen
click-out and a return at a *natural* cadence — never dwell, never streak, never
"engagement." This is why there is no infinite scroll, no autoplay, no notifications
pulling you back, no algorithm. yak.fish belongs to the near-extinct class of
honest-egress products (search, directories, wire services) and is built to be one
on purpose.

## Finishability (the moral signature)

The list has a real bottom and a real "you're caught up" state. It can be *finished*.
A finishable surface is itself a statement about how the maker treats attention; it
needs no manifesto. Any feature that removes the bottom is out of scope by definition.

## The surface: the river you traverse, and the dive into a story

There is **no homepage and no dashboard.** When you open yak.fish you land *in the
river* — the wire itself: every story deduped, chronological, equal weight. There is
nothing on top of it to "apprehend" first; the river is the thing you traverse.

**The river (arrive + traverse).**
- You arrive at the **top of the new** — the freshest unseen headline. Newest is at
  the top; below you, somewhere down the stream, is the **new/old line**: the boundary
  where what's new-since-last-visit meets what you've already seen.
- You **descend toward the line.** The line is the **floor/terminus**, not the start —
  reaching it means you've passed everything new, so you're caught up (often an empty
  floor). This is the inverse of doomscroll: the new is *finite and bounded*, down has
  an end. Each visit, fresh items accumulate above, so the line sits lower relative to
  the new top; this session's new becomes next session's old.
- **The traverse is a reach at a time, not an item and not a fling.** You see a
  screenful of equal-weight headlines at once — a **reach** — because breadth-at-a-
  glance is the whole point of an aggregator (one-item-per-screen would fight that).
  The river flows under a **downward drag that is damped — no momentum fling** (that
  damping is what kills doomscroll physics). On release it **snaps to the nearest
  reach** with a soft **haptic detent**; crossing a reach **marks those headlines seen**
  (optimistic, reversible by dragging back up — never a confirm prompt). The **line is
  a firmer detent**: you feel the floor, and passing it into already-seen/archive takes
  a deliberate extra push. *(Damping strength, reach overlap, haptic intensity, and the
  exact input binding are the in-hand tuning left in `OPEN_QUESTIONS.md` #2/#3.)*

**The dive (into a story — the only depth axis).**
- Open a story by diving into it. If it clustered (more than one host carried it),
  the dive pauses at **the hosts** — 3–8 seen at once, tap the one you want — then
  out to the source. A single-source story has no host step; the dive falls straight
  out to its source.
- **Out — the source, in a new tab.** Tapping a host opens the source in a **new tab**
  (`rel="noopener noreferrer"`); yak.fish stays open underneath. You've left yak.fish —
  that's the win. **Return** is just switching back to the yak.fish tab: the river is
  exactly where you left it, and the story you opened is now marked read. No in-app
  reader layer / iframe — that's a content-ownership and framing line we don't cross
  (`DECISIONS.md`). The loop is traverse → dive → leave (new tab) → return.

**Dive depth is the coverage signal, felt not displayed.** A widely-carried story
catches you at the host step; a single-source story drops straight through. You learn
a story's footprint through your hand, never through a "carried by N" badge. Nothing
is sized, colored, or ordered by that count — equal weight holds (`DECISIONS.md`).

## Interaction grammar (no menus)

- **Descend the river** to traverse — a damped downward drag (no momentum fling) that
  snaps to the next **reach** (a screenful of headlines), with a brief haptic detent.
  Crossing a reach marks those stories *seen* immediately (optimistic), recoverable by
  dragging back up — never a confirmation prompt. The new/old line is a firmer detent —
  the floor; there is no infinite pull for more.
- **Dive** into a story to open it (and back out to undo). The dive pauses at the
  hosts only when the story clustered; otherwise it falls straight to the source.
- **Tap** selects a host at the cluster step.
- **Open** is not a separate action — it's the last step of the zoom (you keep
  diving until you fall out to the source).
- **Leave** is not a separate action — it's advancing past, or zooming out.
- **Save** is the one action with its own gesture: **long-press a headline** (as today),
  or a hold-then-direction. Saved items are reachable via `@saved`. (Long-press on a
  *source name* is mute — different target, see below — so the two never collide.)
- **Keyboard parity** already exists and stays: `/` filter, `esc` clear, `j`/`k`
  next/prev, `g g` top, `s` save, `o` open, `?` colophon.

## The filter bar (the only navigation)

One element doing the navigation, two parts:

- a **typing field** — plain text to filter, plus `@source`, `@section`, `@saved`,
  and (paid) **paste a feed URL to add an RSS source** (subscription, filtering, and
  feed-management collapse into this one input — no settings screen);
- a **zoom dial** that sets your **depth in the story hierarchy** (article ⊂ event ⊂
  thread, built from GDELT's GKG). This is the **same axis as the dive, entered from the
  outside**: zooming out adds a layer of structure you then dive *through*; zooming in
  strips layers away. The river is a horizontal cross-section through one vertical
  hierarchy at the depth you've set.
  - **Raw** — a line is one article; tap → straight to source (0 dive layers).
  - **Stories** (default) — a line is one event; tap → its hosts → source (1 layer).
  - **Threads** — a line is one ongoing thread; tap → its stories → hosts → source (2 layers).

  **A level exists only when it changes the view.** If dedup merges nothing, the dial does
  not offer "stories" as distinct from "raw"; if there are no multi-story threads, the
  thread stop disappears. There is never an empty cluster layer. Zooming out is a **felt
  merge** — lines visibly collapse into their parent (reduced-motion: instant), so the
  motion *is* the meaning, not a silent recount. (The full three-level depth blooms once
  the GKG ingestion feeds real themes; with title-match only it correctly shows ~one
  usable stop rather than faking depth.) Position legible by a notch; nothing glowing.

## Focus mode = the diff

Long-press the wordmark → collapse to only the links new since you last cleared it.
Natural floor: zero (you're caught up). A quiet hour shows a sentence; a big day
shows more — the size of the view is the size of the real news. Possible extension
(test before committing): long-press-and-drag sets focus *depth* continuously
(everything ↔ 24 h ↔ since last visit ↔ since this view was cleared).

## Comfort

Eye comfort is served automatically by the local clock (the chromatic time-of-day),
with a latent manual override. See `DESIGN.md`. It is comfort, not mood — judged by
the need it serves, not its look.

## Folded functions (superposition — no new chrome)

These earn their place by folding onto a surface that already exists, and they grow the
ethos rather than bolt onto it:

- **The filter is the universal command surface.** The one typed input already does
  text-filter + `@source`/`@section`/`@saved` + paste-URL. It also absorbs the rest of
  control — granularity/zoom, focus, jump-to-line, mute — so power users live in one
  field and there is no settings screen. (The unified command bar is the competitive
  wedge — `reference/prior-art-landscape.md`.)
- **The URL carries shareable view-state.** The current *view* (filter, zoom, section)
  encodes into the URL, so any yak.fish view is a link you can send or bookmark. Only
  view config travels in the URL; **read/saved state stays private in `localStorage`,
  never in the URL.** Zero screen cost, no tracking.
- **Source mute — the symmetric half of add-a-source.** Mute lives in the command bar
  (`-@source`) and as an affordance on a **source name** where sources already appear
  (the dive's host step, a filter chip) — **not** on a headline. Long-press on a headline
  stays unambiguously **save**; mute never competes for it. Muting removes a source from
  *your* river: user choice, not an algorithm — anti-domination by hand. Free (hiding
  costs nothing; adding arbitrary RSS stays paid because it costs the proxy).
- **Per-source flood cap — structural anti-domination (decided, in).** Build-side and
  **content-blind**: it counts only *which source*, never what a story is about or how
  "important" it is. It shapes the **deduped-stories default view only** and is
  **non-destructive** — the overflow reappears as you zoom toward the **raw-headlines**
  end of the granularity dial, so nothing is censored and the firehose is always one
  notch away. Mechanically the same move as dedup (both thin the calm default, both
  undone by zooming to raw), which is why it sits inside the no-editorial law, not
  against it. Exact cap = a build-tuning number (`DESIGN.md`, equal weight).

## Free vs paid (accountless)

- **Free front door:** the whole deduplicated public wire, chronological, finishable —
  plus mute, the command bar, and shareable view URLs. The average person reading the
  press, caught up, then gone. ~$0 to serve.
- **Paid power tier (license key, no account):** pin sources, add your own RSS feeds
  (via the proxy), larger archive, optional sync via your own store. The intuitive core
  stays free; power features unlock with a key cached in `localStorage`
  (`ARCHITECTURE.md` §7–8).
