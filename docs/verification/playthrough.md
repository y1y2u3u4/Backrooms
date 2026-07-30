# THE ANNEX — continuous playthrough

Generated 2026-07-30T10:19:34.862Z by `tools/qa/playthrough.mjs`.

**35700 frames · 595.0 s of simulated play at a fixed 1/60 step · 901 s of wall clock · quality `low` · 800×450**

This is the first continuous session ever run on this build. Movement, sprint, crouch, the
lamp key and the interact key are real DOM keyboard events; mouse look is written into the
field a locked pointer would write, because headless Chromium cannot grant pointer lock.
Frame times come from a CPU rasteriser and are not a frame-rate verdict.

## Assertions

| | check | detail |
|---|---|---|
| **PASS** | no console errors during the session |  |
| **PASS** | player position never NaN | 0 frames |
| **PASS** | player never falls through the floor | y -6.00..2.60; frames not standing on a floor: 0 of 35700 (worst consecutive run 0) |
| **FAIL** | the frame loop never stalls (no frame > 5 s) | max 10690 ms, p99 8 ms, p50 0.30 ms |
| **PASS** | post-warmup frame times stay bounded (p99 < 250 ms) | warm p50 0.30 ms, p90 0.60 ms, p99 7.50 ms |
| **PASS** | simulated time advanced continuously | 35700 frames |
| **FAIL** | at least one entity state transition occurred | the Surveyor never changed state |
| **PASS** | audio subsystem reports as constructed | subsystems.audio=true, ctx state=running |
| **PASS** | footsteps fired while walking | 110 player:step events |
| **FAIL** | every zone visited reported lit fixtures | min active lights = 0 |

**3 check(s) failed.**

## Pacing

- **Session length:** 595.0 s (9.9 min) of play.
- **Zero-threat time:** 19.3% of samples had no active entity and fear below 0.15.
- **The Surveyor was active at some point.**
- **Threat episodes:** 0 (none)
- **Fear:** median 0.294, p90 0.563, peak 0.563. Above 0.3 for 39.3% of the session, above 0.5 for 10.7%.
- **Director beats fired:** 1 — distant_door at 1:47.9
- **Longest stretch with nothing on the bus except footsteps:** 595.0 s (0:00.0 → 9:55.0).
- **Moving:** 11% of samples.
- **Zones:** intake (0:00.5–4:51.0) → service (4:52.5–6:12.0) → cistern (6:13.5–7:43.5) → plant (7:45.0–9:13.0) → safe (9:14.5–9:55.0)

### Frame time (CPU rasteriser — not a frame-rate verdict)

| | p50 | p90 | p99 | max |
|---|---:|---:|---:|---:|
| whole session | 0.30 | 0.60 | 7.60 | 10690 |
| after 3 s warmup | 0.30 | 0.60 | 7.50 | 10690 |

All in milliseconds. The multi-second outliers are first-frame shader compiles
after a camera or zone change, which is a property of SwiftShader, not of the renderer.

## Event census

| event | count |
|---|---:|
| `entity:tick` | 335 |
| `player:noise` | 119 |
| `player:step` | 110 |
| `qa:phase` | 41 |
| `lamp:toggle` | 5 |
| `interact:use` | 5 |
| `qa:scripted-reposition` | 5 |
| `zone:build` | 4 |
| `zone:leave` | 4 |
| `world:teleport` | 4 |
| `zone:enter` | 4 |
| `qa:scripted-zone-change` | 4 |
| `light:circuit` | 3 |
| `sfx:breaker` | 3 |
| `zone:unload` | 2 |
| `director:entity-placed` | 1 |
| `director:beat` | 1 |
| `sfx:distant` | 1 |
| `world:noise` | 1 |
| `hide:enter` | 1 |
| `portal:gate` | 1 |
| `ui:refuse` | 1 |
| `lift:power` | 1 |
| `progress:complete` | 1 |
| `progress:objective` | 1 |
| `progress:discovery` | 1 |
| `item:pickup` | 1 |
| `story:tape` | 1 |
| `pickup:taken` | 1 |

## Timeline

State every 5 s; every non-footstep event at the moment it fired. Footsteps and noise
events are counted in the census above rather than listed, because there are hundreds.

