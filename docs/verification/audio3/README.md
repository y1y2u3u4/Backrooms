# THE ANNEX — audio, as files you can play

Generated 2026-07-30T07:46:53.479Z by `tools/qa/audio-render.mjs`. Every file here is
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

One continuous 30-second excerpt per zone. A horror soundscape is a bed, not a
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
| [`beds/intake.wav`](beds/intake.wav) | `corridor` | -0.2 | -6.4 | 2.6 | 92 | — |
| [`beds/service.wav`](beds/service.wav) | `service` | 0.0 | -6.5 | 2.4 | 94 | CLIP |
| [`beds/cistern.wav`](beds/cistern.wav) | `cistern` | 0.1 | -9.4 | 3.8 | 75 | CLIP |
| [`beds/residence.wav`](beds/residence.wav) | `dead` | -2.3 | -20.1 | 8.1 | 102 | — |
| [`beds/plant.wav`](beds/plant.wav) | `hall` | 0.0 | -7.0 | 2.9 | 93 | CLIP |
| [`beds/duct.wav`](beds/duct.wav) | `duct` | -0.8 | -17.2 | 6.7 | 79 | — |
| [`beds/stack.wav`](beds/stack.wav) | `stack` | -0.1 | -6.3 | 2.6 | 91 | hot |
| [`beds/safe.wav`](beds/safe.wav) | `safe` | -2.6 | -19.7 | 6.4 | 112 | — |

### `beds/intake.wav` — intake

Peak -0.2 dBFS, RMS -6.4 dBFS, crest 2.6, spectral centroid 133 Hz, 92 voices spawned over the excerpt. Reverb profile `corridor`.

**What to listen for.** The signature sound of the game. A corridor of fluorescent tubes at 100 Hz, each detuned a few cents so the corridor beats against itself, plus ballast whine near 9.4 kHz. Listen for: the beating (it should wander, never pulse regularly); one tube stuttering out of sync with the others and crackling back in; carpet footsteps that do NOT excite the room; a near-dead low room tone under everything. If this reads as one steady synth pad, the per-fixture spatialisation is not working.

### `beds/service.wav` — service

Peak 0.0 dBFS, RMS -6.5 dBFS, crest 2.4, spectral centroid 151 Hz, 94 voices spawned over the excerpt. Reverb profile `service`.

**What to listen for.** Cold and load-bearing. Concrete footsteps should slap the corridor — the room excitation layer is 6x the carpet one — and the reverb is longer and brighter. Listen for: the transformer buzz at the far end getting louder and duller as you approach and pass it, the vent grille sweeping, and drips roughly every 17 s. A drip behind a partition should be duller AND wetter than one in the open; that is occlusion working, and it is the single most important thing in this file.

### `beds/cistern.wav` — cistern

Peak 0.1 dBFS, RMS -9.4 dBFS, crest 3.8, spectral centroid 249 Hz, 75 voices spawned over the excerpt. Reverb profile `cistern`.

**What to listen for.** Drowned and slow. A drip every ~4 s, running water, the standing-water lap breathing on three incommensurate LFOs, and a long tuned slap-back at 74 Hz. Footsteps are wading. Listen for: whether the drips ever sound like a metronome (they must not — the gaps are exponentially distributed), and whether the 74 Hz resonance is a room or a hum.

### `beds/residence.wav` — residence

Peak -2.3 dBFS, RMS -20.1 dBFS, crest 8.1, spectral centroid 144 Hz, 102 voices spawned over the excerpt. Reverb profile `dead`.

**What to listen for.** Nearly dead acoustically — carpet, damask, soft furnishings, a 0.34 s decay. This file is mostly a test of restraint: the hum is at 0.12, there is almost no vent, and the structure creaks every ~26 s. Listen for: whether it is unnervingly quiet rather than broken, and whether the creaks read as a building settling rather than as a sound effect.

### `beds/plant.wav` — plant

Peak 0.0 dBFS, RMS -7.0 dBFS, crest 2.9, spectral centroid 150 Hz, 93 voices spawned over the excerpt. Reverb profile `hall`.

**What to listen for.** A 14 m concrete cathedral with a 3.1 s decay and a 196 ms slap. The machinery bed is at full proximity: two shafts at slightly different speeds beating against each other, plus casing broadband. Footsteps are chequer plate over a void and should ring for ~0.4 s. Listen for: whether the machine sounds like a machine hunting rather than a sawtooth, and whether the reverb makes the space feel 14 m tall.

### `beds/duct.wav` — duct

Peak -0.8 dBFS, RMS -17.2 dBFS, crest 6.7, spectral centroid 155 Hz, 79 voices spawned over the excerpt. Reverb profile `duct`.

**What to listen for.** A 0.8 m galvanised box around your head: 0.30 s decay, 214 Hz box resonance, width 0.35, nothing but the vent (at 1.0) and your own knees. Listen for: claustrophobia. The panel should boom under each crawl step and the reverb should feel like it is touching your ears.

### `beds/stack.wav` — stack

Peak -0.1 dBFS, RMS -6.3 dBFS, crest 2.6, spectral centroid 172 Hz, 91 voices spawned over the excerpt. Reverb profile `stack`.

**What to listen for.** A vertical shaft: 4.2 s decay, 42 ms predelay, full stereo width, hum at 0.70 from floors above and below. Listen for: whether the early reflections read as *distance upward* rather than as a big room, and whether distant impacts arrive with no highs at all.

### `beds/safe.wav` — safe

Peak -2.6 dBFS, RMS -19.7 dBFS, crest 6.4, spectral centroid 160 Hz, 112 voices spawned over the excerpt. Reverb profile `safe`.

**What to listen for.** The Office of Record. Small, warm, 0.42 s decay, hum at 0.22, almost no events — a drip every 90 s. Listen for: relief. If this is not audibly safer than the Service Spine within two seconds of pressing play, the contrast the whole game rests on is not there.

## Levels

- **Clipping:** 3 artefact(s) clipped.
- **Within 0.2 dB of full scale:** 1.
- **Inaudibly quiet:** 0 — none.

### Failures

- bed service: 1 clipped samples (peak 1.001)
- bed cistern: 19 clipped samples (peak 1.009)
- bed plant: 250 clipped samples (peak 1.001)

### Warnings

- bed stack: peak -0.1 dBFS — within 0.2 dB of full scale

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
