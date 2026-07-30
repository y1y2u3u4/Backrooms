/**
 * ============================================================================
 * THE ANNEX — UI facade.  `src/ui/UI.js`
 * ============================================================================
 *
 * One object owns every pixel of DOM in `#ui-root`, plus the cinematics
 * sequencer and the grade arbitration deck. The integrator constructs it once
 * and calls four methods in the frame loop; everything else is optional.
 *
 * ----------------------------------------------------------------------------
 * CONSTRUCTION
 * ----------------------------------------------------------------------------
 *
 *   import { createUI } from './ui/UI.js';
 *
 *   const ui = createUI({
 *     bus,            // required — the event bus
 *     root,           // required — #ui-root element
 *     engine,         // required — for grade.uniforms, setQuality, camera
 *     player,         // optional — for vitals, fov, cinematic hand-off
 *     input,          // optional — for sensitivity/invertY and pointer lock
 *     game,           // optional — read for menuCamera, elapsed, zone label
 *     rig,            // optional — LightRig, for cinematic lighting beats
 *     bindKeys: true, // set false to route keys yourself via ui.key(code)
 *   });
 *
 * ----------------------------------------------------------------------------
 * FRAME LOOP — the only hard requirement
 * ----------------------------------------------------------------------------
 *
 *   step(dt) {
 *     ...
 *     this.player.update(dt, this.input);
 *     this.rig.update(dt, camera, renderer);
 *     this.ui.update(dt);          // <-- LAST in step(), BEFORE engine.render()
 *   }
 *
 * `ui.update` runs the sequencer (which writes the camera, so it must come
 * after Player.update) and composes the grade deck (which writes the post
 * uniforms, so it must come before engine.render).
 *
 * While paused, keep calling `ui.update(dt)` and `rig.update(dt, ...)` — the
 * pause screen deliberately shows a world that is still alive.
 *
 * ----------------------------------------------------------------------------
 * SCREENS
 * ----------------------------------------------------------------------------
 *
 *   ui.show(name, data?)   ui.hide(name)   ui.toggle(name)
 *   ui.current             // 'title' | 'loading' | ... | null
 *   ui.isModal             // true when the screen wants the pointer released
 *
 *   'title'    main menu. Sits over game.menuCamera if one exists.
 *   'loading'  job docket. `ui.loadProgress(p, msg)` / `await ui.loadFinish()`
 *   'pause'    data: { task, cores, zone, elapsed }
 *   'journal'  the player's notes / tapes / plan
 *   'settings' data: { from: 'title' | 'pause' }
 *   'credits'  the staffing schedule (title screen sub-view)
 *   'death'    data: { cause: 'surveyor'|'water'|'fall'|'unknown', location, elapsed }
 *   'ending'   data: { ending: 'lift'|'stayed' }
 *
 * Menu and screen choices come back as `ui:action` on the bus and through
 * `ui.onAction(fn)`:
 *
 *   begin  continue  settings  credits  back
 *   resume  journal  abandon
 *   respawn  menu
 *   ending:done
 *
 * The UI never starts, loads, saves or quits the game itself. It reports.
 *
 * ----------------------------------------------------------------------------
 * HUD
 * ----------------------------------------------------------------------------
 *
 *   ui.setPrompt({ verb, key?, hold?, requires?, disabled?, subject? } | null)
 *   ui.setHoldProgress(t)                     // 0..1 for held interactions
 *   ui.objective(main, sub?)                  // shows for 6 s on change
 *   ui.recallObjective()
 *   ui.subtitle({ speaker?, text, sound?, position?, hint?, duration?, id? })
 *   ui.sound(text, position, opts?)           // non-speech convenience
 *   ui.hideHud(bool)                          // cinematics use this
 *   ui.setLampBattery(0..1)                   // drives the brown-out cue only
 *   ui.hurt(0..1)
 *
 * There is no stamina bar and no battery bar, by design — see Vitals.js.
 *
 * ----------------------------------------------------------------------------
 * JOURNAL CONTENT
 * ----------------------------------------------------------------------------
 *
 *   ui.addNote({ id, title, body, ref?, date?, kind?, stamp?, stampSub?, sign? })
 *   ui.addTape({ id, title, duration, ref?, transcript: [{ at, who, text }] })
 *   ui.mapAdd({ id, x, z, label?, kind?: 'room'|'junction'|'lift' })
 *   ui.mapLink(idA, idB)
 *   ui.mapHere(x, z)
 *   ui.setTapeTime(id, seconds, playing?)     // audio agent drives the head
 *
 * `story:note` and `item:pickup` on the bus are also picked up automatically.
 *
 * ----------------------------------------------------------------------------
 * CINEMATICS
 * ----------------------------------------------------------------------------
 *
 *   await ui.cine.play('intro');
 *   await ui.cine.play('through:door', { origin, yaw, onSwap, toCircuit });
 *   ui.cine.skip();  ui.cine.stop();  ui.cine.active
 *
 * Registered: intro · through:door · through:hatch · zone:cistern ·
 * zone:residence · zone:plant · zone:stack · zone:duct · lift · lift:call ·
 * impossible:door · entity:reveal · world:transform · capture · respawn ·
 * ending.
 *
 * `ui.deck` is the GradeDeck. Never write `engine.grade.uniforms` directly
 * once the UI exists — take a layer:  `ui.deck.layer('director').set({uDread: .3})`
 *
 * ----------------------------------------------------------------------------
 * SETTINGS
 * ----------------------------------------------------------------------------
 *
 *   ui.settings                 // live values, persisted to localStorage
 *   bus.on('ui:settings', (s) => ...)
 *
 * Applied by the UI directly: sensitivity, invert Y, FOV, quality tier,
 * subtitles, prompt contrast. Broadcast for others to apply: volMaster,
 * volMusic, volSfx (audio agent) and `motion` (Player bob/shake scale — see
 * docs/INTEGRATION_REQUESTS_UI.md).
 * ============================================================================
 */

