# THE ANNEX — continuous playthrough

Generated 2026-07-30T08:35:47.667Z by `tools/qa/playthrough.mjs`.

**26850 frames · 447.5 s of simulated play at a fixed 1/60 step · 602 s of wall clock · quality `low` · 640×360**

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
| **FAIL** | the frame loop never stalls (no frame > 5 s) | max 9805 ms, p99 7 ms, p50 0.20 ms |
| **PASS** | post-warmup frame times stay bounded (p99 < 250 ms) | warm p50 0.20 ms, p90 0.40 ms, p99 6.60 ms |
| **PASS** | simulated time advanced continuously | 26850 frames |
| **PASS** | at least one entity state transition occurred | DORMANT->ROUSED@108.35s, ROUSED->SEEKING@111.85s, SEEKING->APPROACHING@127.9s, APPROACHING->CAPTURING@129.88s, CAPTURING->DORMANT@135.45s |
| **PASS** | audio subsystem reports as constructed | subsystems.audio=true, ctx state=running |
| **PASS** | footsteps fired while walking | 562 player:step events |
| **FAIL** | every zone visited reported lit fixtures | min active lights = 0 |

**2 check(s) failed.**

## Pacing

- **Session length:** 447.5 s (7.5 min) of play.
- **Zero-threat time:** 75.7% of samples had no active entity and fear below 0.15.
- **The Surveyor was active at some point.**
- **Threat episodes:** 1 — 26.5s (ROUSED→SEEKING→APPROACHING→CAPTURING, closest 0.85 m)
- **Fear:** median 0.03, p90 0.286, peak 0.538. Above 0.3 for 1.6% of the session, above 0.5 for 1.2%.
- **Director beats fired:** 1 — distant_door at 1:47.9
- **Longest stretch with nothing on the bus except footsteps:** 447.5 s (0:00.0 → 7:27.5).
- **Moving:** 60% of samples.
- **Zones:** intake (0:00.5–5:13.0) → service (5:14.5–6:22.5) → safe (6:23.0–6:25.0) → service (6:25.5–7:26.5) → safe (7:27.0–7:27.5)

### Frame time (CPU rasteriser — not a frame-rate verdict)

| | p50 | p90 | p99 | max |
|---|---:|---:|---:|---:|
| whole session | 0.20 | 0.40 | 6.60 | 9805 |
| after 3 s warmup | 0.20 | 0.40 | 6.60 | 9805 |

All in milliseconds. The multi-second outliers are first-frame shader compiles
after a camera or zone change, which is a property of SwiftShader, not of the renderer.

## Event census

