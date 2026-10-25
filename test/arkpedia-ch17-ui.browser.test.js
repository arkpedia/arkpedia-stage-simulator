// SPDX-License-Identifier: GPL-3.0-or-later
// Actual-app controls only, no injected combat state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const chrome = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const enabled = process.env.RENDER_E2E === '1' && existsSync(chrome);
const stageCode = process.env.CH17_QA_STAGE ?? '17-2';
assert.ok(['17-2', '17-3', '17-4', '17-5', '17-6', '17-7', '17-8', '17-9'].includes(stageCode));
const out = process.env.CH17_QA_OUT ?? `/tmp/codex-ch${stageCode}-ui`;
test(`experimental ${stageCode} renders and runs on desktop/phone, rejects public access, and restarts`,
  { skip: enabled ? false : 'set RENDER_E2E=1 with Chrome installed', timeout: 120000 }, async () => {
    const { startServer } = await import('../server/index.js');
    const puppeteer = (await import('puppeteer-core')).default;
    const server = await startServer({ port: 0, host: '127.0.0.1', quiet: true });
    let browser; const errors = [];
    mkdirSync(out, { recursive: true });
    try {
      browser = await puppeteer.launch({ executablePath: chrome, headless: true,
        args: ['--no-first-run', process.platform === 'darwin' ? '--use-angle=metal' : '--use-angle=swiftshader', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
      const base = `http://127.0.0.1:${server.port}/arkpedia/`;
      const denied = await browser.newPage(); denied.on('pageerror', e => errors.push(e.message));
      await denied.goto(`${base}?stage=${stageCode}`, { waitUntil: 'domcontentloaded' });
      await denied.waitForFunction(() => document.body.textContent.includes('This stage is test-only'));
      assert.equal(await denied.$('#start'), null);
      assert.deepEqual(errors, [`Stage ${stageCode} is test-only: open it with ?experimental=1`]);
      errors.length = 0; await denied.close();
      for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 844, height: 390, isMobile: true, hasTouch: true }]]) {
        const page = await browser.newPage(); page.on('pageerror', e => errors.push(e.message));
        await page.setViewport(viewport);
        await page.goto(`${base}?experimental=1&stage=${stageCode}`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#start:not(:disabled)'); await page.click('#start');
        try {
          await page.waitForFunction(() => document.querySelector('#deployment button')
            || (document.querySelector('#prep-error')?.textContent
              && !document.querySelector('#prep-error').textContent.includes('Preparing battlefield')), { timeout: 60000 });
          assert.ok(await page.$('#deployment button'), await page.$eval('#prep-error', e => e.textContent).catch(() => 'Deployment controls missing'));
        } catch (error) {
          await page.screenshot({ path: join(out, `${name}-startup-failure.png`) });
          throw new Error(`Stage startup failed: ${JSON.stringify(errors)}; ${await page.$eval('body', e => e.textContent.slice(-2000))}`, { cause: error });
        }
        assert.ok((await page.$eval('.simulation-label', e => e.textContent)).includes(`Test-only simulation · ${stageCode}`));
        assert.equal(await page.$eval('#stage-actions', e => e.hidden), true);
        await page.click('#speed'); await page.click('#pause');
        await page.waitForFunction(() => document.querySelector('#battle-time')?.textContent >= '0:03');
        await page.click('#pause');
        assert.equal(await page.$eval('#pause', e => e.getAttribute('aria-label')), 'Resume');
        await page.waitForFunction(() => {
          const r = document.querySelector('#pause').getBoundingClientRect();
          return r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
        });
        await page.screenshot({ path: join(out, `${name}-running-paused.png`) });
        await page.click('#settings'); await page.click('#restart');
        await page.waitForFunction(() => document.querySelector('#pause')?.getAttribute('aria-label') === 'Start');
        assert.equal(await page.$eval('#battle-time', e => e.textContent), '0:00');
        if (await page.$eval('#settings', e => e.getAttribute('aria-expanded') === 'true')) await page.click('#settings');
        await page.screenshot({ path: join(out, `${name}-restarted.png`) });
        await page.close();
      }
      assert.deepEqual(errors, []);
      writeFileSync(join(out, 'result.json'), JSON.stringify({ stage: stageCode, testOnly: true, errors,
        checks: ['public rejection', 'real wave clock', 'desktop', 'phone landscape', 'control bounds', 'pause/resume', 'restart', 'absent device commands'] }, null, 2));
    } finally { await browser?.close(); await server.close(); }
  });
