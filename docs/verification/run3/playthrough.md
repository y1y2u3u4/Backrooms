# THE ANNEX — continuous playthrough

Generated 2026-07-30T07:56:40.116Z by `tools/qa/playthrough.mjs`.

**26850 frames · 447.5 s of simulated play at a fixed 1/60 step · 875 s of wall clock · quality `low` · 640×360**

This is the first continuous session ever run on this build. Movement, sprint, crouch, the
lamp key and the interact key are real DOM keyboard events; mouse look is written into the
field a locked pointer would write, because headless Chromium cannot grant pointer lock.
Frame times come from a CPU rasteriser and are not a frame-rate verdict.

## Assertions

| | check | detail |
|---|---|---|
| **PASS** | no console errors during the session |  |
| **PASS** | player position never NaN | 0 frames |
| **FAIL** | player never falls through the floor | y 0.00..2.60; frames not standing on a floor: 2612 of 26850 (worst consecutive run 1524) |
| **FAIL** | the frame loop never stalls (no frame > 5 s) | max 15452 ms, p99 12 ms, p50 0.20 ms |
| **PASS** | post-warmup frame times stay bounded (p99 < 250 ms) | warm p50 0.20 ms, p90 0.40 ms, p99 11.50 ms |
| **PASS** | simulated time advanced continuously | 26850 frames |
| **FAIL** | at least one entity state transition occurred | the Surveyor never changed state |
| **PASS** | audio subsystem reports as constructed | subsystems.audio=true, ctx state=running |
| **PASS** | footsteps fired while walking | 469 player:step events |
| **FAIL** | every zone visited reported lit fixtures | min active lights = 0 |

**4 check(s) failed.**

## Pacing

- **Session length:** 447.5 s (7.5 min) of play.
- **Zero-threat time:** 96.5% of samples had no active entity and fear below 0.15.
- **The Surveyor was active at some point.**
- **Threat episodes:** 0 (none)
- **Fear:** median 0.023, p90 0.057, peak 0.295. Above 0.3 for 0.0% of the session, above 0.5 for 0.0%.
- **Director beats fired:** 1 — distant_door at 1:47.9
- **Longest stretch with nothing on the bus except footsteps:** 447.5 s (0:00.0 → 7:27.5).
- **Moving:** 62% of samples.
- **Zones:** intake (0:00.5–5:13.0) → service (5:14.5–6:04.5) → cistern (6:06.0–7:01.0) → safe (7:02.5–7:27.5)

### Frame time (CPU rasteriser — not a frame-rate verdict)

| | p50 | p90 | p99 | max |
|---|---:|---:|---:|---:|
| whole session | 0.20 | 0.50 | 11.70 | 15452 |
| after 3 s warmup | 0.20 | 0.40 | 11.50 | 15452 |

All in milliseconds. The multi-second outliers are first-frame shader compiles
after a camera or zone change, which is a property of SwiftShader, not of the renderer.

## Event census

| event | count |
|---|---:|
| `player:noise` | 474 |
| `player:step` | 469 |
| `entity:tick` | 303 |
| `qa:phase` | 21 |
| `lamp:toggle` | 5 |
| `zone:leave` | 3 |
| `world:teleport` | 3 |
| `zone:enter` | 3 |
| `qa:scripted-zone-change` | 3 |
| `director:entity-placed` | 1 |
| `director:beat` | 1 |
| `sfx:distant` | 1 |
| `world:noise` | 1 |
| `zone:unload` | 1 |
| `progress:discovery` | 1 |

## Timeline

State every 5 s; every non-footstep event at the moment it fired. Footsteps and noise
events are counted in the census above rather than listed, because there are hundreds.

