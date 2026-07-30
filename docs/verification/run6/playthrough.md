# THE ANNEX — continuous playthrough

Generated 2026-07-30T08:59:48.259Z by `tools/qa/playthrough.mjs`.

**26850 frames · 447.5 s of simulated play at a fixed 1/60 step · 584 s of wall clock · quality `low` · 640×360**

This is the first continuous session ever run on this build. Movement, sprint, crouch, the
lamp key and the interact key are real DOM keyboard events; mouse look is written into the
field a locked pointer would write, because headless Chromium cannot grant pointer lock.
Frame times come from a CPU rasteriser and are not a frame-rate verdict.

## Assertions

| | check | detail |
|---|---|---|
| **PASS** | no console errors during the session |  |
| **PASS** | player position never NaN | 0 frames |
| **PASS** | player never falls through the floor | y 0.00..2.60; frames not standing on a floor: 0 of 26850 (worst consecutive run 0) |
| **FAIL** | the frame loop never stalls (no frame > 5 s) | max 10040 ms, p99 7 ms, p50 0.20 ms |
| **PASS** | post-warmup frame times stay bounded (p99 < 250 ms) | warm p50 0.20 ms, p90 0.50 ms, p99 6.90 ms |
| **PASS** | simulated time advanced continuously | 26850 frames |
| **PASS** | at least one entity state transition occurred | DORMANT->ROUSED@107.92s, ROUSED->SEEKING@111.43s, SEEKING->MEASURING@124.33s, MEASURING->SEEKING@126.77s, SEEKING->APPROACHING@130.45s, APPROACHING->MEASURING@137.75s, MEASURING->SEEKING@142.92s, SEEKING->MEASURING@142.93s, MEASURING->SEEKING@150.67s, SEEKING->MEASURING@153.97s, MEASURING->RETREATING@158.93s, RETREATING->DORMANT@176.93s |
| **PASS** | audio subsystem reports as constructed | subsystems.audio=true, ctx state=running |
| **PASS** | footsteps fired while walking | 365 player:step events |
| **FAIL** | every zone visited reported lit fixtures | min active lights = 0 |

**2 check(s) failed.**

## Pacing

- **Session length:** 447.5 s (7.5 min) of play.
- **Zero-threat time:** 84.5% of samples had no active entity and fear below 0.15.
- **The Surveyor was active at some point.**
- **Threat episodes:** 1 — 68.5s (ROUSED→SEEKING→MEASURING→APPROACHING→RETREATING, closest 4.89 m)
- **Fear:** median 0.024, p90 0.08, peak 0.351. Above 0.3 for 1.0% of the session, above 0.5 for 0.0%.
- **Director beats fired:** 1 — distant_door at 1:47.9
- **Longest stretch with nothing on the bus except footsteps:** 447.5 s (0:00.0 → 7:27.5).
- **Moving:** 49% of samples.
- **Zones:** intake (0:00.5–5:13.0) → service (5:14.5–5:55.0) → safe (5:55.5–5:57.0) → service (5:57.5–6:04.5) → cistern (6:06.0–7:01.0) → service (7:02.5–7:27.5)

### Frame time (CPU rasteriser — not a frame-rate verdict)

| | p50 | p90 | p99 | max |
|---|---:|---:|---:|---:|
| whole session | 0.20 | 0.50 | 6.90 | 10040 |
| after 3 s warmup | 0.20 | 0.50 | 6.90 | 10040 |

All in milliseconds. The multi-second outliers are first-frame shader compiles
after a camera or zone change, which is a property of SwiftShader, not of the renderer.

## Event census

| event | count |
|---|---:|
| `player:noise` | 373 |
| `player:step` | 365 |
| `entity:tick` | 243 |
| `entity:heard` | 31 |
| `qa:phase` | 21 |
| `entity:state` | 12 |
| `zone:leave` | 6 |
| `world:teleport` | 6 |
| `zone:enter` | 6 |
| `lamp:toggle` | 5 |
| `qa:scripted-zone-change` | 3 |
| `zone:unload` | 2 |
| `director:entity-placed` | 1 |
| `director:beat` | 1 |
| `sfx:distant` | 1 |
| `world:noise` | 1 |
| `progress:discovery` | 1 |

## Timeline

State every 5 s; every non-footstep event at the moment it fired. Footsteps and noise
events are counted in the census above rather than listed, because there are hundreds.

