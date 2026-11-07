// Screenshots of the key views, each reached by real input on a cold load (dev server on :5197).
//   node scripts/views.mjs [day] [arrive] [phone]     (all three when none is named)
// day: the nave around each of today's prayer times, read from the Light panel.
// arrive: the approach and the arrival under the dome's rose, at noon and at night.
// phone: the phone layout by day and by night, with the Light panel open.
// They go to capture/views/. Not run by default:
// readme: clean JPEGs with no words on screen, for the README (docs/readme/) and the link
// preview (public/og.jpg).
import { mkdirSync } from 'fs';
import { collectConsole, launch } from './lib/browser.mjs';

const url = 'http://localhost:5197/';
const out = new URL('../capture/views/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const want = process.argv.slice(2);
const run = name => (want.length === 0 && name !== 'readme') || want.includes(name);
const settle = page => page.waitForFunction(() => {
  const s = window.__hall.state;
  return Math.abs(s.d - s.target) < 0.005 && s.fade === 0;
}, null, { timeout: 30000, polling: 100 });
const count = async (page, n) => {
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(25);
  }
};
const clock = text => { // '05:22 AM' or '17:22' → minutes after midnight
  let [h, m] = text.replace(/\s*[AP]M$/i, '').split(':').map(Number);
  if (/PM$/i.test(text) && h < 12) h += 12;
  if (/AM$/i.test(text) && h === 12) h = 0;
  return h * 60 + m;
};
const hhmm = t => { t = ((t % 1440) + 1440) % 1440; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };

const browser = await launch();
const logs = [];

if (run('day')) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  logs.push(collectConsole(page));
  await page.goto(url);
  await page.waitForSelector('html[data-ready="1"]');
  await page.click('#light');
  await page.waitForFunction(() => document.querySelector('#times time')?.textContent);
  const times = Object.fromEntries(await page.$$eval('#times li', lis => lis.map(li => [li.dataset.p, li.querySelector('time').textContent])));
  const moments = { fajr: clock(times.fajr) + 15, morning: clock(times.sunrise) + 150, dhuhr: clock(times.dhuhr) + 10,
    asr: clock(times.asr) + 40, maghrib: clock(times.maghrib) + 8, isha: clock(times.isha) + 60 };
  for (const [name, t] of Object.entries(moments)) {
    await page.goto(`${url}?t=${hhmm(t)}`);
    await page.waitForSelector('html[data-ready="1"]');
    await page.mouse.move(640, 400);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}day-${name}.png` });
    console.log(`day-${name} at ${hhmm(t)}: ${await page.textContent('#status')}`);
  }
  await page.close();
}

if (run('arrive')) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  logs.push(collectConsole(page));
  for (const t of ['12:30', '21:00']) {
    const tag = t.replace(':', '');
    await page.goto(`${url}?t=${t}`);
    await page.waitForSelector('html[data-ready="1"]');
    await page.mouse.move(640, 400);
    await count(page, 26);
    await settle(page);
    await page.screenshot({ path: `${out}arrive-${tag}-26.png` });
    await count(page, 6);
    await settle(page);
    await page.screenshot({ path: `${out}arrive-${tag}-32.png` });
    await count(page, 1);
    await settle(page);
    await page.waitForTimeout(6000); // the gaze rises to the rose
    await page.screenshot({ path: `${out}arrive-${tag}-33.png` });
    const r = await page.evaluate(() => window.__hall.rose);
    console.log(`arrive at ${t}: ${r.name}, laid ${r.laid.toFixed(3)}, tilt ${(await page.evaluate(() => window.__hall.state.tilt)).toFixed(2)} rad`);
  }
  await page.close();
}

if (run('phone')) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  logs.push(collectConsole(page));
  for (const t of ['09:30', '19:40']) {
    const tag = t.replace(':', '');
    await page.goto(`${url}?t=${t}`);
    await page.waitForSelector('html[data-ready="1"]');
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${out}phone-${tag}.png` });
    await page.tap('#light');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}phone-${tag}-panel.png` });
  }
  await ctx.close();
}

if (run('readme')) {
  const docs = new URL('../docs/readme/', import.meta.url).pathname;
  const clean = page => page.addStyleTag({ content: '.top, .dhikr, .panel { display: none !important; }' });
  const shoot = async (w, h, t, counts, file, quality = 84) => {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    logs.push(collectConsole(page));
    await page.goto(`${url}?t=${t}`);
    await page.waitForSelector('html[data-ready="1"]');
    await page.mouse.move(w / 2, h / 2);
    if (counts) {
      await count(page, counts);
      await settle(page);
      if (counts === 33) await page.waitForTimeout(6500); // the gaze rises to the rose
    }
    await page.waitForTimeout(1200);
    await clean(page);
    await page.screenshot({ path: file, type: 'jpeg', quality });
    await page.close();
    console.log(file.split('/').slice(-2).join('/'));
  };
  await shoot(1600, 1000, '16:15', 0, `${docs}asr.jpg`);
  await shoot(1600, 1000, '12:30', 33, `${docs}rose.jpg`);
  await shoot(1600, 1000, '20:15', 0, `${docs}isha.jpg`);
  await shoot(1600, 1000, '12:31', 28, `${docs}noon.jpg`);
  await shoot(1200, 630, '16:15', 33, new URL('../public/og.jpg', import.meta.url).pathname, 86);
}

await browser.close();
const log = logs.flat();
console.log(log.length ? log : 'no console errors');
process.exit(log.length ? 1 : 0);
