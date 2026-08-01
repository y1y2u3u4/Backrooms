# THE ANNEX — independent judgement, round 2

**Judge:** independent assessor, acting under `docs/NEXT_ITERATION_PROMPT.md` §1.5.
**Date:** 1 August 2026.
**Mandate:** assess only. Nothing in the project was modified. This file is the only
file created.
**Constraints honoured:** no `npm run build`; no browser harness started. Every number
below comes from the committed/uncommitted source or from my own arithmetic over the
delivered JSON in `docs/verification/` and `docs/captures/`.

**State judged:** working tree as of 1 Aug 2026, base commit `c99a730`, with the 18
modified/untracked files listed by `git diff --stat` plus `tools/qa/explore.mjs`,
`src/player/Decoy.js` and `docs/verification/{fix1,fix2,explore,explore2,explore3}`.

---

## 0. Headline

**Weighted score: 42 / 100** (R1: 36). Delta **+5.6**, and every point of it is in two
dimensions: the fail state now works, and the Director can now escalate. Nothing moved in
visuals, audio, or the quality of the navigation — only in the *measurement* of navigation.

Four of my five R1 defects are genuinely fixed and I can confirm three of them in
telemetry rather than only in source. The fifth — the portal-id collision — has been
**re-keyed but not fixed**: the observable failure is unchanged, and the change has
converted it from a route-dependent hazard into a certainty. **The delivered current-state
session `fix2` ends with `to_plant` in its gate list, and every route into the Plant in the
whole building carries that id.** That is in §1.5 and it is the most important thing in
this report.

I also owe a correction to my own R1 §4/F1: I wrote that `Director.respawn()` "never runs"
with a UI present. It does — `Game.respawn()` → `Progression.respawn()` →
`Director.respawn()`, a path that existed before this round and that I missed. The defect
was still real and the telemetry still showed it; the causal chain I gave for its
persistence was wrong in one link.

---

## 1. Verification of the five R1 defects

### 1.1 F1 — the Surveyor could kill exactly once per page load → **FIXED**

`src/entities/Surveyor.js:749-753`, inside `_setState`:

```js
if (s === STATE.CAPTURING) { this.captureT = 0; this.captureBlend = 0; this._killed = false; }
```

and `:917`, a real exit from CAPTURING:

```js
if (this.stateTime > 6) { this.confidence = 0.35; this._setState(STATE.SEEKING); }
```

**Confirmed in telemetry, which is what matters here.** `docs/verification/explore3/` is an
unguided 540 s session containing **three** `game:death` events — at 1:26.9, 2:02.4 and
8:54.5 — each preceded by an `APPROACHING → CAPTURING` transition and followed by
`entity:state CAPTURING → DORMANT`, `game:respawn` and `death:settled`. That is exactly the
test R1 said no tool could run: a second and a third capture in one page load, each
producing a death. The event census records `game:death` 3, `game:respawn` 5,
`death:settled` 3. The 41.7-second stuck-CAPTURING episode from `ent2` does not recur.

**Not fixed, same file:** lines 901-904 still translate the body 0.55 m/s with no
`resolveCapsule` call — the only movement path in the file that bypasses collision. The
6 s timeout now bounds it, so the entity clips through up to **3.3 m** of geometry per
capture instead of indefinitely. Bounded, not removed.

**No regression test was added.** See §4/N5.

### 1.2 F2 — `dread` computed from `sinceBeat`, so `rouse` was unreachable → **FIXED, with a new ceiling I did not expect** (see §4/N2)

`src/systems/Director.js:641-646` now measures time since anything threatened the player:

```js
const threatUp = !!(s0?.active && s0.state !== SURVEYOR_STATE.DORMANT);
if (threatUp) this._sinceThreat = 0; else this._sinceThreat = (this._sinceThreat ?? 0) + dt;
const wantDread = threatUp ? 0 : clamp01((this._sinceThreat - 40) / 200) * 0.55;
```

`_sinceThreat` is no longer bounded by the Director's own schedule, so the inversion is
gone.

**Confirmed empirically, and it is the strongest single result of this round.**
`docs/verification/fix2/playthrough.md` — Director beats: `distant_door` 0:57.9,
`circuit_trip` 2:21.8, `services` 4:20.4, **`rouse` 6:49.1**. Across the ten beats in
`base`/`after3`/`ent2` combined, `rouse` had fired **zero** times. It has now fired. So has
`lamp_stutter`, in `explore3` at 4:46.9, which is the first time both escalating beats have
appeared in the recorded corpus.

Measured dread maxima, recomputed from the raw samples: `ent2` **0.196**, `fix1` **0.306**,
`fix2` **0.288**. The pre-fix value is under `rouse`'s 0.25 exactly as R1 predicted; the
post-fix values clear it. The claimed 0.55 is not reached — §4/N2.

### 1.3 F3 — `sinceBeat -= 5` running per frame → **FIXED**

`src/systems/Director.js:687` is now a plain `if (!options.length) return;`, with a
comment (`:676-686`) that states the frame-rate arithmetic correctly. The two related
per-frame subtractions were also re-scaled rather than zeroed: `zone:enter` now deducts 20
(`:214`) instead of clamping to `quietFloor * 0.35`, and `entity:state` deducts 30 (`:241`)
instead of zeroing. Both are once-per-event handlers, not per-frame.

