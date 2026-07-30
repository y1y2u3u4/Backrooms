# THE ANNEX — continuous playthrough

Generated 2026-07-30T06:42:47.194Z by `tools/qa/playthrough.mjs`.

**6000 frames · 100.0 s of simulated play at a fixed 1/60 step · 5337 s of wall clock · quality `low` · 640×360**

This is the first continuous session ever run on this build. Movement, sprint, crouch, the
lamp key and the interact key are real DOM keyboard events; mouse look is written into the
field a locked pointer would write, because headless Chromium cannot grant pointer lock.
Frame times come from a CPU rasteriser and are not a frame-rate verdict.

## Assertions

| | check | detail |
|---|---|---|
| **PASS** | no console errors during the session |  |
| **PASS** | player position never NaN | 0 frames |
| **PASS** | player never falls through the floor | y 0.00..0.00; frames not standing on a floor: 0 of 6000 (worst consecutive run 0) |
| **FAIL** | the frame loop never stalls (no frame > 5 s) | max 50104 ms, p99 17551 ms, p50 5.20 ms |
| **FAIL** | post-warmup frame times stay bounded (p99 < 250 ms) | warm p50 5.20 ms, p90 25.70 ms, p99 17721.30 ms |
| **PASS** | simulated time advanced continuously | 6000 frames |
| **FAIL** | at least one entity state transition occurred | the Surveyor never changed state |
| **PASS** | audio subsystem reports as constructed | subsystems.audio=true, ctx state=running |
| **PASS** | footsteps fired while walking | 135 player:step events |
| **PASS** | every zone visited reported lit fixtures | min active lights = 6 |

**3 check(s) failed.**

## Pacing

- **Session length:** 100.0 s (1.7 min) of play.
- **Zero-threat time:** 100.0% of samples had no active entity and fear below 0.15.
- **The Surveyor was **never active at all**.**
- **Threat episodes:** 0 (none)
- **Fear:** median 0.023, p90 0.027, peak 0.027. Above 0.3 for 0.0% of the session, above 0.5 for 0.0%.
- **Director beats fired:** 0 (none — the quiet floor is 95 s and `nextBeatAt` starts at 150 s)
- **Longest stretch with nothing on the bus except footsteps:** 100.0 s (0:00.0 → 1:40.0).
- **Moving:** 67% of samples.
- **Zones:** intake (0:00.5–1:40.0)

### Frame time (CPU rasteriser — not a frame-rate verdict)

| | p50 | p90 | p99 | max |
|---|---:|---:|---:|---:|
| whole session | 5.20 | 25.20 | 17550.80 | 50104 |
| after 3 s warmup | 5.20 | 25.70 | 17721.30 | 50104 |

All in milliseconds. The multi-second outliers are first-frame shader compiles
after a camera or zone change, which is a property of SwiftShader, not of the renderer.

## Event census

| event | count |
|---|---:|
| `player:noise` | 136 |
| `player:step` | 135 |
| `qa:phase` | 5 |
| `lamp:toggle` | 1 |

## Timeline

State every 5 s; every non-footstep event at the moment it fired. Footsteps and noise
events are counted in the census above rather than listed, because there are hundreds.

