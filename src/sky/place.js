// Where the hall's sun is. A place you chose is saved on this device only. Without one, the
// place is estimated from the time zone, which needs no permission. Nothing is sent anywhere.

const KEY = 'endless-rose.place';

// The main city of common time zones, as [latitude, longitude].
const ZONES = {
  'America/New_York': [40.71, -74.01], 'America/Chicago': [41.88, -87.63], 'America/Denver': [39.74, -104.99],
  'America/Phoenix': [33.45, -112.07], 'America/Los_Angeles': [34.05, -118.24], 'America/Anchorage': [61.22, -149.9],
  'America/Toronto': [43.65, -79.38], 'America/Vancouver': [49.28, -123.12], 'America/Halifax': [44.65, -63.57],
  'America/Mexico_City': [19.43, -99.13], 'America/Monterrey': [25.69, -100.32], 'America/Merida': [20.97, -89.62],
  'America/Cancun': [21.16, -86.85], 'America/Tijuana': [32.51, -117.04], 'America/Guatemala': [14.63, -90.51],
  'America/El_Salvador': [13.69, -89.22], 'America/Tegucigalpa': [14.07, -87.19], 'America/Managua': [12.11, -86.24],
  'America/Costa_Rica': [9.93, -84.08], 'America/Panama': [8.98, -79.52], 'America/Havana': [23.11, -82.37],
  'America/Puerto_Rico': [18.47, -66.11], 'America/Bogota': [4.71, -74.07], 'America/Caracas': [10.48, -66.9],
  'America/Lima': [-12.05, -77.04], 'America/Santiago': [-33.45, -70.67], 'America/Sao_Paulo': [-23.55, -46.63],
  'America/Argentina/Buenos_Aires': [-34.6, -58.38],
  'Europe/London': [51.51, -0.13], 'Europe/Dublin': [53.35, -6.26], 'Europe/Lisbon': [38.72, -9.14],
  'Europe/Madrid': [40.42, -3.7], 'Europe/Paris': [48.86, 2.35], 'Europe/Brussels': [50.85, 4.35],
  'Europe/Amsterdam': [52.37, 4.9], 'Europe/Berlin': [52.52, 13.4], 'Europe/Rome': [41.9, 12.5],
  'Europe/Zurich': [47.38, 8.54], 'Europe/Vienna': [48.21, 16.37], 'Europe/Stockholm': [59.33, 18.07],
  'Europe/Oslo': [59.91, 10.75], 'Europe/Copenhagen': [55.68, 12.57], 'Europe/Warsaw': [52.23, 21.01],
  'Europe/Sarajevo': [43.86, 18.41], 'Europe/Athens': [37.98, 23.73], 'Europe/Sofia': [42.7, 23.32],
  'Europe/Bucharest': [44.43, 26.1], 'Europe/Kyiv': [50.45, 30.52], 'Europe/Kiev': [50.45, 30.52],
  'Europe/Istanbul': [41.01, 28.98], 'Europe/Moscow': [55.76, 37.62],
  'Africa/Casablanca': [33.57, -7.59], 'Africa/Algiers': [36.75, 3.06], 'Africa/Tunis': [36.81, 10.18],
  'Africa/Tripoli': [32.89, 13.19], 'Africa/Cairo': [30.04, 31.24], 'Africa/Khartoum': [15.5, 32.56],
  'Africa/Dakar': [14.72, -17.47], 'Africa/Abidjan': [5.36, -4.01], 'Africa/Accra': [5.6, -0.19],
  'Africa/Lagos': [6.52, 3.38], 'Africa/Addis_Ababa': [9.03, 38.74], 'Africa/Mogadishu': [2.05, 45.32],
  'Africa/Nairobi': [-1.29, 36.82], 'Africa/Johannesburg': [-26.2, 28.05],
  'Asia/Riyadh': [24.71, 46.68], 'Asia/Dubai': [25.2, 55.27], 'Asia/Qatar': [25.29, 51.53],
  'Asia/Kuwait': [29.38, 47.99], 'Asia/Bahrain': [26.23, 50.59], 'Asia/Muscat': [23.59, 58.41],
  'Asia/Aden': [12.79, 45.04], 'Asia/Baghdad': [33.31, 44.36], 'Asia/Tehran': [35.69, 51.39],
  'Asia/Damascus': [33.51, 36.29], 'Asia/Beirut': [33.89, 35.5], 'Asia/Amman': [31.95, 35.93],
  'Asia/Jerusalem': [31.77, 35.21], 'Asia/Baku': [40.41, 49.87], 'Asia/Tbilisi': [41.72, 44.79],
  'Asia/Yerevan': [40.18, 44.51], 'Asia/Karachi': [24.86, 67.01], 'Asia/Kabul': [34.53, 69.17],
  'Asia/Tashkent': [41.3, 69.24], 'Asia/Samarkand': [39.65, 66.96], 'Asia/Dushanbe': [38.56, 68.79],
  'Asia/Almaty': [43.24, 76.95], 'Asia/Kolkata': [22.57, 88.36], 'Asia/Dhaka': [23.81, 90.41],
  'Asia/Kathmandu': [27.72, 85.32], 'Asia/Colombo': [6.93, 79.86], 'Asia/Bangkok': [13.76, 100.5],
  'Asia/Kuala_Lumpur': [3.14, 101.69], 'Asia/Singapore': [1.35, 103.82], 'Asia/Jakarta': [-6.21, 106.85],
  'Asia/Makassar': [-5.15, 119.43], 'Asia/Manila': [14.6, 120.98], 'Asia/Shanghai': [31.23, 121.47],
  'Asia/Hong_Kong': [22.32, 114.17], 'Asia/Seoul': [37.57, 126.98], 'Asia/Tokyo': [35.68, 139.69],
  'Australia/Perth': [-31.95, 115.86], 'Australia/Sydney': [-33.87, 151.21], 'Australia/Melbourne': [-37.81, 144.96],
  'Pacific/Auckland': [-36.85, 174.76],
};

