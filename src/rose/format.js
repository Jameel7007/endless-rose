// The rose files: a medallion's finished tiles in a compact binary form. Plain JavaScript with
// no three.js or DOM, so node can write and test them.
//
//   header   'ROSE', version, piece count, point count, scale (units per step), radius
//   pieces   per tile: glaze key (index into KEYS), point count, laying ring × 100
//   points   per point: x, y as int16 steps of `scale` units
//
// The tiles come from the Rosette project's medallions (scripts/import-roses.mjs).

export const KEYS = 'WKBTGORA'; // white, black, lapis, turquoise, green, ochre, terracotta, gold
const MAGIC = 0x45534f52; // 'ROSE', little-endian
const HEADER = 24;

/** tiles: [{ poly: [[x, y], …], key, layer }] → ArrayBuffer */
export function encodeRose(tiles, radius, scale = 0.01) {
  const points = tiles.reduce((n, t) => n + t.poly.length, 0);
  const buf = new ArrayBuffer(HEADER + tiles.length * 4 + points * 4);
  const v = new DataView(buf);
  v.setUint32(0, MAGIC, true);
  v.setUint32(4, 1, true);
  v.setUint32(8, tiles.length, true);
  v.setUint32(12, points, true);
  v.setFloat32(16, scale, true);
  v.setFloat32(20, radius, true);
  let o = HEADER;
  for (const t of tiles) {
    if (t.poly.length > 255) throw new Error('a tile with more than 255 points');
    v.setUint8(o, KEYS.indexOf(t.key));
    v.setUint8(o + 1, t.poly.length);
    v.setUint16(o + 2, Math.round(t.layer * 100), true);
    o += 4;
  }
  for (const t of tiles) {
    for (const [x, y] of t.poly) {
      v.setInt16(o, Math.round(x / scale), true);
      v.setInt16(o + 2, Math.round(y / scale), true);
      o += 4;
    }
  }
  return buf;
}

/** ArrayBuffer → { radius, keys: Uint8Array, layers: Float32Array, starts: Uint32Array, xy: Float32Array } */
export function decodeRose(buf) {
  const v = new DataView(buf);
  if (v.getUint32(0, true) !== MAGIC) throw new Error('not a rose file');
  const n = v.getUint32(8, true);
  const points = v.getUint32(12, true);
  const scale = v.getFloat32(16, true);
  const radius = v.getFloat32(20, true);
  const keys = new Uint8Array(n);
  const layers = new Float32Array(n);
  const starts = new Uint32Array(n + 1);
  let o = HEADER;
  for (let i = 0; i < n; i++) {
    keys[i] = v.getUint8(o);
    starts[i + 1] = starts[i] + v.getUint8(o + 1);
    layers[i] = v.getUint16(o + 2, true) / 100;
    o += 4;
  }
  const xy = new Float32Array(points * 2);
  for (let i = 0; i < points * 2; i++) xy[i] = v.getInt16(o + i * 2, true) * scale;
  return { radius, keys, layers, starts, xy };
}

/**
 * The laying order for a dome: from the rim up to the crown, ring by ring (rings of `ring` units
 * by the tile's distance from the centre), and within a ring a sweep around like a setter's
 * hand. It's worked out from the geometry, not from the designs' own layers, so the three
 * designs are laid alike. Returns each tile's place in the order, from 0 to 1.
 */
export function layingOrder(rose, ring = 0.8) {
  const n = rose.keys.length;
  const band = new Float32Array(n);
  const sweep = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let cx = 0;
    let cy = 0;
    const a = rose.starts[i];
    const b = rose.starts[i + 1];
    for (let p = a; p < b; p++) { cx += rose.xy[2 * p]; cy += rose.xy[2 * p + 1]; }
    cx /= b - a;
    cy /= b - a;
    band[i] = Math.floor(Math.hypot(cx, cy) / ring);
    sweep[i] = (Math.atan2(cy, cx) + Math.PI) / (2 * Math.PI);
  }
  const ids = Array.from({ length: n }, (_, i) => i);
  ids.sort((i, j) => band[j] - band[i] || sweep[i] - sweep[j]);
  const order = new Float32Array(n);
  ids.forEach((id, rank) => { order[id] = rank / n; });
  return order;
}
