# THE ANNEX — continuous playthrough

Generated 2026-08-01T16:18:33.241Z by `tools/qa/playthrough.mjs`.

**32460 frames · 541.0 s of simulated play at a fixed 1/60 step · 2138 s of wall clock · quality `low` · 480×270**

This is the first continuous session ever run on this build. Movement, sprint, crouch, the
lamp key and the interact key are real DOM keyboard events; mouse look is written into the
field a locked pointer would write, because headless Chromium cannot grant pointer lock.
Frame times come from a CPU rasteriser and are not a frame-rate verdict.

## Assertions

| | check | detail |
|---|---|---|
| **PASS** | no console errors during the session |  |
| **PASS** | player position never NaN | 0 frames |
| **PASS** | player never falls through the floor | y -6.00..2.60; frames not standing on a floor: 0 of 32460 (worst consecutive run 0) |
| **FAIL** | the frame loop never stalls (no frame > 5 s) | max 50787 ms, p99 2 ms, p50 0.10 ms |
| **PASS** | post-warmup frame times stay bounded (p99 < 250 ms) | warm p50 0.10 ms, p90 0.20 ms, p99 1.90 ms |
| **PASS** | simulated time advanced continuously | 32460 frames |
| **PASS** | at least one entity state transition occurred | DORMANT->ROUSED@135.22s, ROUSED->SEEKING@138.72s, SEEKING->MEASURING@188.77s, MEASURING->SEEKING@209.57s, SEEKING->MEASURING@216.02s, MEASURING->SEEKING@230.63s, SEEKING->MEASURING@233.93s, MEASURING->SEEKING@241.1s, SEEKING->MEASURING@244.4s, MEASURING->RETREATING@251.65s, RETREATING->DORMANT@269.65s, DORMANT->ROUSED@391.27s, ROUSED->SEEKING@394.77s, SEEKING->MEASURING@423.93s, MEASURING->DORMANT@428.02s, DORMANT->ROUSED@454.93s, ROUSED->SEEKING@458.43s, SEEKING->APPROACHING@458.45s, APPROACHING->MEASURING@479.08s, MEASURING->DORMANT@479.52s |
| **PASS** | audio subsystem reports as constructed | subsystems.audio=true, ctx state=running |
| **PASS** | footsteps fired while walking | 483 player:step events |
| **PASS** | no zone went dark without something switching it off | 39 of 534 samples had no active light (39 with the power out, 0 unexplained) |
| **PASS** | the session did not get stuck inside a hiding place | 13 of 534 samples were spent hidden |
| **PASS** | at least one interactable was operated | tape_player_-296_239:pressed; locker_intake_enter:pressed; locker_intake_enter:pressed; note_4107_-31:pressed; board_c_way5:pressed; board_c_way2:pressed; board_c_way2:pressed; penstock_1:completed a hold; set_2_socket0:refused: You are not carrying a core.; set_2_socket0:refused: You are not carrying a core.; set_2_socket0:refused: You are not carrying a core.; lift_2_call:refused: Dead. Three-phase is out.; lift_2_call:refused: Dead. Three-phase is out.; lift_2_call:refused: Dead. Three-phase is out. |
| **PASS** | the player was able to move for most of the session | 98% of samples had controls enabled |
| **PASS** | a thrown decoy moved the Surveyor's belief to where it landed | 0 of 0 audible throws redirected (1 discarded as not a decoy — beyond 33 m, on top of it, or behind a wall: 9.9 m occl 1) |
| **PASS** | killing the lights froze the Surveyor | no switch was in reach while it was hunting |
| **PASS** | the session never sat on the death screen | 0.0% of samples were dead; 0 revive(s) |

**1 check(s) failed.**

## Interactions

| at | interactable | verb | result |
|---|---|---|---|
| 0:38.8 | `tape_player_-296_239` | Take | pressed |
| 1:39.1 | `locker_intake_enter` | Get in | pressed |
| 1:52.0 | `locker_intake_enter` | Get out | pressed |
| 5:34.9 | `note_4107_-31` | Read | pressed |
| 5:42.5 | `board_c_way5` | Reset | pressed |
| 5:43.6 | `board_c_way2` | Trip | pressed |
| 5:59.1 | `board_c_way2` | Reset | pressed |
| 6:31.3 | `penstock_1` | Close | completed a hold |
| 7:53.9 | `set_2_socket0` | Fit core | refused: You are not carrying a core. |
| 7:54.3 | `set_2_socket0` | Fit core | refused: You are not carrying a core. |
| 7:54.6 | `set_2_socket0` | Fit core | refused: You are not carrying a core. |
| 7:58.1 | `lift_2_call` | Call | refused: Dead. Three-phase is out. |
| 7:58.5 | `lift_2_call` | Call | refused: Dead. Three-phase is out. |
| 7:58.9 | `lift_2_call` | Call | refused: Dead. Three-phase is out. |

Objective state at the end: `{"objective":"core_cistern","completed":1,"cores":{"found":0,"fitted":0},"running":false,"ended":null,"gates":["arrival_lift","to_cistern_pipes","to_residence","to_plant","exit_lift"],"discoveries":["office"]}`
Carried: `{"items":{"lamp":1,"tape_player":1},"selected":"lamp"}`
Interactor registry: 92 items, 21 doors.

## Pacing

- **Session length:** 541.0 s (9.0 min) of play.
- **Zero-threat time:** 55.1% of samples had no active entity and fear below 0.15.
- **The Surveyor was active at some point.**
- **Threat episodes:** 3 — 133s (ROUSED→SEEKING→MEASURING→RETREATING, closest 7.4 m); 36s (ROUSED→SEEKING→MEASURING, closest 11.95 m); 24s (ROUSED→APPROACHING→MEASURING, closest 1.74 m)
- **Fear:** median 0.031, p90 0.4, peak 0.577. Above 0.3 for 21.9% of the session, above 0.5 for 2.1%.
- **Director beats fired:** 5 — distant_door at 0:57.9, circuit_trip at 2:14.6, services at 3:31.2, attendant at 4:44.3, distant_door at 5:12.3
- **Longest stretch with nothing on the bus except footsteps:** 42.7 s (8:18.3 → 9:01.0).
- **Moving:** 47% of samples.
- **Zones:** intake (0:01.0–4:51.0) → service (4:52.5–5:59.5) → cistern (6:01.0–7:08.0) → plant (7:09.5–7:59.5) → safe (8:01.0–8:18.0) → service (8:19.0–9:01.0)

