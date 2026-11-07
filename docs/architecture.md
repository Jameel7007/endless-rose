# How Endless Rose works

An endless prayer hall in plain plaster. You move down the central nave toward the mihrab one bay
per count of dhikr. The light follows the real day where you are: the sun comes in through
openings in the ceiling where it truly stands, and the hall keeps the prayer times. There is no
ornament yet.

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

## Light that keeps prayer time

**The clock** (`src/sky/clock.js`) shows either now or a moment you are previewing. The Light panel's
slider sets the preview, and `?t=17:30` in the address does the same.

**The place** (`src/sky/place.js`). With no choice made, the place is estimated from the browser's
time zone: its main city, from a table of about a hundred zones. That needs no permission.
**Use my location** asks the device once, rounds the answer to about a kilometre, and saves it in
this browser only. Nothing is sent anywhere. Browsers allow location only on secure (https) pages
and on localhost, so it won't work on a phone opened over the local network. `?at=lat,lon` sets a
place for testing.

**The sun and the prayer times** (`src/sky/sun.js`) are plain maths, with no library:
- The sun's position comes from its declination and the equation of time, using the same
  low-precision formulas as PrayTimes.org. They are good to about a minute this century.
- Each prayer is the moment the sun reaches a certain angle:
  - **Fajr**: 18° below the horizon (Muslim World League; other methods use 15° to 19.5°).
  - **Sunrise and Maghrib**: 0.833° below the horizon (the sun's disc plus refraction).
  - **Dhuhr**: just after noon.
  - **Asr**: when a shadow is as long as its object plus its noon shadow (twice as long for Hanafi).
  - **Isha**: 17° below the horizon (or 90 minutes after Maghrib for Umm al-Qura).
  - Far north in summer, Fajr and Isha are held at the middle of the night.
- `tests/sun.test.mjs` checks 192 times against adhan-js (a well-tested library, used only to make
  the reference file): 178 match to the minute and the rest are one minute off.

**The hall faces the real qibla.** The nave points at the Kaaba's bearing from your place, so the sun
keeps its true direction: from Mexico City the nave faces north-east (47°), so the morning sun comes
in from ahead and to the right.

**Openings in the ceiling** (`isOpen()` in `src/layout.js`): a 1.8 m square in the middle of every
other bay of every aisle, alternating like a chessboard, each under a 0.6 m deep light well. The
ceiling's shader simply leaves those squares out, so the sky shows through.

**Sunlight without shadow maps** (`src/hall/light.js`). For each pixel of plaster, the shader follows
a line from that point toward the sun and asks whether it gets out:
- It must pass through an opening at the ceiling and again at the top of its well. So low sun (below
  about 18°) can't get in at all, and the patch of light narrows as the sun sinks.
- If the line meets an arcade wall above the crowns of the upper arches, where the wall is solid,
  it is blocked.
- Under the dome, the only way out is the oculus. That makes the bright ellipse that crawls across
  the qibla wall through the day.
- The edges are softened by the sun's real width (half a degree).

It's all arithmetic on the hall's grid, so there are no shadow maps and the cost doesn't grow with
the number of columns. The trade-off: columns don't cast shadows inside a sunbeam.

**Beams** (`src/hall/beams.js`) are long quads that turn about their own axis to face the camera,
drawn for openings within 36 m. A beam slanting across the hall stops where it meets the solid top of
a wall.

**The look of each hour** (`src/sky/look.js`) is a set of key moments by the sun's height: night,
dawn blues, the rose and gold of sunrise and sunset, the cream of day. Evenings are warmer than
mornings at the same height. Each key sets the haze, the sky light, the bounce from the floor,
the sunlight's colour and strength, the beams, the lanterns and the exposure, and the hall blends
between them.

**Lanterns light the plaster** the same way, from the grid: each pixel adds the nearest lanterns of
the nave, the nearby side aisles and the transverse aisle, plus the big lamp under the dome. Each
lantern's light fades to nothing by the distance at which a nearer one takes its place in the sum,
so there are no seams. They are faint by day and full at night. After sunset the words on screen
turn light on dark.

**Also, from the greybox:**
- **Baked vertex shading**: each piece darkens near the floor and the ceiling. The big flat walls do
  this per pixel instead, because their few big triangles can't carry it.
- **Contact shadows**: the floor and ceiling shaders work out the nearest column from the grid's maths
  and darken around it.
- **Glows**: camera-facing squares with their own fog.
- **Tone mapping**: Khronos PBR Neutral.

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
| `src/hall/surfaces.js` | Floor and ceiling |
| `src/hall/light.js` | The shared shader: sun through the openings, lamplight, contact shadows |
| `src/hall/beams.js` | Light wells and beams |
| `src/sky/sun.js` | Sun position, prayer times, qibla bearing (no three.js; tested) |
| `src/sky/look.js` | The look of each hour (no three.js; tested) |
| `src/sky/clock.js`, `place.js` | Now or a preview; where the times are for |
| `src/input.js`, `overlay.js`, `fader.js` | Input, the words on screen, the wash of light |
| `src/lightpanel.js` | The Light panel and the prayer-time line under the name |
| `src/main.js` | Puts it together and runs the frame loop |

## Checking it

- `npm test` runs 16 tests: layout, motion, the sun against adhan-js, the look of the hours, and the
  openings.
- `npm run smoke` needs the dev server on port 5197. It does a cold load in headless Chrome, driven
  only by real clicks, keys, taps and swipes, and runs 28 checks, including the Light panel. Its
  screenshots go in `capture/smoke/`. It reads `window.__hall` (dev builds only) to measure what
  the input did; it never drives it.

Measured on an M2 Pro (headless Chrome, frame limit off):
- 1280×800: about 290 fps looking down the nave, 220 fps looking sideways.
- 2560×1600: about 185 and 160 fps.
- About 660k triangles in 35 draw calls.

The light layer cost about a quarter of the frame rate. It has not been measured on a phone yet.

## Terms worth knowing

Floating origin, instancing, draw call, frustum culling, critically damped spring, exponential fog,
ambient occlusion (baked and analytic), tone mapping, seeded procedural generation, analytic
visibility (instead of shadow maps), penumbra, equation of time, solar declination, hour angle,
great-circle bearing.

## What this greybox is for deciding

- **Arrive or Ahead**: decided on 2026-10-29. Arrive is the default, so each phrase ends at the
  mihrab; Ahead stays in the toggle.
- **Pace**: is one bay per count right? Is the glide too slow or too quick? (`MOTION.stiffness`,
  `HALL.bay`)
- **Space**: the nave's width, the column height, the haze's depth.
