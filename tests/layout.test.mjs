import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aisles, arcadeLines, rowZ, visibleRows } from '../src/layout.js';
import { HALL, MOTION } from '../src/config.js';
import { arriveCut } from '../src/motion.js';

test('arcades are symmetric, with one nave wider than every side aisle', () => {
  const lines = arcadeLines(HALL);
  assert.equal(lines.length, 2 * (HALL.linesPerSide + 1));
  lines.forEach((x, i) => assert.ok(Math.abs(x + lines[lines.length - 1 - i]) < 1e-9));
  const widths = aisles(lines).map(a => a.width);
  assert.equal(widths.filter(w => Math.abs(w - HALL.nave) < 1e-9).length, 1);
  assert.ok(widths.every(w => Math.abs(w - HALL.nave) < 1e-9 || Math.abs(w - HALL.aisle) < 1e-9));
});

test('at the start of an approach, every row up to the transverse arcade is drawn', () => {
  const cut = arriveCut(MOTION, HALL);
  const v = visibleRows(cut, HALL);
  const lastSupport = v.first + v.supports - 1;
  assert.ok(rowZ(lastSupport, HALL.bay) < cut);
  assert.ok(Math.abs(rowZ(lastSupport + 1, HALL.bay) - cut) < 1e-9, 'no gap before the transverse arcade');
  assert.ok(lastSupport < HALL.rowsAhead, 'the window of rows reaches the transverse arcade');
  assert.ok(Math.abs(rowZ(v.first + v.arches, HALL.bay) - cut) < 1e-9, 'the last arch lands on the transverse arcade');
});

test('wherever the transverse arcade stands, every arch lands on a drawn support or on it', () => {
  for (let cut = -4; cut < arriveCut(MOTION, HALL) + 0.01; cut += 0.37) {
    const v = visibleRows(cut, HALL);
    assert.ok(v.arches === v.supports || v.arches === v.supports - 1 || v.supports === 0);
    if (v.supports > 0) assert.ok(rowZ(v.first + v.supports - 1, HALL.bay) < cut, 'no column beyond the cut');
    if (v.arches > 0) assert.ok(rowZ(v.first + v.arches, HALL.bay) <= cut + 1e-6, 'no arch beyond the cut');
  }
});

test('in ahead mode the field always reaches the transverse arcade', () => {
  for (let local = 0; local < HALL.bay; local += 0.05) {
    const cut = local + MOTION.horizon * HALL.bay;
    const v = visibleRows(cut, HALL);
    assert.ok(rowZ(v.first + v.supports, HALL.bay) >= cut - 1e-6, 'the next row would stand at or past the cut');
  }
});
