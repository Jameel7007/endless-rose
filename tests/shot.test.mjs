import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frameRose, project, rimPoints } from '../src/shot.js';
import { HALL, QIBLA, VIEW } from '../src/config.js';

const rim = rimPoints({ radius: QIBLA.dome, rise: HALL.ceiling - VIEW.eye, before: QIBLA.stopBeforeDome });
const DEG = Math.PI / 180;
const seen = (aspect, band, minFov) => {
  const f = frameRose(rim, aspect, band, { minFov, margin: VIEW.shotMargin });
  return { ...f, ...project(rim, f.pitch, Math.tan((f.fov / 2) * DEG), aspect) };
};

test('the rim is a circle round the dome, ahead of and above the eye', () => {
  assert.equal(rim.length, 72);
  for (const [x, y, z] of rim) {
    assert.ok(Math.abs(Math.hypot(x, z - QIBLA.stopBeforeDome) - QIBLA.dome) < 1e-9);
    assert.equal(y, HALL.ceiling - VIEW.eye);
  }
});

test('a point straight along the view lands in the middle of the screen', () => {
  const r = project([[0, Math.sin(1), Math.cos(1)]], 1, Math.tan(0.5), 1.6);
  assert.ok(Math.abs(r.top - 0.5) < 1e-9 && r.side === 0);
});

for (const [name, aspect, band, minFov] of [
  ['a laptop', 1280 / 800, [0.08, 0.8], VIEW.fovLandscape],
  ['a phone held upright', 390 / 844, [0.27, 0.8], VIEW.fovPortrait],
  ['a phone on its side', 844 / 390, [0.2, 0.62], VIEW.fovLandscape],
  ['a tablet', 768 / 1024, [0.1, 0.78], VIEW.fovPortrait],
]) {
  test(`the whole rose fits between the header and the words on ${name}`, () => {
    const s = seen(aspect, band, minFov);
    assert.ok(s.top >= band[0] - 1e-3 && s.bottom <= band[1] + 1e-3, `rose ${s.top.toFixed(3)}–${s.bottom.toFixed(3)} in ${band}`);
    assert.ok(s.side <= 1, `reaches ${s.side.toFixed(3)} of the width`);
    assert.ok(s.fov >= minFov && s.fov <= 112, `fov ${s.fov.toFixed(1)}°`);
    assert.ok(s.pitch > 45 * DEG && s.pitch < 89 * DEG, `pitch ${(s.pitch / DEG).toFixed(1)}°`);
    // and it fills the band: no smaller than it needs to be
    assert.ok(s.fov === minFov || s.bottom - s.top > 0.8 * (band[1] - band[0]) || s.side > 0.85);
  });
}
