# Integration requests — audio

Owned by the audio agent. Everything the audio system needs from files it does
not own goes here. Nothing in this document is urgent enough to block anyone:
the audio system degrades to silence rather than throwing, and every hook below
is optional.

---

## 1. Integrator — `src/main.js` / `src/Game.js`

The whole system is four calls. Signatures are documented at the top of
`src/audio/index.js`; this is the short version.

```js
import { createAudio } from './audio/index.js';

// in boot(), after collision / rig / camera exist. Cheap — no AudioContext yet.
this.audio = createAudio({
  bus:       this.bus,
  collision: this.collision,
  camera:    this.engine.camera,
  rig:       this.rig,
});
this.audio.bindPlayer(this.player);        // optional: breathing follows exertion

// from a user gesture. Safe to call repeatedly; only the first does work.
this.canvas.addEventListener('click', () => this.audio.init());

// in step(), AFTER player.update() so the camera matrix is current.
this.audio.update(dt, this.engine.camera.position);
```

`createAudio` already installs a one-shot `pointerdown`/`keydown` listener that
calls `init()`, so if the canvas click handler is inconvenient it will still
start on the player's first input. Pass `options: { autoInit: false }` to
suppress that (the QA harness does).

**Requests:**

- **R1.1** Call `audio.update(dt, camera.position)` once per frame from
  `Game.step()`, after `player.update()`. If audio is not initialised this is a
  two-comparison no-op.
- **R1.2** `audio.dispose()` on teardown, if teardown ever exists.
- **R1.3** *(nice to have)* expose `game.audio.stats` alongside `engine.stats`
  in the QA overlay — it reports live voice count, node count, the current
  reverb profile, how many fluorescent hums are running and the AudioContext
  state. A stuck `state: 'suspended'` is the single most likely audio bug in
  the field and it is invisible without this.
- **R1.4** *(nice to have)* a settings surface for `audio.setVolume(0..1)`,
  `audio.setBusVolume('music', v)` and `audio.toggleMute()`.

Nothing else in `main.js` needs to change. The audio system reads
`rig.fixtures[]`, `collision.occlusion()` and `camera.matrixWorld`; it writes to
none of them.

---

## 2. World / environment agent — `src/world/**`

### R2.1 — `reverb` in the zone return value (already in the DESIGN.md contract)

Zone builders already promise a `reverb` key. Valid values:

| key | space |
|---|---|
| `corridor` | Intake — low ceiling, carpet, vinyl. Tight and dull. |
| `tiled` | small hard-tiled service corridor. Bright, slappy. |
| `service` | Service Spine — board-formed concrete. |
| `hall` | The Plant — 14 m cathedral, 3.1 s tail. |
| `cistern` | drowned tunnel, tuned slap-back at 74 Hz. |
| `dead` | The Residence — carpet and damask, nearly anechoic. |
| `duct` | inside a 0.8 m galvanised box. |
| `stack` | the vertical shaft. |
| `safe` | Office of Record. |

Zone *names* also work (`intake`, `service`, `cistern`, `residence`, `plant`,
`duct`, `stack`, `safe`) and map to the right profile automatically, so emitting
`zone:enter { zone: 'cistern' }` is enough and no extra call is needed.

### R2.2 — ambience emitters

Point sources the ambience system will spatialise, start and stop by proximity.
Purely additive — the beds work without any of them, but a grille you can walk
past is worth more than any amount of global bed.

```js
// during zone build, or any time after
ctx.bus.emit('audio:emitter', { kind, position: [x, y, z], ...opts });
// or, if the world has a handle on the facade:
audio.addEmitter(kind, [x, y, z], opts);
```

| kind | opts | put one at |
|---|---|---|
| `vent` | `gain`, `radius` (default 18), `tone` (Hz, default 900) | every grille, duct opening, AHU face |
| `drip` | `vessel` 0..1 (0 = deep steel drum, 1 = shallow tile puddle), `gain` | under every leak, stain and dripping pipe |
| `water` | `gain`, `radius` | running water: a broken main, an overflow, a tap |
| `transformer` | `freq` (default 100), `gain`, `radius` | substations, distribution boards, the Plant |

A `drip` emitter does not loop — it feeds the Poisson drip scheduler with a
position and a vessel size, so drips arrive at real leaks at irregular intervals
instead of scattering randomly around the player.

### R2.3 — floor `surface` strings

`CollisionWorld.addFloor(rect, y, { surface })` drives footstep synthesis. The
synthesised surfaces are:

`carpet`, `carpet_damp`, `concrete`, `lino`, `tread`, `duct`, `water`

Aliases already resolved: `dampCarpet`/`wetCarpet` → `carpet_damp`;
`tile`/`screed`/`slab` → `concrete`; `vinyl`/`linoleum`/`wood`/`floorboard` →
`lino`; `metal`/`grate`/`grating`/`plate`/`gantry` → `tread`; `silt`/`flooded` →
`water`. Anything unrecognised falls back to `concrete`, which is the safe wrong
answer rather than silence. `water > 0.06` on a floor overrides the surface with
the splash model regardless of the label.

**Request:** use `carpet_damp` in the wetter parts of Intake and `tread` on
gantries and walkways. Those two are the most distinctive surfaces in the set
and they are currently unused.

### R2.4 — the Plant's proximity cue

The Plant's thrum is a navigational cue: it should get louder as the player
approaches from two zones away. The world knows the distance; audio does not.

```js
audio.setMachineProximity(clamp01(1 - distanceToPlant / 90));
```

Call it a few times a second, or once per zone change with a coarse value. If
never called it sits at each zone's default, which is correct but static.

