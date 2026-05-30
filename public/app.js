/* yak.fish — savant aggregator (v=14)
 *
 * Six surfaces, two faces, five Recursive axes as state channels.
 * See DESIGN.md for the full design system.
 */

(() => {
  'use strict';

  const ENDPOINTS = ['/api/news', '/.netlify/functions/news', 'cache/news.json'];
  const POLL_MS = 60_000;
  const STALE_MS = 5 * 60_000;
  const BUFFER_HOURS = 26;
  const STOP = new Set(['the','a','an','live','update','updates','breaking','and','of','in','on','to','for']);

  /* 18 OKLCH keyframes. Interpolated in CSS via color-mix. */
  const KEYFRAMES = [
    { at: 0.00, bg: '#ecdfca', ink: '#2c1e12', mute: '#7c6a52', signal: '#7a2e18', label: 'paper noon' },
    { at: 0.07, bg: '#e6d8bc', ink: '#2a1d10', mute: '#766548', signal: '#762d16', label: 'linen' },
    { at: 0.14, bg: '#e0d094', ink: '#3a2c14', mute: '#6e5e3a', signal: '#722c14', label: 'citrus study' },
    { at: 0.22, bg: '#d6a648', ink: '#2e1c0c', mute: '#5e4e2a', signal: '#5e2310', label: 'marigold' },
    { at: 0.30, bg: '#c08624', ink: '#281606', mute: '#544022', signal: '#56200e', label: 'amber' },
    { at: 0.36, bg: '#b8662a', ink: '#1e0c04', mute: '#4a3220', signal: '#4a1808', label: 'persimmon' },
    { at: 0.42, bg: '#983e20', ink: '#160a04', mute: '#3e2418', signal: '#3a1004', label: 'sienna' },
    { at: 0.46, bg: '#6e1e1c', ink: '#100404', mute: '#3a1c18', signal: '#d04428', label: 'oxblood threshold' },
    { at: 0.50, bg: '#380a18', ink: '#ecd4a4', mute: '#a8927c', signal: '#e07840', label: 'blood night' },
    { at: 0.55, bg: '#2a1428', ink: '#d8c498', mute: '#a08068', signal: '#dc7034', label: 'plum dusk' },
    { at: 0.60, bg: '#1c1232', ink: '#cebca0', mute: '#988068', signal: '#d06830', label: 'aubergine' },
    { at: 0.66, bg: '#100c44', ink: '#b8b09c', mute: '#908068', signal: '#c8642c', label: 'violet field' },
    { at: 0.72, bg: '#0a124c', ink: '#b4aaa0', mute: '#908068', signal: '#c0602a', label: 'indigo deep' },
    { at: 0.78, bg: '#0a1c4c', ink: '#b4b09c', mute: '#908068', signal: '#b85a2c', label: 'cobalt night' },
    { at: 0.84, bg: '#0a2c34', ink: '#b4b498', mute: '#888068', signal: '#b45a2c', label: 'petrol' },
    { at: 0.90, bg: '#0c1820', ink: '#aca890', mute: '#807060', signal: '#b05828', label: 'slate' },
    { at: 0.96, bg: '#0a0e14', ink: '#a09c84', mute: '#786c5c', signal: '#ac5626', label: 'ink black' },
    { at: 1.00, bg: '#07090c', ink: '#98947c', mute: '#706858', signal: '#a85226', label: 'terminus' }
  ];

  const state = {
    buffer: new Map(),
    endpoint: null,
    query: '',
    updatedAt: null,
    lastSuccess: 0,
    consecutiveFailures: 0,
    sources: [],
    markState: 'initial',
    isFetching: false,
    dim: 0,
    timeOfDay: 0.5,
    firstRendered: false,
    hasVisitedBefore: false,
    isFocusMode: false,
    isColophonOpen: false,
    focusedIdx: -1,
    keySequence: '',
    keySeqTimer: null,
    grainStartTime: Date.now(),
    readSet: new Set(),
    savedSet: new Set(),
    lastVisitISO: null,
    scrollerDragging: false,
    scrollerActiveTimer: null,
    slantDecayTimer: null,
    lastScrollY: 0,
    lastScrollTime: 0,
    breathTimer: null
  };

  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;

  /* ---------- text helpers ---------- */

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['\u2019]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ').filter((w) => w && !STOP.has(w)).join(' ').trim();
  }
  function clusterKey(title) {
    const t = String(title || '').replace(/\s+[\-\|\u2013\u2014]\s+[^\-\|\u2013\u2014]{1,60}$/, '');
    return norm(t).slice(0, 64);
  }
  function cleanTitle(title) {
    const t = String(title || '').replace(/\s+[\-\|\u2013\u2014]\s+[^\-\|\u2013\u2014]{1,60}$/, '').trim();
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

  /* ---------- localStorage ---------- */

  // One-time rebrand migration: wire.* → yakfish.* (read-old, write-new, drop-old).
  // Runs once per device; preserves seen/saved/visit state across the rename.
  function migrateStorage() {
    try {
      if (localStorage.getItem('yakfish.migrated') === '1') return;
      for (const k of ['dim', 'read', 'saved', 'lastVisit', 'visited']) {
        const oldVal = localStorage.getItem('wire.' + k);
        if (oldVal !== null && localStorage.getItem('yakfish.' + k) === null) {
          localStorage.setItem('yakfish.' + k, oldVal);
        }
        localStorage.removeItem('wire.' + k);
      }
      localStorage.setItem('yakfish.migrated', '1');
    } catch (_) {}
  }

  function loadPersisted() {
    try { const s = localStorage.getItem('yakfish.dim'); if (s !== null) state.dim = Number(s) || 0; } catch (_) {}
    try { const r = localStorage.getItem('yakfish.read');  if (r) state.readSet  = new Set(JSON.parse(r)); } catch (_) {}
    try { const s = localStorage.getItem('yakfish.saved'); if (s) state.savedSet = new Set(JSON.parse(s)); } catch (_) {}
    try { state.lastVisitISO = localStorage.getItem('yakfish.lastVisit'); } catch (_) {}
    try { state.hasVisitedBefore = localStorage.getItem('yakfish.visited') === '1'; } catch (_) {}
  }
  function persistDim()   { try { localStorage.setItem('yakfish.dim',   String(state.dim)); } catch (_) {} }
  function persistRead()  { try { const a = [...state.readSet].slice(-500); state.readSet = new Set(a); localStorage.setItem('yakfish.read', JSON.stringify(a)); } catch (_) {} }
  function persistSaved() { try { localStorage.setItem('yakfish.saved', JSON.stringify([...state.savedSet])); } catch (_) {} }
  function persistVisit() { try { localStorage.setItem('yakfish.lastVisit', new Date().toISOString()); } catch (_) {} }
  function persistVisited() { try { localStorage.setItem('yakfish.visited', '1'); } catch (_) {} }

  /* ---------- dim / chromatic ---------- */

  function findSegment(d) {
    for (let i = 0; i < KEYFRAMES.length - 1; i++) {
      if (d >= KEYFRAMES[i].at && d <= KEYFRAMES[i + 1].at) return [KEYFRAMES[i], KEYFRAMES[i + 1]];
    }
    return [KEYFRAMES[KEYFRAMES.length - 1], KEYFRAMES[KEYFRAMES.length - 1]];
  }

  function applyDim(d) {
    const clamped = Math.max(0, Math.min(1, d));
    state.dim = clamped;
    root.style.setProperty('--dim', String(clamped));

    const [lo, hi] = findSegment(clamped);
    const span = hi.at - lo.at;
    const t = span > 0 ? (clamped - lo.at) / span : 0;
    const pct = (t * 100).toFixed(2);

    root.style.setProperty('--bg',     `color-mix(in oklch, ${lo.bg}, ${hi.bg} ${pct}%)`);
    root.style.setProperty('--ink',    `color-mix(in oklch, ${lo.ink}, ${hi.ink} ${pct}%)`);
    root.style.setProperty('--mute',   `color-mix(in oklch, ${lo.mute}, ${hi.mute} ${pct}%)`);
    root.style.setProperty('--signal', `color-mix(in oklch, ${lo.signal}, ${hi.signal} ${pct}%)`);

    const turb = document.getElementById('grain-turb');
    if (turb) {
      const bucket = Math.floor(clamped * 10);
      const freq = (0.65 + clamped * 1.15).toFixed(3);
      if (turb.getAttribute('data-bucket') !== String(bucket)) {
        turb.setAttribute('seed', String(bucket * 7 + 3));
        turb.setAttribute('data-bucket', String(bucket));
      }
      turb.setAttribute('baseFrequency', freq);
    }

    const bar = $('bar');
    if (bar) {
      const label = t < 0.5 ? lo.label : hi.label;
      bar.setAttribute('aria-valuenow', String(Math.round(clamped * 100)));
      bar.setAttribute('aria-valuetext', `${Math.round(clamped * 100)}% — ${label}`);
    }
  }

  /* ---------- time-of-day mapping ---------- */
  /* Anchor curve maps 24h to dim positions matching natural light. */

  function mapHoursToDim(h) {
    const anchors = [
      [0,  0.92], [3,  0.98], [5, 0.02], [8, 0.14],
      [12, 0.32], [15, 0.40], [18, 0.50], [21, 0.66], [24, 0.92]
    ];
    for (let i = 0; i < anchors.length - 1; i++) {
      const [h1, v1] = anchors[i];
      const [h2, v2] = anchors[i + 1];
      if (h >= h1 && h <= h2) {
        const frac = (h - h1) / (h2 - h1);
        return v1 + (v2 - v1) * frac;
      }
    }
    return 0.5;
  }

  function computeTimeOfDay() {
    const now = new Date();
    const h = now.getHours() + now.getMinutes() / 60;
    return mapHoursToDim(h);
  }

  function updateTimeOfDay() {
    state.timeOfDay = computeTimeOfDay();
    root.style.setProperty('--time-of-day', String(state.timeOfDay));
  }

  function signalAtDim(d) {
    const [lo, hi] = findSegment(d);
    const span = hi.at - lo.at;
    const t = span > 0 ? (d - lo.at) / span : 0;
    const pct = (t * 100).toFixed(2);
    return `color-mix(in oklch, ${lo.signal}, ${hi.signal} ${pct}%)`;
  }

  /* ---------- wordmark color from scroll ---------- */
  /* The wordmark's color tracks the time-of-day of the topmost visible
   * article. Computed on scroll, throttled via rAF. */

  function updateWordmarkColorFromScroll() {
    const articles = document.querySelectorAll('#stream article');
    if (!articles.length) {
      root.style.setProperty('--word-color', `var(--signal)`);
      return;
    }
    const headerBottom = $('header').getBoundingClientRect().bottom;
    let topArticle = null;
    for (const a of articles) {
      const rect = a.getBoundingClientRect();
      if (rect.bottom > headerBottom + 8) {
        topArticle = a;
        break;
      }
    }
    if (!topArticle) topArticle = articles[articles.length - 1];
    const tIso = topArticle.getAttribute('data-time');
    if (!tIso) return;
    const date = new Date(tIso);
    if (isNaN(date.getTime())) return;
    const hours = date.getHours() + date.getMinutes() / 60;
    const dimPos = mapHoursToDim(hours);
    root.style.setProperty('--word-color', signalAtDim(dimPos));
  }

  /* ---------- wordmark slant from scroll velocity ---------- */

  function updateSlantFromVelocity() {
    const now = performance.now();
    const dt = now - state.lastScrollTime;
    if (dt > 0 && state.lastScrollTime > 0 && dt < 200) {
      const dy = Math.abs(window.scrollY - state.lastScrollY);
      const velocity = dy / dt;
      const slant = Math.min(3, velocity * 0.8);
      root.style.setProperty('--word-slnt', String(-slant));
      clearTimeout(state.slantDecayTimer);
      state.slantDecayTimer = setTimeout(() => {
        root.style.setProperty('--word-slnt', '0');
      }, 240);
    }
    state.lastScrollY = window.scrollY;
    state.lastScrollTime = now;
  }

  /* ---------- grain scroll-depth ---------- */

  function updateGrainScroll() {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const pct = Math.min(1, Math.max(0, window.scrollY / max));
    root.style.setProperty('--grain-scroll', pct.toFixed(3));
  }

  /* ---------- grain age cycle ---------- */

  function updateGrainAge() {
    const elapsed = Date.now() - state.grainStartTime;
    const age = Math.min(2, elapsed / POLL_MS);
    root.style.setProperty('--grain-age', age.toFixed(3));
  }
  function resetGrain() {
    state.grainStartTime = Date.now();
    root.style.setProperty('--grain-age', '0');
  }

  /* ---------- error tint ---------- */

  function updateErrorTint() {
    const tint = Math.min(1, Math.max(0, (state.consecutiveFailures - 1) / 2));
    root.style.setProperty('--error-tint', String(tint));
    if (state.consecutiveFailures >= 2) {
      root.style.setProperty('--word-wght', '540');
    }
  }

  /* ---------- chromatic bar ---------- */
  /* Drag adjusts --dim. Tap also adjusts to that point. No notches at rest;
   * a vertical light materializes at the current position on touch. */

  function bindBar() {
    const bar = $('bar');
    if (!bar) return;

    let pointerDown = false;
    let downX = 0, downY = 0;
    let movedSignificantly = false;

    function positionFromPointer(e) {
      const rect = bar.getBoundingClientRect();
      const x = e.clientX - rect.left;
      return Math.max(0, Math.min(1, x / rect.width));
    }

    bar.addEventListener('pointerdown', (e) => {
      pointerDown = true;
      downX = e.clientX;
      downY = e.clientY;
      movedSignificantly = false;
      try { bar.setPointerCapture(e.pointerId); } catch (_) {}
      bar.classList.add('is-touched');
      e.preventDefault();
    });

    bar.addEventListener('pointermove', (e) => {
      if (!pointerDown) return;
      const dx = Math.abs(e.clientX - downX);
      const dy = Math.abs(e.clientY - downY);
      if (dx > 4 || dy > 4) {
        if (!movedSignificantly) {
          movedSignificantly = true;
          bar.classList.add('is-dragging');
        }
        applyDim(positionFromPointer(e));
      }
    });

    function endDrag(e) {
      if (!pointerDown) return;
      pointerDown = false;
      try { bar.releasePointerCapture(e.pointerId); } catch (_) {}
      bar.classList.remove('is-dragging');
      if (!movedSignificantly) {
        applyDim(positionFromPointer(e));
      }
      persistDim();
      setTimeout(() => bar.classList.remove('is-touched'), 500);
    }
    bar.addEventListener('pointerup', endDrag);
    bar.addEventListener('pointercancel', endDrag);

    bar.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { applyDim(state.dim - 0.02); persistDim(); e.preventDefault(); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { applyDim(state.dim + 0.02); persistDim(); e.preventDefault(); }
      else if (e.key === 'Home') { applyDim(0); persistDim(); e.preventDefault(); }
      else if (e.key === 'End')  { applyDim(1); persistDim(); e.preventDefault(); }
      else if (e.key === 'Enter' || e.key === ' ') { applyDim(state.timeOfDay); persistDim(); e.preventDefault(); }
    });
  }

  /* ---------- wordmark ---------- */
  /* Tap = refresh + smooth-scroll-to-top (when scrolled).
   * Double-tap = focus filter input (exits focus mode if active).
   * Long-press = enter / exit focus mode (CASL spikes to 1.0). */

  function bindWordmark() {
    const word = $('word');
    if (!word) return;

    let pressed = false;
    let pressTimer = null;
    let pendingTapTimer = null;
    let lastTapTime = 0;
    let didLongPress = false;

    word.addEventListener('pointerdown', (e) => {
      pressed = true;
      didLongPress = false;
      word.classList.add('is-pressing');
      pressTimer = setTimeout(() => {
        if (pressed) {
          didLongPress = true;
          toggleFocusMode();
          root.style.setProperty('--word-casl', '1.0');
          setTimeout(() => {
            root.style.setProperty('--word-casl', state.isFocusMode ? '0.6' : '0.85');
          }, 600);
        }
      }, 500);
      e.preventDefault();
    });

    function release() {
      if (!pressed) return;
      pressed = false;
      clearTimeout(pressTimer);
      word.classList.remove('is-pressing');
      if (didLongPress) return;
      const now = Date.now();
      const isDoubleTap = (now - lastTapTime) < 320;
      lastTapTime = now;
      if (isDoubleTap) {
        clearTimeout(pendingTapTimer);
        if (state.isFocusMode) toggleFocusMode();
        $('prompt').focus();
      } else {
        pendingTapTimer = setTimeout(() => {
          if (window.scrollY > 100) window.scrollTo({ top: 0, behavior: 'smooth' });
          tick(true);
        }, 280);
      }
    }
    word.addEventListener('pointerup', release);
    word.addEventListener('pointercancel', () => {
      pressed = false; clearTimeout(pressTimer); word.classList.remove('is-pressing');
    });
    word.addEventListener('pointerleave', () => {
      if (!pressed) return;
      pressed = false; clearTimeout(pressTimer); word.classList.remove('is-pressing');
    });
    word.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /* ---------- focus mode ---------- */

  function toggleFocusMode() {
    state.isFocusMode = !state.isFocusMode;
    document.body.classList.toggle('is-focus-mode', state.isFocusMode);
  }

  function bindFocusModeExit() {
    document.addEventListener('click', (e) => {
      if (!state.isFocusMode) return;
      if (e.target.closest('#word')) return;
      if (e.target.closest('a')) return;
      if (e.target.closest('#prompt')) return;
      toggleFocusMode();
    });
  }

  /* ---------- vertical scroll slider ---------- */

  function bindScroller() {
    const sc = $('scroller');
    if (!sc) return;

    function getMax() { return Math.max(0, document.documentElement.scrollHeight - window.innerHeight); }
    function syncFromScroll() {
      const max = getMax();
      const pct = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      root.style.setProperty('--scroll-pct', pct.toFixed(4));
      sc.setAttribute('aria-valuenow', String(Math.round(pct * 100)));
    }
    function showActive() {
      sc.classList.add('is-active');
      clearTimeout(state.scrollerActiveTimer);
      state.scrollerActiveTimer = setTimeout(() => {
        if (!state.scrollerDragging) sc.classList.remove('is-active');
      }, 1100);
    }

    /* Pointer drag to scroll. */
    let dragging = false;
    function handlePointer(e) {
      const rect = sc.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const pct = Math.min(1, Math.max(0, y / rect.height));
      window.scrollTo(0, pct * getMax());
    }
    sc.addEventListener('pointerdown', (e) => {
      if (!sc.classList.contains('is-active') && !sc.classList.contains('is-breathing')) {
        sc.classList.add('is-active');
      }
      dragging = true;
      state.scrollerDragging = true;
      sc.classList.add('is-dragging');
      try { sc.setPointerCapture(e.pointerId); } catch (_) {}
      handlePointer(e);
      e.preventDefault();
    });
    sc.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      handlePointer(e);
    });
    function end(e) {
      if (!dragging) return;
      dragging = false;
      state.scrollerDragging = false;
      sc.classList.remove('is-dragging');
      try { sc.releasePointerCapture(e.pointerId); } catch (_) {}
      showActive();
    }
    sc.addEventListener('pointerup', end);
    sc.addEventListener('pointercancel', end);

    /* Keyboard. */
    sc.addEventListener('keydown', (e) => {
      const step = window.innerHeight * 0.3;
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { window.scrollBy({ top: step, behavior: 'smooth' }); e.preventDefault(); }
      else if (e.key === 'ArrowUp' || e.key === 'PageUp') { window.scrollBy({ top: -step, behavior: 'smooth' }); e.preventDefault(); }
      else if (e.key === 'Home') { window.scrollTo({ top: 0, behavior: 'smooth' }); e.preventDefault(); }
      else if (e.key === 'End')  { window.scrollTo({ top: getMax(), behavior: 'smooth' }); e.preventDefault(); }
    });

    /* Scroll listener fires the rAF handler defined elsewhere. */
    window.addEventListener('scroll', () => {
      syncFromScroll();
      showActive();
    }, { passive: true });
    syncFromScroll();
  }

  /* Breath: opacity 0 → 0.18 → 0 over 1.4s, synchronized with the wordmark
   * weight breath during a fetch. */
  function triggerScrollerBreath() {
    const sc = $('scroller');
    if (!sc) return;
    sc.classList.remove('is-breathing');
    void sc.offsetWidth;
    sc.classList.add('is-breathing');
    clearTimeout(state.breathTimer);
    state.breathTimer = setTimeout(() => sc.classList.remove('is-breathing'), 1500);
  }

  /* Wordmark weight breath: 620↔540↔620 over 1.4s */
  function triggerWordmarkBreath() {
    const startTime = performance.now();
    const duration = 1400;
    const baseW = 620;
    const lowW = 540;
    function step(now) {
      const t = (now - startTime) / duration;
      if (t >= 1) {
        root.style.setProperty('--word-wght', String(state.consecutiveFailures >= 2 ? 540 : baseW));
        return;
      }
      const half = t < 0.5 ? (t * 2) : ((1 - t) * 2);
      const eased = 0.5 - 0.5 * Math.cos(half * Math.PI);
      const w = baseW + (lowW - baseW) * eased;
      root.style.setProperty('--word-wght', String(w.toFixed(0)));
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------- pull-to-refresh ---------- */

  function bindPullRefresh() {
    const pr = $('pull-refresh');
    if (!pr) return;
    let startY = null;
    let pulling = false;

    document.addEventListener('touchstart', (e) => {
      if (window.scrollY > 5) return;
      if (state.isColophonOpen) return;
      if (e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      pulling = false;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (startY === null) return;
      if (window.scrollY > 5) { startY = null; return; }
      const dy = e.touches[0].clientY - startY;
      if (dy > 40) {
        if (!pulling) {
          pulling = true;
          pr.classList.add('is-pulling');
        }
      } else if (pulling && dy < 20) {
        pulling = false;
        pr.classList.remove('is-pulling');
      }
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (pulling) {
        tick(true);
        setTimeout(() => pr.classList.remove('is-pulling'), 800);
      }
      startY = null;
      pulling = false;
    }, { passive: true });
  }

  /* ---------- overscroll bottom → colophon ---------- */

  function bindOverscrollColophon() {
    const col = $('colophon');
    if (!col) return;
    let startY = null;
    let dragOffset = 0;
    let dragging = false;

    function atBottom() {
      return (window.scrollY + window.innerHeight) >= (document.documentElement.scrollHeight - 5);
    }

    document.addEventListener('touchstart', (e) => {
      if (state.isColophonOpen) return;
      if (!atBottom()) return;
      if (e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      dragging = false;
      dragOffset = 0;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (startY === null || state.isColophonOpen) return;
      if (!atBottom()) { startY = null; return; }
      const dy = startY - e.touches[0].clientY;
      if (dy > 0) {
        dragOffset = dy;
        if (dy > 20) {
          dragging = true;
          col.classList.add('is-dragging');
          const pct = Math.min(1, dy / 220);
          col.style.transform = `translateY(${(1 - pct) * 100}%)`;
          col.style.opacity = String(pct);
          col.style.pointerEvents = pct > 0.5 ? 'auto' : 'none';
        }
      }
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (!dragging) { startY = null; return; }
      col.classList.remove('is-dragging');
      col.style.transform = '';
      col.style.opacity = '';
      col.style.pointerEvents = '';
      if (dragOffset > 90) {
        openColophon();
      }
      startY = null;
      dragging = false;
      dragOffset = 0;
    }, { passive: true });
  }

  /* ---------- colophon ---------- */

  function openColophon() {
    const col = $('colophon');
    if (!col) return;
    col.classList.add('is-open');
    col.setAttribute('aria-hidden', 'false');
    state.isColophonOpen = true;
  }
  function closeColophon() {
    const col = $('colophon');
    if (!col) return;
    col.classList.remove('is-open');
    col.setAttribute('aria-hidden', 'true');
    state.isColophonOpen = false;
  }
  function bindColophon() {
    document.addEventListener('click', (e) => {
      if (!state.isColophonOpen) return;
      if (e.target.closest('#colophon')) return;
      if (e.target.closest('#bar')) return;
      if (e.target.closest('#word')) return;
      closeColophon();
    });
    document.addEventListener('keydown', (e) => {
      if (state.isColophonOpen && e.key === 'Escape') { closeColophon(); e.preventDefault(); }
    });
  }

  /* ---------- mark state ---------- */

  function setMarkState(next) {
    if (state.markState === next) return;
    state.markState = next;
    const el = $('mark');
    el.classList.remove('is-initial', 'is-fresh', 'is-updating');
    el.classList.add(`is-${next}`);
  }
  function checkStaleness() {
    if (state.isFetching) return;
    if (state.markState === 'initial') return;
    if (!state.lastSuccess) return;
    if (Date.now() - state.lastSuccess > STALE_MS && state.consecutiveFailures > 0) {
      /* Staleness already shows in grain climbing + word-wght drift. */
    }
  }

  /* ---------- fetch ---------- */

  async function tryFetch(ep) {
    const url = `${ep}?t=${Date.now()}`;
    const res = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (!res.ok) throw new Error(`${ep} ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.articles)) throw new Error(`${ep} bad payload`);
    return { data, endpoint: ep };
  }
  async function pull() {
    const ordered = state.endpoint ? [state.endpoint, ...ENDPOINTS.filter((e) => e !== state.endpoint)] : ENDPOINTS;
    for (const ep of ordered) {
      try { return await tryFetch(ep); } catch (_) {}
    }
    return null;
  }
  function ingest(data) {
    const cutoff = Date.now() - BUFFER_HOURS * 3600_000;
    for (const a of data.articles || []) {
      const id = a.recordId || a.id;
      if (!id) continue;
      const t = new Date(a.publishedAt || a.fetchedAt || Date.now()).getTime();
      if (!Number.isFinite(t) || t < cutoff) continue;
      state.buffer.set(id, { ...a, _t: t });
    }
    for (const [id, r] of state.buffer) if (r._t < cutoff) state.buffer.delete(id);
    state.updatedAt = data.updatedAt || new Date().toISOString();
    state.sources = data.sources || [];
  }

  /* ---------- render ---------- */

  function matchesFilter(r) {
    const q = state.query.trim().toLowerCase();
    if (!q) return true;
    if (q === '@saved') return state.savedSet.has(clusterKey(r.title || ''));
    if (q.startsWith('@')) {
      const term = q.slice(1);
      if (!term) return true;
      const host = (r.host || '').toLowerCase();
      const section = (r.section || '').toLowerCase();
      const publisher = (r.publisher || '').toLowerCase();
      return host.includes(term) || section.includes(term) || publisher.includes(term);
    }
    const hay = `${r.title || ''} ${r.publisher || ''} ${r.host || ''} ${r.section || ''}`.toLowerCase();
    return hay.includes(q);
  }

  function buildEntries() {
    const groups = new Map();
    for (const r of state.buffer.values()) {
      if (!matchesFilter(r)) continue;
      const k = clusterKey(r.title || '');
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
    const entries = [];
    for (const [k, list] of groups) {
      list.sort((a, b) => a._t - b._t);
      const seen = new Set();
      const hosts = [];
      for (const r of list) {
        if (!r.host || seen.has(r.host)) continue;
        seen.add(r.host);
        hosts.push({ host: r.host, url: r.url });
      }
      entries.push({
        clusterKey: k,
        first: list[0],
        latest: list[list.length - 1],
        hosts,
        _t: list[list.length - 1]._t
      });
    }
    entries.sort((a, b) => b._t - a._t);
    return entries;
  }

  function render() {
    const entries = buildEntries();
    const streamEl = $('stream');

    const isFirstPaint = !state.firstRendered && entries.length > 0;
    if (isFirstPaint) {
      state.firstRendered = true;
      streamEl.classList.add('first-load');
      setTimeout(() => streamEl.classList.remove('first-load'), 2400);
    }

    if (entries.length === 0) {
      streamEl.innerHTML = state.buffer.size === 0 ? '' : '<p class="empty">no matches</p>';
    } else {
      const lastVisit = state.lastVisitISO ? new Date(state.lastVisitISO).getTime() : 0;
      const parts = [];
      let pulseIdx = 0;
      for (const e of entries) {
        const isRead  = state.readSet.has(e.clusterKey);
        const isSaved = state.savedSet.has(e.clusterKey);
        const isNew   = isFirstPaint && lastVisit > 0 && e._t > lastVisit && !isRead;
        const pulseDelay = isNew ? (pulseIdx++ * 130) + 600 : 0;
        parts.push(renderEntry(e, isRead, isSaved, isNew, pulseDelay));
      }
      streamEl.innerHTML = parts.join('');
    }

    const ok = state.sources.filter((s) => s.status === 'ok').length;
    const tot = state.sources.length;
    const up = fmtTime(state.updatedAt);
    $('status').textContent = tot ? `${ok}/${tot} pipes · updated ${up}` : '—';

    /* After render: update wordmark color, grain scroll. */
    updateWordmarkColorFromScroll();
    updateGrainScroll();
  }

  function renderEntry(e, isRead, isSaved, isNew, pulseDelay) {
    const head = cleanTitle(e.first.title);
    const time = fmtTime(e.first.publishedAt);
    const ageHours = Math.max(0, (Date.now() - e._t) / (1000 * 60 * 60));
    const casl  = Math.min(0.7, ageHours / 24).toFixed(3);
    const tint  = Math.max(0, 1 - ageHours / 24).toFixed(3);
    const hostsHtml = e.hosts.map((h, i) => {
      const sep = i === 0 ? '' : '<span class="sep">·</span>';
      return `${sep}<a href="${esc(h.url)}" target="_blank" rel="noopener noreferrer" data-host="${esc(h.host)}">${esc(h.host)}</a>`;
    }).join('');
    const cls = [];
    if (isRead) cls.push('is-read');
    if (isSaved) cls.push('is-saved');
    if (isNew) cls.push('is-new');
    const clsAttr = cls.length ? ` class="${cls.join(' ')}"` : '';
    const styleVars = `--src-casl:${casl};--article-tint:${tint};${isNew ? `--pulse-delay:${pulseDelay};` : ''}`;
    return `<article${clsAttr} style="${styleVars}" data-cluster="${esc(e.clusterKey)}" data-time="${esc(e.first.publishedAt || new Date(e._t).toISOString())}">
<h2><a href="${esc(e.first.url)}" target="_blank" rel="noopener noreferrer">${esc(head)}</a></h2>
<div class="src"><span class="t">${esc(time)}</span><span class="sep">·</span>${hostsHtml}</div>
</article>`;
  }

  /* ---------- prompt ---------- */

  function bindPrompt() {
    const input = $('prompt');
    input.addEventListener('input', (e) => {
      state.query = e.target.value;
      render();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        input.value = '';
        state.query = '';
        render();
        input.blur();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (document.activeElement === input) return;
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select', 'button'].includes(tag)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (state.isColophonOpen) {
        if (e.key === 'Escape') { closeColophon(); e.preventDefault(); }
        return;
      }
      if (['j', 'k', 'g', 's', 'o', '?', '/'].includes(e.key)) return;
      if (e.key === 'Escape') {
        if (state.query) { input.value = ''; state.query = ''; render(); e.preventDefault(); }
        return;
      }
      if (e.key.length === 1) {
        input.focus();
        input.value += e.key;
        state.query = input.value;
        render();
        e.preventDefault();
      }
    });
  }

  /* ---------- stream interactions ---------- */

  function bindStream() {
    const stream = $('stream');
    if (!stream) return;
    let pressed = false;
    let pressTimer = null;
    let pressArticle = null;
    let downX = 0, downY = 0;
    let didLongPress = false;

    stream.addEventListener('pointerdown', (e) => {
      const art = e.target.closest('article');
      if (!art) return;
      pressed = true;
      didLongPress = false;
      pressArticle = art;
      downX = e.clientX; downY = e.clientY;
      pressTimer = setTimeout(() => {
        if (!pressed) return;
        didLongPress = true;
        const cKey = pressArticle.getAttribute('data-cluster');
        if (cKey) toggleSaved(cKey, pressArticle);
        pressed = false;
      }, 500);
    }, { passive: true });

    stream.addEventListener('pointermove', (e) => {
      if (!pressed) return;
      if (Math.abs(e.clientX - downX) > 8 || Math.abs(e.clientY - downY) > 8) {
        pressed = false;
        clearTimeout(pressTimer);
      }
    }, { passive: true });

    const release = () => { pressed = false; clearTimeout(pressTimer); };
    stream.addEventListener('pointerup', release);
    stream.addEventListener('pointercancel', release);
    stream.addEventListener('pointerleave', release);

    stream.addEventListener('click', (e) => {
      if (didLongPress) { e.preventDefault(); didLongPress = false; return; }
      const a = e.target.closest('a');
      if (!a) return;
      const art = a.closest('article');
      if (!art) return;
      const cKey = art.getAttribute('data-cluster');
      if (cKey && !state.readSet.has(cKey)) {
        state.readSet.add(cKey);
        persistRead();
      }
    });

    stream.addEventListener('contextmenu', (e) => {
      if (e.target.closest('article')) e.preventDefault();
    });
  }

  function toggleSaved(cKey, articleEl) {
    if (state.savedSet.has(cKey)) {
      state.savedSet.delete(cKey);
      articleEl.classList.remove('is-saved');
    } else {
      state.savedSet.add(cKey);
      articleEl.classList.add('is-saved');
    }
    persistSaved();
  }

  /* ---------- keyboard nav ---------- */

  function bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (state.isColophonOpen) return;

      if (e.key === '/') { $('prompt').focus(); e.preventDefault(); return; }
      if (e.key === 'j') { focusNext(1);  e.preventDefault(); return; }
      if (e.key === 'k') { focusNext(-1); e.preventDefault(); return; }
      if (e.key === 's') { saveFocused(); e.preventDefault(); return; }
      if (e.key === 'o') { openFocused(); e.preventDefault(); return; }
      if (e.key === '?') { openColophon(); e.preventDefault(); return; }
      if (e.key === 'g') {
        if (state.keySequence === 'g') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          state.keySequence = '';
          clearTimeout(state.keySeqTimer);
        } else {
          state.keySequence = 'g';
          clearTimeout(state.keySeqTimer);
          state.keySeqTimer = setTimeout(() => { state.keySequence = ''; }, 600);
        }
        e.preventDefault();
        return;
      }
    });
  }

  function focusNext(dir) {
    const articles = [...document.querySelectorAll('#stream article')];
    if (articles.length === 0) return;
    articles.forEach((a) => a.classList.remove('is-focused'));
    state.focusedIdx = Math.max(0, Math.min(articles.length - 1, state.focusedIdx + dir));
    const el = articles[state.focusedIdx];
    el.classList.add('is-focused');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function saveFocused() {
    const articles = [...document.querySelectorAll('#stream article')];
    if (state.focusedIdx < 0 || state.focusedIdx >= articles.length) return;
    const el = articles[state.focusedIdx];
    const cKey = el.getAttribute('data-cluster');
    if (cKey) toggleSaved(cKey, el);
  }
  function openFocused() {
    const articles = [...document.querySelectorAll('#stream article')];
    if (state.focusedIdx < 0 || state.focusedIdx >= articles.length) return;
    const el = articles[state.focusedIdx];
    const link = el.querySelector('h2 a');
    if (!link) return;
    const cKey = el.getAttribute('data-cluster');
    if (cKey && !state.readSet.has(cKey)) { state.readSet.add(cKey); persistRead(); }
    window.open(link.href, '_blank', 'noopener,noreferrer');
  }

  /* ---------- scroll handler ---------- */

  let scrollRafPending = false;
  function onScroll() {
    if (scrollRafPending) return;
    scrollRafPending = true;
    requestAnimationFrame(() => {
      scrollRafPending = false;
      updateWordmarkColorFromScroll();
      updateGrainScroll();
      updateSlantFromVelocity();
    });
  }

  /* ---------- initial paint entrance ---------- */

  function entrancePaint() {
    if (state.hasVisitedBefore) return;
    document.body.classList.add('first-paint');

    const startTime = performance.now();
    const duration = 1000;
    const startW = 300;
    const endW = 620;
    function step(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const w = startW + (endW - startW) * eased;
      root.style.setProperty('--word-wght', String(w.toFixed(0)));
      if (t < 1) requestAnimationFrame(step);
      else {
        setTimeout(() => {
          document.body.classList.remove('first-paint');
          persistVisited();
        }, 600);
      }
    }
    requestAnimationFrame(step);
  }

  /* ---------- poll / tick ---------- */

  async function tick(manual) {
    if (state.isFetching) return;
    state.isFetching = true;
    setMarkState('updating');
    triggerWordmarkBreath();
    triggerScrollerBreath();
    const r = await pull();
    state.isFetching = false;
    if (r) {
      state.endpoint = r.endpoint;
      state.lastSuccess = Date.now();
      state.consecutiveFailures = 0;
      updateErrorTint();
      ingest(r.data);
      render();
      setMarkState('fresh');
      resetGrain();
    } else {
      state.consecutiveFailures += 1;
      updateErrorTint();
      setMarkState('fresh');
      render();
    }
  }

  /* ---------- boot ---------- */

  function boot() {
    migrateStorage();
    loadPersisted();
    if (state.dim === 0 && !localStorage.getItem('yakfish.dim')) {
      state.dim = computeTimeOfDay();
    }
    updateTimeOfDay();
    applyDim(state.dim);
    updateWordmarkColorFromScroll();

    bindBar();
    bindWordmark();
    bindPrompt();
    bindStream();
    bindKeyboard();
    bindColophon();
    bindScroller();
    bindPullRefresh();
    bindOverscrollColophon();
    bindFocusModeExit();

    window.addEventListener('scroll', onScroll, { passive: true });

    entrancePaint();
    setMarkState('initial');
    tick();
    setInterval(tick, POLL_MS);
    setInterval(checkStaleness, 30_000);
    setInterval(updateTimeOfDay, 60_000);
    setInterval(updateGrainAge, 2_000);

    const persistVisitNow = () => persistVisit();
    window.addEventListener('beforeunload', persistVisitNow);
    window.addEventListener('pagehide', persistVisitNow);
    setInterval(persistVisitNow, 5 * 60_000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
