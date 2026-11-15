// SPDX-License-Identifier: GPL-3.0-or-later
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.ARKPEDIA_REVIEW_ORIGIN ?? 'http://127.0.0.1:3184';
const executablePath = process.env.ARKPEDIA_REVIEW_CHROME;
if (!executablePath) throw Error('Set ARKPEDIA_REVIEW_CHROME and start a local preview');
const args = ['--no-sandbox', '--enable-unsafe-swiftshader'];
if (process.env.ARKPEDIA_REVIEW_CA_PINS) args.push(`--ignore-certificate-errors-spki-list=${process.env.ARKPEDIA_REVIEW_CA_PINS}`);
const dir = new URL('../../.cache/arkpedia/stage-mode-review/', import.meta.url);
await mkdir(dir, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true, args }), results = [];
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage(), errors = [];
    await page.setViewport({ width: mobile ? 1000 : 1440, height: mobile ? 600 : 900, isMobile: mobile, hasTouch: mobile });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${origin}/arkpedia/?stage=isw-df_level_obt_roguelike_ro1_level_rogue1_b-3`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#mode-rules', { timeout: 60000 });
    assert.equal(await page.$$eval('[data-mode-rule]', rows => rows.length), 7);
    await page.evaluate(async () => {
      const values = { life: 9, initialDp: 23, deploymentLimit: 4, dpRate: 0, enemyHp: 2, enemyAtk: 1.5, enemyDef: 0.5 };
      for (const input of document.querySelectorAll('[data-mode-rule]')) { input.value = values[input.dataset.modeRule]; input.dispatchEvent(new Event('change', { bubbles: true })); }
      const { StandardBattle } = await import('/sim/arkpedia.js'), old = StandardBattle.prototype.setViewport;
      StandardBattle.prototype.setViewport = function (...args) { window.reviewBattle = this; return old.apply(this, args); };
    });
    await page.click('#start');
    await page.waitForFunction(() => window.reviewBattle && document.querySelector('#damage'), { timeout: 60000 });
    const state = await page.evaluate(() => {
      const b = window.reviewBattle; let first;
      b.on('enemySpawn', ({ enemy }) => { first ??= enemy; });
      for (let i = 0; i < 900 && !first && !b.finished; i++) b.step();
      return { rules: b.modeRules, life: b.life, dp: b.dp, unitLimit: b.unitLimit, spawned: !!first, errors: b.errors };
    });
    assert.deepEqual(errors, []); assert.deepEqual(state.errors, []);
    assert.equal(state.life, 9); assert.equal(state.dp, 23); assert.equal(state.unitLimit, 4); assert.equal(state.spawned, true);
    await page.click('#settings'); await page.click('#restart');
    const restarted = await page.evaluate(() => ({ life: reviewBattle.life, dp: reviewBattle.dp, rules: reviewBattle.modeRules }));
    assert.equal(restarted.life, 9); assert.equal(restarted.dp, 23); assert.deepEqual(restarted.rules, state.rules);
    await page.screenshot({ path: new URL(`${mobile ? 'touch' : 'desktop'}.png`, dir).pathname });
    results.push({ mobile, ...state, restartPreservedRules: true }); await page.close();
  }
  await writeFile(new URL('results.json', dir), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
