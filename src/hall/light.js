// Light on every plaster surface: the sun through the openings in the ceiling, and the lanterns.
// Both are worked out in the shader from the hall's grid, with no shadow map and no extra lights,
// so 1,400 columns can stand in sunbeams and lamplight at the cost of some arithmetic per pixel.
// The colour layers (src/hall/ornament.js) are painted here too. Every hall material shares
// `hallUniforms` and `ornamentUniforms`; main.js updates them once a frame.
import * as THREE from 'three';
import { HALL, LANTERNS, QIBLA, SKY } from '../config.js';
import { ORNAMENT_GLSL, ornamentUniforms } from './ornament.js';

export const hallUniforms = {
  uBay: { value: HALL.bay },
  uNaveHalf: { value: HALL.nave / 2 },
  uAisle: { value: HALL.aisle },
  uCeiling: { value: HALL.ceiling },
  uCut: { value: 0 },           // local z of the transverse arcade
  uWall: { value: 0 },          // local z of the qibla wall
  uParity: { value: 0 },        // the camera's real row, mod 2, so openings and lanterns stay put
  uOpening: { value: SKY.opening },
  uWell: { value: SKY.well },
  uSolidFrom: { value: SKY.solidFrom },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },  // toward the sun
  uSunColor: { value: new THREE.Color(0, 0, 0) },  // colour × strength of direct sunlight
  uLanternColor: { value: new THREE.Color(0, 0, 0) },
  uLanternY: { value: new THREE.Vector2(LANTERNS.nave, LANTERNS.side) },
  uDome: { value: new THREE.Vector3() },           // centre of the dome's base
  uDomeR: { value: QIBLA.dome },
  uOculus: { value: new THREE.Vector2(HALL.ceiling + QIBLA.dome, QIBLA.oculus) }, // height, radius
  uTransverse: { value: HALL.transverse },
};

