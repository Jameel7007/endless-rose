# How Endless Rose works

An endless prayer hall in plain plaster. You move down the central nave toward the mihrab one bay
per count of dhikr. The light follows the real day where you are: the sun comes in through
openings in the ceiling where it truly stands, and the hall keeps the prayer times. Each round of
33 ends under the dome, where a rose of glazed tile has been laid while you walked.

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

## Finding your way

- **The guide** (`src/guide.js`): a card with four lines (count, walk, arrive, look), in the words of
  the device: "tap" and "swipe" on a touch screen, "click", "Space" and "the pointer" elsewhere. It
  opens by itself on a first visit, remembered in this browser only, and again from the Guide
  button (a **?** on phones). It is a modal `<dialog>`, so nothing behind it can be pressed, and
  nothing counts while it is open. Begin is focused, so Enter or Space closes it.
- **Focus**: after a mouse click on a button, the page lets go of focus, so the next Space counts
  instead of pressing that button again. Keyboard users keep their focus. The smoke check found
  that a click on Begin had left focus on the hidden button, so Space did nothing; closing the
  guide now lets go of it.
- **Hints** under the count (`hintFor()` in `src/overlay.js`): how to count at 0; that each count is
  a bay nearer the mihrab, for the first three; a countdown for the last five ("3 more to the
  dome"); and at 33, how to begin the next round. In between there is nothing, so the hall stays
  quiet.
- **The line under the count** fills as the round goes, in gold.
- **Veils**: soft gradients at the top and bottom of the screen keep the words legible over the
  brightest arches.

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
between them. On 2026-11-07 the whole day was made brighter: more sky light and sunlight, a little
more exposure, and stronger lamplight at night (`SKY.lanternLight`).

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

## The rose in the dome

**Where the roses come from.** `scripts/import-roses.mjs` runs the three 16-fold medallions of the
Rosette project (Moorish, Lee and polar: 2,041, 2,561 and 3,065 finished tiles) and writes their
tiles to `src/rose/data/*.bin`, about 200 KB in all. The format (`src/rose/format.js`) is a short
header, then one record per tile (glaze, point count), then every point as two 16-bit integers in
hundredths of a unit. The roses are made once by the script, not at load.

**Drawing a rose** (`src/rose/rose.js`). When a round begins, the next rose is drawn into two
canvases:
- **Glazes**: the mortar first, then every tile in its colourway's colour, each a shade lighter or
  darker than the next, as real zellige is.
- **Laying order**: each tile's place in the order, written as a shade of red. Every tile is first
  drawn with a wide outline, then all of them filled, so the mortar between two tiles is laid with
  them and never ahead of them.

Both canvases become textures for the dome. They are 2048 pixels square on desktops and 1024 on phones.

**Mapping it onto the dome.** A point's direction from the dome's centre gives its place in the
medallion, measured from the crown: the medallion's centre at the oculus, its rim at the dome's
foot.

**Laying it.** The order runs from the rim up to the crown, ring by ring, sweeping round within each
ring (`layingOrder()`). It is worked out from the tiles' positions, not from the designs' own
layers, so all three designs are laid alike.

In Arrive mode the laying follows how far you have walked, so the rose is laid as you go: through
the nave's arch you can watch the rim rings appear, and the last tile at the crown is set as you
stop. The shader shows a tile once the laying passes its place in the order, and gives laid tiles a
glaze (less rough than plaster).

**Arriving: the dome shot** (`src/shot.js`). At 33, as you come to a stop, the camera takes over.
Pointer and swipes no longer turn it, and it turns up to frame the whole rose. The rose's name appears
under the count. The next count gives the view back, hidden in the wash of light that starts the
next round.

The framing is worked out for each screen:
- The rim of the dome is a circle. The camera's tilt and field of view are found by projecting points
  round that circle, as the renderer will, until the rose sits centred in the clear band between the
  header and the words, and fits inside it and inside the screen's width.
- On a laptop that is a tilt of about 66° with the view widened to about 76°. On a phone held
  upright, about 69° and 98°, because the rose's width is what has to fit.
- It is worked out again on arriving and whenever the screen changes size.
- The large lamp under the dome lights the rose at night, and its glow is softened while the camera
  holds the shot, so the tiles read through it.

With reduced motion turned on, the camera doesn't turn: the last count cuts to the shot under the
wash of light.

**Which rose.** `roseFor(index)` changes the design every round and turns the six colourways, so
all 18 pairings come once in 18 rounds. The index starts at the number of days since 1970, so each
day begins on a different rose.

## Colour

The hall's colour comes in five layers (`src/hall/ornament.js`). Each is a pattern worked out in
the shaders, with no textures, so it repeats with the hall and costs very little:

- **Arches**:
  - **Voussoirs**: Córdoba's red brick and cream stone, on both tiers of every arch and round the
    transverse arches. Each point's angle round its arch's centre picks its voussoir
    (`ornVoussoirs`). The ring sizes come from the same numbers that build the arches
    (`arcadeRings` and `transverseRings` in `src/hall/pieces.js`), so the stripes always fit.
  - **Marble**: each column is its own stone, chosen by hashing its real place in the grid
    (`ornMarble`), so a column keeps its stone as you walk past it.
- **Light**: stained glass at the top of every light well. Where the sun's line crosses the glass,
  `hallGlass` gives that pane's colour, so the sun draws the window onto the floor and the columns:
  a ruby star, an amber ring, cobalt and emerald corners, and the lead between the panes. The
  beams take the same colours, softened.
- **Ceiling**: painted cedar, with eight-point stars in red and green outlined in gold.
- **Floor** (prayer carpets) and **walls** (frieze, zellige dado, a gold-and-lapis mihrab): made
  and compared, but not chosen.

On 2026-11-07 you chose arches, light and ceiling from renders side by side. Later that day the
ceiling went back to plain plaster, for a lighter, quieter hall. The ceiling, floor and walls are
still there with `?colour=all` in the address. `node scripts/views.mjs colour` makes the renders.
The choice is `COLOUR` in `src/config.js`.

How the patterns stay clean:
- Each pattern repeats with the bay, so the floating origin's jumps never show.
- Edges are smoothed using `fwidth`, the rate a value changes from one pixel to the next.
- Fine patterns fade to their average colour in the distance, so they don't shimmer.

## Keeping it smooth on phones

`src/quality.js` times frames over windows of 1.5 seconds:
- **Too slow** (under about 48 fps): it draws fewer pixels, stepping the pixel ratio down from 2 to
  1.6, 1.3, then 1.
- **No better after a step**: if a step down brings no real speed-up, it undoes it and stops.
  Something else is setting the pace, such as an iPhone in Low Power Mode, which holds 30 fps
  whatever is drawn.
- **Smooth for a while**: after four smooth windows in a row it steps back up. It never steps
  back into a level that was too slow within the last minute.

The shader also skips light that couldn't be seen: no lamplight on the plaster by day, none past
70 m where the haze hides it, and no sun after dark.

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
| `src/hall/ornament.js` | The colour layers: voussoirs, marble, glass, cedar, carpets, wall ornament |
| `src/hall/beams.js` | Light wells and beams |
| `src/sky/sun.js` | Sun position, prayer times, qibla bearing (no three.js; tested) |
| `src/sky/look.js` | The look of each hour (no three.js; tested) |
| `src/sky/clock.js`, `place.js` | Now or a preview; where the times are for |
| `src/rose/format.js` | The rose files, and the laying order (no three.js; tested) |
| `src/rose/rose.js` | Choosing the round's rose and drawing it into the dome's textures |
| `src/quality.js` | Fewer pixels when frames run slow (no three.js; tested) |
| `scripts/import-roses.mjs` | Makes `src/rose/data/*.bin` from the Rosette project |
| `scripts/smoke.mjs`, `views.mjs`, `perf.mjs` | Real-input checks, screenshots, frame rate |
| `src/input.js`, `overlay.js`, `fader.js` | Input, the words and hints on screen, the wash of light |
| `src/shot.js` | The dome shot: the tilt and field of view that frame the rose (no three.js; tested) |
| `src/guide.js` | The guide card |
| `src/lightpanel.js` | The Light panel and the prayer-time line under the name |
| `src/main.js` | Puts it together and runs the frame loop |

## Checking it

- `npm test` runs 29 tests:
  - the layout of the hall, and the counting and glide
  - the sun against adhan-js, the look of the hours, and the ceiling openings
  - the rose files and their laying order, and that every rose comes round
  - the resolution governor
  - the dome shot: that the whole rose fits between the header and the words on a laptop, a phone
    held either way, and a tablet
- `npm run smoke` needs the dev server on port 5197. It does a cold load in headless Chrome, driven
  only by real clicks, keys, taps and swipes, and runs 49 checks, including the guide, the hints,
  the dome shot on a laptop and a phone, and the Light panel. Its screenshots go in
  `capture/smoke/`. It reads `window.__hall` (dev builds only) to measure what the input did; it
  never drives it.

Measured on an M2 Pro (headless Chrome, frame limit off, at noon and at night): between about 110
and 240 fps at 1280×800, 2560×1600 and phone size. That is about 660k triangles in 35 draw calls,
and the numbers vary by a few dozen fps from run to run. `node scripts/perf.mjs` measures it;
`T=21:00` before it measures at night. It hasn't been measured on a real phone: the resolution
governor is the safety net.

## Terms worth knowing

Floating origin, instancing, draw call, frustum culling, critically damped spring, exponential fog,
ambient occlusion (baked and analytic), tone mapping, seeded procedural generation, analytic
visibility (instead of shadow maps), penumbra, equation of time, solar declination, hour angle,
great-circle bearing, azimuthal equidistant projection, binary file format, adaptive resolution,
procedural texturing, screen-space derivatives (fwidth), hashing.

## Decisions

- **Arrive or Ahead** (decided on 2026-10-29): Arrive is the default, so each round ends at the
  mihrab under its rose. Ahead stays in the toggle.
- **The end of a round** (decided on 2026-11-07): the camera takes the view and frames the dome on
  every device, whatever the pointer or a swipe is doing, until the next count.
- **Still to judge in use:**
  - the pace: one bay per count, a glide of about two seconds (`MOTION.stiffness`, `HALL.bay`)
  - the light and the roses on a real phone
