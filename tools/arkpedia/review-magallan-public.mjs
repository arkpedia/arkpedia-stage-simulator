// SPDX-License-Identifier: GPL-3.0-or-later
// Actual public roster/drag/drop/swipe/cast/retreat; natural SP and a labeled
// controlled-target fixture, not an unmodified-stage combat result.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const executablePath = process.env.ARKPEDIA_REVIEW_CHROME;
if (!executablePath) throw Error('Set ARKPEDIA_REVIEW_CHROME and run the port-3182 preview.');
const dir = '.cache/arkpedia/magallan-source/public-browser/';
const ID = 'char_248_mgllan', CARD = 'summon:' + ID, origin = 'http://127.0.0.1:3182';
await mkdir(dir, { recursive: true });
const data = await (await fetch(origin + '/data/arkpedia-mvp.json')).json();
assert.ok(data.operators[ID]);
data.stage.geometry.waves[0].spawns = []; data.stage.battle.initial_dp = 99;
const app = await readFile('public/arkpedia/app.js', 'utf8');
const hook = `
globalThis.publicMagallanReview = {
 get battle(){return battle;}, get renderer(){return renderer;}, hits:[], pulses:[],
 get selection(){return {selected,pending,dragging:dragging&&{over:dragging.over,moved:dragging.moved}};},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();renderer.render(battle,s,battle.drainEvents());drawHud();},
 targets(skill){battle.autoFinish=false;
  this.targetsList=[[2,6], skill===1?[2,6]:skill===2?[3,4]:[2,5]].map(pos=>{
   const t=battle.spawnEnemy('enemy_1007_slime',{pos});
   Object.assign(t.base,{maxHp:1e7,atk:0,def:0,res:0,moveSpeed:1});t.markDirty();void t.s;t.hp=1e7;
   battle.addBuff(t,{key:'qa:pin',flags:{noMove:true,disarm:true}});return t;
  });battle._buildEnemyIndex();
  battle.on('damaged',c=>{if(c.dmg?.tags?.some(t=>t.startsWith('mgllan:')))this.hits.push({source:c.source.defId,tags:c.dmg.tags,amount:c.amount});});
  battle.on('magallanPulse',c=>this.pulses.push({source:c.source.defId,active:c.active,status:c.status,count:c.victims.length}));
  paused=true;drawHud();
 },
 silence(){battle.addBuff(battle.bench['${ID}'].unit,{key:'qa:silence',flags:{silence:true}});drawHud();}
};`;
const browser = await puppeteer.launch({ executablePath, headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const reports = [], errors = [], failedResources = [];
const skills = process.env.ARKPEDIA_REVIEW_SKILL ? [Number(process.env.ARKPEDIA_REVIEW_SKILL)] : [1, 2, 3];
assert.ok(skills.every(s => [1, 2, 3].includes(s)));
const pendingRequests = new Set();
let currentPage;
try {
 for (const skill of skills) {
  const page = await browser.newPage();
  currentPage = page;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) failedResources.push({ url: r.url(), status: r.status() }); });
  page.on('request', r => pendingRequests.add(r.url()));
  page.on('requestfinished', r => pendingRequests.delete(r.url()));
  page.on('requestfailed', r => { pendingRequests.delete(r.url()); failedResources.push({ url: r.url(), error: r.failure()?.errorText }); });
  await page.setViewport({ width: 1280, height: 800 });
  await page.setRequestInterception(true);
  page.on('request', r => {
   const path = new URL(r.url()).pathname;
   if (r.url().startsWith(origin) && path === '/favicon.ico') return r.respond({ status: 204 });
   if (r.url().startsWith(origin) && path === '/arkpedia/app.js')
    return r.respond({ status: 200, contentType: 'text/javascript', body: app + hook });
   if (r.url().startsWith(origin) && path === '/data/arkpedia-mvp.json')
    return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
   return r.continue();
  });
  await page.goto(origin + '/arkpedia/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.roster-item.chosen');
  for (const id of await page.$$eval('.roster-item.chosen', es => es.map(e => e.dataset.id))) {
   await page.click(`.roster-item[data-id="${id}"]`); await page.click('#toggle');
  }
  await page.$eval('#roster-search', (e, name) => {
   e.value = name; e.dispatchEvent(new Event('input', { bubbles: true }));
  }, data.operators[ID].name);
  await page.click(`.roster-item[data-id="${ID}"]`); await page.click('#toggle');
  assert.equal(await page.$eval('#skillId', e => e.options.length), 3);
  await page.select('#skillId', `skchr_mgllan_${skill}`); await page.click('#start');
  await page.waitForFunction(() => window.publicMagallanReview?.battle && document.querySelector('#deployment button'), { timeout: 60000 });
  await page.evaluate(skill => publicMagallanReview.targets(skill), skill);
  async function deploy(id, row, col, facing = 'RIGHT', chooseFacing = true) {
   const card = await page.$(`#deployment [data-id="${id}"]`);
   await card.evaluate(e => e.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
   const box = await card.boundingBox();
   const p = await page.evaluate((row, col) => {
    const r = publicMagallanReview.renderer, p = r.projection.project(col, row, r.heightAt(row, col));
    const box = document.querySelector('#battle-board').getBoundingClientRect();
    return { x: p.x + box.x, y: p.y + box.y };
   }, row, col);
   const notDeployed = () => page.evaluate(id => id.startsWith('summon:')
    ? publicMagallanReview.battle.bench[id.slice(7)].unit.mem.magallanController.deck.own().length === 0
    : !publicMagallanReview.battle.bench[id].unit?.alive, id);
   await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
   await page.mouse.down(); await page.mouse.move(p.x, p.y, { steps: 12 });
   const selection = await page.evaluate(() => publicMagallanReview.selection);
   assert.deepEqual(selection.dragging && { row: selection.dragging.over?.row, col: selection.dragging.over?.col }, { row, col }, JSON.stringify({ id, p, selection }));
   assert.equal(await notDeployed(), true); await page.mouse.up();
   if (chooseFacing) {
    await page.waitForSelector('.facing-picker:not([hidden])'); assert.equal(await notDeployed(), true);
    await page.screenshot({ path: dir + `public-s${skill}-${id.startsWith('summon:') ? 'drone' : 'owner'}-facing.png` });
    const h = await (await page.$('.facing-handle')).boundingBox();
    const x = h.x + h.width / 2, y = h.y + h.height / 2;
    const [dx, dy] = { RIGHT: [65, 0], UP: [0, -65], DOWN: [0, 65], LEFT: [-65, 0] }[facing];
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 8 });
    assert.equal(await notDeployed(), true); await page.mouse.up();
   }
   await page.waitForFunction(id => id.startsWith('summon:')
    ? publicMagallanReview.battle.bench[id.slice(7)].unit.mem.magallanController.deck.own().length === 1
    : publicMagallanReview.battle.bench[id].unit?.alive, {}, id);
  }
  await deploy(ID, 2, 4);
  const initial = await page.evaluate(id => {
   const b = publicMagallanReview.battle, u = b.bench[id].unit, c = u.mem.magallanController;
   return { dp: b.dp, sp: u.skill.sp, cost: u.skill.spCost, index: c.record.index,
    dir: u.dir, stock: c.deck.stock, model: publicMagallanReview.renderer.views.get(u.id).key };
  }, ID);
  assert.equal(initial.index, skill - 1); assert.equal(initial.stock, 5);
  assert.ok(initial.model.endsWith('/front'));
  if (skill === 3) {
   await page.setViewport({ width: 844, height: 390 });
   await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  const [row, col] = skill === 1 ? [2, 5] : skill === 2 ? [3, 4] : [1, 5];
  await deploy(CARD, row, col, skill === 3 ? 'UP' : 'RIGHT', skill === 3);
  await page.evaluate(() => publicMagallanReview.advance(3));
  const drone = await page.evaluate(id => {
   const b = publicMagallanReview.battle, c = b.bench[id].unit.mem.magallanController, t = c.deck.own()[0];
   return { id: t.defId, unitId: t.id, dir: t.dir, atk: t.s.atk, aspd: t.s.aspd,
    model: publicMagallanReview.renderer.views.get(t.id).key, stock: c.deck.stock,
    buildText: document.querySelector('.command-copy').textContent, errors: b.errors };
  }, ID);
  assert.equal(drone.id, `token_10005_mgllan_drone${skill}`); assert.equal(drone.stock, 4);
  assert.equal(drone.dir, skill === 3 ? 'UP' : 'RIGHT');
  assert.ok(drone.model.includes(drone.id)); assert.match(drone.buildText, /E2.*Lv 90/);
  assert.deepEqual(drone.errors, []);
  await page.click(`#deployment [data-id="${ID}"]`);
  await page.evaluate(() => publicMagallanReview.silence());
  await page.evaluate(id => {
   const u = publicMagallanReview.battle.bench[id].unit;
   publicMagallanReview.advance(Math.max(0, u.skill.spCost - u.skill.sp) + 1);
  }, ID);
  await page.waitForFunction(() => document.querySelector('#skill')?.classList.contains('ready') && !document.querySelector('#skill').disabled);
  await page.waitForFunction(() => [...document.querySelectorAll('.operator-skill .skill-icon, #field-actions #skill img')]
   .every(e => e.complete && e.naturalWidth > 0), { timeout: 30000 });
  await page.evaluate(() => {
   const e = document.createElement('div'); e.textContent = 'CONTROLLED QA · natural SP / pinned targets / 99 DP';
   e.style.cssText = 'position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:12px sans-serif;pointer-events:none';
   document.querySelector('.workspace').append(e);
  });
  await page.screenshot({ path: dir + `public-s${skill}-ready.png` });
  await page.click('#skill'); await page.evaluate(() => publicMagallanReview.advance(4));
  const active = await page.evaluate(id => {
   const b = publicMagallanReview.battle, u = b.bench[id].unit, c = u.mem.magallanController, t = c.deck.own()[0];
   return { active: u.skill.active, atk: t.s.atk, aspd: t.s.aspd, pulses: publicMagallanReview.pulses,
    hits: publicMagallanReview.hits, errors: b.errors };
  }, ID);
  assert.equal(active.active, true); assert.deepEqual(active.errors, []);
  assert.ok(active.hits.some(h => h.source === ID));
  if (skill === 1) assert.ok(active.pulses.some(p => p.source === drone.id && p.active && p.status === 'bind' && p.count));
  if (skill === 2) { assert.ok(active.aspd > drone.aspd); assert.ok(active.hits.some(h => h.tags.includes('mgllan:drone2:active'))); }
  if (skill === 3) { assert.ok(active.atk > drone.atk); assert.ok(active.hits.some(h => h.tags.includes('mgllan:drone3:active'))); }
  await page.screenshot({ path: dir + `public-s${skill}-active.png` });
  await page.evaluate(() => publicMagallanReview.advance(12));
  const recycled = await page.evaluate(id => {
   const b = publicMagallanReview.battle, u = b.bench[id].unit, c = u.mem.magallanController;
   return { active: u.skill.active, aliveDrones: c.deck.own().length, stock: c.deck.stock,
    cooldown: c.deck.readyAt - b.time, errors: b.errors };
  }, ID);
  assert.equal(recycled.active, false); assert.equal(recycled.aliveDrones, 0); assert.equal(recycled.stock, 5);
  assert.ok(recycled.cooldown > 0); assert.deepEqual(recycled.errors, []);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  if (skill === 3) {
   await page.screenshot({ path: dir + 'public-s3-recycled-landscape.png' });
   await page.setViewport({ width: 390, height: 844 });
   await page.waitForFunction(() => !document.querySelector('#orientation-gate').hidden);
   const before = await page.evaluate(() => publicMagallanReview.battle.time);
   await page.evaluate(() => new Promise(r => setTimeout(r, 150)));
   assert.equal(await page.evaluate(() => publicMagallanReview.battle.time), before);
   await page.screenshot({ path: dir + 'public-s3-portrait.png' });
   await page.setViewport({ width: 1280, height: 800 });
   await page.waitForFunction(() => document.querySelector('#orientation-gate').hidden);
  }
  await page.click(`#deployment [data-id="${ID}"]`); await page.click('#retreat');
  const cleanup = await page.evaluate(id => {
   const c = publicMagallanReview.battle.bench[id].unit.mem.magallanController;
   return { stopped: c.stopped, handles: c.handles.length, stock: c.deck.stock, errors: c.b.errors };
  }, ID);
  assert.deepEqual(cleanup, { stopped: true, handles: 0, stock: 0, errors: [] });
  let redeployment = null;
  if (skill === 3) {
   await page.evaluate(() => publicMagallanReview.advance(75));
   await deploy(ID, 2, 4, 'UP'); await page.evaluate(() => publicMagallanReview.advance(1));
   redeployment = await page.evaluate(id => {
    const b = publicMagallanReview.battle, u = b.bench[id].unit, c = u.mem.magallanController;
    return { dir: u.dir, model: publicMagallanReview.renderer.views.get(u.id).key, stock: c.deck.stock, errors: b.errors };
   }, ID);
   assert.equal(redeployment.dir, 'UP'); assert.ok(redeployment.model.endsWith('/back'));
   assert.equal(redeployment.stock, 5); assert.deepEqual(redeployment.errors, []);
   await page.screenshot({ path: dir + 'public-s3-back.png' }); await page.click('#retreat');
  }
  reports.push({ skill, initial, drone, active, recycled, cleanup, redeployment }); await page.close();
 }
 assert.deepEqual(errors, []); assert.deepEqual(failedResources, []);
 const report = { driver: 'Chromium software WebGL2', publicCommands: true, dragDropAndSwipe: true,
  controlledTarget: true, forcedSp: false, skills, operators: Object.keys(data.operators).length,
  frameParity: false, reports, errors, failedResources };
 await writeFile(dir + (skills.length === 3 ? 'public-browser-review.json' : `public-browser-s${skills[0]}-review.json`), JSON.stringify(report, null, 2) + '\n');
 console.log(JSON.stringify({ skills: reports.map(r => r.skill), operators: report.operators, errors, failedResources }));
} catch (error) {
 if (currentPage && !currentPage.isClosed()) {
  await currentPage.screenshot({ path: dir + 'failure.png' });
  console.error(JSON.stringify(await currentPage.evaluate(() => ({
   state: publicMagallanReview.selection, viewport: [innerWidth, innerHeight],
   error: document.querySelector('#prep-error')?.textContent,
  }))));
  console.error(JSON.stringify({ pendingRequests: [...pendingRequests], failedResources, errors }));
 }
 throw error;
} finally { await browser.close(); }
