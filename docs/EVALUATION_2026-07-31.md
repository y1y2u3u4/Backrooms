# THE ANNEX — independent evaluation, 31 July 2026

Someone else's project, played and measured from a clean clone of
`claude/backrooms-horror-game-9s3q1k` at `c99a730`. This is what I found, what I
changed, and what I got wrong on the way.

Everything below was measured on **an Apple M4 through ANGLE/Metal**, in a real
browser, at 1280×720 CSS with the renderer's 1.5× pixel-ratio cap — so 1920×1080
of actual pixels. That matters: `docs/COMPLETION_REPORT.md` and
`docs/NEXT_ITERATION_PROMPT.md` §3.3 both say, correctly and repeatedly, that
every performance and pixel number in this project came from SwiftShader and is
not a frame-rate verdict. This run is the GPU verdict that was missing.

---

## 1. The headline: every troffer in the building was a sealed box

**`src/world/Kit.js`, `troffer()`.** The housing was built as

```js
const housing = box(L + 0.06, 0.12, W + 0.06, 0.006, 1);
housing.translate(0, 0.062, 0);          // y ∈ [0.002, 0.122]
```

and `box()` returns a `RoundedBoxGeometry` — a closed solid, six faces. The lamps
this same function claims an emissive slot for sit at

```js
t.translate(0, 0.040, off);              // y ∈ [0.021, 0.059], r = 0.019
```

**inside it.** Every recessed troffer in the game had its fluorescent tubes
sealed within its own steel casing. That is 200 of the Intake's 208 fixtures, and
the Intake is where the game starts.

### The evidence

Standing directly under a fitting reporting `health: "good"`, `level: 0.97`,
`slotColor: [1.34, 1.24, 1.02]`, `visible: true`, in the scene graph, in an
`InstancedMesh` that is submitted every frame:

| | peak pixel | mean pixel |
|---|---|---|
| shipping | 156 | 38.7 |
| **every emissive mesh in the zone hidden** | 154 | 38.7 |
| restored | 155 | 38.8 |

Hiding every luminous source in the Intake moved the frame's peak by 2/255 and
its mean by 0.0. The tubes were not contributing pixels. Looking down the
corridor at the ceiling line and dropping the tube instances 120 mm — below the
casing — as a control:

| | peak | pixels > 200 |
|---|---|---|
| shipping | 208 | 7,893 |
| tubes dropped 120 mm | 239 | 17,767 |
| restored | 208 | 5,135 |

### Why nothing caught it

This is the sixth instance of the pattern §6 of the next-iteration brief is
about, and it is worth writing down because every tool involved was green:

- `lightreach` measures distance from a walkable point to a fixture. The fixtures
  were there. Pass.
- `geobudget` counts fixtures and asserts `unlit fixtures 0 / 0`. They were lit —
  the `SpotLight` was working. Pass.
- `perf` counts emissive draw calls. The batch was submitted, once per zone,
  exactly as designed. Pass.
- `lightProbe()` reads direct illumination at head height: 37.3 units. That is
  the `SpotLight`, which is a different object from the mesh. Pass.
- Sixty capture screenshots. Nobody looked *up*.

The one measurement nobody made was whether the thing that is supposed to glow
is bright in the frame. The commit `fd61f0b "Verify the emissive batch in pixels,
not only in counters"` is in the log; the check it describes did not exist.

This also explains a symptom the project has been chasing for several iterations
without resolving. §2.1 says the Stack "still does not read" after light reach
went 10.66 m → 4.99 m, area beyond 5 m went 39 % → 0 %, an enclosing shaft wall
was added and fixture output was tripled — and correctly concludes that raising
fill again is not the answer. It is not, because **the room had no visible light
sources to begin with.** No amount of fill substitutes for the fitting itself,
which is what binding constraint 3 has been saying all along.

### The fix

