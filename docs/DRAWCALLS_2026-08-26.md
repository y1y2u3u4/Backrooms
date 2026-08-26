# Where the draw calls go

Measured with `tools/qa/drawcalls.mjs --quality high`, which wraps
`renderer.renderBufferDirect` and attributes every call to an object, a
material, and a pass. Twelve scenarios, one per authored camera in
`perf-scenarios.json`.

## A correction first

An earlier note here said the budget of 180 "was comparing different things"
because the total contains more than one geometry pass. That was wrong. The
budget in `perf.mjs` is documented as what "must hold on real hardware for a
comfortable 60 fps", and `renderer.info.render.calls` is the whole frame. 435
against 180 is a real 2.4x overshoot, not an accounting artefact.

What the pass split changes is not the size of the problem but where to push.

## The numbers

| scenario | total | colour | gtao-normal | shadow |
|---|---|---|---|---|
| service_spine | 435 | 257 | 178 | 0 |
| residence_landing | 413 | 246 | 167 | 0 |
| plant_hall | 379 | 272 | 107 | 0 |
| intake_spine_east | 375 | 227 | 148 | 0 |
| intake_many_lights | 287 | 183 | 104 | 0 |
| cistern_tunnel | 271 | 175 | 96 | 0 |
| intake_open_bay | 265 | 172 | 93 | 0 |
| stack_well | 243 | 161 | 82 | 0 |
| duct_crawl | 181 | 130 | 51 | 0 |
| safe_room | 127 | 103 | 24 | 0 |
| intake_corridor | 119 | 99 | 20 | 0 |
| intake_long_view | 99 | 89 | 10 | 0 |

Budget 180. Four scenarios are over on the colour pass alone (272, 257, 246,
227); seven are over on the total.

## Two things worth knowing

**The GTAO normal prepass is 40 % of the worst frame.** `MeshNormalMaterial`
appears nowhere in this codebase — it is what three's `GTAOPass` uses to fill
its normal buffer, by drawing the whole scene again. It is one flag
(`Engine.QUALITY[tier].ao`), already false at the low tier, and it is the
largest single lever in the list. Whether the contact darkening it buys is worth
178 draw calls in the Service Spine is a judgement that needs the two frames
side by side, and that comparison has not been made.

**No shadow-map calls were counted in any of the twelve.** The high tier
configures `maxShadows: 3` and `lightProbe()` reports one shadow-casting
fixture, so either the shadow pass runs outside the window this tool watches or
those lights are not actually casting. Not diagnosed. It matters because a
shadow pass would be a third full traversal and nothing in the budget accounts
for one.

## What was fixed here

The keypad: 26 meshes and 24 materials down to 4 meshes and 2, by merging the
static caps and glyph faces against one atlas and moving the twelve raycast
targets to `Interactor.PROXY_LAYER` — hit but never drawn. `residence_landing`
457 -> 413.

That pattern generalises. `calls == mat` in the attribution is the signature: it
means every mesh carries its own material and no amount of geometry merging will
help until those collapse. Rows still showing it:

    32 calls   2k tris   27 mat    <Mesh> | (ShaderMaterial)      volumetric cones
     9 calls   2k tris    9 mat    residence | (MeshBasicMaterial)
    48 calls  78k tris   11 mat    residence | doorPaint

The doorPaint row is the interesting one: 48 meshes over 11 distinct materials
named the same thing, which is the `.clone()` variant pattern. Doors move and
must stay independent; frames and architraves do not.