---

## 3. Gameplay agent — `src/systems/**`, `src/entities/**`

### R3.1 — `entity:state`

Already in the DESIGN.md contract. Payload `{ entity, state, position }`.
Recognised states for `entity: 'surveyor'`:

| state | audio |
|---|---|
| `dormant` / `idle` | silence; presence loop released |
| `spawn` | presence loop + the approach whine |
| `approach` | **the whine** — 3-4 s of warning, direction-ambiguous |
| `hunt` | heavy footfalls ~1.3 s apart, head ticks, presence at full |
| `search` | slower footfalls ~1.7 s apart, more frequent head ticks |
| `measure` | the measuring pose; footfalls stop for ~3.6 s |
| `frozen` | near-silence; only the faint presence tone remains |
| `capture` | the white-noise plate, everything else ducked 92 % |
| `despawn` | presence released over 1.6 s |

Aliases are accepted (`chase`/`pursue`/`walk`/`move` → `hunt`, `lost`/`pause` →
`measure`, `dark`/`still` → `frozen`, `caught`/`kill` → `capture`, and so on),
so emitting whatever the AI already calls its states will almost certainly work.

**Requests:**

- **R3.2** Emit `entity:state` with a `position` every time the state changes,
  and call `audio.entity.setPosition(pos)` (or re-emit with a position) a few
  times a second while it is moving. Without a position the footfalls and head
  ticks play at the origin, which is worse than not playing at all.
- **R3.3** Emit `approach` **3-4 seconds before** the Surveyor actually starts
  advancing. DESIGN.md §2.4 makes the whine a promise to the player; if the
  state machine emits `hunt` with no warning the audio system fires the whine
  anyway, but 3 s late, which is exactly the failure the design forbids.
- **R3.4** Emit `entity:heard { position }` when it turns toward a noise. That
  becomes the head-plate tick, which is the only clean directional cue the
  player ever gets.
- **R3.5** For the Attendant, either emit `entity:state { entity: 'attendant',
  state: 'step' | 'shift' | 'write' | 'breath' | 'any', position }` at the
  moment the evidence is placed, or set a background rate with
  `audio.entity.setAttendantActivity(0..1)` and let it place its own. Both work;
  the first is better, because the sound should coincide with the chair that
  moved.

### R3.6 — the horror-beat duck

`Silence` is the loudest tool available and it needs a director to fire it.

```js
audio.holdBreath(3.5);          // duck over ~2.5 s, hold, snap back
audio.beat('imminent');         // presets: imminent | dread | reveal | threshold | reprieve
audio.silence.setPressure(fear) // or drive it continuously
```

Fire `beat('imminent')` 3-4 s before anything the player is meant to dread, and
`beat('reprieve')` when it passes.

### R3.7 — music cues

The music budget is five cues per playthrough, enforced in code
(`Music.budget`), with a 210 s minimum gap. Requests past the budget are logged
and refused. Cue names: `arrival`, `contact`, `core`, `descent`, `vertigo`,
`seen`, `ending`. `item:pickup` with an id matching `/core|fuse/` already fires
`core` automatically, and `game:ending` fires `ending`.

Also: `audio.setSafeRoom(true|false)` on entering and leaving the Office of
Record. That one is not a cue and is not budgeted.

---

## 4. UI / cinematics agent — `src/ui/**`, `src/cinematics/**`

- **R4.1** Registered UI sounds: `ui.click`, `ui.hover`, `ui.deny`, `ui.note`,
  `ui.journal`. Play them with `bus.emit('audio:play', { name: 'ui.click' })`
  or `audio.play('ui.click')`. They are on their own bus and duck independently.
- **R4.2** `cine:begin` / `cine:end` are already wired: ambience and world duck
  45 % under a cinematic and return over 1.6 s. Emit them and nothing else is
  needed.
- **R4.3** Settings sliders should call `audio.setVolume(v)` and
  `audio.setBusVolume(name, v)` for `ambience | world | entity | player | music
  | ui`. Do not add your own gain nodes — the master chain is limited and a
  second limiter upstream of it will pump.

---

## 5. Things audio deliberately does NOT need

Recorded here so nobody builds them:

- **No audio files, ever.** Every sound is synthesised at runtime. There is
  nothing to load, nothing to stream, no manifest and no loading-bar entry.
- **No changes to `Lighting.js`.** The hum reads `fixture.level`, `.type`,
  `.health` and `.group.position` and writes nothing. Fixtures added or removed
  at runtime are picked up automatically within ~0.31 s.
- **No changes to `Physics.js`.** `occlusion()` is used exactly as it is. Note
  for the record: its five probes are offset ±0.35 m laterally, so any opening
  wider than 0.7 m reads as fully open. That is the right trade for cost, and
  the audio system does not need it changed — but it does mean a standard
  doorway is acoustically transparent, which is arguably correct anyway.
- **No changes to `Player.js`.** `player:step` and `player:land` carry
  everything footstep synthesis needs.

---

## 6. Verification

```
node tools/qa/audio-probe.mjs           # full numeric report, exit 4 on failure
node tools/qa/audio-probe.mjs --png     # also writes waveform strips
```

Renders every registered sound twice through an OfflineAudioContext in headless
Chromium and checks that nothing is silent, clipping or DC-offset, that two
triggers of the same sound differ, that the generated impulse responses have the
T60 they claim and are level-matched, that occlusion makes a source duller,
quieter *and* more reverberant, and that the fluorescent hum's envelope tracks a
dying fixture's flicker curve. It needs no build; it starts its own Vite dev
server on port 5303.
