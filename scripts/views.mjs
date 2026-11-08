// Screenshots of the key views, each reached by real input on a cold load (dev server on :5197).
//   node scripts/views.mjs [day] [arrive] [phone]     (all three when none is named)
// day: the nave around each of today's prayer times, read from the Light panel.
// arrive: the approach and the arrival under the dome's rose, at noon and at night.
// phone: the phone layout by day and by night, with the Light panel open.
// They go to capture/views/. Not run by default:
// readme: clean JPEGs with no words on screen, for the README (docs/readme/) and the link
// preview (public/og.jpg).
// colour: the colour layers compared, each alone, none and all, in the same two views, with a
// labelled sheet of each view (capture/views/colour-*.png). T=14:30 sets the hour.
import { mkdirSync, readFileSync } from 'fs';
import { begin, collectConsole, launch } from './lib/browser.mjs';

const url = 'http://localhost:5197/';
const out = new URL('../capture/views/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const want = process.argv.slice(2);
const run = name => (want.length === 0 && !['readme', 'colour'].includes(name)) || want.includes(name);
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
  await begin(page);
  await page.click('#light');
  await page.waitForFunction(() => document.querySelector('#times time')?.textContent);
  const times = Object.fromEntries(await page.$$eval('#times li', lis => lis.map(li => [li.dataset.p, li.querySelector('time').textContent])));
  const moments = { fajr: clock(times.fajr) + 15, morning: clock(times.sunrise) + 150, dhuhr: clock(times.dhuhr) + 10,
    asr: clock(times.asr) + 40, maghrib: clock(times.maghrib) + 8, isha: clock(times.isha) + 60 };
  for (const [name, t] of Object.entries(moments)) {
    await page.goto(`${url}?t=${hhmm(t)}`);
    await page.waitForSelector('html[data-ready="1"]');
    await begin(page);
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
    await begin(page);
    await page.mouse.move(640, 400);
    await count(page, 26);
    await settle(page);
    await page.screenshot({ path: `${out}arrive-${tag}-26.png` });
    await count(page, 6);
    await settle(page);
    await page.screenshot({ path: `${out}arrive-${tag}-32.png` });
    await count(page, 1);
    await settle(page);
    await page.waitForTimeout(6000); // the camera turns up to the rose
    await page.screenshot({ path: `${out}arrive-${tag}-33.png` });
    const r = await page.evaluate(() => window.__hall.rose);
    const v = await page.evaluate(() => window.__hall.view);
    console.log(`arrive at ${t}: ${r.name}, laid ${r.laid.toFixed(3)}, view up ${(v.pitch * 180 / Math.PI).toFixed(1)}°, fov ${v.fov.toFixed(1)}°`);
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
    await begin(page, { tap: true });
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
  const clean = page => page.addStyleTag({ content: '.top, .dhikr, .panel, .veil { display: none !important; }' });
  const shoot = async (w, h, t, counts, file, quality = 84) => {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    logs.push(collectConsole(page));
    await page.goto(`${url}?t=${t}`);
    await page.waitForSelector('html[data-ready="1"]');
    await begin(page);
    await clean(page); // before arriving, so the dome shot is framed for the whole picture
    await page.mouse.move(w / 2, h / 2);
    if (counts) {
      await count(page, counts);
      await settle(page);
      if (counts === 33) await page.waitForTimeout(6500); // the camera turns up to the rose
    }
    await page.waitForTimeout(1200);
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

if (run('colour')) {
  const variants = [['none', 'As it is'], ['arches', 'Arches: voussoirs, marble'], ['floor', 'Floor: prayer carpets'],
    ['walls', 'Walls: frieze, dado, mihrab'], ['light', 'Light: stained glass'], ['ceiling', 'Ceiling: painted cedar'], ['all', 'All together']];
  const t = process.env.T ?? '14:30';
  const views = { field: { counts: 5, look: [1010, 330] }, approach: { counts: 27, look: [640, 380] } };
  for (const [view, { counts, look }] of Object.entries(views)) {
    const files = [];
    for (const [colour, label] of variants) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      logs.push(collectConsole(page));
      await page.goto(`${url}?t=${t}&colour=${colour}`);
      await page.waitForSelector('html[data-ready="1"]');
      await begin(page);
      await page.mouse.move(640, 400);
      await count(page, counts);
      await settle(page);
      await page.mouse.move(...look);
      await page.waitForTimeout(2600);
      await page.addStyleTag({ content: '.top, .dhikr, .veil { display: none !important; }' });
      const file = `${out}colour-${view}-${colour}.png`;
      await page.screenshot({ path: file });
      files.push([file, label]);
      await page.close();
    }
    // One sheet per view, the variants side by side, three to a row.
    const sheet = await browser.newPage({ viewport: { width: 1920, height: 400 } });
    const cells = files.map(([f, label]) => `<figure><img src="data:image/png;base64,${readFileSync(f).toString('base64')}"><figcaption>${label}</figcaption></figure>`).join('');
    await sheet.setContent(`<style>body{margin:0;background:#1b1714;font:15px/1.3 system-ui;color:#efe6d6}
      main{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:14px}figure{margin:0}
      img{width:100%;display:block;border-radius:6px}figcaption{padding:6px 2px 0}</style><main>${cells}</main>`);
    await sheet.screenshot({ path: `${out}colour-${view}.png`, fullPage: true });
    await sheet.close();
    console.log(`colour-${view}.png`);
  }
}

await browser.close();
const log = logs.flat();
console.log(log.length ? log : 'no console errors');
process.exit(log.length ? 1 : 0);
