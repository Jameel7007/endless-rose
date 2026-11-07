// The hall's time: now, or a moment you are previewing. From it come the sun's place in the
// hall (which faces the qibla, so the sun keeps its true bearing), today's prayer times, and
// whose prayer time it is.
import { periodAt, prayerTimes, qiblaBearing, sunPosition } from './sun.js';

const RAD = Math.PI / 180;
const PREFS = 'endless-rose.prefs';

export class Clock {
  constructor(place, defaults) {
    this.place = place;
    this.prefs = { ...defaults, ...loadPrefs() };
    this.preview = null; // minutes after local midnight, or null for now
    this.cache = new Map();
  }

  setPlace(place) {
    this.place = place;
    this.cache.clear();
  }

  setPrefs(prefs) {
    Object.assign(this.prefs, prefs);
    try { localStorage.setItem(PREFS, JSON.stringify(this.prefs)); } catch { /* not saved */ }
    this.cache.clear();
  }

  /** The moment shown: now, or today at the previewed minute. */
  moment() {
    if (this.preview === null) return Date.now();
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime() + this.preview * 60000;
  }

  /** The prayer times for the local calendar day containing `ms`. */
  timesFor(ms) {
    const d = new Date(ms);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (!this.cache.has(key)) {
      if (this.cache.size > 4) this.cache.clear();
      const { lat, lon } = this.place;
      this.cache.set(key, prayerTimes(d.getFullYear(), d.getMonth() + 1, d.getDate(), lat, lon, this.prefs));
    }
    return this.cache.get(key);
  }

  /**
   * Everything the hall needs at `ms`: the direction toward the sun in the hall (x across,
   * y up, z toward the qibla), its altitude, how far into the evening it is, and the prayer period.
   */
  read(ms = this.moment()) {
    const { lat, lon } = this.place;
    const sun = sunPosition(ms, lat, lon);
    const qibla = qiblaBearing(lat, lon);
    const beta = (sun.azimuth - qibla) * RAD; // the sun's bearing relative to the way the hall faces
    const alt = sun.altitude * RAD;
    const today = this.timesFor(ms);
    const tomorrow = this.timesFor(ms + 86400000);
    return {
      ms,
      altitude: sun.altitude,
      // Facing +z, bearings turn clockwise to the right, and the right of the screen is -x.
      dir: [-Math.sin(beta) * Math.cos(alt), Math.sin(alt), Math.cos(beta) * Math.cos(alt)],
      // 0 in the morning, 1 in the evening, crossing at noon and midnight.
      evening: 0.5 + 0.5 * Math.sin((sun.hourAngle / 15 / 24) * 2 * Math.PI),
      today,
      period: periodAt(ms, today, tomorrow.fajr),
      qibla,
    };
  }
}

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS)) ?? {}; } catch { return {}; }
}

/** `?t=HH:MM` in the address previews that time of day. */
export function urlPreview(search) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(new URLSearchParams(search).get('t') ?? '');
  return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null;
}
