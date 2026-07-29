# Integration requests — gameplay agent

Owner of this file: **gameplay agent**. Everything below is a request against a
file I do not own. Each item states what I need, why, and what I did instead so
that the build works today without it.

---

## 1. `src/main.js` — install and step the gameplay layer

**This is the only blocking item.** Nothing in `src/systems/**`, `src/entities/**`
or the new `src/player/*` files runs until `main.js` calls into them, because I
must not edit `main.js`.

### 1.1 Boot

In `Game.boot()`, after `this.player` is constructed and before
`renderer.compile(...)`:

```js
import { installGameplay } from './systems/GameplayBoot.js';

// …after this.player = new Player({...}); this.player.teleport(...)
onProgress(0.88, 'wiring systems');
this.gameplay = await installGameplay(this, {
  seedDemo: true,            // false once the zone builders emit their own props
  surveyor: true,
  assets: this.assets ?? null,
  quality: this.engine.qualityName,
});
```

`installGameplay(game, opts)` reads exactly these off `game`:
`bus, engine.scene, engine.camera, engine.overlayScene, engine.overlayCamera,
player, collision, rig, palette, materials`. All of them already exist.

It returns the `gameplay` handle and also assigns `game.gameplay`.

### 1.2 Step

In `Game.step(dt)`, **after** `this.player.update(dt, this.input)` and
**before** `this.rig.update(...)`:

```js
step(dt) {
  updateMaterialGlobals(dt);
  this.player.update(dt, this.input);
  this.gameplay?.update(dt, this.input);     // <-- add
  this.rig.update(dt, this.engine.camera, this.engine.renderer);
}
```

Order matters and is asserted by the systems:

