# THE ANNEX — continuous playthrough

Generated 2026-07-30T10:44:22.784Z by `tools/qa/playthrough.mjs`.

**32760 frames · 546.0 s of simulated play at a fixed 1/60 step · 957 s of wall clock · quality `low` · 800×450**

This is the first continuous session ever run on this build. Movement, sprint, crouch, the
lamp key and the interact key are real DOM keyboard events; mouse look is written into the
field a locked pointer would write, because headless Chromium cannot grant pointer lock.
Frame times come from a CPU rasteriser and are not a frame-rate verdict.

## Assertions

| | check | detail |
|---|---|---|
| **PASS** | no console errors during the session |  |
| **PASS** | player position never NaN | 0 frames |
| **PASS** | player never falls through the floor | y -6.00..2.60; frames not standing on a floor: 0 of 32760 (worst consecutive run 0) |
| **FAIL** | the frame loop never stalls (no frame > 5 s) | max 11606 ms, p99 10 ms, p50 0.30 ms |
| **PASS** | post-warmup frame times stay bounded (p99 < 250 ms) | warm p50 0.30 ms, p90 0.60 ms, p99 9.60 ms |
| **PASS** | simulated time advanced continuously | 32760 frames |
| **PASS** | at least one entity state transition occurred | DORMANT->ROUSED@154.63s, ROUSED->SEEKING@158.13s, SEEKING->MEASURING@168s, MEASURING->SEEKING@174.02s, SEEKING->APPROACHING@174.85s, APPROACHING->CAPTURING@196.28s, CAPTURING->DORMANT@201.85s |
| **PASS** | audio subsystem reports as constructed | subsystems.audio=true, ctx state=running |
| **PASS** | footsteps fired while walking | 419 player:step events |
| **PASS** | every zone visited reported lit fixtures | min active lights = 1 |
| **PASS** | the session did not get stuck inside a hiding place | 25 of 1069 samples were spent hidden |
| **PASS** | at least one interactable was operated | locker_intake_enter:pressed; locker_intake_enter:pressed; note_4107_-31:pressed; board_c_way5:pressed; board_c_way2:pressed; board_c_way2:pressed; penstock_1:completed a hold; set_2_socket0:refused: You are not carrying a core.; set_2_socket0:refused: You are not carrying a core.; set_2_socket0:refused: You are not carrying a core.; lift_2_call:refused: Dead. Three-phase is out.; lift_2_call:refused: Dead. Three-phase is out.; lift_2_call:refused: Dead. Three-phase is out. |
| **PASS** | the player was able to move for most of the session | 97% of samples had controls enabled |

**1 check(s) failed.**

## Interactions

| at | interactable | verb | result |
|---|---|---|---|
| 1:52.5 | `locker_intake_enter` | Get in | pressed |
| 2:04.5 | `locker_intake_enter` | Get out | pressed |
| 5:47.5 | `note_4107_-31` | Read | pressed |
| 5:50.4 | `board_c_way5` | Reset | pressed |
| 5:50.6 | `board_c_way2` | Trip | pressed |
| 6:05.6 | `board_c_way2` | Reset | pressed |
| 6:37.7 | `penstock_1` | Close | completed a hold |
| 7:59.9 | `set_2_socket0` | Fit core | refused: You are not carrying a core. |
| 8:00.3 | `set_2_socket0` | Fit core | refused: You are not carrying a core. |
| 8:00.6 | `set_2_socket0` | Fit core | refused: You are not carrying a core. |
| 8:03.6 | `lift_2_call` | Call | refused: Dead. Three-phase is out. |
| 8:04.0 | `lift_2_call` | Call | refused: Dead. Three-phase is out. |
| 8:04.4 | `lift_2_call` | Call | refused: Dead. Three-phase is out. |

Objective state at the end: `{"objective":"core_cistern","completed":1,"cores":{"found":0,"fitted":0},"running":false,"ended":null,"gates":["arrival_lift","to_plant","to_cistern_pipes","to_residence","exit_lift"],"discoveries":["office"]}`
Carried: `{"items":{"lamp":1},"selected":"lamp"}`
Interactor registry: 79 items, 19 doors.

## Pacing

- **Session length:** 546.0 s (9.1 min) of play.
- **Zero-threat time:** 76.4% of samples had no active entity and fear below 0.15.
- **The Surveyor was active at some point.**
- **Threat episodes:** 1 — 46.5s (ROUSED→SEEKING→MEASURING→APPROACHING→CAPTURING, closest 0.85 m)
- **Fear:** median 0.023, p90 0.269, peak 0.513. Above 0.3 for 3.6% of the session, above 0.5 for 0.9%.
- **Director beats fired:** 1 — distant_door at 1:47.9
- **Longest stretch with nothing on the bus except footsteps:** 546.0 s (0:00.0 → 9:06.0).
- **Moving:** 42% of samples.
- **Zones:** intake (0:00.5–5:03.0) → service (5:04.5–6:06.0) → cistern (6:07.5–7:14.0) → plant (7:15.5–8:04.5) → safe (8:06.0–8:10.5) → service (8:11.0–9:06.0)

### Frame time (CPU rasteriser — not a frame-rate verdict)

| | p50 | p90 | p99 | max |
|---|---:|---:|---:|---:|
| whole session | 0.30 | 0.60 | 9.60 | 11606 |
| after 3 s warmup | 0.30 | 0.60 | 9.60 | 11606 |

All in milliseconds. The multi-second outliers are first-frame shader compiles
after a camera or zone change, which is a property of SwiftShader, not of the renderer.

## Event census

| event | count |
|---|---:|
| `player:noise` | 512 |
| `player:step` | 419 |
| `entity:tick` | 312 |
| `entity:heard` | 48 |
| `qa:phase` | 43 |
| `interact:use` | 7 |
| `entity:state` | 7 |
| `ui:refuse` | 7 |
| `lamp:toggle` | 5 |
| `zone:build` | 5 |
| `zone:leave` | 5 |
| `world:teleport` | 5 |
| `zone:enter` | 5 |
| `qa:scripted-reposition` | 5 |
| `sfx:valve` | 5 |
| `qa:scripted-zone-change` | 4 |
| `light:circuit` | 3 |
| `sfx:breaker` | 3 |
| `zone:unload` | 3 |
| `director:entity-placed` | 1 |
| `director:beat` | 1 |
| `sfx:distant` | 1 |
| `world:noise` | 1 |
| `hide:enter` | 1 |
| `hide:exit` | 1 |
| `game:death` | 1 |
| `cine:begin` | 1 |
| `cine:end` | 1 |
| `game:respawn` | 1 |
| `story:note` | 1 |
| `pickup:taken` | 1 |
| `portal:gate` | 1 |
| `valve:turn` | 1 |
| `lift:power` | 1 |
| `progress:complete` | 1 |
| `progress:objective` | 1 |
| `progress:discovery` | 1 |