const COMMON = /* glsl */`
varying vec3 vHall;
varying vec3 vObj;    // the point in the piece's own coordinates
varying vec2 vCell;   // where the piece (or this instance of it) stands on the floor
uniform float uBay, uNaveHalf, uAisle, uCeiling, uCut, uWall, uParity, uOpening, uWell, uSolidFrom, uDomeR, uTransverse;
uniform vec3 uSunDir, uSunColor, uLanternColor, uDome;
uniform vec2 uLanternY, uOculus;
${ORNAMENT_GLSL}

// Distance across the hall to the nearest arcade line.
float hallArcadeDx(float x) {
  float u = abs(x) - uNaveHalf;
  return u < 0.0 ? -u : abs(u - uAisle * floor(u / uAisle + 0.5));
}

// Distance along the hall to the nearest row of supports, counting only rows before the
// transverse arcade, and the transverse arcade itself (it stands on the same lines).
float hallRowDz(float z) {
  float last = ceil(uCut / uBay - 0.5) - 1.0;
  float row = min(floor(z / uBay), last);
  return min(abs(z - (row + 0.5) * uBay), abs(z - uCut));
}

// Which aisle x is in (0 for the nave, then 1, 2... outward), and how far from its centre line.
float hallAisle(float x, out float dx) {
  float ax = abs(x);
  if (ax < uNaveHalf) { dx = x; return 0.0; }
  float k = floor((ax - uNaveHalf) / uAisle) + 1.0;
  dx = ax - (uNaveHalf + (k - 0.5) * uAisle);
  return k;
}

// How open the ceiling is at c = (x, z): 1 in an opening, 0 on plaster, soft over w metres.
// The same rule as isOpen() in src/layout.js: a chessboard of bays, none past the transverse arcade.
float hallOpen(vec2 c, float w) {
  float dx;
  float k = hallAisle(c.x, dx);
  float j = floor(c.y / uBay + 0.5);
  if (mod(k + j + uParity, 2.0) > 0.5 || j * uBay > uCut - 0.5 * uBay + 0.01) return 0.0;
  vec2 e = abs(vec2(dx, c.y - j * uBay)) - 0.5 * uOpening;
  return (1.0 - smoothstep(-w, w, e.x)) * (1.0 - smoothstep(-w, w, e.y));
}

// The stained glass at the top of each well, where the light passes at c = (x, z): a ruby
// eight-point star in an amber ring, cobalt and emerald corners, a clear border, and lead between
// the panes, which the sun draws on the floor.
vec3 hallGlass(vec2 c) {
  float dx;
  hallAisle(c.x, dx);
  float j = floor(c.y / uBay + 0.5);
  vec2 q = vec2(dx, c.y - j * uBay) / (0.5 * uOpening);
  vec2 a = abs(q);
  float s = ornStar(q);
  float sq = max(a.x, a.y);
  vec3 col = s < 0.34 ? vec3(1.0, 0.16, 0.2) : (s < 0.6 ? vec3(1.0, 0.6, 0.16)
    : (q.x * q.y > 0.0 ? vec3(0.2, 0.36, 1.0) : vec3(0.22, 0.85, 0.42)));
  col = sq > 0.86 ? vec3(0.95, 0.9, 0.8) : col;
  float diag = s > 0.6 && sq < 0.86 ? abs(a.x - a.y) : 1.0;
  float lead = 1.0 - smoothstep(0.012, 0.03, min(min(abs(s - 0.34), abs(s - 0.6)), min(abs(sq - 0.86), diag)));
  return col * (1.0 - 0.9 * lead) * 1.35;
}

// From x, the distance to the face of the next arcade wall in direction dir (+1 or -1).
float hallLineGap(float x, float dir) {
  float s = x * dir;
  float next;
  if (s < -uNaveHalf) next = -(uNaveHalf + (ceil((-s - uNaveHalf) / uAisle) - 1.0) * uAisle);
  else if (s < uNaveHalf) next = uNaveHalf;
  else next = uNaveHalf + ceil((s - uNaveHalf) / uAisle) * uAisle;
  return next - s - 0.25;
}

// How much direct sun reaches p: through an opening and up its well, unless the solid top of an
// arcade wall stands in the way. Under the dome, only through its oculus. pane is where the light
// passed the glass at the top of the well (far away when it came through the oculus instead).
float hallSun(vec3 p, out vec2 pane) {
  pane = vec2(1e6);
  vec3 L = uSunDir;
  if (L.y < 0.05) return 0.0;
  float t0 = (uCeiling - p.y) / L.y;
  vec2 c0 = p.xz + L.xz * t0;
  float t2 = (uOculus.x - p.y) / L.y;
  if (length(c0 - uDome.xz) < uDomeR || p.y > uCeiling + uWell) {
    float r = length(p.xz + L.xz * t2 - uDome.xz);
    return 1.0 - smoothstep(uOculus.y - 0.02 - 0.0093 * t2, uOculus.y + 0.0093 * t2, r);
  }
  vec2 c1 = p.xz + L.xz * ((uCeiling + uWell - p.y) / L.y);
  pane = c1;
  float pen = 0.02 + 0.0093 * max(t0, 0.0);          // the sun is half a degree wide
  float vis = hallOpen(c1, pen);
  if (p.y < uCeiling) {
    if (length(c1 - c0) > uOpening) return 0.0;      // can't pass through two different openings
    vis *= hallOpen(c0, pen);
  }
  if (vis <= 0.0) return 0.0;
  if (abs(L.x) > 0.001 && p.y < uCeiling) {
    float gap = hallLineGap(c0.x, -sign(L.x));
    if (gap < abs(p.x - c0.x)) {
      float h = uCeiling - gap * L.y / abs(L.x);      // height where the ray meets that wall
      vis *= 1.0 - smoothstep(uSolidFrom - 0.15, uSolidFrom + 0.15, h);
    }
  }
  if ((p.z - uCut) * (c0.y - uCut) < 0.0 && abs(L.z) > 0.001) {
    float h = p.y + L.y * (uCut - p.z) / L.z;         // the transverse arcade's wall
    vis *= 1.0 - smoothstep(6.5, 6.9, h);
  }
  return vis;
}

float hallLamp(vec3 p, vec3 n, vec3 lamp) {
  vec3 d = lamp - p;
  float r2 = dot(d, d);
  return max(dot(n, d * inversesqrt(r2)), 0.0) / (1.0 + r2);
}

// Lamplight from the nearest lanterns: four rows of the nave, where a lantern hangs in every row;
// two rows of the two nearest side aisles, where they hang in every other row (rows of even real
// number, as src/hall/lanterns.js hangs them); and near the qibla wall, the transverse aisle's
// lanterns and the large lamp under the dome. Each lantern's light fades to nothing by the
// distance at which a nearer lantern takes its place in the sum, so the light has no seams.
vec3 hallLanterns(vec3 p, vec3 n) {
  // None by day (main.js sends black), and none past where the haze would hide it anyway.
  if (dot(uLanternColor, vec3(1.0)) < 1e-4 || distance(p, cameraPosition) > 70.0) return vec3(0.0);
  float sum = 0.0;
  float i0 = floor(p.z / uBay - 0.5);
  for (int k = -1; k < 3; k++) {
    float z = (i0 + float(k) + 0.5) * uBay;
    if (z < uCut) sum += hallLamp(p, n, vec3(0.0, uLanternY.x, z)) * (1.0 - smoothstep(uBay, 2.0 * uBay, abs(p.z - z)));
  }
  float even = i0 - mod(i0 + uParity, 2.0);
  float u = abs(p.x) - uNaveHalf;
  float k0 = u < 0.0 ? 1.0 : floor(u / uAisle) + 1.0;
  float f = u / uAisle - (k0 - 1.0);
  float k1 = u < 0.0 ? 1.0 : (f < 0.5 && k0 > 1.0 ? k0 - 1.0 : k0 + 1.0);
  float zt = uCut + 0.5 * uTransverse;
  float wt = 1.0 - smoothstep(10.0, 14.0, abs(p.z - zt));
  float transverse = 1.6 * hallLamp(p, n, vec3(0.0, 5.4, zt));
  for (int a = 0; a < 2; a++) {
    float k = a == 0 ? k0 : k1;
    float x = (uNaveHalf + (k - 0.5) * uAisle) * (u < 0.0 ? (a == 0 ? 1.0 : -1.0) : sign(p.x));
    float wx = 1.0 - smoothstep(0.5 * uAisle, uAisle, abs(p.x - x));
    for (int r = 0; r < 2; r++) {
      float z = (even + 2.0 * float(r) + 0.5) * uBay;
      if (z < uCut) sum += hallLamp(p, n, vec3(x, uLanternY.y, z)) * wx * (1.0 - smoothstep(uBay, 2.0 * uBay, abs(p.z - z)));
    }
    transverse += hallLamp(p, n, vec3(x, uLanternY.y, zt)) * wx;
  }
  return uLanternColor * (sum + transverse * wt);
}
`;

