# THE ANNEX — continuous playthrough

Generated 2026-07-31T10:22:18.063Z by `tools/qa/playthrough.mjs`.

**30600 frames · 510.0 s of simulated play at a fixed 1/60 step · 1230 s of wall clock · quality `low` · 480×270**

This is the first continuous session ever run on this build. Movement, sprint, crouch, the
lamp key and the interact key are real DOM keyboard events; mouse look is written into the
field a locked pointer would write, because headless Chromium cannot grant pointer lock.
Frame times come from a CPU rasteriser and are not a frame-rate verdict.

## Assertions

| | check | detail |
|---|---|---|
| **FAIL** | no console errors during the session | The root document of this element is not valid for pointer lock. |
| **PASS** | player position never NaN | 0 frames |
| **PASS** | player never falls through the floor | y -6.00..2.60; frames not standing on a floor: 0 of 30600 (worst consecutive run 0) |
| **FAIL** | the frame loop never stalls (no frame > 5 s) | max 34385 ms, p99 2 ms, p50 0.10 ms |
| **PASS** | post-warmup frame times stay bounded (p99 < 250 ms) | warm p50 0.10 ms, p90 0.20 ms, p99 1.80 ms |
| **PASS** | simulated time advanced continuously | 30600 frames |
| **PASS** | at least one entity state transition occurred | DORMANT->ROUSED@152.87s, ROUSED->SEEKING@156.37s, SEEKING->MEASURING@171.87s, MEASURING->SEEKING@177.67s, SEEKING->MEASURING@180.97s, MEASURING->SEEKING@189.4s, SEEKING->MEASURING@192.7s, MEASURING->RETREATING@200.82s, RETREATING->DORMANT@218.82s, DORMANT->ROUSED@220.95s, ROUSED->SEEKING@224.45s, SEEKING->MEASURING@235.85s, MEASURING->SEEKING@239.58s, SEEKING->APPROACHING@245.85s, APPROACHING->CAPTURING@253.03s, CAPTURING->DORMANT@254.4s |
| **PASS** | audio subsystem reports as constructed | subsystems.audio=true, ctx state=running |
| **PASS** | footsteps fired while walking | 421 player:step events |
| **PASS** | every zone visited reported lit fixtures | min active lights = 1 |
| **PASS** | the session did not get stuck inside a hiding place | 13 of 503 samples were spent hidden |
| **PASS** | at least one interactable was operated | locker_intake_enter:pressed; locker_intake_enter:pressed; note_4156_-74:pressed; board_c_way5:pressed; board_c_way2:pressed; board_c_way2:pressed; penstock_1:completed a hold; set_2_socket0:refused: You are not carrying a core.; set_2_socket0:refused: You are not carrying a core.; set_2_socket0:refused: You are not carrying a core.; lift_2_call:refused: Dead. Three-phase is out.; lift_2_call:refused: Dead. Three-phase is out.; lift_2_call:refused: Dead. Three-phase is out.; terminal_record_dial:pressed; note_3993_8019:pressed |
| **PASS** | the player was able to move for most of the session | 96% of samples had controls enabled |
| **PASS** | the session never sat on the death screen | 0.0% of samples were dead; 1 revive(s) |

**2 check(s) failed.**

## Interactions

| at | interactable | verb | result |
|---|---|---|---|
| 1:53.1 | `locker_intake_enter` | Get in | pressed |
| 2:06.0 | `locker_intake_enter` | Get out | pressed |
| 5:49.4 | `note_4156_-74` | Read | pressed |
| 5:51.7 | `board_c_way5` | Reset | pressed |
| 5:52.6 | `board_c_way2` | Trip | pressed |
| 6:08.1 | `board_c_way2` | Reset | pressed |
| 6:40.2 | `penstock_1` | Close | completed a hold |
| 8:02.9 | `set_2_socket0` | Fit core | refused: You are not carrying a core. |
| 8:03.3 | `set_2_socket0` | Fit core | refused: You are not carrying a core. |
| 8:03.6 | `set_2_socket0` | Fit core | refused: You are not carrying a core. |
| 8:07.1 | `lift_2_call` | Call | refused: Dead. Three-phase is out. |
| 8:07.5 | `lift_2_call` | Call | refused: Dead. Three-phase is out. |
| 8:07.9 | `lift_2_call` | Call | refused: Dead. Three-phase is out. |
| 8:28.5 | `terminal_record_dial` | Turn | pressed |
| 8:29.1 | `note_3993_8019` | Read | pressed |

Objective state at the end: `{"objective":"core_cistern","completed":1,"cores":{"found":0,"fitted":0},"running":false,"ended":null,"gates":["arrival_lift","to_plant","to_cistern_pipes","to_stack","to_residence","exit_lift"],"discoveries":["office"]}`
Carried: `{"items":{"lamp":1},"selected":"lamp"}`
Interactor registry: 78 items, 19 doors.

## Pacing

- **Session length:** 510.0 s (8.5 min) of play.
- **Zero-threat time:** 64.0% of samples had no active entity and fear below 0.15.
- **The Surveyor was active at some point.**
- **Threat episodes:** 2 — 65s (ROUSED→SEEKING→MEASURING→RETREATING, closest 10.68 m); 33s (ROUSED→SEEKING→MEASURING→APPROACHING→CAPTURING, closest 1.03 m)
- **Fear:** median 0.024, p90 0.269, peak 0.544. Above 0.3 for 1.6% of the session, above 0.5 for 0.2%.
- **Director beats fired:** 1 — distant_door at 1:47.9
- **Longest stretch with nothing on the bus except footsteps:** 510.0 s (0:00.0 → 8:30.0).
- **Moving:** 43% of samples.
- **Zones:** intake (0:01.0–5:05.0) → service (5:06.5–6:08.5) → cistern (6:10.0–7:17.0) → plant (7:18.5–8:08.5) → safe (8:10.0–8:30.0)

### Frame time (CPU rasteriser — not a frame-rate verdict)

| | p50 | p90 | p99 | max |
|---|---:|---:|---:|---:|
| whole session | 0.10 | 0.20 | 1.80 | 34385 |
| after 3 s warmup | 0.10 | 0.20 | 1.80 | 34385 |

All in milliseconds. The multi-second outliers are first-frame shader compiles
after a camera or zone change, which is a property of SwiftShader, not of the renderer.

## Event census

| event | count |
|---|---:|
| `player:noise` | 515 |
| `player:step` | 421 |
| `entity:tick` | 302 |
| `entity:heard` | 65 |
| `qa:phase` | 43 |
| `entity:state` | 16 |
| `interact:use` | 9 |
| `sfx:valve` | 9 |
| `ui:refuse` | 8 |
| `lamp:toggle` | 5 |
| `qa:scripted-reposition` | 5 |
| `light:circuit` | 4 |
| `zone:build` | 4 |
| `zone:leave` | 4 |
| `world:teleport` | 4 |
| `zone:enter` | 4 |
| `qa:scripted-zone-change` | 4 |
| `cine:cue` | 3 |
| `sfx:breaker` | 3 |
| `cine:begin` | 2 |
| `cine:end` | 2 |
| `game:respawn` | 2 |
| `ui:screen` | 2 |
| `story:note` | 2 |
| `pickup:taken` | 2 |
| `zone:unload` | 2 |
| `director:entity-placed` | 1 |
| `director:beat` | 1 |
| `sfx:distant` | 1 |
| `world:noise` | 1 |
| `hide:enter` | 1 |
| `hide:exit` | 1 |
| `game:death` | 1 |
| `ui:action` | 1 |
| `death:settled` | 1 |
| `valve:turn` | 1 |
| `lift:power` | 1 |
| `progress:complete` | 1 |
| `progress:objective` | 1 |
| `progress:discovery` | 1 |
| `sfx:detent` | 1 |
| `terminal:dial` | 1 |

