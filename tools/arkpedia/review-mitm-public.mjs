// SPDX-License-Identifier: GPL-3.0-or-later
// Public controls with controlled enemies/DP; no unmodified stage-victory claim.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const executablePath = process.env.ARKPEDIA_REVIEW_CHROME;
if (!executablePath) throw Error('Set ARKPEDIA_REVIEW_CHROME and start port 3182 preview.');
const dir = '.cache/arkpedia/mitm-source/public-browser/', origin = 'http://127.0.0.1:3182', ID = 'char_4147_mitm', card = 'summon:' + ID;
await mkdir(dir, { recursive: true });
const data = await (await fetch(origin + '/data/arkpedia-mvp.json')).json();assert.ok(data.operators[ID]);
data.stage.geometry.waves[0].spawns = [];data.stage.battle.initial_dp = 99;data.stage.battle.dp_per_second = 0;
const app = await readFile('public/arkpedia/app.js', 'utf8');
const hook = `
globalThis.publicMitmReview={
 get battle(){return battle;},get renderer(){return renderer;},hits:[],
 get selection(){return{selected,pending,dragging:dragging&&{over:dragging.over,moved:dragging.moved}};},
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){battle.autoFinish=false;paused=true;this.hits=[];
  battle.on('damaged',h=>this.hits.push({source:h.source?.id,target:h.target.id,amount:h.amount,tags:h.dmg.tags??[]}));this.render();
 },
 until(kind){paused=true;const u=battle.bench['${ID}'].unit,c=u.mem.mitmController,end=battle.time+80;
  const reached=()=>kind==='ready'?u.skill.ready:kind==='owner'?this.hits.some(h=>h.source===u.id&&h.tags.includes('mitm:s'+(c.record.index+1)))
   :kind==='rest'?c.devices.point.mode===0:kind==='idle'?c.devices.point.mode===1:kind==='waste'?c.devices.all().some(t=>t.mem.mitmMode===2):!u.skill.active;
  while(battle.time<end&&!reached())battle.step();this.render();if(!reached())throw Error('Missing '+kind);
 },
 target(){const u=battle.bench['${ID}'].unit,t=u.mem.mitmController.devices.point.unit,e=battle.spawnEnemy('enemy_1007_slime',{pos:[t.tileR,t.tileC]});
  Object.assign(e.base,{maxHp:1e7,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;
  battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true}});battle._buildEnemyIndex();this.enemy=e;this.advance(battle.dt);
 },
 defeat(){const e=this.enemy,t=battle.bench['${ID}'].unit.mem.mitmController.devices.point.unit;
  e.base.atk=t.s.maxHp*10;e.markDirty();battle.removeBuff(e,'qa:pin');battle.addBuff(e,{key:'qa:pin',flags:{noMove:true}});
  this.until('rest');battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true}});this.render();
 }
};`;
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const reports = [], errors = [], failures = [];let currentPage;
try {
  for (const mobile of [false, true]) for (const skill of [1, 2]) for (const facing of mobile ? ['UP', 'DOWN'] : ['RIGHT', 'LEFT']) {
    const label = (mobile ? 'mobile' : 'desktop') + '-s' + skill + '-' + facing.toLowerCase(), page = await browser.newPage();currentPage = page;
    page.on('pageerror', e => errors.push({ label, message: e.message }));
    page.on('console', m => { if (m.type() === 'error') errors.push({ label, message: m.text() }); });
    page.on('response', r => { if (r.status() >= 400) failures.push({ label, url: r.url(), status: r.status() }); });
    await page.setViewport(mobile ? { width: 844, height: 390, isMobile: true, hasTouch: true } : { width: 1280, height: 800 });
    await page.setRequestInterception(true);
    page.on('request', r => {
      const path = new URL(r.url()).pathname;
      if (r.url().startsWith(origin) && path === '/favicon.ico') return r.respond({ status: 204 });
      if (r.url().startsWith(origin) && path === '/arkpedia/app.js') return r.respond({ status: 200, contentType: 'text/javascript', body: app + hook });
      if (r.url().startsWith(origin) && path === '/data/arkpedia-mvp.json') return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
      r.continue();
    });
    await page.goto(origin + '/arkpedia/', { waitUntil: 'domcontentloaded', timeout: 60000 });await page.waitForSelector('.roster-item.chosen');
    for (const id of await page.$$eval('.roster-item.chosen', es => es.map(e => e.dataset.id))) {
      await page.click('.roster-item[data-id="' + id + '"]');await page.click('#toggle');
    }
    await page.$eval('#roster-search', (e, name) => { e.value = name;e.dispatchEvent(new Event('input', { bubbles: true })); }, data.operators[ID].name);
    await page.click('.roster-item[data-id="' + ID + '"]');await page.click('#toggle');
    assert.equal(await page.$eval('#skillId', e => e.options.length), 2);await page.select('#skillId', 'skchr_mitm_' + skill);await page.click('#start');
    await page.waitForFunction(() => window.publicMitmReview?.battle && document.querySelector('#deployment button'), { timeout: 60000 });
    await page.evaluate(() => { publicMitmReview.setup();const e = document.createElement('div');e.textContent = 'CONTROLLED QA · natural SP / pinned enemy / real enemy attacks / 99 DP / DP regen off';
      e.style.cssText = 'position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:12px sans-serif;pointer-events:none';document.querySelector('.workspace').append(e); });
    async function down(x, y) { if (mobile) await page.touchscreen.touchStart(x, y);else { await page.mouse.move(x, y);await page.mouse.down(); } }
    async function move(x, y) { if (mobile) await page.touchscreen.touchMove(x, y);else await page.mouse.move(x, y, { steps: 12 }); }
    async function up() { if (mobile) await page.touchscreen.touchEnd();else await page.mouse.up(); }
    async function press(selector) {
      if (!mobile) return page.click(selector);
      const e = await page.$(selector);assert.ok(e);await e.evaluate(e => e.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
      const box = await e.boundingBox();await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    }
    const deployed = id => page.evaluate(id => id.startsWith('summon:') ? publicMitmReview.battle.regularSummons.get(id).deck.own().length > 0 : !!publicMitmReview.battle.bench[id].unit?.alive, id);
    async function deploy(id, row, col) {
      const e = await page.$(`#deployment [data-id="${id}"]`);assert.ok(e);await e.evaluate(e => e.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
      const box = await e.boundingBox(), p = await page.evaluate((row, col) => {
        const r = publicMitmReview.renderer, p = r.projection.project(col, row, r.heightAt(row, col)), box = document.querySelector('#battle-board').getBoundingClientRect();
        return { x: p.x + box.x, y: p.y + box.y };
      }, row, col);
      await down(box.x + box.width / 2, box.y + box.height / 2);await move(p.x, p.y);
      const selection = await page.evaluate(() => publicMitmReview.selection);
      assert.deepEqual(selection.dragging && { row: selection.dragging.over?.row, col: selection.dragging.over?.col }, { row, col });
      assert.equal(await deployed(id), false);await up();
      if (id === card) {
        assert.equal(await deployed(id), true);
        assert.equal(await page.evaluate(() => publicMitmReview.selection.pending), null);
        assert.equal(await page.$eval('.facing-picker', e => e.hidden), true);
        return;
      }
      await page.waitForSelector('.facing-picker:not([hidden])');assert.equal(await deployed(id), false);
      await page.screenshot({ path: dir + label + '-facing.png' });
      const h = await (await page.$('.facing-handle')).boundingBox(), x = h.x + h.width / 2, y = h.y + h.height / 2;
      await down(x, y);await move(x + (facing === 'RIGHT' ? 65 : facing === 'LEFT' ? -65 : 0), y + (facing === 'UP' ? -65 : facing === 'DOWN' ? 65 : 0));
      assert.equal(await deployed(id), false);await up();await page.waitForFunction(id => publicMitmReview.battle.bench[id].unit?.alive, {}, id);
    }
    async function selectUnit(id) {
      // Close the owner's field command first: its skill button overlays nearby
      // tiles while focused, just as during ordinary play.
      await press('.inspector-close');
      const p = await page.evaluate(id => { const q = publicMitmReview, t = q.battle.units.find(u => u.id === id), r = q.renderer;
        const p = r.projection.project(t.x, t.y, r.heightAt(t.tileR, t.tileC)), box = document.querySelector('#battle-board').getBoundingClientRect();return { x: p.x + box.x, y: p.y + box.y }; }, id);
      if (mobile) await page.touchscreen.tap(p.x, p.y);else await page.mouse.click(p.x, p.y);
      await page.waitForSelector('#retreat');assert.equal(await page.evaluate(() => publicMitmReview.selection.selected), 'token:' + id);
    }
    const host = facing === 'UP' ? [2, 4] : facing === 'LEFT' ? [4, 6] : [4, 4];
    await deploy(ID, ...host);await page.evaluate(() => publicMitmReview.advance(1.1));
    const before = await page.evaluate(() => ({ slots: publicMitmReview.battle.deployedSlots(), dp: publicMitmReview.battle.dp }));
    await deploy(card, 3, 5);
    assert.deepEqual(await page.evaluate(() => ({ slots: publicMitmReview.battle.deployedSlots(), dp: publicMitmReview.battle.dp })), before);
    await page.evaluate(() => { publicMitmReview.advance(1.1);publicMitmReview.target(); });
    await press('#deployment [data-id="' + ID + '"]');await page.evaluate(() => publicMitmReview.until('ready'));
    assert.equal(await page.$eval('#skill', e => e.disabled), false);await page.screenshot({ path: dir + label + '-ready.png' });await press('#skill');
    await page.evaluate(() => publicMitmReview.until('owner'));
    const state = await page.evaluate(() => {
      const q = publicMitmReview, u = q.battle.bench['char_4147_mitm'].unit, c = u.mem.mitmController, t = c.devices.point.unit, v = q.renderer.views.get(t.id);
      return { active: u.skill.active, hits: q.hits, ownerClip: u.mem.regularFormVisual.clip, actorClip: q.renderer.views.get(u.id)?.actor.current,
        ownerKey: q.renderer.views.get(u.id)?.key, token: { id: t.id, dir: t.dir, mode: c.devices.point.mode, key: v?.key, clip: v?.actor.current, hp: t.hp, block: t.s.blockCnt }, errors: q.battle.errors };
    });
    assert.deepEqual(state.errors, []);assert.equal(state.ownerClip, skill === 1 ? 'Skill_1' : 'Skill_2_Loop');assert.equal(state.actorClip, state.ownerClip);
    assert.equal(state.ownerKey, 'operator/' + ID + '/default/' + (['UP', 'LEFT'].includes(facing) ? 'back' : 'front'));
    assert.equal(state.token.key, 'operator/token_10037_mitm_trshrb/default/front');assert.equal(state.token.dir, 'RIGHT');
    assert.equal(state.active, skill === 2);assert.equal(state.token.mode, skill === 1 ? 0 : 3);
    await page.screenshot({ path: dir + label + '-attacking.png' });
    await page.evaluate(() => { publicMitmReview.until('rest');publicMitmReview.advance(1.1); });
    await selectUnit(state.token.id);
    assert.match(await page.$eval('.command-copy', e => e.textContent), /Cherry-3 recovering/);
    assert.equal(await page.evaluate(id => publicMitmReview.renderer.views.get(id)?.actor.current, state.token.id), 'Idle_2');
    await page.screenshot({ path: dir + label + '-recovering.png' });
    await page.evaluate(() => { publicMitmReview.until('idle');publicMitmReview.defeat();publicMitmReview.advance(1.1); });
    const wreckage = await page.evaluate(() => {
      const q = publicMitmReview, c = q.battle.bench['char_4147_mitm'].unit.mem.mitmController;
      return c.devices.all().filter(t => t.mem.mitmMode === 2).map(t => ({ id: t.id, row: t.tileR, col: t.tileC, hp: t.hp, maxHp: t.s.maxHp,
        clip: q.renderer.views.get(t.id)?.actor.current, key: q.renderer.views.get(t.id)?.key }));
    });
    assert.ok(wreckage.length > 0);assert.ok(wreckage.every(t => t.clip === 'Waste' && t.hp === t.maxHp));
    assert.ok(await page.evaluate(() => publicMitmReview.hits.some(h => h.source === publicMitmReview.enemy.id && h.amount > 0)));
    await page.screenshot({ path: dir + label + '-wreckage.png' });
    const waste = wreckage.find(w => w.col > 5) ?? wreckage[0];await selectUnit(waste.id);await press('#retreat');
    assert.equal(await page.evaluate(id => publicMitmReview.battle.units.find(u => u.id === id)?.alive, waste.id), false);
    await press('#deployment [data-id="' + ID + '"]');await press('#retreat');
    const cleanup = await page.evaluate(() => { const q = publicMitmReview, c = q.battle.bench['char_4147_mitm'].unit.mem.mitmController;
      return { stopped: c.stopped, tokens: c.devices.tokens.size, registered: q.battle.regularSummons.has('summon:char_4147_mitm'), handles: c.handles.length + c.devices.handles.length, errors: q.battle.errors }; });
    assert.deepEqual(cleanup, { stopped: true, tokens: 0, registered: false, handles: 0, errors: [] });
    assert.equal(await page.$$eval('#deployment [data-id="summon:char_4147_mitm"]', es => es.length), 0);
    reports.push({ label, state, wreckage, cleanup });await page.close();currentPage = null;
  }
  assert.deepEqual(errors, []);assert.deepEqual(failures, []);
  await writeFile(dir + 'report.json', JSON.stringify({ scope: 'Controlled pinned enemy and 99 DP/no regen; actual public roster, mouse/touch placement, natural SP, enemy attacks, recovery and wreckage; not unmodified stage victory', reports, errors, failures }, null, 2) + '\n');
  console.log(JSON.stringify({ checks: reports.length, errors, failures }));
} catch (error) {
  if (currentPage) { await currentPage.screenshot({ path: dir + 'failure.png' }).catch(() => {});await writeFile(dir + 'failure.json', JSON.stringify({ error: error.stack, reports, errors, failures }, null, 2) + '\n'); }
  throw error;
} finally { await browser.close(); }