### 1.4 F4 — contaminated capture evidence → **ACKNOWLEDGED, NOT REMEDIED**

`docs/PLAYTEST_2026-07-31.md` §19 retracts the lamptour conclusions in plain language
("Treat every lamptour conclusion as unproven") and §14 is an explicit retraction section.
That is the honest half.

The evidence itself is unchanged. `docs/captures/tour3/` is still dated 31 Jul 13:47-13:56
— the same set R1 judged, seven of twenty-four frames still invalid, still 496 × 279, still
no valid player's-eye frame of the Residence. `docs/captures/lamptour/` is untouched.
`docs/captures/lum_after/` is 896 × 504 and six frames, but is dated 31 Jul 10:54-11:01,
i.e. **before** R1, and covers only Intake, Service and Plant — the three zones that were
never the problem. **The Stack, the Cistern, the Ductwork and the Residence have not been
re-shot at all**, and R1 §7.3 asked for exactly that. `world.goto()`'s silent failure, the
root cause, is still not chased: I found no change to it in the diff.

**Verdict: partly fixed.** The conclusions were correctly downgraded; the instrument and
the evidence base were not repaired, so the visual dimension has no new information in it.

### 1.5 F5 — `Progression.portals` keyed by bare portal id → **RE-KEYED, NOT FIXED; NOW UNCONDITIONAL**

This is the finding I would act on first.

The map is genuinely re-keyed (`src/systems/Progression.js:230`):

```js
this.portals.set(`${p.zone ?? '?'}:${p.id}`, p);
```

But the query was changed at the same time (`:275`):

```js
isGated(id) { return this._byId(id).some((p) => p.locked) || !!this.portals.get(id)?.locked; }
```

`_byId(id)` (`:237-243`) returns **every** registered portal carrying that bare id, and
`.some()` takes the union of their lock states. `portals.get(id)` is now always `undefined`
because the keys are `zone:id`, so `isGated` is *entirely* `.some()`.

Three zone files declare a portal literally called `to_plant`:

| file:line | zone | locked | group (`ZoneGameplay.groupFor`) |
|---|---|---|---|
| `src/world/zones/ServiceZone.js:411` | service | no | `portal_plant` |
| `src/world/zones/DuctZone.js:395` | duct | no | `portal_plant` |
| `src/world/zones/CisternZone.js:336-337` | cistern | **yes** — authored bolted hatch | `null` (`groupFor` returns null for `locked: true`) |

`src/world/World.js:403` gates a doorway with `progression.isGated(p.id)` — the bare id. So
the moment the Cistern zone is *built*, `isGated('to_plant')` is `true` for **all three**,
and nothing can clear it: `gate()` is never called with `to_plant` or `portal_plant`
anywhere in `src/` (I grepped), and `installDefaultGates` (`:406-411`) only addresses
`portal_cistern`, `portal_residence`, `portal_stack`, `portal_lift`.

**Every route into the Plant in the entire building is called `to_plant`.** `to_service`,
`to_intake`, `to_cistern`, `to_stack`, `to_residence` and `to_safe` all exist, but the only
ids that lead to the Plant are the three above. So this seals the Plant, and `reach_plant`
is objective 1 of 7 and the Plant is where all three fuse cores are fitted.

The Cistern does not have to be entered. `World._preload` (`:446-462`) builds the zone a
portal leads to when the player comes within **14 m** of that portal and fewer than
`maxResident = 3` zones are loaded — so standing near the Service Spine's `to_cistern` door
with only Intake + Service resident is enough.

**Delivered evidence.** `Progression.js:480` serialises `gates` as the bare ids of every
locked portal. From the four playthrough reports:

| session | zones visited | `gates` at end |
|---|---|---|
| `base` | intake→service→cistern→plant→safe | `arrival_lift, `**`to_plant`**`, to_cistern_pipes, to_stack, to_residence, exit_lift` |
| `ent2` | same | same, includes **`to_plant`** |
| `fix1` | same | `arrival_lift, to_cistern_pipes, to_residence, `**`to_plant`**`, exit_lift` |
| `fix2` (current) | same | `arrival_lift, to_cistern_pipes, to_residence, `**`to_plant`**`, exit_lift` |
| `explore3` (never built the Cistern) | intake, service, duct | `arrival_lift, to_cistern_pipes, to_stack, to_residence` — **no `to_plant`** |

`explore3` is the control: the only delivered session that never built the Cistern is the
only one without `to_plant` gated.

**So the observable defect is unchanged by the fix.** Before, it depended on build order and
happened to bite on the recorded route. After, `.some()` makes it certain: there is no
ordering, no route and no player action that unseals the Plant once the Cistern exists.
Every harness in `tools/qa` still changes zone by teleport (`fix2` logs four
`qa:scripted-zone-change` events), so no session has ever tried to walk this door.

