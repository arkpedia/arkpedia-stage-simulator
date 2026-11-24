// SPDX-License-Identifier: GPL-3.0-or-later
// Representative browser regressions; the separate checker smokes every graph.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createPublicReviewServer } from './public-review-server.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const origin = process.env.ARKPEDIA_REVIEW_ORIGIN ?? 'http://127.0.0.1:3182';
const executablePath = process.env.ARKPEDIA_REVIEW_CHROME;
if (!executablePath) throw Error('Set ARKPEDIA_REVIEW_CHROME and start a local preview.');
const directory = `${root}.cache/arkpedia/stage-library-review/`;
await mkdir(directory, { recursive: true });
const manifest = await (await fetch(`${origin}/data/arkpedia-library.json`)).json();
const args = ['--no-sandbox', '--enable-unsafe-swiftshader'];
if (process.env.ARKPEDIA_REVIEW_CA_PINS) args.push(`--ignore-certificate-errors-spki-list=${process.env.ARKPEDIA_REVIEW_CA_PINS}`);
const browser = await puppeteer.launch({ executablePath, headless: true, args });
const results = [];
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage();
    await page.setViewport({ width: mobile ? 1000 : 1440, height: mobile ? 600 : 900, isMobile: mobile, hasTouch: mobile });
    let errors = [], requested = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { const path = new URL(request.url()).pathname; if (path.startsWith('/data/')) requested.push(path); });
    for (const id of ['0-1', '0-4_challenge_mode', '3-6_challenge_mode', 'bw-8_challenge_mode', 'ps-3_challenge_mode', 'tg-1', 'tg-1_challenge_mode', 's7-1', 's7-2']) {
      errors = []; requested = []; console.error('Reviewing', mobile ? 'touch' : 'desktop', id);
      await page.goto(`${origin}/arkpedia/?stage=${id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('#start:not(:disabled)', { timeout: 60000 });
      const options = await page.$$eval('#stage-select option', rows => rows.length);
      assert.equal(options, manifest.stages.length);
      await page.evaluate(async () => {
        const { StandardBattle } = await import('/sim/arkpedia.js');
        const previous = StandardBattle.prototype.setViewport;
        StandardBattle.prototype.setViewport = function (...args) { window.reviewBattle = this; return previous.apply(this, args); };
      });
      await page.click('#start');
      await page.waitForFunction(() => window.reviewBattle && document.querySelector('#damage'), { timeout: 60000 });
      const state = await page.evaluate(() => {
        const battle = window.reviewBattle;
        for (let n = 0; n < 300 && !battle.finished; n++) battle.step();
        return { seconds: battle.time, errors: battle.errors, devices: battle.manualStageDevices?.entries.size ?? 0, // device runtimes load only for stages that use them
          restriction: battle.stageCardRules?.deploymentExcludedProfessionMask ?? 0, canvas: !!document.querySelector('canvas'),
          originalWaveProgram: !!battle.stageWaveScheduler };
      });
      assert.deepEqual(errors, []); assert.deepEqual(state.errors, []); assert.ok(state.canvas);
      assert.equal(state.originalWaveProgram, true);
      if (id === '0-4_challenge_mode') assert.equal(state.restriction, 2);
      if (id === '3-6_challenge_mode') assert.equal(state.devices, 0);
      if (id === '3-6_challenge_mode') {
        state.waveGate = await page.evaluate(() => {
          const battle = window.reviewBattle;
          const hold = enemy => battle.addBuff(enemy, { key: 'review:wave-gate', flags: { noMove: true, disarm: true } });
          for (const enemy of battle.enemies.filter(e => e.alive)) hold(enemy);
          battle.on('enemySpawn', ({ enemy }) => hold(enemy));
          while (battle.time < 98 && !battle.finished) battle.step();
          const heldWave = battle.stageWaveScheduler.wave;
          const blockedFutureSpawns = battle._pending.filter(p => p.tag?.startsWith('stage-wave:2:') && p.time === Infinity).length;
          for (const enemy of battle.enemies.filter(e => e.alive)) battle.kill(enemy);
          battle.step();
          return { heldWave, blockedFutureSpawns, releasedWave: battle.stageWaveScheduler.wave, errors: battle.errors };
        });
        assert.equal(state.waveGate.heldWave, 1); assert.equal(state.waveGate.blockedFutureSpawns, 19);
        assert.equal(state.waveGate.releasedWave, 2); assert.deepEqual(state.waveGate.errors, []);
      }
      if (id === 's7-1' || id === 's7-2') {
        state.mines = await page.evaluate(() => {
          const b = window.reviewBattle; b.autoFinish = false; b.life = 999;
          const mines = b.units.filter(u => u.mem.stageSupplyToken === 'trap_012_mine');
          const mine = mines[0], hpBefore = mine.hp;
          const stockBefore = b.mvpStageTokens.get('trap_012_mine');
          for (const enemy of b.enemies.filter(e => e.alive)) b.kill(enemy);
          b.on('enemySpawn', ({ enemy }) => b.addBuff(enemy, { key: 'review:hold', flags: { noMove: true, disarm: true } }));
          // Isolate the contact blast after verifying the stage's real initial bodies.
          const enemy = b.spawnEnemy('review-mine-target', { pos: [mine.tileR, mine.tileC],
            def: { key: 'review-mine-target', name: 'Mine target', applyWay: 'NONE', dmgType: 'none',
              stats: { maxHp: 100000, hp: 100000, atk: 0, def: 0, res: 0, moveSpeed: 0, bat: 1, blockCnt: 0, lpr: 0 } } });
          const before = enemy.hp; mine.skill.gainSp(25, 'external'); b.step();
          return { count: mines.length, hpBefore, used: !mine.alive, damage: before - enemy.hp,
            stockBefore, stockAfter: b.mvpStageTokens.get('trap_012_mine'), errors: b.errors };
        });
        assert.equal(state.mines.count, id === 's7-1' ? 2 : 1);
        assert.equal(state.mines.hpBefore, 100); assert.equal(state.mines.used, true);
        assert.equal(state.mines.damage, 3000); assert.equal(state.mines.stockAfter, state.mines.stockBefore);
        assert.deepEqual(state.mines.errors, []);
      }
      if (id.startsWith('tg-1')) {
        state.shift = await page.evaluate(() => {
          const b = window.reviewBattle;
          b.autoFinish = false; b.life = 999;
          for (const enemy of b.enemies.filter(e => e.alive))
            b.addBuff(enemy, { key: 'review:hold', flags: { noMove: true, disarm: true } });
          let lane = null;
          for (let r = b.grid.rect.r0; r <= b.grid.rect.r1 && !lane; r++)
            for (let c = b.grid.rect.c0; c <= b.grid.rect.c1 - 3; c++)
              if ([0,1,2,3].every(d => b.grid.groundPassable(r,c+d))) { lane = [r,c]; break; }
          if (!lane) throw Error('No open lane for the movement probe');
          const e = b.spawnEnemy('enemy_1328_cbjedi', { pos: lane, route: 0 });
          b.addBuff(e, { key: 'review:force', flags: { noMove: true, disarm: true } });
          const x = e.x, hp = e.hp;
          b.push(e, e.s.massLevel, { dir: { x: 1, y: 0 }, effect: true });
          const immediate = e.x;
          for (let n = 0; n < 5; n++) b.step();
          const moving = { x: e.x, unbalanced: !!e.mem.regularShift };
          for (let n = 0; n < 30; n++) b.step();
          return { x, immediate, moving, finalX: e.x, unbalanced: !!e.mem.regularShift, hpLost: hp-e.hp, errors: b.errors };
        });
        assert.equal(state.shift.immediate, state.shift.x);
        assert.ok(state.shift.moving.unbalanced && state.shift.moving.x > state.shift.x);
        assert.ok(state.shift.finalX > state.shift.moving.x); assert.equal(state.shift.unbalanced, false, JSON.stringify(state.shift));
        assert.ok(state.shift.hpLost > 0); assert.deepEqual(state.shift.errors, []);
        await page.screenshot({ path: `${directory}${mobile ? 'touch' : 'desktop'}-${id}.png` });
      }
      assert.ok(requested.includes('/data/arkpedia-library.json'));
      assert.ok(requested.some(path => path.includes('/objects/')));
      assert.equal(requested.includes('/data/arkpedia-stages.json'), false);
      assert.equal(requested.some(path => /^\/data\/arkpedia-stage-[^/]+\.json$/.test(path)), false);
      results.push({ id, mobile, options, componentRequests: new Set(requested.filter(path => path.includes('/objects/'))).size, ...state });
      if (id === '0-4_challenge_mode') await page.screenshot({ path: `${directory}${mobile ? 'touch' : 'desktop'}.png` });
    }
    errors = []; requested = [];
    await page.goto(`${origin}/arkpedia/?stage=4-10_challenge_mode`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.innerText.includes('Still needed: Stage modifiers.'));
    assert.equal(await page.$('#start'), null); assert.equal(requested.some(path => path.includes('/objects/')), false);
    results.push({ id: '4-10_challenge_mode', mobile, blockedBeforeComponentFetch: true });
    await page.close();
  }
  // Existing controlled operator reviews intentionally replace the embedded
  // home scene. Their fixture server stays unchanged and uses the real app.
  const data = await (await fetch(`${origin}/data/arkpedia-mvp.json`)).json();
  data.stage.battle.initial_dp = 99;
  data.stage.geometry.waves = [];
  const fixture = await createPublicReviewServer({ origin, data, app: await readFile(`${root}public/arkpedia/app.js`, 'utf8'),
    hook: '\nglobalThis.libraryFixture = { get stage() { return data.stage; }, get battle() { return battle; } };' });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${fixture.origin}/arkpedia/?snapshot=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.libraryFixture && document.querySelector('#start'), { timeout: 60000 });
    assert.deepEqual(await page.evaluate(() => ({ dp: libraryFixture.stage.battle.initial_dp, waves: libraryFixture.stage.geometry.waves.length })), { dp: 99, waves: 0 });
    await page.click('#start');
    await page.waitForFunction(() => window.libraryFixture.battle && document.querySelector('#damage'), { timeout: 60000 });
    assert.equal(await page.evaluate(() => libraryFixture.battle.dp), 99);
    results.push({ homeFixture: true, initialDp: 99, waves: 0 });
    await page.close();
  } finally { await fixture.close(); }
  await writeFile(`${directory}results.json`, JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
