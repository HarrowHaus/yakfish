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
  const POLL_MS = 60_000;
  const BUFFER_HOURS = 26;
  const STOP = new Set(['the','a','an','live','update','updates','breaking','and','of','in','on','to','for']);

  /* Zoom = depth in the story hierarchy (PRODUCT.md): raw=0 / stories=1 / threads=2
     dive layers. A stop is offered only when it changes the view; threads is stubbed
     until the GKG track lands, so it auto-collapses out for now. */
  const ZOOMS = ['raw', 'stories', 'threads'];

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
    zoom: 'stories',
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
    entries: [],
    reaches: [0],
    reachIndex: 0,
    newOldOffset: null,
    lineReachIndex: null,
    diveId: null,
    readSet: new Set(),
    savedSet: new Set(),
    mutedSet: new Set(),
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
  function loadPersisted() {
    try { const r = localStorage.getItem('yakfish.read');  if (r) state.readSet  = new Set(JSON.parse(r)); } catch (_) {}
    try { const s = localStorage.getItem('yakfish.saved'); if (s) state.savedSet = new Set(JSON.parse(s)); } catch (_) {}
    try { const m = localStorage.getItem('yakfish.muted'); if (m) state.mutedSet = new Set(JSON.parse(m)); } catch (_) {}
    try { state.lastVisitISO = localStorage.getItem('yakfish.lastVisit'); } catch (_) {}
  }
  function persistRead()  { try { const a = [...state.readSet].slice(-1000); state.readSet = new Set(a); localStorage.setItem('yakfish.read', JSON.stringify(a)); } catch (_) {} }
  function persistSaved() { try { localStorage.setItem('yakfish.saved', JSON.stringify([...state.savedSet])); } catch (_) {} }
  function persistMuted() { try { localStorage.setItem('yakfish.muted', JSON.stringify([...state.mutedSet])); } catch (_) {} }
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
        pendingTap = setTimeout(() => { goToReach(0, true); tick(true); }, 280);
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
      if ([' ', 'j', 'k', 'g', 's', 'o', '?', '/', '+', '=', '-', '_'].includes(e.key)) return; // reach + depth keys
      if (e.key === 'Escape') { if (state.query) { input.value = ''; state.query = ''; render(); updateHash(); e.preventDefault(); } return; }
      if (e.key.length === 1) { input.focus(); input.value += e.key; state.query = input.value; render(); updateHash(); e.preventDefault(); }
    });
  }

  // Enter runs folded commands: -@source mutes; `zoom raw|stories|threads` and `zoom in|out`
  // set depth (full parity with the pinch gesture — no one is gated by whether they can pinch).
  function runCommand(input) {
    const raw = input.value.trim();
    const low = raw.toLowerCase();
    let m;
    if ((m = low.match(/^-\s*@?\s*(.+)$/))) {
      toggleMute(m[1].trim()); input.value = ''; state.query = ''; render(); updateHash(); return;
    }
    if ((m = low.match(/^(?:zoom|>)\s*:?\s*(raw|stories|threads|in|out)$/))) {
      input.value = ''; state.query = '';
      const arg = m[1];
      if (arg === 'in') zoomStep(1); else if (arg === 'out') zoomStep(-1); else setZoom(arg);
      render(); updateHash(); return;
    }
    state.query = raw; render(); updateHash();
  }

  function toggleMute(term) {
    const t = term.replace(/^@/, '').trim().toLowerCase();
    if (!t) return;
    if (state.mutedSet.has(t)) state.mutedSet.delete(t); else state.mutedSet.add(t);
    persistMuted();
  }

  /* ---------- zoom = depth in the hierarchy (raw=0 / stories=1 / threads=2 layers) ----------
     There is NO at-rest dial — the notched dial failed the earned-chrome test (DECISIONS.md:
     it spent pixels at rest to show a state the content already carries). Depth is a GESTURE:
     pinch within the river (mobile, primary) or the command bar / +- keys / double-click
     (desktop), all at full parity. A level is reachable only when it changes the view
     (auto-collapse); threads stays stubbed until the GKG track, so today the gesture often
     has nowhere to go — and shows nothing, rather than exposing empty stops. */

  // The ordered levels that actually change the view right now (most-raw → most-collapsed).
  function reachableZooms() {
    const stories = [...state.stories.values()].filter((s) => storyVisibleSources(s).length);
    const multi = stories.some((s) => storyVisibleSources(s).length > 1);
    const out = [];
    if (multi) out.push('raw');     // raw differs from stories only when something merged
    out.push('stories');
    // 'threads' omitted until GKG themes make it a real, view-changing rung.
    return out;
  }

  // The single entry point every path shares (pinch / command / keys / double-click) → parity.
  function setZoom(z, centroidY) {
    const reach = reachableZooms();
    if (!reach.includes(z) || z === state.zoom) return false;   // unreachable/empty rung → no-op
    applyZoom(z, centroidY);
    return true;
  }
  // Move one rung. dir = +1 zooms IN (toward raw, more detail), -1 zooms OUT (toward threads).
  function zoomStep(dir, centroidY) {
    const reach = reachableZooms();
    let i = reach.indexOf(state.zoom);
    if (i < 0) i = Math.max(0, reach.indexOf('stories'));
    const j = i - dir;                                          // reach is raw→stories(→threads)
    if (j < 0 || j >= reach.length) return false;               // nowhere to go that way
    applyZoom(reach[j], centroidY);
    return true;
  }
  // The next rung in a direction (for the live gesture label), or null if none.
  function zoomTarget(dir) {
    const reach = reachableZooms();
    let i = reach.indexOf(state.zoom); if (i < 0) i = Math.max(0, reach.indexOf('stories'));
    const j = i - dir;
    return (j >= 0 && j < reach.length) ? reach[j] : null;
  }

  // Apply a level change, holding the line at the centroid stable (map-like) + felt merge.
  function applyZoom(z, centroidY) {
    let anchorId = null, anchorScreenY = 0;
    if (centroidY != null) {
      const el = articleAtScreenY(centroidY);
      if (el) { anchorId = el.getAttribute('data-story'); anchorScreenY = el.getBoundingClientRect().top; }
    }
    flagMerge();
    state.zoom = z; state.diveId = null;
    render();
    if (anchorId) {
      const el = $('river').querySelector(`article[data-story="${anchorId}"]`);
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
  }
  function articleAtScreenY(y) {
    const r = $('stream').getBoundingClientRect();
    const el = document.elementFromPoint((r.left + r.right) / 2, clamp(y, r.top + 1, r.bottom - 1));
    return el ? el.closest('article') : null;
  }

  // Transient depth label — surfaces only DURING a gesture, dissolves on release (the same
  // no-at-rest pattern as the dim day-scrub). Nothing at rest.
  function showDepth(text) { const el = $('depth-label'); if (el) { el.textContent = text; el.classList.add('is-active'); } }
  function hideDepth() { const el = $('depth-label'); if (el) el.classList.remove('is-active'); }

  // The merge cue: a brief settle on the river (reduced-motion: instant, in CSS).
  function flagMerge() {
    const river = $('river');
    river.classList.remove('merging'); void river.offsetWidth; river.classList.add('merging');
    setTimeout(() => river.classList.remove('merging'), 320);
  }

  /* ---------- URL view-state (filter + zoom + section; never read/saved) ---------- */

  function updateHash() {
    const p = new URLSearchParams();
    if (state.query.trim()) p.set('q', state.query.trim());
    if (state.zoom !== 'stories') p.set('z', state.zoom);
    const h = p.toString();
    try { history.replaceState(null, '', h ? '#' + h : location.pathname + location.search); } catch (_) {}
  }
  function readHash() {
    try {
      const p = new URLSearchParams(location.hash.replace(/^#/, ''));
      if (p.get('z') && ZOOMS.includes(p.get('z'))) state.zoom = p.get('z');
      if (p.get('q')) { state.query = p.get('q'); const i = $('prompt'); if (i) i.value = state.query; }
    } catch (_) {}
  }

  /* ---------- fetch / ingest ---------- */

  async function tryFetch(ep) {
    const res = await fetch(`${ep}?t=${Date.now()}`, { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (!res.ok) throw new Error(`${ep} ${res.status}`);
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

  /* ---------- build render entries (mute → filter → zoom → new/old) ---------- */

  function storyVisibleSources(s) {
    if (!state.mutedSet.size) return s.sources;
    return s.sources.filter((src) => {
      const host = (src.host || '').toLowerCase();
      const name = (src.name || '').toLowerCase();
      for (const m of state.mutedSet) { if (host.includes(m) || name.includes(m)) return false; }
      return true;
    });
  }
  function matchesFilter(s, sources) {
    const q = state.query.trim().toLowerCase();
    if (!q || /^(-|zoom|>)/.test(q)) return true;
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

    const entries = [];
    if (state.zoom === 'raw') {
      // 0 dive layers: one line per article (source); tap → straight to the source.
      for (const { s, sources } of visible) {
        for (const src of sources) {
          entries.push({ id: `${s.id}:${src.host}`, storyId: s.id, headline: s.headline, time: src.time || s.time,
            section: s.section, sources: [src], primaryUrl: src.url, depth: 1 });
        }
      }
      entries.sort((a, b) => tms(b.time) - tms(a.time));
    } else {
      // 1 dive layer (stories): one line per event; tap → its hosts → source.
      // 'threads' (2 layers) is stubbed to this until the GKG track lands — no faked depth.
      for (const { s, sources } of visible) {
        entries.push({ id: s.id, storyId: s.id, headline: s.headline, time: s.time,
          section: s.section, sources, primaryUrl: sources[0].url, depth: sources.length });
      }
    }
    return entries;
  }

  /* ---------- render ---------- */

  function render() {
    // Auto-collapse: if the current level is no longer view-changing (e.g. multi-host
    // stories aged out, or a URL set an unreachable level), fall back to the spine.
    if (!reachableZooms().includes(state.zoom)) state.zoom = 'stories';
    state.entries = buildEntries();
    const river = $('river');
    const lv = state.lastVisitISO ? tms(state.lastVisitISO) : 0;

    // The new/old boundary: first entry at or older than last visit.
    let boundary = -1;
    if (lv) { for (let i = 0; i < state.entries.length; i++) { if (tms(state.entries[i].time) <= lv) { boundary = i; break; } } }

    const parts = [];
    if (state.entries.length === 0) {
      parts.push(`<p class="empty">${state.stories.size === 0 ? '' : 'no matches'}</p>`);
    } else {
      state.entries.forEach((e, i) => {
        if (i === boundary && boundary > 0) {
          parts.push(`<div class="newold is-floor" data-line="1"><span>new / old — caught up</span></div>`);
        }
        parts.push(renderEntry(e));
      });
      // The finishable floor.
      const caught = boundary === 0 || state.entries.every((e) => state.readSet.has(e.storyId) || (lv && tms(e.time) <= lv));
      parts.push(`<div class="floor">${caught ? "you're caught up — nothing newer" : "— the bottom —"}</div>`);
    }
    river.innerHTML = parts.join('');

    if (!state.firstRendered && state.entries.length) {
      state.firstRendered = true;
      river.classList.add('first-load');
      setTimeout(() => river.classList.remove('first-load'), 1800);
    }

    layoutReaches();
    goToReach(clamp(state.reachIndex, 0, state.reaches.length - 1), false);
    updateStatus();
  }

  function renderEntry(e) {
    const head = cleanTitle(e.headline);
    const time = fmtTime(e.time);
    const isRead = state.readSet.has(e.storyId);
    const isSaved = state.savedSet.has(e.storyId);
    const cls = ['', isRead ? ' is-read' : '', isSaved ? ' is-saved' : ''].join('');
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

  /* ---------- river interactions: traverse drag + tap-dive + long-press save/mute ---------- */

  function entryById(id) { return state.entries.find((e) => e.id === id); }

  function bindRiver() {
    const stream = $('stream');
    const river = $('river');
    if (!stream) return;
    let down = false, dragging = false, didLong = false, startY = 0, startX = 0, base = 0, downTarget = null, pressTimer = null;
    let moveBound = null, upBound = null;

    // ---- pinch (two-finger) = the depth gesture (mobile, primary) ----
    // Intercepted only inside #stream (touch-action: none in CSS); the rest of the page
    // keeps native behavior. Pinch OUT (fingers apart) zooms IN toward raw; pinch IN
    // (fingers together) zooms OUT toward threads — the pinch IS the felt merge, with the
    // line at the centroid held stable (applyZoom re-anchors it, map-like).
    const pointers = new Map();
    let pinch = false, pinchBase = 0;
    const PINCH_IN = 1.30, PINCH_OUT = 0.77;     // scale ratio to commit one rung
    const twoPts = () => [...pointers.values()];
    const pinchDist = () => { const p = twoPts(); return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); };
    const pinchCentroidY = () => { const p = twoPts(); return (p[0].y + p[1].y) / 2; };

    function startPinch() {
      pinch = true;
      if (dragging) { dragging = false; river.classList.remove('is-dragging'); goToReach(state.reachIndex, true); }
      down = false; clearTimeout(pressTimer);
      pinchBase = pinchDist();
      labelTarget();
    }
    function endPinch() { pinch = false; hideDepth(); }
    function labelTarget() {
      // Show "current → target" only if the gesture has somewhere to go; else nothing.
      const tIn = zoomTarget(1), tOut = zoomTarget(-1);
      if (tIn || tOut) showDepth(`${state.zoom}${tIn ? ' ⇄ ' + tIn : ''}${tOut ? ' ⇄ ' + tOut : ''}`);
      else hideDepth();
    }
    function onPinchMove() {
      if (pointers.size < 2 || pinchBase <= 0) return;
      const ratio = pinchDist() / pinchBase;
      const cy = pinchCentroidY();
      if (ratio >= PINCH_IN) { if (zoomStep(1, cy)) { showDepth(`→ ${state.zoom}`); buzz(8); } pinchBase = pinchDist(); }
      else if (ratio <= PINCH_OUT) { if (zoomStep(-1, cy)) { showDepth(`→ ${state.zoom}`); buzz(8); } pinchBase = pinchDist(); }
    }

    function onMove(e) {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch) { onPinchMove(); return; }
      if (!down) return;
      const dy = e.clientY - startY, dx = e.clientX - startX;
      if (!dragging && (Math.abs(dy) > DRAG_SLOP || Math.abs(dx) > DRAG_SLOP)) {
        if (Math.abs(dy) >= Math.abs(dx)) { dragging = true; clearTimeout(pressTimer); river.classList.add('is-dragging'); }
        else { down = false; return; } // horizontal — let it be (e.g. text select)
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
      if (!down && !dragging) { if (pointers.size === 0) teardown(); return; }
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
      down = true; dragging = false; didLong = false;
      startY = e.clientY; startX = e.clientX; downTarget = e.target;
      base = state.reaches[state.reachIndex] || 0;
      pressTimer = setTimeout(() => {
        if (!down || dragging || pinch) return;
        didLong = true; down = false;
        const host = downTarget.closest && downTarget.closest('.host-link');
        if (host) { toggleMute(host.getAttribute('data-host')); host.classList.toggle('is-muting'); buzz(12); render(); }
        else { const art = downTarget.closest && downTarget.closest('article'); if (art) { toggleSave(art.getAttribute('data-story')); buzz(12); } }
      }, LONG_MS);
    }, { passive: true });

    // Tap → dive (multi-host) or leave (single). Drags/long-presses/pinch suppress the click.
    stream.addEventListener('click', (e) => {
      if (dragging || didLong || pinch || e.detail > 1) { if (dragging || didLong || pinch) e.preventDefault(); didLong = false; return; }
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

    // Desktop: double-click a line pushes IN one level (toward raw). Centroid = that line.
    stream.addEventListener('dblclick', (e) => {
      const art = e.target.closest('article'); if (!art) return;
      e.preventDefault();
      const moved = zoomStep(1, e.clientY);
      if (moved) { showDepth(`→ ${state.zoom}`); setTimeout(hideDepth, 700); }
    });

    // Wheel / trackpad: one reach per gesture, no momentum. (Ctrl+wheel = pinch-zoom on
    // trackpads → route to depth, at parity.)
    let wheelLock = false;
    stream.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (wheelLock || Math.abs(e.deltaY) < 4) return;
      wheelLock = true; setTimeout(() => { wheelLock = false; }, 360);
      if (e.ctrlKey) {
        const moved = e.deltaY < 0 ? zoomStep(1, e.clientY) : zoomStep(-1, e.clientY);
        if (moved) { showDepth(`→ ${state.zoom}`); setTimeout(hideDepth, 700); }
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
  function toggleSave(storyId) {
    if (!storyId) return;
    if (state.savedSet.has(storyId)) state.savedSet.delete(storyId); else state.savedSet.add(storyId);
    persistSaved();
    for (const a of $('river').querySelectorAll(`article[data-story="${storyId}"]`)) a.classList.toggle('is-saved', state.savedSet.has(storyId));
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
      // Depth keys (desktop parity with pinch): + / = zoom IN (raw), - / _ zoom OUT (threads).
      if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') {
        const r = $('stream').getBoundingClientRect();
        const moved = (e.key === '+' || e.key === '=') ? zoomStep(1, (r.top + r.bottom) / 2) : zoomStep(-1, (r.top + r.bottom) / 2);
        if (moved) { showDepth(`→ ${state.zoom}`); setTimeout(hideDepth, 700); }
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

  async function tick() {
    if (state.isFetching) return;
    state.isFetching = true;
    setMark('updating');
    const r = await pull();
    state.isFetching = false;
    if (r) { state.endpoint = r.endpoint; ingest(r.data); setMark('fresh'); render(); }
    else { setMark('fresh'); }
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
