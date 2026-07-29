/**
 * Title screen.
 *
 * Composed as a poster, not a panel: a weighted scrim opens from the left so
 * the live drifting camera stays visible down the right two-thirds of frame,
 * and every element hangs off one left margin. The only things that break the
 * grid are the stamp (0.4 deg off true, printed slightly off its box) and the
 * baseline rule, which runs full bleed and dies out toward the right edge.
 *
 * Interaction is keyboard-first with mouse parity. Nothing here animates on a
 * loop except the selection tick.
 */

import { el, interactive, stamp, meridianMark } from './theme.js';
import { creditsColumn } from './credits.js';

const ITEMS = [
  { id: 'begin',    label: 'Begin',    note: 'Open a new job docket. Attendance is logged.' },
  { id: 'continue', label: 'Continue', note: 'Resume docket 7/CO-2214 from the last countersignature.' },
  { id: 'settings', label: 'Settings', note: 'Form 12B — contractor preferences.' },
  { id: 'credits',  label: 'Credits',  note: 'Staffing schedule and site record.' },
];

export function createMenu({ onSelect, hasSave = () => false }) {
  let sel = 0;
  let view = 'root';   // root | credits

  const noteLine = el('div.ax-menu-note.ax-machine');
  const list = el('div.ax-menu');
  const buttons = ITEMS.map((it, i) => {
    const note = el('span.ax-note');
    const b = el('button.ax-item', { type: 'button' }, it.label, note);
    interactive(b);
    b.addEventListener('pointerenter', () => select(i));
    b.addEventListener('click', () => activate());
    b._note = note;
    list.appendChild(b);
    return b;
  });

  function refreshEnabled() {
    const can = !!hasSave();
    buttons[1].disabled = !can;
    buttons[1]._note.textContent = can ? '' : 'No record on file';
    if (!can && sel === 1) select(0);
  }

  function select(i) {
    if (i < 0 || i >= buttons.length) return;
    if (buttons[i].disabled && i !== sel) { /* still selectable, just inert */ }
    buttons[sel]?.removeAttribute('data-sel');
    sel = i;
    buttons[sel].setAttribute('data-sel', '');
    noteLine.textContent = buttons[sel].disabled ? 'This docket has not been opened.' : ITEMS[sel].note;
  }

  function move(d) {
    let i = sel;
    for (let n = 0; n < buttons.length; n++) {
      i = (i + d + buttons.length) % buttons.length;
      if (!buttons[i].disabled) break;
    }
    select(i);
  }

  function activate() {
    if (buttons[sel].disabled) return;
    onSelect?.(ITEMS[sel].id);
  }

  // -- credits sub-view ----------------------------------------------------
  const creditsBack = el('button.ax-item', { type: 'button' }, 'Back');
  interactive(creditsBack);
  creditsBack.addEventListener('click', () => showView('root'));

  const creditsView = el('div.ax-menu-credits',
    el('div.ax-h1', { text: 'Staffing schedule' }),
    el('div.ax-micro.ax-dim', { text: 'Annex 7 · night operations · sheet 1 of 1',
      style: { marginTop: '10px', marginBottom: '20px' } }),
    creditsColumn(),
    el('div', { style: { marginTop: '26px' } }, creditsBack));

  const rootView = el('div.ax-menu-root',
    el('h1.ax-display.ax-rise', { text: 'The Annex' }),
    el('div.ax-menu-rule.ax-wipe'),
    el('div.ax-menu-sub.ax-rise',
      el('span.ax-micro', { text: 'Annex 7' }),
      el('span.ax-menu-dot'),
      el('span.ax-micro', { text: 'Lower ground and below' }),
      el('span.ax-menu-dot'),
      el('span.ax-micro', { text: 'Night call-out' })),
    el('div.ax-menu-list.ax-rise', list),
    noteLine);

  const stampNode = stamp('Night shift', { seed: 11, rotate: -5.2, sub: '02:14  ·  03 / 94' });
  stampNode.classList.add('ax-menu-stamp');

  const node = el('div.ax-layer.ax-menu-layer',
    el('div.ax-menu-scrim'),
    el('div.ax-tone', { style: { opacity: '.34' } }),
    el('div.ax-vig'),
    el('div.ax-rail.ax-top',
      el('div.ax-menu-brand.ax-rise', meridianMark(15),
        el('div',
          el('div.ax-micro', { text: 'Meridian Facilities Management', style: { color: 'var(--ax-bone-2)' } }),
          el('div.ax-micro', { text: 'Building services · night operations', style: { marginTop: '6px' } }))),
      el('div.ax-rise', { style: { textAlign: 'right' } },
        el('div.ax-micro', { text: 'Job' }),
        el('div.ax-machine', { text: '7/CO-2214', style: { marginTop: '7px', color: 'var(--ax-bone-2)' } }))),
    stampNode,
    rootView,
    creditsView,
    el('div.ax-rail.ax-bot',
      el('div.ax-micro.ax-rise', { text: 'Form 7A · rev. 11 · retain this copy' }),
      el('div.ax-micro.ax-rise', { text: 'Unrecoverable if closed' })));

  function showView(v) {
    view = v;
    rootView.toggleAttribute('data-off', v !== 'root');
    creditsView.toggleAttribute('data-on', v === 'credits');
    stampNode.toggleAttribute('data-off', v !== 'root');
  }

  select(0);
  showView('root');

  return {
    node,
    open() { refreshEnabled(); showView('root'); select(hasSave() ? 1 : 0); },
    showCredits() { showView('credits'); },
    refreshEnabled,
    get view() { return view; },
    key(code) {
      if (view === 'credits') {
        if (code === 'Escape' || code === 'Enter' || code === 'Space') { showView('root'); return true; }
        return false;
      }
      switch (code) {
        case 'ArrowUp': case 'KeyW': move(-1); return true;
        case 'ArrowDown': case 'KeyS': move(1); return true;
        case 'Enter': case 'Space': case 'KeyE': activate(); return true;
        default: return false;
      }
    },
  };
}

