// Take the three 16-fold medallions from the Rosette project (~/Code/rosette, the same author,
// MIT licence) and write their finished tiles to src/rose/data/*.bin.
// Run it only when the medallions change there: `node scripts/import-roses.mjs [path/to/rosette]`.
import { writeFileSync } from 'fs';
import { homedir } from 'os';
import { encodeRose } from '../src/rose/format.js';

const rosette = process.argv[2] ?? `${homedir()}/Code/rosette`;
const designs = [
  ['moorish', 'cutRosette', out => out.tiles],
  ['lee', 'cutRosette', out => out.tiles],
  ['polar', 'rosettePieces', out => out.pieces],
];

for (const [name, cut, tilesOf] of designs) {
  const mod = await import(`${rosette}/src/pattern/rosette16/${name}.js`);
  const ros = mod.buildRosette();
  const tiles = tilesOf(mod[cut](ros));
  const radius = Math.max(...tiles.flatMap(t => t.poly.map(([x, y]) => Math.hypot(x, y))));
  const buf = encodeRose(tiles, radius);
  writeFileSync(new URL(`../src/rose/data/${name}.bin`, import.meta.url), Buffer.from(buf));
  console.log(`${name}: ${tiles.length} tiles, radius ${radius.toFixed(2)}, ${(buf.byteLength / 1024).toFixed(0)} KB`);
}
