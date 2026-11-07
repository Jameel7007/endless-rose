// Lanterns on long chains: one in every bay of the nave, one in every other bay of the side
// aisles. Which bays get one depends on the real row number, not the local one, so a
// lantern stays put as the camera moves past it.
import * as THREE from 'three';
import { aisles, rowZ, visibleRows } from '../layout.js';
import { LANTERNS } from '../config.js';
import { cordGeometry, lanternGeometry } from './pieces.js';
import { Glow } from './glow.js';

export class Lanterns {
  constructor(hall, lines, look) {
    this.hall = hall;
    this.aisles = aisles(lines);
    const max = this.aisles.length * (hall.rowsBehind + hall.rowsAhead + 1);
    this.bodies = new THREE.InstancedMesh(lanternGeometry(), new THREE.MeshBasicMaterial({ color: look.lantern }), max);
    this.cords = new THREE.InstancedMesh(cordGeometry(), new THREE.MeshLambertMaterial({ color: 0x6e6155 }), max);
    this.glow = new Glow(max, { color: look.lantern, intensity: look.lanternGlow, fog: 0.017 });
    this.body = new THREE.Color(look.lantern);
    this.group = new THREE.Group();
    this.group.add(this.bodies, this.cords, this.glow.mesh);
    this.key = '';
  }

  /** How lit the lanterns are (0 to 1): faint by day, full at night. */
  setLight(level, glow, fog) {
    this.glow.setStrength(glow * (0.2 + 0.8 * level));
    this.glow.setFog(fog);
    this.bodies.material.color.copy(this.body).multiplyScalar(0.55 + 0.45 * level);
  }

  /** `base` is the real row the camera stands in; `cut` is the transverse arcade's local z. */
  update(base, cut) {
    const { hall } = this;
    const v = visibleRows(cut, hall);
    const key = `${base}/${v.supports}`;
    if (key === this.key) return;
    this.key = key;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    let n = 0;
    for (const a of this.aisles) {
      const nave = a.width > hall.aisle + 1e-6;
      const y = nave ? LANTERNS.nave : LANTERNS.side;
      const chain = hall.ceiling - (y + 0.26);
      for (let k = 0; k < v.supports; k++) {
        const i = v.first + k;
        if (!nave && (base + i) % 2 !== 0) continue;
        const z = rowZ(i, hall.bay);
        this.bodies.setMatrixAt(n, m.makeTranslation(a.x, y, z));
        this.cords.setMatrixAt(n, m.compose(new THREE.Vector3(a.x, hall.ceiling - chain / 2, z), q, new THREE.Vector3(1, chain, 1)));
        this.glow.set(n, a.x, y, z, nave ? 1.15 : 1.0);
        n++;
      }
    }
    for (const mesh of [this.bodies, this.cords]) {
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    this.glow.commit(n);
  }
}