1. **The housing is a pan, not a box** (`Kit.js`). Five plates — a top and four
   sides — leaving the aperture open the way a louvred fitting actually is. The
   pan interior is unlit steel and reads black, which is what frames the tubes.
   The pan plates pass `radius: 0` (plain `BoxGeometry`), so five of them come to
   *fewer* triangles than the one `RoundedBoxGeometry` they replace: the Intake
   went **473,888 → 466,364 triangles**, i.e. this fix is 7,524 triangles cheaper
   than the bug.

2. **A flush diffuser** (`Kit.js`, `EmissiveBatch.js`). Opening the pan is not
   enough on its own, and the measurement says so: with the pan open and no
   diffuser, **81 lit fixtures inside the camera frustum and 21 pixels above 200
   in the whole frame.** The Intake's ceiling is 2.75 m and the eye is at 1.63,
   so a fitting 7 m down the corridor is seen 9° above the horizontal — past the
   68° cross-axis cut-off of a 120 mm-deep aperture. Physically correct, and
   useless. A real fitting of this period closes the aperture with an opal panel
   that glows from every angle including grazing, and that panel is what the eye
   reads as "the light". It was named in the function's own doc comment
   ("Emits housing + diffuser + tubes") and had never been built. It rides in the
   emissive instance with the lamps for no extra draw call — `EmissiveBatch` now
   enables `vertexColors`, so one instance can carry lamps and diffuser at
   different luminance and they still dim, flicker and die together.

3. **The Service Spine's battens hang their tube below the gear tray**
   (`ZoneKit.js`, `stripLight`). The tube sat at +0.002 against a body spanning
   [0.0005, 0.0755]: the top 55 % of a 38 mm tube inside sheet steel, 17 mm of
   sliver reaching the frame. On a batten the lamp is below the tray — that is
   the entire point of the form.

### After

Same pose, same tier, same build, lamp state identical:

| ceiling pose (a fitting in frame) | peak | pixels > 200 |
|---|---|---|
| shipping | 208 | 7,893 |
| pan open, no diffuser | 234 | 39,957 |
| pan open, diffuser at 0.42 | 208 | 9,055 |
| **pan open, diffuser at 0.90** | **244** | **47,733** |

Service Spine, spawn view, lamp off: peak **255**, 19,493 pixels above 200 — the
strip battens now read as a receding line of tubes, which is the zone's signature
and was previously a line of dark boxes.

`npm run audit` is green after the change: aotest PASS, props 70/70, chain 95/95,
audiowiring 5/5, floorgaps clean, portalgraph 8/19, geobudget under every budget.

---

## 2. The GPU frame rate, measured for the first time

`docs/NEXT_ITERATION_PROMPT.md` §3.3: *"If you have GPU access, measure it in the
worst-case scenes and report honestly."*

Eight headings per zone from the zone's own open-floor spawn, high tier, 1920×1080,
GPU-synchronised with a `readPixels` fence each frame:

| zone | ms | fps | draw calls | triangles | active lights |
|---|---|---|---|---|---|
| plant | 69.1 | **14.5** | 368 | 839 k | 14 |
| service | 40.2 | **24.9** | 423 | 610 k | 14 |
| intake | 33.5 | **29.9** | 287 | 964 k | 12 |
| residence | 23.1 | 43.3 | 441 | 348 k | 1 |
| duct | 23.3 | 42.9 | 205 | 172 k | 4 |
| safe | 23.6 | 42.4 | 201 | 871 k | 5 |
| stack | 22.1 | 45.2 | 197 | 868 k | 0 |
| cistern | 20.4 | 49.0 | 279 | 234 k | 1 |

**No zone reached 60 fps at the shipping high tier.** The brief's target is a
stable 60. The Plant ran at 14.5.

The cost is not geometry — the Cistern draws 234 k triangles in 20 ms and the
Stack draws 868 k in 22 ms. It tracks **active dynamic lights**, exactly as the
comment above `QUALITY` in `Engine.js` predicts, plus a large fixed post-chain
cost. Decomposed at a fixed pose in the Intake, four interleaved rounds so drift
could not favour one configuration:

