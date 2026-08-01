# THE ANNEX — independent judgement, round 1

**Judge:** independent assessor, acting under `docs/NEXT_ITERATION_PROMPT.md` §1.5.
**Date:** 1 August 2026.
**Mandate:** assess only. Nothing in the project was modified. This file is the only
file created.
**Constraints honoured:** no `npm run build`, no browser harness started. Every number
below comes from the committed source, the committed/uncommitted artefacts, or from my
own arithmetic over the raw JSON and WAV files in `docs/`.

**State judged.** The working tree is *moving underneath this assessment*. At the start
of this pass `git status` listed 15 modified files; by the end it listed 16, plus new
untracked `src/player/Decoy.js`, `tools/qa/explore.mjs`, `docs/verification/decoy1/` and
`docs/PLAYTEST_2026-07-31.md` itself. **This judgement is pinned to the working tree as
of 1 Aug 2026 ~12:15**, base commit `c99a730`. Anything added after that is unjudged.

---

## 0. Headline

**Weighted score: 36 / 100.**

The Annex is an unusually *well-argued* project. The source comments are the best I have
read in a generated codebase: they state the hypothesis, the measurement, and the wrong
answers that preceded the right one. Three of its systems — the flashlight/noise/freeze
triangle, the breaker board's 4-of-8 rating constraint, and the refusal layer that makes a
locked door rattle and *make noise* — are real game design, not decoration.

It is not yet a game that plays. The single antagonist cannot catch a player who is
walking, has no vision, and — this is my headline finding — **can kill exactly once per
page load, after which it becomes a permanently stuck, wall-clipping, harmless follower**.
The Director provably cannot select the two beats that escalate. Three of eight zones are
94–95 % pure black at the shipping low tier. No continuous session has ever walked
through a gated door, completed more than one of seven objectives, or been played by
anything that could get lost.

The project's own two evaluation documents are honest and mostly hold up under audit —
I could verify the great majority of `PLAYTEST_2026-07-31.md`'s numbers directly against
the raw JSON, and I say so file-by-file in §5. But its instruments are still measuring
things adjacent to the claim, in the same confident direction §6 of the brief warns about,
and I found four fresh instances.

---

## 1. Rubric, weights, and scores

| # | Dimension | Weight | Score /10 | Weighted |
|---|---|---:|---:|---:|
| 1 | Core loop / moment-to-moment gameplay | 15 | 4 | 60 |
| 2 | Encounter design and player counterplay | 15 | 3 | 45 |
| 3 | Pacing and tension curve | 12 | 4 | 48 |
| 4 | Navigation, legibility, wayfinding | 10 | 2 | 20 |
| 5 | Environmental storytelling and world coherence | 8 | 6 | 48 |
| 6 | Visual quality and art direction | 15 | 4 | 60 |
| 7 | Audio | 10 | 3 | 30 |
| 8 | Technical performance | 8 | 4 | 32 |
| 9 | Onboarding | 4 | 2 | 8 |
| 10 | Content volume and replay value | 3 | 4 | 12 |
| | **Total** | **100** | | **363 → 36.3** |

Weights reflect what a first-person horror game lives or dies on. Visual quality and the
two gameplay dimensions carry 45 points between them because a liminal-horror game is a
loop plus a look. Onboarding and content volume are light because a 40-minute single-route
game is not judged on breadth.

---

### 1.1 Core loop / moment-to-moment gameplay — **4/10** (weight 15)

**What the player actually does.** Eleven bound verbs
(`src/core/Input.js:8-37`): move, look, sprint, crouch, lean L/R, interact, toggle lamp,
cover lens, swap cell, throw decoy. Crawl is not bound — it is forced by headroom
(`src/player/Player.js:174`). Of the eleven, **two are dead and two are cosmetic**:

- `drop: ['KeyG']` is declared at `Input.js:22`. `Inventory.dropCarried()`
  (`src/player/Inventory.js:197`) has **zero call sites** anywhere in `src/` — I grepped.
  The pause screen advertises it anyway (`src/ui/Pause.js:23`, `['G', 'Set down carried
  item']`). You cannot put down a fuse core.
- `peek: ['KeyV']` (`Input.js:36`) — `hidingPlace.api.setPeek()` has no external caller.
- Lean rolls the camera −0.185 rad and offsets the eye 0.42 m (`Player.js:322-336`) and is
  read by nothing in the entity or the audio: it changes what you can *interact* with and
  nothing else.

**Interaction density.** 10 interactable factories (`src/systems/Interactables.js:2084`),
but the authored instance counts are lopsided: **56 pickups** (32 of them notes), 6
lockers, 2 valves, 2 card readers, and exactly **one each** of breaker board, keypad,
terminal, generator and lift. Of roughly twelve real interaction sites, **two are puzzles**:

- The terminal's `2130` cross-reference — the date is on a poster in the Residence, the
  method is on a notebook page in the Safe Room, and neither is on the screen. Diegetic,
  awkward, good. It is also **optional**; it only sets `_discover('sealed')`.
- The breaker board's `maxOn: 4` over 8 ways (`Interactables.js:326-336`): turning on a
  fifth way trips the *oldest* live one. This is the only mechanic in the game where two
  systems compose, because the Surveyor's speed is a function of ambient light — so
  lighting a route is also arming your pursuer. This is genuinely good design.

Everything else is find-the-thing-press-E, or a **procedure** rather than a puzzle: the
penstock valve is 5 turns × 1.35 s = **6.75 seconds of held E** with no information
content (`Interactables.js:502,517`); the generator start is fuel → **12 primer pumps**
→ a 4.0 s starter hold (`Interactables.js:1517,1541`), with the instructions placed in
plain sight next to it.

**The one real economy** is the battery cell, now double-purposed as torch fuel and decoy
ammunition. It is undermined by its own premise: `Decoy.js:38` justifies the cost with
"the game already reports the battery in the HUD"; `src/ui/Vitals.js:3-5` states, in as
many words, *"There is no stamina bar and no battery meter anywhere in the Annex."*

**Empirically, the loop barely runs.** Across the three delivered continuous sessions
(`docs/verification/{base,after3,ent2}/playthrough.json`), `interact:use` fires **9, 8 and
4 times** in 510 s, 553 s and 629 s. In `ent2` — the current state — there were **more
refusals (8) than uses (4)**. All three sessions end with
`progression: {objective: 'core_cistern', completed: 1, cores: {found: 0, fitted: 0},
ended: null}`. **One of seven objectives has ever been completed in a continuous session,
and no fuse core has ever been picked up.**

**Credit where due:** the refusal layer. `Interactor.js:95-124` gives distinct copy for
welded / chained / jammed / locked, and a refused door *physically rattles and emits a
noise event* (`vel += 2.2; makeNoise(chained ? 9 : 6)`). A refusal that costs you
something is a design decision most games do not make.

