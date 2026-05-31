/* yak.fish — the river, the dive, auto-dim (v=15)
 *
 * The river is a reach pager (no free-scroll, no momentum fling): you arrive at the
 * top of the new and descend a reach (a screenful) at a time toward the new/old line,
 * which is the floor. Crossing a reach marks those stories seen (reversible). The dive
 * opens a story to its hosts (only when >1 carried it) before leaving to the source in
 * a new tab. --dim is automatic from the local clock; adjust by dragging the wordmark
 * (transient, session-scoped, never persisted). ALL motion is gated by prefers-
 * reduced-motion. See PRODUCT.md / DESIGN.md.
 */

(() => {
  'use strict';

  const ENDPOINTS = ['cache/latest.json', '/api/news', '/.netlify/functions/news', 'cache/news.json'];
  const POLL_MS = 180_000;   // calm cadence; conditional GET makes most polls cheap 304s
  const BUFFER_HOURS = 26;
  const STOP = new Set(['the','a','an','live','update','updates','breaking','and','of','in','on','to','for']);

  /* Granularity = ALTITUDE, continuous, not a dial (DESIGN/DECISIONS 2026-05-30 lock).
     One scalar `state.altitude` ∈ [0,1]: 0 = ITEMS (reading distance, default) ·
     1 = DENSITY (pulled back — the time-shape of the window). ECHOES is off this axis
     (it is the dive). The old raw/stories/threads rungs are retired. */
  const ALT_SNAP = 0.5;       // release snaps to the nearer pole
  const ALT_HYST = 0.05;      // dead-band around the snap to stop flip-thrash mid-pinch
  const PINCH_K = 2;          // pinch sensitivity: ~1.4× spread spans the full altitude

  /* Reach-traverse tuning (in-hand feel; OPEN_QUESTIONS A). */
  const DRAG_SLOP = 8;        // px before a press becomes a drag
  const LONG_MS = 500;        // long-press → save / mute
  const DAMP = 0.6;           // drag resistance (no momentum carry)
  const REACH_OVERLAP = 0.12; // context carried between reaches

  /* The circadian curve — the BAKED OKLCH anchors from DESIGN.md (the output of the
     build-time Planckian + appearance-model derivation). The runtime is a lean one-
     scalar engine: it color-mixes between the two anchors bracketing the clock hour.
     No color library on the page. Field hue stays warm + low-chroma; every RESTING
     anchor holds ΔL ≥ ~0.55. The polarity flips (light-on-dark night ↔ dark-on-light
     day) happen FAST between anchors via a steep easing (see `ease`), so no hour rests
     in the lightness dead zone (~0.40–0.68). The accent is a baked per-anchor COOL
     counterpoint (the one licensed note of chroma), used only on interactivity, and is
     interpolated on the same --t. Hours wrap 22→02. */
  const ANCHORS = [
    { h: 2.0,  bg: 'oklch(0.16 0.020 62)', ink: 'oklch(0.80 0.016 72)', accent: 'oklch(0.68 0.050 198)' }, // deep night ~2200K
    { h: 5.5,  bg: 'oklch(0.20 0.026 56)', ink: 'oklch(0.82 0.018 66)', accent: 'oklch(0.70 0.080 210)' }, // dawn ~2700K (accent bluest)
    { h: 9.0,  bg: 'oklch(0.94 0.012 92)', ink: 'oklch(0.26 0.012 82)', accent: 'oklch(0.48 0.130 232)' }, // morning ~5000K warm paper
    { h: 12.5, bg: 'oklch(0.96 0.008 94)', ink: 'oklch(0.23 0.008 84)', accent: 'oklch(0.46 0.150 236)' }, // midday ~5500K (peak ΔL, accent vivid)
    { h: 15.5, bg: 'oklch(0.90 0.018 82)', ink: 'oklch(0.27 0.014 76)', accent: 'oklch(0.48 0.120 222)' }, // afternoon ~4500K (the lean)
    { h: 19.0, bg: 'oklch(0.85 0.032 72)', ink: 'oklch(0.28 0.020 62)', accent: 'oklch(0.50 0.110 196)' }, // golden dusk ~3000K (warm/cool duet, P3 reach)
    { h: 22.0, bg: 'oklch(0.25 0.028 60)', ink: 'oklch(0.82 0.020 70)', accent: 'oklch(0.66 0.060 200)' }  // evening ~2400K (diminuendo)
  ];
  // Append the wrap anchor (next-day deep night at h+24) so 22:00→02:00 interpolates.
  const ANCH = [...ANCHORS, { ...ANCHORS[0], h: ANCHORS[0].h + 24 }];

  // smootherstep — flat at the anchors, STEEP through the middle. This is what makes the
  // polarity flip whip across the lightness dead zone fast (timed to the segment middle,
  // ≈ sunrise/sunset) instead of resting in the unreadable gray. (Fixes dawn ΔL≈0.14.)
  const ease = (f) => (f <= 0 ? 0 : f >= 1 ? 1 : f * f * f * (f * (f * 6 - 15) + 10));

  const state = {
    endpoint: null,
    query: '',
    altitude: 0,            // 0 = items (default) … 1 = density; continuous, set by pinch/keys
    stratum: 'items',       // the currently-RENDERED stratum ('items' | 'density'), with hysteresis
    updatedAt: null,
    isFetching: false,
    dimHour: 12,            // the hour the page is painted at (auto = local clock)
    dimOverridden: false,   // session-scoped manual scrub; never persisted
    firstRendered: false,
    isFocusMode: false,
    isColophonOpen: false,
    focusedIdx: -1,
    keySequence: '',
    keySeqTimer: null,
    stories: new Map(),
    pending: new Map(),       // new arrivals HELD at the now-edge; folded in only on pull-to-now
    pendingUpdatedAt: null,
    validators: {},           // per-endpoint { etag, lastModified } for conditional GET
    entries: [],
    reaches: [0],
    reachIndex: 0,
    newOldOffset: null,
    lineReachIndex: null,
    diveId: null,
    readSet: new Set(),
    savedSet: new Set(),
    markedByTraverse: new Set(),
    lastVisitISO: null
  };

  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const buzz = (ms) => { if (!reduced()) { try { navigator.vibrate && navigator.vibrate(ms); } catch (_) {} } };

  /* ---------- text helpers ---------- */

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFKD')
      .replace(/[̀-ͯ]/g, '').replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').split(' ').filter((w) => w && !STOP.has(w)).join(' ').trim();
  }
  function cleanTitle(title) {
    const t = String(title || '').replace(/\s+[\-\|–—]\s+[^\-\|–—]{1,60}$/, '').trim();
    return t || String(title || '') || '(untitled)';
  }
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function fmtTime(iso) {
    if (!iso) return '';
    try { return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso)); }
    catch { return ''; }
  }
  function fmtHour(t) {   // the density axis landmark: just the hour, e.g. "9 PM"
    try { return new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).format(new Date(t)); }
    catch { return ''; }
  }
  const tms = (iso) => { const t = new Date(iso).getTime(); return Number.isFinite(t) ? t : 0; };

  /* ---------- localStorage (session dim is NOT persisted) ---------- */

  function migrateStorage() {
    try {
      if (localStorage.getItem('yakfish.migrated') === '1') return;
      for (const k of ['dim', 'read', 'saved', 'lastVisit', 'visited']) {
        const oldVal = localStorage.getItem('wire.' + k);
        if (oldVal !== null && localStorage.getItem('yakfish.' + k) === null) localStorage.setItem('yakfish.' + k, oldVal);
        localStorage.removeItem('wire.' + k);
      }
      localStorage.setItem('yakfish.migrated', '1');
    } catch (_) {}
  }
  // Intrinsic per-user state: the tide (read/seen), saved, and last-visit. Save is back
  // (2026-05-31 revision) as one of two directional swipe marks (the other is share).
  // Mute stays CUT — the automatic flood-cap + positive filter cover source dominance.
  function loadPersisted() {
    try { const r = localStorage.getItem('yakfish.read');  if (r) state.readSet  = new Set(JSON.parse(r)); } catch (_) {}
    try { const s = localStorage.getItem('yakfish.saved'); if (s) state.savedSet = new Set(JSON.parse(s)); } catch (_) {}
    try { state.lastVisitISO = localStorage.getItem('yakfish.lastVisit'); } catch (_) {}
  }
  function persistRead()  { try { const a = [...state.readSet].slice(-1000); state.readSet = new Set(a); localStorage.setItem('yakfish.read', JSON.stringify(a)); } catch (_) {} }
  function persistSaved() { try { localStorage.setItem('yakfish.saved', JSON.stringify([...state.savedSet])); } catch (_) {} }
  function persistVisit() { try { localStorage.setItem('yakfish.lastVisit', new Date().toISOString()); } catch (_) {} }

  /* ---------- dim / chromatic — continuous circadian curve off the local clock ----------
     The page background IS the dim state. Only bg + ink are set here (color), never any
     layout metric — so a day-scrub can never reflow under the finger. ink/mute/signal/
     borders derive from --bg/--ink in CSS via relative color; the runtime just picks the
     two baked anchors bracketing the hour and color-mixes them. */

  const clockHour = () => { const n = new Date(); return n.getHours() + n.getMinutes() / 60; };
  const mix = (a, b, f) => `color-mix(in oklch, ${a}, ${b} ${(clamp(f, 0, 1) * 100).toFixed(1)}%)`;

  function dimColors(hour) {
    let hh = ((hour % 24) + 24) % 24;       // normalise to [0,24)
    if (hh < ANCH[0].h) hh += 24;           // wrap pre-dawn hours into the 22→26 segment
    for (let i = 0; i < ANCH.length - 1; i++) {
      const a = ANCH[i], b = ANCH[i + 1];
      if (hh >= a.h && hh <= b.h) {
        const f = ease((hh - a.h) / (b.h - a.h));   // steep through the middle
        return { bg: mix(a.bg, b.bg, f), ink: mix(a.ink, b.ink, f), accent: mix(a.accent, b.accent, f) };
      }
    }
    return { bg: ANCHORS[0].bg, ink: ANCHORS[0].ink, accent: ANCHORS[0].accent };
  }

  // Paint the page at a given clock hour. --t (0→1 day phase) is the single scalar; the
  // wordmark and the scrub track read it. Color only — no layout touched. --signal is the
  // baked cool accent (not derived from ink): a circadian counterpoint for interactivity.
  function applyDim(hour) {
    state.dimHour = hour;
    const { bg, ink, accent } = dimColors(hour);
    root.style.setProperty('--bg', bg);
    root.style.setProperty('--ink-auto', ink);
    root.style.setProperty('--signal', accent);
    root.style.setProperty('--t', ((((hour % 24) + 24) % 24) / 24).toFixed(4));
  }

  /* ---------- wordmark: tap / double-tap / long-press / drag-to-dim ---------- */

  function bindWordmark() {
    const word = $('word');
    const track = $('dim-track');
    if (!word) return;
    let pressed = false, pressTimer = null, pendingTap = null, lastTap = 0;
    let didLong = false, dragging = false, startX = 0, baseHour = 0;

    word.addEventListener('pointerdown', (e) => {
      pressed = true; didLong = false; dragging = false;
      startX = e.clientX; baseHour = state.dimHour;
      word.classList.add('is-pressing');
      try { word.setPointerCapture(e.pointerId); } catch (_) {}
      pressTimer = setTimeout(() => {
        if (pressed && !dragging) { didLong = true; word.classList.remove('is-pressing'); toggleFocusMode(); }
      }, LONG_MS);
      e.preventDefault();
    });

    word.addEventListener('pointermove', (e) => {
      if (!pressed) return;
      const dx = e.clientX - startX;
      if (!dragging && Math.abs(dx) > DRAG_SLOP) {
        dragging = true; clearTimeout(pressTimer);
        word.classList.remove('is-pressing'); word.classList.add('is-dimming');
        document.documentElement.classList.add('is-scrubbing');   // live, no tween under the finger
        track.classList.add('is-active');
      }
      if (dragging) {
        // Horizontal because it is TIME, and time reads horizontally: left ← dawn,
        // right → night. Full window width ≈ one full day of scrub.
        let h = baseHour + (dx / Math.max(320, window.innerWidth)) * 24;
        // Felt detent: snap to the live clock hour when close (hands control back).
        const ch = clockHour();
        let delta = ((h - ch + 12) % 24 + 24) % 24 - 12;
        const snapped = Math.abs(delta) < 0.35;
        if (snapped) h = ch;
        applyDim(h);
        state._scrubSnapped = snapped;
      }
    });

    function end(e) {
      if (!pressed) return;
      pressed = false; clearTimeout(pressTimer);
      try { word.releasePointerCapture(e.pointerId); } catch (_) {}
      word.classList.remove('is-pressing', 'is-dimming');
      if (dragging) {
        track.classList.remove('is-active');
        document.documentElement.classList.remove('is-scrubbing');
        dragging = false;
        // Snapping to the clock hands control back to automatic (no "return" button needed).
        state.dimOverridden = !state._scrubSnapped;
        return; // session-scoped, NEVER persisted
      }
      if (didLong) return;
      const now = Date.now();
      const dbl = (now - lastTap) < 320;
      lastTap = now;
      if (dbl) {
        clearTimeout(pendingTap);
        if (state.isFocusMode) toggleFocusMode();
        $('prompt').focus();
      } else {
        pendingTap = setTimeout(() => { pullToNow(); }, 280);   // tap = pull to now (fold held arrivals)
      }
    }
    word.addEventListener('pointerup', end);
    word.addEventListener('pointercancel', () => {
      pressed = false; dragging = false; clearTimeout(pressTimer);
      word.classList.remove('is-pressing', 'is-dimming'); track.classList.remove('is-active');
    });
    word.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function toggleFocusMode() {
    state.isFocusMode = !state.isFocusMode;
    document.body.classList.toggle('is-focus-mode', state.isFocusMode);
    render();
  }

  /* ---------- filter / command surface ---------- */

  function bindPrompt() {
    const input = $('prompt');
    input.addEventListener('input', (e) => { state.query = e.target.value; state.diveId = null; render(); updateHash(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); runCommand(input); }
      else if (e.key === 'Escape') { e.preventDefault(); input.value = ''; state.query = ''; render(); updateHash(); input.blur(); }
    });
    // Type-anywhere → focus the filter (parity with v14).
    document.addEventListener('keydown', (e) => {
      if (document.activeElement === input) return;
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select', 'button'].includes(tag)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (state.isColophonOpen) return;
      if ([' ', 'j', 'k', 'g', 's', 'o', '?', '/', '+', '=', '-', '_'].includes(e.key)) return; // reach/depth/save keys
      if (e.key === 'Escape') { if (state.query) { input.value = ''; state.query = ''; render(); updateHash(); e.preventDefault(); } return; }
      if (e.key.length === 1) { input.focus(); input.value += e.key; state.query = input.value; render(); updateHash(); e.preventDefault(); }
    });
  }

  // Enter applies the typed free-text filter. (Granularity is altitude — a gesture, not a
  // typed `zoom` command, which is retired; there is no mute either — DECISIONS.md
  // 2026-05-30/31. Source dominance is the automatic flood-cap + positive filter.)
  function runCommand(input) {
    state.query = input.value.trim();
    render(); updateHash();
  }

  /* ---------- altitude (continuous granularity) ----------
     A single scalar `state.altitude` ∈ [0,1] (0 = items, 1 = density). The pinch (mobile)
     and +/- keys / double-click / ctrl-wheel (desktop) move it. Crossing the snap (with a
     dead-band to stop thrash) flips the RENDERED stratum, holding the line at the gesture
     centroid stable (both strata are time-ordered newest→top, so the story under the finger
     keeps its place). ECHOES is the dive — off this axis. */

  // The single entry point every altitude control funnels through. Returns true if the
  // rendered stratum flipped (so callers can buzz / relabel).
  function setAltitude(a, centroidY) {
    state.altitude = clamp(a, 0, 1);
    const cur = state.stratum;
    let next = cur;
    if (cur === 'items'   && state.altitude >= ALT_SNAP + ALT_HYST) next = 'density';
    else if (cur === 'density' && state.altitude <= ALT_SNAP - ALT_HYST) next = 'items';
    if (next === cur) return false;

    // Capture the centroid story BEFORE the re-render, to hold it stable across the flip.
    let anchorId = null, anchorScreenY = 0;
    if (centroidY != null) {
      const el = nodeAtScreenY(centroidY);
      if (el) { anchorId = el.getAttribute('data-story'); anchorScreenY = el.getBoundingClientRect().top; }
    }
    flagMerge();
    state.stratum = next; state.diveId = null;
    render();
    if (anchorId) {
      const el = $('river').querySelector(`[data-story="${anchorId}"]`);
      if (el) {
        const streamTop = $('stream').getBoundingClientRect().top;
        const maxOffset = state.reaches[state.reaches.length - 1] || 0;
        const y = clamp(el.offsetTop - (anchorScreenY - streamTop), 0, maxOffset);
        setRiverY(y);
        let best = 0, bd = Infinity;
        state.reaches.forEach((r, i) => { const d = Math.abs(r - y); if (d < bd) { bd = d; best = i; } });
        state.reachIndex = best;
      }
    }
    updateHash();
    return true;
  }
  // Explicit poles for keys / double-click / a density tap (descend to reading distance).
  function toItems(centroidY)   { return setAltitude(0, centroidY); }
  function toDensity(centroidY) { return setAltitude(1, centroidY); }

  // The nearest item element (article OR density mark) at a screen-y; both carry data-story.
  function nodeAtScreenY(y) {
    const r = $('stream').getBoundingClientRect();
    const el = document.elementFromPoint((r.left + r.right) / 2, clamp(y, r.top + 1, r.bottom - 1));
    return el ? el.closest('[data-story]') : null;
  }

  // Transient altitude label — surfaces only DURING a gesture, dissolves on release (the same
  // no-at-rest pattern as the dim day-scrub). Nothing at rest.
  function showDepth(text) { const el = $('depth-label'); if (el) { el.textContent = text; el.classList.add('is-active'); } }
  function hideDepth() { const el = $('depth-label'); if (el) el.classList.remove('is-active'); }

  // The merge cue: a brief settle on the river (reduced-motion: instant, in CSS).
  function flagMerge() {
    const river = $('river');
    river.classList.remove('merging'); void river.offsetWidth; river.classList.add('merging');
    setTimeout(() => river.classList.remove('merging'), 320);
  }

  /* ---------- URL view-state (filter + altitude; never read/saved) ---------- */

  function updateHash() {
    const p = new URLSearchParams();
    if (state.query.trim()) p.set('q', state.query.trim());
    if (state.stratum === 'density') p.set('alt', 'density');   // only the non-default stratum
    const h = p.toString();
    try { history.replaceState(null, '', h ? '#' + h : location.pathname + location.search); } catch (_) {}
  }
  function readHash() {
    try {
      const p = new URLSearchParams(location.hash.replace(/^#/, ''));
      if (p.get('alt') === 'density') { state.stratum = 'density'; state.altitude = 1; }
      if (p.get('q')) { state.query = p.get('q'); const i = $('prompt'); if (i) i.value = state.query; }
    } catch (_) {}
  }

  /* ---------- fetch / ingest ---------- */

  // Conditional GET: no cache-buster, no no-store — we manage freshness with validators.
  // We store the response's ETag / Last-Modified and send them back as If-None-Match /
  // If-Modified-Since, so an unchanged file returns a cheap 304 (no body, no work).
  async function tryFetch(ep) {
    const headers = { accept: 'application/json' };
    const v = state.validators[ep];
    if (v) {
      if (v.etag) headers['If-None-Match'] = v.etag;
      if (v.lastModified) headers['If-Modified-Since'] = v.lastModified;
    }
    const res = await fetch(ep, { headers });
    if (res.status === 304) return { notModified: true, endpoint: ep };
    if (!res.ok) throw new Error(`${ep} ${res.status}`);
    const etag = res.headers.get('etag');
    const lastModified = res.headers.get('last-modified');
    state.validators[ep] = { etag, lastModified };
    const data = await res.json();
    if (!Array.isArray(data.stories)) throw new Error(`${ep} no stories`);
    return { data, endpoint: ep };
  }
  async function pull() {
    const ordered = state.endpoint ? [state.endpoint, ...ENDPOINTS.filter((e) => e !== state.endpoint)] : ENDPOINTS;
    for (const ep of ordered) { try { return await tryFetch(ep); } catch (_) {} }
    return null;
  }
  function ingest(data) {
    const cutoff = Date.now() - BUFFER_HOURS * 3600_000;
    for (const s of data.stories || []) {
      if (!s || !s.id) continue;
      const t = tms(s.time);
      if (t && t < cutoff) continue;
      state.stories.set(s.id, s);
    }
    state.updatedAt = data.updatedAt || new Date().toISOString();
  }

  // Stories in a fresh payload that the reader is not already seeing (and not aged out).
  function newStories(data) {
    const cutoff = Date.now() - BUFFER_HOURS * 3600_000;
    const out = [];
    for (const s of data.stories || []) {
      if (!s || !s.id || state.stories.has(s.id) || state.pending.has(s.id)) continue;
      const t = tms(s.time);
      if (t && t < cutoff) continue;
      out.push(s);
    }
    return out;
  }
  // Fold the held now-edge arrivals into the live river (only on an explicit pull-to-now).
  function foldPending() {
    if (!state.pending.size) return false;
    const cutoff = Date.now() - BUFFER_HOURS * 3600_000;
    for (const [id, s] of state.pending) state.stories.set(id, s);
    for (const [id, r] of state.stories) if (tms(r.time) < cutoff) state.stories.delete(id);
    if (state.pendingUpdatedAt) state.updatedAt = state.pendingUpdatedAt;
    state.pending.clear(); state.pendingUpdatedAt = null;
    return true;
  }

  /* ---------- build render entries (filter → zoom → new/old) ---------- */

  // No mute (DECISIONS.md 2026-05-30): every source is visible; dominance is shaped only
  // by the build-side flood-cap. Kept as a seam so call sites read intent.
  function storyVisibleSources(s) { return s.sources; }

  function matchesFilter(s, sources) {
    const q = state.query.trim().toLowerCase();
    if (!q || /^(zoom|>)/.test(q)) return true;
    if (q === '@saved') return state.savedSet.has(s.id);
    if (q.startsWith('@')) {
      const term = q.slice(1); if (!term) return true;
      if ((s.section || '').toLowerCase().includes(term)) return true;
      return sources.some((src) => (src.host || '').toLowerCase().includes(term) || (src.name || '').toLowerCase().includes(term));
    }
    const hay = `${s.headline || ''} ${s.section || ''} ${sources.map((x) => x.name + ' ' + x.host).join(' ')}`.toLowerCase();
    return hay.includes(q);
  }

  function buildEntries() {
    const visible = [];
    for (const s of state.stories.values()) {
      const sources = storyVisibleSources(s);
      if (!sources.length) continue;
      if (!matchesFilter(s, sources)) continue;
      if (state.isFocusMode) {
        const lv = state.lastVisitISO ? tms(state.lastVisitISO) : 0;
        if (lv && (tms(s.time) <= lv || state.readSet.has(s.id))) continue;
      }
      visible.push({ s, sources });
    }
    visible.sort((a, b) => tms(b.s.time) - tms(a.s.time));

    // One entry per story (the item). Both strata consume this same list — ITEMS renders
    // each as a line, DENSITY as a time-positioned tick. (No raw/threads rungs.)
    const entries = [];
    for (const { s, sources } of visible) {
      entries.push({ id: s.id, storyId: s.id, headline: s.headline, time: s.time,
        section: s.section, sources, primaryUrl: sources[0].url, depth: sources.length });
    }
    return entries;
  }

  /* ---------- render (branches on altitude stratum) ---------- */

  function render() {
    state.entries = buildEntries();
    const river = $('river');
    river.innerHTML = (state.stratum === 'density') ? densityHTML() : itemsHTML();

    if (!state.firstRendered && state.entries.length) {
      state.firstRendered = true;
      river.classList.add('first-load');
      setTimeout(() => river.classList.remove('first-load'), 1800);
    }

    layoutReaches();
    goToReach(clamp(state.reachIndex, 0, state.reaches.length - 1), false);
    updateStatus();
  }

  // ITEMS (reading distance) — one line per event, order-spaced, per-line time as the
  // landmark; the new/old line and finishable floor as before.
  function itemsHTML() {
    const lv = state.lastVisitISO ? tms(state.lastVisitISO) : 0;
    let boundary = -1;
    if (lv) { for (let i = 0; i < state.entries.length; i++) { if (tms(state.entries[i].time) <= lv) { boundary = i; break; } } }
    if (state.entries.length === 0) return `<p class="empty">${state.stories.size === 0 ? '' : 'no matches'}</p>`;
    const parts = [];
    state.entries.forEach((e, i) => {
      if (i === boundary && boundary > 0) parts.push(`<div class="newold is-floor" data-line="1"><span>new / old — caught up</span></div>`);
      parts.push(renderEntry(e));
    });
    const caught = boundary === 0 || state.entries.every((e) => state.readSet.has(e.storyId) || (lv && tms(e.time) <= lv));
    parts.push(`<div class="floor">${caught ? "you're caught up — nothing newer" : "— the bottom —"}</div>`);
    return parts.join('');
  }

  // DENSITY (pulled back) — the WHOLE window's rhythm in one screen. Vertical axis = time
  // (newest top), each story a thin EQUAL-WEIGHT translucent tick at its time-position so
  // overlaps accumulate into a smooth gradient (busy hour = dark band, quiet = sparse). No
  // per-item text (the content IS the temporal distribution); persistent hour labels + the
  // tide line are the time landmark. Tap a mark → descend to items at that time.
  function densityHTML() {
    const E = state.entries;
    if (!E.length) return `<p class="empty">${state.stories.size === 0 ? '' : 'no matches'}</p>`;
    const vh = viewportH();
    const PAD = 26;                                   // room for the "now" / "floor" / labels
    let H = vh;                                        // aim: the whole window in ~1 screen…
    const tNew = tms(E[0].time);
    const tOld = tms(E[E.length - 1].time);
    const span = Math.max(1, tNew - tOld);
    const lv = state.lastVisitISO ? tms(state.lastVisitISO) : 0;

    // Hour-label interval chosen so labels stay legible (≥ ~44px apart); widen to ~1.2
    // screens only if even the coarsest sane interval would crowd (the fallback).
    const hours = span / 3.6e6;
    const steps = [1, 2, 3, 6, 12];
    let stepH = steps.find((s) => (H - 2 * PAD) / (hours / s) >= 44) || 12;
    if ((H - 2 * PAD) / (hours / stepH) < 38) H = Math.round(vh * 1.2);
    const y = (t) => PAD + (tNew - t) / span * (H - 2 * PAD);

    const parts = [`<div class="density" style="height:${H}px">`];
    // persistent hour labels + faint gridlines (time = the landmark at this altitude)
    const startHr = Math.ceil(tOld / 3.6e6) * 3.6e6;
    for (let t = startHr; t <= tNew; t += stepH * 3.6e6) {
      if ((t / 3.6e6) % stepH !== 0) continue;
      parts.push(`<div class="hour-line" style="top:${y(t).toFixed(1)}px"></div>`);
      parts.push(`<div class="hour-label" style="top:${y(t).toFixed(1)}px">${esc(fmtHour(t))}</div>`);
    }
    // the tide (new/old) line, at its own time-position
    if (lv && lv > tOld && lv < tNew) parts.push(`<div class="density-tide" data-line="1" style="top:${y(lv).toFixed(1)}px"><span>new / old</span></div>`);
    // one equal-weight tick per story (translucent → accumulates)
    for (const e of E) {
      parts.push(`<div class="mark" data-id="${esc(e.id)}" data-story="${esc(e.storyId)}" data-time="${esc(e.time)}" style="top:${y(tms(e.time)).toFixed(1)}px"></div>`);
    }
    parts.push(`<div class="density-floor">${E.length} in the window · caught up below</div>`);
    parts.push(`</div>`);
    return parts.join('');
  }

  function renderEntry(e) {
    const head = cleanTitle(e.headline);
    const time = fmtTime(e.time);
    // Item state: the tide (read/seen) and saved (the keep mark, restored 2026-05-31).
    const isRead = state.readSet.has(e.storyId);
    const isSaved = state.savedSet.has(e.storyId);
    const cls = [isRead ? 'is-read' : '', isSaved ? 'is-saved' : ''].filter(Boolean).join(' ');
    const firstHost = e.sources[0] ? esc(e.sources[0].host) : '';

    // Depth (host count) is FELT through the dive, never displayed as a count/badge
    // (PRODUCT.md, DESIGN.md equal weight). The hosts panel only appears on a dive tap.
    let hosts = '';
    if (e.depth > 1) {
      const links = e.sources.map((src) =>
        `<a class="host-link" href="${esc(src.url)}" target="_blank" rel="noopener noreferrer" data-url="${esc(src.url)}" data-host="${esc(src.host)}">${esc(src.name || src.host)}</a>`
      ).join('');
      hosts = `<div class="hosts"><div class="hosts-label">${e.depth} hosts carried this — tap one to leave</div>${links}</div>`;
    }

    // Time/host are DATA (MONO 1 via CSS). Headline is reading text (Atkinson). No axis
    // animates; recency is carried by chronological position, not a decaying tint.
    return `<article class="${cls.trim()}" data-id="${esc(e.id)}" data-story="${esc(e.storyId)}" data-time="${esc(e.time)}">
<h2><a class="head" href="${esc(e.primaryUrl)}" target="_blank" rel="noopener noreferrer">${esc(head)}</a></h2>
<div class="src"><span class="t">${esc(time)}</span><span class="sep">·</span><span class="host">${esc(firstHost)}</span></div>
${hosts}
</article>`;
  }

  function updateStatus() {
    // No source-health on the surface (Phase 3 removal). Quiet count + time only.
    const n = state.entries.length;
    const up = fmtTime(state.updatedAt);
    $('status').textContent = n ? `${n} in the river${up ? ' · updated ' + up : ''}` : '—';
  }

  /* ---------- reach pager ---------- */

  function viewportH() { return $('stream').clientHeight || window.innerHeight; }

  function layoutReaches() {
    const river = $('river');
    const arts = [...river.children];
    const vh = viewportH();
    const riverH = river.scrollHeight;
    const maxOffset = Math.max(0, riverH - vh);
    const step = vh * (1 - REACH_OVERLAP);
    const reaches = [0];
    let guard = 0;
    while (reaches[reaches.length - 1] < maxOffset && guard++ < 500) {
      const target = reaches[reaches.length - 1] + step;
      // Snap each reach boundary to the top of the first article crossing it (no clipped headlines).
      let next = target;
      for (const el of arts) { if (el.offsetTop >= target - 4) { next = el.offsetTop; break; } }
      if (next <= reaches[reaches.length - 1] + 4) next = Math.min(maxOffset, reaches[reaches.length - 1] + step);
      reaches.push(Math.min(next, maxOffset));
      if (reaches[reaches.length - 1] >= maxOffset) break;
    }
    state.reaches = reaches;

    // The new/old line offset + the reach where the old (seen) side begins (the floor detent).
    const lineEl = river.querySelector('[data-line]');
    if (lineEl) {
      state.newOldOffset = lineEl.offsetTop;
      let li = 0; for (let i = 0; i < reaches.length; i++) { if (reaches[i] >= state.newOldOffset - 4) { li = i; break; } li = i; }
      state.lineReachIndex = li;
    } else { state.newOldOffset = null; state.lineReachIndex = null; }
  }

  function setRiverY(px) { root.style.setProperty('--river-y', String(Math.round(px))); }

  function goToReach(i, animate) {
    const last = state.reaches.length - 1;
    i = clamp(i, 0, last);
    const prev = state.reachIndex;
    state.reachIndex = i;
    const river = $('river');
    if (!animate || reduced()) river.style.transition = 'none'; else river.style.transition = '';
    setRiverY(state.reaches[i]);
    if (!animate || reduced()) { void river.offsetWidth; river.style.transition = ''; }
    markSeenThrough(state.reaches[i]);
    if (i !== prev && animate) buzz(state.lineReachIndex != null && i === state.lineReachIndex ? 16 : 8);
  }

  // Optimistic, reversible seen-marking: stories scrolled above the viewport top are
  // seen; dragging back up un-marks those this traverse added (never a confirm prompt).
  function markSeenThrough(topPx) {
    let changed = false;
    for (const el of $('river').querySelectorAll('article')) {
      const id = el.getAttribute('data-story');
      if (!id) continue;
      const above = el.offsetTop + el.offsetHeight <= topPx + 2;
      if (above && !state.readSet.has(id)) { state.readSet.add(id); state.markedByTraverse.add(id); el.classList.add('is-read'); changed = true; }
      else if (!above && state.markedByTraverse.has(id)) { state.readSet.delete(id); state.markedByTraverse.delete(id); el.classList.remove('is-read'); changed = true; }
    }
    if (changed) persistRead();
  }

  function advance(firm) {
    const last = state.reaches.length - 1;
    if (state.reachIndex >= last) { openColophon(); return; }     // push past the floor → colophon
    let next = state.reachIndex + 1;
    const li = state.lineReachIndex;
    if (li != null) {
      if (state.reachIndex < li && next > li && !firm) next = li;             // stop AT the line
      else if (state.reachIndex === li && !firm) { goToReach(li, true); return; } // firmer detent to pass
    }
    goToReach(next, true);
  }
  function retreat() {
    if (state.reachIndex <= 0) { if (state.isColophonOpen) closeColophon(); return; }
    goToReach(state.reachIndex - 1, true);
  }

  /* ---------- river interactions: traverse drag · tap-dive · long-press dive · swipe-share ---------- */

  function entryById(id) { return state.entries.find((e) => e.id === id); }

  function bindRiver() {
    const stream = $('stream');
    const river = $('river');
    if (!stream) return;
    let down = false, dragging = false, didLong = false, startY = 0, startX = 0, base = 0, downTarget = null, pressTimer = null;
    let swiping = false, swiped = false;   // a horizontal flick on an item = the share MARK
    let moveBound = null, upBound = null;

    // ---- pinch (two-finger) = the explicit ALTITUDE control (mobile, primary) ----
    // Intercepted only inside #stream (touch-action: none in CSS); the rest of the page
    // keeps native behavior. Pinch OUT (fingers apart) → ITEMS (detail, altitude→0); pinch
    // IN (fingers together) → DENSITY (the window's shape, altitude→1). Continuous: the
    // gesture drives the scalar; crossing the snap flips the stratum (centroid held), and
    // release snaps the scalar to the rendered stratum's pole.
    const pointers = new Map();
    let pinch = false, pinchBase = 0, pinchStartAlt = 0, pinchCy = 0;
    const twoPts = () => [...pointers.values()];
    const pinchDist = () => { const p = twoPts(); return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); };
    const pinchCentroidY = () => { const p = twoPts(); return (p[0].y + p[1].y) / 2; };

    function startPinch() {
      pinch = true;
      if (dragging) { dragging = false; river.classList.remove('is-dragging'); goToReach(state.reachIndex, true); }
      down = false; clearTimeout(pressTimer);
      pinchBase = pinchDist();                  // fixed baseline → cumulative altitude
      pinchStartAlt = state.altitude;
      pinchCy = pinchCentroidY();
      showDepth(state.stratum);
    }
    function endPinch() {
      pinch = false;
      setAltitude(state.stratum === 'density' ? 1 : 0, pinchCy);   // snap the scalar to the pole
      hideDepth();
    }
    function onPinchMove() {
      if (pointers.size < 2 || pinchBase <= 0) return;
      const ratio = pinchDist() / pinchBase;
      pinchCy = pinchCentroidY();
      // out (ratio>1) → lower altitude (items/detail); in (ratio<1) → raise (density/shape).
      const a = pinchStartAlt - PINCH_K * Math.log2(ratio);
      if (setAltitude(a, pinchCy)) buzz(8);     // buzz only on the stratum flip
      showDepth(state.stratum);
    }

    function onMove(e) {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch) { onPinchMove(); return; }
      if (!down) return;
      const dy = e.clientY - startY, dx = e.clientX - startX;
      if (!dragging && !swiping && (Math.abs(dy) > DRAG_SLOP || Math.abs(dx) > DRAG_SLOP)) {
        if (Math.abs(dy) >= Math.abs(dx)) { dragging = true; clearTimeout(pressTimer); river.classList.add('is-dragging'); }
        else { swiping = true; clearTimeout(pressTimer); }   // horizontal flick → share MARK
      }
      if (dragging) {
        const maxOffset = state.reaches[state.reaches.length - 1] || 0;
        let y = base - dy * DAMP;
        if (y < 0) y = y * 0.35; else if (y > maxOffset) y = maxOffset + (y - maxOffset) * 0.35;
        setRiverY(y);
      }
    }
    function onUp(e) {
      pointers.delete(e.pointerId);
      if (pinch) { if (pointers.size < 2) endPinch(); if (pointers.size === 0) teardown(); return; }
      if (!down && !dragging && !swiping) { if (pointers.size === 0) teardown(); return; }
      down = false; clearTimeout(pressTimer);
      if (dragging) {
        river.classList.remove('is-dragging');
        const dy = e.clientY - startY;
        const TH = Math.max(70, viewportH() * 0.16);
        const TH_LINE = Math.max(150, viewportH() * 0.34);
        if (dy <= -TH) advance(dy <= -TH_LINE);
        else if (dy >= TH) retreat();
        else goToReach(state.reachIndex, true);
        dragging = false;
      } else if (swiping) {
        // A committed horizontal flick on an ITEM is a directional MARK: swipe RIGHT → share
        // (OS hand-off), swipe LEFT → save. Per-item marks belong to ITEMS only — at DENSITY
        // a tick is a navigation target, not a markable item, so no save/share there.
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 56) {
          swiped = true;                                  // suppress the trailing click in any stratum
          if (state.stratum === 'items' && downTarget && downTarget.closest) {
            const art = downTarget.closest('article');
            if (art) {
              if (dx > 0) shareItem(entryById(art.getAttribute('data-id')));
              else toggleSave(art.getAttribute('data-story'));
              buzz(10);
            }
          }
        }
        swiping = false;
      }
      if (pointers.size === 0) teardown();
    }
    function teardown() {
      if (moveBound) window.removeEventListener('pointermove', moveBound);
      if (upBound) { window.removeEventListener('pointerup', upBound); window.removeEventListener('pointercancel', upBound); }
      moveBound = upBound = null;
    }

    stream.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!moveBound) {
        moveBound = onMove; upBound = onUp;
        window.addEventListener('pointermove', moveBound, { passive: true });
        window.addEventListener('pointerup', upBound);
        window.addEventListener('pointercancel', upBound);
      }
      if (pointers.size >= 2) { startPinch(); return; }   // second finger → depth gesture
      down = true; dragging = false; didLong = false; swiping = false; swiped = false;
      startY = e.clientY; startX = e.clientX; downTarget = e.target;
      base = state.reaches[state.reachIndex] || 0;
      // Long-press = DIVE — but only in ITEMS (the dive lives at reading distance). In
      // DENSITY long-press descends to items at that point (density is navigate/descend only).
      pressTimer = setTimeout(() => {
        if (!down || dragging || swiping || pinch) return;
        didLong = true; down = false;
        if (state.stratum === 'density') { toItems(startY); buzz(10); return; }
        const art = downTarget.closest && downTarget.closest('article');
        if (art) { const en = entryById(art.getAttribute('data-id')); if (en) { toggleDive(art, en.id); buzz(12); } }
      }, LONG_MS);
    }, { passive: true });

    // Tap. In DENSITY: descend to items at that time. In ITEMS: dive (multi-host) or leave.
    // Drags / long-press / pinch / swipe suppress the click.
    stream.addEventListener('click', (e) => {
      if (dragging || didLong || pinch || swiped || e.detail > 1) { if (dragging || didLong || pinch || swiped) e.preventDefault(); didLong = false; swiped = false; return; }
      if (state.stratum === 'density') { toItems(e.clientY); return; }   // approach → reveal constituents
      const hostLink = e.target.closest('.host-link');
      if (hostLink) { markRead(hostLink.closest('article').getAttribute('data-story')); collapseDive(); return; } // default opens new tab
      const head = e.target.closest('.head');
      if (head) {
        const art = head.closest('article');
        const e2 = entryById(art.getAttribute('data-id'));
        if (e2 && e2.depth > 1) { e.preventDefault(); toggleDive(art, e2.id); }
        else { markRead(art.getAttribute('data-story')); } // single source → default link opens
      }
    });

    // Block the browser's long-press context menu — but ONLY inside the river, so the
    // long-press gesture isn't hijacked. Not global; the rest of the page keeps it.
    stream.addEventListener('contextmenu', (e) => e.preventDefault());

    // Desktop: double-click descends to ITEMS (reading distance) at that line.
    stream.addEventListener('dblclick', (e) => {
      e.preventDefault();
      if (toItems(e.clientY)) { showDepth('items'); setTimeout(hideDepth, 700); }
    });

    // Wheel / trackpad: pan a reach per gesture, no momentum. Ctrl+wheel = altitude
    // (trackpad pinch-zoom): up → items (detail), down → density (shape).
    let wheelLock = false;
    stream.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (wheelLock || Math.abs(e.deltaY) < 4) return;
      wheelLock = true; setTimeout(() => { wheelLock = false; }, 360);
      if (e.ctrlKey) {
        const moved = e.deltaY < 0 ? toItems(e.clientY) : toDensity(e.clientY);
        if (moved) { showDepth(state.stratum); setTimeout(hideDepth, 700); }
        return;
      }
      if (e.deltaY > 0) advance(false); else retreat();
    }, { passive: false });
  }

  function toggleDive(art, id) {
    const open = state.diveId === id;
    for (const a of $('river').querySelectorAll('article.is-diving')) a.classList.remove('is-diving');
    if (open) { state.diveId = null; }
    else { art.classList.add('is-diving'); state.diveId = id; layoutReaches(); }
  }
  function collapseDive() {
    for (const a of $('river').querySelectorAll('article.is-diving')) a.classList.remove('is-diving');
    state.diveId = null;
  }
  // Save (restored 2026-05-31) — a personal keep mark, the directional swipe opposite to
  // share. Reachable via @saved. (R4 folds save + share into the feedforward radial fan.)
  function toggleSave(storyId) {
    if (!storyId) return;
    if (state.savedSet.has(storyId)) state.savedSet.delete(storyId); else state.savedSet.add(storyId);
    persistSaved();
    for (const a of $('river').querySelectorAll(`article[data-story="${storyId}"]`)) a.classList.toggle('is-saved', state.savedSet.has(storyId));
  }
  // Share — hand the link off to the OS (egress). navigator.share lifts the platform sheet
  // (→ its reading list); where unavailable, copy the link. Must run inside the gesture
  // handler for activation. Save and share are the two directional swipe marks.
  async function shareItem(entry) {
    if (!entry || !entry.primaryUrl) return;
    const url = entry.primaryUrl;
    const title = cleanTitle(entry.headline);
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch (_) { /* user dismissed */ }
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try { await navigator.clipboard.writeText(url); showDepth('link copied'); setTimeout(hideDepth, 1000); } catch (_) {}
    }
  }
  function markRead(storyId) {
    if (!storyId || state.readSet.has(storyId)) return;
    state.readSet.add(storyId); persistRead();
    for (const a of $('river').querySelectorAll(`article[data-story="${storyId}"]`)) a.classList.add('is-read');
  }

  /* ---------- colophon ---------- */

  function openColophon() {
    const col = $('colophon'); if (!col) return;
    col.classList.add('is-open'); col.setAttribute('aria-hidden', 'false'); state.isColophonOpen = true;
  }
  function closeColophon() {
    const col = $('colophon'); if (!col) return;
    col.classList.remove('is-open'); col.setAttribute('aria-hidden', 'true'); state.isColophonOpen = false;
  }
  function bindColophon() {
    document.addEventListener('click', (e) => {
      if (!state.isColophonOpen) return;
      if (e.target.closest('#colophon') || e.target.closest('#word')) return;
      closeColophon();
    });
  }

  /* ---------- keyboard ---------- */

  function bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Colophon retracts on an up-gesture (mirrors its reveal); Esc also closes it.
      if (state.isColophonOpen) {
        if (['Escape', 'ArrowUp', 'PageUp', 'k'].includes(e.key)) { closeColophon(); e.preventDefault(); }
        return;
      }

      if (e.key === '/') { $('prompt').focus(); e.preventDefault(); return; }
      // Altitude keys (desktop parity with pinch): + / = → items (detail), - / _ → density (shape).
      if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') {
        const r = $('stream').getBoundingClientRect();
        const moved = (e.key === '+' || e.key === '=') ? toItems((r.top + r.bottom) / 2) : toDensity((r.top + r.bottom) / 2);
        if (moved) { showDepth(state.stratum); setTimeout(hideDepth, 700); }
        e.preventDefault(); return;
      }
      if (e.key === ' ' || e.key === 'PageDown' || e.key === 'ArrowDown') { advance(true); e.preventDefault(); return; }
      if (e.key === 'PageUp' || e.key === 'ArrowUp') { retreat(); e.preventDefault(); return; }
      if (e.key === 'Home') { goToReach(0, true); e.preventDefault(); return; }
      if (e.key === 'j') { focusStep(1); e.preventDefault(); return; }
      if (e.key === 'k') { focusStep(-1); e.preventDefault(); return; }
      if (e.key === 's') { const el = focusedEl(); if (el) toggleSave(el.getAttribute('data-story')); e.preventDefault(); return; }
      if (e.key === 'o') { openFocused(); e.preventDefault(); return; }
      if (e.key === 'Enter') { const el = focusedEl(); if (el) { const en = entryById(el.getAttribute('data-id')); if (en && en.depth > 1) toggleDive(el, en.id); else openFocused(); } e.preventDefault(); return; }
      if (e.key === '?') { openColophon(); e.preventDefault(); return; }
      if (e.key === 'g') {
        if (state.keySequence === 'g') { goToReach(0, true); state.keySequence = ''; clearTimeout(state.keySeqTimer); }
        else { state.keySequence = 'g'; clearTimeout(state.keySeqTimer); state.keySeqTimer = setTimeout(() => { state.keySequence = ''; }, 600); }
        e.preventDefault();
      }
    });
  }
  function articleEls() { return [...$('river').querySelectorAll('article')]; }
  function focusedEl() { const a = articleEls(); return (state.focusedIdx >= 0 && state.focusedIdx < a.length) ? a[state.focusedIdx] : null; }
  function focusStep(dir) {
    const a = articleEls(); if (!a.length) return;
    a.forEach((el) => el.classList.remove('is-focused'));
    state.focusedIdx = clamp(state.focusedIdx + dir, 0, a.length - 1);
    const el = a[state.focusedIdx]; el.classList.add('is-focused');
    // Keep the focused headline within the current reach.
    const top = state.reaches[state.reachIndex], vh = viewportH();
    if (el.offsetTop < top || el.offsetTop + el.offsetHeight > top + vh) {
      let r = 0; for (let i = 0; i < state.reaches.length; i++) { if (state.reaches[i] <= el.offsetTop) r = i; }
      goToReach(r, true);
    }
  }
  function openFocused() {
    const el = focusedEl(); if (!el) return;
    const en = entryById(el.getAttribute('data-id')); if (!en) return;
    markRead(en.storyId);
    window.open(en.primaryUrl, '_blank', 'noopener,noreferrer');
  }

  /* ---------- poll / tick ---------- */

  async function tick(opts = {}) {
    if (state.isFetching) return;
    state.isFetching = true;
    const r = await pull();
    state.isFetching = false;
    if (!r) return;                       // network failed → keep last-good silently (stale-but-honest)
    state.endpoint = r.endpoint;
    if (r.notModified) return;            // 304 → do nothing: no ingest, no render

    // First paint, or an explicit pull-to-now: fold everything in and render.
    if (opts.foldNow || !state.firstRendered) {
      foldPending();
      ingest(r.data);
      setMark('fresh');
      render();
      return;
    }
    // Background poll with genuinely newer data: HOLD it at the now-edge — never reflow the
    // river under the reader. The #mark signals it; it folds in only on pull-to-now.
    const fresh = newStories(r.data);
    if (fresh.length) {
      for (const s of fresh) state.pending.set(s.id, s);
      state.pendingUpdatedAt = r.data.updatedAt || state.pendingUpdatedAt;
      setMark('fresh');
    }
  }

  // Pull-to-now (wordmark tap): jump to the top and fold the held arrivals in. A reflow
  // here is correct — the reader asked for it. Also checks for anything even newer.
  function pullToNow() {
    if (foldPending()) { setMark('fresh'); render(); }
    goToReach(0, true);
    tick({ foldNow: true });
  }
  function setMark(next) {
    const el = $('mark'); if (!el) return;
    el.classList.remove('is-initial', 'is-fresh', 'is-updating'); el.classList.add('is-' + next);
  }

  /* ---------- boot ---------- */

  function boot() {
    migrateStorage();
    loadPersisted();
    readHash();
    applyDim(clockHour());          // session-scoped auto-dim off the local clock; never persisted

    bindWordmark();
    bindPrompt();
    bindRiver();
    bindKeyboard();
    bindColophon();

    window.addEventListener('resize', () => { layoutReaches(); goToReach(state.reachIndex, false); }, { passive: true });

    setMark('initial');
    tick();
    setInterval(tick, POLL_MS);
    // Continuous by the minute: re-paint to the clock unless the day has been scrubbed.
    setInterval(() => { if (!state.dimOverridden) applyDim(clockHour()); }, 60_000);

    const visit = () => persistVisit();
    window.addEventListener('beforeunload', visit);
    window.addEventListener('pagehide', visit);
    setInterval(visit, 5 * 60_000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