// What each kind of surface looks like. Each sets diffuseColor; hallPolish (0 to 1) makes it less
// rough, for glazed tile, polished marble and glass mosaic.

const FLOOR = /* glsl */`
{
  float d = length(vec2(hallArcadeDx(vHall.x), hallRowDz(vHall.z)));
  float ao = mix(0.55, 1.0, smoothstep(0.2, 1.1, d));
  ao *= mix(0.72, 1.0, smoothstep(0.0, 1.8, uWall - vHall.z));
  // Stone joints: 1 m across, half a bay along, with every column on a slab's centre.
  vec2 slab = vec2(1.0, 0.5 * uBay);
  vec2 q = (vHall.xz + vec2(0.5, 0.25 * uBay)) / slab;
  vec2 j = (0.5 - abs(fract(q) - 0.5)) * slab;
  vec2 w = fwidth(vHall.xz);
  float line = 1.0 - smoothstep(0.0, 0.004 + 1.5 * max(w.x, w.y), min(j.x, j.y));
  float far = smoothstep(14.0, 38.0, distance(vHall, cameraPosition));
  vec3 stone = diffuseColor.rgb * (1.0 - 0.13 * line * (1.0 - smoothstep(12.0, 45.0, distance(vHall, cameraPosition))));
  diffuseColor.rgb = mix(stone, ornCarpet(vHall.xz, far), uFloorPaint) * ao;
}
`;

const CEILING = /* glsl */`
{
  float far = smoothstep(14.0, 40.0, distance(vHall, cameraPosition));
  vec3 cedar = ornCedar(vHall.xz, far);
  if (hallOpen(vHall.xz, 0.001) > 0.5) discard;   // the openings, where the sky shows
  float ao = mix(0.6, 1.0, smoothstep(0.25, 1.4, hallArcadeDx(vHall.x)));
  ao *= mix(0.72, 1.0, smoothstep(0.0, 1.4, uCut - vHall.z));
  diffuseColor.rgb = mix(diffuseColor.rgb, cedar, uCeilingPaint) * ao;
}
`;

