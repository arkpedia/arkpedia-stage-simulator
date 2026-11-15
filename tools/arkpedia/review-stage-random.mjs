// SPDX-License-Identifier: GPL-3.0-or-later
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.ARKPEDIA_REVIEW_ORIGIN ?? 'http://127.0.0.1:3184';
const dir = new URL('../../.cache/arkpedia/stage-random-review/', import.meta.url);
await mkdir(dir, { recursive: true });
const args = ['--no-sandbox', '--enable-unsafe-swiftshader'];
if (process.env.ARKPEDIA_REVIEW_CA_PINS) args.push(`--ignore-certificate-errors-spki-list=${process.env.ARKPEDIA_REVIEW_CA_PINS}`);
const browser = await puppeteer.launch({ executablePath: process.env.ARKPEDIA_REVIEW_CHROME ?? '/usr/bin/chromium', headless: true, args });
const results = [];
try {
  for (const mobile of [false, true]) for (const suffix of [1, 2, 4]) {
    const id = `isw-du_level_obt_roguelike_ro1_level_rogue1_t-${suffix}`;
    console.error('Reviewing random stage', mobile ? 'touch' : 'desktop', id);
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewport({ width: mobile ? 1000 : 1440, height: mobile ? 600 : 900, isMobile: mobile, hasTouch: mobile });
    await page.goto(`${origin}/arkpedia/?stage=${id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#start:not(:disabled)', { timeout: 60000 });
    await page.evaluate(async () => {
      const { StandardBattle } = await import('/sim/arkpedia.js'), original = StandardBattle.prototype.setViewport;
      StandardBattle.prototype.setViewport = function (...args) { window.reviewBattle = this; return original.apply(this, args); };
      Element.prototype.requestFullscreen = async () => {};
    });
    await page.click('#start'); await page.waitForFunction(() => window.reviewBattle, { timeout: 60000 });
    const check = () => page.evaluate(() => {
      const b = reviewBattle, p = b.stageWaveScheduler.program;
      return { choices: b.result().stageRandomChoices, total: b.total,
        expected: p.waves.reduce((n, w) => n + w.fragments.reduce((m, f) => m + f.spawns.reduce((s, a) => s + (a.unharmful ? 0 : a.count), 0), 0), 0),
        unresolved: p.waves.some(w => w.fragments.some(f => f.spawns.some(a => a.random))), errors: b.errors };
    });
    const state = await check();
    assert.ok(state.choices.length > 0); assert.equal(state.unresolved, false); assert.equal(state.total, state.expected);
    assert.deepEqual(state.errors, []);
    await page.evaluate(() => reviewBattle._finish('cleared'));
    await page.waitForSelector('#again'); await page.click('#again');
    await page.waitForFunction(() => !reviewBattle.finished && !document.querySelector('.result'));
    const restart = await check();
    assert.equal(restart.total, restart.expected); assert.equal(restart.choices.length, state.choices.length);
    assert.equal(restart.unresolved, false); assert.deepEqual(restart.errors, []); assert.deepEqual(errors, []);
    await page.screenshot({ path: new URL(`${mobile ? 'touch' : 'desktop'}-${suffix}.png`, dir).pathname });
    results.push({ id, mobile, state, restart, errors }); await page.close();
  }
} finally { await browser.close(); }
await writeFile(new URL('results.json', dir), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