```

 0:00.0  ── arrival — standing still, taking the room in ──
 0:00.5  intake    pos( -24.0,   0.0,  24.8) stil      fear 0.01 lamp on 0.99 lit  6/142/201 entity not spawned        5643.2ms
 0:05.5  intake    pos( -24.0,   0.0,  24.8) stil      fear 0.00 lamp on 0.98 lit  6/142/201 entity not spawned        2685.3ms

 0:08.0  ── first walk, no lamp ──
 0:10.5  intake    pos( -21.0,   0.0,  23.1) walk      fear 0.03 lamp on 0.97 lit  6/142/201 entity not spawned        2368.4ms
 0:15.5  intake    pos( -10.3,   0.0,  23.2) walk      fear 0.03 lamp on 0.96 lit  6/142/201 entity not spawned        1732.7ms
 0:19.9      * director:entity-placed   
 0:19.9      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:20.5  intake    pos(  -0.3,   0.0,  22.1) walk      fear 0.03 lamp on 0.95 lit  6/142/201 entity DORMANT @24.8m     1367.0ms
 0:21.6      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:23.1      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:23.9      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:25.1      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:25.5  intake    pos(   5.5,   0.0,  18.8) walk      fear 0.03 lamp on 0.93 lit  6/142/201 entity DORMANT @19.3m     1163.6ms
 0:26.1      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:28.2      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:29.8      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:30.5  intake    pos(   8.1,   0.0,  15.1) walk      fear 0.02 lamp on 0.92 lit  6/142/201 entity DORMANT @17.9m      987.8ms
 0:30.5      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:31.8      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:33.4      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:34.2      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:35.1      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:35.5  intake    pos(   6.8,   0.0,  15.1) walk      fear 0.01 lamp on 0.91 lit  6/142/201 entity DORMANT @19.2m      877.1ms
 0:36.4      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)

 0:38.0  ── lamp on ──
 0:38.0      * lamp:toggle              
 0:38.0      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:39.9      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:40.5  intake    pos(   2.8,   0.0,  19.9) walk      fear 0.03 lamp off      lit  6/142/201 entity DORMANT @21.9m     1038.0ms
 0:40.7      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:41.5      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:42.8      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:43.7      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:45.1      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:45.5  intake    pos(   5.8,   0.0,  16.4) walk      fear 0.03 lamp off      lit  6/141/201 entity DORMANT @19.6m     1027.5ms
 0:46.3      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:47.5      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:48.4      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:49.9      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:50.5  intake    pos(  -1.1,   0.0,  19.8) walk      fear 0.03 lamp off      lit  6/142/201 entity DORMANT @25.8m      929.9ms
 0:51.5      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:52.0      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:52.9      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:53.7      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:54.3      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:54.9      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:55.5  intake    pos(   4.5,   0.0,  17.8) walk      fear 0.03 lamp off      lit  6/142/201 entity DORMANT @20.5m      859.8ms
 0:56.4      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 0:58.3      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:00.4      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:00.5  intake    pos(   6.8,   0.0,  15.1) walk      fear 0.01 lamp off      lit  6/142/201 entity DORMANT @19.1m      790.3ms
 1:01.3      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)

 1:03.0  ── stop and listen (lamp on) ──
 1:03.3      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:04.1      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:05.5  intake    pos(   8.5,   0.0,  15.1) stil      fear 0.01 lamp off      lit  6/142/201 entity DORMANT @17.6m      731.4ms
 1:05.7      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:07.1      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:07.9      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:10.0      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:10.5  intake    pos(   8.5,   0.0,  15.1) stil      fear 0.01 lamp off      lit  6/141/201 entity DORMANT @17.6m      687.2ms
 1:11.3      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:12.5      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:13.5      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:14.3      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:15.0      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:15.5  intake    pos(   8.5,   0.0,  15.1) stil      fear 0.01 lamp off      lit  6/142/201 entity DORMANT @17.6m      642.1ms
 1:16.1      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:17.2      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:18.1      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:19.5      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:20.5  intake    pos(   8.5,   0.0,  15.1) stil      fear 0.01 lamp off      lit  6/142/201 entity DORMANT @17.6m      602.6ms
 1:21.4      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:22.4      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)

 1:23.0  ── crouch-walk — nearly silent ──
 1:23.2      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:23.8      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:25.1      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:25.5  intake    pos(   6.5,   0.0,  16.5) walk crch fear 0.02 lamp off      lit  6/142/201 entity DORMANT @19.0m      572.5ms
 1:27.0      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:27.6      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:28.3      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:29.6      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:30.5  intake    pos(   4.0,   0.0,  17.3) walk crch fear 0.01 lamp off      lit  6/142/201 entity DORMANT @21.1m      285.9ms
 1:30.9      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:32.3      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:34.2      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:35.1      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:35.5  intake    pos(   7.6,   0.0,  15.1) walk crch fear 0.01 lamp off      lit  6/142/201 entity DORMANT @18.5m      277.6ms
 1:36.4      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:37.8      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:38.8      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:40.5  intake    pos(  10.5,   0.0,  15.1) walk crch fear 0.02 lamp off      lit  6/142/201 entity DORMANT @15.8m      193.8ms
 1:40.5      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:41.7      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:43.2      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:44.7      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:45.5  intake    pos(  13.7,   0.0,  15.1) stil crch fear 0.03 lamp off      lit  6/142/201 entity DORMANT @13.0m      193.9ms
 1:45.8      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:47.3      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:47.9      * director:beat            zone=intake name=distant_door fear=0.03
 1:47.9      * sfx:distant              kind=door at=(8.3, 0, 30.7)
 1:47.9      * entity:state             from=DORMANT state=ROUSED entity=surveyor at=(24.6, 0, 22.3)
 1:47.9      * entity:heard             entity=surveyor strength=0.08 radius=11 at=(11.4, 0, 29.6)

 1:48.0  ── sprint — deliberately loud ──
 1:48.8      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:49.5      * entity:heard             entity=surveyor strength=0.154 radius=11 at=(11.4, 0, 29.6)
 1:50.5  intake    pos(  13.2,   0.0,  15.1) walk      fear 0.16 lamp off      lit  6/142/201 entity ROUSED @13.5m       193.9ms
 1:50.7      * entity:tick              entity=surveyor at=(24.6, 0, 22.3)
 1:51.0      * entity:heard             entity=surveyor strength=0.144 radius=11 at=(11.4, 0, 29.6)
 1:51.4      * entity:state             from=ROUSED state=SEEKING entity=surveyor at=(24.6, 0, 22.3)
 1:51.8      * entity:heard             entity=surveyor strength=0.134 radius=11 at=(11.4, 0, 29.6)
 1:52.4      * entity:tick              entity=surveyor at=(24.1, 0, 22.5)
 1:53.2      * entity:heard             entity=surveyor strength=0.397 radius=11 at=(11.4, 0, 29.6)
 1:53.3      * entity:tick              entity=surveyor at=(23.4, 0, 22.8)
 1:54.1      * entity:heard             entity=surveyor strength=0.386 radius=11 at=(11.4, 0, 29.6)
 1:54.8      * entity:tick              entity=surveyor at=(22.2, 0, 23.2)
 1:55.5  intake    pos(  13.6,   0.0,  15.1) walk      fear 0.13 lamp off      lit  6/142/201 entity SEEKING @11.6m      192.1ms
 1:56.1      * entity:tick              entity=surveyor at=(21.2, 0, 23.4)
 1:57.1      * entity:tick              entity=surveyor at=(20.5, 0, 23.4)
 1:57.7      * entity:tick              entity=surveyor at=(20, 0, 23.4)
 1:58.3      * entity:tick              entity=surveyor at=(19.4, 0, 23.4)
 1:58.8      * entity:heard             entity=surveyor strength=0.196 radius=11 at=(11.4, 0, 29.6)
 1:59.8      * entity:heard             entity=surveyor strength=0.101 radius=6 at=(11.4, 0, 29.6)
 1:59.8      * entity:tick              entity=surveyor at=(18.2, 0, 23.4)
 2:00.5  intake    pos(  12.2,   0.0,  15.1) walk      fear 0.16 lamp off      lit  6/142/201 entity SEEKING @10.0m      192.2ms
 2:01.0      * entity:tick              entity=surveyor at=(17.3, 0, 23.4)
 2:01.2      * entity:heard             entity=surveyor strength=0.146 radius=6 at=(11.4, 0, 29.6)
 2:03.0      * entity:tick              entity=surveyor at=(15.6, 0, 23.4)
 2:04.3      * entity:state             from=SEEKING state=MEASURING entity=surveyor at=(14.5, 0, 23.4)
 2:04.9      * entity:tick              entity=surveyor at=(14.5, 0, 23.4)
 2:05.5  intake    pos(  10.8,   0.0,  15.1) stil      fear 0.17 lamp off      lit  6/142/201 entity MEASURING @9.2m     183.7ms
 2:06.2      * entity:heard             entity=surveyor strength=0.372 radius=6 at=(10.2, 0, 14.1)
 2:06.7      * entity:tick              entity=surveyor at=(14.5, 0, 23.4)
 2:06.8      * entity:state             from=MEASURING state=SEEKING entity=surveyor at=(14.5, 0, 23.4)

 2:08.0  ── walk on, lamp off (the entity only moves in light) ──
 2:08.0      * entity:heard             entity=surveyor strength=0.114 radius=3.4 at=(10.2, 0, 14.1)
 2:08.0      * lamp:toggle              
 2:08.7      * entity:heard             entity=surveyor strength=0.455 radius=6 at=(11.8, 0, 15.1)
 2:09.1      * entity:tick              entity=surveyor at=(13.6, 0, 22.4)
 2:10.4      * entity:heard             entity=surveyor strength=0.559 radius=6 at=(12.5, 0, 15.4)
 2:10.4      * entity:state             from=SEEKING state=APPROACHING entity=surveyor at=(13.2, 0, 21.4)
 2:10.5  intake    pos(  12.4,   0.0,  15.1) walk      fear 0.22 lamp on 0.90 lit  6/142/201 entity APPROACHING @6.3m    61.0ms
 2:10.8      * entity:tick              entity=surveyor at=(13.1, 0, 21.1)
 2:11.3      * entity:heard             entity=surveyor strength=0.612 radius=6 at=(12.9, 0, 13.9)
 2:11.6      * entity:tick              entity=surveyor at=(12.9, 0, 20.4)
 2:11.9      * entity:heard             entity=surveyor strength=0.638 radius=6 at=(14.3, 0, 14.8)
 2:12.3      * entity:heard             entity=surveyor strength=0.568 radius=6 at=(15.7, 0, 14.3)
 2:12.8      * entity:heard             entity=surveyor strength=0.306 radius=6 at=(15.7, 0, 14.3)
 2:13.1      * entity:tick              entity=surveyor at=(13.3, 0, 19.1)
 2:13.3      * entity:heard             entity=surveyor strength=0.209 radius=6 at=(15.7, 0, 14.3)
 2:13.7      * entity:heard             entity=surveyor strength=0.196 radius=6 at=(15.7, 0, 14.3)
 2:14.2      * entity:heard             entity=surveyor strength=0.255 radius=6 at=(15.7, 0, 14.3)
 2:14.6      * entity:heard             entity=surveyor strength=0.237 radius=6 at=(15.7, 0, 14.3)
 2:15.0      * entity:tick              entity=surveyor at=(13.9, 0, 17.5)
 2:15.1      * entity:heard             entity=surveyor strength=0.401 radius=6 at=(15.7, 0, 14.3)
 2:15.5      * entity:heard             entity=surveyor strength=0.368 radius=6 at=(15.7, 0, 14.3)
 2:15.5  intake    pos(  20.0,   0.0,  11.3) walk      fear 0.31 lamp on 0.89 lit  6/142/201 entity APPROACHING @8.3m     6.7ms
 2:16.0      * entity:heard             entity=surveyor strength=0.385 radius=6 at=(15.7, 0, 14.3)
 2:16.4      * entity:heard             entity=surveyor strength=0.35 radius=6 at=(15.7, 0, 14.3)
 2:16.9      * entity:heard             entity=surveyor strength=0.315 radius=6 at=(15.7, 0, 14.3)
 2:16.9      * entity:tick              entity=surveyor at=(14.6, 0, 15.9)
 2:17.3      * entity:heard             entity=surveyor strength=0.281 radius=6 at=(15.7, 0, 14.3)
 2:17.7      * entity:state             from=APPROACHING state=MEASURING entity=surveyor at=(14.9, 0, 15.2)
 2:17.8      * entity:heard             entity=surveyor strength=0.246 radius=6 at=(15.7, 0, 14.3)
 2:18.2      * entity:heard             entity=surveyor strength=0.184 radius=6 at=(15.7, 0, 14.3)
 2:18.5      * entity:tick              entity=surveyor at=(14.9, 0, 15.2)
 2:18.7      * entity:heard             entity=surveyor strength=0.121 radius=6 at=(15.7, 0, 14.3)
 2:19.2      * entity:heard             entity=surveyor strength=0.06 radius=6 at=(15.7, 0, 14.3)
 2:20.5  intake    pos(  22.0,   0.0,   3.1) walk      fear 0.12 lamp on 0.88 lit  6/208/269 entity MEASURING @14.1m      6.5ms
 2:21.6      * entity:tick              entity=surveyor at=(14.9, 0, 15.2)
 2:22.9      * entity:state             from=MEASURING state=SEEKING entity=surveyor at=(14.9, 0, 15.2)
 2:22.9      * entity:state             from=SEEKING state=MEASURING entity=surveyor at=(14.9, 0, 15.2)
 2:24.6      * entity:tick              entity=surveyor at=(14.9, 0, 15.2)
 2:25.5  intake    pos(  14.1,   0.0,  -0.2) walk      fear 0.08 lamp on 0.86 lit  6/208/269 entity MEASURING @15.5m      6.6ms
 2:28.9      * entity:tick              entity=surveyor at=(14.9, 0, 15.2)
 2:30.5  intake    pos(  13.8,   0.0,  -6.5) walk      fear 0.04 lamp on 0.85 lit  6/208/269 entity MEASURING @21.8m      6.7ms
 2:30.7      * entity:state             from=MEASURING state=SEEKING entity=surveyor at=(14.9, 0, 15.2)
 2:32.1      * entity:tick              entity=surveyor at=(15.2, 0, 14.3)
 2:33.8      * entity:tick              entity=surveyor at=(15.2, 0, 12.9)
 2:33.9      * entity:state             from=SEEKING state=MEASURING entity=surveyor at=(15.2, 0, 12.8)
 2:35.5  intake    pos(   5.2,   0.0,  -5.2) walk      fear 0.03 lamp on 0.84 lit  6/208/269 entity MEASURING @20.6m      6.7ms
 2:35.7      * entity:tick              entity=surveyor at=(15.2, 0, 12.8)
 2:37.7      * entity:tick              entity=surveyor at=(15.2, 0, 12.8)

 2:38.0  ── stand in the dark and wait ──
 2:38.9      * entity:state             from=MEASURING state=RETREATING entity=surveyor at=(15.2, 0, 12.8)
 2:40.5  intake    pos(   7.7,   0.0,  -6.3) stil      fear 0.01 lamp on 0.83 lit  6/208/269 entity RETREATING @20.4m     7.1ms
 2:41.6      * entity:tick              entity=surveyor at=(16.1, 0, 12.6)
 2:43.5      * entity:tick              entity=surveyor at=(17.3, 0, 13.1)
 2:44.3      * entity:tick              entity=surveyor at=(17.8, 0, 13.3)
 2:45.5  intake    pos(   7.7,   0.0,  -6.3) stil      fear 0.00 lamp on 0.81 lit  6/208/269 entity RETREATING @22.6m     7.3ms
 2:46.0      * entity:tick              entity=surveyor at=(18.8, 0, 13.7)
 2:47.8      * entity:tick              entity=surveyor at=(19.9, 0, 14.2)
 2:49.9      * entity:tick              entity=surveyor at=(21.2, 0, 14.7)
 2:50.5  intake    pos(   7.7,   0.0,  -6.3) stil      fear 0.00 lamp on 0.80 lit  6/208/269 entity RETREATING @25.2m     7.3ms
 2:50.8      * entity:tick              entity=surveyor at=(21.7, 0, 14.8)
 2:52.3      * entity:tick              entity=surveyor at=(22.7, 0, 14.8)
 2:53.7      * entity:tick              entity=surveyor at=(23.6, 0, 14.8)
 2:55.5  intake    pos(   7.7,   0.0,  -6.3) stil      fear 0.00 lamp on 0.79 lit  6/208/269 entity RETREATING @27.4m     7.3ms
 2:55.6      * entity:tick              entity=surveyor at=(24.7, 0, 15.3)
 2:56.9      * entity:state             from=RETREATING state=DORMANT entity=surveyor at=(25.6, 0, 15.6)
 2:57.5      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 2:58.8      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 2:59.8      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:00.5  intake    pos(   7.7,   0.0,  -6.3) stil      fear 0.00 lamp on 0.78 lit  6/208/269 entity DORMANT @28.2m        7.2ms
 3:01.7      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:02.9      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:04.1      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:05.5  intake    pos(   7.7,   0.0,  -6.3) stil      fear 0.00 lamp on 0.77 lit  6/208/269 entity DORMANT @28.2m        7.2ms
 3:05.9      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:07.2      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)

 3:08.0  ── SCRIPTED: spawn the Surveyor 26 m away, dormant ──

 3:08.0  ── sprint past it — loud enough to be heard ──
 3:08.1      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:09.8      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:10.5  intake    pos(   5.9,   0.0,  -6.2) walk      fear 0.08 lamp on 0.76 lit  6/208/269 entity DORMANT @29.3m        7.4ms
 3:11.1      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:12.1      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:14.2      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:15.5  intake    pos(  19.2,   0.0,  -8.4) walk      fear 0.07 lamp on 0.74 lit  6/208/269 entity DORMANT @24.9m       16.7ms
 3:16.0      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:17.7      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:18.5      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:19.3      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:20.5  intake    pos(  24.8,   0.0,  -4.4) walk      fear 0.05 lamp on 0.73 lit  6/207/269 entity DORMANT @20.0m       16.6ms
 3:20.8      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:22.4      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:23.8      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:25.1      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:25.5  intake    pos(  31.1,   0.0, -12.5) walk      fear 0.05 lamp on 0.72 lit  6/208/269 entity DORMANT @28.6m       27.6ms
 3:26.9      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:28.0      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:29.5      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:30.5  intake    pos(  31.1,   0.0, -15.6) walk      fear 0.04 lamp on 0.71 lit  6/208/269 entity DORMANT @31.6m       27.4ms
 3:31.3      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)

 3:33.0  ── lamp on and keep moving (it only advances in light) ──
 3:33.0      * lamp:toggle              
 3:33.3      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:34.4      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:35.1      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:35.5  intake    pos(  31.1,   0.0, -22.5) walk      fear 0.03 lamp off      lit  6/208/269 entity DORMANT @38.5m       44.0ms
 3:36.9      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:37.6      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:39.1      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:40.5  intake    pos(  31.0,   0.0, -23.0) walk      fear 0.01 lamp off      lit  6/208/269 entity DORMANT @39.0m       48.3ms
 3:41.0      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:42.8      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:43.7      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:45.5  intake    pos(  22.9,   0.0, -21.7) walk      fear 0.03 lamp off      lit  6/208/269 entity DORMANT @37.4m       48.2ms
 3:45.7      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:46.4      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:48.1      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:49.1      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:50.3      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:50.5  intake    pos(  22.8,   0.0, -21.7) stil      fear 0.01 lamp off      lit  6/233/294 entity DORMANT @37.5m       48.2ms
 3:51.4      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:53.3      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:53.9      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:55.5  intake    pos(  22.8,   0.0, -21.7) stil      fear 0.00 lamp off      lit  6/233/294 entity DORMANT @37.5m       48.2ms
 3:55.7      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:57.6      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:58.4      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 3:59.6      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:00.5  intake    pos(  22.8,   0.0, -21.7) stil      fear 0.00 lamp off      lit  6/233/294 entity DORMANT @37.5m       48.0ms
 4:00.8      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:01.9      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:02.8      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:03.4      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:04.4      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:05.5  intake    pos(  22.8,   0.0, -21.7) stil      fear 0.00 lamp off      lit  6/233/294 entity DORMANT @37.5m       48.0ms
 4:06.4      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)

 4:08.0  ── stop, lamp off, stay still — does it lose you? ──
 4:08.0      * lamp:toggle              
 4:08.4      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:09.3      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:10.0      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:10.5  intake    pos(  22.8,   0.0, -21.7) stil      fear 0.00 lamp on 0.70 lit  6/233/294 entity DORMANT @37.5m       47.8ms
 4:11.0      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:12.2      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:14.3      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:15.5  intake    pos(  22.8,   0.0, -21.7) stil      fear 0.00 lamp on 0.68 lit  6/233/294 entity DORMANT @37.5m       47.6ms
 4:15.8      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:16.8      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:17.5      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:18.1      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:20.2      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:20.5  intake    pos(  22.8,   0.0, -21.7) stil      fear 0.00 lamp on 0.67 lit  6/233/294 entity DORMANT @37.5m       47.6ms
 4:21.8      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:23.9      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:24.6      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:25.4      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:25.5  intake    pos(  22.8,   0.0, -21.7) stil      fear 0.00 lamp on 0.66 lit  6/233/294 entity DORMANT @37.5m       47.5ms
 4:27.4      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:28.1      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:29.9      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:30.5  intake    pos(  22.8,   0.0, -21.7) stil      fear 0.00 lamp on 0.65 lit  6/233/294 entity DORMANT @37.5m       47.5ms
 4:31.7      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:32.4      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:33.8      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:35.5  intake    pos(  22.8,   0.0, -21.7) stil      fear 0.00 lamp on 0.64 lit  6/233/294 entity DORMANT @37.5m       47.4ms
 4:35.5      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:36.9      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:38.1      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:38.9      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:39.5      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:40.5  intake    pos(  22.8,   0.0, -21.7) stil      fear 0.00 lamp on 0.63 lit  6/233/294 entity DORMANT @37.5m       47.2ms
 4:41.5      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:43.3      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:44.5      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:45.1      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:45.5  intake    pos(  22.8,   0.0, -21.7) stil      fear 0.00 lamp on 0.61 lit  6/233/294 entity DORMANT @37.5m       37.6ms
 4:47.0      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)

 4:48.0  ── walk to the service door ──
 4:48.9      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:50.0      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:50.5  intake    pos(  22.8,   0.0, -21.7) stil      fear 0.00 lamp on 0.60 lit  6/233/294 entity DORMANT @37.5m       37.5ms
 4:51.8      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:52.6      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:53.4      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:54.2      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:54.9      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:55.5  intake    pos(  22.8,   0.0, -21.7) stil      fear 0.00 lamp on 0.59 lit  6/233/294 entity DORMANT @37.5m       26.5ms
 4:56.8      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:58.4      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 4:59.4      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:00.5  intake    pos(  22.8,   0.0, -21.7) stil      fear 0.00 lamp on 0.58 lit  6/233/294 entity DORMANT @37.5m       26.5ms
 5:01.1      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:02.2      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:04.0      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:05.5  intake    pos(  22.8,   0.0, -21.7) stil      fear 0.00 lamp on 0.56 lit  6/233/294 entity DORMANT @37.5m       10.2ms
 5:05.6      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:07.0      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:08.8      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:10.3      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:10.5  intake    pos(  22.8,   0.0, -21.7) stil      fear 0.00 lamp on 0.55 lit  6/233/294 entity DORMANT @37.5m        5.9ms
 5:11.3      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:12.9      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:13.0      * zone:leave               zone=intake
 5:13.0      * world:teleport           zone=service at=(370.4, 0, 0)
 5:13.0      * zone:enter               zone=service from=intake
 5:13.0      * qa:scripted-zone-change  zone=service

 5:13.0  ── zone settle ──
 5:13.8      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)

 5:14.5  ── service spine — first walk ──
 5:15.5  service   pos( 372.4,   0.0,   0.0) walk      fear 0.01 lamp on 0.54 lit  6/232/294 entity DORMANT @347.2m      14.3ms
 5:15.5      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:16.9      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:18.6      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:19.9      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:20.5  service   pos( 382.9,   0.0,   0.1) walk      fear 0.03 lamp on 0.53 lit  6/233/294 entity DORMANT @357.7m      19.5ms
 5:21.1      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:22.6      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:23.8      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:25.3      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:25.5  service   pos( 393.4,   0.0,  -0.3) walk      fear 0.03 lamp on 0.52 lit  6/233/294 entity DORMANT @368.1m      19.5ms
 5:26.1      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:26.8      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:27.6      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:28.6      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:30.5  service   pos( 402.6,   0.0,   1.0) walk      fear 0.03 lamp on 0.51 lit  6/233/294 entity DORMANT @377.3m      19.5ms
 5:30.5      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:32.6      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:34.3      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:35.3      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:35.5  service   pos( 402.6,   0.0,   1.0) stil      fear 0.01 lamp on 0.49 lit  6/233/294 entity DORMANT @377.3m      19.4ms
 5:37.2      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:39.2      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:40.5  service   pos( 402.6,   0.0,   1.0) walk      fear 0.00 lamp on 0.48 lit  6/233/294 entity DORMANT @377.3m      19.4ms
 5:40.9      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:42.0      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:43.0      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:44.1      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:44.9      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:45.5  service   pos( 401.9,   0.0,   1.0) walk      fear 0.01 lamp on 0.47 lit  6/233/294 entity DORMANT @376.6m      19.4ms
 5:46.6      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:47.3      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:49.3      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)

 5:49.5  ── service spine — sprint ──
 5:50.5  service   pos( 400.1,   0.0,   1.0) walk      fear 0.05 lamp on 0.46 lit  6/233/294 entity DORMANT @374.8m      19.7ms
 5:51.4      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:52.3      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:53.3      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:55.1      * entity:tick              entity=surveyor at=(25.6, 0, 15.6)
 5:55.3      * zone:unload              zone=intake
 5:55.3      * zone:leave               zone=service
 5:55.3      * world:teleport           zone=safe at=(400.6, 0, 799)
 5:55.3      * zone:enter               zone=safe from=service
 5:55.3      * progress:discovery       id=office title=The Office of Record
 5:55.5  safe      pos( 400.6,   0.0, 799.2) walk      fear 0.08 lamp on 0.45 lit  0/ 96/98 entity DORMANT @868.8m      19.8ms
 5:57.3      * zone:leave               zone=safe
 5:57.3      * world:teleport           zone=service at=(370.4, 0, 0)
 5:57.3      * zone:enter               zone=service from=safe
 6:00.5  service   pos( 378.3,   0.0,  -0.2) walk      fear 0.05 lamp on 0.43 lit  6/ 96/98 entity DORMANT @353.1m     111.7ms
 6:04.5      * zone:unload              zone=duct
 6:04.5      * zone:leave               zone=service
 6:04.5      * world:teleport           zone=cistern at=(774, 2.6, 0)
 6:04.5      * zone:enter               zone=cistern from=service
 6:04.5      * qa:scripted-zone-change  zone=cistern

 6:04.5  ── zone settle ──

 6:06.0  ── cistern — wading ──
 6:06.0      * lamp:toggle              
 6:06.0  cistern   pos( 773.1,   2.6,   0.0) stil crch fear 0.03 lamp on 0.42 lit  3/ 87/90 entity DORMANT @747.7m     171.6ms
 6:11.0  cistern   pos( 777.5,   2.6,   0.1) walk crch fear 0.06 lamp off      lit  4/ 87/90 entity DORMANT @752.1m     279.3ms
 6:16.0  cistern   pos( 777.5,   2.6,   0.4) stil crch fear 0.05 lamp off      lit  4/ 87/90 entity DORMANT @752.1m     279.1ms
 6:21.0  cistern   pos( 777.5,   2.6,   0.2) stil crch fear 0.05 lamp off      lit  4/ 87/90 entity DORMANT @752.1m     279.1ms
 6:26.0  cistern   pos( 777.5,   2.6,   0.4) stil crch fear 0.05 lamp off      lit  4/ 87/90 entity DORMANT @752.1m     279.0ms
 6:31.0  cistern   pos( 777.5,   2.6,  -0.1) walk crch fear 0.05 lamp off      lit  4/ 87/90 entity DORMANT @752.1m     278.8ms
 6:36.0  cistern   pos( 777.5,   2.6,  -0.3) stil crch fear 0.05 lamp off      lit  4/ 87/90 entity DORMANT @752.1m     278.4ms

 6:41.0  ── cistern — stand still in the water ──
 6:41.0  cistern   pos( 777.5,   2.6,  -0.3) stil crch fear 0.06 lamp off      lit  4/ 87/90 entity DORMANT @752.1m     278.2ms
 6:46.0  cistern   pos( 777.5,   2.6,  -0.3) stil crch fear 0.05 lamp off      lit  4/ 87/90 entity DORMANT @752.1m     281.9ms
 6:51.0  cistern   pos( 777.5,   2.6,  -0.3) stil crch fear 0.05 lamp off      lit  4/ 87/90 entity DORMANT @752.1m     281.6ms
 6:56.0  cistern   pos( 777.5,   2.6,  -0.3) stil crch fear 0.05 lamp off      lit  4/ 87/90 entity DORMANT @752.1m     281.2ms
 7:01.0      * zone:leave               zone=cistern
 7:01.0      * world:teleport           zone=safe at=(400.6, 0, 799)
 7:01.0      * zone:enter               zone=safe from=cistern
 7:01.0      * qa:scripted-zone-change  zone=safe

 7:01.0  ── zone settle ──
 7:01.0  cistern   pos( 777.5,   2.6,  -0.3) stil crch fear 0.05 lamp off      lit  4/ 87/90 entity DORMANT @752.1m     282.1ms
 7:01.7      * zone:leave               zone=safe
 7:01.7      * world:teleport           zone=service at=(370.4, 0, 0)
 7:01.7      * zone:enter               zone=service from=safe

 7:02.5  ── the safe room ──
 7:06.0  service   pos( 377.8,   0.0,   0.0) walk      fear 0.03 lamp off      lit  6/ 87/90 entity DORMANT @352.6m     346.1ms
 7:11.0  service   pos( 388.0,   0.0,  -0.3) walk      fear 0.03 lamp off      lit  6/ 86/90 entity DORMANT @362.8m     346.2ms
 7:16.0  service   pos( 398.4,   0.0,   0.4) walk      fear 0.03 lamp off      lit  6/ 87/90 entity DORMANT @373.2m     346.6ms
 7:21.0  service   pos( 402.2,   0.0,   1.0) stil      fear 0.01 lamp off      lit  6/ 87/90 entity DORMANT @376.9m     346.3ms
 7:26.0  service   pos( 402.6,   0.0,   1.0) walk      fear 0.01 lamp off      lit  6/ 87/90 entity DORMANT @377.3m     314.3ms
```