```

 0:00.0  ── arrival — standing still, taking the room in ──
 0:00.5  intake    pos( -24.0,   0.0,  24.8) stil      fear 0.00 lamp on 0.99 lit  6/142/201 entity not spawned        5819.9ms
 0:05.5  intake    pos( -24.0,   0.0,  24.8) stil      fear 0.00 lamp on 0.98 lit  6/142/201 entity not spawned        2663.4ms

 0:08.0  ── first walk, no lamp ──
 0:10.5  intake    pos( -21.0,   0.0,  23.1) walk      fear 0.03 lamp on 0.97 lit  6/142/201 entity not spawned        2287.7ms
 0:15.5  intake    pos( -10.3,   0.0,  23.2) walk      fear 0.03 lamp on 0.96 lit  6/142/201 entity not spawned        1661.3ms
 0:19.9      * director:entity-placed   
 0:19.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:20.5  intake    pos(  -0.3,   0.0,  22.2) walk      fear 0.03 lamp on 0.95 lit  6/142/201 entity DORMANT @25.1m     1340.3ms
 0:21.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:23.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:23.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:25.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:25.5  intake    pos(   3.9,   0.0,  21.0) walk      fear 0.03 lamp on 0.93 lit  6/142/201 entity DORMANT @21.0m     1130.3ms
 0:26.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:28.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:29.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:30.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:30.5  intake    pos(   1.7,   0.0,  17.1) walk      fear 0.03 lamp on 0.92 lit  6/142/201 entity DORMANT @23.9m      975.7ms
 0:31.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)

 0:32.0  ── INTERACT: take the nearest thing off the floor ──
 0:33.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:34.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:35.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:35.5  intake    pos(  -7.6,   0.0,  15.1) walk      fear 0.03 lamp on 0.91 lit  6/142/201 entity DORMANT @33.3m      843.9ms
 0:36.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:38.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:39.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:40.5  intake    pos(  -9.7,   0.0,  15.1) walk      fear 0.02 lamp on 0.90 lit  6/142/201 entity DORMANT @35.4m      754.9ms
 0:40.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:41.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:42.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:43.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:45.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:45.5  intake    pos( -10.9,   0.0,  15.1) walk      fear 0.01 lamp on 0.89 lit  6/141/201 entity DORMANT @36.6m      673.9ms
 0:46.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:47.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:48.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:49.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:50.5  intake    pos( -10.6,   0.0,  15.1) walk      fear 0.01 lamp on 0.88 lit  6/142/201 entity DORMANT @36.3m      616.3ms
 0:51.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:52.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:52.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:53.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:54.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:54.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 0:55.5  intake    pos( -10.1,   0.0,  15.1) walk      fear 0.01 lamp on 0.86 lit  6/142/201 entity DORMANT @35.8m      561.5ms
 0:56.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)

 0:58.0  ── lamp on ──
 0:58.0      * lamp:toggle              
 0:58.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:00.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:00.5  intake    pos( -10.9,   0.0,  15.1) stil      fear 0.01 lamp off      lit  6/142/201 entity DORMANT @36.5m      611.3ms
 1:01.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:03.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:04.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:05.5  intake    pos( -10.9,   0.0,  15.1) stil      fear 0.00 lamp off      lit  6/142/201 entity DORMANT @36.5m      640.4ms
 1:05.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:07.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:07.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:10.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:10.5  intake    pos( -10.9,   0.0,  15.1) stil      fear 0.00 lamp off      lit  6/141/201 entity DORMANT @36.5m      600.2ms
 1:11.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:12.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:13.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:14.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:15.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:15.5  intake    pos( -10.9,   0.0,  15.1) stil      fear 0.00 lamp off      lit  6/142/201 entity DORMANT @36.5m      560.1ms
 1:16.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:17.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:18.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:19.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)

 1:20.0  ── stop and listen (lamp on) ──
 1:20.5  intake    pos( -10.9,   0.0,  15.1) stil      fear 0.00 lamp off      lit  6/142/201 entity DORMANT @36.5m      264.6ms
 1:21.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:22.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:23.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:23.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:25.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:25.5  intake    pos( -10.9,   0.0,  15.1) stil      fear 0.00 lamp off      lit  6/142/201 entity DORMANT @36.5m      248.4ms
 1:27.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:27.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:28.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:29.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:30.5  intake    pos( -10.9,   0.0,  15.1) stil      fear 0.00 lamp off      lit  6/142/201 entity DORMANT @36.5m      158.9ms
 1:30.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:32.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:34.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:35.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:35.5  intake    pos( -10.9,   0.0,  15.1) stil      fear 0.00 lamp off      lit  6/142/201 entity DORMANT @36.5m      158.0ms
 1:36.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:37.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)

 1:38.0  ── INTERACT: get into the locker by the lift ──
 1:38.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:40.5  intake    pos( -14.0,   0.0,  18.3) walk      fear 0.03 lamp off      lit  6/142/201 entity DORMANT @39.1m      170.2ms
 1:40.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:41.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:43.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:44.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:45.5  intake    pos( -22.7,   0.0,  20.6) walk      fear 0.02 lamp off      lit  6/142/201 entity DORMANT @47.6m      162.2ms
 1:45.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:47.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:47.9      * director:beat            zone=intake name=distant_door fear=0.02
 1:47.9      * sfx:distant              kind=door at=(-32.2, 0, 36.2)
 1:48.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:50.5  intake    pos( -28.7,   0.0,  23.4) walk      fear 0.02 lamp off      lit  6/142/201 entity DORMANT @53.5m      162.6ms
 1:50.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:52.6      * hide:enter               id=locker_intake kind=locker at=(-31.1, 0, 29.1)
 1:52.6      * interact:use             id=locker_intake_enter kind=hide
 1:52.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)

 1:53.0  ── crouch-walk — nearly silent ──
 1:54.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:55.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.2m      203.9ms
 1:56.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:56.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:58.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 1:59.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:00.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.2m      204.0ms
 2:01.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:02.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:03.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:05.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:05.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.2m      204.1ms
 2:06.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:06.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:07.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:08.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:09.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:10.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.2m      203.9ms
 2:11.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:12.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:14.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)

 2:15.0  ── sprint — deliberately loud ──
 2:15.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.2m      203.8ms
 2:16.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:17.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:19.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:20.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.2m      131.4ms
 2:21.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:22.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:23.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:24.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:25.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.2m       65.6ms
 2:26.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:26.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:28.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:29.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:30.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:30.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.2m       73.9ms
 2:32.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)

 2:33.0  ── walk on, lamp off (the entity only moves in light) ──
 2:33.0      * lamp:toggle              
 2:33.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:35.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:35.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.85 lit  6/142/201 entity DORMANT @56.2m       81.3ms
 2:37.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:37.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:39.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:40.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.84 lit  6/142/201 entity DORMANT @56.2m      102.0ms
 2:41.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:42.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:44.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:45.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.83 lit  6/142/201 entity DORMANT @56.2m       99.3ms
 2:45.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:46.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:48.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:50.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:50.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.81 lit  6/142/201 entity DORMANT @56.2m       99.8ms
 2:52.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:53.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:54.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:55.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.80 lit  6/142/201 entity DORMANT @56.2m      100.2ms
 2:56.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:56.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 2:58.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)

 2:59.0  ── stand in the dark and wait ──
 2:59.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:00.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.79 lit  6/142/201 entity DORMANT @56.2m       87.8ms
 3:00.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:01.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:03.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:04.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:05.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:05.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.78 lit  6/142/201 entity DORMANT @56.2m       83.9ms
 3:06.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:08.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:10.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:10.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.77 lit  6/142/201 entity DORMANT @56.2m      107.5ms
 3:11.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:12.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:14.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:15.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.76 lit  6/142/201 entity DORMANT @56.2m       72.5ms
 3:15.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:17.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:18.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:19.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:20.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.74 lit  6/141/201 entity DORMANT @56.2m      103.2ms
 3:21.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:23.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:24.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)

 3:25.0  ── SCRIPTED: spawn the Surveyor 26 m away, dormant ──

 3:25.0  ── sprint past it — loud enough to be heard ──
 3:25.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.73 lit  6/142/201 entity DORMANT @56.2m      103.4ms
 3:25.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:27.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:29.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:30.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.72 lit  6/142/201 entity DORMANT @56.2m      103.5ms
 3:30.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:32.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:33.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:35.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:35.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.71 lit  6/142/201 entity DORMANT @56.2m      103.8ms
 3:37.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:38.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:39.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:40.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.70 lit  6/142/201 entity DORMANT @56.2m      103.8ms
 3:41.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:42.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:43.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:45.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.68 lit  6/142/201 entity DORMANT @56.2m      103.8ms
 3:45.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:46.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)

 3:47.0  ── lamp on and keep moving (it only advances in light) ──
 3:47.0      * lamp:toggle              
 3:47.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:49.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:50.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.2m      112.1ms
 3:50.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:51.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:54.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:55.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.2m      111.8ms
 3:55.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:57.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:58.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 3:59.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:00.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.2m      105.8ms
 4:00.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:02.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:03.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:04.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:05.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.2m      105.4ms
 4:06.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:07.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:09.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:10.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.2m      105.2ms
 4:11.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:13.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:14.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:14.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:15.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/142/201 entity DORMANT @56.2m      105.5ms
 4:16.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)

 4:17.0  ── stop, lamp off, stay still — does it lose you? ──
 4:17.0      * lamp:toggle              
 4:17.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:18.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:20.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.67 lit  6/142/201 entity DORMANT @56.2m      105.4ms
 4:20.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:22.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:23.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:25.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:25.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.66 lit  6/142/201 entity DORMANT @56.2m      105.3ms
 4:26.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:27.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:28.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:30.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:30.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.65 lit  6/142/201 entity DORMANT @56.2m       96.1ms
 4:31.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:33.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:33.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:35.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:35.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.64 lit  6/142/201 entity DORMANT @56.2m       99.0ms
 4:37.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:38.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:39.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:40.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.63 lit  6/142/201 entity DORMANT @56.2m       99.9ms
 4:40.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:41.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:42.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:43.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:44.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:45.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.61 lit  6/142/201 entity DORMANT @56.2m       99.6ms
 4:46.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:48.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:49.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:49.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:50.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp on 0.60 lit  6/142/201 entity DORMANT @56.2m       99.5ms
 4:50.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:51.0      * zone:build               zone=service
 4:51.0      * zone:leave               zone=intake
 4:51.0      * world:teleport           zone=service at=(370.4, 0, 0)
 4:51.0      * zone:enter               zone=service from=intake
 4:51.0      * qa:scripted-zone-change  zone=service

 4:51.0  ── zone settle ──
 4:51.9      * zone:build               zone=cistern
 4:52.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)

 4:52.5  ── service spine — first walk ──
 4:54.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:55.5  service   pos( 370.4,   0.0,   0.0) stil      fear 0.29 lamp on 0.59 lit  6/209/286 entity DORMANT @346.4m     129.4ms
 4:55.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:56.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:57.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:57.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 4:60.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:00.5  service   pos( 370.4,   0.0,   0.0) stil      fear 0.29 lamp on 0.58 lit  6/209/286 entity DORMANT @346.4m     129.6ms
 5:01.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:03.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:04.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:05.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:05.5  service   pos( 370.4,   0.0,   0.0) stil      fear 0.29 lamp on 0.56 lit  6/209/286 entity DORMANT @346.4m     129.9ms
 5:07.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:07.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:09.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:10.5  service   pos( 370.4,   0.0,   0.0) stil      fear 0.29 lamp on 0.55 lit  6/209/286 entity DORMANT @346.4m     113.5ms
 5:11.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:12.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:13.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:15.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:15.5  service   pos( 370.4,   0.0,   0.0) stil      fear 0.29 lamp on 0.54 lit  6/208/286 entity DORMANT @346.4m     106.5ms
 5:16.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:17.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:18.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:19.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:20.5      * qa:scripted-reposition   at=(412.6, 0, -2.2) zone=service

 5:20.5  ── reposition settle ──
 5:20.5  service   pos( 370.4,   0.0,   0.0) stil      fear 0.29 lamp on 0.53 lit  6/209/286 entity DORMANT @346.4m      95.0ms
 5:21.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)

 5:22.5  ── walk into the switchroom ──
 5:23.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:24.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:24.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:25.5  service   pos( 412.6,   0.0,  -2.2) stil      fear 0.29 lamp on 0.52 lit  6/209/286 entity DORMANT @388.7m      95.1ms
 5:26.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:28.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:29.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:30.5  service   pos( 412.6,   0.0,  -2.2) stil      fear 0.29 lamp on 0.51 lit  6/209/286 entity DORMANT @388.7m      95.2ms
 5:31.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:32.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:33.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:34.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)

 5:34.5  ── INTERACT: read the board schedule off the floor ──
 5:34.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:35.5  service   pos( 412.6,   0.0,  -2.2) stil      fear 0.29 lamp on 0.49 lit  6/209/286 entity DORMANT @388.7m      94.8ms
 5:36.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:38.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:39.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:40.5  service   pos( 412.6,   0.0,  -2.2) stil      fear 0.29 lamp on 0.48 lit  6/209/286 entity DORMANT @388.7m      94.9ms
 5:40.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:41.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:43.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:45.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:45.5  service   pos( 412.6,   0.0,  -2.2) stil      fear 0.29 lamp on 0.47 lit  6/209/286 entity DORMANT @388.7m      94.9ms
 5:46.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:48.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:50.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:50.5  service   pos( 412.6,   0.0,  -2.2) stil      fear 0.29 lamp on 0.46 lit  6/208/286 entity DORMANT @388.7m      80.0ms
 5:51.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:52.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:53.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:54.5      * qa:scripted-reposition   at=(414.6, 0, -8.4) zone=service

 5:54.5  ── reposition settle ──
 5:55.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)

 5:56.5  ── INTERACT: reset way 5 — the Stack lift lobby ──
 5:56.5  service   pos( 414.6,   0.0,  -8.4) stil      fear 0.29 lamp on 0.44 lit  6/209/286 entity DORMANT @391.1m      88.5ms
 5:56.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:56.7      * light:circuit            circuit=stack powered=true
 5:56.7      * sfx:breaker              at=(416.1, 1.2, -8.4)
 5:56.7      * interact:use             id=board_c_way5 kind=breaker
 5:56.7      * portal:gate              id=to_stack

 5:57.0  ── INTERACT: trip way 2 — put the Spine out behind you ──
 5:57.1      * light:circuit            circuit=service powered=false
 5:57.1      * sfx:breaker              at=(416.1, 1.2, -8.4)
 5:57.1      * interact:use             id=board_c_way2 kind=breaker

 5:57.5  ── stand in the switchroom and look at what changed ──
 5:58.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 5:59.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:00.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:01.5  service   pos( 414.6,   0.0,  -8.4) stil      fear 0.33 lamp on 0.43 lit  1/146/286 entity DORMANT @391.1m     138.3ms
 6:02.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:03.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:05.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:05.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:06.5  service   pos( 414.6,   0.0,  -8.4) stil      fear 0.33 lamp on 0.42 lit  1/146/286 entity DORMANT @391.1m     148.6ms
 6:06.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:07.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:08.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:10.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)

 6:11.5  ── INTERACT: reset way 2 — the Spine comes back ──
 6:11.5  service   pos( 414.6,   0.0,  -8.4) stil      fear 0.33 lamp on 0.41 lit  1/145/286 entity DORMANT @391.1m     118.4ms
 6:11.6      * light:circuit            circuit=service powered=true
 6:11.6      * sfx:breaker              at=(416.1, 1.2, -8.4)
 6:11.6      * interact:use             id=board_c_way2 kind=breaker
 6:12.0      * zone:leave               zone=service
 6:12.0      * world:teleport           zone=cistern at=(774, 2.6, 0)
 6:12.0      * zone:enter               zone=cistern from=service
 6:12.0      * qa:scripted-zone-change  zone=cistern

 6:12.0  ── zone settle ──
 6:12.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)

 6:13.5  ── cistern — wading ──
 6:13.5      * lamp:toggle              
 6:14.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:15.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:16.5  cistern   pos( 773.1,   2.6,   0.0) stil crch fear 0.47 lamp off      lit  1/209/286 entity DORMANT @748.7m     181.0ms
 6:16.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:19.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:20.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:21.5  cistern   pos( 773.1,   2.6,   0.0) stil crch fear 0.47 lamp off      lit  1/208/286 entity DORMANT @748.7m     180.9ms
 6:21.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:22.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:23.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:24.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:26.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:26.5  cistern   pos( 773.1,   2.6,   0.0) stil crch fear 0.47 lamp off      lit  1/209/286 entity DORMANT @748.7m     180.7ms
 6:27.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:29.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:31.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:31.5  cistern   pos( 773.1,   2.6,   0.0) stil crch fear 0.47 lamp off      lit  1/209/286 entity DORMANT @748.7m     180.7ms
 6:32.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:33.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:34.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:36.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:36.5  cistern   pos( 773.1,   2.6,   0.0) stil crch fear 0.47 lamp off      lit  1/209/286 entity DORMANT @748.7m     180.6ms
 6:37.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:38.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:39.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:39.5      * qa:scripted-reposition   at=(815.4, 1.6, 3.2) zone=cistern

 6:39.5  ── reposition settle ──
 6:40.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)

 6:41.5  ── INTERACT: turn penstock 1 (a 1.35 s hold) ──
 6:41.5  cistern   pos( 815.4,   1.6,   3.2) stil      fear 0.56 lamp off      lit  0/209/286 entity DORMANT @790.9m     209.6ms
 6:42.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:43.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:44.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:45.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:46.5  cistern   pos( 815.4,   1.6,   3.2) stil      fear 0.56 lamp off      lit  0/209/286 entity DORMANT @790.9m     212.6ms
 6:47.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:48.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:49.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:50.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:51.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:51.5  cistern   pos( 815.4,   1.6,   3.2) stil      fear 0.56 lamp off      lit  0/208/286 entity DORMANT @790.9m     212.4ms
 6:53.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:53.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:55.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:56.5  cistern   pos( 815.4,   1.6,   3.2) stil      fear 0.56 lamp off      lit  0/209/286 entity DORMANT @790.9m     212.0ms
 6:56.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:57.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 6:59.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:00.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:01.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:01.5  cistern   pos( 815.4,   1.6,   3.2) stil      fear 0.56 lamp off      lit  0/209/286 entity DORMANT @790.9m     211.8ms
 7:02.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:03.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:04.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:06.5  cistern   pos( 815.4,   1.6,   3.2) stil      fear 0.56 lamp off      lit  0/209/286 entity DORMANT @790.9m     211.8ms
 7:06.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)

 7:07.5  ── INTERACT: try penstock 2 — it is padlocked ──
 7:07.6      * ui:refuse                id=penstock_2
 7:07.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:09.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:11.5  cistern   pos( 815.4,   1.6,   3.2) stil      fear 0.56 lamp off      lit  0/209/286 entity DORMANT @790.9m     211.8ms
 7:11.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:13.4      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:15.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:16.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:16.5  cistern   pos( 815.4,   1.6,   3.2) stil      fear 0.56 lamp off      lit  0/209/286 entity DORMANT @790.9m     194.0ms
 7:17.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:19.3      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:20.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:21.5  cistern   pos( 815.4,   1.6,   3.2) stil      fear 0.56 lamp off      lit  0/209/286 entity DORMANT @790.9m     112.5ms
 7:22.5      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:23.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:24.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:25.6      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:26.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:26.5  cistern   pos( 815.4,   1.6,   3.2) stil      fear 0.56 lamp off      lit  0/209/286 entity DORMANT @790.9m     102.0ms
 7:27.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)

 7:27.5  ── cistern — stand still in the water ──
 7:29.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:30.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:30.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:31.5  cistern   pos( 815.4,   1.6,   3.2) stil      fear 0.56 lamp off      lit  0/209/286 entity DORMANT @790.9m     102.0ms
 7:31.8      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:33.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:34.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:36.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:36.5  cistern   pos( 815.4,   1.6,   3.2) stil      fear 0.56 lamp off      lit  0/209/286 entity DORMANT @790.9m      39.2ms
 7:37.2      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:39.0      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:40.7      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:41.5  cistern   pos( 815.4,   1.6,   3.2) stil      fear 0.56 lamp off      lit  0/209/286 entity DORMANT @790.9m      39.0ms
 7:42.1      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:42.9      * entity:tick              entity=surveyor at=(24.8, 0, 23.2)
 7:43.5      * zone:build               zone=plant
 7:43.5      * lift:power               id=lift_2
 7:43.5      * zone:unload              zone=intake
 7:43.5      * zone:leave               zone=cistern
 7:43.5      * world:teleport           zone=plant at=(384.8, 0.7, 400)
 7:43.5      * zone:enter               zone=plant from=cistern
 7:43.5      * progress:complete        id=reach_plant title=Find the Plant
 7:43.5      * progress:objective       title=Supply core — the Cistern objective=core_cistern
 7:43.5      * qa:scripted-zone-change  zone=plant

 7:43.5  ── zone settle ──

 7:45.0  ── the generator hall — the landmark frame ──
 7:46.5  plant     pos( 384.8,   0.7, 400.0) stil      fear 0.38 lamp off      lit  6/ 85/105 entity DORMANT @521.2m      77.6ms
 7:51.5  plant     pos( 384.8,   0.7, 400.0) stil      fear 0.32 lamp off      lit  6/ 85/105 entity DORMANT @521.2m      77.7ms
 7:56.5  plant     pos( 384.8,   0.7, 400.0) stil      fear 0.31 lamp off      lit  6/ 85/105 entity DORMANT @521.2m      77.6ms
 8:01.5  plant     pos( 384.8,   0.7, 400.0) stil      fear 0.31 lamp off      lit  6/ 85/105 entity DORMANT @521.2m      45.4ms
 8:05.0      * qa:scripted-reposition   at=(402.6, -5.7, 398) zone=plant

 8:05.0  ── reposition settle ──

 8:07.0  ── INTERACT: try the fuel valve with no cores fitted ──
 8:07.0  plant     pos( 402.6,  -5.7, 398.0) stil      fear 0.31 lamp off      lit  5/ 85/105 entity DORMANT @532.3m     118.1ms
 8:12.0  plant     pos( 402.6,  -5.7, 398.0) stil      fear 0.31 lamp off      lit  5/ 85/105 entity DORMANT @532.3m     121.8ms
 8:17.0  plant     pos( 402.6,  -5.7, 398.0) stil      fear 0.31 lamp off      lit  5/ 85/105 entity DORMANT @532.3m     122.0ms
 8:22.0  plant     pos( 402.6,  -5.7, 398.0) stil      fear 0.31 lamp off      lit  5/ 85/105 entity DORMANT @532.3m     122.3ms
 8:27.0  plant     pos( 402.6,  -5.7, 398.0) stil      fear 0.31 lamp off      lit  5/ 85/105 entity DORMANT @532.3m     122.2ms

 8:29.0  ── INTERACT: try a socket with nothing in your hands ──
 8:32.0  plant     pos( 402.6,  -5.7, 398.0) stil      fear 0.31 lamp off      lit  5/ 85/105 entity DORMANT @532.3m     122.3ms
 8:37.0  plant     pos( 402.6,  -5.7, 398.0) stil      fear 0.31 lamp off      lit  5/ 85/105 entity DORMANT @532.3m     224.7ms
 8:42.0  plant     pos( 402.6,  -5.7, 398.0) stil      fear 0.31 lamp off      lit  5/ 85/105 entity DORMANT @532.3m     290.3ms
 8:47.0  plant     pos( 402.6,  -5.7, 398.0) stil      fear 0.31 lamp off      lit  5/ 85/105 entity DORMANT @532.3m     290.4ms
 8:49.0      * qa:scripted-reposition   at=(414, -6, 400) zone=plant

 8:49.0  ── reposition settle ──

 8:51.0  ── INTERACT: call the goods lift — it has no supply ──
 8:52.0  plant     pos( 414.0,  -6.0, 400.0) stil      fear 0.31 lamp off      lit  6/ 85/105 entity DORMANT @541.8m     290.5ms
 8:57.0  plant     pos( 414.0,  -6.0, 400.0) stil      fear 0.31 lamp off      lit  6/ 85/105 entity DORMANT @541.8m     290.6ms
 9:02.0  plant     pos( 414.0,  -6.0, 400.0) stil      fear 0.31 lamp off      lit  6/ 85/105 entity DORMANT @541.8m     290.6ms
 9:07.0  plant     pos( 414.0,  -6.0, 400.0) stil      fear 0.31 lamp off      lit  6/ 85/105 entity DORMANT @541.8m     252.0ms
 9:12.0  plant     pos( 414.0,  -6.0, 400.0) stil      fear 0.31 lamp off      lit  6/ 85/105 entity DORMANT @541.8m     252.1ms
 9:13.0      * zone:build               zone=safe
 9:13.0      * zone:unload              zone=service
 9:13.0      * zone:leave               zone=plant
 9:13.0      * world:teleport           zone=safe at=(400.6, 0, 799)
 9:13.0      * zone:enter               zone=safe from=plant
 9:13.0      * progress:discovery       id=office title=The Office of Record
 9:13.0      * qa:scripted-zone-change  zone=safe

 9:13.0  ── zone settle ──

 9:14.5  ── the safe room ──
 9:17.0  safe      pos( 400.6,   0.0, 799.0) stil      fear 0.31 lamp off      lit  5/ 24/42 entity DORMANT @862.1m     307.1ms
 9:22.0  safe      pos( 400.6,   0.0, 799.0) stil      fear 0.31 lamp off      lit  5/ 24/42 entity DORMANT @862.1m     306.9ms
 9:27.0  safe      pos( 400.6,   0.0, 799.0) stil      fear 0.31 lamp off      lit  5/ 24/42 entity DORMANT @862.1m     230.9ms
 9:32.0  safe      pos( 400.6,   0.0, 799.0) stil      fear 0.31 lamp off      lit  5/ 24/42 entity DORMANT @862.1m     227.1ms

 9:32.5  ── INTERACT: the terminal ──
 9:37.0  safe      pos( 400.6,   0.0, 799.0) stil      fear 0.31 lamp off      lit  5/ 24/42 entity DORMANT @862.1m     229.0ms
 9:42.0  safe      pos( 400.6,   0.0, 799.0) stil      fear 0.31 lamp off      lit  5/ 24/42 entity DORMANT @862.1m     228.7ms
 9:47.0  safe      pos( 400.6,   0.0, 799.0) stil      fear 0.31 lamp off      lit  5/ 24/42 entity DORMANT @862.1m     228.7ms
 9:52.0  safe      pos( 400.6,   0.0, 799.0) stil      fear 0.31 lamp off      lit  5/ 24/42 entity DORMANT @862.1m     228.5ms

 9:54.5  ── INTERACT: read what is on the desk ──
 9:54.7      * item:pickup              name=Cassette id=cassette kind=tape
 9:54.7      * story:tape               id=tape_kearns_1 title=Tape 2 — "For the record" (Kearns)
 9:54.7      * pickup:taken             id=cassette_4022_7989 item=cassette at=(402.1, 0.7, 798.9)
 9:54.7      * interact:use             id=cassette_4022_7989 kind=pickup
```

