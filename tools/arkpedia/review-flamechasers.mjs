// SPDX-License-Identifier: GPL-3.0-or-later
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.ARKPEDIA_REVIEW_ORIGIN ?? 'http://127.0.0.1:3185';
const args = ['--no-sandbox', '--enable-unsafe-swiftshader'];
if (process.env.ARKPEDIA_REVIEW_CA_PINS) args.push(`--ignore-certificate-errors-spki-list=${process.env.ARKPEDIA_REVIEW_CA_PINS}`);
const dir = new URL(process.env.ARKPEDIA_REVIEW_OUT ? `../../${process.env.ARKPEDIA_REVIEW_OUT}/` : '../../.cache/arkpedia/flamechaser-battle-review/', import.meta.url); await mkdir(dir, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.ARKPEDIA_REVIEW_CHROME ?? '/usr/bin/chromium', headless: true, args });
const results = [];
try {
  for (const mobile of [false, true]) for (const [stage, id, hits = 5] of JSON.parse(process.env.ARKPEDIA_REVIEW_CASES ?? '[ ["fc-2","enemy_1288_duskls",5], ["fc-ex-1","enemy_1288_duskls_2",5] ]')) {
    const page = await browser.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.setViewport({ width: mobile ? 1000 : 1440, height: mobile ? 420 : 900, isMobile: mobile, hasTouch: mobile });
    await page.goto(`${origin}/arkpedia/?stage=${stage}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#start:not(:disabled)', { timeout: 60000 });
    await page.evaluate(async () => {
      const { StandardBattle } = await import('/sim/arkpedia.js'), old = StandardBattle.prototype.setViewport;
      StandardBattle.prototype.setViewport = function (...args) { window.reviewBattle = this; return old.apply(this, args); };
      const { StageRenderer } = await import('/arkpedia/renderer.js'), draw = StageRenderer.prototype.drawSurface;
      StageRenderer.prototype.drawSurface = function (...args) { window.reviewRenderer = this; return draw.apply(this, args); };
      Element.prototype.requestFullscreen = async () => {};
    });
    await page.click('#start'); await page.waitForFunction(() => window.reviewBattle && document.querySelector('#damage'));
    const state = await page.evaluate(id => {
      const b = reviewBattle, tile = [...(b.stageReeds?.tiles.values() ?? [])][0];
      const e = b.spawnEnemy(id, { ...(tile ? { pos: [tile.row, tile.col] } : { route: 0 }), countInTotal: true }); window.reviewEnemy = e;
      b.addBuff(e, { key: 'review:hold', persist: true, flags: { noMove: true, disarm: true } });
      if (tile) b.stageReeds.ignite(tile.row, tile.col);
      return { id, stage: b.stage.id, originalMaxHp: e.s.maxHp, reeds: b.stageReeds?.tiles.size ?? 0, mire: b.stageMire?.tiles.size ?? 0 };
    }, id);
    await page.waitForFunction(() => window.reviewRenderer?.views.get(window.reviewEnemy?.id)?.actor
      && reviewRenderer.views.get(reviewEnemy.id).actor.constructor.name !== 'FallbackActor', { timeout: 60000 }).catch(async error => {
      console.log(await page.evaluate(() => ({ enemy: { id: reviewEnemy?.id, defId: reviewEnemy?.defId, alive: reviewEnemy?.alive },
        views: [...(window.reviewRenderer?.views ?? [])].map(([id,v]) => ({id,key:v.key,actor:v.actor.constructor.name})),
        preloaded: [...(window.reviewRenderer?.preloaded?.keys() ?? [])], error: reviewBattle?.errors }))); throw error;
    });
    const phase = await page.evaluate(() => {
      const b = reviewBattle, e = reviewEnemy; b.kill(e, null); const first = { hp: e.hp, killed: b.killed, clip: e.mem.regularFormVisual.clip };
      for (let i = 0; i < 66; i++) b.step();
      return { first, ember: { alive: e.alive, hp: e.hp, form: e.form, clip: e.mem.regularFormVisual.clip, noAttack: e.profile.noAttack } };
    });
    assert.equal(phase.first.hp, hits); assert.equal(phase.first.killed, 0); assert.equal(phase.first.clip, 'Die');
    assert.equal(phase.ember.form, 'husk'); assert.equal(phase.ember.clip, 'Idle_2'); assert.equal(phase.ember.noAttack, true);
    await page.waitForFunction(() => reviewRenderer.views.get(reviewEnemy.id)?.actor.regularVisualClip === 'Idle_2');
    await page.screenshot({ path: new URL(`${stage}-${mobile ? 'touch' : 'desktop'}-ember.png`, dir).pathname });
    const finish = await page.evaluate(hits => {
      const b = reviewBattle, e = reviewEnemy;
      for (let i = 0; i < 271; i++) b.step();
      const revived = { hp: e.hp, maxHp: e.s.maxHp, form: e.form, hitCount: !!e.s.flags.hitCount, noAttack: e.profile.noAttack };
      b.kill(e, null); for (let i = 0; i < 34; i++) b.step();
      for (let i = 0; i < hits; i++) b.dealDamage(null, e, { amount: 100000, type: 'true', ignoreSelect: true });
      return { revived, finallyDead: !e.alive, killed: b.killed, errors: b.errors };
    }, hits);
    assert.equal(finish.revived.hp, state.originalMaxHp); assert.equal(finish.revived.form, 'revived');
    assert.equal(finish.revived.hitCount, false); assert.equal(finish.revived.noAttack, false);
    assert.equal(finish.finallyDead, true); assert.equal(finish.killed, 1); assert.deepEqual(finish.errors, []); assert.deepEqual(errors, []);
    results.push({ mobile, ...state, ...phase, ...finish }); await page.close();
  }
  await writeFile(new URL('results.json', dir), JSON.stringify({ scope: 'Original stage loading with diagnostic spawning, ignition, knockout, revival and final death; not a playable clear', results }, null, 2) + '\n');
  console.log(`Passed ${results.length} desktop/touch stage and form cases`);
} finally { await browser.close(); }
