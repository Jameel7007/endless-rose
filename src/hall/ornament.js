// The colour of the hall, in layers that can be turned on one at a time (so they can be compared):
//   arches   Córdoba's voussoirs, red brick and cream stone, on every arch; and columns of different
//            marbles, as the Mezquita gathered them from older buildings
//   floor    rows of prayer carpets, each place with its niche pointing to the qibla
//   walls    a painted frieze under the ceiling, a zellige dado on the qibla wall, the mihrab in mosaic
//   light    stained glass in the ceiling openings: the sun falls in coloured patches
//   ceiling  painted cedar between the openings
// Every layer is a pattern worked out in the shaders (src/hall/light.js), so it needs no textures
// and repeats with the hall. `?colour=arches,floor` in the address shows just those (or `none`, `all`).

export const LAYERS = ['arches', 'floor', 'walls', 'light', 'ceiling'];

const UNIFORM = { arches: 'uArches', floor: 'uFloorPaint', walls: 'uWallPaint', light: 'uGlass', ceiling: 'uCeilingPaint' };

export const ornamentUniforms = {
  uArches: { value: 1 },
  uFloorPaint: { value: 1 },
  uWallPaint: { value: 1 },
  uGlass: { value: 1 },
  uCeilingPaint: { value: 1 },
  uRowShift: { value: 0 }, // the camera's real row, mod 1024, so each column keeps its marble
};

/** The layers to show: those named by `?colour=` in the address, or else the defaults. */
export function chooseLayers(search, defaults) {
  const asked = new URLSearchParams(search).get('colour');
  if (asked === null) return defaults;
  if (asked === 'all') return [...LAYERS];
  return asked.split(',').filter(l => LAYERS.includes(l));
}

export function showLayers(layers) {
  for (const l of LAYERS) ornamentUniforms[UNIFORM[l]].value = layers.includes(l) ? 1 : 0;
}

