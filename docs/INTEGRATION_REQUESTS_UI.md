# Integration requests — UI & cinematics

Owned by the UI/cinematics agent. Everything here is a change in a file this
agent does not own. Nothing in `src/ui/**` or `src/cinematics/**` depends on any
of it being done *today* — the UI degrades cleanly if a request is unmet — but
the build is not finished until they are.

Ordered by how much breaks without them.

---

## 1. `src/main.js` — construct the UI and call it in the frame loop  **(blocking)**

The UI is a drop-in. It needs three lines in `boot()` and one in `step()`.

```js
import { createUI } from './ui/UI.js';
import { createLoading } from './ui/Loading.js';
```

**Replace the placeholder loading screen** (main.js lines ~167–181 and the
`.then()` teardown) with:

```js
const loading = createLoading({});
document.getElementById('ui-root').appendChild(loading.node);
loading.show();

game.boot((p, msg) => loading.progress(p, msg))
  .then(async () => {
    if (qa) { loading.dispose(); veil.remove(); window.ANNEX_READY = true; return; }
    veil.style.opacity = '0';
    await loading.finish();        // stamps ATTENDED, fades, resolves
    loading.dispose();
    game.start();
    game.ui.show('title');
    window.ANNEX_READY = true;
  })
  .catch((err) => { loading.fail(err); window.ANNEX_ERROR = String(err.stack || err); });
```

`loading.finish()` returns a promise and can be awaited; the screen holds
indefinitely and honestly until then, with a real clock rather than a spinner.

**In `boot()`, after the player exists:**

```js
this.ui = createUI({
  bus: this.bus, root: this.uiRoot, engine: this.engine,
  player: this.player, input: this.input, game: this, rig: this.rig,
});
```

**In `step(dt)`, as the last statement:**

```js
step(dt) {
  updateMaterialGlobals(dt);
  this.player.update(dt, this.input);
  this.rig.update(dt, this.engine.camera, this.engine.renderer);
  this.ui.update(dt);          // <-- must be last, and must run before render
}
```

Order matters and is not negotiable: the sequencer writes `engine.camera` and so
has to run *after* `Player.update`, and the grade deck writes the post uniforms
and so has to run *before* `engine.render`.

## 2. Keep the world alive while paused  **(blocking for the pause screen)**

`_frame()` currently skips all of `step()` when paused, which freezes the light
flicker. The pause screen is deliberately a translucent scrim over a *living*
room — a static frame behind it reads as a screenshot. Please run the
presentation half of the step even when paused:

```js
_frame() {
  const now = performance.now();
  const dt = Math.min((now - this._last) / 1000, 0.05);
  this._last = now;
  this.time += dt;
  if (!this.paused) this.step(dt);
  else {
    updateMaterialGlobals(dt);
    this.rig.update(dt, this.engine.camera, this.engine.renderer);
    this.ui.update(dt);
  }
  this.engine.render(dt);
  this.input.endFrame();
}
```

## 3. `game.menuCamera` — the title screen's live plate

The title screen composites over whatever the world is rendering. Please provide:

```js
game.menuCamera = {
  enable() {},              // optional
  disable() {},             // optional
  update(dt) {},            // called every frame while the title is up
};
```

A very slow drift is all that is wanted: a few centimetres of dolly and a
degree or two of yaw over 30–40 seconds, somewhere with a fluorescent in frame
and a long corridor going away from camera. The scrim opens from the left, so
put the interesting part of the shot in the right two thirds.

If `game.menuCamera` is absent the menu falls back to an opaque plate and still
looks deliberate — this is a quality request, not a correctness one.

## 4. `src/player/Player.js` — honour the motion-reduction setting

Settings has a **Head motion** slider (0..1). The UI applies it to its own
animation and to every cinematic shake, but the player's bob, sway and breath
belong to Player. Please add a scalar and multiply the existing terms by it:

```js
this.motionScale = 1;      // set by the UI from ui:settings

// in _applyCamera, scale the authored amplitudes:
const a = this.bobAmount * lerp(1, 0.55, this.crouchAmt) * this.motionScale;
const breathAmp = lerp(0.0032, 0.0135, ...) * lerp(0.35, 1, this.motionScale);
this.viewRoll = damp(this.viewRoll, (-this.lean * 0.185 + bobRoll) * this.motionScale + this.recoil.z, 12, dt);
```

and in main.js:

```js
this.bus.on('ui:settings', (s) => { this.player.motionScale = s.motion; });
```

At `motionScale = 0` the head should be still but the lean, the neck spring and
the landing compression should all still work — those are physical responses,
not idle motion, and removing them removes information.

## 5. `src/audio/**` — the cinematic cue contract

Sequences never touch audio. They emit on the bus:

```js
bus.on('cine:cue', ({ sequence, cue, at, ...params }) => { /* play it */ });
```

`cue` is a stable slash-namespaced string. The full set currently emitted:

