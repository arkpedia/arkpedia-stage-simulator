// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled enemy fixtures exercise the public result panel. These enemies do
// not yet unlock a full source stage; unrelated stage blockers remain enforced.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const catalogue = JSON.parse(await readFile(new URL('../../data/arkpedia-enemy-records.json', import.meta.url)));
const ids = ['enemy_2069_skzbox', 'enemy_2091_skzgds', 'enemy_2067_skzcy', 'enemy_2070_skzfbx'];
const records = Object.fromEntries(ids.map(id => [id, catalogue.enemies[id].levels[0]]));
const origin = process.env.ARKPEDIA_REVIEW_ORIGIN ?? 'http://127.0.0.1:3184';
const dir = new URL('../../.cache/arkpedia/stage-outcomes-review/', import.meta.url);
await mkdir(dir, { recursive: true });
const args = ['--no-sandbox', '--enable-unsafe-swiftshader'];
if (process.env.ARKPEDIA_REVIEW_CA_PINS) args.push(`--ignore-certificate-errors-spki-list=${process.env.ARKPEDIA_REVIEW_CA_PINS}`);
const browser = await puppeteer.launch({ executablePath: process.env.ARKPEDIA_REVIEW_CHROME ?? '/usr/bin/chromium', headless: true, args });
const results = [];
try {
  for (const mobile of [false, true]) {
    console.error('Reviewing stage outcomes', mobile ? 'touch' : 'desktop');
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') console.error('Browser:', message.text()); });
    await page.setViewport({ width: mobile ? 1000 : 1440, height: mobile ? 420 : 900, isMobile: mobile, hasTouch: mobile });
    await page.goto(`${origin}/arkpedia/?stage=0-1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#start:not(:disabled)', { timeout: 60000 });
    await page.evaluate(async () => {
      const { StandardBattle } = await import('/sim/arkpedia.js'), original = StandardBattle.prototype.setViewport;
      StandardBattle.prototype.setViewport = function (...args) { window.reviewBattle = this; return original.apply(this, args); };
      const {StageRenderer}=await import('/arkpedia/renderer.js'),preload=StageRenderer.prototype.preload;
      StageRenderer.prototype.preload=function(...args){
        window.reviewRenderer=this;
        return window.reviewPreload=preload.apply(this,args);
      };
      Element.prototype.requestFullscreen = async () => {};
    });
    await page.click('#start');
    try { await page.waitForFunction(() => !!window.reviewBattle && !!window.reviewPreload, { timeout: 60000 }); }
    catch (error) {
      console.error(await page.evaluate(() => ({ battle: !!window.reviewBattle, preload: !!window.reviewPreload,
        status: document.querySelector('#prep-error')?.textContent })), errors);
      throw error;
    }
    await page.evaluate(() => window.reviewPreload);
    const state = await page.evaluate(async records => {
      const b = reviewBattle;
      Object.assign(b.data.raw.enemies, records);
      // This controlled fixture introduces records absent from 0-1. Fetch their
      // shared models explicitly; ordinary stage loading remains demand-driven.
      const snapshot=await(await fetch('/data/arkpedia-mvp.json')).json();
      const modelKeys=[...Object.keys(records).map(id=>`enemy/${id}/default/default`),
        ...['trap_757_skzbox','trap_758_skzmbx','trap_759_skzwyx'].map(id=>`device/${id}/default/default`)];
      Object.assign(reviewRenderer.data.enemies,records);
      reviewRenderer.data.sd.models={...reviewRenderer.data.sd.models,...Object.fromEntries(modelKeys.map(key=>[key,snapshot.sd.models[key]]))};
      reviewRenderer.data.stage.devices=[...(reviewRenderer.data.stage.devices??[]),
        ...['trap_757_skzbox','trap_758_skzmbx','trap_759_skzwyx'].map(key=>({key}))];
      await reviewRenderer.preload([]);
      const models=[];
      const capture=async(unit,label)=>{
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        const view=reviewRenderer.views.get(unit.id);
        models.push({label,key:view?.key,actor:view?.actor.constructor.name,role:view?.actor.roles?.idle,
          clip:view?.actor.spine?.state?.getCurrent(0)?.animation.name,loaded:view&&reviewRenderer.preloaded.has(view.key)});
      };
      let goal;
      for (let row = b.rect.r0; row <= b.rect.r1; row++) for (let col = b.rect.c0; col <= b.rect.c1; col++)
        if (b.grid.tile(row, col).key === 'tile_end') goal = [row, col];
      if (!goal) throw Error('Fixture needs an objective');
      b.leak(b.spawnEnemy('enemy_2069_skzbox', { pos: goal }));
      b.kill(b.spawnEnemy('enemy_2069_skzbox', { pos: goal }), null);
      b.kill(b.spawnEnemy('enemy_2091_skzgds', { pos: goal }), null);
      const hovercraft = b.spawnEnemy('enemy_2070_skzfbx', { pos: goal });
      b.addBuff(hovercraft,{key:'review:hold',flags:{noMove:true}});
      await capture(hovercraft,'airborne');
      const hover = [{ airborne: hovercraft.isFlying, speed: hovercraft.s.moveSpeed }];
      b.applyStatus(hovercraft, 'stun', { duration: .01 });
      hover.push({ airborne: hovercraft.isFlying, speed: hovercraft.s.moveSpeed });
      b.step();await capture(hovercraft,'grounded');
      b.kill(hovercraft, null);
      const { StageRewardDevices } = await import('/sim/content/arkpedia-stage-reward-devices.js');
      const chestController = new StageRewardDevices(b, [{ key: 'trap_757_skzbox', alias: 'review-chest',
        name: 'Treasure Chest', kind: 'device', hidden: true, row: goal[0], col: goal[1], instance: { level: 1, skillLevel: 1 } }]);
      chestController.activate('review-chest');
      const chest = chestController.entries.get('review-chest').unit;
      if (!chest) throw Error('Fixture chest activation failed');
      await capture(chest,'chest');
      b.kill(chest);
      const rescues = new StageRewardDevices(b, [{ key: 'trap_759_skzwyx', alias: 'review-fowl',
        name: 'Dying Fowlbeast', kind: 'device', hidden: false, row: goal[0], col: goal[1], instance: { level: 1, skillLevel: 1 } }]);
      const fowl = rescues.entries.get('review-fowl').unit;
      if (!fowl) throw Error('Fixture rescue activation failed');
      await capture(fowl,'fowl');
      const rescue = { initialHp: fowl.hp, side: fowl.side, total: b.total };
      rescue.restored = b.heal(null, fowl, 10000); rescue.alive = fowl.alive; rescue.finalTotal = b.total;
      b.stageBranches.branches['review-mimic'] = { spawns: [{ enemyKey: 'enemy_2069_skzbox', routeIndex: 0,
        count: 1, offset: 0, interval: 1, order: 0 }] };
      const mimics = new StageRewardDevices(b, [{ key: 'trap_758_skzmbx', alias: 'review-mimic',
        name: 'Idle Exquisicart', kind: 'device', hidden: false, row: goal[0], col: goal[1],
        instance: { level: 1, skillLevel: 1, branchId: 'review-mimic' } }]);
      const mimic = mimics.entries.get('review-mimic').unit, before = b.total;
      if (!mimic) throw Error('Fixture mimic activation failed');
      await capture(mimic,'mimic');
      b.dealDamage(null, mimic, { amount: 1, type: 'true' });
      const child = b.enemies.find(e => e.mem.stageBranch);
      const branch = { mimicAlive: mimic.alive, child: child?.defId, counted: child?.counted,
        holdsBattle: child?.profile.holdsBattle, before, after: b.total };
      if (child) b._remove(child, 'expire');
      b.addDp('arkpedia', 99);
      let operator;
      for (const id of Object.keys(b.bench)) for (let row = b.rect.r0; row <= b.rect.r1; row++) for (let col = b.rect.c0; col <= b.rect.c1; col++)
        if (!operator && !b.placementError(id, row, col)) operator = b.deployOperator(id, row, col, 'RIGHT');
      if (!operator) throw Error('Fixture needs a deployed operator');
      b.kill(b.spawnEnemy('enemy_2067_skzcy', { pos: goal }), null);
      return { outcomes: b.result().stageOutcomes, removed: operator.defId, hover, rescue, branch, models,
        placementError: b.placementError(operator.defId, operator.tileR, operator.tileC), errors: b.errors };
    }, records);
    assert.deepEqual(state.outcomes.counters, { rogue_thief_reach_exit: 1, trap_758_skzmbx: 1, killed: 2, trap_757_skzbox: 1, trap_759_skzwyx: 1, rogue_first_step: 1 });
    assert.equal(state.rescue.initialHp, 1); assert.equal(state.rescue.restored, 5999); assert.equal(state.rescue.alive, false);
    assert.equal(state.rescue.side, 'ally'); assert.equal(state.rescue.total, state.rescue.finalTotal);
    assert.equal(state.branch.mimicAlive, false); assert.equal(state.branch.child, 'enemy_2069_skzbox');
    assert.equal(state.branch.counted, false); assert.equal(state.branch.holdsBattle, true); assert.equal(state.branch.before, state.branch.after);
    assert.deepEqual(state.hover, [{ airborne: true, speed: .35 }, { airborne: false, speed: .7 }]);
    assert.equal(state.models.length,5);
    for(const model of state.models){assert.equal(model.actor,'BattleActor',JSON.stringify(model));assert.ok(model.clip,model.label);}
    assert.equal(state.models[0].role,'Idle1');assert.equal(state.models[1].role,'Idle2');
    for(const [i,key]of ['trap_757_skzbox','trap_759_skzwyx','trap_758_skzmbx'].entries())
      assert.equal(state.models[i+2].key,`device/${key}/default/default`);
    assert.deepEqual(state.errors, []);
    assert.match(state.placementError, /removed from the squad/);
    await page.waitForFunction(id => !document.querySelector(`#deployment button[data-id="${id}"]`), {}, state.removed);
    await page.evaluate(() => reviewBattle._finish('cleared'));
    await page.waitForSelector('.result .stage-outcomes');
    const summaries = await page.$$eval('.stage-outcomes', nodes => nodes.map(n => n.textContent));
    assert.equal(summaries.length, 7); assert.ok(summaries.some(s => s.includes('Ingot theft events: 1')));
    assert.ok(summaries.some(s => s.includes('Treasure Chests opened: 1')));
    assert.ok(summaries.some(s => s.includes('Fowlbeasts rescued: 1')));
    assert.ok(summaries.some(s => s.includes('Windows defeated: 1')));
    assert.ok(summaries.some(s => s.includes('Operators removed by Portal:')));
    const panel = await page.$eval('.result .panel', node => {
      const r = node.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, height: innerHeight, scroll: node.scrollHeight, visible: node.clientHeight };
    });
    assert.ok(panel.top >= 0 && panel.bottom <= panel.height, 'result panel stays inside the viewport');
    if (mobile) assert.ok(panel.scroll > panel.visible, 'long outcomes remain scrollable on a short touch viewport');
    await page.screenshot({ path: new URL(`${mobile ? 'touch' : 'desktop'}.png`, dir).pathname });
    await page.click('#again');
    await page.waitForFunction(() => !reviewBattle.finished && !document.querySelector('.result'));
    assert.deepEqual(await page.evaluate(() => reviewBattle.result().stageOutcomes), { counters: {}, events: [] });
    assert.equal(await page.evaluate(id => !!reviewBattle.bench[id].removedFromDeck, state.removed), false);
    assert.deepEqual(errors, []); results.push({ mobile, scope: 'controlled supported-enemy fixtures in the public result UI', state, summaries, panel, errors });
    await page.close();
  }
} finally { await browser.close(); }
await writeFile(new URL('results.json', dir), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
