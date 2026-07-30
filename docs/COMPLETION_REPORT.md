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
| ↳ superseded by fixture batching | 85 – 170 | 180 |
| triangles, scene pass only | 26 k – 387 k | 1 200 k |
| active dynamic lights | 12 (capped by tier) | 14 |
| shadow-casting lights | 1 – 3 | 3 |
| fixtures resident | 127 | — |

The superseded row is measured differently — 640×360 at the low tier, four scripted
scenarios rather than eight zone shots — so it is not a like-for-like replacement
for the row above it, and both are kept. What it does establish is that the metric
that used to exceed its budget no longer does, on the harness that asserts it.
Section 8.1 has the scenario breakdown and what the batching cost in exchange.

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

**On the cost of MSAA, which is the one change in the polish pass with a real
performance price.** It could not be measured here in any useful way, and the
attempt is worth recording because of how badly the software rasteriser distorts
it: capturing six frames at 880×496 with 2× MSAA and a 150-frame settle burned
**80 minutes of CPU across 24 minutes of wall clock** in the GPU process without
finishing a single frame, against roughly four minutes for the same set without
it. That is a property of resolving a multisampled half-float target on a CPU
rasteriser and says nothing about hardware, where MSAA resolve is fixed-function
and the scene is 190 draw calls and ~390 k triangles. But it does mean the tier
values (4× / 2× / off) are a judgement, not a measurement, and the auto-quality
downgrade at a p90 of 26 ms is what has to catch a machine that cannot afford
them. Capture runs use the low tier, where MSAA is off, when the thing being
verified is content rather than edge quality.

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
3. **The QA camera needs vertical clearance testing.** `lookOpen()` now rejects a
   position with no horizontal sightline and searches outward for one, but it
   still does not test headroom, so a capture aimed at a mezzanine zone can land
   the eye inside a soffit (visible in
   `docs/captures/judge1/07_residence_corridor.png`). This is a capture-tool
   limitation, not a game defect — the player controller has a ceiling probe and
   cannot get there.
3b. **The Intake's corridors contain no light fixtures.** Found in this pass and
   not fixed. It is a violation of the project's own rule — "light from visible
   sources only; if it glows, there is a fixture" — and it is why a ceiling-facing
   capture of the Intake shows a lit ceiling with nothing in it
   (`docs/captures/verify/02_intake_ceiling.png`).

   The measurement, from `Game.fixtureReport()` with the camera standing in a
   corridor at `[-22.4, 1.63, 23.35]`: the four nearest troffers are 6.31, 6.76,
   6.79 and 7.33 m away, at z = 29.4 and z = 16.8 — the far sides of partition
   walls. All four are healthy and correct in every respect the report checks
   (level 0.97, light visible, tube mesh present, in the scene graph, visible,
   emissive luminance 1.22), so this is not a rendering or rig bug.

   What is *measured* is the effect: no fixture within 6 m of a camera standing in
   an Intake corridor, and every fixture that does exist working correctly. The
   mechanism is **inferred and not yet confirmed**: `IntakeZone` plans fixtures on
   the 4.2 m room-cell grid and places one per cell centre, and the two cells whose
   centres bracket this camera (`[-21, 21]` and `[-21, 25.2]`) both have none —
   either because they are marked as wall cells or because both lost the 10 %
   per-cell skip roll, which two adjacent cells doing is unlikely enough to be
   worth checking. Confirming which requires dumping the zone's cell grid
   alongside the fixture plan.

   No fix is attempted here. The likely shape of one is to walk the corridor runs
   after the cell pass and place fixtures along them at roughly 3 m centres, but
   that is a change to zone authoring on top of an unconfirmed diagnosis, and it
   could not be verified in the remaining budget — an unverified geometry change is
   worse than a precisely documented defect. Joint top priority with limitation 4.
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

### The dark zones, and a second wrong hypothesis about them

The artifact analyser reports the Intake at 2.5–3.2 % crushed pixels — well
exposed, detailed, nothing hidden — and every other zone between 24 % and 94 %.
That is the largest remaining defect and it is the specific thing the brief
forbids, so it was chased rather than noted.

The hypothesis was again that the bounce fill was too low in those zones, since
the Intake's is 2.05 and the Cistern's is 0.50 with much darker colours. It was
tested by sweeping the Cistern's fill (`tools/qa/shots.cistern.json`) and
measuring. **Raising it moved the crushed fraction from 0.937 to 0.935.** Fill is
not the lever.

`lightProbe()` says what is: `directAtHead: 0` — *zero* direct light where the
camera stands, with 89 of the zone's 140 fixtures wanting to be lit and `active: 6`.
Six is the low quality tier's cap on simultaneous dynamic lights (`q.lights` is
6 / 10 / 14), and in a zone the size of the Cistern the six nearest can all be far
away.

Which means the capture method, not the zone, produced most of that number. These
runs were made at the low tier because MSAA is unaffordable on a CPU rasteriser
(above), so they were shot with fewer than half the lights the shipped high tier
uses. The same frames at the medium tier measure very differently:

| zone | crushed, low tier (6 lights) | crushed, medium tier (10 lights) |
|---|---:|---:|
| Intake spine | 0.032 | 0.028 |
| Cistern | 0.939 | 0.236 |
| Plant | 0.771 | 0.449 |
| Residence | 0.587 | 0.614 |
| Service | 0.732 | 0.772 |
| Ductwork | — | 0.790 |

So: the Cistern and the Plant were largely a measurement artefact and are
acceptable at shipping quality. The **Service Spine, the Residence and the
Ductwork are genuinely dark** at 61–79 % crushed and remain a real defect. What
they need is more *fixtures reaching the player*, not more fill — the same finding
as limitation 3b, in three more zones. Not fixed here: a clean sweep would have to
run at the high tier, which this environment cannot capture at a workable rate.

**Numbers that did improve and are not tier-dependent:** isolated speckle, the
metric that tracks the thin-geometry aliasing MSAA was added for, fell from a mean
of 0.00028 (max 0.00078) before to 0.00003 (max 0.00018) after — 9× lower. Banding
is 0.000 and clipping is 0.000 in every frame of every set.

### Three measurement defects this pass found in its own tooling

Worth listing separately, because each one had been silently producing a wrong
judgement rather than an error, and two of them invalidated conclusions that had
already been drawn.

- **The AO statistics were measured over the wrong cells.** A zone's bounds are an
  AABB, so a zone that does not fill its box is mostly void, and void reads fully
  open by construction. Taking the normalisation percentile over every unoccupied
  cell pinned it at 1.0 in five of six zones and reported the Ductwork — a
  crawlspace, the most enclosed space in the game — at a mean openness of 0.957.
  The statistic now covers only cells within two cells of geometry, which is where
  the shader's probe actually lands.
- **Captures settled 14 frames.** Adaptation into darkness has a 1.8 s time
  constant, which is 109 frames, so a capture that jumps from a bright zone to a
  dark one and settles 14 frames photographs the exposure of the zone it just
  left. Every Cistern and Ductwork frame taken that way came out near-black. Some
  of those frames had already been diagnosed as the zone being too dark, and the
  fill values were raised on the strength of that reading. Default is now 150.
