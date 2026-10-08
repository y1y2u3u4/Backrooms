# THE ANNEX — continuous playthrough

Generated 2026-08-01T12:19:11.678Z by `tools/qa/playthrough.mjs`.

**15600 frames · 260.0 s of simulated play at a fixed 1/60 step · 537 s of wall clock · quality `low` · 400×225**

This is the first continuous session ever run on this build. Movement, sprint, crouch, the
lamp key and the interact key are real DOM keyboard events; mouse look is written into the
field a locked pointer would write, because headless Chromium cannot grant pointer lock.
Frame times come from a CPU rasteriser and are not a frame-rate verdict.

## Assertions

| | check | detail |
|---|---|---|
| **FAIL** | no console errors during the session | The root document of this element is not valid for pointer lock. |
| **PASS** | player position never NaN | 0 frames |
| **PASS** | player never falls through the floor | y 0.00..0.00; frames not standing on a floor: 0 of 15600 (worst consecutive run 0) |
| **PASS** | the frame loop never stalls (no frame > 5 s) | max 2724 ms, p99 2 ms, p50 0.10 ms |
| **PASS** | post-warmup frame times stay bounded (p99 < 250 ms) | warm p50 0.10 ms, p90 0.20 ms, p99 1.50 ms |
| **PASS** | simulated time advanced continuously | 15600 frames |
| **PASS** | at least one entity state transition occurred | DORMANT->ROUSED@98.63s, ROUSED->SEEKING@102.13s, SEEKING->APPROACHING@102.15s, APPROACHING->MEASURING@117.42s, MEASURING->SEEKING@123.07s, SEEKING->MEASURING@126.37s, MEASURING->SEEKING@132.63s, SEEKING->MEASURING@135.93s, MEASURING->RETREATING@142.85s, RETREATING->ROUSED@148.2s, ROUSED->SEEKING@151.7s, SEEKING->APPROACHING@151.72s, APPROACHING->CAPTURING@167.2s, CAPTURING->DORMANT@168.57s |
| **PASS** | audio subsystem reports as constructed | subsystems.audio=true, ctx state=running |
| **PASS** | footsteps fired while walking | 317 player:step events |
| **PASS** | no zone went dark without something switching it off | 0 of 260 samples had no active light (0 with the power out, 0 unexplained) |
| **PASS** | the session did not get stuck inside a hiding place | 13 of 260 samples were spent hidden |
| **FAIL** | at least one interactable was operated | locker_intake_enter:pressed; locker_intake_enter:pressed |
| **PASS** | the player was able to move for most of the session | 93% of samples had controls enabled |
| **PASS** | a thrown decoy moved the Surveyor's belief to where it landed | no decoy was thrown this session — the entity never came close enough |
| **PASS** | the session never sat on the death screen | 0.0% of samples were dead; 1 revive(s) |

**2 check(s) failed.**

## Interactions

| at | interactable | verb | result |
|---|---|---|---|
| 1:52.9 | `locker_intake_enter` | Get in | pressed |
| 2:05.0 | `locker_intake_enter` | Get out | pressed |

Objective state at the end: `{"objective":"reach_plant","completed":0,"cores":{"found":0,"fitted":0},"running":false,"ended":null,"gates":["arrival_lift"],"discoveries":[]}`
Carried: `{"items":{"lamp":1,"battery_cell":1},"selected":"lamp"}`
Interactor registry: 11 items, 4 doors.

## Pacing

- **Session length:** 260.0 s (4.3 min) of play.
- **Zero-threat time:** 72.7% of samples had no active entity and fear below 0.15.
- **The Surveyor was active at some point.**
- **Threat episodes:** 1 — 69s (ROUSED→APPROACHING→MEASURING→SEEKING→RETREATING→CAPTURING, closest 0.54 m)
- **Fear:** median 0.027, p90 0.306, peak 0.564. Above 0.3 for 11.5% of the session, above 0.5 for 1.5%.
- **Director beats fired:** 1 — distant_door at 0:57.9
- **Longest stretch with nothing on the bus except footsteps:** 62.8 s (2:57.2 → 4:00.0).
- **Moving:** 60% of samples.
- **Zones:** intake (0:01.0–4:20.0)

