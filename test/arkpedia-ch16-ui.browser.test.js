// SPDX-License-Identifier: GPL-3.0-or-later
// Opt in: RENDER_E2E=1 node --test test/arkpedia-ch16-ui.browser.test.js
// Uses the actual app, natural SP and keyboard input; no injected battle state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const chrome = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const enabled = process.env.RENDER_E2E === '1' && existsSync(chrome);
const stageCode = process.env.CH16_QA_STAGE ?? '16-3';
if (!['16-3', '16-4', '16-5', '16-6', '16-7', '16-8', '16-10', '16-11', '16-14', '16-15'].includes(stageCode)) throw Error('Only reviewed test-only tunnel stages may run this QA');
const out = process.env.CH16_QA_OUT ?? '/tmp/codex-ch16-ui';

test(`test-only ${stageCode} tunnel command works with natural SP, keyboard, mobile layout and restart`,
  { skip: enabled ? false : 'set RENDER_E2E=1 with Chrome installed', timeout: 120000 }, async () => {
    const { startServer } = await import('../server/index.js');
    const puppeteer = (await import('puppeteer-core')).default;
    const server = await startServer({ port: 0, host: '127.0.0.1', quiet: true });
    let browser;
    const errors = [];
    mkdirSync(out, { recursive: true });
    try {
      browser = await puppeteer.launch({ executablePath: chrome, headless: true, dumpio: process.env.CI === 'true',
        // Hosted startup logs show DevTools appearing just after 30 seconds.
        // Bound process startup separately; gameplay waits/assertions stay fixed.
        timeout: process.env.CI === 'true' ? 60000 : 30000,
        args: ['--no-first-run', process.platform === 'darwin' ? '--use-angle=metal' : '--use-angle=swiftshader', '--enable-gpu', '--ignore-gpu-blocklist',
          '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
      let page = await browser.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: 1440, height: 900 });
      const base = `http://127.0.0.1:${server.port}/arkpedia/`;
      await page.goto(`${base}?stage=${stageCode}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.body.textContent.includes('This stage is test-only'));
      assert.equal(await page.$('#start'), null);
      await page.waitForFunction(() => document.readyState === 'complete');
      assert.deepEqual(errors, [`Stage ${stageCode} is test-only: open it with ?experimental=1`]);
      errors.length = 0;
      await page.goto(`${base}?experimental=1&stage=${stageCode}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#start'); await page.click('#start');
      await page.waitForSelector('#stage-actions button', { timeout: 60000 });
      assert.match(await page.$eval('.simulation-label', e => e.textContent), /Test-only/);
      const command = '#stage-actions button';
      assert.equal(await page.$$eval(command, es => es.length), ['16-5', '16-15'].includes(stageCode) ? 2 : 1);
      if (stageCode === '16-5') {
        const labels = await page.$$eval(command, es => es.map(e => e.textContent));
        assert.ok(labels[0].includes('Lower Hidden Tunnel')); assert.ok(labels[1].includes('Upper Hidden Tunnel'));
      }
      const initial = await page.$eval(command, e => e.textContent);
      assert.match(initial, /0 waiting/); assert.match(initial, /0\/15 SP/);
      await page.click(command);
      assert.equal(await page.$eval(command, e => e.getAttribute('aria-pressed')), 'false');
      await page.screenshot({ path: join(out, 'desktop-charging.png') });

      async function chargeAndCommand(touch = false) {
        await page.click('#speed');
        await page.click('#pause');
        try {
          await page.waitForFunction(() => document.querySelector('#stage-actions button')?.getAttribute('aria-disabled') === 'false', { timeout: 45000 });
        } catch (error) {
          await page.screenshot({ path: join(out, 'charge-timeout.png') });
          throw new Error(`Natural SP did not become ready (page errors: ${JSON.stringify(errors)}): ${await page.$eval('.workspace', e => e.textContent)}`, { cause: error });
        }
        await page.click('#pause');
        assert.match(await page.$eval(command, e => e.textContent), /1 waiting/);
        const before = await page.$eval(command, e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
        if (touch) await page.tap(command);
        else { await page.focus(command); await page.keyboard.press('Enter'); }
        assert.equal(await page.$eval(command, e => e.getAttribute('aria-pressed')), 'true');
        if (!touch) assert.equal(await page.$eval(command, e => document.activeElement === e), true);
        assert.match(await page.$eval(command, e => e.textContent), /0 waiting/);
        if (['16-5','16-15'].includes(stageCode)) {
          const other = (await page.$$(command))[1];
          assert.equal(await other.evaluate(e => e.getAttribute('aria-pressed')), 'false');
          assert.match(await other.evaluate(e => e.textContent), /1 waiting/);
          assert.match(await other.evaluate(e => e.textContent), /15\/15 SP/);
        }
        assert.match(await page.$eval(command, e => e.textContent), /0\/15 SP/);
        assert.deepEqual(await page.$eval(command, e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }), before);
      }
      await chargeAndCommand();
      await page.screenshot({ path: join(out, 'desktop-commanded.png') });
      await page.close();
      page = await browser.newPage();
      page.on('pageerror', e => errors.push(e.message));
      await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true });
      await page.goto(`${base}?experimental=1&stage=${stageCode}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#start'); await page.tap('#start');
      await page.waitForSelector('#stage-actions button', { timeout: 60000 });
      await page.waitForFunction(() => {
        return [...document.querySelectorAll('#stage-actions button')].every(e => {
          const r = e.getBoundingClientRect(); return r.x >= 0 && r.right <= innerWidth && r.y >= 0 && r.bottom <= innerHeight;
        });
      });
      await chargeAndCommand(true);
      await page.screenshot({ path: join(out, 'phone-commanded.png') });
      await page.click('#settings'); await page.click('#restart');
      await page.waitForFunction(() => document.querySelector('#stage-actions button')?.getAttribute('aria-pressed') === 'false');
      assert.match(await page.$eval(command, e => e.textContent), /0 waiting/);
      await chargeAndCommand(true);
      await page.screenshot({ path: join(out, 'phone-restarted-commanded.png') });
      assert.deepEqual(errors, []);
      writeFileSync(join(out, 'result.json'), JSON.stringify({ stage: stageCode, testOnly: true, errors,
        checks: ['public rejection', 'natural SP', 'owner queue release', 'keyboard', 'stable focus and bounds', 'desktop', 'phone landscape', 'restart'] }, null, 2));
    } finally { await browser?.close(); await server.close(); }
  });
