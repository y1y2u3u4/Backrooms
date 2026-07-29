/**
 * Pause — "work suspended".
 *
 * Dims with a DOM scrim rather than the grade's fade, so the world behind keeps
 * rendering: fluorescents keep flickering, grain keeps moving, water keeps
 * catching the light. A pause screen over a frozen still is a screenshot; a
 * pause screen over a room that is still alive is unnerving, which is free.
 *
 * Carries the two things a player who walked away for ten minutes actually
 * needs: what they were doing, and which key does what.
 */

import { el, field, interactive, meridianMark } from './theme.js';

const CONTROLS = [
  ['W A S D', 'Move'],
  ['Shift', 'Run — loud'],
  ['Ctrl / C', 'Crouch — near silent'],
  ['Q · R', 'Lean left · right'],
  ['E', 'Interact · hold where shown'],
  ['F', 'Lamp'],
  ['Tab / J', 'Journal'],
  ['O', 'Recall task'],
  ['G', 'Set down carried item'],
  ['Esc', 'Suspend work'],
];

const ACTIONS = [
  { id: 'resume', label: 'Resume work' },
  { id: 'journal', label: 'Journal' },
  { id: 'settings', label: 'Settings' },
  { id: 'abandon', label: 'Abandon shift' },
];

export function createPause({ onSelect }) {
  let sel = 0;

  const buttons = ACTIONS.map((a, i) => {
    const b = el('button.ax-item', { type: 'button' }, a.label);
    interactive(b);
    b.addEventListener('pointerenter', () => select(i));
    b.addEventListener('click', () => onSelect?.(a.id));
    return b;
  });

  function select(i) {
    buttons[sel]?.removeAttribute('data-sel');
    sel = (i + buttons.length) % buttons.length;
    buttons[sel].setAttribute('data-sel', '');
  }

  const fTask = field('Current task', '—');
  const fCores = field('Fuse cores', '0 of 3', { mono: true });
  const fZone = field('Location', '—');
  const clock = el('div.ax-machine', { text: '02:47' });

  const node = el('div.ax-layer.ax-pause',
    el('div.ax-scrim'),
    el('div.ax-tone', { style: { opacity: '.36' } }),
    el('div.ax-vig'),
    el('div.ax-rail.ax-top',
      el('div.ax-menu-brand.ax-rise', meridianMark(15),
        el('div',
          el('div.ax-micro', { text: 'Meridian Facilities Management', style: { color: 'var(--ax-bone-2)' } }),
          el('div.ax-micro', { text: 'Attendance record', style: { marginTop: '6px' } }))),
      el('div.ax-rise', { style: { textAlign: 'right' } },
        el('div.ax-micro', { text: 'On site since' }), clock)),

    el('div.ax-pause-body',
      el('div.ax-pause-l',
        el('div.ax-micro.ax-rise', { text: 'Job 7/CO-2214' }),
        el('h2.ax-display.ax-pause-title.ax-rise', { text: 'Work suspended' }),
        el('hr.ax-rule.ax-strong.ax-wipe', { style: { margin: '22px 0 6px' } }),
        el('div.ax-rise', fTask, fCores, fZone),
        el('div.ax-menu.ax-pause-menu.ax-rise', buttons)),
      el('div.ax-pause-r.ax-rise',
        el('div.ax-h2', { text: 'Standing instructions' }),
        el('hr.ax-rule.ax-strong', { style: { margin: '10px 0 4px' } }),
        el('div.ax-pause-keys',
          CONTROLS.map(([k, v]) => el('div.ax-pause-key',
            el('span.ax-pause-k', { text: k }),
            el('span.ax-leader'),
            el('span.ax-value', { text: v })))))),

    el('div.ax-rail.ax-bot',
      el('div.ax-micro.ax-rise', { text: 'Meridian FM · form 7A · rev. 11' }),
      el('div.ax-micro.ax-rise', { text: 'Esc — return to work' })));

  return {
    node,
    open({ task = '', cores = '0 of 3', zone = '', elapsed = 0 } = {}) {
      fTask._value.textContent = task || 'Unassigned';
      fCores._value.textContent = cores;
      fZone._value.textContent = zone || 'Unrecorded';
      const m = 134 + Math.floor(elapsed / 60);
      clock.textContent = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      select(0);
    },
    key(code) {
      switch (code) {
        case 'ArrowUp': case 'KeyW': select(sel - 1); return true;
        case 'ArrowDown': case 'KeyS': select(sel + 1); return true;
        case 'Enter': case 'Space': case 'KeyE': onSelect?.(ACTIONS[sel].id); return true;
        default: return false;
      }
    },
  };
}

export const PAUSE_CSS = /* css */ `
/* Dark enough to read against, transparent enough that the fluorescents behind
   it keep flickering. Anything above about .80 and the world stops moving. */
.ax-pause .ax-scrim { background: rgba(5,4,3,.78); }
.ax-pause-body {
  position: absolute; left: var(--ax-inset); right: var(--ax-inset);
  top: clamp(96px, 15vh, 150px); bottom: clamp(70px, 10vh, 100px);
  display: grid; grid-template-columns: minmax(0,1.05fr) minmax(0,.95fr);
  gap: clamp(40px, 6vw, 110px); align-content: start;
}
.ax-pause-title { font-size: clamp(30px, 3.4vw, 50px); letter-spacing: .22em; margin-top: 16px; }
.ax-pause-l .ax-field { padding: 6px 0; }
.ax-pause-menu { margin-top: clamp(26px, 4vh, 44px); }
.ax-pause-r { padding-top: 6px; }
.ax-pause-keys { display: grid; }
.ax-pause-key { display: flex; align-items: baseline; gap: 12px; padding: 6px 0;
  border-bottom: 1px solid rgba(207,200,180,.08); }
.ax-pause-k { font-family: var(--ax-mono); font-size: 10.5px; letter-spacing: .1em;
  color: var(--ax-amber); min-width: 84px; white-space: nowrap; }
.ax-pause-key .ax-value { color: var(--ax-bone-2); }
.ax-pause-r .ax-h2 { color: var(--ax-bone-2); }

@media (max-width: 1100px) {
  .ax-pause-body { grid-template-columns: minmax(0,1fr); gap: 26px; }
  .ax-pause-r { display: none; }
}
`;

export default createPause;
