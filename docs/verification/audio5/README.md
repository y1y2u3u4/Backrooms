# THE ANNEX — audio, as files you can play

Generated 2026-08-24T01:00:15.710Z by `tools/qa/audio-render.mjs`. Every file here is
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

One continuous 45-second excerpt per zone. A horror soundscape is a bed, not a
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
| [`beds/intake.wav`](beds/intake.wav) | `corridor` | -6.5 | -20.8 | 4.9 | 155 | — |
| [`beds/service.wav`](beds/service.wav) | `service` | -3.1 | -17.2 | 5.5 | 155 | — |
| [`beds/cistern.wav`](beds/cistern.wav) | `cistern` | -2.3 | -16.6 | 6.3 | 127 | — |
| [`beds/residence.wav`](beds/residence.wav) | `dead` | -7.2 | -31.9 | 14.1 | 176 | — |
| [`beds/plant.wav`](beds/plant.wav) | `hall` | -2.4 | -13.1 | 4.3 | 155 | — |
| [`beds/duct.wav`](beds/duct.wav) | `duct` | -3.6 | -27.3 | 15.4 | 119 | — |
| [`beds/stack.wav`](beds/stack.wav) | `stack` | -3.3 | -16.4 | 5.3 | 153 | — |
| [`beds/safe.wav`](beds/safe.wav) | `safe` | -8.5 | -33.2 | 15.3 | 183 | — |

### `beds/intake.wav` — intake

Peak -6.5 dBFS, RMS -20.8 dBFS, crest 4.9, spectral centroid 127 Hz, 155 voices spawned over the excerpt. Reverb profile `corridor`.

**What to listen for.** The signature sound of the game. A corridor of fluorescent tubes at 100 Hz, each detuned a few cents so the corridor beats against itself, plus ballast whine near 9.4 kHz. Listen for: the beating (it should wander, never pulse regularly); one tube stuttering out of sync with the others and crackling back in; carpet footsteps that do NOT excite the room; a near-dead low room tone under everything. If this reads as one steady synth pad, the per-fixture spatialisation is not working.

### `beds/service.wav` — service

Peak -3.1 dBFS, RMS -17.2 dBFS, crest 5.5, spectral centroid 168 Hz, 155 voices spawned over the excerpt. Reverb profile `service`.

**What to listen for.** Cold and load-bearing. Concrete footsteps should slap the corridor — the room excitation layer is 6x the carpet one — and the reverb is longer and brighter. Listen for: the transformer buzz at the far end getting louder and duller as you approach and pass it, the vent grille sweeping, and drips roughly every 17 s. A drip behind a partition should be duller AND wetter than one in the open; that is occlusion working, and it is the single most important thing in this file.

### `beds/cistern.wav` — cistern

Peak -2.3 dBFS, RMS -16.6 dBFS, crest 6.3, spectral centroid 227 Hz, 127 voices spawned over the excerpt. Reverb profile `cistern`.

**What to listen for.** Drowned and slow. A drip every ~4 s, running water, the standing-water lap breathing on three incommensurate LFOs, and a long tuned slap-back at 74 Hz. Footsteps are wading. Listen for: whether the drips ever sound like a metronome (they must not — the gaps are exponentially distributed), and whether the 74 Hz resonance is a room or a hum.

### `beds/residence.wav` — residence

Peak -7.2 dBFS, RMS -31.9 dBFS, crest 14.1, spectral centroid 131 Hz, 176 voices spawned over the excerpt. Reverb profile `dead`.

**What to listen for.** Nearly dead acoustically — carpet, damask, soft furnishings, a 0.34 s decay. This file is mostly a test of restraint: the hum is at 0.12, there is almost no vent, and the structure creaks every ~26 s. Listen for: whether it is unnervingly quiet rather than broken, and whether the creaks read as a building settling rather than as a sound effect.

### `beds/plant.wav` — plant

Peak -2.4 dBFS, RMS -13.1 dBFS, crest 4.3, spectral centroid 250 Hz, 155 voices spawned over the excerpt. Reverb profile `hall`.

**What to listen for.** A 14 m concrete cathedral with a 3.1 s decay and a 196 ms slap. The machinery bed is at full proximity: two shafts at slightly different speeds beating against each other, plus casing broadband. Footsteps are chequer plate over a void and should ring for ~0.4 s. Listen for: whether the machine sounds like a machine hunting rather than a sawtooth, and whether the reverb makes the space feel 14 m tall.

### `beds/duct.wav` — duct

Peak -3.6 dBFS, RMS -27.3 dBFS, crest 15.4, spectral centroid 134 Hz, 119 voices spawned over the excerpt. Reverb profile `duct`.

**What to listen for.** A 0.8 m galvanised box around your head: 0.30 s decay, 214 Hz box resonance, width 0.35, nothing but the vent (at 1.0) and your own knees. Listen for: claustrophobia. The panel should boom under each crawl step and the reverb should feel like it is touching your ears.

### `beds/stack.wav` — stack

Peak -3.3 dBFS, RMS -16.4 dBFS, crest 5.3, spectral centroid 148 Hz, 153 voices spawned over the excerpt. Reverb profile `stack`.

**What to listen for.** A vertical shaft: 4.2 s decay, 42 ms predelay, full stereo width, hum at 0.70 from floors above and below. Listen for: whether the early reflections read as *distance upward* rather than as a big room, and whether distant impacts arrive with no highs at all.

### `beds/safe.wav` — safe

Peak -8.5 dBFS, RMS -33.2 dBFS, crest 15.3, spectral centroid 132 Hz, 183 voices spawned over the excerpt. Reverb profile `safe`.

**What to listen for.** The Office of Record. Small, warm, 0.42 s decay, hum at 0.22, almost no events — a drip every 90 s. Listen for: relief. If this is not audibly safer than the Service Spine within two seconds of pressing play, the contrast the whole game rests on is not there.

## Levels

- **Clipping:** 0 artefact(s) clipped.
- **Within 0.2 dB of full scale:** 0.
- **Inaudibly quiet:** 0 — none.

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