- **`lookOpen` could frame a wall 40 cm from the lens.** It scored headings in
  one-metre steps starting at one metre, so a wall at 0.4 m and a wall at 0.9 m
  both scored zero and a position with no sightline won by default.

### Not closed

- **Screen-space reflections** on the Cistern's water. It uses a planar-ish
  approximation against the procedural environment map, not real SSR.
- **Near-field defocus.** Considered and dropped: it is close to the list of things
  the brief forbids using to hide problems, and the hands are the only thing near
  enough to benefit.
- **Prop instancing.** ~~The scene pass measures ~190 draw calls against a 180
  budget (see the correction in section 2).~~ **Resolved for fixtures, still open
  for props.** Batching the fixture emissive sources took the worst scenario from
  221 draw calls to 170, under budget — see section 8.1. The remaining independent
  objects are doors, machines and props, and instancing those is still the right
  next optimisation; it is no longer the thing standing between the frame and its
  budget.
- **Animation** remains procedural. No motion capture exists for this project and
  none can be authored in it.
- **The Stack** still needs its enclosing shaft geometry — limitation 4.
- **The Intake's corridors have no fixtures in them** — limitation 3b. Found in
  this pass, measured precisely, deliberately not fixed. Joint top item with the
  Stack. The Service Spine, Residence and Ductwork have the same problem at zone
  scale: 61-79 % of their pixels are crushed at shipping quality, and the fill
  sweep proves fill is not the lever.
- **Wallpaper pattern repetition in the Residence.** The anti-repetition machinery
  works on luminance and hue, so a strongly *figurative* pattern — the Residence's
  flower motif — still reads as a repeat down a corridor even though its tone
  varies. A stochastic re-tile cannot fix a motif the eye recognises; that needs
  either several authored variants or a much larger tile.
- **The mote cloud is uniform density.** Real dust concentrates near disturbance
  and settles in still air. Per-zone density and scattering are tuned, but within a
  zone the field is homogeneous.

---

## 6. Second pass: fixing what the self-assessment named

An honest self-assessment of the build listed its own defects. This section reports
what happened to each. It is written from measurements, and where something was not
fixed it says so rather than reframing it.

### The measurement that unlocked most of this: `tools/qa/lightreach.mjs`

Every previous attempt to answer "is this zone too dark?" was made from
screenshots, and screenshots kept answering a different question — three
consecutive wrong diagnoses, all recorded in §5. Meanwhile an Intake corridor with
no lamp above it was invisible to every metric the project had.

This measures the thing itself: for every walkable point in a zone, the horizontal
distance to the nearest fixture that is not dead. No browser, no GPU, no exposure
pipeline. It runs in about ten seconds for all eight zones.

| zone | fixtures | worst reach before | after | walkable area over 5 m from a lamp |
|---|---:|---:|---:|---:|
| Intake | 127 → 210 | nearest lamp 6.3 m from a corridor | 9.86 m | 9 % |
| Service Spine | 68 | — | 2.79 m | **0 %** |
| Cistern | 13 → 17 | 8.67 m | 7.96 m | 19 % → 9 % |
| Residence | 33 | — | 2.40 m | **0 %** |
| Plant | 19 | — | 6.71 m | 10 % |
| Ductwork | 25 | — | 1.53 m | **0 %** |
| Stack | 37 → 73 | 10.66 m | **4.99 m** | 39 % → **0 %** |
| Office of Record | 3 | — | 2.63 m | **0 %** |

The Intake's remaining 9.86 m worst case is the ruined far corner where the wear
gradient kills the lamps deliberately, and is intended. The Stack was the worst in
the building for a structural reason worth recording: its walkable surface is a
perimeter gantry **ring**, and four fittings at the mid-point of each side light the
sides and leave the four corners as far from a lamp as it is possible to get.

### Defect: the Intake's corridors had no light fixtures

Fixed. A WALL cell is a 4.2 m cell containing a 160 mm partition through its
centre — 96 % of it is open floor — and the fixture planner skipped the whole cell
because a fixture at the cell centre would be buried in the wall. Fixtures now step
1.26 m off the partition onto whichever sides are circulation.

### Defect: three zones measurably too dark

Substantially fixed, by fixture coverage rather than by fill — which the fill sweep
in §5 had already proved was not the lever. The Service Spine went from **0.772
crushed pixels to 0.059**, measured at the *low* tier where the light budget is
tightest. Residence and Ductwork have full coverage by the reach metric.

### Defect: the headline zone's visual identity was not original

Fixed, and this was the most interesting problem in the pass. An unbroken field of
pale yellow wallpaper under a fluorescent-lit suspended ceiling is the most
reproduced image in this genre; however well the material is synthesised it is
still that image. The fiction, zone structure, creature rules and interface were
original — the first thing the player sees was not.

`wallRun` grows an optional dado: an applied lower wall lining on a moulded PVC
capping bead at 1.06 m, which the Intake now uses on every wall. It fixes the
problem at the level of the wall's construction rather than by recolouring, and it
does three things at once — breaks the flat field, gives perspective a strong
horizontal to converge along, and because the lining is a cool desaturated olive
under warm yellow, it supplies the within-frame colour-temperature contrast the
zone did not previously have anywhere.