// Columns: the shaft in its own marble.
const SUPPORT_COMMON = /* glsl */`
uniform vec2 uShaft;
`;
const SUPPORT = /* glsl */`
{
  float shaft = step(uShaft.x, vObj.y) * step(vObj.y, uShaft.y) * uArches;
  diffuseColor.rgb = mix(diffuseColor.rgb, ornMarble(vCell, vObj) * vColor.rgb, shaft);
  hallPolish = shaft * 0.75;
}
`;

// Arcade walls: the voussoirs of the lower rib and the upper arch, and the frieze under the
// ceiling. uAlong is 0 where the arcade runs along z (the field), 1 where it runs along x (the
// transverse arcade); uRib and uUpper are the two rings, uSpring the heights they spring from.
const ARCADE_COMMON = /* glsl */`
uniform float uAlong;
uniform vec4 uRib, uUpper;
uniform vec2 uSpring;
`;
const ARCADE = /* glsl */`
{
  vec2 uv = vec2(mix(vObj.z, vObj.x, uAlong), vObj.y);
  vec4 rib = ornVoussoirs(uv, uRib, uSpring.x);
  vec4 upper = ornVoussoirs(uv, uUpper, uSpring.y);
  vec4 frieze = ornFrieze(uv);
  diffuseColor.rgb = mix(diffuseColor.rgb, rib.rgb * vColor.rgb, rib.a * uArches);
  diffuseColor.rgb = mix(diffuseColor.rgb, upper.rgb * vColor.rgb, upper.a * uArches);
  diffuseColor.rgb = mix(diffuseColor.rgb, frieze.rgb * vColor.rgb, frieze.a * uWallPaint);
}
`;

// Large flat walls shade by height per pixel: their few big triangles can't carry vertex
// shading. The qibla wall carries the zellige dado.
const WALL = /* glsl */`
{
  float shade = 0.74 + 0.26 * smoothstep(0.0, 1.2, vHall.y);
  diffuseColor.rgb *= shade * (1.0 - 0.3 * smoothstep(uCeiling - 1.1, uCeiling, vHall.y));
  float dado = step(vHall.y, 1.36) * uWallPaint;
  diffuseColor.rgb = mix(diffuseColor.rgb, ornZellige(vHall.xy) * shade, dado);
  hallPolish = dado;
}
`;

// The mihrab's frame: its horseshoe ring in voussoirs of gold, lapis and red, and the panel
// around it in gold mosaic with a lapis lattice and border, as at Córdoba.
const MIHRAB_COMMON = /* glsl */`
uniform vec4 uMihrab;   // the arch's centre height, radius, springing height; the panel's half width
uniform float uMihrabTop;
`;
const MIHRAB = /* glsl */`
{
  vec2 d = vec2(vHall.x, vHall.y - uMihrab.x);
  float r = length(d);
  float ring = step(uMihrab.y - 0.02, r) * step(r, uMihrab.y + 0.32) * step(uMihrab.z - 0.02, vHall.y);
  float k = mod(floor(atan(d.x, d.y) * uMihrab.y / 0.15 + 0.5), 3.0);
  vec3 gold = vec3(0.60, 0.40, 0.12);
  vec3 lapis = vec3(0.04, 0.09, 0.32);
  vec3 vouss = k < 0.5 ? gold : (k < 1.5 ? lapis : vec3(0.38, 0.07, 0.034));
  vec2 q = fract(vHall.xy / 0.2) - 0.5;
  float lattice = 1.0 - smoothstep(0.0, 0.02, abs(abs(q.x) + abs(q.y) - 0.5) - 0.025);
  float border = 1.0 - step(abs(vHall.x), uMihrab.w - 0.14) * step(vHall.y, uMihrabTop - 0.14);
  vec3 panel = mix(mix(gold, lapis, lattice), lapis, border);
  diffuseColor.rgb = mix(diffuseColor.rgb, mix(panel, vouss, ring) * vColor.rgb, uWallPaint);
  hallPolish = 0.8 * uWallPaint;
}
`;

