# THE ANNEX — completion report, 1 August 2026

This supersedes nothing in `docs/COMPLETION_REPORT.md`, which describes what the
project **is**. This describes one pass over it: what was found, what was fixed,
what was measured, and — at more length than is comfortable — what was got wrong
along the way.

`docs/NEXT_ITERATION_PROMPT.md` §1 constraint 7 asks for at most three
independent judge rounds and then an honest completion report. Three rounds were
run (`docs/JUDGE_R1.md`, `R2`, `R3`). This is the report.

The long-form account with every measurement is `docs/PLAYTEST_2026-07-31.md`,
parts 1–39. This is the summary.

---

## 1. The one-sentence version

The project's verification suite was green and most of it was measuring something
adjacent to its own claim; this pass made the instruments honest, and the game
changes that followed were the ones the honest instruments demanded.

---

## 2. Independent assessment

| round | weighted score | new defects found |
|---|---|---|
| R1 | 36 / 100 | 5 |
| R2 | 42 / 100 | 5 |
| R3 | **45 / 100** | 5 |

The reviewer's own explanation of why the score moved so little is the most
useful sentence produced in three rounds, and it is accepted without argument:

> Five of ten dimensions carrying 46 points have not moved in three rounds …
> every one of the fifteen defects found is a *mechanism* defect — a sign, a key,
> a predicate, a map key, a reset. None was about what the game looks like,
> sounds like, or gives the player to do.

**Six of the fifteen defects were introduced during this pass**, while fixing the
other nine. Every one was caught by a measurement rather than by re-reading the
code, and three were caught only because the reviewer was explicitly instructed
to distrust the developer's own account.

---

## 3. What changed in the game

| | evidence |
|---|---|
| **The Surveyor followed the player between zones.** It had been placed once at t = 22 s and never moved; zones sit 400 m apart, so it was stranded in an empty building for **39 %** of a session. | beyond 100 m: 39 % → **0 %**; within 15 m: 6 % → **41 %** |
| **The Surveyor could kill once per page load.** `_killed` was set and never reset, and CAPTURING had no exit; a second capture emitted nothing and the entity stood on the player for 41.7 s. | 5 threat episodes, 2 reaching CAPTURING, 1 death |
| **The Director could not escalate.** Half the beat table is gated on fear, and fear is assembled only from perceivable things, so a quiet game could never become a loud one. `dread` breaks the deadlock. | beats/9 min: 1 → 3–5; `rouse` had **never fired** in any recorded session and now fires |
| **The pendant's lamp was sealed inside an opaque shade** — the troffer defect in a second fitting, provable from geometry. | emissive delta 2 → 80; before/after frames in `docs/captures/pendant_*` |
| **The Stack's corner high bays were never aimed.** Its own source argued they existed to throw light across the well; `ZoneKit.highbay` never set `f.target`, so they lit the gantry underneath themselves. | crushed pixels **59.6 % → 13.5 %**, fill untouched — §2.1's stated bar |
| **A door onto a hole, and a respawn with nothing under it.** Found only by an unguided bot. | `player:fell` 18 → **0**; worst stall 105 s → none |
| **`to_plant` names three doors and one is authored shut.** Keyed by bare id, the last zone built won; my first fix made it a union and sealed the Plant permanently. | `chain` now fails on all three historical forms |
| **The player had no verb that redirects.** Every existing one lowers your own signature. `nb_1` had promised a thrown-object decoy since before the code existed. | `1 of 1 audible throws redirected` |
| **Three bound keys were on no screen**, including `cover`, which `Input.js` calls the most important key in the game after WASD. | `chain` fails on the shipped list |
| **`nb_1`, the page teaching the three survival rules, was in the Ductwork.** The seed that puts it in the Intake only runs when the world module is absent. | read at 22.6 s by an unguided bot |

Measured across a full session, before this pass and after:

| | before | after |
|---|---|---|
| Director beats in ~9 min | 1 | 3–5 |
| distinct beat types used | 1 | 4 |
| fear above 0.3 | 1.6 % | 18–30 % |
| Surveyor dormant or inactive | 80 % | ~43 % |
| threat episodes | 2 | 3–5 |
| falls through the floor, unguided | 6 452 frames | **0** |

---

## 4. What changed in the instruments

This is the larger half of the work.