`lit A/B/C` = lights uploaded to shaders / fixtures above 5% brightness / fixtures resident.

## Entity state transitions

| t | from | to | active |
|---|---|---|---|
| 1:47.9 | DORMANT | ROUSED | true |
| 1:51.4 | ROUSED | SEEKING | true |
| 2:04.3 | SEEKING | MEASURING | true |
| 2:06.8 | MEASURING | SEEKING | true |
| 2:10.4 | SEEKING | APPROACHING | true |
| 2:17.8 | APPROACHING | MEASURING | true |
| 2:22.9 | MEASURING | SEEKING | true |
| 2:22.9 | SEEKING | MEASURING | true |
| 2:30.7 | MEASURING | SEEKING | true |
| 2:34.0 | SEEKING | MEASURING | true |
| 2:38.9 | MEASURING | RETREATING | true |
| 2:56.9 | RETREATING | DORMANT | true |

## Filmstrip

33 frames, one every ~15 s of play. See `filmstrip.md` for them in order.

## Subsystems at the end of the session

```json
{
  "state": "play",
  "zone": "service",
  "subsystems": {
    "world": true,
    "audio": true,
    "gameplay": true,
    "ui": true,
    "cinematics": true
  },
  "engine": {
    "ms": 254.2641666667536,
    "fps": 3.9329175365502076,
    "p90": 10.100000001490116,
    "calls": 155,
    "tris": 206470,
    "quality": "low",
    "res": "397x223"
  },
  "lights": {
    "fixtures": 90,
    "lit": 87,
    "active": 6,
    "shadows": 2
  },
  "entity": {
    "entity": "surveyor",
    "state": "DORMANT",
    "stateTime": 270.57,
    "position": [
      25.56,
      0,
      15.6
    ],
    "heading": 1.178,
    "target": [
      10.98,
      0,
      10.2
    ],
    "confidence": 0,
    "illumination": 0,
    "lightScale": 0,
    "speed": 0,
    "frozen": true,
    "stoop": 0,
    "measureHold": 0,
    "distToPlayer": 377.29,
    "usingGlb": true
  },
  "gameplay": {
    "surveyor": {
      "entity": "surveyor",
      "state": "DORMANT",
      "stateTime": 270.57,
      "position": [
        25.56,
        0,
        15.6
      ],
      "heading": 1.178,
      "target": [
        10.98,
        0,
        10.2
      ],
      "confidence": 0,
      "illumination": 0,
      "lightScale": 0,
      "speed": 0,
      "frozen": true,
      "stoop": 0,
      "measureHold": 0,
      "distToPlayer": 377.29,
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
      "fear": 0.004,
      "tension": 0,
      "intensity": 0.15,
      "sinceBeat": 59,
      "nextBeatAt": 220.2,
      "grace": 0,
      "zone": "service",
      "objective": null,
      "deaths": 0,
      "hidden": false,
      "lastBeats": [
        "distant_door"
      ]
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
      "exposure": 1
    },
    "inventory": {
      "items": {
        "lamp": 1
      },
      "selected": "lamp"
    }
  },
  "audio": {
    "voices": 14,
    "oneShots": 2,
    "loops": 12,
    "nodes": 349,
    "occlChecks": 24777,
    "denied": 0,
    "reverb": "service",
    "zone": "service",
    "hums": 8,
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