import { injectStyles, el, DUR } from './theme.js';
import { createMenu, MENU_CSS } from './Menu.js';
import { createSettings, SETTINGS_CSS } from './Settings.js';
import { createLoading, LOADING_CSS } from './Loading.js';
import { createPause, PAUSE_CSS } from './Pause.js';
import { createJournal, JOURNAL_CSS } from './Journal.js';
import { createPrompts, PROMPTS_CSS } from './Prompts.js';
import { createSubtitles, SUBS_CSS } from './Subtitles.js';
import { createObjective, OBJ_CSS } from './Objective.js';
import { createDeath, createEnding, END_CSS } from './EndScreens.js';
import { createVitals } from './Vitals.js';
import { CREDITS_CSS } from './credits.js';
import { deckFor } from '../cinematics/Grade.js';
import { createSequencer } from '../cinematics/Sequencer.js';
import { installCinematics } from '../cinematics/index.js';

const MODAL = new Set(['title', 'pause', 'journal', 'settings', 'credits', 'death', 'ending', 'loading']);

/**
 * Where each zone sits on the journal's plan.
 *
 * NOT `ZONE_ORIGIN`. Those are the streaming patches — eight squares 400 m apart
 * in a grid, chosen so nothing in one zone can be seen from another, and they say
 * nothing about how the building connects. These are the graph in `ZONE_GRAPH`
 * laid out by hand as a person sketching it would: the Spine across the middle
 * because everything hangs off it, the Cistern below because it is down a stair,
 * the Plant below and east because the pipes run that way.
 */
const ZONE_MAP = {
  intake: { x: -26, z: 0, label: 'INTAKE L-100', kind: 'lift' },
  duct: { x: -14, z: -16, label: 'AHU 3', kind: 'junction' },
  service: { x: 0, z: 0, label: 'SERVICE SPINE', kind: 'junction' },
  safe: { x: 4, z: -14, label: 'OFFICE OF RECORD', kind: 'room' },
  stack: { x: -12, z: 15, label: 'THE STACK', kind: 'lift' },
  residence: { x: 6, z: 17, label: 'RESIDENCE 2nd', kind: 'room' },
  cistern: { x: 18, z: 8, label: 'CISTERN', kind: 'room' },
  plant: { x: 22, z: -6, label: 'PLANT P-10', kind: 'room' },
};
/** Screens that black the world out behind them. */
const OPAQUE = new Set(['loading', 'death', 'ending']);

