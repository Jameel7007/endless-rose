// The field of arcades: one instanced mesh per few arcades, so whole groups of them can be
// skipped when they're outside the view. Every instance sits in local coordinates, so the
// layout only changes when the transverse arcade moves past a row.
import * as THREE from 'three';
import { arcadeLines, rowZ, visibleRows } from '../layout.js';

const CHUNK = 6; // arcades per instanced mesh

export class Field {
  constructor(hall, geometries, materials) {
    this.hall = hall;
    this.lines = arcadeLines(hall);
    this.group = new THREE.Group();
    this.chunks = [];
    const rows = hall.rowsBehind + hall.rowsAhead + 1;
    for (let i = 0; i < this.lines.length; i += CHUNK) {
      const xs = this.lines.slice(i, i + CHUNK);
      const supports = new THREE.InstancedMesh(geometries.support, materials.support, xs.length * rows);
      const arches = new THREE.InstancedMesh(geometries.bay, materials.bay, xs.length * rows);
      this.group.add(supports, arches);
      this.chunks.push({ xs, supports, arches });
    }
    this.key = '';
  }

  /** Lay out the rows that stand before the transverse arcade at local z = cut. */
  update(cut) {
    const v = visibleRows(cut, this.hall);
    const key = `${v.supports}/${v.arches}`;
    if (key === this.key) return;
    this.key = key;
    const m = new THREE.Matrix4();
    for (const { xs, supports, arches } of this.chunks) {
      let s = 0;
      let a = 0;
      for (const x of xs) {
        for (let k = 0; k < v.supports; k++) supports.setMatrixAt(s++, m.makeTranslation(x, 0, rowZ(v.first + k, this.hall.bay)));
        for (let k = 0; k < v.arches; k++) arches.setMatrixAt(a++, m.makeTranslation(x, 0, rowZ(v.first + k, this.hall.bay)));
      }
      for (const [mesh, n] of [[supports, s], [arches, a]]) {
        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
    }
  }
}
