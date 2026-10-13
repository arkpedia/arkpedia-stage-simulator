// SPDX-License-Identifier: GPL-3.0-or-later
// Real public commands; controlled DP/target and accepted damage, never forced SP.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const executablePath = process.env.ARKPEDIA_REVIEW_CHROME;
if (!executablePath) throw Error('Set ARKPEDIA_REVIEW_CHROME and run the port-3182 preview.');
const dir = '.cache/arkpedia/rmixer-source/public-browser/', ID = 'char_4194_rmixer', origin = 'http://127.0.0.1:3182';
await mkdir(dir, { recursive: true });
const data = await (await fetch(origin + '/data/arkpedia-mvp.json')).json(); assert.ok(data.operators[ID]);
data.stage.geometry.waves[0].spawns = []; data.stage.battle.initial_dp = 99;
const app = await readFile('public/arkpedia/app.js', 'utf8');
const hook = `\nglobalThis.publicRmixerReview={get battle(){return battle;},get renderer(){return renderer;},hits:[],
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();renderer.render(battle,s,battle.drainEvents());drawHud();},
 target(){battle.autoFinish=false;battle.rng=()=>.99;const t=battle.spawnEnemy('enemy_1007_slime',{pos:[3,5]});Object.assign(t.base,{maxHp:1e7,atk:0,def:0,res:0,moveSpeed:0});t.markDirty();void t.s;t.hp=1e7;battle.addBuff(t,{key:'qa:pin',flags:{noMove:true,disarm:true,unblockable:true}});battle._buildEnemyIndex();battle.on('damaged',c=>{if(c.dmg?.tags?.some(t=>t.startsWith('rmixer:')))this.hits.push({tags:c.dmg.tags,amount:c.amount});});paused=true;drawHud();return t.id;},
 input(id,count=1,amount=1){const u=battle.bench[id].unit,t=battle.enemies.find(t=>t.alive);for(let n=0;n<count;n++)battle.dealDamage(t,u,{amount,type:'true',isAttack:true,canDodge:false});renderer.render(battle,.001,battle.drainEvents());drawHud();}};`;
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const reports = [], errors = [], failedResources = [];
try {
  for (const skill of [1, 2, 3]) {
    const page = await browser.newPage(); page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) failedResources.push({ url: r.url(), status: r.status() }); });
    await page.setViewport({ width: 1280, height: 800 }); await page.setRequestInterception(true);
    page.on('request', r => {
      const path = new URL(r.url()).pathname;
      if (r.url().startsWith(origin) && path === '/favicon.ico') return r.respond({ status: 204 });
      if (r.url().startsWith(origin) && path === '/arkpedia/app.js') return r.respond({ status: 200, contentType: 'text/javascript', body: app + hook });
      if (r.url().startsWith(origin) && path === '/data/arkpedia-mvp.json') return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
      return r.continue();
    });
    await page.goto(origin + '/arkpedia/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('.roster-item.chosen');
    for (const id of await page.$$eval('.roster-item.chosen', es => es.map(e => e.dataset.id))) {
      await page.click(`.roster-item[data-id="${id}"]`); await page.click('#toggle');
    }
    await page.$eval('#roster-search', (e, name) => { e.value = name; e.dispatchEvent(new Event('input', { bubbles: true })); }, data.operators[ID].name);
    await page.click(`.roster-item[data-id="${ID}"]`); await page.click('#toggle');
    assert.equal(await page.$eval('#skillId', e => e.options.length), 3);
    await page.select('#skillId', `skchr_rmixer_${skill}`); await page.click('#start');
    await page.waitForFunction(() => window.publicRmixerReview?.battle && document.querySelector('#deployment button'), { timeout: 60000 });
    const target = await page.evaluate(() => publicRmixerReview.target());
    async function deploy(dir = 'RIGHT') {
      const card = await page.$(`#deployment [data-id="${ID}"]`), box = await card.boundingBox();
      const p = await page.evaluate(() => {
        const r = publicRmixerReview.renderer, p = r.projection.project(4, 3, r.heightAt(3, 4)), box = document.querySelector('#battle-board').getBoundingClientRect();
        return { x: p.x + box.x, y: p.y + box.y };
      });
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
      await page.mouse.move(p.x, p.y, { steps: 12 }); await page.mouse.up();
      await page.waitForSelector('.facing-picker:not([hidden])');
      assert.equal(await page.evaluate(id => !!publicRmixerReview.battle.bench[id].unit?.alive, ID), false);
      const handle = await page.$('.facing-handle'), h = await handle.boundingBox(), x = h.x + h.width / 2, y = h.y + h.height / 2;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + (dir === 'RIGHT' ? 65 : 0), y + (dir === 'UP' ? -65 : 0), { steps: 8 });
      assert.equal(await page.evaluate(id => !!publicRmixerReview.battle.bench[id].unit?.alive, ID), false);
      await page.mouse.up(); await page.waitForFunction(id => publicRmixerReview.battle.bench[id].unit?.alive, {}, ID);
    }
    await deploy(); await page.evaluate(() => publicRmixerReview.advance(2));
    const initial = await page.evaluate(id => {
      const b = publicRmixerReview.battle, u = b.bench[id].unit;
      return { dp: b.dp, sp: u.skill.sp, index: u.mem.rmixerAttacks.record.index, dir: u.dir };
    }, ID);
    assert.equal(initial.index, skill - 1); assert.equal(initial.dir, 'RIGHT');
    await page.evaluate(() => {
      const e = document.createElement('div'); e.textContent = 'CONTROLLED QA · accepted damage / natural SP / pinned target / 99 DP';
      e.style.cssText = 'position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:12px sans-serif;pointer-events:none'; document.querySelector('.workspace').append(e);
    });
    if (skill === 1) {
      await page.evaluate(id => { const u = publicRmixerReview.battle.bench[id].unit; publicRmixerReview.input(id, u.skill.spCost - u.skill.sp); for(let n=0;n<120&&!u.skill.active;n++)publicRmixerReview.advance(publicRmixerReview.battle.dt); publicRmixerReview.advance(.12); }, ID);
    } else {
      await page.evaluate(id => { const u = publicRmixerReview.battle.bench[id].unit; publicRmixerReview.advance(Math.max(0, u.skill.spCost - u.skill.sp) + 1); }, ID);
      await page.waitForFunction(() => document.querySelector('#skill') && !document.querySelector('#skill').disabled);
      await page.screenshot({ path: dir + `public-s${skill}-ready.png` }); await page.click('#skill');
      await page.evaluate(() => publicRmixerReview.advance(.9));
      if (skill === 3) await page.evaluate(id => { const u=publicRmixerReview.battle.bench[id].unit; for(let n=0;n<120&&u.mem.regularFormVisual.clip!=='Skill_3_Idle';n++)publicRmixerReview.advance(publicRmixerReview.battle.dt); publicRmixerReview.input(id); }, ID);
      else await page.evaluate(() => publicRmixerReview.advance(.8));
    }
    const active = await page.evaluate(id => {
      const b = publicRmixerReview.battle, u = b.bench[id].unit, c = u.mem.rmixerAttacks;
      return { ammo: u.skill.ammoLeft, active: u.skill.active, clip: u.mem.regularFormVisual.clip,
        model: publicRmixerReview.renderer.views.get(u.id).key, hits: publicRmixerReview.hits, errors: b.errors, controller: c.contract.scope };
    }, ID);
    assert.ok(active.model.endsWith('/front')); assert.deepEqual(active.errors, []); assert.equal(active.active, true);
    assert.equal(active.clip, skill === 1 ? 'Skill_Loop' : skill === 2 ? 'Skill_2_Loop' : 'Skill_3_Idle');
    await page.waitForFunction(() => [...document.querySelectorAll('.operator-skill .skill-icon, #field-actions #skill img')].every(e => e.complete && e.naturalWidth > 0), { timeout: 30000 });
    await page.screenshot({ path: dir + `public-s${skill}-desktop.png` });
    if (skill === 1) await page.evaluate(() => publicRmixerReview.advance(1.3));
    const hits = await page.evaluate((skill) => publicRmixerReview.hits.filter(h => h.tags.includes(`rmixer:s${skill}`)), skill);
    assert.ok(hits.length >= (skill === 1 ? 3 : 1));
    if (skill === 2) {
      const before = await page.evaluate(id => publicRmixerReview.battle.bench[id].unit.skill.ammoLeft, ID);
      await page.evaluate(id => { const u = publicRmixerReview.battle.bench[id].unit; publicRmixerReview.input(id, 1, u.s.maxHp * 100); }, ID);
      assert.equal(await page.evaluate(id => publicRmixerReview.battle.bench[id].unit.alive, ID), true);
      assert.equal(await page.evaluate(id => publicRmixerReview.battle.bench[id].unit.skill.ammoLeft, ID), before - 20);
    }
    if (skill === 3) {
      await page.setViewport({ width: 844, height: 390 }); await page.screenshot({ path: dir + 'public-s3-landscape.png' });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.setViewport({ width: 390, height: 844 }); await page.waitForFunction(() => !document.querySelector('#orientation-gate').hidden);
      const before = await page.evaluate(() => publicRmixerReview.battle.time);
      await page.evaluate(() => new Promise(r => setTimeout(r, 150))); assert.equal(await page.evaluate(() => publicRmixerReview.battle.time), before);
      await page.screenshot({ path: dir + 'public-s3-portrait.png' }); await page.setViewport({ width: 1280, height: 800 });
      await page.waitForFunction(() => document.querySelector('#orientation-gate').hidden);
    }
    await page.click(`#deployment [data-id="${ID}"]`); await page.click('#retreat');
    const cleanup = await page.evaluate(id => {
      const u = publicRmixerReview.battle.bench[id].unit, c = u.mem.rmixerAttacks;
      return { stopped: c.stopped, handles: c.handles.length, resourceHooks: c.resources.hooks.length,
        barrier: !!c.resources.barrier, active: u.skill.active, errors: c.b.errors };
    }, ID);
    assert.deepEqual(cleanup, { stopped: true, handles: 0, resourceHooks: 0, barrier: false, active: false, errors: [] });
    let redeployment = null;
    if (skill === 3) {
      await page.evaluate(t => {
        publicRmixerReview.advance(85); const u = publicRmixerReview.battle.units.find(u => u.id === t);
        u.x = 4; u.y = 4; u.tileR = 4; u.tileC = 4; publicRmixerReview.battle._buildEnemyIndex();
      }, target);
      await deploy('UP'); await page.evaluate(id => { const u = publicRmixerReview.battle.bench[id].unit; publicRmixerReview.advance(u.skill.spCost - u.skill.sp + 1); }, ID);
      await page.click('#skill'); await page.evaluate(id => { publicRmixerReview.advance(.9); const u=publicRmixerReview.battle.bench[id].unit; for(let n=0;n<120&&u.mem.regularFormVisual.clip!=='Skill_3_Idle';n++)publicRmixerReview.advance(publicRmixerReview.battle.dt); publicRmixerReview.input(id); }, ID);
      redeployment = await page.evaluate(id => {
        const u = publicRmixerReview.battle.bench[id].unit;
        return { dir: u.dir, model: publicRmixerReview.renderer.views.get(u.id).key, clip: u.mem.regularFormVisual.clip, active: u.skill.active };
      }, ID);
      assert.equal(redeployment.dir, 'UP'); assert.ok(redeployment.model.endsWith('/back'));
      assert.equal(redeployment.clip, 'Skill_3_Idle'); assert.equal(redeployment.active, true);
      await page.screenshot({ path: dir + 'public-s3-back.png' }); await page.click('#skill');
      assert.equal(await page.evaluate(id => publicRmixerReview.battle.bench[id].unit.skill.active, ID), false);
      await page.click('#retreat');
    }
    reports.push({ skill, initial, active, hits, cleanup, redeployment }); await page.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(failedResources, []);
  const report = { driver: 'Chromium software WebGL2', publicCommands: true, dragDropAndSwipe: true, controlledTarget: true,
    forcedSp: false, operators: Object.keys(data.operators).length, frameParity: false, reports, errors, failedResources };
  await writeFile(dir + 'public-browser-review.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
} finally { await browser.close(); }