```

 0:00.0  ── arrival — standing still, taking the room in ──
 0:00.5  intake    pos( -24.0,   0.0,  24.8) stil      fear 0.00 lamp on 0.99 lit  6/142/201 entity not spawned           9.2ms
 0:05.5  intake    pos( -24.0,   0.0,  24.8) stil      fear 0.00 lamp on 0.98 lit  6/142/201 entity not spawned           3.8ms

 0:08.0  ── first walk, no lamp ──
 0:10.5  intake    pos( -21.0,   0.0,  23.1) walk      fear 0.03 lamp on 0.97 lit  6/142/201 entity not spawned         600.7ms
 0:15.5  intake    pos( -10.3,   0.0,  23.2) walk      fear 0.03 lamp on 0.96 lit  6/142/201 entity not spawned        1113.6ms
 0:20.5  intake    pos(  -0.6,   0.0,  21.8) walk      fear 0.03 lamp on 0.95 lit  6/142/201 entity not spawned           6.1ms
 0:25.5  intake    pos(  -5.8,   0.0,  18.7) walk      fear 0.03 lamp on 0.93 lit  6/142/201 entity not spawned        1102.7ms
 0:30.5  intake    pos( -10.3,   0.0,  15.1) walk      fear 0.03 lamp on 0.92 lit  6/142/201 entity not spawned         858.0ms
 0:35.5  intake    pos(  -5.1,   0.0,  16.1) walk      fear 0.02 lamp on 0.91 lit  6/142/201 entity not spawned           7.4ms

 0:38.0  ── lamp on ──
 0:38.0      * lamp:toggle              
 0:40.5  intake    pos( -13.7,   0.0,  15.1) walk      fear 0.02 lamp off      lit  6/142/201 entity not spawned         499.2ms
 0:45.5  intake    pos( -19.1,   0.0,  11.1) walk      fear 0.03 lamp off      lit  6/141/201 entity not spawned        1114.1ms
 0:50.5  intake    pos( -24.1,   0.0,   9.3) walk      fear 0.03 lamp off      lit  6/142/201 entity not spawned           7.4ms
 0:55.5  intake    pos( -23.4,   0.0,   9.0) walk      fear 0.03 lamp off      lit  6/142/201 entity not spawned         847.7ms
 1:00.5  intake    pos( -13.0,   0.0,  10.1) walk      fear 0.03 lamp off      lit  6/142/201 entity not spawned         864.3ms

 1:03.0  ── stop and listen (lamp on) ──
 1:05.5  intake    pos(  -7.6,   0.0,  10.1) stil      fear 0.01 lamp off      lit  6/142/201 entity not spawned           3.9ms
 1:10.5  intake    pos(  -7.6,   0.0,  10.1) stil      fear 0.00 lamp off      lit  6/141/201 entity not spawned        1351.9ms
 1:15.5  intake    pos(  -7.6,   0.0,  10.1) stil      fear 0.00 lamp off      lit  6/142/201 entity not spawned        1051.8ms
 1:20.5  intake    pos(  -7.6,   0.0,  10.1) stil      fear 0.00 lamp off      lit  6/142/201 entity not spawned           2.7ms

 1:23.0  ── crouch-walk — nearly silent ──
 1:25.5  intake    pos(  -7.2,   0.0,   8.8) walk crch fear 0.01 lamp off      lit  6/142/201 entity not spawned         997.4ms
 1:30.5  intake    pos(  -7.0,   0.0,   8.8) stil crch fear 0.00 lamp off      lit  6/142/201 entity not spawned        1199.0ms
 1:35.5  intake    pos(  -8.8,   0.0,   8.8) walk crch fear 0.01 lamp off      lit  6/142/201 entity not spawned           2.2ms
```

`lit A/B/C` = lights uploaded to shaders / fixtures above 5% brightness / fixtures resident.

## Entity state transitions

None. The Surveyor never changed state during the session.

## Filmstrip

7 frames, one every ~15 s of play. See `filmstrip.md` for them in order.

## Subsystems at the end of the session

```json
{
  "state": "play",
  "zone": "intake",
  "subsystems": {
    "world": true,
    "audio": true,
    "gameplay": true,
    "ui": true,
    "cinematics": true
  },
  "engine": {
    "ms": 565.2299999998883,
    "fps": 1.7691913026559059,
    "p90": 3301.60000000149,
    "calls": 143,
    "tris": 290602,
    "quality": "low",
    "res": "397x223"
  },
  "lights": {
    "fixtures": 201,
    "lit": 142,
    "active": 6,
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
    "distToPlayer": 16.24,
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
      "distToPlayer": 16.24,
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
      "fear": 0.014,
      "tension": 0,
      "intensity": 0.15,
      "sinceBeat": 142.1,
      "nextBeatAt": 150,
      "grace": 0,
      "zone": "intake",
      "objective": null,
      "deaths": 0,
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
      "discoveries": []
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
      "battery": 0.905,
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
    "voices": 12,
    "oneShots": 0,
    "loops": 12,
    "nodes": 295,
    "occlChecks": 5044,
    "denied": 0,
    "reverb": "corridor",
    "zone": "intake",
    "hums": 8,
    "state": "running",
    "music": {
      "spent": 0,
      "budget": 5,
      "sinceLast": 1000102,
      "cues": []
    },
    "pressure": 0
  }
}
```
