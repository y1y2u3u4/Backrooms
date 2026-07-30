# THE ANNEX — design bible

Everyone working on this project reads this file first. It is the shared source
of truth for fiction, art direction and code contracts.

---

## 1. Premise

**Meridian Facilities Management** held the maintenance contract on **Annex 7**,
a 1970s local-government office block extended four times by four different
architects. In 1994 the building stopped matching its own floor plans.

Meridian did not evacuate. They issued a revised procedure. Night-shift
custodians kept working, logging discrepancies on carbon-copy forms, and
management kept paying them. The revisions accumulated until the procedure was
longer than the building's original specification, and then the paperwork
stopped.

You are a Meridian contractor who took a night call-out to reset a tripped
supply. The lift doors opened on a floor that is not on the schedule.

**Objective:** restore three-phase power to the goods lift in the Plant and ride
it out. That requires three **fuse cores** from three different parts of the
building, and the building does not want to give them up.

**The building's rule, learned not told:** Annex 7 rearranges itself, but only
in rooms nobody is looking at. Doors you came through are not always doors you
can go back through.

## 2. The Surveyor

One entity is fully realised. Everything else is evidence.

**Silhouette:** ~2.9 m, extremely narrow. Head is a square louvred
ceiling-diffuser plate on a long neck. Torso is a column of stacked, offset
plates. Arms are too long, too many segments, ending in flat measuring blades.
Legs reversed at the knee.

**Behavioural language — the player must be able to learn all of this without
being told:**

1. **It only moves in light.** Under a lit fixture it advances. In darkness it
   is frozen mid-stride. The player's lamp counts as light — pointing the lamp
   at it *helps it*. This inverts the usual horror instinct and is the single
   most important mechanic in the game.
2. **It is blind.** It navigates by sound: footsteps, doors, dropped objects,
   running water, machinery. Wading and sprinting are loud. Crouching is nearly
   silent.
3. **It measures.** When it loses the player it stops and extends an arm
   against a wall, holding still for several seconds. This is the player's
   window to move.
4. **It announces itself.** A rising transformer whine precedes it by 3-4
   seconds, direction-ambiguous at distance. Learn the whine, live longer.
5. **It does not chase far.** It commits to a straight line toward the last
   sound. Break line-of-sound and kill the lights and it will lose you.

**Never:** it does not sprint at the player from off-screen, it does not
teleport into frame, it does not scream on contact. On capture it simply
reaches the player, and the frame goes to a plate of white noise.

**The Attendant** is the second presence and has no model at all. It is only
ever evidence: a chair turned to face the door you are about to open, wet
footprints that start in the middle of a room, a locker that was open and is
now shut, your own name written on a form you have not filled in.

## 3. Zones

| Zone | Feel | Signature | Fog profile |
|---|---|---|---|
| **Intake** | Oppressive, over-lit, endless | Mustard vinyl wallcovering, damp loop carpet, 2.78 m ceiling, unbroken fluorescent hum | `intake` |
| **Service Spine** | Cold, functional, load-bearing | Board-formed concrete, painted block, surface conduit, strip lights, 2.95 m | `service` |
| **The Cistern** | Drowned, echoing, slow | Knee-deep standing water, corroded steel, bulkhead lamps, silt | `cistern` |
| **The Residence** | Wrong-domestic, intimate | Faded damask, plaster, pendant lamps, numbered doors, carpet runner | `residence` |
| **The Plant** | Vast, cathedral, humming | Generator hall, high-bay sodium, gantries, machinery, 14 m volume | `plant` |
| **Ductwork** | Crushing, blind, tactile | 0.8 m galvanised crawls, forced crouch, no lights but the lamp | `duct` |
| **The Stack** | Impossible, vertiginous | A vertical shaft of identical office floors receding up and down forever | `stack` |
| **Office of Record** | Safe — probably | Warm desk lamp, a working kettle, a chair, filed carbon copies | `safe` |

**Architectural rules that make it one building:**

- Everything is on a 4.2 m structural grid, in every zone. The Cistern's
  columns line up with Intake's. The player should half-notice this.
- Wall thickness 160 mm, always shown at an opening.
- Every wall meets the floor through a skirting and the ceiling through a
  perimeter angle. No bare plane intersections. Ever.
- Services (conduit, pipes, ducts) run continuously between zones. A pipe that
  leaves the Cistern arrives in the Plant.
- Signage uses one typeface and one plate format throughout, with room numbers
  in the format `7/L-nnn`.

## 4. Visual rules

**Do:**
- Chamfer every visible edge. 2-4 mm.
- Light from visible sources only. If it glows, there is a fixture.
- Vary damage with a gradient, not a coin flip. The far corner is the ruined one.
- Put the eye somewhere: every long view needs one bright, legible focal element.
- Keep the frame readable at normal exposure. A well-exposed inspection
  screenshot must still look like a real place.

**Do not:**
- Hide anything behind darkness, fog, grain, aberration or shake. The grade is
  deliberately restrained; if a shot only works with the vignette at 0.8, the
  shot is broken.
- Repeat a prop within one sightline without rotating, scaling or damaging it.
- Use uniform grime. Dirt collects in cavities, at floor lines, and under leaks.
- Ship a raw `BoxGeometry` with visible sharp edges.

