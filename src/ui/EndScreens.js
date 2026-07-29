/**
 * Death and ending.
 *
 * Both are Meridian paperwork, because the horror of this building is that it
 * is administered. You do not get a "YOU DIED" card; you get a form somebody
 * filled in about you, and the form is already stamped.
 *
 * The death screen is the tail of the capture cinematic — the sequence holds a
 * plate of white noise slightly too long, cuts to black, and then this fades up
 * over about half a second. It never appears without that lead-in.
 */

import { el, field, interactive, stamp, meridianMark } from './theme.js';
import { creditsColumn } from './credits.js';

const CAUSES = {
  surveyor: {
    title: 'Not recovered',
    cause: 'Attended by site survey',
    remark: 'Contractor ceased to log discrepancies at 03:12. Lamp recovered from the ' +
      'corridor, still lit, still warm. No other effects on site.\n\n' +
      'Replacement raised against the same docket. The building does not require a new number.',
  },
  water: {
    title: 'Not recovered',
    cause: 'Standing water, lower level',
    remark: 'Depth at the last logged position exceeded the figure on the schedule by ' +
      'a little over a metre. The schedule has not been revised.',
  },
  fall: {
    title: 'Not recovered',
    cause: 'Fall, plant level',
    remark: 'Gantry handrail noted as deficient on four previous sheets. Each sheet was ' +
      'countersigned and filed.',
  },
  unknown: {
    title: 'Not recovered',
    cause: 'Undetermined',
    remark: 'No discrepancy logged. No fault raised. Attendance ends here on the record ' +
      'and the record is the only thing that is kept.',
  },
};

const DEATH_ACTIONS = [
  { id: 'respawn', label: 'Report to the Office of Record' },
  { id: 'menu', label: 'Abandon shift' },
];

