# THE ANNEX — completion report

_Status: in progress. This file is updated at each milestone and finalised after
the third independent judge round._

---

## 1. What exists

### Engine and rendering
- WebGL2 renderer with a custom post chain: GTAO, selective bloom, AgX tone
  mapping, split-tone grade, GPU eye adaptation, restrained vignette /
  aberration / grain.
- Height-stratified atmospheric fog with a per-zone profile, replacing three's
  flat exponential fog so haze pools in corridors and drains out of volumes.
- `TextureForge`: 16 procedural PBR surface recipes synthesised on the CPU at
  load. No photographic source art anywhere in the project.
- `MaterialLibrary`: shader-injected anti-repetition — world-space macro
  variation, stochastic two-tap re-tiling, leak streaks, traffic wear,
  grounding dirt, per-zone wetness, distance-faded detail normals.
- `LightRig`: fixtures with physical candela intensities, five flicker
  personalities, circuit switching, a distance-ranked active-light budget and a
  hysteretic shadow-caster budget.
- Per-zone bounce fill standing in for global illumination.

### World
- Eight zones: Intake, Service Spine, Cistern, Residence, Plant, Ductwork,
  Stack, Office of Record.
- `World` streams zones on demand through a portal graph, keeping three
  resident, tearing down geometry, colliders and fixtures together.
- `Kit` modular construction language: 160 mm walls that show their thickness
  at every opening, bullnose skirtings, ceiling perimeter angles, exposed-tee
  suspended ceilings with services in the plenum.
- `Props` and `Decals` set-dressing libraries.

### Gameplay
- First-person controller with authored camera motion, lean, crouch, stamina,
  surface-aware footfalls and a noise model.
- Inspection lamp with battery, brown-out, and a silent hand-cover that matters
  because the switch is audible.
- Interaction, inventory, breakers, valves, lift, keypads, terminals,
  generator, hiding places.
- **The Surveyor** — moves only in light, hunts by sound, measures walls when it
  loses the trail, announced by a rising transformer whine.
- **The Attendant** — no model; evidence only.
- Director, progression and the three-fuse-core critical path.

### Audio
- Fully synthesised: no audio files. Zone convolution reverbs from procedural
  impulse responses, per-fixture fluorescent hum locked to each fixture's live
  flicker, occlusion-driven filtering, surface-modelled footsteps, entity voice.

### UI and cinematics
- Bureaucratic-paperwork visual identity: job dockets, incident reports, rubber
  stamps, carbon copies.
- Title over a live drifting camera, journal, settings, pause, death, ending.
- Sequencer with authored intro, transitions, lift, entity reveal, capture and
  ending sequences.

### Blender assets
Authored headless in Blender 4.0.2 (`tools/blender/`), exported as GLB, and
re-materialised in-engine against the procedural palette so they share the
game's lighting and wear language rather than carrying baked textures.

| asset | tris | size (m) | named parts |
|---|---:|---|---:|
| `surveyor.glb` — the entity | 9 680 | 0.96 × 2.95 × 0.46 | 9 |
| `breaker_panel.glb` | 7 264 | 0.61 × 0.90 × 0.19 | 15 |
| `hands_lowpoly.glb` | 5 304 | 0.36 × 0.24 × 0.11 | 2 |
| `fuse_core.glb` — hero puzzle item | 4 470 | 0.11 × 0.31 × 0.12 | 16 |
| `handheld_lamp.glb` | 2 660 | 0.06 × 0.07 × 0.26 | 14 |
| `valve_wheel.glb` | 2 016 | 0.39 × 0.36 × 0.28 | 6 |

Every asset keeps its moving parts as separately-named objects with pivots on
the real axis, so the game animates them procedurally: breaker toggles, the
valve wheel on its stem, the panel door on its hinge, and the Surveyor's nine
joints. `public/assets/models/manifest.json` documents every sub-object and its
material slot; turntables are in `docs/assets/`.

---

## 2. Performance measurements

_(filled in at final verification — see the environment caveat in README.md)_

---

## 3. Remaining limitations

_(filled in at final verification)_

---

## 4. Judge feedback and how it was addressed

_(filled in after each round)_

---

## 5. Artefacts

| what | where |
|---|---|
| Build | `npm run build` → `dist/` |
| Design bible | `docs/DESIGN.md` |
| Capture rounds | `docs/captures/rN/` |
| Contact sheets | `docs/captures/rN/_sheet.png` |
| Artifact analysis | `docs/captures/rN/_artifacts.json` |
| Blender asset sheets | `docs/assets/` |
| Performance data | `docs/captures/perf.json` |