// Colours are linear RGB (the shader's working space), noted here with their sRGB names.
export const ORNAMENT_GLSL = /* glsl */`
uniform float uArches, uFloorPaint, uWallPaint, uGlass, uCeilingPaint, uRowShift;

float ornHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// An eight-point star (khatam): a square and a diagonal square together. Its "radius" at q.
float ornStar(vec2 q) {
  vec2 a = abs(q);
  return min(max(a.x, a.y), (a.x + a.y) * 0.70711);
}

// Rows of prayer carpets facing the qibla (+z): three rows to a bay and a place every 0.8 m, each
// with a niche pointing to the qibla and a gold lozenge, the rows parted by an indigo band. Far
// off, the detail gives way to the carpet's average colour, so it never shimmers.
vec3 ornCarpet(vec2 p, float far) {
  vec2 cell = vec2(0.8, uBay / 3.0);
  vec2 m = (fract(vec2(p.x / cell.x + 0.5, p.y / cell.y)) - 0.5) * cell;
  vec2 w = fwidth(p);
  float aa = max(w.x, w.y) + 1e-4;
  float rise = clamp((m.y - 0.1) / 0.24, 0.0, 1.0);
  float s = min(0.25 * (1.0 - pow(rise, 1.7)) - abs(m.x), min(m.y + 0.36, 0.36 - m.y));
  float niche = smoothstep(-aa, aa, s);
  float outline = 1.0 - smoothstep(0.0, aa + 0.012, abs(s - 0.035));
  float band = 1.0 - smoothstep(-aa, aa, 0.5 * cell.y - abs(m.y) - 0.075);
  float bandLine = band * (1.0 - smoothstep(0.0, aa + 0.008, abs(abs(m.y) - 0.5 * cell.y + 0.0375)));
  float seam = 1.0 - smoothstep(-aa, aa, 0.5 * cell.x - abs(m.x) - 0.014);
  float lozenge = niche * (1.0 - smoothstep(-aa, aa, abs(m.x) + abs(m.y + 0.07) - 0.065));
  vec3 madder = vec3(0.19, 0.022, 0.028);   // #7b2b2f deep madder
  vec3 gold = vec3(0.40, 0.25, 0.08);       // #aa8a4f
  vec3 c = mix(madder, vec3(0.25, 0.036, 0.035), niche);
  c = mix(c, gold, max(outline, lozenge));
  c = mix(c, madder * 0.65, seam * (1.0 - band));
  c = mix(c, vec3(0.022, 0.03, 0.095), band); // indigo
  c = mix(c, gold, bandLine);
  return mix(c, vec3(0.165, 0.03, 0.034), far);
}

// Voussoirs round an arch: wedges about 0.42 m wide at the intrados with the keystone at the
// crown, alternating cream stone and red brick, as on Córdoba's arches, with fine joints between.
// ring = centre (u, v), inner and outer radius; springV = the height the arch springs from.
// .rgb is the colour, .a how much of the point lies in the ring.
vec4 ornVoussoirs(vec2 uv, vec4 ring, float springV) {
  vec2 d = uv - ring.xy;
  float r = length(d);
  float inRing = step(ring.z - 0.03, r) * step(r, ring.w + 0.03) * step(springV - 0.02, uv.y) * step(0.01, ring.z);
  float t = atan(d.x, d.y) * ring.z / 0.42 + 0.5;
  float w = fwidth(t) + 1e-4;
  float f = fract(t * 0.5);
  float brick = smoothstep(0.5 - w, 0.5 + w, f) * (1.0 - smoothstep(1.0 - w, 1.0, f));
  float joint = 1.0 - smoothstep(0.0, 0.05 + w, abs(fract(t + 0.5) - 0.5));
  vec3 c = mix(vec3(0.74, 0.62, 0.42), vec3(0.27, 0.075, 0.04), brick); // #dfcfae stone, #8f4d38 brick
  return vec4(c * (1.0 - 0.25 * joint), inRing);
}

// A painted frieze along the top of the arcade walls: a red band between cream lines, with a
// chain of gold lozenges. .a is how much of the point lies in it.
vec4 ornFrieze(vec2 uv) {
  float v0 = uCeiling - 0.78;
  float v1 = uCeiling - 0.22;
  float mid = 0.5 * (v0 + v1);
  float x = (fract(uv.x / 0.44) - 0.5) * 0.44;
  float loz = 1.0 - smoothstep(0.0, 0.012, abs(x) * 0.95 + abs(uv.y - mid) - 0.19);
  float rule = 1.0 - smoothstep(0.0, 0.01, min(abs(uv.y - v0 - 0.04), abs(uv.y - v1 + 0.04)) - 0.014);
  vec3 c = mix(vec3(0.21, 0.035, 0.03), vec3(0.45, 0.29, 0.09), loz);
  c = mix(c, vec3(0.74, 0.65, 0.48), rule);
  return vec4(c, step(v0, uv.y) * step(uv.y, v1));
}

// The columns, each its own stone: white, rose jasper, grey-blue, green, honey or dark marble,
// with a faint vein. cell = the column's place on the floor; obj = the point on the column.
vec3 ornMarble(vec2 cell, vec3 obj) {
  float h = ornHash(vec2(floor(cell.x + 0.5), floor(cell.y / uBay) + uRowShift));
  vec3 c = h < 0.3 ? vec3(0.80, 0.78, 0.74)
    : h < 0.48 ? vec3(0.55, 0.26, 0.20)
    : h < 0.64 ? vec3(0.42, 0.47, 0.54)
    : h < 0.78 ? vec3(0.36, 0.45, 0.39)
    : h < 0.95 ? vec3(0.66, 0.50, 0.30)
    : vec3(0.34, 0.33, 0.34);
  float vein = sin(obj.y * 4.0 + 2.2 * sin(atan(obj.z, obj.x) * 2.0 + h * 20.0) + h * 40.0);
  return c * (0.92 + 0.08 * vein);
}

// A zellige dado: green eight-point stars on a square grid, white crosses between them with a
// lapis square at each crossing, black outlines; above it a border of black and white.
vec3 ornZellige(vec2 p) {
  vec2 g = p / 0.42;
  vec2 q = fract(g) - 0.5;
  float s = ornStar(q);
  vec2 w = fwidth(g);
  float aa = max(w.x, w.y) + 1e-4;
  float star = 1.0 - smoothstep(0.3 - aa, 0.3 + aa, s);
  float line = 1.0 - smoothstep(0.0, 0.03 + aa, abs(s - 0.3));
  float corner = 1.0 - smoothstep(-aa, aa, max(abs(abs(q.x) - 0.5), abs(abs(q.y) - 0.5)) - 0.07);
  vec3 c = mix(vec3(0.80, 0.75, 0.64), vec3(0.04, 0.20, 0.10), star);
  c = mix(c, vec3(0.04, 0.08, 0.30), corner);
  c = mix(c, vec3(0.02, 0.018, 0.016), line);
  float checks = mod(floor(p.x / 0.105) + floor(p.y / 0.0525), 2.0);
  return p.y > 1.25 ? mix(vec3(0.02, 0.018, 0.016), vec3(0.80, 0.75, 0.64), checks) : c;
}

// Painted cedar: a dark wooden ground with a lattice of eight-point stars in red and green,
// outlined in gold. Far off it gives way to its average colour.
vec3 ornCedar(vec2 p, float far) {
  vec2 g = p / 0.8;
  vec2 q = fract(g) - 0.5;
  float s = ornStar(q);
  vec2 w = fwidth(g);
  float aa = max(w.x, w.y) + 1e-4;
  float star = 1.0 - smoothstep(0.28 - aa, 0.28 + aa, s);
  float line = 1.0 - smoothstep(0.0, 0.035 + aa, abs(s - 0.28));
  float alt = mod(floor(g.x) + floor(g.y), 2.0);
  vec3 c = mix(vec3(0.12, 0.055, 0.025), alt > 0.5 ? vec3(0.30, 0.05, 0.04) : vec3(0.04, 0.16, 0.09), star);
  c = mix(c, vec3(0.55, 0.36, 0.10), line);
  return mix(c, vec3(0.14, 0.07, 0.035), far);
}
`;