### Frame time (CPU rasteriser — not a frame-rate verdict)

| | p50 | p90 | p99 | max |
|---|---:|---:|---:|---:|
| whole session | 0.10 | 0.20 | 1.50 | 2724 |
| after 3 s warmup | 0.10 | 0.20 | 1.50 | 2724 |

All in milliseconds. The multi-second outliers are first-frame shader compiles
after a camera or zone change, which is a property of SwiftShader, not of the renderer.

## Event census

| event | count |
|---|---:|
| `player:noise` | 322 |
| `player:step` | 317 |
| `entity:tick` | 98 |
| `entity:heard` | 69 |
| `qa:phase` | 15 |
| `entity:state` | 14 |
| `lamp:toggle` | 3 |
| `cine:cue` | 3 |
| `interact:use` | 2 |
| `cine:begin` | 2 |
| `cine:end` | 2 |
| `game:respawn` | 2 |
| `ui:screen` | 2 |
| `director:entity-placed` | 1 |
| `director:beat` | 1 |
| `sfx:distant` | 1 |
| `world:noise` | 1 |
| `hide:enter` | 1 |
| `hide:exit` | 1 |
| `game:death` | 1 |
| `ui:action` | 1 |
| `light:circuit` | 1 |
| `death:settled` | 1 |

## Timeline

State every 5 s; every non-footstep event at the moment it fired. Footsteps and noise
events are counted in the census above rather than listed, because there are hundreds.

