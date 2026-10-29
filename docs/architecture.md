# How Endless Rose works (greybox)

An endless prayer hall in plain plaster. You move down the central nave toward the mihrab one bay
per count of dhikr. There is no ornament yet: this stage is only for judging the space and the pace.

## The space: a T-plan hypostyle

- **Hypostyle**: a hall whose roof stands on a forest of columns, like the Great Mosques of Córdoba
  and Kairouan. A forest of columns has no natural end, which is why it suits an endless hall.
- **T-plan**: one wider aisle, the nave (8 m), runs to the mihrab, and one aisle (8 m deep) runs
  along the qibla wall. Together they make a T. The side aisles are 5 m wide.
- The arcades run toward the qibla. Every **bay** (3.2 m) of an arcade has a column (plinth, base,
  shaft, capital, impost), a pier above it, a lower horseshoe rib bracing the columns, an open band,
  then a round upper arch under a wall that rises to the 9 m ceiling. These are Córdoba's two tiers
  of arches.
- At the end of the nave: the transverse arcade (big horseshoe arches, the nave's widest), a dome
  over the bay in front of the mihrab, the qibla wall, and the mihrab (frame, horseshoe ring, niche).
- Every dimension is in `src/config.js`.

## How "endless" works

1. **Floating origin (the treadmill).** The camera's real distance `d` can grow forever, but the GPU
   only ever sees the camera inside the first bay. Each frame, `base = floor(d / bay)` counts the whole
   bays travelled, and everything is drawn shifted back by that many bays. Because every bay is
   identical, the shift can't be seen. The numbers on the GPU stay small, so there is no jitter
   after kilometres, and the scene never grows.
2. **Instancing.** There is one column-and-pier shape and one arch shape, each drawn about 1,400 times
   (`THREE.InstancedMesh`). The GPU gets a list of positions instead of 1,400 copies of the geometry.
3. **Chunks.** The arcades are split into groups of six, each its own instanced mesh, so three.js can
   skip whole groups that are outside the view (frustum culling).
4. **The cut.** The field of columns stops at the transverse arcade. `visibleRows()` in `src/layout.js`
   decides which rows to draw; `tests/layout.test.mjs` checks that every arch lands on a column and
   that no gap opens before the transverse arcade.
5. **Haze.** Exponential fog hides everything past about 100 m. So the field only needs to be built
   32 rows ahead and 18 arcades to each side.
6. **Real row numbers for variety.** Anything that changes from bay to bay uses the real row number
   (`base` plus the local row), so it stays put as you move. In the greybox that is only which
   side-aisle bays have a lantern. Later each dome's rose will be chosen the same way (seeded
   procedural generation).

## How counting moves you

- `step()` in `src/motion.js` turns each count into a target distance.
  - **Arrive mode**: counts 1 to 32 are one bay each. The 33rd ends the phrase under the dome,
    7 m from the qibla wall. The 34th starts the next approach, with the next phrase.
  - **Ahead mode**: one more bay, forever. The transverse arcade, dome and qibla wall stay 26 bays
    (83 m) ahead, deep in the haze, so the mihrab's light is always in front of you.
- **The glide** is a critically damped spring (`spring()`). It moves toward the target as fast as it can
  without overshooting, and takes a new target mid-glide smoothly. So fast counting becomes one
  continuous walk, and slow counting becomes step, glide, rest. It is solved exactly for each frame,
  so a dropped frame can't make it wobble.
- **The wash of light** (`src/fader.js`): a jump (a new approach, a mode change, a reset) happens at
  full light, and the camera holds still while the light rises.
- **Reduced motion**: with the system setting on, there is no glide; each count cuts straight to the
  next bay. That cut is almost invisible, because the hall repeats bay by bay.

## Looking around

`src/input.js`:
- **Desktop**: the pointer's position steers the head, with a still centre. It turns up to 32° left or
  right, 30° up and 8° down, smoothed. Click to count.
- **Touch**: a swipe turns the head and a tap counts. A press that moves more than 10 px is a swipe.
- **Keys**: Space or Enter counts, the arrow keys look around, Home looks straight ahead again.

## Lighting the greybox

There are no textures and no shadow maps. Instead:
- A **hemisphere light**: warm light from above, and a softer bounce from below that lights the ceiling
  and the undersides of the arches.
- One **directional light** from the upper side, to show the shapes.
- **Baked vertex shading**: each piece darkens near the floor and the ceiling, written into its
  vertex colours (`finish()` in `src/hall/pieces.js`).
- **Floor and ceiling shaders** work out the nearest column from the grid's maths and darken around it
  (`src/hall/surfaces.js`). That gives contact shadows for 1,400 columns for a few lines of maths
  per pixel.
- **Glows** are camera-facing squares with their own fog (`src/hall/glow.js`). The mihrab's glow lies
  flat on the wall and fades as you come close, handing over to the lit niche.
- **Tone mapping**: Khronos PBR Neutral, which keeps the plaster's colour honest.

## Files

| File | What it does |
| --- | --- |
| `src/config.js` | Every dimension, speed and colour |
| `src/layout.js` | Where arcades and rows stand, and which rows to draw (no three.js; tested) |
| `src/motion.js` | Counts, phrases, targets, the spring (no three.js; tested) |
| `src/hall/pieces.js` | The geometry of every piece, plus its baked shading |
| `src/hall/field.js` | The instanced field of arcades |
| `src/hall/qibla.js` | Transverse arcade, dome, qibla wall, mihrab |
| `src/hall/lanterns.js`, `glow.js` | Lanterns, chains and their glow |
| `src/hall/surfaces.js` | Floor and ceiling, with their shaders |
| `src/input.js`, `overlay.js`, `fader.js` | Input, the words on screen, the wash of light |
| `src/main.js` | Puts it together and runs the frame loop |

## Checking it

- `npm test` runs the layout and motion tests (9).
- `npm run smoke` needs the dev server on port 5197. It does a cold load in headless Chrome, driven
  only by real clicks, keys, taps and swipes: 18 checks, with screenshots in `capture/smoke/`.
  It reads `window.__hall` (dev builds only) to measure what the input did; it never drives it.

Measured on an M2 Pro (headless Chrome, frame limit off): about 380 fps at 1280×800 and about 250 fps
at 2560×1600, drawing about 650k triangles in 30 draw calls. Not yet measured on a phone.

## Terms worth knowing

Floating origin, instancing, draw call, frustum culling, critically damped spring, exponential fog,
ambient occlusion (baked and analytic), tone mapping, seeded procedural generation.

## What this greybox is for deciding

- **Arrive or Ahead**: decided on 2026-10-29. Arrive is the default, so each phrase ends at the
  mihrab; Ahead stays in the toggle.
- **Pace**: is one bay per count right? Is the glide too slow or too quick? (`MOTION.stiffness`,
  `HALL.bay`)
- **Space**: the nave's width, the column height, the haze's depth.
