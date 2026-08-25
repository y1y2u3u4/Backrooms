# The capture frames were never aimed

**Date:** 2026-08-25
**Applies to:** every PNG under `docs/captures/` written before this date, and
every visual judgement in `docs/JUDGE_R1.md`, `JUDGE_R2.md`, `JUDGE_R3.md`,
`EVALUATION_2026-07-31.md` and the completion reports that rests on one.

## What was wrong

`Game.lookOpen(pos, prefer, pitch)` is a **query**. It searches for an open
sightline and returns `{position, yaw, clear, degenerate}`. It moves nothing.

115 of the 135 shots that called it called it as a bare statement:

```js
g.world.goto('duct');
...
g.lookOpen(r, g.world.spawnYaw || 0, 0.0);     // result dropped on the floor
```

So those shots were never posed. Each one photographed whatever pose
`world.goto` happened to leave the player in — the zone's spawn, facing the
spawn heading. Frames named `intake_ceiling`, `stack_up`, `service_spine`,
`04_intake_look_back` and `ao_02_off_ceiling` are all pictures of the same
forward view from the spawn point of their zone.

21 of the 24 shot lists were affected, including `shots.judge.json` (13 shots),
which is the list the visual-quality scoring was built on.

## What it cost

`09_duct` came back 93–94 % crushed across four separate runs. It was read as
evidence that the Ductwork was unlit, and four rounds of work followed:

| change | delivered irradiance | frame crushed |
|---|---|---|
| baseline | 93 % under-lit, mean 8.77 | 0.942 |
| fittings `OUT.bulk` 0.50 → 1.60 | 0 % under-lit, mean 19.12 | 0.943 |
| ambient fill 0.30 → 0.85 | — | 0.935 |
| capture camera crawl-height fixes | — | 0.936 |

The frame would not move because the frame was not of the zone.

Reading the **live canvas** directly, at the authored values, with the two
lighting changes reverted:

| zone | crushed | mean luminance | head lux | fixtures lit |
|---|---|---|---|---|
| **duct** | **0.000** | **169.4** | 3.92 | 25/25 |
| intake | 0.000 | 146.4 | 44.14 | 184/254 |
| service | 0.038 | 104.3 | 17.65 | 72/74 |

The Ductwork is the **brightest** zone measured, not the darkest. Both lighting
changes were reverted; they were made to move a number that never measured the
zone.

## Contributing defects, all now fixed

1. **`lookOpen` as a command** — 115 shots rewritten to `g.lookAtOpen()`, which
   queries *and* poses, and poses from the position `lookOpen` actually found
   rather than the one it was handed. `tools/qa/shotlint.mjs` fails the audit if
   a bare call comes back; the check is mutation-tested.
2. **`capture.mjs` never checked build freshness** — it tested only that
   `dist/index.html` *existed*, which is true of a bundle from any point in
   history. `perf.mjs` had this fixed and nothing else did. The check now lives
   in `tools/qa/freshbuild.mjs` and both call it.
3. **`lookOpen` refused any headroom under 1.75 m** — impossible in a 0.80 m
   crawlway, so no camera was ever placed there. Now parameterised, with a
   0.55 m relaxed retry and a warning when nothing is placed.
4. **The probe and the posed camera used a fixed 1.6 m eye height** — above the
   duct's roof. Now `min(1.6, max(0.45, clear - 0.30))`.
5. **`look()` stepped the player once**, so `crouchAmt`/`crawlAmt`, damped at 11
   and 9, never settled. Now 40 steps.
6. **`look()` accepted a non-finite pose silently** — `g.world.spawn` is an
   *array*, so a setup written as `r.x` passed `undefined`, and the camera went
   to NaN and rendered black while the status line printed `head NaN` and the
   run carried on. It now refuses and logs an error.

## What this does not tell you

Nothing here says the other seven zones look good or bad. It says the frames
they were judged from were aimed at the spawn rather than at what their names
claim. **Every visual conclusion in the documents listed at the top has to be
re-derived from re-captured frames before it can be relied on.** That work has
not been done.

