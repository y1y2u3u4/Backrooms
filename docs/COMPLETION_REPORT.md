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
_(filled in at final verification)_

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
