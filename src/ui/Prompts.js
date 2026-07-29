/**
 * Interaction prompt.
 *
 * Sits low in frame (76% down) so it never enters the centre 40% during play.
 * Three states and no more:
 *
 *   available   amber key badge, verb in bone
 *   held        the badge's perimeter sweeps clockwise from top-centre
 *   refused     verb struck through, a single mono line naming what is missing
 *
 * Refusal never uses red. The building does not warn you, it just declines.
 *
 * With `safePrompts` on (colour-blind-safe), state stops being carried by
 * colour alone: the badge fills solid when available, gains a diagonal bar when
 * refused, and every state gains a word token.
 */

import { el } from './theme.js';

const PERIM = 'M17 0.5 H33.5 V33.5 H0.5 V0.5 Z';

export function createPrompts() {
  let cur = null;
  let safe = false;
  let holdT = 0;

  const subject = el('div.ax-pr-subject.ax-micro');
  const badgeKey = el('span.ax-pr-key');
  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ring.setAttribute('viewBox', '0 0 34 34');
  ring.setAttribute('class', 'ax-pr-ring');
  const ringPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  ringPath.setAttribute('d', PERIM);
  ringPath.setAttribute('pathLength', '100');
  ring.appendChild(ringPath);

  const badge = el('div.ax-pr-badge', badgeKey, ring);
  const verb = el('div.ax-pr-verb');
  const token = el('span.ax-pr-token');
  const line = el('div.ax-pr-line', badge, el('div.ax-pr-verbwrap', verb, token));
  const requires = el('div.ax-pr-req.ax-machine');

  const node = el('div.ax-layer.ax-prompts',
    el('div.ax-pr-stack', subject, line, requires));

  function paint() {
    if (!cur) return;
    subject.textContent = cur.subject || '';
    subject.style.opacity = cur.subject ? '' : '0';
    badgeKey.textContent = cur.key || 'E';
    verb.textContent = cur.verb || 'Use';
    // Note the coercion: toggleAttribute(name, undefined) *toggles* rather than
    // forcing, which silently leaves a stale refusal on the next prompt.
    const refused = !!(cur.requires || cur.disabled);
    node.toggleAttribute('data-refused', refused);
    node.toggleAttribute('data-hold', !!(cur.hold && !refused));
    node.toggleAttribute('data-safe', !!safe);
    requires.textContent = cur.requires ? `Requires ${cur.requires}` : '';
    requires.style.opacity = cur.requires ? '' : '0';
    token.textContent = !safe ? '' : refused ? '· Locked' : cur.hold ? '· Hold' : '· Press';
  }

  function setRing(t) {
    holdT = Math.max(0, Math.min(1, t));
    ringPath.style.strokeDashoffset = String(100 - holdT * 100);
  }
  setRing(0);

  return {
    node,
    /**
     * @param {null|{verb:string,key?:string,hold?:boolean,requires?:string,
     *               disabled?:boolean,subject?:string}} spec
     */
    set(spec) {
      if (!spec) {
        if (!cur) return;
        cur = null;
        node.classList.remove('ax-on');
        setRing(0);
        return;
      }
      const same = cur && cur.verb === spec.verb && cur.key === spec.key &&
        cur.requires === spec.requires && cur.subject === spec.subject &&
        cur.hold === spec.hold && cur.disabled === spec.disabled;
      cur = { key: 'E', ...spec };
      if (!same) { paint(); setRing(0); }
      node.classList.add('ax-on');
    },
    /** 0..1 progress for a held action. */
    hold(t) { setRing(t); },
    get holdProgress() { return holdT; },
    setSafe(v) { safe = !!v; paint(); },
    get active() { return !!cur; },
  };
}