// The rose in the dome (src/rose/rose.js). The direction of a point from the dome's centre gives
// its place in the medallion, equidistant from the crown: the medallion's centre at the oculus, its
// rim at the dome's foot. A tile shows once the laying has passed its place in the order, and laid
// tiles take a glaze.
const DOME_COMMON = /* glsl */`
uniform sampler2D uRose, uRoseOrder;
uniform float uRoseProgress;
`;
const DOME = /* glsl */`
{
  vec3 d = normalize(vHall - uDome);
  float theta = acos(clamp(d.y, -1.0, 1.0));
  vec2 uv = 0.5 + 0.5 * min(theta / (0.5 * PI), 1.0) * d.xz / max(length(d.xz), 1e-5);
  float order = texture2D(uRoseOrder, uv).r * 255.0 / 254.0;
  hallPolish = 1.0 - smoothstep(uRoseProgress - 0.004, uRoseProgress, order);
  diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(uRose, uv).rgb * vColor.rgb, hallPolish);
}
`;

const KINDS = {
  plaster: ['', ''],
  floor: ['', FLOOR],
  ceiling: ['', CEILING],
  wall: ['', WALL],
  support: [SUPPORT_COMMON, SUPPORT],
  arcade: [ARCADE_COMMON, ARCADE],
  mihrab: [MIHRAB_COMMON, MIHRAB],
  dome: [DOME_COMMON, DOME],
};

const LIGHT = /* glsl */`
{
  vec3 hallN = inverseTransformDirection(normal, viewMatrix);
  vec3 hallLight = hallLanterns(vHall, hallN);
  float hallFacing = max(dot(hallN, uSunDir), 0.0);
  if (hallFacing > 0.0 && dot(uSunColor, vec3(1.0)) > 1e-4) {
    vec2 hallPane;
    float hallVis = hallSun(vHall, hallPane);
    vec3 hallTint = uGlass > 0.5 && hallPane.x < 1e5 ? hallGlass(hallPane) : vec3(1.0);
    hallLight += uSunColor * hallTint * (hallFacing * hallVis);
  }
  reflectedLight.directDiffuse += hallLight * BRDF_Lambert(material.diffuseColor);
}
`;

/**
 * Give a MeshStandardMaterial the hall's light and colour. `kind` is one of KINDS: 'plaster',
 * 'floor', 'ceiling', 'wall' (big flat walls; the qibla wall's dado), 'support' (marble shafts;
 * extra: uShaft), 'arcade' (voussoirs and frieze; extra: uAlong, uRib, uUpper, uSpring), 'mihrab'
 * (extra: uMihrab, uMihrabTop) or 'dome' (the rose; extra: uRose, uRoseOrder, uRoseProgress).
 */
export function litMaterial(material, kind = 'plaster', extra = {}) {
  const [common, surface] = KINDS[kind];
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, hallUniforms, ornamentUniforms, extra);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHall;\nvarying vec3 vObj;\nvarying vec2 vCell;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 hallPos = vec4(transformed, 1.0);
        vec4 hallCell = vec4(0.0, 0.0, 0.0, 1.0);
        #ifdef USE_INSTANCING
          hallPos = instanceMatrix * hallPos;
          hallCell = instanceMatrix * hallCell;
        #endif
        vHall = (modelMatrix * hallPos).xyz;
        vObj = transformed;
        vCell = (modelMatrix * hallCell).xz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${COMMON}${common}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\nfloat hallPolish = 0.0;\n${surface}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.38, hallPolish);')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${LIGHT}`);
  };
  // Every hall material patches the same base shader, so each kind needs its own program key.
  material.customProgramCacheKey = () => `hall-${kind}`;
  return material;
}

/** A column: its shaft in marble when the arches layer is on. */
export function supportMaterial(look, S) {
  return litMaterial(new THREE.MeshStandardMaterial({ color: look.plaster, roughness: 0.94, vertexColors: true }), 'support', {
    uShaft: { value: new THREE.Vector2(S.baseTop, S.shaftTop) },
  });
}

/**
 * An arcade wall, with rings of voussoirs from arcadeRings() or transverseRings() in pieces.js.
 * `along` is 0 for the field's arcades (they run along z) and 1 for the transverse arcade.
 */
export function arcadeMaterial(look, rings, along) {
  return litMaterial(new THREE.MeshStandardMaterial({ color: look.plaster, roughness: 0.94, vertexColors: true }), 'arcade', {
    uAlong: { value: along },
    uRib: { value: new THREE.Vector4(...rings.rib) },
    uUpper: { value: new THREE.Vector4(...rings.upper) },
    uSpring: { value: new THREE.Vector2(...rings.spring) },
  });
}