## Timeline

State every 5 s; every non-footstep event at the moment it fired. Footsteps and noise
events are counted in the census above rather than listed, because there are hundreds.

```

 0:00.0  ── arrival — standing still, taking the room in ──
 0:01.0  intake    pos( -24.0,   0.0,  24.8) stil      fear 0.00 lamp on 0.99 lit  6/149/208 entity not spawned        7535.1ms
 0:06.0  intake    pos( -24.0,   0.0,  24.8) stil      fear 0.00 lamp on 0.98 lit  6/149/208 entity not spawned        3213.4ms

 0:08.0  ── first walk, no lamp ──
 0:11.0  intake    pos( -19.9,   0.0,  23.1) walk      fear 0.03 lamp on 0.97 lit  6/149/208 entity not spawned        2144.7ms
 0:16.0  intake    pos(  -9.3,   0.0,  23.4) walk      fear 0.03 lamp on 0.96 lit  6/149/208 entity not spawned        1941.6ms
 0:19.9      * director:entity-placed   
 0:19.9      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:21.0  intake    pos(   0.2,   0.0,  22.2) walk      fear 0.03 lamp on 0.94 lit  6/149/208 entity DORMANT @24.2m     1580.3ms
 0:21.6      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:23.2      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:23.9      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:25.1      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:26.0  intake    pos(   2.8,   0.0,  17.9) walk      fear 0.03 lamp on 0.93 lit  6/149/208 entity DORMANT @22.2m     1303.0ms
 0:26.2      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:28.2      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:29.9      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:30.6      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:31.0  intake    pos(  -2.0,   0.0,  17.6) walk      fear 0.03 lamp on 0.92 lit  6/149/208 entity DORMANT @26.9m      515.8ms
 0:31.8      * entity:tick              entity=surveyor at=(24.4, 0, 23)

 0:32.0  ── INTERACT: take the nearest thing off the floor ──
 0:33.4      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:34.3      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:35.1      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:36.0  intake    pos( -10.0,   0.0,  15.1) walk      fear 0.02 lamp on 0.91 lit  6/149/208 entity DORMANT @35.3m      338.9ms
 0:36.4      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:38.1      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:40.0      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:40.8      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:41.0  intake    pos( -10.3,   0.0,  15.1) walk      fear 0.01 lamp on 0.90 lit  6/149/208 entity DORMANT @35.6m      342.0ms
 0:41.5      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:42.8      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:43.8      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:45.1      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:46.0  intake    pos( -10.6,   0.0,  15.1) stil      fear 0.01 lamp on 0.89 lit  6/149/208 entity DORMANT @35.9m       93.5ms
 0:46.4      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:47.5      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:48.4      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:49.9      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:51.0  intake    pos( -11.1,   0.0,  15.1) stil      fear 0.01 lamp on 0.87 lit  6/149/208 entity DORMANT @36.4m      279.4ms
 0:51.5      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:52.1      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:53.0      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:53.7      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:54.4      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:54.9      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 0:56.0  intake    pos(  -9.8,   0.0,  15.1) walk      fear 0.00 lamp on 0.86 lit  6/149/208 entity DORMANT @35.0m      290.2ms
 0:56.5      * entity:tick              entity=surveyor at=(24.4, 0, 23)

 0:58.0  ── lamp on ──
 0:58.0      * lamp:toggle              
 0:58.4      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:00.5      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:01.0  intake    pos( -10.9,   0.0,  15.1) stil      fear 0.00 lamp off      lit  6/149/208 entity DORMANT @36.2m      331.4ms
 1:01.3      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:03.3      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:04.1      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:05.7      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:06.0  intake    pos( -10.9,   0.0,  15.1) stil      fear 0.00 lamp off      lit  6/148/208 entity DORMANT @36.2m      514.0ms
 1:07.1      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:08.0      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:10.0      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:11.0  intake    pos( -10.9,   0.0,  15.1) stil      fear 0.00 lamp off      lit  6/149/208 entity DORMANT @36.2m      516.4ms
 1:11.3      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:12.5      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:13.5      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:14.3      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:15.1      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:16.0  intake    pos( -10.9,   0.0,  15.1) stil      fear 0.00 lamp off      lit  6/149/208 entity DORMANT @36.2m      525.5ms
 1:16.2      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:17.2      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:18.2      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:19.5      * entity:tick              entity=surveyor at=(24.4, 0, 23)

 1:20.0  ── stop and listen (lamp on) ──
 1:21.0  intake    pos( -10.9,   0.0,  15.1) stil      fear 0.00 lamp off      lit  6/149/208 entity DORMANT @36.2m      551.5ms
 1:21.5      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:22.5      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:23.3      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:23.9      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:25.1      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:26.0  intake    pos( -10.9,   0.0,  15.1) stil      fear 0.00 lamp off      lit  6/149/208 entity DORMANT @36.2m      332.9ms
 1:27.1      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:27.7      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:28.4      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:29.6      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:31.0      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:31.0  intake    pos( -10.9,   0.0,  15.1) stil      fear 0.00 lamp off      lit  6/149/208 entity DORMANT @36.2m      288.5ms
 1:32.3      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:34.2      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:35.1      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:36.0  intake    pos( -10.9,   0.0,  15.1) stil      fear 0.00 lamp off      lit  6/149/208 entity DORMANT @36.2m      310.5ms
 1:36.4      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:37.8      * entity:tick              entity=surveyor at=(24.4, 0, 23)

 1:38.0  ── INTERACT: get into the locker by the lift ──
 1:38.8      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:40.6      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:41.0  intake    pos( -14.3,   0.0,  18.7) walk      fear 0.03 lamp off      lit  6/149/208 entity DORMANT @38.9m      179.3ms
 1:41.7      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:43.3      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:44.7      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:45.8      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:46.0  intake    pos( -22.9,   0.0,  20.6) walk      fear 0.02 lamp off      lit  6/149/208 entity DORMANT @47.4m      308.3ms
 1:47.3      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:47.9      * director:beat            zone=intake name=distant_door fear=0.02
 1:47.9      * sfx:distant              kind=door at=(-31.8, 0, 36.2)
 1:48.8      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:50.9      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:51.0  intake    pos( -28.7,   0.0,  23.4) walk      fear 0.02 lamp off      lit  6/149/208 entity DORMANT @53.1m      342.6ms
 1:52.8      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:53.1      * hide:enter               id=locker_intake kind=locker at=(-31.1, 0, 29.1)
 1:53.1      * interact:use             id=locker_intake_enter kind=hide

 1:54.0  ── inside the locker — two louvre slots and your own breathing ──
 1:54.7      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:56.0  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/149/208 entity DORMANT @55.8m      382.3ms
 1:56.3      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:56.9      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:58.7      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 1:59.6      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 2:01.0  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/149/208 entity DORMANT @55.8m      445.0ms
 2:01.3      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 2:02.8      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 2:03.8      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 2:05.1      * entity:tick              entity=surveyor at=(24.4, 0, 23)

 2:06.0  ── INTERACT: get out of the locker ──
 2:06.0      * hide:exit                id=locker_intake kind=locker
 2:06.0      * interact:use             id=locker_intake_enter kind=hide
 2:06.0  intake    pos( -31.1,   0.0,  29.1) stil      fear 0.29 lamp off      lit  6/149/208 entity DORMANT @55.8m      426.9ms
 2:06.0      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 2:06.7      * entity:tick              entity=surveyor at=(24.4, 0, 23)

 2:07.0  ── crouch-walk — nearly silent ──
 2:07.6      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 2:09.0      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 2:09.9      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 2:11.0  intake    pos( -28.8,   0.0,  26.4) walk crch fear 0.05 lamp off      lit  6/149/208 entity DORMANT @53.2m      536.4ms
 2:11.3      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 2:12.9      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 2:14.1      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 2:16.0  intake    pos( -25.2,   0.0,  23.6) walk crch fear 0.02 lamp off      lit  6/149/208 entity DORMANT @49.6m      796.6ms
 2:16.1      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 2:17.3      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 2:19.2      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 2:21.0  intake    pos( -19.8,   0.0,  23.6) walk crch fear 0.01 lamp off      lit  6/149/208 entity DORMANT @44.2m      841.4ms
 2:21.3      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 2:22.2      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 2:23.7      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 2:24.8      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 2:26.0  intake    pos( -14.4,   0.0,  23.6) walk crch fear 0.01 lamp off      lit  6/149/208 entity DORMANT @38.8m      963.0ms
 2:26.2      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 2:27.0      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 2:28.7      * entity:tick              entity=surveyor at=(24.4, 0, 23)

 2:29.0  ── sprint — deliberately loud ──
 2:29.6      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 2:30.4      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 2:31.0  intake    pos(  -4.5,   0.0,  23.8) walk      fear 0.08 lamp off      lit  6/149/208 entity DORMANT @28.9m     1131.4ms
 2:32.0      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 2:32.8      * entity:state             from=DORMANT state=ROUSED entity=surveyor at=(24.4, 0, 23)
 2:32.8      * entity:heard             entity=surveyor strength=0.066 radius=11 at=(2.4, 0, 23.1)
 2:33.2      * entity:heard             entity=surveyor strength=0.11 radius=11 at=(2.4, 0, 23.1)
 2:33.4      * entity:heard             entity=surveyor strength=0.154 radius=11 at=(2.4, 0, 23.1)
 2:33.6      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 2:35.4      * entity:tick              entity=surveyor at=(24.4, 0, 23)
 2:35.7      * entity:heard             entity=surveyor strength=0.076 radius=11 at=(2.4, 0, 23.1)
 2:36.0  intake    pos(   6.2,   0.0,  18.6) walk      fear 0.08 lamp off      lit  6/149/208 entity ROUSED @18.7m      1179.7ms
 2:36.1      * entity:heard             entity=surveyor strength=0.074 radius=11 at=(2.4, 0, 23.1)
 2:36.3      * entity:state             from=ROUSED state=SEEKING entity=surveyor at=(24.4, 0, 23)
 2:37.2      * entity:tick              entity=surveyor at=(23.9, 0, 23)
 2:38.3      * entity:tick              entity=surveyor at=(23, 0, 23)
 2:38.3      * entity:heard             entity=surveyor strength=0.16 radius=11 at=(2.4, 0, 23.1)
 2:38.7      * entity:heard             entity=surveyor strength=0.177 radius=11 at=(2.4, 0, 23.1)
 2:39.1      * entity:heard             entity=surveyor strength=0.192 radius=11 at=(2.4, 0, 23.1)
 2:39.5      * entity:heard             entity=surveyor strength=0.194 radius=11 at=(2.4, 0, 23.1)
 2:39.8      * entity:tick              entity=surveyor at=(21.8, 0, 23)
 2:39.9      * entity:heard             entity=surveyor strength=0.09 radius=6 at=(2.4, 0, 23.1)
 2:40.3      * entity:heard             entity=surveyor strength=0.075 radius=6 at=(2.4, 0, 23.1)
 2:40.7      * entity:heard             entity=surveyor strength=0.062 radius=6 at=(2.4, 0, 23.1)
 2:41.0  intake    pos(   9.2,   0.0,  19.9) walk      fear 0.16 lamp off      lit  6/149/208 entity SEEKING @12.2m     1259.5ms
 2:41.1      * entity:tick              entity=surveyor at=(20.8, 0, 23.2)
 2:42.5      * entity:tick              entity=surveyor at=(19.7, 0, 23.5)
 2:42.6      * entity:heard             entity=surveyor strength=0.132 radius=11 at=(2.4, 0, 23.1)
 2:43.0      * entity:heard             entity=surveyor strength=0.123 radius=11 at=(2.4, 0, 23.1)
 2:43.5      * entity:tick              entity=surveyor at=(18.9, 0, 23.5)
 2:43.8      * entity:heard             entity=surveyor strength=0.272 radius=11 at=(2.4, 0, 23.1)
 2:44.2      * entity:heard             entity=surveyor strength=0.256 radius=11 at=(2.4, 0, 23.1)
 2:44.3      * entity:tick              entity=surveyor at=(18.2, 0, 23.5)
 2:46.0  intake    pos(  -0.1,   0.0,  21.7) walk      fear 0.09 lamp off      lit  6/149/208 entity SEEKING @17.1m      884.6ms
 2:46.3      * entity:tick              entity=surveyor at=(16.6, 0, 23.5)
 2:46.4      * entity:heard             entity=surveyor strength=0.349 radius=11 at=(2.3, 0, 21)
 2:46.8      * entity:heard             entity=surveyor strength=0.403 radius=11 at=(1.3, 0, 22.8)

 2:47.0  ── walk on, lamp off (the entity only moves in light) ──
 2:47.0      * lamp:toggle              
 2:47.3      * entity:heard             entity=surveyor strength=0.081 radius=6 at=(1.3, 0, 22.8)
 2:47.7      * entity:heard             entity=surveyor strength=0.093 radius=6 at=(1.3, 0, 22.8)
 2:47.8      * entity:tick              entity=surveyor at=(15.4, 0, 23.5)
 2:48.7      * entity:tick              entity=surveyor at=(14.6, 0, 23.5)
 2:49.8      * entity:tick              entity=surveyor at=(13.7, 0, 23.5)
 2:50.7      * entity:tick              entity=surveyor at=(13, 0, 23.5)
 2:51.0  intake    pos(  -2.9,   0.0,  18.1) walk      fear 0.08 lamp on 0.85 lit  6/149/208 entity SEEKING @16.6m      864.7ms
 2:51.4      * entity:tick              entity=surveyor at=(12.5, 0, 23.5)
 2:51.8      * entity:state             from=SEEKING state=MEASURING entity=surveyor at=(12.1, 0, 23.5)
 2:52.1      * entity:tick              entity=surveyor at=(12.1, 0, 23.5)
 2:55.7      * entity:tick              entity=surveyor at=(12.1, 0, 23.5)
 2:56.0  intake    pos( -11.9,   0.0,  15.1) stil      fear 0.04 lamp on 0.84 lit  6/149/208 entity MEASURING @25.4m   1037.3ms
 2:57.7      * entity:state             from=MEASURING state=SEEKING entity=surveyor at=(12.1, 0, 23.5)
 2:58.4      * entity:tick              entity=surveyor at=(11.7, 0, 23.6)
 2:59.8      * entity:tick              entity=surveyor at=(10.7, 0, 24)
 3:00.9      * entity:state             from=SEEKING state=MEASURING entity=surveyor at=(9.8, 0, 24.4)
 3:01.0  intake    pos(  -9.5,   0.0,  15.1) walk      fear 0.01 lamp on 0.82 lit  6/149/208 entity MEASURING @21.4m    994.4ms
 3:01.7      * entity:tick              entity=surveyor at=(9.8, 0, 24.4)
 3:04.5      * entity:tick              entity=surveyor at=(9.8, 0, 24.4)
 3:06.0  intake    pos(  -4.6,   0.0,  15.2) walk      fear 0.03 lamp on 0.81 lit  6/149/208 entity MEASURING @17.1m   1107.7ms
 3:06.9      * entity:tick              entity=surveyor at=(9.8, 0, 24.4)
 3:09.4      * entity:state             from=MEASURING state=SEEKING entity=surveyor at=(9.8, 0, 24.4)
 3:10.9      * entity:tick              entity=surveyor at=(8.9, 0, 24.7)
 3:11.0  intake    pos(  -9.5,   0.0,  17.4) walk      fear 0.03 lamp on 0.80 lit  6/149/208 entity SEEKING @19.7m     1200.1ms
 3:12.7      * entity:state             from=SEEKING state=MEASURING entity=surveyor at=(7.5, 0, 25.3)
 3:12.9      * entity:tick              entity=surveyor at=(7.5, 0, 25.3)

 3:13.0  ── stand in the dark and wait ──
 3:16.0  intake    pos(  -5.2,   0.0,  17.6) stil      fear 0.04 lamp on 0.79 lit  6/149/208 entity MEASURING @14.8m   1336.7ms
 3:17.4      * entity:tick              entity=surveyor at=(7.5, 0, 25.3)
 3:20.4      * entity:tick              entity=surveyor at=(7.5, 0, 25.3)
 3:20.8      * entity:state             from=MEASURING state=RETREATING entity=surveyor at=(7.5, 0, 25.3)
 3:21.0  intake    pos(  -5.2,   0.0,  17.6) stil      fear 0.03 lamp on 0.78 lit  6/148/208 entity RETREATING @14.8m  1366.0ms
 3:24.5      * entity:tick              entity=surveyor at=(8.2, 0, 26.3)
 3:26.0  intake    pos(  -5.2,   0.0,  17.6) stil      fear 0.02 lamp on 0.76 lit  6/149/208 entity RETREATING @16.9m  1031.3ms
 3:26.4      * entity:tick              entity=surveyor at=(9.4, 0, 26.7)
 3:28.0      * entity:tick              entity=surveyor at=(10.4, 0, 27.1)
 3:29.8      * entity:tick              entity=surveyor at=(11.5, 0, 27.6)
 3:30.4      * entity:tick              entity=surveyor at=(11.8, 0, 27.8)
 3:31.0  intake    pos(  -5.2,   0.0,  17.6) stil      fear 0.01 lamp on 0.75 lit  6/149/208 entity RETREATING @20.2m  1139.0ms
 3:31.3      * entity:tick              entity=surveyor at=(12.3, 0, 28)
 3:33.0      * entity:tick              entity=surveyor at=(13.4, 0, 28.4)
 3:34.4      * entity:tick              entity=surveyor at=(14.3, 0, 28.8)
 3:35.7      * entity:tick              entity=surveyor at=(15, 0, 29.1)
 3:36.0  intake    pos(  -5.2,   0.0,  17.6) stil      fear 0.00 lamp on 0.74 lit  6/149/208 entity RETREATING @23.4m  1149.8ms
 3:36.4      * entity:tick              entity=surveyor at=(15.5, 0, 29.2)
 3:38.1      * entity:tick              entity=surveyor at=(16.6, 0, 29.2)
 3:38.8      * entity:state             from=RETREATING state=DORMANT entity=surveyor at=(17, 0, 29.2)

 3:39.0  ── SCRIPTED: spawn the Surveyor 26 m away, dormant ──

 3:39.0  ── sprint past it — loud enough to be heard ──
 3:40.2      * entity:tick              entity=surveyor at=(17, 0, 29.2)
 3:40.9      * entity:state             from=DORMANT state=ROUSED entity=surveyor at=(17, 0, 29.2)
 3:40.9      * entity:heard             entity=surveyor strength=0.065 radius=11 at=(1.1, 0, 21)
 3:41.0  intake    pos(   1.0,   0.0,  18.7) walk      fear 0.08 lamp on 0.73 lit  6/149/208 entity ROUSED @19.1m      1090.4ms
 3:41.2      * entity:heard             entity=surveyor strength=0.079 radius=11 at=(1.1, 0, 21)
 3:41.5      * entity:heard             entity=surveyor strength=0.093 radius=11 at=(1.1, 0, 21)
 3:41.8      * entity:tick              entity=surveyor at=(17, 0, 29.2)
 3:41.8      * entity:heard             entity=surveyor strength=0.108 radius=11 at=(1.1, 0, 21)
 3:42.1      * entity:heard             entity=surveyor strength=0.121 radius=11 at=(1.1, 0, 21)
 3:42.4      * entity:heard             entity=surveyor strength=0.325 radius=11 at=(1.1, 0, 21)
 3:42.7      * entity:heard             entity=surveyor strength=0.359 radius=11 at=(1.1, 0, 21)
 3:43.0      * entity:tick              entity=surveyor at=(17, 0, 29.2)
 3:43.0      * entity:heard             entity=surveyor strength=0.325 radius=11 at=(1.1, 0, 21)
 3:43.3      * entity:heard             entity=surveyor strength=0.29 radius=11 at=(1.1, 0, 21)
 3:43.6      * entity:heard             entity=surveyor strength=0.252 radius=11 at=(1.1, 0, 21)
 3:44.0      * entity:tick              entity=surveyor at=(17, 0, 29.2)
 3:44.4      * entity:state             from=ROUSED state=SEEKING entity=surveyor at=(17, 0, 29.2)
 3:44.7      * entity:heard             entity=surveyor strength=0.142 radius=11 at=(1.1, 0, 21)
 3:45.1      * entity:heard             entity=surveyor strength=0.097 radius=11 at=(1.1, 0, 21)
 3:45.8      * entity:tick              entity=surveyor at=(17.4, 0, 29)
 3:46.0  intake    pos(  -5.9,   0.0,  23.6) walk      fear 0.09 lamp on 0.72 lit  6/149/208 entity SEEKING @23.9m     1148.2ms
 3:46.9      * entity:tick              entity=surveyor at=(17.4, 0, 28.5)
 3:48.0      * entity:tick              entity=surveyor at=(16.9, 0, 28.1)
 3:49.9      * entity:tick              entity=surveyor at=(15.5, 0, 27.5)
 3:50.6      * entity:tick              entity=surveyor at=(15, 0, 27.3)
 3:51.0  intake    pos( -17.8,   0.0,  22.2) walk      fear 0.05 lamp on 0.70 lit  6/149/208 entity SEEKING @32.9m     1076.9ms
 3:52.2      * entity:tick              entity=surveyor at=(13.8, 0, 27.1)
 3:53.9      * entity:tick              entity=surveyor at=(12.5, 0, 26.5)
 3:55.3      * entity:tick              entity=surveyor at=(11.4, 0, 26.1)
 3:55.8      * entity:state             from=SEEKING state=MEASURING entity=surveyor at=(11, 0, 25.9)
 3:56.0  intake    pos(  -9.8,   0.0,  21.4) walk      fear 0.05 lamp on 0.69 lit  6/149/208 entity MEASURING @21.3m   1085.2ms
 3:56.4      * entity:heard             entity=surveyor strength=0.154 radius=11 at=(-8.3, 0, 21.7)
 3:56.6      * entity:tick              entity=surveyor at=(11, 0, 25.9)
 3:59.0      * entity:heard             entity=surveyor strength=0.385 radius=11 at=(-3.4, 0, 21.4)
 3:59.4      * entity:heard             entity=surveyor strength=0.425 radius=11 at=(-2.6, 0, 20.2)
 3:59.6      * entity:state             from=MEASURING state=SEEKING entity=surveyor at=(11, 0, 25.9)
 3:59.8      * entity:heard             entity=surveyor strength=0.465 radius=11 at=(-1.8, 0, 20.2)
 4:00.2      * entity:heard             entity=surveyor strength=0.513 radius=11 at=(-0.3, 0, 21.7)
 4:00.5      * entity:tick              entity=surveyor at=(10.5, 0, 25.7)
 4:00.5      * entity:heard             entity=surveyor strength=0.242 radius=6 at=(-0.3, 0, 21.7)
 4:00.9      * entity:heard             entity=surveyor strength=0.238 radius=6 at=(-0.3, 0, 21.7)

 4:01.0  ── lamp on and keep moving (it only advances in light) ──
 4:01.0      * lamp:toggle              
 4:01.0  intake    pos(   0.7,   0.0,  19.8) walk      fear 0.15 lamp on 0.68 lit  6/149/208 entity SEEKING @11.0m     1043.2ms
 4:01.3      * entity:heard             entity=surveyor strength=0.203 radius=6 at=(-0.3, 0, 21.7)
 4:01.8      * entity:heard             entity=surveyor strength=0.179 radius=6 at=(-0.3, 0, 21.7)
 4:02.1      * entity:tick              entity=surveyor at=(9.3, 0, 25.2)
 4:02.3      * entity:heard             entity=surveyor strength=0.149 radius=6 at=(-0.3, 0, 21.7)
 4:02.7      * entity:heard             entity=surveyor strength=0.122 radius=6 at=(-0.3, 0, 21.7)
 4:03.1      * entity:tick              entity=surveyor at=(8.5, 0, 24.9)
 4:03.2      * entity:heard             entity=surveyor strength=0.136 radius=6 at=(-0.3, 0, 21.7)
 4:03.6      * entity:heard             entity=surveyor strength=0.201 radius=6 at=(-0.3, 0, 21.7)
 4:04.1      * entity:heard             entity=surveyor strength=0.286 radius=6 at=(-0.3, 0, 21.7)
 4:04.5      * entity:heard             entity=surveyor strength=0.375 radius=6 at=(-0.3, 0, 21.7)
 4:04.9      * entity:heard             entity=surveyor strength=0.452 radius=6 at=(-0.3, 0, 21.7)
 4:05.2      * entity:tick              entity=surveyor at=(7, 0, 24.2)
 4:05.4      * entity:heard             entity=surveyor strength=0.54 radius=6 at=(3.2, 0, 18)
 4:05.8      * entity:heard             entity=surveyor strength=0.625 radius=6 at=(3.2, 0, 19)
 4:05.8      * entity:state             from=SEEKING state=APPROACHING entity=surveyor at=(6.5, 0, 24)
 4:05.9      * entity:tick              entity=surveyor at=(6.5, 0, 23.9)
 4:06.0  intake    pos(   2.9,   0.0,  20.2) walk      fear 0.28 lamp off      lit  6/149/208 entity APPROACHING @5.1m   808.2ms
 4:06.3      * entity:heard             entity=surveyor strength=0.666 radius=6 at=(2, 0, 20.5)
 4:06.6      * entity:tick              entity=surveyor at=(6, 0, 23.5)
 4:06.8      * entity:heard             entity=surveyor strength=0.646 radius=6 at=(1.1, 0, 20.9)
 4:07.2      * entity:heard             entity=surveyor strength=0.614 radius=6 at=(0.8, 0, 20.7)
 4:07.7      * entity:heard             entity=surveyor strength=0.585 radius=6 at=(0.1, 0, 20)
 4:08.1      * entity:heard             entity=surveyor strength=0.6 radius=6 at=(0, 0, 20.3)
 4:08.3      * entity:tick              entity=surveyor at=(4.7, 0, 22.8)
 4:08.6      * entity:heard             entity=surveyor strength=0.655 radius=6 at=(1.6, 0, 19.2)
 4:09.0      * entity:heard             entity=surveyor strength=0.665 radius=6 at=(2, 0, 18.2)
 4:09.5      * entity:heard             entity=surveyor strength=0.703 radius=6 at=(3.7, 0, 17.9)
 4:09.8      * entity:tick              entity=surveyor at=(3.8, 0, 22)
 4:09.9      * entity:heard             entity=surveyor strength=0.758 radius=6 at=(3.7, 0, 18.7)
 4:10.4      * entity:heard             entity=surveyor strength=0.796 radius=6 at=(4.4, 0, 18)
 4:10.8      * entity:heard             entity=surveyor strength=0.805 radius=6 at=(5.6, 0, 18.7)
 4:11.0  intake    pos(   5.8,   0.0,  18.9) walk      fear 0.44 lamp off      lit  6/149/208 entity APPROACHING @2.8m   886.7ms
 4:11.3      * entity:tick              entity=surveyor at=(3.8, 0, 20.7)
 4:11.3      * entity:heard             entity=surveyor strength=0.776 radius=6 at=(6.5, 0, 19)
 4:11.8      * entity:heard             entity=surveyor strength=0.76 radius=6 at=(7.8, 0, 19.6)
 4:12.2      * entity:heard             entity=surveyor strength=0.789 radius=6 at=(7.6, 0, 19.7)
 4:12.5      * entity:tick              entity=surveyor at=(4.4, 0, 19.9)
 4:12.7      * entity:heard             entity=surveyor strength=0.862 radius=6 at=(6.3, 0, 21)
 4:13.0      * entity:state             from=APPROACHING state=CAPTURING entity=surveyor at=(4.8, 0, 19.8)
 4:14.0      * entity:tick              entity=surveyor at=(4.9, 0, 19.9)
 4:14.4      * game:death               cause=surveyor at=(4.7, 0, 20)
 4:14.4      * cine:begin               name=death cause=surveyor
 4:14.4      * ui:action                
 4:14.4      * entity:state             from=CAPTURING state=DORMANT entity=surveyor at=(4.7, 0, 20)
 4:14.4      * cine:end                 name=death
 4:14.4      * game:respawn             
 4:14.4      * cine:begin               name=respawn
 4:14.4      * ui:screen                
 4:14.4      * light:circuit            circuit=office_lamp powered=true
 4:14.5      * cine:cue                 
 4:15.0      * cine:cue                 
 4:15.6      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:16.0  intake    pos( -24.0,   0.0,  25.2) stil      fear 0.12 lamp off      lit  6/149/208 entity DORMANT @30.0m      776.2ms
 4:16.7      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:17.6      * cine:cue                 
 4:18.6      * death:settled            
 4:18.6      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:20.2      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:21.0  intake    pos( -24.0,   0.0,  25.2) walk      fear 0.04 lamp off      lit  6/149/208 entity DORMANT @30.0m      752.4ms
 4:21.6      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:23.0      * ui:screen                
 4:23.0      * game:respawn             
 4:23.0      * cine:end                 name=respawn
 4:23.4      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:24.9      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:25.9      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:26.0  intake    pos( -21.7,   0.0,  21.7) walk      fear 0.03 lamp off      lit  6/149/208 entity DORMANT @28.5m      669.4ms
 4:27.4      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:28.3      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:30.1      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)

 4:31.0  ── stop, lamp off, stay still — does it lose you? ──
 4:31.0      * lamp:toggle              
 4:31.0  intake    pos( -11.0,   0.0,  22.4) walk      fear 0.03 lamp off      lit  6/148/208 entity DORMANT @18.4m      499.8ms
 4:31.5      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:33.2      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:34.4      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:35.6      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:36.0  intake    pos( -10.9,   0.0,  22.4) stil      fear 0.01 lamp on 0.67 lit  6/149/208 entity DORMANT @18.3m      513.0ms
 4:37.1      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:38.4      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:39.8      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:40.7      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:41.0  intake    pos( -10.9,   0.0,  22.4) stil      fear 0.01 lamp on 0.66 lit  6/149/208 entity DORMANT @18.3m      214.3ms
 4:41.4      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:42.1      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:43.1      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:45.1      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:46.0  intake    pos( -10.9,   0.0,  22.4) stil      fear 0.00 lamp on 0.65 lit  6/149/208 entity DORMANT @18.3m      175.6ms
 4:47.2      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:48.9      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:49.9      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:51.0  intake    pos( -10.9,   0.0,  22.4) stil      fear 0.00 lamp on 0.63 lit  6/149/208 entity DORMANT @18.3m      145.8ms
 4:51.7      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:53.8      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:55.4      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:56.0  intake    pos( -10.9,   0.0,  22.4) stil      fear 0.00 lamp on 0.62 lit  6/149/208 entity DORMANT @18.3m       56.4ms
 4:56.6      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:57.6      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:58.7      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 4:59.4      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:01.0  intake    pos( -10.9,   0.0,  22.4) stil      fear 0.00 lamp on 0.61 lit  6/149/208 entity DORMANT @18.3m       55.9ms
 5:01.2      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:01.9      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:03.9      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:05.0      * zone:build               zone=service
 5:05.0      * zone:leave               zone=intake
 5:05.0      * world:teleport           zone=service at=(370.4, 0, 0)
 5:05.0      * zone:enter               zone=service from=intake
 5:05.0      * qa:scripted-zone-change  zone=service

 5:05.0  ── zone settle ──
 5:05.9      * zone:build               zone=cistern
 5:06.0      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)

 5:06.5  ── service spine — first walk ──
 5:06.5  service   pos( 370.4,   0.0,   0.0) stil      fear 0.00 lamp on 0.60 lit  6/225/302 entity DORMANT @366.1m     135.5ms
 5:06.9      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:07.9      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:09.6      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:10.9      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:11.5  service   pos( 380.8,   0.0,   0.1) walk      fear 0.03 lamp on 0.58 lit  6/225/302 entity DORMANT @376.4m     136.4ms
 5:12.4      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:13.5      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:14.2      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:15.7      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:16.5  service   pos( 384.7,   0.0,   0.1) stil      fear 0.01 lamp on 0.57 lit  6/225/302 entity DORMANT @380.3m     213.3ms
 5:17.5      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:18.2      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:19.4      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:20.1      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:21.5  service   pos( 384.7,   0.0,   0.1) stil      fear 0.00 lamp on 0.56 lit  6/225/302 entity DORMANT @380.3m     214.3ms
 5:21.8      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:23.2      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:24.0      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:25.1      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:25.9      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:26.5  service   pos( 384.7,   0.0,   0.1) stil      fear 0.00 lamp on 0.55 lit  6/225/302 entity DORMANT @380.3m     204.8ms
 5:27.9      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:28.5      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:30.0      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:31.5  service   pos( 384.7,   0.0,   0.1) stil      fear 0.00 lamp on 0.54 lit  6/225/302 entity DORMANT @380.3m     200.2ms
 5:31.6      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:32.7      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:34.5      * qa:scripted-reposition   at=(412.6, 0, -2.2) zone=service

 5:34.5  ── reposition settle ──
 5:34.6      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:35.1      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:36.2      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)

 5:36.5  ── walk into the switchroom ──
 5:36.5  service   pos( 412.6,   0.0,  -2.2) stil      fear 0.00 lamp on 0.53 lit  6/225/302 entity DORMANT @408.3m     201.9ms
 5:36.9      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:38.6      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:39.4      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:41.5      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:41.5  service   pos( 409.4,   0.0,  -4.2) stil crch fear 0.02 lamp on 0.51 lit  6/225/302 entity DORMANT @405.3m     112.8ms
 5:42.6      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:44.7      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:46.5      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:46.5  service   pos( 413.2,   0.0,  -7.8) walk      fear 0.03 lamp on 0.50 lit  6/225/302 entity DORMANT @409.4m      44.8ms
 5:48.2      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)

 5:48.5  ── INTERACT: read the board schedule off the floor ──
 5:49.4      * story:note               id=note_tally kind=ledger title=Tally Sheet — Doors
 5:49.4      * pickup:taken             id=note_4156_-74 item=note at=(415.6, 0, -7.4)
 5:49.4      * interact:use             id=note_4156_-74 kind=pickup
 5:49.5      * qa:scripted-reposition   at=(414.6, 0, -8.4) zone=service

 5:49.5  ── reposition settle ──
 5:50.3      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:51.0      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)

 5:51.5  ── INTERACT: reset way 5 — the Stack lift lobby ──
 5:51.5  service   pos( 414.6,   0.0,  -8.4) stil      fear 0.01 lamp on 0.49 lit  6/224/302 entity DORMANT @410.8m      53.4ms
 5:51.7      * light:circuit            circuit=residence powered=true
 5:51.7      * sfx:breaker              at=(416.1, 1.2, -8.4)
 5:51.7      * interact:use             id=board_c_way6 kind=breaker
 5:52.4      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)

 5:52.5  ── INTERACT: trip way 2 — put the Spine out behind you ──
 5:52.6      * light:circuit            circuit=service powered=false
 5:52.6      * sfx:breaker              at=(416.1, 1.2, -8.4)
 5:52.6      * interact:use             id=board_c_way2 kind=breaker

 5:53.5  ── stand in the switchroom and look at what changed ──
 5:54.1      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:55.7      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:56.5  service   pos( 415.0,   0.0,  -8.5) stil      fear 0.03 lamp on 0.48 lit  3/162/302 entity DORMANT @411.2m     233.7ms
 5:57.3      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:58.5      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 5:59.7      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:00.4      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:01.0      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:01.5  service   pos( 415.0,   0.0,  -8.5) stil      fear 0.03 lamp on 0.47 lit  3/162/302 entity DORMANT @411.2m     310.6ms
 6:02.0      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:03.8      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:04.8      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:05.8      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:06.5  service   pos( 415.0,   0.0,  -8.5) stil      fear 0.04 lamp on 0.45 lit  3/162/302 entity DORMANT @411.2m     307.4ms
 6:06.6      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)

 6:07.5  ── INTERACT: reset way 2 — the Spine comes back ──
 6:07.9      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:08.1      * light:circuit            circuit=service powered=true
 6:08.1      * sfx:breaker              at=(416.1, 1.2, -8.4)
 6:08.1      * interact:use             id=board_c_way2 kind=breaker
 6:08.5      * zone:leave               zone=service
 6:08.5      * world:teleport           zone=cistern at=(774, 2.6, 0)
 6:08.5      * zone:enter               zone=cistern from=service
 6:08.5      * qa:scripted-zone-change  zone=cistern

 6:08.5  ── zone settle ──
 6:09.5      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)

 6:10.0  ── cistern — wading ──
 6:10.0      * lamp:toggle              
 6:10.8      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:12.0      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:12.0  cistern   pos( 775.2,   2.6,   0.0) walk crch fear 0.22 lamp off      lit  1/225/302 entity DORMANT @770.2m     450.4ms
 6:13.8      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:15.5      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:16.9      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:17.0  cistern   pos( 777.5,   2.6,   0.0) stil crch fear 0.27 lamp off      lit  2/225/302 entity DORMANT @772.5m     565.1ms
 6:17.7      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:19.7      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:20.8      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:22.0  cistern   pos( 777.5,   2.6,  -0.2) stil crch fear 0.27 lamp off      lit  2/225/302 entity DORMANT @772.5m     663.8ms
 6:22.6      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:24.1      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:24.7      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:25.5      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:27.0  cistern   pos( 777.5,   2.6,  -0.2) stil crch fear 0.27 lamp off      lit  2/225/302 entity DORMANT @772.5m     637.9ms
 6:27.5      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:29.6      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:30.4      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:31.6      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:32.0  cistern   pos( 777.5,   2.6,  -0.3) walk crch fear 0.27 lamp off      lit  2/225/302 entity DORMANT @772.5m     405.9ms
 6:32.3      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:34.1      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:35.6      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:36.0      * qa:scripted-reposition   at=(815.4, 1.6, 3.2) zone=cistern

 6:36.0  ── reposition settle ──
 6:37.5      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)

 6:38.0  ── INTERACT: turn penstock 1 (a 1.35 s hold) ──
 6:38.0  cistern   pos( 815.4,   1.6,   3.2) stil      fear 0.27 lamp off      lit  1/225/302 entity DORMANT @810.3m     548.7ms
 6:38.8      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:38.9      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:38.9      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:39.1      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:39.1      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:39.1      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:39.2      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:39.5      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:39.5      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:39.8      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:39.9      * sfx:valve                id=penstock_1 at=(814.6, 2.3, 3)
 6:40.2      * valve:turn               zone=cistern id=penstock_1
 6:40.2      * interact:use             id=penstock_1 kind=valve

 6:41.0  ── INTERACT: try penstock 2 — it is padlocked ──
 6:41.1      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:41.9      * ui:refuse                id=penstock_2
 6:42.6      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:43.0  cistern   pos( 815.4,   1.6,   3.2) stil      fear 0.27 lamp off      lit  1/225/302 entity DORMANT @810.3m     394.0ms
 6:44.5      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:45.7      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:46.5      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:48.0  cistern   pos( 815.9,   1.6,   3.0) stil crch fear 0.27 lamp off      lit  1/225/302 entity DORMANT @810.8m     262.6ms
 6:48.5      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:50.6      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:52.4      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:53.0  cistern   pos( 815.9,   1.6,   3.2) stil crch fear 0.27 lamp off      lit  1/225/302 entity DORMANT @810.8m     149.1ms
 6:54.2      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:55.5      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:56.6      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:58.0  cistern   pos( 816.0,   1.6,   3.3) stil crch fear 0.27 lamp off      lit  1/225/302 entity DORMANT @810.8m     164.0ms
 6:58.4      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 6:59.4      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)

 7:01.0  ── cistern — stand still in the water ──
 7:01.0      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 7:02.6      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 7:03.0  cistern   pos( 816.0,   1.6,   2.8) stil crch fear 0.27 lamp off      lit  1/225/302 entity DORMANT @810.8m     162.5ms
 7:04.1      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 7:04.8      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 7:05.6      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 7:06.1      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 7:06.9      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 7:08.0  cistern   pos( 816.0,   1.6,   2.8) stil crch fear 0.27 lamp off      lit  1/225/302 entity DORMANT @810.8m     225.5ms
 7:08.9      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 7:10.6      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 7:11.8      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 7:13.0  cistern   pos( 816.0,   1.6,   2.8) stil crch fear 0.27 lamp off      lit  1/225/302 entity DORMANT @810.8m     111.4ms
 7:13.1      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 7:14.6      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 7:16.1      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 7:16.6      * entity:tick              entity=surveyor at=(5.6, 0, 30.2)
 7:17.0      * zone:build               zone=plant
 7:17.0      * lift:power               id=lift_2
 7:17.0      * zone:unload              zone=intake
 7:17.0      * zone:leave               zone=cistern
 7:17.0      * world:teleport           zone=plant at=(384.8, 0.7, 400)
 7:17.0      * zone:enter               zone=plant from=cistern
 7:17.0      * progress:complete        id=reach_plant title=Find the Plant
 7:17.0      * progress:objective       title=Supply core — the Cistern objective=core_cistern
 7:17.0      * qa:scripted-zone-change  zone=plant

 7:17.0  ── zone settle ──

 7:18.5  ── the generator hall — the landmark frame ──
 7:18.5  plant     pos( 384.8,   0.7, 400.0) stil      fear 0.14 lamp off      lit 10/ 99/119 entity DORMANT @529.7m     377.9ms
 7:23.5  plant     pos( 384.8,   0.7, 400.0) stil      fear 0.02 lamp off      lit 10/ 99/119 entity DORMANT @529.7m     496.8ms
 7:28.5  plant     pos( 384.8,   0.7, 400.0) stil      fear 0.00 lamp off      lit 10/ 99/119 entity DORMANT @529.7m     521.7ms
 7:33.5  plant     pos( 384.8,   0.7, 400.0) stil      fear 0.00 lamp off      lit 10/ 99/119 entity DORMANT @529.7m     592.1ms
 7:38.5      * qa:scripted-reposition   at=(402.6, -5.7, 398) zone=plant

 7:38.5  ── reposition settle ──
 7:38.5  plant     pos( 384.8,   0.7, 400.0) stil      fear 0.00 lamp off      lit 10/ 99/119 entity DORMANT @529.7m     633.6ms

 7:40.5  ── INTERACT: try the fuel valve with no cores fitted ──
 7:40.8      * ui:refuse                id=set_2_fuel
 7:43.5  plant     pos( 402.3,  -5.7, 397.6) stil      fear 0.00 lamp off      lit 10/ 99/119 entity DORMANT @540.8m     714.1ms
 7:48.5  plant     pos( 401.5,  -5.7, 396.9) stil      fear 0.00 lamp off      lit 10/ 99/119 entity DORMANT @539.7m     720.1ms
 7:53.5  plant     pos( 402.1,  -5.7, 396.9) walk      fear 0.01 lamp off      lit 10/ 99/119 entity DORMANT @540.2m     375.9ms
 7:58.5  plant     pos( 402.8,  -5.7, 396.9) stil      fear 0.01 lamp off      lit 10/ 99/119 entity DORMANT @540.7m     422.3ms

 8:02.5  ── INTERACT: try a socket with nothing in your hands ──
 8:02.9      * ui:refuse                id=set_2_socket0
 8:03.3      * ui:refuse                id=set_2_socket0
 8:03.5  plant     pos( 402.1,  -5.7, 396.9) stil      fear 0.01 lamp off      lit 10/ 98/119 entity DORMANT @540.2m     401.0ms
 8:03.6      * ui:refuse                id=set_2_socket0
 8:04.5      * qa:scripted-reposition   at=(414, -6, 400) zone=plant

 8:04.5  ── reposition settle ──

 8:06.5  ── INTERACT: call the goods lift — it has no supply ──
 8:07.1      * ui:refuse                id=lift_2_call
 8:07.5      * ui:refuse                id=lift_2_call
 8:07.9      * ui:refuse                id=lift_2_call
 8:08.5      * zone:build               zone=safe
 8:08.5      * zone:unload              zone=service
 8:08.5      * zone:leave               zone=plant
 8:08.5      * world:teleport           zone=safe at=(400.6, 0, 799)
 8:08.5      * zone:enter               zone=safe from=plant
 8:08.5      * progress:discovery       id=office title=The Office of Record
 8:08.5      * qa:scripted-zone-change  zone=safe

 8:08.5  ── zone settle ──
 8:08.5  plant     pos( 415.8,  -6.0, 400.0) stil      fear 0.01 lamp off      lit 10/ 99/119 entity DORMANT @552.3m     332.4ms

 8:10.0  ── the safe room ──
 8:14.0  safe      pos( 399.5,   0.0, 799.6) walk      fear 0.02 lamp off      lit  5/ 32/50 entity DORMANT @864.4m     687.7ms
 8:19.0  safe      pos( 402.3,   0.0, 799.8) walk      fear 0.02 lamp off      lit  5/ 32/50 entity DORMANT @865.9m     721.9ms
 8:24.0  safe      pos( 400.0,   0.0, 801.1) stil crch fear 0.01 lamp off      lit  5/ 32/50 entity DORMANT @866.0m     724.6ms

 8:28.0  ── INTERACT: the terminal ──
 8:28.5      * sfx:detent               id=terminal_record
 8:28.5      * terminal:dial            id=terminal_record
 8:28.5      * interact:use             id=terminal_record_dial kind=dial

 8:29.0  ── INTERACT: read what is on the desk ──
 8:29.0  safe      pos( 400.0,   0.0, 801.1) stil      fear 0.00 lamp off      lit  5/ 32/50 entity DORMANT @866.0m     694.0ms
 8:29.1      * story:note               id=note_office_of_record kind=note title=Office of Record — Card on the desk
 8:29.1      * pickup:taken             id=note_3993_8019 item=note at=(399.3, 0.7, 801.9)
 8:29.1      * interact:use             id=note_3993_8019 kind=pickup
```