```

 0:00.0  ── arrival — standing still, taking the room in ──
 0:00.5  intake    pos( -24.0,   0.0,  24.8) stil      fear 0.01 lamp on 0.99 lit  6/142/201 entity not spawned        4238.9ms
 0:05.5  intake    pos( -24.0,   0.0,  24.8) stil      fear 0.00 lamp on 0.98 lit  6/142/201 entity not spawned        2158.9ms

 0:08.0  ── first walk, no lamp ──
 0:10.5  intake    pos( -21.0,   0.0,  23.1) walk      fear 0.03 lamp on 0.97 lit  6/142/201 entity not spawned        2263.1ms
 0:15.5  intake    pos( -10.3,   0.0,  23.2) walk      fear 0.03 lamp on 0.96 lit  6/142/201 entity not spawned        1658.7ms
 0:19.9      * director:entity-placed   
 0:19.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:20.5  intake    pos(  -0.5,   0.0,  22.1) walk      fear 0.03 lamp on 0.95 lit  6/142/201 entity DORMANT @25.0m     1312.4ms
 0:21.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:23.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:23.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:25.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:25.5  intake    pos(   1.0,   0.0,  16.6) walk      fear 0.03 lamp on 0.93 lit  6/142/201 entity DORMANT @24.3m     1179.1ms
 0:26.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:28.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:29.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:30.5  intake    pos(   5.9,   0.0,  11.7) walk      fear 0.03 lamp on 0.92 lit  6/142/201 entity DORMANT @21.7m     1002.1ms
 0:30.5      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:31.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:33.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:34.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:35.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:35.5  intake    pos(   2.4,   0.0,   4.1) walk      fear 0.03 lamp on 0.91 lit  6/142/201 entity DORMANT @29.0m      871.9ms
 0:36.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)

 0:38.0  ── lamp on ──
 0:38.0      * lamp:toggle              
 0:38.0      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:39.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:40.5  intake    pos(   1.1,   0.0,  -2.1) walk      fear 0.03 lamp off      lit  6/142/201 entity DORMANT @34.2m     1046.4ms
 0:40.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:41.5      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:42.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:43.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:45.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:45.5  intake    pos(  -7.7,   0.0,  -2.6) walk      fear 0.03 lamp off      lit  6/141/201 entity DORMANT @41.0m     1195.1ms
 0:46.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:47.5      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:48.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:49.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:50.5  intake    pos( -18.0,   0.0,  -3.4) walk      fear 0.03 lamp off      lit  6/142/201 entity DORMANT @50.0m     1082.6ms
 0:51.5      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:52.0      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:52.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:53.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:54.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:54.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:55.5  intake    pos( -15.3,   0.0,  -3.8) walk      fear 0.01 lamp off      lit  6/142/201 entity DORMANT @48.0m     1001.4ms
 0:56.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 0:58.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:00.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:00.5  intake    pos( -13.1,   0.0,  -3.8) walk      fear 0.01 lamp off      lit  6/142/201 entity DORMANT @46.1m      941.5ms
 1:01.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)

 1:03.0  ── stop and listen (lamp on) ──
 1:03.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:04.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:05.5  intake    pos( -13.9,   0.0,  -3.8) stil      fear 0.00 lamp off      lit  6/142/201 entity DORMANT @46.8m      871.9ms
 1:05.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:07.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:07.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:10.0      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:10.5  intake    pos( -13.9,   0.0,  -3.8) stil      fear 0.00 lamp off      lit  6/141/201 entity DORMANT @46.8m      819.9ms
 1:11.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:12.5      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:13.5      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:14.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:15.0      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:15.5  intake    pos( -13.9,   0.0,  -3.8) stil      fear 0.00 lamp off      lit  6/142/201 entity DORMANT @46.8m      766.8ms
 1:16.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:17.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:18.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:19.5      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:20.5  intake    pos( -13.9,   0.0,  -3.8) stil      fear 0.00 lamp off      lit  6/142/201 entity DORMANT @46.8m      719.8ms
 1:21.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:22.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)

 1:23.0  ── crouch-walk — nearly silent ──
 1:23.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:23.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:25.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:25.5  intake    pos( -16.6,   0.0,  -3.7) walk crch fear 0.01 lamp off      lit  6/142/201 entity DORMANT @48.9m      684.0ms
 1:27.0      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:27.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:28.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:29.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:30.5  intake    pos( -16.6,   0.0,  -3.8) walk crch fear 0.01 lamp off      lit  6/142/201 entity DORMANT @49.0m      467.1ms
 1:30.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:32.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:34.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:35.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:35.5  intake    pos( -13.1,   0.0,  -3.8) walk crch fear 0.01 lamp off      lit  6/142/201 entity DORMANT @46.1m      446.0ms
 1:36.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:37.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:38.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:40.5  intake    pos(  -8.6,   0.0,  -3.8) walk crch fear 0.01 lamp off      lit  6/142/201 entity DORMANT @42.5m      322.1ms
 1:40.5      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:41.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:43.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:44.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:45.5  intake    pos(  -4.4,   0.0,  -3.8) walk crch fear 0.01 lamp off      lit  6/142/201 entity DORMANT @39.3m      322.0ms
 1:45.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:47.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:47.9      * director:beat            zone=intake name=distant_door fear=0.01
 1:47.9      * sfx:distant              kind=door at=(-8.9, 0, 11.8)

 1:48.0  ── sprint — deliberately loud ──
 1:48.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:50.5  intake    pos(  -5.0,   0.0,  -3.8) walk      fear 0.08 lamp off      lit  6/142/201 entity DORMANT @39.8m      321.1ms
 1:50.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:52.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:54.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:55.5  intake    pos( -12.6,   0.0,  -3.8) walk      fear 0.06 lamp off      lit  6/142/201 entity DORMANT @45.7m      299.4ms
 1:56.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:56.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:58.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 1:59.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:00.5  intake    pos( -17.6,   0.0,  -3.8) stil      fear 0.04 lamp off      lit  6/142/201 entity DORMANT @49.8m      298.9ms
 2:01.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:02.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:03.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:05.0      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:05.5  intake    pos( -16.9,   0.0,  -3.8) stil      fear 0.04 lamp off      lit  6/142/201 entity DORMANT @49.2m      298.3ms
 2:06.0      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:06.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:07.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)

 2:08.0  ── walk on, lamp off (the entity only moves in light) ──
 2:08.0      * lamp:toggle              
 2:08.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:09.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:10.5  intake    pos( -16.3,   0.0,  -3.8) walk      fear 0.02 lamp on 0.90 lit  6/142/201 entity DORMANT @48.7m      169.6ms
 2:11.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:12.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:14.0      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:15.5  intake    pos( -12.1,   0.0,  -3.8) walk      fear 0.01 lamp on 0.89 lit  6/142/201 entity DORMANT @45.3m       27.3ms
 2:16.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:17.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:19.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:20.5  intake    pos( -10.0,   0.0,  -3.8) stil      fear 0.01 lamp on 0.88 lit  6/142/201 entity DORMANT @43.6m       26.8ms
 2:21.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:22.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:23.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:24.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:25.5  intake    pos(  -8.1,   0.0,  -3.8) walk      fear 0.01 lamp on 0.86 lit  6/142/201 entity DORMANT @42.1m       26.6ms
 2:26.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:26.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:28.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:29.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:30.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:30.5  intake    pos(  -3.7,   0.0,  -3.8) walk      fear 0.01 lamp on 0.85 lit  6/142/201 entity DORMANT @38.8m       11.9ms
 2:32.0      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:33.5      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:35.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:35.5  intake    pos(  -4.1,   0.0,  -3.8) walk      fear 0.01 lamp on 0.84 lit  6/142/201 entity DORMANT @39.1m       11.3ms
 2:37.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:37.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)

 2:38.0  ── stand in the dark and wait ──
 2:39.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:40.5  intake    pos(  -1.9,   0.0,  -3.8) stil      fear 0.01 lamp on 0.83 lit  6/142/201 entity DORMANT @37.5m       10.9ms
 2:41.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:42.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:44.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:45.5  intake    pos(  -1.9,   0.0,  -3.8) stil      fear 0.00 lamp on 0.81 lit  6/142/201 entity DORMANT @37.5m       10.2ms
 2:45.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:46.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:48.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:50.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:50.5  intake    pos(  -1.9,   0.0,  -3.8) stil      fear 0.00 lamp on 0.80 lit  6/142/201 entity DORMANT @37.5m       10.1ms
 2:52.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:53.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:54.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:55.5  intake    pos(  -1.9,   0.0,  -3.8) stil      fear 0.00 lamp on 0.79 lit  6/142/201 entity DORMANT @37.5m        9.8ms
 2:56.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:56.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:58.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 2:59.5      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:00.5  intake    pos(  -1.9,   0.0,  -3.8) stil      fear 0.00 lamp on 0.78 lit  6/142/201 entity DORMANT @37.5m        9.3ms
 3:00.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:01.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:03.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:04.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:05.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:05.5  intake    pos(  -1.9,   0.0,  -3.8) stil      fear 0.00 lamp on 0.77 lit  6/142/201 entity DORMANT @37.5m        8.8ms
 3:06.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)

 3:08.0  ── SCRIPTED: spawn the Surveyor 26 m away, dormant ──

 3:08.0  ── sprint past it — loud enough to be heard ──
 3:08.5      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:10.0      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:10.5  intake    pos( -10.6,   0.0,  -3.8) walk      fear 0.08 lamp on 0.76 lit  6/142/201 entity DORMANT @44.1m        9.1ms
 3:11.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:12.5      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:14.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:15.5  intake    pos( -16.1,   0.0,  -3.8) walk      fear 0.06 lamp on 0.74 lit  6/142/201 entity DORMANT @48.6m        8.6ms
 3:16.0      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:17.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:18.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:19.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:20.5  intake    pos(  -3.6,   0.0,  -1.7) walk      fear 0.05 lamp on 0.73 lit  6/141/201 entity DORMANT @37.3m        8.8ms
 3:21.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:23.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:24.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:25.5  intake    pos( -10.3,   0.0,  -3.8) walk      fear 0.05 lamp on 0.72 lit  6/142/201 entity DORMANT @43.9m        8.9ms
 3:25.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:27.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:29.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:30.5  intake    pos( -16.6,   0.0,  -3.8) walk      fear 0.04 lamp on 0.71 lit  6/142/201 entity DORMANT @49.0m        9.3ms
 3:30.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:32.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)

 3:33.0  ── lamp on and keep moving (it only advances in light) ──
 3:33.0      * lamp:toggle              
 3:33.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:35.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:35.5  intake    pos(  -6.3,   0.0,  -3.8) walk      fear 0.04 lamp off      lit  6/142/201 entity DORMANT @40.8m        9.5ms
 3:37.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:38.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:39.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:40.5  intake    pos(  -3.7,   0.0,  -3.8) walk      fear 0.01 lamp off      lit  6/142/201 entity DORMANT @38.9m        9.3ms
 3:41.5      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:42.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:43.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:45.5  intake    pos(  -5.8,   0.0,  -3.8) walk      fear 0.02 lamp off      lit  6/142/201 entity DORMANT @40.4m        9.6ms
 3:45.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:46.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:47.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:49.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:50.5  intake    pos( -16.5,   0.0,  -3.8) walk      fear 0.03 lamp off      lit  6/142/201 entity DORMANT @49.0m        9.4ms
 3:50.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:51.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:54.0      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:55.5  intake    pos( -16.3,   0.0,  -3.8) stil      fear 0.01 lamp off      lit  6/142/201 entity DORMANT @48.8m        9.3ms
 3:55.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:57.5      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:58.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 3:59.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:00.5  intake    pos( -16.9,   0.0,  -3.8) walk      fear 0.01 lamp off      lit  6/142/201 entity DORMANT @49.3m        8.9ms
 4:00.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:02.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:03.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:04.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:05.5  intake    pos( -12.2,   0.0,  -3.8) walk      fear 0.02 lamp off      lit  6/142/201 entity DORMANT @45.4m        9.1ms
 4:06.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:07.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)

 4:08.0  ── stop, lamp off, stay still — does it lose you? ──
 4:08.0      * lamp:toggle              
 4:09.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:10.5  intake    pos(  -8.2,   0.0,  -3.8) stil      fear 0.01 lamp on 0.70 lit  6/142/201 entity DORMANT @42.2m        9.5ms
 4:11.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:13.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:14.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:14.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:15.5  intake    pos(  -8.2,   0.0,  -3.8) stil      fear 0.00 lamp on 0.68 lit  6/142/201 entity DORMANT @42.2m        9.9ms
 4:16.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:17.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:18.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:20.5  intake    pos(  -8.2,   0.0,  -3.8) stil      fear 0.00 lamp on 0.67 lit  6/142/201 entity DORMANT @42.2m        9.9ms
 4:20.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:22.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:23.5      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:25.5      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:25.5  intake    pos(  -8.2,   0.0,  -3.8) stil      fear 0.00 lamp on 0.66 lit  6/142/201 entity DORMANT @42.2m       10.0ms
 4:26.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:27.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:28.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:30.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:30.5  intake    pos(  -8.2,   0.0,  -3.8) stil      fear 0.00 lamp on 0.65 lit  6/142/201 entity DORMANT @42.2m       10.4ms
 4:31.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:33.0      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:33.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:35.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:35.5  intake    pos(  -8.2,   0.0,  -3.8) stil      fear 0.00 lamp on 0.64 lit  6/142/201 entity DORMANT @42.2m       10.5ms
 4:37.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:38.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:39.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:40.5  intake    pos(  -8.2,   0.0,  -3.8) stil      fear 0.00 lamp on 0.63 lit  6/142/201 entity DORMANT @42.2m       10.2ms
 4:40.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:41.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:42.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:43.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:44.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:45.5  intake    pos(  -8.2,   0.0,  -3.8) stil      fear 0.00 lamp on 0.61 lit  6/142/201 entity DORMANT @42.2m       10.1ms
 4:46.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)

 4:48.0  ── walk to the service door ──
 4:48.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:49.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:49.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:50.5  intake    pos(  -4.6,   0.0,  -3.8) walk      fear 0.02 lamp on 0.60 lit  6/142/201 entity DORMANT @39.5m        9.9ms
 4:50.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:52.0      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:54.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:55.5  intake    pos(  -6.3,   0.0,  -3.8) walk      fear 0.01 lamp on 0.59 lit  6/142/201 entity DORMANT @40.8m        9.7ms
 4:55.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:56.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:57.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 4:57.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:00.0      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:00.5  intake    pos(  -7.5,   0.0,  -3.8) walk      fear 0.01 lamp on 0.58 lit  6/142/201 entity DORMANT @41.7m        9.4ms
 5:01.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:03.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:04.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:05.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:05.5  intake    pos(  -5.9,   0.0,  -3.8) walk      fear 0.02 lamp on 0.56 lit  6/142/201 entity DORMANT @40.4m        9.1ms
 5:07.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:07.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:09.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:10.5  intake    pos(  -4.6,   0.0,  -3.8) walk      fear 0.02 lamp on 0.55 lit  6/142/201 entity DORMANT @39.5m        8.9ms
 5:11.5      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:12.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:13.0      * zone:leave               zone=intake
 5:13.0      * world:teleport           zone=service at=(370.4, 0, 0)
 5:13.0      * zone:enter               zone=service from=intake
 5:13.0      * qa:scripted-zone-change  zone=service

 5:13.0  ── zone settle ──
 5:13.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)

 5:14.5  ── service spine — first walk ──
 5:15.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:15.5  service   pos( 372.4,   0.0,   0.0) walk      fear 0.02 lamp on 0.54 lit  6/223/286 entity DORMANT @348.6m      32.7ms
 5:16.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:17.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:18.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:19.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:20.5  service   pos( 382.9,   0.0,   0.1) walk      fear 0.03 lamp on 0.53 lit  6/224/286 entity DORMANT @359.2m      54.4ms
 5:21.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:23.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:24.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:24.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:25.5  service   pos( 393.4,   0.0,  -0.3) walk      fear 0.03 lamp on 0.52 lit  6/224/286 entity DORMANT @369.7m      54.4ms
 5:26.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:28.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:29.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:30.5  service   pos( 400.4,   0.0,   1.0) walk      fear 0.02 lamp on 0.51 lit  6/224/286 entity DORMANT @376.6m      54.3ms
 5:31.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:32.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:33.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:34.0      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:34.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:35.5  service   pos( 400.1,   0.0,   1.0) walk      fear 0.01 lamp on 0.49 lit  6/224/286 entity DORMANT @376.2m      54.1ms
 5:36.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:38.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:39.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:40.5  service   pos( 395.6,   0.0,   6.3) walk      fear 0.03 lamp on 0.48 lit  6/224/286 entity DORMANT @371.5m      53.7ms
 5:40.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:41.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:43.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:45.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:45.5  service   pos( 386.6,   0.0,  10.7) walk      fear 0.03 lamp on 0.47 lit  6/224/286 entity DORMANT @362.3m      53.3ms
 5:46.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:48.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)

 5:49.5  ── service spine — sprint ──
 5:50.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:50.5  service   pos( 391.0,   0.0,  16.4) walk      fear 0.08 lamp on 0.46 lit  5/223/286 entity DORMANT @366.6m     135.5ms
 5:51.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:52.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:53.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:55.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:55.5  service   pos( 401.9,   0.0,  15.3) walk      fear 0.12 lamp on 0.45 lit  6/224/286 entity DORMANT @377.5m     519.7ms
 5:56.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:58.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 5:59.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:00.5  service   pos( 390.6,   0.0,  17.9) walk      fear 0.09 lamp on 0.43 lit  5/224/286 entity DORMANT @366.1m     591.1ms
 6:00.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:02.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:03.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:04.5      * zone:leave               zone=service
 6:04.5      * world:teleport           zone=cistern at=(774, 2.6, 0)
 6:04.5      * zone:enter               zone=cistern from=service
 6:04.5      * qa:scripted-zone-change  zone=cistern

 6:04.5  ── zone settle ──
 6:05.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:05.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)

 6:06.0  ── cistern — wading ──
 6:06.0      * lamp:toggle              
 6:06.0  cistern   pos( 773.1,   2.6,   0.0) stil crch fear 0.06 lamp on 0.42 lit  3/223/286 entity DORMANT @749.0m     682.1ms
 6:06.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:07.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:08.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:10.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:11.0  cistern   pos( 777.5,   2.6,   0.1) stil crch fear 0.06 lamp off      lit  4/224/286 entity DORMANT @753.3m     790.5ms
 6:12.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:14.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:15.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:16.0  cistern   pos( 777.5,   2.6,   0.0) stil crch fear 0.05 lamp off      lit  4/224/286 entity DORMANT @753.3m     790.3ms
 6:16.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:19.0      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:20.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:21.0  cistern   pos( 777.5,   2.6,  -0.1) stil crch fear 0.05 lamp off      lit  4/223/286 entity DORMANT @753.3m     790.1ms
 6:21.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:22.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:23.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:24.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:26.0  cistern   pos( 777.5,   2.6,  -0.2) walk crch fear 0.06 lamp off      lit  4/224/286 entity DORMANT @753.3m     789.8ms
 6:26.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:27.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:29.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:31.0  cistern   pos( 777.5,   2.6,  -0.1) walk crch fear 0.05 lamp off      lit  4/224/286 entity DORMANT @753.3m     789.6ms
 6:31.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:32.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:33.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:34.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:36.0  cistern   pos( 777.5,   2.6,  -0.3) stil crch fear 0.05 lamp off      lit  4/224/286 entity DORMANT @753.3m     789.5ms
 6:36.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:37.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:38.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:39.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:40.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)

 6:41.0  ── cistern — stand still in the water ──
 6:41.0  cistern   pos( 777.5,   2.6,  -0.4) stil crch fear 0.06 lamp off      lit  4/224/286 entity DORMANT @753.3m     789.3ms
 6:42.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:43.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:44.6      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:45.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:46.0  cistern   pos( 777.5,   2.6,  -0.4) stil crch fear 0.05 lamp off      lit  4/223/286 entity DORMANT @753.3m     755.6ms
 6:47.0      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:48.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:49.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:50.3      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:51.0  cistern   pos( 777.5,   2.6,  -0.4) stil crch fear 0.05 lamp off      lit  4/224/286 entity DORMANT @753.3m     757.3ms
 6:51.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:53.1      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:53.7      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:55.2      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:56.0  cistern   pos( 777.5,   2.6,  -0.4) stil crch fear 0.05 lamp off      lit  4/224/286 entity DORMANT @753.3m     757.1ms
 6:56.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:57.9      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 6:59.8      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 7:00.4      * entity:tick              entity=surveyor at=(24.5, 0, 22.9)
 7:01.0      * zone:unload              zone=intake
 7:01.0      * zone:leave               zone=cistern
 7:01.0      * world:teleport           zone=safe at=(400.6, 0, 799)
 7:01.0      * zone:enter               zone=safe from=cistern
 7:01.0      * progress:discovery       id=office title=The Office of Record
 7:01.0      * qa:scripted-zone-change  zone=safe

 7:01.0  ── zone settle ──
 7:01.0  cistern   pos( 777.5,   2.6,  -0.4) stil crch fear 0.05 lamp off      lit  4/224/286 entity DORMANT @753.3m     756.9ms

 7:02.5  ── the safe room ──
 7:06.0  safe      pos( 399.4,   0.0, 799.8) walk      fear 0.03 lamp off      lit  5/ 87/90 entity DORMANT @862.7m     852.4ms
 7:11.0  safe      pos( 398.3,   0.0, 795.5) walk      fear 0.03 lamp off      lit  5/ 87/90 entity DORMANT @858.3m     857.7ms
 7:16.0  safe      pos( 394.0,   0.0, 791.4) walk      fear 0.29 lamp off      lit  5/ 87/90 entity DORMANT @852.7m     858.6ms
 7:21.0  safe      pos( 389.5,   0.0, 798.4) walk      fear 0.29 lamp off      lit  5/ 87/90 entity DORMANT @857.1m     776.1ms
 7:26.0  safe      pos( 395.1,   0.0, 792.8) walk      fear 0.29 lamp off      lit  5/ 87/90 entity DORMANT @854.5m     391.7ms
```

