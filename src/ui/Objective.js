/**
 * Objective line.
 *
 * One line, top-left, on the same margin as everything else. It appears when it
 * changes, holds for six seconds and leaves. It can be recalled with a key,
 * which is the whole reason it is allowed to leave at all.
 *
 * Deliberately not a checklist and never persistent: a permanent objective
 * readout turns a building you are lost in into a level you are completing.
 */

import { el } from './theme.js';

const HOLD = 6.0;

export function createObjective() {
  let t = 0, showing = false;
  let text = '', detail = '';

  const textNode = el('div.ax-obj-text');
  const detailNode = el('div.ax-obj-detail.ax-machine');
  const body = el('div.ax-obj-body',
    el('div.ax-obj-label.ax-micro', { text: 'Current task' }),
    textNode, detailNode);
  const stackNode = el('div.ax-obj-stack', el('div.ax-obj-tick'), body);
  const node = el('div.ax-layer.ax-obj', stackNode);
  node.classList.add('ax-on');

  function show() {
    showing = true; t = 0;
    stackNode.setAttribute('data-on', '');
  }
  function hide() { showing = false; stackNode.removeAttribute('data-on'); }

  return {
    node,
    /** @param {string} main @param {string} [sub] e.g. "0 / 3 fuse cores" */
    set(main, sub = '') {
      if (main === text && sub === detail && showing) return;
      text = main || ''; detail = sub || '';
      textNode.textContent = text;
      detailNode.textContent = detail;
      detailNode.style.display = detail ? '' : 'none';
      if (text) show(); else hide();
    },
    /** Re-show the current objective without changing it. */
    recall() { if (text) show(); },
    get text() { return text; },
    update(dt) {
      if (!showing) return;
      t += dt;
      if (t > HOLD) hide();
    },
  };
}

export const OBJ_CSS = /* css */ `
.ax-obj-stack {
  position: absolute; left: var(--ax-pad); top: clamp(78px, 11vh, 118px);
  display: flex; gap: 13px; max-width: min(54ch, 46vw);
  opacity: 0; transform: translateX(-8px);
  transition: opacity 420ms var(--ax-ease), transform 420ms var(--ax-ease);
}
.ax-obj-stack[data-on] { opacity: 1; transform: none; }
.ax-obj-tick { width: 2px; background: var(--ax-amber); transform-origin: top; transform: scaleY(0);
  transition: transform 520ms var(--ax-ease) 60ms; }
.ax-obj-stack[data-on] .ax-obj-tick { transform: scaleY(1); }
.ax-obj-label { color: var(--ax-amber-2); }
.ax-obj-text { font-family: var(--ax-head); font-weight: 700; font-size: clamp(11.5px,1.02vw,13.5px);
  letter-spacing: .22em; text-transform: uppercase; color: var(--ax-bone);
  line-height: 1.7; margin-top: 8px; }
/* Edgeless pool, same device as the prompt — legibility over a lit wall
   without introducing a panel or a drop shadow. */
.ax-obj-stack::before { content: ''; position: absolute; inset: -26px -70px -26px -40px;
  background: radial-gradient(62% 66% at 34% 50%, rgba(4,3,2,.74), rgba(4,3,2,0) 74%);
  z-index: -1; }
.ax-obj-detail { font-size: 10px; letter-spacing: .13em; color: var(--ax-bone-3); margin-top: 8px; }
`;

export default createObjective;
