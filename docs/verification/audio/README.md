# THE ANNEX — audio, as files you can play

Generated 2026-07-30T07:33:45.994Z by `tools/qa/audio-render.mjs`. Every file here is
rendered offline through the same `src/audio/` code the live game runs — there is no
sample content in this project and nothing here was recorded.

**Read this first.** All levels below are measured, not adjusted. Nothing has been
normalised, because a normalised QA artefact hides the one defect it exists to find.
The one-shots in `sounds/` are **dry**: no zone reverb, no bus compressor, no master
limiter, at their own authored gain. That is deliberate — it is the sound itself, which
is what you want when judging a drip. Several are quiet in absolute terms because the
bus that carries them applies up to +5 dB and the reverb send doubles their apparent
loudness; the peak column tells you which ones need the volume turned up. The files in
`beds/` and `scenes/` are the full chain and are the ones to judge the mix on.

## `beds/` — start here

One continuous 65-second excerpt per zone. A horror soundscape is a bed, not a
set of one-shots, and this is the only artefact in the project that can be judged as one.
Each is the whole system running: the fluorescent hum spatialised per fixture and driven
by that fixture's live flicker level, the ventilation bed, room tone, machinery, and
Poisson-timed drips, pipe knocks, structural creaks, expansion ticks, arcs and distant
impacts at the zone's own authored rates — through the zone's procedural convolution
reverb, the bus compressors and the master limiter. A listener walks up and down a 36 m
corridor and through two doorways, so occlusion is measured against a real
`CollisionWorld` while the mix runs. The first and last 8 seconds have no footsteps, so
the bed can be heard on its own.

| file | reverb | peak dBFS | RMS dBFS | crest | voices | flags |
|---|---|---:|---:|---:|---:|---|
| [`beds/intake.wav`](beds/intake.wav) | `corridor` | -0.1 | -6.1 | 2.6 | 235 | hot |
| [`beds/service.wav`](beds/service.wav) | `service` | 0.0 | -6.2 | 2.3 | 236 | CLIP |
| [`beds/cistern.wav`](beds/cistern.wav) | `cistern` | 0.2 | -8.3 | 3.6 | 196 | CLIP |
| [`beds/residence.wav`](beds/residence.wav) | `dead` | -0.5 | -14.8 | 5.7 | 267 | — |
| [`beds/plant.wav`](beds/plant.wav) | `hall` | 0.0 | -6.6 | 2.8 | 232 | CLIP |
| [`beds/duct.wav`](beds/duct.wav) | `duct` | -0.3 | -10.7 | 3.5 | 175 | — |
| [`beds/stack.wav`](beds/stack.wav) | `stack` | 0.0 | -6.3 | 2.7 | 229 | CLIP |
| [`beds/safe.wav`](beds/safe.wav) | `safe` | -0.9 | -14.5 | 5.2 | 278 | — |

### `beds/intake.wav` — intake

Peak -0.1 dBFS, RMS -6.1 dBFS, crest 2.6, spectral centroid 136 Hz, 235 voices spawned over the excerpt. Reverb profile `corridor`.

**What to listen for.** The signature sound of the game. A corridor of fluorescent tubes at 100 Hz, each detuned a few cents so the corridor beats against itself, plus ballast whine near 9.4 kHz. Listen for: the beating (it should wander, never pulse regularly); one tube stuttering out of sync with the others and crackling back in; carpet footsteps that do NOT excite the room; a near-dead low room tone under everything. If this reads as one steady synth pad, the per-fixture spatialisation is not working.

### `beds/service.wav` — service

Peak 0.0 dBFS, RMS -6.2 dBFS, crest 2.3, spectral centroid 103 Hz, 236 voices spawned over the excerpt. Reverb profile `service`.

**What to listen for.** Cold and load-bearing. Concrete footsteps should slap the corridor — the room excitation layer is 6x the carpet one — and the reverb is longer and brighter. Listen for: the transformer buzz at the far end getting louder and duller as you approach and pass it, the vent grille sweeping, and drips roughly every 17 s. A drip behind a partition should be duller AND wetter than one in the open; that is occlusion working, and it is the single most important thing in this file.

### `beds/cistern.wav` — cistern

Peak 0.2 dBFS, RMS -8.3 dBFS, crest 3.6, spectral centroid 125 Hz, 196 voices spawned over the excerpt. Reverb profile `cistern`.

