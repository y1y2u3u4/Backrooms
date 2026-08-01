# THE ANNEX — continuous playthrough

Generated 2026-08-01T11:57:13.479Z by `tools/qa/playthrough.mjs`.

**33360 frames · 556.0 s of simulated play at a fixed 1/60 step · 1995 s of wall clock · quality `low` · 480×270**

This is the first continuous session ever run on this build. Movement, sprint, crouch, the
lamp key and the interact key are real DOM keyboard events; mouse look is written into the
field a locked pointer would write, because headless Chromium cannot grant pointer lock.
Frame times come from a CPU rasteriser and are not a frame-rate verdict.

## Assertions

| | check | detail |
|---|---|---|
| **FAIL** | no console errors during the session | The root document of this element is not valid for pointer lock. |
| **PASS** | player position never NaN | 0 frames |
| **PASS** | player never falls through the floor | y -6.00..2.60; frames not standing on a floor: 0 of 33360 (worst consecutive run 0) |
| **FAIL** | the frame loop never stalls (no frame > 5 s) | max 50867 ms, p99 2 ms, p50 0.10 ms |
| **PASS** | post-warmup frame times stay bounded (p99 < 250 ms) | warm p50 0.10 ms, p90 0.20 ms, p99 1.80 ms |
| **PASS** | simulated time advanced continuously | 33360 frames |
| **PASS** | at least one entity state transition occurred | DORMANT->ROUSED@99.55s, ROUSED->SEEKING@103.05s, SEEKING->APPROACHING@106.22s, APPROACHING->MEASURING@117.07s, MEASURING->SEEKING@124.83s, SEEKING->APPROACHING@131.68s, APPROACHING->CAPTURING@132.78s, CAPTURING->DORMANT@134.15s, DORMANT->ROUSED@406.18s, ROUSED->SEEKING@409.68s, SEEKING->MEASURING@440.07s, MEASURING->DORMANT@443.02s, DORMANT->ROUSED@466.83s, ROUSED->SEEKING@470.33s, SEEKING->APPROACHING@470.35s, APPROACHING->MEASURING@475.95s, MEASURING->SEEKING@483.02s, SEEKING->MEASURING@486.25s, MEASURING->DORMANT@494.52s |
| **PASS** | audio subsystem reports as constructed | subsystems.audio=true, ctx state=running |
| **PASS** | footsteps fired while walking | 353 player:step events |
| **PASS** | no zone went dark without something switching it off | 0 of 549 samples had no active light (0 with the power out, 0 unexplained) |
| **PASS** | the session did not get stuck inside a hiding place | 13 of 549 samples were spent hidden |
| **PASS** | at least one interactable was operated | locker_intake_enter:pressed; locker_intake_enter:pressed; note_4156_-74:pressed; board_c_way5:pressed; board_c_way2:pressed; board_c_way2:pressed; penstock_1:completed a hold; set_2_socket0:refused: You are not carrying a core.; set_2_socket0:refused: You are not carrying a core.; set_2_socket0:refused: You are not carrying a core.; lift_2_call:refused: Dead. Three-phase is out.; lift_2_call:refused: Dead. Three-phase is out.; lift_2_call:refused: Dead. Three-phase is out. |
| **PASS** | the player was able to move for most of the session | 97% of samples had controls enabled |
| **PASS** | a thrown decoy moved the Surveyor's belief to where it landed | 1 of 1 audible throws redirected (0 discarded as not a decoy — beyond 33 m, on top of it, or behind a wall: 8 m occl 0) |
| **PASS** | the session never sat on the death screen | 0.0% of samples were dead; 1 revive(s) |

**2 check(s) failed.**

## Interactions

| at | interactable | verb | result |
|---|---|---|---|
| 1:56.0 | `locker_intake_enter` | Get in | pressed |
| 2:08.0 | `locker_intake_enter` | Get out | pressed |
| 5:54.5 | `note_4156_-74` | Read | pressed |
| 5:57.7 | `board_c_way5` | Reset | pressed |
| 5:58.6 | `board_c_way2` | Trip | pressed |
| 6:14.1 | `board_c_way2` | Reset | pressed |
| 6:46.2 | `penstock_1` | Close | completed a hold |
| 8:08.9 | `set_2_socket0` | Fit core | refused: You are not carrying a core. |
| 8:09.3 | `set_2_socket0` | Fit core | refused: You are not carrying a core. |
| 8:09.6 | `set_2_socket0` | Fit core | refused: You are not carrying a core. |
| 8:13.1 | `lift_2_call` | Call | refused: Dead. Three-phase is out. |
| 8:13.5 | `lift_2_call` | Call | refused: Dead. Three-phase is out. |
| 8:13.9 | `lift_2_call` | Call | refused: Dead. Three-phase is out. |

Objective state at the end: `{"objective":"core_cistern","completed":1,"cores":{"found":0,"fitted":0},"running":false,"ended":null,"gates":["arrival_lift","to_cistern_pipes","to_residence","to_plant","exit_lift"],"discoveries":["office"]}`
Carried: `{"items":{"lamp":1},"selected":"lamp"}`
Interactor registry: 80 items, 19 doors.

## Pacing

- **Session length:** 556.0 s (9.3 min) of play.
- **Zero-threat time:** 76.5% of samples had no active entity and fear below 0.15.
- **The Surveyor was active at some point.**
- **Threat episodes:** 3 — 34s (ROUSED→SEEKING→APPROACHING→MEASURING→CAPTURING, closest 0.46 m); 36s (ROUSED→SEEKING→MEASURING, closest 11.95 m); 27s (ROUSED→APPROACHING→MEASURING→SEEKING, closest 3.84 m)
- **Fear:** median 0.026, p90 0.399, peak 0.564. Above 0.3 for 18.6% of the session, above 0.5 for 0.4%.
- **Director beats fired:** 3 — distant_door at 0:57.9, attendant at 3:50.3, lamp_stutter at 5:41.6
- **Longest stretch with nothing on the bus except footsteps:** 61.3 s (2:49.0 → 3:50.3).
- **Moving:** 40% of samples.
- **Zones:** intake (0:01.0–5:07.0) → service (5:08.5–6:14.5) → cistern (6:16.0–7:23.0) → plant (7:24.5–8:14.5) → safe (8:16.0–8:26.0) → service (8:27.0–9:16.0)

