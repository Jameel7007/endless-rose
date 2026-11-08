// The hall's building blocks: each is built once, then drawn many times by instancing.
// Arcade profiles are drawn flat (u along the arcade, v up), then extruded into slabs.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const V2 = THREE.Vector2;

export const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Points on a circle from angle a0 to a1 (radians), both ends included. */
function arc(cx, cy, r, a0, a1, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push(new V2(cx + r * Math.cos(a), cy + r * Math.sin(a)));
  }
  return pts;
}

/** Extrude a flat profile into a slab centred on its arcade line, running along z. */
function slab(points, thickness) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(points), { depth: thickness, bevelEnabled: false });
  g.translate(0, 0, -thickness / 2);
  return g.rotateY(-Math.PI / 2); // profile u → world z, thickness → world x
}

/**
 * Merge parts into one geometry and bake a little ambient occlusion into its vertex colours.
 * The greybox has no textures, so this shading is what gives the plaster its depth.
 */
function finish(parts, shade) {
  const g = mergeGeometries(parts.map(p => {
    const q = p.index ? p.toNonIndexed() : p;
    q.deleteAttribute('uv');
    return q;
  }));
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) col.fill(shade(pos.getX(i), pos.getY(i), pos.getZ(i)), 3 * i, 3 * i + 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

const nearCeiling = (ceiling, y) => 1 - 0.3 * smooth(ceiling - 1.1, ceiling, y);

/** One support: plinth, base, column, capital, impost, and the pier that carries the upper arches. */
export function supportGeometry(S) {
  const plinth = new THREE.BoxGeometry(S.plinth, S.plinthTop, S.plinth).translate(0, S.plinthTop / 2, 0);
  const base = new THREE.LatheGeometry([
    new V2(S.plinth * 0.46, S.plinthTop),
    new V2(S.plinth * 0.46, S.plinthTop + 0.05),
    new V2(S.shaftRadius + 0.06, S.plinthTop + 0.1),
    new V2(S.shaftRadius + 0.02, S.baseTop - 0.02),
    new V2(S.shaftRadius, S.baseTop),
  ], 12);
  const top = S.shaftRadius * 0.93;
  const shaft = new THREE.CylinderGeometry(top, S.shaftRadius, S.shaftTop - S.baseTop, 12, 1, true)
    .translate(0, (S.baseTop + S.shaftTop) / 2, 0);
  // A square block flaring out of the round shaft stands in for the carved capital.
  const capital = new THREE.CylinderGeometry(S.capital / Math.SQRT2, top * Math.SQRT2, S.capitalTop - S.shaftTop, 4, 1)
    .rotateY(Math.PI / 4)
    .translate(0, (S.shaftTop + S.capitalTop) / 2, 0);
  const impost = new THREE.BoxGeometry(S.impost, S.impostTop - S.capitalTop, S.impost)
    .translate(0, (S.capitalTop + S.impostTop) / 2, 0);
  const pier = new THREE.BoxGeometry(S.pier, S.pierTop - S.impostTop, S.pier)
    .translate(0, (S.impostTop + S.pierTop) / 2, 0);
  return finish([plinth, base, shaft, capital, impost, pier], (x, y) => 0.6 + 0.4 * smooth(0, 1.2, y));
}

/**
 * One bay of an arcade, from one support's centre to the next: the horseshoe rib that braces
 * the columns (as at Córdoba) and, above an open band, the wall with its round upper arch.
 */
export function arcadeBayGeometry(hall, S, A) {
  const { bay, ceiling } = hall;
  const face = S.pier / 2;
  const mid = bay / 2;
  const half = mid - face;                  // half the clear span between pier faces
  const ri = half - A.inset;                // the horseshoe is widest just short of the piers
  const ro = ri + A.ribDepth;
  const cy = S.impostTop + A.rise;          // a centre above the springing line makes the horseshoe
  const spring = Math.asin(A.rise / ri);
  const outerAt = Math.sqrt(ro * ro - half * half);
  const outerA = Math.atan2(outerAt, half);
  const rib = slab([
    new V2(face, S.impostTop),
    ...arc(mid, cy, ro, Math.PI - outerA, outerA, 16),
    new V2(bay - face, S.impostTop),
    ...arc(mid, cy, ri, -spring, Math.PI + spring, 28),
  ], S.pier);
  const wall = slab([
    new V2(0, S.pierTop),
    new V2(face, S.pierTop),
    ...arc(mid, S.pierTop, half, Math.PI, 0, 20).slice(1, -1),
    new V2(bay - face, S.pierTop),
    new V2(bay, S.pierTop),
    new V2(bay, ceiling),
    new V2(0, ceiling),
  ], S.pier);
  return finish([rib, wall], (x, y) => nearCeiling(ceiling, y));
}

/** One arch of the transverse arcade (the bar of the T), `span` metres wide, running along x. */
export function transverseBayGeometry(span, hall, S, A) {
  const mid = span / 2;
  const ri = mid - S.pier / 2 - A.inset;
  const s = Math.asin(A.transverseRise / ri);
  const cy = S.impostTop + A.transverseRise;
  const g = slab([
    new V2(0, S.impostTop),
    ...arc(mid, cy, ri, Math.PI + s, -s, 40),
    new V2(span, S.impostTop),
    new V2(span, hall.ceiling),
    new V2(0, hall.ceiling),
  ], S.pier).rotateY(Math.PI / 2); // profile u → world x, thickness → world z
  return finish([g], (x, y) => nearCeiling(hall.ceiling, y));
}

/** The qibla wall, `half` metres to each side, with the mihrab's horseshoe opening at x = 0. */
export function qiblaWallGeometry(half, hall, Q) {
  const r = Q.mihrabWidth / 2;
  const cy = Q.mihrabHeight - r;
  const s = Math.asin(Q.rise / r);
  const jamb = r * Math.cos(s);
  const springY = cy - Q.rise;
  const g = new THREE.ExtrudeGeometry(new THREE.Shape([
    new V2(-half, 0),
    new V2(-jamb, 0),
    new V2(-jamb, springY),
    ...arc(0, cy, r, Math.PI + s, -s, 32).slice(1, -1),
    new V2(jamb, springY),
    new V2(jamb, 0),
    new V2(half, 0),
    new V2(half, hall.ceiling),
    new V2(-half, hall.ceiling),
  ]), { depth: Q.wall, bevelEnabled: false });
  return finish([g], (x, y) => (0.74 + 0.26 * smooth(0, 1.2, y)) * nearCeiling(hall.ceiling, y));
}

/**
 * The mihrab's frame, standing proud of the wall: a rectangular panel (the alfiz of
 * Andalusian mihrabs) and on it the horseshoe ring of the arch. Its back lies at z = 0.
 */
export function mihrabFrameGeometry(Q) {
  const r = Q.mihrabWidth / 2;
  const cy = Q.mihrabHeight - r;
  const s = Math.asin(Q.rise / r);
  const jamb = r * Math.cos(s);
  const springY = cy - Q.rise;
  const w = Q.mihrabWidth / 2 + 0.65;
  const h = Q.mihrabHeight + 1.25;
  const panel = new THREE.ExtrudeGeometry(new THREE.Shape([
    new V2(-w, 0),
    new V2(-jamb, 0),
    new V2(-jamb, springY),
    ...arc(0, cy, r, Math.PI + s, -s, 32).slice(1, -1),
    new V2(jamb, springY),
    new V2(jamb, 0),
    new V2(w, 0),
    new V2(w, h),
    new V2(-w, h),
  ]), { depth: 0.1, bevelEnabled: false }).translate(0, 0, -0.1);
  const ro = r + 0.3;
  const so = Math.asin(Q.rise / ro);
  const ring = new THREE.ExtrudeGeometry(new THREE.Shape([
    ...arc(0, cy, ro, Math.PI + so, -so, 40),
    ...arc(0, cy, r, -s, Math.PI + s, 32),
  ]), { depth: 0.07, bevelEnabled: false }).translate(0, 0, -0.17);
  return finish([panel, ring], (x, y) => 0.82 + 0.18 * smooth(0, 1.2, y));
}

/** The niche behind the mihrab opening: a half cylinder under a quarter sphere. */
export function nicheGeometry(Q) {
  const r = Q.mihrabWidth / 2;
  const cy = Q.mihrabHeight - r;
  const wall = new THREE.CylinderGeometry(r, r, cy, 24, 1, true, -Math.PI / 2, Math.PI).translate(0, cy / 2, 0);
  const hood = new THREE.SphereGeometry(r, 24, 8, 0, Math.PI, 0, Math.PI / 2).translate(0, cy, 0);
  return finish([wall, hood], (x, y) => 0.8 + 0.2 * smooth(0, cy, y));
}

/** The dome over the bay in front of the mihrab, seen from inside. Its base sits at y = 0. */
export function domeGeometry(Q) {
  const g = new THREE.SphereGeometry(Q.dome, 64, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  return finish([g], (x, y) => 0.7 + 0.3 * smooth(0, Q.dome * 0.8, y));
}

/**
 * The ceiling over the transverse aisle (z from 0 to depth), with a round opening for the dome.
 * The opening is a little smaller than the dome so the two polygons can't leave a crack between them.
 */
export function transverseCeilingGeometry(half, depth, Q) {
  const shape = new THREE.Shape([new V2(-half, 0), new V2(half, 0), new V2(half, depth), new V2(-half, depth)]);
  shape.holes.push(new THREE.Path().absarc(0, depth / 2, Q.dome - 0.04, 0, Math.PI * 2, true));
  return new THREE.ShapeGeometry(shape, 64).rotateX(Math.PI / 2); // facing down
}

/** A lantern's glass: a stretched octahedron. */
export const lanternGeometry = () => new THREE.OctahedronGeometry(0.17, 0).scale(1, 1.55, 1);

/** A chain, one metre long and centred, scaled to length per lantern. */
export const cordGeometry = () => new THREE.BoxGeometry(0.014, 1, 0.014);

/**
 * The rings of voussoirs on a bay of a field arcade, for the shader: the lower horseshoe rib and
 * a band round the upper arch. Each ring is [centre u, centre v, inner radius, outer radius],
 * worked out from the same numbers that build arcadeBayGeometry.
 */
export function arcadeRings(hall, S, A) {
  const mid = hall.bay / 2;
  const half = mid - S.pier / 2;
  const ri = half - A.inset;
  return {
    rib: [mid, S.impostTop + A.rise, ri, ri + A.ribDepth],
    upper: [mid, S.pierTop, half, half + 0.45],
    spring: [S.impostTop, S.pierTop],
  };
}

/** The ring of voussoirs round a transverse arch `span` metres wide (it has no rib). */
export function transverseRings(span, S, A) {
  const ri = span / 2 - S.pier / 2 - A.inset;
  return {
    rib: [0, 0, 0, 0],
    upper: [span / 2, S.impostTop + A.transverseRise, ri, ri + 0.55],
    spring: [S.impostTop, S.impostTop],
  };
}

/** The mihrab arch [centre height, radius, springing height, frame half width] and the frame's top. */
export function mihrabShape(Q) {
  const r = Q.mihrabWidth / 2;
  const cy = Q.mihrabHeight - r;
  return { arch: [cy, r, cy - Q.rise, r + 0.65], top: Q.mihrabHeight + 1.25 };
}
