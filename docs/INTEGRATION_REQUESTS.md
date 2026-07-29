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