export const MENU_CSS = /* css */ `
.ax-menu-layer { }
.ax-menu-scrim {
  position: absolute; inset: 0;
  background:
    linear-gradient(97deg, rgba(5,4,3,.95) 0%, rgba(5,4,3,.90) 24%, rgba(5,4,3,.58) 47%,
                            rgba(5,4,3,.20) 70%, rgba(5,4,3,.34) 100%),
    linear-gradient(0deg, rgba(4,3,2,.86) 0%, rgba(4,3,2,0) 34%);
}
.ax-menu-brand { display: flex; gap: 13px; align-items: flex-start; }
.ax-menu-brand .ax-mark { margin-top: 1px; }

.ax-menu-root { position: absolute; left: var(--ax-pad); top: 40%; width: min(52ch, 46vw); }
.ax-menu-root[data-off] { opacity: 0; transform: translateY(-8px); pointer-events: none;
  transition: opacity 260ms var(--ax-ease), transform 260ms var(--ax-ease); }
.ax-menu-root .ax-display { margin-left: -.06em; }

.ax-menu-rule { position: absolute; left: 0; right: -60vw; height: 1px; margin-top: 20px;
  background: linear-gradient(90deg, var(--ax-rule-2) 0%, var(--ax-rule) 34%, rgba(207,200,180,0) 82%); }
.ax-menu-sub { display: flex; align-items: center; gap: 12px; margin-top: 34px; flex-wrap: wrap;
  transition-delay: 90ms; }
.ax-menu-dot { width: 3px; height: 3px; background: var(--ax-amber-2); flex: 0 0 auto; }
.ax-menu-list { margin-top: clamp(28px, 4.4vh, 46px); transition-delay: 170ms; }
.ax-menu-list .ax-item { padding-right: 30px; }
.ax-menu-note { margin-top: 20px; font-size: 10.5px; letter-spacing: .1em;
  color: var(--ax-bone-4); min-height: 1.4em; }

.ax-menu-stamp { right: clamp(60px, 9vw, 190px); top: clamp(96px, 17vh, 190px); }
.ax-menu-stamp[data-off] { opacity: 0; transition: opacity 240ms var(--ax-ease); }

.ax-menu-credits {
  position: absolute; left: var(--ax-pad); top: clamp(104px, 16vh, 160px);
  width: min(62ch, 54vw); max-height: 68vh; overflow: hidden;
  opacity: 0; transform: translateY(10px); pointer-events: none;
  transition: opacity 320ms var(--ax-ease), transform 320ms var(--ax-ease);
}
.ax-menu-credits[data-on] { opacity: 1; transform: none; pointer-events: auto; }

@media (max-height: 700px) {
  .ax-menu-root { top: 36%; }
  .ax-menu-sub { margin-top: 26px; }
}
`;

export default createMenu;
