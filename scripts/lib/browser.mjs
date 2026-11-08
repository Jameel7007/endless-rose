// Headless Chrome on the real GPU (Metal via ANGLE), for screenshots and smoke checks.
// Same approach as the Rosette project: the Playwright cache's Chrome for Testing if present,
// otherwise the installed Google Chrome.
import { existsSync, readdirSync } from 'fs';
import { homedir } from 'os';
import { chromium } from 'playwright-core';

const cache = `${homedir()}/Library/Caches/ms-playwright`;
const found = existsSync(cache) && readdirSync(cache).filter(d => /^chromium-\d+$/.test(d)).sort().pop();
const systemChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const executablePath = process.env.CHROME_PATH
  || (found && `${cache}/${found}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`)
  || (existsSync(systemChrome) ? systemChrome : undefined);

export function launch(opts = {}) {
  return chromium.launch({
    executablePath,
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
    ...opts,
  });
}

/** Collect console errors and warnings, and page errors, into an array. */
export function collectConsole(page) {
  const log = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') log.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => log.push(`[pageerror] ${e.message}`));
  return log;
}

/**
 * Close the guide that opens on a first visit, as a visitor would, with its Begin button (a tap
 * on a touch screen). Returns false when it wasn't open (a later visit in the same browser).
 */
export async function begin(page, { tap = false } = {}) {
  if (!(await page.isVisible('#guide'))) return false;
  await (tap ? page.tap('#begin') : page.click('#begin'));
  await page.waitForSelector('#guide', { state: 'hidden' });
  return true;
}
