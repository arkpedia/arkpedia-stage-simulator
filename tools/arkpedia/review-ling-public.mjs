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
const dir = '.cache/arkpedia/ling-source/public-browser/';
const ID = 'char_2023_ling', CARD = 'summon:' + ID, origin = 'http://127.0.0.1:3182';
await mkdir(dir, { recursive: true });
const data = await (await fetch(origin + '/data/arkpedia-mvp.json')).json();
assert.ok(data.operators[ID]);
data.stage.geometry.waves[0].spawns = []; data.stage.battle.initial_dp = 99;
const app = await readFile('public/arkpedia/app.js', 'utf8');
const hook = `
globalThis.publicLingReview = {
 get battle(){return battle;}, get renderer(){return renderer;}, hits:[], pulses:[],
 get selection(){return {selected,pending,dragging:dragging&&{over:dragging.over,moved:dragging.moved}};},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();renderer.render(battle,s,battle.drainEvents());drawHud();},
 targets(skill){battle.autoFinish=false;
  this.targetsList=[[2,5],[2,6],[3,5]].map(pos=>{
   const t=battle.spawnEnemy('enemy_1007_slime',{pos});
   Object.assign(t.base,{maxHp:1e7,atk:0,def:0,res:0,moveSpeed:1});t.markDirty();void t.s;t.hp=1e7;
   battle.addBuff(t,{key:'qa:pin',flags:{noMove:true,disarm:true}});return t;
  });battle._buildEnemyIndex();
  battle.on('damaged',c=>{if(c.dmg?.tags?.some(t=>t.startsWith('ling:')))this.hits.push({source:c.source.defId,tags:c.dmg.tags,amount:c.amount});});
  battle.on('lingFusion',c=>this.pulses.push({type:'fusion',id:c.survivor.id,slots:c.survivor.deploymentSlotCost}));
  battle.on('lingAuraPulse',c=>this.pulses.push({type:'aura',id:c.unit.id}));
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
 for (const mobile of [false, true]) for (const skill of skills) {
  const page = await browser.newPage();
  currentPage = page;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) failedResources.push({ url: r.url(), status: r.status() }); });
  page.on('request', r => pendingRequests.add(r.url()));
  page.on('requestfinished', r => pendingRequests.delete(r.url()));
  page.on('requestfailed', r => { pendingRequests.delete(r.url()); failedResources.push({ url: r.url(), error: r.failure()?.errorText }); });
  const label = `${mobile ? 'mobile' : 'desktop'}-s${skill}`;
  await page.setViewport(mobile ? { width: 844, height: 390, isMobile: true, hasTouch: true } : { width: 1280, height: 800 });
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
  await page.select('#skillId', `skchr_ling_${skill}`); await page.click('#start');
  await page.waitForFunction(() => window.publicLingReview?.battle && document.querySelector('#deployment button'), { timeout: 60000 });
  async function press(selector) {
    if (!mobile) return page.click(selector);
    const element=await page.$(selector);assert.ok(element,selector);
    await element.evaluate(e=>e.scrollIntoView({block:'nearest',inline:'nearest'}));
    const box=await element.boundingBox();await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
  }
  await page.evaluate(skill => publicLingReview.targets(skill), skill);
  await page.evaluate(() => {
    const e=document.createElement('div');e.textContent='CONTROLLED QA · natural SP / pinned targets / 99 DP';
    e.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:12px sans-serif;pointer-events:none';
    document.querySelector('.workspace').append(e);
  });
  async function deploy(id, row, col, facing = 'RIGHT', chooseFacing = true) {
   const card = await page.$(`#deployment [data-id="${id}"]`);
   await card.evaluate(e => e.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
   const box = await card.boundingBox();
   const p = await page.evaluate((row, col) => {
    const r = publicLingReview.renderer, p = r.projection.project(col, row, r.heightAt(row, col));
    const box = document.querySelector('#battle-board').getBoundingClientRect();
    return { x: p.x + box.x, y: p.y + box.y };
   }, row, col);
   const beforeCount = await page.evaluate(id => id.startsWith('summon:') ? publicLingReview.battle.bench[id.slice(7)].unit.mem.lingController.deck.own().length : 0, id);
   const notDeployed = () => page.evaluate((id, count) => id.startsWith('summon:')
    ? publicLingReview.battle.bench[id.slice(7)].unit.mem.lingController.deck.own().length === count
    : !publicLingReview.battle.bench[id].unit?.alive, id, beforeCount);
   async function down(x, y) { if (mobile) await page.touchscreen.touchStart(x, y); else { await page.mouse.move(x,y); await page.mouse.down(); } }
   async function move(x, y) { if (mobile) await page.touchscreen.touchMove(x,y); else await page.mouse.move(x,y,{steps:12}); }
   async function up() { if (mobile) await page.touchscreen.touchEnd(); else await page.mouse.up(); }
   await down(box.x + box.width / 2, box.y + box.height / 2); await move(p.x, p.y);
   const selection = await page.evaluate(() => publicLingReview.selection);
   assert.deepEqual(selection.dragging && { row: selection.dragging.over?.row, col: selection.dragging.over?.col }, { row, col }, JSON.stringify({ id, p, selection }));
   assert.equal(await notDeployed(), true); await up();
   if (chooseFacing) {
    await page.waitForSelector('.facing-picker:not([hidden])'); assert.equal(await notDeployed(), true);
    await page.screenshot({ path: dir + `public-${label}-${id.startsWith('summon:') ? 'dragon' : 'owner'}-facing.png` });
    const h = await (await page.$('.facing-handle')).boundingBox();
    const x = h.x + h.width / 2, y = h.y + h.height / 2;
    const [dx, dy] = { RIGHT: [65, 0], UP: [0, -65], DOWN: [0, 65], LEFT: [-65, 0] }[facing];
    await down(x, y); await move(x + dx, y + dy);
    assert.equal(await notDeployed(), true); await up();
   }
   await page.waitForFunction((id,count) => id.startsWith('summon:')
    ? publicLingReview.battle.bench[id.slice(7)].unit.mem.lingController.deck.own().length === count + 1
    : publicLingReview.battle.bench[id].unit?.alive, {}, id, beforeCount);
  }
  await deploy(ID, 2, 4);
  await page.evaluate(() => publicLingReview.advance(1.1));
  await deploy(CARD, skill === 2 ? 4 : 3, 4);
  await page.evaluate(() => publicLingReview.advance(3));
  let extra;
  if (skill === 2) {
    await page.evaluate(() => publicLingReview.advance(10)); await deploy(CARD, 4, 6);
    extra = await page.evaluate(id => {
      const c=publicLingReview.battle.bench[id].unit.mem.lingController, [low,half]=c.deck.own();
      low.hp=low.s.maxHp*.49;half.hp=half.s.maxHp*.5;return {low:low.id,half:half.id,stock:c.deck.stock};
    },ID);
  }
  if (skill === 3) {
    await page.evaluate(() => publicLingReview.advance(20)); await deploy(CARD, 3, 5, 'LEFT');
    await page.evaluate(() => publicLingReview.advance(.3));
    extra = await page.evaluate(id => {
      const b=publicLingReview.battle,c=b.bench[id].unit.mem.lingController,t=c.deck.own()[0];
      return {id:t.id,count:c.deck.own().length,slots:t.deploymentSlotCost,totalSlots:b.deployedSlots(),clip:t.mem.regularFormVisual.clip,die:t.mem.regularDeathVisual.die};
    },ID);
    assert.equal(extra.count,1);assert.equal(extra.slots,2);assert.equal(extra.totalSlots,3);
    assert.ok(['Idle_02','Attack_02'].includes(extra.clip));assert.equal(extra.die,'Die_02');
  }
  await press(`#deployment [data-id="${ID}"]`);
  await page.evaluate(() => publicLingReview.silence());
  await page.evaluate(id => {
    const u=publicLingReview.battle.bench[id].unit;
    publicLingReview.advance(Math.max(0,u.skill.spCost-u.skill.sp)+1);
  },ID);
  assert.equal(await page.$eval('#skill',e=>e.disabled),false);
  await page.screenshot({path:dir+`public-${label}-ready.png`});
  await press('#skill');
  await page.evaluate(() => publicLingReview.advance(.6));
  const active=await page.evaluate(id=>{
    const b=publicLingReview.battle,u=b.bench[id].unit,c=u.mem.lingController;
    return {active:u.skill.active,stock:c.deck.stock,sp:u.skill.sp,atk:u.s.atk,hits:publicLingReview.hits,pulses:publicLingReview.pulses,
      tokens:c.deck.own().map(t=>({id:t.id,atk:t.s.atk,baseAtk:t.base.atk,clip:t.mem.regularFormVisual.clip,actorClip:publicLingReview.renderer.views.get(t.id)?.actor.current,slots:t.deploymentSlotCost})),errors:b.errors};
  },ID);
  assert.equal(active.active,true);assert.deepEqual(active.errors,[]);
  await page.screenshot({path:dir+`public-${label}-active.png`});
  if (skill === 2) {
    await page.evaluate(() => publicLingReview.advance(.7));
    const recycled=await page.evaluate(id=>{const c=publicLingReview.battle.bench[id].unit.mem.lingController;
      return {ids:c.deck.own().map(t=>t.id),stock:c.deck.stock,active:c.u.skill.active,hits:publicLingReview.hits};},ID);
    assert.equal(recycled.active,false);assert.deepEqual(recycled.ids,[extra.half]);assert.equal(recycled.stock,extra.stock+1);
    assert.ok(recycled.hits.some(h=>h.tags.includes('ling:s2')));
  } else {
    if(skill===1) assert.ok(active.tokens[0].atk>active.tokens[0].baseAtk);
    else { assert.ok(active.pulses.some(p=>p.type==='aura')); assert.ok(['Idle_02','Attack_02'].includes(active.tokens[0].actorClip)); }
    await page.evaluate(() => publicLingReview.advance(35));
    assert.equal(await page.evaluate(id=>publicLingReview.battle.bench[id].unit.skill.active,ID),false);
  }
  // Check the remaining token through the actual focus and retreat controls.
  const remaining=await page.evaluate(id=>publicLingReview.battle.bench[id].unit.mem.lingController.deck.own()[0].id,ID);
  const focus = await page.evaluate(id => {
    const t=publicLingReview.battle.units.find(t=>t.id===id),r=publicLingReview.renderer;
    const p=r.projection.project(t.tileC,t.tileR,r.heightAt(t.tileR,t.tileC));
    const box=document.querySelector('#battle-board').getBoundingClientRect();return {x:box.x+p.x,y:box.y+p.y};
  },remaining);
  if(mobile) await page.touchscreen.tap(focus.x,focus.y); else await page.mouse.click(focus.x,focus.y);
  assert.equal(await page.evaluate(()=>publicLingReview.selection.selected),`token:${remaining}`);
  if(skill===3) assert.match(await page.$eval('.command-copy',e=>e.textContent),/2 deployment slots/);
  await page.screenshot({path:dir+`public-${label}-focused.png`});
  await press('#retreat');
  if(skill===3) await page.waitForFunction(id=>publicLingReview.renderer.views.get(id)?.actor.current==='Die_02',{},remaining);
  const removed=await page.evaluate(id=>{const b=publicLingReview.battle,t=b.units.find(t=>t.id===id),v=publicLingReview.renderer.views.get(id);
    return {alive:t.alive,slots:b.deployedSlots(),death:t.mem.regularDeathVisual,clip:v?.actor.current,duration:v?.deathDuration};},remaining);
  assert.equal(removed.alive,false);assert.equal(removed.slots,1);
  if(skill===3){assert.equal(removed.clip,'Die_02');assert.equal(removed.duration,1);}
  const snapshots={label,skill,mobile,extra,active,removed};reports.push(snapshots);
  await press(`#deployment [data-id="${ID}"]`); await press('#retreat');
  assert.equal(await page.evaluate(id=>publicLingReview.battle.bench[id].unit.mem.lingController.stopped,ID),true);
  await page.close();
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failedResources,[]);
 const report={fixture:'Actual public roster and controls on original 0-1 tiles with empty waves, 99 initial DP, pinned durable targets and natural SP; not an unmodified stage battle.',operators:Object.keys(data.operators).length,reports,errors,failedResources};
 await writeFile(dir+'public-browser-review.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({cases:reports.map(r=>r.label),operators:report.operators,errors,failedResources}));
} catch(error) {
 if(currentPage&&!currentPage.isClosed()) {
  await currentPage.screenshot({path:dir+'failure.png'});
  console.error(JSON.stringify(await currentPage.evaluate(()=>({state:publicLingReview.selection,viewport:[innerWidth,innerHeight],error:document.querySelector('#prep-error')?.textContent}))));
 }
 throw error;
} finally {await browser.close();}
