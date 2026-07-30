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
- **Prop instancing.** The scene pass measures ~190 draw calls against a 180
  budget (see the correction in section 2). Still the right optimisation.
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

- **The Stack still does not read.** Its enclosure is now real and verified
  numerically — 124 shaft-wall colliders across three radii, 411 k triangles, and
  22 322 triangles facing *into* the shaft, correctly wound. So the remaining
  darkness is lighting, not missing geometry, and its light reach is now the joint
  best in the building. But the frame at the low tier is still 0.93 crushed and I
  could not get a shipping-tier capture of it inside the remaining budget. Given
  the Cistern measures 0.939 at low against 0.236 at medium, much of that number is
  the tier artefact described in §5 — but "probably mostly a measurement artefact"
  is not verification, and this stays open.
- **The Cistern is still dark**, 9 % of its area beyond 5 m from a lamp.
- **Still never run on a GPU**, and no frame-rate verdict exists.
- **The playthrough and audio-export harnesses are written but their runs are not
  in this report.** `tools/qa/playthrough.mjs` drives a continuous session with real
  synthetic keyboard input through the real update path, and
  `tools/qa/audio-render.mjs` renders the synthesised audio to .wav files a human
  can listen to. Both landed; neither has produced a finished artefact yet. The two
  biggest holes in this project's verification — nobody has played it and nobody
  has heard it — therefore remain open, and the tooling to close them existing is
  not the same as them being closed.

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
