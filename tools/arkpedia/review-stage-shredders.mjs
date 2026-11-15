// SPDX-License-Identifier: GPL-3.0-or-later
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.ARKPEDIA_REVIEW_ORIGIN ?? 'http://127.0.0.1:3184';
const out = new URL('../../.cache/arkpedia/stage-shredder-review/', import.meta.url);
await mkdir(out, { recursive: true });
const args = ['--no-sandbox', '--enable-unsafe-swiftshader'];
if (process.env.ARKPEDIA_REVIEW_CA_PINS) args.push(`--ignore-certificate-errors-spki-list=${process.env.ARKPEDIA_REVIEW_CA_PINS}`);
const browser = await puppeteer.launch({ executablePath: process.env.ARKPEDIA_REVIEW_CHROME ?? '/usr/bin/chromium', headless: true, args });
const results = [];
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewport({ width: mobile ? 1000 : 1440, height: mobile ? 600 : 900, isMobile: mobile, hasTouch: mobile });
    await page.goto(`${origin}/arkpedia/?stage=ri-6`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#start:not(:disabled)', { timeout: 60000 });
    await page.evaluate(async () => {
      const { StandardBattle } = await import('/sim/arkpedia.js'), original = StandardBattle.prototype.setViewport;
      StandardBattle.prototype.setViewport = function (...args) { window.reviewBattle = this; return original.apply(this, args); };
    });
    await page.click('#start'); await page.waitForFunction(() => window.reviewBattle);
    const state = await page.evaluate(() => {
      const b = reviewBattle; b.autoFinish = false; b.life = 999;
      const tree = b.allyUnits.find(u => u.tags.has('tree'));
      const e = b.spawnEnemy('enemy_1097_cclmbjk', { pos: [tree.tileR, tree.tileC - 1] });
      b.addBuff(e, { key: 'review:hold', flags: { noMove: true } });
      const target = b.spawnDevice('review_target', tree.tileR - 1, tree.tileC - 1, { hp: 1e6, blockCnt: 0 });
      if (!target) throw Error('Controlled target tile occupied'); target.profile.enemyTargetableDevice = true;
      let selected;
      for (let i = 0; i < 1000; i++) {
        b.step(); if (e.mem.stumpShredder.cast?.skill) selected = e.mem.stumpShredder.cast.target;
        if (b.stageScenery.brokenStumps.size) break;
      }
      if (!selected) throw Error('Shredder never selected a stump');
      window.reviewShredder = e;
      return { selected, attacks: e.stats.attacks, broken: b.stageScenery.brokenStumps.size,
        tile: b.grid.tile(selected.row, selected.col),
        occupied: b.allyUnits.some(u => u.alive && u.tileR === selected.row && u.tileC === selected.col), errors: b.errors };
    });
    assert.equal(state.attacks, 4); assert.equal(state.broken, 1); assert.equal(state.tile.build, 'NONE');
    assert.equal(state.occupied, false); assert.deepEqual(state.errors, []);
    await page.waitForSelector('.tile-hit[aria-label^="Destroyed stump. Deployment prohibited."]');
    await page.screenshot({ path: new URL(`${mobile ? 'touch' : 'desktop'}.png`, out).pathname });
    assert.deepEqual(errors, []); results.push({ mobile, state, errors }); await page.close();
  }
} finally { await browser.close(); }
await writeFile(new URL('results.json', out), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
