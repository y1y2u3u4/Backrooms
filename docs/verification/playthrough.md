# THE ANNEX — continuous playthrough

Generated 2026-07-30T07:20:54.508Z by `tools/qa/playthrough.mjs`.

**26850 frames · 447.5 s of simulated play at a fixed 1/60 step · 568 s of wall clock · quality `low` · 640×360**

This is the first continuous session ever run on this build. Movement, sprint, crouch, the
lamp key and the interact key are real DOM keyboard events; mouse look is written into the
field a locked pointer would write, because headless Chromium cannot grant pointer lock.
Frame times come from a CPU rasteriser and are not a frame-rate verdict.

## Assertions

| | check | detail |
|---|---|---|
| **PASS** | no console errors during the session |  |
| **PASS** | player position never NaN | 0 frames |
| **FAIL** | player never falls through the floor | y 0.00..2.60; frames not standing on a floor: 1921 of 26850 (worst consecutive run 1223) |
| **FAIL** | the frame loop never stalls (no frame > 5 s) | max 9575 ms, p99 6 ms, p50 0.20 ms |
| **PASS** | post-warmup frame times stay bounded (p99 < 250 ms) | warm p50 0.20 ms, p90 0.30 ms, p99 5.50 ms |
| **PASS** | simulated time advanced continuously | 26850 frames |
| **FAIL** | at least one entity state transition occurred | the Surveyor never changed state |
| **PASS** | audio subsystem reports as constructed | subsystems.audio=true, ctx state=running |
| **PASS** | footsteps fired while walking | 484 player:step events |
| **FAIL** | every zone visited reported lit fixtures | min active lights = 0 |

**4 check(s) failed.**

## Pacing

- **Session length:** 447.5 s (7.5 min) of play.
- **Zero-threat time:** 95.7% of samples had no active entity and fear below 0.15.
- **The Surveyor was **never active at all**.**
- **Threat episodes:** 0 (none)
- **Fear:** median 0.013, p90 0.068, peak 0.295. Above 0.3 for 0.0% of the session, above 0.5 for 0.0%.
- **Director beats fired:** 2 — distant_door at 1:47.9, distant_door at 5:06.4
- **Longest stretch with nothing on the bus except footsteps:** 447.5 s (0:00.0 → 7:27.5).
- **Moving:** 52% of samples.
- **Zones:** intake (0:00.5–5:13.0) → service (5:14.5–6:04.5) → cistern (6:06.0–7:01.0) → safe (7:02.5–7:27.5)

### Frame time (CPU rasteriser — not a frame-rate verdict)

| | p50 | p90 | p99 | max |
|---|---:|---:|---:|---:|
| whole session | 0.20 | 0.30 | 5.50 | 9575 |
| after 3 s warmup | 0.20 | 0.30 | 5.50 | 9575 |

All in milliseconds. The multi-second outliers are first-frame shader compiles
after a camera or zone change, which is a property of SwiftShader, not of the renderer.

## Event census

| event | count |
|---|---:|
| `player:noise` | 489 |
| `player:step` | 484 |
| `qa:phase` | 21 |
| `lamp:toggle` | 5 |
| `zone:leave` | 3 |
| `world:teleport` | 3 |
| `zone:enter` | 3 |
| `qa:scripted-zone-change` | 3 |
| `director:beat` | 2 |
| `sfx:distant` | 2 |
| `world:noise` | 2 |
| `zone:unload` | 1 |
| `progress:discovery` | 1 |

## Timeline

State every 5 s; every non-footstep event at the moment it fired. Footsteps and noise
events are counted in the census above rather than listed, because there are hundreds.

