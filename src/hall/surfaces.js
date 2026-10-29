// Floor and ceiling: two big planes that follow the camera. Their shaders darken the stone
// around every column foot and the plaster along every wall, working out the nearest
// column from the grid itself rather than from the geometry.
import * as THREE from 'three';

const COMMON = /* glsl */`
varying vec3 vHall;
uniform float uBay, uNaveHalf, uAisle, uCut, uWall;
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
  float ao = mix(0.6, 1.0, smoothstep(0.25, 1.4, hallArcadeDx(vHall.x)));
  ao *= mix(0.72, 1.0, smoothstep(0.0, 1.4, uCut - vHall.z));
  diffuseColor.rgb *= ao;
}
`;

function patch(material, kind, uniforms) {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHall;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvHall = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${COMMON}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${kind === 'floor' ? FLOOR : CEILING}`);
  };
  // Both materials patch the same base shader; without distinct keys they would share one program.
  material.customProgramCacheKey = () => `hall-${kind}`;
  return material;
}

export class Surfaces {
  constructor(hall, look, halfWidth) {
    this.hall = hall;
    this.halfWidth = halfWidth;
    this.uniforms = {
      uBay: { value: hall.bay },
      uNaveHalf: { value: hall.nave / 2 },
      uAisle: { value: hall.aisle },
      uCut: { value: 0 },
      uWall: { value: 0 },
    };
    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      patch(new THREE.MeshStandardMaterial({ color: look.floor, roughness: 0.82 }), 'floor', this.uniforms),
    );
    this.ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2),
      patch(new THREE.MeshStandardMaterial({ color: look.ceiling, roughness: 0.95 }), 'ceiling', this.uniforms),
    );
    this.ceiling.position.y = hall.ceiling;
    this.group = new THREE.Group();
    this.group.add(this.floor, this.ceiling);
  }

  /** The floor runs on to the foot of the qibla wall; the field's ceiling stops at the transverse arcade. */
  update(cut, wall) {
    const back = -(this.hall.rowsBehind + 2) * this.hall.bay;
    const width = 2 * this.halfWidth;
    this.floor.scale.set(width, 1, wall + 1 - back);
    this.floor.position.z = (back + wall + 1) / 2;
    this.ceiling.scale.set(width, 1, Math.max(0.01, cut - back));
    this.ceiling.position.z = (back + cut) / 2;
    this.uniforms.uCut.value = cut;
    this.uniforms.uWall.value = wall;
  }
}