`lit A/B/C` = lights uploaded to shaders / fixtures above 5% brightness / fixtures resident.

## Entity state transitions

None. The Surveyor never changed state during the session.

## Filmstrip

19 frames, one every ~40 s of play. See `filmstrip.md` for them in order.

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
    "ms": 224.79083333313466,
    "fps": 4.448579976204029,
    "p90": 14.799999997019768,
    "calls": 61,
    "tris": 35560,
    "quality": "low",
    "res": "496x279"
  },
  "lights": {
    "fixtures": 42,
    "lit": 24,
    "active": 5,
    "shadows": 1
  },
  "entity": {
    "entity": "surveyor",
    "state": "DORMANT",
    "stateTime": 575.1,
    "position": [
      24.76,
      0,
      23.16
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
    "distToPlayer": 862.08,
    "usingGlb": true
  },
  "gameplay": {
    "surveyor": {
      "entity": "surveyor",
      "state": "DORMANT",
      "stateTime": 575.1,
      "position": [
        24.76,
        0,
        23.16
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
      "distToPlayer": 862.08,
      "usingGlb": true
    },
    "attendant": {
      "entity": "attendant",
      "acts": 0,
      "cooldown": 0,
      "targets": 8,
      "unused": 8,
      "last": []
    },
    "director": {
      "fear": 0.308,
      "tension": 0,
      "intensity": 0.28,
      "sinceBeat": 75.2,
      "nextBeatAt": 220.2,
      "grace": 0,
      "zone": "safe",
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
      "items": 79,
      "doors": 19
    },
    "flashlight": {
      "on": false,
      "battery": 0.403,
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
        "lamp": 1,
        "cassette": 1
      },
      "selected": "lamp"
    }
  },
  "audio": {
    "voices": 5,
    "oneShots": 1,
    "loops": 4,
    "nodes": 102,
    "occlChecks": 31224,
    "denied": 0,
    "reverb": "safe",
    "zone": "safe",
    "hums": 0,
    "state": "running",
    "music": {
      "spent": 0,
      "budget": 5,
      "sinceLast": 1000597,
      "cues": []
    },
    "pressure": 0
  }
}
```
