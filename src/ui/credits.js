/**
 * Credits, written as a Meridian staffing schedule because that is the only
 * kind of list this building knows how to produce.
 */

import { el } from './theme.js';

export const CREDITS = [
  { role: 'Site', names: ['Annex 7 — Lower ground and below'] },
  { role: 'Occupier of record', names: ['Meridian Facilities Management'] },
  { role: 'Contract', names: ['7/CO-2214 — night maintenance, rolling'] },
  { role: null, names: [] },
  { role: 'Architecture', names: ['Four hands, thirty years, no agreement'] },
  { role: 'Lighting', names: ['Circuit A — Intake', 'Circuit B — Service spine', 'Circuit E — Emergency, battery'] },
  { role: 'Plant', names: ['Generator hall, gantry level', 'Goods lift, three-phase'] },
  { role: 'Sound', names: ['Ballast hum, water, plant', 'One transformer whine, rising'] },
  { role: null, names: [] },
  { role: 'Observed', names: ['The Surveyor', 'The Attendant (no photograph on file)'] },
  { role: 'Recovered', names: ['Nine notes', 'Four tapes', 'One partial plan'] },
  { role: null, names: [] },
  { role: 'Filed by', names: ['Night custodian, name withheld'] },
  { role: 'Countersigned', names: ['— — — — —'] },
];

/** Renders the schedule as a column of label / value rows. */
export function creditsColumn() {
  const wrap = el('div.ax-credits');
  for (const { role, names } of CREDITS) {
    if (!role) { wrap.appendChild(el('div.ax-credits-gap')); continue; }
    wrap.appendChild(el('div.ax-credits-row',
      el('div.ax-label', { text: role }),
      el('div.ax-credits-n', names.map((n) => el('div.ax-value', { text: n })))));
  }
  return wrap;
}

export const CREDITS_CSS = /* css */ `
.ax-credits { display: grid; gap: 0; }
.ax-credits-row { display: grid; grid-template-columns: clamp(130px,13vw,190px) minmax(0,1fr);
  gap: 22px; padding: 9px 0; border-top: 1px solid var(--ax-bone-4); align-items: baseline; }
.ax-credits-row .ax-label { padding-top: 2px; }
.ax-credits-n .ax-value { white-space: normal; line-height: 1.62; }
.ax-credits-gap { height: 26px; }
`;

export default creditsColumn;
