// The dome shot. On arriving under the dome at the end of a round the camera looks up and frames
// the whole rose, on any screen, in the part of it the words leave clear: below the header and
// above the phrase. The rose's rim is a circle; the camera's tilt and field of view are found by
// projecting points around that circle, the way the renderer will, until it sits centred in that
// band and fits inside it and inside the screen's width.

const DEG = Math.PI / 180;

/** Points around the dome's rim, relative to the eye standing `before` metres short of its centre. */
export function rimPoints({ radius, rise, before }, n = 72) {
  const points = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 2 * Math.PI;
    points.push([radius * Math.cos(t), rise, before + radius * Math.sin(t)]);
  }
  return points;
}

/**
 * Where the rim lands on screen for a camera facing the qibla (+z) and tilted up by `pitch`
 * (radians), with `a` = tan(half the vertical field of view). Returns the rim's top and bottom as
 * fractions of the screen's height (0 at the top), and how far it reaches sideways (1 = the edge).
 */
export function project(rim, pitch, a, aspect) {
  const s = Math.sin(pitch);
  const c = Math.cos(pitch);
  let top = Infinity;
  let bottom = -Infinity;
  let side = 0;
  for (const [x, y, z] of rim) {
    const depth = y * s + z * c;
    if (depth <= 1e-6) return null; // behind the camera: this tilt can't frame it
    const up = y * c - z * s;
    const sy = 0.5 - (0.5 * up) / (depth * a);
    top = Math.min(top, sy);
    bottom = Math.max(bottom, sy);
    side = Math.max(side, Math.abs(x) / (depth * a * aspect));
  }
  return { top, bottom, side };
}

/** The tilt that centres the rim in the band [top, bottom], for this field of view (by halving). */
function centre(rim, a, aspect, mid) {
  let lo = 5 * DEG;
  let hi = 89 * DEG;
  for (let i = 0; i < 40; i++) {
    const p = (lo + hi) / 2;
    const r = project(rim, p, a, aspect);
    // Looking higher moves the rose down the screen.
    if (!r || (r.top + r.bottom) / 2 > mid) hi = p;
    else lo = p;
  }
  return (lo + hi) / 2;
}

/**
 * The shot: { pitch (radians), fov (vertical, degrees) } that fits the rim in the band of the screen
 * between `band[0]` and `band[1]` (fractions of its height), leaving `margin` of the band clear
 * above and below and of the width at the sides. The view never narrows below `minFov` (so the
 * shot never zooms in) or widens past `maxFov`.
 */
export function frameRose(rim, aspect, band, { minFov, maxFov = 112, margin = 0.05 } = {}) {
  const mid = (band[0] + band[1]) / 2;
  const room = Math.max(0.15, band[1] - band[0]) * (1 - 2 * margin);
  const fits = a => {
    const p = centre(rim, a, aspect, mid);
    const r = project(rim, p, a, aspect);
    return { p, ok: Boolean(r) && r.bottom - r.top <= room && r.side <= 1 - margin };
  };
  let lo = Math.tan((minFov / 2) * DEG);
  let hi = Math.tan((maxFov / 2) * DEG);
  if (fits(lo).ok) return { pitch: fits(lo).p, fov: minFov };
  if (!fits(hi).ok) return { pitch: fits(hi).p, fov: maxFov };
  for (let i = 0; i < 30; i++) {
    const a = (lo + hi) / 2;
    if (fits(a).ok) hi = a;
    else lo = a;
  }
  return { pitch: fits(hi).p, fov: (2 * Math.atan(hi)) / DEG };
}
