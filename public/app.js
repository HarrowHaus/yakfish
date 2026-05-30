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
     scalar engine: it color-mixes between the two anchors bracketing the local clock
     hour. No color library, no appearance model on the page. Warm hue always; chroma a
     whisper; ink polarity flips across the day (light-on-dark night → dark-on-light
     day) because the baked ink anchors already encode it. Hours wrap 22→02. */
  const ANCHORS = [
    { h: 2.0,  bg: 'oklch(0.17 0.022 60)', ink: 'oklch(0.72 0.018 70)' }, // deep night ~2200K
    { h: 5.5,  bg: 'oklch(0.44 0.030 52)', ink: 'oklch(0.30 0.016 50)' }, // dawn ~2700K (cool-of-warm)
    { h: 9.0,  bg: 'oklch(0.93 0.012 85)', ink: 'oklch(0.25 0.010 80)' }, // morning ~5000K warm paper
    { h: 12.5, bg: 'oklch(0.95 0.008 88)', ink: 'oklch(0.22 0.008 80)' }, // midday ~5500K (peak ΔL)
    { h: 15.5, bg: 'oklch(0.88 0.020 78)', ink: 'oklch(0.27 0.014 72)' }, // afternoon ~4500K (the lean)
    { h: 19.0, bg: 'oklch(0.58 0.045 65)', ink: 'oklch(0.26 0.020 60)' }, // golden dusk ~3000K (P3 reach)
    { h: 22.0, bg: 'oklch(0.30 0.030 60)', ink: 'oklch(0.74 0.020 70)' }  // evening ~2400K (diminuendo)
  ];
  // Append the wrap anchor (next-day deep night at h+24) so 22:00→02:00 interpolates.
  const ANCH = [...ANCHORS, { h: ANCHORS[0].h + 24, bg: ANCHORS[0].bg, ink: ANCHORS[0].ink }];

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
        const f = (hh - a.h) / (b.h - a.h);
        return { bg: mix(a.bg, b.bg, f), ink: mix(a.ink, b.ink, f) };
      }
    }
    return { bg: ANCHORS[0].bg, ink: ANCHORS[0].ink };
  }

  // Paint the page at a given clock hour. --t (0→1 day phase) is the single scalar; the
  // wordmark and the scrub track read it. Color only — no layout touched.
  function applyDim(hour) {
    state.dimHour = hour;
    const { bg, ink } = dimColors(hour);
    root.style.setProperty('--bg', bg);
    root.style.setProperty('--ink-auto', ink);
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
      if ([' ', 'j', 'k', 'g', 's', 'o', '?', '/'].includes(e.key)) return;
      if (e.key === 'Escape') { if (state.query) { input.value = ''; state.query = ''; render(); updateHash(); e.preventDefault(); } return; }
      if (e.key.length === 1) { input.focus(); input.value += e.key; state.query = input.value; render(); updateHash(); e.preventDefault(); }
    });
  }

  // Enter runs folded commands: -@source mutes, `zoom raw|stories|threads` sets depth.
  function runCommand(input) {
    const raw = input.value.trim();
    const low = raw.toLowerCase();
    let m;
    if ((m = low.match(/^-\s*@?\s*(.+)$/))) {
      toggleMute(m[1].trim()); input.value = ''; state.query = ''; render(); updateHash(); return;
    }
    if ((m = low.match(/^(?:zoom|>)\s*:?\s*(raw|stories|threads)$/))) {
      setZoom(m[1]); input.value = ''; state.query = ''; render(); updateHash(); return;
    }
    state.query = raw; render(); updateHash();
  }

  function toggleMute(term) {
    const t = term.replace(/^@/, '').trim().toLowerCase();
    if (!t) return;
    if (state.mutedSet.has(t)) state.mutedSet.delete(t); else state.mutedSet.add(t);
    persistMuted();
  }

  /* ---------- zoom = depth in the hierarchy (raw/stories/threads = 0/1/2 layers) ---------- */

  // A stop is offered ONLY when it changes the view (no empty/redundant cluster layer):
  //  - 'stories' is the spine (the deduped river).
  //  - 'raw' appears only if un-clustering actually splits something (a multi-host story).
  //  - 'threads' is STUBBED until the GKG track — it never changes the view yet, so it
  //    auto-collapses out. (No section-as-thread faking of depth.)
  function availableZooms() {
    const stories = [...state.stories.values()].filter((s) => storyVisibleSources(s).length);
    const multi = stories.some((s) => storyVisibleSources(s).length > 1);
    const out = [];
    if (multi) out.push('raw');          // raw differs from stories only when something merged
    out.push('stories');
    // 'threads' intentionally omitted until GKG themes make it change the view.
    return out;
  }

  function bindZoom() {
    const zoom = $('zoom');
    if (!zoom) return;
    zoom.addEventListener('click', (e) => {
      const btn = e.target.closest('.zoom-notch');
      if (!btn || btn.hasAttribute('hidden')) return;
      setZoom(btn.getAttribute('data-zoom'));
      updateHash();
    });
  }
  function setZoom(z) {
    const avail = availableZooms();
    if (!avail.includes(z)) z = avail.includes('stories') ? 'stories' : avail[0];
    if (z === state.zoom) { reflectZoom(); return; }
    // Zooming OUT (fewer layers, lines merge into parents) is a felt merge.
    if (ZOOMS.indexOf(z) > ZOOMS.indexOf(state.zoom)) flagMerge();
    state.zoom = z; state.diveId = null; render();
  }
  function reflectZoom() {
    const avail = availableZooms();
    if (!avail.includes(state.zoom)) state.zoom = avail.includes('stories') ? 'stories' : avail[0];
    const zoomEl = $('zoom');
    for (const btn of zoomEl.querySelectorAll('.zoom-notch')) {
      const z = btn.getAttribute('data-zoom');
      const on = avail.includes(z);
      btn.toggleAttribute('hidden', !on);              // auto-collapse unavailable stops
      btn.setAttribute('aria-checked', String(z === state.zoom));
    }
    // The dial only earns its pixels when there is more than one stop to choose.
    zoomEl.toggleAttribute('hidden', avail.length < 2);
  }
  // The merge cue: a brief settle on the river (gated by reduced-motion in CSS).
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
    reflectZoom();
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

    function onMove(e) {
      if (!down) return;
      const dy = e.clientY - startY, dx = e.clientX - startX;
      if (!dragging && (Math.abs(dy) > DRAG_SLOP || Math.abs(dx) > DRAG_SLOP)) {
        if (Math.abs(dy) >= Math.abs(dx)) { dragging = true; clearTimeout(pressTimer); river.classList.add('is-dragging'); }
        else { down = false; teardown(); return; } // horizontal — let it be (e.g. text select)
      }
      if (dragging) {
        const maxOffset = state.reaches[state.reaches.length - 1] || 0;
        let y = base - dy * DAMP;
        if (y < 0) y = y * 0.35; else if (y > maxOffset) y = maxOffset + (y - maxOffset) * 0.35;
        setRiverY(y);
      }
    }
    function onUp(e) {
      if (!down && !dragging) { teardown(); return; }
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
      teardown();
    }
    function teardown() {
      if (moveBound) window.removeEventListener('pointermove', moveBound);
      if (upBound) { window.removeEventListener('pointerup', upBound); window.removeEventListener('pointercancel', upBound); }
      moveBound = upBound = null;
    }

    stream.addEventListener('pointerdown', (e) => {
      if (e.button != null && e.button !== 0) return;
      down = true; dragging = false; didLong = false;
      startY = e.clientY; startX = e.clientX; downTarget = e.target;
      base = state.reaches[state.reachIndex] || 0;
      pressTimer = setTimeout(() => {
        if (!down || dragging) return;
        didLong = true; down = false;
        const host = downTarget.closest && downTarget.closest('.host-link');
        if (host) { toggleMute(host.getAttribute('data-host')); host.classList.toggle('is-muting'); buzz(12); render(); }
        else { const art = downTarget.closest && downTarget.closest('article'); if (art) { toggleSave(art.getAttribute('data-story')); buzz(12); } }
        teardown();
      }, LONG_MS);
      moveBound = onMove; upBound = onUp;
      window.addEventListener('pointermove', moveBound, { passive: true });
      window.addEventListener('pointerup', upBound);
      window.addEventListener('pointercancel', upBound);
    }, { passive: true });

    // Tap → dive (multi-host) or leave (single). Drags/long-presses suppress the click.
    stream.addEventListener('click', (e) => {
      if (dragging || didLong) { e.preventDefault(); didLong = false; return; }
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

    // Wheel / trackpad: one reach per gesture, no momentum.
    let wheelLock = false;
    stream.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (wheelLock || Math.abs(e.deltaY) < 4) return;
      wheelLock = true; setTimeout(() => { wheelLock = false; }, 360);
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
    bindZoom();
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