| namespace | cues |
|---|---|
| `intro/` | `lift_running` (loop), `floor_wrong`, `handover` |
| `lift/` | `gate_grab`, `gate_close`, `gate_seat`, `gate_open`, `car_lamp_strike`, `contactor`, `motor_start`, `run` (loop), `pass_floor` `{index, up}`, `motor_stop`, `arrest`, `shaft_change`, `call_button`, `shaft_distant`, `arrive_distant` |
| `door/` | `handle`, `handle_slow`, `swing_slow`, `latch_pass`, `fire_bar`, `closer_hiss`, `steel_heavy` |
| `hatch/` | `dog_release`, `hinge`, `interior_bridge` |
| `stair/` | `step_concrete` |
| `cistern/` | `water_wash` (loop, `fadeIn`), `reverb_bridge`, `wade_first` |
| `residence/` | `pendant_strike`, `carpet_dead` |
| `plant/` | `room_tone` (loop), `highbay_strike` `{index}` |
| `stack/` | `pressure_shift` |
| `duct/` | `panel_off`, `steel_bridge`, `breath_close` |
| `intake/` | `ballast_strike` `{far}`, `ballast_die` |
| `impossible/` | `bank_strike`, `room_tone` (loop, `fadeIn`) |
| `surveyor/` | `whine_far` `{distance}`, `whine_close`, `whine_fade`, `blade_extend`, `measure` |
| `annex/` | `settle_deep`, `door_shut_behind` `{distance}`, `structure_shift` `{masked}` |
| `noise/` | `plate_on`, `plate_off` |
| `office/` | `lamp_hum` (loop), `kettle_settle`, `chair_creak` |
| `ending/` | `outside_air` (loop, `fadeIn`) |

Anything with `loop: true` must be stopped on `cine:end` for that sequence —
the sequencer does not track audio handles by design.

Also please pick up volumes from `ui:settings` (`volMaster`, `volMusic`,
`volSfx`, all 0..1) and drive the journal's tape transport:

```js
bus.on('tape:play',  ({ id, time }) => ...);
bus.on('tape:pause', ({ id, time }) => ...);
bus.on('tape:stop',  ({ id }) => ...);
bus.on('tape:seek',  ({ id, time }) => ...);
// and push the head position back so the transcript follows the audio, not a timer:
ui.setTapeTime(id, seconds, isPlaying);
```

## 6. Nobody writes `engine.grade.uniforms` directly any more

Three systems want the same dozen uniforms. `ui.deck` (a `GradeDeck`) arbitrates
them: additive channels sum, exposure and saturation multiply, fades take the
maximum. Take a named layer and set it; drop it when you are done.

```js
const dread = ui.deck.layer('director', 20);
dread.set({ uDread: 0.4 });
await dread.to('uDread', 0, 1.2);
dread.retire();      // fades this layer's whole contribution out, then removes it
```

Direct writes still "work" but will be overwritten on the next frame, and will
silently cancel a cinematic. Layers currently in use: `vitals` (10, UI),
`screen` (200, UI), `cine:<name>` (100, sequencer).

## 7. `src/systems/Interactor.js` (gameplay) — drive the prompt

```js
ui.setPrompt(target ? {
  verb: target.verb,                 // 'Open', 'Turn valve', 'Read'
  key: 'E',
  hold: !!target.holdTime,
  requires: target.requires && !inventory.has(target.requires)
    ? prettyName(target.requires) : null,
  subject: target.roomNumber,        // optional, e.g. '7/L-112'
} : null);

ui.setHoldProgress(heldFor / target.holdTime);   // 0..1
```

Pass `null` the moment the target leaves range. The prompt does its own
transitions; calling `set` with identical values every frame is free.

## 8. Save detection for the title screen's CONTINUE

The menu enables CONTINUE if `localStorage.getItem('annex.save')` is non-empty.
If saves live anywhere else, call `ui.setHasSave(true|false)` after loading.

## 9. `src/core/Input.js` — do not also act on the UI's keys

The UI binds `window` keydown itself and owns `Escape`, `Tab`/`KeyJ` and `KeyO`,
plus `Space`/`Escape` as the cinematic skip hold. `Input` may keep emitting its
`press:journal` / `press:cancel` events, but nothing else should *act* on them
or the journal will open and close in the same frame.

If you would rather route keys yourself, construct with `bindKeys: false` and
call `ui.key(code)` / `ui.keyUp(code)`; `ui.key` returns `true` when it consumed
the key.

## 10. Pointer lock

The UI calls `input.exitLock()` when a modal screen opens and emits
`ui:screen {screen, open}`. Re-acquiring the lock is the integrator's call —
suggested:

```js
bus.on('ui:screen', ({ open }) => { if (!open && !ui.isModal) input.requestLock(); });
```

## 11. Circuit names used by the authored sequences

Sequences call `rig.setCircuit(name, powered)` and emit `light:circuit`. These
names are parameterised with the defaults below; either name the circuits this
way or pass overrides in the sequence params.

`intake_a`, `intake_far`, `lift_car`, `cistern_bulk`, `residence_pendant`,
`plant_bay_a`, `plant_bay_b`, `plant_bay_c`, `impossible_far`, `office_lamp`,
`yard_daylight`.

`rig.setCircuit` on an unknown circuit is harmless, so nothing breaks if a name
is wrong — the lighting beat just does not land, which is worse than a crash
because it is silent. Please confirm the names when the zones exist.

---

## Not requests — notes for whoever integrates

- `ui.cine.play()` returns a promise that resolves on **every** exit path
  (completed, skipped, interrupted, error). It is always safe to `await`.
- Calling `play()` while a sequence is running interrupts the old one cleanly
  first. There is no queue, on purpose.
- `params.onSwap` is invoked exactly once per transition, inside the occluded
  window, and again from `onEnd` if the sequence was skipped or interrupted
  before it fired. Make it idempotent anyway.
- Every sequence falls back to the player's live pose if `origin`/`yaw` are
  omitted, so they can be wired up before the world has real coordinates.
- QA: `sh tools/qa/shots.ui.run.sh docs/captures/ui/<round> 1280 720` shoots
  every screen; `node tools/qa/shots.ui.cinetest.mjs --port 5304` runs every
  sequence watched and skipped and fails on stuck control, stuck grade channels
  or camera discontinuity.