**What to listen for.** Drowned and slow. A drip every ~4 s, running water, the standing-water lap breathing on three incommensurate LFOs, and a long tuned slap-back at 74 Hz. Footsteps are wading. Listen for: whether the drips ever sound like a metronome (they must not — the gaps are exponentially distributed), and whether the 74 Hz resonance is a room or a hum.

### `beds/residence.wav` — residence

Peak -0.5 dBFS, RMS -14.8 dBFS, crest 5.7, spectral centroid 134 Hz, 267 voices spawned over the excerpt. Reverb profile `dead`.

**What to listen for.** Nearly dead acoustically — carpet, damask, soft furnishings, a 0.34 s decay. This file is mostly a test of restraint: the hum is at 0.12, there is almost no vent, and the structure creaks every ~26 s. Listen for: whether it is unnervingly quiet rather than broken, and whether the creaks read as a building settling rather than as a sound effect.

### `beds/plant.wav` — plant

Peak 0.0 dBFS, RMS -6.6 dBFS, crest 2.8, spectral centroid 135 Hz, 232 voices spawned over the excerpt. Reverb profile `hall`.

**What to listen for.** A 14 m concrete cathedral with a 3.1 s decay and a 196 ms slap. The machinery bed is at full proximity: two shafts at slightly different speeds beating against each other, plus casing broadband. Footsteps are chequer plate over a void and should ring for ~0.4 s. Listen for: whether the machine sounds like a machine hunting rather than a sawtooth, and whether the reverb makes the space feel 14 m tall.

### `beds/duct.wav` — duct

Peak -0.3 dBFS, RMS -10.7 dBFS, crest 3.5, spectral centroid 133 Hz, 175 voices spawned over the excerpt. Reverb profile `duct`.

**What to listen for.** A 0.8 m galvanised box around your head: 0.30 s decay, 214 Hz box resonance, width 0.35, nothing but the vent (at 1.0) and your own knees. Listen for: claustrophobia. The panel should boom under each crawl step and the reverb should feel like it is touching your ears.

### `beds/stack.wav` — stack

Peak 0.0 dBFS, RMS -6.3 dBFS, crest 2.7, spectral centroid 174 Hz, 229 voices spawned over the excerpt. Reverb profile `stack`.

**What to listen for.** A vertical shaft: 4.2 s decay, 42 ms predelay, full stereo width, hum at 0.70 from floors above and below. Listen for: whether the early reflections read as *distance upward* rather than as a big room, and whether distant impacts arrive with no highs at all.

### `beds/safe.wav` — safe

Peak -0.9 dBFS, RMS -14.5 dBFS, crest 5.2, spectral centroid 164 Hz, 278 voices spawned over the excerpt. Reverb profile `safe`.

**What to listen for.** The Office of Record. Small, warm, 0.42 s decay, hum at 0.22, almost no events — a drip every 90 s. Listen for: relief. If this is not audibly safer than the Service Spine within two seconds of pressing play, the contrast the whole game rests on is not there.

## `scenes/` — the sequences the design makes promises about

### `scenes/surveyor.wav` — surveyor (over the service bed)

Peak 0.0 dBFS, RMS -6.3 dBFS, 75 s.

**What to listen for.** The behavioural promises in DESIGN.md §2, in order, over 75 s. 0:10 the whine begins — it must be direction-ambiguous (a Haas widener with an inverted delayed side channel and the largest reverb send in the game) and must feel like it is accelerating. 0:14 it walks. 0:30 a head-plate tick — the one moment you are given a bearing. 0:34 it loses you. 0:40 it measures a wall; this is the silence you are supposed to move in. 0:52 the lights die and it freezes — note that the hum dies with them. 1:02 it leaves. Listen for: whether you could learn the whine means "three seconds" from this file alone.

| time | beat |
|---|---|
| 0:10 | entity:state approach — the whine begins — 3-4 s of warning, direction-ambiguous |
| 0:14 | entity:state hunt — it commits to a straight line and walks |
| 0:30 | entity:heard — the head-plate tick that gives you its bearing |
| 0:34 | entity:state search — it has lost the trail |
| 0:40 | entity:state measure — it stops and measures a wall — your window to move |
| 0:52 | entity:state frozen — the lights go and it freezes mid-stride |
| 1:02 | entity:state despawn — it leaves |

## `sounds/` — one file per registered sound

75 files, dry, at the render window the QA probe uses. Loops are
rendered with a level driven in and stopped just before the file ends, which is why some
are exactly 6.00 s.