/** The place estimated from a time zone: its main city, or failing that, a longitude from the UTC offset. */
export function zonePlace(zone, offsetMinutes) {
  const city = ZONES[zone];
  if (city) return { lat: city[0], lon: city[1], source: 'zone', label: zone.split('/').pop().replace(/_/g, ' ') };
  return { lat: 25, lon: Math.max(-180, Math.min(180, -offsetMinutes / 4)), source: 'zone', label: 'your time zone' };
}

const round = x => Math.round(x * 100) / 100; // about a kilometre

export function savedPlace() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY));
    if (p && Number.isFinite(p.lat) && Number.isFinite(p.lon)) return { lat: p.lat, lon: p.lon, source: 'device', label: 'your location' };
  } catch { /* storage can be blocked; fall back to the time zone */ }
  return null;
}

export function savePlace(lat, lon) {
  try { localStorage.setItem(KEY, JSON.stringify({ lat: round(lat), lon: round(lon) })); } catch { /* not saved */ }
}

export function forgetPlace() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to forget */ }
}

/** `?at=lat,lon` in the address: a place for testing, never saved. */
export function urlPlace(search) {
  const at = new URLSearchParams(search).get('at');
  const [lat, lon] = (at ?? '').split(',').map(Number);
  return at && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
    ? { lat, lon, source: 'url', label: `${lat}, ${lon}` }
    : null;
}

/** Ask the device for its position, once. Resolves to { lat, lon } rounded to about a kilometre. */
export function locate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('This browser has no location service.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: round(pos.coords.latitude), lon: round(pos.coords.longitude) }),
      err => reject(err),
      { timeout: 15000, maximumAge: 600000 },
    );
  });
}

export function currentPlace() {
  return urlPlace(location.search) ?? savedPlace()
    ?? zonePlace(Intl.DateTimeFormat().resolvedOptions().timeZone, new Date().getTimezoneOffset());
}