```

 0:00.0  ── arrival — standing still, taking the room in ──
 0:00.5  intake    pos( -24.0,   0.0,  24.8) stil      fear 0.01 lamp on 0.99 lit  6/142/201 entity not spawned        5618.8ms
 0:05.5  intake    pos( -24.0,   0.0,  24.8) stil      fear 0.00 lamp on 0.98 lit  6/142/201 entity not spawned        2669.7ms

 0:08.0  ── first walk, no lamp ──
 0:10.5  intake    pos( -21.0,   0.0,  23.1) walk      fear 0.03 lamp on 0.97 lit  6/142/201 entity not spawned        2333.2ms
 0:15.5  intake    pos( -10.3,   0.0,  23.2) walk      fear 0.03 lamp on 0.96 lit  6/142/201 entity not spawned        1706.6ms
 0:20.5  intake    pos(   0.1,   0.0,  23.9) walk      fear 0.03 lamp on 0.95 lit  6/142/201 entity not spawned        1345.4ms
 0:25.5  intake    pos(   4.0,   0.0,  23.4) walk      fear 0.03 lamp on 0.93 lit  6/142/201 entity not spawned        1166.5ms
 0:30.5  intake    pos(   8.0,   0.0,  17.7) walk      fear 0.03 lamp on 0.92 lit  6/142/201 entity not spawned         990.1ms
 0:35.5  intake    pos(   0.1,   0.0,  18.7) walk      fear 0.03 lamp on 0.91 lit  6/142/201 entity not spawned         860.3ms

 0:38.0  ── lamp on ──
 0:38.0      * lamp:toggle              
 0:40.5  intake    pos(   3.1,   0.0,  16.9) walk      fear 0.03 lamp off      lit  6/142/201 entity not spawned        1062.0ms
 0:45.5  intake    pos(   0.1,   0.0,  16.3) walk      fear 0.03 lamp off      lit  6/141/201 entity not spawned         980.7ms
 0:50.5  intake    pos( -10.7,   0.0,  16.3) walk      fear 0.03 lamp off      lit  6/142/201 entity not spawned         887.3ms
 0:55.5  intake    pos(  -3.1,   0.0,  17.9) walk      fear 0.03 lamp off      lit  6/142/201 entity not spawned         820.2ms
 1:00.5  intake    pos(   6.3,   0.0,  18.8) walk      fear 0.03 lamp off      lit  6/142/201 entity not spawned         753.7ms

 1:03.0  ── stop and listen (lamp on) ──
 1:05.5  intake    pos(  11.7,   0.0,  17.9) stil      fear 0.01 lamp off      lit  6/142/201 entity not spawned         697.3ms
 1:10.5  intake    pos(  11.7,   0.0,  17.9) stil      fear 0.00 lamp off      lit  6/141/201 entity not spawned         655.2ms
 1:15.5  intake    pos(  11.7,   0.0,  17.9) stil      fear 0.00 lamp off      lit  6/142/201 entity not spawned         612.1ms
 1:20.5  intake    pos(  11.7,   0.0,  17.9) stil      fear 0.00 lamp off      lit  6/142/201 entity not spawned         574.4ms

 1:23.0  ── crouch-walk — nearly silent ──
 1:25.5  intake    pos(   9.6,   0.0,  17.9) walk crch fear 0.01 lamp off      lit  6/142/201 entity not spawned         545.6ms
 1:30.5  intake    pos(   4.7,   0.0,  19.4) walk crch fear 0.01 lamp off      lit  6/142/201 entity not spawned         260.3ms
 1:35.5  intake    pos(   3.3,   0.0,  18.6) walk crch fear 0.01 lamp off      lit  6/142/201 entity not spawned         252.3ms
 1:40.5  intake    pos(   5.0,   0.0,  18.8) walk crch fear 0.01 lamp off      lit  6/142/201 entity not spawned         172.2ms
 1:45.5  intake    pos(  10.0,   0.0,  17.7) walk crch fear 0.01 lamp off      lit  6/142/201 entity not spawned         172.0ms
 1:47.9      * director:beat            zone=intake name=distant_door fear=0.01
 1:47.9      * sfx:distant              kind=door at=(30, 0, -6.4)

 1:48.0  ── sprint — deliberately loud ──
 1:50.5  intake    pos(   9.5,   0.0,  19.6) walk      fear 0.09 lamp off      lit  6/142/201 entity not spawned         172.0ms
 1:55.5  intake    pos(   1.9,   0.0,  20.1) walk      fear 0.07 lamp off      lit  6/142/201 entity not spawned         163.0ms
 2:00.5  intake    pos(  -6.3,   0.0,  17.4) walk      fear 0.05 lamp off      lit  6/142/201 entity not spawned         162.8ms
 2:05.5  intake    pos( -15.1,   0.0,  15.0) walk      fear 0.04 lamp off      lit  6/142/201 entity not spawned         162.7ms

 2:08.0  ── walk on, lamp off (the entity only moves in light) ──
 2:08.0      * lamp:toggle              
 2:10.5  intake    pos( -20.6,   0.0,  10.7) walk      fear 0.04 lamp on 0.90 lit  6/142/201 entity not spawned          20.9ms
 2:15.5  intake    pos( -24.4,   0.0,   7.7) walk      fear 0.03 lamp on 0.89 lit  6/142/201 entity not spawned           4.1ms
 2:20.5  intake    pos( -19.4,   0.0,   3.8) walk      fear 0.03 lamp on 0.88 lit  6/142/201 entity not spawned           4.0ms
 2:25.5  intake    pos(  -8.7,   0.0,   3.7) walk      fear 0.03 lamp on 0.86 lit  6/142/201 entity not spawned           4.0ms
 2:30.5  intake    pos(   0.6,   0.0,  -0.6) walk      fear 0.03 lamp on 0.85 lit  6/142/201 entity not spawned           4.2ms
 2:35.5  intake    pos(   0.8,   0.0,  -7.2) walk      fear 0.03 lamp on 0.84 lit  6/142/201 entity not spawned           4.3ms

 2:38.0  ── stand in the dark and wait ──
 2:40.5  intake    pos(   2.4,   0.0,  -6.7) stil      fear 0.01 lamp on 0.83 lit  6/141/201 entity not spawned           4.3ms
 2:45.5  intake    pos(   2.4,   0.0,  -6.7) stil      fear 0.00 lamp on 0.81 lit  6/142/201 entity not spawned           4.5ms
 2:50.5  intake    pos(   2.4,   0.0,  -6.7) stil      fear 0.00 lamp on 0.80 lit  6/142/201 entity not spawned           4.4ms
 2:55.5  intake    pos(   2.4,   0.0,  -6.7) stil      fear 0.00 lamp on 0.79 lit  6/142/201 entity not spawned           4.6ms
 3:00.5  intake    pos(   2.4,   0.0,  -6.7) stil      fear 0.00 lamp on 0.78 lit  6/142/201 entity not spawned           4.7ms
 3:05.5  intake    pos(   2.4,   0.0,  -6.7) stil      fear 0.00 lamp on 0.77 lit  6/142/201 entity not spawned           4.6ms

 3:08.0  ── SCRIPTED: spawn the Surveyor 26 m away, dormant ──

 3:08.0  ── sprint past it — loud enough to be heard ──
 3:10.5  intake    pos(  -4.0,   0.0,  -4.6) walk      fear 0.08 lamp on 0.76 lit  6/142/201 entity not spawned           4.6ms
 3:15.5  intake    pos(  -4.3,   0.0,  -4.6) walk      fear 0.06 lamp on 0.74 lit  6/142/201 entity not spawned           4.8ms
 3:20.5  intake    pos(   1.0,   0.0,  -4.6) stil      fear 0.04 lamp on 0.73 lit  6/141/201 entity not spawned           5.0ms
 3:25.5  intake    pos(   0.3,   0.0,  -4.6) walk      fear 0.04 lamp on 0.72 lit  6/142/201 entity not spawned           5.2ms
 3:30.5  intake    pos(  -5.5,   0.0,  -4.6) walk      fear 0.04 lamp on 0.71 lit  6/142/201 entity not spawned           5.3ms

 3:33.0  ── lamp on and keep moving (it only advances in light) ──
 3:33.0      * lamp:toggle              
 3:35.5  intake    pos(  -0.1,   0.0,  -8.1) walk      fear 0.04 lamp off      lit  6/142/201 entity not spawned           5.2ms
 3:40.5  intake    pos(   5.3,   0.0,  -5.4) walk      fear 0.03 lamp off      lit  6/142/201 entity not spawned           5.1ms
 3:45.5  intake    pos(   3.9,   0.0,  -7.2) walk      fear 0.03 lamp off      lit  6/142/201 entity not spawned           5.2ms
 3:50.5  intake    pos(  -0.2,   0.0,  -6.5) stil      fear 0.01 lamp off      lit  6/142/201 entity not spawned           5.1ms
 3:55.5  intake    pos(  -0.2,   0.0,  -6.5) stil      fear 0.00 lamp off      lit  6/142/201 entity not spawned           5.0ms
 4:00.5  intake    pos(  -0.2,   0.0,  -6.5) stil      fear 0.00 lamp off      lit  6/142/201 entity not spawned           4.8ms
 4:05.5  intake    pos(  -0.2,   0.0,  -6.5) stil      fear 0.00 lamp off      lit  6/142/201 entity not spawned           4.9ms

 4:08.0  ── stop, lamp off, stay still — does it lose you? ──
 4:08.0      * lamp:toggle              
 4:10.5  intake    pos(  -0.2,   0.0,  -6.5) stil      fear 0.00 lamp on 0.70 lit  6/142/201 entity not spawned           5.0ms
 4:15.5  intake    pos(  -0.2,   0.0,  -6.5) stil      fear 0.00 lamp on 0.68 lit  6/142/201 entity not spawned           4.9ms
 4:20.5  intake    pos(  -0.2,   0.0,  -6.5) stil      fear 0.00 lamp on 0.67 lit  6/142/201 entity not spawned           4.9ms
 4:25.5  intake    pos(  -0.2,   0.0,  -6.5) stil      fear 0.00 lamp on 0.66 lit  6/142/201 entity not spawned           5.0ms
 4:30.5  intake    pos(  -0.2,   0.0,  -6.5) stil      fear 0.00 lamp on 0.65 lit  6/142/201 entity not spawned           4.9ms
 4:35.5  intake    pos(  -0.2,   0.0,  -6.5) stil      fear 0.00 lamp on 0.64 lit  6/142/201 entity not spawned           4.9ms
 4:40.5  intake    pos(  -0.2,   0.0,  -6.5) stil      fear 0.00 lamp on 0.63 lit  6/142/201 entity not spawned           4.8ms
 4:45.5  intake    pos(  -0.2,   0.0,  -6.5) stil      fear 0.00 lamp on 0.61 lit  6/142/201 entity not spawned           4.7ms

 4:48.0  ── walk to the service door ──
 4:50.5  intake    pos(  -0.2,   0.0,  -6.5) stil      fear 0.00 lamp on 0.60 lit  6/142/201 entity not spawned           4.5ms
 4:55.5  intake    pos(  -0.2,   0.0,  -6.5) stil      fear 0.00 lamp on 0.59 lit  6/142/201 entity not spawned           4.4ms
 5:00.5  intake    pos(  -0.2,   0.0,  -6.5) stil      fear 0.00 lamp on 0.58 lit  6/142/201 entity not spawned           4.4ms
 5:05.5  intake    pos(  -0.2,   0.0,  -6.5) stil      fear 0.00 lamp on 0.56 lit  6/142/201 entity not spawned           4.4ms
 5:06.4      * director:beat            zone=intake name=distant_door fear=0
 5:06.4      * sfx:distant              kind=door at=(-12.5, 0, 20.6)
 5:10.5  intake    pos(  -0.2,   0.0,  -6.5) stil      fear 0.00 lamp on 0.55 lit  6/142/201 entity not spawned           4.5ms
 5:13.0      * zone:leave               zone=intake
 5:13.0      * world:teleport           zone=service at=(370.4, 0, 0)
 5:13.0      * zone:enter               zone=service from=intake
 5:13.0      * qa:scripted-zone-change  zone=service

 5:13.0  ── zone settle ──

 5:14.5  ── service spine — first walk ──
 5:15.5  service   pos( 372.4,   0.0,   0.0) walk      fear 0.01 lamp on 0.54 lit  6/223/286 entity not spawned          47.1ms
 5:20.5  service   pos( 382.9,   0.0,   0.1) walk      fear 0.03 lamp on 0.53 lit  6/224/286 entity not spawned          47.5ms
 5:25.5  service   pos( 393.4,   0.0,  -0.3) walk      fear 0.03 lamp on 0.52 lit  6/224/286 entity not spawned          47.6ms
 5:30.5  service   pos( 401.2,   0.0,   1.0) walk      fear 0.02 lamp on 0.51 lit  6/224/286 entity not spawned          48.0ms
 5:35.5  service   pos( 402.6,   0.0,   1.0) walk      fear 0.01 lamp on 0.49 lit  6/224/286 entity not spawned          48.0ms
 5:40.5  service   pos( 402.6,   0.0,   1.0) stil      fear 0.00 lamp on 0.48 lit  6/223/286 entity not spawned          48.0ms
 5:45.5  service   pos( 402.6,   0.0,   1.0) walk      fear 0.00 lamp on 0.47 lit  6/224/286 entity not spawned          48.0ms

 5:49.5  ── service spine — sprint ──
 5:50.5  service   pos( 399.6,   0.0,   1.0) walk      fear 0.05 lamp on 0.46 lit  6/224/286 entity not spawned          48.1ms
 5:55.5  service   pos( 395.4,   0.0,  11.4) walk      fear 0.08 lamp on 0.45 lit  6/224/286 entity not spawned          48.1ms
 6:00.5  service   pos( 395.8,   0.0,  20.2) walk      fear 0.09 lamp on 0.43 lit  3/224/286 entity not spawned         159.9ms
 6:04.5      * zone:leave               zone=service
 6:04.5      * world:teleport           zone=cistern at=(774, 2.6, 0)
 6:04.5      * zone:enter               zone=cistern from=service
 6:04.5      * qa:scripted-zone-change  zone=cistern

 6:04.5  ── zone settle ──

 6:06.0  ── cistern — wading ──
 6:06.0      * lamp:toggle              
 6:06.0  cistern   pos( 773.1,   2.6,   0.0) stil crch fear 0.05 lamp on 0.42 lit  3/224/286 entity not spawned         355.1ms
 6:11.0  cistern   pos( 775.1,   2.6,   0.0) stil crch fear 0.01 lamp off      lit  4/224/286 entity not spawned         456.1ms
 6:16.0  cistern   pos( 775.1,   2.6,   0.0) stil crch fear 0.00 lamp off      lit  4/224/286 entity not spawned         456.1ms
 6:21.0  cistern   pos( 775.1,   2.6,   0.0) stil crch fear 0.00 lamp off      lit  4/224/286 entity not spawned         456.2ms
 6:26.0  cistern   pos( 775.1,   2.6,   0.0) stil crch fear 0.00 lamp off      lit  4/224/286 entity not spawned         456.3ms
 6:31.0  cistern   pos( 775.1,   2.6,   0.0) stil crch fear 0.00 lamp off      lit  4/224/286 entity not spawned         456.3ms
 6:36.0  cistern   pos( 775.1,   2.6,   0.0) stil crch fear 0.00 lamp off      lit  4/224/286 entity not spawned         456.3ms

 6:41.0  ── cistern — stand still in the water ──
 6:41.0  cistern   pos( 775.1,   2.6,   0.0) stil crch fear 0.00 lamp off      lit  4/224/286 entity not spawned         456.2ms
 6:46.0  cistern   pos( 775.1,   2.6,   0.0) stil crch fear 0.00 lamp off      lit  4/224/286 entity not spawned         419.6ms
 6:51.0  cistern   pos( 775.1,   2.6,   0.0) stil crch fear 0.00 lamp off      lit  4/224/286 entity not spawned         421.5ms
 6:56.0  cistern   pos( 775.1,   2.6,   0.0) stil crch fear 0.00 lamp off      lit  4/224/286 entity not spawned         421.3ms
 7:01.0      * zone:unload              zone=intake
 7:01.0      * zone:leave               zone=cistern
 7:01.0      * world:teleport           zone=safe at=(400.6, 0, 799)
 7:01.0      * zone:enter               zone=safe from=cistern
 7:01.0      * progress:discovery       id=office title=The Office of Record
 7:01.0      * qa:scripted-zone-change  zone=safe

 7:01.0  ── zone settle ──
 7:01.0  cistern   pos( 775.1,   2.6,   0.0) stil crch fear 0.00 lamp off      lit  4/224/286 entity not spawned         432.9ms

 7:02.5  ── the safe room ──
 7:06.0  safe      pos( 401.6,   0.0, 798.9) walk      fear 0.03 lamp off      lit  3/ 85/88 entity not spawned         493.6ms
 7:11.0  safe      pos( 405.2,   0.0, 796.5) walk      fear 0.28 lamp off      lit  3/ 85/88 entity not spawned         497.5ms
 7:16.0  safe      pos( 412.6,   0.0, 797.1) walk      fear 0.29 lamp off      lit  1/ 85/88 entity not spawned         497.4ms
 7:21.0  safe      pos( 413.7,   0.0, 795.4) walk      fear 0.29 lamp off      lit  1/ 85/88 entity not spawned         560.6ms
 7:26.0  safe      pos( 414.5,   0.0, 795.1) walk      fear 0.29 lamp off      lit  0/ 85/88 entity not spawned         570.0ms
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
    "ms": 494.1841666668343,
    "fps": 2.0235371091404737,
    "p90": 1522.300000000745,
    "calls": 75,
    "tris": 15868,
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
    "stateTime": 0,
    "position": [
      0,
      0,
      0
    ],
    "heading": 0,
    "target": [
      0,
      0,
      0
    ],
    "confidence": 0,
    "illumination": 0,
    "lightScale": 0,
    "speed": 0,
    "frozen": false,
    "stoop": 0,
    "measureHold": 0,
    "distToPlayer": 899.24,
    "usingGlb": true
  },
  "gameplay": {
    "surveyor": {
      "entity": "surveyor",
      "state": "DORMANT",
      "stateTime": 0,
      "position": [
        0,
        0,
        0
      ],
      "heading": 0,
      "target": [
        0,
        0,
        0
      ],
      "confidence": 0,
      "illumination": 0,
      "lightScale": 0,
      "speed": 0,
      "frozen": false,
      "stoop": 0,
      "measureHold": 0,
      "distToPlayer": 899.24,
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
      "nextBeatAt": 205,
      "grace": 0,
      "zone": "safe",
      "objective": null,
      "deaths": 0,
      "hidden": false,
      "lastBeats": [
        "distant_door",
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
    "voices": 9,
    "oneShots": 5,
    "loops": 4,
    "nodes": 157,
    "occlChecks": 23386,
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
