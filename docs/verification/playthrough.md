# THE ANNEX — continuous playthrough

Generated 2026-07-30T10:01:09.755Z by `tools/qa/playthrough.mjs`.

**37380 frames · 623.0 s of simulated play at a fixed 1/60 step · 873 s of wall clock · quality `low` · 800×450**

This is the first continuous session ever run on this build. Movement, sprint, crouch, the
lamp key and the interact key are real DOM keyboard events; mouse look is written into the
field a locked pointer would write, because headless Chromium cannot grant pointer lock.
Frame times come from a CPU rasteriser and are not a frame-rate verdict.

## Assertions

| | check | detail |
|---|---|---|
| **PASS** | no console errors during the session |  |
| **PASS** | player position never NaN | 0 frames |
| **FAIL** | player never falls through the floor | y -31.33..2.60; frames not standing on a floor: 6538 of 37380 (worst consecutive run 3840) |
| **FAIL** | the frame loop never stalls (no frame > 5 s) | max 11533 ms, p99 7 ms, p50 0.20 ms |
| **PASS** | post-warmup frame times stay bounded (p99 < 250 ms) | warm p50 0.20 ms, p90 0.50 ms, p99 7.20 ms |
| **PASS** | simulated time advanced continuously | 37380 frames |
| **FAIL** | at least one entity state transition occurred | the Surveyor never changed state |
| **PASS** | audio subsystem reports as constructed | subsystems.audio=true, ctx state=running |
| **PASS** | footsteps fired while walking | 140 player:step events |
| **FAIL** | every zone visited reported lit fixtures | min active lights = 0 |

**4 check(s) failed.**

## Pacing

- **Session length:** 623.0 s (10.4 min) of play.
- **Zero-threat time:** 20.0% of samples had no active entity and fear below 0.15.
- **The Surveyor was active at some point.**
- **Threat episodes:** 0 (none)
- **Fear:** median 0.294, p90 0.588, peak 0.588. Above 0.3 for 40.6% of the session, above 0.5 for 34.0%.
- **Director beats fired:** 1 — distant_door at 1:47.9
- **Longest stretch with nothing on the bus except footsteps:** 623.0 s (0:00.0 → 10:23.0).
- **Moving:** 20% of samples.
- **Zones:** intake (0:00.5–5:00.0) → service (5:01.5–7:52.0) → plant (7:53.5–7:56.0) → service (7:56.5–7:56.5) → cistern (7:57.0–7:57.5) → service (7:58.0–8:13.5) → cistern (8:15.5–9:21.5) → service (9:23.0–10:23.0)

### Frame time (CPU rasteriser — not a frame-rate verdict)

| | p50 | p90 | p99 | max |
|---|---:|---:|---:|---:|
| whole session | 0.20 | 0.50 | 7.20 | 11533 |
| after 3 s warmup | 0.20 | 0.50 | 7.20 | 11533 |

All in milliseconds. The multi-second outliers are first-frame shader compiles
after a camera or zone change, which is a property of SwiftShader, not of the renderer.

## Event census

| event | count |
|---|---:|
| `entity:tick` | 294 |
| `player:noise` | 148 |
| `player:step` | 140 |
| `cine:cue` | 57 |
| `qa:phase` | 40 |
| `cine:end` | 38 |
| `game:respawn` | 38 |
| `ui:screen` | 38 |
| `light:circuit` | 21 |
| `player:fell` | 19 |
| `cine:begin` | 19 |
| `attendant:act` | 12 |
| `zone:leave` | 10 |
| `zone:enter` | 10 |
| `world:teleport` | 7 |
| `lamp:toggle` | 5 |
| `qa:scripted-reposition` | 5 |
| `zone:build` | 4 |
| `qa:scripted-zone-change` | 4 |
| `interact:use` | 3 |
| `story:evidence` | 3 |
| `sfx:breaker` | 2 |
| `zone:unload` | 2 |
| `director:entity-placed` | 1 |
| `director:beat` | 1 |
| `sfx:distant` | 1 |
| `world:noise` | 1 |
| `hide:enter` | 1 |
| `portal:gate` | 1 |
| `lift:power` | 1 |
| `progress:complete` | 1 |
| `progress:objective` | 1 |
| `player:land` | 1 |
| `progress:discovery` | 1 |

## Timeline

State every 5 s; every non-footstep event at the moment it fired. Footsteps and noise
events are counted in the census above rather than listed, because there are hundreds.