export function createDeath({ onSelect }) {
  let sel = 0;
  const buttons = DEATH_ACTIONS.map((a, i) => {
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

  const titleNode = el('h2.ax-display.ax-death-title.ax-rise');
  const fPersonnel = field('Personnel', '7/CO-2214 — name withheld');
  const fLast = field('Last logged', '—');
  const fCause = field('Cause', '—');
  const fTime = field('Time', '03:12', { mono: true });
  const remarkNode = el('div.ax-death-remark.ax-rise');
  const unresolved = stamp('Unresolved', { seed: 23, rotate: -4.2, sub: 'FILE OPEN' });
  unresolved.classList.add('ax-death-stamp');

  const node = el('div.ax-layer.ax-death',
    el('div.ax-ground.ax-solid'),
    el('div.ax-tone'),
    el('div.ax-vig'),
    el('div.ax-rail.ax-top',
      el('div.ax-menu-brand.ax-rise', meridianMark(15),
        el('div',
          el('div.ax-micro', { text: 'Meridian Facilities Management', style: { color: 'var(--ax-bone-2)' } }),
          el('div.ax-micro', { text: 'Incident report · form 19', style: { marginTop: '6px' } }))),
      el('div.ax-rise', { style: { textAlign: 'right' } },
        el('div.ax-micro', { text: 'Sheet' }),
        el('div.ax-machine', { text: '19/001', style: { marginTop: '7px', color: 'var(--ax-bone-2)' } }))),
    el('div.ax-death-body',
      el('div.ax-micro.ax-rise', { text: 'Attendance closed' }),
      titleNode,
      el('hr.ax-rule.ax-strong.ax-wipe', { style: { margin: '24px 0 8px' } }),
      el('div.ax-rise', fPersonnel, fLast, fCause, fTime),
      remarkNode,
      el('div.ax-menu.ax-death-menu.ax-rise', buttons)),
    unresolved,
    el('div.ax-rail.ax-bot',
      el('div.ax-micro.ax-rise', { text: 'Copy 3 of 3 — retained on site' }),
      el('div.ax-micro.ax-rise', { text: 'Countersignature pending' })));

  return {
    node,
    /** @param {{cause?:string, location?:string, elapsed?:number}} info */
    open(info = {}) {
      const c = CAUSES[info.cause] || CAUSES.unknown;
      titleNode.textContent = c.title;
      fCause._value.textContent = c.cause;
      fLast._value.textContent = info.location || 'Lower ground, unrecorded corridor';
      const m = 134 + Math.floor((info.elapsed || 0) / 60);
      fTime._value.textContent = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      remarkNode.innerHTML = '';
      for (const p of c.remark.split('\n\n')) remarkNode.appendChild(el('p.ax-death-p', { text: p }));
      select(0);
    },
    key(code) {
      switch (code) {
        case 'ArrowUp': case 'KeyW': select(sel - 1); return true;
        case 'ArrowDown': case 'KeyS': select(sel + 1); return true;
        case 'Enter': case 'Space': case 'KeyE': onSelect?.(DEATH_ACTIONS[sel].id); return true;
        default: return false;
      }
    },
  };
}

// ---------------------------------------------------------------------------

const ENDINGS = {
  lift: {
    card: 'Shift ended',
    time: '05:41',
    line: 'The goods lift reached the loading yard. The yard was where it should be.',
    coda: 'Annex 7 remains on the Meridian schedule.',
  },
  stayed: {
    card: 'Shift extended',
    time: '—',
    line: 'You signed the sheet, filed the copy, and went back down.',
    coda: 'Annex 7 remains on the Meridian schedule.',
  },
};

/**
 * Ending sequence: title card, then the staffing schedule scrolling at reading
 * speed, then a coda. Driven from `update(dt)` rather than a CSS animation so
 * it survives a pause and can be scrubbed by the sequencer.
 */
export function createEnding({ onDone }) {
  let t = 0, phase = 'idle', id = 'lift', scroll = 0;

  const cardTitle = el('h2.ax-display.ax-end-title');
  const cardTime = el('div.ax-machine.ax-end-time');
  const cardLine = el('div.ax-end-line');
  const card = el('div.ax-end-card',
    el('div.ax-micro', { text: 'Meridian Facilities Management' }),
    cardTitle, cardTime, el('hr.ax-rule.ax-strong', { style: { margin: '22px 0' } }), cardLine);

  const roll = creditsColumn();
  const rollWrap = el('div.ax-end-roll',
    el('div.ax-end-roll-inner',
      el('div.ax-h1', { text: 'Staffing schedule' }),
      el('div.ax-micro.ax-dim', { text: 'Annex 7 · night operations', style: { margin: '12px 0 26px' } }),
      roll,
      el('div', { style: { height: '18vh' } })));
  const rollInner = rollWrap.firstChild;

  const codaNode = el('div.ax-end-coda',
    el('div.ax-end-coda-line'),
    el('div.ax-display.ax-end-logo', { text: 'The Annex' }));

  const node = el('div.ax-layer.ax-ending',
    el('div.ax-ground.ax-solid'),
    el('div.ax-tone'),
    el('div.ax-vig'),
    card, rollWrap, codaNode);

  function setPhase(p) {
    phase = p; t = 0;
    node.setAttribute('data-phase', p);
  }

  return {
    node,
    /** @param {string} endingId key into ENDINGS */
    play(endingId = 'lift') {
      id = ENDINGS[endingId] ? endingId : 'lift';
      const e = ENDINGS[id];
      cardTitle.textContent = e.card;
      cardTime.textContent = e.time;
      cardLine.textContent = e.line;
      codaNode.firstChild.textContent = e.coda;
      scroll = 0; rollInner.style.transform = 'translateY(0)';
      setPhase('card');
    },
    skip() {
      if (phase === 'card') setPhase('roll');
      else if (phase === 'roll') setPhase('coda');
      else if (phase === 'coda') { setPhase('idle'); onDone?.(id); }
    },
    update(dt) {
      if (phase === 'idle') return;
      t += dt;
      if (phase === 'card' && t > 6.5) setPhase('roll');
      else if (phase === 'roll') {
        scroll += dt * 26;
        rollInner.style.transform = `translateY(${-scroll}px)`;
        const max = rollInner.scrollHeight - rollWrap.clientHeight;
        if (scroll >= max + 40) setPhase('coda');
      } else if (phase === 'coda' && t > 9) { setPhase('idle'); onDone?.(id); }
    },
    key(code) {
      if (code === 'Enter' || code === 'Space' || code === 'Escape') { this.skip(); return true; }
      return false;
    },
    get phase() { return phase; },
  };
}

export const END_CSS = /* css */ `
/* ---- death -------------------------------------------------------------- */
.ax-death-body { position: absolute; left: var(--ax-inset); top: clamp(112px, 17vh, 176px);
  width: min(58ch, 52vw); }
.ax-death-title { font-size: clamp(32px, 3.8vw, 58px); letter-spacing: .20em; margin-top: 16px; }
.ax-death-body .ax-field { padding: 6px 0; }
.ax-death-remark { margin-top: 26px; max-width: 52ch;
  opacity: 0; transform: translateY(9px);
  transition: opacity 520ms var(--ax-ease) 260ms, transform 520ms var(--ax-ease) 260ms; }
.ax-on .ax-death-remark { opacity: 1; transform: none; }
.ax-death-p { font-family: var(--ax-type); font-size: 12.5px; line-height: 1.95;
  color: var(--ax-bone-2); margin: 0 0 14px; }
.ax-death-menu { margin-top: clamp(24px, 4vh, 42px); }
.ax-death-stamp { right: calc(var(--ax-inset) + clamp(30px, 8vw, 220px)); top: clamp(150px, 30vh, 320px);
  --scale: 2.1; transform: rotate(var(--rot)) scale(2.1); transform-origin: 50% 50%;
  opacity: 0; transition: opacity 620ms var(--ax-ease) 700ms; }
.ax-on .ax-death-stamp { opacity: .58; }

/* ---- ending ------------------------------------------------------------- */
.ax-end-card { position: absolute; left: var(--ax-inset); top: 34%; width: min(56ch, 52vw);
  opacity: 0; transform: translateY(10px);
  transition: opacity 900ms var(--ax-ease), transform 900ms var(--ax-ease); }
.ax-ending[data-phase="card"] .ax-end-card { opacity: 1; transform: none; }
.ax-end-title { font-size: clamp(34px, 4.2vw, 64px); letter-spacing: .22em; margin-top: 14px; }
.ax-end-time { font-size: 13px; letter-spacing: .3em; color: var(--ax-amber); margin-top: 16px; }
.ax-end-line { font-family: var(--ax-type); font-size: 13px; line-height: 1.9; color: var(--ax-bone-2);
  max-width: 46ch; }

.ax-end-roll { position: absolute; left: var(--ax-inset); right: var(--ax-inset);
  top: 14vh; bottom: 10vh; overflow: hidden; opacity: 0;
  transition: opacity 700ms var(--ax-ease);
  -webkit-mask-image: linear-gradient(180deg, #0000, #000 9%, #000 86%, #0000 100%);
  mask-image: linear-gradient(180deg, #0000, #000 9%, #000 86%, #0000 100%); }
.ax-ending[data-phase="roll"] .ax-end-roll { opacity: 1; }
.ax-end-roll-inner { width: min(64ch, 56vw); will-change: transform; }

.ax-end-coda { position: absolute; left: var(--ax-inset); top: 42%; width: min(64ch, 58vw);
  opacity: 0; transform: translateY(8px);
  transition: opacity 1100ms var(--ax-ease), transform 1100ms var(--ax-ease); }
.ax-ending[data-phase="coda"] .ax-end-coda { opacity: 1; transform: none; }
.ax-end-coda-line { font-family: var(--ax-head); font-weight: 700; font-size: clamp(12px,1.1vw,15px);
  letter-spacing: .30em; text-transform: uppercase; color: var(--ax-bone-2); line-height: 1.8; }
.ax-end-logo { margin-top: 42px; font-size: clamp(30px,3.4vw,52px); letter-spacing: .34em;
  color: var(--ax-amber); }
`;

export default { createDeath, createEnding };