`lit A/B/C` = lights uploaded to shaders / fixtures above 5% brightness / fixtures resident.

## Entity state transitions

None. The Surveyor never changed state during the session.

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
    "ms": 359.52583333343887,
    "fps": 2.7814412965216864,
    "p90": 649.5,
    "calls": 124,
    "tris": 55648,
    "quality": "low",
    "res": "397x223"
  },
  "lights": {
    "fixtures": 90,
    "lit": 87,
    "active": 5,
    "shadows": 2
  },
  "entity": {
    "entity": "surveyor",
    "state": "DORMANT",
    "stateTime": 427.58,
    "position": [
      24.5,
      0,
      22.87
    ],
    "heading": 4.704,
    "target": [
      0,
      0,
      0
    ],
    "confidence": 0,
    "illumination": 0,
    "lightScale": 0,
    "speed": 0,
    "frozen": true,
    "stoop": 0,
    "measureHold": 0,
    "distToPlayer": 856.07,
    "usingGlb": true
  },
  "gameplay": {
    "surveyor": {
      "entity": "surveyor",
      "state": "DORMANT",
      "stateTime": 427.58,
      "position": [
        24.5,
        0,
        22.87
      ],
      "heading": 4.704,
      "target": [
        0,
        0,
        0
      ],
      "confidence": 0,
      "illumination": 0,
      "lightScale": 0,
      "speed": 0,
      "frozen": true,
      "stoop": 0,
      "measureHold": 0,
      "distToPlayer": 856.07,
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
      "fear": 0.291,
      "tension": 0,
      "intensity": 0.15,
      "sinceBeat": 59.7,
      "nextBeatAt": 220.2,
      "grace": 0,
      "zone": "safe",
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
      "exposure": 0.1
    },
    "inventory": {
      "items": {
        "lamp": 1
      },
      "selected": "lamp"
    }
  },
  "audio": {
    "voices": 16,
    "oneShots": 12,
    "loops": 4,
    "nodes": 262,
    "occlChecks": 21831,
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
