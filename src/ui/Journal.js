/**
 * Journal — the file copy.
 *
 * Three tabs, because there are exactly three kinds of evidence in the Annex:
 * paper the building printed, tape somebody recorded, and the plan you are
 * drawing yourself because the building's own plan is wrong.
 *
 *   NOTES  scanned carbon copies. Real paper stock, typed in a typewriter face,
 *          punched, stamped, and sitting fractionally off square — every sheet
 *          gets a deterministic rotation and wear from its own id, so a note
 *          looks the same every time you open it.
 *   TAPES  a transport: two reels that actually turn at the right rate for the
 *          counter, a scrub track, and a transcript that follows the head.
 *   PLAN   hand-drawn, filling in as you explore. Ink over a very faint 4.2 m
 *          structural grid, because the grid is the one thing about this
 *          building that is consistent and the player should half-notice it.
 *
 * The journal renders nothing it does not have. An empty tab says so plainly.
 */

import { el, interactive, stamp, punchHoles, meridianMark } from './theme.js';
import { mmss } from '../core/util.js';

const TABS = [
  { id: 'notes', label: 'Notes' },
  { id: 'tapes', label: 'Tapes' },
  { id: 'plan',  label: 'Plan' },
];

/** Deterministic 0..1 from a string — page wear must not reshuffle per open. */
function h(s, salt = 0) {
  let x = 2166136261 ^ salt;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
  return ((x >>> 0) % 100000) / 100000;
}

