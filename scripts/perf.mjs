// Frame rate with the frame limit off (vsync and Chrome's limit disabled), at a few canvas sizes,
// looking down the nave and sideways. Each frame reads one pixel back, so the GPU can't run ahead.
// Usage: node scripts/perf.mjs   (dev server on :5197)
import { begin, launch } from './lib/browser.mjs';

const browser = await launch({
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
for (const [w, h, dpr, label] of [[1280, 800, 1, 'laptop 1x'], [1280, 800, 2, 'laptop retina 2x'], [390, 844, 2, 'phone 2x']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:5197/?t=${process.env.T ?? '12:30'}`);
  await page.waitForSelector('html[data-ready="1"]');
  await begin(page);
  const fps = () => page.evaluate(() => new Promise(done => {
    const gl = window.__hall.renderer.getContext();
    const px = new Uint8Array(4);
    let n = 0;
    const t0 = performance.now();
    const tick = () => {
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      n++;
      if (performance.now() - t0 < 3000) requestAnimationFrame(tick);
      else done(n / 3);
    };
    requestAnimationFrame(tick);
  }));
  await page.waitForTimeout(1000);
  const ahead = await fps();
  await page.mouse.move(w - 1, h / 2);
  await page.waitForTimeout(2500);
  const side = await fps();
  const info = await page.evaluate(() => {
    const r = window.__hall.renderer.info.render;
    return `${r.calls} draw calls, ${(r.triangles / 1000).toFixed(0)}k triangles, ratio ${window.__hall.ratio}`;
  });
  console.log(`${label.padEnd(18)} ${w * dpr}×${h * dpr}px  ahead ${ahead.toFixed(0)} fps, side ${side.toFixed(0)} fps  (${info})`);
  await ctx.close();
}
await browser.close();