| configuration | ms | fps |
|---|---|---|
| msaa 4, GTAO 1.0 (shipped) | 34.6 | 28.9 |
| msaa 4, GTAO 0.5 | 31.2 | 32.1 |
| msaa 2, GTAO 0.5 | 26.0 | 38.5 |
| msaa 0, GTAO 0.5 | 19.6 | 51.0 |

CPU logic is free: `step()` alone measures 0.1 ms. This is entirely a render cost,
and 4× MSAA on a half-float 1080p target plus a full-resolution GTAO is 15 ms of
a 34.6 ms frame.

### What I changed

`QUALITY.high`: `aoScale` 1.0 → 0.5, `msaa` 4 → 2. Ambient occlusion is a
low-frequency signal and already runs at 0.5 on medium; 2× MSAA still resolves
the sub-pixel speckling on this building's thin edges that 0× does not.

Interleaved A/B, same session, same poses, both configurations warmed on every
heading first:

| zone | old median | new median | old worst | new worst |
|---|---|---|---|---|
| intake | 36.9 ms (27.1 fps) | **22.9 ms (43.7 fps)** | 42.2 ms (23.7) | 36.6 ms (27.3) |
| service | 44.3 ms (22.6 fps) | **24.9 ms (40.2 fps)** | 52.4 ms (19.1) | 38.3 ms (26.1) |
| plant | 41.3 ms (24.2 fps) | **23.7 ms (42.2 fps)** | 64.3 ms (15.6) | 53.0 ms (18.9) |

Median frame time down 38–44 %, median frame rate up 61–86 %.

**It still does not hit 60.** Median is now ~40 fps instead of ~25, and the worst
heading in the Plant is 18.9. Two post-chain settings cannot close that gap; what
remains is the per-fragment light loop in the two zones that run fourteen
simultaneous lights, and it needs a lighting or a renderer decision, not a
quality flag. The medium tier is the one that lands near 60 (46–81 fps measured),
and it is now reachable in both directions — see below.

### Two related fixes

**`preserveDrawingBuffer` shipped on.** It was hard-coded true with the comment
"QA capture needs readable frames". It asks the driver to keep the back buffer
alive after presentation and costs a full-frame copy on a tile-based GPU. It is
now bound to `?qa=1`, so the QA harnesses keep it and players do not.

**The quality ladder was one-way, with `low` latched behind a 999-second
cooldown.** That is defensible when a drop means the machine cannot cope, and
wrong here, because the drop is usually the *room*: the same GPU measures 26 fps
in the Plant and 49 in the Cistern. Thirty seconds in the Plant used to cost a
player the rest of the session at 1190×670 with no ambient occlusion — a tier
that measures 100–185 fps on this machine, i.e. throwing away most of the GPU to
pay for a corridor they left ten minutes ago. It can now climb, with twice the
dwell and a margin well inside the tier below's trigger so the two cannot
oscillate.

---

## 3. A new check: `tools/qa/emissive.mjs`

Per §6 — *"every claim you make must be backed by a measurement that would fail
if the claim were false"* — the luminaire fix is worth nothing without a tool
that would have caught the original bug and will catch the next one.

`node tools/qa/emissive.mjs [--gpu]` powers the whole board, then for each
fixture type in each zone stands at 2.5 m and 6 m from a lit fitting, aims at it
by projecting it and correcting the angular error, and compares the brightest
pixel over the aperture with the brightest pixel in a ring of ceiling around it.
A lit fitting that does not beat its own surround by 24/255 is reported
`INVISIBLE`, and a type that was never sampled is reported as a coverage hole
rather than silently passing.

It also takes `--gpu`, and so does `capture.mjs` now: these harnesses hard-code
`--use-angle=swiftshader`, which is right on a headless box with no GPU and wrong
on a laptop with one. **On this machine the flag does not help** — headless
Chromium still reports `SwiftShader Device (LLVM 10.0.0)` with the flags removed,
which is why the tool prints the renderer string on every run and why every GPU
number in §2 came from the in-app browser rather than from here. The flag is
worth having and it is not a substitute for checking what you actually got.

