/**
 * Settings — Meridian form 12B, "Contractor preferences".
 *
 * Values persist to localStorage under `annex.settings` and apply live: nothing
 * here needs a confirm step, because a setting you cannot feel while you change
 * it is a setting you will get wrong.
 *
 * Applying is deliberately split. Anything the UI/cinematics agent owns is
 * applied directly (FOV, sensitivity, quality, subtitles, prompt style, motion
 * scaling of our own animation). Everything else is broadcast on the bus as
 * `ui:settings` so the audio and gameplay systems can pick up what they own.
 */

import { el, field, interactive, DUR } from './theme.js';

const KEY = 'annex.settings';

export const DEFAULTS = {
  sensitivity: 1.00,   // multiplier on Input's base sensitivity
  invertY: false,
  fov: 66,             // vertical degrees
  quality: 'auto',     // auto | low | medium | high
  volMaster: 0.85,
  volMusic: 0.55,
  volSfx: 0.90,
  subtitles: true,
  motion: 1.00,        // 1 = full head motion, 0 = bob and shake off
  safePrompts: false,  // colour-blind-safe: shape + word tokens, not colour alone
};

const BASE_SENSITIVITY = 0.0021;

export function loadSettings() {
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { stored = {}; }
  const out = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) {
    if (stored[k] === undefined) continue;
    if (typeof DEFAULTS[k] === 'number') out[k] = Number(stored[k]);
    else if (typeof DEFAULTS[k] === 'boolean') out[k] = !!stored[k];
    else out[k] = stored[k];
  }
  return out;
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode */ }
}

// ---------------------------------------------------------------------------

const SCHEMA = [
  { group: 'Look', items: [
    { id: 'sensitivity', name: 'Mouse sensitivity', kind: 'range', min: 0.20, max: 3.00, step: 0.05,
      format: (v) => v.toFixed(2) + '×' },
    { id: 'invertY', name: 'Invert vertical', kind: 'toggle' },
    { id: 'fov', name: 'Field of view', kind: 'range', min: 58, max: 92, step: 1,
      format: (v) => Math.round(v) + '°' },
    { id: 'motion', name: 'Head motion', kind: 'range', min: 0, max: 1, step: 0.1,
      format: (v) => (v <= 0.001 ? 'OFF' : v >= 0.999 ? 'FULL' : Math.round(v * 100) + '%') },
  ] },
  { group: 'Display', items: [
    { id: 'quality', name: 'Quality tier', kind: 'choice', options: ['auto', 'low', 'medium', 'high'],
      label: { auto: 'Auto', low: 'Low', medium: 'Med', high: 'High' } },
  ] },
  { group: 'Sound', items: [
    { id: 'volMaster', name: 'Master', kind: 'range', min: 0, max: 1, step: 0.05, format: pct },
    { id: 'volMusic', name: 'Score', kind: 'range', min: 0, max: 1, step: 0.05, format: pct },
    { id: 'volSfx', name: 'Effects', kind: 'range', min: 0, max: 1, step: 0.05, format: pct },
  ] },
  { group: 'Accessibility', items: [
    { id: 'subtitles', name: 'Subtitles', kind: 'toggle' },
    { id: 'safePrompts', name: 'High-contrast prompts', kind: 'toggle' },
  ] },
];

function pct(v) { return v <= 0.001 ? 'MUTE' : Math.round(v * 100) + '%'; }

// ---------------------------------------------------------------------------