**A second-order consequence, same change.** `isGated` and `gateReason` now resolve by
different rules. `isGated` takes the union over homonyms; `gateReason` (`:278`) uses
`_resolve`, which prefers the portal in the player's *current* zone. Standing in the Service
Spine at `to_plant`, `isGated` answers with the Cistern's hatch and `gateReason` answers
with the Service Spine's own entry, whose `reason` is `''`. `src/ui/UI.js:438-441` therefore
prints the generic `'It will not open.'` The door that ends the run does not say why.

**The minimal correct fix is two lines** — see §5.

---

## 2. Re-score, identical rubric and weights

| # | Dimension | Weight | R1 /10 | **R2 /10** | Δ | Weighted |
|---|---|---:|---:|---:|---:|---:|
| 1 | Core loop / moment-to-moment gameplay | 15 | 4 | **4** | 0 | 60 |
| 2 | Encounter design and player counterplay | 15 | 3 | **5** | +2 | 75 |
| 3 | Pacing and tension curve | 12 | 4 | **5** | +1 | 60 |
| 4 | Navigation, legibility, wayfinding | 10 | 2 | **3** | +1 | 30 |
| 5 | Environmental storytelling and world coherence | 8 | 6 | **6** | 0 | 48 |
| 6 | Visual quality and art direction | 15 | 4 | **4** | 0 | 60 |
| 7 | Audio | 10 | 3 | **3** | 0 | 30 |
| 8 | Technical performance | 8 | 4 | **4** | 0 | 32 |
| 9 | Onboarding | 4 | 2 | **3** | +1 | 12 |
| 10 | Content volume and replay value | 3 | 4 | **4** | 0 | 12 |
| | **Total** | **100** | 36.3 | | | **419 → 41.9** |

**42 / 100.** Five of ten dimensions did not move at all, and they carry 44 of the 100
points. Stated plainly: this round fixed bugs, and it did not make the game look, sound or
read any better.

### 2.1 Core loop — 4 → **4** (no change)

**Up:** a fifth pressure verb exists (`Decoy`, `KeyT`, `src/core/Input.js:31-36`) and the
starting inventory carries one cell (`Inventory.js:107`) so it is usable from the first
minute. `interact:use` recovers from `ent2`'s 4 to **9** in `fix2`, matching `base`. And for
the first time there is evidence of the loop running *without a script*: `explore3` operated
ten interactables with no hints — four pickups, three door latches, a locker, two more doors
— including reading `nb_1` at 0:22.6.

**Down, and it cancels out:** `Decoy._landingPoint` (`Decoy.js:117`) still uses
`dx = sin(yaw), dz = cos(yaw)` where `Player.forward` (`Player.js:135`) is
`(-sin, -cos)`. The cell is thrown **exactly 180° backwards**, up to 14 m behind the player,
and the `world:noise` it emits pulls the Surveyor toward them. I raised this in R1's "also
worth fixing" list; it was not fixed and the acceptance test written for it cannot see it
(§4/N4). The new verb does the opposite of its purpose. And §1.5 means the critical path
does not run at all past the Cistern. Still 1 of 7 objectives and 0 of 4 cores in every
recorded session.

### 2.2 Encounter design and counterplay — 3 → **5** (+2)

Two of those points are for the fail state existing. R1's headline was that the game stopped
having a fail state after one death; `explore3` now kills the player three times in nine
minutes and resolves every capture. CAPTURING has an exit. The decoy adds a fifth verb in
principle.

Everything else in R1 §1.2 stands verbatim: `baseSpeed = lerp(0.82, 1.24, aggression)`
(`Surveyor.js:778`) is unchanged, so APPROACHING is still **0.918 m/s** against a
**2.15 m/s** walk (`Player.js:185`); `Surveyor.js` still contains no reference to `hidden`,
lockers or hiding of any kind, so the six lockers still make you *more* afraid
(`Director.js:321`) and no harder to detect; lean is still read by nothing. The decoy is
also refused whenever `inventory.handsFull` (`Decoy.js:94`), and `handsFull` is
`encumbered` (`Inventory.js:90,123`), which is true while carrying a fuse core — so the
game's only redirect verb is unavailable during the one sequence the design builds tension
around, and nothing tells the player.

### 2.3 Pacing — 4 → **5** (+1)

`rouse` fired. That is a real, first-ever result and it is the one thing R1 said the
Director structurally could not do. `sinceBeat -= 5` is gone. `explore3` produced four beats
of four *distinct* types (`services`, `lamp_stutter`, `distant_door`, `circuit_trip`) in
540 s, against `ent2`'s three types with `services` twice.

Against that, recomputed from the raw samples:

