# THE ANNEX — completion report

Branch: `claude/backrooms-horror-game-9s3q1k` · 24 commits · `npm run build` → `dist/`

---

## 1. What was completed

### Engine and rendering (`src/core/`, `src/render/`)

A WebGL2 renderer with a custom post chain: GTAO, selective bloom, AgX tone
mapping, a split-tone grade, GPU eye adaptation, and restrained vignette /
chromatic aberration / grain. Three quality tiers scale resolution, AO, shadow
budget, light budget and shader complexity — but never the art, so a low tier is
a softer version of the same picture rather than a different, worse scene.

Three ideas carry most of the visual weight:

**Everything is synthesised.** `TextureForge` writes 16 PBR surface sets on the
CPU at load from noise recipes — albedo, packed occlusion/roughness/metalness,
and a sobel-derived normal map. There is no photographic source art in the
project. `Synth` does the same for audio: 75 registered sounds, no audio files.

**Anti-repetition lives in the shader, not the texture.** `MaterialLibrary`
injects world-space macro variation, a stochastic two-tap re-tile, leak streaks
that run downward on vertical faces only, traffic wear on horizontal ones,
grounding dirt at skirting height, per-zone wetness below a water line, and a
detail normal that fades out via `fwidth()` before it can shimmer. A 1.5 m tile
repeated twenty times down a corridor stops reading as a grid because the
large-scale structure has a much longer period than the tile.

**Detail is cheap; draw calls are not.** `Builder` accumulates thousands of small
pieces — every skirting board, every conduit clip, every ceiling tee — into a
handful of merged meshes per chunk. That is what makes it affordable to put in
the construction detail that separates a believable interior from a set of boxes.

Also: a height-stratified atmospheric fog (three's flat exponential fog washes
tall volumes into milk and destroys the sense of a ceiling), a fixture rig with
physical candela intensities and five flicker personalities, circuit switching,
a distance-ranked active-light budget, a hysteretic shadow-caster budget, and a
per-zone bounce fill standing in for global illumination.

### World (`src/world/`)

Eight zones — Intake, Service Spine, Cistern, Residence, Plant, Ductwork, Stack,
Office of Record — streamed on demand through a portal graph that keeps three
resident and tears down geometry, colliders and fixtures together. Zones occupy
disjoint patches of world space 400 m apart, past the far plane, so one
collision world and one light rig hold several at once and a portal transition is
a teleport the player never sees.

`Kit` is the shared construction language: 160 mm walls that show their thickness
at every opening, bullnose skirtings, ceiling perimeter angles, exposed-tee
suspended ceilings with the tile running *under* the tee flange, and services
visible in the plenum where a tile is missing. `Props` and `Decals` provide set
dressing and geometry-projected staining, signage and room numbers.

### Gameplay (`src/player/`, `src/systems/`, `src/entities/`)

A first-person controller with authored camera motion — a 2:1 Lissajous bob,
footfalls fired off bob phase rather than a timer, breathing that rises with
exertion and fear, a collision-probed lean, and a neck spring that compresses on
landing. Surface-aware footsteps and a noise model that entities can hear.

An inspection lamp with battery, brown-out, and a **silent hand-cover** that
matters because the switch is audible. Interaction, inventory, breaker panels,
valves, a goods lift, keypads, terminals, the generator, and hiding places.

**The Surveyor** moves only in light and freezes in darkness — the player's lamp
counts as light, which inverts the usual horror instinct. It is blind and hunts
by sound; when it loses the trail it stops and measures a wall, which is the
player's window; a rising transformer whine announces it three to four seconds
early. **The Attendant** has no model at all and is only ever evidence.

### Audio (`src/audio/`)

