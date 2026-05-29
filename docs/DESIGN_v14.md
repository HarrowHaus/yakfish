# wire — design system (v=14)

A manual for what wire is, what its surfaces do, and how to add things without breaking the discipline.

---

## The principle

Take something intrusive and useful — a refresh button, a status indicator, a category nav, a clock, a settings panel — and reduce it until it is no longer recognizable as that thing, but still does its work, inside the design language wire already has.

When asking whether wire should add a feature, ask first: can it ride on a surface that already exists? If yes — ride. If no, and only if no, consider whether the feature is actually needed.

---

## The materials

Two faces, multi-axis state, one chromatic variable, one substrate.

**Typography.**
- **Recursive Variable** — wordmark, filter input, timestamps, sources, anything interactive. Wire's wordmark coordinates: `wght=620, CASL=0.85, MONO=0, slnt=0`. Wire's mono coordinates: `wght=400, CASL=0, MONO=1, slnt=0`. Identity is the axis configuration, not the face name.
- **Atkinson Hyperlegible** — headlines and body. Static. Legibility-engineered.

The wordmark's axes are a state-display surface. Five variable axes become five additional channels of design language alongside `--dim`.

**Color.** One CSS variable `--dim` ∈ [0, 1] drives the entire palette via eighteen OKLCH-interpolated keyframes. All hues are mixed from the current state of four values: `--bg`, `--ink`, `--mute`, `--signal`.

**Texture.** SVG `feTurbulence` rendered as a 6% soft-light overlay. Mutates with `--dim` bucket, ages with `--grain-age` across the fetch cycle and with scroll depth into the buffer.

**Layout.** Vanilla HTML, vanilla CSS, vanilla JavaScript. No build step. No framework. No bundler.

**Fluid scale.** All sizes and spacing use `clamp()` interpolation between viewport widths 360px and 1240px (Utopia.fyi method). No breakpoints. Continuous adaptation from mobile to desktop.

---

## The surfaces

### 1. The wordmark

Sticky at the top of the page, always visible, always functional. Functions as masthead, refresh control, filter opener, focus-mode toggle.

**Interactions.**
- Tap → manual refetch + smooth-scroll to top (one intent: take me to the freshest, at the top).
- Double-tap → focus the filter input.
- Long-press (500ms+) → enter focus mode. All non-content surfaces fade. Tap anywhere to exit.

**State channels via Recursive axes.**
- `--word-wght`: weight. 620 at rest. Oscillates 620↔540 over 1.4s during a fetch (the "thinking" pulse). Drifts toward 540 on sustained fetch failure.
- `--word-casl`: casual. 0.85 at rest. Spikes to 1.0 momentarily on long-press, eases back. Goes to 0.6 in focus mode.
- `--word-slnt`: slant. 0 at rest. Tracks scroll velocity — scroll fast and the wordmark leans -3°, returns upright over 240ms.
- Color: tracks the time-of-day of the topmost visible article. Pure CSS scroll-driven animation via `animation-timeline: scroll()`.

The wordmark's hue + the wordmark's color + the wordmark's weight together carry: scroll position in time, fetch state, error state, focus state. Six visible state channels on one element.

### 2. The chromatic bar

Sticky directly below the wordmark. The full `--dim` spectrum rendered as a 4px hairline rule with the chromatic gradient as its substance. No notches at rest. The bar IS the legend; the page background is the cursor.

**Interactions.**
- Drag anywhere on the bar → adjust `--dim`.
- Tap → adjust `--dim` to that position.
- On any touch → a single vertical light materializes at the current `--dim` position (scale-X 0→1 over 180ms), persists while held, dissolves over 320ms on release.

The bar is the editor. The page is the surface being edited.

### 3. The filter input

A Recursive monospace caret to the right of the wordmark. Configurations:
- Plain text → fuzzy match across headlines, sources, sections.
- `@<host>` → filter by source.
- `@<section>` → filter by category.
- `@saved` → show only saved articles.
- `Esc` → clear.

### 4. The vertical scroll slider

Right edge, full viewport height, invisible at rest.

**Visibility triggers.**
- Fetch breath: opacity oscillates 0 → 0.18 → 0 over 1.4s, synchronized with the wordmark's weight breath. Once per POLL_MS.
- Scroll input: opacity 0.4 for 800ms after the last scroll event, then fades.
- Active drag: opacity 0.6.

**Chromatic mapping.** The slider's gradient maps the full 26-hour news buffer to chromatic keyframe positions. Top = newest articles = current `--time-of-day`. Bottom = ~26h back = the chromatic position of that earlier time-of-day. The thumb's position is the user's scroll depth in time-space.