Current output, `--zones intake,service --per 3`:

```
type          n   range   aperture mean   ceiling median   delta   verdict
bulkhead       3   2.5 m             143              146      -7   INVISIBLE
bulkhead       3     6 m             116               38      12   cut off (not gated)
emergency      6   2.5 m             139              129      25   ok
emergency      6     6 m             226              225       2   cut off (not gated)
strip          3   2.5 m              56                2      42   ok
strip          3     6 m             186              184       2   cut off (not gated)
troffer        6   2.5 m             161               99      64   ok
troffer        6     6 m             229              220       5   cut off (not gated)

⚠ never sampled: highbay, pendant — coverage hole, not a pass
```

**The tool discriminates.** Run against the same fixed build with every emissive
mesh in the zone hidden — which is what the shipped troffer amounted to — the
same troffer measurement goes from `aperture mean 179 / ceiling 78 / delta +101`
to `68 / 74 / delta −6`, well under the threshold of 24. A check that cannot fail
is not a check, and this one was verified against a known-broken state rather
than assumed.

Two caveats stated rather than hidden. `bulkhead` reports INVISIBLE and I do not
believe it: the sampler picks a standing position by open floor alone and never
asks which way a wall-mounted fitting faces, so it is photographing the back of
some of them. That is a tool limitation, noted in the source, and the verdict for
wall-mounted types should be read as unproven. And the 6 m row is currently
uninformative — the ring saturates at that distance — which is why only the
nearest range gates the run.

---

## 4. Smaller findings, measured but not fixed

**The title menu's legibility is left to chance.** The menu camera drifts through
the Intake behind the title card. When it lands on a dark stretch the typography
is excellent — genuinely the strongest piece of design work in the project. When
it drifts up against a lit wall, the backdrop measures 218/255 and the unselected
items (`rgba(207,200,180,.6)`) come to a contrast ratio of **1.11 : 1**; the
selected item reaches **1.42 : 1**. WCAG AA for large text is 3.0. I caught this
on the first load and could not reproduce it on the next two, which is the
problem: it is a coin flip. A scrim behind the menu column would fix it, and the
UI harness already has the right instinct — its own comment says the plate exists
so you can judge "whether an amber prompt is sitting on an amber wall".

**Nothing in the frame is allowed to be bright.** Before the luminaire fix no
pose I tried produced a pixel above 208, and most produced nothing above 156.
That is the visual analogue of what commit `f980964` says about the mix — "the
mix has no dynamics at all" — and it has the same cause on both sides of the
project: the loudest thing in the room was turned off.

**The first-person hands.** §2.4 already names these and it is right. They read
as a pale prosthetic rather than a hand, and they do not sit in the scene's
colour — they are noticeably pinker and brighter than every frame they appear in,
including deep in the unlit Stack. They are one of the two things always on
screen.

**The intro cinematic is 18 seconds with the player frozen** (`controlEnabled`
false, `lookEnabled` false throughout), measured by stepping the sim to the end
of `cine.active`. There is a hold-to-skip affordance.

**The Intake's spawn corridor has no fittings in its own ceiling.** They are in
the bays either side at z = 19.7 and 26.5; the corridor runs along z = 23.4. The
light in the opening shot spills in from next door. `lightreach` already reports
the Intake's worst case at 9.86 m with 9 % of walkable area beyond 5 m from a
lamp, and this is where it lives — the first corridor the player ever sees.

**Boot is slow and it is all CPU.** Everything is synthesised at load; a warm
reload on an M4 takes 20–30 seconds to `ANNEX_READY` at the high tier, and
headless Chromium at `textureQuality: 1` sits at 100 % of one core for minutes.
That is the price of the "everything is synthesised" design and it is mostly a
fair one, but it is also why every browser-based harness in `tools/qa` is
expensive to run, which is why several of them had not been.

---

## 5. Where the brief is out of date

