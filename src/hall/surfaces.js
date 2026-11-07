// Floor and ceiling: two big planes that follow the camera. Their shaders (src/hall/light.js)
// darken the stone round every column foot and the plaster along every wall, and open the
// ceiling to the sky, all worked out from the hall's grid rather than from geometry.
import * as THREE from 'three';
import { hallUniforms, litMaterial } from './light.js';

export class Surfaces {
  constructor(hall, look, halfWidth) {
    this.hall = hall;
    this.halfWidth = halfWidth;
    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      litMaterial(new THREE.MeshStandardMaterial({ color: look.floor, roughness: 0.82 }), 'floor'),
    );
    this.ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2),
      litMaterial(new THREE.MeshStandardMaterial({ color: look.ceiling, roughness: 0.95 }), 'ceiling'),
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
    hallUniforms.uCut.value = cut;
    hallUniforms.uWall.value = wall;
  }
}
