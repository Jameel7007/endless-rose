// Light on every plaster surface: the sun through the openings in the ceiling, and the lanterns.
// Both are worked out in the shader from the hall's grid, with no shadow map and no extra lights,
// so 1,400 columns can stand in sunbeams and lamplight at the cost of some arithmetic per pixel.
// Every hall material shares `hallUniforms`; main.js updates them once a frame.
import * as THREE from 'three';
import { HALL, LANTERNS, QIBLA, SKY } from '../config.js';

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
uniform float uBay, uNaveHalf, uAisle, uCeiling, uCut, uWall, uParity, uOpening, uWell, uSolidFrom, uDomeR, uTransverse;
uniform vec3 uSunDir, uSunColor, uLanternColor, uDome;
uniform vec2 uLanternY, uOculus;

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
// arcade wall stands in the way. Under the dome, only through its oculus.
float hallSun(vec3 p) {
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
  line *= 1.0 - smoothstep(12.0, 45.0, distance(vHall, cameraPosition));
  diffuseColor.rgb *= ao * (1.0 - 0.13 * line);
}
`;

const CEILING = /* glsl */`
{
  if (hallOpen(vHall.xz, 0.001) > 0.5) discard;   // the openings, where the sky shows
  float ao = mix(0.6, 1.0, smoothstep(0.25, 1.4, hallArcadeDx(vHall.x)));
  ao *= mix(0.72, 1.0, smoothstep(0.0, 1.4, uCut - vHall.z));
  diffuseColor.rgb *= ao;
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
  float hallGlaze = 0.0;
  {
    vec3 d = normalize(vHall - uDome);
    float theta = acos(clamp(d.y, -1.0, 1.0));
    vec2 uv = 0.5 + 0.5 * min(theta / (0.5 * PI), 1.0) * d.xz / max(length(d.xz), 1e-5);
    float order = texture2D(uRoseOrder, uv).r * 255.0 / 254.0;
    hallGlaze = 1.0 - smoothstep(uRoseProgress - 0.004, uRoseProgress, order);
    diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(uRose, uv).rgb * vColor.rgb, hallGlaze);
  }
`;

// Large flat walls shade by height per pixel: their few big triangles can't carry vertex shading.
const WALL = /* glsl */`
  diffuseColor.rgb *= (0.74 + 0.26 * smoothstep(0.0, 1.2, vHall.y)) * (1.0 - 0.3 * smoothstep(uCeiling - 1.1, uCeiling, vHall.y));
`;

const LIGHT = /* glsl */`
{
  vec3 hallN = inverseTransformDirection(normal, viewMatrix);
  vec3 hallLight = hallLanterns(vHall, hallN);
  float hallFacing = max(dot(hallN, uSunDir), 0.0);
  if (hallFacing > 0.0 && dot(uSunColor, vec3(1.0)) > 1e-4) hallLight += uSunColor * (hallFacing * hallSun(vHall));
  reflectedLight.directDiffuse += hallLight * BRDF_Lambert(material.diffuseColor);
}
`;

/**
 * Give a MeshStandardMaterial the hall's light. `kind` is 'plaster', 'floor' (adds joints and
 * shading round the column feet), 'ceiling' (adds the openings and shading along the walls) or
 * 'wall' (shading by height, for big flat walls) or 'dome' (the rose; give `extra` its uniforms
 * uRose, uRoseOrder and uRoseProgress).
 */
export function litMaterial(material, kind = 'plaster', extra = {}) {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, hallUniforms, extra);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHall;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 hallPos = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          hallPos = instanceMatrix * hallPos;
        #endif
        vHall = (modelMatrix * hallPos).xyz;`);
    const surface = { floor: FLOOR, ceiling: CEILING, wall: WALL, dome: DOME }[kind] ?? '';
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${COMMON}${kind === 'dome' ? DOME_COMMON : ''}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${surface}`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${LIGHT}`);
    if (kind === 'dome') {
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.4, hallGlaze);');
    }
  };
  // Every hall material patches the same base shader, so each kind needs its own program key.
  material.customProgramCacheKey = () => `hall-${kind}`;
  return material;
}