`lit A/B/C` = lights uploaded to shaders / fixtures above 5% brightness / fixtures resident.

## Entity state transitions

| t | from | to | active |
|---|---|---|---|
| 2:32.9 | DORMANT | ROUSED | true |
| 2:36.4 | ROUSED | SEEKING | true |
| 2:51.9 | SEEKING | MEASURING | true |
| 2:57.7 | MEASURING | SEEKING | true |
| 3:01.0 | SEEKING | MEASURING | true |
| 3:09.4 | MEASURING | SEEKING | true |
| 3:12.7 | SEEKING | MEASURING | true |
| 3:20.8 | MEASURING | RETREATING | true |
| 3:38.8 | RETREATING | DORMANT | true |
| 3:40.9 | DORMANT | ROUSED | true |
| 3:44.4 | ROUSED | SEEKING | true |
| 3:55.8 | SEEKING | MEASURING | true |
| 3:59.6 | MEASURING | SEEKING | true |
| 4:05.8 | SEEKING | APPROACHING | true |
| 4:13.0 | APPROACHING | CAPTURING | true |
| 4:14.4 | CAPTURING | DORMANT | true |

## Filmstrip

17 frames, one every ~40 s of play. See `filmstrip.md` for them in order.

## Subsystems at the end of the session

```json
{
  "state": "play",
  "zone": "safe",
  "subsystems": {
    "world": true,
    "audio": true,
    "save": true,
    "gameplay": true,
    "ui": true,
    "cinematics": true
  },
  "engine": {
    "ms": 689.4883333365123,
    "fps": 1.4503508640398404,
    "p90": 780.6999998092651,
    "calls": 257,
    "tris": 99792,
    "quality": "medium",
    "res": "384x216"
  },
  "lights": {
    "fixtures": 50,
    "lit": 32,
    "active": 5,
    "tubes": 32,
    "shadows": 2
  },
  "entity": {
    "entity": "surveyor",
    "state": "DORMANT",
    "stateTime": 255.6,
    "position": [
      5.59,
      0,
      30.16
    ],
    "heading": 4.546,
    "target": [
      6.29,
      0,
      20.97
    ],
    "confidence": 0,
    "illumination": 0,
    "lightScale": 0,
    "speed": 0,
    "frozen": true,
    "stoop": 0,
    "measureHold": 0,
    "distToPlayer": 865.98,
    "usingGlb": true
  },
  "gameplay": {
    "surveyor": {
      "entity": "surveyor",
      "state": "DORMANT",
      "stateTime": 255.6,
      "position": [
        5.59,
        0,
        30.16
      ],
      "heading": 4.546,
      "target": [
        6.29,
        0,
        20.97
      ],
      "confidence": 0,
      "illumination": 0,
      "lightScale": 0,
      "speed": 0,
      "frozen": true,
      "stoop": 0,
      "measureHold": 0,
      "distToPlayer": 865.98,
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
      "tension": 0,
      "intensity": 0.28,
      "sinceBeat": 54.7,
      "nextBeatAt": 240,
      "grace": 48.5,
      "zone": "safe",
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
        "to_stack",
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
      "items": 78,
      "doors": 19
    },
    "flashlight": {
      "on": false,
      "battery": 0.445,
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
    "voices": 6,
    "oneShots": 2,
    "loops": 4,
    "nodes": 109,
    "occlChecks": 25014,
    "denied": 0,
    "reverb": "safe",
    "zone": "safe",
    "hums": 0,
    "state": "running",
    "music": {
      "spent": 0,
      "budget": 5,
      "sinceLast": 1000502,
      "cues": []
    },
    "pressure": 0
  }
}
```
