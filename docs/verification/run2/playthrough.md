# THE ANNEX — continuous playthrough

Generated 2026-07-30T07:31:30.458Z by `tools/qa/playthrough.mjs`.

**26850 frames · 447.5 s of simulated play at a fixed 1/60 step · 534 s of wall clock · quality `low` · 640×360**

This is the first continuous session ever run on this build. Movement, sprint, crouch, the
lamp key and the interact key are real DOM keyboard events; mouse look is written into the
field a locked pointer would write, because headless Chromium cannot grant pointer lock.
Frame times come from a CPU rasteriser and are not a frame-rate verdict.

## Assertions

| | check | detail |
|---|---|---|
| **PASS** | no console errors during the session |  |
| **PASS** | player position never NaN | 0 frames |
| **FAIL** | player never falls through the floor | y 0.00..2.60; frames not standing on a floor: 1969 of 26850 (worst consecutive run 1248) |
| **FAIL** | the frame loop never stalls (no frame > 5 s) | max 9407 ms, p99 7 ms, p50 0.20 ms |
| **PASS** | post-warmup frame times stay bounded (p99 < 250 ms) | warm p50 0.20 ms, p90 0.40 ms, p99 6.50 ms |
| **PASS** | simulated time advanced continuously | 26850 frames |
| **PASS** | at least one entity state transition occurred | DORMANT->ROUSED@54.58s, ROUSED->SEEKING@58.08s, SEEKING->MEASURING@68.45s, MEASURING->SEEKING@73s, SEEKING->MEASURING@76.3s, MEASURING->SEEKING@82.73s, SEEKING->MEASURING@86.03s, MEASURING->RETREATING@91.47s, RETREATING->ROUSED@93.77s, ROUSED->SEEKING@97.27s, SEEKING->APPROACHING@97.28s, APPROACHING->MEASURING@99.1s, MEASURING->SEEKING@100.28s, SEEKING->APPROACHING@100.3s, APPROACHING->CAPTURING@115.33s, CAPTURING->DORMANT@120.9s |
| **PASS** | audio subsystem reports as constructed | subsystems.audio=true, ctx state=running |
| **PASS** | footsteps fired while walking | 600 player:step events |
| **FAIL** | every zone visited reported lit fixtures | min active lights = 0 |

**3 check(s) failed.**

## Pacing

- **Session length:** 447.5 s (7.5 min) of play.
- **Zero-threat time:** 81.4% of samples had no active entity and fear below 0.15.
- **The Surveyor was active at some point.**
- **Threat episodes:** 1 — 65.5s (ROUSED→SEEKING→MEASURING→RETREATING→APPROACHING→CAPTURING, closest 0.66 m)
- **Fear:** median 0.027, p90 0.152, peak 0.565. Above 0.3 for 5.5% of the session, above 0.5 for 1.2%.
- **Director beats fired:** 0 (none — the quiet floor is 95 s and `nextBeatAt` starts at 150 s)
- **Longest stretch with nothing on the bus except footsteps:** 447.5 s (0:00.0 → 7:27.5).
- **Moving:** 63% of samples.
- **Zones:** intake (0:00.5–5:13.0) → service (5:14.5–6:04.5) → cistern (6:06.0–7:01.0) → safe (7:02.5–7:27.5)

### Frame time (CPU rasteriser — not a frame-rate verdict)

| | p50 | p90 | p99 | max |
|---|---:|---:|---:|---:|
| whole session | 0.20 | 0.40 | 6.50 | 9407 |
| after 3 s warmup | 0.20 | 0.40 | 6.50 | 9407 |

All in milliseconds. The multi-second outliers are first-frame shader compiles
after a camera or zone change, which is a property of SwiftShader, not of the renderer.

## Event census

| event | count |
|---|---:|
| `player:noise` | 605 |
| `player:step` | 600 |
| `entity:tick` | 289 |
| `entity:heard` | 56 |
| `qa:phase` | 21 |
| `entity:state` | 16 |
| `lamp:toggle` | 5 |
| `zone:leave` | 3 |
| `world:teleport` | 3 |
| `zone:enter` | 3 |
| `qa:scripted-zone-change` | 3 |
| `director:entity-placed` | 1 |
| `game:death` | 1 |
| `cine:begin` | 1 |
| `cine:end` | 1 |
| `game:respawn` | 1 |
| `zone:unload` | 1 |
| `progress:discovery` | 1 |

## Timeline

State every 5 s; every non-footstep event at the moment it fired. Footsteps and noise
events are counted in the census above rather than listed, because there are hundreds.