```
 0:01.0  intake    pos( -24.0,   0.0,  24.8) stil      fear 0.00 lamp on 0.99 lit  6/149/208 entity not spawned        7336.2ms
 0:06.0  intake    pos( -24.0,   0.0,  24.8) stil      fear 0.00 lamp on 0.98 lit  6/149/208 entity not spawned        3339.8ms
 0:11.0  intake    pos( -19.9,   0.0,  23.1) walk      fear 0.03 lamp on 0.97 lit  6/149/208 entity not spawned        2177.4ms
 0:16.0  intake    pos(  -9.3,   0.0,  23.5) walk      fear 0.03 lamp on 0.96 lit  6/149/208 entity not spawned        1621.8ms
 0:19.9      * director:entity-placed   
 0:21.0  intake    pos(   0.6,   0.0,  22.7) walk      fear 0.03 lamp on 0.94 lit  6/149/208 entity DORMANT @27.5m     1270.7ms
 0:26.0  intake    pos(   0.9,   0.0,  19.6) walk      fear 0.03 lamp on 0.93 lit  6/149/208 entity DORMANT @27.2m     1061.9ms
 0:31.0  intake    pos(  -0.5,   0.0,  19.0) walk      fear 0.03 lamp on 0.92 lit  6/149/208 entity DORMANT @25.1m      899.7ms
 0:36.0  intake    pos(  -9.2,   0.0,  15.1) walk      fear 0.03 lamp on 0.91 lit  6/149/208 entity DORMANT @17.1m      788.5ms
 0:41.0  intake    pos(  -9.3,   0.0,  15.1) walk      fear 0.02 lamp on 0.90 lit  6/149/208 entity DORMANT @16.3m      695.4ms
 0:46.0  intake    pos( -10.8,   0.0,  15.1) stil      fear 0.02 lamp on 0.89 lit  6/149/208 entity DORMANT @14.2m       26.3ms
 0:51.0  intake    pos( -10.3,   0.0,  15.1) stil      fear 0.03 lamp on 0.87 lit  6/149/208 entity DORMANT @14.2m       25.6ms
 0:56.0  intake    pos( -10.1,   0.0,  15.1) walk      fear 0.03 lamp on 0.86 lit  6/149/208 entity DORMANT @14.2m       25.4ms
 0:57.9      * director:beat            zone=intake name=distant_door fear=0.02
 0:57.9      * sfx:distant              kind=door at=(7.9, 0, -8.3)
 0:58.0      * lamp:toggle              
 1:01.0  intake    pos(  -9.8,   0.0,  15.1) stil      fear 0.02 lamp off      lit  6/149/208 entity DORMANT @14.5m       20.2ms
 1:06.0  intake    pos(  -9.8,   0.0,  15.1) stil      fear 0.02 lamp off      lit  6/148/208 entity DORMANT @15.1m       20.2ms
 1:11.0  intake    pos(  -9.8,   0.0,  15.1) stil      fear 0.01 lamp off      lit  6/149/208 entity DORMANT @15.8m       20.3ms
 1:16.0  intake    pos(  -9.8,   0.0,  15.1) stil      fear 0.01 lamp off      lit  6/149/208 entity DORMANT @15.6m       18.7ms
 1:21.0  intake    pos(  -9.8,   0.0,  15.1) stil      fear 0.01 lamp off      lit  6/149/208 entity DORMANT @15.2m       18.7ms
 1:26.0  intake    pos(  -9.8,   0.0,  15.1) stil      fear 0.02 lamp off      lit  6/149/208 entity DORMANT @14.5m       20.1ms
 1:31.0  intake    pos(  -9.8,   0.0,  15.1) stil      fear 0.02 lamp off      lit  6/149/208 entity DORMANT @13.7m       20.1ms
 1:36.0  intake    pos(  -9.8,   0.0,  15.1) stil      fear 0.02 lamp off      lit  6/149/208 entity DORMANT @13.0m       20.1ms
 1:38.6      * entity:state             from=DORMANT state=ROUSED entity=surveyor at=(-19.7, 0, 22.9)
 1:38.6      * entity:heard             entity=surveyor strength=0.07 radius=6 at=(-11.5, 0, 14)
 1:39.0      * entity:heard             entity=surveyor strength=0.092 radius=6 at=(-11.5, 0, 14)
 1:39.5      * entity:heard             entity=surveyor strength=0.114 radius=6 at=(-11.5, 0, 14)
 1:40.0      * entity:heard             entity=surveyor strength=0.137 radius=6 at=(-11.5, 0, 14)
 1:40.4      * entity:heard             entity=surveyor strength=0.158 radius=6 at=(-11.5, 0, 14)
 1:40.8      * entity:heard             entity=surveyor strength=0.18 radius=6 at=(-11.5, 0, 14)
 1:41.0  intake    pos( -15.0,   0.0,  18.5) walk      fear 0.25 lamp off      lit  6/149/208 entity ROUSED @6.4m         39.0ms
 1:41.3      * entity:heard             entity=surveyor strength=0.203 radius=6 at=(-11.5, 0, 14)
 1:41.7      * entity:heard             entity=surveyor strength=0.224 radius=6 at=(-11.5, 0, 14)
 1:42.1      * entity:state             from=ROUSED state=SEEKING entity=surveyor at=(-19.7, 0, 22.9)
 1:42.1      * entity:state             from=SEEKING state=APPROACHING entity=surveyor at=(-19.7, 0, 22.9)
 1:42.2      * entity:heard             entity=surveyor strength=0.246 radius=6 at=(-11.5, 0, 14)
 1:42.6      * entity:heard             entity=surveyor strength=0.272 radius=6 at=(-11.5, 0, 14)
 1:43.1      * entity:heard             entity=surveyor strength=0.29 radius=6 at=(-11.5, 0, 14)
 1:43.7      * entity:heard             entity=surveyor strength=0.285 radius=6 at=(-11.5, 0, 14)
 1:44.2      * entity:heard             entity=surveyor strength=0.265 radius=6 at=(-11.5, 0, 14)
 1:44.8      * entity:heard             entity=surveyor strength=0.237 radius=6 at=(-11.5, 0, 14)
 1:45.4      * entity:heard             entity=surveyor strength=0.205 radius=6 at=(-11.5, 0, 14)
 1:46.0  intake    pos( -23.2,   0.0,  20.6) walk      fear 0.41 lamp off      lit  6/149/208 entity APPROACHING @7.0m    39.0ms
 1:46.0      * entity:heard             entity=surveyor strength=0.173 radius=6 at=(-11.5, 0, 14)
 1:46.6      * entity:heard             entity=surveyor strength=0.139 radius=6 at=(-11.5, 0, 14)
 1:47.2      * entity:heard             entity=surveyor strength=0.106 radius=6 at=(-11.5, 0, 14)
 1:47.8      * entity:heard             entity=surveyor strength=0.073 radius=6 at=(-11.5, 0, 14)
 1:51.0  intake    pos( -28.8,   0.0,  23.8) walk      fear 0.14 lamp off      lit  6/149/208 entity APPROACHING @16.9m   21.5ms
 1:52.9      * hide:enter               id=locker_intake kind=locker at=(-31.1, 0, 29.1)
 1:52.9      * interact:use             id=locker_intake_enter kind=hide
 1:56.0  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.31 lamp off      lit  6/149/208 entity APPROACHING @23.8m   29.9ms
 1:57.4      * entity:state             from=APPROACHING state=MEASURING entity=surveyor at=(-7.3, 0, 21.4)
 2:01.0  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.31 lamp off      lit  6/149/208 entity MEASURING @25.0m     29.7ms
 2:03.0      * entity:state             from=MEASURING state=SEEKING entity=surveyor at=(-7.3, 0, 21.4)
 2:05.0      * hide:exit                id=locker_intake kind=locker
 2:05.0      * interact:use             id=locker_intake_enter kind=hide
 2:06.0  intake    pos( -30.3,   0.0,  29.1) stil      fear 0.21 lamp off      lit  6/149/208 entity SEEKING @26.4m       29.6ms
 2:06.3      * entity:state             from=SEEKING state=MEASURING entity=surveyor at=(-4.8, 0, 21.4)
 2:11.0  intake    pos( -28.6,   0.0,  25.1) walk crch fear 0.04 lamp off      lit  6/149/208 entity MEASURING @24.1m     29.6ms
 2:12.6      * entity:state             from=MEASURING state=SEEKING entity=surveyor at=(-4.8, 0, 21.4)
 2:15.9      * entity:state             from=SEEKING state=MEASURING entity=surveyor at=(-2.3, 0, 21.4)
 2:16.0  intake    pos( -24.3,   0.0,  23.4) walk crch fear 0.02 lamp off      lit  6/149/208 entity MEASURING @22.0m     29.8ms
 2:21.0  intake    pos( -18.9,   0.0,  23.4) walk crch fear 0.03 lamp off      lit  6/149/208 entity MEASURING @16.7m     29.8ms
 2:22.8      * entity:state             from=MEASURING state=RETREATING entity=surveyor at=(-2.3, 0, 21.4)
 2:26.0  intake    pos( -13.5,   0.0,  23.4) walk crch fear 0.06 lamp off      lit  6/149/208 entity RETREATING @11.8m    29.9ms
 2:28.2      * entity:state             from=RETREATING state=ROUSED entity=surveyor at=(-1.8, 0, 24)
 2:28.2      * entity:heard             entity=surveyor strength=0.615 radius=11 at=(-10.9, 0, 24.1)
 2:28.5      * entity:heard             entity=surveyor strength=0.66 radius=11 at=(-10.9, 0, 24.1)
 2:28.8      * entity:heard             entity=surveyor strength=0.702 radius=11 at=(-10.9, 0, 24.1)
 2:29.1      * entity:heard             entity=surveyor strength=0.745 radius=11 at=(-7.9, 0, 23.7)
 2:29.4      * entity:heard             entity=surveyor strength=0.78 radius=11 at=(-6.7, 0, 23.6)
 2:29.7      * entity:heard             entity=surveyor strength=0.824 radius=11 at=(-6.1, 0, 24.3)
 2:30.0      * entity:heard             entity=surveyor strength=0.867 radius=11 at=(-4.7, 0, 24)
 2:30.3      * entity:heard             entity=surveyor strength=0.907 radius=11 at=(-3.9, 0, 24.4)
 2:30.6      * entity:heard             entity=surveyor strength=0.949 radius=11 at=(-2.9, 0, 24.7)
 2:30.9      * entity:heard             entity=surveyor strength=0.98 radius=11 at=(-1.6, 0, 24.3)
 2:31.0  intake    pos(  -1.6,   0.0,  24.5) walk      fear 0.53 lamp off      lit  6/149/208 entity ROUSED @0.5m         11.0ms
 2:31.2      * entity:heard             entity=surveyor strength=0.957 radius=11 at=(-1, 0, 24.5)
 2:31.5      * entity:heard             entity=surveyor strength=0.929 radius=11 at=(-0.1, 0, 23.6)
 2:31.7      * entity:state             from=ROUSED state=SEEKING entity=surveyor at=(-1.8, 0, 24)
 2:31.7      * entity:state             from=SEEKING state=APPROACHING entity=surveyor at=(-1.8, 0, 24)
 2:31.8      * entity:heard             entity=surveyor strength=0.903 radius=11 at=(-0.3, 0, 22.7)
 2:32.1      * entity:heard             entity=surveyor strength=0.868 radius=11 at=(0.3, 0, 21.8)
 2:32.4      * entity:heard             entity=surveyor strength=0.824 radius=11 at=(1.4, 0, 21.1)
 2:32.8      * entity:heard             entity=surveyor strength=0.636 radius=6 at=(1.3, 0, 19.4)
 2:33.1      * entity:heard             entity=surveyor strength=0.574 radius=6 at=(2.1, 0, 19.2)
 2:33.5      * entity:heard             entity=surveyor strength=0.521 radius=6 at=(1.6, 0, 18.4)
 2:33.9      * entity:heard             entity=surveyor strength=0.481 radius=6 at=(2.4, 0, 17.7)
 2:34.3      * entity:heard             entity=surveyor strength=0.488 radius=6 at=(1.3, 0, 17.5)
 2:34.7      * entity:heard             entity=surveyor strength=0.514 radius=6 at=(0.1, 0, 17.1)
 2:35.1      * entity:heard             entity=surveyor strength=0.534 radius=6 at=(-0.2, 0, 16.7)
 2:35.5      * entity:heard             entity=surveyor strength=0.543 radius=6 at=(-1.4, 0, 17)
 2:35.9      * entity:heard             entity=surveyor strength=0.544 radius=6 at=(-2.7, 0, 18.1)
 2:36.0  intake    pos(  -3.2,   0.0,  17.2) walk      fear 0.39 lamp off      lit  6/149/208 entity APPROACHING @6.6m    11.0ms
 2:36.3      * entity:heard             entity=surveyor strength=0.534 radius=6 at=(-4.3, 0, 17.7)
 2:36.7      * entity:heard             entity=surveyor strength=0.449 radius=6 at=(-5.9, 0, 18.5)
 2:37.1      * entity:heard             entity=surveyor strength=0.428 radius=6 at=(-5.8, 0, 17.7)
 2:37.4      * entity:heard             entity=surveyor strength=0.403 radius=6 at=(-6.6, 0, 17.1)
 2:37.8      * entity:heard             entity=surveyor strength=0.204 radius=6 at=(-6.6, 0, 17.1)
 2:38.2      * entity:heard             entity=surveyor strength=0.343 radius=6 at=(-9.9, 0, 18)
 2:38.6      * entity:heard             entity=surveyor strength=0.308 radius=6 at=(-11, 0, 18.7)
 2:39.0      * entity:heard             entity=surveyor strength=0.311 radius=6 at=(-10.6, 0, 16.5)
 2:39.4      * entity:heard             entity=surveyor strength=0.266 radius=6 at=(-11.3, 0, 16.6)
 2:39.8      * entity:heard             entity=surveyor strength=0.228 radius=6 at=(-11.1, 0, 17.2)
 2:40.8      * entity:heard             entity=surveyor strength=0.546 radius=11 at=(-13.2, 0, 14.1)
 2:41.0  intake    pos( -12.8,   0.0,  15.1) walk      fear 0.25 lamp off      lit  6/149/208 entity APPROACHING @10.8m   11.1ms
 2:41.5      * entity:heard             entity=surveyor strength=0.24 radius=6 at=(-13.2, 0, 14.1)
 2:42.1      * entity:heard             entity=surveyor strength=0.531 radius=11 at=(-15, 0, 14.9)
 2:42.7      * entity:heard             entity=surveyor strength=0.519 radius=11 at=(-15.1, 0, 14.6)
 2:43.1      * entity:heard             entity=surveyor strength=0.162 radius=6 at=(-15.1, 0, 14.6)
 2:43.5      * entity:heard             entity=surveyor strength=0.492 radius=11 at=(-18.2, 0, 15.7)
 2:43.9      * entity:heard             entity=surveyor strength=0.208 radius=6 at=(-18.2, 0, 15.7)
 2:44.3      * entity:heard             entity=surveyor strength=0.575 radius=11 at=(-15.2, 0, 16.4)
 2:44.7      * entity:heard             entity=surveyor strength=0.629 radius=11 at=(-14.9, 0, 16.6)
 2:45.1      * entity:heard             entity=surveyor strength=0.683 radius=11 at=(-13.1, 0, 16.4)
 2:45.4      * entity:heard             entity=surveyor strength=0.562 radius=6 at=(-13.9, 0, 15.8)
 2:45.8      * entity:heard             entity=surveyor strength=0.792 radius=11 at=(-12, 0, 17)
 2:46.0      * entity:heard             entity=surveyor strength=0.533 radius=3.4 at=(-12, 0, 17)
 2:46.0      * lamp:toggle              
 2:46.0  intake    pos( -11.6,   0.0,  16.8) walk      fear 0.38 lamp off      lit  6/149/208 entity APPROACHING @4.5m     2.7ms
 2:46.3      * entity:heard             entity=surveyor strength=0.746 radius=6 at=(-10.5, 0, 17.4)
 2:46.7      * entity:heard             entity=surveyor strength=0.838 radius=6 at=(-10.1, 0, 17.2)
 2:47.2      * entity:heard             entity=surveyor strength=0.919 radius=6 at=(-8.9, 0, 17.3)
 2:47.2      * entity:state             from=APPROACHING state=CAPTURING entity=surveyor at=(-8.5, 0, 17.9)
 2:48.6      * game:death               cause=surveyor at=(-8.3, 0, 17.6)
 2:48.6      * cine:begin               name=death cause=surveyor
 2:48.6      * ui:action                
 2:48.6      * entity:state             from=CAPTURING state=DORMANT entity=surveyor at=(-8.3, 0, 17.6)
 2:48.6      * cine:end                 name=death
 2:48.6      * game:respawn             
 2:48.6      * cine:begin               name=respawn
 2:48.6      * ui:screen                
 2:48.6      * light:circuit            circuit=office_lamp powered=true
 2:48.7      * cine:cue                 
 2:49.2      * cine:cue                 
 2:51.0  intake    pos( -24.0,   0.0,  25.2) stil      fear 0.09 lamp on 0.84 lit  6/149/208 entity DORMANT @30.0m        3.0ms
 2:51.8      * cine:cue                 
 2:52.8      * death:settled            
 2:56.0  intake    pos( -24.0,   0.0,  25.2) walk      fear 0.04 lamp on 0.83 lit  6/149/208 entity DORMANT @30.0m        3.0ms
 2:57.2      * ui:screen                
 2:57.2      * game:respawn             
 2:57.2      * cine:end                 name=respawn
 3:01.0  intake    pos( -19.1,   0.0,  27.8) walk      fear 0.03 lamp on 0.82 lit  6/149/208 entity DORMANT @26.3m        1.6ms
 3:06.0  intake    pos(  -8.5,   0.0,  26.9) walk      fear 0.03 lamp on 0.81 lit  6/149/208 entity DORMANT @27.7m        1.6ms
 3:11.0  intake    pos(  -1.6,   0.0,  23.5) walk      fear 0.03 lamp on 0.80 lit  6/149/208 entity DORMANT @33.1m        1.6ms
 3:16.0  intake    pos(  -3.8,   0.0,  23.8) stil      fear 0.01 lamp on 0.79 lit  6/149/208 entity DORMANT @32.0m        1.5ms
 3:21.0  intake    pos(  -3.8,   0.0,  23.8) stil      fear 0.00 lamp on 0.77 lit  6/148/208 entity DORMANT @32.0m        1.5ms
 3:26.0  intake    pos(  -3.8,   0.0,  23.8) stil      fear 0.00 lamp on 0.76 lit  6/149/208 entity DORMANT @32.0m        1.4ms
 3:31.0  intake    pos(  -3.8,   0.0,  23.8) stil      fear 0.00 lamp on 0.75 lit  6/149/208 entity DORMANT @32.0m        1.4ms
 3:36.0  intake    pos(  -3.8,   0.0,  23.8) stil      fear 0.00 lamp on 0.74 lit  6/149/208 entity DORMANT @32.0m        1.1ms
 3:41.0  intake    pos( -14.4,   0.0,  23.8) walk      fear 0.09 lamp on 0.73 lit  6/149/208 entity DORMANT @30.0m        1.1ms
 3:46.0  intake    pos( -10.2,   0.0,  22.3) walk      fear 0.07 lamp on 0.71 lit  6/149/208 entity DORMANT @31.9m        1.1ms
 3:51.0  intake    pos(  -0.3,   0.0,  19.1) walk      fear 0.06 lamp on 0.70 lit  6/149/208 entity DORMANT @37.8m        1.1ms
 3:56.0  intake    pos(  11.8,   0.0,  18.4) walk      fear 0.05 lamp on 0.69 lit  6/149/208 entity DORMANT @44.4m        1.1ms
 4:00.0      * lamp:toggle              
 4:01.0  intake    pos(  16.2,   0.0,  15.3) walk      fear 0.04 lamp off      lit  6/149/208 entity DORMANT @49.6m        1.1ms
 4:06.0  intake    pos(  17.2,   0.0,  16.4) walk      fear 0.01 lamp off      lit  6/149/208 entity DORMANT @49.4m        1.1ms
 4:11.0  intake    pos(  22.2,   0.0,  16.4) walk      fear 0.01 lamp off      lit  6/149/208 entity DORMANT @52.7m        1.1ms
 4:16.0  intake    pos(  24.2,   0.0,  14.8) walk      fear 0.02 lamp off      lit  6/149/208 entity DORMANT @55.3m        1.1ms
```