---

### 1.2 Encounter design and player counterplay — **3/10** (weight 15)

**How many meaningful choices does the player have under pressure?** Concretely, and
generously counted: **four.** Slow down (crouch), break line-of-sound, kill the light
(toggle / cover / trip a breaker), throw a cell. That is it. Everything else on the verb
list does nothing to the Surveyor.

The underlying model is well specified. The entity is blind — there is no FOV cone, no
`segmentBlocked` visibility test anywhere in `src/entities/Surveyor.js`. It hears:
`audible = radius * 1.9 + 3` (`Surveyor.js:557`), against player noise radii of 2.2
crouched / 6 walking / 11 sprinting (`Player.js:307`) — so 7.2 m, 14.4 m, 23.9 m of reach.
Standing still emits nothing at all (`Player.js:305`, gated on `speedNow > 0.35`). And it
freezes absolutely in darkness: `_moveToward` returns early at `lightScale <= 0.02`
(`Surveyor.js:682`), gait phase included, and `_sampleLight` sums your own torch into its
light budget (`Surveyor.js:611-613`). **Pointing your torch at it inside 1.15 m is what
enables your own capture.** That is the best single interaction in the codebase.

Now the problems.

**(a) The chase is not losable.** `baseSpeed = lerp(0.82, 1.24, aggression)`
(`Surveyor.js:758`), and `aggression` is written in exactly one place —
`Director.respawn():487` — which never executes (see (c)). So base speed is permanently
**0.82 m/s**, ×1.12 in APPROACHING = **0.918 m/s**. Player walk is **2.15 m/s**
(`Player.js:185`), sprint 3.62. A player *walking in a straight line* outpaces the
antagonist by **2.34×**, and it turns at a hard-capped 0.85 rad/s (`Surveyor.js:695`). The
only configurations that lose are crouching, or wading in deep water, or carrying a fuse
core (×0.62) — i.e. the Cistern with a core. Capture requires closing to 1.15 m, which can
only happen to a player who has stopped.

**(b) There is no hiding.** The game ships six lockers. `hide:enter` is consumed by
`audio/index.js` and by `Director.js:224`, where it sets `this.hidden` — which feeds a
**+0.30 fear penalty** (`Director.js:321`) and 30 s of grace. `Surveyor.js` never
references hiding, lockers, or `hidden` in any form. **Getting in a locker makes you more
afraid and does not make you harder to detect.**

**(c) The fail state disappears after the first death.** See §4, finding F1. This is the
most serious defect I found and I have both the code and the telemetry for it.

**(d) One threat, one behavioural language**, which `NEXT_ITERATION` §4 already names. It
is worse than the brief implies, because the Director can never fire `rouse` (§4, F2), so
the only encounters that ever happen are the scripted first placement plus whatever
proximity the follow-on-zone-change produces.

