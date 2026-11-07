import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookAt, luminance } from '../src/sky/look.js';
import { aisleIndex, aisles, arcadeLines, isOpen } from '../src/layout.js';
import { HALL } from '../src/config.js';

test('the hall darkens from day to night, and lanterns take over', () => {
  let prev = Infinity;
  for (let alt = 60; alt >= -30; alt -= 3) {
    for (const evening of [0, 0.5, 1]) {
      const l = lookAt(alt, evening);
      for (const v of [...l.haze, ...l.sky, ...l.ground, ...l.sun, l.hemi, l.sunI, l.beam, l.lantern, l.exposure, l.fog]) {
        assert.ok(Number.isFinite(v) && v >= 0, `alt ${alt}: a value is ${v}`);
      }
    }
    const haze = luminance(lookAt(alt, 0.5).haze);
    assert.ok(haze <= prev + 0.02, `the haze should not brighten as the sun sinks (alt ${alt})`);
    prev = haze;
  }
  assert.ok(lookAt(-30, 1).lantern === 1 && lookAt(40, 0).lantern < 0.2);
  assert.equal(lookAt(-10, 0).sunI, 0, 'no sunlight before sunrise');
});

test('evenings are warmer than mornings at the same height', () => {
  const warmth = ([r, , b]) => r / Math.max(b, 1e-6);
  assert.ok(warmth(lookAt(5, 1).haze) > warmth(lookAt(5, 0).haze));
});

test('ceiling openings make a chessboard, the nave open on even rows', () => {
  assert.equal(isOpen(0, 0), true);
  assert.equal(isOpen(0, 1), false);
  assert.equal(isOpen(1, 0), false);
  assert.equal(isOpen(1, -3), true);
  assert.equal(isOpen(2, 4), true);
  const lines = arcadeLines(HALL);
  const ks = aisles(lines).map(a => aisleIndex(a.x, HALL));
  assert.equal(ks[HALL.linesPerSide], 0, 'the middle aisle is the nave');
  assert.deepEqual(ks.slice(HALL.linesPerSide + 1, HALL.linesPerSide + 4), [1, 2, 3]);
  assert.deepEqual(ks.slice(HALL.linesPerSide - 3, HALL.linesPerSide), [3, 2, 1]);
});
