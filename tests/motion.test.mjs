import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arriveCut, phraseIndex, spring, step, withinRound } from '../src/motion.js';
import { HALL, MOTION, QIBLA } from '../src/config.js';

const run = (mode, counts) => {
  let s = { count: 0, mode, target: 0 };
  const out = [];
  for (let i = 0; i < counts; i++) {
    const next = step(s, MOTION, HALL, QIBLA);
    s = { ...s, count: next.count, target: next.target };
    out.push(next);
  }
  return out;
};

test('phrases change every 33 counts and cycle through all three', () => {
  const at = c => [withinRound(c, 33), phraseIndex(c, 33, 3)];
  assert.deepEqual(at(0), [0, 0]);
  assert.deepEqual(at(1), [1, 0]);
  assert.deepEqual(at(33), [33, 0]);
  assert.deepEqual(at(34), [1, 1]);
  assert.deepEqual(at(66), [33, 1]);
  assert.deepEqual(at(67), [1, 2]);
  assert.deepEqual(at(99), [33, 2]);
  assert.deepEqual(at(100), [1, 0]);
});

test('arrive: one bay per count, the 33rd under the dome, the 34th back at the start', () => {
  const steps = run('arrive', 35);
  for (let c = 1; c <= 32; c++) {
    assert.ok(Math.abs(steps[c - 1].target - c * HALL.bay) < 1e-9);
    assert.equal(steps[c - 1].restart, false);
  }
  const cut = arriveCut(MOTION, HALL);
  const last = steps[32].target;
  assert.ok(last > cut && last < cut + HALL.transverse, 'the last stop is past the transverse arcade, before the wall');
  assert.equal(steps[33].restart, true);
  assert.ok(Math.abs(steps[33].target - HALL.bay) < 1e-9);
  assert.equal(steps[34].restart, false);
});

test('ahead: one bay per count, never a restart', () => {
  const steps = run('ahead', 120);
  steps.forEach((s, i) => {
    assert.ok(Math.abs(s.target - (i + 1) * HALL.bay) < 1e-9);
    assert.equal(s.restart, false);
  });
});

test('the glide settles on its target without overshooting', () => {
  let x = 0;
  let v = 0;
  let prev = 0;
  for (let t = 0; t < 4; t += 1 / 60) {
    [x, v] = spring(x, v, HALL.bay, MOTION.stiffness, 1 / 60);
    assert.ok(x >= prev - 1e-12 && x <= HALL.bay + 1e-9);
    prev = x;
  }
  assert.ok(Math.abs(x - HALL.bay) < 0.01, 'within a centimetre after four seconds');
});

test('the glide stays stable through long frames', () => {
  let x = 0;
  let v = 0;
  for (let i = 0; i < 20; i++) [x, v] = spring(x, v, 10, MOTION.stiffness, 0.5);
  assert.ok(Number.isFinite(x) && Math.abs(x - 10) < 1e-3);
});
