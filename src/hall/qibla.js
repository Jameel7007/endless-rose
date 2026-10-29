// The end of the nave: the transverse arcade (the bar of the T), the dome in front of the
// mihrab, and the qibla wall. Built once in its own group; the group's origin is the
// transverse arcade's line, and main.js moves it each frame.
import * as THREE from 'three';
import {
  domeGeometry, lanternGeometry, mihrabFrameGeometry, nicheGeometry, qiblaWallGeometry,
  transverseBayGeometry, transverseCeilingGeometry,
} from './pieces.js';
import { Glow } from './glow.js';

export class Qibla {
  constructor({ hall, support, arch, qibla, look, lines, halfWidth, supportGeometry, plaster }) {
    this.group = new THREE.Group();
    const m = new THREE.Matrix4();

    const supports = new THREE.InstancedMesh(supportGeometry, plaster, lines.length);
    lines.forEach((x, i) => supports.setMatrixAt(i, m.makeTranslation(x, 0, 0)));

    const side = lines.slice(0, -1).filter((x, i) => Math.abs(lines[i + 1] - x - hall.aisle) < 1e-6);
    const sideArches = new THREE.InstancedMesh(transverseBayGeometry(hall.aisle, hall, support, arch), plaster, side.length);
    side.forEach((x, i) => sideArches.setMatrixAt(i, m.makeTranslation(x, 0, 0)));

    const naveArch = new THREE.Mesh(transverseBayGeometry(hall.nave, hall, support, arch), plaster);
    naveArch.position.x = -hall.nave / 2;

    const ceiling = new THREE.Mesh(
      transverseCeilingGeometry(halfWidth, hall.transverse, qibla),
      new THREE.MeshStandardMaterial({ color: look.ceiling, roughness: 0.95 }),
    );
    ceiling.position.y = hall.ceiling;

    const dome = new THREE.Mesh(domeGeometry(qibla), new THREE.MeshStandardMaterial({
      color: look.plaster, roughness: 0.94, vertexColors: true, side: THREE.BackSide,
    }));
    dome.position.set(0, hall.ceiling, hall.transverse / 2);

    const oculus = new THREE.Mesh(new THREE.CircleGeometry(0.55, 32).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff6e6 }));
    oculus.position.set(0, hall.ceiling + qibla.dome - 0.05, hall.transverse / 2);

    const wall = new THREE.Mesh(qiblaWallGeometry(halfWidth, hall, qibla), plaster);
    wall.position.z = hall.transverse;
    const frame = new THREE.Mesh(mihrabFrameGeometry(qibla), plaster);
    frame.position.z = hall.transverse;

    const niche = new THREE.Mesh(nicheGeometry(qibla), new THREE.MeshStandardMaterial({
      color: 0xf1dcb4, roughness: 0.9, vertexColors: true, side: THREE.DoubleSide,
      emissive: look.mihrab, emissiveIntensity: 0.12,
    }));
    niche.position.z = hall.transverse;

    const light = new THREE.PointLight(look.mihrab, look.mihrabLight, 0, 2);
    light.position.set(0, 2.2, hall.transverse - 1.4);

    // A larger lantern hangs under the dome.
    const lamp = new THREE.Mesh(lanternGeometry().scale(1.8, 1.8, 1.8), new THREE.MeshBasicMaterial({ color: look.lantern }));
    lamp.position.set(0, 5.4, hall.transverse / 2);
    const chain = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1, 0.02), new THREE.MeshLambertMaterial({ color: 0x6e6155 }));
    const chainLength = hall.ceiling + qibla.dome - 0.05 - (5.4 + 0.45);
    chain.scale.y = chainLength;
    chain.position.set(0, 5.4 + 0.45 + chainLength / 2, hall.transverse / 2);

    // Seen from the far end of the nave, the mihrab's light carries through the haze;
    // close up it gives way to the lit niche itself.
    this.mihrabGlow = new Glow(1, {
      color: look.mihrab, intensity: look.mihrabGlow, fog: look.fog, fogScale: 0.32, fixed: true, near: [10, 40],
    });
    this.mihrabGlow.set(0, 0, 1.9, hall.transverse - 0.2, 6.5);
    this.mihrabGlow.commit(1);
    this.lampGlow = new Glow(1, { color: look.lantern, intensity: 1.0, fog: look.fog });
    this.lampGlow.set(0, 0, 5.4, hall.transverse / 2, 2.6);
    this.lampGlow.commit(1);

    this.group.add(supports, sideArches, naveArch, ceiling, dome, oculus, wall, frame, niche, light, lamp, chain,
      this.mihrabGlow.mesh, this.lampGlow.mesh);
  }
}