| event | count |
|---|---:|
| `player:noise` | 568 |
| `player:step` | 562 |
| `entity:tick` | 91 |
| `entity:heard` | 37 |
| `qa:phase` | 21 |
| `zone:leave` | 8 |
| `world:teleport` | 8 |
| `zone:enter` | 8 |
| `lamp:toggle` | 5 |
| `entity:state` | 5 |
| `qa:scripted-zone-change` | 3 |
| `director:entity-placed` | 1 |
| `director:beat` | 1 |
| `sfx:distant` | 1 |
| `world:noise` | 1 |
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
 0:00.5  intake    pos( -24.0,   0.0,  24.8) stil      fear 0.00 lamp on 0.99 lit  6/142/201 entity not spawned        5800.1ms
 0:05.5  intake    pos( -24.0,   0.0,  24.8) stil      fear 0.00 lamp on 0.98 lit  6/142/201 entity not spawned        2754.8ms

 0:08.0  ── first walk, no lamp ──
 0:10.5  intake    pos( -21.0,   0.0,  23.1) walk      fear 0.03 lamp on 0.97 lit  6/142/201 entity not spawned        2402.8ms
 0:15.5  intake    pos( -10.3,   0.0,  23.2) walk      fear 0.03 lamp on 0.96 lit  6/142/201 entity not spawned        1757.7ms
 0:19.9      * director:entity-placed   
 0:19.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:20.5  intake    pos(  -0.3,   0.0,  22.4) walk      fear 0.03 lamp on 0.95 lit  6/142/201 entity DORMANT @25.1m     1386.7ms
 0:21.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:23.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:23.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:25.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:25.5  intake    pos(  -0.8,   0.0,  17.8) walk      fear 0.03 lamp on 0.93 lit  6/142/201 entity DORMANT @26.2m     1215.0ms
 0:26.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:28.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:29.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:30.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:30.5  intake    pos(   7.0,   0.0,  16.9) walk      fear 0.03 lamp on 0.92 lit  6/142/201 entity DORMANT @19.0m     1030.9ms
 0:31.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:33.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:34.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:35.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:35.5  intake    pos(  11.9,   0.0,  15.1) walk      fear 0.03 lamp on 0.91 lit  6/142/201 entity DORMANT @15.5m      895.5ms
 0:36.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)

 0:38.0  ── lamp on ──
 0:38.0      * lamp:toggle              
 0:38.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:39.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:40.5  intake    pos(  19.4,   0.0,  11.6) walk      fear 0.05 lamp off      lit  6/142/201 entity DORMANT @13.1m     1123.8ms
 0:40.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:41.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:42.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:43.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:45.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:45.5  intake    pos(  23.8,   0.0,   2.4) walk      fear 0.03 lamp off      lit  6/207/269 entity DORMANT @21.2m     1006.6ms
 0:46.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:47.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:48.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:49.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:50.5  intake    pos(  26.7,   0.0,  -6.5) walk      fear 0.03 lamp off      lit  6/208/269 entity DORMANT @30.0m      963.3ms
 0:51.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:52.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:52.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:53.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:54.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:54.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:55.5  intake    pos(  25.4,   0.0,   2.9) walk      fear 0.03 lamp off      lit  6/208/269 entity DORMANT @20.6m      890.6ms
 0:56.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 0:58.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:00.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:00.5  intake    pos(  25.3,   0.0,   7.3) walk      fear 0.04 lamp off      lit  6/208/269 entity DORMANT @16.2m      818.4ms
 1:01.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)

 1:03.0  ── stop and listen (lamp on) ──
 1:03.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:04.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:05.5  intake    pos(  24.0,   0.0,   3.0) stil      fear 0.02 lamp off      lit  6/208/269 entity DORMANT @20.6m      757.3ms
 1:05.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:07.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:07.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:10.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:10.5  intake    pos(  24.0,   0.0,   3.0) stil      fear 0.00 lamp off      lit  6/207/269 entity DORMANT @20.6m      711.6ms
 1:11.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:12.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:13.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:14.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:15.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:15.5  intake    pos(  24.0,   0.0,   3.0) stil      fear 0.00 lamp off      lit  6/208/269 entity DORMANT @20.6m      664.9ms
 1:16.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:17.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:18.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:19.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:20.5  intake    pos(  24.0,   0.0,   3.0) stil      fear 0.00 lamp off      lit  6/208/269 entity DORMANT @20.6m      623.9ms
 1:21.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:22.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)

 1:23.0  ── crouch-walk — nearly silent ──
 1:23.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:23.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:25.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:25.5  intake    pos(  24.6,   0.0,   5.5) walk crch fear 0.02 lamp off      lit  6/208/269 entity DORMANT @18.1m      592.6ms
 1:27.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:27.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:28.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:29.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:30.5  intake    pos(  23.6,   0.0,   5.0) walk crch fear 0.02 lamp off      lit  6/208/269 entity DORMANT @18.5m      305.5ms
 1:30.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:32.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:34.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:35.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:35.5  intake    pos(  21.9,   0.0,   8.2) walk crch fear 0.03 lamp off      lit  6/208/269 entity DORMANT @15.6m      297.4ms
 1:36.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:37.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:38.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:40.5  intake    pos(  18.0,   0.0,  11.9) walk crch fear 0.03 lamp off      lit  6/208/269 entity DORMANT @13.5m      215.7ms
 1:40.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:41.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:43.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:44.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:45.5  intake    pos(  14.1,   0.0,  15.3) walk crch fear 0.04 lamp off      lit  6/208/269 entity DORMANT @13.6m      215.7ms
 1:45.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:47.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:47.9      * director:beat            zone=intake name=distant_door fear=0.03
 1:47.9      * sfx:distant              kind=door at=(5.9, 0, 31.8)

 1:48.0  ── sprint — deliberately loud ──
 1:48.3      * entity:state             from=DORMANT state=ROUSED entity=surveyor at=(24.8, 0, 23.5)
 1:48.3      * entity:heard             entity=surveyor strength=0.118 radius=11 at=(13.6, 0, 15.6)
 1:48.6      * entity:heard             entity=surveyor strength=0.106 radius=11 at=(13.6, 0, 15.6)
 1:48.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:48.9      * entity:heard             entity=surveyor strength=0.095 radius=11 at=(13.6, 0, 15.6)
 1:49.2      * entity:heard             entity=surveyor strength=0.085 radius=11 at=(13.6, 0, 15.6)
 1:49.5      * entity:heard             entity=surveyor strength=0.07 radius=11 at=(13.6, 0, 15.6)
 1:50.5  intake    pos(   4.2,   0.0,  15.5) walk      fear 0.09 lamp off      lit  6/208/269 entity ROUSED @22.1m       215.5ms
 1:50.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:51.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.5)
 1:51.8      * entity:state             from=ROUSED state=SEEKING entity=surveyor at=(24.8, 0, 23.5)
 1:53.3      * entity:tick              entity=surveyor at=(23.9, 0, 23.2)
 1:54.8      * entity:tick              entity=surveyor at=(22.8, 0, 22.7)
 1:55.5  intake    pos(   2.1,   0.0,  17.7) walk      fear 0.07 lamp off      lit  6/208/269 entity SEEKING @20.8m      202.4ms
 1:55.8      * entity:tick              entity=surveyor at=(22.1, 0, 22.4)
 1:57.1      * entity:tick              entity=surveyor at=(21.3, 0, 21.8)
 1:57.8      * entity:heard             entity=surveyor strength=0.15 radius=11 at=(13.6, 0, 15.6)
 1:58.0      * entity:tick              entity=surveyor at=(20.7, 0, 21.2)
 1:58.2      * entity:heard             entity=surveyor strength=0.166 radius=11 at=(13.6, 0, 15.6)
 1:58.6      * entity:heard             entity=surveyor strength=0.079 radius=6 at=(13.6, 0, 15.6)
 1:59.0      * entity:heard             entity=surveyor strength=0.106 radius=6 at=(13.6, 0, 15.6)
 1:59.0      * entity:tick              entity=surveyor at=(20.2, 0, 20.6)
 1:59.3      * entity:heard             entity=surveyor strength=0.133 radius=6 at=(13.6, 0, 15.6)
 1:59.7      * entity:heard             entity=surveyor strength=0.161 radius=6 at=(13.6, 0, 15.6)
 2:00.1      * entity:heard             entity=surveyor strength=0.189 radius=6 at=(13.6, 0, 15.6)
 2:00.5      * entity:heard             entity=surveyor strength=0.208 radius=6 at=(13.6, 0, 15.6)
 2:00.5  intake    pos(  13.8,   0.0,  18.8) walk      fear 0.26 lamp off      lit  6/208/269 entity SEEKING @5.6m       216.9ms
 2:00.6      * entity:tick              entity=surveyor at=(19.2, 0, 19.7)
 2:00.9      * entity:heard             entity=surveyor strength=0.202 radius=6 at=(13.6, 0, 15.6)
 2:01.3      * entity:heard             entity=surveyor strength=0.184 radius=6 at=(13.6, 0, 15.6)
 2:01.7      * entity:heard             entity=surveyor strength=0.168 radius=6 at=(13.6, 0, 15.6)
 2:02.0      * entity:heard             entity=surveyor strength=0.152 radius=6 at=(13.6, 0, 15.6)
 2:02.5      * entity:heard             entity=surveyor strength=0.136 radius=6 at=(13.6, 0, 15.6)
 2:02.7      * entity:tick              entity=surveyor at=(17.8, 0, 18.9)
 2:02.8      * entity:heard             entity=surveyor strength=0.361 radius=6 at=(8.7, 0, 19.7)
 2:03.2      * entity:heard             entity=surveyor strength=0.588 radius=11 at=(8.2, 0, 20.1)
 2:03.6      * entity:heard             entity=surveyor strength=0.276 radius=6 at=(8.2, 0, 20.1)
 2:04.0      * entity:heard             entity=surveyor strength=0.537 radius=11 at=(5.5, 0, 19.5)
 2:04.4      * entity:heard             entity=surveyor strength=0.523 radius=11 at=(5.3, 0, 18.8)
 2:04.5      * entity:tick              entity=surveyor at=(16.5, 0, 18.5)
 2:04.8      * entity:heard             entity=surveyor strength=0.179 radius=6 at=(5.3, 0, 18.8)
 2:05.2      * entity:heard             entity=surveyor strength=0.48 radius=11 at=(3.5, 0, 18.9)
 2:05.5  intake    pos(   3.1,   0.0,  19.6) walk      fear 0.18 lamp off      lit  6/208/269 entity SEEKING @12.5m      216.9ms
 2:05.5      * entity:heard             entity=surveyor strength=0.133 radius=6 at=(3.5, 0, 18.9)
 2:05.9      * entity:heard             entity=surveyor strength=0.182 radius=6 at=(3.5, 0, 18.9)
 2:06.3      * entity:tick              entity=surveyor at=(14.9, 0, 18.5)
 2:06.3      * entity:heard             entity=surveyor strength=0.267 radius=6 at=(3.5, 0, 18.9)
 2:06.7      * entity:heard             entity=surveyor strength=0.341 radius=6 at=(3.5, 0, 18.9)
 2:07.1      * entity:heard             entity=surveyor strength=0.386 radius=6 at=(3.5, 0, 18.9)
 2:07.5      * entity:heard             entity=surveyor strength=0.467 radius=6 at=(4.9, 0, 18)
 2:07.9      * entity:heard             entity=surveyor strength=0.555 radius=6 at=(7, 0, 18.7)
 2:07.9      * entity:state             from=SEEKING state=APPROACHING entity=surveyor at=(13.6, 0, 18.5)

 2:08.0  ── walk on, lamp off (the entity only moves in light) ──
 2:08.0      * entity:heard             entity=surveyor strength=0.362 radius=3.4 at=(7, 0, 18.7)
 2:08.0      * lamp:toggle              
 2:08.3      * entity:heard             entity=surveyor strength=0.643 radius=6 at=(8, 0, 17.7)
 2:08.4      * entity:tick              entity=surveyor at=(13.2, 0, 18.5)
 2:08.8      * entity:heard             entity=surveyor strength=0.732 radius=6 at=(9.1, 0, 18)
 2:09.2      * entity:heard             entity=surveyor strength=0.82 radius=6 at=(10, 0, 18)
 2:09.7      * entity:heard             entity=surveyor strength=0.9 radius=6 at=(10.5, 0, 17.5)
 2:09.9      * entity:state             from=APPROACHING state=CAPTURING entity=surveyor at=(11.9, 0, 18.5)
 2:10.0      * entity:tick              entity=surveyor at=(11.8, 0, 18.5)
 2:10.5  intake    pos(  12.6,   0.0,  17.4) walk      fear 0.52 lamp on 0.90 lit  6/208/269 entity CAPTURING @1.3m      60.2ms
 2:11.0      * entity:tick              entity=surveyor at=(11.8, 0, 18)
 2:11.2      * game:death               cause=surveyor at=(11.9, 0, 18)
 2:11.2      * cine:begin               name=death cause=surveyor
 2:12.6      * entity:tick              entity=surveyor at=(12.5, 0, 17.5)
 2:14.0      * entity:tick              entity=surveyor at=(13.1, 0, 17.1)
 2:15.1      * entity:tick              entity=surveyor at=(13.1, 0, 17.1)
 2:15.4      * entity:state             from=CAPTURING state=DORMANT entity=surveyor at=(13.1, 0, 17.1)
 2:15.4      * cine:end                 name=death
 2:15.4      * game:respawn             
 2:15.5  intake    pos(  13.9,   0.0,  16.6) walk      fear 0.20 lamp on 0.89 lit  6/208/269 entity DORMANT @30.0m       59.3ms
 2:20.5  intake    pos(  11.3,   0.0,  15.1) stil      fear 0.03 lamp on 0.88 lit  6/145/269 entity DORMANT @32.8m       27.2ms
 2:25.5  intake    pos(   7.6,   0.0,  15.1) walk      fear 0.02 lamp on 0.86 lit  6/145/269 entity DORMANT @36.4m       27.2ms
 2:30.5  intake    pos(   0.2,   0.0,  19.4) walk      fear 0.03 lamp on 0.85 lit  6/145/269 entity DORMANT @43.3m       27.4ms
 2:35.5  intake    pos(   1.5,   0.0,  21.1) walk      fear 0.03 lamp on 0.84 lit  6/145/269 entity DORMANT @41.9m       27.6ms

 2:38.0  ── stand in the dark and wait ──
 2:40.5  intake    pos(   4.5,   0.0,  17.4) stil      fear 0.01 lamp on 0.83 lit  6/145/269 entity DORMANT @39.1m       45.5ms
 2:45.5  intake    pos(   4.5,   0.0,  17.4) stil      fear 0.00 lamp on 0.81 lit  6/145/269 entity DORMANT @39.1m       45.6ms
 2:50.5  intake    pos(   4.5,   0.0,  17.4) stil      fear 0.00 lamp on 0.80 lit  6/145/269 entity DORMANT @39.1m       45.7ms
 2:55.5  intake    pos(   4.5,   0.0,  17.4) stil      fear 0.00 lamp on 0.79 lit  6/145/269 entity DORMANT @39.1m       45.9ms
 3:00.5  intake    pos(   4.5,   0.0,  17.4) stil      fear 0.00 lamp on 0.78 lit  6/145/269 entity DORMANT @39.1m       38.4ms
 3:05.5  intake    pos(   4.5,   0.0,  17.4) stil      fear 0.00 lamp on 0.77 lit  6/145/269 entity DORMANT @39.1m       38.5ms

 3:08.0  ── SCRIPTED: spawn the Surveyor 26 m away, dormant ──

 3:08.0  ── sprint past it — loud enough to be heard ──
 3:10.5  intake    pos(   5.0,   0.0,  19.6) walk      fear 0.08 lamp on 0.76 lit  6/145/269 entity DORMANT @38.5m       60.1ms
 3:15.5  intake    pos(  -8.3,   0.0,  17.6) walk      fear 0.07 lamp on 0.74 lit  6/145/269 entity DORMANT @51.9m       60.3ms
 3:20.5  intake    pos( -13.1,   0.0,  15.1) walk      fear 0.05 lamp on 0.73 lit  6/144/269 entity DORMANT @56.9m       60.3ms
 3:25.5  intake    pos( -10.9,   0.0,  17.1) walk      fear 0.05 lamp on 0.72 lit  6/145/269 entity DORMANT @54.6m       60.3ms
 3:30.5  intake    pos(   0.7,   0.0,  16.3) walk      fear 0.05 lamp on 0.71 lit  6/145/269 entity DORMANT @43.1m       45.9ms

 3:33.0  ── lamp on and keep moving (it only advances in light) ──
 3:33.0      * lamp:toggle              
 3:35.5  intake    pos(   1.3,   0.0,  21.4) walk      fear 0.04 lamp off      lit  6/145/269 entity DORMANT @42.1m       45.9ms
 3:40.5  intake    pos(   6.9,   0.0,  15.1) stil      fear 0.03 lamp off      lit  6/145/269 entity DORMANT @37.1m       46.0ms
 3:45.5  intake    pos(   6.8,   0.0,  15.1) stil      fear 0.01 lamp off      lit  6/145/269 entity DORMANT @37.2m       46.2ms
 3:50.5  intake    pos(  11.5,   0.0,  15.1) walk      fear 0.02 lamp off      lit  6/145/269 entity DORMANT @32.6m       46.5ms
 3:55.5  intake    pos(  19.3,   0.0,  11.7) walk      fear 0.03 lamp off      lit  6/145/269 entity DORMANT @26.1m       46.6ms
 4:00.5  intake    pos(  23.8,   0.0,   2.5) walk      fear 0.03 lamp off      lit  6/145/269 entity DORMANT @27.4m       46.5ms
 4:05.5  intake    pos(  23.1,   0.0,   7.6) walk      fear 0.03 lamp off      lit  6/145/269 entity DORMANT @24.7m       46.4ms

 4:08.0  ── stop, lamp off, stay still — does it lose you? ──
 4:08.0      * lamp:toggle              
 4:10.5  intake    pos(  19.0,   0.0,  11.2) stil      fear 0.01 lamp on 0.70 lit  6/145/269 entity DORMANT @26.6m       28.8ms
 4:15.5  intake    pos(  19.0,   0.0,  11.2) stil      fear 0.00 lamp on 0.68 lit  6/145/269 entity DORMANT @26.6m       28.7ms
 4:20.5  intake    pos(  19.0,   0.0,  11.2) stil      fear 0.00 lamp on 0.67 lit  6/145/269 entity DORMANT @26.6m       28.9ms
 4:25.5  intake    pos(  19.0,   0.0,  11.2) stil      fear 0.00 lamp on 0.66 lit  6/145/269 entity DORMANT @26.6m       28.8ms
 4:30.5  intake    pos(  19.0,   0.0,  11.2) stil      fear 0.00 lamp on 0.65 lit  6/145/269 entity DORMANT @26.6m       28.7ms
 4:35.5  intake    pos(  19.0,   0.0,  11.2) stil      fear 0.00 lamp on 0.64 lit  6/145/269 entity DORMANT @26.6m       28.6ms
 4:40.5  intake    pos(  19.0,   0.0,  11.2) stil      fear 0.00 lamp on 0.63 lit  6/145/269 entity DORMANT @26.6m        6.8ms
 4:45.5  intake    pos(  19.0,   0.0,  11.2) stil      fear 0.00 lamp on 0.61 lit  6/145/269 entity DORMANT @26.6m        6.5ms

 4:48.0  ── walk to the service door ──
 4:50.5  intake    pos(  15.2,   0.0,  14.8) walk      fear 0.03 lamp on 0.60 lit  6/145/269 entity DORMANT @29.0m        6.6ms
 4:55.5  intake    pos(   5.7,   0.0,  16.3) walk      fear 0.03 lamp on 0.59 lit  6/145/269 entity DORMANT @38.1m        6.3ms
 5:00.5  intake    pos(  11.1,   0.0,  18.3) walk      fear 0.03 lamp on 0.58 lit  6/145/269 entity DORMANT @32.5m        6.3ms
 5:05.5  intake    pos(  18.1,   0.0,  12.8) walk      fear 0.03 lamp on 0.56 lit  6/145/269 entity DORMANT @26.8m        6.4ms
 5:10.5  intake    pos(  23.5,   0.0,   4.0) walk      fear 0.03 lamp on 0.55 lit  6/145/269 entity DORMANT @26.6m        6.5ms
 5:13.0      * zone:leave               zone=intake
 5:13.0      * world:teleport           zone=service at=(370.4, 0, 0)
 5:13.0      * zone:enter               zone=service from=intake
 5:13.0      * qa:scripted-zone-change  zone=service

 5:13.0  ── zone settle ──

 5:14.5  ── service spine — first walk ──
 5:15.5  service   pos( 372.4,   0.0,   0.0) walk      fear 0.04 lamp on 0.54 lit  0/160/286 entity DORMANT @329.7m      75.0ms
 5:20.5  service   pos( 382.9,   0.0,   0.1) walk      fear 0.06 lamp on 0.53 lit  1/161/286 entity DORMANT @340.2m     144.8ms
 5:25.5  service   pos( 384.7,   0.0,   0.1) stil      fear 0.10 lamp on 0.52 lit  1/161/286 entity DORMANT @342.0m     144.7ms
 5:30.5  service   pos( 384.7,   0.0,   0.1) stil      fear 0.04 lamp on 0.51 lit  1/161/286 entity DORMANT @342.0m     144.7ms
 5:35.5  service   pos( 384.7,   0.0,   0.1) stil      fear 0.03 lamp on 0.49 lit  1/161/286 entity DORMANT @342.0m     144.5ms
 5:40.5  service   pos( 384.7,   0.0,   0.1) stil      fear 0.03 lamp on 0.48 lit  1/161/286 entity DORMANT @342.0m     144.3ms
 5:45.5  service   pos( 384.7,   0.0,   0.1) stil      fear 0.03 lamp on 0.47 lit  1/161/286 entity DORMANT @342.0m     144.5ms

 5:49.5  ── service spine — sprint ──
 5:50.5  service   pos( 384.7,   0.0,   0.1) stil      fear 0.08 lamp on 0.46 lit  1/160/286 entity DORMANT @342.0m     144.3ms
 5:55.5  service   pos( 384.7,   0.0,   0.1) stil      fear 0.11 lamp on 0.45 lit  1/161/286 entity DORMANT @342.0m     144.2ms
 6:00.5  service   pos( 384.7,   0.0,   0.1) stil      fear 0.08 lamp on 0.43 lit  1/161/286 entity DORMANT @342.0m     144.3ms
 6:04.5      * zone:leave               zone=service
 6:04.5      * world:teleport           zone=cistern at=(774, 2.6, 0)
 6:04.5      * zone:enter               zone=cistern from=service
 6:04.5      * qa:scripted-zone-change  zone=cistern

 6:04.5  ── zone settle ──
 6:05.2      * zone:leave               zone=cistern
 6:05.2      * world:teleport           zone=service at=(370.4, 0, 0)
 6:05.2      * zone:enter               zone=service from=cistern

 6:06.0  ── cistern — wading ──
 6:06.0      * lamp:toggle              
 6:06.0  service   pos( 370.4,   0.0,   0.0) stil      fear 0.06 lamp on 0.42 lit  0/160/286 entity DORMANT @327.7m     225.5ms
 6:11.0  service   pos( 380.6,   0.0,   0.1) walk      fear 0.29 lamp off      lit  0/161/286 entity DORMANT @337.9m     276.8ms
 6:16.0  service   pos( 390.9,   0.0,  -0.3) walk      fear 0.29 lamp off      lit  1/161/286 entity DORMANT @348.1m     345.9ms
 6:21.0  service   pos( 398.6,   0.0,   1.0) stil      fear 0.29 lamp off      lit  1/160/286 entity DORMANT @355.8m     345.9ms
 6:22.9      * zone:unload              zone=intake
 6:22.9      * zone:leave               zone=service
 6:22.9      * world:teleport           zone=safe at=(400.6, 0, 799)
 6:22.9      * zone:enter               zone=safe from=service
 6:22.9      * progress:discovery       id=office title=The Office of Record
 6:25.0      * zone:leave               zone=safe
 6:25.0      * world:teleport           zone=service at=(370.4, 0, 0)
 6:25.0      * zone:enter               zone=service from=safe
 6:26.0  service   pos( 372.0,   0.0,  -0.8) walk      fear 0.28 lamp off      lit  0/ 24/90 entity DORMANT @329.4m     440.0ms
 6:31.0  service   pos( 382.5,   0.0,  -0.8) walk      fear 0.29 lamp off      lit  1/ 24/90 entity DORMANT @339.8m     439.9ms
 6:36.0  service   pos( 393.0,   0.0,  -0.9) walk      fear 0.28 lamp off      lit  1/ 24/90 entity DORMANT @350.3m     439.9ms

 6:41.0  ── cistern — stand still in the water ──
 6:41.0  service   pos( 403.4,   0.0,  -0.4) walk      fear 0.29 lamp off      lit  1/ 24/90 entity DORMANT @360.6m     439.8ms
 6:46.0  service   pos( 403.5,   0.0,  -0.4) stil      fear 0.27 lamp off      lit  1/ 24/90 entity DORMANT @360.7m     371.2ms
 6:51.0  service   pos( 403.5,   0.0,  -0.4) stil      fear 0.27 lamp off      lit  1/ 24/90 entity DORMANT @360.7m     301.0ms
 6:56.0  service   pos( 403.5,   0.0,  -0.4) stil      fear 0.27 lamp off      lit  1/ 24/90 entity DORMANT @360.7m     305.3ms
 7:01.0      * zone:leave               zone=service
 7:01.0      * world:teleport           zone=safe at=(400.6, 0, 799)
 7:01.0      * zone:enter               zone=safe from=service
 7:01.0      * qa:scripted-zone-change  zone=safe

 7:01.0  ── zone settle ──
 7:01.0  service   pos( 403.5,   0.0,  -0.4) stil      fear 0.27 lamp off      lit  1/ 24/90 entity DORMANT @360.7m     305.1ms
 7:01.7      * zone:leave               zone=safe
 7:01.7      * world:teleport           zone=service at=(370.4, 0, 0)
 7:01.7      * zone:enter               zone=service from=safe

 7:02.5  ── the safe room ──
 7:06.0  service   pos( 377.6,   0.0,   0.0) walk      fear 0.29 lamp off      lit  0/ 24/90 entity DORMANT @334.9m     314.2ms
 7:11.0  service   pos( 387.7,   0.0,  -0.3) walk      fear 0.29 lamp off      lit  1/ 24/90 entity DORMANT @344.9m     314.3ms
 7:16.0  service   pos( 398.1,   0.0,  -0.1) walk      fear 0.28 lamp off      lit  1/ 24/90 entity DORMANT @355.4m     314.1ms
 7:21.0  service   pos( 402.2,   0.0,   1.0) stil      fear 0.28 lamp off      lit  1/ 24/90 entity DORMANT @359.3m     314.1ms
 7:26.0  service   pos( 398.2,   0.0,   2.0) walk      fear 0.28 lamp off      lit  1/ 24/90 entity DORMANT @355.3m     314.1ms
 7:26.6      * zone:leave               zone=service
 7:26.6      * world:teleport           zone=safe at=(400.6, 0, 799)
 7:26.6      * zone:enter               zone=safe from=service