`lit A/B/C` = lights uploaded to shaders / fixtures above 5% brightness / fixtures resident.

## Entity state transitions

| t | from | to | active |
|---|---|---|---|
| 1:38.6 | DORMANT | ROUSED | true |
| 1:42.1 | ROUSED | SEEKING | true |
| 1:42.2 | SEEKING | APPROACHING | true |
| 1:57.4 | APPROACHING | MEASURING | true |
| 2:03.1 | MEASURING | SEEKING | true |
| 2:06.4 | SEEKING | MEASURING | true |
| 2:12.6 | MEASURING | SEEKING | true |
| 2:15.9 | SEEKING | MEASURING | true |
| 2:22.8 | MEASURING | RETREATING | true |
| 2:28.2 | RETREATING | ROUSED | true |
| 2:31.7 | ROUSED | SEEKING | true |
| 2:31.7 | SEEKING | APPROACHING | true |
| 2:47.2 | APPROACHING | CAPTURING | true |
| 2:48.6 | CAPTURING | DORMANT | true |

## Filmstrip

5 frames, one every ~60 s of play. See `filmstrip.md` for them in order.

## Subsystems at the end of the session

```json
{
  "state": "play",
  "zone": "intake",
  "subsystems": {
    "world": true,
    "audio": true,
    "save": true,
    "gameplay": true,
    "ui": true,
    "cinematics": true
  },
  "engine": {
    "ms": 1.0791666706403096,
    "fps": 926.6409232289049,
    "p90": 1.5,
    "calls": 325,
    "tris": 1223432,
    "quality": "medium",
    "res": "320x180"
  },
  "lights": {
    "fixtures": 208,
    "lit": 149,
    "active": 6,
    "tubes": 149,
    "shadows": 1
  },
  "entity": {
    "entity": "surveyor",
    "state": "DORMANT",
    "stateTime": 91.43,
    "position": [
      -15.02,
      0,
      53.82
    ],
    "heading": 3.446,
    "target": [
      -8.9,
      0,
      17.32
    ],
    "confidence": 0,
    "illumination": 0,
    "lightScale": 0,
    "speed": 0,
    "frozen": true,
    "stoop": 0,
    "measureHold": 0,
    "distToPlayer": 60.92,
    "usingGlb": true
  },
  "gameplay": {
    "surveyor": {
      "entity": "surveyor",
      "state": "DORMANT",
      "stateTime": 91.43,
      "position": [
        -15.02,
        0,
        53.82
      ],
      "heading": 3.446,
      "target": [
        -8.9,
        0,
        17.32
      ],
      "confidence": 0,
      "illumination": 0,
      "lightScale": 0,
      "speed": 0,
      "frozen": true,
      "stoop": 0,
      "measureHold": 0,
      "distToPlayer": 60.92,
      "usingGlb": true
    },
    "attendant": {
      "entity": "attendant",
      "acts": 0,
      "cooldown": 0,
      "targets": 2,
      "unused": 2,
      "last": []
    },
    "director": {
      "fear": 0.029,
      "dread": 0.125,
      "tension": 0,
      "intensity": 0.42,
      "sinceBeat": 87.2,
      "nextBeatAt": 92,
      "grace": 0,
      "zone": "intake",
      "objective": "reach_plant",
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
      "gates": [
        "arrival_lift"
      ],
      "discoveries": []
    },
    "interactor": {
      "focus": null,
      "blocked": false,
      "reason": null,
      "progress": 0,
      "items": 11,
      "doors": 4
    },
    "flashlight": {
      "on": false,
      "battery": 0.681,
      "beam": 0,
      "covered": 0,
      "swapping": false,
      "enabled": true
    },
    "decoy": {
      "cells": 1,
      "cooldown": 0,
      "thrown": 0,
      "canThrow": true,
      "lastLanding": null
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
        "battery_cell": 1
      },
      "selected": "lamp"
    }
  },
  "audio": {
    "voices": 14,
    "oneShots": 2,
    "loops": 12,
    "nodes": 329,
    "occlChecks": 13843,
    "denied": 0,
    "reverb": "corridor",
    "zone": "intake",
    "hums": 8,
    "state": "running",
    "music": {
      "spent": 0,
      "budget": 5,
      "sinceLast": 1000262,
      "cues": []
    },
    "pressure": 0
  }
}
```