It took three passes to calibrate and the reason is worth writing down. Five
multipliers land on that surface (texture albedo, colour tint, the grime gradient,
wallRun's vertex shade, the baked AO) and it is lit almost entirely by bounce
because every fixture points straight down onto a wall at a grazing angle. Choosing
each multiplier to look suitably grubby in isolation multiplied out to 0.13 of the
upper wall — a solid black band across the zone. Two further passes of "make the
hex brighter" did nothing, because `MeshStandardMaterial.color` was being set from a
hex literal whose channels cap at 1.0, so a hex can only ever *darken* a texture,
and acousticPanel's albedo is #5c5b52 — about 0.11 linear against the 0.30 a real
hessian panel reflects. The fix was a `colorGain` factor that is allowed to exceed
1, which is meaningful because that field is a plain linear multiplier in the
shader. Result: the Intake spine measures **0.034 crushed** with the dado present,
against 0.032 before the dado existed — a second material, a horizontal and a cool
mass in frame at no cost in shadow detail.

### Defect: first-person hands read as a pale blob

Improved. The asset was rebuilt to 13 192 triangles with a real joint hierarchy —
four fingers of three phalanges plus a two-phalanx thumb per side, pivoted at
anatomical joint positions, verified by walking the GLB node tree.

`Hands.js` was still doing the straight swap it was written for when the export was
a single skin with no finger nodes, so all 30 joints arrived and were immediately
discarded. The curl driver is now bound to them, with the tip carried as a third
segment (rotating two of three joints leaves the fingertip poking out of a closed
fist) and the fingers bound index-to-little to match the pose table rather than the
asset's alphabetical node order, which would have silently applied the index
finger's curl to the little finger.

### Defect: figurative wallpaper repeated visibly in the Residence

Addressed in code, not yet confirmed in a frame. The stochastic re-tile defeats
repetition in luminance, which is enough for a noise-like surface and useless
against a motif the eye recognises as a shape. Real paper is hung in 530 mm drops
each cut from the roll at a different point, so registration differs between
neighbours and there is a seam where two butt; modelling that is both correct and
the thing that actually breaks the repeat.

### Defect: uniform mote density

Addressed in code, not yet confirmed in a frame. A world-space clump field replaces
the even distribution, so a beam shows drifting patches rather than an even fog.

### Defect: the QA camera could frame the inside of a soffit

Fixed. `lookOpen` now rejects any position with less than 1.75 m of headroom.

### Not fixed

- **The Stack is the one zone still not fixed.** Everything measurable about it
  improved: light reach from 10.66 m worst case and 39 % of its area beyond 5 m to
  4.99 m and 0 %, a real enclosing shaft wall (124 colliders, 22 322 triangles
  facing into the well), fill raised, fixture output tripled, crushed pixels 0.934 →
  0.925. It still does not read. The cause is understood and is geometric: a strip
  fitting under a gallery soffit over an 18 m void throws most of its output into
  the void, and with no global illumination nothing brings it back. The fix is a
  different class of fitting — high-bay rather than strip — which is a lighting
  design decision for the zone, not a number to raise.
- **The Cistern is now dim rather than unreadable** (crushed 0.911 → 0.842, dynamic
  range 0.21 → 0.47) but still measures 0.84 crushed at the low tier, and 9 % of its
  walkable area is beyond 5 m from a lamp.
- **Still never run on a GPU**, and no frame-rate verdict exists.
- **The audio has still never been heard.** `tools/qa/audio-render.mjs` is written
  and will export the synthesised sound to .wav files, but it has not been run, so
  the 75 sounds remain verified only numerically. This is now the single largest
  unexamined part of the project.
- **(Superseded — the playthrough DID run. See §6.5.)** The note that follows is
  kept because it was true when written:
  **The playthrough and audio-export harnesses are written but their runs are not
  in this report.** `tools/qa/playthrough.mjs` drives a continuous session with real
  synthetic keyboard input through the real update path, and
  `tools/qa/audio-render.mjs` renders the synthesised audio to .wav files a human
  can listen to. Both landed; neither has produced a finished artefact yet. The two
  biggest holes in this project's verification — nobody has played it and nobody
  has heard it — therefore remain open, and the tooling to close them existing is
  not the same as them being closed.

### The dark zones, resolved — and a fourth wrong diagnosis on the way there

The Stack and the Cistern resisted five separate explanations. They are recorded
because four of them were wrong and the pattern in *how* they were wrong is the
useful part.

| explanation | how it was tested | verdict |
|---|---|---|
| bounce fill too low | swept the Cistern's fill 1× → 4.5× and measured | **wrong** (0.937 → 0.935) |
| enclosing geometry missing | walked the built scene graph, counted triangles by radius and winding | **wrong** — 22 322 triangles face into the shaft, 124 colliders |
| fog swallowing the far wall | raised `colorFar` from 0x22242c to 0x3e4450 and re-measured | **wrong** (0.934 → 0.934) |
| power circuits switched off | dumped `rig.circuits` | **wrong** — every circuit at level 1 |
| the zones are simply lit far dimmer than the Intake | probed direct light and fill in each zone **after a settled frame** | **right** |

The measurement, at last taken correctly:

| zone | direct light at head height | bounce fill (up) | zone fixtures lit |
|---|---:|---:|---:|
| Intake | **37.0** | 0.56 | 142 / 201 |
| Stack | **4.5** | 0.54 | 62 / 73 |
| Cistern | **1.0** | **0.048** | 16 / 17 |

Thirty-seven to one in direct light, and twelve to one in fill for the Cistern.
That is not an atmospheric choice; it is two stops past "grim" into "unreadable",
and no amount of occlusion, fog or material work could have recovered it. The
Cistern's fill goes from 0.50 to 1.45 and the Stack's from 1.55 to 2.30, both with
lightened colours.

**Why the fill sweep in §5 said the opposite.** It reported that raising the fill
changed nothing, and the conclusion drawn from it — "fill is not the lever" — was
wrong. Reading its own probe output back afterwards, `fillUp` went 0.183 → 0.082 →
0.123 → 0.184 across the four settings: the fill never actually rose, because
`setFill` writes a *target* the rig damps towards over about a second and the shots
settled 70 frames, and because a zone-profile reapplication reset it in between.
The sweep measured almost the same fill four times and I read four identical
results as evidence about fill.

### The probe-timing artefact, which is the most useful thing in this section

`lightProbe()` called from a capture's `setup` reports **every fixture in the
building as unlit and every zone as receiving zero direct light**, including the
Intake, which visibly has light pools on its floor in the same frame.

The reason is that setup runs before any frame is stepped. Fixture output ramps
from zero and circuit level ramps with it, so at setup time nothing has been
updated yet. This produced a confident, precise, entirely wrong conclusion — that
the zones' power circuits were switched off — supported by a table of zeroes.

Probing has to happen in a second shot with `settle: 1`, the same pattern the AO
A/B pairs already use. Corrected, the Intake reads 37.0 rather than 0.

The general lesson is the one this project keeps relearning: **a measurement taken
at the wrong moment is more dangerous than no measurement**, because it comes with
the authority of a number. Four of the six wrong diagnoses in this report were of
that kind — a 14-frame exposure settle, an AO statistic over void cells, a fill
sweep that never changed the fill, and a probe read before the first frame.

### 6.5 The game has now been played, and nothing happened

This is the most important result in the report, and it is the one that could only
ever have come from playing it.

`tools/qa/playthrough.mjs` ran one unbroken session: **6000 frames, 100 seconds of
simulated play at a fixed 1/60 step**, driven by real DOM keyboard events through
the real update path — movement, sprint, crouch, lamp, interact. Not teleports.

**What held up.** No console errors. Player position never NaN. Never fell through
the floor — 0 of 6000 frames not standing on a floor. Simulated time advanced
continuously. 135 footstep events fired while walking. The audio subsystem
constructed and its AudioContext reached `running`. Every zone visited reported lit
fixtures. For a build assembled from independently-authored subsystems and never
once run continuously, that is a better result than I expected.

**What did not.** Three assertions failed. Two are the CPU rasteriser: frame-time
p50 is 5.20 ms and p99 is 17.7 *seconds*, which is first-frame shader compilation,
not steady-state cost, and is called out as such rather than hidden.

The third is the finding:

> **at least one entity state transition occurred — FAIL — the Surveyor never
> changed state**

And the pacing analysis:

| measure | value |
|---|---|
| zero-threat time | **100.0 %** |
| threat episodes | **0** |
| Director beats fired | **0** |
| fear, peak over the whole session | **0.027** out of 1 |
| longest stretch with nothing on the bus but footsteps | **100.0 s** |

**In a hundred seconds of a horror game, nothing happened.** Not a chase, not a
beat, not a distant sound — fear never rose above 0.027.

The harness also reports the cause, which is a scheduling parameter rather than a
broken system: the Director's quiet floor is 95 s and its first beat is scheduled at
150 s. So the opening is *designed* to be empty for two and a half minutes, and the
Surveyor is gated behind progression a walking bot never reaches.

A slow burn is legitimate — *Alien: Isolation* takes about ten minutes to show you
the Alien. But it does not give you two and a half minutes of *nothing*: it gives
you a radio, a body, a door that will not open. The distinction is between delaying
the monster and delaying every beat, and this build currently does the second. That
is now measured rather than suspected, which is the whole point of having run it.

### 6.6 Playing it for longer found the actual bug, and fixing it changed the game

The 100-second session above was truncated — the script is 7.5 minutes and covers
four zones. It could not be run in full because the harness rendered every frame,
and on a CPU rasteriser 100 seconds of that cost 89 minutes of wall clock.

`step()` is the game; `render()` is the picture. Nothing in the Director, the
entities, the audio or the physics reads back from the framebuffer, so for a pacing
run the frames in between are pure cost. With `--renderEvery 45` the full script
runs in **568 s** and the frame timing finally measures the game rather than the
rasteriser: **p50 0.20 ms, warm p99 5.5 ms**.

Run in full, it found the real defect — and it was not pacing:

**`spawnAt` had exactly two callers, and neither could ever fire.**
`seedIntakeDemo`, which `Game.js` gates behind `seedDemo: !this.subsystems.world`
and which therefore only runs when the world module is *absent*; and
`Director.respawn`, which cannot fire because nothing had killed the player. **The
monster in the horror game never entered it.** Every zone, every session, from the
beginning.

`Director._ensureSpawned` now places it dormant 26 m away after 22 seconds — the
same state and distance the demo seeding used. Re-running the identical script:

| | before | after |
|---|---|---|
| entity state transitions | **0** | **16** |
| threat episodes | 0 | **1** |
| zero-threat time | 95.7 % | **81.4 %** |
| fear, p90 / peak | 0.068 / 0.295 | **0.152 / 0.565** |

The transitions are the design document's five behavioural rules executing, in
order, unprompted:

```
DORMANT->ROUSED@54.6s   ROUSED->SEEKING@58.1s    SEEKING->MEASURING@68.5s
MEASURING->SEEKING@73s  ... RETREATING->ROUSED@93.8s  SEEKING->APPROACHING@97.3s
APPROACHING->CAPTURING@115.3s    CAPTURING->DORMANT@120.9s
```

It heard the player, held still for 3.5 seconds announcing itself, hunted, lost the
trail and stopped to measure a wall, picked the trail up again, closed, and caught
them — 66 seconds of pursuit. The `ROUSED` window is the 3–4 second warning the
design specifies. None of this had ever happened before.

**Pacing was never the problem. An absent monster was**, and the pacing figures
were the symptom. That is exactly the kind of mistake that only playing it can
catch: every screenshot in this project was of a building that was, unknowingly,
empty.

### 6.7 Six more structural bugs, found by playing and fixed

Once the session could run at full length and repeatedly, it stopped being a
pacing instrument and became a bug-finder. Each of these was invisible to every
other tool in the project, and each is measured before and after.

**The player could walk on air.** `Player.update`, on finding no floor beneath,
held the player at the last height they had stood on and re-grounded them there.
The instinct is right — do not drop the player out of the world — but it turned
every unguarded edge in the game into an invisible floor: off the Cistern's
landing, out over the Plant's 6.7 m pit, and across the Stack's shaft, a zone
whose entire reason to exist is vertigo. `tools/qa/floorgaps.mjs` was written to
find holes in the geometry and found the opposite, which is what located it: a
dense grid over every walkable rectangle in all eight zones reports **zero** holes.
Every failure was past a lip. Gravity now does what gravity does and the net moved
to the bottom as a `player:fell` event. **2 612 bad frames → 0 of 26 850.**

**The eight zones were eight disconnected rooms.** Every zone declares its doors,
Progression keeps a gate table, `World.enter()` performs the transition — and
nothing called `enter()`. The only zone change available required walking 400 m of
empty space between world patches. A player could never leave the Intake; the fuse
cores, the goods lift and the whole objective chain were unreachable. Screenshots
are per-zone and the playthrough changed zones through a QA hook, so nothing had
ever touched a door. `tools/qa/portalgraph.mjs`: **all 8 zones reachable on foot
across 19 doors.**

**Portals ping-ponged.** Arriving through a door puts the player at its arrive
point, which is a step inside the destination — and inside the *return* portal's
radius, so it fired immediately and sent them back. A cooldown cannot fix it; the
player is still standing in the trigger when it expires. A portal is now spent
until it is walked out of.

**A zone could arrive unlit.** The active-light cull tests `distToCam`, which was
only written on the throttled re-sort. Zones sit 400 m apart, so the frame after a
transition every fixture in the destination still carried its distance from the
zone just left and was culled. **23 continuous seconds of the Service Spine with
286 fixtures resident and zero active.** Distance is now recomputed per frame;
only the sort stays throttled.

**Respawn could switch off the room you woke up in.** `Director.respawn` flips one
circuit — a good beat, correctly sized — but picked uniformly over every circuit
in the building, including the one lighting the zone the player respawns into.
Measured: captured at 2:48, and the Intake's 208 lit fixtures went out and stayed
out for the remaining 145 seconds. A horror game may take the lights away; doing it
to the room you are standing in at the instant you regain control reads as a bug,
because it was one. **291 dark samples → 1.**

**The Surveyor never entered the game** (§6.6).

Across the six runs, the same 7.5-minute script now produces:

| | run 1 (100 s) | run 3 | run 6 |
|---|---|---|---|
| entity transitions | 0 | 0 | **12, a full hunt** |
| frames not on a floor | — | 2 612 | **0** |
| samples with no active light | — | 46 | **2** |
| zero-threat | 100 % | 96.5 % | **84.5 %** |

### Two bugs the long session found — BOTH FIXED IN SECTION 8, see 8.1

Left open at the end of this pass, and resolved in the next one. Recorded here
rather than deleted because the shape of each is worth keeping.

- **The player spends time not standing on any floor** — 1 969 of 26 850 frames,
  worst consecutive run 1 248 frames (about 21 seconds), with y ranging 0.00–2.60.
  The collision world has no walkable rectangle under the player there. It does not
  produce a fall, so it is not visible in play, but it means floor-dependent systems
  (footstep surface, the entity's noise model) are guessing for 21 seconds.
  → **Fixed.** It was not a hole in the world at all: `tools/qa/floorgaps.mjs`
  found no walkable rectangle that fails the stand test, which relocated the bug to
  the player controller, and from there to `Player._fellOut` — a one-shot latch
  nothing ever cleared, so the safety net that catches a player leaving the world
  worked exactly once per session. Now **0 of 32 760 frames**.
- **The Office of Record reports zero active lights.** The safe room — the one
  place in the game that is supposed to be safe — has 3 fixtures and at times none
  of them are live.
  → **Fixed twice over.** Three pendants plus the desk lamp plus an emergency light
  on the always-powered circuit, and then the light budget was re-ranked by
  importance rather than distance so a dim lamp standing next to the player can no
  longer displace the room's key light. The zone reports 0 % of its walkable area
  beyond 5 m from a live fixture, and the continuous session's minimum active-light
  count across every zone visited is now **1** rather than 0 — including in a zone
  the player had deliberately switched off at the board.

### A diagnostic of mine that was wrong, recorded because it nearly misled me

To test whether the Stack's new shaft wall faced outward, I measured triangle
normals against the shaft axis. The first run reported **zero** shaft-wall
triangles anywhere, which would have meant the enclosure was never built.

The test was wrong, not the zone. `makeBuilders()` looks `ZONE_ORIGIN` up by zone
id and bakes it into every emitted vertex regardless of the origin passed to the
builder, so the Stack's geometry sits at z = 800 and measuring radius from the
world origin found nothing at all. Corrected, it found 22 322 inward-facing
triangles. A verification tool that is wrong in the confident direction is more
dangerous than no tool.

---

## 6.8 Verification state at the end of the second pass

**Superseded by section 8.1.** Kept as the record of where the second pass left
things; the numbers below are not current.

Four audits, all of which run in seconds without a browser, and one continuous
session. Every one of these can be re-run by anyone reading this.

```
npm run aotest                    PASS   8 checks on the baked AO field
node tools/qa/portalgraph.mjs     PASS   all 8 zones reachable on foot, 19 doors
node tools/qa/floorgaps.mjs       PASS   no walkable rectangle fails the stand test
node tools/qa/lightreach.mjs      —      worst-case metres to the nearest live lamp
node tools/qa/playthrough.mjs     8/10   7.5 min continuous, real input
```

Light reach, all eight zones:

| zone | fixtures | worst reach | area beyond 5 m |
|---|---:|---:|---:|
| Intake | 210 | 9.86 m | 9 % |
| Service Spine | 68 | 2.79 m | **0 %** |
| Cistern | 17 | 7.21 m | 9 % |
| Residence | 33 | 2.40 m | **0 %** |
| Plant | 19 | 6.71 m | 10 % |
| Ductwork | 25 | 1.53 m | **0 %** |
| Stack | 73 | 4.99 m | **0 %** |
| Office of Record | 5 | 2.24 m | **0 %** |

The Intake's and Plant's worst cases are the deliberately ruined far corner and a
large hall respectively. The two playthrough assertions still failing are the
CPU-rasteriser frame stall (p50 is 0.20 ms; the outliers are shader compiles) and
two single frames at a zone boundary reporting no active light, which is the
one-frame transient the light re-rank is allowed.

*(Both of those, and the fixture counts in the table above, changed in section 8:
about twenty-five emergency fixtures were added to the escape routes after the
blackout case was measured for the first time, and the light budget was re-ranked.
See 8.1 for the current numbers.)*

## 7. Artefacts

| what | where |
|---|---|
| Build | `npm run build` → `dist/`; `npm run preview` |
| Design bible (fiction, zones, architectural rules, code contracts) | `docs/DESIGN.md` |
| Zone-coverage captures | `docs/captures/judge1/` |
| Ordinary-gameplay captures, chronological | `docs/captures/r0/` … `r8/` |
| Artifact metrics | `docs/captures/*/_artifacts.json` |
| Baked-AO A/B pairs (`ao_NN_off_*` vs `ao_NN_on_*`) | `docs/captures/ao/` |
| Contributor-isolation diagnostics (GTAO / shadows / detail normal / fill off) | `docs/captures/diag3/` |
| Post-polish zone captures | `docs/captures/verify/`, `docs/captures/final3/` |
| Magnified crops used to identify sub-pixel defects | `docs/captures/crop/` |
| Numeric AO bake check | `npm run aotest` |
| Light-reach audit, all zones | `node tools/qa/lightreach.mjs` |
| Post-dado Intake and zone checks | `docs/captures/chk2/`, `docs/captures/intake/` |
| Continuous playthrough harness (written, run pending) | `tools/qa/playthrough.mjs` |
| Audio-to-wav export harness (written, run pending) | `tools/qa/audio-render.mjs` |
| Hand asset renders | `docs/assets/hands_firstperson*.png`, `hands_silhouette.png` |
| UI screens, three aspect ratios | `docs/captures/ui/r9*/` |
| Blender asset turntables | `docs/assets/` |
| Asset manifest with sub-objects and material slots | `public/assets/models/manifest.json` |
| Cross-subsystem integration contracts and responses | `docs/INTEGRATION_REQUESTS*.md` |

---

## 8. Third pass: making it a game

The two passes above are about how the building looks and how it is measured.
This one is about a defect that neither of them could have found, because both
were looking at pictures of rooms:

**The shipped build had no interactables in it at all.**

Every one of the eight zone builders ends with

```js
return { root, chunks, builders, portals, interactables, ... };
```

and every one of them returned `interactables: []`. `Builder` carried an
`interactables` array of its own that nothing ever pushed to. And
`installGameplay` only populated the world when `seedDemo` was true — which is
`!subsystems.world`, i.e. the bare Intake fallback used when `src/world/World.js`
is absent. So with all eight zones built, which is every real build, the
interactor's registry was **empty**:

- no breaker, valve, keypad, card reader, terminal, generator or goods lift
- no pickups, so no supply cores, no warden's card, no pry bar, no notes, no tapes
- no hiding places
- **no working doors, and therefore no door colliders.** `Kit.doorway` leaves the
  wall opening walkable on purpose, because the collider belongs to `DoorLatch`;
  nothing constructed those latches, so every shut door in the building was a hole
  you walked through — including the ~20 Residence doors whose rooms are never
  built, where walking through meant falling out of the world.

The three-supply-core objective chain and both endings were unreachable, and
`Progression` sat for the whole session with its first objective active and no way
to advance it. Nothing in the project had ever pressed the interact key.

This is the clearest example in the whole build of the lesson section 6.5 already
wrote down and did not finish applying: **a screenshot cannot tell you whether a
game is a game.** Sixty capture shots, four numeric audits and two continuous
sessions all passed while the thing they were measuring could not be played.

### What was built

`src/systems/ZoneGameplay.js` — the join. Once per zone, on first build:

1. **Adopts every door.** A `DoorLatch` per `Kit.doorway()` group, locked when
   there is no walkable floor on both sides — which is simultaneously the diegetic
   reason most Residence doors do not open ("Locked. No keyway on this side.") and
   the fix for the void-entry bug. 41 latches, 30 passable; the 11 that are not are
   exactly the corridor doors whose rooms do not exist.
2. **Spawns the zone's declared props**, offsetting local coordinates into the
   zone's world patch.
3. **Registers portals with `Progression` under gate GROUPS**, so the critical path
   can lock "the way into the Stack" once instead of hunting for two
   independently-authored door ids, and a zone built later inherits the lock.
4. **Hands the Director its safe room** and the Attendant its candidate floors.

Props are never despawned. Zones sit 400 m apart past the far plane, so a resident
prop from an unloaded zone is invisible, culled, and in collision hash cells no
query touches — whereas a thrown breaker, a turned valve and three fitted cores
are the player's progress, and serialising that is a much larger and more fragile
thing than the memory it would save.

### The content, and where the design came from

Almost none of it was invented here. `src/systems/Notes.js` already contained
thirty documents that describe the whole game in detail, and they were treated as
the specification:

| note | what it dictated |
|---|---|
| `note_fuse_room` (stock card) | one core in the Cistern penstock room, one in Residence R-207, one in the Stack lift lobby, one dropped on the Plant floor |
| `note_keycard_memo` | R-207 is card-access, cards issued before October do not open it, the warden's card is on the warden's belt |
| `note_cistern_isolation` | penstock 1 open and must stay open, penstock 2 padlocked, "no configuration in which neither of them matter" |
| `nb_5` (last notebook page) | the terminal code is the open-day date reversed — 3 December → 0312 → **2130** |
| `note_generator_start` | fuel valve, twelve primer strokes, starter, fifteen seconds maximum |
| `note_lift_permit` | the car travels with three cores and only three, exactly once |
| `note_board_c` | eight ways, the main is under-rated |

Two pieces of existing set dressing turned out to be the answers to their own
questions:

- The Service switchroom is described as "the room where every chair faces one
  corner", and the chairs' yaw is computed toward that corner. **Distribution
  Board C now stands in it.** That is what they were facing.
- The Stack has "a chair pushed up to the missing bay of handrail, facing out over
  the drop". **The warden's card is on the deck beside it.** Nothing else in the
  game explained that chair.

R-207 had to be built: index 6 in the Residence's 3.6 m door rhythm (201 + 6),
which was an undressed shut door in front of a room that did not exist. It is now
dressed as the stores the memo says it is, with a card-locked leaf, the reader,
**and** a keypad whose code is the notebook's — so a player who never finds the
warden can still finish, and a player who finds the warden never has to work it
out.

The Plant's Set No. 2 is a real machine now rather than dressing, and the goods
lift is a real car in the shaft behind the wall opening. The `Mech.goodsLift`
surround that used to stand there was a shut door with a collider across the
opening: it would have walled the exit off from the car.

Draining the Cistern works. Shutting penstock 1 lowers the water over half a
minute **and takes the standing-water depth out of every floor record as it goes**,
so footsteps stop being loud at the same rate the water stops being visible. That
is the choice the isolation notice sets up: make one loud noise, or wade.

### Six bugs that made something unplayable, each found a different way

- **The Ductwork was physically impossible to enter.** Its internal clear is
  800 mm and a crouched capsule is 1.02 m, so its ceiling colliders overlapped the
  body all along the crawl and `resolveCapsule` shoved the player sideways out of
  it at every step. The zone, its two portals and everything in it were
  unreachable. Fixed with a third posture — standing → crouched → hands and knees —
  with its own eye height, speed and footstep loudness. Found by a placement audit
  reporting every prop in the zone as unreachable and being asked why.
- **Portal arrivals went to the wrong place.** `portal()` stores the far-side door
  as `target.portalId`; the trigger read `target.portal`, found `undefined` every
  time, and fell back to the id of the door being *left* — which no destination
  zone has — so every transition dropped the player at the destination's default
  spawn instead of the door they walked into.
- **Two self-opening gates never opened.** `Progression.update` read
  `this.portals.get('portal_stack')`, and `portal_stack` is a *group* name that has
  never been a portal id — the zones call their doors `to_stack`, `to_residence`.
  The lookup returned `undefined`, both conditions were permanently false, and
  neither the Stack nor the Residence ever opened whatever the player did.
- **A core found early was credited to nothing.** The three core hunts are only
  revealed on first reaching the Plant, and the Cistern and the Stack are both open
  before it. Requiring the hunt to be `active` meant an early core vanished into
  the count and its objective stayed on the list with the core already in hand.
- **`annexDoor` had never worked.** Its builder shim implemented `mat` and
  `addObject` but not `add`, and `Kit.doorway` bakes the static frame through
  `add`. Any door built outside a zone chunk threw on its own frame.
- **No cassette had ever played.** The pickup called `notes.collect`, which files a
  tape without opening it, so `story:tape` never fired for any of the six — no
  transcript panel, and the "tapes" discovery was unreachable.

### The HUD was never connected to the game

`ui.setPrompt` is documented in `UI.js`'s own header and had exactly one caller in
the project: the cinematics, clearing it. With the interactables finally live,
every door, breaker, valve, socket and pickup was still silent on screen — no key
badge, no verb, no reason when it refused, no hold ring on the four actions that
need one. `Interactor` maintains a stable `focus` object precisely so the UI can
read it every frame.

Nor did anything listen to `Progression`. It announced every objective change,
core, hint and discovery on the bus, and the objective banner — the only place the
game ever states what the player is trying to do — was blank for the whole of
play. The pause screen's core count was the hard-coded string `'0 of 3'`, so it
told every player they had fitted nothing right up to the ending.

### Every mechanism in the building was silent

`Library.js` registers 70 sounds. Twenty-one had no caller anywhere: `door.open`,
`door.close`, `door.latch`, `door.locked`, `door.heavy`, `door.handle`,
`valve.turn`, `hatch.open`, `lift.call`, `lift.arrive`, `relay.click`,
`switch.click`, `locker.click`, `metal.clang`, `pipe.knock`, `chair.scrape`,
`flashlight.click`, `flashlight.rattle`, `kettle.click`, `ui.hover`, `ui.journal`.

For a game whose entity hunts by sound that is not a polish gap. The lamp switch
had no click — so the cover key (hold V, silent by design) had nothing to be
quieter *than*, and the single most important mechanic after WASD was
unobservable.

`tools/qa/audiowiring.mjs` now checks both directions statically: every sound
played by name is registered, every player-facing event has a listener, and
nothing a player *does* in the world goes unanswered. Five library sounds are
declared accepted orphans — `impact.soft`, `impact.hard`, `debris.small`,
`glass.crack`, `cable.twang` — because each needs a physics event that does not
exist. They are listed so the gap is visible and the count cannot creep.

### The light budget was ranked wrong

`LightRig` can drive 6 / 10 / 14 real lights by tier and it kept the N **nearest**.
That sounds obviously right and is not: irradiance falls as 1/d², but rated output
spans 9 to 340 candela across `FIXTURE_TYPES` — a factor of thirty-eight — so the
output term is much the stronger of the two. A 9 cd emergency bulkhead 2 m away
outranked a 340 cd high bay 5 m away.

Fixtures now rank on estimated irradiance at the camera. Measured rather than
assumed: `lightreach --budget 10` sums what the chosen ten deliver under both
rankings at every walkable sample point. Importance can never lose — it is
choosing the top N of the very quantity being summed — so the numbers are the
margin that was being left on the table:

| zone | gain | worst point |
|---|---:|---:|
| Plant | **+13.7 %** | ×1.66 |
| Stack | +3.5 % | ×1.11 |
| Service Spine | +1.2 % | ×1.07 |
| Ductwork | +1.1 % | ×1.06 |
| Residence | +0.4 % | ×1.02 |
| Cistern | +0.1 % | ×1.02 |
| Intake, Office | 0.0 % | ×1.03 |

The Plant is where distance and output disagree, which is exactly where the zone's
own header comment says the composition lives.

### Nobody had measured the blackout

Board C carries eight ways and lets four be live at once, so the player *chooses*
which parts of the building go dark — and a blacked-out zone is supposed to stay
navigable on the always-powered emergency circuit plus a flashlight. That case had
never been measured. `lightreach --blackout` measures it, and it was bad:

| zone | before (mean / worst) | after |
|---|---|---|
| Intake | 43.8 m / 82.8 m | **10.6 / 26.4** |
| Service Spine | 11.5 / 26.4 | **4.4 / 11.3** |
| Cistern | 26.4 / 47.2 | **6.2 / 15.4** |
| Residence | 20.0 / 41.4 | **4.0 / 7.9** |
| Plant | 11.8 / 23.8 | **6.9 / 15.0** |
| Stack | **no emergency fixtures at all** | **5.2 / 10.3** |

The Stack had none — the only zone without, and the only one that is a 47 m
vertical drop with a bay of handrail missing. Tripping its way from inside it put
the player in total darkness on a deck ring above a shaft. It now has four, one per
face, plus one four levels down on the far side of the well: the only light in the
shaft that never goes out, and so the thing the eye finds when you look over the
edge. Adding twenty-odd dim lamps across the building is only safe *because* of the
ranking fix above; under distance ranking they would have stolen the key light from
every lit room they stand in.

### Three safety nets that fired once and never again

- **`Player._fellOut`** latches so one fall emits one `player:fell` — and nothing
  cleared it, so the net that catches a player leaving the world worked exactly
  once per session. A run showed the second fall reaching −31 m and staying there
  for 64 seconds with the game running perfectly happily. Cleared on `teleport`,
  which is the end of a fall by definition.
- **Arriving in a zone now spends every door in it.** Arming only the matching pair
  was not enough: `enter(zone)` with no portal id uses the zone's own spawn, and the
  Cistern's spawn is 300 mm from its own exit door — it fired on the next frame and
  sent the player back to the Spine. A radius test looked like the fix and was not
  (the Plant's Service door is 1.7 m from its spawn and the bounce still happened).
  Each door re-arms itself the first frame the player is not standing in it.
- **A hiding place's prompt said "Get in" while you were inside it.** Inside, the
  controls are disabled and the only key that does anything is the one whose label
  was wrong. A session had the bot climb in at 1:53 and still be in there nine
  minutes later, with every later movement phase doing nothing and the whole run
  measuring a player standing still in the dark.

### Checkpoint saves

The title screen has always offered Continue. `UI.readHasSave()` decided whether
to enable it by reading `localStorage['annex.save']`, and nothing ever wrote that
key: permanently greyed out, and every session started at the arrival lift. The
game is about forty minutes long.

`src/systems/SaveGame.js` does not snapshot the world — the zones are
deterministic functions of one seed. What cannot be reproduced is what the *player*
changed, and that is a short list: where they are (local to the zone, so a
`ZONE_ORIGIN` can move without invalidating saves), what they carry, the objective
states and cores and gates, which papers they have read, each way of Board C, and
which of Set No. 2's sockets are filled. Keeping the list short is the point: a
format that serialises geometry breaks the first time a zone builder is edited.

Checkpoints, not save-anywhere — on entering the Office of Record, on completing an
objective, and on starting the set. A horror game that lets you save mid-chase has
no chases in it, and the Office is already the room the fiction offers as the place
you may sit down.

### The playthrough bot can now play

A `seek` mode aims yaw *and* pitch at a target through `Input.mouse`, walks to it,
and taps the interact key **on the frame the interactor's own reticle reports the
item as focused** — so a pass means the raycast, the distance pre-filter, the range
test and the prompt all agreed before anything was pressed. The key is dispatched
in-page rather than from the driver process because `input.pressed()` is true for
exactly one frame and a round trip to Node cannot hit a chosen one.

Steering is the honest weak point: there is no navmesh, so `seek` walks toward a
target and steps around what it bumps into. Where that is not enough the phase
declares `at`, which repositions the player and is logged as SCRIPTED, exactly as
the zone changes are. A reposition now *refuses* a coordinate with no floor rather
than dropping the player into the void — which is how the 64-second fall got into
a session and poisoned every measurement after it.

### New audits

```
node tools/qa/props.mjs             71 declared props: support height, buried
                                    depth from the nearest face, and a ring search
                                    for a standing/crouching/crawling position with
                                    line of sight inside the prop's own reach
node tools/qa/chain.mjs             builds all eight zones, runs the real gameplay
                                    wiring over them, and plays the critical path
                                    through Interactor's own refusal gate
node tools/qa/audiowiring.mjs       sounds reachable, events heard
node tools/qa/lightreach.mjs --blackout   navigability with every way tripped
node tools/qa/lightreach.mjs --budget 10  which N fixtures the rig should keep
```

`props.mjs` found three real coordinate errors and one zone-wide posture bug.
`chain.mjs` walks the whole spine — arrival bay to goods lift, board to Stack,
warden's card to R-207, three cores, twelve primer strokes, `ending = left` — plus
a save round trip that captures at the end of a completed run, breaks everything,
restores, and compares field by field.

### What this pass did not close

- **Frame rate on real hardware is still unverified.** This environment has no GPU.
  Zone-build shader compilation is now pre-warmed on `zone:build` rather than
  landing on the first frame after a transition, which is the right fix regardless
  of hardware, but the absolute numbers here remain a CPU rasteriser's.
- **Nobody has listened to the audio.** The mechanism sounds are wired and the
  wiring is statically verified; whether they are *good* is not something a static
  check or an RMS measurement can answer.
- **The bot is not a player.** It presses the right things because it is told which
  ones. It will not find a secret, misread a note, or get lost — and getting lost is
  most of what this game is.

### The two ends of the game were not connected either

`Surveyor` emits `game:death` when a capture completes; `Progression` emits
`game:ending` when the lift reaches the surface. The Director listened for the
first, to freeze the body and run the death cinematic. Nothing at the level that
owns the screens listened for either. So being caught froze the player in place
with no screen and no way back, and finishing the game — three cores, a generator
started by hand, a lift ridden out — showed nothing at all. Both screens exist in
`src/ui/EndScreens.js`, fully designed, with option lists; the UI harness was the
only thing that had ever opened them. The death screen's second option, "Abandon
shift", had no handler, and its first did not put the state machine back to `play`
or re-take the pointer.

And `Director.respawn()` teleported to `lastSafe || safeRooms[0]` — both undefined
until the player has walked into the Office of Record, i.e. for the whole opening
half hour. Every death before that skipped the teleport, unfroze the body exactly
where it fell, and handed the player back to the thing standing over them.

### The journal's plan tab was a blank sheet

`Journal` has `mapAdd`, `mapLink` and `mapHere`, and nothing had ever added a node.
The one call that existed fed `mapHere` the player's world position, which for
zones authored 400 m apart in disjoint streaming patches is a number with no
relation to a floor plan. It draws a zone map now — eight nodes on the graph the
building actually has, each appearing the first time the player stands in it, edges
between the ones they have walked between. Hand-laid out rather than derived from
`ZONE_ORIGIN`, because those are streaming patches and say nothing about how the
place connects.

## 8.1 Verification state after this pass

Browser-free, `npm run audit`, about six seconds total:

```
aotest         PASS   8 checks on the baked AO field
props          PASS   70 declared props on a floor, out of the walls, reachable
chain          95/95  the critical path played through Interactor's refusal gate,
                      plus a save capture/restore round trip
audiowiring    5/5    sounds reachable, player-facing events heard
floorgaps      PASS   no walkable rectangle fails the stand test
portalgraph    PASS   8 zones reachable on foot across 19 doors
lightreach     —      worst-case metres to the nearest live lamp
```

One browser check that takes 40 seconds, `npm run bootcheck`:

```
9/9   ready, no console errors, world + gameplay + UI + audio + saves up,
      10 interactor items and 4 doors live in the start zone, objective active
```

And one continuous session, 11.5 minutes of simulated play with real DOM input,
`npm run playthrough` — **12 of 13**:

| | check | result |
|---|---|---|
| PASS | no console errors | — |
| PASS | position never NaN | 0 frames |
| PASS | never falls through the floor | **0 of 32 760 frames** (was 2 612) |
| FAIL | no frame > 5 s | max 11 606 ms, p99 **10 ms**, p50 0.30 ms |
| PASS | post-warmup p99 < 250 ms | warm p50 0.30, p90 0.60, p99 9.6 ms |
| PASS | simulated time continuous | 32 760 frames |
| PASS | an entity state transition occurred | DORMANT→ROUSED→SEEKING→MEASURING→SEEKING→APPROACHING→**CAPTURING**→DORMANT |
| PASS | audio constructed | ctx running |
| PASS | footsteps fired | 419 |
| PASS | every zone reported lit fixtures | min active **1** (was 0) |
| PASS | not stuck in a hiding place | 25 of 1 069 samples hidden |
| PASS | an interactable was operated | **13 operations** |
| PASS | player could move | 97 % of samples |

The thirteen operations, which is the part that did not exist before this pass:

```
locker_intake_enter  pressed          (in)
locker_intake_enter  pressed          (out)
note_4107_-31        pressed          (read)
board_c_way5         pressed          (Stack lift lobby, live)
board_c_way2         pressed          (Spine, out)
board_c_way2         pressed          (Spine, back)
penstock_1           completed a hold (1.35 s, real key held)
set_2_socket0        refused: You are not carrying a core.       x3
lift_2_call          refused: Dead. Three-phase is out.          x3
```

Instant presses, a completed hold action, and two distinct refusals with the
correct reasons — each fired on the frame the interactor's own reticle reported the
item as focused, so the raycast, the range test and the prompt all agreed first.

The single remaining failure is the CPU rasteriser's shader compile, which is what
the per-zone pre-warm exists to remove and which the harness disables by default
(`?prewarm=0`) because on SwiftShader it costs 190 seconds a zone. p99 is 10 ms
either side of it.

### Submitted workload, `npm run perf` — every budget met

Measured at the low tier, 640×360, shader pre-warm off (`prewarm=0`), which is what
a four-scenario run can complete in a useful time on a CPU rasteriser. The numbers
are the workload the frame submits, which is portable; the frame times printed
alongside them are not, and the tool says so.

| | before | after | budget |
|---|---:|---:|---:|
| draw calls, `many_lights` (worst) | 221 | **170** | 180 |
| draw calls, `open_bay` | 185 | **154** | — |
| draw calls, `corridor` / `long_view` | 90 / 84 | 91 / 85 | — |
| triangles, worst | 477 802 | 485 642 | 1 200 000 |
| emissive sources glowing | 48 – 139 | **149 in every scenario** | — |
| active dynamic lights | 6 | 6 | 28 |
| shadow-casting lights | 1 | 1 | 3 |
| shader programs | 128 | 128 | 140 |
| logic ms, p95 worst | 0.70 | 1.60 | 4.0 |

This is the first run in which every budget passes. What changed was
`render/EmissiveBatch.js`: each fixture's glowing part used to be its own mesh,
which made 217 fixtures in the Intake 217 draw calls, and the batch makes them
eight — one per fixture type per chunk, so each still frustum-culls with the chunk
it belongs to. Per-zone triangle counts are identical to the byte.

Three of those rows deserve the honest reading rather than the flattering one:

- **`corridor` and `long_view` went UP by one call.** A batch spans a whole chunk,
  so it is in frustum more often than a scattered handful of distant tubes would
  be. The trade is one draw call in the cheap scenarios for fifty-one in the
  expensive one.
- **Triangles went up 7 840.** Hidden sources keep their place in the instance
  buffer with a zeroed basis, so they still reach the vertex shader as degenerate
  triangles. At 486 k of a 1.2 M budget that is the right side of the trade.
- **Worst-case logic p95 went 0.70 ms to 1.60 ms**, all of it in `many_lights` —
  the scenario that switches circuits, where every flip re-flags a whole instance
  matrix buffer. Within budget with headroom, and not chased further, because a
  buffer-upload cost measured on SwiftShader is not a cost I can confirm exists on
  real silicon.

**The batch was checked in pixels, not only in counters**, because "217 sources
became 8 draw calls" is exactly the kind of claim that can be true while the
sources have quietly stopped rendering. `docs/captures/emissive-verify/` holds the
evidence: the Service Spine with the near strip's tube blown out inside its
housing, a second mid-corridor and a receding row beyond it, all one instanced
mesh; and the safe room lit warm by its own pendants. Alongside them,
`fixtureReport` for all five fixture types — troffer, strip, bulkhead, high bay,
pendant, plus emergency — every one reporting its slot in the scene, visible, and
at the right luminance, and the one unpowered troffer in frame correctly reporting
`visible: false, lum: 0`.

Two traps on the way to those shots, recorded because both would have produced a
confident wrong answer:

- The first report said every fixture in the safe room was at level 0 — a dark
  safe room, which would be a real defect. It was the harness: a shot's `setup`
  runs *before* its settle frames, so the report was taken on the frame the zone
  was built. Split into a goto shot and a report shot, all five read ~0.98.
- `capture.mjs` had no way to skip the shader pre-warm, so a five-shot run over
  four zones could not finish here at all. That is why it now takes `--prewarm 0`.

An earlier version of this pass tried a 40 m distance cull on the emissive sources
instead. It recovered five draw calls of 226, because the Intake is a dense
63 × 63 m plate rather than a corridor and nearly everything lit is already inside
40 m. It is reverted: with the sources batched, hiding the far ones buys nothing and
can only break the rule that if the player can see light, they can see what is
making it. That is why the "emissive sources glowing" row goes *up* while the draw
calls go down.

Pacing, for the record: 76.4 % zero-threat, one threat episode of 47 seconds
ending in a capture, fear p90 0.269 and peak 0.513, longest stretch with nothing on
the bus but footsteps 546 s. That last number is the honest weakness — the Director
fires beats on a 95 s floor and a 150 s first beat, and a bot that walks in circles
does not give it much to react to, but nine minutes of quiet is nine minutes of
quiet.
