/**
 * Loading — a Meridian job docket filling itself in.
 *
 * Constraints that shaped this:
 *
 *  - It must be able to hold indefinitely without lying. So there is no
 *    spinner and no fake progress. What moves while we wait is a real clock
 *    ("time on site") and a print caret. If the build stalls at 62% the sheet
 *    honestly reads 62% and the clock keeps running, which is exactly what a
 *    night custodian sitting in a corridor would be looking at.
 *  - It must not flash. The ground is near-black and the ink is bone, because
 *    this is the first thing the player ever sees and the game behind it is a
 *    dark building.
 *  - It is in fiction. Procedure steps are jobs, not engine subsystems; the
 *    engine's own progress messages land in REMARKS where arbitrary strings
 *    can live without breaking the layout.
 */

import { el, field, stamp, meridianMark, DUR } from './theme.js';

/** Procedure steps, keyed to the boot progress fractions main.js reports. */
const PROCEDURE = [
  { at: 0.00, name: 'Attend site' },
  { at: 0.04, name: 'Energise survey equipment' },
  { at: 0.06, name: 'Record surfaces' },
  { at: 0.70, name: 'Mix finishes' },
  { at: 0.74, name: 'Raise structure' },
  { at: 0.92, name: 'Settle dust' },
  { at: 0.99, name: 'Sign on' },
];

const BLOCKS = 14;