export function createJournal({ bus } = {}) {
  const notes = [];
  const tapes = [];
  const plan = { nodes: new Map(), edges: [], here: null, extent: null };
  const state = { tab: 'notes', sel: { notes: 0, tapes: 0, plan: 0 }, playing: false, tapeT: 0 };

  // -- chrome --------------------------------------------------------------
  const tabRail = el('div.ax-jr-tabs');
  const tabNodes = TABS.map((t) => {
    const count = el('span.ax-jr-count.ax-machine');
    const b = el('button.ax-jr-tab', { type: 'button' }, el('span', { text: t.label }), count);
    interactive(b);
    b.addEventListener('click', () => setTab(t.id));
    b._count = count;
    tabRail.appendChild(b);
    return b;
  });

  const index = el('div.ax-jr-index');
  const stage = el('div.ax-jr-stage');
  const emptyNote = el('div.ax-jr-empty.ax-micro');

  const node = el('div.ax-layer.ax-journal',
    el('div.ax-ground'),
    el('div.ax-tone'),
    el('div.ax-vig'),
    el('div.ax-rail.ax-top',
      el('div.ax-menu-brand.ax-rise', meridianMark(15),
        el('div',
          el('div.ax-micro', { text: 'Meridian Facilities Management', style: { color: 'var(--ax-bone-2)' } }),
          el('div.ax-micro', { text: 'File copy · night custodian', style: { marginTop: '6px' } }))),
      el('div.ax-rise', { style: { textAlign: 'right' } },
        el('div.ax-micro', { text: 'Docket' }),
        el('div.ax-machine', { text: '7/CO-2214', style: { marginTop: '7px', color: 'var(--ax-bone-2)' } }))),
    el('div.ax-jr-body',
      el('div.ax-jr-left.ax-rise', tabRail, el('hr.ax-rule.ax-strong'), index, emptyNote),
      el('div.ax-jr-right.ax-rise', stage)),
    el('div.ax-rail.ax-bot',
      el('div.ax-micro.ax-rise', { html: '<span style="color:var(--ax-amber-2)">&#9650;&#9660;</span> file &nbsp; <span style="color:var(--ax-amber-2)">&#9668;&#9658;</span> section &nbsp; <span style="color:var(--ax-amber-2)">SPACE</span> tape transport' }),
      el('div.ax-micro.ax-rise', { text: 'Tab — close file' })));

  // -- tape transport ------------------------------------------------------
  const reelL = reel(), reelR = reel();
  const counter = el('div.ax-tp-counter.ax-machine', { text: '0000' });
  const timeNode = el('div.ax-machine.ax-dim', { text: '0:00 / 0:00' });
  const track = el('div.ax-tp-track');
  const trackFill = el('i'); const head = el('b');
  track.append(trackFill, head);
  const transcript = el('div.ax-tp-transcript');
  const btn = (glyph, title, fn) => {
    const b = el('button.ax-tp-btn', { type: 'button', title }, glyph);
    interactive(b); b.addEventListener('click', fn); return b;
  };
  const playBtn = btn('▶', 'Play', () => togglePlay());
  const transport = el('div.ax-tp',
    el('div.ax-tp-deck',
      reelL.node,
      el('div.ax-tp-window',
        el('div.ax-label', { text: 'Counter' }),
        counter, timeNode),
      reelR.node),
    el('div.ax-tp-ctl',
      btn('◀◀', 'Rewind', () => seek(-10)),
      playBtn,
      btn('■', 'Stop', () => stop()),
      btn('▶▶', 'Forward', () => seek(10)),
      track),
    transcript);

  function reel() {
    const n = el('div.ax-tp-reel');
    n.innerHTML =
      `<svg viewBox="0 0 60 60" width="100%" height="100%">
        <circle cx="30" cy="30" r="28.5" fill="none" stroke="currentColor" stroke-opacity=".55"/>
        <circle cx="30" cy="30" r="21"   fill="none" stroke="currentColor" stroke-opacity=".22"/>
        <g class="hub">
          <circle cx="30" cy="30" r="7.5" fill="none" stroke="currentColor" stroke-opacity=".8"/>
          <path d="M30 3 L30 12 M30 48 L30 57 M3 30 L12 30 M48 30 L57 30" stroke="currentColor" stroke-opacity=".45"/>
          <path d="M11 11 L17 17 M43 43 L49 49 M49 11 L43 17 M17 43 L11 49" stroke="currentColor" stroke-opacity=".28"/>
        </g>
      </svg>`;
    return { node: n, hub: n.querySelector('.hub') };
  }

  // -- plan canvas ---------------------------------------------------------
  const canvas = el('canvas.ax-plan-canvas');
  const planSheet = el('div.ax-sheet.ax-plan-sheet',
    punchHoles(2),
    el('div.ax-plan-head',
      el('div.ax-label', { text: 'Annex 7 — partial plan' }),
      el('div.ax-machine', { text: 'not to scale', style: { opacity: '.6' } })),
    canvas,
    el('div.ax-plan-foot',
      el('span.ax-value', { text: 'Drawn on site. Corrections in ink.' }),
      el('span.ax-machine', { text: 'sheet 1' })));

  // -----------------------------------------------------------------------
  function setTab(id) {
    state.tab = id;
    tabNodes.forEach((b, i) => b.toggleAttribute('data-sel', TABS[i].id === id));
    if (state.playing && id !== 'tapes') stop();
    renderIndex();
    renderStage();
  }

  function list() {
    return state.tab === 'notes' ? notes : state.tab === 'tapes' ? tapes : [];
  }

  function renderIndex() {
    index.innerHTML = '';
    tabNodes[0]._count.textContent = notes.length ? String(notes.length).padStart(2, '0') : '--';
    tabNodes[1]._count.textContent = tapes.length ? String(tapes.length).padStart(2, '0') : '--';
    tabNodes[2]._count.textContent = plan.nodes.size ? String(plan.nodes.size).padStart(2, '0') : '--';

    if (state.tab === 'plan') {
      emptyNote.textContent = plan.nodes.size ? '' : 'No survey recorded';
      const key = (glyph, text) => el('div.ax-jr-key',
        el('span.ax-jr-glyph', { text: glyph }), el('span.ax-value', { text }));
      index.appendChild(el('div.ax-jr-planinfo',
        el('div.ax-micro', { text: 'Surveyed' }),
        el('div.ax-value', { text: `${plan.nodes.size} location${plan.nodes.size === 1 ? '' : 's'}`,
          style: { marginTop: '8px' } }),
        el('div.ax-micro', { text: 'Grid', style: { marginTop: '22px' } }),
        el('div.ax-value', { text: '4.2 m structural', style: { marginTop: '8px' } }),
        el('hr.ax-rule', { style: { margin: '26px 0 16px' } }),
        el('div.ax-micro', { text: 'Key', style: { marginBottom: '12px' } }),
        key('□', 'Room, entered'),
        key('•', 'Junction'),
        key('⊗', 'Lift or shaft'),
        key('✛', 'Last known position'),
        el('hr.ax-rule', { style: { margin: '22px 0 14px' } }),
        el('p.ax-jr-planp', { text:
          'The schedule for this floor is on file and does not agree with this ' +
          'sheet. This sheet was drawn on site.' })));
      return;
    }

    const items = list();
    emptyNote.textContent = items.length ? ''
      : state.tab === 'notes' ? 'Nothing filed' : 'No tapes recovered';

    items.forEach((it, i) => {
      const row = el('button.ax-jr-row', { type: 'button' },
        el('span.ax-jr-ref.ax-machine', { text: it.ref || '—' }),
        el('span.ax-jr-title', { text: it.title }),
        it.unread ? el('span.ax-jr-new') : null);
      interactive(row);
      row.addEventListener('click', () => selectItem(i));
      row.toggleAttribute('data-sel', i === state.sel[state.tab]);
      index.appendChild(row);
    });
  }

  function selectItem(i) {
    const items = list();
    if (!items.length) return;
    state.sel[state.tab] = Math.max(0, Math.min(items.length - 1, i));
    items[state.sel[state.tab]].unread = false;
    if (state.tab === 'tapes') { stop(); state.tapeT = 0; }
    renderIndex();
    renderStage();
  }

  function renderStage() {
    stage.innerHTML = '';
    if (state.tab === 'plan') { stage.appendChild(planSheet); drawPlan(); return; }

    const items = list();
    const it = items[state.sel[state.tab]];
    if (!it) {
      stage.appendChild(el('div.ax-jr-blank',
        el('div.ax-micro', { text: state.tab === 'notes' ? 'No sheet selected' : 'No tape loaded' })));
      return;
    }

    if (state.tab === 'notes') stage.appendChild(noteSheet(it));
    else {
      stage.appendChild(el('div.ax-tp-wrap',
        el('div.ax-tp-title',
          el('div.ax-h2', { text: it.title }),
          el('div.ax-machine.ax-dim', { text: it.ref || '' })),
        transport));
      paintTape(it);
    }
  }

  function noteSheet(n) {
    const rot = (h(n.id, 1) - 0.5) * 1.5;
    const sheet = el('div.ax-sheet.ax-jr-sheet',
      punchHoles(2),
      el('div.ax-jr-sheet-head',
        el('div',
          el('div.ax-label', { text: n.kind || 'Discrepancy log' }),
          el('div.ax-jr-sheet-title', { text: n.title })),
        el('div', { style: { textAlign: 'right' } },
          el('div.ax-machine', { text: n.ref || '' }),
          el('div.ax-machine', { text: n.date || '', style: { opacity: '.6', marginTop: '5px' } }))),
      el('hr.ax-rule'),
      el('div.ax-jr-sheet-body', String(n.body || '').trim().split(/\n{2,}/)
        .map((para) => el('p.ax-jr-p', { text: para.trim() }))),
      n.sign ? el('div.ax-jr-sign',
        el('span.ax-label', { text: 'Signed' }),
        el('span.ax-jr-hand', { text: n.sign })) : null,
      el('div.ax-jr-scan'));
    sheet.style.setProperty('--rot', `${rot.toFixed(2)}deg`);
    if (n.stamp) {
      const s = stamp(n.stamp, { seed: Math.floor(h(n.id, 7) * 900) + 3, rotate: -7 + h(n.id, 9) * 14, sub: n.stampSub });
      s.classList.add('ax-on-paper', 'ax-jr-stamp');
      s.style.right = `${8 + h(n.id, 3) * 16}%`;
      s.style.bottom = `${9 + h(n.id, 4) * 16}%`;
      sheet.appendChild(s);
    }
    return sheet;
  }

  // -- tape ----------------------------------------------------------------
  function currentTape() { return tapes[state.sel.tapes] || null; }

  function paintTape(t = currentTape()) {
    if (!t) return;
    const dur = Math.max(1, t.duration || 60);
    const pos = Math.max(0, Math.min(dur, state.tapeT));
    counter.textContent = String(Math.floor(pos * 6.2)).padStart(4, '0');
    timeNode.textContent = `${mmss(pos)} / ${mmss(dur)}`;
    const f = pos / dur;
    trackFill.style.width = `${f * 100}%`;
    head.style.left = `${f * 100}%`;
    playBtn.textContent = state.playing ? '‖' : '▶';
    playBtn.classList.toggle('ax-tp-on', state.playing);

    transcript.innerHTML = '';
    const lines = t.transcript || [];
    if (!lines.length) {
      transcript.appendChild(el('div.ax-micro.ax-dim', { text: 'No transcript on file' }));
      return;
    }
    let activeNode = null;
    lines.forEach((l, i) => {
      const next = lines[i + 1];
      const on = pos >= l.at && (!next || pos < next.at);
      const past = pos >= l.at;
      const row = el('div.ax-tp-line',
        el('span.ax-tp-at.ax-machine', { text: mmss(l.at) }),
        el('span.ax-tp-who', { text: l.who || '' }),
        el('span.ax-tp-say', { text: l.text }));
      row.toggleAttribute('data-on', on);
      row.toggleAttribute('data-past', past && !on);
      if (on) activeNode = row;
      transcript.appendChild(row);
    });
    if (activeNode) {
      const top = activeNode.offsetTop - transcript.clientHeight * 0.42;
      transcript.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
  }

  function togglePlay() {
    const t = currentTape(); if (!t) return;
    state.playing = !state.playing;
    bus?.emit(state.playing ? 'tape:play' : 'tape:pause', { id: t.id, time: state.tapeT });
    paintTape(t);
  }
  function stop() {
    if (!state.playing) { state.tapeT = 0; paintTape(); return; }
    state.playing = false;
    const t = currentTape();
    state.tapeT = 0;
    bus?.emit('tape:stop', { id: t?.id });
    paintTape();
  }
  function seek(d) {
    const t = currentTape(); if (!t) return;
    state.tapeT = Math.max(0, Math.min(t.duration || 60, state.tapeT + d));
    bus?.emit('tape:seek', { id: t.id, time: state.tapeT });
    paintTape(t);
  }

  // -- plan drawing --------------------------------------------------------
  function drawPlan() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 640, ht = canvas.clientHeight || 380;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(ht * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, ht);

    const nodes = [...plan.nodes.values()];
    if (!nodes.length) {
      g.fillStyle = 'rgba(35,33,26,.36)';
      g.font = '11px "Courier New", monospace';
      g.fillText('nothing surveyed', 18, 30);
      return;
    }

    // Fit the surveyed extent with a margin, keeping the aspect square so the
    // 4.2 m grid stays square — a stretched plan would break the one rule the
    // building keeps.
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (const n of nodes) { minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x); minZ = Math.min(minZ, n.z); maxZ = Math.max(maxZ, n.z); }
    if (plan.here) { minX = Math.min(minX, plan.here.x); maxX = Math.max(maxX, plan.here.x);
      minZ = Math.min(minZ, plan.here.z); maxZ = Math.max(maxZ, plan.here.z); }
    const pad = 8.4;
    minX -= pad; maxX += pad; minZ -= pad; maxZ += pad;
    const s = Math.min((w - 40) / Math.max(maxX - minX, 1), (ht - 44) / Math.max(maxZ - minZ, 1));
    const ox = 20 + ((w - 40) - (maxX - minX) * s) / 2;
    const oz = 22 + ((ht - 44) - (maxZ - minZ) * s) / 2;
    const X = (x) => ox + (x - minX) * s;
    const Z = (z) => oz + (z - minZ) * s;

    // pencil grid, 4.2 m
    g.strokeStyle = 'rgba(35,33,26,.10)'; g.lineWidth = 1;
    g.beginPath();
    for (let x = Math.ceil(minX / 4.2) * 4.2; x < maxX; x += 4.2) { g.moveTo(X(x), 0); g.lineTo(X(x), ht); }
    for (let z = Math.ceil(minZ / 4.2) * 4.2; z < maxZ; z += 4.2) { g.moveTo(0, Z(z)); g.lineTo(w, Z(z)); }
    g.stroke();

    // hand-drawn stroke: two passes with deterministic wobble
    const ink = 'rgba(30,28,22,.80)';
    const wob = (a, b, k) => (h(`${a}|${b}`, k) - 0.5);
    function handLine(x1, y1, x2, y2, key, jitter = 2.4) {
      const segs = Math.max(3, Math.round(Math.hypot(x2 - x1, y2 - y1) / 15));
      for (let pass = 0; pass < 2; pass++) {
        g.beginPath();
        for (let i = 0; i <= segs; i++) {
          const t = i / segs;
          const jx = wob(key + pass, i, 11) * jitter;
          const jy = wob(key + pass, i, 29) * jitter;
          const px = x1 + (x2 - x1) * t + jx, py = y1 + (y2 - y1) * t + jy;
          if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.globalAlpha = pass === 0 ? 0.85 : 0.42;
        g.stroke();
      }
      g.globalAlpha = 1;
    }

    g.strokeStyle = ink; g.lineWidth = 1.35; g.lineCap = 'round';
    for (const [a, b] of plan.edges) {
      const na = plan.nodes.get(a), nb = plan.nodes.get(b);
      if (!na || !nb) continue;
      handLine(X(na.x), Z(na.z), X(nb.x), Z(nb.z), a + b);
    }

    g.font = '10px "Courier New", monospace';
    for (const n of nodes) {
      const x = X(n.x), z = Z(n.z);
      const r = n.kind === 'room' ? 9 : n.kind === 'lift' ? 8 : 4.5;
      g.lineWidth = 1.2;
      if (n.kind === 'room') {
        handLine(x - r, z - r, x + r, z - r, n.id + 'a', 1.4);
        handLine(x + r, z - r, x + r, z + r, n.id + 'b', 1.4);
        handLine(x + r, z + r, x - r, z + r, n.id + 'c', 1.4);
        handLine(x - r, z + r, x - r, z - r, n.id + 'd', 1.4);
      } else if (n.kind === 'lift') {
        handLine(x - r, z - r, x + r, z + r, n.id + 'x', 1.2);
        handLine(x + r, z - r, x - r, z + r, n.id + 'y', 1.2);
        g.beginPath(); g.arc(x, z, r, 0, Math.PI * 2); g.stroke();
      } else {
        g.beginPath(); g.arc(x, z, r, 0, Math.PI * 2); g.fillStyle = ink; g.fill();
      }
    }
    if (plan.here) {
      const x = X(plan.here.x), z = Z(plan.here.z);
      g.strokeStyle = '#8a5a1a'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x - 8, z); g.lineTo(x + 8, z);
      g.moveTo(x, z - 8); g.lineTo(x, z + 8); g.stroke();
      g.beginPath(); g.arc(x, z, 12, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#8a5a1a'; g.font = 'bold 9px "Helvetica Neue", Arial, sans-serif';
      g.fillText('HERE', x + 16, z - 10);
      g.font = '10px "Courier New", monospace';
    }

    // Labels last, over a knocked-out patch of paper — this is a plan somebody
    // annotated after drawing it, so the writing wins over the lines.
    for (const n of nodes) {
      if (!n.label) continue;
      const x = X(n.x), z = Z(n.z);
      const r = n.kind === 'junction' ? 4.5 : 9;
      const wdt = g.measureText(n.label).width;
      const lx = x + r + 6, ly = z + 3.5;
      g.fillStyle = 'rgba(196,187,159,.90)';
      g.fillRect(lx - 3, ly - 9, wdt + 6, 12);
      g.fillStyle = 'rgba(30,28,22,.80)';
      g.fillText(n.label, lx, ly);
    }
  }

  const ro = new ResizeObserver(() => { if (state.tab === 'plan') drawPlan(); });
  ro.observe(canvas);

  // -- public --------------------------------------------------------------
  setTab('notes');

  return {
    node,
    state,
    setTab,
    /** @param {{id,title,body,ref?,date?,kind?,stamp?,stampSub?,sign?}} n */
    addNote(n) {
      if (notes.some((x) => x.id === n.id)) return false;
      notes.push({ unread: true, ...n });
      renderIndex();
      if (state.tab === 'notes' && notes.length === 1) renderStage();
      return true;
    },
    /** @param {{id,title,duration,ref?,transcript?:[{at,who,text}]}} t */
    addTape(t) {
      if (tapes.some((x) => x.id === t.id)) return false;
      tapes.push({ unread: true, duration: 60, transcript: [], ...t });
      renderIndex();
      return true;
    },
    /** Register a surveyed location. Safe to call repeatedly. */
    mapAdd({ id, x, z, label = '', kind = 'junction' }) {
      if (plan.nodes.has(id)) return false;
      plan.nodes.set(id, { id, x, z, label, kind });
      if (state.tab === 'plan') { renderIndex(); drawPlan(); } else renderIndex();
      return true;
    },
    mapLink(a, b) {
      if (plan.edges.some(([p, q]) => (p === a && q === b) || (p === b && q === a))) return;
      plan.edges.push([a, b]);
      if (state.tab === 'plan') drawPlan();
    },
    mapHere(x, z) { plan.here = { x, z }; if (state.tab === 'plan') drawPlan(); },
    /** Audio agent drives the head position; the UI never assumes it. */
    setTapeTime(id, time, playing) {
      const t = currentTape();
      if (!t || t.id !== id) return;
      state.tapeT = time;
      if (playing !== undefined) state.playing = !!playing;
      paintTape(t);
    },
    get unreadCount() { return notes.filter((n) => n.unread).length + tapes.filter((t) => t.unread).length; },
    open() { renderIndex(); renderStage(); if (state.tab === 'plan') requestAnimationFrame(drawPlan); },
    close() { if (state.playing) stop(); },
    update(dt) {
      if (!state.playing) return;
      const t = currentTape(); if (!t) return;
      state.tapeT += dt;
      const spin = state.tapeT * 84;
      reelL.hub.style.transform = `rotate(${spin}deg)`;
      reelR.hub.style.transform = `rotate(${spin * 0.72}deg)`;
      if (state.tapeT >= (t.duration || 60)) { state.tapeT = t.duration || 60; stop(); return; }
      paintTape(t);
    },
    key(code) {
      const items = list();
      switch (code) {
        case 'ArrowLeft': case 'KeyA': {
          const i = TABS.findIndex((t) => t.id === state.tab);
          setTab(TABS[(i - 1 + TABS.length) % TABS.length].id); return true;
        }
        case 'ArrowRight': case 'KeyD': {
          const i = TABS.findIndex((t) => t.id === state.tab);
          setTab(TABS[(i + 1) % TABS.length].id); return true;
        }
        case 'ArrowUp': case 'KeyW': selectItem(state.sel[state.tab] - 1); return true;
        case 'ArrowDown': case 'KeyS': selectItem(state.sel[state.tab] + 1); return true;
        case 'Space': if (state.tab === 'tapes' && items.length) { togglePlay(); return true; } return false;
        default: return false;
      }
    },
    dispose() { ro.disconnect(); },
  };
}

