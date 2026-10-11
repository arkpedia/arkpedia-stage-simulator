// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled targets/starting DP, actual public drag/drop/swipe and natural SP.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const executablePath = process.env.ARKPEDIA_REVIEW_CHROME;
if (!executablePath) throw Error('Set ARKPEDIA_REVIEW_CHROME and run the port-3182 preview.');
const dir = '.cache/arkpedia/exusiai-covenant-source/public-browser/';
const ID = 'char_1041_angel2', ALLY = 'char_289_gyuki', CARD = 'summon:' + ID;
const origin = 'http://127.0.0.1:3182';
await mkdir(dir, { recursive: true });
const data = await (await fetch(origin + '/data/arkpedia-mvp.json')).json();
assert.ok(data.operators[ID]);
data.stage.geometry.waves[0].spawns = []; data.stage.battle.initial_dp = 99;
const app = await readFile('public/arkpedia/app.js', 'utf8');
const hook = `
globalThis.publicCovenantReview = {
 get battle(){return battle;}, get renderer(){return renderer;}, hits:[], deliveries:[],
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();renderer.render(battle,s,battle.drainEvents());drawHud();},
 target(){battle.autoFinish=false;battle.rng=()=>.99;
  const t=battle.spawnEnemy('enemy_1007_slime',{pos:[2,6]});
  Object.assign(t.base,{maxHp:1e7,atk:0,def:0,res:0,moveSpeed:0});t.markDirty();void t.s;t.hp=1e7;
  battle.addBuff(t,{key:'qa:pin',flags:{noMove:true,disarm:true}});battle._buildEnemyIndex();
  battle.on('damaged',c=>{if(c.dmg?.tags?.some(t=>t.startsWith('angel2:')))this.hits.push({tags:c.dmg.tags,amount:c.amount});});
  battle.on('exusiaiCovenantDelivery',c=>this.deliveries.push({id:c.unit.defId,dir:c.unit.dir,row:c.unit.tileR,col:c.unit.tileC,sp:c.unit.skill.sp,initialSp:c.unit.skill.initSp}));
  paused=true;drawHud();return t.id;},
 silence(){battle.addBuff(battle.bench['${ID}'].unit,{key:'qa:silence',flags:{silence:true}});drawHud();}
};`;
const browser = await puppeteer.launch({ executablePath, headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const reports = [], errors = [], failedResources = [];
try {
 for (const skill of [1, 2, 3]) {
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) failedResources.push({ url: r.url(), status: r.status() }); });
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
  for (const id of [ID, ALLY]) {
   await page.$eval('#roster-search', (e, name) => {
    e.value = name; e.dispatchEvent(new Event('input', { bubbles: true }));
   }, data.operators[id].name);
   await page.click(`.roster-item[data-id="${id}"]`); await page.click('#toggle');
  }
  await page.$eval('#roster-search', (e, name) => {
   e.value = name; e.dispatchEvent(new Event('input', { bubbles: true }));
  }, data.operators[ID].name);
  await page.click(`.roster-item[data-id="${ID}"]`);
  assert.equal(await page.$eval('#skillId', e => e.options.length), 3);
  await page.select('#skillId', `skchr_angel2_${skill}`); await page.click('#start');
  await page.waitForFunction(() => window.publicCovenantReview?.battle && document.querySelector('#deployment button'), { timeout: 60000 });
  await page.evaluate(() => publicCovenantReview.target());
  async function deploy(id, row, col, dir = 'RIGHT') {
   const card = await page.$(`#deployment [data-id="${id}"]`);
   await card.evaluate(e => e.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
   const box = await card.boundingBox();
   const p = await page.evaluate((row, col) => {
    const r = publicCovenantReview.renderer, p = r.projection.project(col, row, r.heightAt(row, col));
    const box = document.querySelector('#battle-board').getBoundingClientRect();
    return { x: p.x + box.x, y: p.y + box.y };
   }, row, col);
   await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
   await page.mouse.down(); await page.mouse.move(p.x, p.y, { steps: 12 }); await page.mouse.up();
   await page.waitForSelector('.facing-picker:not([hidden])');
   const notDeployed = () => page.evaluate(id => id.startsWith('summon:')
    ? !publicCovenantReview.battle.bench[id.slice(7)].unit.mem.exusiaiCovenantController.coordinates.token?.alive
    : !publicCovenantReview.battle.bench[id].unit?.alive, id);
   assert.equal(await notDeployed(), true);
   const handle = await page.$('.facing-handle'), h = await handle.boundingBox();
   const x = h.x + h.width / 2, y = h.y + h.height / 2;
   const [dx, dy] = { RIGHT: [65, 0], UP: [0, -65], DOWN: [0, 65], LEFT: [-65, 0] }[dir];
   await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 8 });
   assert.equal(await notDeployed(), true); await page.mouse.up();
   await page.waitForFunction(id => id.startsWith('summon:')
    ? publicCovenantReview.battle.bench[id.slice(7)].unit.mem.exusiaiCovenantController.coordinates.token?.alive
    : publicCovenantReview.battle.bench[id].unit?.alive, {}, id);
  }
  if (skill === 2) { await deploy(ALLY, 2, 5); await page.evaluate(() => publicCovenantReview.advance(2)); }
  await deploy(ID, 2, 4);
  const initial = await page.evaluate(id => {
   const b = publicCovenantReview.battle, u = b.bench[id].unit;
   return { dp: b.dp, sp: u.skill.sp, index: u.mem.exusiaiCovenantController.record.index, dir: u.dir, tags: u.def.tags };
  }, ID);
  assert.equal(initial.index, skill - 1); assert.ok(initial.tags.includes('laterano'));
  await page.evaluate(() => publicCovenantReview.silence());
  await page.evaluate(id => {
   const u = publicCovenantReview.battle.bench[id].unit;
   publicCovenantReview.advance(Math.max(0, u.skill.spCost - u.skill.sp) + 1);
  }, ID);
  if (skill !== 1) {
   await page.waitForFunction(() => document.querySelector('#skill') && !document.querySelector('#skill').disabled);
   await page.click('#skill');
  }
  await page.evaluate(() => publicCovenantReview.advance(2));
  const active = await page.evaluate(id => {
   const b = publicCovenantReview.battle, u = b.bench[id].unit, c = u.mem.exusiaiCovenantController;
   return { ammo: u.skill.ammoLeft, active: u.skill.active, clip: u.mem.regularFormVisual.clip,
    model: publicCovenantReview.renderer.views.get(u.id).key, hits: publicCovenantReview.hits,
    loan: c.s2?.loan?.target?.defId ?? null, errors: b.errors };
  }, ID);
  assert.ok(active.model.endsWith('/front')); assert.deepEqual(active.errors, []);
  assert.equal(active.active, true);
  assert.ok(active.hits.some(h => h.tags.includes(skill === 1 ? 'angel2:s1-normal' : skill === 2 ? 'angel2:s2' : 'angel2:s3')));
  if (skill === 2) assert.equal(active.loan, ALLY);
  await page.waitForFunction(() => [...document.querySelectorAll('.operator-skill .skill-icon, #field-actions #skill img')]
   .every(e => e.complete && e.naturalWidth > 0), { timeout: 30000 });
  await page.evaluate(() => {
   const e = document.createElement('div'); e.textContent = 'CONTROLLED QA · natural SP / pinned target / 99 DP';
   e.style.cssText = 'position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:12px sans-serif;pointer-events:none';
   document.querySelector('.workspace').append(e);
  });
  await page.screenshot({ path: dir + `public-s${skill}-desktop.png` });
  let coordinates = null;
  if (skill === 3) {
   await page.setViewport({ width: 844, height: 390 });
   await page.click('#skill'); await page.evaluate(() => publicCovenantReview.advance(2));
   assert.equal(await page.evaluate(id => publicCovenantReview.battle.bench[id].unit.skill.active, ID), false);
   await deploy(CARD, 2, 5, 'UP'); await page.evaluate(() => publicCovenantReview.advance(.1));
   const marker = await page.evaluate(id => {
    const u = publicCovenantReview.battle.bench[id].unit.mem.exusiaiCovenantController.coordinates.token;
    return { id: u.id, dir: u.dir, hiddenHp: u.mem.regularHideHp, model: publicCovenantReview.renderer.views.get(u.id).key };
   }, ID);
   assert.equal(marker.dir, 'UP'); assert.equal(marker.hiddenHp, true);
   assert.ok(marker.model.includes('token_10056_angel2_target'));
   await page.screenshot({ path: dir + 'public-coordinates-landscape.png' });
   await page.click(`#deployment [data-id="${ID}"]`);
   await page.evaluate(id => {
    const u = publicCovenantReview.battle.bench[id].unit;
    publicCovenantReview.advance(u.skill.spCost - u.skill.sp + 1);
   }, ID);
   await page.click('#skill'); await page.evaluate(() => publicCovenantReview.advance(3));
   coordinates = await page.evaluate(id => {
    const b = publicCovenantReview.battle, c = b.bench[id].unit.mem.exusiaiCovenantController.coordinates;
    return { deliveries: publicCovenantReview.deliveries, token: c.token?.alive ?? false,
     cooldown: c.readyAt - b.time, stock: c.stock, allyModel: publicCovenantReview.renderer.views.get(b.bench['char_289_gyuki'].unit.id).key,
     errors: b.errors };
   }, ID);
   assert.equal(coordinates.deliveries.length, 1);
   const delivered = coordinates.deliveries[0];
   assert.equal(delivered.id, ALLY); assert.equal(delivered.dir, 'UP');
   assert.equal(delivered.row, 2); assert.equal(delivered.col, 5);
   assert.equal(delivered.sp, delivered.initialSp + 6);
   assert.equal(coordinates.token, false); assert.ok(coordinates.cooldown > 60);
   assert.ok(coordinates.allyModel.endsWith('/back')); assert.deepEqual(coordinates.errors, []);
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
   await page.screenshot({ path: dir + 'public-delivery-landscape.png' });
   await page.setViewport({ width: 390, height: 844 });
   await page.waitForFunction(() => !document.querySelector('#orientation-gate').hidden);
   const before = await page.evaluate(() => publicCovenantReview.battle.time);
   await page.evaluate(() => new Promise(r => setTimeout(r, 150)));
   assert.equal(await page.evaluate(() => publicCovenantReview.battle.time), before);
   await page.screenshot({ path: dir + 'public-s3-portrait.png' });
   await page.setViewport({ width: 1280, height: 800 });
   await page.waitForFunction(() => document.querySelector('#orientation-gate').hidden);
  }
  await page.click(`#deployment [data-id="${ID}"]`); await page.click('#retreat');
  const cleanup = await page.evaluate(id => {
   const c = publicCovenantReview.battle.bench[id].unit.mem.exusiaiCovenantController;
   return { stopped: c.stopped, handles: c.handles.length, errors: c.b.errors };
  }, ID);
  assert.deepEqual(cleanup, { stopped: true, handles: 0, errors: [] });
  let redeployment = null;
  if (skill === 3) {
   await page.evaluate(() => {
    publicCovenantReview.advance(75);
    const t = publicCovenantReview.battle.enemies[0];
    t.x = 4; t.y = 3; t.tileR = 3; t.tileC = 4;
    publicCovenantReview.battle._buildEnemyIndex();
   });
   await deploy(ID, 2, 4, 'UP');
   await page.evaluate(id => {
    const u = publicCovenantReview.battle.bench[id].unit;
    publicCovenantReview.advance(u.skill.spCost - u.skill.sp + 1);
   }, ID);
   await page.click('#skill'); await page.evaluate(() => publicCovenantReview.advance(1));
   redeployment = await page.evaluate(id => {
    const b = publicCovenantReview.battle, u = b.bench[id].unit;
    const c = u.mem.exusiaiCovenantController;
    return { dir: u.dir, model: publicCovenantReview.renderer.views.get(u.id).key,
     clip: u.mem.regularFormVisual.clip, active: u.skill.active,
     freshCoordinates: c.coordinates.stock === 1 && c.coordinates.deliveries === 0,
     errors: b.errors };
   }, ID);
   assert.equal(redeployment.dir, 'UP'); assert.ok(redeployment.model.endsWith('/back'));
   assert.equal(redeployment.clip, 'Skill_3_Loop'); assert.equal(redeployment.active, true);
   assert.equal(redeployment.freshCoordinates, true); assert.deepEqual(redeployment.errors, []);
   await page.screenshot({ path: dir + 'public-s3-back.png' });
   await page.click('#skill'); await page.click('#retreat');
  }
  reports.push({ skill, initial, active, coordinates, cleanup, redeployment }); await page.close();
 }
 assert.deepEqual(errors, []); assert.deepEqual(failedResources, []);
 const report = { driver: 'Chromium software WebGL2', publicCommands: true, dragDropAndSwipe: true,
  controlledTarget: true, forcedSp: false, operators: Object.keys(data.operators).length,
  frameParity: false, reports, errors, failedResources };
 await writeFile(dir + 'public-browser-review.json', JSON.stringify(report, null, 2) + '\n');
 console.log(JSON.stringify(report));
} finally { await browser.close(); }
