// SPDX-License-Identifier: GPL-3.0-or-later
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.ARKPEDIA_REVIEW_ORIGIN ?? 'http://127.0.0.1:3184';
const out = new URL('../../.cache/arkpedia/stage-native-enemy-attributes-review/', import.meta.url);
await mkdir(out, { recursive: true });
const args = ['--no-sandbox', '--enable-unsafe-swiftshader'];
if (process.env.ARKPEDIA_REVIEW_CA_PINS) args.push(`--ignore-certificate-errors-spki-list=${process.env.ARKPEDIA_REVIEW_CA_PINS}`);
const browser = await puppeteer.launch({ executablePath: process.env.ARKPEDIA_REVIEW_CHROME ?? '/usr/bin/chromium', headless: true, args });
const results = [];
try {
  for (const mobile of [false, true]) for (const stage of ['dm-ex-3_challenge_mode', 'dm-ex-6']) {
    console.error(`Reviewing ${stage} ${mobile ? 'touch' : 'desktop'}`);
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewport({ width: mobile ? 1000 : 1440, height: mobile ? 600 : 900, isMobile: mobile, hasTouch: mobile });
    await page.goto(`${origin}/arkpedia/?stage=${stage}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#start:not(:disabled)', { timeout: 60000 });
    await page.evaluate(async () => {
      const { StandardBattle } = await import('/sim/arkpedia.js'), original = StandardBattle.prototype.setViewport;
      StandardBattle.prototype.setViewport = function (...args) { window.reviewBattle = this; return original.apply(this, args); };
      Element.prototype.requestFullscreen = async () => {};
    });
    await page.click('#start'); await page.waitForFunction(() => window.reviewBattle, { timeout: 60000 });
    const state = await page.evaluate(stage => {
      const b = reviewBattle; b.autoFinish = false; b.life = 999; b.timeLimit = 500;
      if (stage === 'dm-ex-6') {
        for (let n = 0; n < 30; n++) b.step();
        const id = 'enemy_1073_dscout_2', record = b.data.raw.enemies[id];
        return { code: document.title, immunities: record.stats.immunities, block: record.stats.blockCnt, errors: b.errors };
      }
      const id = 'enemy_1072_dlancer_2';
      const e = b.spawnEnemy(id, { route: { motion: 'WALK', start: [2, 2], end: [2, 3],
        checkpoints: [{ type: 'WAIT', time: 300, pos: [2, 2] }] } });
      const charge = e.mem.ab.list.find(a => 'stacks' in a), samples = [];
      for (const seconds of [170, .5, 12, 2]) {
        for (let n = 0; n < Math.round(seconds / b.dt); n++) b.step();
        samples.push({ time: b.time, stacks: charge.stacks, triggers: charge.triggers });
      }
      return { code: document.title, samples, alive: e.alive, coefficient: b.data.raw.enemies[id].talents.bb['firstattack.atk_scale'], errors: b.errors };
    }, stage);
    assert.deepEqual(state.errors, []);
    if (state.samples) {
      assert.deepEqual(state.samples.map(s => s.stacks), [0, 1, 25, 25]);
      assert.deepEqual(state.samples.map(s => s.triggers), [340, 341, 365, 365]);
      assert.equal(state.coefficient, 960); assert.equal(state.alive, true);
    } else { assert.equal(state.immunities.stun, true); assert.equal(state.immunities.silence, true); }
    await page.screenshot({ path: new URL(`${stage}-${mobile ? 'touch' : 'desktop'}.png`, out).pathname });
    assert.deepEqual(errors, []); results.push({ mobile, stage, state, errors }); await page.close();
  }
} finally { await browser.close(); }
await writeFile(new URL('results.json', out), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
