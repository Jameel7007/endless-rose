// The openings in the ceiling, seen from below: the light well above each one, and the beam of
// sunlight it lets down into the haze. Wells are drawn out to 60 m, beams for the openings
// nearest the camera. A beam is a long quad that turns about its own axis to face the camera.
import * as THREE from 'three';
import { aisleIndex, aisles, gapToArcade, isOpen } from '../layout.js';

const WELLS_WITHIN = 60;

export class Openings {
  constructor(hall, sky, lines, wellMaterial) {
    this.hall = hall;
    this.sky = sky;
    this.aisles = aisles(lines).map(a => ({ ...a, k: aisleIndex(a.x, hall) }));
    const rows = hall.rowsBehind + hall.rowsAhead + 1;
    const max = this.aisles.length * rows;

    // A square tube, open at both ends: the inside of a well.
    const tube = new THREE.CylinderGeometry(sky.opening / Math.SQRT2, sky.opening / Math.SQRT2, sky.well, 4, 1, true)
      .rotateY(Math.PI / 4);
    this.wells = new THREE.InstancedMesh(tube, wellMaterial, max);

    const quad = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0); // x across, y from the top down
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = quad.index;
    this.geometry.setAttribute('position', quad.attributes.position);
    this.data = new Float32Array(max * 4);
    this.attr = new THREE.InstancedBufferAttribute(this.data, 4); // opening x, z, length, width
    this.geometry.setAttribute('beam', this.attr);
    this.geometry.instanceCount = 0;
    this.uniforms = {
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uCeiling: { value: hall.ceiling },
      uColor: { value: new THREE.Color() },
      uFog: { value: 0.017 },
    };
    this.beams = new THREE.Mesh(this.geometry, new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */`
        attribute vec4 beam;
        uniform vec3 uSunDir;
        uniform float uCeiling, uFog;
        varying vec2 vUv;
        varying float vFade;
        void main() {
          vec3 axis = -uSunDir;
          vec3 top = vec3(beam.x, uCeiling, beam.y);
          vec3 side = normalize(cross(axis, cameraPosition - (top + axis * beam.z * 0.5)));
          vec3 p = top + axis * (position.y * beam.z) + side * (position.x * beam.w);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          vUv = vec2(position.x * 2.0, position.y);
          float f = -mv.z * uFog;
          vFade = exp(-f * f);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uColor;
        varying vec2 vUv;
        varying float vFade;
        void main() {
          float across = 1.0 - smoothstep(0.15, 1.0, abs(vUv.x));
          float along = smoothstep(0.0, 0.05, vUv.y) * (1.0 - smoothstep(0.6, 1.0, vUv.y)) * (1.0 - 0.6 * vUv.y);
          gl_FragColor = vec4(uColor * (across * along * vFade), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }));
    this.beams.frustumCulled = false;
    this.beams.renderOrder = 1;
    this.group = new THREE.Group();
    this.group.add(this.wells, this.beams);
    this.list = [];
    this.key = '';
  }

  /** The openings that stand before the transverse arcade (local z = cut), within `range` metres. */
  nearby(base, cut, range) {
    const { bay, rowsBehind, rowsAhead } = this.hall;
    const out = [];
    for (let j = -rowsBehind; j <= rowsAhead; j++) {
      const z = j * bay;
      if (z > cut - 0.5 * bay + 0.01) break;
      for (const a of this.aisles) {
        if (isOpen(a.k, j + base) && Math.hypot(a.x, z) < range) out.push([a.x, z]);
      }
    }
    return out;
  }

  /**
   * `dir` points at the sun (hall coordinates); `strength` is how bright the beams are; `colour`
   * is the sunlight's colour as linear RGB.
   */
  update(base, cut, dir, strength, colour, fog) {
    const { hall, sky } = this;
    const key = `${base}/${Math.floor(cut / hall.bay - 0.5)}`; // changes only when a row of openings comes or goes
    if (key !== this.key) {
      this.key = key;
      const m = new THREE.Matrix4();
      const wells = this.nearby(base, cut, WELLS_WITHIN);
      wells.forEach(([x, z], i) => this.wells.setMatrixAt(i, m.makeTranslation(x, hall.ceiling + sky.well / 2, z)));
      this.wells.count = wells.length;
      this.wells.instanceMatrix.needsUpdate = true;
      this.wells.computeBoundingSphere();
      this.list = this.nearby(base, cut, sky.beamsWithin);
    }

    const [lx, ly, lz] = dir;
    // How much of the opening the sun can see down the well, across and along the hall.
    const wx = sky.opening - (sky.well * Math.abs(lx)) / Math.max(ly, 1e-3);
    const wz = sky.opening - (sky.well * Math.abs(lz)) / Math.max(ly, 1e-3);
    if (strength <= 0 || ly < 0.05 || wx <= 0 || wz <= 0) {
      this.geometry.instanceCount = 0;
      return;
    }
    const width = Math.sqrt(wx * wz);
    const toFloor = hall.ceiling / ly;
    let n = 0;
    for (const [x, z] of this.list) {
      let length = toFloor;
      if (Math.abs(lx) > 1e-3) {
        // A beam slanting across the hall stops where it meets the solid top of an arcade wall.
        const gap = gapToArcade(x, -Math.sign(lx), hall);
        const t = gap / Math.abs(lx);
        if (hall.ceiling - ly * t > sky.solidFrom && t < length) length = t;
      }
      this.data.set([x, z, length, width], n * 4);
      n++;
    }
    this.geometry.instanceCount = n;
    this.attr.needsUpdate = true;
    this.uniforms.uSunDir.value.set(lx, ly, lz);
    this.uniforms.uColor.value.setRGB(...colour).multiplyScalar(strength * (wx * wz) / (sky.opening * sky.opening));
    this.uniforms.uFog.value = fog;
  }
}
