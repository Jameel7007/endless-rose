// Where things stand in the hall. Plain functions with no three.js, so node can test them.
//
// Coordinates: x across the hall, y up, z toward the qibla. Everything the GPU sees is in
// local coordinates: the world shifted back by whole bays so the camera always stays inside
// the first bay (docs/architecture.md, "How endless works").

/** x of every arcade, left to right: the two nave arcades and the side field beyond them. */
export function arcadeLines({ nave, aisle, linesPerSide }) {
  const right = [];
  for (let k = 0; k <= linesPerSide; k++) right.push(nave / 2 + k * aisle);
  return [...right.map(x => -x).reverse(), ...right];
}

/** The aisles between neighbouring arcades: centre x and width. The nave is the wide one. */
export function aisles(lines) {
  const out = [];
  for (let i = 0; i < lines.length - 1; i++) {
    out.push({ x: (lines[i] + lines[i + 1]) / 2, width: lines[i + 1] - lines[i] });
  }
  return out;
}

/** Local z of support row i. Rows sit half a bay off the places where the camera stops. */
export const rowZ = (i, bay) => (i + 0.5) * bay;

const EPS = 1e-6;

/**
 * Which rows to draw when the transverse arcade (the bar of the T) stands at local z = cut.
 * Supports stop short of it, because the transverse arcade brings its own. An arch is drawn
 * only when the support it lands on is drawn, or is the transverse arcade itself.
 * Rows run from `first` upward: `supports` of them get a column, `arches` get an arch.
 */
export function visibleRows(cut, { bay, rowsBehind, rowsAhead }) {
  let supports = 0;
  let arches = 0;
  for (let i = -rowsBehind; i <= rowsAhead; i++) {
    if (rowZ(i, bay) < cut - EPS) supports++;
    if (rowZ(i + 1, bay) <= cut + EPS) arches++;
  }
  return { first: -rowsBehind, supports, arches };
}
