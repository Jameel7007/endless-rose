import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Quality } from '../src/quality.js';

const run = (q, seconds, frameTime) => {
  for (let t = 0; t < seconds; t += frameTime) q.frame(frameTime);
};

test('slow frames step the pixel ratio down, one window at a time', () => {
  const seen = [];
  const q = new Quality(2, r => seen.push(r));
  assert.deepEqual(q.ratios, [2, 1.6, 1.3, 1]);
  run(q, 1.6, 1 / 30); // slow: step down to 1.6 and judge it
  assert.equal(q.ratio, 1.6);
  run(q, 1.6, 1 / 45); // it helped (30 → 45 fps): keep it
  assert.equal(q.ratio, 1.6);
  run(q, 1.6, 1 / 45); // still slow: down again
  assert.equal(q.ratio, 1.3);
  assert.deepEqual(seen, [2, 1.6, 1.3]);
});

test('a step down that brings no speed-up is undone, and not tried again', () => {
  const q = new Quality(2, () => {});
  run(q, 1.6, 1 / 30); // slow: try 1.6
  run(q, 1.6, 1 / 30); // no faster: something else holds 30 fps
  assert.equal(q.ratio, 2);
  run(q, 10, 1 / 30);
  assert.equal(q.ratio, 2, 'stays put once it knows');
});

test('long smooth stretches step back up, but not soon into a level that was too slow', () => {
  const q = new Quality(2, () => {});
  run(q, 1.6, 1 / 30);
  run(q, 1.6, 1 / 60); // faster at 1.6
  assert.equal(q.ratio, 1.6);
  run(q, 20, 1 / 60);
  assert.equal(q.ratio, 1.6, 'level 2 was too slow less than a minute ago');
  run(q, 60, 1 / 60);
  assert.equal(q.ratio, 2);
});

test('a device that only reaches ratio 1 has one level', () => {
  const q = new Quality(1, () => {});
  assert.deepEqual(q.ratios, [1]);
  run(q, 5, 1 / 20);
  assert.equal(q.ratio, 1);
});
