// The rose in the dome: one of three 16-fold medallions in one of six colourways, drawn into two
// textures, the glazes and the laying order. The dome's shader shows a tile once the laying has
// reached its place in the order, so the rose is laid as you walk the nave, rim first, and its
// crown is set as you arrive. Each round brings the next rose; each day starts at a different one.
import * as THREE from 'three';
import { KEYS, decodeRose, layingOrder } from './format.js';

export const DESIGNS = ['moorish', 'lee', 'polar'];
const FILES = {
  moorish: new URL('./data/moorish.bin', import.meta.url),
  lee: new URL('./data/lee.bin', import.meta.url),
  polar: new URL('./data/polar.bin', import.meta.url),
};

// Glazes for the keys W K B T G O R A (white, black, lapis, turquoise, green, ochre, terracotta,
// gold), and the mortar between the tiles. Fez is the Rosette project's own palette.
export const COLOURWAYS = [
  { name: 'Fez', grout: '#cfc4b0', W: '#e4d9c2', K: '#1f1a19', B: '#1a3473', T: '#1b716e', G: '#29583f', O: '#a8721f', R: '#8e3f2b', A: '#d3a64e' },
  { name: 'Alhambra', grout: '#d8ccb4', W: '#ece2cc', K: '#1d2b26', B: '#2b4a7c', T: '#3c8c7e', G: '#2f6b45', O: '#c08b33', R: '#9e4b2f', A: '#dcb46a' },
  { name: 'Isfahan', grout: '#d6ccb8', W: '#f0e8d6', K: '#142a4c', B: '#1f4f9e', T: '#2a9a94', G: '#2c7a58', O: '#d1a02a', R: '#a0412f', A: '#e3c47a' },
  { name: 'Córdoba', grout: '#d2c2a4', W: '#efe1c4', K: '#3b2016', B: '#2d3f6c', T: '#3a7d77', G: '#5b6c31', O: '#b88029', R: '#9c3023', A: '#d9b25c' },
  { name: 'Night', grout: '#c9bfaa', W: '#ddd4c0', K: '#131a35', B: '#263a75', T: '#2e6f8c', G: '#2b4f4b', O: '#b5853a', R: '#713040', A: '#e4c172' },
  { name: 'Marrakech', grout: '#d4c8b0', W: '#ede4ce', K: '#1a2b21', B: '#29506e', T: '#2b7c68', G: '#1f6c46', O: '#bb8c2c', R: '#8f3c2b', A: '#d8b25c' },
];

/**
 * Which rose comes `index`-th: the design changes every round, and the colourways turn so that
 * all 18 pairings come once in every 18 rounds.
 */
export function roseFor(index) {
  const i = ((index % 18) + 18) % 18;
  return { design: DESIGNS[i % 3], colourway: COLOURWAYS[(i % 6 + Math.floor(i / 6)) % 6] };
}

/** Days since 1970 in local time: the first rose of the day. */
export const dayIndex = (ms = Date.now()) => Math.floor((ms - new Date(ms).getTimezoneOffset() * 60000) / 86400000);

// Small, steady differences from tile to tile, as in real zellige.
function shade(hex, j) {
  const n = parseInt(hex.slice(1), 16);
  const f = 1 + j;
  const c = x => Math.max(0, Math.min(255, Math.round(x * f)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

export class Roses {
  constructor(size, anisotropy = 1) {
    this.size = size;
    const canvas = () => Object.assign(document.createElement('canvas'), { width: size, height: size });
    this.colourCanvas = canvas();
    this.orderCanvas = canvas();
    // Until a rose is drawn every texel is "never": 255, past the last tile's 254.
    const o = this.orderCanvas.getContext('2d');
    o.fillStyle = '#ff0000';
    o.fillRect(0, 0, size, size);
    this.colour = new THREE.CanvasTexture(this.colourCanvas);
    this.colour.colorSpace = THREE.SRGBColorSpace;
    this.colour.anisotropy = anisotropy;
    this.order = new THREE.CanvasTexture(this.orderCanvas);
    this.order.magFilter = this.order.minFilter = THREE.NearestFilter;
    this.order.generateMipmaps = false;
    this.roses = {};
    this.shown = null;
    this.ready = Promise.all(DESIGNS.map(async d => {
      const rose = decodeRose(await (await fetch(FILES[d])).arrayBuffer());
      this.roses[d] = { rose, order: layingOrder(rose) };
    }));
  }

  /** Draw the `index`-th rose into the textures (once its tiles have loaded). */
  async show(index) {
    this.wanted = index;
    await this.ready;
    if (this.wanted !== index || this.shown === index) return;
    const { design, colourway } = roseFor(index);
    const { rose, order } = this.roses[design];
    const s = this.size;
    const k = s / 2 / rose.radius; // medallion units → pixels; the medallion's rim is the dome's rim
    const c = this.colourCanvas.getContext('2d');
    const o = this.orderCanvas.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    o.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = colourway.grout;
    c.fillRect(0, 0, s, s);
    o.fillStyle = '#ff0000';
    o.fillRect(0, 0, s, s);
    c.setTransform(k, 0, 0, k, s / 2, s / 2);
    o.setTransform(k, 0, 0, k, s / 2, s / 2);
    o.lineWidth = 0.3; // wider than the grout gap, so mortar is laid with the tiles beside it
    o.lineJoin = 'round';
    let seed = index * 7919 + 17;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const paths = [];
    for (let i = 0; i < rose.keys.length; i++) {
      const path = new Path2D();
      for (let p = rose.starts[i]; p < rose.starts[i + 1]; p++) {
        if (p === rose.starts[i]) path.moveTo(rose.xy[2 * p], rose.xy[2 * p + 1]);
        else path.lineTo(rose.xy[2 * p], rose.xy[2 * p + 1]);
      }
      path.closePath();
      paths.push(path);
      c.fillStyle = shade(colourway[KEYS[rose.keys[i]]], (rand() - 0.5) * 0.12);
      c.fill(path);
    }
    // The laying order in the red channel: all the wide outlines first, then every tile over
    // them, so an outline only ever fills the mortar and never eats into a neighbouring tile.
    const step = i => `rgb(${Math.round(order[i] * 254)},0,0)`;
    paths.forEach((path, i) => { o.strokeStyle = step(i); o.stroke(path); });
    paths.forEach((path, i) => { o.fillStyle = step(i); o.fill(path); });
    this.colour.needsUpdate = true;
    this.order.needsUpdate = true;
    this.shown = index;
    this.name = `${design[0].toUpperCase()}${design.slice(1)} rose · ${colourway.name}`;
  }
}