**Evidence that the encounter is thin in practice:** across all three sessions the player
`hidden` for exactly **13 samples**, crouched for 92/83/87, and crawled for 43/34/38 — the
harness script, unchanged. In `ent2` the entity was within 15 m for 41 % of the session
(a genuine and large improvement over `base`'s 6.8 %), but the transitions
`SEEKING → APPROACHING` at t=316.98 and t=408.83 each took **10–20 milliseconds** — the
SEEKING stage that is supposed to be the telegraph has no minimum dwell and can be skipped
in a single frame.

---

### 1.3 Pacing and tension curve — **4/10** (weight 12)

Measured from the telemetry, not the prose. All figures are mine, recomputed from
`playthrough.json`.

| metric | `base` (before) | `after3` (Director fix) | `ent2` (current) |
|---|---:|---:|---:|
| sim seconds | 510 | 553 | 629 |
| Director beats fired | 1 | 5 | 4 |
| distinct beat types | 1 | 4 | 3 |
| `fear` median | 0.024 | 0.019 | **0.137** |
| `fear` p90 | 0.269 | 0.306 | **0.473** |
| fraction `fear > 0.3` | 1.6 % | 15.0 % | **30.4 %** |
| zero-threat fraction | 64.0 % | 72.9 % | **28.3 %** |
| entity DORMANT (samples) | 80.1 % | 87.7 % | **43.4 %** |
| entity beyond 100 m | 39.4 % | 44.3 % | **0.0 %** |
| entity within 15 m | 6.8 % | 2.7 % | **41.2 %** |
| longest silence (tool rule) | 49.9 s | 54.0 s | 59.6 s |

**The Director/entity overhaul is real and it is the strongest work in the project.** I
independently reproduced every one of those numbers from the raw samples. Going from an
antagonist stranded 870 m away in an empty building 39 % of the time to one that is inside
15 m for 41 % of the session is a large, honestly-measured improvement.

**But the tension curve is still not a curve.** Four beats in 10 minutes 29 seconds is one
perceivable authored event every 157 s. In `ent2` the beats were `distant_door`,
`circuit_trip`, `services`, `services` — **`services` twice, and only three distinct types
in the whole session.** `rouse` — the beat that wakes the antagonist — has fired **zero
times in any recorded session**, and §4/F2 shows why it structurally cannot on the normal
path.

**The escalation runs backwards.** `intensity` climbs with the clock and with completed
objectives (`Director.js:618-620`), and its only effect on scheduling is
`nextBeatAt = lerp(92, 55, intensity) × rng(0.86, 1.20)` (`Director.js:373`). A shorter
gap means a lower `sinceBeat` at the moment of firing, and `dread` is
`clamp01((sinceBeat − 25) / 155) × 0.42` (`Director.js:629`). So **raising intensity
lowers the maximum achievable dread**, which is what gates the escalating beats. Worked
through in §4/F2: the eligible pool *shrinks* as the session escalates.

**Positive note against the project's own report.** `PLAYTEST` §13 lists "longest true
silence 49.9 → 59.6 s" as a regression. It is not. 233 of the 375 events in `ent2`'s
"notable" stream (62 %) are `entity:heard` — the Surveyor's *internal* hearing evaluation,
which the player never perceives, and which only exists when the entity is near, i.e.
precisely what the fix changed. Excluding it, `base` rises from 49.9 s to **78.4 s** while
`ent2` is unchanged at 59.6 s. The change is an improvement, and the project's own table
reports it in the wrong direction. (The metric is still contaminated — see §4/F4.)

---

### 1.4 Navigation, legibility, wayfinding — **2/10** (weight 10)

This is the least-evidenced dimension in the entire project, and it is the one
`NEXT_ITERATION` §3.2 correctly identifies as *"most of what this game is"*.

**Nothing has measured it.** There is no time-to-first-objective, no revisit rate, no
stall analysis, no cue-gap measurement — the four things §3.2 asks for by name. An
untracked `tools/qa/explore.mjs` appeared in the working tree during this pass; it has
produced no artefact in `docs/`.

**The scripted bot cannot get lost, and it does not navigate.** Of the 4–7 `world:teleport`
events per session, only 2–3 carry `kind: 'door'`, and all of those are Intake↔Service.
**The Cistern, the Plant and the Safe Room are entered by harness teleport in every
session.** No gated portal has ever been traversed in a continuous run. The one time a
gate was met — `portal:locked {zone: 'residence'}` at t=439.3 in `ent2` — the bot stopped
and the session moved on by teleport.

**Three of eight zones have never appeared in a continuous session at all.** `zonesVisited`
across all three runs covers `intake, service, cistern, plant, safe`. The Stack, the
Residence and the Ductwork have zero telemetry.

**The in-game wayfinding affordances are minimal by design and thin in practice.** The
objective banner is one line and **auto-hides after 6.0 s** (`src/ui/Objective.js:14,49`),
recallable on `O`. There is no map. There is no compass. Objectives are written as
descriptions rather than instructions, which is a defensible art choice, but it is the
whole of the wayfinding budget.

**And there is a live softlock risk in the portal graph** — §4/F5.

---

### 1.5 Environmental storytelling and world coherence — **6/10** (weight 8)

The strongest non-visual dimension. The Annex has an authored mythology with real
internal machinery: 32 notes, a "your card was issued in March" thread that runs through
three notes and two objective descriptions, `Kearns' notebook` stating the entity's rules
in-fiction, and a terminal cross-reference whose answer lives in a different building.
The material palette and architectural language are consistent and original — this is not
a Backrooms clone, and constraint §1.1 is comfortably met.

Deductions, all verified:

- **Payoff content that can never be reached.** `card_contractor` and `keys_ring`
  (`Inventory.js:41,53`) have no spawn site in any zone. `cardReader.refusal`
  (`Interactables.js:911-913`) contains `if (inventory?.has('card_contractor')) return
  'Reader rejects it. Your card was issued in March.'` — the payoff line for the thread —
  and it is dead. `note_induction` tells the player they were issued "one set of keys";
  they were not.
- **`ENDINGS.DESCENDED` is unreachable.** `Progression.js:306` fires it when the lift
  reaches the exit floor with `!setRunning`. `lift_2` is authored `powered: false`
  (`PlantZone.js:453`), and the only `setPower(true)` in the codebase is
  `Progression.js:294`, inside the `gen:running` handler. You cannot board without the
  set running. One of three declared endings cannot occur.
- **The pry bar opens nothing.** `ServiceZone.js:841` says two doors are jammed and it is
  the only thing that opens them. `jammed` appears in zero zone descriptors.
- **The room that explains the antagonist is optional and gated.** `nb_1` (the rules) is in
  the Ductwork, an optional crawl; `nb_2` (cover the lens) is in the Residence, behind the
  `card_warden` gate; `nb_3` is in the Stack.

---

### 1.6 Visual quality and art direction — **4/10** (weight 15)

I read the frames as well as the metrics.

**What genuinely works.** `tour3/intake_h0.png` is a good frame: a one-point corridor with
a receding tiled ceiling grid, a dado line, a warm sodium palette and legible depth.
`tour3/service_h0.png` reads as a services spine — cold green blockwork, a battened strip
line, a counter and a grating giving the frame a foreground. `tour3/residence_h0.png` —
warm panelled corridor with a receding line of pendants — is the best-composed frame in
the set. Constraint §1.2 (no hiding problems behind grain/fog/aberration) is respected;
there is no crutch post-processing here.

**The Stack fix is real.** I checked the provenance rather than the prose:
`tools/qa/shots.stackab.json` shows the four frames differ in exactly two variables, yaw
(0 / 1.57 rad) and `aim`, so `a_DOWN` vs `a_ACROSS` and `b_DOWN` vs `b_ACROSS` are properly
controlled pairs. `crushed` goes 0.772 → 0.529 and 0.596 → **0.135**, and the aim change is
committed in the working tree (`StackZone.js:612-616`, `ZoneKit.js:670-672`), not merely
injected by the capture script. `stack_b_ACROSS.png` does show a shaft wall opposite with
blockwork and window openings. **§2.1's stated bar is met.** Credit.

**What does not work.**

- **Three of eight zones are 94–95 % pure black at the shipping low tier**, with the eye
  adaptation pinned against *both* clamps (`adapted` 0.004, `autoGain` 1.55). The Cistern
  measures 0.947/0.943/0.943 crushed; the Ductwork 0.953; the Stack's one valid tour frame
  0.951. I looked at `tour3/stack_h2.png` and `tour3/cistern_h1.png`: they are black
  rectangles with a hand in the corner and, in the Cistern, a thumbnail-sized sliver of lit
  geometry. §2.2's bar (Cistern below 0.80 crushed) is **not** met.
- **The objective frame metrics are anti-correlated with image quality on this evidence
  set.** The best-scoring frame in the entire tour — `plant_h1.png`, `dynamicRange` 0.791,
  `crushed` 0.003, `emptiness` 0.085, the only unflagged Plant frame — **is a camera
  pressed flat against a blockwork wall.** Nothing else is in it. The metrics reward local
  texture and mid-tone coverage, which a wall provides perfectly. Any "done when crushed <
  X" criterion in this project is gameable by standing closer to something lit.
- **Visible speckle/dither artefacting on bright surfaces.** In `stack_b_ACROSS.png` the
  large white panel at frame-left is covered in coarse orange-black speckle across its top
  and left edges. `service_h0.png` and `stack_h1.png` are both flagged `ALIASING`
  (`highFreq` 0.122 and 0.127 against a set median of 0.043).
- **The evidence resolution is 496 × 279.** That is 0.14 megapixels. Art-direction defects
  at 1080p — normal-map seams, texture stretching, shadow acne, transparency sorting — are
  not resolvable at this size, and the brief's §5 asks for exactly that inspection.
- **Seven of 24 tour frames are invalid**, including all three Residence frames — so **no
  valid player's-eye frame of the Residence exists in this evidence set at all**, and the
  best-looking frame in the tour is one I am not allowed to count.

---

### 1.7 Audio — **3/10** (weight 10)

The brief told me to score the evidence and to say the evidence is absent. **It is not
absent, and that is worth correcting:** `docs/verification/audio/` contains **117 rendered
`.wav` files** — 8 walking zone beds, 8 still zone beds, 2 scenes, and ~99 dry one-shots —
with a 70-line README stating what to listen for in each. That is a substantially better
artefact than §3.1 of the brief credits.

**What is absent is any record of a human or an agent having listened and formed a
judgement.** No listening notes exist. The only claim in the repository is the commit
subject `f980964` — *"Audio has now been rendered and measured; the mix has no dynamics at
all"* — followed by two commits that changed the bus/send topology.

**So I measured the delivered files myself.** Short-term loudness in 300 ms windows,
mono-summed, p95 − p10 as a dynamic-range proxy:

| file | peak dBFS | RMS dBFS | crest dB | short-term range dB |
|---|---:|---:|---:|---:|
| `scenes/surveyor.wav` (75 s, an entity encounter) | −2.9 | −11.5 | 8.6 | **2.9** |
| `scenes/breaker.wav` (60 s, a breaker throw) | −3.2 | −11.8 | 8.6 | **4.0** |
| `beds/plant.wav` | −2.7 | −12.8 | 10.1 | **2.6** |
| `beds/cistern.wav` | −3.3 | −16.0 | 12.6 | 3.1 |
| `beds/service.wav` | −3.0 | −11.6 | 8.6 | 3.4 |
| `beds/intake.wav` | −3.2 | −12.5 | 9.4 | 5.1 |
| `beds/residence.wav` | −7.5 | −26.1 | 18.6 | 9.7 |
| `beds/duct.wav` | −4.0 | −21.6 | 17.6 | 8.8 |

**The two commits after `f980964` did not fix it.** A 75-second entity encounter that
moves **2.9 dB** is a wall of texture, exactly as the commit message said. A breaker
throw — an impulsive event — moves 4.0 dB. The five loudest zones are the five flattest.

**The structural cause is visible in the same table.** These beds sit at −11.6 to
−12.8 dBFS RMS and peak at −2.7 to −3.3 dBFS. An *ambience bed* is occupying the whole
delivery headroom. A jump scare, an entity roar, or a footstep in the Plant has roughly
3 dB of room above the bed before the limiter takes it. A film-style horror bed lives
20–30 dB lower, precisely so that something can be loud.

The one-shot inventory, the 75-sound coverage, the occlusion model and the per-fixture
spatialised hum are all genuinely ambitious. The mix is not mixed.

---

### 1.8 Technical performance — **4/10** (weight 8)

One real GPU measurement exists and it is honest work
(`docs/EVALUATION_2026-07-31.md` §2): Apple M4 through ANGLE/Metal, 1280×720 CSS at a
1.5× pixel-ratio cap = 1920×1080 actual, with a `readPixels` fence each frame.

Pre-fix, **no zone reached 60 fps at the shipping high tier**; the Plant ran at 14.5. After
lowering `aoScale` 1.0 → 0.5 and `msaa` 4 → 2, medians are **43.7 / 40.2 / 42.2 fps** for
Intake / Service / Plant, with the Plant's worst heading at **18.9 fps**. Medium tier
measures 46–81 fps.

Assessment: the diagnosis (per-fragment light loop plus a fixed post-chain cost, not
geometry) is correct and well isolated by the interleaved A/B. Fixing `preserveDrawingBuffer`
and making the quality ladder two-way are both right.

Deductions: **the brief's target is a stable 60 and it is not met at the shipping high
tier on a fast machine.** This is one GPU, one API, one resolution — an Apple M4 is a good
integrated GPU and tells you nothing about a discrete mid-range part or an Intel iGPU, and
nothing about the 90th-percentile browser. Everything else in the project — every
`perf.json`, every `playthrough` frame time — is SwiftShader. The three delivered sessions
report engine fps of **1.45 / 14.8 / 24.8**, which is a rasteriser number and not a verdict.
Both standing assertion failures in every session (`no console errors`, `no frame > 5 s`
with a 34–49 second first frame) are environmental but have been red for the life of the
tool, which erodes the signal value of the suite.

---

### 1.9 Onboarding — **2/10** (weight 4)

There is no tutorial, no contextual hint system, and no first-run flow — I searched
`src/` for `tutorial`, `onboard`, `firstRun`, `teach` and `intro`; only the intro
cinematic exists, and it is a 23.5 s camera dolly out of a lift that teaches nothing
mechanical.

**The only place the controls are enumerated is the pause screen** (`src/ui/Pause.js:15-26`),
which the player must press Esc to find, and which is **hidden entirely below 1100 px
viewport width** (`Pause.js:132-135`). Its ten rows are:

```
W A S D · Shift · Ctrl/C · Q·R · E · F · Tab/J · O · G · Esc
```

It **omits `V` (cover lens), `B` (swap cell) and `T` (throw decoy)** — every verb that
matters against the antagonist — and it **advertises `G`, which does nothing** (§1.1).
`src/core/Input.js:24-26` describes the cover key as *"the single most important key in
the game after WASD"*. It is not on the control list, and the note that explains it
(`nb_2`) is in the Residence, behind a keycard gate.

A player taking the minimum route can finish the game having been told the entity's rules
at most once, and will never learn that `V` exists.

`Surveyor.js:22-24` asserts that the frozen-in-light pose is *"how the player learns the
rule without being told it."* The pose is implemented. **The staging is not** — there is no
scripted first encounter that puts a frozen Surveyor in a lit doorway for the player to
observe. `Director._ensureSpawned` drops it 26 m away at t=22 s and leaves the rest to
chance.

---

### 1.10 Content volume and replay value — **4/10** (weight 3)

Volume is respectable for the scope: 8 zones, 599 meshes, 1.78 M triangles, 481 fixtures,
56 authored pickups, 32 notes, 7 objectives, 5 optional discoveries.

Replay is close to nil, and the branching is illusory. `Progression` reveals `core_cistern`,
`core_residence` and `core_stack` together, which reads as a diamond. But **four cores exist
and three are needed**, the Plant-floor core is free, the Cistern is ungated, and the
Residence route requires `card_warden` — **which is authored in the Stack**
(`StackZone.js:770`). So the Stack must be opened regardless and the Residence is entirely
optional content. Real branching: **zero**. It is a linear chain wearing a diamond.

Add: one antagonist with one behavioural language; one of three endings unreachable
(§1.5); no layout randomisation; no new-game-plus.

---

## 2. Overall score

**36 / 100**, weights as stated in §1.

For calibration: I would put a polished, shippable indie horror short at 65–75, and a AAA
title at 85+. 36 is "an ambitious and well-reasoned technical foundation with a genuinely
original art identity, whose core gameplay loop has not yet been closed and whose
antagonist is broken in a way that removes the fail state."

---

## 3. The gap to AAA, ranked by impact ÷ effort

| rank | gap | what AAA does | cheapest intervention here | impact | effort |
|---|---|---|---|---|---|
| 1 | **The fail state evaporates after one death** | Amnesia, Alien: Isolation, Outlast: death is repeatable, costed, and resets the threat cleanly | Reset `_killed = false; captureT = 0` in `_setState` when leaving CAPTURING, and add an unconditional `despawn()`/re-place on `game:death` that does not depend on `autoRespawn`. ~10 lines. | **Enormous** | **Trivial** |
| 2 | **The player is never taught the rules** | Alien: Isolation stages its first Xenomorph encounter behind glass; Amnesia's first door teaches the lantern | Author *one* scripted beat: a Surveyor standing frozen in a lit doorway 12 m away, that starts moving the moment the player's torch leaves it. Plus add `V`/`B`/`T` to `Pause.js:15-26` and delete `G`. | Very high | Low |
| 3 | **The chase is unlosable** | Alien: Isolation's alien is faster than you and you must break line of sight; Outlast makes you hide | Raise `baseSpeed` to ~2.4 m/s during APPROACHING only, so the player must *do something* rather than hold W. Then make lockers actually work: have `Surveyor.hear()` multiply strength by ~0.15 when `player.hidden`. | Very high | Low |
| 4 | **The Director cannot escalate** | AAA directors (L4D, Alien) ratchet a global pressure value that *widens* the action set over time | Decouple the eligibility gate from the beat gap: gate on `intensity` directly, or raise `dread`'s divisor so `sinceBeat = nextBeatAt` reaches 0.42. Fix `sinceBeat -= 5` to run once (§4/F3). | High | Trivial |
| 5 | **Three zones are unreadable without the torch** | AAA lights for legibility first and mood second: a dark room still has a silhouette, a rim, a bounce | Apply the Stack's own lesson to the Cistern and Ductwork: aim the fittings at a *surface*, and give the Ductwork a bounce fill above 0.011 (every other zone is 0.21–0.56). | High | Medium |
| 6 | **The mix has ~3 dB of dynamic range** | AAA ducks the bed 12–20 dB under a scare and rides a sidechain off the threat state | Pull the ambience beds down 15 dB at the bus, then re-render `scenes/surveyor.wav` and check the short-term range exceeds 12 dB. The measurement in §1.7 is the acceptance test. | High | Low |
| 7 | **No wayfinding measurement exists** | AAA runs hundreds of naive-player sessions and heatmaps the stalls | Finish `tools/qa/explore.mjs` and instrument the four metrics §3.2 names. Even one non-scripted completion would be new information. | High | High |
| 8 | **The world's verbs are thin under pressure** | AAA gives 6–10 pressure verbs: barricade, throw, sprint-vault, close a door behind you, kill a light | The doors already have velocity and noise (`Interactor.js:118`). Let the player *pull a door shut behind them* and have it block the entity's path. One verb, enormous payoff. | High | Medium |
| 9 | **Frame rate misses 60** | AAA ships a 60 fps mode | Already diagnosed correctly as the per-fragment light loop. Cluster or tile the lights, or cap simultaneous lights to 8 with importance ranking (some already exists). | Medium | High |
| 10 | **First-person hands and entity animation** | Mocap, IK, layered additive breathing | Named in §2.4/§4 already. Blender work; no cheap version. | Medium | High |

---

## 4. Five original defects

These are mine. None appears in `docs/PLAYTEST_2026-07-31.md` or
`docs/NEXT_ITERATION_PROMPT.md`. Each is verified in code *and*, where possible, in
telemetry.

---

### F1 — The Surveyor can kill exactly once per page load, then becomes a permanently stuck, wall-clipping, harmless follower

**Severity: critical.** This removes the game's only fail state after the first death.

**Code.** `src/entities/Surveyor.js:416` initialises `this.captureT = 0`. Line 874
increments it. Line 886-887:

```js
if (this.captureT > 1.35 && !this._killed) {
  this._killed = true;
  this.bus?.emit('game:death', { cause: 'surveyor', position: this.position.clone() });
}
```

`_killed` and `captureT` are **never reset anywhere in `src/`** — I grepped for both.
CAPTURING (`Surveyor.js:871-891`) has **no exit transition**; `hear()` returns 0 in
CAPTURING (`:555`); `rouse()` only accepts DORMANT/RETREATING (`:537`). The single exit is
`despawn()` (`:522-527`), whose **only caller in the entire codebase** is
`src/systems/Director.js:480`, inside `Director.respawn()`. And `Director.respawn()` is
called only from `Director.js:600`, guarded by `if (this.autoRespawn)` — while
`src/Game.js:358` sets `this.director.autoRespawn = !this.ui`. **With a UI present — i.e.
the actual game — `Director.respawn()` never runs.**

Also note lines 882-883: while `playerDist > 0.85` the entity translates 0.55 m/s with
**no `resolveCapsule` call** — the only movement path in the file that bypasses collision.
So the stuck entity walks through walls.

**Telemetry — this is not theoretical.** `docs/verification/ent2/playthrough.json`, the
session presented as the current state:

- t=321.97 `APPROACHING → CAPTURING`; t=323.33 `CAPTURING → DORMANT`; `game:death` at
  323.32. First capture: correct, 1.36 s.
- t=410.85 `APPROACHING → CAPTURING`. **The entity then stays in CAPTURING for 41.67
  seconds**, `speed` pinned at 0.2, `confidence` 0, `dist` oscillating between 0.84 m and
  10.11 m while the player walks around at 2.0 m/s and executes three QA phases. **No
  `game:death` fires.** It only exits at t=452.50 because the harness *teleported the
  player to another zone*, which triggers `placeSurveyorNear → spawnAt → _setState(DORMANT)`.

**Consequence in the shipped game:** after the first death, the antagonist follows the
player at 0.55 m/s through geometry, forever, unable to kill, until the player happens to
change zone. The horror game stops having a horror.

**Corollary — `PLAYTEST` §13 is wrong on one line.** It says the five `ent2` episodes were
*"Two deaths, three escapes."* The raw event log contains exactly **one** `game:death`.
The second "capture" is this bug.

**Why no tool caught it:** `src/systems/qa/surveyor_sim.mjs` constructs a fresh entity per
test, so a state that only manifests on the *second* capture is structurally invisible to
it. And `playthrough.mjs` has no assertion that CAPTURING resolves.

**Bonus, same file:** `surveyor_sim.mjs:249` reads
`ok('does not tunnel through the divider', Math.abs(s.position.z) > 0.15 || true);` —
the one assertion that would catch collision tunnelling is **unconditionally green**. That
is a seventh instance of the pattern §6 of the brief documents six times.

---

### F2 — The Director's escalation is inverted: raising `intensity` makes `rouse` and `lamp_stutter` *less* reachable, so the Director can never wake its own antagonist

**Severity: high.** This is why `rouse` has fired zero times in every recorded session.

`_eligible()` gates on `pressure = Math.max(fear, dread)` (`Director.js:343`). Beat
minimums: `circuit_trip` 0.15, `rouse` 0.25, `lamp_stutter` 0.30 (`Director.js:33-44`).

`dread` (`Director.js:629`): `clamp01((sinceBeat − 25) / 155) × 0.42`.
Beat gap (`Director.js:373`): `nextBeatAt = lerp(92, 55, intensity) × rng(0.86, 1.20)`.

Gate 3 (`Director.js:649`) fires as soon as `sinceBeat ≥ nextBeatAt`. So on the normal
path the **maximum `sinceBeat` at a firing opportunity** is `(92 − 37·I) × 1.20`, and the
maximum achievable dread is:

| `intensity` | max `nextBeatAt` | max `dread` at fire |
|---:|---:|---:|
| 0.15 (session start) | 103.7 s | **0.213** |
| 0.50 | 88.2 s | 0.171 |
| 0.65 (≈ t=8 min) | 81.6 s | 0.153 |
| 1.00 (≈ t=11 min) | 66.0 s | **0.111** |

**The global maximum is 0.213, on the luckiest jitter roll, at the lowest intensity** —
and `dread` is additionally exponentially damped at rate 0.55, so the realised value is
lower still. `rouse` needs 0.25 and `lamp_stutter` needs 0.30: **neither is reachable
through dread, ever.** `circuit_trip` (0.15) becomes unreachable past `intensity ≈ 0.68`,
i.e. roughly 8½ minutes in.

So as the session escalates, the eligible pool **collapses** to
`{distant_door, attendant, services}` — the three beats that cost < 0.11 and change
nothing — unless real perceived fear happens to be high. **The game gets structurally
quieter the longer you play.**

The load-bearing comment at `Director.js:623-626` says dread *"rises toward 0.42 over about
three minutes of silence, which is enough to unlock every beat in the table including
`rouse` at 0.25."* `dread = 0.42` requires `sinceBeat ≥ 180 s`, which gate 3 makes
impossible. The 0.42 ceiling is dead headroom.

**Empirical confirmation:** `rouse` appears in **zero** of the 10 beats fired across all
three sessions. `lamp_stutter` fired exactly once (`after3` t=402.1) and did so on **real
fear 0.31**, not dread. The stated escalation mechanism has never operated.

**Two consequences I also verified:**
- `circuit_trip` picks a circuit and *then* checks for `emergency` (`Director.js:392-396`),
  so ~⅓ of its firings abort after already charging `tension += 0.22`, zeroing `dread`,
  resetting `sinceBeat` and starting a 100 s cooldown. Compare `Director.js:509`, where the
  respawn path filters correctly — the author knew the right shape.
- `circuit_trip` has no locality filter at all, so it can black out the Plant while the
  player is in the Intake, 400 m away. *"The most useful beat: it changes the map"* changes
  a map nobody is standing on.

---

### F3 — `sinceBeat -= 5` executes every frame, so a single ineligible instant costs a full beat gap instead of five seconds

**Severity: medium.** `src/systems/Director.js:661`, inside `update(dt)`:

```js
// That is a reason to look again in five seconds, not to sit down for
// another 70% of a full gap, which is what `* 0.7` did.
if (!options.length) { this.sinceBeat = Math.max(0, this.sinceBeat - 5); return; }
```

There is no per-second or per-invocation guard. At 60 fps this subtracts **300 s of
`sinceBeat` per second of play**. From a typical `sinceBeat ≈ 100` it reaches the
`quietFloor` of 55 in **nine frames (0.15 s)**, at which point gate 1
(`Director.js:638`) takes over and the Director stands down until `sinceBeat` climbs back
past `nextBeatAt` — **a full gap, 47–104 s.** The comment describes the exact behaviour the
line was written to eliminate; it is the same class of error as the `* 0.7` it replaced,
one order of magnitude worse.

This interacts badly with F2: because `circuit_trip`/`rouse`/`lamp_stutter` are usually
locked out and the other three are on a 100 s cooldown, `options.length === 0` is a
*common* state, not a rare one.

---

### F4 — The tour and lamp-tour capture sets are still corrupt, and the corrupt frames are the ones the project's conclusions rest on

**Severity: high — this is an evidence-integrity defect, and it is the class §6 of the brief
is about.**

`PLAYTEST` §1.3 correctly reports that 7 of 24 `tour3` frames are invalid and adds a
`valid` flag to the tour. Two things it does not say:

**(a) Two of the three "Stack" frames in `tour3` were taken in other zones entirely.**
From `docs/captures/tour3/console.log`: `stack_h0` reports `"zone":"intake"`, `stack_h1`
reports `"zone":"service"`. `stack_h1.png` is the second-largest file in the set (379 KB,
`crushed` 0.061) and looks great — because it is a picture of the Service Spine filed under
the Stack. Anyone eyeballing the contact sheet concludes the Stack is fine. Similarly, all
three Residence frames are invalid, so **no valid player's-eye frame of the Residence
exists in the delivered evidence at all** — and the Residence frame that does exist is the
best-composed image in the tour.

**(b) `docs/captures/lamptour/` has no validity guard whatsoever, and its `LAMP` records
contain no `valid` field.** It was captured at 13:38, *before* the tour's guards were
written. Reading `lamptour/console.log` against the filenames:

| file | zone actually current | fell |
|---|---|---|
| `cistern_h0_lampon.png` | **duct** | — |
| `cistern_h1_lampon.png` | **duct** | — |
| `cistern_h2_lampon.png` | cistern ✓ | — |
| `residence_h0_lampon.png` | **stack** | — |
| `residence_h1_lampon.png` | residence | **−28.04 m** |
| `stack_h0_lampon.png` | stack | **−28.04 m** |
| `duct_h1_lampon.png` | duct | **−28.04 m** |

**Six of twelve frames are unusable, and two of the three "Cistern" frames are the
Ductwork.** These are the frames `PLAYTEST` §2 cites to justify leaving §2.2 open:

> *"Re-shot with the flashlight on (`docs/captures/lamptour/`), the Cistern reads
> correctly: a pool of light on a timber walkway and a concrete wall, and nothing else.
> That is a horror game working."*

I looked at all three. The one genuinely-Cistern frame (`cistern_h2_lampon.png`) **does**
show a timber walkway and a blockwork wall in a pool of torchlight, so the claim survives —
but on one frame out of three, not on the set it points at. `cistern_h1_lampon.png`, the
largest and most persuasive-looking file in the directory, is the torch pressed into a
corner of the Ductwork, blown out.

`PLAYTEST` §6 lists `world.goto()` silently failing as *"Reproduced twice in one 24-shot
run. Not chased."* It happened **three more times in a 12-shot run**, giving a 25 % failure
rate in the lamp tour against 8 % in the main tour. It is the single largest source of
false evidence in this project and it is still not chased.

**(c) A smaller instance in the pacing tool.** The corrected `longestSilence`
(`tools/qa/playthrough.mjs:872-873`) excludes only `{player:step, player:noise, world:noise,
entity:tick}` and `qa:*`. It does **not** exclude `entity:heard`, which is the Surveyor's
internal hearing evaluation — an event the player cannot perceive, which fires every
~0.45 s during a hunt, and which accounts for **233 of the 375 "notable" events (62 %)** in
`ent2`. The metric therefore measures "how recently the entity's sensor ticked", not "how
long since anything happened". (As noted in §1.3, correcting it happens to *improve* the
project's before/after story — but the ruler is still adjacent to the claim.)

---

### F5 — `Progression.portals` is keyed by bare portal id, and three zones declare `to_plant` with conflicting lock states

**Severity: high — this is a plausible route to an unwinnable run.**

`src/systems/Progression.js:209`: `this.portals.set(portal.id, p)` — a flat `Map` keyed by
the bare id. `World.update` gates a door with `progression.isGated(p.id)`
(`src/world/World.js:403`), which reads that single entry.

Three zones declare a portal literally called `to_plant`:

- `src/world/zones/ServiceZone.js:411` — the real door, no `locked` flag ⇒ `groupFor`
  returns `'portal_plant'`, registered unlocked.
- `src/world/zones/DuctZone.js:395` — the crawl route, same.
- `src/world/zones/CisternZone.js:336-337` — **`{ locked: true }`**, an authored scenery
  hatch. `groupFor` (`src/systems/ZoneGameplay.js:63`) returns `null` for any portal with
  `locked: true`, so it registers with `group: null, locked: true` — *deliberately outside
  the group system*, so that `installDefaultGates()` cannot throw it open.

**Last registration wins.** With `maxResident = 3` and streaming rebuilds, the winner is
whichever zone was built most recently. The Cistern is ungated from the start
(`installDefaultGates`, `Progression.js:371-378`), so the perfectly ordinary route
*Intake → Service → Cistern → back → Plant* builds the Cistern after the Service Spine and
leaves `portals.get('to_plant').locked === true`. **The Service Spine's door to the Plant
then refuses, and nothing ever calls `gate('portal_plant', false)` to correct it** — the
group is `portal_plant`, and the winning entry's group is `null`.

The reverse order is also wrong in the other direction: the Cistern's bolted scenery hatch
becomes a live route into the Plant.

The same collision exists for `to_service` (six declarations), `to_stack`, `to_residence`
and `to_intake`; `to_plant` is the one where the lock states differ and the consequence is
a blocked critical path.

**Why no tool caught it:** `portalgraph` is a static check over the descriptor arrays, not
over the runtime map. And the continuous harness **teleports between zones** — of 4–7
`world:teleport` events per session only 2–3 carry `kind: 'door'`, all Intake↔Service.
**No gated portal has ever been traversed in a continuous session.** The one gate the bot
ever met (`portal:locked {id: 'to_residence'}` at `ent2` t=439.3) stopped it, and the run
continued by teleport.

---

### Also worth fixing (found, verified, not in my top five)

- **Five of nine "should succeed" scripted interactions silently produced nothing in
  `ent2`, and no assertion failed.** Comparing `qa:phase` events against `interact:use` in
  the same window: the four Service Spine breaker phases and the note pickup all fired
  correctly in `base`, and **all five produced zero `interact:use` and zero `ui:refuse` in
  `ent2`**. `INTERACT: take the nearest thing off the floor` (t=32) has produced nothing in
  **all three** sessions. The check `at least one interactable was operated` passes on a
  single locker press.
- **The hidden ending fires on one keypress.** `Interactor._fire` calls `item.onUse()`
  *before* emitting `interact:use`; the docket's `onUse` opens `note_ending_hint`, and
  `NotesLibrary.open` marks it read synchronously. By the time
  `Progression.js:326-338` checks `hasRead('note_ending_hint')` it is already true. The
  `'You have not read it properly.'` refusal can never fire.
- **Every refusal in the game renders as `Requires <sentence>`.** `src/ui/UI.js:491` passes
  the refusal reason into the prompt's `requires` field and `src/ui/Prompts.js:61` renders
  `` `Requires ${cur.requires}` ``, producing *"REQUIRES BOTH HANDS ARE FULL."*
- **The new decoy throws backwards.** `src/player/Decoy.js:103` uses
  `dx = Math.sin(yaw), dz = Math.cos(yaw)`; `Player.forward` (`Player.js:135`) and
  `Flashlight._updateAim` both use `-sin/-cos`. The cell lands up to 14 m *behind* the
  player and the `world:noise` pulls the Surveyor toward them. (Untracked file, written
  during this pass — flagged rather than counted.)
- **`Director` dead wiring:** `on('progress:safe', …)` (`:253`) has no emitter anywhere;
  `markSafe()` (`:273`) has no callers; `this.interactor` (`:69`) is assigned and never
  read. `Surveyor.hearingRange = 34` (`:402`) and `Surveyor._commit` (`:424`) are declared
  and never read.
- **`ZoneGameplay.install` swallows all four of its phases** in separate `try/catch` blocks
  (`:103-106`). A throw in `_props` leaves a zone with doors and no interactables, and the
  game continues — which the file's own header describes as having already shipped once.

---

## 5. `PLAYTEST_2026-07-31.md` — what I verified, and what I dispute

I recomputed every numeric claim I could from the raw JSON rather than reading the prose.

**Verified exactly, from `playthrough.json`:** entity DORMANT 80 % → 43 % (403/503 →
270/622); within 15 m 6.8 % → 41.2 %; beyond 25 m 72.0 % → 25.7 %; beyond 100 m 39.4 % →
0.0 %; threat episodes 2 → 5; fear median 0.024 → 0.137; fear p90 0.269 → 0.473; fear
above 0.3 1.6 % → 30.4 %; above 0.5 0.2 % → 6.8 %; peak fear 0.544 → 0.693; zero-threat
64.0 % → 28.3 %; Director beats 1 → 4 (and 1 → 5 for `after3`); controls enabled 96 % →
97 %; falls through the floor 0 → 0; median `intensity` 0.15 → 0.44.

**Verified exactly, from the frame metrics:** every crushed value in the §2 table matches
`tour3/_artifacts.json` to three decimals; the `adapted` 0.004 / `autoGain` 1.55 double-clamp
in the three dark zones is in `console.log`; the four §4 Stack A/B numbers match
`stack_ab/_artifacts.json`, and I checked `tools/qa/shots.stackab.json` to confirm the aim
really is the only variable within each yaw pair, and that the fix is committed in
`StackZone.js`/`ZoneKit.js` rather than only injected at capture time.

**Verified as a genuine bug fix:** the `longestQuiet` seeding bug is exactly as described
(`playthrough.mjs:899-916`), `base`'s stored `analysis.longestSilence` is the whole 510 s
session, and my own re-derivation under the corrected rule reproduces **49.9 s in the window
58 → 108 s**, matching §7's "0:58 → 1:48" precisely.

**Disputed or overstated:**

1. **"Two deaths, three escapes"** (§13). **False.** `ent2` contains exactly one
   `game:death` event. The second "capture" is the 41.7-second stuck-CAPTURING bug (F1).
2. **"the Cistern reads correctly [with the lamp on]… That is a horror game working"**
   (§2). **Unsupported as cited.** Two of the three frames in the directory it points at
   were taken in the Ductwork (F4). The claim happens to survive on the third frame.
3. **"longest true silence 49.9 → 59.6 s"** (§13). Arithmetically correct under the tool's
   own rule, but the rule counts 233 `entity:heard` diagnostics; corrected, the comparison
   is 78.4 → 59.6 s, i.e. **an improvement reported as a regression** (F4c).
4. **"`lamp_stutter` requires fear 0.30 and `circuit_trip` 0.15. Both fired in the new
   runs"** (§9). True only across two different sessions — `after3` fired `lamp_stutter`
   and not `circuit_trip`; `ent2` fired `circuit_trip` and not `lamp_stutter`. No single
   session has demonstrated the full beat table, and `rouse` has never fired at all (F2).
5. **"median `nextBeatAt` 220 → 92 s"** (§9). I measure 220.2 → **73.6 s**. The direction is
   right and the real figure is better than claimed; 92 is the retuned `quietCeiling`, not
   a measured median. Minor, but it is a stated measurement that is not the measurement.
6. **"§12 … the check now separates [a blackout from a defect] … and passes the intended
   blackout."** The delivered `ent2` session has this check **FAILING**
   (`min active lights = 0`), on four samples: t=156 and t=240/241 in the Intake and
   t=402.0 in the Service Spine. The `circuit_trip` beat fired at t=147.55, so t=156 is
   plausibly the intended blackout; t=240, t=241 and the zone-transition frame at t=402 are
   not explained anywhere. §12's claim is not true of the run it ships with.
7. **"The Stack — the oldest open defect, §2.1 — is fixed"** (§ summary). I accept the
   measurement and the A/B is sound. But it is measured from **two headings at one standing
   position on one level, at the low tier, on SwiftShader**, and §6 of the same document
   concedes this. The claim is stronger in the summary than in the caveats. The only
   *ordinary gameplay* frame of the Stack in the whole evidence set (`tour3/stack_h2.png`,
   the one valid one) is still 95.1 % pure black — it predates the fix, and it has not been
   re-shot.
8. **Unverifiable from the artefacts:** "blocked below the quiet floor 87 % → 56 %" (§9) —
   I could not determine the definition; the emissive-tool numbers in §1.1 and the
   pendant's "delta 2 → 80" (§3), which depend on a tool whose behaviour changed in the same
   run and which §3 itself flags; and §5's sweep table, which is a tool output I cannot
   reproduce without running the browser.

**Overall:** `PLAYTEST_2026-07-31.md` is a substantially honest document. It self-reports
eight of its own tool defects, retracts three verdicts, and its headline numbers survive
audit. Its failure mode is not fabrication — it is that the *summary* lines are more
confident than the *caveat* lines beneath them, and that the corrupt evidence it did not
find (F4) sits under two of its conclusions.

---

## 6. What I could not assess, and why

- **The audio, as sound.** I cannot listen. I measured the 117 delivered `.wav` files
  objectively (peak, RMS, crest, short-term range) and reported that, which is a statement
  about the *mix*, not about whether the fluorescent hum sounds like a fluorescent, whether
  footsteps read across four surfaces, or whether the Surveyor has mass. Those remain
  unjudged by anyone.
- **Frame rate.** I was instructed not to build or run a browser harness. Every performance
  number here is second-hand: one GPU pass on one Apple M4 (`EVALUATION` §2), and
  SwiftShader everywhere else. I have no independent verification of any of it.
- **Anything at above 496 × 279.** All player's-eye evidence is 0.14 MP. Normal-map seams,
  texture stretching, shadow acne, z-fighting, transparency sorting and temporal
  instability — the entire §5 inspection list — are not resolvable at that size. **My visual
  score is a score of composition, lighting and palette only.**
- **Three of eight zones in motion.** The Stack, Residence and Ductwork have zero
  continuous-session telemetry and (for the Residence) zero valid player's-eye frames. I
  judged them from static captures and from the zone source.
- **Six of seven objectives, and all three endings.** No session has completed more than
  `reach_plant`. I read `Progression.js` and the zone descriptors to reason about the
  critical path; I have not seen it traversed.
- **Whether the game is frightening.** Fear is a property of a session with a human in it.
  Nothing in this repository has ever had one. Every claim about tension in this document —
  mine included — is a claim about a scripted bot with a fixed 43-phase route that cannot
  get lost, and getting lost is what this game is for.
- **Anything added after 1 Aug ~12:15.** The tree changed twice during this pass
  (`src/player/Decoy.js`, `src/world/zones/IntakeZone.js`, `tools/qa/explore.mjs`,
  `docs/verification/decoy1/`). Judging a moving target is not judging; those files are
  flagged, not scored.
- **`npm run audit`.** I did not run it. The green status reported in `PLAYTEST` is taken on
  trust, with the caveat that this project's own history is eight instances of a green
  check over a broken thing, and I found a ninth (`surveyor_sim.mjs:249`).

---

## 7. If only three things are done before round 2

1. **Fix F1.** Reset `_killed` and `captureT`, give CAPTURING an exit, and make death
   repeatable independent of `autoRespawn`. Then add the assertion that would have caught
   it: *a CAPTURING state must resolve to a death or a despawn within N seconds.*
2. **Fix F2 and F3.** Gate escalation on something that does not shrink as the game
   escalates, and make `sinceBeat -= 5` happen once. Then re-run `playthrough` and report
   whether `rouse` has ever fired.
3. **Re-shoot the Stack, the Cistern, the Ductwork and the Residence as ordinary gameplay
   frames, at ≥ 1280 × 720, with the validity guard on, and chase `world.goto()`.** Until
   `world.goto()` is fixed, roughly one frame in eight of every capture set is a photograph
   of a different room, and this project makes lighting decisions from those photographs.
