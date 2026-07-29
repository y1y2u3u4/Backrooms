/**
 * THE ANNEX — UI theme.
 *
 * One stylesheet for every screen, so the whole interface reads as one
 * document rather than a pile of components.
 *
 * The reference is Meridian Facilities Management's paperwork: NCR carbon-copy
 * job sheets, Letraset door signage, rubber date stamps, dot-matrix line
 * printers, manila. Rules that follow from that and are not negotiable:
 *
 *  - Two type registers only. A condensed grotesque, uppercase and heavily
 *    tracked, for anything the *building* signposted (headings, menu items,
 *    field labels). A typewriter face for anything the building *printed*
 *    (form values, note bodies, transcripts). A third, modern mono is used
 *    only for machine readouts — tape counters, reference numbers.
 *  - Flat. No gradients as decoration, no drop shadows, no glow, no blur, no
 *    rounded corners. Rules are 1px and mostly 20% opacity.
 *  - One accent: amber. Amber means "you can act on this". Bone means text.
 *    Everything else is near-black. The stamp red is print ink, not an accent —
 *    it never carries UI state and never appears outside a document.
 *  - Everything sits on an 8px grid, and then one thing per screen is very
 *    slightly out of true: a 0.4 degree rotation, a stamp printed off-centre,
 *    a second colour misregistered by a pixel. The imperfection is authored,
 *    never random per frame.
 *
 * No web fonts — there is no network at runtime. Character comes from
 * tracking, weight, scale and layout.
 */

export const DUR = { fast: 200, base: 320, slow: 480, veil: 620 };
export const EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)';

/** Small DOM builder. `el('div.ax-foo', {attrs}, ...children)` */
export function el(spec, attrs, ...kids) {
  const [tag, ...classes] = String(spec).split('.');
  const n = document.createElement(tag || 'div');
  if (classes.length) n.className = classes.join(' ');
  // A node, a string or an array in the attrs slot is a child, not attributes.
  if (attrs && (attrs.nodeType || typeof attrs === 'string' || Array.isArray(attrs))) {
    kids.unshift(attrs); attrs = null;
  }
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const k of kids.flat(3)) {
    if (k == null || k === false) continue;
    n.appendChild(k.nodeType ? k : document.createTextNode(String(k)));
  }
  return n;
}

/** Marks a node as accepting the pointer. Set inline so no stylesheet can lose. */
export function interactive(node, on = true) {
  node.style.pointerEvents = on ? 'auto' : 'none';
  return node;
}

/** A label / dot-leader / value row — the atom every Annex form is built from. */
export function field(label, value, opts = {}) {
  const v = el('span.ax-value', { text: value ?? '' });
  const row = el('div.ax-field',
    el('span.ax-label', { text: label }),
    el('span.ax-leader'),
    v);
  if (opts.mono) v.classList.add('ax-machine');
  if (opts.amber) v.classList.add('ax-hot');
  row._value = v;
  return row;
}

/** The Meridian mark: a square, a diagonal, a notch. Drawn, never an image. */
export function meridianMark(size = 15) {
  const s = el('span.ax-mark');
  s.style.width = s.style.height = `${size}px`;
  s.innerHTML =
    `<svg viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true">` +
    `<rect x="0.5" y="0.5" width="15" height="15" fill="none" stroke="currentColor"/>` +
    `<path d="M0.5 15.5 L15.5 0.5" stroke="currentColor"/>` +
    `<rect x="4" y="4" width="4" height="4" fill="currentColor"/></svg>`;
  return s;
}

/**
 * A rubber stamp. Wear is deterministic per seed — a stamp that reshuffles its
 * own damage every frame reads as an effect, not as ink.
 */
export function stamp(text, { seed = 3, rotate = -4.5, sub = null } = {}) {
  const n = el('div.ax-stamp', el('div.ax-stamp-t', { text }), sub ? el('div.ax-stamp-s', { text: sub }) : null);
  n.style.setProperty('--rot', `${rotate}deg`);
  n.style.webkitMaskImage = n.style.maskImage = wearMask(seed);
  return n;
}

/** Deterministic blotch mask: the ink that did not take. */
export function wearMask(seed = 1) {
  let a = (seed * 2654435761) >>> 0;
  const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  const parts = ['linear-gradient(#000,#000)'];
  for (let i = 0; i < 16; i++) {
    const x = (rnd() * 106 - 3).toFixed(1);
    const y = (rnd() * 112 - 6).toFixed(1);
    const r = (2.5 + rnd() * 9).toFixed(1);
    parts.push(`radial-gradient(ellipse ${r}% ${(r * 1.7).toFixed(1)}% at ${x}% ${y}%, #0000 0 55%, #000 78%)`);
  }
  return parts.join(',');
}

