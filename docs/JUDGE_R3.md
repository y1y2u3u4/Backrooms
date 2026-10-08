# THE ANNEX — independent judgement, round 3 (final)

**Judge:** independent assessor, acting under `docs/NEXT_ITERATION_PROMPT.md` §1.5.
**Date:** 1 August 2026.
**Mandate:** assess only. This file is the only file created.

**Constraints honoured:** no `npm run build`; no browser harness (`playthrough.mjs`,
`explore.mjs`, `capture.mjs`, `emissive.mjs`) started. Browser-free tools were run:
`chain.mjs`, `portalgraph.mjs`, `aotest.mjs`, `props.mjs`, `floorgaps.mjs`,
`geobudget.mjs`, `lightreach.mjs`, `audiowiring.mjs`, `src/systems/qa/surveyor_sim.mjs`,
plus two probes of my own written into a scratch directory outside the repository and run
against the project's own modules.

**One disclosure.** `tools/qa/geobudget.mjs` writes its own baseline as a side effect of
running; it rewrote the `at` field of `docs/captures/geobudget.json` from
`2026-08-01T09:15:31.171Z` to `2026-08-01T09:16:36.421Z`. The tool reported the measured
numbers "unchanged since the baseline", so the only differing byte range was that
timestamp, and I restored it. No other file in the repository was touched.

**State judged, and it moved again.** At the start of this pass `git status` listed 21
modified files. By the end it listed 22: `src/ui/Pause.js` and a second hunk in
`tools/qa/chain.mjs` were written *during* this assessment (file mtimes after 17:00, and
`chain.mjs` went from 96/96 to 97/97 between two of my own invocations). Those two changes
are judged; anything written after ~17:20 is not. This is the third round in a row in which
the tree has moved under the judgement.

---

## 0. Headline

**Weighted score: 45 / 100.** R2 was 42, R1 was 36. Delta **+3.4** on R2, **+9.0** on R1.

All five of my R2 defects are fixed, and three of the five I can confirm outside the source
that claims them. The critical-path seal — the thing I said in R2 I would act on first — is
genuinely gone; I proved it by driving `Progression.isGated` directly against every portal
id declared in more than one zone (§1.5).

The score moved 3 points because **five of ten dimensions, carrying 46 of the 100 points,
have not moved in three rounds**: visual quality, audio, technical performance,
environmental storytelling, content volume. There is **no capture file anywhere under
`docs/captures/` newer than 31 July** — I checked by mtime — and
`docs/verification/audio/` is byte-identical to the set I measured in R1. Two rounds of the
brief have asked for the four dark zones to be re-shot and for someone to listen to the
mix. Neither has happened. What has happened, three times now, is that the project has
found and fixed defects in its own machinery. That is worth something and it is not worth
much more than three points.

**The most important thing in this report is §3.1:** the check written this round to guard
the critical-path bug — the one the developer's §25 presents as the check that "cannot be
skipped away" — is, against the current source, an **identity comparison that can never
fail**, and it never exercises the call `World.update` was making when the bug shipped.
That is the eleventh instance of the pattern brief §6 documents six times, and it is
guarding the most serious defect the project has had.

---

## 1. Verification of my five R2 defects

### 1.1 N1 — `placeSurveyorNear` put the Surveyor in front of the player → **FIXED (source only)**

`src/systems/Director.js:582` now reads `const back = this.player.yaw ?? 0;`. The offsets
below it are `(sin(a), cos(a))` and `Player.forward()` is `(-sin, -cos)`, so `a = yaw` is
now the direction behind the player. The facing argument `spawnAt(x, y, z, a + Math.PI)` is
still correct: the entity's own convention is `(sin h, cos h)`, so `h = yaw + π` points it
back down the player's forward axis, at them. The fallback branch (`:594`) is consistent.

**But it is verifiable only by reading the code, and that is a finding in itself.**
`playthrough.mjs` records `entity.dist` and nothing else about the entity's position
(sample keys: `active, state, stateTime, dist, illum, conf, speed`). Reconstructing the
placements in `final5` gives:

```
placed@20s 26.28 m   followed@304s 29.76   @373s 30.98   @441s 21.03   @493s 20.00   @505s 29.27
```

— consistent with `firstSpawnRange 26`, `followRange 30` and `followRangeHot 20`, and
**completely silent on bearing**. A defect that put the antagonist 20–30 m into the
player's eyeline, at first spawn and at every zone change, survived two rounds because no
instrument in this project records which way it was placed, and none records it now. See
§3, D-new-7.

### 1.2 N2 — the realised `dread` ceiling was 0.288, not 0.55 → **FIXED**

`src/systems/Director.js:119` introduces `threatRange = 22`, and `:659-661`:

```js
const near = s0?.active ? s0.position.distanceTo(this.player.position) < this.threatRange : false;
const threatUp = !!(s0?.active && s0.state !== SURVEYOR_STATE.DORMANT && near);
```

Recomputed from the raw samples:

