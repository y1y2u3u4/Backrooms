# THE ANNEX — Next Iteration Brief

You are continuing an existing project, not starting one. Read this whole file
before touching anything, and read `docs/COMPLETION_REPORT.md` — it is long, it is
honest, and it already contains the diagnosis for most of what is still wrong.

**Do not rebuild what exists.** The game boots, plays end to end, has eight
connected zones, a working entity, puzzles, saves, an ending, and a browser-free
verification suite. Your job is to close named gaps and raise the ceiling, not to
re-derive the project.

---

## 0. What exists, so you do not rebuild it

- **Engine**: three.js, WebGL2, deferred-ish forward renderer, GTAO, MSAA, exposure
  adaptation, colour grading, procedural PBR materials, baked AO volume, motes,
  volumetric cones, per-zone bounce fill.
- **World**: eight art-directed zones (Intake, Service Spine, Ductwork, Cistern,
  Residence, Stack, Plant, Safe Room) on a streaming graph, 400 m apart in world
  space, `maxResident = 3`. 599 meshes, 1.78 M triangles, 481 fixtures total.
- **Gameplay**: interactor with refusal gating, doors/latches, breakers, valves,
  keypads, card readers, terminals, a lift, a generator with three cores,
  inventory, notes, journal, progression with gate groups, checkpoint saves.
- **Entity**: the Surveyor, with a state machine reaching
  DORMANT → ROUSED → SEEKING → MEASURING → APPROACHING → CAPTURING.
- **Audio**: 75 procedurally synthesised sounds, spatialised, occlusion, reverb
  zones, footsteps by surface, every mechanism wired.
- **UI**: menus, HUD, prompts, objectives, journal, death flow, ending, pause.
- **QA**: `npm run audit` (browser-free, ~6 s) covering AO, props, the critical
  path, audio wiring, floor coverage, portal graph, geometry census, light reach;
  plus `bootcheck`, `perf`, `playthrough`, `capture`, `lightreach`, `blackout`.

Current verification state: props 77/77, chain 106/106, audiowiring 5/5,
floorgaps clean, portalgraph 8 zones / 19 doors, geobudget under every budget,
bootcheck 11/11, light reach 0 % beyond 5 m in six of eight zones and 1 % in the
other two.

`npm run perf` at the shipping low tier, **twelve scenarios across all eight
zones**: triangles 651 k / 1.2 M, active lights 12 / 28, shadow lights 1 / 3,
shader programs 51 / 140, logic 0.2 ms / 4 — and **draw calls 268 / 180, which
fails.**

Read the history carefully here. Until this pass `tools/qa/perf-scenarios.json`
did not exist, so `perf.mjs` fell back to four hardcoded cameras that are all in
the Intake, and every "worst scenario 179 / 180, all budgets pass" in this
project's documents meant "the worst of four cameras in one of eight zones". The
real worst case is the Plant at 268, and the Residence, the Service Spine and a
fifth Intake camera all exceed 180 as well. Nothing regressed; the tool was
looking at one room. The scenario file is committed now.

Two cautions carried forward:

- **Draw calls are the open technical defect**, at 268 / 180. The Residence's 264
  at the shipping tier is 487 at high, and it is mostly independent door leaves
  and pendant fittings.
- **`programs` fell from 162 to 51** because one `customProgramCacheKey` carried
  seven uniform *values*. If you add a material option, put it in a uniform; only
  put it in the cache key if it changes the generated GLSL. Census it with
  `tools/qa/programs.mjs`.

Three tools were repaired or added in the pass that produced these numbers, and
each of them changed a conclusion:

- `perf.mjs` rebuilds before measuring (it was serving a six-commit-old bundle).
- `capture.mjs` polls on a timer rather than a frame callback, prints the renderer
  it actually got, and streams progress. It was never hung.
- `lightreach.mjs --delivered N` measures light that reaches the shader rather
  than fittings that exist, `--map` draws the plan, and `--blackout` now asks
  whether an emergency fitting is *visible* rather than how far away it is.

---

## 1. Constraints carried forward — these are binding