| metric | `base` | `ent2` (R1's "current") | **`fix2` (current)** |
|---|---:|---:|---:|
| sim seconds | 510 | 629 | 526 |
| beats fired | 1 | 4 | 4 |
| distinct beat types | 1 | 3 | **4** |
| `fear` median | 0.024 | 0.138 | **0.035** |
| `fear` p90 | 0.269 | 0.473 | **0.421** |
| fraction `fear > 0.3` | 1.6 % | 30.4 % | **27.9 %** |
| entity non-DORMANT (samples) | 19.9 % | 56.6 % | **43.2 %** |
| max `dread` | — | 0.196 | **0.288** |
| threat episodes | 2 | 5 | **3** |

The fear median falls back by a factor of four and threat episodes drop from 5 to 3. One
beat per 131 s is still one perceivable authored event every two minutes. And the dread
ceiling is 0.288 against a designed 0.55, which leaves `lamp_stutter` (0.30) unreachable
through dread in every scripted session — §4/N2. +1, not more.

### 2.4 Navigation — 2 → **3** (+1)

The whole point is worth restating: **the point is for the instrument, not the level.**

`tools/qa/explore.mjs` is the first thing in this project to measure §3.2 of the brief at
all, and it is a serious piece of work — a `--selftest` mode with metrics checked against
constructed answers, a `--verify` mode that truncates the session to 25/50/75 % and requires
the numbers to move, a coverage denominator built from `collision.floors` that the walker
never reads, and an explicit "What this tool cannot tell you" section. It immediately found
a defect no other harness could: `service_door3` opened onto a hole and the safety net had
nothing under it (`PLAYTEST` §23). That is the exact class of finding the brief's §6 says
only real play produces.

What it measured is not good. From `explore3`, and none of these depend on the cue model:

- **483 seconds** to find the way out of the starting zone (`service.firstSeen = 484`;
  route table `0:00 intake → 8:03 service`).
- **2 of 8 zones** reached in nine minutes.
- **0 objectives** completed, ever, unguided.
- 48.8 % of one 61 × 60 m plate covered in 489 s, revisit rate 24.0 %.

Add §1.5, which shuts the critical path. The in-game affordances are unchanged: no map, no
compass, objective banner still auto-hiding after 6.0 s. 3, and the point is provisional on
the instrument being trusted — which brings us to §3.

### 2.5 Environmental storytelling — 6 → **6** (no change)

`nb_1`, the page that states the entity's three rules, moved from the Ductwork crawl to the
Intake arrival bay (`src/world/zones/IntakeZone.js:783-801`), and `explore3` confirms an
unguided bot reads it **22.6 seconds** into the session. That closes one of R1's four
deductions and it is the right call.

The other three stand: `card_contractor` and `keys_ring` still have no spawn site anywhere,
so the "your card was issued in March" payoff at `Interactables.js:911-913` is still dead
code and `note_induction` still promises keys that do not exist; `ENDINGS.DESCENDED` is
still unreachable (`lift_2` authored `powered: false`, the only `setPower(true)` is inside
the `gen:running` handler); the pry bar still opens nothing. One of four fixed does not move
an integer.

### 2.6 Visual quality — 4 → **4** (no change)

**There is no new visual evidence.** Every capture directory that bears on R1's criticism
predates R1. The Stack, Cistern, Ductwork and Residence have not been re-shot; the three
zones at 94-95 % crushed pixels are still at 94-95 %; the Residence still has no valid
player's-eye frame; the whole tour is still 0.14 MP. `docs/captures/lum_after/` is the only
higher-resolution set (896 × 504) and it photographs Intake, Service and Plant.

`src/core/Engine.js:30` also drops the shipping high tier from `aoScale 1.0 → 0.5` and
`msaa 4 → 2`. The reasoning is measured and honest, but it is a small quality reduction in a
building the same comment describes as "made of thin high-contrast edges", in a project
whose own tour already flags two frames `ALIASING`. Brief §1.6 asks that performance not be
bought by destroying visual quality; this is a mild instance, not a violation. Net zero.

### 2.7 Audio — 3 → **3** (no change)

`docs/verification/audio/` is byte-for-byte the set R1 measured, last written 31 Jul 09:45.
No re-render, no listening notes, no new artefacts. The measurements from R1 §1.7 therefore
stand unchanged: `scenes/surveyor.wav` moves **2.9 dB** over 75 seconds, `scenes/breaker.wav`
4.0 dB, and the beds still sit at −11.6 to −12.8 dBFS RMS with peaks at −2.7 to −3.3, so
there is ~3 dB of room above the ambience for anything to be loud in. Brief §7 requires the
audio to have been "listened to, judged, fixed where wrong". None of those has happened.

### 2.8 Technical performance — 4 → **4** (no change)

Real improvements: `preserveDrawingBuffer` is now off for players and on only under `?qa=1`
(`Engine.js:80`, `Game.js:88`) — a per-frame back-buffer copy removed from the shipping
path, and all eleven harnesses in `tools/qa` do pass the flag, so no capture set was
silently invalidated. The quality ladder climbs back as well as dropping.

No new measurement. `docs/EVALUATION_2026-07-31.md` is the same single Apple-M4 pass R1
scored; the shipping high tier still does not reach 60 fps on it. Both `fix2` and `explore3`
still report the standing failure `no frame > 5 s` (max 59 063 ms), which has been red for
the life of the tool.

### 2.9 Onboarding — 2 → **3** (+1)

The `nb_1` move is the single highest-value onboarding change available and it landed, with
proof: a bot with no instructions read the game's rules 22.6 s in.

Everything else in R1 §1.9 is untouched. `src/ui/Pause.js:15-25` is unchanged: it still
lists ten rows, still omits `V` (cover lens), `B` (swap cell) and `T` (throw decoy), and
still advertises `G` — `Inventory.dropCarried()` (`Inventory.js:197`) still has **zero call
sites in `src/`**. `T` is a brand-new key with no surface anywhere in the UI. There is still
no staged first encounter.

### 2.10 Content volume and replay — 4 → **4** (no change)

One new verb. No new content, no branching, one ending still unreachable, and §1.5 removes
the ability to finish at all on the ordinary route.

---

## 3. The `83.7 %` cue metric — audit and verdict

**This is the highest-value item in the report and the verdict is: mostly a tool artefact.
Do not change the level design on the strength of that number.**

### 3.0 First: the two numbers in circulation are from different runs

The counters `{"far":154397,"behind":5441,"elevation":9,"occluded":2061,"hidden":0,
"seen":1513}` are from **`docs/verification/explore/explore.json`**, whose cueless fraction
is **0.8074**. `explore3` — the current state, and the source of the 83.7 % — has
`{"far":67905,"behind":5427,"elevation":9,"occluded":1965,"hidden":0,"seen":1286}` and
fraction **0.8370**. `PLAYTEST` §24 quotes explore3's percentage next to explore1's cull
table, and also gives "longest single stretch 190 s" where `explore3/explore.md:97` says
**161 s**. Before anything else, the two numbers should be made to come from the same run.

### 3.1 `far` is not a level-design signal, and this is provable

`EX.visible()` (`tools/qa/explore.mjs:609-650`) iterates `g.interactor.items` — the *global*
registry. `ZoneGameplay`'s own header states props are never despawned, and zones sit 400 m
apart. So `far` is counting interactables in other buildings.

The proof is in the delivered artefacts. `explore` and `explore2` have **identical**
`behind` (5441), `elevation` (9), `occluded` (2061) and `seen` (1513), and an identical
cueless fraction of 0.80740740740…, i.e. the same walk producing the same cue outcomes at
every sample. Their `far` counters differ by **41 790** (154 397 → 196 187). Forty-one
thousand additional rejections with zero effect on any cue decision. `far` is a function of
how many objects happened to be resident, not of what the player could see. **The "showing
its working" block (`explore.mjs:1418-1425`, rendered at `explore.md:106-115`) is therefore
dominated by a term that carries no information**, which is the opposite of what it is
offered for.

### 3.2 What actually decides `cue`, in numbers

Restricting to candidates inside the 14 m radius — the only ones any other test sees —
`explore3` gives 5427 + 9 + 1965 + 1286 = **8687** decisions:

| outcome | count | share of in-radius |
|---|---:|---:|
| `behind` (outside the instantaneous FOV wedge) | 5427 | **62.5 %** |
| `occluded` (single ray blocked) | 1965 | 22.6 % |
| `seen` | 1286 | **14.8 %** |
| `elevation` | 9 | 0.1 % |

So the binding constraint is not occlusion and it is not the level — it is **which way the
bot's head happened to be pointing on that frame**. A standing player turns their head; the
bot commits to a heading and the cue is sampled at that instantaneous yaw
(`explore.mjs:1007`, `cue: seen.length`).

### 3.3 The in-reach free pass, which is the metric's real problem

`explore.mjs:623-624`:

```js
const inReach = dist <= (it.range ?? 2.2);
if (!inReach) { /* FOV, elevation and occlusion tests here */ }
```

Anything within ~2.2 m skips **every** test — direction, walls, everything. Distribution of
`cueNearest` over the 88 `explore3` samples that recorded any cue at all:

| nearest cue | samples | share of positives | share of the whole session |
|---|---:|---:|---:|
| ≤ 2.2 m (the free pass) | **50** | 57 % | 9.3 % |
| 2.2 – 5 m | 14 | 16 % | 2.6 % |
| > 5 m | **24** | 27 % | **4.4 %** |

Median nearest-cue distance: **2.1 m**. Maximum across the whole 540 s session: **13.8 m**.

Read that the other way round. The tool's positive class is mostly "there is something at
your feet". **The session had a cue visible at a distance of more than 5 m for 4.4 % of its
samples, not 16.3 %.** The metric named "nothing to walk toward" almost never records
anything to walk toward; it records things already walked to.

### 3.4 Geometry: the number is close to a restatement of its own constants

The Intake, where the bot spent 489 of 540 s, spans x −31.1…29.7 and z −29.5…30.6 in the
`explore3` samples — 61 × 60 m — with 864 walkable 2 m cells ≈ **3456 m²** of floor.

The cue wedge: `SEE = 14.0` (`explore.mjs:484`), half-FOV `atan(tan(65°/2) × 16/9) = 0.848`
rad plus 0.09 slack, so a wedge of 1.876 rad. Area ≈ ½ × 14² × 1.876 ≈ **184 m²** —
**5.3 %** of the zone, before any wall blocks it.

Persistent cue objects in that plate after the first 32 s: three door latches, one locker,
one tape player — the four pickups the bot took at 0:22.6, 0:25.5, 0:31.3 and 0:31.8 are
removed from the registry when taken. Call it five. A uniform-density null model gives
P(nothing in the wedge) ≈ (1 − 0.053)^5 ≈ **0.76** with no occlusion at all, and the
measured Intake figure is 86.5 %. **The observed value is what the radius, the wedge and the
object count predict.** Adding interactables until 83.7 % comes down would be optimising the
tool, not the level.

### 3.5 The vocabulary, and the assertion built on top of it

A "cue" is an interactable or a door latch and nothing else. Room plates, `STAFF ONLY`
labels (the `Decals` layer places these), a lit corridor at the end of a dark one, the
architecture — none of it counts, and per R1 §1.4 the architecture *is* this game's entire
wayfinding budget. `explore.md:489-493` says so and correctly calls the figure an **upper
bound**.

And then `explore.mjs:1265` asserts a hard threshold against it — *"less than half the
session had no navigational cue in sight"* — and prints **FAIL**. A pass/fail line on an
acknowledged upper bound is a claim that the prose immediately disclaims. This is the brief's
§6 pattern with the sign reversed: a red check over a thing that is not broken in the way
the check says.

### 3.6 Verdict

**Both, but not in the proportion the number implies — and the design defect is measured
elsewhere in the same file, by rulers that work.**

- **The 83.7 % itself is mostly a tool artefact.** Its value is set by `SEE = 14 m`, a wedge
  covering 5 % of the plate, an in-reach free pass that supplies 57 % of the positives, an
  instantaneous yaw that rejects 62 % of in-radius candidates, and a cue vocabulary that
  excludes everything this level actually uses to direct a player. Acting on it directly
  would mean scattering interactables to move a number.
- **There is a real navigation defect underneath, and you already have clean evidence of
  it:** 483 s to leave the starting zone, 2 of 8 zones in nine minutes, 0 objectives, 48.8 %
  coverage of one plate. Those come from positions, zone events and progression state, and
  none of them touches the cue model. Design against *those*.

### 3.7 What would make the measurement trustworthy

1. **Scope the candidate set to the player's current zone.** One condition in
   `EX.visible()`. The 41 790-count gap between `explore` and `explore2` is the size of the
   contamination being removed.
2. **Make the radius geometric, not constant.** March the sightline until it is blocked and
   let the corridor set the range; a 40 m spine should count at 40 m. Report the achieved
   maximum sight distance per zone next to the metric so a reader can see whether 14 m was
   ever binding.
3. **Split the two populations and report both.** `cueInReach` (dist ≤ range, no tests) and
   `cueInView` (passed FOV + occlusion at distance). Today they are summed and the first
   dominates 57:43.
4. **Sweep the view.** Evaluate over the union of headings held during the sample second, or
   over ±90° in 15° steps. A standing player looks around without moving; `behind` at 62 %
   of in-radius rejects is the size of what is currently being measured instead.
5. **Widen the vocabulary to what the level uses:** portal trigger volumes, powered
   fixtures/circuits, and the signage `Decals` already authors. If a `STAFF ONLY` plate is
   not a cue, this is not a wayfinding metric.
6. **Publish the null model.** Per zone: persistent cue-object count, walkable area, wedge
   area, and the cueless fraction a uniform distribution would produce. A design defect is
   the *excess over the null*, not the raw fraction.
7. **Retire the 50 % assertion** or restate it against something defensible —
   time-to-first-objective, zones reached, coverage, distance-to-nearest-unexplored-exit.
   Those three already pass or fail meaningfully.

---

## 4. Five new defects

None appears in `docs/JUDGE_R1.md`, `docs/PLAYTEST_2026-07-31.md` or
`docs/NEXT_ITERATION_PROMPT.md`. Each is verified in source; three are corroborated in
telemetry.

### N1 — `placeSurveyorNear` puts the Surveyor 20–30 m *directly in front of* the player, not behind

**Severity: high.** It fires at first spawn, on every zone change, and again on every
cross-zone respawn.

`src/systems/Director.js:573-580`:

```js
const back = (this.player.yaw ?? 0) + Math.PI;
const headings = [back, back + 0.8, back - 0.8, ... , back + Math.PI];
for (const a of headings) {
  const x = p.x + Math.sin(a) * range, z = p.z + Math.cos(a) * range;
```

`Player.forward` (`src/player/Player.js:135`) is `(-sin(yaw), 0, -cos(yaw))`. With
`a = yaw + π`, the offset `(sin a, cos a) = (-sin yaw, -cos yaw)` **is** `Player.forward`.
So the first and most-preferred candidate places the entity `range` metres along the
player's gaze. The genuinely-behind candidate is `back + Math.PI` — the **last** entry in
the list, reached only if the seven in front of the player all fail their floor test.
`spawnAt(..., a + π)` then faces it back at the player, which is why it looks deliberate.

This is the same sign-convention error as `Decoy.js:117`, in a second file. The entity uses
`(+sin, +cos)` with headings from `atan2(dx, dz)` (`Surveyor.js:961`, `:703-704`); the
player uses `(-sin, -cos)`. Anything that mixes the two is 180° out.

The comment two lines up says *"It re-enters behind the player, out of sight, at a distance
that is not an ambush."* It re-enters in front of them.

**Corroboration.** `explore3`: `director:entity-followed zone=service` at 8:03.4 as the bot
walks into the Service Spine; `DORMANT → ROUSED` at 8:48.0, `CAPTURING` at 8:53.1,
`game:death` at 8:54.5 — 51 seconds from entering a corridor to dying in it, in a zone the
bot had just arrived in. The same sequence at 0:19.9 (`director:entity-placed`) → ROUSED at
0:36.1 → death at 1:26.9.

**Fix:** `const back = (this.player.yaw ?? 0);` — because `(sin yaw, cos yaw) = -forward`.
One character.

### N2 — the dread fix's realised ceiling is 0.288, not 0.55, and this round's entity-follow fix is what holds it down

**Severity: medium-high.** The two headline improvements of this round work against each
other, and `lamp_stutter` is still unreachable through dread in scripted play.

`Director.js:641-645` resets `_sinceThreat` on `s0.state !== DORMANT` — with **no distance
term at all**. The Surveyor's non-DORMANT states include SEEKING and MEASURING, which it
holds for long periods at considerable range. And the same round's `zone:enter` follow
(`:194-200`) plus the DORMANT wander (`Surveyor.js:797-809`) keep it near the player far more
of the time than before.

Measured, recomputed from the raw samples:

| | `base` | `ent2` | `fix1` | **`fix2`** |
|---|---:|---:|---:|---:|
| entity non-DORMANT | 19.9 % | 56.6 % | 51.7 % | **43.2 %** |
| longest continuous non-DORMANT run | — | 156 s | 155 s | **135 s** |
| median distance while non-DORMANT | — | 11.2 m | 12.4 m | **14.1 m** |
| max distance while non-DORMANT | — | 24.8 m | 30.4 m | **33.5 m** |
| **max `dread`** | — | 0.196 | 0.306 | **0.288** |
| samples with `dread > 0.25` | — | 0.0 % | 3.9 % | **2.7 %** |

`wantDread = clamp01((_sinceThreat − 40)/200) × 0.55` needs **240 s** of continuous DORMANT
to reach 0.55, and **149 s** to reach `lamp_stutter`'s 0.30. The longest DORMANT stretch in
any delivered scripted session does not deliver it, because a Surveyor pottering about in
MEASURING **33 metres away** — where the player cannot see, hear or be threatened by it —
pins `_sinceThreat` at zero for 135 consecutive seconds.

The comment at `:639-640` says *"Four minutes with the Surveyor asleep now reaches 0.55,
which clears every gate in the table."* Measured maximum across three post-fix sessions:
**0.306**. `rouse` (0.25) clears; `lamp_stutter` (0.30) clears only in `explore3`, where the
bot's route left the entity dormant longer.

**Fix shape:** gate `threatUp` on perceptibility rather than on state — e.g.
`state !== DORMANT && dist < ~25 m`, or scale `wantDread` by distance. The concept is right;
the predicate is too generous.

### N3 — a locked door explains itself exactly once per session

**Severity: medium.** It is a wayfinding defect in the dimension the brief calls "most of
what this game is".

`src/world/World.js:404-411`:

```js
if (gated) {
  if (this._lastGateNag !== p.id) { this._lastGateNag = p.id; bus.emit('portal:locked', ...); }
  continue;
}
this._lastGateNag = null;
```

`_lastGateNag` is cleared **only** by successfully passing through some portal. So the
second, third and tenth time a player walks into the same locked door — after wandering off,
finding nothing, and coming back to check — the game says nothing at all. No subtitle, no
sound, no reason.

**Corroboration.** `explore3` logs `portal:locked` exactly **once** in 540 s
(`lockedDoorNags: 1` for `service`), for `to_cistern_pipes`, in a session that spent 51 s in
a zone with two locked portals in it.

Compounding it, from §1.5: `isGated` and `gateReason` resolve homonyms by different rules, so
the one message a `to_plant` refusal does produce is the generic
`'It will not open.'` (`src/ui/UI.js:440`) rather than any authored reason. And per R1, every
refusal that *does* carry a reason renders through `Prompts.js:61` as
`` `Requires ${reason}` ``, producing sentences like *"REQUIRES BOTH HANDS ARE FULL."*

### N4 — the new decoy acceptance test cannot fail on a mis-aimed throw

**Severity: high as an evidence defect.** This is the tenth instance of the pattern brief §6
documents six times, and it is guarding this round's headline new feature.

`tools/qa/playthrough.mjs:1016-1031`:

```js
const throws = H.events.filter((e) => e.key === 'decoy:thrown');
const heard  = H.events.filter((e) => e.key === 'entity:heard' && e.data?.at);
const redirected = throws.filter((tw) => { const [tx,,tz] = tw.data.at;
  return heard.some((h) => h.t >= tw.t && h.t <= tw.t + 4
    && Math.hypot(h.data.at[0]-tx, h.data.at[2]-tz) < 6); });
check('a thrown decoy moved the Surveyor\'s belief to where it landed',
  throws.length === 0 || redirected.length > 0, ...);
```

Its own comment claims *"This is the check that fails if… the landing point is computed
wrong."* It does not. It compares the belief against `decoy:thrown.at` — the tool's own
report of where the cell went — and both sides come from the same direction vector. If the
cell lands 14 m **behind** the player (which it does, `Decoy.js:117`), the belief lands 14 m
behind the player, the distance is ~0 m, and the check reads **PASS**. It would still pass
if the cell landed on the player's feet.

Two further weaknesses: `throws.length === 0 ||` makes a session with no throws pass
vacuously, and the delivered evidence is **n = 1** — `fix2` fired the throw once
(`decoy:thrown` count 1) and the report states *"1 of 1 throws produced a belief within
6 m"*. One sample of a mechanic tested by a check that cannot fail.

**The check that would work** compares the landing point against the player's own aim:
`dot(normalize(land − playerPos), Player.forward()) > 0.9`, plus a check that the belief
moved *away* from the player, not merely near the cell.

### N5 — the F1 fix has no regression test, and the one harness that could hold it is structurally blind to it

**Severity: medium.** The most serious defect this project has had is now guarded by nothing.

R1 §7.1 asked for the assertion that would have caught it: *a CAPTURING state must resolve to
a death or a despawn within N seconds.* I grepped: no such assertion exists in
`tools/qa/playthrough.mjs`, `tools/qa/explore.mjs` or `src/systems/qa/surveyor_sim.mjs`.

`surveyor_sim.mjs` constructs a **fresh entity per test** (`:184-199`, `:210`, `:222`), so a
state that only manifests on the *second* capture cannot be reached by it — which is why it
was green for the life of the bug and is green now for a different reason. Its one relevant
assertion, `:198`, checks a single `game:death` on a single entity.

The only evidence the bug is fixed is `explore3` happening to die three times. That is an
accident of a bot that dies a lot, not a test: if the reset in `_setState` were deleted
tomorrow, `npm run audit` would stay green and the scripted `fix2` session — which recorded
**zero** deaths — would not notice.

**Same file, still unfixed since R1:** `surveyor_sim.mjs:249` reads

```js
ok('does not tunnel through the divider', Math.abs(s.position.z) > 0.15 || true);
```

The one assertion that would catch collision tunnelling is still unconditionally green,
which matters more now that `Surveyor.js:901-904` is confirmed to move the body without
`resolveCapsule` for up to 6 s per capture.

---

## 5. The single highest impact ÷ effort intervention

**Make `isGated` resolve the portal the player is standing at, not the union of every
portal that shares its name. Two lines.**

`src/world/World.js:403`:

```js
const gated = this.ctx.progression?.isGated?.(p.zone ? `${p.zone}:${p.id}` : p.id);
```

`p.zone` is already on every portal (`src/world/ZoneKit.js:147`), and the map is already
keyed exactly that way.

`src/systems/Progression.js:275`:

```js
isGated(key) { return !!(this.portals.get(key) || this._byId(key)[0])?.locked; }
```

`gateReason` already resolves this way, so the two stop disagreeing for free.

**Why this one.** It is the smallest change in this report and it is the only one that
unblocks the project's remaining verification holes rather than closing a single bug:

- It restores the critical path. `reach_plant` is objective 1 of 7 and the Plant is where
  all three cores are fitted; today the Plant is sealed for the rest of the run the moment
  the Cistern is built, which happens on the ordinary route and can happen without the
  player ever entering it.
- Every unfinished item in brief §7 is downstream of it. *"An exploration bot that is not
  following a script has completed the game"* cannot happen while the Plant is shut. Six of
  seven objectives, both remaining endings, and three zones with zero continuous telemetry
  (Stack, Residence, Ductwork) are all behind that door.
- The cost is two lines against a defect that has survived two rounds and one deliberate fix
  attempt, because every harness in `tools/qa` changes zone by teleport and no gated portal
  has ever been walked through in the history of this project.

**And ship it with the acceptance test that would have failed**, because that is the whole
argument of brief §6: *an unguided session must traverse at least one portal that was gated
at some point in the run, and `progression.isGated('to_plant')` must be false while standing
in the Service Spine with the Cistern resident.* `explore.mjs` is already the right harness
— it walks doors instead of teleporting, and it is the only tool in the repository that
could ever have caught this.

**Runners-up, for completeness:** N1 (one character, restores the entity's intended staging
and removes an unearned ambush) and N4 + `Decoy.js:117` (fix the aim, then fix the test that
cannot see the aim) — both trivial, both high-value, neither of them unblocking anything
else.

---

## 6. What I could not assess

Unchanged from R1 §6 in every particular, because the evidence base did not change:

- **The audio, as sound.** The files are the same files. No one has listened.
- **Frame rate.** One Apple M4 pass, second-hand; everything else is SwiftShader.
- **Anything above 496 × 279**, except six frames of the three strongest zones at
  896 × 504. The §5 inspection list (normal-map seams, texture stretching, shadow acne,
  transparency sorting, temporal stability) remains unresolvable at the delivered sizes.
- **The Stack, the Residence and the Ductwork in motion.** `explore3` reached two zones;
  `fix2` reached five by teleport. Those three still have no continuous telemetry, and the
  Residence still has no valid player's-eye frame.
- **Six of seven objectives and all three endings.** No session has completed more than
  `reach_plant`, and §1.5 explains why no session can.
- **Whether the game is frightening.** Still no human has played it, and getting lost is
  what this game is for.