## Timeline

State every 5 s; every non-footstep event at the moment it fired. Footsteps and noise
events are counted in the census above rather than listed, because there are hundreds.

```

 0:00.0  ── arrival — standing still, taking the room in ──
 0:00.5  intake    pos( -24.0,   0.0,  24.8) stil      fear 0.00 lamp on 0.99 lit  6/149/208 entity not spawned        5914.5ms
 0:05.5  intake    pos( -24.0,   0.0,  24.8) stil      fear 0.00 lamp on 0.98 lit  6/149/208 entity not spawned        2594.6ms

 0:08.0  ── first walk, no lamp ──
 0:10.5  intake    pos( -21.0,   0.0,  23.1) walk      fear 0.03 lamp on 0.97 lit  6/149/208 entity not spawned        2272.0ms
 0:15.5  intake    pos( -10.3,   0.0,  23.2) walk      fear 0.03 lamp on 0.96 lit  6/149/208 entity not spawned        1650.3ms
 0:19.9      * director:entity-placed   
 0:19.9      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:20.5  intake    pos(  -0.2,   0.0,  23.1) walk      fear 0.03 lamp on 0.95 lit  6/149/208 entity DORMANT @24.7m     1331.2ms
 0:21.6      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:23.1      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:23.9      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:25.0      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:25.5  intake    pos(   6.1,   0.0,  20.5) walk      fear 0.03 lamp on 0.93 lit  6/149/208 entity DORMANT @18.6m     1095.8ms
 0:26.1      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:28.2      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:29.8      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:30.5      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:30.5  intake    pos(   1.9,   0.0,  20.0) walk      fear 0.03 lamp on 0.92 lit  6/149/208 entity DORMANT @22.9m      961.1ms
 0:31.8      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)

 0:32.0  ── INTERACT: take the nearest thing off the floor ──
 0:33.4      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:34.2      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:35.0      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:35.5  intake    pos(  -6.8,   0.0,  15.6) walk      fear 0.03 lamp on 0.91 lit  6/149/208 entity DORMANT @32.2m      831.6ms
 0:36.4      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:38.0      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:39.9      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:40.5  intake    pos(  -9.8,   0.0,  15.1) walk      fear 0.02 lamp on 0.90 lit  6/149/208 entity DORMANT @35.3m      743.8ms
 0:40.7      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:41.5      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:42.8      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:43.7      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:45.1      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:45.5  intake    pos( -10.9,   0.0,  15.1) walk      fear 0.01 lamp on 0.89 lit  6/148/208 entity DORMANT @36.4m      664.5ms
 0:46.3      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:47.5      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:48.4      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:49.8      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:50.5  intake    pos( -10.6,   0.0,  15.1) walk      fear 0.01 lamp on 0.88 lit  6/149/208 entity DORMANT @36.1m      608.1ms
 0:51.4      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:52.0      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:52.9      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:53.7      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:54.3      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:54.9      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 0:55.5  intake    pos( -10.1,   0.0,  15.1) walk      fear 0.01 lamp on 0.86 lit  6/149/208 entity DORMANT @35.5m      554.2ms
 0:56.4      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)

 0:58.0  ── lamp on ──
 0:58.0      * lamp:toggle              
 0:58.3      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:00.4      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:00.5  intake    pos( -10.9,   0.0,  15.1) stil      fear 0.01 lamp off      lit  6/149/208 entity DORMANT @36.3m      626.7ms
 1:01.3      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:03.3      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:04.1      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:05.5  intake    pos( -10.9,   0.0,  15.1) stil      fear 0.00 lamp off      lit  6/149/208 entity DORMANT @36.3m      662.6ms
 1:05.7      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:07.1      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:07.9      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:10.0      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:10.5  intake    pos( -10.9,   0.0,  15.1) stil      fear 0.00 lamp off      lit  6/148/208 entity DORMANT @36.3m      621.0ms
 1:11.3      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:12.5      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:13.5      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:14.3      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:15.0      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:15.5  intake    pos( -10.9,   0.0,  15.1) stil      fear 0.00 lamp off      lit  6/149/208 entity DORMANT @36.3m      579.5ms
 1:16.1      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:17.2      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:18.1      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:19.5      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)

 1:20.0  ── stop and listen (lamp on) ──
 1:20.5  intake    pos( -10.9,   0.0,  15.1) stil      fear 0.00 lamp off      lit  6/149/208 entity DORMANT @36.3m      279.2ms
 1:21.4      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:22.4      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:23.2      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:23.8      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:25.0      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:25.5  intake    pos( -10.9,   0.0,  15.1) stil      fear 0.00 lamp off      lit  6/149/208 entity DORMANT @36.3m      274.9ms
 1:27.0      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:27.6      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:28.3      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:29.6      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:30.5  intake    pos( -10.9,   0.0,  15.1) stil      fear 0.00 lamp off      lit  6/149/208 entity DORMANT @36.3m      183.1ms
 1:30.9      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:32.2      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:34.2      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:35.1      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:35.5  intake    pos( -10.9,   0.0,  15.1) stil      fear 0.00 lamp off      lit  6/149/208 entity DORMANT @36.3m      182.5ms
 1:36.4      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:37.8      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)

 1:38.0  ── INTERACT: get into the locker by the lift ──
 1:38.7      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:40.5  intake    pos( -14.2,   0.0,  18.3) walk      fear 0.03 lamp off      lit  6/149/208 entity DORMANT @39.0m      190.7ms
 1:40.5      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:41.7      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:43.2      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:44.7      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:45.5  intake    pos( -22.9,   0.0,  20.6) walk      fear 0.02 lamp off      lit  6/149/208 entity DORMANT @47.5m      191.1ms
 1:45.8      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:47.3      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:47.9      * director:beat            zone=intake name=distant_door fear=0.02
 1:47.9      * sfx:distant              kind=door at=(-32.4, 0, 36.2)
 1:48.8      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:50.5  intake    pos( -28.8,   0.0,  23.7) walk      fear 0.02 lamp off      lit  6/149/208 entity DORMANT @53.3m      184.8ms
 1:50.8      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:52.5      * hide:enter               id=locker_intake kind=locker at=(-31.1, 0, 29.1)
 1:52.5      * interact:use             id=locker_intake_enter kind=hide

 1:52.5  ── inside the locker — two louvre slots and your own breathing ──
 1:52.7      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:54.6      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:55.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/149/208 entity DORMANT @55.9m      206.7ms
 1:56.3      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:56.9      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:58.6      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 1:59.5      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:00.5  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/149/208 entity DORMANT @55.9m      206.8ms
 2:01.3      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:02.8      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:03.7      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)

 2:04.5  ── INTERACT: get out of the locker ──
 2:04.5      * hide:exit                id=locker_intake kind=locker
 2:04.5      * interact:use             id=locker_intake_enter kind=hide

 2:05.0  ── crouch-walk — nearly silent ──
 2:05.0      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:05.5  intake    pos( -30.6,   0.0,  28.9) walk crch fear 0.20 lamp off      lit  6/149/208 entity DORMANT @55.4m      206.4ms
 2:06.0      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:06.6      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:07.6      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:08.9      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:09.9      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:10.5  intake    pos( -28.6,   0.0,  25.4) walk crch fear 0.04 lamp off      lit  6/149/208 entity DORMANT @53.1m      206.9ms
 2:11.3      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:12.9      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:14.0      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:15.5  intake    pos( -24.2,   0.0,  23.7) walk crch fear 0.02 lamp off      lit  6/149/208 entity DORMANT @48.7m      214.9ms
 2:16.0      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:17.3      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:19.2      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:20.5  intake    pos( -18.8,   0.0,  23.7) walk crch fear 0.01 lamp off      lit  6/149/208 entity DORMANT @43.3m      125.8ms
 2:21.3      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:22.1      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:23.6      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:24.7      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:25.5  intake    pos( -13.4,   0.0,  23.7) walk crch fear 0.01 lamp off      lit  6/149/208 entity DORMANT @37.9m       53.5ms
 2:26.2      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:26.9      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)

 2:27.0  ── sprint — deliberately loud ──
 2:28.7      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:29.5      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:30.3      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:30.5  intake    pos(  -1.1,   0.0,  21.7) walk      fear 0.09 lamp off      lit  6/149/208 entity DORMANT @25.6m       75.9ms
 2:32.0      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:33.5      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:34.6      * entity:state             from=DORMANT state=ROUSED entity=surveyor at=(24.5, 0, 23.2)
 2:34.6      * entity:heard             entity=surveyor strength=0.075 radius=11 at=(9.2, 0, 13)
 2:35.3      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:35.5  intake    pos(   8.6,   0.0,  15.1) walk      fear 0.06 lamp off      lit  6/149/208 entity ROUSED @17.9m       102.8ms
 2:36.0      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:36.6      * entity:tick              entity=surveyor at=(24.5, 0, 23.2)
 2:36.8      * entity:heard             entity=surveyor strength=0.139 radius=11 at=(9.2, 0, 13)
 2:38.1      * entity:heard             entity=surveyor strength=0.283 radius=11 at=(9.2, 0, 13)
 2:38.1      * entity:state             from=ROUSED state=SEEKING entity=surveyor at=(24.5, 0, 23.2)
 2:38.4      * entity:tick              entity=surveyor at=(24.4, 0, 23.2)
 2:39.6      * entity:tick              entity=surveyor at=(23.7, 0, 22.9)
 2:40.5  intake    pos(  11.4,   0.0,  15.1) walk      fear 0.09 lamp off      lit  6/149/208 entity SEEKING @13.8m      103.4ms
 2:41.0      * entity:tick              entity=surveyor at=(22.5, 0, 22.4)
 2:42.9      * entity:tick              entity=surveyor at=(21.3, 0, 21.6)

 2:45.0  ── walk on, lamp off (the entity only moves in light) ──
 2:45.0      * lamp:toggle              
 2:45.0      * entity:tick              entity=surveyor at=(20.1, 0, 20.4)
 2:45.4      * entity:heard             entity=surveyor strength=0.12 radius=6 at=(9.2, 0, 13)
 2:45.5  intake    pos(   8.5,   0.0,  15.1) walk      fear 0.12 lamp on 0.86 lit  6/149/208 entity SEEKING @12.4m      101.5ms
 2:45.9      * entity:tick              entity=surveyor at=(19.5, 0, 19.9)
 2:46.3      * entity:heard             entity=surveyor strength=0.132 radius=6 at=(7.8, 0, 15.1)
 2:47.0      * entity:heard             entity=surveyor strength=0.107 radius=6 at=(6.8, 0, 15.1)
 2:47.3      * entity:tick              entity=surveyor at=(18.7, 0, 19.3)
 2:48.0      * entity:state             from=SEEKING state=MEASURING entity=surveyor at=(18.1, 0, 19.1)
 2:48.2      * entity:tick              entity=surveyor at=(18.1, 0, 19.1)
 2:50.4      * entity:tick              entity=surveyor at=(18.1, 0, 19.1)
 2:50.5  intake    pos(   7.2,   0.0,  15.1) walk      fear 0.08 lamp on 0.84 lit  6/149/208 entity MEASURING @11.6m     99.2ms
 2:50.6      * entity:heard             entity=surveyor strength=0.2 radius=6 at=(7.7, 0, 16.8)
 2:52.0      * entity:heard             entity=surveyor strength=0.254 radius=6 at=(8.3, 0, 15.4)
 2:52.8      * entity:heard             entity=surveyor strength=0.31 radius=6 at=(8.8, 0, 15)
 2:53.4      * entity:heard             entity=surveyor strength=0.365 radius=6 at=(11.1, 0, 14.7)
 2:53.6      * entity:tick              entity=surveyor at=(18.1, 0, 19.1)
 2:53.9      * entity:heard             entity=surveyor strength=0.423 radius=6 at=(10.3, 0, 15.9)
 2:54.0      * entity:state             from=MEASURING state=SEEKING entity=surveyor at=(18.1, 0, 19.1)
 2:54.4      * entity:heard             entity=surveyor strength=0.425 radius=6 at=(10.1, 0, 15)
 2:54.8      * entity:heard             entity=surveyor strength=0.57 radius=6 at=(12.5, 0, 15.3)
 2:54.8      * entity:state             from=SEEKING state=APPROACHING entity=surveyor at=(17.7, 0, 18.9)
 2:55.3      * entity:heard             entity=surveyor strength=0.606 radius=6 at=(12.1, 0, 15.9)
 2:55.5  intake    pos(  11.8,   0.0,  17.0) walk      fear 0.31 lamp on 0.83 lit  6/149/208 entity APPROACHING @5.6m    99.4ms
 2:55.8      * entity:heard             entity=surveyor strength=0.603 radius=6 at=(11.6, 0, 17)
 2:56.2      * entity:heard             entity=surveyor strength=0.569 radius=6 at=(10.6, 0, 17.5)
 2:56.7      * entity:heard             entity=surveyor strength=0.542 radius=6 at=(9.7, 0, 18.1)
 2:56.9      * entity:tick              entity=surveyor at=(16, 0, 18.2)
 2:57.1      * entity:heard             entity=surveyor strength=0.509 radius=6 at=(8.9, 0, 18)
 2:57.6      * entity:heard             entity=surveyor strength=0.477 radius=6 at=(8.8, 0, 18.8)
 2:58.0      * entity:heard             entity=surveyor strength=0.46 radius=6 at=(6.4, 0, 18.5)
 2:58.5      * entity:heard             entity=surveyor strength=0.455 radius=6 at=(6.3, 0, 15.2)
 2:58.7      * entity:tick              entity=surveyor at=(14.4, 0, 18.2)
 2:58.9      * entity:heard             entity=surveyor strength=0.42 radius=6 at=(4.8, 0, 15.6)
 2:59.4      * entity:heard             entity=surveyor strength=0.396 radius=6 at=(4.9, 0, 16.7)
 2:59.8      * entity:heard             entity=surveyor strength=0.366 radius=6 at=(4.4, 0, 17)
 2:59.9      * entity:tick              entity=surveyor at=(13.3, 0, 17.8)
 3:00.3      * entity:heard             entity=surveyor strength=0.332 radius=6 at=(1.6, 0, 17.7)
 3:00.5  intake    pos(   3.0,   0.0,  17.3) walk      fear 0.25 lamp on 0.82 lit  6/149/208 entity APPROACHING @9.8m    91.3ms
 3:00.7      * entity:heard             entity=surveyor strength=0.301 radius=6 at=(2.2, 0, 17.5)
 3:01.2      * entity:heard             entity=surveyor strength=0.309 radius=6 at=(3, 0, 14.8)
 3:01.7      * entity:heard             entity=surveyor strength=0.304 radius=6 at=(1.8, 0, 15.4)
 3:01.8      * entity:tick              entity=surveyor at=(11.7, 0, 17.6)
 3:02.1      * entity:heard             entity=surveyor strength=0.27 radius=6 at=(1.7, 0, 13.5)
 3:02.6      * entity:heard             entity=surveyor strength=0.268 radius=6 at=(-1.1, 0, 16.5)
 3:03.0      * entity:heard             entity=surveyor strength=0.307 radius=6 at=(0.6, 0, 17.6)
 3:03.1      * entity:tick              entity=surveyor at=(10.6, 0, 17.3)
 3:03.4      * entity:heard             entity=surveyor strength=0.337 radius=6 at=(-0.8, 0, 18)
 3:03.9      * entity:heard             entity=surveyor strength=0.416 radius=6 at=(0.9, 0, 19)
 3:04.3      * entity:heard             entity=surveyor strength=0.507 radius=6 at=(3.6, 0, 18.1)
 3:04.8      * entity:tick              entity=surveyor at=(9.1, 0, 17.3)
 3:04.8      * entity:heard             entity=surveyor strength=0.585 radius=6 at=(3.3, 0, 18.8)
 3:05.3      * entity:heard             entity=surveyor strength=0.655 radius=6 at=(4, 0, 19)
 3:05.5  intake    pos(   4.4,   0.0,  19.5) walk      fear 0.34 lamp on 0.81 lit  6/149/208 entity APPROACHING @4.6m    89.1ms
 3:05.7      * entity:heard             entity=surveyor strength=0.711 radius=6 at=(4.3, 0, 19.4)
 3:06.2      * entity:heard             entity=surveyor strength=0.796 radius=6 at=(5.1, 0, 19.6)
 3:06.5      * entity:tick              entity=surveyor at=(7.6, 0, 17.5)
 3:06.6      * entity:heard             entity=surveyor strength=0.866 radius=6 at=(5.7, 0, 18.1)
 3:07.1      * entity:heard             entity=surveyor strength=0.856 radius=6 at=(5.5, 0, 17.8)
 3:07.2      * entity:tick              entity=surveyor at=(7, 0, 17.8)
 3:07.6      * entity:heard             entity=surveyor strength=0.822 radius=6 at=(4.2, 0, 18.6)
 3:08.0      * entity:heard             entity=surveyor strength=0.787 radius=6 at=(3.5, 0, 19.2)
 3:08.5      * entity:heard             entity=surveyor strength=0.753 radius=6 at=(2.5, 0, 19.8)
 3:08.8      * entity:tick              entity=surveyor at=(5.6, 0, 18.3)
 3:08.9      * entity:heard             entity=surveyor strength=0.722 radius=6 at=(1.5, 0, 18.9)
 3:09.4      * entity:heard             entity=surveyor strength=0.723 radius=6 at=(1.6, 0, 17.3)
 3:09.8      * entity:heard             entity=surveyor strength=0.697 radius=6 at=(0.6, 0, 17.3)
 3:10.1      * entity:tick              entity=surveyor at=(4.5, 0, 18.6)
 3:10.3      * entity:heard             entity=surveyor strength=0.661 radius=6 at=(-0.6, 0, 18.3)
 3:10.5  intake    pos(  -0.7,   0.0,  17.3) walk      fear 0.42 lamp on 0.80 lit  6/149/208 entity APPROACHING @5.1m   141.9ms
 3:10.8      * entity:heard             entity=surveyor strength=0.623 radius=6 at=(-2.2, 0, 17)

 3:11.0  ── stand in the dark and wait ──
 3:11.4      * entity:tick              entity=surveyor at=(3.5, 0, 18.3)
 3:12.2      * entity:tick              entity=surveyor at=(2.8, 0, 18)
 3:14.1      * entity:tick              entity=surveyor at=(1.1, 0, 17.3)
 3:14.8      * entity:tick              entity=surveyor at=(0.6, 0, 17.2)
 3:15.5  intake    pos(  -1.9,   0.0,  17.3) stil      fear 0.45 lamp on 0.78 lit  6/149/208 entity APPROACHING @1.9m   120.0ms
 3:16.3      * entity:state             from=APPROACHING state=CAPTURING entity=surveyor at=(-0.8, 0, 17.2)
 3:16.5      * entity:tick              entity=surveyor at=(-0.9, 0, 17.2)
 3:17.5      * entity:tick              entity=surveyor at=(-1, 0, 17.2)
 3:17.6      * game:death               cause=surveyor at=(-1, 0, 17.2)
 3:17.6      * cine:begin               name=death cause=surveyor
 3:19.2      * entity:tick              entity=surveyor at=(-1, 0, 17.2)
 3:20.4      * entity:tick              entity=surveyor at=(-1, 0, 17.2)
 3:20.5  intake    pos(  -1.9,   0.0,  17.3) stil      fear 0.51 lamp on 0.77 lit  6/148/208 entity CAPTURING @0.8m     163.8ms
 3:21.8      * entity:state             from=CAPTURING state=DORMANT entity=surveyor at=(-1, 0, 17.2)
 3:21.8      * cine:end                 name=death
 3:21.8      * game:respawn             
 3:22.2      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:23.3      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:25.1      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:25.5  intake    pos(  -1.9,   0.0,  17.3) stil      fear 0.04 lamp on 0.76 lit  6/149/208 entity DORMANT @30.0m      164.1ms
 3:25.8      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:27.6      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:29.5      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:30.3      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:30.5  intake    pos(  -1.9,   0.0,  17.3) stil      fear 0.01 lamp on 0.75 lit  6/149/208 entity DORMANT @30.0m      163.3ms
 3:31.5      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:32.7      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:33.8      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:34.7      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:35.3      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:35.5  intake    pos(  -1.9,   0.0,  17.3) stil      fear 0.00 lamp on 0.74 lit  6/149/208 entity DORMANT @30.0m      155.2ms
 3:36.3      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)

 3:37.0  ── SCRIPTED: spawn the Surveyor 26 m away, dormant ──

 3:37.0  ── sprint past it — loud enough to be heard ──
 3:38.3      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:40.3      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:40.5  intake    pos( -13.3,   0.0,  15.1) walk      fear 0.09 lamp on 0.72 lit  6/149/208 entity DORMANT @41.7m      154.8ms
 3:41.2      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:41.8      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:42.8      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:44.1      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:45.5  intake    pos(  -9.6,   0.0,  17.1) walk      fear 0.06 lamp on 0.71 lit  6/149/208 entity DORMANT @37.6m      154.9ms
 3:46.2      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:47.7      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:48.7      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:49.4      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:50.0      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:50.5  intake    pos(   2.3,   0.0,  20.1) walk      fear 0.05 lamp on 0.70 lit  6/149/208 entity DORMANT @25.5m      153.8ms
 3:52.1      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:53.7      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:55.5  intake    pos(  -2.8,   0.0,  17.7) walk      fear 0.05 lamp on 0.69 lit  6/149/208 entity DORMANT @30.8m      150.5ms
 3:55.8      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:56.5      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:57.3      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)

 3:59.0  ── lamp on and keep moving (it only advances in light) ──
 3:59.0      * lamp:toggle              
 3:59.3      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 3:60.0      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:00.5  intake    pos( -12.3,   0.0,  15.1) walk      fear 0.04 lamp off      lit  6/149/208 entity DORMANT @40.6m      150.4ms
 4:01.8      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:03.6      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:04.3      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:05.5  intake    pos(  -7.3,   0.0,  15.1) walk      fear 0.02 lamp off      lit  6/149/208 entity DORMANT @35.7m      150.2ms
 4:05.7      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:07.4      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:08.8      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:10.0      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:10.5  intake    pos( -10.0,   0.0,  15.9) walk      fear 0.03 lamp off      lit  6/149/208 entity DORMANT @38.2m      149.8ms
 4:10.8      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:11.4      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:13.4      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:15.2      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:15.5  intake    pos(  -3.4,   0.0,  17.7) walk      fear 0.03 lamp off      lit  6/149/208 entity DORMANT @31.4m      149.3ms
 4:16.4      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:17.0      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:18.9      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:20.5  intake    pos(  -0.1,   0.0,  22.8) walk      fear 0.03 lamp off      lit  6/149/208 entity DORMANT @27.8m      148.9ms
 4:20.8      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:21.9      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:23.7      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:24.5      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:25.3      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:25.5  intake    pos(   2.2,   0.0,  20.8) walk      fear 0.03 lamp off      lit  6/149/208 entity DORMANT @25.5m      148.5ms
 4:26.1      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:26.8      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:28.7      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)

 4:29.0  ── stop, lamp off, stay still — does it lose you? ──
 4:29.0      * lamp:toggle              
 4:30.3      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:30.5  intake    pos(   3.1,   0.0,  20.2) stil      fear 0.02 lamp on 0.68 lit  6/149/208 entity DORMANT @24.6m       95.6ms
 4:31.3      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:32.9      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:34.1      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:35.5  intake    pos(   3.1,   0.0,  20.2) stil      fear 0.00 lamp on 0.67 lit  6/149/208 entity DORMANT @24.6m      124.7ms
 4:35.9      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:37.5      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:38.9      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:40.5  intake    pos(   3.1,   0.0,  20.2) stil      fear 0.00 lamp on 0.65 lit  6/149/208 entity DORMANT @24.6m       80.8ms
 4:40.7      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:42.2      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:43.2      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:44.8      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:45.5  intake    pos(   3.1,   0.0,  20.2) stil      fear 0.00 lamp on 0.64 lit  6/149/208 entity DORMANT @24.6m       80.7ms
 4:45.6      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:47.4      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:48.8      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:50.5  intake    pos(   3.1,   0.0,  20.2) stil      fear 0.00 lamp on 0.63 lit  6/149/208 entity DORMANT @24.6m       80.6ms
 4:50.5      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:51.8      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:53.0      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:54.4      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:55.5  intake    pos(   3.1,   0.0,  20.2) stil      fear 0.00 lamp on 0.62 lit  6/149/208 entity DORMANT @24.6m       80.6ms
 4:55.7      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:57.1      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:58.0      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:58.7      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 4:59.4      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:00.5      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:00.5  intake    pos(   3.1,   0.0,  20.2) stil      fear 0.00 lamp on 0.61 lit  6/149/208 entity DORMANT @24.6m       80.3ms
 5:02.4      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:03.0      * zone:build               zone=service
 5:03.0      * zone:leave               zone=intake
 5:03.0      * world:teleport           zone=service at=(370.4, 0, 0)
 5:03.0      * zone:enter               zone=service from=intake
 5:03.0      * qa:scripted-zone-change  zone=service

 5:03.0  ── zone settle ──
 5:03.9      * zone:build               zone=cistern
 5:04.5      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)

 5:04.5  ── service spine — first walk ──
 5:05.5  service   pos( 372.4,   0.0,   0.0) walk      fear 0.01 lamp on 0.59 lit  6/225/302 entity DORMANT @345.4m     122.4ms
 5:06.2      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:07.2      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:09.1      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:10.5  service   pos( 383.0,   0.0,   0.1) walk      fear 0.03 lamp on 0.58 lit  6/225/302 entity DORMANT @355.9m     136.5ms
 5:11.1      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:12.7      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:13.9      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:14.9      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:15.5  service   pos( 384.7,   0.0,   0.1) stil      fear 0.01 lamp on 0.57 lit  6/224/302 entity DORMANT @357.7m     113.1ms
 5:16.0      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:16.7      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:18.5      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:19.2      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:20.5  service   pos( 384.7,   0.0,   0.1) stil      fear 0.00 lamp on 0.56 lit  6/225/302 entity DORMANT @357.7m     112.7ms
 5:21.2      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:23.3      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:24.2      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:25.2      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:25.5  service   pos( 384.7,   0.0,   0.1) stil      fear 0.00 lamp on 0.55 lit  6/225/302 entity DORMANT @357.7m     112.8ms
 5:26.9      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:28.3      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:29.8      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:30.5  service   pos( 384.7,   0.0,   0.1) stil      fear 0.00 lamp on 0.53 lit  6/225/302 entity DORMANT @357.7m     113.0ms
 5:30.8      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:31.5      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:32.5      * qa:scripted-reposition   at=(412.6, 0, -2.2) zone=service

 5:32.5  ── reposition settle ──
 5:33.1      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)

 5:34.5  ── walk into the switchroom ──
 5:34.9      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:35.5      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:35.5  service   pos( 413.5,   0.0,  -3.7) walk      fear 0.01 lamp on 0.52 lit  6/225/302 entity DORMANT @386.6m     113.6ms
 5:36.7      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:37.4      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:39.1      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:40.5  service   pos( 411.4,   0.0,  -1.8) walk      fear 0.03 lamp on 0.51 lit  6/225/302 entity DORMANT @384.5m     113.9ms
 5:40.6      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:41.3      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:42.4      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:43.2      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:45.2      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:45.5  service   pos( 413.7,   0.0,  -4.0) walk      fear 0.03 lamp on 0.50 lit  6/225/302 entity DORMANT @386.9m     124.5ms
 5:45.8      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)

 5:46.5  ── INTERACT: read the board schedule off the floor ──
 5:47.3      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:47.5      * story:note               id=note_proc_7c kind=procedure title=Procedure 7-C: Lighting During Night Occupation
 5:47.5      * pickup:taken             id=note_4107_-31 item=note at=(410.7, 0.8, -3.1)
 5:47.5      * interact:use             id=note_4107_-31 kind=pickup
 5:47.5      * qa:scripted-reposition   at=(414.6, 0, -8.4) zone=service

 5:47.5  ── reposition settle ──
 5:48.9      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)

 5:49.5  ── INTERACT: reset way 5 — the Stack lift lobby ──
 5:50.0      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:50.4      * light:circuit            circuit=stack powered=true
 5:50.4      * sfx:breaker              at=(416.1, 1.2, -8.4)
 5:50.4      * interact:use             id=board_c_way5 kind=breaker
 5:50.4      * portal:gate              id=to_stack

 5:50.5  ── INTERACT: trip way 2 — put the Spine out behind you ──
 5:50.5  service   pos( 415.2,   0.0,  -7.6) stil      fear 0.01 lamp on 0.49 lit  6/224/302 entity DORMANT @388.7m     124.8ms
 5:50.6      * light:circuit            circuit=service powered=false
 5:50.6      * sfx:breaker              at=(416.1, 1.2, -8.4)
 5:50.6      * interact:use             id=board_c_way2 kind=breaker

 5:51.0  ── stand in the switchroom and look at what changed ──
 5:51.9      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:52.5      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:53.5      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:54.3      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:55.5  service   pos( 415.4,   0.0,  -7.7) stil      fear 0.03 lamp on 0.47 lit  3/162/302 entity DORMANT @388.8m     226.0ms
 5:55.9      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:56.7      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:58.8      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 5:59.9      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:00.5  service   pos( 415.4,   0.0,  -7.7) stil      fear 0.03 lamp on 0.46 lit  3/162/302 entity DORMANT @388.8m     226.4ms
 6:02.0      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:03.8      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)

 6:05.0  ── INTERACT: reset way 2 — the Spine comes back ──
 6:05.5  service   pos( 415.4,   0.0,  -7.7) stil      fear 0.03 lamp on 0.45 lit  3/162/302 entity DORMANT @388.8m     226.2ms
 6:05.6      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:05.6      * light:circuit            circuit=service powered=true
 6:05.6      * sfx:breaker              at=(416.1, 1.2, -8.4)
 6:05.6      * interact:use             id=board_c_way2 kind=breaker
 6:06.0      * zone:leave               zone=service
 6:06.0      * world:teleport           zone=cistern at=(774, 2.6, 0)
 6:06.0      * zone:enter               zone=cistern from=service
 6:06.0      * qa:scripted-zone-change  zone=cistern

 6:06.0  ── zone settle ──

 6:07.5  ── cistern — wading ──
 6:07.5      * lamp:toggle              
 6:07.6      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:08.3      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:09.7      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:10.5  cistern   pos( 776.3,   2.6,   0.0) walk crch fear 0.25 lamp off      lit  2/225/302 entity DORMANT @748.9m     399.5ms
 6:11.4      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:13.0      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:14.6      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:15.5  cistern   pos( 777.5,   2.6,   0.0) stil crch fear 0.27 lamp off      lit  2/225/302 entity DORMANT @750.1m     399.4ms
 6:15.8      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:17.0      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:17.7      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:18.3      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:19.3      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:20.5  cistern   pos( 777.5,   2.6,  -0.2) walk crch fear 0.27 lamp off      lit  2/224/302 entity DORMANT @750.1m     399.2ms
 6:21.1      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:22.1      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:23.1      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:23.9      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:25.2      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:25.5  cistern   pos( 777.5,   2.6,  -0.2) stil crch fear 0.27 lamp off      lit  2/224/302 entity DORMANT @750.1m     356.6ms
 6:26.8      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:28.1      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:29.3      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:30.5  cistern   pos( 777.5,   2.6,  -0.1) walk crch fear 0.27 lamp off      lit  2/225/302 entity DORMANT @750.1m     321.3ms
 6:31.1      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:32.9      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:33.5      * qa:scripted-reposition   at=(815.4, 1.6, 3.2) zone=cistern

 6:33.5  ── reposition settle ──
 6:34.2      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:35.0      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)

 6:35.5  ── INTERACT: turn penstock 1 (a 1.35 s hold) ──
 6:35.5  cistern   pos( 815.4,   1.6,   3.2) stil      fear 0.27 lamp off      lit  1/225/302 entity DORMANT @787.9m     321.1ms
 6:36.5      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:36.5      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:36.7      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:36.8      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:37.0      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:37.1      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:37.7      * valve:turn               zone=cistern id=penstock_1
 6:37.7      * interact:use             id=penstock_1 kind=valve

 6:38.0  ── INTERACT: try penstock 2 — it is padlocked ──
 6:38.1      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:38.9      * ui:refuse                id=penstock_2
 6:39.9      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:40.5  cistern   pos( 815.4,   1.6,   3.2) stil      fear 0.27 lamp off      lit  1/225/302 entity DORMANT @787.9m     320.9ms
 6:41.5      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:42.1      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:42.8      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:44.8      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:45.5  cistern   pos( 815.4,   1.6,   3.2) stil      fear 0.27 lamp off      lit  1/225/302 entity DORMANT @787.9m     320.8ms
 6:46.9      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:47.7      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:48.9      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:49.6      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:50.5  cistern   pos( 815.4,   1.6,   3.2) stil      fear 0.27 lamp off      lit  1/225/302 entity DORMANT @787.9m     320.5ms
 6:51.4      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:52.9      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:54.8      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:55.5  cistern   pos( 815.4,   1.6,   3.2) stil      fear 0.27 lamp off      lit  1/225/302 entity DORMANT @787.9m     320.0ms
 6:56.4      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:57.1      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)

 6:58.0  ── cistern — stand still in the water ──
 6:58.4      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 6:59.9      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 7:00.5  cistern   pos( 815.4,   1.6,   3.2) stil      fear 0.27 lamp off      lit  1/225/302 entity DORMANT @787.9m     319.7ms
 7:01.8      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 7:03.0      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 7:03.8      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 7:05.5  cistern   pos( 815.4,   1.6,   3.2) stil      fear 0.27 lamp off      lit  1/225/302 entity DORMANT @787.9m     309.2ms
 7:05.8      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 7:07.9      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 7:09.7      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 7:10.5  cistern   pos( 815.4,   1.6,   3.2) stil      fear 0.27 lamp off      lit  1/225/302 entity DORMANT @787.9m     309.0ms
 7:11.5      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 7:12.8      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 7:13.9      * entity:tick              entity=surveyor at=(27.7, 0, 22.3)
 7:14.0      * zone:build               zone=plant
 7:14.0      * lift:power               id=lift_2
 7:14.0      * zone:unload              zone=intake
 7:14.0      * zone:leave               zone=cistern
 7:14.0      * world:teleport           zone=plant at=(384.8, 0.7, 400)
 7:14.0      * zone:enter               zone=plant from=cistern
 7:14.0      * progress:complete        id=reach_plant title=Find the Plant
 7:14.0      * progress:objective       title=Supply core — the Cistern objective=core_cistern
 7:14.0      * qa:scripted-zone-change  zone=plant

 7:14.0  ── zone settle ──

 7:15.5  ── the generator hall — the landmark frame ──
 7:15.5  plant     pos( 384.8,   0.7, 400.0) stil      fear 0.14 lamp off      lit  6/ 99/119 entity DORMANT @519.8m     211.9ms
 7:20.5  plant     pos( 384.8,   0.7, 400.0) stil      fear 0.02 lamp off      lit  6/ 99/119 entity DORMANT @519.8m     211.7ms
 7:25.5  plant     pos( 384.8,   0.7, 400.0) stil      fear 0.00 lamp off      lit  6/ 99/119 entity DORMANT @519.8m     211.8ms
 7:30.5  plant     pos( 384.8,   0.7, 400.0) stil      fear 0.00 lamp off      lit  6/ 99/119 entity DORMANT @519.8m      38.4ms
 7:35.5      * qa:scripted-reposition   at=(402.6, -5.7, 398) zone=plant

 7:35.5  ── reposition settle ──
 7:35.5  plant     pos( 384.8,   0.7, 400.0) stil      fear 0.00 lamp off      lit  6/ 99/119 entity DORMANT @519.8m      54.5ms

 7:37.5  ── INTERACT: try the fuel valve with no cores fitted ──
 7:40.5  plant     pos( 402.3,  -5.7, 397.6) stil      fear 0.00 lamp off      lit  6/ 99/119 entity DORMANT @530.3m      54.6ms
 7:45.5  plant     pos( 402.3,  -5.7, 397.6) stil      fear 0.00 lamp off      lit  6/ 99/119 entity DORMANT @530.3m      54.7ms
 7:50.5  plant     pos( 402.3,  -5.7, 397.6) stil      fear 0.00 lamp off      lit  6/ 99/119 entity DORMANT @530.3m     215.7ms
 7:55.5  plant     pos( 402.3,  -5.7, 397.6) stil      fear 0.00 lamp off      lit  6/ 99/119 entity DORMANT @530.3m     257.5ms

 7:59.5  ── INTERACT: try a socket with nothing in your hands ──
 7:59.9      * ui:refuse                id=set_2_socket0
 8:00.3      * ui:refuse                id=set_2_socket0
 8:00.5  plant     pos( 402.3,  -5.7, 397.6) stil      fear 0.00 lamp off      lit  6/ 99/119 entity DORMANT @530.3m     301.8ms
 8:00.6      * ui:refuse                id=set_2_socket0
 8:01.0      * qa:scripted-reposition   at=(414, -6, 400) zone=plant

 8:01.0  ── reposition settle ──

 8:03.0  ── INTERACT: call the goods lift — it has no supply ──
 8:03.6      * ui:refuse                id=lift_2_call
 8:04.0      * ui:refuse                id=lift_2_call
 8:04.4      * ui:refuse                id=lift_2_call
 8:04.5      * zone:build               zone=safe
 8:04.5      * zone:unload              zone=service
 8:04.5      * zone:leave               zone=plant
 8:04.5      * world:teleport           zone=safe at=(400.6, 0, 799)
 8:04.5      * zone:enter               zone=safe from=plant
 8:04.5      * progress:discovery       id=office title=The Office of Record
 8:04.5      * qa:scripted-zone-change  zone=safe

 8:04.5  ── zone settle ──

 8:06.0  ── the safe room ──
 8:06.0  safe      pos( 400.6,   0.0, 799.0) stil      fear 0.01 lamp off      lit  5/ 32/50 entity DORMANT @861.6m     369.0ms
 8:10.7      * zone:build               zone=service
 8:10.7      * zone:unload              zone=cistern
 8:10.7      * zone:leave               zone=safe
 8:10.7      * world:teleport           zone=service kind=door at=(397.9, 0, 3.3)
 8:10.7      * zone:enter               zone=service from=safe
 8:11.0  service   pos( 397.8,   0.0,   3.7) walk      fear 0.02 lamp off      lit  6/100/104 entity DORMANT @370.6m     438.1ms
 8:16.0  service   pos( 402.6,   0.0,   0.7) stil      fear 0.03 lamp off      lit  6/100/104 entity DORMANT @375.5m     458.4ms
 8:21.0  service   pos( 402.6,   0.0,   0.7) stil      fear 0.00 lamp off      lit  6/100/104 entity DORMANT @375.5m     458.5ms

 8:24.0  ── INTERACT: the terminal ──
 8:26.0  service   pos( 402.6,   0.0,   1.0) walk      fear 0.00 lamp off      lit  6/100/104 entity DORMANT @375.5m     458.6ms
 8:31.0  service   pos( 402.4,   0.0,   1.0) stil      fear 0.00 lamp off      lit  6/100/104 entity DORMANT @375.4m     458.6ms
 8:36.0  service   pos( 402.3,   0.0,   1.0) stil      fear 0.00 lamp off      lit  6/100/104 entity DORMANT @375.2m     426.8ms
 8:41.0  service   pos( 402.4,   0.0,   1.0) stil      fear 0.00 lamp off      lit  6/100/104 entity DORMANT @375.3m     438.9ms

 8:46.0  ── INTERACT: read what is on the desk ──
 8:46.0  service   pos( 402.4,   0.0,   1.0) stil      fear 0.00 lamp off      lit  6/100/104 entity DORMANT @375.3m     438.8ms
 8:51.0  service   pos( 404.1,   0.0,  -1.0) walk      fear 0.01 lamp off      lit  6/100/104 entity DORMANT @377.1m     439.1ms
 8:56.0  service   pos( 404.3,   0.0,  -1.0) stil      fear 0.00 lamp off      lit  6/100/104 entity DORMANT @377.3m     423.0ms
 9:01.0  service   pos( 404.1,   0.0,  -1.0) stil      fear 0.00 lamp off      lit  6/100/104 entity DORMANT @377.1m     423.0ms
 9:06.0  service   pos( 403.9,   0.0,  -1.0) stil      fear 0.00 lamp off      lit  6/100/104 entity DORMANT @376.9m     422.9ms
```