§3.1 says the audio has never been rendered and that
`tools/qa/audio-render.mjs` "has never been run". It has: `docs/verification/`
contains `audio/`, `audio2/`, `audio3/` and `audio4/`, committed. I re-ran it
against the current mix — 75 sounds, 8 zone beds, 2 scenes, 85 wav files, 168 MB,
0 warnings, 0 failures — and reverted the regenerated binaries rather than
committing 271 MB of churn for a run that only confirms the tool works. The zone
beds' crest factors are worth someone's ears: 3.9 in the Plant against 15.3 in
the Safe Room, which is a very wide spread for eight rooms in one building.

Two tooling notes for whoever runs this next: `npx playwright install chromium`
is a prerequisite nothing in the repo mentions, and `audio:render` exits **0**
when Playwright is missing, so `npm run audio:render` reports success while
producing nothing. That is a small instance of the same pattern as everything in
§1.

---

## 6. What I got wrong

Recorded because §6 of the brief asks for it, and because two of these would have
become confident claims if I had stopped measuring one step earlier.

1. **"Auto-quality is blind to the GPU."** `Engine.render` measures `t1 - t0`
   around a pile of asynchronous WebGL calls, so I expected `frameTime` to read a
   few milliseconds while the GPU took 42, and the ladder to never fire. It fires
   correctly: once the GPU is the bottleneck the driver's back-pressure blocks
   the submitting thread and the CPU-side measurement tracks reality. I watched
   it drop `high → medium` on its own mid-measurement. The real defect in
   `_autoQuality` is that it could not climb back, which is a different bug.

2. **"The title screen persists over live gameplay."** A screenshot showed the
   menu painted over a corridor I had just walked down, with the DOM insisting
   the title was hidden and the HUD was on. It was a compositing artefact of the
   hidden preview pane: the WebGL canvas kept updating because I was driving
   `renderOnce` synchronously, and the DOM layer was frozen at its last paint.
   Not a game bug. Screenshots from a backgrounded pane are only trustworthy for
   the canvas.

3. **The diffuser at 0.42.** I picked it from the ratio of tube projected area to
   aperture area and it made the fitting *dimmer* than the open pan — 208/9,055
   against 234/39,957 — because an opaque panel across the aperture hides the
   lamps behind it. The physical reasoning was about total flux; what the frame
   sees is luminance. Measured, corrected to 0.90, re-measured.

4. **A naive "walk toward the objective" bot got stuck 8.2 m short of the first
   note**, wedged against a wall, which is exactly the failure §3.2 predicts for
   scripted navigation. I mention it not as a game defect but because it is the
   cheapest possible demonstration that the exploration-bot gap in the brief is
   real.

---

## 7. What this run did not cover

- **The Stack and the Cistern**, §2.1 and §2.2, are untouched. The luminaire fix
  helps them — their strip fittings now show their lamps — but the crushed-pixel
  targets need re-measuring with the shipped tools, and my attempts to photograph
  the Stack kept landing inside its arrival cinematic with exposure clamped at
  0.3. The diagnosis in §2.1 should be revisited now that the fittings are
  visible: "a different class of fitting" may no longer be the answer.
- **No judge rounds** (§3.4).
- **No exploration bot** (§3.2).
- **Hands, dressing density, SSR, entity animation, Director pacing** — all
  untouched.
- **One machine.** Every number here is an Apple M4. They are not a claim about
  every machine; they are a claim that the high tier as shipped did not reach its
  own target on a current Apple GPU, which had never been checked.

---

## Changed files

```
src/world/Kit.js            troffer: open pan + flush diffuser
src/world/ZoneKit.js        stripLight: tube below the gear tray
src/render/EmissiveBatch.js vertexColors, so one instance carries two luminances
src/core/Engine.js          high tier msaa 4→2, aoScale 1.0→0.5;
                            preserveDrawingBuffer behind qa; two-way quality ladder
src/Game.js                 pass readback: this.qa to the Engine
tools/qa/emissive.mjs       new — the check that would have caught §1
tools/qa/capture.mjs        --gpu
```