export function createUI({
  bus, root, engine, player = null, input = null, game = null, rig = null, bindKeys = true,
} = {}) {
  if (!root) throw new Error('createUI: root element required');
  injectStyles(document);
  injectModuleStyles();

  const deck = deckFor(engine);
  const screenLayer = deck.layer('screen', 200);
  const listeners = new Set();
  let current = null;
  let hudHidden = false;
  let skipHold = 0, skipDown = false, skipVisible = false;

  const emitAction = (action, data) => {
    bus?.emit('ui:action', { action, ...(data || {}) });
    for (const fn of listeners) { try { fn(action, data); } catch (e) { console.error('[ui]', e); } }
  };

  // ---- components --------------------------------------------------------
  const prompts = createPrompts();
  const subs = createSubtitles({ camera: engine?.camera || null });
  const objective = createObjective();
  const journal = createJournal({ bus });
  const pause = createPause({ onSelect: (id) => {
    if (id === 'resume') { hide('pause'); emitAction('resume'); }
    else if (id === 'journal') { show('journal'); }
    else if (id === 'settings') { show('settings', { from: 'pause' }); }
    else if (id === 'abandon') { emitAction('abandon'); }
  } });
  const menu = createMenu({
    hasSave: () => hasSave,
    // The only sound the shell makes while you move through it. `ui.hover` was in
    // the library with nothing to trigger it.
    onHover: () => bus?.emit('ui:hover', {}),
    onSelect: (id) => {
      if (id === 'settings') show('settings', { from: 'title' });
      else if (id === 'credits') { menu.showCredits(); current = 'credits'; }
      else emitAction(id);
    },
  });
  const settings = createSettings({
    bus, engine, player, input,
    onClose: (owner) => { if (owner === 'pause') show('pause'); else show('title'); },
  });
  const loading = createLoading({});
  const death = createDeath({ onSelect: (id) => emitAction(id) });
  const ending = createEnding({ onDone: (id) => { emitAction('ending:done', { ending: id }); } });
  const vitals = createVitals({ deck, player });

  const skipHint = el('div.ax-layer.ax-skip',
    el('div.ax-skip-box',
      el('span.ax-micro', { text: 'Hold' }),
      el('span.ax-key', { text: 'Space' }),
      el('span.ax-micro', { text: 'to skip' }),
      el('div.ax-skip-bar', el('i'))));
  const skipBar = skipHint.querySelector('.ax-skip-bar i');

  const hud = el('div.ax-layer.ax-hud', subs.node, objective.node, prompts.node);
  hud.classList.add('ax-on');

  for (const n of [hud, journal.node, pause.node, settings.node, menu.node,
    death.node, ending.node, loading.node, skipHint]) {
    n.style.pointerEvents = 'none';
    root.appendChild(n);
  }

  const screens = {
    title: menu, credits: menu, pause, journal, settings, death, ending, loading,
  };
  const nodes = {
    title: menu.node, credits: menu.node, pause: pause.node, journal: journal.node,
    settings: settings.node, death: death.node, ending: ending.node, loading: loading.node,
  };

  let hasSave = readHasSave();
  function readHasSave() {
    // Version-checked rather than "the key exists": a save from an older format
    // is worse than no save, because Continue would light up and then strand the
    // player. See systems/SaveGame.js.
    try {
      const raw = localStorage.getItem('annex.save');
      if (!raw) return false;
      const d = JSON.parse(raw);
      return !!d && typeof d.version === 'number' && !!d.where;
    } catch { return false; }
  }

  // ---- sequencer ---------------------------------------------------------
  const uiFacade = {};   // forward-declared so cinematics can call back into us
  const cine = createSequencer({ bus, engine, player, deck, ui: uiFacade, rig, game });
  installCinematics(cine);

  // ---- screen management -------------------------------------------------
  function show(name, data) {
    if (!nodes[name]) { console.warn(`[ui] no screen "${name}"`); return; }
    if (current && current !== name && nodes[current] !== nodes[name]) hideNode(current);

    switch (name) {
      case 'title': menu.open(); break;
      case 'credits': menu.showCredits(); break;
      case 'pause': pause.open({
        // Read the live progression rather than a placeholder. `'0 of 3'` was
        // hard-coded, so the pause screen told every player they had fitted
        // nothing right up to the ending.
        task: game?.progression?.current?.title || objective.text,
        cores: (() => {
          const p = game?.progression;
          return p ? `${p.coresFitted} of 3 fitted` : (data?.cores ?? '0 of 3');
        })(),
        zone: data?.zone ?? game?.world?.currentZone ?? '',
        elapsed: data?.elapsed ?? (game?.time ?? 0),
        ...data,
      }); break;
      case 'journal': journal.open(); break;
      case 'settings': settings.open(data?.from || 'title'); break;
      case 'death': death.open(data || {}); break;
      case 'ending': ending.play(data?.ending || 'lift'); break;
      case 'loading': loading.show(); break;
      default: break;
    }

    current = name;
    nodes[name].classList.add('ax-on');
    nodes[name].style.pointerEvents = 'auto';
    syncHud();
    if (OPAQUE.has(name)) screenLayer.set({ uFade: 1, fadeColor: 0x000000 });
    if (name === 'title' && !game?.menuCamera) menu.node.setAttribute('data-plate', '');
    input?.exitLock?.();
    bus?.emit('ui:screen', { screen: name, open: true });
  }

  function hideNode(name) {
    const n = nodes[name];
    if (!n) return;
    n.classList.remove('ax-on');
    n.style.pointerEvents = 'none';
    if (name === 'journal') journal.close();
    if (OPAQUE.has(name)) screenLayer.to('uFade', 0, 0.5);
    bus?.emit('ui:screen', { screen: name, open: false });
  }

  function hide(name) {
    if (name && current !== name) {
      // Hiding something that is not on top is still legal (cinematics do it).
      hideNode(name);
      syncHud();
      return;
    }
    if (!current) return;
    hideNode(current);
    current = null;
    syncHud();
  }

  /** The HUD is never visible under a modal screen or during a cinematic. */
  function syncHud() {
    const on = !hudHidden && !(current && MODAL.has(current));
    hud.classList.toggle('ax-on', on);
    if (!on) prompts.set(null);
  }

  function toggle(name, data) { (current === name ? hide : show)(name, data); }

  // ---- key routing -------------------------------------------------------
  function key(code, event) {
    // Cinematic skip takes priority over everything except a hard pause.
    if (cine.active && cine.current?.skippable && (code === 'Space' || code === 'Escape')) {
      skipDown = true;
      return true;
    }

    if (current) {
      const s = screens[current];
      if (code === 'Escape') {
        if (current === 'settings') { settings.key('Escape'); return true; }
        if (current === 'credits') { show('title'); return true; }
        if (current === 'journal') { hide('journal'); emitAction('journal:close'); return true; }
        if (current === 'pause') { hide('pause'); emitAction('resume'); return true; }
        if (current === 'title' || current === 'loading') return true;
      }
      if ((code === 'Tab' || code === 'KeyJ') && current === 'journal') {
        hide('journal'); emitAction('journal:close'); return true;
      }
      if (s?.key?.(code)) return true;
      return true;   // modal screens swallow input
    }

    switch (code) {
      case 'Escape': show('pause'); emitAction('pause'); return true;
      case 'Tab': case 'KeyJ': show('journal'); emitAction('journal:open'); return true;
      case 'KeyO': objective.recall(); return true;
      default: return false;
    }
  }

  function keyUp(code) {
    if (code === 'Space' || code === 'Escape') { skipDown = false; skipHold = 0; }
  }

  let onKeyDown, onKeyUp;
  if (bindKeys) {
    onKeyDown = (e) => {
      if (e.repeat) return;
      if (e.code === 'Tab') e.preventDefault();
      if (key(e.code, e)) { /* consumed */ }
    };
    onKeyUp = (e) => keyUp(e.code);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }

  // ---- bus wiring --------------------------------------------------------
  const unsub = [
    bus?.on('story:note', (n) => { if (journal.addNote(n)) subs.say({ text: 'sheet filed', sound: true, hint: '', duration: 2.2 }); }),
    bus?.on('story:tape', (t) => journal.addTape(t)),
    /**
     * The plan tab. Nothing had ever added a node to it, so the journal's map was
     * a blank sheet for the whole game — and the one thing that did touch it,
     * `mapHere`, was fed the player's WORLD position, which for zones authored 400 m
     * apart in disjoint patches is a number with no relation to a floor plan.
     *
     * A zone map rather than a room map: eight nodes on the graph the building
     * actually has, each appearing the first time the player stands in it, with the
     * edges drawn between the ones they have seen. That is exactly the map Kearns
     * describes keeping — "what I do and when I do it and which way I turned" — and
     * it is honest: the player never gets a plan of a room they have not entered.
     */
    bus?.on('zone:enter', ({ zone, from }) => {
      if (!zone) return;
      const n = ZONE_MAP[zone];
      if (n) journal.mapAdd?.({ id: zone, x: n.x, z: n.z, label: n.label, kind: n.kind });
      if (from && ZONE_MAP[from]) journal.mapLink?.(from, zone);
      // `here` is in the same space as the nodes, so it has to be the zone's own
      // slot on the plan, not the player's world coordinate.
      if (n) journal.mapHere?.(n.x, n.z);
    }),

    // ---- the gameplay layer ------------------------------------------------
    // None of this was connected. `Progression` announced every objective change
    // on the bus and nothing listened, so the objective banner — the only place
    // the game ever states what the player is trying to do — was fed by
    // cinematics alone and was blank for the whole of play. The same for the
    // refusal line: `Interactor` emitted `ui:refuse` with the reason a door would
    // not open, and it went nowhere.
    bus?.on('progress:objective', (e) => {
      if (e?.title) objective.set(e.title, e.detail || '');
    }),
    bus?.on('progress:complete', (e) => {
      if (e?.title) subs.say({ text: e.title.toLowerCase(), sound: false, hint: 'done', duration: 3.0 });
    }),
    bus?.on('progress:core', (e) => {
      objective.set(objective.text || 'Three supply cores',
        `${e?.fitted ?? 0} of 3 fitted · ${e?.found ?? 0} found`);
    }),
    bus?.on('progress:hint', (e) => {
      if (e?.text) subs.say({ text: e.text, sound: true, hint: '', duration: 3.4 });
    }),
    bus?.on('progress:discovery', (e) => {
      if (e?.title) subs.say({ text: e.title.toLowerCase(), sound: false, hint: 'found', duration: 3.4 });
    }),
    // A door that will not open, a card that is out of date, a starter that is
    // still hot. The refusal reason is already written by whoever refused.
    bus?.on('ui:refuse', (e) => {
      if (e?.reason) subs.say({ text: e.reason, sound: false, hint: '', duration: 2.6 });
    }),
    bus?.on('portal:locked', (e) => {
      const why = game?.progression?.gateReason?.(e?.id);
      subs.say({ text: why || 'It will not open.', sound: false, hint: '', duration: 3.0 });
    }),
    bus?.on('save:written', () => {
      hasSave = readHasSave();
      menu.refreshEnabled?.();
      subs.say({ text: 'checkpoint', sound: false, hint: 'filed', duration: 1.8 });
    }),
    bus?.on('item:pickup', (e) => {
      const name = game?.inventory?.def?.(e?.id)?.name || e?.id;
      if (name) subs.say({ text: String(name).toLowerCase(), sound: false, hint: 'taken', duration: 2.2 });
    }),
  ].filter(Boolean);

  // ---- cinematic hooks (called by the Sequencer) -------------------------
  uiFacade.show = show;
  uiFacade.hide = hide;
  uiFacade.subtitle = (cue) => subs.say(cue);
  uiFacade.objective = (m, s) => objective.set(m, s);
  uiFacade.hideHud = (v) => { hudHidden = !!v; syncHud(); };
  uiFacade._cineBegin = (name, skippable) => {
    prompts.set(null);
    skipHold = 0; skipDown = false; skipVisible = false;
    skipHint.classList.remove('ax-on');
    skipHint._t = skippable ? 0 : -1;
  };
  uiFacade._cineEnd = () => {
    skipHint.classList.remove('ax-on');
    skipHint._t = -1; skipHold = 0; skipDown = false;
  };
  skipHint._t = -1;

  // ---- frame -------------------------------------------------------------
  /**
   * The interaction prompt, driven straight off the interactor's focus.
   *
   * `Interactor` maintains a stable `focus` object precisely so the UI can read
   * it every frame — and nothing did. `ui.setPrompt` existed, was documented, and
   * had exactly one caller in the whole project: the cinematics, clearing it. So
   * every door, breaker, valve, socket and pickup in the building was silent: no
   * key badge, no verb, no reason when it refused, and no hold ring on the four
   * actions that need one.
   */
  function syncPrompt() {
    const it = game?.interactor || game?.gameplay?.interactor;
    const f = it?.focus;
    if (!f?.target || hudHidden || isModalNow()) { prompts.set(null); return; }
    prompts.set({
      key: 'E',
      verb: f.blocked ? (f.target.verb || 'Use') : (f.verb || 'Use'),
      subject: f.label || '',
      hold: f.hold > 0,
      requires: f.blocked ? (f.reason || '') : '',
    });
    if (f.hold > 0) prompts.hold(f.progress || 0);
  }
  const isModalNow = () => !!current && MODAL.has(current);

  function update(dt) {
    cine.update(dt);
    if (!cine.active) syncPrompt();
    vitals.update(dt);
    objective.update(dt);
    journal.update(dt);
    ending.update(dt);

    // Skip affordance: appears after 1.2 s, and requires a 0.55 s hold so it
    // can never be triggered by the key the player used to open something.
    if (skipHint._t >= 0 && cine.active) {
      skipHint._t += dt;
      if (!skipVisible && skipHint._t > 1.2) { skipVisible = true; skipHint.classList.add('ax-on'); }
      skipHold = skipDown ? Math.min(1, skipHold + dt / 0.55) : Math.max(0, skipHold - dt / 0.3);
      skipBar.style.transform = `scaleX(${skipHold})`;
      if (skipHold >= 1) { skipDown = false; skipHold = 0; cine.skip(); }
    }

    if (game?.menuCamera && current === 'title') game.menuCamera.update?.(dt);

    deck.apply(dt);
  }

  // ---- public facade -----------------------------------------------------
  Object.assign(uiFacade, {
    // lifecycle
    update,
    dispose() {
      cine.dispose();
      if (onKeyDown) { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); }
      for (const u of unsub) u();
      journal.dispose();
      deck.reset();
      for (const n of Object.values(nodes)) n.remove();
      hud.remove(); skipHint.remove();
    },

    // screens
    show, hide, toggle, key, keyUp,
    get current() { return current; },
    get isModal() { return !!current && MODAL.has(current); },
    setHasSave(v) { hasSave = !!v; menu.refreshEnabled(); },

    // loading
    loadProgress: (p, msg) => loading.progress(p, msg),
    loadFinish: async () => { await loading.finish(); current = current === 'loading' ? null : current; },
    loadFail: (e) => loading.fail(e),

    // HUD
    setPrompt: (spec) => { if (!hudHidden) prompts.set(spec); },
    setHoldProgress: (t) => prompts.hold(t),
    objective: (m, s) => objective.set(m, s),
    recallObjective: () => objective.recall(),
    subtitle: (cue) => subs.say(cue),
    sound: (text, position, opts) => subs.sound(text, position, opts),
    hideHud: uiFacade.hideHud,
    setLampBattery: (v) => vitals.setLampBattery(v),
    hurt: (a) => vitals.hurt(a),

    // journal content
    addNote: (n) => journal.addNote(n),
    addTape: (t) => journal.addTape(t),
    mapAdd: (n) => journal.mapAdd(n),
    mapLink: (a, b) => journal.mapLink(a, b),
    mapHere: (x, z) => journal.mapHere(x, z),
    setTapeTime: (id, t, playing) => journal.setTapeTime(id, t, playing),

    // systems
    cine, deck, vitals,
    get settings() { return settings.values; },
    onAction(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    // escape hatches for the integrator
    _components: { menu, settings, loading, pause, journal, prompts, subs, objective, death, ending },
  });

  // Apply persisted settings to everything that reads them.
  subs.setEnabled(settings.values.subtitles);
  prompts.setSafe(settings.values.safePrompts);
  cine.setMotionScale(settings.values.motion);
  bus?.on('ui:settings', (s) => {
    subs.setEnabled(s.subtitles);
    prompts.setSafe(s.safePrompts);
    cine.setMotionScale(s.motion);
  });

  return uiFacade;
}