1. **Original visual identity.** Do not copy existing Backrooms games. The Annex
   has an authored architectural language, history, material palette and
   mythology; extend it, do not replace it.
2. **Do not hide visual problems behind extreme darkness, heavy fog, film grain,
   chromatic aberration, or excessive camera shake.** The environment must still
   look convincing in well-exposed inspection screenshots. This has already been
   the deciding argument in three design decisions in this project; it still is.
3. **Light comes from visible sources.** If it glows, there is a fixture. If there
   is a fixture, it is where the light is.
4. **Blender goes through one dedicated subagent.** Blender cannot safely support
   concurrent control. Queue every asset task through that one agent.
5. **The judge is independent and assesses only.** It must not modify the project.
   Do not weaken or rewrite its criteria to obtain approval.
6. **Target a stable 60 FPS in the browser**, and do not achieve performance solely
   by destroying visual quality.
7. **Maximum three full judge revision rounds**, then resolve remaining critical
   defects and produce an honest completion report.

---

## 2. Priority 1 — the named defects

Each of these is already diagnosed. The measurement is given so you cannot declare
it fixed without moving the number.

### 2.1 The Stack — SUPERSEDED, see section 13 of the completion report

Everything below this line was written before the well enclosure, before the
corner high-bays were aimed across the void, and before the capture harness
worked. It has now been re-measured and most of it is out of date.

**The stated exit criterion is met and has been for some time.** Crushed at the
shipping tier measures 0.270 (down the drop), 0.295 (up the well), 0.527 (across)
and 0.579 (corner diagonal), against a bar of 0.85. Frames are in
`docs/captures/stack_now/`. The zone also has the highest delivered light in the
building — mean 31.17 against the Service Spine's 18.13, 0 % of its area under-lit
(`lightreach --delivered 6`).

**And the criterion was measuring the wrong thing.** Twenty wall-washers added to
the ring raised delivered light at every percentile and moved crushed by nothing
(0.527 → 0.516, 0.270 → 0.283). The black in these frames is the shaft's depth —
seven storeys dissolving into fog — and the only way to drive `crushed` down is to
light the void, which destroys the reading the zone exists to create. Do not chase
that number. Dynamic range is the one that moved with the improvement
(0.460 → 0.709 across the well).

Do not raise fill. That has been tried and it is why the zone measures well.

**What is actually left**: a human judgement on whether it reads. My reading of
the four frames is that down and up the shaft read as a well, and along the ring
reads as a dark walkway with a lit wall opposite. That is a judgement, and this
project has been wrong about the Stack from judgements before.

### 2.2 The Cistern is dim rather than unreadable

**Area beyond 5 m from a lamp is now 0 %** (was 9 %) without the fill moving —
the sump had no fitting at all and the stair hall had one, at the far end from a
flight of fourteen treads going down into standing water. See section 10 of the
completion report.

**The crushed target is met too, and comfortably.** Re-measured at the shipping
tier with all four fittings live: 0.090 in the tunnel, 0.249 in the stair hall,
0.269 in the sump, 0.398 in the valve chamber, against a bar of 0.80 — and dynamic
range 0.626 to 0.783 against the 0.47 that was recorded. Frames are in
`docs/captures/cistern_now/`.

**This item is closed.** Both stated conditions are satisfied. Anything further
in this zone is dressing density (§2.5), not lighting.

### 2.2 The Cistern is dim rather than unreadable

Crushed 0.911 → 0.842, dynamic range 0.21 → 0.47. Still 0.84 crushed at the low
tier, and 9 % of walkable area is beyond 5 m from a lamp. Same class of problem as
the Stack but less severe. **Done when**: crushed below 0.80 and area beyond 5 m
at 0 %.

### 2.3 Prop instancing

Fixture emissive sources are now batched (`src/render/EmissiveBatch.js`, 217 meshes
→ 8 in the Intake). The remaining independent draw calls are doors, machines and
props. This is no longer blocking the budget — worst scenario is 170 of 180 — so
treat it as headroom work, and do it only where it does not cost authoring
flexibility. **Anything that moves, opens, or is interacted with must stay
independent.**