export const JOURNAL_CSS = /* css */ `
.ax-jr-body {
  position: absolute; left: var(--ax-inset); right: var(--ax-inset);
  top: clamp(94px, 14vh, 148px); bottom: clamp(62px, 9vh, 92px);
  display: grid; grid-template-columns: clamp(240px, 25%, 340px) minmax(0, 1fr);
  gap: clamp(26px, 3.4vw, 62px);
}
.ax-jr-left { display: flex; flex-direction: column; min-height: 0; }
.ax-jr-left .ax-rule { margin: 12px 0 4px; }
.ax-jr-right { position: relative; min-width: 0; min-height: 0; display: flex;
  align-items: stretch; }
.ax-jr-stage { display: flex; width: 100%; min-width: 0; min-height: 0; }

.ax-jr-tabs { display: flex; gap: 22px; }
.ax-jr-tab { background: none; border: 0; padding: 0 0 3px; cursor: pointer;
  display: flex; align-items: baseline; gap: 7px;
  font-family: var(--ax-head); font-weight: 700; font-size: 11px; letter-spacing: .30em;
  text-transform: uppercase; color: var(--ax-bone-4);
  transition: color 220ms var(--ax-ease); }
.ax-jr-tab[data-sel] { color: var(--ax-amber); }
.ax-jr-count { font-size: 9px; letter-spacing: .08em; opacity: .55; }

.ax-jr-index { overflow-y: auto; margin-top: 6px; flex: 1 1 auto;
  scrollbar-width: thin; scrollbar-color: rgba(207,200,180,.18) transparent; }
.ax-jr-index::-webkit-scrollbar { width: 3px; }
.ax-jr-index::-webkit-scrollbar-thumb { background: rgba(207,200,180,.18); }
.ax-jr-row { display: flex; align-items: baseline; gap: 12px; width: 100%; text-align: left;
  background: none; border: 0; border-bottom: 1px solid rgba(207,200,180,.09);
  padding: 11px 2px; cursor: pointer; color: inherit;
  transition: background-color 200ms var(--ax-ease); }
.ax-jr-row:hover { background: rgba(207,200,180,.04); }
.ax-jr-row[data-sel] { background: rgba(216,180,90,.07); }
.ax-jr-ref { font-size: 9.5px; letter-spacing: .1em; color: var(--ax-amber-2); min-width: 62px; }
.ax-jr-row[data-sel] .ax-jr-ref { color: var(--ax-amber); }
.ax-jr-title { font-family: var(--ax-head); font-weight: 700; font-size: 10.5px;
  letter-spacing: .20em; text-transform: uppercase; color: var(--ax-bone-2); line-height: 1.5; }
.ax-jr-row[data-sel] .ax-jr-title { color: var(--ax-bone); }
.ax-jr-new { width: 4px; height: 4px; background: var(--ax-amber); margin-left: auto;
  align-self: center; flex: 0 0 auto; }
.ax-jr-empty { padding: 26px 2px; color: var(--ax-bone-4); }
.ax-jr-planinfo { padding: 20px 2px; }
.ax-jr-key { display: flex; align-items: baseline; gap: 12px; padding: 4px 0; }
.ax-jr-glyph { font-family: var(--ax-mono); font-size: 12px; color: var(--ax-amber-2);
  width: 14px; text-align: center; }
.ax-jr-key .ax-value { color: var(--ax-bone-2); font-size: 11.5px; }
.ax-jr-planp { font-family: var(--ax-type); font-size: 11px; line-height: 1.85;
  color: var(--ax-bone-4); margin: 0; }
.ax-jr-blank { margin: auto; }

/* ---- note sheet --------------------------------------------------------- */
.ax-jr-sheet {
  width: min(600px, 100%); height: 100%; overflow: hidden;
  padding: clamp(24px,2.6vw,34px) clamp(30px,3.2vw,44px) clamp(26px,3vw,40px) clamp(48px,4.8vw,66px);
  transform: rotate(var(--rot, -0.5deg)); transform-origin: 50% 50%;
  display: flex; flex-direction: column; flex: 0 0 auto;
}
.ax-jr-sheet-head { display: flex; justify-content: space-between; align-items: flex-start;
  gap: 24px; padding-bottom: 14px; }
.ax-jr-sheet-head .ax-machine { color: rgba(35,33,26,.72); }
.ax-jr-sheet-title { font-family: var(--ax-head); font-weight: 700; font-size: 15px;
  letter-spacing: .22em; text-transform: uppercase; color: var(--ax-paper-ink); margin-top: 9px; }
/* A long sheet scrolls. Masking to transparent lets the sheet's own paper show
   through, so the text fades into the page rather than into the dark ground. */
.ax-jr-sheet-body { padding-top: 18px; overflow-y: auto; flex: 1 1 auto;
  scrollbar-width: thin; scrollbar-color: rgba(35,33,26,.22) transparent;
  -webkit-mask-image: linear-gradient(180deg, #000 0 88%, #0000 99%);
  mask-image: linear-gradient(180deg, #000 0 88%, #0000 99%); }
.ax-jr-sheet-body::-webkit-scrollbar { width: 3px; }
.ax-jr-sheet-body::-webkit-scrollbar-thumb { background: rgba(35,33,26,.24); }
.ax-jr-p { font-family: var(--ax-type); font-size: 13px; line-height: 1.92;
  color: rgba(30,28,22,.92); margin: 0 0 15px; letter-spacing: .008em; }
.ax-jr-p:last-child { margin-bottom: 0; }
.ax-jr-sign { display: flex; align-items: baseline; gap: 14px; margin-top: 18px;
  padding-top: 12px; border-top: 1px solid rgba(35,33,26,.22); }
.ax-jr-hand { font-family: var(--ax-type); font-size: 15px; letter-spacing: .06em;
  color: rgba(30,28,22,.86); transform: rotate(-1.2deg) skewX(-8deg); }
/* the scan: a lifted-page shadow down the bound edge, and platen banding */
.ax-jr-scan { position: absolute; inset: 0; pointer-events: none;
  background:
    linear-gradient(90deg, rgba(0,0,0,.30), rgba(0,0,0,.06) 5%, rgba(0,0,0,0) 13%),
    linear-gradient(0deg, rgba(0,0,0,.13), rgba(0,0,0,0) 16%),
    repeating-linear-gradient(0deg, rgba(0,0,0,.018) 0 2px, rgba(255,255,255,.014) 2px 4px); }
.ax-jr-stamp { position: absolute; }

/* ---- tape transport ----------------------------------------------------- */
.ax-tp-wrap { display: flex; flex-direction: column; width: min(660px, 100%);
  height: 100%; min-height: 0; }
.ax-tp-title { display: flex; justify-content: space-between; align-items: baseline;
  gap: 20px; padding-bottom: 13px; border-bottom: 1px solid var(--ax-rule-2); }
.ax-tp { display: flex; flex-direction: column; min-height: 0; flex: 1 1 auto; }
.ax-tp-deck { display: grid; grid-template-columns: 92px minmax(0,1fr) 92px; align-items: center;
  gap: 22px; padding: 26px 0 20px; }
.ax-tp-reel { width: 92px; height: 92px; color: var(--ax-bone-2); }
.ax-tp-reel .hub { transform-origin: 50% 50%; }
.ax-tp-window { text-align: center; border: 1px solid var(--ax-bone-4); padding: 12px 10px; }
.ax-tp-counter { font-size: 26px; letter-spacing: .22em; color: var(--ax-amber); margin: 7px 0 5px; }
.ax-tp-ctl { display: flex; align-items: center; gap: 8px; padding-bottom: 18px; }
.ax-tp-btn { background: none; border: 1px solid var(--ax-bone-4); color: var(--ax-bone-2);
  width: 34px; height: 26px; font-size: 10px; line-height: 1; cursor: pointer; padding: 0;
  transition: color 200ms var(--ax-ease), border-color 200ms var(--ax-ease); }
.ax-tp-btn:hover { color: var(--ax-amber); border-color: var(--ax-amber-2); }
.ax-tp-btn.ax-tp-on { color: var(--ax-amber); border-color: var(--ax-amber); }
.ax-tp-track { position: relative; flex: 1 1 auto; height: 20px; margin-left: 12px; }
.ax-tp-track::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 12px;
  transform: translateY(-50%);
  background: repeating-linear-gradient(90deg, var(--ax-bone-4) 0 1px, #0000 1px 7px); }
.ax-tp-track i { position: absolute; left: 0; top: 50%; height: 1px; background: var(--ax-amber-2);
  transform: translateY(-50%); }
.ax-tp-track b { position: absolute; top: 50%; width: 2px; height: 18px; background: var(--ax-amber);
  transform: translate(-1px,-50%); transition: left 120ms linear; }

.ax-tp-transcript { overflow-y: auto; padding-top: 16px; border-top: 1px solid var(--ax-bone-4);
  flex: 1 1 auto; min-height: 0; scrollbar-width: thin;
  scrollbar-color: rgba(207,200,180,.18) transparent;
  -webkit-mask-image: linear-gradient(180deg, #000 0 88%, #0000 100%);
  mask-image: linear-gradient(180deg, #000 0 88%, #0000 100%); }
.ax-tp-transcript::-webkit-scrollbar { width: 3px; }
.ax-tp-transcript::-webkit-scrollbar-thumb { background: rgba(207,200,180,.18); }
.ax-tp-line { display: grid; grid-template-columns: 42px 82px minmax(0,1fr); gap: 11px;
  padding: 7px 0; align-items: baseline; opacity: .34;
  transition: opacity 260ms var(--ax-ease); }
.ax-tp-line[data-past] { opacity: .62; }
.ax-tp-line[data-on] { opacity: 1; }
.ax-tp-at { font-size: 9.5px; color: var(--ax-bone-3); }
.ax-tp-who { font-family: var(--ax-head); font-weight: 700; font-size: 9.5px; letter-spacing: .22em;
  text-transform: uppercase; color: var(--ax-bone-3); }
.ax-tp-line[data-on] .ax-tp-who { color: var(--ax-amber); }
.ax-tp-say { font-family: var(--ax-sans); font-size: 13px; line-height: 1.6; color: #e0dac8; }

/* ---- plan --------------------------------------------------------------- */
.ax-plan-sheet { width: 100%; height: 100%; padding: 20px 24px 18px 52px;
  display: flex; flex-direction: column; transform: rotate(-0.3deg); }
.ax-plan-head { display: flex; justify-content: space-between; align-items: baseline;
  padding-bottom: 10px; border-bottom: 1px solid rgba(35,33,26,.26); }
.ax-plan-head .ax-machine { color: rgba(35,33,26,.7); }
.ax-plan-canvas { flex: 1 1 auto; width: 100%; min-height: 0; }
.ax-plan-foot { display: flex; justify-content: space-between; align-items: baseline;
  padding-top: 8px; border-top: 1px solid rgba(35,33,26,.26); }
.ax-plan-foot .ax-machine { color: rgba(35,33,26,.7); }

@media (max-width: 1080px) {
  .ax-jr-body { grid-template-columns: 220px minmax(0,1fr); }
  .ax-tp-deck { grid-template-columns: 72px minmax(0,1fr) 72px; }
  .ax-tp-reel { width: 72px; height: 72px; }
}
`;

export default createJournal;
