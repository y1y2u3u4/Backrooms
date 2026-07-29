# THE ANNEX

A first-person liminal-horror game that runs in a browser. Three.js, no
photographic source art, no audio files — every surface and every sound is
synthesised at load.

> Meridian Facilities Management held the maintenance contract on Annex 7, a
> 1970s local-government office block extended four times by four different
> architects. In 1994 the building stopped matching its own floor plans.
>
> Meridian did not evacuate. They issued a revised procedure.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
```

Production build:

```bash
npm run build      # -> dist/
npm run preview    # http://localhost:4173
```

Query parameters:

| param | effect |
|---|---|
| `?quality=low\|medium\|high` | force a quality tier instead of auto-detecting |
| `?qa=1` | skip the menu and fades; expose `window.ANNEX` for the harness |

## Controls

| | |
|---|---|
| `W A S D` | move |
| `Shift` | sprint (loud) |
| `Ctrl` / `C` | crouch (quiet) |
| `Q` / `R` | lean |
| `E` | interact — hold for valves, cranks and anything with resistance |
| `F` | lamp on/off — **the switch clicks, and clicks carry** |
| `V` | hold to cover the lamp with your hand — silent |
| `B` | fit a spare cell |
| `Tab` / `J` | journal: notes, tapes, the map you are drawing |
| `Esc` | pause |

## The rules nobody tells you

The Surveyor moves in light and freezes in darkness. Your lamp is light.
Pointing it at the thing helps the thing.

It is blind. It hears you. Wading and running are loud; crouching is nearly
silent; doors are loud; dropping something is loud on purpose.

When it loses you it stops and measures a wall. That is your window.

---

## Architecture

```
src/
  Game.js              integration: boot order, frame loop, state machine
  core/                Engine (renderer + post chain), Input, Assets, util
  render/              TextureForge, MaterialLibrary, Lighting, fog, GradePass
  world/               Builder, Kit, Palette, Props, Decals, World, zones/
  player/              Player, Physics, Interactor, Flashlight, Hands, Inventory
  systems/             Interactables, Director, Progression, Notes
  entities/            Surveyor, Attendant
  audio/               AudioEngine, Synth, Ambience, Footsteps, EntityAudio, Music
  ui/                  UI facade, Menu, Journal, Prompts, Subtitles, screens
  cinematics/          Sequencer and the authored sequences
tools/
  blender/             asset generation scripts (Blender 4.0, headless)
  qa/                  capture, contact sheets, perf, playtest, diagnostics
```

Three ideas carry most of the visual weight:

**Everything is synthesised.** `TextureForge` writes PBR sets on the CPU at
load from noise recipes. `Synth` does the same for audio. Nothing is fetched, so
there is nothing to look repetitive — the variation is generated, not sampled.

**Anti-repetition lives in the shader, not the texture.** `MaterialLibrary`
injects world-space macro variation, leak streaks, traffic wear, grounding dirt
and a stochastic two-tap re-tile into every standard material. A 1.5 m tile
repeated 20 times down a corridor stops reading as a grid because the
large-scale structure has a much longer period than the tile does.

**Detail is cheap, draw calls are not.** `Builder` accumulates thousands of
small pieces — every skirting board, every conduit clip, every ceiling tee —
into a handful of merged meshes per chunk. That is what makes it affordable to
put in the construction detail that separates a believable interior from a set
of boxes.

See `docs/DESIGN.md` for the world bible, the architectural rules and the code
contracts between subsystems.

## QA tooling

```bash
npm run build
node tools/qa/capture.mjs --out docs/captures/rN --quality low --width 800 --height 450
node tools/qa/contactsheet.mjs --in docs/captures/rN --cols 4
node tools/qa/playtest.mjs        # input-driven smoke test
node tools/qa/perf.mjs            # workload budgets (see the caveat below)
node tools/qa/status.mjs          # boot + subsystem report
```

**Performance caveat.** The development environment has no GPU; headless
Chromium runs WebGL on SwiftShader, a CPU rasteriser. Absolute frame times
measured here are one to two orders of magnitude worse than the same build on
real hardware and are not a valid 60 fps verdict. `perf.mjs` therefore reports
hardware-independent workload budgets (draw calls, triangles, active lights,
shadow casters, shader permutations, logic-only CPU time) as the primary signal,
with the SwiftShader frame time alongside as a relative regression check only.

## Captures

Representative frames live in `docs/captures/`. Each round directory contains
the frames, a `manifest.json` with per-shot draw-call and triangle counts, and
the browser console log for that run.
