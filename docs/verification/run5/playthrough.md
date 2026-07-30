# THE ANNEX — continuous playthrough

Generated 2026-07-30T08:48:03.456Z by `tools/qa/playthrough.mjs`.

**26850 frames · 447.5 s of simulated play at a fixed 1/60 step · 564 s of wall clock · quality `low` · 640×360**

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
| **FAIL** | the frame loop never stalls (no frame > 5 s) | max 9415 ms, p99 7 ms, p50 0.20 ms |
| **PASS** | post-warmup frame times stay bounded (p99 < 250 ms) | warm p50 0.20 ms, p90 0.50 ms, p99 7.00 ms |
| **PASS** | simulated time advanced continuously | 26850 frames |
| **PASS** | at least one entity state transition occurred | DORMANT->ROUSED@40.97s, ROUSED->SEEKING@44.47s, SEEKING->MEASURING@58.38s, MEASURING->SEEKING@63.02s, SEEKING->MEASURING@66.32s, MEASURING->SEEKING@74.78s, SEEKING->MEASURING@78.08s, MEASURING->RETREATING@85.95s, RETREATING->DORMANT@103.95s, DORMANT->ROUSED@109.4s, ROUSED->SEEKING@112.9s, SEEKING->MEASURING@123.2s, MEASURING->SEEKING@127.48s, SEEKING->MEASURING@130.78s, MEASURING->SEEKING@139.1s, SEEKING->APPROACHING@156.05s, APPROACHING->CAPTURING@162.38s, CAPTURING->DORMANT@167.95s |
| **PASS** | audio subsystem reports as constructed | subsystems.audio=true, ctx state=running |
| **PASS** | footsteps fired while walking | 505 player:step events |
| **FAIL** | every zone visited reported lit fixtures | min active lights = 0 |

**2 check(s) failed.**

## Pacing

- **Session length:** 447.5 s (7.5 min) of play.
- **Zero-threat time:** 64.2% of samples had no active entity and fear below 0.15.
- **The Surveyor was active at some point.**
- **Threat episodes:** 2 — 62.5s (ROUSED→SEEKING→MEASURING→RETREATING, closest 8.16 m); 58s (ROUSED→SEEKING→MEASURING→APPROACHING→CAPTURING, closest 0.85 m)
- **Fear:** median 0.027, p90 0.278, peak 0.513. Above 0.3 for 2.5% of the session, above 0.5 for 1.1%.
- **Director beats fired:** 0 (none — the quiet floor is 95 s and `nextBeatAt` starts at 150 s)
- **Longest stretch with nothing on the bus except footsteps:** 447.5 s (0:00.0 → 7:27.5).
- **Moving:** 65% of samples.
- **Zones:** intake (0:00.5–5:13.0) → service (5:14.5–6:23.0) → safe (6:23.5–6:25.5) → service (6:26.0–7:01.0) → safe (7:02.5–7:04.5) → service (7:05.0–7:27.5)

### Frame time (CPU rasteriser — not a frame-rate verdict)

| | p50 | p90 | p99 | max |
|---|---:|---:|---:|---:|
| whole session | 0.20 | 0.50 | 7.00 | 9415 |
| after 3 s warmup | 0.20 | 0.50 | 7.00 | 9415 |

All in milliseconds. The multi-second outliers are first-frame shader compiles
after a camera or zone change, which is a property of SwiftShader, not of the renderer.

## Event census

