import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { decodeRose, encodeRose, layingOrder } from '../src/rose/format.js';
import { COLOURWAYS, DESIGNS, roseFor } from '../src/rose/rose.js';

const load = name => {
  const b = readFileSync(new URL(`../src/rose/data/${name}.bin`, import.meta.url));
  return decodeRose(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};

test('a rose survives the trip to bytes and back', () => {
  const tiles = [
    { poly: [[0, 0], [1.234, 0], [0, 2.5]], key: 'A', layer: 0 },
    { poly: [[-3, -3], [-2, -3.5], [-2.25, -2], [-3.01, -2.4]], key: 'K', layer: 2.37 },
  ];
  const r = decodeRose(encodeRose(tiles, 5));
  assert.equal(r.radius, 5);
  assert.deepEqual([...r.keys], [7, 1]);
  assert.deepEqual([...r.starts], [0, 3, 7]);
  assert.ok(Math.abs(r.layers[1] - 2.37) < 1e-6);
  assert.ok(Math.abs(r.xy[2] - 1.23) < 0.006 && Math.abs(r.xy[13] + 2.4) < 0.006, 'coordinates kept to a hundredth');
});

test('the three roses load whole, and are laid from the rim up to the crown', () => {
  const counts = { moorish: 2041, lee: 2561, polar: 3065 };
  for (const name of DESIGNS) {
    const rose = load(name);
    assert.equal(rose.keys.length, counts[name], name);
    assert.ok(Math.abs(rose.radius - 29.47) < 0.02, `${name} radius ${rose.radius}`);
    const order = layingOrder(rose);
    const radiusOf = i => {
      let cx = 0, cy = 0;
      const a = rose.starts[i], b = rose.starts[i + 1];
      for (let p = a; p < b; p++) { cx += rose.xy[2 * p]; cy += rose.xy[2 * p + 1]; }
      return Math.hypot(cx / (b - a), cy / (b - a));
    };
    const first = [], last = [];
    order.forEach((o, i) => { if (o < 0.1) first.push(radiusOf(i)); if (o >= 0.9) last.push(radiusOf(i)); });
    const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
    assert.ok(mean(first) > 25 && mean(last) < 10, `${name}: first tiles at r ${mean(first).toFixed(1)}, last at ${mean(last).toFixed(1)}`);
    assert.equal(new Set(order).size, order.length, 'every tile has its own place in the order');
  }
});

test('every design meets every colourway once in 18 rounds', () => {
  for (const start of [0, 7, 20329]) {
    const seen = new Set();
    for (let i = start; i < start + 18; i++) {
      const { design, colourway } = roseFor(i);
      seen.add(`${design}/${colourway.name}`);
      assert.notEqual(roseFor(i).design, roseFor(i + 1).design, 'the design changes every round');
    }
    assert.equal(seen.size, DESIGNS.length * COLOURWAYS.length);
  }
});