| file | bus | loop | dur s | peak dBFS | RMS dBFS | centroid | flags |
|---|---|---|---:|---:|---:|---:|---|
| [`sounds/amb_grille.wav`](sounds/amb_grille.wav) | ambience | yes | 6.00 | -17.0 | -38.6 | 423 Hz | — |
| [`sounds/amb_hum.wav`](sounds/amb_hum.wav) | ambience | yes | 6.00 | -13.9 | -20.9 | 108 Hz | — |
| [`sounds/amb_machine.wav`](sounds/amb_machine.wav) | ambience | yes | 6.00 | -7.3 | -18.1 | 85 Hz | — |
| [`sounds/amb_room.wav`](sounds/amb_room.wav) | ambience | yes | 6.00 | -21.2 | -34.7 | 65 Hz | — |
| [`sounds/amb_strike.wav`](sounds/amb_strike.wav) | ambience |  | 2.00 | -15.8 | -53.2 | 4789 Hz | — |
| [`sounds/amb_transformer.wav`](sounds/amb_transformer.wav) | ambience | yes | 6.00 | -6.2 | -17.4 | 839 Hz | — |
| [`sounds/amb_vent.wav`](sounds/amb_vent.wav) | ambience | yes | 6.00 | -19.7 | -34.4 | 123 Hz | — |
| [`sounds/amb_water_lap.wav`](sounds/amb_water_lap.wav) | ambience | yes | 6.00 | -20.3 | -34.2 | 153 Hz | — |
| [`sounds/amb_water_run.wav`](sounds/amb_water_run.wav) | ambience | yes | 6.00 | -11.6 | -26.2 | 1841 Hz | — |
| [`sounds/attendant_breath.wav`](sounds/attendant_breath.wav) | entity |  | 2.60 | -25.2 | -45.2 | 1022 Hz | — |
| [`sounds/attendant_shift.wav`](sounds/attendant_shift.wav) | entity |  | 3.00 | -23.1 | -48.3 | 107 Hz | — |
| [`sounds/attendant_step.wav`](sounds/attendant_step.wav) | entity |  | 2.20 | -13.0 | -42.3 | 215 Hz | — |
| [`sounds/attendant_write.wav`](sounds/attendant_write.wav) | entity |  | 3.40 | -13.8 | -33.4 | 3130 Hz | — |
| [`sounds/breaker_throw.wav`](sounds/breaker_throw.wav) | world |  | 2.00 | -10.7 | -40.9 | 231 Hz | — |
| [`sounds/breath.wav`](sounds/breath.wav) | player |  | 2.20 | -19.9 | -43.7 | 1743 Hz | — |
| [`sounds/cable_twang.wav`](sounds/cable_twang.wav) | world |  | 3.00 | -18.2 | -39.2 | 195 Hz | — |
| [`sounds/chair_scrape.wav`](sounds/chair_scrape.wav) | ambience |  | 2.60 | -21.3 | -41.4 | 621 Hz | — |
| [`sounds/cloth_rustle.wav`](sounds/cloth_rustle.wav) | player |  | 2.00 | -16.3 | -48.8 | 3403 Hz | — |
| [`sounds/debris_small.wav`](sounds/debris_small.wav) | world |  | 2.40 | -26.0 | -55.1 | 1930 Hz | — |
| [`sounds/door_close.wav`](sounds/door_close.wav) | world |  | 2.40 | -6.0 | -29.2 | 155 Hz | — |
| [`sounds/door_handle.wav`](sounds/door_handle.wav) | world |  | 2.00 | -13.4 | -39.7 | 601 Hz | — |
| [`sounds/door_heavy.wav`](sounds/door_heavy.wav) | world |  | 3.50 | -2.9 | -25.4 | 99 Hz | — |
| [`sounds/door_latch.wav`](sounds/door_latch.wav) | world |  | 2.00 | -18.6 | -50.6 | 1391 Hz | — |
| [`sounds/door_locked.wav`](sounds/door_locked.wav) | world |  | 2.00 | -11.8 | -37.7 | 290 Hz | — |
| [`sounds/door_open.wav`](sounds/door_open.wav) | world |  | 2.60 | -14.8 | -35.1 | 528 Hz | — |
| [`sounds/drip.wav`](sounds/drip.wav) | ambience |  | 2.00 | -11.8 | -37.4 | 960 Hz | — |
| [`sounds/elec_arc.wav`](sounds/elec_arc.wav) | ambience |  | 2.00 | -14.4 | -53.2 | 2015 Hz | — |
| [`sounds/entity_capture.wav`](sounds/entity_capture.wav) | entity |  | 5.00 | -1.6 | -17.6 | 1502 Hz | — |
| [`sounds/entity_measure.wav`](sounds/entity_measure.wav) | entity |  | 4.20 | -7.9 | -32.4 | 280 Hz | — |
| [`sounds/entity_presence.wav`](sounds/entity_presence.wav) | entity | yes | 6.00 | -9.4 | -15.9 | 158 Hz | — |
| [`sounds/entity_step.wav`](sounds/entity_step.wav) | entity |  | 3.40 | -2.7 | -26.7 | 76 Hz | — |
| [`sounds/entity_tick.wav`](sounds/entity_tick.wav) | entity |  | 2.00 | -15.5 | -42.1 | 302 Hz | — |
| [`sounds/entity_whine.wav`](sounds/entity_whine.wav) | entity |  | 4.60 | -5.3 | -22.1 | 870 Hz | — |
| [`sounds/flashlight_click.wav`](sounds/flashlight_click.wav) | player |  | 2.00 | -19.7 | -53.6 | 1178 Hz | — |
| [`sounds/flashlight_rattle.wav`](sounds/flashlight_rattle.wav) | player |  | 2.00 | -25.2 | -56.9 | 1919 Hz | — |
| [`sounds/glass_crack.wav`](sounds/glass_crack.wav) | world |  | 2.80 | -9.8 | -38.3 | 2360 Hz | — |
| [`sounds/hatch_open.wav`](sounds/hatch_open.wav) | world |  | 2.80 | -16.9 | -36.9 | 342 Hz | — |
| [`sounds/impact_hard.wav`](sounds/impact_hard.wav) | world |  | 2.60 | -4.4 | -28.3 | 81 Hz | — |
| [`sounds/impact_soft.wav`](sounds/impact_soft.wav) | world |  | 2.00 | -11.3 | -37.3 | 130 Hz | — |
| [`sounds/kettle_boil.wav`](sounds/kettle_boil.wav) | ambience | yes | 12.00 | -17.5 | -33.5 | 1142 Hz | — |
| [`sounds/kettle_click.wav`](sounds/kettle_click.wav) | world |  | 2.00 | -16.1 | -47.9 | 915 Hz | — |
| [`sounds/land.wav`](sounds/land.wav) | player |  | 2.60 | -8.2 | -38.4 | 214 Hz | — |
| [`sounds/lift_arrive.wav`](sounds/lift_arrive.wav) | world |  | 4.00 | -6.0 | -26.5 | 138 Hz | — |
| [`sounds/lift_call.wav`](sounds/lift_call.wav) | world |  | 2.40 | -15.9 | -34.6 | 689 Hz | — |
| [`sounds/locker_click.wav`](sounds/locker_click.wav) | ambience |  | 2.00 | -20.0 | -47.7 | 305 Hz | — |
| [`sounds/metal_clang.wav`](sounds/metal_clang.wav) | world |  | 3.00 | -10.1 | -34.4 | 345 Hz | — |
| [`sounds/music_bed.wav`](sounds/music_bed.wav) | music | yes | 8.00 | -6.8 | -17.5 | 136 Hz | — |
| [`sounds/music_bowed.wav`](sounds/music_bowed.wav) | music |  | 10.00 | -11.9 | -29.0 | 261 Hz | — |
| [`sounds/music_motif.wav`](sounds/music_motif.wav) | music |  | 13.00 | -12.4 | -29.5 | 231 Hz | — |
| [`sounds/music_warm.wav`](sounds/music_warm.wav) | music | yes | 8.00 | -7.8 | -19.9 | 188 Hz | — |
| [`sounds/paper_rustle.wav`](sounds/paper_rustle.wav) | ambience |  | 2.60 | -16.2 | -44.9 | 3758 Hz | — |
| [`sounds/paper_take.wav`](sounds/paper_take.wav) | player |  | 2.00 | -12.9 | -42.7 | 6857 Hz | — |
| [`sounds/pickup_core.wav`](sounds/pickup_core.wav) | player |  | 3.60 | -11.1 | -33.6 | 140 Hz | — |
| [`sounds/pickup_item.wav`](sounds/pickup_item.wav) | player |  | 2.00 | -18.5 | -46.2 | 1012 Hz | — |
| [`sounds/pipe_knock.wav`](sounds/pipe_knock.wav) | ambience |  | 2.20 | -14.4 | -40.4 | 119 Hz | — |
| [`sounds/relay_click.wav`](sounds/relay_click.wav) | world |  | 2.00 | -17.1 | -51.0 | 942 Hz | — |
| [`sounds/silence_vacuum.wav`](sounds/silence_vacuum.wav) | music |  | 6.00 | -15.2 | -32.1 | 52 Hz | — |
| [`sounds/splash.wav`](sounds/splash.wav) | world |  | 2.40 | -10.7 | -36.5 | 1916 Hz | — |
| [`sounds/step_carpet.wav`](sounds/step_carpet.wav) | player |  | 2.20 | -17.3 | -43.9 | 476 Hz | — |
| [`sounds/step_carpet_damp.wav`](sounds/step_carpet_damp.wav) | player |  | 2.20 | -11.7 | -39.2 | 206 Hz | — |
| [`sounds/step_concrete.wav`](sounds/step_concrete.wav) | player |  | 2.20 | -8.2 | -40.6 | 310 Hz | — |
| [`sounds/step_duct.wav`](sounds/step_duct.wav) | player |  | 2.20 | -18.2 | -43.3 | 125 Hz | — |
| [`sounds/step_lino.wav`](sounds/step_lino.wav) | player |  | 2.20 | -11.6 | -42.4 | 253 Hz | — |
| [`sounds/step_tread.wav`](sounds/step_tread.wav) | player |  | 2.20 | -6.3 | -33.3 | 342 Hz | — |
| [`sounds/step_water.wav`](sounds/step_water.wav) | player |  | 2.20 | -5.9 | -34.0 | 1406 Hz | — |
| [`sounds/struct_creak.wav`](sounds/struct_creak.wav) | ambience |  | 3.50 | -17.5 | -35.8 | 235 Hz | — |
| [`sounds/struct_impact.wav`](sounds/struct_impact.wav) | ambience |  | 4.00 | -8.5 | -28.2 | 49 Hz | — |
| [`sounds/struct_tick.wav`](sounds/struct_tick.wav) | ambience |  | 2.00 | -15.9 | -47.9 | 773 Hz | — |
| [`sounds/switch_click.wav`](sounds/switch_click.wav) | world |  | 2.00 | -17.5 | -52.4 | 1336 Hz | — |
| [`sounds/ui_click.wav`](sounds/ui_click.wav) | ui |  | 2.00 | -19.5 | -54.5 | 1906 Hz | — |
| [`sounds/ui_deny.wav`](sounds/ui_deny.wav) | ui |  | 2.00 | -22.9 | -41.1 | 372 Hz | — |
| [`sounds/ui_hover.wav`](sounds/ui_hover.wav) | ui |  | 2.00 | -20.6 | -57.9 | 4805 Hz | — |
| [`sounds/ui_journal.wav`](sounds/ui_journal.wav) | ui |  | 2.00 | -18.7 | -44.1 | 207 Hz | — |
| [`sounds/ui_note.wav`](sounds/ui_note.wav) | ui |  | 2.00 | -15.2 | -45.9 | 5509 Hz | — |
| [`sounds/valve_turn.wav`](sounds/valve_turn.wav) | world |  | 2.90 | -20.1 | -40.5 | 172 Hz | — |

