// The sun for a place and a moment, the five prayer times, and the qibla. Plain maths with no
// dependencies, so node can test it. Solar coordinates are the low-precision ones PrayTimes.org
// uses, good to about a minute this century. tests/sun.test.mjs checks the results against
// adhan-js.

const RAD = Math.PI / 180;
const HOUR = 3600000;
const sin = d => Math.sin(d * RAD);
const cos = d => Math.cos(d * RAD);
const tan = d => Math.tan(d * RAD);
const asin = x => Math.asin(x) / RAD;
const acos = x => Math.acos(x) / RAD;
const atan2 = (y, x) => Math.atan2(y, x) / RAD;
const wrap = (a, b) => ((a % b) + b) % b;

const julian = ms => ms / 86400000 + 2440587.5;

/** The sun's declination (degrees) and the equation of time (hours) at a Julian day. */
function solar(jd) {
  const d = jd - 2451545.0;
  const g = wrap(357.529 + 0.98560028 * d, 360);
  const q = wrap(280.459 + 0.98564736 * d, 360);
  const l = wrap(q + 1.915 * sin(g) + 0.02 * sin(2 * g), 360);
  const e = 23.439 - 0.00000036 * d;
  const ra = wrap(atan2(cos(e) * sin(l), cos(l)) / 15, 24);
  return { decl: asin(sin(e) * sin(l)), eqt: wrap(q / 15 - ra + 12, 24) - 12 };
}

/**
 * The sun's altitude and azimuth in degrees (azimuth clockwise from north) at a moment `ms`,
 * and its hour angle (degrees from solar noon, -180 to 180; negative in the morning).
 */
export function sunPosition(ms, lat, lon) {
  const { decl, eqt } = solar(julian(ms));
  const hourAngle = wrap(15 * (ms / HOUR + lon / 15 + eqt - 12) + 180, 360) - 180;
  return {
    altitude: asin(sin(lat) * sin(decl) + cos(lat) * cos(decl) * cos(hourAngle)),
    azimuth: wrap(atan2(-cos(decl) * sin(hourAngle), sin(decl) * cos(lat) - cos(decl) * cos(hourAngle) * sin(lat)), 360),
    hourAngle,
  };
}

/** Bearing of the Kaaba from a place, in degrees clockwise from north. */
export function qiblaBearing(lat, lon) {
  const kaabaLat = 21.4225;
  const dl = 39.8262 - lon;
  return wrap(atan2(sin(dl), cos(lat) * tan(kaabaLat) - sin(lat) * cos(dl)), 360);
}

/**
 * Calculation methods: the sun's depression for Fajr and Isha (or a fixed interval after
 * Maghrib), and minutes added to Dhuhr. The same conventions as adhan-js.
 */
export const METHODS = {
  mwl: { name: 'Muslim World League', fajr: 18, isha: 17, dhuhr: 1 },
  isna: { name: 'ISNA, North America', fajr: 15, isha: 15, dhuhr: 1 },
  egypt: { name: 'Egyptian Authority', fajr: 19.5, isha: 17.5, dhuhr: 1 },
  karachi: { name: 'University of Karachi', fajr: 18, isha: 18, dhuhr: 1 },
  makkah: { name: 'Umm al-Qura, Makkah', fajr: 18.5, ishaMinutes: 90, dhuhr: 0 },
};

/** Hours either side of solar noon at which the sun stands at `altitude`; NaN if it never does. */
function hoursFromNoon(altitude, lat, decl) {
  const c = (sin(altitude) - sin(lat) * sin(decl)) / (cos(lat) * cos(decl));
  return c < -1 || c > 1 ? NaN : acos(c) / 15;
}

/**
 * The prayer times for one calendar day at a place, as moments in ms (rounded to the minute).
 * `asr` is 'standard' (a shadow its own length past noon) or 'hanafi' (twice its length).
 * Where Fajr or Isha would fall beyond the middle of the night, or never come (far north in
 * summer), they are held at the middle of the night.
 */
export function prayerTimes(year, month, day, lat, lon, { method = 'mwl', asr = 'standard' } = {}) {
  const m = METHODS[method];
  const base = Date.UTC(year, month - 1, day);
  const noonOn = b => 12 - lon / 15 - solar(julian(b + (12 - lon / 15) * HOUR)).eqt;
  // An event at a given sun altitude, refined once with the sun as it is at that hour.
  const event = (b, altitude, side) => {
    let h = noonOn(b) + side * hoursFromNoon(altitude, lat, solar(julian(b + (12 - lon / 15) * HOUR)).decl);
    if (Number.isNaN(h)) return NaN;
    const s = solar(julian(b + h * HOUR));
    h = 12 - lon / 15 - s.eqt + side * hoursFromNoon(altitude, lat, s.decl);
    return b + h * HOUR;
  };
  const asrAltitude = decl => Math.atan(1 / ((asr === 'hanafi' ? 2 : 1) + tan(Math.abs(lat - decl)))) / RAD;

  const transit = base + noonOn(base) * HOUR;
  const sunrise = event(base, -0.833, -1);
  const sunset = event(base, -0.833, 1);
  const night = event(base + 86400000, -0.833, -1) - sunset;
  let asrTime = transit + hoursFromNoon(asrAltitude(solar(julian(transit)).decl), lat, solar(julian(transit)).decl) * HOUR;
  asrTime = transit + hoursFromNoon(asrAltitude(solar(julian(asrTime)).decl), lat, solar(julian(asrTime)).decl) * HOUR;

  let fajr = event(base, -m.fajr, -1);
  const safeFajr = sunrise - night / 2;
  if (Number.isNaN(fajr) || fajr < safeFajr) fajr = safeFajr;
  let isha;
  if (m.ishaMinutes) {
    isha = sunset + m.ishaMinutes * 60000;
  } else {
    isha = event(base, -m.isha, 1);
    const safeIsha = sunset + night / 2;
    if (Number.isNaN(isha) || isha > safeIsha) isha = safeIsha;
  }

  const minute = t => Math.round(t / 60000) * 60000;
  return {
    fajr: minute(fajr),
    sunrise: minute(sunrise),
    dhuhr: minute(transit + m.dhuhr * 60000),
    asr: minute(asrTime),
    maghrib: minute(sunset),
    isha: minute(isha),
  };
}

export const PRAYERS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const LABELS = {
  fajr: 'Fajr', sunrise: 'Sunrise', morning: 'Morning', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha',
};

/**
 * Whose time it is at `ms`, given today's times and tomorrow's Fajr: one of fajr, morning
 * (between sunrise and Dhuhr), dhuhr, asr, maghrib, isha. Also which time comes next.
 */
export function periodAt(ms, today, tomorrowFajr) {
  if (ms < today.fajr) return { now: 'isha', next: 'fajr', at: today.fajr };
  if (ms < today.sunrise) return { now: 'fajr', next: 'sunrise', at: today.sunrise };
  if (ms < today.dhuhr) return { now: 'morning', next: 'dhuhr', at: today.dhuhr };
  if (ms < today.asr) return { now: 'dhuhr', next: 'asr', at: today.asr };
  if (ms < today.maghrib) return { now: 'asr', next: 'maghrib', at: today.maghrib };
  if (ms < today.isha) return { now: 'maghrib', next: 'isha', at: today.isha };
  return { now: 'isha', next: 'fajr', at: tomorrowFajr };
}