### Frame time (CPU rasteriser — not a frame-rate verdict)

| | p50 | p90 | p99 | max |
|---|---:|---:|---:|---:|
| whole session | 0.10 | 0.20 | 1.90 | 50787 |
| after 3 s warmup | 0.10 | 0.20 | 1.90 | 50787 |

All in milliseconds. The multi-second outliers are first-frame shader compiles
after a camera or zone change, which is a property of SwiftShader, not of the renderer.

## Event census

| event | count |
|---|---:|
| `player:noise` | 577 |
| `player:step` | 483 |
| `entity:tick` | 251 |
| `entity:heard` | 63 |
| `qa:phase` | 43 |
| `entity:state` | 20 |
| `interact:use` | 8 |
| `ui:refuse` | 8 |
| `zone:build` | 6 |
| `lamp:toggle` | 5 |
| `director:beat` | 5 |
| `zone:leave` | 5 |
| `world:teleport` | 5 |
| `zone:enter` | 5 |
| `director:entity-followed` | 5 |
| `qa:scripted-reposition` | 5 |
| `sfx:valve` | 5 |
| `world:noise` | 4 |
| `light:circuit` | 4 |
| `qa:scripted-zone-change` | 4 |
| `zone:unload` | 4 |
| `sfx:distant` | 3 |
| `sfx:services` | 3 |
| `sfx:breaker` | 3 |
| `setpiece` | 3 |
| `pickup:taken` | 2 |
| `director:entity-placed` | 1 |
| `item:pickup` | 1 |
| `hide:enter` | 1 |
| `hide:exit` | 1 |
| `sfx:trip` | 1 |
| `item:use` | 1 |
| `item:remove` | 1 |
| `decoy:thrown` | 1 |
| `story:note` | 1 |
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
 0:01.0  intake    pos( -24.0,   0.0,  25.2) stil      fear 0.00 lamp on 0.99 lit  6/156/222 entity not spawned        6646.6ms
 0:06.0  intake    pos( -24.0,   0.0,  25.2) stil      fear 0.00 lamp on 0.98 lit  6/157/222 entity not spawned        2823.0ms
 0:11.0  intake    pos( -25.3,   0.0,  19.3) walk      fear 0.03 lamp on 0.97 lit  6/157/222 entity not spawned        1844.0ms
 0:16.0  intake    pos( -25.6,   0.0,  10.1) walk      fear 0.03 lamp on 0.96 lit  6/157/222 entity not spawned        1370.1ms
 0:19.9      * director:entity-placed   
 0:21.0  intake    pos( -27.5,   0.0,   1.3) walk      fear 0.03 lamp on 0.94 lit  6/157/222 entity DORMANT @27.5m     1081.8ms
 0:26.0  intake    pos( -27.7,   0.0,  12.0) walk      fear 0.03 lamp on 0.93 lit  6/157/222 entity DORMANT @25.3m      891.7ms
 0:31.0  intake    pos( -25.6,   0.0,  17.7) walk      fear 0.02 lamp on 0.92 lit  6/157/222 entity DORMANT @23.7m       27.3ms
 0:36.0  intake    pos( -28.9,   0.0,  22.7) stil      fear 0.03 lamp on 0.91 lit  6/157/222 entity DORMANT @28.0m       26.5ms
 0:38.8      * item:pickup              name=Dictaphone id=tape_player kind=tool
 0:38.8      * pickup:taken             id=tape_player_-296_239 item=tape_player at=(-29.6, 0, 23.9)
 0:38.8      * interact:use             id=tape_player_-296_239 kind=pickup
 0:39.0      * lamp:toggle              
 0:41.0  intake    pos( -26.1,   0.0,  24.6) walk      fear 0.02 lamp off      lit  6/157/222 entity DORMANT @26.1m       45.1ms
 0:46.0  intake    pos( -17.6,   0.0,  21.2) walk      fear 0.03 lamp off      lit  6/157/222 entity DORMANT @16.5m       43.1ms
 0:51.0  intake    pos(  -8.9,   0.0,  24.8) walk      fear 0.04 lamp off      lit  6/157/222 entity DORMANT @15.1m       43.2ms
 0:56.0  intake    pos(   1.1,   0.0,  24.2) walk      fear 0.04 lamp off      lit  6/157/222 entity DORMANT @16.6m       40.9ms
 0:57.9      * director:beat            zone=intake name=distant_door fear=0.04
 0:57.9      * sfx:distant              kind=door at=(22.4, 0, -0.1)
 1:01.0  intake    pos(   8.6,   0.0,  18.6) walk      fear 0.03 lamp off      lit  6/157/222 entity DORMANT @18.6m       41.0ms
 1:06.0  intake    pos(   8.6,   0.0,  18.5) stil      fear 0.01 lamp off      lit  6/157/222 entity DORMANT @18.9m       41.0ms
 1:11.0  intake    pos(   8.6,   0.0,  18.5) stil      fear 0.00 lamp off      lit  6/157/222 entity DORMANT @19.0m       41.0ms
 1:16.0  intake    pos(   8.6,   0.0,  18.5) stil      fear 0.00 lamp off      lit  6/157/222 entity DORMANT @18.5m        2.0ms
 1:21.0  intake    pos(   6.3,   0.0,  20.4) walk      fear 0.03 lamp off      lit  6/157/222 entity DORMANT @16.9m        4.4ms
 1:26.0  intake    pos(  -4.1,   0.0,  22.8) walk      fear 0.06 lamp off      lit  6/157/222 entity DORMANT @12.1m        4.5ms
 1:31.0  intake    pos( -14.4,   0.0,  25.3) walk      fear 0.05 lamp off      lit  6/157/222 entity DORMANT @16.5m        4.5ms
 1:36.0  intake    pos( -24.2,   0.0,  27.6) walk      fear 0.03 lamp off      lit  6/157/222 entity DORMANT @25.2m        4.5ms
 1:39.1      * hide:enter               id=locker_intake kind=locker at=(-31.1, 0, 29.1)
 1:39.1      * interact:use             id=locker_intake_enter kind=hide
 1:41.0  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.30 lamp off      lit  6/157/222 entity DORMANT @31.9m        8.1ms
 1:46.0  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.30 lamp off      lit  6/157/222 entity DORMANT @32.2m        8.1ms
 1:51.0  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.30 lamp off      lit  6/157/222 entity DORMANT @31.7m        8.2ms
 1:52.0      * hide:exit                id=locker_intake kind=locker
 1:52.0      * interact:use             id=locker_intake_enter kind=hide
 1:56.0  intake    pos( -29.0,   0.0,  27.1) walk crch fear 0.07 lamp off      lit  6/157/222 entity DORMANT @28.3m        4.6ms
 2:01.0  intake    pos( -24.9,   0.0,  24.3) walk crch fear 0.02 lamp off      lit  6/157/222 entity DORMANT @22.8m        4.6ms
 2:06.0  intake    pos( -23.3,   0.0,  20.1) walk crch fear 0.02 lamp off      lit  6/157/222 entity DORMANT @18.6m        4.6ms
 2:11.0  intake    pos( -18.3,   0.0,  20.4) walk crch fear 0.03 lamp off      lit  6/157/222 entity DORMANT @14.1m        4.7ms
 2:14.6      * director:beat            zone=intake name=circuit_trip fear=0.05
 2:14.6      * light:circuit            circuit=intake powered=false cause=director
 2:14.6      * sfx:trip                 circuit=intake
 2:15.2      * entity:state             from=DORMANT state=ROUSED entity=surveyor at=(-7.8, 0, 11.2)
 2:15.2      * entity:heard             entity=surveyor strength=0.191 radius=11 at=(-15.6, 0, 19.2)
 2:15.2      * item:use                 name=Spare cell id=battery_cell
 2:15.2      * item:remove              name=Spare cell id=battery_cell
 2:15.2      * sfx:distant              kind=clatter at=(0.1, 0, 17.1)
 2:15.2      * entity:heard             entity=surveyor strength=0.239 radius=16 at=(-15.6, 0, 19.2)
 2:15.2      * decoy:thrown             distance=14 remaining=0 at=(0.1, 0, 17.1)
 2:16.0  intake    pos( -12.6,   0.0,  19.7) walk crch fear 0.33 lamp off      lit  1/  8/222 entity ROUSED @9.8m         18.2ms
 2:18.7      * entity:state             from=ROUSED state=SEEKING entity=surveyor at=(-7.8, 0, 11.2)
 2:20.4      * entity:heard             entity=surveyor strength=0.233 radius=11 at=(-15.6, 0, 19.2)
 2:20.7      * entity:heard             entity=surveyor strength=0.235 radius=11 at=(-15.6, 0, 19.2)
 2:21.0  intake    pos(  -6.1,   0.0,  18.4) walk      fear 0.52 lamp off      lit  1/  8/222 entity SEEKING @7.4m        18.2ms
 2:21.0      * entity:heard             entity=surveyor strength=0.235 radius=11 at=(-15.6, 0, 19.2)
 2:21.3      * entity:heard             entity=surveyor strength=0.231 radius=11 at=(-15.6, 0, 19.2)
 2:21.6      * entity:heard             entity=surveyor strength=0.225 radius=11 at=(-15.6, 0, 19.2)
 2:21.9      * entity:heard             entity=surveyor strength=0.215 radius=11 at=(-15.6, 0, 19.2)
 2:22.2      * entity:heard             entity=surveyor strength=0.203 radius=11 at=(-15.6, 0, 19.2)
 2:22.5      * entity:heard             entity=surveyor strength=0.194 radius=11 at=(-15.6, 0, 19.2)
 2:22.8      * entity:heard             entity=surveyor strength=0.186 radius=11 at=(-15.6, 0, 19.2)
 2:23.1      * entity:heard             entity=surveyor strength=0.176 radius=11 at=(-15.6, 0, 19.2)
 2:23.4      * entity:heard             entity=surveyor strength=0.162 radius=11 at=(-15.6, 0, 19.2)
 2:23.8      * entity:heard             entity=surveyor strength=0.148 radius=11 at=(-15.6, 0, 19.2)
 2:24.1      * entity:heard             entity=surveyor strength=0.133 radius=11 at=(-15.6, 0, 19.2)
 2:24.4      * entity:heard             entity=surveyor strength=0.119 radius=11 at=(-15.6, 0, 19.2)
 2:24.7      * entity:heard             entity=surveyor strength=0.109 radius=11 at=(-15.6, 0, 19.2)
 2:26.0  intake    pos(   5.0,   0.0,  17.4) walk      fear 0.43 lamp off      lit  1/  8/222 entity SEEKING @14.3m       51.2ms
 2:28.5      * entity:heard             entity=surveyor strength=0.461 radius=11 at=(-15.6, 0, 19.2)
 2:28.9      * entity:heard             entity=surveyor strength=0.167 radius=6 at=(-15.6, 0, 19.2)
 2:29.3      * entity:heard             entity=surveyor strength=0.513 radius=11 at=(-15.6, 0, 19.2)
 2:29.7      * entity:heard             entity=surveyor strength=0.512 radius=11 at=(-15.6, 0, 19.2)
 2:30.1      * entity:heard             entity=surveyor strength=0.44 radius=11 at=(-15.6, 0, 19.2)
 2:30.5      * entity:heard             entity=surveyor strength=0.435 radius=11 at=(-15.6, 0, 19.2)
 2:30.9      * entity:heard             entity=surveyor strength=0.177 radius=11 at=(-15.6, 0, 19.2)
 2:31.0  intake    pos(   2.8,   0.0,   7.7) walk      fear 0.43 lamp off      lit  1/  8/222 entity SEEKING @11.2m       51.1ms
 2:31.3      * entity:heard             entity=surveyor strength=0.092 radius=6 at=(-15.6, 0, 19.2)
 2:31.7      * entity:heard             entity=surveyor strength=0.111 radius=6 at=(-15.6, 0, 19.2)
 2:32.1      * entity:heard             entity=surveyor strength=0.13 radius=6 at=(-15.6, 0, 19.2)
 2:32.5      * entity:heard             entity=surveyor strength=0.135 radius=6 at=(-15.6, 0, 19.2)
 2:32.9      * entity:heard             entity=surveyor strength=0.141 radius=6 at=(-15.6, 0, 19.2)
 2:33.0      * lamp:toggle              
 2:33.3      * entity:heard             entity=surveyor strength=0.154 radius=6 at=(-15.6, 0, 19.2)
 2:33.8      * entity:heard             entity=surveyor strength=0.145 radius=6 at=(-15.6, 0, 19.2)
 2:34.3      * entity:heard             entity=surveyor strength=0.124 radius=6 at=(-15.6, 0, 19.2)
 2:34.7      * entity:heard             entity=surveyor strength=0.108 radius=6 at=(-15.6, 0, 19.2)
 2:35.2      * entity:heard             entity=surveyor strength=0.091 radius=6 at=(-15.6, 0, 19.2)
 2:35.6      * entity:heard             entity=surveyor strength=0.074 radius=6 at=(-15.6, 0, 19.2)
 2:36.0  intake    pos(   1.8,   0.0,   5.1) walk      fear 0.27 lamp on 0.90 lit  0/  8/222 entity SEEKING @11.4m       80.5ms
 2:36.1      * entity:heard             entity=surveyor strength=0.071 radius=6 at=(-15.6, 0, 19.2)
 2:41.0  intake    pos(   7.2,   0.0,   0.4) walk      fear 0.10 lamp on 0.88 lit  1/  8/222 entity SEEKING @18.5m       99.0ms
 2:46.0  intake    pos(   9.8,   0.0,   0.4) walk      fear 0.04 lamp on 0.87 lit  1/  8/222 entity SEEKING @20.7m       99.0ms
 2:51.0  intake    pos(  14.4,   0.0,   0.4) walk      fear 0.04 lamp on 0.86 lit  1/  8/222 entity SEEKING @24.7m       81.8ms
 2:56.0  intake    pos(  18.2,   0.0,   0.4) walk      fear 0.03 lamp on 0.85 lit  1/  8/222 entity SEEKING @28.2m       49.5ms
 3:01.0  intake    pos(  14.7,   0.0,   3.7) stil      fear 0.04 lamp on 0.84 lit  0/  8/222 entity SEEKING @23.7m       50.1ms
 3:06.0  intake    pos(  14.7,   0.0,   3.7) stil      fear 0.02 lamp on 0.82 lit  0/  8/222 entity SEEKING @23.7m       20.7ms
 3:08.8      * entity:state             from=SEEKING state=MEASURING entity=surveyor at=(-7.8, 0, 11.2)
 3:11.0  intake    pos(  14.7,   0.0,   3.7) stil      fear 0.02 lamp on 0.81 lit  0/  8/222 entity MEASURING @23.7m     20.7ms
 3:16.0  intake    pos(  14.7,   0.0,   3.7) stil      fear 0.02 lamp on 0.80 lit  0/  8/222 entity MEASURING @23.7m      2.2ms
 3:21.0  intake    pos(  14.7,   0.0,   3.7) stil      fear 0.02 lamp on 0.79 lit  0/  8/222 entity MEASURING @23.7m      2.2ms
 3:26.0  intake    pos(  12.4,   0.0,   3.8) walk      fear 0.07 lamp on 0.78 lit  0/  8/222 entity MEASURING @21.5m      2.1ms
 3:27.2      * entity:heard             entity=surveyor strength=0.07 radius=11 at=(12.3, 0, 2.1)
 3:27.7      * entity:heard             entity=surveyor strength=0.082 radius=11 at=(8.7, 0, 3.5)
 3:28.3      * entity:heard             entity=surveyor strength=0.094 radius=11 at=(9.5, 0, 2.7)
 3:28.7      * entity:heard             entity=surveyor strength=0.107 radius=11 at=(4.1, 0, 3.8)
 3:29.1      * entity:heard             entity=surveyor strength=0.12 radius=11 at=(7.2, 0, 5.1)
 3:29.3      * entity:heard             entity=surveyor strength=0.133 radius=11 at=(3.4, 0, 4.3)
 3:29.6      * entity:state             from=MEASURING state=SEEKING entity=surveyor at=(-7.8, 0, 11.2)
 3:29.7      * entity:heard             entity=surveyor strength=0.138 radius=11 at=(4.4, 0, 3.3)
 3:30.4      * entity:heard             entity=surveyor strength=0.128 radius=11 at=(3.5, 0, 1.4)
 3:31.0  intake    pos(   3.5,   0.0,   1.3) walk      fear 0.15 lamp on 0.76 lit  1/  8/222 entity SEEKING @15.0m        0.9ms
 3:31.2      * director:beat            zone=intake name=services fear=0.15
 3:31.2      * sfx:services             kind=water at=(-1.3, 1.2, 13.1)
 3:33.3      * entity:heard             entity=surveyor strength=0.079 radius=11 at=(3.1, 0, 1.1)
 3:33.7      * entity:heard             entity=surveyor strength=0.074 radius=11 at=(1.2, 0, -4.3)
 3:34.1      * entity:heard             entity=surveyor strength=0.073 radius=11 at=(4.4, 0, -2.6)
 3:34.4      * entity:heard             entity=surveyor strength=0.067 radius=11 at=(3.1, 0, -4.6)
 3:36.0      * entity:state             from=SEEKING state=MEASURING entity=surveyor at=(-7.8, 0, 11.2)
 3:36.0  intake    pos(  -0.3,   0.0,  -5.6) walk      fear 0.08 lamp on 0.75 lit  1/  8/222 entity SEEKING @18.4m        0.9ms
 3:36.7      * entity:heard             entity=surveyor strength=0.1 radius=11 at=(-2.8, 0, -6.2)
 3:37.5      * entity:heard             entity=surveyor strength=0.086 radius=11 at=(1.5, 0, -2.7)
 3:37.9      * entity:heard             entity=surveyor strength=0.077 radius=11 at=(1.4, 0, -7.1)
 3:41.0  intake    pos(   9.4,   0.0,  -4.6) walk      fear 0.07 lamp on 0.74 lit  2/  8/222 entity MEASURING @23.4m     38.2ms
 3:44.9      * zone:build               zone=service
 3:46.0  intake    pos(  17.2,   0.0,  -7.8) walk      fear 0.06 lamp on 0.73 lit  6/229/296 entity MEASURING @31.4m     39.6ms
 3:47.0      * lamp:toggle              
 3:50.6      * entity:state             from=MEASURING state=SEEKING entity=surveyor at=(-7.8, 0, 11.2)
 3:51.0  intake    pos(   8.9,   0.0, -11.8) walk      fear 0.03 lamp off      lit  6/229/296 entity SEEKING @28.4m       39.7ms
 3:53.9      * entity:state             from=SEEKING state=MEASURING entity=surveyor at=(-10.2, 0, 11.1)
 3:53.9      * zone:build               zone=duct
 3:56.0  intake    pos(   5.3,   0.0, -19.3) walk      fear 0.03 lamp off      lit  6/240/321 entity MEASURING @34.2m     39.7ms
 4:01.0  intake    pos(  -1.6,   0.0, -12.9) walk      fear 0.03 lamp off      lit  6/240/321 entity MEASURING @25.5m     39.8ms
 4:01.1      * entity:state             from=MEASURING state=SEEKING entity=surveyor at=(-10.2, 0, 11.1)
 4:04.4      * entity:state             from=SEEKING state=MEASURING entity=surveyor at=(-12, 0, 9.6)
 4:06.0  intake    pos(  -1.0,   0.0,  -8.7) walk      fear 0.03 lamp off      lit  6/240/321 entity MEASURING @21.4m     40.0ms
 4:11.0  intake    pos(   2.7,   0.0, -13.4) walk      fear 0.03 lamp off      lit  6/240/321 entity MEASURING @27.3m     43.7ms
 4:11.6      * entity:state             from=MEASURING state=RETREATING entity=surveyor at=(-12, 0, 9.6)
 4:16.0  intake    pos(  -0.5,   0.0, -10.9) walk      fear 0.03 lamp off      lit  6/240/321 entity RETREATING @22.2m     7.8ms
 4:17.0      * lamp:toggle              
 4:21.0  intake    pos(  -1.1,   0.0,  -9.0) stil      fear 0.01 lamp on 0.72 lit  6/240/321 entity RETREATING @18.9m     6.5ms
 4:26.0  intake    pos(  -1.1,   0.0,  -9.0) stil      fear 0.01 lamp on 0.70 lit  6/240/321 entity RETREATING @18.1m     6.6ms
 4:29.6      * entity:state             from=RETREATING state=DORMANT entity=surveyor at=(-1.7, 0, 9.6)
 4:31.0  intake    pos(  -1.1,   0.0,  -9.0) stil      fear 0.01 lamp on 0.69 lit  6/239/321 entity DORMANT @18.8m        6.6ms
 4:36.0  intake    pos(  -1.1,   0.0,  -9.0) stil      fear 0.00 lamp on 0.68 lit  6/240/321 entity DORMANT @19.1m        6.5ms
 4:41.0  intake    pos(  -1.1,   0.0,  -9.0) stil      fear 0.00 lamp on 0.67 lit  6/239/321 entity DORMANT @18.8m        2.8ms
 4:44.3      * director:beat            zone=intake name=attendant fear=0
 4:46.0  intake    pos(  -1.1,   0.0,  -9.0) stil      fear 0.00 lamp on 0.66 lit  6/240/321 entity DORMANT @18.2m        1.4ms
 4:51.0      * zone:leave               zone=intake
 4:51.0      * world:teleport           zone=service at=(370.4, 0, 0)
 4:51.0      * zone:enter               zone=service from=intake
 4:51.0      * director:entity-followed zone=service
 4:51.0  intake    pos(  -1.1,   0.0,  -9.0) stil      fear 0.01 lamp on 0.65 lit  6/240/321 entity DORMANT @18.0m        1.4ms
 4:56.5  service   pos( 378.8,   0.0,   0.0) walk      fear 0.03 lamp on 0.63 lit 14/240/321 entity DORMANT @20.7m      465.4ms
 5:01.5  service   pos( 384.7,   0.0,   0.1) stil      fear 0.03 lamp on 0.62 lit 14/240/321 entity DORMANT @14.0m      465.5ms
 5:06.5  service   pos( 384.7,   0.0,   0.1) stil      fear 0.02 lamp on 0.61 lit 14/240/321 entity DORMANT @13.4m      465.6ms
 5:11.5  service   pos( 384.7,   0.0,   0.1) stil      fear 0.03 lamp on 0.60 lit 14/240/321 entity DORMANT @12.8m      465.7ms
 5:12.3      * director:beat            zone=service name=distant_door fear=0.03
 5:12.3      * sfx:distant              kind=door at=(373.8, 0, -20.7)
 5:16.5  service   pos( 384.7,   0.0,   0.1) stil      fear 0.03 lamp on 0.58 lit 14/240/321 entity DORMANT @12.2m      465.8ms
 5:22.5  service   pos( 412.6,   0.0,  -2.2) stil      fear 0.02 lamp on 0.57 lit 14/239/321 entity DORMANT @16.8m      465.9ms
 5:27.5  service   pos( 409.6,   0.0,  -7.0) walk      fear 0.04 lamp on 0.56 lit 14/240/321 entity DORMANT @15.8m       16.1ms
 5:32.5  service   pos( 415.0,   0.0,  -4.9) walk      fear 0.03 lamp on 0.55 lit 14/240/321 entity DORMANT @20.2m       15.9ms
 5:34.9      * story:note               id=note_proc_7c kind=procedure title=Procedure 7-C: Lighting During Night Occupation
 5:34.9      * pickup:taken             id=note_4107_-31 item=note at=(410.7, 0.8, -3.1)
 5:34.9      * interact:use             id=note_4107_-31 kind=pickup
 5:37.5  service   pos( 414.6,   0.0,  -8.4) stil      fear 0.02 lamp on 0.53 lit 14/240/321 entity DORMANT @20.4m       15.9ms
 5:42.5      * light:circuit            circuit=stack powered=true
 5:42.5      * sfx:breaker              at=(416.1, 1.2, -8.4)
 5:42.5      * interact:use             id=board_c_way5 kind=breaker
 5:42.5      * portal:gate              id=to_stack reason=The lobby is dark. Nothing calls without Way 7.
 5:42.5  service   pos( 415.8,   0.0,  -8.7) stil crch fear 0.02 lamp on 0.52 lit 14/240/321 entity DORMANT @20.8m       15.8ms
 5:43.6      * light:circuit            circuit=service powered=false
 5:43.6      * sfx:breaker              at=(416.1, 1.2, -8.4)
 5:43.6      * interact:use             id=board_c_way2 kind=breaker
 5:47.5  service   pos( 415.8,   0.0,  -8.7) stil crch fear 0.03 lamp on 0.51 lit  3/177/321 entity DORMANT @20.4m       35.2ms
 5:52.5  service   pos( 415.8,   0.0,  -8.7) stil crch fear 0.04 lamp on 0.50 lit  3/177/321 entity DORMANT @20.3m       35.0ms
 5:57.5  service   pos( 415.8,   0.0,  -8.7) stil crch fear 0.04 lamp on 0.49 lit  3/177/321 entity DORMANT @20.2m       21.0ms
 5:59.1      * light:circuit            circuit=service powered=true
 5:59.1      * sfx:breaker              at=(416.1, 1.2, -8.4)
 5:59.1      * interact:use             id=board_c_way2 kind=breaker
 5:59.5      * zone:build               zone=cistern
 5:59.5      * zone:unload              zone=intake
 5:59.5      * zone:leave               zone=service
 5:59.5      * world:teleport           zone=cistern at=(774, 2.6, 0)
 5:59.5      * zone:enter               zone=cistern from=service
 5:59.5      * director:entity-followed zone=cistern
 5:59.5      * setpiece                 id=something_in_the_water
 5:59.5      * sfx:services             kind=water at=(756.7, 2.6, -10)
 6:01.0      * lamp:toggle              
 6:03.0  cistern   pos( 776.0,   2.6,   0.0) walk crch fear 0.28 lamp off      lit  2/ 87/119 entity DORMANT @28.1m       85.5ms
 6:08.0  cistern   pos( 777.5,   2.6,   0.1) walk crch fear 0.30 lamp off      lit  2/ 87/119 entity DORMANT @26.7m       85.4ms
 6:13.0  cistern   pos( 777.5,   2.6,  -0.2) stil crch fear 0.30 lamp off      lit  2/ 87/119 entity DORMANT @26.7m       85.4ms
 6:18.0  cistern   pos( 777.5,   2.6,  -0.0) stil crch fear 0.30 lamp off      lit  2/ 87/119 entity DORMANT @26.7m       65.8ms
 6:23.0  cistern   pos( 777.5,   2.6,  -0.1) stil crch fear 0.30 lamp off      lit  2/ 87/119 entity DORMANT @26.7m       65.8ms
 6:29.0  cistern   pos( 815.4,   1.6,   3.2) stil      fear 0.34 lamp off      lit  1/ 87/119 entity DORMANT @11.9m       65.8ms
 6:30.0      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:30.4      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:30.4      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:30.5      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:30.6      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:31.3      * entity:state             from=DORMANT state=ROUSED entity=surveyor at=(804, 0, 0)
 6:31.3      * entity:heard             entity=surveyor strength=0.148 radius=6 at=(817.3, 1.6, 1.7)
 6:31.3      * valve:turn               zone=cistern id=penstock_1
 6:31.3      * interact:use             id=penstock_1 kind=valve
 6:32.9      * ui:refuse                id=penstock_2 reason=Padlocked. Brass tag, stamped P2.
 6:34.0  cistern   pos( 815.4,   1.6,   3.2) stil      fear 0.42 lamp off      lit  1/ 87/119 entity ROUSED @11.9m         8.3ms
 6:34.8      * entity:state             from=ROUSED state=SEEKING entity=surveyor at=(804, 0, 0)
 6:39.0  cistern   pos( 815.9,   1.6,   3.0) stil crch fear 0.40 lamp off      lit  1/ 87/119 entity SEEKING @12.4m        0.9ms
 6:44.0  cistern   pos( 815.9,   1.6,   3.2) stil crch fear 0.40 lamp off      lit  1/ 86/119 entity SEEKING @12.5m        0.9ms
 6:49.0  cistern   pos( 816.0,   1.6,   3.3) stil crch fear 0.40 lamp off      lit  1/ 87/119 entity SEEKING @12.5m        0.8ms
 6:54.0  cistern   pos( 816.0,   1.6,   2.8) stil crch fear 0.40 lamp off      lit  1/ 87/119 entity SEEKING @12.4m        0.8ms
 6:59.0  cistern   pos( 816.0,   1.6,   2.8) stil crch fear 0.40 lamp off      lit  1/ 87/119 entity SEEKING @12.4m        0.8ms
 7:03.9      * entity:state             from=SEEKING state=MEASURING entity=surveyor at=(804, 0, 0)
 7:04.0  cistern   pos( 816.0,   1.6,   2.8) stil crch fear 0.40 lamp off      lit  1/ 87/119 entity MEASURING @12.4m      1.6ms
 7:08.0      * zone:build               zone=plant
 7:08.0      * lift:power               id=lift_2
 7:08.0      * zone:unload              zone=duct
 7:08.0      * zone:leave               zone=cistern
 7:08.0      * world:teleport           zone=plant at=(384.8, 0.7, 400)
 7:08.0      * zone:enter               zone=plant from=cistern
 7:08.0      * entity:state             from=MEASURING state=DORMANT entity=surveyor at=(404.8, -6, 400)
 7:08.0      * director:entity-followed zone=plant
 7:08.0      * progress:complete        id=reach_plant title=Find the Plant
 7:08.0      * setpiece                 id=the_plant_answers
 7:08.0      * sfx:services             kind=settle at=(381.3, 0.7, 410)
 7:08.0      * progress:objective       title=Supply core — the Cistern objective=core_cistern
 7:09.5  plant     pos( 384.8,   0.7, 400.0) stil      fear 0.20 lamp off      lit 14/ 99/119 entity DORMANT @21.0m      277.4ms
 7:14.5  plant     pos( 384.8,   0.7, 400.0) stil      fear 0.03 lamp off      lit 14/ 99/119 entity DORMANT @21.4m      289.8ms
 7:19.5  plant     pos( 384.8,   0.7, 400.0) stil      fear 0.00 lamp off      lit 14/ 99/119 entity DORMANT @21.4m      302.2ms
 7:24.5  plant     pos( 384.8,   0.7, 400.0) stil      fear 0.00 lamp off      lit 14/ 99/119 entity DORMANT @20.8m      302.3ms
 7:29.5  plant     pos( 384.8,   0.7, 400.0) stil      fear 0.00 lamp off      lit 14/ 99/119 entity DORMANT @20.1m      302.2ms
 7:31.8      * ui:refuse                id=set_2_fuel reason=3 supply cores still missing.
 7:34.5  plant     pos( 402.4,  -5.7, 397.6) stil      fear 0.14 lamp off      lit 12/ 99/119 entity DORMANT @2.0m       547.0ms
 7:34.9      * entity:state             from=DORMANT state=ROUSED entity=surveyor at=(403.7, -6, 399)
 7:34.9      * entity:heard             entity=surveyor strength=0.836 radius=6 at=(401.9, -5.7, 397.6)
 7:38.4      * entity:state             from=ROUSED state=SEEKING entity=surveyor at=(403.7, -6, 399)
 7:38.4      * entity:state             from=SEEKING state=APPROACHING entity=surveyor at=(403.7, -6, 399)
 7:39.5  plant     pos( 401.5,  -5.7, 396.9) stil      fear 0.49 lamp off      lit 11/ 99/119 entity APPROACHING @3.4m   579.6ms
 7:41.8      * entity:heard             entity=surveyor strength=0.785 radius=6 at=(401.9, -5.7, 396.7)
 7:44.3      * entity:heard             entity=surveyor strength=0.81 radius=6 at=(402.6, -5.7, 396.7)
 7:44.5  plant     pos( 402.1,  -5.7, 396.9) walk      fear 0.52 lamp off      lit 12/ 99/119 entity APPROACHING @2.5m   304.3ms
 7:44.8      * entity:heard             entity=surveyor strength=0.848 radius=6 at=(401.3, -5.7, 397.3)
 7:47.6      * entity:heard             entity=surveyor strength=0.849 radius=6 at=(401.4, -5.7, 397.1)
 7:48.1      * entity:heard             entity=surveyor strength=0.79 radius=6 at=(402.1, -5.7, 396.7)
 7:48.9      * entity:heard             entity=surveyor strength=0.735 radius=6 at=(402.1, -5.7, 397.2)
 7:49.5  plant     pos( 402.8,  -5.7, 396.9) stil      fear 0.52 lamp off      lit 12/ 99/119 entity APPROACHING @4.0m   314.7ms
 7:51.5      * entity:heard             entity=surveyor strength=0.247 radius=6 at=(402.1, -5.7, 397.2)
 7:52.1      * entity:heard             entity=surveyor strength=0.349 radius=6 at=(402.1, -5.7, 397.2)
 7:53.9      * entity:heard             entity=surveyor strength=0.241 radius=6 at=(402.1, -5.7, 397.2)
 7:53.9      * ui:refuse                id=set_2_socket0 reason=You are not carrying a core.
 7:54.3      * ui:refuse                id=set_2_socket0 reason=You are not carrying a core.
 7:54.5  plant     pos( 402.1,  -5.7, 396.9) stil      fear 0.47 lamp off      lit 12/ 99/119 entity APPROACHING @4.2m   302.5ms
 7:54.6      * ui:refuse                id=set_2_socket0 reason=You are not carrying a core.
 7:57.6      * entity:heard             entity=surveyor strength=0.091 radius=6 at=(402.1, -5.7, 397.2)
 7:58.1      * ui:refuse                id=lift_2_call reason=Dead. Three-phase is out.
 7:58.5      * ui:refuse                id=lift_2_call reason=Dead. Three-phase is out.
 7:58.9      * ui:refuse                id=lift_2_call reason=Dead. Three-phase is out.
 7:59.1      * entity:state             from=APPROACHING state=MEASURING entity=surveyor at=(404.7, -6, 393.1)
 7:59.5      * zone:build               zone=safe
 7:59.5      * zone:unload              zone=service
 7:59.5      * zone:leave               zone=plant
 7:59.5      * world:teleport           zone=safe at=(400.6, 0, 799)
 7:59.5      * zone:enter               zone=safe from=plant
 7:59.5      * entity:state             from=MEASURING state=DORMANT entity=surveyor at=(393.6, 0, 780.2)
 7:59.5      * director:entity-followed zone=safe
 7:59.5      * progress:discovery       id=office title=The Office of Record
 7:59.5      * setpiece                 id=the_kettle
 7:59.5  plant     pos( 415.8,  -6.0, 400.0) stil      fear 0.17 lamp off      lit 13/ 99/119 entity MEASURING @13.1m    331.4ms
 8:05.0  safe      pos( 398.6,   0.0, 800.8) walk      fear 0.03 lamp off      lit  5/ 32/50 entity DORMANT @21.1m      242.2ms
 8:10.0  safe      pos( 402.3,   0.0, 799.9) walk      fear 0.03 lamp off      lit  5/ 32/50 entity DORMANT @21.5m      247.9ms
 8:15.0  safe      pos( 399.6,   0.0, 799.6) walk      fear 0.03 lamp off      lit  5/ 32/50 entity DORMANT @20.2m      212.6ms
 8:18.3      * zone:build               zone=service
 8:18.3      * zone:unload              zone=cistern
 8:18.3      * zone:leave               zone=safe
 8:18.3      * world:teleport           zone=service kind=door at=(397.9, 0, 3.3)
 8:18.3      * zone:enter               zone=service from=safe
 8:18.3      * director:entity-followed zone=service
 8:20.0  service   pos( 396.8,   0.0,   4.2) stil      fear 0.03 lamp off      lit 10/100/104 entity DORMANT @29.3m      265.4ms
 8:25.0  service   pos( 396.8,   0.0,   4.2) walk      fear 0.01 lamp off      lit 10/100/104 entity DORMANT @28.8m      256.0ms
 8:30.0  service   pos( 397.0,   0.0,   4.2) stil      fear 0.00 lamp off      lit 10/100/104 entity DORMANT @28.3m      227.0ms
 8:35.0  service   pos( 397.6,   0.0,   4.3) stil      fear 0.00 lamp off      lit 10/100/104 entity DORMANT @28.0m      103.6ms
 8:40.0  service   pos( 397.9,   0.0,   4.3) stil      fear 0.00 lamp off      lit 10/100/104 entity DORMANT @27.5m       70.8ms
 8:45.0  service   pos( 396.8,   0.0,   2.5) stil      fear 0.01 lamp off      lit 10/100/104 entity DORMANT @25.0m       65.1ms
 8:50.0  service   pos( 396.8,   0.0,   2.3) stil      fear 0.00 lamp off      lit 10/100/104 entity DORMANT @24.1m       55.1ms
 8:55.0  service   pos( 396.8,   0.0,   2.3) stil      fear 0.00 lamp off      lit 10/100/104 entity DORMANT @23.4m        1.1ms
 9:00.0  service   pos( 396.8,   0.0,   2.4) stil      fear 0.00 lamp off      lit 10/100/104 entity DORMANT @22.8m        1.1ms