Drag the thumb → page scrolls to corresponding position. As the user scrolls, the wordmark color (tracking topmost visible article's time-of-day) updates in sync with the thumb position. Color and thumb position are the same state on two surfaces.

### 5. Each article

A single `<article>` carrying its headline, sources, and timestamp.

**Interactions.**
- Tap headline or source → open the original in a new tab.
- Long-press (500ms+) → toggle save state.

**State.**
- **Read** — articles previously opened render ~8% reduced saturation and ~4% reduced opacity on subsequent sessions. Persisted in `localStorage`.
- **Saved** — a 4px tall, 1px wide `--signal` hairline in the left margin.
- **New since last visit** — single signal-color pulse traverses the headline left-to-right, once, on first paint of the session.
- **Chromatic time-tint** — each article's source line carries a signal-color tint at strength `1 - (age_hours / 24)`, clamped to 0. The most recent article: full tint. 24+ hours: no tint.
- **Timestamp casual decay** — each timestamp's Recursive `CASL` axis is set to `min(0.7, age_hours / 24)`. Fresh timestamps render in clinical monospace; old timestamps drift toward casual handwriting. Time degrades into the type itself.

### 6. The grain

The page's `feTurbulence` substrate.

**Behavior.**
- Mutates with `--dim` (seed and `baseFrequency` shift per 10% dim bucket).
- Ages with `--grain-age` across the fetch cycle. Resets to 0 with a 600ms ease on each successful fetch.
- Climbs past 1 on failed fetches; the page visibly degrades.
- After 2 consecutive failures, the wordmark's hue rotates ~4° toward muted, weight drifts to 540.

---

## The colophon

Revealed by pulling past the bottom of the article list (overscroll). Rises with the drag, opens fully when released past the threshold. Tap outside, pull back down, or press Esc to dismiss.

Also revealed by `?` keyboard shortcut.

Contents: about, font credits, the page rules (type to filter / drag the bar to dim / each line is one story across every host), keyboard shortcuts, touch gestures, filter sigils, RSS endpoint, "no tracking / no accounts / no ads."

---

## Pull-to-refresh

Standard iOS rubber-band gesture at the top of the page. Maps to the same action as tap-wordmark: refetch. Both available, no chrome added.

---

## Initial paint entrance

First visit only, no `localStorage.wire.visited` flag yet.

1.4s sequence:
- Wordmark fades in with Recursive weight interpolating 300 → 620 over 1.0s.
- Chromatic bar fills left-to-right over 800ms — all 18 OKLCH keyframes draw themselves into the rule.
- Articles cascade in 80ms apart (existing entrance animation).

Subsequent visits skip the entrance. The flag is set on first successful render.

---

## Keyboard

`/` focus filter · `Esc` clear filter · `j` / `k` next / previous article · `g g` scroll to top · `s` save focused article · `o` open focused article · `?` open colophon.

---

## What was removed (v=12 → v=14)

- **The top dim slider** — dissolved into the chromatic bar.
- **The wordmark pulse on fetch landing** — replaced by Recursive weight oscillation (more legible) and grain reset (page-wide).
- **The mid-dim tutorial state** — articles no longer fade at `dim=0.5`. The chromatic journey is continuous. Tutorial text moved to colophon.
- **The hour dividers** (9am, 10am rows) — articles now carry their time-state in both chromatic tint AND `CASL` axis.
- **Bagnard** — replaced by Recursive at wire's wordmark axis coordinates.
- **Iosevka** — replaced by Recursive at mono axis coordinates.
- **The `is-stale` wordmark class** — staleness shows in grain climbing and wordmark weight drifting.
- **"connecting…"** loading text — replaced by the initial paint entrance.
- **1-second-hold-on-bar to open colophon** — replaced by overscroll at bottom.

Net face count: 2 (was 3). Net typography file size: smaller (one variable file replaces two static face families).

---

## Rules for adding features

1. **Find the surface first.** Identify the surface where the feature should live. If no existing surface fits, the feature is probably not in scope.

2. **Reduce affordances to their function.** The element does the work; it should not announce itself doing the work.

3. **Express state through existing materials.** New states should be expressed via `--dim`, the Recursive axes (`wght`/`CASL`/`MONO`/`slnt`), the grain, or `--time-of-day`. Not via new visual elements.

4. **Visibility is earned by use.** Controls that are invisible at rest must surface themselves through synchronized motion (the wordmark breath driving the scroll slider opacity), through touch (the bar's vertical light on press), or through natural gesture (overscroll for colophon).

5. **Chrome IS content.** The visible properties of design elements ENCODE the state of the data. The wordmark color = time-of-day of visible articles. The bar gradient = the full chromatic journey, with the page bg pointing at the user's position. Per-article tints + timestamp casual = each article's time-relevance.

6. **No tracking, no accounts, no ads.** Persistent state lives in `localStorage` only.

7. **Vanilla.** No build pipeline. No framework. The fonts are local. Nothing depends on a network resource other than the news fetch.

---

## File map

```
public/
├── index.html      vanilla HTML
├── styles.css      Recursive @font-face, Utopia clamp() scales, all design language
├── app.js          all interaction logic
└── fonts/
    ├── Recursive-Variable.woff2
    └── AtkinsonHyperlegible-{Regular,Italic,Bold,BoldItalic}.woff2
lib/
└── build-news.js   backend aggregator, URL-only dedup
api/
└── news.js         Vercel serverless endpoint
netlify/functions/  Netlify serverless endpoint
server.mjs          local Node dev server
```

Two faces, three files for the page, vanilla. That's the discipline.