### Frame time (CPU rasteriser — not a frame-rate verdict)

| | p50 | p90 | p99 | max |
|---|---:|---:|---:|---:|
| whole session | 0.10 | 0.20 | 1.80 | 50867 |
| after 3 s warmup | 0.10 | 0.20 | 1.80 | 50867 |

All in milliseconds. The multi-second outliers are first-frame shader compiles
after a camera or zone change, which is a property of SwiftShader, not of the renderer.

## Event census

| event | count |
|---|---:|
| `player:noise` | 447 |
| `player:step` | 353 |
| `entity:tick` | 163 |
| `entity:heard` | 44 |
| `qa:phase` | 43 |
| `entity:state` | 19 |
| `sfx:valve` | 9 |
| `ui:refuse` | 8 |
| `interact:use` | 7 |
| `lamp:toggle` | 5 |
| `zone:build` | 5 |
| `zone:leave` | 5 |
| `world:teleport` | 5 |
| `zone:enter` | 5 |
| `director:entity-followed` | 5 |
| `qa:scripted-reposition` | 5 |
| `light:circuit` | 4 |
| `qa:scripted-zone-change` | 4 |
| `director:beat` | 3 |
| `cine:cue` | 3 |
| `sfx:breaker` | 3 |
| `zone:unload` | 3 |
| `sfx:distant` | 2 |
| `world:noise` | 2 |
| `cine:begin` | 2 |
| `cine:end` | 2 |
| `game:respawn` | 2 |
| `ui:screen` | 2 |
| `director:entity-placed` | 1 |
| `item:use` | 1 |
| `item:remove` | 1 |
| `decoy:thrown` | 1 |
| `hide:enter` | 1 |
| `hide:exit` | 1 |
| `game:death` | 1 |
| `ui:action` | 1 |
| `death:settled` | 1 |
| `story:evidence` | 1 |
| `attendant:act` | 1 |
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
 0:01.0  intake    pos( -24.0,   0.0,  24.8) stil      fear 0.00 lamp on 0.99 lit  6/149/208 entity not spawned        5864.1ms
 0:06.0  intake    pos( -24.0,   0.0,  24.8) stil      fear 0.00 lamp on 0.98 lit  6/149/208 entity not spawned        2493.6ms
 0:11.0  intake    pos( -19.9,   0.0,  23.1) walk      fear 0.03 lamp on 0.97 lit  6/149/208 entity not spawned        1634.9ms
 0:16.0  intake    pos(  -9.3,   0.0,  23.5) walk      fear 0.03 lamp on 0.96 lit  6/149/208 entity not spawned        1214.7ms
 0:19.9      * director:entity-placed   
 0:21.0  intake    pos(   0.5,   0.0,  21.7) walk      fear 0.03 lamp on 0.94 lit  6/149/208 entity DORMANT @27.1m      955.7ms
 0:26.0  intake    pos(  -0.1,   0.0,  17.1) walk      fear 0.03 lamp on 0.93 lit  6/149/208 entity DORMANT @25.9m      789.6ms
 0:31.0  intake    pos( -10.7,   0.0,  16.7) walk      fear 0.04 lamp on 0.92 lit  6/149/208 entity DORMANT @15.1m       26.7ms
 0:36.0  intake    pos( -10.1,   0.0,  15.1) walk      fear 0.03 lamp on 0.91 lit  6/149/208 entity DORMANT @15.7m       25.2ms
 0:41.0  intake    pos( -10.9,   0.0,  15.1) walk      fear 0.02 lamp on 0.90 lit  6/149/208 entity DORMANT @14.7m       25.2ms
 0:46.0  intake    pos( -11.3,   0.0,  15.1) walk      fear 0.02 lamp on 0.89 lit  6/149/208 entity DORMANT @14.6m        2.9ms
 0:51.0  intake    pos( -10.3,   0.0,  15.1) walk      fear 0.02 lamp on 0.87 lit  6/149/208 entity DORMANT @15.3m        2.9ms
 0:56.0  intake    pos( -10.8,   0.0,  15.1) walk      fear 0.03 lamp on 0.86 lit  6/149/208 entity DORMANT @15.0m        1.2ms
 0:57.9      * director:beat            zone=intake name=distant_door fear=0.03
 0:57.9      * sfx:distant              kind=door at=(6.9, 0, -8.3)
 0:58.0      * lamp:toggle              
 1:01.0  intake    pos( -10.6,   0.0,  15.1) stil      fear 0.02 lamp off      lit  6/149/208 entity DORMANT @15.4m       20.1ms
 1:06.0  intake    pos( -10.6,   0.0,  15.1) stil      fear 0.01 lamp off      lit  6/148/208 entity DORMANT @15.5m       35.6ms
 1:11.0  intake    pos( -10.6,   0.0,  15.1) stil      fear 0.01 lamp off      lit  6/149/208 entity DORMANT @15.5m       36.3ms
 1:16.0  intake    pos( -10.6,   0.0,  15.1) stil      fear 0.01 lamp off      lit  6/149/208 entity DORMANT @15.6m       36.4ms
 1:21.0  intake    pos( -10.6,   0.0,  15.1) stil      fear 0.01 lamp off      lit  6/149/208 entity DORMANT @15.4m       36.1ms
 1:26.0  intake    pos( -10.6,   0.0,  15.1) stil      fear 0.01 lamp off      lit  6/149/208 entity DORMANT @15.2m       37.5ms
 1:31.0  intake    pos( -10.6,   0.0,  15.1) stil      fear 0.02 lamp off      lit  6/149/208 entity DORMANT @14.5m       18.6ms
 1:36.0  intake    pos( -10.6,   0.0,  15.1) stil      fear 0.02 lamp off      lit  6/149/208 entity DORMANT @14.2m       18.5ms
 1:39.5      * entity:state             from=DORMANT state=ROUSED entity=surveyor at=(-24.6, 0, 17.9)
 1:39.5      * entity:heard             entity=surveyor strength=0.071 radius=6 at=(-10.6, 0, 18.1)
 1:40.0      * entity:heard             entity=surveyor strength=0.127 radius=6 at=(-10.6, 0, 18.1)
 1:40.3      * item:use                 name=Spare cell id=battery_cell
 1:40.3      * item:remove              name=Spare cell id=battery_cell
 1:40.3      * sfx:distant              kind=clatter at=(-17, 0, 20.5)
 1:40.3      * entity:heard             entity=surveyor strength=0.759 radius=16 at=(-16.7, 0, 20.4)
 1:40.3      * decoy:thrown             distance=5 remaining=0 at=(-17, 0, 20.5)
 1:41.0  intake    pos( -13.4,   0.0,  18.4) walk crch fear 0.13 lamp off      lit  6/149/208 entity ROUSED @11.2m         5.3ms
 1:43.0      * entity:state             from=ROUSED state=SEEKING entity=surveyor at=(-24.6, 0, 17.9)
 1:45.7      * entity:heard             entity=surveyor strength=0.542 radius=6 at=(-17.9, 0, 20.9)
 1:46.0  intake    pos( -18.3,   0.0,  20.6) walk      fear 0.23 lamp off      lit  6/149/208 entity SEEKING @5.9m         5.3ms
 1:46.2      * entity:heard             entity=surveyor strength=0.625 radius=6 at=(-18.7, 0, 20.9)
 1:46.2      * entity:state             from=SEEKING state=APPROACHING entity=surveyor at=(-23.1, 0, 17.5)
 1:46.7      * entity:heard             entity=surveyor strength=0.705 radius=6 at=(-19.3, 0, 21.4)
 1:47.2      * entity:heard             entity=surveyor strength=0.772 radius=6 at=(-20.4, 0, 20.7)
 1:47.8      * entity:heard             entity=surveyor strength=0.818 radius=6 at=(-21.8, 0, 21.1)
 1:48.4      * entity:heard             entity=surveyor strength=0.819 radius=6 at=(-22.5, 0, 20.7)
 1:49.0      * entity:heard             entity=surveyor strength=0.784 radius=6 at=(-23.6, 0, 20.3)
 1:49.7      * entity:heard             entity=surveyor strength=0.742 radius=6 at=(-23.7, 0, 20.3)
 1:50.4      * entity:heard             entity=surveyor strength=0.701 radius=6 at=(-24.1, 0, 20.9)
 1:51.0  intake    pos( -25.8,   0.0,  20.6) walk      fear 0.43 lamp off      lit  6/149/208 entity APPROACHING @4.7m     5.3ms
 1:51.0      * entity:heard             entity=surveyor strength=0.668 radius=6 at=(-25.5, 0, 20.6)
 1:51.7      * entity:heard             entity=surveyor strength=0.643 radius=6 at=(-27.2, 0, 21.5)
 1:52.4      * entity:heard             entity=surveyor strength=0.627 radius=6 at=(-27.7, 0, 20.4)
 1:52.8      * entity:heard             entity=surveyor strength=0.208 radius=6 at=(-27.7, 0, 20.4)
 1:53.3      * entity:heard             entity=surveyor strength=0.2 radius=6 at=(-27.7, 0, 20.4)
 1:53.8      * entity:heard             entity=surveyor strength=0.19 radius=6 at=(-27.7, 0, 20.4)
 1:54.2      * entity:heard             entity=surveyor strength=0.177 radius=6 at=(-27.7, 0, 20.4)
 1:54.7      * entity:heard             entity=surveyor strength=0.163 radius=6 at=(-27.7, 0, 20.4)
 1:55.1      * entity:heard             entity=surveyor strength=0.148 radius=6 at=(-27.7, 0, 20.4)
 1:55.6      * entity:heard             entity=surveyor strength=0.132 radius=6 at=(-27.7, 0, 20.4)
 1:56.0      * hide:enter               id=locker_intake kind=locker at=(-31.1, 0, 29.1)
 1:56.0      * interact:use             id=locker_intake_enter kind=hide
 1:56.0  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.31 lamp off      lit  6/149/208 entity APPROACHING @10.9m    4.7ms
 1:57.0      * entity:state             from=APPROACHING state=MEASURING entity=surveyor at=(-26.5, 0, 20)
 2:01.0  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.41 lamp off      lit  6/149/208 entity MEASURING @10.2m      8.6ms
 2:04.8      * entity:state             from=MEASURING state=SEEKING entity=surveyor at=(-26.5, 0, 20)
 2:06.0  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.44 lamp off      lit  6/149/208 entity SEEKING @9.6m         8.6ms
 2:08.0      * entity:heard             entity=surveyor strength=0.516 radius=7 at=(-30.6, 0, 29.3)
 2:08.0      * hide:exit                id=locker_intake kind=locker
 2:08.0      * interact:use             id=locker_intake_enter kind=hide
 2:09.7      * entity:heard             entity=surveyor strength=0.139 radius=2.2 at=(-30.6, 0, 29.3)
 2:10.3      * entity:heard             entity=surveyor strength=0.281 radius=2.2 at=(-30.3, 0, 28.4)
 2:11.0  intake    pos( -29.9,   0.0,  28.0) walk crch fear 0.31 lamp off      lit  6/149/208 entity SEEKING @4.3m         7.9ms
 2:11.1      * entity:heard             entity=surveyor strength=0.424 radius=2.2 at=(-29.2, 0, 26.7)
 2:11.7      * entity:heard             entity=surveyor strength=0.57 radius=2.2 at=(-30.1, 0, 27)
 2:11.7      * entity:state             from=SEEKING state=APPROACHING entity=surveyor at=(-28.7, 0, 24.4)
 2:12.3      * entity:heard             entity=surveyor strength=0.71 radius=2.2 at=(-29.4, 0, 26.3)
 2:12.8      * entity:state             from=APPROACHING state=CAPTURING entity=surveyor at=(-28.8, 0, 25.4)
 2:14.1      * game:death               cause=surveyor at=(-28.9, 0, 25.4)
 2:14.1      * cine:begin               name=death cause=surveyor
 2:14.1      * ui:action                
 2:14.1      * entity:state             from=CAPTURING state=DORMANT entity=surveyor at=(-28.9, 0, 25.4)
 2:14.1      * cine:end                 name=death
 2:14.1      * game:respawn             
 2:14.1      * cine:begin               name=respawn
 2:14.2      * ui:screen                
 2:14.2      * light:circuit            circuit=office_lamp powered=true
 2:14.3      * cine:cue                 
 2:14.7      * cine:cue                 
 2:16.0  intake    pos( -24.0,   0.0,  25.2) stil crch fear 0.10 lamp off      lit  6/149/208 entity DORMANT @30.0m        5.7ms
 2:17.3      * cine:cue                 
 2:18.3      * death:settled            
 2:21.0  intake    pos( -24.0,   0.0,  25.2) walk crch fear 0.02 lamp off      lit  6/149/208 entity DORMANT @30.0m        5.6ms
 2:22.7      * ui:screen                
 2:22.7      * game:respawn             
 2:22.7      * cine:end                 name=respawn
 2:26.0  intake    pos( -21.9,   0.0,  23.3) walk crch fear 0.01 lamp off      lit  6/149/208 entity DORMANT @31.3m        7.0ms
 2:31.0  intake    pos( -16.6,   0.0,  23.3) walk crch fear 0.01 lamp off      lit  6/149/208 entity DORMANT @30.5m        2.4ms
 2:36.0  intake    pos(   0.5,   0.0,  24.0) walk      fear 0.09 lamp off      lit  6/149/208 entity DORMANT @33.7m        2.5ms
 2:41.0  intake    pos(   1.4,   0.0,  21.1) walk      fear 0.06 lamp off      lit  6/149/208 entity DORMANT @36.6m        2.5ms
 2:46.0  intake    pos(  -3.5,   0.0,  21.4) walk      fear 0.05 lamp off      lit  6/149/208 entity DORMANT @34.4m        2.4ms
 2:49.0      * lamp:toggle              
 2:51.0  intake    pos( -11.4,   0.0,  21.4) walk      fear 0.04 lamp on 0.85 lit  6/149/208 entity DORMANT @32.7m        2.5ms
 2:56.0  intake    pos( -17.3,   0.0,  21.4) stil      fear 0.02 lamp on 0.84 lit  6/149/208 entity DORMANT @32.5m        2.5ms
 3:01.0  intake    pos( -17.6,   0.0,  21.4) stil      fear 0.00 lamp on 0.83 lit  6/149/208 entity DORMANT @32.5m        1.2ms
 3:06.0  intake    pos( -12.5,   0.0,  21.4) walk      fear 0.02 lamp on 0.82 lit  6/149/208 entity DORMANT @32.5m        1.3ms
 3:11.0  intake    pos(  -3.0,   0.0,  21.6) walk      fear 0.03 lamp on 0.81 lit  6/149/208 entity DORMANT @34.4m        1.3ms
 3:16.0  intake    pos(  -0.8,   0.0,  18.4) stil      fear 0.02 lamp on 0.79 lit  6/149/208 entity DORMANT @38.1m        1.3ms
 3:21.0  intake    pos(  -0.8,   0.0,  18.4) stil      fear 0.00 lamp on 0.78 lit  6/148/208 entity DORMANT @38.1m        1.3ms
 3:26.0  intake    pos(  -0.8,   0.0,  18.4) stil      fear 0.00 lamp on 0.77 lit  6/149/208 entity DORMANT @38.1m        1.2ms
 3:31.0  intake    pos(  -0.8,   0.0,  18.4) stil      fear 0.00 lamp on 0.76 lit  6/149/208 entity DORMANT @38.1m        1.2ms
 3:36.0  intake    pos(  -0.8,   0.0,  18.4) stil      fear 0.00 lamp on 0.74 lit  6/149/208 entity DORMANT @38.1m        1.0ms
 3:41.0  intake    pos(  -0.8,   0.0,  18.4) stil      fear 0.00 lamp on 0.73 lit  6/149/208 entity DORMANT @38.1m        1.0ms
 3:46.0  intake    pos( -14.3,   0.0,  20.6) stil      fear 0.10 lamp on 0.72 lit  6/149/208 entity DORMANT @33.2m        1.1ms
 3:50.3      * director:beat            zone=intake name=attendant fear=0.05
 3:50.3      * story:evidence           kind=footprints at=(-29.1, 0, 25.3)
 3:50.3      * attendant:act            kind=footprints at=(-29.1, 0, 25.3)
 3:51.0  intake    pos( -10.1,   0.0,  20.6) walk      fear 0.05 lamp on 0.71 lit  6/149/208 entity DORMANT @33.6m        1.1ms
 3:56.0  intake    pos( -12.4,   0.0,  20.6) walk      fear 0.04 lamp on 0.70 lit  6/149/208 entity DORMANT @33.3m        1.3ms
 4:01.0  intake    pos( -13.8,   0.0,  20.6) walk      fear 0.04 lamp on 0.69 lit  6/149/208 entity DORMANT @33.2m        1.4ms
 4:03.0      * lamp:toggle              
 4:06.0  intake    pos( -14.6,   0.0,  20.6) walk      fear 0.02 lamp off      lit  6/149/208 entity DORMANT @33.2m        1.4ms
 4:11.0  intake    pos( -14.5,   0.0,  20.6) walk      fear 0.01 lamp off      lit  6/149/208 entity DORMANT @33.2m        1.4ms
 4:16.0  intake    pos( -16.6,   0.0,  20.6) walk      fear 0.01 lamp off      lit  6/149/208 entity DORMANT @33.2m        1.3ms
 4:21.0  intake    pos(  -9.6,   0.0,  20.6) walk      fear 0.02 lamp off      lit  6/149/208 entity DORMANT @33.6m        1.2ms
 4:26.0  intake    pos(  -3.2,   0.0,  20.6) walk      fear 0.02 lamp off      lit  6/149/208 entity DORMANT @35.2m        1.2ms
 4:31.0  intake    pos(   2.5,   0.0,  19.9) walk      fear 0.03 lamp off      lit  6/148/208 entity DORMANT @38.1m        0.9ms
 4:33.0      * lamp:toggle              
 4:36.0  intake    pos(  -0.3,   0.0,  20.3) stil      fear 0.01 lamp on 0.67 lit  6/149/208 entity DORMANT @36.6m        0.9ms
 4:41.0  intake    pos(  -0.3,   0.0,  20.3) stil      fear 0.00 lamp on 0.66 lit  6/149/208 entity DORMANT @36.6m        1.0ms
 4:46.0  intake    pos(  -0.3,   0.0,  20.3) stil      fear 0.00 lamp on 0.65 lit  6/149/208 entity DORMANT @36.6m        1.0ms
 4:51.0  intake    pos(  -0.3,   0.0,  20.3) stil      fear 0.00 lamp on 0.64 lit  6/149/208 entity DORMANT @36.6m        1.1ms
 4:56.0  intake    pos(  -0.3,   0.0,  20.3) stil      fear 0.00 lamp on 0.63 lit  6/149/208 entity DORMANT @36.6m        1.1ms
 5:01.0  intake    pos(  -0.3,   0.0,  20.3) stil      fear 0.00 lamp on 0.61 lit  6/149/208 entity DORMANT @36.6m        1.1ms
 5:06.0  intake    pos(  -0.3,   0.0,  20.3) stil      fear 0.00 lamp on 0.60 lit  6/149/208 entity DORMANT @36.6m        1.1ms
 5:07.0      * zone:build               zone=service
 5:07.0      * zone:leave               zone=intake
 5:07.0      * world:teleport           zone=service at=(370.4, 0, 0)
 5:07.0      * zone:enter               zone=service from=intake
 5:07.0      * director:entity-followed zone=service
 5:07.9      * zone:build               zone=cistern
 5:11.5  service   pos( 376.7,   0.0,   0.0) walk      fear 0.03 lamp on 0.59 lit 14/225/302 entity DORMANT @23.0m      465.6ms
 5:16.5  service   pos( 384.7,   0.0,   0.1) stil      fear 0.04 lamp on 0.58 lit 14/225/302 entity DORMANT @14.2m      465.8ms
 5:21.5  service   pos( 384.7,   0.0,   0.1) stil      fear 0.02 lamp on 0.56 lit 14/225/302 entity DORMANT @14.2m      465.9ms
 5:26.5  service   pos( 384.7,   0.0,   0.1) stil      fear 0.02 lamp on 0.55 lit 14/225/302 entity DORMANT @14.8m      466.1ms
 5:31.5  service   pos( 384.7,   0.0,   0.1) stil      fear 0.02 lamp on 0.54 lit 14/225/302 entity DORMANT @15.0m      466.4ms
 5:36.5  service   pos( 384.7,   0.0,   0.1) stil      fear 0.02 lamp on 0.53 lit 14/225/302 entity DORMANT @14.5m      466.6ms
 5:41.5  service   pos( 411.9,   0.0,  -6.7) walk      fear 0.04 lamp on 0.52 lit 14/225/302 entity DORMANT @14.8m       57.6ms
 5:41.6      * director:beat            zone=service name=lamp_stutter fear=0.04
 5:46.5  service   pos( 410.3,   0.0,  -2.5) walk crch fear 0.06 lamp on 0.51 lit 14/225/302 entity DORMANT @12.7m       20.5ms
 5:51.5  service   pos( 414.6,   0.0,  -6.5) stil      fear 0.04 lamp on 0.49 lit 14/225/302 entity DORMANT @18.1m       20.4ms
 5:54.5      * story:note               id=note_tally kind=ledger title=Tally Sheet — Doors
 5:54.5      * pickup:taken             id=note_4156_-74 item=note at=(415.6, 0, -7.4)
 5:54.5      * interact:use             id=note_4156_-74 kind=pickup
 5:57.5  service   pos( 414.6,   0.0,  -8.4) stil      fear 0.01 lamp on 0.48 lit 14/225/302 entity DORMANT @18.1m       20.2ms
 5:57.7      * light:circuit            circuit=stack powered=true
 5:57.7      * sfx:breaker              at=(416.1, 1.2, -8.4)
 5:57.7      * interact:use             id=board_c_way5 kind=breaker
 5:57.7      * portal:gate              id=to_stack reason=The lobby is dark. Nothing calls without Way 7.
 5:58.6      * light:circuit            circuit=service powered=false
 5:58.6      * sfx:breaker              at=(416.1, 1.2, -8.4)
 5:58.6      * interact:use             id=board_c_way2 kind=breaker
 6:02.5  service   pos( 415.0,   0.0,  -8.5) stil      fear 0.04 lamp on 0.47 lit  3/162/302 entity DORMANT @18.0m       67.3ms
 6:07.5  service   pos( 415.0,   0.0,  -8.5) stil      fear 0.04 lamp on 0.46 lit  3/162/302 entity DORMANT @17.9m       67.9ms
 6:12.5  service   pos( 415.0,   0.0,  -8.5) stil      fear 0.05 lamp on 0.44 lit  3/162/302 entity DORMANT @17.7m       53.1ms
 6:14.1      * light:circuit            circuit=service powered=true
 6:14.1      * sfx:breaker              at=(416.1, 1.2, -8.4)
 6:14.1      * interact:use             id=board_c_way2 kind=breaker
 6:14.5      * zone:leave               zone=service
 6:14.5      * world:teleport           zone=cistern at=(774, 2.6, 0)
 6:14.5      * zone:enter               zone=cistern from=service
 6:14.5      * director:entity-followed zone=cistern
 6:16.0      * lamp:toggle              
 6:18.0  cistern   pos( 775.2,   2.6,   0.0) walk crch fear 0.25 lamp off      lit  1/224/302 entity DORMANT @28.9m      218.4ms
 6:23.0  cistern   pos( 777.5,   2.6,  -0.1) stil crch fear 0.31 lamp off      lit  2/225/302 entity DORMANT @26.7m      232.5ms
 6:28.0  cistern   pos( 777.5,   2.6,  -0.2) stil crch fear 0.30 lamp off      lit  2/225/302 entity DORMANT @26.7m      232.5ms
 6:33.0  cistern   pos( 777.5,   2.6,  -0.3) stil crch fear 0.30 lamp off      lit  2/225/302 entity DORMANT @26.7m      208.0ms
 6:38.0  cistern   pos( 777.5,   2.6,  -0.4) walk crch fear 0.31 lamp off      lit  2/225/302 entity DORMANT @26.7m      184.3ms
 6:44.0  cistern   pos( 815.4,   1.6,   3.2) stil      fear 0.34 lamp off      lit  1/225/302 entity DORMANT @11.9m      184.2ms
 6:45.0      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:45.4      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:45.4      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:45.4      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:45.6      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:45.6      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:45.6      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:45.7      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:46.0      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:46.2      * entity:state             from=DORMANT state=ROUSED entity=surveyor at=(804, 0, 0)
 6:46.2      * entity:heard             entity=surveyor strength=0.148 radius=6 at=(815.3, 1.6, 3.1)
 6:46.2      * valve:turn               zone=cistern id=penstock_1
 6:46.2      * interact:use             id=penstock_1 kind=valve
 6:47.9      * ui:refuse                id=penstock_2 reason=Padlocked. Brass tag, stamped P2.
 6:49.0  cistern   pos( 815.4,   1.6,   3.2) stil      fear 0.42 lamp off      lit  1/225/302 entity ROUSED @11.9m        16.4ms
 6:49.7      * entity:state             from=ROUSED state=SEEKING entity=surveyor at=(804, 0, 0)
 6:50.0      * entity:heard             entity=surveyor strength=0.147 radius=6 at=(815.3, 1.6, 3.1)
 6:54.0  cistern   pos( 815.9,   1.6,   3.0) walk crch fear 0.40 lamp off      lit  1/225/302 entity SEEKING @12.4m        1.1ms
 6:59.0  cistern   pos( 816.0,   1.6,   2.8) stil crch fear 0.40 lamp off      lit  1/225/302 entity SEEKING @12.4m        1.0ms
 7:04.0  cistern   pos( 816.0,   1.6,   2.8) stil crch fear 0.40 lamp off      lit  1/225/302 entity SEEKING @12.4m        1.0ms
 7:09.0  cistern   pos( 816.0,   1.6,   3.3) stil crch fear 0.40 lamp off      lit  1/225/302 entity SEEKING @12.5m        0.9ms
 7:14.0  cistern   pos( 816.0,   1.6,   3.3) stil crch fear 0.40 lamp off      lit  1/225/302 entity SEEKING @12.5m        2.6ms
 7:19.0  cistern   pos( 816.0,   1.6,   3.3) stil crch fear 0.40 lamp off      lit  1/225/302 entity SEEKING @12.5m        2.6ms
 7:20.1      * entity:state             from=SEEKING state=MEASURING entity=surveyor at=(804, 0, 0)
 7:23.0      * zone:build               zone=plant
 7:23.0      * lift:power               id=lift_2
 7:23.0      * zone:unload              zone=intake
 7:23.0      * zone:leave               zone=cistern
 7:23.0      * world:teleport           zone=plant at=(384.8, 0.7, 400)
 7:23.0      * zone:enter               zone=plant from=cistern
 7:23.0      * entity:state             from=MEASURING state=DORMANT entity=surveyor at=(404.8, -6, 400)
 7:23.0      * director:entity-followed zone=plant
 7:23.0      * progress:complete        id=reach_plant title=Find the Plant
 7:23.0      * progress:objective       title=Supply core — the Cistern objective=core_cistern
 7:24.5  plant     pos( 384.8,   0.7, 400.0) stil      fear 0.20 lamp off      lit 14/ 99/119 entity DORMANT @21.0m      284.8ms
 7:29.5  plant     pos( 384.8,   0.7, 400.0) stil      fear 0.03 lamp off      lit 14/ 99/119 entity DORMANT @21.4m      298.2ms
 7:34.5  plant     pos( 384.8,   0.7, 400.0) stil      fear 0.00 lamp off      lit 14/ 99/119 entity DORMANT @22.0m      298.2ms
 7:39.5  plant     pos( 384.8,   0.7, 400.0) stil      fear 0.00 lamp off      lit 14/ 99/119 entity DORMANT @22.7m      298.3ms
 7:44.5  plant     pos( 384.8,   0.7, 400.0) stil      fear 0.00 lamp off      lit 14/ 99/119 entity DORMANT @23.5m      298.3ms
 7:46.8      * ui:refuse                id=set_2_fuel reason=3 supply cores still missing.
 7:46.8      * entity:state             from=DORMANT state=ROUSED entity=surveyor at=(407.5, -6, 397.6)
 7:46.8      * entity:heard             entity=surveyor strength=0.647 radius=6 at=(403.4, -5.7, 397.5)
 7:49.5  plant     pos( 402.4,  -5.7, 397.6) stil      fear 0.34 lamp off      lit 12/ 99/119 entity ROUSED @5.1m        540.2ms
 7:50.2      * entity:heard             entity=surveyor strength=0.606 radius=6 at=(401.8, -5.7, 396.9)
 7:50.3      * entity:state             from=ROUSED state=SEEKING entity=surveyor at=(407.5, -6, 397.6)
 7:50.3      * entity:state             from=SEEKING state=APPROACHING entity=surveyor at=(407.5, -6, 397.6)
 7:51.1      * entity:heard             entity=surveyor strength=0.545 radius=6 at=(402.2, -5.7, 396.7)
 7:53.5      * entity:heard             entity=surveyor strength=0.231 radius=6 at=(402.2, -5.7, 396.7)
 7:54.2      * entity:heard             entity=surveyor strength=0.249 radius=6 at=(400.8, -5.7, 397.3)
 7:54.5  plant     pos( 402.7,  -5.7, 396.9) walk      fear 0.46 lamp off      lit 12/ 99/119 entity APPROACHING @3.8m   795.6ms
 7:55.9      * entity:state             from=APPROACHING state=MEASURING entity=surveyor at=(406.1, -6, 393.8)
 7:56.9      * entity:heard             entity=surveyor strength=0.219 radius=6 at=(402.8, -5.7, 396)
 7:57.5      * entity:heard             entity=surveyor strength=0.202 radius=6 at=(402.4, -5.7, 398.3)
 7:59.5  plant     pos( 400.8,  -5.7, 396.9) stil      fear 0.26 lamp off      lit 12/ 99/119 entity MEASURING @6.2m     517.4ms
 8:00.3      * entity:heard             entity=surveyor strength=0.202 radius=6 at=(400.3, -5.7, 397.3)
 8:00.8      * entity:heard             entity=surveyor strength=0.22 radius=6 at=(402.9, -5.7, 395.9)
 8:03.0      * entity:state             from=MEASURING state=SEEKING entity=surveyor at=(406.1, -6, 393.8)
 8:03.6      * entity:heard             entity=surveyor strength=0.223 radius=6 at=(401.6, -5.7, 395.1)
 8:04.1      * entity:heard             entity=surveyor strength=0.203 radius=6 at=(400.1, -5.7, 398)
 8:04.5  plant     pos( 401.1,  -5.7, 396.9) walk      fear 0.30 lamp off      lit 11/ 99/119 entity SEEKING @6.2m       517.4ms
 8:06.2      * entity:state             from=SEEKING state=MEASURING entity=surveyor at=(404.6, -6, 392.8)
 8:06.9      * entity:heard             entity=surveyor strength=0.207 radius=6 at=(399.9, -5.7, 396.8)
 8:07.4      * entity:heard             entity=surveyor strength=0.221 radius=6 at=(401.2, -5.7, 396.6)
 8:08.1      * entity:heard             entity=surveyor strength=0.232 radius=6 at=(403.3, -5.7, 395.8)
 8:08.9      * ui:refuse                id=set_2_socket0 reason=You are not carrying a core.
 8:09.3      * ui:refuse                id=set_2_socket0 reason=You are not carrying a core.
 8:09.5  plant     pos( 402.8,  -5.7, 396.9) stil      fear 0.25 lamp off      lit 12/ 99/119 entity MEASURING @4.5m     518.7ms
 8:09.6      * ui:refuse                id=set_2_socket0 reason=You are not carrying a core.
 8:13.1      * ui:refuse                id=lift_2_call reason=Dead. Three-phase is out.
 8:13.5      * ui:refuse                id=lift_2_call reason=Dead. Three-phase is out.
 8:13.9      * ui:refuse                id=lift_2_call reason=Dead. Three-phase is out.
 8:14.5      * zone:build               zone=safe
 8:14.5      * zone:unload              zone=service
 8:14.5      * zone:leave               zone=plant
 8:14.5      * world:teleport           zone=safe at=(400.6, 0, 799)
 8:14.5      * zone:enter               zone=safe from=plant
 8:14.5      * entity:state             from=MEASURING state=DORMANT entity=surveyor at=(393.5, 0, 817.7)
 8:14.5      * director:entity-followed zone=safe
 8:14.5      * progress:discovery       id=office title=The Office of Record
 8:14.5  plant     pos( 415.8,  -6.0, 400.0) stil      fear 0.11 lamp off      lit 13/ 99/119 entity MEASURING @13.3m    546.7ms
 8:20.0  safe      pos( 400.0,   0.0, 801.1) stil      fear 0.02 lamp off      lit  5/ 32/50 entity DORMANT @17.8m      414.9ms
 8:25.0  safe      pos( 400.0,   0.0, 801.1) stil      fear 0.01 lamp off      lit  5/ 32/50 entity DORMANT @17.8m      170.0ms
 8:27.0      * zone:build               zone=service
 8:27.0      * zone:unload              zone=cistern
 8:27.0      * zone:leave               zone=safe
 8:27.0      * world:teleport           zone=service kind=door at=(397.9, 0, 3.3)
 8:27.0      * zone:enter               zone=service from=safe
 8:27.0      * director:entity-followed zone=service
 8:30.0  service   pos( 398.6,   0.0,   0.8) walk      fear 0.03 lamp off      lit 14/100/104 entity DORMANT @27.9m      273.8ms
 8:35.0  service   pos( 402.4,   0.0,   1.0) stil      fear 0.01 lamp off      lit 14/100/104 entity DORMANT @29.6m      259.7ms
 8:40.0  service   pos( 402.4,   0.0,   1.0) stil      fear 0.00 lamp off      lit 14/100/104 entity DORMANT @29.6m      259.6ms
 8:45.0  service   pos( 402.3,   0.0,   1.0) stil      fear 0.00 lamp off      lit 14/100/104 entity DORMANT @29.6m      258.4ms
 8:50.0  service   pos( 402.4,   0.0,   1.0) stil      fear 0.00 lamp off      lit 14/100/104 entity DORMANT @29.6m      118.6ms
 8:55.0  service   pos( 402.1,   0.0,   1.0) stil      fear 0.00 lamp off      lit 14/100/104 entity DORMANT @29.4m      108.7ms
 9:00.0  service   pos( 403.4,   0.0,  -1.0) walk      fear 0.02 lamp off      lit 14/ 98/104 entity DORMANT @28.4m       64.6ms
 9:05.0  service   pos( 404.1,   0.0,  -1.0) walk      fear 0.01 lamp off      lit 14/100/104 entity DORMANT @28.8m        1.1ms
 9:10.0  service   pos( 404.2,   0.0,  -1.0) stil      fear 0.00 lamp off      lit 14/100/104 entity DORMANT @28.8m        1.1ms
 9:15.0  service   pos( 404.0,   0.0,  -1.0) walk      fear 0.00 lamp off      lit 14/100/104 entity DORMANT @28.7m        1.1ms
