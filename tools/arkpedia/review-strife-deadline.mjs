// SPDX-License-Identifier: GPL-3.0-or-later
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.ARKPEDIA_REVIEW_ORIGIN ?? 'http://127.0.0.1:3185';
const args = ['--no-sandbox', '--enable-unsafe-swiftshader'];
if (process.env.ARKPEDIA_REVIEW_CA_PINS) args.push(`--ignore-certificate-errors-spki-list=${process.env.ARKPEDIA_REVIEW_CA_PINS}`);
const out = new URL('../../.cache/arkpedia/strife-deadline-review/', import.meta.url); await mkdir(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.ARKPEDIA_REVIEW_CHROME ?? '/usr/bin/chromium', headless: true, args });
const results = [];
try {
  for (const mobile of [false, true]) for (const stage of ['vec-sp01_act1vecb_sp01', 'vec-sp01_act2break_sp01']) {
    const page = await browser.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.setViewport({ width: mobile ? 1000 : 1440, height: mobile ? 600 : 900, isMobile: mobile, hasTouch: mobile });
    await page.goto(`${origin}/arkpedia/?stage=${stage}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#start:not(:disabled)', { timeout: 60000 });
    await page.evaluate(async () => {
      const { StandardBattle } = await import('/sim/arkpedia.js'), original = StandardBattle.prototype.setViewport;
      StandardBattle.prototype.setViewport = function (...args) { window.reviewBattle = this; return original.apply(this, args); };
      Element.prototype.requestFullscreen = async () => {};
    });
    await page.click('#start'); await page.waitForFunction(() => window.reviewBattle && document.querySelector('#objective-clock')?.textContent.includes('3:00'));
    const initial = await page.evaluate(() => ({ id: reviewBattle.stage.id, time: reviewBattle.time,
      deadline: reviewBattle.stageDeadline.endAt, paused: !document.querySelector('#paused-label').hidden }));
    assert.equal(initial.id, 'VEC-SP01'); assert.equal(initial.time, 0); assert.equal(initial.deadline, 180); assert.equal(initial.paused, true);
    await page.evaluate(() => {
      const b = reviewBattle;
      // Keep original enemies on the field to exercise the deadline. These are
      // diagnostic body holds, not a claim of a playable stage clear.
      const hold = e => b.addBuff(e, { key: 'review:hold', flags: { noMove: true, disarm: true } });
      b.on('enemySpawn', ({ enemy }) => hold(enemy)); for (const e of b.enemies) hold(e);
      for (let i = 0; i < 31; i++) b.step();
    });
    await page.waitForFunction(() => document.querySelector('#objective-clock').textContent.includes('2:59'));
    await page.screenshot({ path: new URL(`${stage}-${mobile ? 'touch' : 'desktop'}.png`, out).pathname });
    const expired = await page.evaluate(() => {
      const b = reviewBattle; for (let i = 0; i < 5500 && !b.finished; i++) b.step();
      return { reason: b.reason, time: b.time, killed: b.killed, escaped: b.leakedCount, remaining: b.enemies.filter(e => e.alive).length, errors: b.errors };
    });
    assert.equal(expired.reason, 'deadline'); assert.ok(Math.abs(expired.time - 180) < 1e-6);
    assert.equal(expired.escaped, 0); assert.ok(expired.remaining > 0); assert.deepEqual(expired.errors, []);
    await page.waitForFunction(() => document.querySelector('.result h2')?.textContent === 'Time expired');
    await page.screenshot({ path: new URL(`${stage}-${mobile ? 'touch' : 'desktop'}-expired.png`, out).pathname });
    await page.click('#again');
    await page.waitForFunction(() => reviewBattle.time === 0 && document.querySelector('#objective-clock')?.textContent.includes('3:00'));
    const restarted = await page.evaluate(() => ({ time: reviewBattle.time, deadline: reviewBattle.stageDeadline.endAt, finished: reviewBattle.finished }));
    assert.deepEqual(restarted, { time: 0, deadline: 180, finished: false }); assert.deepEqual(errors, []);
    results.push({ stage, mobile, scope: 'Original level loading and objective deadline with diagnostically held enemies', initial, expired, restarted });
    await page.close();
  }
  await writeFile(new URL('results.json', out), JSON.stringify(results, null, 2) + '\n'); console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