- **`tools/qa/emissive.mjs`** — six defects. It sampled fixtures from every
  resident zone and labelled them with the zone under test; aimed at the mount
  rather than the lamp; treated a horizontal offset as a distance; never checked
  there was a floor; called `collision.pointBlocked`, **which does not exist**,
  so its obstruction test had been a no-op for the file's whole life. It now
  proves it is looking at a fitting — switching that fitting's emissive off and
  to 6× and requiring the aperture to move — before it judges it.
- **The eye adaptation had no readout at all.** `lightProbe().exposure` returned
  a constant, so three harnesses "settled" on a number that never moves, after
  31 frames against a 1.8 s time constant. One frame went from **95.2 % pure
  black to 0.3 %** when settled properly.
- **`tools/qa/playthrough.mjs`** — every session silently ended at the first
  death, because being caught opens a modal the harness did not know about; and
  its headline metric, "longest stretch with nothing on the bus", was **seeded
  with the whole session and could therefore never report anything else**. That
  line had been quoted as the project's principal pacing defect. The real figure
  is ~50 s.
- **`tools/qa/explore.mjs`** — new, and the first thing in the project to
  measure §3.2 at all. Its coverage denominator discarded every corridor
  narrower than the 2 m grid, so the Ductwork gridded to zero cells.
- **`src/systems/qa/surveyor_sim.mjs`** — an assertion reading `|| true`,
  named in two review rounds before it was fixed.

Every check written or repaired in this pass has been run against the broken
state it guards and seen to fail there. The list is in
`docs/PLAYTEST_2026-07-31.md` §39.

---

## 5. Open, ranked

**Bugs — none known.** Everything found across three rounds is fixed and
regression-tested, except:

1. **The first-frame shader compile stalls for 30–90 s.** A SwiftShader property,
   not a renderer defect. Unmeasured on a GPU.

**Design decisions that need a human.**

2. **Nine minutes of unguided play reaches 2 of 8 zones and completes 0
   objectives.** Real, and the only remaining measurement that describes the
   game rather than a tool. It was *not* acted on: the metric that pointed at a
   specific fix ("83.7 % of the session had nothing to walk toward") was audited
   on request and came back mostly an artefact of its own cull radius, and the
   claim that 483 s to leave the Intake indicts the level was **retracted** — the
   bot found the exit 0.8 s after its random walk had covered enough ground to be
   likely to. The instrument now exists; the design call does not belong to a
   measurement.
3. **The Cistern and the Ductwork render 94–95 % pure black with the power on
   and the lamp off**, with the auto-exposure pinned against both of its clamps.
   With the lamp on the Cistern reads correctly. Whether the Ductwork should is
   an authorial choice; its bounce fill of 0.011 is an order of magnitude below
   every other zone.
4. **The lamp lasts about seven minutes** and two zones are unnavigable without
   it. That economy has never been tuned against a player.

**Missing content.**

5. **No authored setpieces.** Pacing is now systemic and works; nothing in nine
   minutes is a moment anyone would describe to someone else afterwards.
6. **Entity animation and the first-person hands** — named in the brief §2.4,
   untouched, and the place AAA money goes.

---

## 6. What no tooling in this project can currently tell anyone

Stated plainly because a suite this green invites the opposite assumption.

- **Whether it is frightening.** No human has played it. The scripted bot follows
  a route; the unguided bot steers on open space. Neither gets lost, misreads a
  note, or gets bored.
- **Whether it sounds good.** 75 sounds are verified for silence, clipping and DC
  offset. Nobody has listened. The one measurement made — R1's — found the entity
  encounter has **2.9 dB** of short-term dynamic range.
- **Whether it runs.** Every number here is SwiftShader at the low tier. The one
  GPU pass ever recorded measured a median of ~40 fps at the high tier after
  fixes, against a target of 60, on one machine.
- **Whether the art reads.** The objective frame metrics are gameable: the
  best-scoring frame in the whole eight-zone tour is a camera pressed flat
  against a wall.

---

## 7. The thing worth carrying forward

Six of fifteen defects in this pass were introduced by the person fixing the
other nine, and all six were found by measurement rather than by review. Three
were found only because an independent reader was told not to believe the
author's own document.

The corresponding rule, which cost this pass most of its time to learn twice:
**a check that has not been run against the state it is supposed to catch is not
a check.** Three of the checks written here passed on the broken code the first
time they were written, and looked completely reasonable while doing so.
