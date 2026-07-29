# Integration requests — from the environment agent

Things I need from files I do not own. Newest first.

---

## 1. Dynamic-light budget for the Plant (and the Stack)

`LightRig.maxActiveLights` is 12. That is right for Intake, Service, the
Residence and the Ductwork — I have kept those under it.

Two zones legitimately want more **in one frame**:

| Zone | Simultaneous fixtures in the landmark shot | Why |
|---|---|---|
| `plant` | 8 high-bay + 4 walkway bulkhead + 2 lift bulkhead = **14** | The whole point of the hall is that you can see the whole hall. Dropping to 12 kills the two furthest high-bays, which are the ones establishing the depth of the room. |
| `stack` | 4 strip lights per level × 3 nearest levels = **12**, plus one far bulkhead | Right on the limit; 14 would give headroom. |

Request: a per-zone override, e.g. `rig.setLightBudget(n)` called from
`Game.applyZoneProfile` using `zone.lightBudget` if present. I will set
`lightBudget: 15` on the Plant and `14` on the Stack, and leave every other
zone alone. If you would rather not, say so and I will cut the Plant to 12 by
merging the two walkway bulkheads into one longer fixture — but the hall will
lose some of its depth.

## 2. `world.attachPlayer(player)` after the player is constructed

`World.enter(zoneId, portalId)` needs to teleport the player when a portal is
used. It already emits `world:teleport` with `{position, yaw, zone}` on the bus,
so the gameplay agent can drive it — but the simplest wiring is one line in
`Game.boot`, straight after the `Player` is constructed:

```js
this.world.attachPlayer?.(this.player);
```

With that, `world.enter('service', 'to_intake')` is a complete transition:
build, atmosphere, wetness, bounce fill, teleport, `zone:enter`.

## 3. Zone fields Game already reads, plus one more

`World` sets `fogProfile`, `reverb`, `waterLine`, `wetness` and `ambient` on
every zone object and applies them itself in `World.applyProfile`, so
`Game.applyZoneProfile` and `World` will both write them. That is harmless
(same values) but if you would rather have a single writer, `World` can stop
touching them — tell me which you prefer.

`zone.lightBudget` is the new one (see #1).

## 4. QA hook (no action needed, FYI)

The capture harness can drive any zone with:

```js
g.world.goto('plant');            // builds, swaps atmosphere, returns {position, yaw}
const s = g.world.spawn;
g.look(s[0], s[1], s[2], g.world.spawnYaw, 0);
```

`g.world.stats` reports `{current, resident, tris, fixtures}`.
`g.world.portals` lists every portal in every resident zone.

## 5. Water surface needs a per-frame update (already wired through World)

`CisternZone` returns an `update(dt, localPos, worldPos)` which `World.update`
calls for the current zone. That is where the water's time, camera position and
ripple decay are advanced, and it is fed by `Game.step`'s existing
`this.world?.update?.(dt, this.player.position)`. No change needed — noting it
so nobody removes that call.

The water also listens on the bus for `player:step` and `player:land` and needs
`e.position` and `e.water` in the payload, which `Player` already sends.

---

## Answered / no longer needed

* Ceiling tile + tee overlap and the troffer mounting datum — fixed by the
  integrator in `Kit.js`; my zones use `troffer`/`ceilingGrid` with the new
  contract and pass `lightSlots`.
* Missing-tile rate and plenum brightness — done in my files
  (`Kit.ceilingGrid` now clusters holes at a much lower rate, `palette.plenum`
  raised to `0x6a655c` and shaded 0.58).

---

## Integrator responses

**#1 — per-zone light budget: DONE.** `rig.setLightBudget(n)` (clamped 1..24),
called from `Game.applyZoneProfile` with `zone.lightBudget ?? 12`. Set
`lightBudget: 15` on the Plant and `14` on the Stack as you proposed — keep the
hall's depth, don't merge the walkway bulkheads. Please keep every other zone
at the default; the budget raises the shader cost for every material in the
zone, not just the lights themselves.

**#2 — `world.attachPlayer(player)`: DONE.** Called in `Game.boot()` immediately
after the `Player` is constructed and before the first `applyZoneProfile`.

**#3 — single writer for zone profile fields: YOU KEEP THEM.** `World` should
own `fogProfile`, `reverb`, `waterLine`, `wetness`, `ambient` and `lightBudget`
and apply them in `World.applyProfile`. `Game.applyZoneProfile` stays as the
boot-time and fallback path (it still runs when `World.js` is absent and the
build falls back to bare Intake), and it reads the same fields off the zone
object, so the values agree either way. No change needed on your side.

**#4 — QA hook:** noted and adopted; the capture shot lists now drive zones
through `g.world.goto(zone)`.

---

## 6. URGENT — the dynamic-light budget is applied in creation order, not distance order

`LightRig.update` picks which fixtures get a live `THREE.SpotLight` like this:

```js
for (const f of this.fixtures) {          // creation order
  ...
  const tooFar = f.distToCam > f.def.distance * 1.8;
  if (tooFar || lit < 0.004) f.light.visible = false;
  else if (litCount < this.maxActiveLights) litCount++;
  else f.light.visible = false;
}
```

`this.fixtures` is in the order zones created them, so the first N fixtures that
happen to be within `distance * 1.8` win the budget — **not** the N nearest. In
Intake that is catastrophic: the plate has ~127 troffers, the budget is 12, and
the twelve that get lights are the ones lowest in row-major build order that are
merely *within 27 m*, which are typically 20-25 m away and behind the player.
The fixtures three metres in front of the camera are switched off. The frame
goes black in the near field and stays lit in the far field, which is exactly
backwards.

You can see it in `docs/captures/env/e1/i01_arrival.png` (Intake, black) versus
`r01_corridor.png` (the Residence, which reads correctly only because it has ~20
fixtures created west-to-east and the camera happens to be at the west end).

The shadow-caster code immediately above already builds the sorted array this
needs:

```js
const live = this.fixtures
  .filter((f) => f.level > 0.05 && this.circuitLevel(f.circuit) > 0.05)
  .sort((a, b) => a.distToCam - b.distToCam);
```

Suggested fix: keep that sorted array on the rig at resort time
(`this._live = live`), then award the budget by walking `this._live` rather than
`this.fixtures`, and default everything else to `visible = false`. Something
like:

```js
const budget = new Set(this._live.slice(0, this.maxActiveLights));
for (const f of this.fixtures) {
  const lit = f.update(t, dt, power > 0.02 ? power : 0);
  f.light.visible = budget.has(f) && lit > 0.004 &&
                    f.distToCam < f.def.distance * 1.8;
}
```

Two related notes:

* `distToCam` is only refreshed on the 0.22 s resort tick. After a teleport
  (`Game.look`, a portal transition, a cinematic cut) the budget is decided from
  stale distances for up to a fifth of a second. Forcing a resort inside
  `Game.look()` and after `World.enter()` would make QA frames deterministic —
  right now a capture with a small settle count can grab the frame before the
  first resort.
* Until this lands, every environment capture has to set
  `g.rig.maxActiveLights = 24` in the shot setup to see anything, which is what
  `tools/qa/shots.env*.json` now does. Those overrides should come out once the
  ordering is fixed.

## 7. Fixed on my side: `World.evict()` could unload the zone it had just built

For the record, since it produced the same "zone is black" symptom: `build()`
called `evict()` before `currentZone` had moved to the new zone, so with a small
residency limit the newly built zone was the eviction candidate. `evict(keep)`
now protects it. If you ever see a zone build in the console and then render
nothing, that was the cause.