---

## The re-captured sheet (2026-08-25, docs/captures/judge_reaimed)

15 shots, cameras actually posed. Eight are healthy and readable:

| frame | crush | note |
|---|---|---|
| 01_intake_spine | 0.033 | ceiling grid, dado, receding corridor |
| 02_intake_bay | 0.043 | |
| 03_intake_ceiling | 0.011 | |
| 04_intake_look_back | 0.048 | |
| 05_service_corridor | 0.031 | |
| 07_residence_corridor | 0.013 | pendants, wallpaper, notice board |
| 13_surveyor_mid | 0.037 | was 0.400 while unposed |
| 14_surveyor_close | 0.030 | was 0.641; the Surveyor is in frame |

Two are flagged CRUSHED and should not be: `08_plant_hall` 0.429 and
`09_plant_wide` 0.462. Both are correct pictures of a tall industrial hall lit
by downward high bays — brick, gantries, pipework, light cones — and what the
metric is calling crushed is the ceiling void above the bays, which is supposed
to be black. This is the artifact tool mis-scoring a working frame, not a
lighting fault.

Four are dark because the shot itself kills the circuits, which is the point of
the shot: `06_cistern_water` (4 of 24 lit), `10_duct_crawl` (11 of 25),
`11_stack_shaft` (head 0 lux), `15_lamp_in_the_dark` (`live:none`, the whole
building off). Crushed is expected. They are also close to useless as judging
material, which is worth deciding about separately.

### 12_safe_room: not a rendering fault — the third variant

Called a probable rendering fault when first seen, on the strength of hard-edged
black rectangles across flat cream wall panels. That was wrong, and the number
that settled it was the workload rather than the picture:

    in the sheet   12_safe_room   205 calls   888k tris
    in the sheet   11_stack_shaft 201 calls   885k tris     <- the shot before it
    on its own     12_safe_room   119 calls    66k tris

In a sheet run the shot rendered the STACK, with the safe room's electrics live
over the top of it — `[safe lit 5/5 head 15.2]` was true and described a zone the
camera was not standing in. Captured on its own the same shot gives a correct
safe room: damask wallpaper, dado rail, filing cabinet, wall lamp, torch pool,
crush 0.148. An in-page reproduction of the same pose matches it exactly.

Two suspects were eliminated on the way, and both are worth recording because
both were plausible:

  * the baked AO volume, which turned out to be doing its job. Zeroing
    `uAOStrength` at runtime took the frame from 0.225 crushed to 0.101 — over
    half the crushed pixels — but the AO-on picture is the good-looking one, and
    with `uAOFloor` at 0.35 the term cannot drive indirect below 41.5 % anyway,
    so it can push a dim pixel under the threshold but cannot make black.
  * shadow maps, which moved it 0.225 -> 0.211. Not the variable.

`Game.assertCameraInZone()` now compares where the camera is against the bounds
of the zone the game says it is in, and warns with both. Nothing else in the
harness compared those two things, which is why three shots could render the
wrong room while every readout in the status line agreed that all was well. It
warns rather than throws, because a shot taken from a doorway or a portal is a
legitimate thing to want and this cannot tell the difference — what it can do is
stop the disagreement being silent.

### Still open

Nothing from the judge sheet. The Ductwork's between-pool darkness (see the
constant in DuctZone.js) and the four zones at roughly 2.4x the draw-call budget
are the open visual items, and neither came from this sheet.

### Draw calls, measured per zone for the first time

The figure carried until now was 268 against a budget of 180, from a scenario
list that only covered the Intake. The re-aimed sheet reports the real spread:

    07_residence_corridor   457
    15_lamp_in_the_dark     439
    05_service_corridor     433
    08_plant_hall           424
    13/14_surveyor          327
    01/02/04_intake         297

Four zones sit at roughly 2.4x budget, not one zone slightly over.