| event | count |
|---|---:|
| `player:noise` | 510 |
| `player:step` | 505 |
| `entity:tick` | 94 |
| `entity:heard` | 54 |
| `qa:phase` | 21 |
| `entity:state` | 18 |
| `zone:leave` | 7 |
| `world:teleport` | 7 |
| `zone:enter` | 7 |
| `lamp:toggle` | 5 |
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
 0:00.5  intake    pos( -24.0,   0.0,  24.8) stil      fear 0.00 lamp on 0.99 lit  6/142/201 entity not spawned        5806.1ms
 0:05.5  intake    pos( -24.0,   0.0,  24.8) stil      fear 0.00 lamp on 0.98 lit  6/142/201 entity not spawned        2760.5ms

 0:08.0  ── first walk, no lamp ──
 0:10.5  intake    pos( -21.0,   0.0,  23.1) walk      fear 0.03 lamp on 0.97 lit  6/142/201 entity not spawned        2385.8ms
 0:15.5  intake    pos( -10.3,   0.0,  23.2) walk      fear 0.03 lamp on 0.96 lit  6/142/201 entity not spawned        1745.0ms
 0:19.9      * director:entity-placed   
 0:19.9      * entity:tick              entity=surveyor at=(24.3, 0, 22.6)
 0:20.5  intake    pos(  -0.8,   0.0,  21.6) walk      fear 0.03 lamp on 0.95 lit  6/142/201 entity DORMANT @25.1m     1376.8ms
 0:21.6      * entity:tick              entity=surveyor at=(24.3, 0, 22.6)
 0:23.1      * entity:tick              entity=surveyor at=(24.3, 0, 22.6)
 0:23.9      * entity:tick              entity=surveyor at=(24.3, 0, 22.6)
 0:25.0      * entity:tick              entity=surveyor at=(24.3, 0, 22.6)
 0:25.5  intake    pos(   1.7,   0.0,  19.1) walk      fear 0.03 lamp on 0.93 lit  6/142/201 entity DORMANT @23.0m     1205.0ms
 0:26.1      * entity:tick              entity=surveyor at=(24.3, 0, 22.6)
 0:28.2      * entity:tick              entity=surveyor at=(24.3, 0, 22.6)
 0:29.8      * entity:tick              entity=surveyor at=(24.3, 0, 22.6)
 0:30.5      * entity:tick              entity=surveyor at=(24.3, 0, 22.6)
 0:30.5  intake    pos(   5.6,   0.0,  21.1) walk      fear 0.03 lamp on 0.92 lit  6/142/201 entity DORMANT @18.8m     1022.3ms
 0:31.8      * entity:tick              entity=surveyor at=(24.3, 0, 22.6)
 0:33.4      * entity:tick              entity=surveyor at=(24.3, 0, 22.6)
 0:34.2      * entity:tick              entity=surveyor at=(24.3, 0, 22.6)
 0:35.0      * entity:tick              entity=surveyor at=(24.3, 0, 22.6)
 0:35.5  intake    pos(   3.1,   0.0,  18.9) walk      fear 0.03 lamp on 0.91 lit  6/142/201 entity DORMANT @21.6m      888.0ms
 0:36.4      * entity:tick              entity=surveyor at=(24.3, 0, 22.6)

 0:38.0  ── lamp on ──
 0:38.0      * lamp:toggle              
 0:38.0      * entity:tick              entity=surveyor at=(24.3, 0, 22.6)
 0:39.9      * entity:tick              entity=surveyor at=(24.3, 0, 22.6)
 0:40.5  intake    pos(  11.7,   0.0,  16.9) walk      fear 0.04 lamp off      lit  6/142/201 entity DORMANT @13.9m      952.0ms
 0:40.7      * entity:tick              entity=surveyor at=(24.3, 0, 22.6)
 0:41.0      * entity:state             from=DORMANT state=ROUSED entity=surveyor at=(24.3, 0, 22.6)
 0:41.0      * entity:heard             entity=surveyor strength=0.075 radius=6 at=(10.1, 0, 17.1)
 0:41.4      * entity:heard             entity=surveyor strength=0.112 radius=6 at=(10.1, 0, 17.1)
 0:41.5      * entity:tick              entity=surveyor at=(24.3, 0, 22.6)
 0:42.3      * entity:heard             entity=surveyor strength=0.066 radius=6 at=(10.1, 0, 17.1)
 0:42.7      * entity:heard             entity=surveyor strength=0.079 radius=6 at=(10.1, 0, 17.1)
 0:42.9      * entity:tick              entity=surveyor at=(24.3, 0, 22.6)
 0:43.2      * entity:heard             entity=surveyor strength=0.099 radius=6 at=(10.1, 0, 17.1)
 0:43.6      * entity:heard             entity=surveyor strength=0.105 radius=6 at=(10.1, 0, 17.1)
 0:43.7      * entity:tick              entity=surveyor at=(24.3, 0, 22.6)
 0:44.1      * entity:heard             entity=surveyor strength=0.089 radius=6 at=(10.1, 0, 17.1)
 0:44.5      * entity:state             from=ROUSED state=SEEKING entity=surveyor at=(24.3, 0, 22.6)
 0:44.5      * entity:heard             entity=surveyor strength=0.068 radius=6 at=(10.1, 0, 17.1)
 0:44.7      * entity:tick              entity=surveyor at=(24.3, 0, 22.6)
 0:45.3      * entity:tick              entity=surveyor at=(23.9, 0, 22.5)
 0:45.5  intake    pos(  15.6,   0.0,  12.5) walk      fear 0.14 lamp off      lit  6/141/201 entity SEEKING @12.9m     1018.5ms
 0:46.8      * entity:tick              entity=surveyor at=(22.8, 0, 22)
 0:47.2      * entity:heard             entity=surveyor strength=0.062 radius=6 at=(10.1, 0, 17.1)
 0:48.7      * entity:tick              entity=surveyor at=(21.4, 0, 21.4)
 0:49.5      * entity:heard             entity=surveyor strength=0.079 radius=6 at=(10.1, 0, 17.1)
 0:49.9      * entity:heard             entity=surveyor strength=0.099 radius=6 at=(10.1, 0, 17.1)
 0:50.1      * entity:tick              entity=surveyor at=(20.5, 0, 20.8)
 0:50.4      * entity:heard             entity=surveyor strength=0.097 radius=6 at=(10.1, 0, 17.1)
 0:50.5  intake    pos(  19.9,   0.0,  10.1) walk      fear 0.14 lamp off      lit  6/142/201 entity SEEKING @10.4m      921.8ms
 0:50.8      * entity:heard             entity=surveyor strength=0.082 radius=6 at=(10.1, 0, 17.1)
 0:51.3      * entity:heard             entity=surveyor strength=0.074 radius=6 at=(10.1, 0, 17.1)
 0:51.7      * entity:heard             entity=surveyor strength=0.085 radius=6 at=(10.1, 0, 17.1)
 0:52.0      * entity:tick              entity=surveyor at=(19.4, 0, 19.7)
 0:52.2      * entity:heard             entity=surveyor strength=0.109 radius=6 at=(10.1, 0, 17.1)
 0:52.6      * entity:heard             entity=surveyor strength=0.133 radius=6 at=(10.1, 0, 17.1)
 0:53.1      * entity:heard             entity=surveyor strength=0.148 radius=6 at=(10.1, 0, 17.1)
 0:53.5      * entity:tick              entity=surveyor at=(18.4, 0, 19.1)
 0:53.5      * entity:heard             entity=surveyor strength=0.138 radius=6 at=(10.1, 0, 17.1)
 0:54.0      * entity:heard             entity=surveyor strength=0.115 radius=6 at=(10.1, 0, 17.1)
 0:54.4      * entity:tick              entity=surveyor at=(17.7, 0, 18.9)
 0:54.4      * entity:heard             entity=surveyor strength=0.093 radius=6 at=(10.1, 0, 17.1)
 0:54.9      * entity:heard             entity=surveyor strength=0.07 radius=6 at=(10.1, 0, 17.1)
 0:55.5  intake    pos(  23.7,   0.0,   7.8) walk      fear 0.16 lamp off      lit  6/142/201 entity SEEKING @12.7m      852.5ms
 0:56.0      * entity:tick              entity=surveyor at=(16.5, 0, 18.4)
 0:57.0      * entity:tick              entity=surveyor at=(15.7, 0, 18)
 0:58.1      * entity:tick              entity=surveyor at=(14.8, 0, 17.7)
 0:58.4      * entity:state             from=SEEKING state=MEASURING entity=surveyor at=(14.7, 0, 17.6)
 0:59.1      * entity:tick              entity=surveyor at=(14.7, 0, 17.6)
 1:00.5  intake    pos(  24.1,   0.0,  -1.6) walk      fear 0.05 lamp off      lit  6/207/269 entity MEASURING @21.4m    783.9ms
 1:02.0      * entity:tick              entity=surveyor at=(14.7, 0, 17.6)

 1:03.0  ── stop and listen (lamp on) ──
 1:03.0      * entity:state             from=MEASURING state=SEEKING entity=surveyor at=(14.7, 0, 17.6)
 1:05.0      * entity:tick              entity=surveyor at=(13.4, 0, 17.9)
 1:05.5  intake    pos(  19.2,   0.0,  -2.3) stil      fear 0.02 lamp off      lit  6/208/269 entity SEEKING @21.2m      725.5ms
 1:06.3      * entity:state             from=SEEKING state=MEASURING entity=surveyor at=(12.4, 0, 18.3)
 1:06.3      * entity:tick              entity=surveyor at=(12.4, 0, 18.3)
 1:08.3      * entity:tick              entity=surveyor at=(12.4, 0, 18.3)
 1:10.5  intake    pos(  19.2,   0.0,  -2.3) stil      fear 0.00 lamp off      lit  6/207/269 entity MEASURING @21.6m    681.9ms
 1:11.2      * entity:tick              entity=surveyor at=(12.4, 0, 18.3)
 1:14.2      * entity:tick              entity=surveyor at=(12.4, 0, 18.3)
 1:14.8      * entity:state             from=MEASURING state=SEEKING entity=surveyor at=(12.4, 0, 18.3)
 1:15.5  intake    pos(  19.2,   0.0,  -2.3) stil      fear 0.00 lamp off      lit  6/208/269 entity SEEKING @21.9m      637.1ms
 1:16.3      * entity:tick              entity=surveyor at=(11.9, 0, 19.1)
 1:17.3      * entity:tick              entity=surveyor at=(11.6, 0, 19.8)
 1:18.1      * entity:state             from=SEEKING state=MEASURING entity=surveyor at=(11.4, 0, 20.4)
 1:19.1      * entity:tick              entity=surveyor at=(11.4, 0, 20.4)
 1:20.5  intake    pos(  19.2,   0.0,  -2.3) stil      fear 0.00 lamp off      lit  6/208/269 entity MEASURING @24.0m    598.2ms
 1:22.4      * entity:tick              entity=surveyor at=(11.4, 0, 20.4)

 1:23.0  ── crouch-walk — nearly silent ──
 1:25.5  intake    pos(  19.2,   0.0,  -0.4) stil crch fear 0.01 lamp off      lit  6/208/269 entity MEASURING @22.2m    568.2ms
 1:25.9      * entity:state             from=MEASURING state=RETREATING entity=surveyor at=(11.4, 0, 20.4)
 1:26.1      * entity:tick              entity=surveyor at=(11.3, 0, 20.4)
 1:27.1      * entity:tick              entity=surveyor at=(11.1, 0, 20.5)
 1:29.0      * entity:tick              entity=surveyor at=(10.6, 0, 20)
 1:30.5      * entity:tick              entity=surveyor at=(10.4, 0, 19.1)
 1:30.5  intake    pos(  22.8,   0.0,  -2.4) walk crch fear 0.01 lamp off      lit  6/208/269 entity RETREATING @24.9m   301.8ms
 1:32.0      * entity:tick              entity=surveyor at=(10.4, 0, 18.1)
 1:33.8      * entity:tick              entity=surveyor at=(10.4, 0, 16.9)
 1:35.0      * entity:tick              entity=surveyor at=(10.4, 0, 16.2)
 1:35.5  intake    pos(  22.9,   0.0,  -7.0) walk crch fear 0.01 lamp off      lit  6/208/269 entity RETREATING @26.0m   293.4ms
 1:35.7      * entity:tick              entity=surveyor at=(10.4, 0, 15.7)
 1:37.2      * entity:tick              entity=surveyor at=(9.9, 0, 15.2)
 1:39.0      * entity:tick              entity=surveyor at=(8.8, 0, 15.3)
 1:40.5      * entity:tick              entity=surveyor at=(7.9, 0, 15.3)
 1:40.5  intake    pos(  17.5,   0.0,  -7.0) walk crch fear 0.01 lamp off      lit  6/208/269 entity RETREATING @24.3m   215.0ms
 1:42.4      * entity:tick              entity=surveyor at=(6.6, 0, 15.3)
 1:43.9      * entity:state             from=RETREATING state=DORMANT entity=surveyor at=(5.7, 0, 15)
 1:44.3      * entity:tick              entity=surveyor at=(5.7, 0, 15)
 1:45.5  intake    pos(  12.2,   0.0,  -7.6) walk crch fear 0.01 lamp off      lit  6/208/269 entity DORMANT @23.5m      215.0ms
 1:46.2      * entity:tick              entity=surveyor at=(5.7, 0, 15)
 1:47.1      * entity:tick              entity=surveyor at=(5.7, 0, 15)
 1:47.7      * entity:tick              entity=surveyor at=(5.7, 0, 15)

 1:48.0  ── sprint — deliberately loud ──
 1:49.2      * entity:tick              entity=surveyor at=(5.7, 0, 15)
 1:49.4      * entity:state             from=DORMANT state=ROUSED entity=surveyor at=(5.7, 0, 15)
 1:49.4      * entity:heard             entity=surveyor strength=0.105 radius=11 at=(4.3, 0, -4.9)
 1:49.7      * entity:heard             entity=surveyor strength=0.108 radius=11 at=(4.3, 0, -4.9)
 1:50.0      * entity:heard             entity=surveyor strength=0.131 radius=11 at=(4.3, 0, -4.9)
 1:50.3      * entity:heard             entity=surveyor strength=0.166 radius=11 at=(4.3, 0, -4.9)
 1:50.5      * entity:tick              entity=surveyor at=(5.7, 0, 15)
 1:50.5  intake    pos(   3.4,   0.0,  -3.6) walk      fear 0.09 lamp off      lit  6/208/269 entity ROUSED @18.7m       214.8ms
 1:50.6      * entity:heard             entity=surveyor strength=0.224 radius=11 at=(4.3, 0, -4.9)
 1:50.9      * entity:heard             entity=surveyor strength=0.229 radius=11 at=(4.3, 0, -4.9)
 1:51.2      * entity:heard             entity=surveyor strength=0.219 radius=11 at=(4.3, 0, -4.9)
 1:51.5      * entity:heard             entity=surveyor strength=0.179 radius=11 at=(4.3, 0, -4.9)
 1:51.7      * entity:tick              entity=surveyor at=(5.7, 0, 15)
 1:51.8      * entity:heard             entity=surveyor strength=0.066 radius=11 at=(4.3, 0, -4.9)
 1:52.9      * entity:state             from=ROUSED state=SEEKING entity=surveyor at=(5.7, 0, 15)
 1:53.7      * entity:tick              entity=surveyor at=(5.5, 0, 14.6)
 1:54.4      * entity:tick              entity=surveyor at=(5.5, 0, 14.1)
 1:55.5  intake    pos( -11.6,   0.0,  -3.1) walk      fear 0.07 lamp off      lit  6/208/269 entity SEEKING @23.6m      202.1ms
 1:55.9      * entity:tick              entity=surveyor at=(5.5, 0, 12.9)
 1:56.7      * entity:tick              entity=surveyor at=(5.5, 0, 12.2)
 1:58.3      * entity:tick              entity=surveyor at=(5.5, 0, 10.9)
 1:59.9      * entity:tick              entity=surveyor at=(5.5, 0, 9.6)
 2:00.5  intake    pos( -17.6,   0.0,  -3.8) stil      fear 0.05 lamp off      lit  6/208/269 entity SEEKING @26.5m      202.3ms
 2:01.7      * entity:tick              entity=surveyor at=(5.5, 0, 8.1)
 2:03.2      * entity:state             from=SEEKING state=MEASURING entity=surveyor at=(5.5, 0, 6.9)
 2:03.6      * entity:tick              entity=surveyor at=(5.5, 0, 6.9)
 2:05.5  intake    pos( -16.5,   0.0,  -3.8) stil      fear 0.04 lamp off      lit  6/208/269 entity MEASURING @24.5m    202.3ms
 2:07.5      * entity:state             from=MEASURING state=SEEKING entity=surveyor at=(5.5, 0, 6.9)
 2:07.7      * entity:tick              entity=surveyor at=(5.5, 0, 6.8)

 2:08.0  ── walk on, lamp off (the entity only moves in light) ──
 2:08.0      * lamp:toggle              
 2:09.5      * entity:tick              entity=surveyor at=(4.8, 0, 5.9)
 2:10.4      * entity:tick              entity=surveyor at=(4.3, 0, 5.3)
 2:10.5  intake    pos( -13.8,   0.0,  -3.8) walk      fear 0.03 lamp on 0.90 lit  6/208/269 entity SEEKING @20.2m      126.6ms
 2:10.8      * entity:state             from=SEEKING state=MEASURING entity=surveyor at=(4.1, 0, 5.1)
 2:11.3      * entity:tick              entity=surveyor at=(4.1, 0, 5.1)
 2:14.9      * entity:tick              entity=surveyor at=(4.1, 0, 5.1)
 2:15.5  intake    pos(  -6.7,   0.0,  -3.8) walk      fear 0.06 lamp on 0.89 lit  6/208/269 entity MEASURING @14.0m     35.6ms
 2:16.0      * entity:heard             entity=surveyor strength=0.081 radius=6 at=(-6, 0, -3.3)
 2:16.7      * entity:heard             entity=surveyor strength=0.126 radius=6 at=(-5.9, 0, -2.8)
 2:18.1      * entity:tick              entity=surveyor at=(4.1, 0, 5.1)
 2:19.1      * entity:state             from=MEASURING state=SEEKING entity=surveyor at=(4.1, 0, 5.1)
 2:19.3      * entity:heard             entity=surveyor strength=0.128 radius=6 at=(0.3, 0, 3.3)
 2:20.5  intake    pos(  -5.0,   0.0,  -3.8) walk      fear 0.09 lamp on 0.88 lit  6/208/269 entity SEEKING @11.8m       35.3ms
 2:21.6      * entity:tick              entity=surveyor at=(2.7, 0, 4)
 2:22.1      * entity:heard             entity=surveyor strength=0.277 radius=6 at=(-6.2, 0, -4.3)
 2:22.6      * entity:tick              entity=surveyor at=(2, 0, 3.7)
 2:23.6      * entity:tick              entity=surveyor at=(1.4, 0, 3.1)
 2:23.9      * entity:heard             entity=surveyor strength=0.381 radius=6 at=(-4.3, 0, -2.4)
 2:24.9      * entity:heard             entity=surveyor strength=0.338 radius=6 at=(-5.3, 0, -3.5)
 2:25.0      * entity:tick              entity=surveyor at=(0.5, 0, 2.6)
 2:25.5  intake    pos(  -6.0,   0.0,  -3.8) walk      fear 0.16 lamp on 0.86 lit  6/208/269 entity SEEKING @8.8m        35.4ms
 2:25.9      * entity:heard             entity=surveyor strength=0.135 radius=6 at=(-5.3, 0, -3.5)
 2:26.4      * entity:tick              entity=surveyor at=(-0.4, 0, 2)
 2:26.7      * entity:heard             entity=surveyor strength=0.133 radius=6 at=(-5.3, 0, -3.5)
 2:27.4      * entity:heard             entity=surveyor strength=0.129 radius=6 at=(-5.3, 0, -3.5)
 2:27.9      * entity:tick              entity=surveyor at=(-0.9, 0, 0.9)
 2:28.1      * entity:heard             entity=surveyor strength=0.122 radius=6 at=(-8.9, 0, -6)
 2:28.7      * entity:heard             entity=surveyor strength=0.157 radius=6 at=(-9.3, 0, -4.7)
 2:29.4      * entity:heard             entity=surveyor strength=0.271 radius=6 at=(-10.5, 0, -3.3)
 2:29.7      * entity:tick              entity=surveyor at=(-1.7, 0, -0.2)
 2:30.1      * entity:heard             entity=surveyor strength=0.289 radius=6 at=(-11.5, 0, -4.2)
 2:30.5  intake    pos( -12.1,   0.0,  -3.8) walk      fear 0.15 lamp on 0.85 lit  6/208/269 entity SEEKING @10.3m       35.3ms
 2:30.6      * entity:tick              entity=surveyor at=(-2.3, 0, -0.5)
 2:30.8      * entity:heard             entity=surveyor strength=0.276 radius=6 at=(-12.3, 0, -3.7)
 2:31.7      * entity:heard             entity=surveyor strength=0.267 radius=6 at=(-13.3, 0, -4.5)
 2:32.4      * entity:heard             entity=surveyor strength=0.248 radius=6 at=(-13.7, 0, -5.2)
 2:32.5      * entity:tick              entity=surveyor at=(-3.8, 0, -1.1)
 2:33.3      * entity:heard             entity=surveyor strength=0.244 radius=6 at=(-15, 0, -2.5)
 2:34.6      * entity:tick              entity=surveyor at=(-5.3, 0, -1.7)
 2:34.8      * entity:heard             entity=surveyor strength=0.376 radius=6 at=(-14.6, 0, -3.9)
 2:35.4      * entity:heard             entity=surveyor strength=0.464 radius=6 at=(-13.4, 0, -3.9)
 2:35.5  intake    pos( -13.3,   0.0,  -3.8) walk      fear 0.17 lamp on 0.84 lit  6/208/269 entity SEEKING @7.5m        35.3ms
 2:36.0      * entity:tick              entity=surveyor at=(-6.5, 0, -1.7)
 2:36.0      * entity:heard             entity=surveyor strength=0.558 radius=6 at=(-13.8, 0, -3.5)
 2:36.0      * entity:state             from=SEEKING state=APPROACHING entity=surveyor at=(-6.5, 0, -1.7)
 2:36.6      * entity:heard             entity=surveyor strength=0.652 radius=6 at=(-11.8, 0, -3.5)
 2:37.2      * entity:heard             entity=surveyor strength=0.741 radius=6 at=(-10.4, 0, -4.4)
 2:37.9      * entity:heard             entity=surveyor strength=0.825 radius=6 at=(-9.9, 0, -3.8)
 2:37.9      * entity:tick              entity=surveyor at=(-8.1, 0, -2.1)

 2:38.0  ── stand in the dark and wait ──
 2:39.2      * entity:tick              entity=surveyor at=(-9.2, 0, -2.5)
 2:40.5  intake    pos(  -9.6,   0.0,  -3.8) stil      fear 0.49 lamp on 0.83 lit  6/208/269 entity APPROACHING @1.4m    49.9ms
 2:41.0      * entity:tick              entity=surveyor at=(-10.6, 0, -2.8)
 2:42.2      * entity:tick              entity=surveyor at=(-10.7, 0, -3.4)
 2:42.4      * entity:state             from=APPROACHING state=CAPTURING entity=surveyor at=(-10.7, 0, -3.5)
 2:43.2      * entity:tick              entity=surveyor at=(-10.4, 0, -3.6)
 2:43.7      * game:death               cause=surveyor at=(-10.4, 0, -3.6)
 2:43.7      * cine:begin               name=death cause=surveyor
 2:44.8      * entity:tick              entity=surveyor at=(-10.4, 0, -3.6)
 2:45.5  intake    pos(  -9.6,   0.0,  -3.8) stil      fear 0.51 lamp on 0.81 lit  6/208/269 entity CAPTURING @0.8m      50.0ms
 2:46.7      * entity:tick              entity=surveyor at=(-10.4, 0, -3.6)
 2:47.9      * entity:state             from=CAPTURING state=DORMANT entity=surveyor at=(-10.4, 0, -3.6)
 2:47.9      * cine:end                 name=death
 2:47.9      * game:respawn             
 2:47.9      * entity:tick              entity=surveyor at=(14.6, 0, 13.9)
 2:50.5  intake    pos(  -9.6,   0.0,  -3.8) stil      fear 0.08 lamp on 0.80 lit  0/ 67/269 entity DORMANT @30.0m      103.2ms
 2:55.5  intake    pos(  -9.6,   0.0,  -3.8) stil      fear 0.03 lamp on 0.79 lit  0/ 67/269 entity DORMANT @30.0m      103.2ms
 3:00.5  intake    pos(  -9.6,   0.0,  -3.8) stil      fear 0.02 lamp on 0.78 lit  0/ 67/269 entity DORMANT @30.0m       74.8ms
 3:05.5  intake    pos(  -9.6,   0.0,  -3.8) stil      fear 0.02 lamp on 0.77 lit  0/ 67/269 entity DORMANT @30.0m       74.6ms

 3:08.0  ── SCRIPTED: spawn the Surveyor 26 m away, dormant ──

 3:08.0  ── sprint past it — loud enough to be heard ──
 3:10.5  intake    pos(  -3.0,   0.0,  -3.8) walk      fear 0.10 lamp on 0.76 lit  0/ 67/269 entity DORMANT @24.9m       74.5ms
 3:15.5  intake    pos( -12.3,   0.0,  -3.8) walk      fear 0.09 lamp on 0.74 lit  0/ 67/269 entity DORMANT @32.2m       80.2ms
 3:20.5  intake    pos( -18.8,   0.0,  -3.8) stil      fear 0.06 lamp on 0.73 lit  0/ 67/269 entity DORMANT @37.8m       80.1ms
 3:25.5  intake    pos( -12.7,   0.0,  -3.8) walk      fear 0.07 lamp on 0.72 lit  0/ 67/269 entity DORMANT @32.5m       80.1ms
 3:30.5  intake    pos(  -0.6,   0.0,  -2.8) walk      fear 0.07 lamp on 0.71 lit  0/ 67/269 entity DORMANT @22.6m       80.0ms

 3:33.0  ── lamp on and keep moving (it only advances in light) ──
 3:33.0      * lamp:toggle              
 3:35.5  intake    pos(   3.2,   0.0,  -5.9) walk      fear 0.29 lamp off      lit  0/ 67/269 entity DORMANT @22.9m      126.4ms
 3:40.5  intake    pos(  -4.0,   0.0,  -1.9) walk      fear 0.29 lamp off      lit  0/ 67/269 entity DORMANT @24.4m      132.8ms
 3:45.5  intake    pos( -14.5,   0.0,  -1.9) walk      fear 0.29 lamp off      lit  0/ 67/269 entity DORMANT @33.1m      132.0ms
 3:50.5  intake    pos( -16.9,   0.0,  -3.8) walk      fear 0.28 lamp off      lit  0/ 67/269 entity DORMANT @36.1m      131.8ms
 3:55.5  intake    pos( -15.3,   0.0,  -3.8) walk      fear 0.28 lamp off      lit  0/ 67/269 entity DORMANT @34.8m      131.5ms
 4:00.5  intake    pos(  -9.8,   0.0,  -3.8) walk      fear 0.28 lamp off      lit  0/ 67/269 entity DORMANT @30.1m      139.4ms
 4:05.5  intake    pos(  -6.4,   0.0,  -3.8) walk      fear 0.28 lamp off      lit  0/ 67/269 entity DORMANT @27.5m      139.1ms

 4:08.0  ── stop, lamp off, stay still — does it lose you? ──
 4:08.0      * lamp:toggle              
 4:10.5  intake    pos( -10.3,   0.0,  -3.8) stil      fear 0.12 lamp on 0.70 lit  0/ 67/269 entity DORMANT @30.5m      124.5ms
 4:15.5  intake    pos( -10.3,   0.0,  -3.8) stil      fear 0.03 lamp on 0.68 lit  0/ 67/269 entity DORMANT @30.5m      124.3ms
 4:20.5  intake    pos( -10.3,   0.0,  -3.8) stil      fear 0.02 lamp on 0.67 lit  0/ 67/269 entity DORMANT @30.5m       70.9ms
 4:25.5  intake    pos( -10.3,   0.0,  -3.8) stil      fear 0.02 lamp on 0.66 lit  0/ 67/269 entity DORMANT @30.5m       71.0ms
 4:30.5  intake    pos( -10.3,   0.0,  -3.8) stil      fear 0.02 lamp on 0.65 lit  0/ 67/269 entity DORMANT @30.5m       71.0ms
 4:35.5  intake    pos( -10.3,   0.0,  -3.8) stil      fear 0.02 lamp on 0.64 lit  0/ 67/269 entity DORMANT @30.5m       70.9ms
 4:40.5  intake    pos( -10.3,   0.0,  -3.8) stil      fear 0.02 lamp on 0.63 lit  0/ 67/269 entity DORMANT @30.5m       70.9ms
 4:45.5  intake    pos( -10.3,   0.0,  -3.8) stil      fear 0.03 lamp on 0.61 lit  0/ 67/269 entity DORMANT @30.5m       65.0ms

 4:48.0  ── walk to the service door ──
 4:50.5  intake    pos( -14.5,   0.0,  -3.8) walk      fear 0.04 lamp on 0.60 lit  0/ 67/269 entity DORMANT @34.0m       65.0ms
 4:55.5  intake    pos( -17.4,   0.0,  -3.8) walk      fear 0.03 lamp on 0.59 lit  0/ 67/269 entity DORMANT @36.6m       65.0ms
 5:00.5  intake    pos( -13.4,   0.0,  -3.8) walk      fear 0.04 lamp on 0.58 lit  0/ 67/269 entity DORMANT @33.1m       65.0ms
 5:05.5  intake    pos( -14.3,   0.0,  -3.8) stil      fear 0.03 lamp on 0.56 lit  0/ 67/269 entity DORMANT @33.9m       18.5ms
 5:10.5  intake    pos(  -9.8,   0.0,  -3.8) walk      fear 0.04 lamp on 0.55 lit  0/ 67/269 entity DORMANT @30.1m       21.4ms
 5:13.0      * zone:leave               zone=intake
 5:13.0      * world:teleport           zone=service at=(370.4, 0, 0)
 5:13.0      * zone:enter               zone=service from=intake
 5:13.0      * qa:scripted-zone-change  zone=service

 5:13.0  ── zone settle ──

 5:14.5  ── service spine — first walk ──
 5:15.5  service   pos( 372.4,   0.0,   0.0) walk      fear 0.02 lamp on 0.54 lit  6/ 83/286 entity DORMANT @358.1m      44.5ms
 5:20.5  service   pos( 382.9,   0.0,   0.1) walk      fear 0.03 lamp on 0.53 lit  6/ 83/286 entity DORMANT @368.6m      44.9ms
 5:25.5  service   pos( 393.6,   0.0,  -0.3) walk      fear 0.03 lamp on 0.52 lit  6/ 83/286 entity DORMANT @379.3m      45.4ms
 5:30.5  service   pos( 401.6,   0.0,   1.0) walk      fear 0.02 lamp on 0.51 lit  6/ 83/286 entity DORMANT @387.2m      37.7ms
 5:35.5  service   pos( 402.6,   0.0,   1.0) stil      fear 0.01 lamp on 0.49 lit  6/ 83/286 entity DORMANT @388.2m      37.8ms
 5:40.5  service   pos( 402.6,   0.0,   1.0) stil      fear 0.00 lamp on 0.48 lit  6/ 83/286 entity DORMANT @388.2m      37.8ms
 5:45.5  service   pos( 402.6,   0.0,   1.0) stil      fear 0.00 lamp on 0.47 lit  6/ 83/286 entity DORMANT @388.2m      38.3ms

 5:49.5  ── service spine — sprint ──
 5:50.5  service   pos( 402.6,   0.0,   1.0) stil      fear 0.05 lamp on 0.46 lit  6/ 83/286 entity DORMANT @388.2m      38.2ms
 5:55.5  service   pos( 402.6,   0.0,   1.0) walk      fear 0.08 lamp on 0.45 lit  6/ 83/286 entity DORMANT @388.2m      38.4ms
 6:00.5  service   pos( 402.6,   0.0,   1.0) stil      fear 0.05 lamp on 0.43 lit  6/ 83/286 entity DORMANT @388.2m      38.7ms
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
 6:06.0  service   pos( 370.4,   0.0,   0.0) stil      fear 0.03 lamp on 0.42 lit  6/ 83/286 entity DORMANT @356.1m      98.7ms
 6:11.0  service   pos( 380.8,   0.0,   0.1) walk      fear 0.03 lamp off      lit  6/ 83/286 entity DORMANT @366.5m     104.7ms
 6:16.0  service   pos( 391.2,   0.0,  -0.3) walk      fear 0.03 lamp off      lit  6/ 82/286 entity DORMANT @376.9m     105.0ms
 6:21.0  service   pos( 399.0,   0.0,   1.0) stil      fear 0.02 lamp off      lit  6/ 82/286 entity DORMANT @384.7m     105.2ms
 6:23.4      * zone:unload              zone=intake
 6:23.4      * zone:leave               zone=service
 6:23.4      * world:teleport           zone=safe at=(400.6, 0, 799)
 6:23.4      * zone:enter               zone=safe from=service
 6:23.4      * progress:discovery       id=office title=The Office of Record
 6:25.7      * zone:leave               zone=safe
 6:25.7      * world:teleport           zone=service at=(370.4, 0, 0)
 6:25.7      * zone:enter               zone=service from=safe
 6:26.0  service   pos( 370.9,   0.0,   0.1) walk      fear 0.03 lamp off      lit  6/ 87/90 entity DORMANT @356.6m     199.2ms
 6:31.0  service   pos( 381.6,   0.0,   0.2) walk      fear 0.03 lamp off      lit  6/ 87/90 entity DORMANT @367.3m     199.2ms
 6:36.0  service   pos( 389.4,   0.0,  -1.0) walk      fear 0.02 lamp off      lit  6/ 87/90 entity DORMANT @375.1m     199.6ms

 6:41.0  ── cistern — stand still in the water ──
 6:41.0  service   pos( 397.9,   0.0,  -1.0) walk      fear 0.02 lamp off      lit  6/ 86/90 entity DORMANT @383.6m     190.6ms
 6:46.0  service   pos( 398.0,   0.0,  -1.0) stil      fear 0.00 lamp off      lit  6/ 87/90 entity DORMANT @383.7m     167.5ms
 6:51.0  service   pos( 398.0,   0.0,  -1.0) stil      fear 0.00 lamp off      lit  6/ 87/90 entity DORMANT @383.7m     167.1ms
 6:56.0  service   pos( 398.0,   0.0,  -1.0) stil      fear 0.00 lamp off      lit  6/ 87/90 entity DORMANT @383.7m     166.6ms
 7:01.0      * zone:leave               zone=service
 7:01.0      * world:teleport           zone=safe at=(400.6, 0, 799)
 7:01.0      * zone:enter               zone=safe from=service
 7:01.0      * qa:scripted-zone-change  zone=safe

 7:01.0  ── zone settle ──
 7:01.0  service   pos( 398.0,   0.0,  -1.0) stil      fear 0.00 lamp off      lit  6/ 87/90 entity DORMANT @383.7m     166.4ms

 7:02.5  ── the safe room ──
 7:04.8      * zone:leave               zone=safe
 7:04.8      * world:teleport           zone=service at=(370.4, 0, 0)
 7:04.8      * zone:enter               zone=service from=safe
 7:06.0  service   pos( 372.8,   0.0,   0.2) walk      fear 0.03 lamp off      lit  6/ 87/90 entity DORMANT @358.5m     175.6ms
 7:11.0  service   pos( 383.5,   0.0,  -0.0) walk      fear 0.03 lamp off      lit  6/ 87/90 entity DORMANT @369.2m     175.6ms
 7:16.0  service   pos( 393.9,   0.0,  -0.3) walk      fear 0.03 lamp off      lit  6/ 87/90 entity DORMANT @379.6m     175.6ms
 7:21.0  service   pos( 400.4,   0.0,   1.0) walk      fear 0.02 lamp off      lit  6/ 87/90 entity DORMANT @386.0m     175.7ms
 7:26.0  service   pos( 402.1,   0.0,   1.0) walk      fear 0.01 lamp off      lit  6/ 87/90 entity DORMANT @387.7m     175.5ms