// ---------------------------------------------------------------------------

let modulesInjected = false;
function injectModuleStyles() {
  if (modulesInjected && document.getElementById('ax-style-modules')) return;
  const s = document.createElement('style');
  s.id = 'ax-style-modules';
  s.textContent = [
    MENU_CSS, SETTINGS_CSS, LOADING_CSS, PAUSE_CSS, JOURNAL_CSS,
    PROMPTS_CSS, SUBS_CSS, OBJ_CSS, END_CSS, CREDITS_CSS, UI_CSS,
  ].join('\n');
  document.head.appendChild(s);
  modulesInjected = true;
}

const UI_CSS = /* css */ `
.ax-hud { transition: opacity 320ms var(--ax-ease), visibility 0s linear 320ms; }
.ax-menu-layer[data-plate] .ax-menu-scrim { background:
  radial-gradient(120% 100% at 74% 46%, rgba(28,24,15,1) 0%, rgba(10,9,6,1) 55%, #040302 100%); }
.ax-skip { }
.ax-skip-box { position: absolute; right: var(--ax-inset); bottom: clamp(22px,3vh,34px);
  display: flex; align-items: center; gap: 9px; }
.ax-skip-bar { position: absolute; left: 0; right: 0; bottom: -7px; height: 1px;
  background: rgba(207,200,180,.14); }
.ax-skip-bar i { display: block; height: 100%; background: var(--ax-amber);
  transform: scaleX(0); transform-origin: left; }
`;

export default createUI;
