/**
 * Subtitles.
 *
 * Written as an assistive transcript, not a chat log. That means:
 *
 *  - speech is attributed with a speaker label above the line, in the same
 *    tracked caps the building uses for its own signage;
 *  - non-speech is described in square brackets, which is the broadcast
 *    convention and is instantly legible as "this is a sound, not a voice";
 *  - anything off-screen carries a positional hint — "[to your left, distant]"
 *    — because a player who cannot hear the Surveyor's whine still has to be
 *    able to play the game the whine was written for.
 *
 * The block is centred low in frame, text left-aligned inside it, and lines
 * stack upward with the oldest dropping off. Maximum three lines: past that it
 * stops being a transcript and starts being a wall.
 */

import { el } from './theme.js';

const MAX_LINES = 3;

/** "to your left, distant" — relative to where the camera is looking. */
export function describeDirection(camera, position) {
  if (!camera || !position) return '';
  const px = position.x ?? position[0];
  const py = position.y ?? position[1];
  const pz = position.z ?? position[2];
  const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
  const dx = px - cx, dy = py - cy, dz = pz - cz;
  const dist = Math.hypot(dx, dy, dz);

  // Camera forward on the horizontal plane (three's -Z convention, YXZ order).
  const yaw = camera.rotation.y;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const f = dx * fx + dz * fz;
  const r = dx * rx + dz * rz;
  const ang = Math.atan2(r, f) * 180 / Math.PI;

  let dir;
  if (Math.abs(ang) < 32) dir = 'ahead';
  else if (Math.abs(ang) > 148) dir = 'behind you';
  else if (ang > 0) dir = 'to your right';
  else dir = 'to your left';

  if (dy > 2.6 && dist > 3) dir += ', above';
  else if (dy < -2.6 && dist > 3) dir += ', below';

  let range = '';
  if (dist > 34) range = ', far off';
  else if (dist > 15) range = ', distant';
  else if (dist < 3.2) range = ', close';

  return dir + range;
}

export function createSubtitles({ camera = null } = {}) {
  const stack = el('div.ax-sub-stack');
  const node = el('div.ax-layer.ax-subs', stack);
  node.classList.add('ax-on');
  let enabled = true;
  const live = [];

  function drop(rec) {
    const i = live.indexOf(rec);
    if (i >= 0) live.splice(i, 1);
    clearTimeout(rec.timer);
    rec.node.removeAttribute('data-on');
    setTimeout(() => rec.node.remove(), 340);
  }

  /**
   * @param {object} cue
   * @param {string} [cue.speaker]  'Surveyor', 'Attendant', 'Tape 3'
   * @param {string} cue.text
   * @param {boolean} [cue.sound]   true = non-speech, rendered in brackets
   * @param {string} [cue.hint]     overrides the computed positional hint
   * @param {object|Array} [cue.position] world position for the hint
   * @param {number} [cue.duration] seconds; auto from length if omitted
   * @param {string} [cue.id]       replaces a live cue with the same id
   */
  function say(cue) {
    if (!enabled || !cue || !cue.text) return null;
    if (cue.id) { const prev = live.find((l) => l.id === cue.id); if (prev) drop(prev); }

    const hint = cue.hint !== undefined ? cue.hint
      : (cue.position ? describeDirection(camera, cue.position) : '');

    const head = el('div.ax-sub-head');
    if (cue.speaker) head.appendChild(el('span.ax-sub-who', { text: cue.speaker }));
    if (hint) head.appendChild(el('span.ax-sub-where', { text: `[${hint}]` }));

    const body = el('div.ax-sub-text', { text: cue.sound ? `[ ${cue.text} ]` : cue.text });
    if (cue.sound) body.classList.add('ax-sub-sound');

    const lineNode = el('div.ax-sub-line', head.childNodes.length ? head : null, body);
    stack.appendChild(lineNode);
    requestAnimationFrame(() => lineNode.setAttribute('data-on', ''));

    const dur = cue.duration ?? Math.max(2.0, Math.min(9, 1.5 + cue.text.length * 0.055));
    const rec = { id: cue.id, node: lineNode, timer: setTimeout(() => drop(rec), dur * 1000) };
    live.push(rec);
    while (live.length > MAX_LINES) drop(live[0]);
    return rec;
  }

  return {
    node,
    say,
    /** Convenience for entity/world sounds. */
    sound(text, position, opts = {}) { return say({ text, position, sound: true, ...opts }); },
    clear() { for (const r of [...live]) drop(r); },
    setEnabled(v) { enabled = !!v; if (!enabled) for (const r of [...live]) drop(r); },
    setCamera(c) { camera = c; },
    get enabled() { return enabled; },
  };
}

export const SUBS_CSS = /* css */ `
.ax-subs { }
.ax-sub-stack {
  position: absolute; left: 50%; bottom: clamp(56px, 9vh, 104px); transform: translateX(-50%);
  width: min(66ch, 74vw); display: grid; gap: 4px; justify-items: center;
}
.ax-sub-line {
  max-width: 100%; padding: 8px 15px 10px; background: rgba(6,5,3,.76);
  border-left: 2px solid var(--ax-amber-2);
  opacity: 0; transform: translateY(6px);
  transition: opacity 280ms var(--ax-ease), transform 280ms var(--ax-ease);
}
.ax-sub-line[data-on] { opacity: 1; transform: none; }
.ax-sub-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 4px; flex-wrap: wrap; }
.ax-sub-who { font-family: var(--ax-head); font-weight: 700; font-size: 9.5px;
  letter-spacing: .30em; text-transform: uppercase; color: var(--ax-amber); }
.ax-sub-where { font-family: var(--ax-mono); font-size: 9.5px; letter-spacing: .08em;
  color: var(--ax-bone-3); }
.ax-sub-text { font-family: var(--ax-sans); font-size: clamp(13px,1.05vw,15px); line-height: 1.5;
  color: #e5dfcd; letter-spacing: .012em; }
.ax-sub-text.ax-sub-sound { color: var(--ax-bone-2); letter-spacing: .05em; }
`;

export default createSubtitles;