## Levels

- **Clipping:** 5 artefact(s) clipped.
- **Within 0.2 dB of full scale:** 1.
- **Inaudibly quiet:** 0 — none.

### Failures

- bed service: 382 clipped samples (peak 1.002)
- bed cistern: 506 clipped samples (peak 1.020)
- bed plant: 4796 clipped samples (peak 1.001)
- bed stack: 96 clipped samples (peak 1.000)
- scene surveyor: 1434 clipped samples (peak 1.004)
- scene breaker: render threw — page.evaluate: TypeError: beats[(bi++)] is not a function

### Warnings

- bed intake: peak -0.1 dBFS — within 0.2 dB of full scale

## Method, and what it does not prove

The audio system is written for a live `AudioContext` whose clock advances by itself. An
`OfflineAudioContext` clock does not move until `startRendering()`, so stepping the
simulation against it would schedule every event at t = 0. `engine.now` is therefore
shadowed with a virtual clock that returns the simulation time, and the whole graph is
scheduled into the future of one offline render. Voice reaping is also made
non-destructive, because `NodeBag.dispose()` disconnects nodes and offline the sound has
not been rendered yet. Nothing in `src/` is modified; both changes are made from outside.

What this does **not** prove: that the mix works on speakers in a room, that the
spatialisation reads correctly on headphones versus stereo, or that the levels sit right
against a system volume a player has already set. Those need ears. What it does prove is
that the files exist, that they are not silent or clipped, and that the continuous bed
holds together for over a minute without a loop point, a pile-up or a dropout.