Fully synthesised. Per-fixture fluorescent hum built from a 100 Hz mains
PeriodicWave plus ballast whine, driven live by each fixture's flicker level
(measured correlation r = 0.92 against a dying fixture's curve). Nine procedural
convolution reverbs crossfaded per zone. Occlusion measured through the real
collision world gives dry −43.9 / −48.4 / −57.8 dBFS and wet/dry 7.4 / 14.3 /
20.9 for clear / half / blocked — quieter, duller *and* more reverberant,
monotonically. A three-note motif on a hard budget of five cues per playthrough.

### UI and cinematics (`src/ui/`, `src/cinematics/`)

A bureaucratic-paperwork visual identity: job dockets, incident reports, rubber
stamps, carbon copies. Title over a live drifting camera, journal with notes and
tapes, settings, pause, death, ending. Sixteen authored sequences (intro, zone
transitions, lift, impossible door, entity reveal, capture, respawn, ending) on
a fluent timeline with centripetal Catmull-Rom camera paths and a guaranteed
restore on every exit path.

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

Every asset keeps its moving parts as separately-named objects with pivots on the
real axis, so the game animates them procedurally: breaker toggles, the valve
wheel on its stem, the panel door on its hinge, the Surveyor's nine joints.

### QA tooling (`tools/qa/`)

| tool | what it does |
|---|---|
| `capture.mjs` | boots the build headless, drives `window.ANNEX`, reads frames straight off the canvas |
| `contactsheet.mjs` | composes a labelled sheet with per-shot draw calls and triangle counts |
| `artifacts.mjs` | per-frame metrics: crushed blacks, clipping, dynamic range, banding, high-frequency energy, isolated speckle, emptiness |
| `playtest.mjs` | drives real synthetic input and asserts tunnelling, NaN, floor-fall, crouch, footstep cadence, frame loop, console errors |
| `perf.mjs` | hardware-independent workload budgets |
| `status.mjs` | boot and subsystem report |
| `audio-probe.mjs` | renders every sound offline and measures it |

---

## 2. Performance measurements

**The environment has no GPU.** Headless Chromium runs WebGL on SwiftShader, a
CPU rasteriser. Absolute frame times measured here are one to two orders of
magnitude worse than the same build on real hardware and are **not** a valid
answer to "does it hit 60 fps". This is stated plainly rather than worked around.

What *is* portable is the workload the frame submits. Measured in the integrated
build at 1024×576, medium tier:

| metric | measured across 8 zone shots | budget |
|---|---:|---:|
| draw calls, total submitted | 62 – 353 | — |
| draw calls, scene pass only | ~35 – 190 | 180 |
| triangles, scene pass only | 26 k – 387 k | 1 200 k |
| active dynamic lights | 12 (capped by tier) | 14 |
| shadow-casting lights | 1 – 3 | 3 |
| fixtures resident | 127 | — |

**Correction to an earlier version of this report.** It stated draw calls as
62–318 against a 180 budget and called that the one workload metric outside
target. That comparison was wrong, and the error was in the measurement rather
than the renderer. `renderer.info` accumulates over every pass in a frame, and
GTAO traverses the whole scene again for its own depth and normal buffers. Turning
GTAO off in an otherwise identical frame (`tools/qa/shots.diag.json`, `d0` vs
`d1`) took the same view from 353 calls and 766 k triangles to 190 and 387 k —
almost exactly half. So the scene itself submits roughly 176–190 calls and
~387 k triangles, and the earlier figures were double-counting a second scene
traversal that the AO pass is supposed to make. A depth prepass for AO is what
every renderer of this kind does.

At ~190 the scene pass is at the 180 budget rather than 75% over it. Instancing
the repeated props is still the right optimisation and still the first one to
make, but it is a tightening rather than a rescue.

Steady-state SwiftShader frame times were **4–10 ms** (496×279 low tier: 5–8 ms;
819×461 medium tier: 4.2–9.4 ms). The multi-second
frames that appear in the capture logs are first-frame shader compiles after a
camera jump into newly-visible materials, not steady-state cost — the same
scenario measured 7.7 ms and 5.1 ms on subsequent frames.

Optimisations applied after measurement, all of which preserve the intended
appearance: the fog inhomogeneity term dropped from two noise octaves to one (it
runs on every fragment of every surface and the second octave was invisible at
the amplitude it is permitted); the leak field is skipped entirely on horizontal
faces, which are most of the screen area in a building made of corridors; one
lattice walk now feeds both the albedo and the roughness injections instead of
two; and the active-light count, stochastic re-tile and AO are tiered.

**Honest exception:** a genuine 60 fps verdict on the target laptop could not be
produced in this environment. The workload numbers sit inside budgets chosen for
comfortable 60 fps on integrated graphics, but that is an inference, not a
measurement.

---

## 3. Remaining limitations

1. **No GPU-verified frame rate.** See above.
2. **Fewer independent judge rounds than intended.** One round was commissioned;
   it was terminated part-way by a platform usage limit. Its findings are in §4.
   The two further rounds the brief allows for were not run.
3. **The QA camera needs vertical clearance testing.** `lookOpen()` finds an open
   horizontal sightline but does not yet reject positions with insufficient
   headroom, so a capture aimed at a mezzanine zone can land the eye inside a
   soffit (visible in `docs/captures/judge1/07_residence_corridor.png`). This is
   a capture-tool limitation, not a game defect — the player controller has a
   ceiling probe and cannot get there.
4. **The Stack is the one zone that does not work.** It is a known, diagnosed
   defect, not an unknown. In `docs/captures/final/05_stack.png` the receding
   floors read as isolated lit rectangles suspended in black rather than as a
   shaft: the zone emits floor slabs and gantries but no enclosing shaft wall, so
   there is nothing for the fill light or the haze to sit on and nothing to
   establish that the floors are inside anything. Raising its bounce fill and
   thickening its fog (both done) reduce the effect but cannot fix it — the
   geometry needs an enclosing well. This is the top remaining item.
5. **Zone dressing density is uneven.** Intake, the Service Spine, the Residence
   and the Plant are dressed to standard. The Cistern and the Ductwork have
   their architecture, water and lighting but a lower prop density. The Safe Room
   builds but could not be verified in a capture — see limitation 3.
6. ~~**Ceiling water-staining is close to uniform.**~~ Fixed in the polish pass
   (section 5). The cause was that every weathering term in the material was
   gated on a vertical or upward-facing normal, so a suspended tile — normal
   straight down — received none of them.
7. **First-person hands are functional but not finished.** They are lit, posed
   and animated, but the geometry does not yet read as convincingly as the rest
   of the frame at the size it occupies.
8. **Audio was never listened to.** It is verified numerically and thoroughly —
   75/75 sounds rendered with no silence, clipping or DC offset, occlusion
   monotonic across three states, reverb T60s tracking target — but nobody in
   this loop could hear it.

---

## 4. Judge feedback and how it was addressed

An independent judge subagent was commissioned with assessment-only permissions
and explicit instructions not to weaken its criteria. It was terminated by a
platform usage limit part-way through its first pass, after examining the
ordinary-gameplay frames and the zone-coverage captures.

**Its one substantive finding was significant and correct:**

> `active: 0` lights in six of seven zone shots — that's a likely root cause.

This was a real bug, not a capture artefact. The active-light budget selected
fixtures by their *instantaneous brightness*. Brightness is a transient: a
freshly built zone's fixtures all start at zero and its circuits ramp over a
fraction of a second, so the selected set came out empty on the first frame after
a zone change and then left every light in that zone switched off until the next
re-sort — 0.18 s later, or never, because the set was cached.

Fixed in `5152504`: the set now tests what is *supposed* to be on (circuit target
and fixture health, not current level), circuits created already powered start at
full rather than fading up from black, and switching a circuit forces an
immediate re-rank. Without the judge this would have shipped as "some zones are
just very dark".

Defects found and fixed by the project's own review loop, for completeness:

| defect | fix |
|---|---|
| Overlay pass wiped the world every frame (`renderer.render()` auto-clears colour) | clear depth only — commit `d8f7bd1` |
| Ceiling tile/tee gap aliased into black speckles across every ceiling | tile runs under the tee flange with real overlap |
| Fixtures were buried in the plenum above the tiles | `troffer()` takes the ceiling datum; cells passed as `lightSlots` |
| Ceiling tees rendered as hard black lines | painted steel, not a mirror: metalness 0.85 → 0.18 |
| Bounce fill was 36× too weak, leaving a hard band where each spot cone ended | recalibrated to physical irradiance |
| Detail normal shimmered on every grazing wall | fades via `fwidth()` before one texel per pixel |
| Resolution-tied `sin()` frequencies aliased into vertical streaks | fixed cycle counts |
| Shadow acne on grazing surfaces | normalBias 0.028 → 0.075 |
| **Six of eight zones were 60–95% pure black** | zone builders each carried an `ambient` field authored against the pre-recalibration scale (colour × intensity ≈ 0.01 against a troffer's ~5 at the floor) and `World` was applying them; bounce fill now has exactly one writer |
| Zone profile was applied only at boot | now applied on `zone:enter`, so walking into the Cistern stops keeping Intake's office fill |
| Auto-exposure blew a lit wall whenever half the frame was dark | range narrowed from [0.78, 2.20] to [0.80, 1.55] |
| QA cameras stood against walls and inside soffits | `lookOpen()` probes for the clearest heading, centres laterally, resolves out of geometry and snaps to the floor |

### On reading the artifact analyser honestly

The analyser flags a frame as CRUSHED when more than 16% of it sits at or near
pure black. On the final set that fires for Service (0.738), the Plant (0.536),
the Residence (0.613), the Cistern (0.260) and the Stack (0.900).

**Four of those five are correct behaviour, not defects.** The threshold is
calibrated for Intake, which is an over-lit office; a concrete service corridor
lit by three failing strip lights is *supposed* to be mostly black, and visual
inspection of `03_service.png`, `07_residence.png`, `06_cistern.png` and
`04_plant_hall.png` confirms each has clear surface detail, readable
architecture and legible light pools where it is lit. The flag did its job — it
said "look at these" — and looking is what settled it.

The Stack at 0.900 is the real failure, and it is the one the flag and the eye
agree on. Per-zone thresholds are the obvious improvement to the tool.

The analyser was also what turned the biggest defect of the project from an
impression into a number. It measures crushed blacks, clipping, dynamic range,
banding, high-frequency energy relative to the set median, isolated speckle and
frame emptiness, and flags which frames to look at first — the run that produced
`0.677, 0.642, 0.693, 0.894, 0.954` of frame at or near pure black across the
non-Intake zones is what located the stale fill values.

---

## 5. Polish pass: the named gaps against a AAA-budget renderer

This section exists because of a follow-up instruction to locate the differences
against AAA titles and keep polishing until they were closed.

**One thing stated plainly up front, and not softened afterwards.** "Exceeding
AAA" is not a claim this project can support and it is not claimed here. *Alien:
Isolation* is on the order of a hundred person-years with photogrammetry, baked
global illumination and motion capture; nothing in a single automated session
reaches that, and any report saying otherwise would be worthless. What *is*
achievable is naming the specific, individually-nameable differences and closing
the ones that are closable. That is what follows, including the ones that are not
closed.

### Gaps identified from `docs/captures/final/09_intake_recheck.png`

Ranked by how strongly each one signalled "not a real room", at the time:

1. **Zero occlusion at any corner or crease.** The strongest tell by a wide
   margin — wall/floor, wall/ceiling and wall/column junctions had no darkening
   at all.
2. **No anti-aliasing of any kind.** Not on the original list; found during
   diagnosis and arguably worse than item 1.
3. **Uniform ceiling staining** instead of a per-tile and per-leak distribution.
4. **Nothing in the air.** Rooms read as empty volumes with surfaces at the far
   end.
5. **No colour-temperature contrast** anywhere in a frame — every surface one hue.
6. **Small-scale variation in albedo but not in lighting.**
7. Sparse props in ordinary sightlines; no SSR on the Cistern's water; no
   near-field defocus; procedural rather than captured animation.

### What was done

**1. Baked zone-scale AO — `src/render/AOVolume.js` (new).** Voxelises a zone's
colliders, measures openness per cell against a 32-direction golden-spiral set
with a 3 m metric reach, blurs three times, and packs the field into a 2D atlas of
Y-slices, which materials sample by world position and apply to the indirect terms
only. Y-slices rather than a 3D texture because `sampler3D` needs GLSL ES 3.00 and
three compiles `MeshStandardMaterial` as 1.00.

Four things about the first implementation were wrong, and all four were found by
a numeric test (`tools/qa/aotest.mjs`) rather than by looking at a frame — which
is the part of this worth keeping:

- The ray reach was in *cells*, so the effect's radius scaled with grid
  resolution. At fine cell sizes it fell below the distance at which a wall should
  start to matter and a corner 55 cm from two walls measured as **fully open**.
- The open-room reference was a hand-tuned constant whose correctness depended on
  room height and cell size. At fine resolutions it saturated the whole field to
  1.0 and the effect silently did nothing.
- Floors are registered as walkable *rectangles*, not boxes, so the volume had no
  ground in it and nothing occluded from below.
- Ceiling colliders were skipped on the theory that they would seal the room. They
  sit above the tile line; including them is what makes the top of a wall fall off.

Two further properties turned out to be necessary rather than optional, and both
came from measuring frames:

- **A floor clamp.** With no GI, "indirect" is a constant, so occluding it drives
  towards black rather than towards the dim light a real crease still receives from
  three or four bounces. Unclamped it crushed the shaded side of a light pool on
  the carpet to solid black — one of the specific things this project is not
  allowed to do.
- **Fill compensation.** Occlusion moves light, it does not delete it. Applying the
  field without scaling the bounce fill back up by the field's own mean put the
  Intake about a stop and a half under the exposure it was authored at.
  `AOVolume.fillCompensation` does that arithmetic.

**2. MSAA (`q.msaa`: 4/2/0 by tier).** There was no anti-aliasing at all. The
context is created with `antialias: false` — correct, because it does nothing once
the scene renders into a composer target — but the composer's target had
`samples: 0`, and a comment claimed supersampling covered it while the high tier's
render scale was 1.00. This building is almost entirely thin high-contrast edges,
and near edge-on they went sub-pixel and broke into strings of isolated black
dots. Those dots were visible across every wall in the diagnostic captures and
**survived turning off GTAO, the shadow maps and the injected detail normal in
turn**, which is how the cause was pinned down rather than guessed at.

**3. Ceiling staining.** Every weathering term in the material was gated on
`axVert` or `axUp`, so a suspended tile got none of them and an entire ceiling
plate was one flat tone under isotropic noise. Now: per-tile tonal variation on the
0.6 m cross-tee grid, a fraction of tiles read as replacements, and damp patches
carry the darker tide line that a dried water stain actually has.

**4. `src/render/Motes.js` (new).** One additive `Points` cloud wrapped around the
camera in the vertex shader, lit per particle by the nearest six fixtures with a
strong forward-scattering lobe, because dust is only conspicuous when you turn to
face a lamp. Two bugs in the first version: the beam test had its sign inverted, so
every mote *in* a beam got zero light and only the ones up in the plenum lit; and
the candela-to-scene-units factor left an off-axis mote at ~0.003 of scene white,
below what AgX and an 8-bit output can represent.

**5. Colour temperature.** The bounce fill's sky and ground colours were two shades
of one hue in every zone. They are now pushed apart on the warm/cool axis at
matched luminance. A `HemisphereLight` is the only tool in this renderer that can
put two colour temperatures in one frame.

Also: Kaplanyan geometric specular anti-aliasing on the injected detail normal.

### One hypothesis this pass got wrong

Reading the flat walls in the first A/B frames, the conclusion was that the room
was lit by its bounce fill rather than by its fixtures, and that the fix was to cut
the fill hard. Both halves were wrong, and both were settled by measurement rather
than argument. `Game.lightProbe()` reported 19.2 units of direct light at head
height against 0.51 of fill — direct dominates by roughly 20:1 — and frames
captured at quarter and half fill (`d5`, `d6`) left the corridor almost entirely
black. The fill stayed as authored.

The real explanation is more interesting and did not need a change: every fixture
in the Annex points straight down, so the *floors* take nearly all the direct
light and every vertical surface sits at a grazing angle to every fixture. Walls
genuinely are lit almost entirely by bounce. That is why they were flat, why the
AO volume changes them so much, and why it barely touches a lit floor.

### Not closed

- **Screen-space reflections** on the Cistern's water. It uses a planar-ish
  approximation against the procedural environment map, not real SSR.
- **Near-field defocus.** Considered and dropped: it is close to the list of things
  the brief forbids using to hide problems, and the hands are the only thing near
  enough to benefit.
- **Prop instancing.** The scene pass measures ~190 draw calls against a 180
  budget (see the correction in section 2). Still the right optimisation.
- **Animation** remains procedural. No motion capture exists for this project and
  none can be authored in it.
- **The Stack** still needs its enclosing shaft geometry — limitation 4, and still
  the top item.

---

## 6. Artefacts

| what | where |
|---|---|
| Build | `npm run build` → `dist/`; `npm run preview` |
| Design bible (fiction, zones, architectural rules, code contracts) | `docs/DESIGN.md` |
| Zone-coverage captures | `docs/captures/judge1/` |
| Ordinary-gameplay captures, chronological | `docs/captures/r0/` … `r8/` |
| Artifact metrics | `docs/captures/*/_artifacts.json` |
| UI screens, three aspect ratios | `docs/captures/ui/r9*/` |
| Blender asset turntables | `docs/assets/` |
| Asset manifest with sub-objects and material slots | `public/assets/models/manifest.json` |
| Cross-subsystem integration contracts and responses | `docs/INTEGRATION_REQUESTS*.md` |
