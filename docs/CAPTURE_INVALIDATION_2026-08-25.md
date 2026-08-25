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