### 2.4 First-person hands

Functional, lit, posed and animated, but the geometry does not read as convincingly
as the rest of the frame at the size it occupies. This is a Blender task. It is one
of the two things always on screen.

### 2.5 Uneven dressing density

Intake, Service Spine, Residence and Plant are dressed to standard. **The Cistern
and the Ductwork have architecture, water and lighting but noticeably lower prop
density.** Bring them up without turning corridors into obstacle courses.

---

## 3. Priority 2 — the verification holes

These are the parts of the project nobody has actually checked. They matter more
than any new feature.

### 3.1 Nobody has ever heard the audio

**This is the single largest unexamined part of the project.** 75 sounds are
verified numerically — rendered with no silence, clipping or DC offset, occlusion
monotonic across three states, reverb T60s tracking target — and that is not the
same as them being good. `tools/qa/audio-render.mjs` exists and will export the
synthesised sound to .wav; **it has never been run**.

Run it. Produce the .wav files. Then do the part a static check cannot: listen for
whether the fluorescent hum sounds like a fluorescent, whether footsteps change
convincingly across carpet, concrete, water and steel grating, whether the entity
reads as a thing with mass, and whether the mix has any dynamic range or is a wall
of texture. Fix what is wrong and re-render. Deliver the .wav files as artefacts so
a human can spot-check your judgement.

### 3.2 The bot is not a player

`tools/qa/playthrough.mjs` drives a continuous session with real synthetic keyboard
input and operates 13 interactables — because it is told which ones. It will not
find a secret, misread a note, take a wrong turn, or get lost. **Getting lost is
most of what this game is**, and nothing in the harness measures it.

Build an exploration bot that navigates by what it can see and reach rather than by
a script, and instrument the things that matter for a liminal-space game:
time-to-first-objective without hints, how often it revisits a room it has already
cleared, how long it spends without a navigational cue, and where it stalls. A room
the bot cannot find its way out of is a room a player will hate.

### 3.3 No GPU-verified frame rate

Every performance number in this project comes from SwiftShader, a CPU rasteriser,
and is one to two orders of magnitude off real hardware. The submitted workload is
portable and is within budget; the frame rate is not measured. If you have GPU
access, measure it in the worst-case scenes (large rooms, heavy atmospherics,
entity encounters, dynamic lighting, transitions) and report honestly. If you do
not, say so plainly rather than implying the budgets are a frame-rate verdict.

### 3.4 The judge rounds that never happened

The brief allows three independent judge rounds. **One was commissioned and it was
terminated part-way by a platform usage limit.** Run the rounds. Give the judge
ordinary gameplay frames, not hero shots — including the Stack and the Cistern,
which are the weakest zones and the ones a curated set would omit.

---

## 4. Priority 3 — raising the ceiling

Only after Priorities 1 and 2. Each of these is a real gap against the reference
targets, and none is a bug.

- **Screen-space reflections** on the Cistern's water. It currently uses a
  planar-ish approximation against the procedural environment map.
- **Entity animation.** Procedural, no mocap, and it shows in the walk cycle and in
  the transition into CAPTURING.
- **Director pacing.** The longest measured stretch with nothing on the bus but
  footsteps is **546 seconds**. The Director fires beats on a 95 s floor and a 150 s
  first beat, and a bot that walks in circles does not give it much to react to —
  but nine minutes of quiet is nine minutes of quiet. Give the Director something
  to do when the player is *not* generating events.
- **A second entity, or a second behaviour for the Surveyor.** One threat with one
  behavioural language stops being frightening once learned. If you add one, it
  needs a recognisable language of its own, used sparingly.
- **The QA camera has no vertical clearance test.** `lookOpen()` rejects a position
  with no horizontal sightline and searches outward, but does not test headroom, so
  a capture aimed at a mezzanine can land the eye inside a soffit. A capture-tool
  limitation, not a game defect, but it corrupts evidence.

---

## 5. How to work