```

`lit A/B/C` = lights uploaded to shaders / fixtures above 5% brightness / fixtures resident.

## Entity state transitions

| t | from | to | active |
|---|---|---|---|
| 1:48.3 | DORMANT | ROUSED | true |
| 1:51.8 | ROUSED | SEEKING | true |
| 2:07.9 | SEEKING | APPROACHING | true |
| 2:09.9 | APPROACHING | CAPTURING | true |
| 2:15.4 | CAPTURING | DORMANT | true |

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
    "ms": 314.1208333333954,
    "fps": 3.1834883073121087,
    "p90": 10.399999998509884,
    "calls": 159,
    "tris": 94714,
    "quality": "low",
    "res": "397x223"
  },
  "lights": {
    "fixtures": 90,
    "lit": 24,
    "active": 5,
    "shadows": 1
  },
  "entity": {
    "entity": "surveyor",
    "state": "DORMANT",
    "stateTime": 312.05,
    "position": [
      43.43,
      0,
      21.59
    ],
    "heading": 4.546,
    "target": [
      10.47,
      0,
      17.5
    ],
    "confidence": 0,
    "illumination": 0,
    "lightScale": 0,
    "speed": 0,
    "frozen": true,
    "stoop": 0,
    "measureHold": 0,
    "distToPlayer": 855.73,
    "usingGlb": true
  },
  "gameplay": {
    "surveyor": {
      "entity": "surveyor",
      "state": "DORMANT",
      "stateTime": 312.05,
      "position": [
        43.43,
        0,
        21.59
      ],
      "heading": 4.546,
      "target": [
        10.47,
        0,
        17.5
      ],
      "confidence": 0,
      "illumination": 0,
      "lightScale": 0,
      "speed": 0,
      "frozen": true,
      "stoop": 0,
      "measureHold": 0,
      "distToPlayer": 855.73,
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
      "fear": 0.206,
      "tension": 0,
      "intensity": 0.15,
      "sinceBeat": 34.1,
      "nextBeatAt": 240,
      "grace": 0,
      "zone": "safe",
      "objective": null,
      "deaths": 1,
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
      "exposure": 0.94
    },
    "inventory": {
      "items": {
        "lamp": 1
      },
      "selected": "lamp"
    }
  },
  "audio": {
    "voices": 19,
    "oneShots": 15,
    "loops": 4,
    "nodes": 438,
    "occlChecks": 23439,
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