```

 0:00.0  ── arrival — standing still, taking the room in ──
 0:00.5  intake    pos( -24.0,   0.0,  24.8) stil      fear 0.01 lamp on 0.99 lit  6/142/201 entity not spawned        5899.4ms
 0:05.5  intake    pos( -24.0,   0.0,  24.8) stil      fear 0.00 lamp on 0.98 lit  6/142/201 entity not spawned        2742.9ms

 0:08.0  ── first walk, no lamp ──
 0:10.5  intake    pos( -21.0,   0.0,  23.1) walk      fear 0.03 lamp on 0.97 lit  6/142/201 entity not spawned        2375.1ms
 0:15.5  intake    pos( -10.3,   0.0,  23.2) walk      fear 0.03 lamp on 0.96 lit  6/142/201 entity not spawned        1724.1ms
 0:19.9      * director:entity-placed   
 0:19.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:20.5  intake    pos(   0.1,   0.0,  23.2) walk      fear 0.03 lamp on 0.95 lit  6/142/201 entity DORMANT @24.8m     1390.7ms
 0:21.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:23.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:23.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:25.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:25.5  intake    pos(   2.3,   0.0,  16.1) walk      fear 0.03 lamp on 0.93 lit  6/142/201 entity DORMANT @23.7m     1175.8ms
 0:26.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:28.2      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:29.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:30.5  intake    pos(   6.4,   0.0,  17.3) walk      fear 0.03 lamp on 0.92 lit  6/142/201 entity DORMANT @19.5m     1015.3ms
 0:30.5      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:31.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)

 0:32.0  ── INTERACT: take the nearest thing off the floor ──
 0:33.4      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:34.2      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:35.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:35.5  intake    pos(   3.9,   0.0,  15.2) walk      fear 0.03 lamp on 0.91 lit  6/142/201 entity DORMANT @22.5m      878.4ms
 0:36.4      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:38.0      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:39.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:40.5  intake    pos(  -3.8,   0.0,  13.8) stil      fear 0.02 lamp on 0.90 lit  6/142/201 entity DORMANT @30.3m      785.8ms
 0:40.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:41.5      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:42.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:43.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:45.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:45.5  intake    pos(  -3.8,   0.0,  13.3) stil      fear 0.01 lamp on 0.89 lit  6/141/201 entity DORMANT @30.5m      702.0ms
 0:46.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:47.5      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:48.4      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:49.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:50.5  intake    pos(  -3.8,   0.0,  13.3) stil      fear 0.00 lamp on 0.88 lit  6/142/201 entity DORMANT @30.5m      642.7ms
 0:51.5      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:52.0      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:52.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:53.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:54.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:54.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 0:55.5  intake    pos(  -3.8,   0.0,  13.1) stil      fear 0.00 lamp on 0.86 lit  6/142/201 entity DORMANT @30.5m      585.9ms
 0:56.4      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)

 0:58.0  ── lamp on ──
 0:58.0      * lamp:toggle              
 0:58.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:00.4      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:00.5  intake    pos(  -3.8,   0.0,  13.3) stil      fear 0.00 lamp off      lit  6/142/201 entity DORMANT @30.5m      665.1ms
 1:01.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:03.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:04.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:05.5  intake    pos(  -3.8,   0.0,  13.3) stil      fear 0.00 lamp off      lit  6/142/201 entity DORMANT @30.5m      614.3ms
 1:05.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:07.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:07.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:10.0      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:10.5  intake    pos(  -3.8,   0.0,  13.3) stil      fear 0.00 lamp off      lit  6/141/201 entity DORMANT @30.5m      575.8ms
 1:11.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:12.5      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:13.5      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:14.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:15.0      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:15.5  intake    pos(  -3.8,   0.0,  13.3) stil      fear 0.00 lamp off      lit  6/142/201 entity DORMANT @30.5m      537.4ms
 1:16.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:17.2      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:18.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:19.5      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)

 1:20.0  ── stop and listen (lamp on) ──
 1:20.5  intake    pos(  -3.8,   0.0,  13.3) stil      fear 0.00 lamp off      lit  6/142/201 entity DORMANT @30.5m      254.1ms
 1:21.4      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:22.4      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:23.2      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:23.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:25.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:25.5  intake    pos(  -3.8,   0.0,  13.3) stil      fear 0.00 lamp off      lit  6/142/201 entity DORMANT @30.5m      244.9ms
 1:27.0      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:27.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:28.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:29.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:30.5  intake    pos(  -3.8,   0.0,  13.3) stil      fear 0.00 lamp off      lit  6/142/201 entity DORMANT @30.5m      149.6ms
 1:30.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:32.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:34.2      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:35.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:35.5  intake    pos(  -3.8,   0.0,  13.3) stil      fear 0.00 lamp off      lit  6/142/201 entity DORMANT @30.5m      148.9ms
 1:36.4      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:37.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)

 1:38.0  ── INTERACT: get into the locker by the lift ──
 1:38.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:40.5  intake    pos(  -3.8,   0.0,  10.8) walk      fear 0.02 lamp off      lit  6/142/201 entity DORMANT @31.4m      149.9ms
 1:40.5      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:41.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:43.2      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:44.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:45.5  intake    pos(  -6.5,   0.0,  16.3) walk      fear 0.02 lamp off      lit  6/142/201 entity DORMANT @32.3m      209.7ms
 1:45.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:47.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:47.9      * director:beat            zone=intake name=distant_door fear=0.03
 1:47.9      * sfx:distant              kind=door at=(-17.1, 0, 34.3)
 1:48.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:50.5  intake    pos( -16.1,   0.0,  20.6) walk      fear 0.03 lamp off      lit  6/142/201 entity DORMANT @41.1m      209.8ms
 1:50.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:52.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:54.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:55.5  intake    pos( -24.4,   0.0,  20.6) walk      fear 0.02 lamp off      lit  6/142/201 entity DORMANT @49.4m      209.8ms
 1:56.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:56.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:58.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 1:59.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:00.5  intake    pos( -29.3,   0.0,  24.9) walk      fear 0.03 lamp off      lit  6/142/201 entity DORMANT @54.2m      209.8ms
 2:01.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:01.8      * hide:enter               id=locker_intake kind=locker at=(-31.1, 0, 29.1)
 2:01.8      * interact:use             id=locker_intake_enter kind=hide

 2:02.0  ── crouch-walk — nearly silent ──
 2:02.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:03.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:05.0      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:05.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.3m      209.4ms
 2:06.0      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:06.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:07.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:08.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:09.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:10.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.3m      208.9ms
 2:11.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:12.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:14.0      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:15.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.3m      208.5ms
 2:16.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:17.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:19.2      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:20.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.3m      111.4ms
 2:21.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:22.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:23.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)

 2:24.0  ── sprint — deliberately loud ──
 2:24.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:25.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.3m      111.3ms
 2:26.2      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:26.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:28.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:29.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:30.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:30.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.3m      125.4ms
 2:32.0      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:33.5      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:35.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:35.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.3m      148.3ms
 2:37.2      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:37.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:39.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:40.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.3m      132.5ms
 2:41.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)

 2:42.0  ── walk on, lamp off (the entity only moves in light) ──
 2:42.0      * lamp:toggle              
 2:42.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:44.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:45.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.85 lit  6/142/201 entity DORMANT @56.3m      117.2ms
 2:45.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:46.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:48.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:50.2      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:50.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.84 lit  6/142/201 entity DORMANT @56.3m      117.0ms
 2:52.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:53.2      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:54.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:55.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.82 lit  6/142/201 entity DORMANT @56.3m      117.0ms
 2:56.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:56.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:58.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 2:59.5      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:00.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.81 lit  6/142/201 entity DORMANT @56.3m      115.6ms
 3:00.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:01.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:03.4      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:04.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:05.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:05.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.80 lit  6/142/201 entity DORMANT @56.3m       42.1ms
 3:06.4      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)

 3:08.0  ── stand in the dark and wait ──
 3:08.5      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:10.0      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:10.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.79 lit  6/142/201 entity DORMANT @56.3m       67.5ms
 3:11.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:12.5      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:14.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:15.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.78 lit  6/142/201 entity DORMANT @56.3m       74.8ms
 3:16.0      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:17.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:18.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:19.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:20.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.77 lit  6/141/201 entity DORMANT @56.3m       98.5ms
 3:21.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:23.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:24.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:25.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.75 lit  6/142/201 entity DORMANT @56.3m       98.7ms
 3:25.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:27.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:29.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:30.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.74 lit  6/142/201 entity DORMANT @56.3m       98.7ms
 3:30.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:32.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:33.4      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)

 3:34.0  ── SCRIPTED: spawn the Surveyor 26 m away, dormant ──

 3:34.0  ── sprint past it — loud enough to be heard ──
 3:35.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:35.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.73 lit  6/142/201 entity DORMANT @56.3m       98.7ms
 3:37.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:38.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:39.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:40.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.72 lit  6/142/201 entity DORMANT @56.3m       98.5ms
 3:41.5      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:42.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:43.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:45.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.71 lit  6/142/201 entity DORMANT @56.3m       98.7ms
 3:45.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:46.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:47.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:49.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:50.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.69 lit  6/142/201 entity DORMANT @56.3m      103.3ms
 3:50.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:51.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:54.0      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:55.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.68 lit  6/142/201 entity DORMANT @56.3m       87.1ms
 3:55.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)

 3:56.0  ── lamp on and keep moving (it only advances in light) ──
 3:56.0      * lamp:toggle              
 3:57.5      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:58.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 3:59.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:00.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.3m      118.3ms
 4:00.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:02.2      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:03.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:04.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:05.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.3m      118.2ms
 4:06.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:07.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:09.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:10.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.3m      118.4ms
 4:11.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:13.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:14.2      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:14.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:15.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.3m      118.4ms
 4:16.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:17.4      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:18.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:20.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.3m      118.4ms
 4:20.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:22.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:23.5      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:25.5      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:25.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.3m      118.4ms

 4:26.0  ── stop, lamp off, stay still — does it lose you? ──
 4:26.0      * lamp:toggle              
 4:26.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:27.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:28.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:30.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:30.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.67 lit  6/142/201 entity DORMANT @56.3m      102.2ms
 4:31.2      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:33.0      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:33.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:35.4      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:35.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.66 lit  6/142/201 entity DORMANT @56.3m      101.4ms
 4:37.4      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:38.2      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:39.4      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:40.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.65 lit  6/142/201 entity DORMANT @56.3m       91.7ms
 4:40.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:41.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:42.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:43.2      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:44.2      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:45.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.63 lit  6/142/201 entity DORMANT @56.3m       91.5ms
 4:46.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:48.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:49.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:49.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:50.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.62 lit  6/142/201 entity DORMANT @56.3m       91.7ms
 4:50.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:52.0      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:54.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:55.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.61 lit  6/142/201 entity DORMANT @56.3m       91.9ms
 4:55.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:56.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:57.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 4:57.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:00.0      * zone:build               zone=service
 5:00.0      * zone:leave               zone=intake
 5:00.0      * world:teleport           zone=service at=(370.4, 0, 0)
 5:00.0      * zone:enter               zone=service from=intake
 5:00.0      * qa:scripted-zone-change  zone=service

 5:00.0  ── zone settle ──
 5:00.0      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:00.9      * zone:build               zone=cistern

 5:01.5  ── service spine — first walk ──
 5:01.5  service   pos( 370.4,   0.0,   0.0) stil      fear 0.29 lamp on 0.60 lit  6/209/286 entity DORMANT @346.3m     130.3ms
 5:01.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:03.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:04.4      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:05.2      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:06.5  service   pos( 370.4,   0.0,   0.0) stil      fear 0.29 lamp on 0.58 lit  6/209/286 entity DORMANT @346.3m     130.3ms
 5:07.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:07.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:09.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:11.5      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:11.5  service   pos( 370.4,   0.0,   0.0) stil      fear 0.29 lamp on 0.57 lit  6/209/286 entity DORMANT @346.3m     112.0ms
 5:12.2      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:13.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:15.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:16.5  service   pos( 370.4,   0.0,   0.0) stil      fear 0.29 lamp on 0.56 lit  6/209/286 entity DORMANT @346.3m     105.6ms
 5:16.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:17.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:18.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:19.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:21.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:21.5  service   pos( 370.4,   0.0,   0.0) stil      fear 0.29 lamp on 0.55 lit  6/209/286 entity DORMANT @346.3m      74.6ms
 5:23.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:24.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:24.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:26.5  service   pos( 370.4,   0.0,   0.0) stil      fear 0.29 lamp on 0.54 lit  6/209/286 entity DORMANT @346.3m      74.6ms
 5:26.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:28.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:29.5      * qa:scripted-reposition   at=(412.6, 0, -2.2) zone=service

 5:29.5  ── reposition settle ──
 5:29.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)

 5:31.5  ── walk into the switchroom ──
 5:31.5  service   pos( 412.6,   0.0,  -2.2) stil      fear 0.29 lamp on 0.53 lit  6/209/286 entity DORMANT @388.6m      74.7ms
 5:31.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:32.4      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:33.2      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:34.0      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:34.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:36.5  service   pos( 412.6,   0.0,  -2.2) stil      fear 0.29 lamp on 0.51 lit  6/209/286 entity DORMANT @388.6m      75.0ms
 5:36.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:38.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:39.2      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:40.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:41.5  service   pos( 412.6,   0.0,  -2.2) stil      fear 0.29 lamp on 0.50 lit  6/209/286 entity DORMANT @388.6m      75.2ms
 5:41.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)

 5:43.5  ── INTERACT: read the board schedule off the floor ──
 5:43.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:45.4      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:46.5  service   pos( 412.6,   0.0,  -2.2) stil      fear 0.29 lamp on 0.49 lit  6/209/286 entity DORMANT @388.6m      75.3ms
 5:46.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:48.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:50.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:51.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:51.5  service   pos( 412.6,   0.0,  -2.2) stil      fear 0.29 lamp on 0.48 lit  6/209/286 entity DORMANT @388.6m      66.0ms
 5:52.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:53.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:55.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:56.5  service   pos( 412.6,   0.0,  -2.2) stil      fear 0.29 lamp on 0.47 lit  6/208/286 entity DORMANT @388.6m      73.5ms
 5:56.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:58.4      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 5:59.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:00.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:01.5  service   pos( 412.6,   0.0,  -2.2) stil      fear 0.29 lamp on 0.45 lit  6/209/286 entity DORMANT @388.6m      59.6ms
 6:02.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:03.5      * qa:scripted-reposition   at=(414.6, 0, -8.4) zone=service

 6:03.5  ── reposition settle ──
 6:03.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:05.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)

 6:05.5  ── INTERACT: reset way 5 — the Stack lift lobby ──
 6:05.7      * light:circuit            circuit=stack powered=true
 6:05.7      * sfx:breaker              at=(416.1, 1.2, -8.4)
 6:05.7      * interact:use             id=board_c_way5 kind=breaker
 6:05.7      * portal:gate              id=to_stack
 6:05.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)

 6:06.0  ── INTERACT: trip way 2 — put the Spine out behind you ──
 6:06.1      * light:circuit            circuit=service powered=false
 6:06.1      * sfx:breaker              at=(416.1, 1.2, -8.4)
 6:06.1      * interact:use             id=board_c_way2 kind=breaker

 6:06.5  ── stand in the switchroom and look at what changed ──
 6:06.5  service   pos( 414.6,   0.0,  -8.4) stil      fear 0.29 lamp on 0.44 lit  1/209/286 entity DORMANT @391.0m      59.6ms
 6:06.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:07.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:08.4      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:10.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:11.5  service   pos( 414.6,   0.0,  -8.4) stil      fear 0.33 lamp on 0.43 lit  1/144/286 entity DORMANT @391.0m     117.9ms
 6:12.4      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:14.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:15.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:16.5  service   pos( 414.6,   0.0,  -8.4) stil      fear 0.33 lamp on 0.42 lit  1/146/286 entity DORMANT @391.0m     128.6ms
 6:16.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:19.0      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:20.5      * zone:leave               zone=service
 6:20.5      * world:teleport           zone=cistern at=(774, 2.6, 0)
 6:20.5      * zone:enter               zone=cistern from=service
 6:20.5      * qa:scripted-zone-change  zone=cistern

 6:20.5  ── zone settle ──
 6:20.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:21.2      * zone:leave               zone=cistern
 6:21.2      * world:teleport           zone=service at=(420.5, -3.1, 9)
 6:21.2      * zone:enter               zone=service from=cistern
 6:21.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)

 6:22.0  ── cistern — wading ──
 6:22.0      * lamp:toggle              
 6:22.0  service   pos( 420.5,  -3.1,   9.0) stil      fear 0.33 lamp on 0.41 lit  2/146/286 entity DORMANT @395.9m     162.5ms
 6:22.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:23.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:24.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:26.4      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:27.0  service   pos( 420.5,  -3.1,   9.0) stil      fear 0.56 lamp off      lit  2/146/286 entity DORMANT @395.9m     282.7ms
 6:27.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:29.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:31.2      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:32.0  service   pos( 420.5,  -3.1,   9.0) stil      fear 0.56 lamp off      lit  2/146/286 entity DORMANT @395.9m     282.3ms
 6:32.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:33.1      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:34.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:36.2      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:37.0  service   pos( 420.5,  -3.1,   9.0) stil      fear 0.56 lamp off      lit  2/146/286 entity DORMANT @395.9m     282.0ms
 6:37.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:38.7      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:39.4      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:40.9      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:42.0  service   pos( 420.5,  -3.1,   9.0) stil      fear 0.56 lamp off      lit  2/146/286 entity DORMANT @395.9m     281.6ms
 6:42.8      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:43.4      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:44.6      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:45.3      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:47.0  service   pos( 420.5,  -3.1,   9.0) stil      fear 0.56 lamp off      lit  2/146/286 entity DORMANT @395.9m     281.4ms
 6:47.0      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:48.0      * qa:scripted-reposition   at=(415.4, 0, 3.2) zone=service

 6:48.0  ── reposition settle ──
 6:48.4      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:49.2      * entity:tick              entity=surveyor at=(24.9, 0, 23.5)
 6:49.7      * player:fell              from=0
 6:49.7      * story:evidence           kind=footprints at=(413, 0, -4.6)
 6:49.7      * attendant:act            kind=footprints at=(413, 0, -4.6)
 6:49.7      * attendant:act            kind=locker at=(387.1, 0, 5.5)
 6:49.7      * cine:end                 name=death
 6:49.7      * game:respawn             
 6:49.7      * cine:begin               name=respawn
 6:49.7      * ui:screen                
 6:49.7      * light:circuit            circuit=office_lamp powered=true
 6:49.8      * cine:cue                 

 6:50.0  ── INTERACT: turn penstock 1 (a 1.35 s hold) ──
 6:50.3      * cine:cue                 
 6:52.0  service   pos( 420.5, -28.0,   9.0) stil      fear 0.56 lamp off      lit  0/144/286 entity DORMANT @24.5m      348.4ms
 6:52.9      * cine:cue                 
 6:56.2      * player:fell              from=-3.15
 6:56.2      * story:evidence           kind=footprints at=(413.3, 0, -6)
 6:56.2      * attendant:act            kind=footprints at=(413.3, 0, -6)
 6:56.2      * cine:end                 name=death
 6:56.2      * game:respawn             
 6:56.2      * ui:screen                
 6:56.2      * game:respawn             
 6:56.2      * cine:end                 name=respawn
 6:56.2      * cine:begin               name=respawn
 6:56.2      * ui:screen                
 6:56.3      * light:circuit            circuit=office_lamp powered=true
 6:56.3      * cine:cue                 
 6:56.8      * cine:cue                 
 6:57.0  service   pos( 420.5, -31.3,   9.0) stil      fear 0.51 lamp off      lit  0/146/286 entity DORMANT @30.0m      349.8ms
 6:59.4      * cine:cue                 
 7:02.0  service   pos( 420.5, -31.3,   9.0) stil      fear 0.56 lamp off      lit  0/146/286 entity DORMANT @30.0m      349.6ms
 7:02.3      * player:fell              from=-3.15
 7:02.3      * cine:end                 name=death
 7:02.3      * game:respawn             
 7:02.3      * ui:screen                
 7:02.3      * game:respawn             
 7:02.3      * cine:end                 name=respawn
 7:02.3      * cine:begin               name=respawn
 7:02.3      * ui:screen                
 7:02.3      * light:circuit            circuit=office_lamp powered=true
 7:02.4      * cine:cue                 
 7:02.8      * cine:cue                 
 7:05.4      * cine:cue                 
 7:07.0  service   pos( 420.5, -31.3,   9.0) stil      fear 0.56 lamp off      lit  0/146/286 entity DORMANT @30.0m      349.4ms
 7:08.3      * player:fell              from=-3.15
 7:08.3      * cine:end                 name=death
 7:08.3      * game:respawn             
 7:08.3      * ui:screen                
 7:08.3      * game:respawn             
 7:08.3      * cine:end                 name=respawn
 7:08.3      * cine:begin               name=respawn
 7:08.3      * ui:screen                
 7:08.3      * light:circuit            circuit=office_lamp powered=true
 7:08.4      * cine:cue                 
 7:08.9      * cine:cue                 
 7:11.5      * cine:cue                 
 7:12.0  service   pos( 420.5, -31.3,   9.0) stil      fear 0.56 lamp off      lit  0/146/286 entity DORMANT @30.0m      349.2ms
 7:14.3      * player:fell              from=-3.15
 7:14.3      * cine:end                 name=death
 7:14.3      * game:respawn             
 7:14.3      * ui:screen                
 7:14.3      * game:respawn             
 7:14.3      * cine:end                 name=respawn
 7:14.3      * cine:begin               name=respawn
 7:14.3      * ui:screen                
 7:14.3      * light:circuit            circuit=office_lamp powered=true
 7:14.4      * cine:cue                 
 7:14.9      * cine:cue                 

 7:16.0  ── INTERACT: try penstock 2 — it is padlocked ──
 7:17.0  service   pos( 420.5, -31.3,   9.0) stil      fear 0.56 lamp off      lit  0/146/286 entity DORMANT @30.0m      335.2ms
 7:17.5      * cine:cue                 
 7:20.3      * player:fell              from=-3.15
 7:20.3      * cine:end                 name=death
 7:20.3      * game:respawn             
 7:20.3      * ui:screen                
 7:20.3      * game:respawn             
 7:20.3      * cine:end                 name=respawn
 7:20.3      * cine:begin               name=respawn
 7:20.3      * ui:screen                
 7:20.3      * light:circuit            circuit=office_lamp powered=true
 7:20.4      * cine:cue                 
 7:20.9      * cine:cue                 
 7:22.0  service   pos( 420.5, -31.3,   9.0) stil      fear 0.56 lamp off      lit  0/146/286 entity DORMANT @30.0m      335.0ms
 7:23.5      * cine:cue                 
 7:26.3      * player:fell              from=-3.15
 7:26.3      * cine:end                 name=death
 7:26.3      * game:respawn             
 7:26.3      * ui:screen                
 7:26.3      * game:respawn             
 7:26.3      * cine:end                 name=respawn
 7:26.3      * cine:begin               name=respawn
 7:26.3      * ui:screen                
 7:26.4      * light:circuit            circuit=office_lamp powered=true
 7:26.4      * cine:cue                 
 7:26.9      * cine:cue                 
 7:27.0  service   pos( 420.5, -31.3,   9.0) stil      fear 0.50 lamp off      lit  0/146/286 entity DORMANT @30.0m      276.2ms
 7:29.5      * cine:cue                 
 7:32.0  service   pos( 420.5, -31.3,   9.0) stil      fear 0.56 lamp off      lit  0/145/286 entity DORMANT @30.0m      276.2ms
 7:32.3      * player:fell              from=-3.15
 7:32.3      * cine:end                 name=death
 7:32.3      * game:respawn             
 7:32.3      * ui:screen                
 7:32.3      * game:respawn             
 7:32.3      * cine:end                 name=respawn
 7:32.3      * cine:begin               name=respawn
 7:32.3      * ui:screen                
 7:32.4      * light:circuit            circuit=office_lamp powered=true
 7:32.4      * cine:cue                 
 7:32.9      * cine:cue                 
 7:35.5      * cine:cue                 

 7:36.0  ── cistern — stand still in the water ──
 7:37.0  service   pos( 420.5, -31.3,   9.0) stil      fear 0.56 lamp off      lit  0/145/286 entity DORMANT @30.0m      265.4ms
 7:38.4      * player:fell              from=-3.15
 7:38.4      * cine:end                 name=death
 7:38.4      * game:respawn             
 7:38.4      * ui:screen                
 7:38.4      * game:respawn             
 7:38.4      * cine:end                 name=respawn
 7:38.4      * cine:begin               name=respawn
 7:38.4      * ui:screen                
 7:38.4      * light:circuit            circuit=office_lamp powered=true
 7:38.4      * cine:cue                 
 7:38.9      * cine:cue                 
 7:41.6      * cine:cue                 
 7:42.0  service   pos( 420.5, -31.3,   9.0) stil      fear 0.56 lamp off      lit  0/146/286 entity DORMANT @30.0m      193.0ms
 7:44.4      * player:fell              from=-3.15
 7:44.4      * cine:end                 name=death
 7:44.4      * game:respawn             
 7:44.4      * ui:screen                
 7:44.4      * game:respawn             
 7:44.4      * cine:end                 name=respawn
 7:44.4      * cine:begin               name=respawn
 7:44.4      * ui:screen                
 7:44.4      * light:circuit            circuit=office_lamp powered=true
 7:44.5      * cine:cue                 
 7:44.9      * cine:cue                 
 7:47.0  service   pos( 420.5, -31.3,   9.0) stil      fear 0.56 lamp off      lit  0/146/286 entity DORMANT @30.0m       72.7ms
 7:47.6      * cine:cue                 
 7:50.4      * player:fell              from=-3.15
 7:50.4      * cine:end                 name=death
 7:50.4      * game:respawn             
 7:50.4      * ui:screen                
 7:50.4      * game:respawn             
 7:50.4      * cine:end                 name=respawn
 7:50.4      * cine:begin               name=respawn
 7:50.4      * ui:screen                
 7:50.4      * light:circuit            circuit=office_lamp powered=true
 7:50.5      * cine:cue                 
 7:51.0      * cine:cue                 
 7:52.0      * zone:build               zone=plant
 7:52.0      * lift:power               id=lift_2
 7:52.0      * zone:unload              zone=intake
 7:52.0      * zone:leave               zone=service
 7:52.0      * world:teleport           zone=plant at=(384.8, 0.7, 400)
 7:52.0      * zone:enter               zone=plant from=service
 7:52.0      * progress:complete        id=reach_plant title=Find the Plant
 7:52.0      * progress:objective       title=Supply core — the Cistern objective=core_cistern
 7:52.0      * qa:scripted-zone-change  zone=plant

 7:52.0  ── zone settle ──
 7:52.0  service   pos( 420.5, -31.3,   9.0) stil      fear 0.56 lamp off      lit  0/161/286 entity DORMANT @30.0m       72.7ms

 7:53.5  ── the generator hall — the landmark frame ──
 7:53.6      * cine:cue                 
 7:56.4      * zone:leave               zone=plant
 7:56.4      * zone:enter               zone=service from=plant
 7:56.8      * zone:leave               zone=service
 7:56.8      * world:teleport           zone=cistern at=(774.6, 2.6, 0)
 7:56.8      * zone:enter               zone=cistern from=service
 7:57.0  cistern   pos( 420.5,   2.2,   9.0) stil      fear 0.58 lamp off      lit  2/ 22/105 entity DORMANT @45.0m      208.0ms
 7:57.6      * zone:leave               zone=cistern
 7:57.6      * zone:enter               zone=service from=cistern
 7:57.6      * player:land              surface=concrete
 7:59.0      * ui:screen                
 7:59.0      * game:respawn             
 7:59.0      * cine:end                 name=respawn
 8:02.0  service   pos( 420.5,  -3.1,   9.0) stil      fear 0.59 lamp off      lit  2/ 22/105 entity DORMANT @41.2m      210.7ms
 8:07.0  service   pos( 420.5,  -3.1,   9.0) stil      fear 0.59 lamp off      lit  2/ 22/105 entity DORMANT @41.2m      210.6ms
 8:12.0  service   pos( 420.5,  -3.1,   9.0) stil      fear 0.59 lamp off      lit  2/ 22/105 entity DORMANT @41.2m      143.2ms
 8:13.5      * qa:scripted-reposition   at=(402.6, 0, -2) zone=service

 8:13.5  ── reposition settle ──
 8:15.2      * player:fell              from=0
 8:15.2      * story:evidence           kind=footprints at=(378.9, 0, -0.2)
 8:15.2      * attendant:act            kind=footprints at=(378.9, 0, -0.2)
 8:15.2      * attendant:act            kind=locker at=(387.1, 0, 5.5)
 8:15.2      * cine:end                 name=death
 8:15.2      * game:respawn             
 8:15.2      * cine:begin               name=respawn
 8:15.2      * zone:leave               zone=service
 8:15.2      * zone:enter               zone=cistern from=service
 8:15.2      * ui:screen                
 8:15.2      * light:circuit            circuit=office_lamp powered=true
 8:15.3      * cine:cue                 

 8:15.5  ── INTERACT: try the fuel valve with no cores fitted ──
 8:15.8      * cine:cue                 
 8:17.0  cistern   pos( 774.6, -28.0,   0.0) stil      fear 0.58 lamp off      lit  0/ 22/105 entity DORMANT @349.0m     150.2ms
 8:18.4      * cine:cue                 
 8:21.2      * player:fell              from=2.6
 8:21.2      * attendant:act            kind=locker at=(793.1, 0.2, 6.6)
 8:21.2      * cine:end                 name=death
 8:21.2      * game:respawn             
 8:21.2      * ui:screen                
 8:21.2      * game:respawn             
 8:21.2      * cine:end                 name=respawn
 8:21.2      * cine:begin               name=respawn
 8:21.2      * ui:screen                
 8:21.2      * light:circuit            circuit=office_lamp powered=true
 8:21.3      * cine:cue                 
 8:21.8      * cine:cue                 
 8:22.0  cistern   pos( 774.6, -28.1,   0.0) stil      fear 0.54 lamp off      lit  0/ 22/105 entity DORMANT @30.0m      150.1ms
 8:24.4      * cine:cue                 
 8:27.0  cistern   pos( 774.6, -28.1,   0.0) stil      fear 0.59 lamp off      lit  0/ 22/105 entity DORMANT @30.0m      150.0ms
 8:27.2      * player:fell              from=2.6
 8:27.2      * attendant:act            kind=locker at=(793.1, 0.2, 6.6)
 8:27.2      * cine:end                 name=death
 8:27.2      * game:respawn             
 8:27.2      * ui:screen                
 8:27.2      * game:respawn             
 8:27.2      * cine:end                 name=respawn
 8:27.2      * cine:begin               name=respawn
 8:27.2      * ui:screen                
 8:27.2      * light:circuit            circuit=office_lamp powered=true
 8:27.3      * cine:cue                 
 8:27.8      * cine:cue                 
 8:30.4      * cine:cue                 
 8:32.0  cistern   pos( 774.6, -28.1,   0.0) stil      fear 0.59 lamp off      lit  0/ 22/105 entity DORMANT @30.0m      150.0ms
 8:33.2      * player:fell              from=2.6
 8:33.2      * attendant:act            kind=locker at=(793.1, 0.2, 6.6)
 8:33.2      * cine:end                 name=death
 8:33.2      * game:respawn             
 8:33.2      * ui:screen                
 8:33.2      * game:respawn             
 8:33.2      * cine:end                 name=respawn
 8:33.2      * cine:begin               name=respawn
 8:33.2      * ui:screen                
 8:33.3      * light:circuit            circuit=office_lamp powered=true
 8:33.3      * cine:cue                 
 8:33.8      * cine:cue                 
 8:36.4      * cine:cue                 
 8:37.0  cistern   pos( 774.6, -28.1,   0.0) stil      fear 0.59 lamp off      lit  0/ 22/105 entity DORMANT @30.0m      149.8ms

 8:37.5  ── INTERACT: try a socket with nothing in your hands ──
 8:39.2      * player:fell              from=2.6
 8:39.2      * attendant:act            kind=locker at=(793.1, 0.2, 6.6)
 8:39.2      * cine:end                 name=death
 8:39.2      * game:respawn             
 8:39.2      * ui:screen                
 8:39.2      * game:respawn             
 8:39.2      * cine:end                 name=respawn
 8:39.2      * cine:begin               name=respawn
 8:39.2      * ui:screen                
 8:39.3      * light:circuit            circuit=office_lamp powered=true
 8:39.3      * cine:cue                 
 8:39.8      * cine:cue                 
 8:42.0  cistern   pos( 774.6, -28.1,   0.0) stil      fear 0.59 lamp off      lit  0/ 85/105 entity DORMANT @30.0m      149.8ms
 8:42.4      * cine:cue                 
 8:45.3      * player:fell              from=2.6
 8:45.3      * attendant:act            kind=locker at=(793.1, 0.2, 6.6)
 8:45.3      * cine:end                 name=death
 8:45.3      * game:respawn             
 8:45.3      * ui:screen                
 8:45.3      * game:respawn             
 8:45.3      * cine:end                 name=respawn
 8:45.3      * cine:begin               name=respawn
 8:45.3      * ui:screen                
 8:45.3      * light:circuit            circuit=office_lamp powered=true
 8:45.4      * cine:cue                 
 8:45.8      * cine:cue                 
 8:47.0  cistern   pos( 774.6, -28.1,   0.0) stil      fear 0.58 lamp off      lit  0/ 85/105 entity DORMANT @30.0m      149.8ms
 8:48.5      * cine:cue                 
 8:51.3      * player:fell              from=2.6
 8:51.3      * attendant:act            kind=locker at=(793.1, 0.2, 6.6)
 8:51.3      * cine:end                 name=death
 8:51.3      * game:respawn             
 8:51.3      * ui:screen                
 8:51.3      * game:respawn             
 8:51.3      * cine:end                 name=respawn
 8:51.3      * cine:begin               name=respawn
 8:51.3      * ui:screen                
 8:51.3      * light:circuit            circuit=office_lamp powered=true
 8:51.4      * cine:cue                 
 8:51.9      * cine:cue                 
 8:52.0  cistern   pos( 774.6, -28.1,   0.0) stil      fear 0.53 lamp off      lit  0/ 85/105 entity DORMANT @30.0m      149.6ms
 8:54.5      * cine:cue                 
 8:57.0  cistern   pos( 774.6, -28.1,   0.0) stil      fear 0.59 lamp off      lit  0/ 22/105 entity DORMANT @30.0m      149.4ms
 8:57.3      * player:fell              from=2.6
 8:57.3      * attendant:act            kind=locker at=(793.1, 0.2, 6.6)
 8:57.3      * cine:end                 name=death
 8:57.3      * game:respawn             
 8:57.3      * ui:screen                
 8:57.3      * game:respawn             
 8:57.3      * cine:end                 name=respawn
 8:57.3      * cine:begin               name=respawn
 8:57.3      * ui:screen                
 8:57.3      * light:circuit            circuit=office_lamp powered=true
 8:57.4      * cine:cue                 
 8:57.5      * qa:scripted-reposition   at=(814, -0.3, 0) zone=cistern

 8:57.5  ── reposition settle ──
 8:57.9      * cine:cue                 

 8:59.5  ── INTERACT: call the goods lift — it has no supply ──
 9:00.5      * cine:cue                 
 9:02.0  cistern   pos( 814.0,  -0.3,   0.0) stil      fear 0.32 lamp off      lit  6/ 22/105 entity DORMANT @54.7m      174.8ms
 9:05.9      * ui:screen                
 9:05.9      * game:respawn             
 9:05.9      * cine:end                 name=respawn
 9:07.0  cistern   pos( 776.1,   0.0,   1.0) walk      fear 0.35 lamp off      lit  4/ 22/105 entity DORMANT @41.8m      236.6ms
 9:12.0  cistern   pos( 780.6,   0.0,   3.2) walk      fear 0.51 lamp off      lit  6/ 22/105 entity DORMANT @43.5m      320.2ms
 9:17.0  cistern   pos( 780.6,   0.0,   3.2) walk      fear 0.50 lamp off      lit  6/ 22/105 entity DORMANT @43.5m      184.9ms
 9:21.5      * zone:build               zone=safe
 9:21.5      * zone:unload              zone=plant
 9:21.5      * zone:leave               zone=cistern
 9:21.5      * world:teleport           zone=safe at=(400.6, 0, 799)
 9:21.5      * zone:enter               zone=safe from=cistern
 9:21.5      * progress:discovery       id=office title=The Office of Record
 9:21.5      * qa:scripted-zone-change  zone=safe

 9:21.5  ── zone settle ──
 9:22.2      * zone:leave               zone=safe
 9:22.2      * world:teleport           zone=service at=(397.9, 0, 3.3)
 9:22.2      * zone:enter               zone=service from=safe

 9:23.0  ── the safe room ──
 9:23.0  service   pos( 397.9,   0.0,   3.3) stil      fear 0.57 lamp off      lit  1/ 24/90 entity DORMANT @382.1m     217.8ms
 9:28.0  service   pos( 399.0,   0.0,   1.7) walk      fear 0.59 lamp off      lit  1/ 24/90 entity DORMANT @380.9m     217.9ms
 9:33.0  service   pos( 399.0,   0.0,   1.7) walk      fear 0.59 lamp off      lit  1/ 24/90 entity DORMANT @380.9m     218.0ms
 9:38.0  service   pos( 399.0,   0.0,   1.7) walk      fear 0.59 lamp off      lit  1/ 24/90 entity DORMANT @380.9m     209.3ms

 9:41.0  ── INTERACT: the terminal ──
 9:43.0  service   pos( 399.0,   0.0,   1.7) walk      fear 0.59 lamp off      lit  1/ 24/90 entity DORMANT @380.9m     209.4ms
 9:48.0  service   pos( 399.0,   0.0,   1.7) stil      fear 0.59 lamp off      lit  1/ 23/90 entity DORMANT @380.9m     209.5ms
 9:53.0  service   pos( 399.0,   0.0,   1.7) walk      fear 0.59 lamp off      lit  1/ 24/90 entity DORMANT @380.9m     218.0ms
 9:58.0  service   pos( 399.0,   0.0,   1.7) stil      fear 0.59 lamp off      lit  1/ 24/90 entity DORMANT @380.9m     234.0ms

10:03.0  ── INTERACT: read what is on the desk ──
10:03.0  service   pos( 399.0,   0.0,   1.7) walk      fear 0.59 lamp off      lit  1/ 24/90 entity DORMANT @380.9m     241.9ms
10:08.0  service   pos( 399.0,   0.0,   1.7) walk      fear 0.59 lamp off      lit  1/ 24/90 entity DORMANT @380.9m     241.9ms
10:13.0  service   pos( 399.0,   0.0,   1.7) walk      fear 0.59 lamp off      lit  1/ 24/90 entity DORMANT @380.9m     241.9ms
10:18.0  service   pos( 399.0,   0.0,   1.7) walk      fear 0.59 lamp off      lit  1/ 24/90 entity DORMANT @380.9m     242.0ms
10:23.0  service   pos( 399.0,   0.0,   1.7) walk      fear 0.59 lamp off      lit  1/ 24/90 entity DORMANT @380.9m     216.8ms
```