```

`lit A/B/C` = lights uploaded to shaders / fixtures above 5% brightness / fixtures resident.

## Entity state transitions

| t | from | to | active |
|---|---|---|---|
| 0:41.0 | DORMANT | ROUSED | true |
| 0:44.5 | ROUSED | SEEKING | true |
| 0:58.4 | SEEKING | MEASURING | true |
| 1:03.0 | MEASURING | SEEKING | true |
| 1:06.3 | SEEKING | MEASURING | true |
| 1:14.8 | MEASURING | SEEKING | true |
| 1:18.1 | SEEKING | MEASURING | true |
| 1:26.0 | MEASURING | RETREATING | true |
| 1:44.0 | RETREATING | DORMANT | true |
| 1:49.4 | DORMANT | ROUSED | true |
| 1:52.9 | ROUSED | SEEKING | true |
| 2:03.2 | SEEKING | MEASURING | true |
| 2:07.5 | MEASURING | SEEKING | true |
| 2:10.8 | SEEKING | MEASURING | true |
| 2:19.1 | MEASURING | SEEKING | true |
| 2:36.1 | SEEKING | APPROACHING | true |
| 2:42.4 | APPROACHING | CAPTURING | true |
| 2:47.9 | CAPTURING | DORMANT | true |

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
    "ms": 175.44416666664182,
    "fps": 5.699819030746581,
    "p90": 15.800000004470348,
    "calls": 123,
    "tris": 137070,
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
    "stateTime": 279.55,
    "position": [
      14.55,
      0,
      13.93
    ],
    "heading": 4.079,
    "target": [
      -9.95,
      0,
      -3.76
    ],
    "confidence": 0,
    "illumination": 0,
    "lightScale": 0,
    "speed": 0,
    "frozen": true,
    "stoop": 0,
    "measureHold": 0,
    "distToPlayer": 387.03,
    "usingGlb": true
  },
  "gameplay": {
    "surveyor": {
      "entity": "surveyor",
      "state": "DORMANT",
      "stateTime": 279.55,
      "position": [
        14.55,
        0,
        13.93
      ],
      "heading": 4.079,
      "target": [
        -9.95,
        0,
        -3.76
      ],
      "confidence": 0,
      "illumination": 0,
      "lightScale": 0,
      "speed": 0,
      "frozen": true,
      "stoop": 0,
      "measureHold": 0,
      "distToPlayer": 387.03,
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
      "fear": 0.007,
      "tension": 0,
      "intensity": 0.15,
      "sinceBeat": 55.9,
      "nextBeatAt": 240,
      "grace": 0,
      "zone": "service",
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
    "voices": 17,
    "oneShots": 5,
    "loops": 12,
    "nodes": 390,
    "occlChecks": 24502,
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
