// Smoke check on a cold load, driven only by real input: clicks, keys, taps and swipes.
// It reads the dev build's window.__hall to measure what the input did; it never drives it.
// Usage: npm run smoke  (dev server on :5197)   or   npm run smoke -- --url http://host:port/
// Screenshots go to capture/smoke/.
import { mkdirSync } from 'fs';
import { collectConsole, launch } from './lib/browser.mjs';

const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const url = arg('--url') ?? 'http://localhost:5197/';
const dir = new URL('../capture/smoke/', import.meta.url).pathname;
mkdirSync(dir, { recursive: true });

const BAY = 3.2;
let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? '✔' : '✖'} ${name}${detail ? `  (${detail})` : ''}`);
};
const ready = page => page.waitForSelector('html[data-ready="1"]', { timeout: 20000 });
const state = page => page.evaluate(() => window.__hall.state);
const shown = page => page.textContent('#n');
const settle = (page, timeout = 10000) => page.waitForFunction(() => {
  const s = window.__hall.state;
  return Math.abs(s.d - s.target) < 0.005 && s.fade === 0;
}, null, { timeout, polling: 100 });
// Buttons hide their jump in a wash of light: wait for it to start, then for everything to settle.
const afterFade = async page => {
  await page.waitForFunction(() => window.__hall.state.fade > 0, null, { timeout: 3000, polling: 'raf' });
  await settle(page);
};
const shot = (page, name) => page.screenshot({ path: `${dir}${name}.png` });

const browser = await launch();

// ---- Desktop: mouse and keyboard -------------------------------------------------------
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const log = collectConsole(page);
  await page.goto(url);
  await ready(page);
  await page.mouse.move(640, 400);
  await page.waitForTimeout(800);
  await shot(page, '01-start');

  const fps = await page.evaluate(() => new Promise(done => {
    let n = 0;
    const t0 = performance.now();
    const tick = () => (performance.now() - t0 < 2000 ? (n++, requestAnimationFrame(tick)) : done(n / 2));
    requestAnimationFrame(tick);
  }));
  check('renders smoothly', fps >= 50, `${fps.toFixed(0)} fps at 1280×800`);

  for (let i = 0; i < 5; i++) {
    await page.mouse.click(640, 400);
    await page.waitForTimeout(200);
  }
  await settle(page);
  let s = await state(page);
  check('five clicks count five', s.count === 5 && (await shown(page)) === '5', `count ${s.count}, shown ${await shown(page)}`);
  check('and move five bays', Math.abs(s.d - 5 * BAY) < 0.01, `d ${s.d.toFixed(3)} m`);

  for (let i = 5; i < 33; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(40);
  }
  await settle(page, 15000);
  s = await state(page);
  check('Space counts to 33', s.count === 33 && (await shown(page)) === '33');
  check('the 33rd count stops under the dome', s.d > 32 * BAY && s.d < 32.5 * BAY + 8, `d ${s.d.toFixed(2)} m`);
  check('the gloss names the next phrase', (await page.textContent('#gloss')) === 'Next: Alhamdulillah');
  await shot(page, '02-arrived');

  await page.mouse.move(640, 2);
  await page.waitForTimeout(2500);
  s = await state(page);
  check('the pointer at the top looks up', s.pitch > 0.25, `pitch ${s.pitch.toFixed(2)} rad`);
  await shot(page, '03-dome');

  await page.mouse.move(640, 400);
  await page.keyboard.press('Space');
  await settle(page);
  s = await state(page);
  check('count 34 starts a new approach', s.count === 34 && Math.abs(s.d - BAY) < 0.01, `d ${s.d.toFixed(3)} m`);
  check('with the next phrase', (await page.textContent('#phrase')) === 'Alhamdulillah' && (await shown(page)) === '1');

  await page.mouse.move(1279, 430);
  await page.waitForTimeout(2500);
  s = await state(page);
  check('the pointer at the right edge turns the head right', s.yaw < -0.4, `yaw ${s.yaw.toFixed(2)} rad`);
  await shot(page, '04-side');

  await page.click('[data-mode="ahead"]');
  await afterFade(page);
  s = await state(page);
  check('the Ahead button switches mode', s.mode === 'ahead' && (await page.getAttribute('[data-mode="ahead"]', 'aria-pressed')) === 'true');
  const before = s.d;
  await page.mouse.move(640, 400);
  for (let i = 0; i < 3; i++) await page.keyboard.press('Enter');
  await settle(page);
  s = await state(page);
  check('Enter counts in ahead mode, one bay each', s.count === 37 && Math.abs(s.d - before - 3 * BAY) < 0.01);
  await shot(page, '05-ahead');

  await page.click('#reset');
  await afterFade(page);
  s = await state(page);
  check('Reset goes back to zero', s.count === 0 && s.d === 0 && (await shown(page)) === '0');
  await page.keyboard.press('Space');
  await settle(page);
  check('Space counts again after clicking a button', (await state(page)).count === 1);
  check('no console errors on desktop', log.length === 0, log.join(' | '));
  await page.close();
}

// ---- Phone: taps and swipes --------------------------------------------------------------
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  const log = collectConsole(page);
  await page.goto(url);
  await ready(page);
  await page.waitForTimeout(800);
  await shot(page, '06-phone');
  for (let i = 0; i < 3; i++) {
    await page.touchscreen.tap(195, 420);
    await page.waitForTimeout(150);
  }
  await settle(page);
  let s = await state(page);
  check('three taps count three', s.count === 3 && (await shown(page)) === '3');

  const cdp = await ctx.newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await touch('touchStart', 120, 420);
  for (let x = 120; x <= 300; x += 15) {
    await touch('touchMove', x, 420);
    await page.waitForTimeout(16);
  }
  await touch('touchEnd');
  await page.waitForTimeout(1500);
  s = await state(page);
  check('a swipe turns the head and does not count', s.count === 3 && s.yaw > 0.3, `yaw ${s.yaw.toFixed(2)} rad, count ${s.count}`);
  await shot(page, '07-phone-swipe');
  check('no console errors on the phone', log.length === 0, log.join(' | '));
  await ctx.close();
}

await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