`lit A/B/C` = lights uploaded to shaders / fixtures above 5% brightness / fixtures resident.

## Entity state transitions

None. The Surveyor never changed state during the session.

## Filmstrip

20 frames, one every ~40 s of play. See `filmstrip.md` for them in order.

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
    "ms": 216.7574999998634,
    "fps": 4.613450514979321,
    "p90": 439.8999999985099,
    "calls": 136,
    "tris": 201236,
    "quality": "low",
    "res": "496x279"
  },
  "lights": {
    "fixtures": 90,
    "lit": 24,
    "active": 1,
    "shadows": 1
  },
  "entity": {
    "entity": "surveyor",
    "state": "DORMANT",
    "stateTime": 603.08,
    "position": [
      777.54,
      -28.08,
      -29.86
    ],
    "heading": 6.185,
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
    "distToPlayer": 380.86,
    "usingGlb": true
  },
  "gameplay": {
    "surveyor": {
      "entity": "surveyor",
      "state": "DORMANT",
      "stateTime": 603.08,
      "position": [
        777.54,
        -28.08,
        -29.86
      ],
      "heading": 6.185,
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
      "distToPlayer": 380.86,
      "usingGlb": true
    },
    "attendant": {
      "entity": "attendant",
      "acts": 12,
      "cooldown": 0,
      "targets": 8,
      "unused": 7,
      "last": [
        "locker"
      ]
    },
    "director": {
      "fear": 0.588,
      "tension": 0,
      "intensity": 0.28,
      "sinceBeat": 85.7,
      "nextBeatAt": 240,
      "grace": 0,
      "zone": "service",
      "objective": "core_cistern",
      "deaths": 0,
      "hidden": true,
      "lastBeats": [
        "distant_door"
      ]
    },
    "progression": {
      "objective": "core_cistern",
      "completed": 1,
      "cores": {
        "found": 0,
        "fitted": 0
      },
      "running": false,
      "ended": null,
      "gates": [
        "arrival_lift",
        "to_plant",
        "to_cistern_pipes",
        "to_residence",
        "exit_lift"
      ],
      "discoveries": [
        "office"
      ]
    },
    "interactor": {
      "focus": null,
      "blocked": false,
      "reason": null,
      "progress": 0,
      "items": 80,
      "doors": 19
    },
    "flashlight": {
      "on": false,
      "battery": 0.405,
      "beam": 0,
      "covered": 0,
      "swapping": false,
      "enabled": true
    },
    "hands": {
      "visible": false,
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
    "voices": 16,
    "oneShots": 4,
    "loops": 12,
    "nodes": 364,
    "occlChecks": 30641,
    "denied": 0,
    "reverb": "service",
    "zone": "service",
    "hums": 8,
    "state": "running",
    "music": {
      "spent": 0,
      "budget": 5,
      "sinceLast": 1000625,
      "cues": []
    },
    "pressure": 0
  }
}
```