```

`lit A/B/C` = lights uploaded to shaders / fixtures above 5% brightness / fixtures resident.

## Entity state transitions

| t | from | to | active |
|---|---|---|---|
| 1:39.5 | DORMANT | ROUSED | true |
| 1:43.0 | ROUSED | SEEKING | true |
| 1:46.2 | SEEKING | APPROACHING | true |
| 1:57.1 | APPROACHING | MEASURING | true |
| 2:04.8 | MEASURING | SEEKING | true |
| 2:11.7 | SEEKING | APPROACHING | true |
| 2:12.8 | APPROACHING | CAPTURING | true |
| 2:14.2 | CAPTURING | DORMANT | true |
| 6:46.2 | DORMANT | ROUSED | true |
| 6:49.7 | ROUSED | SEEKING | true |
| 7:20.1 | SEEKING | MEASURING | true |
| 7:23.0 | MEASURING | DORMANT | true |
| 7:46.8 | DORMANT | ROUSED | true |
| 7:50.3 | ROUSED | SEEKING | true |
| 7:50.4 | SEEKING | APPROACHING | true |
| 7:55.9 | APPROACHING | MEASURING | true |
| 8:03.0 | MEASURING | SEEKING | true |
| 8:06.3 | SEEKING | MEASURING | true |
| 8:14.5 | MEASURING | DORMANT | true |

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
    "ms": 1.1225000301996866,
    "fps": 890.8685729140742,
    "p90": 1.5,
    "calls": 225,
    "tris": 373420,
    "quality": "medium",
    "res": "384x216"
  },
  "lights": {
    "fixtures": 104,
    "lit": 100,
    "active": 14,
    "tubes": 100,
    "shadows": 2
  },
  "entity": {
    "entity": "surveyor",
    "state": "DORMANT",
    "stateTime": 61.5,
    "position": [
      388.76,
      0,
      -25.27
    ],
    "heading": 6.593,
    "target": [
      403.33,
      -5.7,
      395.76
    ],
    "confidence": 0,
    "illumination": 0,
    "lightScale": 0,
    "speed": 0,
    "frozen": true,
    "stoop": 0,
    "measureHold": 0.25,
    "distToPlayer": 28.85,
    "usingGlb": true
  },
  "gameplay": {
    "surveyor": {
      "entity": "surveyor",
      "state": "DORMANT",
      "stateTime": 61.5,
      "position": [
        388.76,
        0,
        -25.27
      ],
      "heading": 6.593,
      "target": [
        403.33,
        -5.7,
        395.76
      ],
      "confidence": 0,
      "illumination": 0,
      "lightScale": 0,
      "speed": 0,
      "frozen": true,
      "stoop": 0,
      "measureHold": 0.25,
      "distToPlayer": 28.85,
      "usingGlb": true
    },
    "attendant": {
      "entity": "attendant",
      "acts": 1,
      "cooldown": 0,
      "targets": 8,
      "unused": 7,
      "last": [
        "footprints"
      ]
    },
    "director": {
      "fear": 0.004,
      "dread": 0.054,
      "tension": 0,
      "intensity": 0.78,
      "sinceBeat": 49,
      "nextBeatAt": 68.4,
      "grace": 0,
      "zone": "service",
      "objective": "core_cistern",
      "deaths": 1,
      "hidden": false,
      "lastBeats": [
        "distant_door",
        "attendant",
        "lamp_stutter"
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
      "items": 80,
      "doors": 19
    },
    "flashlight": {
      "on": false,
      "battery": 0.436,
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
        -17,
        0,
        20.5
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
    "occlChecks": 26699,
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