export const PROMPTS_CSS = /* css */ `
.ax-prompts { transition: opacity 240ms var(--ax-ease), visibility 0s linear 240ms; }
.ax-pr-stack {
  position: absolute; left: 50%; top: 72%; transform: translate(-50%,0);
  display: grid; justify-items: center; gap: 9px; text-align: center;
  padding: 26px 60px;
  opacity: 0; transform: translate(-50%, 7px);
  transition: opacity 260ms var(--ax-ease), transform 260ms var(--ax-ease);
}
/* A soft, edgeless pool of shadow so amber type stays legible against a lit
   mustard wall. It has no perceptible boundary — it is not a panel. */
.ax-pr-stack::before { content: ''; position: absolute; inset: -14px -30px;
  background: radial-gradient(58% 62% at 50% 50%, rgba(4,3,2,.72), rgba(4,3,2,0) 72%);
  z-index: -1; }
.ax-prompts.ax-on .ax-pr-stack { opacity: 1; transform: translate(-50%, 0); }

.ax-pr-subject { color: var(--ax-bone-3); transition: opacity 220ms var(--ax-ease); }
.ax-pr-line { display: flex; align-items: center; gap: 14px; }

.ax-pr-badge { position: relative; width: 34px; height: 34px; display: grid; place-items: center; }
.ax-pr-badge::before { content: ''; position: absolute; inset: 0;
  border: 1px solid var(--ax-amber-2); background: rgba(8,7,5,.55);
  transition: border-color 220ms var(--ax-ease), background-color 220ms var(--ax-ease); }
.ax-pr-key { position: relative; font-family: var(--ax-head); font-weight: 700; font-size: 11px;
  letter-spacing: .1em; color: var(--ax-amber); text-transform: uppercase;
  transition: color 220ms var(--ax-ease); }
.ax-pr-ring { position: absolute; inset: 0; width: 34px; height: 34px; overflow: visible; }
.ax-pr-ring path { fill: none; stroke: var(--ax-amber); stroke-width: 2;
  stroke-dasharray: 100 100; stroke-dashoffset: 100; opacity: 0;
  transition: opacity 200ms var(--ax-ease); }
.ax-prompts[data-hold] .ax-pr-ring path { opacity: 1; }

.ax-pr-verbwrap { display: flex; align-items: baseline; gap: 8px; }
.ax-pr-verb { font-family: var(--ax-head); font-weight: 700; font-size: 13px;
  letter-spacing: .30em; text-transform: uppercase; color: var(--ax-bone);
  position: relative; transition: color 220ms var(--ax-ease); }
.ax-pr-token { font-family: var(--ax-mono); font-size: 9.5px; letter-spacing: .14em;
  color: var(--ax-bone-4); text-transform: uppercase; }
.ax-pr-req { font-size: 10px; letter-spacing: .16em; color: var(--ax-amber-2);
  text-transform: uppercase; transition: opacity 220ms var(--ax-ease); }

/* refused */
.ax-prompts[data-refused] .ax-pr-badge::before { border-color: var(--ax-bone-4); }
.ax-prompts[data-refused] .ax-pr-key { color: var(--ax-bone-3); }
.ax-prompts[data-refused] .ax-pr-verb { color: var(--ax-bone-3); }
.ax-prompts[data-refused] .ax-pr-verb::after { content: ''; position: absolute;
  left: -2px; right: 2px; top: 52%; height: 1px; background: var(--ax-bone-3); }

/* colour-blind-safe: state carried by fill, bar and word, not hue */
.ax-prompts[data-safe] .ax-pr-badge::before { background: rgba(216,180,90,.90); border-color: var(--ax-amber); }
.ax-prompts[data-safe] .ax-pr-key { color: #100d07; }
.ax-prompts[data-safe] .ax-pr-verb { color: #efeadc; }
.ax-prompts[data-safe][data-refused] .ax-pr-badge::before { background: none; border-color: #efeadc; }
.ax-prompts[data-safe][data-refused] .ax-pr-key { color: #efeadc; }
.ax-prompts[data-safe][data-refused] .ax-pr-badge::after { content: ''; position: absolute;
  left: -3px; right: -3px; top: 50%; height: 1px; background: #efeadc; transform: rotate(-38deg); }
.ax-prompts[data-safe] .ax-pr-req { color: #efeadc; }
/* An amber ring on an amber badge is invisible: in safe mode the progress
   sweep and the state token both go to bone. */
.ax-prompts[data-safe] .ax-pr-ring path { stroke: #efeadc; stroke-width: 2.5; }
.ax-prompts[data-safe] .ax-pr-token { color: #cfc8b4; }
.ax-prompts[data-safe] .ax-pr-subject { color: #b9b3a2; }
`;

export default createPrompts;