```

 0:00.0  ── arrival — standing still, taking the room in ──
 0:00.5  intake    pos( -24.0,   0.0,  24.8) stil      fear 0.01 lamp on 0.99 lit  6/142/201 entity not spawned        5590.8ms
 0:05.5  intake    pos( -24.0,   0.0,  24.8) stil      fear 0.00 lamp on 0.98 lit  6/142/201 entity not spawned        2652.9ms

 0:08.0  ── first walk, no lamp ──
 0:10.5  intake    pos( -21.0,   0.0,  23.1) walk      fear 0.03 lamp on 0.97 lit  6/142/201 entity not spawned        2311.9ms
 0:15.5  intake    pos( -10.3,   0.0,  23.2) walk      fear 0.03 lamp on 0.96 lit  6/142/201 entity not spawned        1690.7ms
 0:19.9      * director:entity-placed   
 0:19.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:20.5  intake    pos(  -0.2,   0.0,  22.2) walk      fear 0.03 lamp on 0.95 lit  6/142/201 entity DORMANT @24.8m     1334.2ms
 0:21.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:23.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:23.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:25.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:25.5  intake    pos(   4.5,   0.0,  18.8) walk      fear 0.03 lamp on 0.93 lit  6/142/201 entity DORMANT @20.4m     1131.7ms
 0:26.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:28.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:29.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:30.5  intake    pos(   2.8,   0.0,  18.2) walk      fear 0.03 lamp on 0.92 lit  6/142/201 entity DORMANT @22.2m      960.4ms
 0:30.5      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:31.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:33.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:34.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:35.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:35.5  intake    pos(  -4.1,   0.0,  19.0) walk      fear 0.03 lamp on 0.91 lit  6/142/201 entity DORMANT @28.8m      853.0ms
 0:36.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)

 0:38.0  ── lamp on ──
 0:38.0      * lamp:toggle              
 0:38.0      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:39.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:40.5  intake    pos( -11.8,   0.0,  15.1) walk      fear 0.03 lamp off      lit  6/142/201 entity DORMANT @37.1m      938.9ms
 0:40.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:41.5      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:42.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:43.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:45.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:45.5  intake    pos(  -2.1,   0.0,  17.9) walk      fear 0.03 lamp off      lit  6/141/201 entity DORMANT @27.0m      967.4ms
 0:46.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:47.5      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:48.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:49.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:50.5  intake    pos(   5.4,   0.0,  17.4) walk      fear 0.03 lamp off      lit  6/142/201 entity DORMANT @19.9m      875.2ms
 0:51.5      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:52.0      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:52.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:53.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:54.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:54.6      * entity:state             from=DORMANT state=ROUSED entity=surveyor at=(24.5, 0, 22.5)
 0:54.6      * entity:heard             entity=surveyor strength=0.08 radius=6 at=(11.7, 0, 15)
 0:54.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:55.5  intake    pos(  14.2,   0.0,  15.1) walk      fear 0.10 lamp off      lit  6/142/201 entity ROUSED @12.8m       809.3ms
 0:56.5      * entity:heard             entity=surveyor strength=0.077 radius=6 at=(11.7, 0, 15)
 0:56.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:57.0      * entity:heard             entity=surveyor strength=0.086 radius=6 at=(11.7, 0, 15)
 0:57.4      * entity:heard             entity=surveyor strength=0.071 radius=6 at=(11.7, 0, 15)
 0:58.1      * entity:state             from=ROUSED state=SEEKING entity=surveyor at=(24.5, 0, 22.5)
 0:58.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.5)
 0:59.2      * entity:heard             entity=surveyor strength=0.08 radius=6 at=(11.7, 0, 15)
 0:59.7      * entity:heard             entity=surveyor strength=0.107 radius=6 at=(11.7, 0, 15)
 1:00.1      * entity:tick              entity=surveyor at=(23.2, 0, 22)
 1:00.1      * entity:heard             entity=surveyor strength=0.113 radius=6 at=(11.7, 0, 15)
 1:00.5  intake    pos(  20.4,   0.0,  12.3) walk      fear 0.15 lamp off      lit  6/142/201 entity SEEKING @10.0m      744.1ms
 1:00.6      * entity:heard             entity=surveyor strength=0.102 radius=6 at=(11.7, 0, 15)
 1:01.0      * entity:heard             entity=surveyor strength=0.088 radius=6 at=(11.7, 0, 15)
 1:01.5      * entity:heard             entity=surveyor strength=0.073 radius=6 at=(11.7, 0, 15)
 1:02.0      * entity:tick              entity=surveyor at=(21.8, 0, 21.4)

 1:03.0  ── stop and listen (lamp on) ──
 1:03.1      * entity:tick              entity=surveyor at=(21.2, 0, 20.8)
 1:04.0      * entity:tick              entity=surveyor at=(20.6, 0, 20.3)
 1:05.0      * entity:tick              entity=surveyor at=(20.1, 0, 19.8)
 1:05.5  intake    pos(  22.5,   0.0,   7.2) stil      fear 0.09 lamp off      lit  6/142/201 entity SEEKING @12.7m      697.2ms
 1:05.8      * entity:tick              entity=surveyor at=(19.4, 0, 19.5)
 1:07.5      * entity:tick              entity=surveyor at=(18.2, 0, 19)
 1:08.4      * entity:state             from=SEEKING state=MEASURING entity=surveyor at=(17.5, 0, 18.7)
 1:08.4      * entity:tick              entity=surveyor at=(17.5, 0, 18.7)
 1:10.5  intake    pos(  22.5,   0.0,   7.2) stil      fear 0.07 lamp off      lit  6/141/201 entity MEASURING @12.5m    655.2ms
 1:10.7      * entity:tick              entity=surveyor at=(17.5, 0, 18.7)
 1:13.0      * entity:state             from=MEASURING state=SEEKING entity=surveyor at=(17.5, 0, 18.7)
 1:13.1      * entity:tick              entity=surveyor at=(17.5, 0, 18.7)
 1:13.7      * entity:tick              entity=surveyor at=(17.1, 0, 18.5)
 1:14.4      * entity:tick              entity=surveyor at=(16.6, 0, 18.3)
 1:15.5  intake    pos(  22.5,   0.0,   7.2) stil      fear 0.08 lamp off      lit  6/142/201 entity SEEKING @12.7m      612.1ms
 1:15.7      * entity:tick              entity=surveyor at=(15.7, 0, 17.9)
 1:16.3      * entity:state             from=SEEKING state=MEASURING entity=surveyor at=(15.2, 0, 17.7)
 1:17.0      * entity:tick              entity=surveyor at=(15.2, 0, 17.7)
 1:20.5  intake    pos(  22.5,   0.0,   7.2) stil      fear 0.06 lamp off      lit  6/142/201 entity MEASURING @12.8m    574.5ms
 1:21.3      * entity:tick              entity=surveyor at=(15.2, 0, 17.7)
 1:22.7      * entity:state             from=MEASURING state=SEEKING entity=surveyor at=(15.2, 0, 17.7)

 1:23.0  ── crouch-walk — nearly silent ──
 1:23.3      * entity:tick              entity=surveyor at=(14.9, 0, 17.6)
 1:24.1      * entity:tick              entity=surveyor at=(14.4, 0, 17.4)
 1:25.5      * entity:tick              entity=surveyor at=(13.3, 0, 17)
 1:25.5  intake    pos(  20.1,   0.0,   8.4) walk crch fear 0.11 lamp off      lit  6/142/201 entity SEEKING @10.9m      546.0ms
 1:26.0      * entity:state             from=SEEKING state=MEASURING entity=surveyor at=(12.9, 0, 16.8)
 1:26.1      * entity:tick              entity=surveyor at=(12.9, 0, 16.8)
 1:30.0      * entity:tick              entity=surveyor at=(12.9, 0, 16.8)
 1:30.5  intake    pos(  20.3,   0.0,  10.8) walk crch fear 0.11 lamp off      lit  6/142/201 entity MEASURING @9.5m     262.2ms
 1:31.5      * entity:state             from=MEASURING state=RETREATING entity=surveyor at=(12.9, 0, 16.8)
 1:33.8      * entity:state             from=RETREATING state=ROUSED entity=surveyor at=(12.4, 0, 17.1)
 1:33.8      * entity:heard             entity=surveyor strength=0.083 radius=2.2 at=(16.6, 0, 12.5)
 1:33.9      * entity:tick              entity=surveyor at=(12.4, 0, 17.1)
 1:34.3      * entity:heard             entity=surveyor strength=0.168 radius=2.2 at=(16.6, 0, 12.5)
 1:34.9      * entity:heard             entity=surveyor strength=0.254 radius=2.2 at=(16.6, 0, 12.5)
 1:35.5  intake    pos(  16.4,   0.0,  14.4) walk crch fear 0.29 lamp off      lit  6/142/201 entity ROUSED @4.8m        254.7ms
 1:35.5      * entity:heard             entity=surveyor strength=0.341 radius=2.2 at=(16.6, 0, 12.5)
 1:35.6      * entity:tick              entity=surveyor at=(12.4, 0, 17.1)
 1:36.1      * entity:heard             entity=surveyor strength=0.426 radius=2.2 at=(16.6, 0, 12.5)
 1:36.7      * entity:heard             entity=surveyor strength=0.51 radius=2.2 at=(16.6, 0, 12.5)
 1:37.1      * entity:tick              entity=surveyor at=(12.4, 0, 17.1)
 1:37.3      * entity:state             from=ROUSED state=SEEKING entity=surveyor at=(12.4, 0, 17.1)
 1:37.3      * entity:state             from=SEEKING state=APPROACHING entity=surveyor at=(12.4, 0, 17.1)
 1:37.3      * entity:heard             entity=surveyor strength=0.588 radius=2.2 at=(16.6, 0, 12.5)
 1:37.8      * entity:tick              entity=surveyor at=(12.5, 0, 17.3)
 1:37.9      * entity:heard             entity=surveyor strength=0.652 radius=2.2 at=(16.6, 0, 12.5)
 1:38.5      * entity:heard             entity=surveyor strength=0.706 radius=2.2 at=(12.7, 0, 15.8)
 1:39.1      * entity:heard             entity=surveyor strength=0.765 radius=2.2 at=(13, 0, 16.7)
 1:39.1      * entity:state             from=APPROACHING state=MEASURING entity=surveyor at=(13, 0, 17.6)
 1:39.3      * entity:tick              entity=surveyor at=(13, 0, 17.6)
 1:39.7      * entity:heard             entity=surveyor strength=0.766 radius=2.2 at=(12.2, 0, 15.9)
 1:40.3      * entity:state             from=MEASURING state=SEEKING entity=surveyor at=(13, 0, 17.6)
 1:40.3      * entity:heard             entity=surveyor strength=0.756 radius=2.2 at=(11.4, 0, 16.4)
 1:40.3      * entity:state             from=SEEKING state=APPROACHING entity=surveyor at=(13, 0, 17.6)
 1:40.5  intake    pos(  11.7,   0.0,  16.3) walk crch fear 0.43 lamp off      lit  6/142/201 entity APPROACHING @1.9m   176.4ms
 1:40.9      * entity:heard             entity=surveyor strength=0.697 radius=2.2 at=(10.7, 0, 16.9)
 1:41.5      * entity:tick              entity=surveyor at=(13.4, 0, 17.4)
 1:41.5      * entity:heard             entity=surveyor strength=0.613 radius=2.2 at=(10.4, 0, 17.9)
 1:42.1      * entity:heard             entity=surveyor strength=0.537 radius=2.2 at=(10.4, 0, 16.5)
 1:42.7      * entity:heard             entity=surveyor strength=0.47 radius=2.2 at=(8.5, 0, 18)
 1:43.1      * entity:tick              entity=surveyor at=(13.3, 0, 16.7)
 1:43.3      * entity:heard             entity=surveyor strength=0.405 radius=2.2 at=(8.8, 0, 17.7)
 1:43.9      * entity:heard             entity=surveyor strength=0.367 radius=2.2 at=(8.3, 0, 19)
 1:44.2      * entity:tick              entity=surveyor at=(12.6, 0, 16.5)
 1:44.5      * entity:heard             entity=surveyor strength=0.346 radius=2.2 at=(9.1, 0, 18)
 1:45.1      * entity:heard             entity=surveyor strength=0.335 radius=2.2 at=(7.6, 0, 18.8)
 1:45.5  intake    pos(   7.2,   0.0,  18.8) walk crch fear 0.39 lamp off      lit  6/142/201 entity APPROACHING @4.8m   176.9ms
 1:45.7      * entity:heard             entity=surveyor strength=0.326 radius=2.2 at=(8.3, 0, 19.4)
 1:46.0      * entity:tick              entity=surveyor at=(11.2, 0, 17)
 1:46.3      * entity:heard             entity=surveyor strength=0.314 radius=2.2 at=(6.4, 0, 19.4)
 1:46.9      * entity:heard             entity=surveyor strength=0.3 radius=2.2 at=(6.9, 0, 18.5)
 1:47.5      * entity:heard             entity=surveyor strength=0.29 radius=2.2 at=(6.6, 0, 19.4)
 1:47.5      * entity:tick              entity=surveyor at=(10.1, 0, 17.7)

 1:48.0  ── sprint — deliberately loud ──
 1:48.1      * entity:heard             entity=surveyor strength=0.783 radius=11 at=(4.6, 0, 20.6)
 1:48.4      * entity:heard             entity=surveyor strength=0.756 radius=11 at=(4, 0, 20.4)
 1:48.6      * entity:tick              entity=surveyor at=(9.1, 0, 18.1)
 1:48.7      * entity:heard             entity=surveyor strength=0.726 radius=11 at=(3.8, 0, 20.9)
 1:49.0      * entity:heard             entity=surveyor strength=0.704 radius=11 at=(2, 0, 20.2)
 1:49.3      * entity:tick              entity=surveyor at=(8.6, 0, 18.3)
 1:49.3      * entity:heard             entity=surveyor strength=0.698 radius=11 at=(1.4, 0, 19.9)
 1:49.6      * entity:heard             entity=surveyor strength=0.673 radius=11 at=(0.5, 0, 19.2)
 1:49.9      * entity:heard             entity=surveyor strength=0.641 radius=11 at=(-0.1, 0, 18.4)
 1:50.2      * entity:heard             entity=surveyor strength=0.612 radius=11 at=(-1.8, 0, 18.4)
 1:50.5  intake    pos(  -2.4,   0.0,  19.4) walk      fear 0.33 lamp off      lit  6/142/201 entity APPROACHING @9.9m   176.6ms
 1:50.5      * entity:heard             entity=surveyor strength=0.58 radius=11 at=(-3.7, 0, 18.8)
 1:50.8      * entity:heard             entity=surveyor strength=0.563 radius=11 at=(-3.4, 0, 18.8)
 1:51.0      * entity:tick              entity=surveyor at=(7, 0, 18.7)
 1:51.1      * entity:heard             entity=surveyor strength=0.571 radius=11 at=(-3.5, 0, 16.9)
 1:51.4      * entity:heard             entity=surveyor strength=0.601 radius=11 at=(-2.7, 0, 16.6)
 1:51.7      * entity:heard             entity=surveyor strength=0.648 radius=11 at=(-0.7, 0, 16.7)
 1:52.0      * entity:heard             entity=surveyor strength=0.693 radius=11 at=(-0.5, 0, 16)
 1:52.2      * entity:tick              entity=surveyor at=(6, 0, 18.7)
 1:52.3      * entity:heard             entity=surveyor strength=0.708 radius=11 at=(0, 0, 14.8)
 1:52.6      * entity:heard             entity=surveyor strength=0.708 radius=11 at=(0, 0, 13.6)
 1:53.0      * entity:heard             entity=surveyor strength=0.704 radius=11 at=(0.5, 0, 13.4)
 1:53.2      * entity:tick              entity=surveyor at=(5.2, 0, 18.4)
 1:53.4      * entity:heard             entity=surveyor strength=0.513 radius=6 at=(1.1, 0, 12.4)
 1:53.8      * entity:heard             entity=surveyor strength=0.74 radius=11 at=(2.8, 0, 12.2)
 1:54.2      * entity:heard             entity=surveyor strength=0.792 radius=11 at=(2.2, 0, 12.6)
 1:54.5      * entity:heard             entity=surveyor strength=0.846 radius=11 at=(2.8, 0, 14.4)
 1:55.0      * entity:heard             entity=surveyor strength=0.902 radius=11 at=(2.9, 0, 14.9)
 1:55.1      * entity:tick              entity=surveyor at=(4.3, 0, 17)
 1:55.3      * entity:state             from=APPROACHING state=CAPTURING entity=surveyor at=(4.2, 0, 16.8)
 1:55.5  intake    pos(   3.8,   0.0,  16.2) walk      fear 0.52 lamp off      lit  6/142/201 entity CAPTURING @0.7m     176.2ms
 1:56.7      * game:death               cause=surveyor at=(4.5, 0, 16.6)
 1:56.7      * cine:begin               name=death cause=surveyor
 1:56.9      * entity:tick              entity=surveyor at=(4.6, 0, 16.7)
 1:58.6      * entity:tick              entity=surveyor at=(5.4, 0, 17.1)
 2:00.1      * entity:tick              entity=surveyor at=(5.5, 0, 17.1)
 2:00.5  intake    pos(   6.2,   0.0,  17.5) walk      fear 0.56 lamp off      lit  6/142/201 entity CAPTURING @0.8m     176.2ms
 2:00.9      * entity:state             from=CAPTURING state=DORMANT entity=surveyor at=(5.5, 0, 17.1)
 2:00.9      * cine:end                 name=death
 2:00.9      * game:respawn             
 2:02.0      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:03.0      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:04.0      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:05.1      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:05.5  intake    pos(  -0.6,   0.0,  19.2) walk      fear 0.07 lamp off      lit  6/142/201 entity DORMANT @34.9m      167.8ms
 2:06.0      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:06.6      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:07.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)

 2:08.0  ── walk on, lamp off (the entity only moves in light) ──
 2:08.0      * lamp:toggle              
 2:08.5      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:10.1      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:10.5  intake    pos(  -1.8,   0.0,  19.9) walk      fear 0.04 lamp on 0.90 lit  6/142/201 entity DORMANT @35.7m       83.3ms
 2:11.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:12.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:14.8      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:15.5  intake    pos(   4.8,   0.0,  18.7) walk      fear 0.03 lamp on 0.89 lit  6/142/201 entity DORMANT @30.5m       13.2ms
 2:15.7      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:16.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:18.1      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:20.2      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:20.5  intake    pos(  13.5,   0.0,  19.5) walk      fear 0.03 lamp on 0.88 lit  6/142/201 entity DORMANT @23.1m       13.1ms
 2:21.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:22.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:23.8      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:25.5  intake    pos(   6.4,   0.0,  18.8) walk      fear 0.03 lamp on 0.86 lit  6/142/201 entity DORMANT @29.1m       13.1ms
 2:25.8      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:27.6      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:29.7      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:30.5  intake    pos(   2.8,   0.0,  19.1) walk      fear 0.03 lamp on 0.85 lit  6/142/201 entity DORMANT @32.0m       12.9ms
 2:31.1      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:32.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:34.8      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:35.5  intake    pos(   0.5,   0.0,  18.5) walk      fear 0.03 lamp on 0.84 lit  6/142/201 entity DORMANT @34.3m        6.1ms
 2:36.4      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)

 2:38.0  ── stand in the dark and wait ──
 2:38.2      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:38.8      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:39.7      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:40.5  intake    pos(   1.4,   0.0,  20.7) stil      fear 0.01 lamp on 0.83 lit  6/142/201 entity DORMANT @32.4m        6.2ms
 2:41.4      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:42.8      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:44.1      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:44.8      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:45.5  intake    pos(   1.4,   0.0,  20.7) stil      fear 0.00 lamp on 0.81 lit  6/142/201 entity DORMANT @32.4m        6.2ms
 2:46.5      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:48.6      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:50.2      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:50.5  intake    pos(   1.4,   0.0,  20.7) stil      fear 0.00 lamp on 0.80 lit  6/142/201 entity DORMANT @32.4m        6.2ms
 2:51.1      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:52.0      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:52.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:54.1      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:55.2      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:55.5  intake    pos(   1.4,   0.0,  20.7) stil      fear 0.00 lamp on 0.79 lit  6/142/201 entity DORMANT @32.4m        6.1ms
 2:57.0      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 2:58.7      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:00.0      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:00.5  intake    pos(   1.4,   0.0,  20.7) stil      fear 0.00 lamp on 0.78 lit  6/142/201 entity DORMANT @32.4m        6.0ms
 3:01.0      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:02.4      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:03.2      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:04.7      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:05.5  intake    pos(   1.4,   0.0,  20.7) stil      fear 0.00 lamp on 0.77 lit  6/142/201 entity DORMANT @32.4m        6.0ms
 3:06.5      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:07.4      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)

 3:08.0  ── SCRIPTED: spawn the Surveyor 26 m away, dormant ──

 3:08.0  ── sprint past it — loud enough to be heard ──
 3:08.6      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:10.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:10.5  intake    pos(   1.9,   0.0,  15.9) walk      fear 0.08 lamp on 0.76 lit  6/142/201 entity DORMANT @34.5m        5.7ms
 3:12.1      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:13.4      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:14.6      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:15.2      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:15.5  intake    pos(   7.1,   0.0,  18.6) walk      fear 0.07 lamp on 0.74 lit  6/142/201 entity DORMANT @28.7m        5.3ms
 3:16.8      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:18.5      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:19.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:20.5  intake    pos(   9.1,   0.0,  20.1) walk      fear 0.05 lamp on 0.73 lit  6/141/201 entity DORMANT @26.2m        5.2ms
 3:21.2      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:21.8      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:22.6      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:24.4      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:25.5  intake    pos(   7.0,   0.0,  15.3) walk      fear 0.05 lamp on 0.72 lit  6/142/201 entity DORMANT @30.7m        5.3ms
 3:25.7      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:27.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:28.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:30.1      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:30.5  intake    pos(  13.3,   0.0,  15.1) walk      fear 0.04 lamp on 0.71 lit  6/142/201 entity DORMANT @26.5m        5.4ms
 3:31.7      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:32.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)

 3:33.0  ── lamp on and keep moving (it only advances in light) ──
 3:33.0      * lamp:toggle              
 3:33.4      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:34.6      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:35.5  intake    pos(  21.9,   0.0,  16.4) walk      fear 0.03 lamp off      lit  6/142/201 entity DORMANT @20.7m        5.3ms
 3:35.8      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:36.7      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:38.8      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:39.4      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:40.5  intake    pos(  26.6,   0.0,  14.0) walk      fear 0.03 lamp off      lit  6/142/201 entity DORMANT @21.6m        5.3ms
 3:41.4      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:42.6      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:43.7      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:45.4      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:45.5  intake    pos(  24.8,   0.0,   4.6) walk      fear 0.03 lamp off      lit  6/142/201 entity DORMANT @31.2m        5.3ms
 3:46.2      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:47.0      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:48.7      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:50.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:50.5  intake    pos(  21.6,   0.0,  -2.9) walk      fear 0.03 lamp off      lit  6/208/269 entity DORMANT @39.2m        5.3ms
 3:52.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:53.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:55.5  intake    pos(  23.1,   0.0,  -3.2) walk      fear 0.02 lamp off      lit  6/208/269 entity DORMANT @39.2m        5.4ms
 3:55.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:57.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:58.0      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 3:59.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:00.5  intake    pos(  24.5,   0.0,   6.7) walk      fear 0.03 lamp off      lit  6/208/269 entity DORMANT @29.2m        5.5ms
 4:01.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:03.0      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:04.0      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:05.4      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:05.5  intake    pos(  24.3,   0.0,   7.6) walk      fear 0.03 lamp off      lit  6/208/269 entity DORMANT @28.3m        5.5ms
 4:06.2      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:06.8      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)

 4:08.0  ── stop, lamp off, stay still — does it lose you? ──
 4:08.0      * lamp:toggle              
 4:08.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:10.4      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:10.5  intake    pos(  24.5,   0.0,  12.5) stil      fear 0.01 lamp on 0.70 lit  6/208/269 entity DORMANT @23.6m        5.6ms
 4:11.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:13.0      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:14.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:15.5  intake    pos(  24.5,   0.0,  12.5) stil      fear 0.00 lamp on 0.68 lit  6/208/269 entity DORMANT @23.6m        5.7ms
 4:16.1      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:17.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:18.7      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:20.5      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:20.5  intake    pos(  24.5,   0.0,  12.5) stil      fear 0.00 lamp on 0.67 lit  6/208/269 entity DORMANT @23.6m        5.6ms
 4:22.1      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:22.7      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:23.7      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:25.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:25.5  intake    pos(  24.5,   0.0,  12.5) stil      fear 0.00 lamp on 0.66 lit  6/208/269 entity DORMANT @23.6m        5.5ms
 4:27.2      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:27.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:29.0      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:30.5  intake    pos(  24.5,   0.0,  12.5) stil      fear 0.00 lamp on 0.65 lit  6/208/269 entity DORMANT @23.6m        5.5ms
 4:30.8      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:32.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:34.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:35.5  intake    pos(  24.5,   0.0,  12.5) stil      fear 0.00 lamp on 0.64 lit  6/208/269 entity DORMANT @23.6m        5.6ms
 4:35.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:37.4      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:38.1      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:38.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:40.1      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:40.5  intake    pos(  24.5,   0.0,  12.5) stil      fear 0.00 lamp on 0.63 lit  6/208/269 entity DORMANT @23.6m        5.6ms
 4:41.8      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:42.5      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:44.0      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:44.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:45.5  intake    pos(  24.5,   0.0,  12.5) stil      fear 0.00 lamp on 0.61 lit  6/208/269 entity DORMANT @23.6m        5.6ms
 4:46.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)

 4:48.0  ── walk to the service door ──
 4:48.1      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:49.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:50.5  intake    pos(  24.1,   0.0,   8.1) walk      fear 0.03 lamp on 0.60 lit  6/208/269 entity DORMANT @27.9m        5.6ms
 4:51.0      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:52.1      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:53.7      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:54.4      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:55.5  intake    pos(  24.1,   0.0,   2.3) walk      fear 0.03 lamp on 0.59 lit  6/208/269 entity DORMANT @33.6m        5.3ms
 4:56.1      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:57.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 4:58.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:00.0      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:00.5  intake    pos(  25.0,   0.0,  12.1) walk      fear 0.03 lamp on 0.58 lit  6/208/269 entity DORMANT @23.8m        5.2ms
 5:00.7      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:01.6      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:03.1      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:04.2      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:05.5  intake    pos(  23.7,   0.0,   3.7) walk      fear 0.03 lamp on 0.56 lit  6/208/269 entity DORMANT @32.3m        5.4ms
 5:05.7      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:06.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:07.4      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:08.4      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:08.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:10.5  intake    pos(  14.0,   0.0,   2.0) walk      fear 0.03 lamp on 0.55 lit  6/208/269 entity DORMANT @37.1m        5.4ms
 5:10.6      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:12.2      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:13.0      * zone:leave               zone=intake
 5:13.0      * world:teleport           zone=service at=(370.4, 0, 0)
 5:13.0      * zone:enter               zone=service from=intake
 5:13.0      * qa:scripted-zone-change  zone=service

 5:13.0  ── zone settle ──
 5:13.8      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)

 5:14.5  ── service spine — first walk ──
 5:15.5  service   pos( 372.4,   0.0,   0.0) walk      fear 0.02 lamp on 0.54 lit  6/223/286 entity DORMANT @343.8m      26.6ms
 5:15.8      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:17.8      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:19.8      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:20.5  service   pos( 382.9,   0.0,   0.1) walk      fear 0.03 lamp on 0.53 lit  6/224/286 entity DORMANT @354.3m      48.0ms
 5:21.7      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:22.5      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:24.2      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:25.5  service   pos( 393.4,   0.0,  -0.3) walk      fear 0.03 lamp on 0.52 lit  6/224/286 entity DORMANT @364.7m      47.9ms
 5:25.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:27.6      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:28.4      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:29.6      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:30.5  service   pos( 401.4,   0.0,   1.0) walk      fear 0.02 lamp on 0.51 lit  6/224/286 entity DORMANT @372.6m      48.0ms
 5:31.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:32.4      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:33.6      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:35.5  service   pos( 402.6,   0.0,   1.0) stil      fear 0.01 lamp on 0.49 lit  6/224/286 entity DORMANT @373.8m      48.0ms
 5:35.7      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:36.8      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:38.4      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:39.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:40.5  service   pos( 402.6,   0.0,   1.0) stil      fear 0.01 lamp on 0.48 lit  6/223/286 entity DORMANT @373.8m      47.9ms
 5:41.1      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:42.8      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:44.1      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:45.5  service   pos( 402.6,   0.0,   1.0) stil      fear 0.00 lamp on 0.47 lit  6/224/286 entity DORMANT @373.8m      51.4ms
 5:45.6      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:47.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:49.0      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)

 5:49.5  ── service spine — sprint ──
 5:50.5  service   pos( 400.3,   0.0,   1.0) walk      fear 0.05 lamp on 0.46 lit  6/223/286 entity DORMANT @371.5m      51.5ms
 5:51.0      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:52.2      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:52.8      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:54.4      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:55.5  service   pos( 390.9,   0.0,   9.8) walk      fear 0.08 lamp on 0.45 lit  6/224/286 entity DORMANT @361.5m      51.8ms
 5:56.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:57.0      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:58.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 5:59.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:00.5  service   pos( 381.6,   0.0,  13.0) walk      fear 0.06 lamp on 0.43 lit  6/224/286 entity DORMANT @351.9m      66.3ms
 6:01.8      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:02.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:04.4      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:04.5      * zone:leave               zone=service
 6:04.5      * world:teleport           zone=cistern at=(774, 2.6, 0)
 6:04.5      * zone:enter               zone=cistern from=service
 6:04.5      * qa:scripted-zone-change  zone=cistern

 6:04.5  ── zone settle ──

 6:06.0  ── cistern — wading ──
 6:06.0      * lamp:toggle              
 6:06.0  cistern   pos( 773.1,   2.6,   0.0) stil crch fear 0.05 lamp on 0.42 lit  3/223/286 entity DORMANT @743.6m     121.8ms
 6:06.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:07.4      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:08.4      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:09.5      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:11.0  cistern   pos( 775.1,   2.6,   0.0) stil crch fear 0.01 lamp off      lit  4/224/286 entity DORMANT @745.5m     223.7ms
 6:11.6      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:13.5      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:15.4      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:16.0  cistern   pos( 775.1,   2.6,   0.0) stil crch fear 0.00 lamp off      lit  4/224/286 entity DORMANT @745.5m     223.7ms
 6:16.6      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:18.4      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:20.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:21.0  cistern   pos( 775.1,   2.6,   0.0) stil crch fear 0.00 lamp off      lit  4/222/286 entity DORMANT @745.5m     223.8ms
 6:21.5      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:22.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:23.8      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:24.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:26.0  cistern   pos( 775.1,   2.6,   0.0) stil crch fear 0.00 lamp off      lit  4/224/286 entity DORMANT @745.5m     223.9ms
 6:26.7      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:28.4      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:29.8      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:30.8      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:31.0  cistern   pos( 775.1,   2.6,   0.0) stil crch fear 0.00 lamp off      lit  4/224/286 entity DORMANT @745.5m     223.8ms
 6:31.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:33.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:35.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:36.0  cistern   pos( 775.1,   2.6,   0.0) stil crch fear 0.00 lamp off      lit  4/224/286 entity DORMANT @745.5m     223.8ms
 6:36.6      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:37.7      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:39.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:40.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)

 6:41.0  ── cistern — stand still in the water ──
 6:41.0  cistern   pos( 775.1,   2.6,   0.0) stil crch fear 0.00 lamp off      lit  4/224/286 entity DORMANT @745.5m     223.8ms
 6:42.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:44.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:45.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:46.0  cistern   pos( 775.1,   2.6,   0.0) stil crch fear 0.00 lamp off      lit  4/223/286 entity DORMANT @745.5m     187.2ms
 6:47.5      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:49.6      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:51.0  cistern   pos( 775.1,   2.6,   0.0) stil crch fear 0.00 lamp off      lit  4/224/286 entity DORMANT @745.5m     189.2ms
 6:51.4      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:52.9      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:54.1      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:55.5      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:56.0  cistern   pos( 775.1,   2.6,   0.0) stil crch fear 0.00 lamp off      lit  4/224/286 entity DORMANT @745.5m     189.0ms
 6:57.5      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 6:59.3      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 7:00.5      * entity:tick              entity=surveyor at=(30.4, 0, 35.3)
 7:01.0      * zone:unload              zone=intake
 7:01.0      * zone:leave               zone=cistern
 7:01.0      * world:teleport           zone=safe at=(400.6, 0, 799)
 7:01.0      * zone:enter               zone=safe from=cistern
 7:01.0      * progress:discovery       id=office title=The Office of Record
 7:01.0      * qa:scripted-zone-change  zone=safe

 7:01.0  ── zone settle ──
 7:01.0  cistern   pos( 775.1,   2.6,   0.0) stil crch fear 0.00 lamp off      lit  4/224/286 entity DORMANT @745.5m     200.9ms

 7:02.5  ── the safe room ──
 7:06.0  safe      pos( 401.3,   0.0, 798.1) walk      fear 0.03 lamp off      lit  3/ 85/88 entity DORMANT @848.2m     258.0ms
 7:11.0  safe      pos( 394.3,   0.0, 799.0) walk      fear 0.13 lamp off      lit  3/ 85/88 entity DORMANT @846.0m     255.6ms
 7:16.0  safe      pos( 390.2,   0.0, 801.1) walk      fear 0.29 lamp off      lit  3/ 85/88 entity DORMANT @846.1m     259.1ms
 7:21.0  safe      pos( 392.0,   0.0, 792.6) walk      fear 0.29 lamp off      lit  3/ 85/88 entity DORMANT @839.2m     259.0ms
 7:26.0  safe      pos( 383.3,   0.0, 789.9) walk      fear 0.29 lamp off      lit  0/ 85/88 entity DORMANT @833.1m     261.9ms
```