**Delegate bounded tasks to parallel subagents** where it is safe: environment art;
gameplay and entity behaviour; Blender (one agent, queued); sound design; rendering
QA and performance; independent judging. Give each concrete deliverables. Integrate
and review their work rather than accepting it. Never let two agents edit the same
file or the same Blender session.

**Review continuously in the browser.** Capture contact sheets across normal
exploration, bright and dark rooms, entity encounters, hiding, transitions, puzzle
interactions, death and restart, menus and the ending. Inspect for z-fighting,
shadow acne, light leaking, banding, texture stretching, flickering materials,
broken normals, seams, clipping, camera intersections, unstable temporal effects,
transparency sorting, abrupt exposure changes, repeated props, animation pops, UI
inconsistencies and unintended hard cuts. Fix and re-capture.

---

## 6. The evidence standard

**This section is not in the original brief. It is the most valuable thing this
project has learned, and it was learned six times.**

Six times in this project a verification tool was wrong **in the confident
direction** — it reported success while the thing it measured was broken:

1. `perf.mjs` compared burning fixtures (149) against a budget meant for lights
   uploaded to the shader (28), and failed meaninglessly for as long as it existed.
2. `bootcheck` measured audio spawns by watching the voice pool's length, which
   does not grow when the budget steals a voice — so it reported three working
   sounds as broken.
3. `geobudget` asserted an invented 130-mesh budget, then counted an InstancedMesh's
   triangles once instead of once per instance, reporting a zone 16 720 triangles
   lighter — which reads exactly like geometry gone missing.
4. `floorgaps` caught a build throw in the Service Spine, printed one line, and
   reported "no point of any walkable rectangle fails the stand test" having tested
   nothing in the zone the player spends the most time in.
5. A hand-written probe walked one line east from the Cistern spawn, found the gap
   on that line, and passed — while 2 612 frames of the real playthrough stood on
   nothing, because the remaining hole was not on that line.
6. Sixty capture screenshots, four numeric audits and two continuous sessions all
   passed while **no interactable in the game had ever been pressed**.

The pattern is always the same: the tool measured something adjacent to the claim
rather than the claim itself. So:

- **Every claim you make must be backed by a measurement that would fail if the
  claim were false.** Before trusting a green result, ask what it would look like if
  the thing were broken, and confirm the tool can tell the difference.
- **A skipped case is not a passing case.** If a tool cannot build a zone, cannot
  reach a state, or silently caps its coverage, it must fail loudly and say what it
  did not test.
- **Screenshots have never found a high-value defect in this project.** Every one
  came from a browser-free numeric measurement or from actually playing. Capture
  sheets are for artefacts and composition; they are not a substitute for playing
  the game.
- **When you fix something, re-measure the same number the same way.** "It looks
  better" has been wrong here more often than it has been right.
- **Record wrong hypotheses.** This report contains four wrong diagnoses of the dark
  zones and they are more useful than the right one, because each explains a thing
  that is not the cause.

---

## 7. Definition of done

- The Stack reads as a shaft in a well-exposed capture, with the crushed-pixel
  ratio measured and improved without raising fill.
- The Cistern measures below 0.80 crushed with 0 % of walkable area beyond 5 m
  from a lamp.
- The audio has been rendered to .wav, listened to, judged, fixed where wrong, and
  the files delivered as artefacts.
- An exploration bot that is not following a script has completed the game, and its
  navigation metrics are reported.
- Three independent judge rounds have run — or fewer, with the reason stated — with
  ordinary gameplay frames including the weakest zones.
- First-person hands read as well as the rest of the frame.
- The Cistern and Ductwork are dressed to the standard of the other zones.
- Artefact review sheets show no major recurring rendering defects.
- Every budget in `npm run perf` still passes, and `npm run audit` is green.
- An honest completion report exists containing what was completed, performance
  measurements, remaining limitations, judge feedback and how it was addressed, and
  paths to representative screenshots, contact sheets, audio renders and the build.

Work autonomously and make strong artistic decisions. Prioritise the frightening,
polished player experience over feature count. **And when you report, report what
you measured, not what you hoped.**