export function createLoading({ title = 'Job docket', ref = '7/CO-2214' } = {}) {
  let p = 0, t0 = performance.now(), raf = 0, finished = false;

  const stepNodes = PROCEDURE.map((s, i) => {
    const status = el('span.ax-load-status', { text: '' });
    const row = el('div.ax-load-step',
      el('span.ax-load-no', { text: String(i + 1).padStart(2, '0') }),
      el('span.ax-load-name', { text: s.name }),
      el('span.ax-leader'),
      status);
    row._status = status;
    return row;
  });

  const bar = el('div.ax-load-bar');
  const blocks = [];
  for (let i = 0; i < BLOCKS; i++) { const b = el('i'); blocks.push(b); bar.appendChild(b); }

  const pctNode = el('span.ax-machine.ax-hot', { text: '  0%' });
  const clockNode = el('span.ax-machine', { text: '0:00' });
  const remarks = el('span.ax-load-remarks', { text: 'attending' });
  const caret = el('span.ax-caret');

  const attended = stamp('Attended', { seed: 5, rotate: 3.4, sub: 'MERIDIAN FM' });
  attended.classList.add('ax-load-stamp');

  const sheet = el('div.ax-load-sheet',
    el('div.ax-feed.ax-l'), el('div.ax-feed.ax-r'),
    el('div.ax-load-head',
      el('div.ax-load-brand', meridianMark(13),
        el('span.ax-micro', { text: 'Meridian Facilities Management' })),
      el('span.ax-micro', { text: 'Night maintenance' })),
    el('hr.ax-rule.ax-strong'),
    el('div.ax-load-title',
      el('div.ax-h1', { text: title }),
      el('div.ax-machine.ax-dim', { text: ref })),
    el('hr.ax-rule'),
    el('div.ax-load-fields',
      field('Site', 'Annex 7 — lower ground'),
      field('Call received', '02:14'),
      field('Fault', 'Three-phase supply, goods lift'),
      field('Contractor', 'Name withheld')),
    el('hr.ax-rule'),
    el('div.ax-label', { text: 'Procedure', style: { margin: '16px 0 6px' } }),
    el('div.ax-load-steps', stepNodes),
    el('hr.ax-rule', { style: { marginTop: '14px' } }),
    el('div.ax-load-foot',
      el('div.ax-load-foot-l',
        el('span.ax-label', { text: 'Progress' }),
        bar, pctNode),
      el('div.ax-load-foot-r',
        el('span.ax-label', { text: 'Time on site' }),
        clockNode)),
    el('div.ax-load-remarks-row',
      el('span.ax-label', { text: 'Remarks' }), remarks, caret),
    attended);

  const node = el('div.ax-layer.ax-loading',
    el('div.ax-ground.ax-solid'),
    el('div.ax-tone'),
    el('div.ax-vig'),
    sheet,
    el('div.ax-rail.ax-bot',
      el('div.ax-micro', { text: 'Form 7A · rev. 11' }),
      el('div.ax-micro', { text: 'Retain this copy' })));

  function paint() {
    const pc = Math.max(0, Math.min(1, p));
    for (let i = 0; i < BLOCKS; i++) blocks[i].toggleAttribute('data-on', (i + 1) / BLOCKS <= pc + 1e-4);
    pctNode.textContent = `${String(Math.round(pc * 100)).padStart(3, ' ')}%`;

    for (let i = 0; i < PROCEDURE.length; i++) {
      const s = PROCEDURE[i];
      const next = PROCEDURE[i + 1];
      const done = next ? pc >= next.at : pc >= 1;
      const active = !done && pc >= s.at;
      stepNodes[i].toggleAttribute('data-done', done);
      stepNodes[i].toggleAttribute('data-active', active);
      stepNodes[i]._status.textContent = done ? 'Complete' : active ? 'In hand' : '—';
    }
  }

  function tick() {
    const s = (performance.now() - t0) / 1000;
    clockNode.textContent = `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    raf = requestAnimationFrame(tick);
  }

  paint();

  return {
    node,
    show() {
      t0 = performance.now();
      if (!raf) raf = requestAnimationFrame(tick);
      requestAnimationFrame(() => node.classList.add('ax-on'));
    },
    /** @param {number} v 0..1  @param {string} msg free text, shown as remarks */
    progress(v, msg) {
      p = Math.max(p, Math.max(0, Math.min(1, v || 0)));
      if (msg) remarks.textContent = String(msg);
      paint();
    },
    /** Stamp the docket and fade out. Resolves when the screen is gone. */
    finish() {
      if (finished) return Promise.resolve();
      finished = true;
      p = 1; paint();
      remarks.textContent = 'signed on';
      caret.style.display = 'none';
      node.classList.add('ax-stamped');
      return new Promise((res) => setTimeout(() => {
        node.classList.remove('ax-on');
        setTimeout(() => { cancelAnimationFrame(raf); raf = 0; res(); }, DUR.veil);
      }, 900));
    },
    fail(err) {
      remarks.textContent = `job abandoned — ${String(err && err.message || err)}`;
      remarks.classList.add('ax-load-fail');
      caret.style.display = 'none';
    },
    dispose() { cancelAnimationFrame(raf); raf = 0; node.remove(); },
  };
}

export const LOADING_CSS = /* css */ `
.ax-loading .ax-ground { background-color: #050403; }
.ax-load-sheet {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%) rotate(-0.4deg);
  width: min(760px, 78vw); padding: clamp(22px,2.6vw,34px) clamp(30px,3.4vw,46px);
  border: 1px solid var(--ax-bone-4);
  background: linear-gradient(180deg, rgba(207,200,180,.028), rgba(207,200,180,.008) 42%, rgba(0,0,0,0));
  opacity: 0; transform-origin: 50% 50%;
  transition: opacity 620ms var(--ax-ease);
}
.ax-loading.ax-on .ax-load-sheet { opacity: 1; }

/* tractor-feed edges */
.ax-feed { position: absolute; top: 8px; bottom: 8px; width: 5px;
  background: repeating-linear-gradient(180deg, var(--ax-bone-4) 0 5px, #0000 5px 17px); }
.ax-feed.ax-l { left: 9px; } .ax-feed.ax-r { right: 9px; }

.ax-load-head { display: flex; justify-content: space-between; align-items: center; gap: 20px;
  padding-bottom: 13px; }
.ax-load-brand { display: flex; align-items: center; gap: 10px; }
.ax-load-brand .ax-micro { color: var(--ax-bone-2); }
.ax-load-title { display: flex; justify-content: space-between; align-items: baseline;
  padding: 14px 0 12px; }
.ax-load-fields { padding: 10px 0 4px; }
.ax-load-fields .ax-field { padding: 4px 0; }

.ax-load-steps { display: grid; }
.ax-load-step { display: flex; align-items: baseline; gap: 11px; padding: 3px 0;
  color: var(--ax-bone-4); transition: color 260ms var(--ax-ease); }
.ax-load-step[data-active] { color: var(--ax-amber); }
.ax-load-step[data-done] { color: var(--ax-bone-2); }
.ax-load-no { font-family: var(--ax-mono); font-size: 10px; letter-spacing: .1em; opacity: .7; }
.ax-load-name { font-family: var(--ax-head); font-weight: 700; font-size: 10.5px;
  letter-spacing: .26em; text-transform: uppercase; white-space: nowrap; }
.ax-load-status { font-family: var(--ax-type); font-size: 11.5px; white-space: nowrap; }

.ax-load-foot { display: flex; justify-content: space-between; align-items: center;
  gap: 26px; padding-top: 14px; }
.ax-load-foot-l, .ax-load-foot-r { display: flex; align-items: center; gap: 12px; }
.ax-load-bar { display: flex; gap: 2px; }
.ax-load-bar i { display: block; width: 12px; height: 9px; background: rgba(207,200,180,.10);
  transition: background-color 220ms var(--ax-ease); }
.ax-load-bar i[data-on] { background: var(--ax-amber); }

.ax-load-remarks-row { display: flex; align-items: center; gap: 12px; padding-top: 13px; }
.ax-load-remarks { font-family: var(--ax-type); font-size: 12px; color: var(--ax-bone-2);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ax-load-fail { color: #b4614f; }

.ax-load-stamp { right: clamp(26px,3.4vw,54px); bottom: clamp(54px,7vh,86px);
  opacity: 0; transform: rotate(var(--rot)) scale(1.08);
  transition: opacity 420ms var(--ax-ease), transform 420ms cubic-bezier(.16,.9,.3,1); }
.ax-loading.ax-stamped .ax-load-stamp { opacity: .72; transform: rotate(var(--rot)) scale(1); }

@media (max-height: 620px) {
  .ax-load-sheet { width: min(720px, 84vw); padding: 20px 30px; }
  .ax-load-fields .ax-field { padding: 2px 0; }
}
`;

export default createLoading;