export function createSettings({ bus, engine, player, input, onClose }) {
  const values = loadSettings();
  const rows = [];
  let sel = 0;
  let owner = 'menu';   // which screen opened us, so BACK returns there

  const body = el('div.ax-set-body');
  const cols = [el('div.ax-set-col'), el('div.ax-set-col')];
  body.append(cols[0], cols[1]);

  SCHEMA.forEach((group, gi) => {
    const target = cols[gi < 2 ? 0 : 1];
    target.appendChild(el('div.ax-set-group.ax-rise',
      el('div.ax-h2', { text: group.group }),
      el('hr.ax-rule.ax-strong')));
    for (const item of group.items) target.appendChild(makeRow(item, target));
  });

  function makeRow(item) {
    const name = el('div.ax-ctl-n', { text: item.name });
    let mid, val;

    if (item.kind === 'range') {
      const fill = el('i'), knob = el('b');
      mid = el('div.ax-track', fill, knob);
      val = el('div.ax-ctl-v');
      mid.addEventListener('pointerdown', (e) => {
        const box = mid.getBoundingClientRect();
        const t = Math.max(0, Math.min(1, (e.clientX - box.left) / box.width));
        setValue(item, item.min + t * (item.max - item.min), true);
        selectRow(rows.findIndex((r) => r.item === item));
      });
      mid._paint = (v) => {
        const t = (v - item.min) / (item.max - item.min);
        fill.style.width = `${t * 100}%`;
        knob.style.left = `${t * 100}%`;
      };
    } else if (item.kind === 'toggle') {
      const off = el('span', { text: 'Off' }), on = el('span', { text: 'On' });
      mid = el('div.ax-seg', off, on);
      val = el('div.ax-ctl-v');
      off.addEventListener('pointerdown', () => setValue(item, false, true));
      on.addEventListener('pointerdown', () => setValue(item, true, true));
      mid._paint = (v) => {
        off.toggleAttribute('data-on', !v);
        on.toggleAttribute('data-on', !!v);
      };
    } else {
      const spans = item.options.map((o) => {
        const s = el('span', { text: item.label?.[o] || o });
        s.addEventListener('pointerdown', () => setValue(item, o, true));
        return s;
      });
      mid = el('div.ax-seg', spans);
      val = el('div.ax-ctl-v');
      mid._paint = (v) => spans.forEach((s, i) => s.toggleAttribute('data-on', item.options[i] === v));
    }

    const row = el('div.ax-ctl.ax-rise', name, mid, val);
    interactive(row);
    row.addEventListener('pointerenter', () => selectRow(rows.findIndex((r) => r.item === item)));
    const rec = { item, node: row, mid, val };
    rows.push(rec);
    return row;
  }

  function paint(item) {
    const rec = rows.find((r) => r.item === item);
    if (!rec) return;
    const v = values[item.id];
    rec.mid._paint(v);
    if (item.kind === 'range') rec.val.textContent = item.format(v);
    else if (item.kind === 'toggle') rec.val.textContent = v ? 'YES' : 'NO';
    else rec.val.textContent = '';
  }

  function setValue(item, v, apply = true) {
    if (item.kind === 'range') {
      v = Math.round(v / item.step) * item.step;
      v = Math.max(item.min, Math.min(item.max, v));
      v = Math.round(v * 1000) / 1000;
    }
    if (values[item.id] === v) return;
    values[item.id] = v;
    paint(item);
    saveSettings(values);
    if (apply) applyAll();
    bus?.emit('ui:setting', { id: item.id, value: v });
  }

  function selectRow(i) {
    if (i < 0 || i >= rows.length) return;
    rows[sel]?.node.removeAttribute('data-sel');
    sel = i;
    rows[sel].node.setAttribute('data-sel', '');
  }

  function nudge(dir) {
    const { item } = rows[sel];
    if (item.kind === 'range') setValue(item, values[item.id] + dir * item.step);
    else if (item.kind === 'toggle') setValue(item, dir > 0);
    else {
      const i = item.options.indexOf(values[item.id]);
      setValue(item, item.options[Math.max(0, Math.min(item.options.length - 1, i + dir))]);
    }
  }

  // -- live application ----------------------------------------------------
  function applyAll() {
    if (input) {
      input.sensitivity = BASE_SENSITIVITY * values.sensitivity;
      input.invertY = values.invertY;
    }
    if (player) player.fovBase = values.fov;
    else engine?.setFov?.(values.fov);
    if (engine && values.quality !== 'auto') {
      engine.autoQuality = false;
      engine.setQuality(values.quality);
    } else if (engine) {
      engine.autoQuality = true;
    }
    document.documentElement.style.setProperty('--ax-motion', String(values.motion));
    bus?.emit('ui:settings', { ...values });
  }

  // -- screen chrome -------------------------------------------------------
  const backBtn = el('button.ax-item', { type: 'button' }, 'Back');
  interactive(backBtn);
  backBtn.addEventListener('click', () => close());

  const root = el('div.ax-layer.ax-settings',
    el('div.ax-ground'),
    el('div.ax-tone'),
    el('div.ax-rail.ax-top',
      el('div.ax-rise',
        el('div.ax-micro', { text: 'Meridian Facilities Management' }),
        el('div.ax-h1', { text: 'Contractor preferences', style: { marginTop: '9px' } })),
      el('div.ax-rise', { style: { textAlign: 'right' } },
        el('div.ax-micro', { text: 'Form 12B' }),
        el('div.ax-machine.ax-dim', { text: 'REV. 11 / 03-94', style: { marginTop: '8px' } }))),
    body,
    el('div.ax-rail.ax-bot',
      el('div.ax-set-hint.ax-rise', { html:
        '<span>&#9650;&#9660;</span> select &nbsp;&nbsp; <span>&#9668;&#9658;</span> adjust &nbsp;&nbsp; <span>ESC</span> back' }),
      el('div.ax-rise', backBtn)));

  function close() {
    saveSettings(values);
    onClose?.(owner);
  }

  applyAll();
  for (const g of SCHEMA) for (const i of g.items) paint(i);
  selectRow(0);

  return {
    node: root,
    values,
    get: (k) => values[k],
    open(from = 'menu') { owner = from; selectRow(0); },
    applyAll,
    /** @returns {boolean} true if the key was consumed */
    key(code) {
      switch (code) {
        case 'ArrowUp': case 'KeyW': selectRow((sel - 1 + rows.length) % rows.length); return true;
        case 'ArrowDown': case 'KeyS': selectRow((sel + 1) % rows.length); return true;
        case 'ArrowLeft': case 'KeyA': nudge(-1); return true;
        case 'ArrowRight': case 'KeyD': nudge(1); return true;
        case 'Enter': case 'Space': nudge(1); return true;
        case 'Escape': close(); return true;
        default: return false;
      }
    },
  };
}

export const SETTINGS_CSS = /* css */ `
.ax-set-body {
  position: absolute; left: var(--ax-pad); right: var(--ax-pad);
  top: clamp(112px, 17vh, 168px); bottom: clamp(78px, 11vh, 108px);
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(34px, 5vw, 92px); align-content: start;
}
.ax-set-col { display: grid; align-content: start; gap: 0; min-width: 0; }
.ax-set-group { margin: 22px 0 6px; }
.ax-set-group:first-child { margin-top: 0; }
.ax-set-group .ax-rule { margin-top: 8px; }
.ax-set-hint { font-family: var(--ax-head); font-weight: 700; font-size: 9px;
  letter-spacing: .26em; text-transform: uppercase; color: var(--ax-bone-4); }
.ax-set-hint span { color: var(--ax-amber-2); }
.ax-settings .ax-ctl { grid-template-columns: minmax(0,1fr) clamp(120px,12vw,172px) 62px; }
`;

export default createSettings;
