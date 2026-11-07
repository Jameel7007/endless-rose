// How the hall is lit for a given sun: the haze, the light from the sky and from the floor,
// the sunlight through the openings and its beams, the lanterns, and the exposure.
// Keyed by the sun's altitude in degrees. Evenings are warmer than mornings at the same height,
// so most colours come in pairs, [morning, evening]. Colours are sRGB; they mix in linear light.

const KEYS = [
  { alt: -90, haze: [0x10141f, 0x10141f], sky: [0x2b3a5c, 0x2b3a5c], ground: [0x1b1715, 0x1b1715], sun: [0x000000, 0x000000], hemi: 0.55, sunI: 0, beam: 0, lantern: 1, exposure: 1.2, fog: 0.026 },
  { alt: -18, haze: [0x10141f, 0x10141f], sky: [0x2b3a5c, 0x2b3a5c], ground: [0x1b1715, 0x1b1715], sun: [0x000000, 0x000000], hemi: 0.55, sunI: 0, beam: 0, lantern: 1, exposure: 1.2, fog: 0.026 },
  { alt: -12, haze: [0x18213a, 0x1d1f38], sky: [0x33446b, 0x3a3d66], ground: [0x1e1a1a, 0x201a1a], sun: [0x000000, 0x000000], hemi: 0.75, sunI: 0, beam: 0, lantern: 1, exposure: 1.18, fog: 0.024 },
  { alt: -6, haze: [0x4c5a80, 0x5a4f78], sky: [0x6c7fae, 0x7b6fa6], ground: [0x3a3232, 0x3d3030], sun: [0x000000, 0x000000], hemi: 1.2, sunI: 0, beam: 0, lantern: 0.85, exposure: 1.12, fog: 0.022 },
  { alt: -1, haze: [0xb9a9b8, 0xc08f86], sky: [0xcdb9c4, 0xd39a86], ground: [0x7a6a66, 0x7c5e52], sun: [0xffb07a, 0xff9a5c], hemi: 1.8, sunI: 0, beam: 0, lantern: 0.55, exposure: 1.1, fog: 0.019 },
  { alt: 3, haze: [0xead0b5, 0xe9b48a], sky: [0xf6e0c6, 0xf3c79a], ground: [0xa8917a, 0xa88a6c], sun: [0xffc08a, 0xffa860], hemi: 2.1, sunI: 2.4, beam: 0.1, lantern: 0.35, exposure: 1.0, fog: 0.018 },
  { alt: 12, haze: [0xefdcc4, 0xf0d3a8], sky: [0xfbead2, 0xfadcb0], ground: [0xbba68d, 0xbda07f], sun: [0xffd7a8, 0xffc888], hemi: 2.4, sunI: 3.2, beam: 0.16, lantern: 0.2, exposure: 1.0, fog: 0.017 },
  { alt: 25, haze: [0xeee3d1, 0xefdfc6], sky: [0xfff3e2, 0xfdebd2], ground: [0xc9bca8, 0xc8b79c], sun: [0xffe6c4, 0xffdcb4], hemi: 2.5, sunI: 3.8, beam: 0.14, lantern: 0.15, exposure: 1.0, fog: 0.017 },
  { alt: 90, haze: [0xf0eadf, 0xf0eadf], sky: [0xfff8ee, 0xfff8ee], ground: [0xcfc4b4, 0xcfc4b4], sun: [0xfff1dc, 0xfff1dc], hemi: 2.6, sunI: 4.0, beam: 0.12, lantern: 0.12, exposure: 1.0, fog: 0.017 },
];

const toLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linear = hex => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map(v => toLinear(v / 255));
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const COLOURS = ['haze', 'sky', 'ground', 'sun'];
const NUMBERS = ['hemi', 'sunI', 'beam', 'lantern', 'exposure', 'fog'];

/**
 * The look for a sun at `altitude` degrees. `evening` runs from 0 (morning) to 1 (evening).
 * Colours come back as linear RGB triples.
 */
export function lookAt(altitude, evening) {
  const a = Math.max(-90, Math.min(90, altitude));
  let i = 0;
  while (i < KEYS.length - 2 && a > KEYS[i + 1].alt) i++;
  const k0 = KEYS[i];
  const k1 = KEYS[i + 1];
  const t = (a - k0.alt) / (k1.alt - k0.alt);
  const out = {};
  for (const c of COLOURS) {
    const at = k => mix3(linear(k[c][0]), linear(k[c][1]), evening);
    out[c] = mix3(at(k0), at(k1), t);
  }
  for (const n of NUMBERS) out[n] = mix(k0[n], k1[n], t);
  return out;
}

/** Luminance of a linear RGB triple. */
export const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
