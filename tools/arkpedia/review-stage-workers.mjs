// SPDX-License-Identifier: GPL-3.0-or-later
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.ARKPEDIA_REVIEW_ORIGIN ?? 'http://127.0.0.1:3184';
const executablePath = process.env.ARKPEDIA_REVIEW_CHROME;
if (!executablePath) throw Error('Set ARKPEDIA_REVIEW_CHROME.');
const out = new URL('../../.cache/arkpedia/stage-worker-review/', import.meta.url);
await mkdir(out, { recursive: true });
const args = ['--no-sandbox', '--enable-unsafe-swiftshader'];
if (process.env.ARKPEDIA_REVIEW_CA_PINS) args.push(`--ignore-certificate-errors-spki-list=${process.env.ARKPEDIA_REVIEW_CA_PINS}`);
const browser = await puppeteer.launch({ executablePath, headless: true, args }), results = [];
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewport({ width: mobile ? 1000 : 1440, height: mobile ? 600 : 900, isMobile: mobile, hasTouch: mobile });
    await page.goto(`${origin}/arkpedia/?stage=ri-3`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#start:not(:disabled)', { timeout: 60000 });
    await page.evaluate(async () => {
      const { StandardBattle } = await import('/sim/arkpedia.js'), original = StandardBattle.prototype.setViewport;
      StandardBattle.prototype.setViewport = function (...args) { window.reviewBattle = this; return original.apply(this, args); };
    });
    await page.click('#start');
    await page.waitForFunction(() => window.reviewBattle && document.querySelector('[data-token="trap_016_peon"]'), { timeout: 60000 });
    await page.evaluate(() => { reviewBattle.autoFinish = false; reviewBattle.life = 999;
      while (reviewBattle.dp < 6) reviewBattle.step(); });
    await page.click('[data-token="trap_016_peon"]');
    await page.click('.tile-hit[aria-label$="row 2, column 4"]');
    await page.screenshot({ path: new URL(`${mobile ? 'touch' : 'desktop'}-placement.png`, out).pathname });
    await page.waitForSelector('[data-facing="UP"]', { visible: true });
    await page.click('[data-facing="UP"]');
    await page.waitForFunction(() => reviewBattle.units.some(u => u.mem.stageSupplyToken === 'trap_016_peon'));
    const before = await page.evaluate(() => {
      const b = reviewBattle, u = b.units.find(u => u.mem.stageSupplyToken === 'trap_016_peon');
      return { row: u.tileR, col: u.tileC, dir: u.dir, stock: b.mvpStageTokens.get('trap_016_peon'), hp: u.hp };
    });
    assert.deepEqual(before, { row: 1, col: 3, dir: 'UP', stock: 7, hp: 100 });
    const state = await page.evaluate(() => {
      const b = reviewBattle, tree = b.units.find(u => u.tags.has('tree') && u.tileR === 2 && u.tileC === 3);
      const worker = b.units.find(u => u.mem.stageSupplyToken === 'trap_016_peon');
      for (let i = 0; i < 280; i++) b.step();
      return { treeCleared: !tree.alive, workerWithdrawn: !worker.alive, attacks: worker.stats.attacks,
        tile: b.grid.tile(2, 3), occupied: b.allyUnits.some(u => u.alive && u.tileR === 2 && u.tileC === 3), errors: b.errors };
    });
    assert.equal(state.treeCleared, true); assert.equal(state.workerWithdrawn, true); assert.equal(state.attacks, 8);
    assert.equal(state.tile.build, 'RANGED'); assert.equal(state.occupied, false); assert.deepEqual(state.errors, []);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: new URL(`${mobile ? 'touch' : 'desktop'}.png`, out).pathname });
    assert.deepEqual(errors, []); results.push({ mobile, before, state, errors }); await page.close();
  }
} finally { await browser.close(); }
await writeFile(new URL('results.json', out), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