`lit A/B/C` = lights uploaded to shaders / fixtures above 5% brightness / fixtures resident.

## Entity state transitions

| t | from | to | active |
|---|---|---|---|
| 2:34.6 | DORMANT | ROUSED | true |
| 2:38.1 | ROUSED | SEEKING | true |
| 2:48.0 | SEEKING | MEASURING | true |
| 2:54.0 | MEASURING | SEEKING | true |
| 2:54.8 | SEEKING | APPROACHING | true |
| 3:16.3 | APPROACHING | CAPTURING | true |
| 3:21.8 | CAPTURING | DORMANT | true |

## Filmstrip

18 frames, one every ~40 s of play. See `filmstrip.md` for them in order.

## Subsystems at the end of the session

```json
{
  "state": "play",
  "zone": "service",
  "subsystems": {
    "world": true,
    "audio": true,
    "save": true,
    "gameplay": true,
    "ui": true,
    "cinematics": true
  },
  "engine": {
    "ms": 422.9241666669026,
    "fps": 2.364490087859192,
    "p90": 1545.5,
    "calls": 150,
    "tris": 227220,
    "quality": "low",
    "res": "496x279"
  },
  "lights": {
    "fixtures": 104,
    "lit": 100,
    "active": 6,
    "shadows": 2
  },
  "entity": {
    "entity": "surveyor",
    "state": "DORMANT",
    "stateTime": 344.15,
    "position": [
      27.7,
      0,
      22.28
    ],
    "heading": 4.546,
    "target": [
      -2.22,
      0,
      16.98
    ],
    "confidence": 0,
    "illumination": 0,
    "lightScale": 0,
    "speed": 0,
    "frozen": true,
    "stoop": 0,
    "measureHold": 0,
    "distToPlayer": 376.9,
    "usingGlb": true
  },
  "gameplay": {
    "surveyor": {
      "entity": "surveyor",
      "state": "DORMANT",
      "stateTime": 344.15,
      "position": [
        27.7,
        0,
        22.28
      ],
      "heading": 4.546,
      "target": [
        -2.22,
        0,
        16.98
      ],
      "confidence": 0,
      "illumination": 0,
      "lightScale": 0,
      "speed": 0,
      "frozen": true,
      "stoop": 0,
      "measureHold": 0,
      "distToPlayer": 376.9,
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
      "fear": 0.003,
      "tension": 0,
      "intensity": 0.28,
      "sinceBeat": 88.5,
      "nextBeatAt": 240,
      "grace": 0,
      "zone": "service",
      "objective": "core_cistern",
      "deaths": 1,
      "hidden": false,
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
      "battery": 0.446,
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
    "occlChecks": 28386,
    "denied": 0,
    "reverb": "service",
    "zone": "service",
    "hums": 8,
    "state": "running",
    "music": {
      "spent": 0,
      "budget": 5,
      "sinceLast": 1000548,
      "cues": []
    },
    "pressure": 0
  }
}
```