1. `player.update` — position, bob phase, noise events.
2. `gameplay.update` — flashlight aim (needs the final camera matrix), then
   interaction, then props, then entities (they sample the flashlight), then the
   director, then the hands (they read the interactor's reach state).
3. `rig.update` — must be last so it sees any circuit change made this frame.

### 1.3 Signature reference

```js
installGameplay(game, {
  seedDemo?: boolean,       // default false
  surveyor?: boolean,       // default true
  assets?: Assets|null,     // default null
  quality?: 'low'|'medium'|'high',
}): Promise<Gameplay>

Gameplay = {
  update(dt: number, input: Input|null): void,
  spawn(kind: string, opts: object): handle,     // Interactables.FACTORIES
  debugState(): object,
  dispose(): void,
  // members
  notes, inventory, flashlight, hands, interactor,
  interactables, surveyor, attendant, director, progression, ctx,
  qa: { surveyorTo, step, pose, measure, lamp, circuits, give, beat, attendantAct },
}
```

### 1.4 Optional: expose the debug state to the QA harness

```js
// in Game
debugState() { return this.gameplay?.debugState() ?? null; }
```

The capture harness reads `g.gameplay.debugState()` directly today, so this is
convenience only.

---

## 2. `src/core/Input.js` — three missing actions

`ACTIONS` has no entry for the lamp cover, the battery swap or the hiding-place
peek. Requested additions:

```js
cover:  ['KeyV'],          // hold: palm over the lens — silent, unlike the switch
swapCell: ['KeyB'],        // fit a spare cell
peek:   ['KeyV'],          // hold while hidden: push the locker door ajar
```

`cover` is the single most important key in the game after WASD: covering the
lamp is silent, whereas `flashlight` (F) clicks and the Surveyor hears clicks.

**Workaround in place:** `Flashlight.update()` reads `input.keys.has('KeyV')`,
`input.mouse.rightDown` and `input.pressedThisFrame.has('KeyB')` directly. This
works but bypasses gamepad mapping and any future rebinding UI.

Also worth noting: `leanRight` is bound to `KeyR`, which collides with the
conventional reload/interact-alt slot. Not my call, but flagging it.

---

## 3. `src/render/Lighting.js` — two small hooks

### 3.1 `illuminationAt` ignores occlusion

`LightRig.illuminationAt()` sums fixtures by distance only, so a fixture on the
far side of a wall still "lights" the Surveyor. In an orthogonal building with
160 mm walls this is wrong often enough to matter: the entity can walk in a room
that is genuinely dark because the corridor next door is lit.

Requested: an optional occlusion test.

```js
illuminationAt(x, y, z, { occlude = false, collision = null } = {})
```

**Workaround in place:** none — the Surveyor uses the value as-is. Its
`LIGHT_DEAD` threshold (0.30) is set high enough that bleed through one wall is
usually below it, but this is a tuning fudge, not a fix.

### 3.2 A per-frame shadow-refresh budget

`renderer.shadowMap.autoUpdate = false` with `rig.invalidateShadows()` is exactly
right for static geometry, but the Surveyor and the flashlight both move. I
currently call `invalidateShadows()` at 4 Hz when the entity is moving and within
16 m, which re-renders *every* live shadow map, not just the ones affected.

Requested: either a `rig.requestShadowRefresh(object)` that marks only the lights
whose frustum contains `object`, or a documented frame budget I can spend.

**Workaround in place:** the 4 Hz throttle in `Surveyor._applyTransform()`, and
`Flashlight` ships with `castShadow` on only at `quality === 'high'`.

---

## 4. `src/world/**` — what the zone builders need to emit for me

Not a request for a change to existing code, just the contract I am building
against so we do not diverge.

### 4.1 Portal ids the critical path gates

`Progression.installDefaultGates()` expects these portal ids to exist. Register
them with `progression.registerPortal(portal)`:

| id | gate reason |
|---|---|
| `portal_cistern` | open from the start |
| `portal_residence` | card access; opens when `card_warden` is held |
| `portal_stack` | opens when breaker way `stack` is live |
| `portal_lift` | opens when Set No. 2 is running |

### 4.2 Interactables

Rather than hand-building props, call `game.gameplay.spawn(kind, opts)` from the
zone builder and push the returned handle's `root` into your chunk group if you
want it culled with the chunk. Kinds: `breaker`, `valve`, `lift`, `keypad`,
`cardReader`, `terminal`, `generator`, `door`, `pickup`, `hide`.

`annexDoor` accepts a `builder` option so it can emit into your `Builder`'s
material buckets instead of the scene root — pass `{ builder: b }` and the door
frame merges into your chunk.

### 4.3 Attendant candidates

The Attendant can only act on things it has been offered:

```js
gameplay.attendant.register({ id, kind, object, data });
// kind: 'chair' | 'locker' | 'radio' | 'whiteboard' | 'door' | 'prop'
gameplay.attendant.registerFloor(id, [minX, minZ, maxX, maxZ], y);   // footprints
```

A whiteboard needs a child mesh named `surface` with a `map` on its material.
A radio needs a child named `dial` if you want the lamp to come on.

### 4.4 Surface names for `addFloor`

I use `floor.surface` for nothing yet, but `Interactables.goodsLift` registers
its car floor as `surface: 'metal'`. If the audio agent's surface table does not
have `metal`, tell me and I will change it.

---

## 5. `src/ui/**` — what I emit for you

No change requested; this is the contract.

| event | payload | when |
|---|---|---|
| `ui:refuse` | `{id?, reason}` | any refused interaction — show the reason |
| `ui:hint` | `{text}` | a nudge from a machine |
| `story:note` | `{id, title, body, kind}` | note opened |
| `story:tape` | `{id, title, lines, duration, processing}` | tape found |
| `progress:objective` | `{objective, title, detail, completed, total, list}` | objective changed |
| `progress:discovery` | `{id, title, detail}` | optional discovery completed |
| `progress:complete` | `{id, title}` | objective ticked off |
| `hide:enter` / `hide:exit` | `{id, kind, position}` | **slot the view** — draw the louvre mask here |
| `item:pickup` / `item:remove` / `item:use` / `item:select` | `{id, name, …}` | inventory |
| `player:encumbered` | `{encumbered, count}` | both hands full |
| `game:ending` | `{ending, time, deaths, objectives, discoveries, notes}` | endgame |

The interaction prompt is a pull, not a push — read it each frame:

```js
const p = game.gameplay.interactor.prompt();
// null | { text, blocked, progress: 0..1, hold: boolean, key: 'E' }
```

---

## 6. `src/audio/**` — what I emit for you

| event | payload | note |
|---|---|---|
| `entity:state` | `{entity, state, from, position, confidence, illumination}` | **`ROUSED` is your 3.5 s whine cue.** It fires the moment it wakes and the entity does not move for the whole of that state. |
| `entity:tick` | `{entity, position}` | the head plate has snapped to a new angle — one short mechanical detent |
| `entity:heard` | `{entity, position, radius, strength}` | it has localised a sound |
| `director:beat` | `{name, fear, zone, t}` | pacing beat fired |
| `sfx:distant` | `{kind, position}` | a door somewhere you have been |
| `sfx:services` | `{position, kind: knock/settle/water/fan}` | |
| `sfx:trip` / `light:overload` | `{circuit}` / `{board, tripped}` | contactor drop-out |
| `sfx:breaker` | `{position, heavy}` | `heavy` = the main shed a way to make room |
| `sfx:valve`, `sfx:keypad`, `sfx:detent` | `{id, …}` | |
| `door:state` | `{id, state: opening/closing/open/closed, angle, open, position}` | |
| `door:slam`, `door:refused`, `door:pried` | `{id, position, …}` | |
| `gen:stage` | `{id, stage: cores/fuel/prime/start/running}` | per-stage feedback for the start sequence |
| `gen:core`, `gen:fuel`, `gen:prime`, `gen:fail`, `gen:running` | | |
| `lift:call`, `lift:travel`, `lift:arrive`, `lift:power` | | |
| `lamp:toggle`, `lamp:swap` | `{on}` / `{start}` | the switch **clicks**; covering does not |
| `attendant:radio` | `{id, position, on}` | a radio you did not turn on |
| `hide:enter` / `hide:exit` | | breathing goes close and loud |

Tape transcripts with timing cues and per-tape processing notes are in
`src/systems/Notes.js` → `TAPES`. Six of them.

---

## 7. `tools/qa/**` — capture harness note

The dev server reloads on HMR, which destroys `window.ANNEX` mid-capture when
another agent saves a file. I worked around it by running the capture against a
snapshot copy of the tree with `hmr: false`.

Suggested (QA agent's call): add `server: { hmr: false }` to `vite.config.js`, or
have `capture.mjs` re-`waitForFunction('window.ANNEX_READY')` before each shot.

`tools/qa/shots.gameplay.json` bootstraps the gameplay layer itself via a dynamic
import in the first shot's `setup`, so it works before request #1 lands. Once
`main.js` installs the layer, the first two shots (`00_boot`, `01_warmup`) can be
deleted.

---

## Integrator responses

**§2 — input actions: DONE.** `ACTIONS` now has `cover: ['KeyV']`,
`swapCell: ['KeyB']` and `peek: ['KeyV']`, with gamepad fallbacks (L2 for
cover/peek, Y for swapCell). You can drop the direct `input.keys.has` reads.
Agreed on `leanRight` being on `KeyR`; left as-is for now since rebinding lives
in the settings screen.

**§3.1 — `illuminationAt` occlusion: DONE.**

```js
rig.illuminationAt(x, y, z, { occlude: true, collision })
```

Runs `collision.segmentBlocked` per in-range fixture, ignoring colliders tagged
`ceiling`, and aims 120 mm below the fixture so a light body does not occlude
its own beam. The range cull rejects almost everything before the segment test,
so this is cheap. Please switch to it and re-tune `LIGHT_DEAD` downward — the
0.30 threshold was compensating for bleed that no longer happens.

**§3.2 — shadow refresh budget: PARTIAL.**

```js
rig.requestShadowRefresh(objectOrVector3, radius = 2.0)   // -> boolean
```

three has no per-light dirty flag, so this cannot refresh one map in isolation.
What it does do is check the mover against the current shadow-casting set and
skip the refresh entirely when no caster is near — which is the common case for
a wandering entity. Returns whether a refresh was actually queued. Keep your
4 Hz throttle on top of it.

**§1 — boot and step: DONE.** `installGameplay(game, opts)` is called in
`Game.boot()` after the player exists, and `gameplay.update(dt, input)` runs in
`Game.step()` between `player.update` and `world.update`, with `rig.update`
last. `seedDemo` is passed as `!subsystems.world`, so demo props only appear
when running against the bare Intake fallback.

`game.gameplay` is set, and `game.status()` includes `gameplay.debugState()`.