`lit A/B/C` = lights uploaded to shaders / fixtures above 5% brightness / fixtures resident.

## Entity state transitions

| t | from | to | active |
|---|---|---|---|
| 0:54.6 | DORMANT | ROUSED | true |
| 0:58.1 | ROUSED | SEEKING | true |
| 1:08.5 | SEEKING | MEASURING | true |
| 1:13.0 | MEASURING | SEEKING | true |
| 1:16.3 | SEEKING | MEASURING | true |
| 1:22.7 | MEASURING | SEEKING | true |
| 1:26.0 | SEEKING | MEASURING | true |
| 1:31.5 | MEASURING | RETREATING | true |
| 1:33.8 | RETREATING | ROUSED | true |
| 1:37.3 | ROUSED | SEEKING | true |
| 1:37.3 | SEEKING | APPROACHING | true |
| 1:39.1 | APPROACHING | MEASURING | true |
| 1:40.3 | MEASURING | SEEKING | true |
| 1:40.3 | SEEKING | APPROACHING | true |
| 1:55.3 | APPROACHING | CAPTURING | true |
| 2:00.9 | CAPTURING | DORMANT | true |

## Filmstrip

33 frames, one every ~15 s of play. See `filmstrip.md` for them in order.

## Subsystems at the end of the session