### Where the shape in a frame comes from

The Annex is lit the way a real office plate is lit: a troffer every couple of
metres, all pointing straight down, and 127 of them in the Intake alone. Measured
at head height in a corridor that is about 19 units of direct light against 0.5 of
bounce fill. It also means the *floors* get nearly all of the direct light and
every vertical surface is at a grazing angle to every fixture, so walls are lit
almost entirely by bounce — and bounce, in a renderer with no GI, is a hemisphere
constant that reaches everywhere equally.

That is why the walls used to be flat. Three systems now supply the shape a real
room gets for free, and they are not interchangeable:

| System | Scale it works at | What it is for |
| --- | --- | --- |
| `render/AOVolume.js` | metres | A room's own shape. Corners, reveals, the top and bottom of a wall, the base of a column. Baked per zone, sampled by world position, multiplies indirect only. |
| GTAO (`core/Engine.js`) | centimetres | Contact shading. A skirting board's bevel, a prop where it meets the floor. |
| Injected detail normal (`render/Materials.js`) | millimetres | Micro-relief when the player's face is against a wall. |

Two rules about the volume, both learned the hard way:

- It must not change a zone's average exposure, only the distribution. Occlusion
  moves light, it does not delete it. `AOVolume.fillCompensation` scales the
  bounce fill back up by the field's own mean so the zone stays at the exposure it
  was authored at; without it the Intake sat about a stop and a half under.
- It needs a floor clamp. With no GI there is no multi-bounce term for a crease
  to fall back on, so an unclamped occlusion drives towards black rather than
  towards dim — which crushed the shaded side of a light pool on the carpet.

### Anti-aliasing

MSAA lives on the composer's render target (`q.msaa`), not on the WebGL context.
`antialias: true` on the context does nothing once the scene renders into a
composer target instead of the default framebuffer. This is load-bearing rather
than a nicety: the building is made almost entirely of thin high-contrast edges —
tee flanges, conduit, skirting, handrails, door stops — and seen near edge-on
those go sub-pixel and break into strings of isolated black dots.

## 5. Code contracts

### Build context

Every zone builder receives a `ctx`:

```js
{
  materials,   // MaterialLibrary
  collision,   // CollisionWorld
  rig,         // LightRig
  palette,     // key -> material factory  (src/world/Palette.js)
  scene,       // THREE.Scene
  bus,         // event bus
  assets,      // GLB registry (src/core/Assets.js), may be empty
}
```

and returns:

```js
{
  root,        // THREE.Group added to the scene
  chunks,      // THREE.Group[] — one per culling chunk
  spawn,       // [x, y, z]
  spawnYaw,    // radians
  bounds,      // THREE.Box3
  portals,     // Portal[] — see below
  interactables, // Interactable[]
  fogProfile,  // key into FOG_PROFILES
  reverb,      // key into the audio engine's reverb profiles
}
```

### Portals

A portal connects two zones. Transitions are always motivated — a door, a lift,
a hatch, a flooded stair — never a hard cut.

```js
{ id, zone, position: [x,y,z], yaw, target: {zone, portalId}, kind: 'door'|'lift'|'hatch'|'stair', locked: false }
```

### Interactables

```js
{
  id, object,            // THREE.Object3D used for the raycast
  label,                 // 'Open', 'Turn valve', 'Read'
  verb,                  // shown in the prompt
  range: 2.2,
  enabled: true,
  requires: 'keycard_b', // optional inventory gate
  onFocus(player) {}, onBlur() {},
  onUse(player, game) {},
}
```

### Events on the bus

| Event | Payload | Emitted by |
|---|---|---|
| `player:step` | `{surface, water, strength, crouch, left, position}` | Player |
| `player:land` | `{force, surface}` | Player |
| `player:noise` | `{position, radius}` | Player, props |
| `zone:enter` | `{zone, from}` | World |
| `zone:leave` | `{zone}` | World |
| `light:circuit` | `{circuit, powered}` | Puzzles |
| `entity:state` | `{entity, state, position}` | EntityManager |
| `entity:heard` | `{position, radius}` | EntityManager |
| `item:pickup` | `{id, name}` | Inventory |
| `story:note` | `{id, title, body}` | Interactables |
| `game:death` | `{cause}` | Director |
| `game:ending` | `{ending}` | Director |
| `cine:begin` / `cine:end` | `{name}` | Sequencer |

### File ownership

| Path | Owner |
|---|---|
| `src/main.js`, `src/Game.js`, `src/core/**` | integrator |
| `src/render/**` | integrator |
| `src/world/**` | environment agent |
| `src/systems/**`, `src/entities/**`, `src/player/Interactor.js`, `Flashlight.js`, `Hands.js` | gameplay agent |
| `src/audio/**` | audio agent |
| `src/ui/**`, `src/cinematics/**` | UI/cinematics agent |
| `tools/blender/**`, `public/assets/models/**` | Blender agent |
| `tools/qa/**`, `docs/captures/**` | QA agent |

Nobody edits a file they do not own. Cross-cutting changes go through the
integrator.
