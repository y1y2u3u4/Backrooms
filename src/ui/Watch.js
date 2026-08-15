/**
 * Night Watch readout.
 *
 * The mode is scored on time, so the time has to be on screen — a survival
 * challenge whose number you cannot see is not a challenge, it is a mood. This
 * is the one place in this game's UI that is allowed to be permanent, and it is
 * allowed because it is the objective rather than a decoration of one.
 *
 * Three things, in the order a player needs them:
 *
 *   ON SHIFT 07:14        how long you have lasted — the score, live
 *   PLANT HIGH BAY  0:38  the way that is open and how long it has left
 *   BEST 11:02            what you are trying to beat
 *
 * The fault line is the only part that shouts. It goes amber under thirty
 * seconds and red under twelve, because the margin is the only number in the
 * mode a player has to act on and reading a countdown off a monospace clock in
 * a dark corridor while something walks toward you is not a reasonable ask.
 *
 * Deliberately NOT a minimap, a marker or an arrow. It tells you which way has
 * dropped and which board carries it; finding the board is the game.
 */

import { el } from './theme.js';

export const WATCH_CSS = `
.ax-watch { position:absolute; top:0; right:0; padding:22px 26px; text-align:right;
  pointer-events:none; opacity:0; transition:opacity .35s ease; }
.ax-watch[data-on] { opacity:1; }
.ax-watch-label { letter-spacing:.16em; opacity:.55; font-size:11px; }
.ax-watch-clock { font-size:30px; line-height:1.05; letter-spacing:.04em; }
.ax-watch-best { font-size:12px; opacity:.5; margin-top:2px; }
.ax-watch-faults { margin-top:12px; display:flex; flex-direction:column; gap:5px; align-items:flex-end; }
.ax-watch-fault { font-size:13px; letter-spacing:.06em; padding:3px 9px;
  border-right:2px solid currentColor; opacity:.85; }
.ax-watch-fault[data-urgency="warn"] { color:#e8a33d; opacity:1; }
.ax-watch-fault[data-urgency="crit"] { color:#e2513a; opacity:1;
  animation:ax-watch-pulse .9s steps(2, end) infinite; }
@keyframes ax-watch-pulse { 50% { opacity:.35; } }
`;

const mmss = (s) => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

const BEST_KEY = 'annex.watch.best';

export function createWatch() {
  const clock = el('div.ax-watch-clock.ax-machine', { text: '0:00' });
  const best = el('div.ax-watch-best.ax-machine', { text: '' });
  const faults = el('div.ax-watch-faults');
  const node = el('div.ax-layer.ax-watch',
    el('div.ax-watch-label.ax-micro', { text: 'On shift' }),
    clock, best, faults);

  let bestSeconds = 0;
  try { bestSeconds = parseFloat(localStorage.getItem(BEST_KEY) || '0') || 0; } catch { bestSeconds = 0; }
  const paintBest = () => { best.textContent = bestSeconds > 0 ? `BEST ${mmss(bestSeconds)}` : ''; };
  paintBest();

  const rows = new Map();   // circuit -> { node, label }

  return {
    node,
    show(on = true) { if (on) node.setAttribute('data-on', ''); else node.removeAttribute('data-on'); },

    /** @param {number} seconds elapsed */
    time(seconds) { clock.textContent = mmss(seconds); },

    /**
     * @param {Array<{circuit:string,label:string,margin:number}>} open
     */
    faults(open) {
      const seen = new Set();
      for (const f of open) {
        seen.add(f.circuit);
        let row = rows.get(f.circuit);
        if (!row) {
          row = { node: el('div.ax-watch-fault.ax-machine') };
          faults.appendChild(row.node);
          rows.set(f.circuit, row);
        }
        row.node.textContent = `${f.label}  ${mmss(f.margin)}`;
        row.node.dataset.urgency = f.margin < 12 ? 'crit' : f.margin < 30 ? 'warn' : 'ok';
      }
      for (const [c, row] of rows) {
        if (!seen.has(c)) { row.node.remove(); rows.delete(c); }
      }
    },

    /** Returns `{ seconds, best, record }`. */
    finish(seconds) {
      const record = seconds > bestSeconds;
      if (record) {
        bestSeconds = seconds;
        try { localStorage.setItem(BEST_KEY, String(Math.floor(seconds))); } catch { /* private mode */ }
        paintBest();
      }
      return { seconds, best: bestSeconds, record };
    },

    get best() { return bestSeconds; },
  };
}

export default createWatch;