/** Punched filing holes down the left edge of a sheet. */
export function punchHoles(count = 2) {
  const g = el('div.ax-punch');
  for (let i = 0; i < count; i++) g.appendChild(el('i'));
  return g;
}

const CSS = /* css */ `
:root {
  --ax-ink:        #0a0906;
  --ax-ink-2:      #14120c;
  --ax-bone:       #cfc8b4;
  --ax-bone-2:     rgba(207,200,180,.60);
  --ax-bone-3:     rgba(207,200,180,.34);
  --ax-bone-4:     rgba(207,200,180,.16);
  --ax-amber:      #d8b45a;
  --ax-amber-2:    #8a7134;
  --ax-rule:       rgba(207,200,180,.20);
  --ax-rule-2:     rgba(207,200,180,.44);
  --ax-paper:      #c4bb9f;
  --ax-paper-2:    #b3a888;
  --ax-paper-ink:  #23211a;
  --ax-stamp:      #7d3a31;
  --ax-pad:        clamp(30px, 4.1vw, 84px);
  /* Screens stop widening past 1680 px and centre instead, so a 21:9 monitor
     gets a wider frame around the same document rather than a stretched one. */
  --ax-inset:      max(var(--ax-pad), calc(50% - 840px));
  --ax-head: 'Helvetica Neue Condensed','HelveticaNeue-CondensedBold','Arial Narrow',
             'Liberation Sans Narrow','DejaVu Sans Condensed','Helvetica Neue',Helvetica,Arial,sans-serif;
  --ax-sans: 'Helvetica Neue',Helvetica,'Liberation Sans',Arial,sans-serif;
  --ax-type: 'Courier New',Courier,'Courier 10 Pitch','Nimbus Mono PS','Liberation Mono',monospace;
  --ax-mono: ui-monospace,'SF Mono',Menlo,Consolas,'Liberation Mono','DejaVu Sans Mono',monospace;
  --ax-ease: ${EASE};
}

/* ---- layers ------------------------------------------------------------- */
.ax-layer {
  position: absolute; inset: 0;
  font-family: var(--ax-sans); color: var(--ax-bone);
  -webkit-font-smoothing: antialiased;
  user-select: none;
  opacity: 0; visibility: hidden;
  transition: opacity ${DUR.base}ms var(--ax-ease), visibility 0s linear ${DUR.base}ms;
}
.ax-layer.ax-on { opacity: 1; visibility: visible; transition-delay: 0s, 0s; }
.ax-layer * { box-sizing: border-box; }

/* Full-screen modal ground: a near-black field with a slight fall-off so the
   live scene behind reads as a dark room rather than as a switched-off panel. */
.ax-ground {
  position: absolute; inset: 0;
  background:
    radial-gradient(126% 100% at 20% 28%, rgba(13,11,8,.975) 0%, rgba(7,6,4,.995) 58%, #050403 100%);
}
.ax-ground.ax-solid { background: #06050300; background-color: #060503; }
.ax-scrim { position: absolute; inset: 0; background: rgba(5,4,3,.62); }

/* Reprographic tone: a fixed, static unevenness across every screen so the UI
   sits on the same "sheet" everywhere. Static — never animated. */
.ax-tone {
  position: absolute; inset: 0; pointer-events: none; opacity: .42;
  background:
    linear-gradient(163deg, rgba(216,180,90,.030) 0%, rgba(0,0,0,0) 46%),
    linear-gradient(8deg,  rgba(207,200,180,.022) 0%, rgba(0,0,0,0) 38%),
    repeating-linear-gradient(0deg, rgba(0,0,0,.16) 0 1px, #0000 1px 3px);
}
/* A radial, not an inset shadow: an inset shadow on a dark ground draws a
   visible rounded rectangle, which is the single most common way a full-screen
   overlay gives itself away as a box. */
.ax-vig { position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(128% 104% at 50% 46%, rgba(4,3,2,0) 34%, rgba(4,3,2,.66) 100%); }

/* ---- type -------------------------------------------------------------- */
.ax-display {
  font-family: var(--ax-head); font-weight: 700;
  font-size: clamp(44px, 5.6vw, 86px); line-height: .92;
  letter-spacing: .30em; text-transform: uppercase;
  margin: 0; color: var(--ax-bone);
}
.ax-h1 { font-family: var(--ax-head); font-weight: 700; font-size: clamp(16px,1.5vw,22px);
  letter-spacing: .40em; text-transform: uppercase; margin: 0; }
.ax-h2 { font-family: var(--ax-head); font-weight: 700; font-size: 12px;
  letter-spacing: .34em; text-transform: uppercase; margin: 0; color: var(--ax-bone-2); }
.ax-label { font-family: var(--ax-head); font-weight: 700; font-size: 10px;
  letter-spacing: .30em; text-transform: uppercase; color: var(--ax-bone-3); white-space: nowrap; }
.ax-micro { font-family: var(--ax-head); font-weight: 700; font-size: 9px;
  letter-spacing: .28em; text-transform: uppercase; color: var(--ax-bone-3); }
.ax-value { font-family: var(--ax-type); font-size: 12.5px; letter-spacing: .02em;
  color: var(--ax-bone); white-space: nowrap; }
.ax-machine { font-family: var(--ax-mono); font-size: 11.5px; letter-spacing: .08em;
  font-variant-numeric: tabular-nums; }
.ax-hot { color: var(--ax-amber); }
.ax-dim { color: var(--ax-bone-3); }

/* ---- form primitives ---------------------------------------------------- */
.ax-rule { height: 1px; background: var(--ax-rule); border: 0; margin: 0; }
.ax-rule.ax-strong { background: var(--ax-rule-2); }
.ax-field { display: flex; align-items: baseline; gap: 10px; padding: 5px 0; }
.ax-leader { flex: 1 1 auto; height: 1px; align-self: flex-end; margin-bottom: 4px;
  background: repeating-linear-gradient(90deg, var(--ax-bone-4) 0 1px, #0000 1px 5px); }
.ax-mark { display: inline-block; color: var(--ax-amber-2); line-height: 0; }

.ax-stamp {
  position: absolute; display: inline-block; padding: 9px 16px 8px;
  border: 2px solid var(--ax-stamp); color: var(--ax-stamp);
  transform: rotate(var(--rot, -4.5deg));
  opacity: .70; mix-blend-mode: screen; pointer-events: none;
}
.ax-stamp-t { font-family: var(--ax-head); font-weight: 700; font-size: 17px;
  letter-spacing: .22em; text-transform: uppercase; white-space: nowrap; }
.ax-stamp-s { font-family: var(--ax-mono); font-size: 9px; letter-spacing: .16em;
  text-align: center; margin-top: 3px; opacity: .85; }
.ax-stamp.ax-on-paper { mix-blend-mode: multiply; opacity: .78; }

.ax-punch { position: absolute; left: 15px; top: 0; bottom: 0; width: 13px;
  display: flex; flex-direction: column; justify-content: space-evenly; padding: 17% 0; }
.ax-punch i { display: block; width: 13px; height: 13px; border-radius: 50%;
  box-shadow: inset 0 1px 2px rgba(0,0,0,.55); background-color: rgba(10,9,7,.80); }

/* ---- sheets ------------------------------------------------------------- */
.ax-sheet {
  position: relative; background: var(--ax-paper); color: var(--ax-paper-ink);
  background-image:
    radial-gradient(78% 60% at 18% 6%,  rgba(255,255,255,.20), #0000 70%),
    radial-gradient(60% 50% at 92% 96%, rgba(0,0,0,.10), #0000 72%),
    repeating-linear-gradient(0deg, rgba(0,0,0,.028) 0 1px, #0000 1px 2px);
  box-shadow: inset 0 0 0 1px rgba(0,0,0,.18);
}
.ax-sheet.ax-carbon { background-color: var(--ax-paper-2); }
.ax-sheet .ax-label { color: rgba(35,33,26,.52); }
.ax-sheet .ax-value { color: var(--ax-paper-ink); }
.ax-sheet .ax-rule { background: rgba(35,33,26,.26); }
.ax-sheet .ax-leader { background: repeating-linear-gradient(90deg, rgba(35,33,26,.22) 0 1px, #0000 1px 5px); }

/* ---- menu list ---------------------------------------------------------- */
.ax-menu { display: grid; gap: 2px; }
.ax-item {
  position: relative; display: flex; align-items: center; gap: 14px;
  padding: 9px 0 9px 26px; background: none; border: 0; color: var(--ax-bone-2);
  font-family: var(--ax-head); font-weight: 700; font-size: clamp(13px,1.15vw,16px);
  letter-spacing: .34em; text-transform: uppercase; text-align: left; cursor: pointer;
  transition: color ${DUR.fast}ms var(--ax-ease), letter-spacing ${DUR.base}ms var(--ax-ease);
}
.ax-item::before {
  content: ''; position: absolute; left: 0; top: 50%; width: 12px; height: 1px;
  background: var(--ax-amber); transform: translateY(-50%) scaleX(0); transform-origin: left;
  transition: transform ${DUR.base}ms var(--ax-ease);
}
.ax-item[data-sel] { color: var(--ax-amber); letter-spacing: .40em; }
.ax-item[data-sel]::before { transform: translateY(-50%) scaleX(1); }
.ax-item[disabled] { color: var(--ax-bone-4); cursor: default; }
.ax-item[disabled][data-sel] { color: var(--ax-bone-3); letter-spacing: .34em; }
.ax-item[disabled]::before { background: var(--ax-bone-3); }
.ax-item .ax-note { margin-left: auto; font-family: var(--ax-mono); font-size: 9.5px;
  letter-spacing: .16em; color: var(--ax-bone-4); }

/* ---- controls ----------------------------------------------------------- */
.ax-ctl { display: grid; grid-template-columns: 1fr 168px 78px; align-items: center;
  gap: 18px; padding: 10px 0; border-bottom: 1px solid var(--ax-bone-4); cursor: pointer; }
.ax-ctl[data-sel] { border-bottom-color: var(--ax-rule-2); }
.ax-ctl[data-sel] .ax-ctl-n { color: var(--ax-amber); }
.ax-ctl-n { font-family: var(--ax-head); font-weight: 700; font-size: 11px;
  letter-spacing: .28em; text-transform: uppercase; color: var(--ax-bone-2);
  transition: color ${DUR.fast}ms var(--ax-ease); }
.ax-ctl-v { font-family: var(--ax-mono); font-size: 11px; letter-spacing: .12em;
  color: var(--ax-bone); text-align: right; font-variant-numeric: tabular-nums; }
.ax-track { position: relative; height: 12px; }
.ax-track::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 1px;
  background: var(--ax-bone-4); }
.ax-track i { position: absolute; top: 50%; left: 0; height: 1px; background: var(--ax-amber-2);
  transform: translateY(-50%); transition: width ${DUR.fast}ms var(--ax-ease); }
.ax-track b { position: absolute; top: 50%; width: 2px; height: 11px; background: var(--ax-amber);
  transform: translate(-1px,-50%); transition: left ${DUR.fast}ms var(--ax-ease); }
.ax-seg { display: flex; gap: 1px; justify-content: flex-end; }
.ax-seg span { font-family: var(--ax-head); font-weight: 700; font-size: 9.5px;
  letter-spacing: .18em; text-transform: uppercase; padding: 4px 7px; color: var(--ax-bone-4);
  border: 1px solid transparent; transition: color ${DUR.fast}ms var(--ax-ease); }
.ax-seg span[data-on] { color: var(--ax-amber); border-color: var(--ax-amber-2); }

/* ---- key glyph ---------------------------------------------------------- */
.ax-key {
  display: inline-grid; place-items: center; min-width: 24px; height: 24px; padding: 0 6px;
  border: 1px solid var(--ax-amber-2); color: var(--ax-amber);
  font-family: var(--ax-head); font-weight: 700; font-size: 10.5px; letter-spacing: .12em;
}
.ax-key.ax-cold { border-color: var(--ax-bone-4); color: var(--ax-bone-3); }

/* ---- footer / header rails --------------------------------------------- */
.ax-rail { position: absolute; left: var(--ax-inset); right: var(--ax-inset);
  display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; }
.ax-rail.ax-top { top: clamp(24px,3.2vh,38px); align-items: flex-start; }
.ax-rail.ax-bot { bottom: clamp(22px,3vh,34px); }

/* ---- transitions -------------------------------------------------------- */
.ax-rise { opacity: 0; transform: translateY(9px);
  transition: opacity ${DUR.slow}ms var(--ax-ease), transform ${DUR.slow}ms var(--ax-ease); }
.ax-on .ax-rise { opacity: 1; transform: none; }
.ax-wipe { transform: scaleX(0); transform-origin: left;
  transition: transform ${DUR.slow}ms var(--ax-ease); }
.ax-on .ax-wipe { transform: scaleX(1); }

/* ---- caret (never a spinner) ------------------------------------------- */
.ax-caret { display: inline-block; width: 7px; height: 12px; vertical-align: -1px;
  background: var(--ax-amber); animation: ax-blink 1.15s steps(1,end) infinite; }
@keyframes ax-blink { 0%,55% { opacity: 1 } 56%,100% { opacity: 0 } }

@media (prefers-reduced-motion: reduce) {
  .ax-caret { animation: none; }
}
`;

let injected = false;
export function injectStyles(doc = document) {
  if (injected && doc.getElementById('ax-style')) return;
  const s = doc.createElement('style');
  s.id = 'ax-style';
  s.textContent = CSS;
  doc.head.appendChild(s);
  injected = true;
}

export default { el, field, stamp, injectStyles, interactive, meridianMark, punchHoles, DUR, EASE };