| | `ent2` | `fix2` (R2's current) | **`final4`** | **`final5`** |
|---|---:|---:|---:|---:|
| max `dread` | 0.196 | 0.288 | **0.550** | 0.383 |
| samples `dread > 0.25` | 0.0 % | 2.7 % | **21.1 %** | 11.6 % |
| entity non-DORMANT | 56.6 % | 43.2 % | 27.1 % | 34.0 % |
| median distance while non-DORMANT | 11.2 m | 14.1 m | 12.4 m | 12.5 m |

`final4` reaches the designed 0.550 exactly. In `final5`, `dread > 0.30` — `lamp_stutter`'s
gate — holds for one run of 30 consecutive samples. The predicate is now doing what the
comment says. 74.6 % of non-DORMANT samples in `final5` are inside 22 m, so the gate is
discriminating rather than nullifying.

I also checked the worry I had about the DORMANT wander (`Surveyor.js:797-809`) pulling the
entity onto the player, since `_wanderGoal` is anchored on the player's position. It does
not: median entity distance while DORMANT in `final5` is **29.3 m** (p10 15.0, p90 39.2),
with only 33.9 % of DORMANT samples inside 26 m. No defect.

### 1.3 N3 — a locked door explained itself once per session → **FIXED in source, zero telemetry**

`src/world/World.js:326` advances `_nagT`; `:423-428` is a per-door clock keyed
`${p.zone}:${p.id}` with a 6 s repeat. Correct.

**No delivered session exercises it.** `final5` logs **zero** `portal:locked` events — the
scripted bot changes zone four times by `qa:scripted-zone-change` and never meets a gate.
`explore3` logs one, and `explore3` was captured at 15:02, before this change. So claim 5 is
correct code with no evidence behind it, and the acceptance test that would hold it does not
exist.

Two things the fix does not reach, both still live:

- `World.js:428` emits `{ id: p.id, zone: p.target.zone }` — the zone the door *leads to*,
  not the zone it is *in*. `src/ui/UI.js:439` then calls `gateReason(e?.id)` with the bare
  id, which resolves through `Progression._byId`'s current-zone sort. The gate is now
  resolved by zone and the *reason* still is not; they agree only by luck of ordering.
- `src/ui/UI.js:491` still feeds the refusal reason into the prompt's `requires` field and
  `src/ui/Prompts.js:61` still renders `` `Requires ${cur.requires}` ``, so the decoy's own
  refusal reads **"REQUIRES BOTH HANDS ARE FULL."** Unchanged since R1.

### 1.4 N4 — the decoy acceptance test could not fail on a mis-aimed throw → **NOT FIXED; strengthened on the wrong axis, and the harness now makes it weaker**

The sign error it was blind to *is* fixed — `src/player/Decoy.js:126` is now
`const dx = -Math.sin(yaw), dz = -Math.cos(yaw);`, matching `Player.forward()`. Credit.

The test is not. `tools/qa/playthrough.mjs:1072-1121` still compares
`entity:heard.at` against `decoy:thrown.at`, and both sides still derive from the same
`_landingPoint()` vector. What was added is an *audibility* precondition
(`AUDIBLE = 13 × 1.9 + 3 = 27.7 m`, plus a real `collision.occlusion` probe at `:658-675`)
— which is a genuine improvement to a different property. R2's recommended assertion, that
the landing point lie along the player's own forward vector, was not added. A sign flip
tomorrow would put the cell ~26 m from the entity — still inside 27.7 m — and the check
would still read PASS.

**And the harness change made the redirect claim weaker, not stronger.** `playthrough.mjs:615-624`
now aims the bot **at the Surveyor** before pressing `T`. `final5`'s report line is:

> `1 of 1 audible throws redirected (0 discarded as inaudible — beyond 28 m or behind a wall: 2.2 m occl 0)`

`2.2 m` is the distance from the Surveyor to the landing point. The cell was thrown
**onto the monster**. The raw stream confirms it: throw at t=148.233 lands at
`(5.4, 0, 24.7)`; the belief at t=148.233 is `(5.2, 0, 24.2)`. A decoy landing 2.2 m from
the thing it is meant to mislead is not a redirect; it is a noise the entity would have
heard from where it was standing. The belief then reverts to the player at t=153.383 —
exactly when the harness's enforced 5 s crouch window ends.

Sample size is still **n = 1 throw per 540 s session**.

### 1.5 N5 — no regression test for the kill-once bug → **FIXED, and it has teeth**

`src/systems/qa/surveyor_sim.mjs` gained a block that reuses **one** entity across two
captures plus an unresolved-capture case. I ran it: **41 passed, 0 failed**, including
`the second capture also kills` and `an unresolved capture lets go instead of latching`.
This is the right shape — every other test in the file builds a fresh entity, which is
exactly why the harness was blind. Good work.

**Unchanged, third round running:** `surveyor_sim.mjs:249` still reads

```js
ok('does not tunnel through the divider', Math.abs(s.position.z) > 0.15 || true);
```

— unconditionally green. And `Surveyor.js:901-904` still translates the body 0.55 m/s with
no `resolveCapsule` call, bounded to 6 s by the timeout at `:917`, i.e. up to **3.3 m** of
geometry clipped per capture.

### 1.6 The R2 headline: `isGated` unioned over homonyms → **FIXED, verified by direct probe**

`src/systems/Progression.js:296`:

```js
isGated(id, zone = null) {
  if (zone) return !!this.portals.get(`${zone}:${id}`)?.locked;
  return !!this._resolve(id)?.locked;
}
```

and `src/world/World.js:408` passes `p.zone`. I built the eight zones headlessly and asked
`Progression` about every id declared in more than one zone:

```
to_plant
   service: reg=open    isGated(id,zone)=false   isGated(id)=false
   cistern: reg=LOCKED  isGated(id,zone)=true    isGated(id)=false
   duct:    reg=open    isGated(id,zone)=false   isGated(id)=false
to_service (×6), to_intake (×2), to_stack (×2), to_residence (×2) — all consistent
```

The Cistern's authored hatch is shut and the Service Spine's lobby door is open. The Plant
is no longer sealed. `chain.mjs` reports **97/97**, `portalgraph` reports all 8 zones
reachable across 19 doors, and `props`, `floorgaps`, `aotest`, `lightreach`, `geobudget` and
`audiowiring` are all green.

Note the residual: `final5`'s end-of-session `gates` list *still contains* `to_plant` —
because `Progression`'s serialiser emits bare ids and the Cistern's hatch is correctly
locked. The field that was the smoking gun in R2 is no longer diagnostic of anything, and
nothing in the report says so.

---

## 2. Score, identical rubric and weights

| # | Dimension | Weight | R1 | R2 | **R3** | Δ(R2) | Weighted |
|---|---|---:|---:|---:|---:|---:|---:|
| 1 | Core loop / moment-to-moment gameplay | 15 | 4 | 4 | **5** | +1 | 75 |
| 2 | Encounter design and player counterplay | 15 | 3 | 5 | **6** | +1 | 90 |
| 3 | Pacing and tension curve | 12 | 4 | 5 | **5** | 0 | 60 |
| 4 | Navigation, legibility, wayfinding | 10 | 2 | 3 | **3** | 0 | 30 |
| 5 | Environmental storytelling and world coherence | 8 | 6 | 6 | **6** | 0 | 48 |
| 6 | Visual quality and art direction | 15 | 4 | 4 | **4** | 0 | 60 |
| 7 | Audio | 10 | 3 | 3 | **3** | 0 | 30 |
| 8 | Technical performance | 8 | 4 | 4 | **4** | 0 | 32 |
| 9 | Onboarding | 4 | 2 | 3 | **4** | +1 | 16 |
| 10 | Content volume and replay value | 3 | 4 | 4 | **4** | 0 | 12 |
| | **Total** | **100** | 36.3 | 41.9 | | | **453 → 45.3** |

**45 / 100. It barely moved, and here is why.**

Three rounds have produced ten judge-found defects and, by the developer's own count, five
more that they introduced while fixing the first five. Every one of the fifteen is a
*mechanism* defect — a sign, a key, a predicate, a map key, a reset. Not one of them was
about what the game looks like, sounds like, or gives the player to do. The dimensions that
carry the most weight are the ones a mechanism fix cannot reach, and they have received no
new evidence at all: **zero capture files newer than 31 July, zero audio re-renders, zero new
performance measurements, one GPU, 496 × 279.** A project cannot score above the low
forties on a rubric where 33 of the points are visual and audio quality while producing no
new visual or audio evidence for two consecutive rounds.

### 2.1 Core loop 4 → **5**

The decoy now throws in the direction the player is looking (`Decoy.js:126`), which turns
the project's fifth pressure verb from actively harmful into functional; the starting
inventory carries a cell (`Inventory.js`), so it is usable from the first minute; and the
Plant is no longer sealed, so the critical path exists in the world and not only in
`chain.mjs`. `chain.mjs` walks arrival lift → three cores → ending through the real
interactor, 97/97.

Against that: `final5` still ends `{"objective":"core_cistern","completed":1,
"cores":{"found":0,"fitted":0},"ended":null}`. **One of seven objectives, zero of four
cores, in every continuous session ever recorded.** `interact:use` is 8. The unguided bot
completed **zero** objectives. And the decoy is still refused whenever
`inventory.handsFull` (`Decoy.js:94`), which is true while carrying a fuse core — the one
sequence the design builds tension around.

### 2.2 Encounter design 5 → **6**

The point R2 withheld is now earned: a working redirect verb is the first counterplay this
game has had that is not "be less noticeable". The kill-more-than-once regression test
locks in R1's headline fix. The entity no longer spawns in the player's face.

Everything else in R1 §1.2 stands verbatim. `grep -c hidden src/entities/Surveyor.js` = **0**
— the six lockers still make you *more* afraid (`Director.js:321`, +0.30) and no harder to
detect. `baseSpeed = lerp(0.82, 1.24, aggression)` (`Surveyor.js:778`) with
`aggression += 0.12` per death (`Director.js:490`), so after `explore3`'s three deaths the
entity moves at **0.97 m/s** against a **2.15 m/s** walk. Lean is still read by nothing.

### 2.3 Pacing 5 → **5** (no change)

The mechanism is now correct — §1.2 — and the delivered curve is not better. `final5`: 5
beats of 4 types in 540 s (one authored event per 108 s), fear median **0.029**, p90 0.400,
above 0.3 for 22.0 %, zero-threat **56.8 %**, 3 threat episodes. Against `ent2`, which R1
called the current state: fear median 0.136, above 0.3 for 30.4 %, zero-threat 28.3 %, 5
episodes. **The player-facing tension curve peaked two rounds ago and has declined since,
while the Director's machinery has improved every round.** `rouse` fired in `fix2` and in
neither `final4` nor `final5`; `lamp_stutter` fired in `final4` only; `final5` fired
`distant_door` twice. No single session has yet demonstrated the whole beat table.

### 2.4 Navigation 3 → **3** (no change)

The per-door nag clock is a real improvement with no telemetry (§1.3), and the level is
unchanged by explicit decision (`PLAYTEST` part eight). No map, no compass, objective banner
still auto-hides at 6.0 s. The unguided evidence is unchanged from R2 because
`explore3` is unchanged: 483 s to leave the starting zone, 2 of 8 zones in 9 minutes, 0
objectives. And §4 below shows that three of the four numbers part eight rests on cannot
carry the weight put on them.

### 2.5 Environmental storytelling 6 → **6** (no change)

All three of R1's surviving deductions are intact. `keys_ring` and `card_contractor` still
have **no spawn site in any zone file** — the builders exist (`Interactables.js:1841`,
`:1767`), the item definitions exist (`Inventory.js:41,53`), the payoff line
`'Reader rejects it. Your card was issued in March.'` exists (`Interactables.js:919`), and a
comment added *this round* in `Inventory.js` quotes the note that promises them:
*"one lamp, one spare cell, one set of keys, one pager"*. The keys are still not in the
game. `ENDINGS.DESCENDED` is still unreachable: the only `setPower(true)` is
`Progression.js:353` inside the `gen:running` handler, which also sets `setRunning = true`,
so `:365`'s `this._end(this.setRunning ? LEFT : DESCENDED)` can only ever produce `LEFT`.
The pry bar still opens nothing — `jammed` appears in no zone descriptor.

### 2.6 Visual quality 4 → **4** (no change)

`find docs/captures -newermt "2026-08-01 00:00"` returns exactly one file, and it is the
`geobudget.json` my own tool run touched. **No frame has been captured since 31 July.** The
Stack, the Cistern, the Ductwork and the Residence have not been re-shot in either round
since I first asked; the three zones at 94–95 % crushed pixels have no new measurement; the
Residence still has no valid player's-eye frame; the tour is still 496 × 279 and 7 of its 24
frames are still invalid; `world.goto()`'s silent failure is still unchased. The fixture
work in `ZoneKit.js` (the strip tube dropped from +0.002 to −0.024, the aimable high bay,
the pendant shade joining the emissive instance) is real and well-argued — and it was
captured on 31 July, before R2. Nothing has photographed it since.

### 2.7 Audio 3 → **3** (no change)

`docs/verification/audio/` last written 31 July 09:45. Unchanged for the third round. R1's
measurements therefore stand: `scenes/surveyor.wav` moves **2.9 dB** of short-term loudness
over a 75-second entity encounter, `scenes/breaker.wav` 4.0 dB, the beds sit at −11.6 to
−12.8 dBFS RMS with peaks at −2.7 to −3.3, so an ambience bed occupies the whole delivery
headroom. Brief §7 asks for audio "listened to, judged, fixed where wrong". None of the
three has happened in three rounds.

### 2.8 Technical performance 4 → **4** (no change)

No new measurement. `docs/EVALUATION_2026-07-31.md` is the same single Apple M4 /
ANGLE-Metal pass; the shipping high tier still misses 60 fps on it. `final5` still reports
`FAIL — the frame loop never stalls (no frame > 5 s)` at **48 067 ms**, red for the life of
the tool. `GradePass.AUTO_EXPOSURE` and `ExposureAdaptation.read()` are good diagnostics
work — they close the gap where harnesses waited on a constant that never moved — but they
are instrument, not performance.

### 2.9 Onboarding 3 → **4**

`src/ui/Pause.js` now lists `V` (*"Cover the lens — silent. The switch clicks; your hand
does not"*), `B` and `T`, with copy that teaches the mechanic and not just the binding.
`chain.mjs` gained a check that every bound key appears on that list. This landed during
this assessment and it is R1's second-highest-value onboarding ask.

Still missing: the staged first encounter that `Surveyor.js:22-24` says is how the player
learns the freeze rule. And the screen still advertises `['G', 'Set down carried item']`
while `drop: ['KeyG']` (`Input.js:22`) has no reader anywhere and
`Inventory.dropCarried()` (`Inventory.js:197`) still has zero call sites in `src/` — see
§3, D6.

### 2.10 Content volume and replay 4 → **4** (no change)

The Plant is reachable again, which restores access to content that already existed. No new
content, no branching, one of three endings still unreachable.

---

## 3. Audit of the newest and least-reviewed code

Ten findings, ordered by how much they matter. Every one is verified against the current
source; four are corroborated by a tool I ran or by delivered telemetry.

### D1 — **the new `chain.mjs` homonym check is an identity comparison and cannot fail against the current source**

**Severity: high — evidence defect, guarding the most serious bug the project has had.**

`tools/qa/chain.mjs:647-654`:

```js
const own  = progression.portals.get(`${zid}:${id}`);
if (!own) { bled.push(`${zid}/${id} (never registered)`); continue; }
const said = progression.isGated(id, zid);
if (said !== !!own.locked) { bled.push(...); }
```

and `src/systems/Progression.js:296`:

```js
isGated(id, zone = null) {
  if (zone) return !!this.portals.get(`${zone}:${id}`)?.locked;
  ...
}
```

With a truthy `zone`, `isGated(id, zid)` **is literally** `!!portals.get(`${zid}:${id}`)?.locked`
— which is `!!own.locked`. The comparison on line 650 reduces to `x !== x`. The registration
branch (`!own`) still has teeth, and that is what catches the *original* bare-id keying
("15 portals never registered"), and the union bug is caught because that version had a
different `isGated`. But against the code as it stands, and against any future change that
keeps the two-arg path reading the map, the check is green by construction.

Worse, **it never calls the form the game was calling when the bug shipped.** `World.js`
used `isGated(p.id)` — the bare form — and `src/ui/UI.js:439` still uses the bare form for
`gateReason`. The check passes `zid` itself, so a regression in which someone drops the
`p.zone` argument at `World.js:408` leaves `chain` at 97/97 and reseals the Plant.

The developer's own §25 presents this as "the invariant that cannot be skipped away". It
is skipped away by the signature.

**Cheapest fix, two lines:** assert the expression `World.update` actually evaluates —
`progression.isGated(id)` (bare, no zone) — against the registration of the portal in the
zone the player is standing in, for every homonym, from each zone in turn. That form does
route through `_byId`'s union-or-sort logic and would have failed on both historical bugs
*and* on a dropped argument.

### D2 — **the coverage denominator silently discards every floor rectangle narrower than 2 m; the Ductwork grids to zero, and standing in it inflates the building-wide figure**

**Severity: high — this is the ruler §4 of this report and part eight of the developer's log
both depend on.**

`tools/qa/explore.mjs:654-685` (`EX.gridZone`) builds the denominator by testing the
*centres* of 2 m cells that fall strictly inside a `collision.floors` rectangle
(`if (x < f.minX || x > f.maxX || z < f.minZ || z > f.maxZ) continue;`). A rectangle
narrower than `CELL = 2.0` on either side contains no cell centre and contributes **nothing**.

I ran that exact algorithm over all eight zones with every zone resident:

| zone | floor rects | rects < 2 m on a side | raw floor area | gridZone denominator | ratio |
|---|---:|---:|---:|---:|---:|
| intake | 4 | 0 | 3 969 m² | 3 628 m² | 0.91 |
| service | 35 | **23** | 447 m² | 176 m² | **0.39** |
| cistern | 33 | 27 | 433 m² | 360 m² | 0.83 |
| residence | 21 | **10** | 245 m² | 68 m² | **0.28** |
| plant | 51 | 45 | 1 054 m² | 868 m² | 0.82 |
| **duct** | 7 | **7** | 36 m² | **0 m²** | **0.00** |
| stack | 4 | 0 | 196 m² | 176 m² | 0.90 |
| safe | 1 | 0 | 26 m² | 12 m² | 0.46 |

Consequences, all arithmetic:

- **The Ductwork can never appear in a coverage number.** `coverage()` returns
  `fraction: w > 0 ? … : null` (`explore.mjs:141`), so it reports `null`.
- **And walking it inflates the building-wide figure.** `explore.mjs:142` is
  `totV += Math.min(v, w || v); totW += w;`. With `w === 0`, `w || v` is `v`, so every cell
  visited in the Ductwork is added to the *numerator* while adding nothing to the
  denominator.
- **`explore3`'s "service: 84.1 % covered" is really about 33 %.** 37 cells × 4 m² = 148 m²
  of the Service Spine's 447 m² of floor.
- The Intake's 48.8 % is the *only* coverage figure in the delivered evidence whose
  denominator is close to right (91 %), and it is the one the assertion at
  `explore.mjs:1246` happens to be applied to.

The tool's own "What this tool cannot tell you" section (`explore.md:498-500`) is honest
that coverage counts rooms behind locked doors — it says nothing about the 2 m grid dropping
most of the floor in six of eight zones.

**Cheapest fix:** rasterise by rectangle *overlap* rather than by centre containment, or
snap the grid per-rectangle. Ten lines. And make `coverage()` refuse to add to the numerator
what it cannot add to the denominator.

### D3 — **`distanceMetres` and the sampled path disagree by 1.79×, and the assertion uses the larger one**

`explore.mjs:940` accumulates per-frame XZ displacement at 60 Hz. `explore3` reports
**1 731.7 m** in 540 s (3.21 m/s). Summing the 1 s-sampled positions from the same run gives
**965.7 m** (1.79 m/s), and the sampled speed distribution is p10 0.45 / p50 **2.07** / p90
2.14 m/s — i.e. the bot is walking (`Player.js:185` walk = 2.15 m/s), not sprinting: only
0.2 % of samples exceed 3.0 m/s. A per-frame sum that is 79 % larger than the sampled path
of a body moving in near-straight lines at 1 s resolution is measuring wobble, strafe and
collision slide, not ground covered. The check at `explore.mjs:1237-1238` prints the larger
number as *"1732 m in 540 s"* and the report table calls it "Ground covered". Nothing
reconciles the two.

### D4 — **the decoy check now passes on a cell thrown at the monster** — see §1.4. `final5`: one throw, landing **2.2 m** from the Surveyor, belief 0.5 m from the cell, PASS.

### D5 — **`surveyor_sim.mjs:249` is still `|| true`**, third round, and it is the one assertion that would catch the uncollided CAPTURING move at `Surveyor.js:901-904`.

### D6 — **the new pause-screen check is one-directional, and the known-false direction is the one it does not guard**

`chain.mjs:591-601` iterates `Input.ACTIONS` and asserts every bound key appears in
`Pause.CONTROLS`. It does not assert the converse. `drop: ['KeyG']` (`Input.js:22`) is bound,
so it satisfies the check; nothing reads `pressed('drop')` anywhere in `src/`;
`Inventory.dropCarried()` (`Inventory.js:197`) has zero call sites; and `Pause.js` still
prints `['G', 'Set down carried item']`. The screen the player opens in their first minute
still advertises a verb that does not exist, and the check written this round to police that
screen is green over it.

### D7 — **no instrument in the project records where the Surveyor is, only how far**

`playthrough.mjs`'s entity sample is `{active, state, stateTime, dist, illum, conf, speed}`.
`director:entity-placed` and `director:entity-followed` carry `at`, `range` and `hunting` —
no bearing, no position. This is precisely why N1 (spawning in the player's face) survived
two rounds and why its fix cannot be confirmed by anything but reading the code. One field
— `dot(normalize(entity − player), Player.forward())` — closes it, and makes both the
placement and the decoy-aim assertions writable.

### D8 — **`Progression._byId`'s primary zone lookup is dead**

`src/systems/Progression.js:238`: `const here = this.player?.game?.currentZone ?? this.director?.zone ?? null;`.
`Player` has no `game` property — I grepped `src/player/Player.js` — so this is always the
Director's zone. It works today. It reads as if it resolves from the player, it does not, and
a `Director` that has not yet seen a `zone:enter` falls back to `'intake'` (`Director.js:151`).
Same file, `_resolve` (`:244`) still tries `this.portals.get(id)` first, which can never hit
now that the keys are `zone:id`.

### D9 — **the repeat-fall recovery puts the player back beside the hole they fell through**

`src/Game.js:354`: on a second fall within 12 s, `_anyFloorNear(this.player.position.x,
this.player.position.z)` searches from the XZ where the player fell, so it returns the
nearest built floor *to the gap*. The destination is properly proven standable (capsule +
headroom, `Game.js:628-635`), and the 0.75 s cooldown at `:350` plus the `_anyFloorNear`
fallback in `_settleRespawn` have genuinely killed the 5 992-event loop this replaced. But
the player is returned to the lip of the same hole; the 12 s window then lapses and the
third fall routes back through `respawn()`. It is a bounded oscillation rather than a
recovery from the cause. Low severity now that the two-probe door test shuts doors onto
nothing, which is the correct place to have fixed it.

### D10 — **the two-probe door test exempts anything within 1.6 m of a portal**

`src/systems/ZoneGameplay.js:134-137` builds `nearPortal` as a 1.6 m XZ / 2.2 m Y sphere
around each portal point, and `:177-178` is `const passable = isPortal || sides.every(...)`.
The exemption is necessary — the far side of a portal is 400 m away and cannot be
sampled — but it is granted by *proximity*, not by identity, so any ordinary door hung
within 1.6 m of a portal inherits the free pass and never gets the floor test. Cheapest fix:
match the door to the portal by id or by the leaf's own object, not by radius.

**Also unchanged since R1:** `ZoneGameplay.js:103-106` still wraps each of the four install
phases in its own `try/catch`, so a throw in `_props` still leaves a zone with doors and no
interactables and the game continues.

---

## 4. Is `tools/qa/explore.mjs` trustworthy? Metric by metric

R2 found the cue metric was mostly measuring its own cull radius; the developer accepted
that and correctly did not change the level. Here is the same treatment for the rest.
`SEE = 14.0` (`:484`) and the ≤ 2.2 m in-reach free pass (`:623`) are unchanged, so R2 §3
stands as written.

| metric | may a designer act on it? |
|---|---|
| **falls / off-floor frames** | **Yes.** The most valuable thing in the tool. It found `service_door3` opening onto a hole, which nothing else could. Caveat: `explore3`'s y range is **0.00 to 0.00** across all 32 400 frames — the run never changed level, so nothing vertical was exercised. |
| **objectives completed (0)** | **Yes.** The trigger is verified sound and the bot simply never arrived. A true statement about the bot. |
| **zones reached (2 of 8)** | **Weakly.** True, but it is a consequence of the 483 s below, not independent evidence. |
| **coverage** | **Only for the Intake.** See D2: the denominator is 91 % right in the Intake, 39 % in the Service Spine, 28 % in the Residence and **0 %** in the Ductwork. Cross-zone comparison is measuring rectangle granularity. |
| **revisit rate (24.6 %)** | **No.** It is `1 − fresh/entries` over cell-boundary crossings, so it is a monotone function of how saturated the zone already is. It falls when a bot is discovering and rises when it is not, and it is not comparable across sessions of different length or across zones with different denominators. It carries no information the coverage curve does not. |
| **"lost" stretches (longest 14.6 s, 3 %)** | **No.** "No new cell in N seconds" cannot fire while a moving bot is under 50 % coverage. `explore3`'s median `sinceNewCell` is **0.7 s**, p90 4.1 s, max 14.5 s, against a 25 %-of-session threshold — the assertion at `:1259` is structurally unable to fail until coverage saturates, which it never does. |
| **stall detection (0 stalls)** | **No.** `STALL_RADIUS 1.6 m` for ≥ 12 s cannot fire on a body whose 1 s-sampled median speed is 2.07 m/s and which is below 0.5 m/s for 10.1 % of samples. It measures a jammed bot, not a hesitating player. `PLAYTEST` part eight and §31 both quote "0 stalls" as a result; it is a vacuous pass. |
| **time to leave the starting zone (483 s)** | **No — and this is the one part eight leans on hardest.** Intake coverage was 48.8 % (422 of 864 cells) at t = 482.6 s; the exit was crossed at t = 483.4 s. If the exit were one arbitrary cell of the 864, the median time to find it *is* the time coverage passes 50 %, which this run never reached. **The measured 483 s is the null model's answer to within a second.** The coverage curve is close to linear throughout (10 % at 86 s, 25 % at 244 s, 40 % at 383 s), so there is no inflection to attribute to the level. The number says the walker has no exit-seeking behaviour — `chooseHeading` states "there is no goal term because there is no goal" (`:687`). It does not say the exit is badly signposted. |
| **cueless fraction (83.7 %)** | **No** — R2 §3, unchanged. |

**Verdict on part eight.** Of the four numbers it rests on — 483 s, 2 of 8 zones, 0
objectives, 48.8 % coverage — **one is a restatement of the coverage curve, one is derivative
of it, one has a denominator that is only sound in the zone it was applied to, and one is
sound.** The developer's *conclusion* — do not change the level on a number you cannot
evaluate — is right, and it is more right than the argument given for it: the reason not to
act is not merely that the cue metric was an artefact, it is that three of the four
surviving rulers cannot support a level change either.

**What the tool does have that is trustworthy:** the fall detector, the interaction log
(10 interactables operated unguided, including reading `nb_1` at 0:22.6), the zone sequence,
the progression state, the `--selftest` metric checks against constructed answers, the
`--verify` truncation mode, and the honesty of `explore.md:485-503`. That is a real
instrument with three metrics that work and five that do not, and nothing in the report
separates them.

---

## 5. Completion report — what remains OPEN and CRITICAL after three rounds

Ranked by impact ÷ effort. **[B]** = bug, **[C]** = missing content, **[H]** = design
decision that needs a human.

| # | | Defect | Evidence | Cheapest intervention |
|---|---|---|---|---|
| 1 | **[B]** | **Hiding does nothing.** Six lockers; `grep -c hidden src/entities/Surveyor.js` = **0**; `Director.js:321` adds **+0.30 fear** for hiding and `:227` grants 30 s grace. Getting in a locker makes you more afraid and no harder to detect. | source, all three rounds | In `Surveyor.hear()`, multiply `strength` by ~0.15 when `player.hidden`. ~3 lines, and it makes six authored props into a mechanic. |
| 2 | **[H]** | **The chase is unlosable.** `baseSpeed = lerp(0.82, 1.24, aggression)` (`Surveyor.js:778`); `aggression += 0.12` per death (`Director.js:490`) → 0.97 m/s after three deaths against a 2.15 m/s walk (`Player.js:185`). Capture needs 1.15 m, which only happens to a player who has stopped. | source + `explore3` (3 deaths, all after the bot stopped) | Raise the APPROACHING multiplier so the entity beats a walk and loses to a sprint. A human must pick the number; it is the single largest lever on dimension 2. |
| 3 | **[B]** | **`ENDINGS.DESCENDED` is unreachable.** The only `setPower(true)` is `Progression.js:353` inside `gen:running`, which also sets `setRunning = true`; `:365` therefore always yields `LEFT`. One of three endings. | source, three rounds | Power `lift_2` from something other than the generator, or make the ending test something other than `setRunning`. |
| 4 | **[C]** | **`keys_ring` and `card_contractor` have no spawn site.** Builders, item defs, refusal payoff line (`Interactables.js:919`) and the note that promises them all exist; the placement does not. | grep across `src/world/zones/*.js` | One `{ kind: 'pickup', item: … }` line per item. Two lines closes a three-note narrative thread. |
| 5 | **[B]** | **The pry bar opens nothing.** `ServiceZone.js:841` says two doors are jammed and it is the only thing that opens them; `jammed` appears in no zone descriptor. | grep | Author `jammed: true` on two doors, or delete the pry bar. |
| 6 | **[B]** | **D1 — the critical-path guard cannot fail.** `chain.mjs:649` compares `isGated(id, zid)` against the map entry `isGated(id, zid)` reads. A dropped `p.zone` argument at `World.js:408` reseals the Plant with `chain` still at 97/97. | ran `chain.mjs`; §3.1 | Assert the bare-id form from each zone in turn. Two lines. |
| 7 | **[B]** | **D2 — coverage denominator drops sub-2 m rectangles.** Ductwork 0 cells and inflating the overall figure; Residence 28 %, Service 39 % of true floor. | own run of `gridZone` over all 8 zones | Rasterise by overlap, not centre containment. ~10 lines. |
| 8 | **[B]** | **The decoy is refused while carrying a fuse core** (`Decoy.js:94` → `Inventory.js:123` `encumbered`), and the refusal renders as *"REQUIRES BOTH HANDS ARE FULL."* (`UI.js:491` + `Prompts.js:61`). The one redirect verb is unavailable during the one sequence built around tension. | source | Either allow the throw (it costs a cell) or say why in a sentence. And stop prefixing every refusal with "Requires". |
| 9 | **[B]** | **No instrument records the entity's bearing** (D7), so N1's fix, the decoy's aim, and any future staging are unfalsifiable. | sample schema in `final5/playthrough.json` | Add one field to the entity sample and one assertion each to `playthrough.mjs` and `surveyor_sim.mjs`. |
| 10 | **[H]** | **The four dark zones have not been photographed since 31 July.** Stack/Cistern/Ductwork at 94–95 % crushed; Residence with no valid player's-eye frame; whole tour 0.14 MP; `world.goto()`'s silent failure still unchased at a 8–25 % frame-corruption rate. | `find docs/captures -newermt "2026-08-01"` → 1 file, and it is mine | One capture run at ≥ 1280×720 with the validity guard on. This is the largest single block of unevidenced score in the rubric (15 points). |
| 11 | **[H]** | **Nobody has listened to the audio.** 117 rendered `.wav`, unchanged since 31 Jul 09:45; `scenes/surveyor.wav` moves 2.9 dB over 75 s; beds at −11.6 to −12.8 dBFS RMS. | R1 measurements, files byte-identical | Pull the beds 15 dB at the bus, re-render, and check the short-term range of `scenes/surveyor.wav` exceeds 12 dB. The measurement is the acceptance test. |
| 12 | **[H]** | **The Intake takes a novelty walker eight minutes to leave** — and §4 shows the number cannot distinguish the level from the walker. | §4 | This one needs a person, not a tool. Nothing in the repository can settle it. |
| 13 | **[B]** | Residual instrument defects: D3 (`distanceMetres` 1.79× the sampled path), D4 (decoy test aims at the monster), D5 (`surveyor_sim.mjs:249` `\|\| true`), D6 (`G` advertised and dead), D8 (dead `player.game` lookup), D10 (1.6 m portal exemption). | §3 | Each is one to ten lines. |
| 14 | **[B]** | **No gated portal has ever been walked through, in the entire history of this project.** `final5` changes zone four times by `qa:scripted-zone-change`; `explore3` reached two zones and met one gate. The two bugs that sealed the building both lived in exactly this blind spot. | event census, all sessions | Seed one `explore` run to start in the Service Spine, or add a scripted phase that walks `to_cistern` on foot after `gate()` opens it. |

Standing failures, both honest and both red for the life of the tool: `no frame > 5 s`
(48 067 ms in `final5`, a SwiftShader first-frame compile) and the shipping high tier not
reaching 60 fps on the one GPU ever measured.

---

## 6. What no amount of tooling in this project can currently tell anyone

Concretely, and each with the reason it is unknowable rather than merely unknown:

1. **Whether the game is frightening, or whether a person gets lost.** No human has ever
   played it. Every tension number in three rounds of documents — mine included — describes
   either a 43-phase scripted route that cannot get lost, or a novelty walker with, in its
   own words, "no goal term because there is no goal". Getting lost is what this game is
   for, and the only instrument for it is a walker whose time-to-exit is indistinguishable
   from its own coverage curve (§4).

2. **What the game sounds like.** 117 `.wav` files exist and are measurable; whether the
   fluorescent hum sounds like a fluorescent, whether footsteps read across four surfaces,
   whether the Surveyor has mass, and whether the Annex is frightening in the dark with
   headphones on are all unjudged by anyone, human or machine. There is no listening note
   in the repository.

3. **Anything visual above 496 × 279**, except six frames at 896 × 504 of the three zones
   that were never the problem. Normal-map seams, texture stretching, shadow acne,
   z-fighting, transparency sorting and temporal stability — the whole of brief §5's
   inspection list — are not resolvable at 0.14 MP, and no frame at any resolution has been
   taken since 31 July.

4. **Frame rate anywhere but on one Apple M4 through ANGLE/Metal at one resolution.** Every
   other performance number in the project is SwiftShader. Nothing here says anything about
   a discrete mid-range GPU, an Intel iGPU, or the 90th-percentile browser.

5. **What the second half of the game plays like.** `chain.mjs` proves the critical path is
   *completable through the interactor* — 97/97, arrival lift to goods lift, three cores,
   one ending. It has never been *walked*. Zero of four fuse cores has been picked up in any
   continuous session; one of seven objectives has ever completed; three of the eight zones
   have no continuous telemetry at all.

6. **Whether the Surveyor is placed behind the player** — or the decoy thrown forward, or
   any other directional property of the entity. Nothing records a bearing (D7). Both sign
   errors that shipped this round were found by reading, not by measuring, and a third would
   be found the same way or not at all.

7. **Anything about the Ductwork.** It has zero doors in `chain`'s census, **zero walkable
   cells** in `explore`'s coverage grid (D2), zero continuous-session telemetry, and zero
   valid tour frames. Four independent instruments look at that zone and see nothing.

8. **Whether a locked door now explains itself**, whether the entity-follow feels like an
   ambush, whether the per-door nag is too chatty or too quiet — every player-facing
   behaviour fixed this round landed with no session that exercises it. `final5` records
   zero `portal:locked` events and one decoy throw.

9. **Whether any of the fixture work since 31 July made the building look better.** The
   strip tube, the aimable high bay and the pendant shade are well-argued geometry changes
   with a measurement behind each. No frame has been captured since they landed.

10. **Whether `npm run audit` is green over anything real.** I did not run it. This
    project's own history is now *eleven* instances of a green check over a broken thing —
    six the developer documented, `surveyor_sim.mjs:249` (still open), the decoy redirect
    check (§1.4), the stall assertion (§4), the pause-screen check (D6), and the
    critical-path homonym check written this round (D1). The base rate on green checks in
    this repository is not good enough for a green suite to be evidence.

---

## 7. Closing

Three rounds, fifteen defects, and every one of them found by a measurement or by reading
the source — never by playing. The project's engineering culture is genuinely unusual: it
writes down its wrong answers, it retracts its own verdicts (parts 14, 19, 25, 26, 27), and
when I told it a number was an artefact it did not act on the number. Five of the ten
judge-found defects were introduced by the fixes for the other five, and the developer says
so in their own summary. That honesty is real and it is most of why the score moved at all.

But the arithmetic of the rubric is unsentimental. 45/100 is *"a technically careful,
unusually well-reasoned foundation with an original art identity, whose mechanisms now
mostly work, whose antagonist still cannot catch a walking player, three of whose zones are
94–95 % black, whose mix has three decibels of range, and which no person has ever played."*
The next five points are not in the code. They are in a capture run, a listening session,
and one human being lost in the Intake for eight minutes and saying why.
