// The end of the nave: the transverse arcade (the bar of the T), the dome in front of the
// mihrab, and the qibla wall. Built once in its own group; the group's origin is the
// transverse arcade's line, and main.js moves it each frame.
import * as THREE from 'three';
import {
  domeGeometry, lanternGeometry, mihrabFrameGeometry, nicheGeometry, qiblaWallGeometry,
  transverseBayGeometry, transverseCeilingGeometry,
} from './pieces.js';
import { Glow } from './glow.js';
import { litMaterial } from './light.js';
import { aisles } from '../layout.js';
import { LANTERNS } from '../config.js';

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

    // A lantern in each side bay of the transverse aisle, as in the field.
    const bays = aisles(lines).filter(a => Math.abs(a.width - hall.aisle) < 1e-6);
    this.lanternBody = new THREE.Color(look.lantern);
    this.bodies = new THREE.MeshBasicMaterial({ color: look.lantern });
    const sideLamps = new THREE.InstancedMesh(lanternGeometry(), this.bodies, bays.length);
    const sideChains = new THREE.InstancedMesh(new THREE.BoxGeometry(0.014, 1, 0.014), new THREE.MeshLambertMaterial({ color: 0x6e6155 }), bays.length);
    this.sideGlow = new Glow(bays.length, { color: look.lantern, intensity: look.lanternGlow, fog: 0.017 });
    const chainLength = hall.ceiling - (LANTERNS.side + 0.26);
    const q = new THREE.Quaternion();
    bays.forEach((a, i) => {
      sideLamps.setMatrixAt(i, m.makeTranslation(a.x, LANTERNS.side, hall.transverse / 2));
      sideChains.setMatrixAt(i, m.compose(new THREE.Vector3(a.x, hall.ceiling - chainLength / 2, hall.transverse / 2), q, new THREE.Vector3(1, chainLength, 1)));
      this.sideGlow.set(i, a.x, LANTERNS.side, hall.transverse / 2, 1.0);
    });
    this.sideGlow.commit(bays.length);

    const ceiling = new THREE.Mesh(
      transverseCeilingGeometry(halfWidth, hall.transverse, qibla),
      litMaterial(new THREE.MeshStandardMaterial({ color: look.ceiling, roughness: 0.95 })),
    );
    ceiling.position.y = hall.ceiling;

    const dome = new THREE.Mesh(domeGeometry(qibla), litMaterial(new THREE.MeshStandardMaterial({
      color: look.plaster, roughness: 0.94, vertexColors: true, side: THREE.BackSide,
    })));
    dome.position.set(0, hall.ceiling, hall.transverse / 2);

    this.oculus = new THREE.MeshBasicMaterial({ color: 0xfff6e6, fog: false });
    const oculus = new THREE.Mesh(new THREE.CircleGeometry(0.55, 32).rotateX(Math.PI / 2), this.oculus);
    oculus.position.set(0, hall.ceiling + qibla.dome - 0.05, hall.transverse / 2);

    const wallMaterial = litMaterial(new THREE.MeshStandardMaterial({ color: look.plaster, roughness: 0.94 }), 'wall');
    const wall = new THREE.Mesh(qiblaWallGeometry(halfWidth, hall, qibla), wallMaterial);
    wall.position.z = hall.transverse;
    const frame = new THREE.Mesh(mihrabFrameGeometry(qibla), wallMaterial);
    frame.position.z = hall.transverse;

    const niche = new THREE.Mesh(nicheGeometry(qibla), new THREE.MeshStandardMaterial({
      color: 0xf1dcb4, roughness: 0.9, vertexColors: true, side: THREE.DoubleSide,
      emissive: look.mihrab, emissiveIntensity: 0.12,
    }));
    niche.position.z = hall.transverse;

    this.look = look;
    const light = new THREE.PointLight(look.mihrab, look.mihrabLight, 0, 2);
    this.light = light;
    light.position.set(0, 2.2, hall.transverse - 1.4);

    // A larger lantern hangs under the dome.
    const lamp = new THREE.Mesh(lanternGeometry().scale(1.8, 1.8, 1.8), this.bodies);
    lamp.position.set(0, 5.4, hall.transverse / 2);
    const chain = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1, 0.02), new THREE.MeshLambertMaterial({ color: 0x6e6155 }));
    const domeChain = hall.ceiling + qibla.dome - 0.05 - (5.4 + 0.45);
    chain.scale.y = domeChain;
    chain.position.set(0, 5.4 + 0.45 + domeChain / 2, hall.transverse / 2);

    // Seen from the far end of the nave, the mihrab's light carries through the haze;
    // close up it gives way to the lit niche itself.
    this.mihrabGlow = new Glow(1, {
      color: look.mihrab, intensity: look.mihrabGlow, fog: 0.017, fogScale: 0.32, fixed: true, near: [10, 40],
    });
    this.mihrabGlow.set(0, 0, 1.9, hall.transverse - 0.2, 6.5);
    this.mihrabGlow.commit(1);
    this.lampGlow = new Glow(1, { color: look.lantern, intensity: 1.0, fog: 0.017 });
    this.lampGlow.set(0, 0, 5.4, hall.transverse / 2, 2.6);
    this.lampGlow.commit(1);

    this.group.add(supports, sideArches, naveArch, ceiling, dome, oculus, wall, frame, niche, light, lamp, chain,
      sideLamps, sideChains, this.mihrabGlow.mesh, this.lampGlow.mesh, this.sideGlow.mesh);
  }

  /** The hour's light: the oculus shows the sky; the mihrab and the lamp glow more by night. */
  setLight(sky, lantern, fog) {
    this.oculus.color.setRGB(...sky).multiplyScalar(1.6);
    this.light.intensity = this.look.mihrabLight * (1 + 0.6 * lantern);
    this.mihrabGlow.setStrength(this.look.mihrabGlow * (0.8 + 0.6 * lantern));
    this.mihrabGlow.setFog(fog);
    this.lampGlow.setStrength(0.35 + 0.75 * lantern);
    this.lampGlow.setFog(fog);
    this.sideGlow.setStrength(this.look.lanternGlow * (0.2 + 0.8 * lantern));
    this.sideGlow.setFog(fog);
    this.bodies.color.copy(this.lanternBody).multiplyScalar(0.55 + 0.45 * lantern);
  }
}