```json
{
  "state": "play",
  "zone": "safe",
  "subsystems": {
    "world": true,
    "audio": true,
    "gameplay": true,
    "ui": true,
    "cinematics": true
  },
  "engine": {
    "ms": 286.9825000000186,
    "fps": 3.4845330290172227,
    "p90": 234.5,
    "calls": 124,
    "tris": 55268,
    "quality": "low",
    "res": "397x223"
  },
  "lights": {
    "fixtures": 88,
    "lit": 85,
    "active": 0,
    "shadows": 2
  },
  "entity": {
    "entity": "surveyor",
    "state": "DORMANT",
    "stateTime": 326.6,
    "position": [
      30.39,
      0,
      35.29
    ],
    "heading": 4.079,
    "target": [
      2.89,
      0,
      14.9
    ],
    "confidence": 0,
    "illumination": 0,
    "lightScale": 0,
    "speed": 0,
    "frozen": true,
    "stoop": 0,
    "measureHold": 0,
    "distToPlayer": 834.79,
    "usingGlb": true
  },
  "gameplay": {
    "surveyor": {
      "entity": "surveyor",
      "state": "DORMANT",
      "stateTime": 326.6,
      "position": [
        30.39,
        0,
        35.29
      ],
      "heading": 4.079,
      "target": [
        2.89,
        0,
        14.9
      ],
      "confidence": 0,
      "illumination": 0,
      "lightScale": 0,
      "speed": 0,
      "frozen": true,
      "stoop": 0,
      "measureHold": 0,
      "distToPlayer": 834.79,
      "usingGlb": true
    },
    "attendant": {
      "entity": "attendant",
      "acts": 0,
      "cooldown": 0,
      "targets": 0,
      "unused": 0,
      "last": []
    },
    "director": {
      "fear": 0.295,
      "tension": 0,
      "intensity": 0.15,
      "sinceBeat": 59.7,
      "nextBeatAt": 240,
      "grace": 0,
      "zone": "safe",
      "objective": null,
      "deaths": 1,
      "hidden": false,
      "lastBeats": []
    },
    "progression": {
      "objective": "reach_plant",
      "completed": 0,
      "cores": {
        "found": 0,
        "fitted": 0
      },
      "running": false,
      "ended": null,
      "gates": [],
      "discoveries": [
        "office"
      ]
    },
    "interactor": {
      "focus": null,
      "blocked": false,
      "reason": null,
      "progress": 0,
      "items": 0,
      "doors": 0
    },
    "flashlight": {
      "on": false,
      "battery": 0.421,
      "beam": 0,
      "covered": 0,
      "swapping": false,
      "enabled": true
    },
    "hands": {
      "visible": true,
      "carrying": false,
      "reach": 0,
      "startle": 0,
      "exposure": 0
    },
    "inventory": {
      "items": {
        "lamp": 1
      },
      "selected": "lamp"
    }
  },
  "audio": {
    "voices": 5,
    "oneShots": 1,
    "loops": 4,
    "nodes": 100,
    "occlChecks": 22513,
    "denied": 0,
    "reverb": "safe",
    "zone": "safe",
    "hums": 0,
    "state": "running",
    "music": {
      "spent": 0,
      "budget": 5,
      "sinceLast": 1000450,
      "cues": []
    },
    "pressure": 0
  }
}
```