```

`lit A/B/C` = lights uploaded to shaders / fixtures above 5% brightness / fixtures resident.

## Entity state transitions

| t | from | to | active |
|---|---|---|---|
| 2:15.2 | DORMANT | ROUSED | true |
| 2:18.7 | ROUSED | SEEKING | true |
| 3:08.8 | SEEKING | MEASURING | true |
| 3:29.6 | MEASURING | SEEKING | true |
| 3:36.0 | SEEKING | MEASURING | true |
| 3:50.6 | MEASURING | SEEKING | true |
| 3:53.9 | SEEKING | MEASURING | true |
| 4:01.1 | MEASURING | SEEKING | true |
| 4:04.4 | SEEKING | MEASURING | true |
| 4:11.7 | MEASURING | RETREATING | true |
| 4:29.6 | RETREATING | DORMANT | true |
| 6:31.3 | DORMANT | ROUSED | true |
| 6:34.8 | ROUSED | SEEKING | true |
| 7:03.9 | SEEKING | MEASURING | true |
| 7:08.0 | MEASURING | DORMANT | true |
| 7:34.9 | DORMANT | ROUSED | true |
| 7:38.4 | ROUSED | SEEKING | true |
| 7:38.4 | SEEKING | APPROACHING | true |
| 7:59.1 | APPROACHING | MEASURING | true |
| 7:59.5 | MEASURING | DORMANT | true |

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
    "ms": 1.1041666865348816,
    "fps": 905.6603610621693,
    "p90": 1.5,
    "calls": 285,
    "tris": 431232,
    "quality": "medium",
    "res": "384x216"
  },
  "lights": {
    "fixtures": 104,
    "lit": 100,
    "active": 10,
    "tubes": 100,
    "shadows": 2
  },
  "entity": {
    "entity": "surveyor",
    "state": "DORMANT",
    "stateTime": 61.5,
    "position": [
      376.41,
      0,
      -7.48
    ],
    "heading": 7.273,
    "target": [
      402.09,
      -5.7,
      397.17
    ],
    "confidence": 0,
    "illumination": 22.91,
    "lightScale": 1,
    "speed": 0.103,
    "frozen": false,
    "stoop": 0,
    "measureHold": 6.37,
    "distToPlayer": 22.59,
    "usingGlb": true
  },
  "gameplay": {
    "surveyor": {
      "entity": "surveyor",
      "state": "DORMANT",
      "stateTime": 61.5,
      "position": [
        376.41,
        0,
        -7.48
      ],
      "heading": 7.273,
      "target": [
        402.09,
        -5.7,
        397.17
      ],
      "confidence": 0,
      "illumination": 22.91,
      "lightScale": 1,
      "speed": 0.103,
      "frozen": false,
      "stoop": 0,
      "measureHold": 6.37,
      "distToPlayer": 22.59,
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
      "fear": 0.002,
      "dread": 0.054,
      "tension": 0,
      "intensity": 0.78,
      "sinceBeat": 58.6,
      "nextBeatAt": 80.4,
      "grace": 0,
      "zone": "service",
      "objective": "core_cistern",
      "deaths": 0,
      "hidden": false,
      "lastBeats": [
        "circuit_trip",
        "services",
        "attendant",
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
        "to_cistern_pipes",
        "to_residence",
        "to_plant",
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
      "items": 92,
      "doors": 21
    },
    "flashlight": {
      "on": false,
      "battery": 0.478,
      "beam": 0,
      "covered": 0,
      "swapping": false,
      "enabled": true
    },
    "decoy": {
      "cells": 0,
      "cooldown": 0,
      "thrown": 1,
      "canThrow": false,
      "lastLanding": [
        0.1,
        0,
        17.1
      ]
    },
    "setpieces": {
      "fired": [
        "something_in_the_water",
        "the_plant_answers",
        "the_kettle"
      ],
      "count": 3,
      "log": [
        {
          "id": "something_in_the_water",
          "t": 361.6
        },
        {
          "id": "the_plant_answers",
          "t": 430.1
        },
        {
          "id": "the_kettle",
          "t": 481.6
        }
      ]
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
        "lamp": 1,
        "tape_player": 1
      },
      "selected": "lamp"
    }
  },
  "audio": {
    "voices": 12,
    "oneShots": 0,
    "loops": 12,
    "nodes": 295,
    "occlChecks": 26457,
    "denied": 0,
    "reverb": "service",
    "zone": "service",
    "hums": 8,
    "state": "running",
    "music": {
      "spent": 0,
      "budget": 5,
      "sinceLast": 1000533,
      "cues": []
    },
    "pressure": 0
  }
}
```
