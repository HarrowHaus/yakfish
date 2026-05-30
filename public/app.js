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
  const ZOOMS = ['raw', 'stories', 'clusters'];

  /* Reach-traverse tuning (in-hand feel; OPEN_QUESTIONS A). */
  const DRAG_SLOP = 8;        // px before a press becomes a drag
  const LONG_MS = 500;        // long-press → save / mute
  const DAMP = 0.6;           // drag resistance (no momentum carry)
  const REACH_OVERLAP = 0.12; // context carried between reaches

  /* 18 OKLCH keyframes. Interpolated in CSS via color-mix. */
  const KEYFRAMES = [
    { at: 0.00, bg: '#ecdfca', ink: '#2c1e12', mute: '#7c6a52', signal: '#7a2e18' },
    { at: 0.07, bg: '#e6d8bc', ink: '#2a1d10', mute: '#766548', signal: '#762d16' },
    { at: 0.14, bg: '#e0d094', ink: '#3a2c14', mute: '#6e5e3a', signal: '#722c14' },
    { at: 0.22, bg: '#d6a648', ink: '#2e1c0c', mute: '#5e4e2a', signal: '#5e2310' },
    { at: 0.30, bg: '#c08624', ink: '#281606', mute: '#544022', signal: '#56200e' },
    { at: 0.36, bg: '#b8662a', ink: '#1e0c04', mute: '#4a3220', signal: '#4a1808' },
    { at: 0.42, bg: '#983e20', ink: '#160a04', mute: '#3e2418', signal: '#3a1004' },
    { at: 0.46, bg: '#6e1e1c', ink: '#100404', mute: '#3a1c18', signal: '#d04428' },
    { at: 0.50, bg: '#380a18', ink: '#ecd4a4', mute: '#a8927c', signal: '#e07840' },
    { at: 0.55, bg: '#2a1428', ink: '#d8c498', mute: '#a08068', signal: '#dc7034' },
    { at: 0.60, bg: '#1c1232', ink: '#cebca0', mute: '#988068', signal: '#d06830' },
    { at: 0.66, bg: '#100c44', ink: '#b8b09c', mute: '#908068', signal: '#c8642c' },
    { at: 0.72, bg: '#0a124c', ink: '#b4aaa0', mute: '#908068', signal: '#c0602a' },
    { at: 0.78, bg: '#0a1c4c', ink: '#b0a89c', mute: '#8c7c64', signal: '#bc5e28' },
    { at: 0.84, bg: '#0a2c34', ink: '#aca890', mute: '#7c7058', signal: '#b85a26' },
    { at: 0.90, bg: '#0c1820', ink: '#aca890', mute: '#807060', signal: '#b05828' },
    { at: 0.96, bg: '#0a0e14', ink: '#a09c84', mute: '#786c5c', signal: '#ac5626' },
    { at: 1.00, bg: '#07090c', ink: '#98947c', mute: '#706858', signal: '#a85226' }
  ];

  const state = {
    endpoint: null,
    query: '',
    zoom: 'stories',
    updatedAt: null,
    isFetching: false,
    dim: 0.5,
    dimOverridden: false,
    timeOfDay: 0.5,
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

  /* ---------- dim / chromatic (auto from clock; page bg IS the state) ---------- */

  function findSegment(d) {
    for (let i = 0; i < KEYFRAMES.length - 1; i++) {
      if (d >= KEYFRAMES[i].at && d <= KEYFRAMES[i + 1].at) return [KEYFRAMES[i], KEYFRAMES[i + 1]];
    }
    return [KEYFRAMES[KEYFRAMES.length - 1], KEYFRAMES[KEYFRAMES.length - 1]];
  }
  function applyDim(d) {
    const c = clamp(d, 0, 1);
    state.dim = c;
    root.style.setProperty('--dim', String(c));
    const [lo, hi] = findSegment(c);
    const span = hi.at - lo.at;
    const t = span > 0 ? (c - lo.at) / span : 0;
    const pct = (t * 100).toFixed(2);
    root.style.setProperty('--bg',     `color-mix(in oklch, ${lo.bg}, ${hi.bg} ${pct}%)`);
    root.style.setProperty('--ink',    `color-mix(in oklch, ${lo.ink}, ${hi.ink} ${pct}%)`);
    root.style.setProperty('--mute',   `color-mix(in oklch, ${lo.mute}, ${hi.mute} ${pct}%)`);
    root.style.setProperty('--signal', `color-mix(in oklch, ${lo.signal}, ${hi.signal} ${pct}%)`);
  }
  function mapHoursToDim(h) {
    const anchors = [[0,0.92],[3,0.98],[5,0.02],[8,0.14],[12,0.32],[15,0.40],[18,0.50],[21,0.66],[24,0.92]];
    for (let i = 0; i < anchors.length - 1; i++) {
      const [h1, v1] = anchors[i], [h2, v2] = anchors[i + 1];
      if (h >= h1 && h <= h2) return v1 + (v2 - v1) * ((h - h1) / (h2 - h1));
    }
    return 0.5;
  }
  function computeTimeOfDay() {
    const now = new Date();
    return mapHoursToDim(now.getHours() + now.getMinutes() / 60);
  }
  function updateTimeOfDay() {
    state.timeOfDay = computeTimeOfDay();
    root.style.setProperty('--time-of-day', String(state.timeOfDay));
  }
  function signalAtDim(d) {
    const [lo, hi] = findSegment(d);
    const span = hi.at - lo.at;
    const t = span > 0 ? (d - lo.at) / span : 0;
    return `color-mix(in oklch, ${lo.signal}, ${hi.signal} ${(t * 100).toFixed(2)}%)`;
  }
  function updateWordmarkColor() {
    const arts = $('river').querySelectorAll('article');
    let topTime = null;
    const riverTop = state.reaches[state.reachIndex] || 0;
    for (const a of arts) {
      if (a.offsetTop + a.offsetHeight > riverTop + 4) { topTime = a.getAttribute('data-time'); break; }
    }
    if (!topTime) { root.style.setProperty('--word-color', 'var(--signal)'); return; }
    const date = new Date(topTime);
    if (isNaN(date.getTime())) return;
    root.style.setProperty('--word-color', signalAtDim(mapHoursToDim(date.getHours() + date.getMinutes() / 60)));
  }

  /* ---------- wordmark: tap / double-tap / long-press / drag-to-dim ---------- */

  function bindWordmark() {
    const word = $('word');
    const track = $('dim-track');
    if (!word) return;
    let pressed = false, pressTimer = null, pendingTap = null, lastTap = 0;
    let didLong = false, dragging = false, startY = 0, baseDim = 0;

    word.addEventListener('pointerdown', (e) => {
      pressed = true; didLong = false; dragging = false;
      startY = e.clientY; baseDim = state.dim;
      word.classList.add('is-pressing');
      try { word.setPointerCapture(e.pointerId); } catch (_) {}
      pressTimer = setTimeout(() => {
        if (pressed && !dragging) { didLong = true; word.classList.remove('is-pressing'); toggleFocusMode(); }
      }, LONG_MS);
      e.preventDefault();
    });

    word.addEventListener('pointermove', (e) => {
      if (!pressed) return;
      const dy = e.clientY - startY;
      if (!dragging && Math.abs(dy) > DRAG_SLOP) {
        dragging = true; clearTimeout(pressTimer);
        word.classList.remove('is-pressing'); word.classList.add('is-dimming');
        track.classList.add('is-active');
      }
      if (dragging) {
        // Drag down = warmer/dimmer (toward night); drag up = cooler/brighter.
        let next = clamp(baseDim + dy / Math.max(240, window.innerHeight * 0.7), 0, 1);
        // Felt detent: snap to the automatic clock value when close (hand control back).
        if (Math.abs(next - state.timeOfDay) < 0.03) next = state.timeOfDay;
        applyDim(next);
        updateWordmarkColor();
      }
    });

    function end(e) {
      if (!pressed) return;
      pressed = false; clearTimeout(pressTimer);
      try { word.releasePointerCapture(e.pointerId); } catch (_) {}
      word.classList.remove('is-pressing', 'is-dimming');
      if (dragging) { track.classList.remove('is-active'); dragging = false; state.dimOverridden = true; return; } // session-scoped, NOT persisted
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

  // Enter runs folded commands: -@source mutes, `zoom raw|stories|clusters` sets density.
  function runCommand(input) {
    const raw = input.value.trim();
    const low = raw.toLowerCase();
    let m;
    if ((m = low.match(/^-\s*@?\s*(.+)$/))) {
      toggleMute(m[1].trim()); input.value = ''; state.query = ''; render(); updateHash(); return;
    }
    if ((m = low.match(/^(?:zoom|>)\s*:?\s*(raw|stories|clusters)$/))) {
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

  /* ---------- zoom / density dial ---------- */

  function bindZoom() {
    const zoom = $('zoom');
    if (!zoom) return;
    zoom.addEventListener('click', (e) => {
      const btn = e.target.closest('.zoom-notch');
      if (!btn) return;
      setZoom(btn.getAttribute('data-zoom'));
      updateHash();
    });
  }
  function setZoom(z) {
    if (!ZOOMS.includes(z) || z === state.zoom) { reflectZoom(); return; }
    state.zoom = z; state.diveId = null; reflectZoom(); render();
  }
  function reflectZoom() {
    for (const btn of $('zoom').querySelectorAll('.zoom-notch')) {
      btn.setAttribute('aria-checked', String(btn.getAttribute('data-zoom') === state.zoom));
    }
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

    let entries = [];
    if (state.zoom === 'raw') {
      for (const { s, sources } of visible) {
        for (const src of sources) {
          entries.push({ id: `${s.id}:${src.host}`, storyId: s.id, headline: s.headline, time: src.time || s.time,
            section: s.section, sources: [src], primaryUrl: src.url, depth: 1 });
        }
      }
      entries.sort((a, b) => tms(b.time) - tms(a.time));
    } else if (state.zoom === 'clusters') {
      const bySection = new Map();
      for (const v of visible) {
        const k = v.s.section || 'UNFILED';
        if (!bySection.has(k)) bySection.set(k, []);
        bySection.get(k).push(v);
      }
      for (const [section, list] of bySection) {
        const top = list[0];
        entries.push({ id: `cluster:${section}`, storyId: top.s.id, headline: top.s.headline, time: top.s.time,
          section, sources: top.sources, primaryUrl: top.sources[0].url, depth: top.sources.length, clusterCount: list.length });
      }
      entries.sort((a, b) => tms(b.time) - tms(a.time));
    } else {
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
    updateWordmarkColor();
  }

  function renderEntry(e) {
    const head = cleanTitle(e.headline);
    const time = fmtTime(e.time);
    const ageH = Math.max(0, (Date.now() - tms(e.time)) / 3600_000);
    const casl = Math.min(0.7, ageH / 24).toFixed(3);
    const tint = Math.max(0, 1 - ageH / 24).toFixed(3);
    const isRead = state.readSet.has(e.storyId);
    const isSaved = state.savedSet.has(e.storyId);
    const cls = ['', isRead ? ' is-read' : '', isSaved ? ' is-saved' : ''].join('');
    const depthMark = e.depth > 1 ? `<span class="depth" aria-hidden="true">${'·'.repeat(Math.min(4, e.depth))}</span>` : '';
    const sectionTag = state.zoom === 'clusters' ? `<span class="host">${esc(e.section.toLowerCase())} · ${e.clusterCount}</span><span class="sep">·</span>` : '';
    const firstHost = e.sources[0] ? esc(e.sources[0].host) : '';

    let hosts = '';
    if (e.depth > 1) {
      const links = e.sources.map((src) =>
        `<a class="host-link" href="${esc(src.url)}" target="_blank" rel="noopener noreferrer" data-url="${esc(src.url)}" data-host="${esc(src.host)}">${esc(src.name || src.host)}</a>`
      ).join('');
      hosts = `<div class="hosts"><div class="hosts-label">${e.depth} hosts carried this — tap one to leave</div>${links}</div>`;
    }

    return `<article class="${cls.trim()}" data-id="${esc(e.id)}" data-story="${esc(e.storyId)}" data-time="${esc(e.time)}" style="--src-casl:${casl};--article-tint:${tint}">
<h2><a class="head" href="${esc(e.primaryUrl)}" target="_blank" rel="noopener noreferrer">${esc(head)}</a></h2>
<div class="src">${sectionTag}<span class="t">${esc(time)}</span><span class="sep">·</span><span class="host">${firstHost}</span>${depthMark}</div>
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
    updateWordmarkColor();
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
      if (state.isColophonOpen) { if (e.key === 'Escape') { closeColophon(); e.preventDefault(); } return; }

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
    reflectZoom();
    updateTimeOfDay();
    applyDim(computeTimeOfDay());   // session-scoped auto-dim; never persisted

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
    setInterval(updateTimeOfDay, 60_000);
    setInterval(() => { if (!state.dimOverridden) applyDim(state.timeOfDay); }, 5 * 60_000); // drift bg with the clock unless overridden this session

    const visit = () => persistVisit();
    window.addEventListener('beforeunload', visit);
    window.addEventListener('pagehide', visit);
    setInterval(visit, 5 * 60_000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
