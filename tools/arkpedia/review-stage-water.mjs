// SPDX-License-Identifier: GPL-3.0-or-later
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.ARKPEDIA_REVIEW_ORIGIN ?? 'http://127.0.0.1:3184';
const executablePath = process.env.ARKPEDIA_REVIEW_CHROME;
if (!executablePath) throw Error('Set ARKPEDIA_REVIEW_CHROME and start a local preview');
const args = ['--no-sandbox', '--enable-unsafe-swiftshader'];
if (process.env.ARKPEDIA_REVIEW_CA_PINS) args.push(`--ignore-certificate-errors-spki-list=${process.env.ARKPEDIA_REVIEW_CA_PINS}`);
const dir = new URL('../../.cache/arkpedia/stage-water-review/', import.meta.url);
await mkdir(dir, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true, args }), results = [];
try {
  for (const mobile of [false, true]) for (const id of ['cg-5', 'dh-7', 'bol_var']) {
    console.error('Reviewing water', id, mobile ? 'touch' : 'desktop');
    const page = await browser.newPage(), errors = [];
    await page.setViewport({ width: mobile ? 1000 : 1440, height: mobile ? 600 : 900, isMobile: mobile, hasTouch: mobile });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${origin}/arkpedia/?stage=${id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#start:not(:disabled)', { timeout: 60000 });
    await page.evaluate(async () => {
      const { StandardBattle } = await import('/sim/arkpedia.js'), old = StandardBattle.prototype.setViewport;
      StandardBattle.prototype.setViewport = function (...args) { window.reviewBattle = this; return old.apply(this, args); };
    });
    await page.click('#start');
    await page.waitForFunction(() => window.reviewBattle && document.querySelector('#damage'), { timeout: 60000 });
    const state = await page.evaluate(() => {
      const b = window.reviewBattle, water = b.stageWater;
      if (!water) throw Error('Missing water controller');
      const [row, col] = water.spec.tiles[0];
      const enemy = b.spawnEnemy('enemy_1007_slime', { pos: [row, col], countInTotal: false });
      b.addBuff(enemy, { key: 'review:hold', flags: { noMove: true, disarm: true } });
      const hp = enemy.hp;
      for (let i = 0; i < 7; i++) b.step();
      const loss = hp - enemy.hp, contacted = !!enemy.findBuff('stage:water');
      let platform = null;
      if (b.mvpStageTokens.get('trap_040_canoe') > 0) {
        b.addDp('arkpedia', 99);
        const operator = Object.keys(b.bench)[0], before = b.placementError(operator, row, col);
        b.deployToken('trap_040_canoe', row, col);
        const after = b.placementError(operator, row, col);
        for (let i = 0; i < 7; i++) b.step();
        platform = { before, after, stopped: !enemy.findBuff('stage:water') };
      }
      return { tiles: water.tiles.size, loss, contacted, platform, errors: b.errors };
    });
    assert.deepEqual(errors, []); assert.deepEqual(state.errors, []);
    assert.equal(state.contacted, true); assert.equal(state.loss, 40);
    if (state.platform) { assert.match(state.platform.before, /floating platform/); assert.equal(state.platform.after, null); assert.equal(state.platform.stopped, true); }
    await page.screenshot({ path: new URL(`${id}-${mobile ? 'touch' : 'desktop'}.png`, dir).pathname });
    results.push({ id, mobile, diagnosticSpawn: true, ...state }); await page.close();
  }
  await writeFile(new URL('results.json', dir), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
