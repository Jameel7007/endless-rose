import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { PRAYERS, periodAt, prayerTimes, qiblaBearing, sunPosition } from '../src/sky/sun.js';

// Reference times and bearings computed with adhan-js 4.4.6 (rounded to the minute, as adhan does):
// five cities, four days through the year, five methods, both ways of reckoning Asr.
const ref = JSON.parse(readFileSync(new URL('./fixtures/adhan-reference.json', import.meta.url)));
const minutesApart = (a, b) => Math.abs(a - b) / 60000;

test('prayer times agree with adhan-js to within two minutes', () => {
  for (const c of ref.cases) {
    const [lat, lon] = ref.cities[c.city];
    const [y, m, d] = c.day.split('-').map(Number);
    const t = prayerTimes(y, m, d, lat, lon, { method: c.method, asr: c.asr });
    for (const k of PRAYERS) {
      const off = minutesApart(t[k], Date.parse(c.times[k]));
      assert.ok(off <= 2, `${c.city} ${c.method} ${c.asr} ${c.day} ${k}: ${new Date(t[k]).toISOString()} vs ${c.times[k]}`);
    }
  }
});

test('the qibla bearing agrees with adhan-js', () => {
  for (const [city, bearing] of Object.entries(ref.qibla)) {
    if (city === 'mecca') continue; // no bearing from the Kaaba itself
    const [lat, lon] = ref.cities[city];
    assert.ok(Math.abs(qiblaBearing(lat, lon) - bearing) < 0.1, `${city}: ${qiblaBearing(lat, lon)} vs ${bearing}`);
  }
});

test('the sun stands where the prayer times say it does', () => {
  for (const c of ref.cases.filter(c => c.method === 'mwl' && c.city !== 'london')) {
    const [lat, lon] = ref.cities[c.city];
    const at = k => sunPosition(Date.parse(c.times[k]), lat, lon);
    assert.ok(Math.abs(at('fajr').altitude + 18) < 0.6, `${c.city} ${c.day} Fajr altitude ${at('fajr').altitude}`);
    assert.ok(Math.abs(at('sunrise').altitude + 0.833) < 0.6, `${c.city} ${c.day} sunrise altitude ${at('sunrise').altitude}`);
    assert.ok(Math.abs(at('maghrib').altitude + 0.833) < 0.6, `${c.city} ${c.day} sunset altitude ${at('maghrib').altitude}`);
    assert.ok(at('sunrise').azimuth < 180 && at('maghrib').azimuth > 180, 'rises in the east, sets in the west');
    const noon = sunPosition(Date.parse(c.times.dhuhr) - 60000, lat, lon); // adhan adds a minute to Dhuhr
    if (noon.altitude < 85) assert.ok(Math.abs(Math.sin(noon.azimuth * Math.PI / 180)) < 0.03, `${c.city} ${c.day} noon azimuth ${noon.azimuth}`);
  }
});

test('the period follows the day around', () => {
  const t = prayerTimes(2026, 10, 29, 37.8789, -4.7794);
  const tomorrow = prayerTimes(2026, 10, 30, 37.8789, -4.7794).fajr;
  const now = ms => periodAt(ms, t, tomorrow);
  assert.deepEqual(now(t.fajr - 1).now, 'isha');
  assert.equal(now(t.fajr).now, 'fajr');
  assert.equal(now(t.sunrise + 1).now, 'morning');
  assert.equal(now(t.dhuhr).now, 'dhuhr');
  assert.equal(now(t.asr).now, 'asr');
  assert.equal(now(t.maghrib).now, 'maghrib');
  assert.equal(now(t.isha).next, 'fajr');
  assert.equal(now(t.isha).at, tomorrow);
});
