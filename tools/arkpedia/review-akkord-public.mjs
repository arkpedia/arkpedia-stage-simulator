// SPDX-License-Identifier: GPL-3.0-or-later
// Real public roster, mouse/touch drag/drop, separate facing swipe and native playback.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const executablePath = process.env.ARKPEDIA_REVIEW_CHROME;
if (!executablePath) throw Error('Set ARKPEDIA_REVIEW_CHROME and run port 3182');
const origin = 'http://127.0.0.1:3182', out = '.cache/arkpedia/akkord-source/public-browser/';
const ID = 'char_4051_akkord', ALLY = 'char_208_melan';
const data = await (await fetch(origin + '/data/arkpedia-mvp.json')).json();
assert.equal(data.operators[ID].name, 'Akkord'); assert.equal(data.operators[ID].sourceChannel, 'cn');
data.stage.geometry.waves[0].spawns = []; data.stage.battle.initial_dp = 99; data.stage.battle.dp_per_second = 0;
const app = await readFile('public/arkpedia/app.js', 'utf8');
const hook = `
globalThis.akkordReview={get battle(){return battle;},get renderer(){return renderer;},hits:[],attacks:[],
 get owner(){return battle.bench['${ID}'].unit;},get controller(){return this.owner.mem.akkord;},
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){battle.autoFinish=false;battle.timeLimit=1000;paused=true;
  battle.on('damaged',x=>{if(x.source?.defId==='${ID}')this.hits.push({tags:x.dmg.tags,amount:x.amount,isSkill:x.dmg.isSkill,attackId:x.dmg.attackId});});
  battle.on('attack',x=>{if(x.attacker?.defId==='${ID}')this.attacks.push(x.targets.map(t=>t.id));});
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / 99 DP / empty waves / pinned target';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 target(row){const t=battle.spawnEnemy('enemy_1007_slime',{pos:[row,6]});Object.assign(t.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});t.markDirty();t.hp=t.s.maxHp;
  battle.addBuff(t,{key:'qa:pin',flags:{noMove:true,disarm:true,unblockable:true}});battle._buildEnemyIndex();},
 ready(skill){const end=battle.time+90;const done=()=>skill===1?this.hits.some(h=>h.isSkill):skillHud(this.owner.skill).canActivate;
  while(!done()&&battle.time<end)battle.step();if(!done())throw Error('Natural SP did not become ready');this.render();},
 active(){const end=battle.time+8;while(!this.hits.some(h=>h.tags.includes('akkord:burst'))&&battle.time<end)battle.step();this.render();},
 playback(skill){const expected=skill===1?(this.owner.dir==='DOWN'?'Attack_Down':'Attack'):(this.owner.dir==='DOWN'?'Skill_Down_2_Loop':'Skill_2_Loop'),samples=[];
  let previous=this.owner.mem.regularFormVisual;const end=battle.time+12;
  while(samples.length<2&&battle.time<end){battle.step();this.render();const visual=this.owner.mem.regularFormVisual;
   if(visual!==previous&&visual?.clip===expected){const track=renderer.views.get(this.owner.id)?.actor.spine.state.tracks[0];
    samples.push({time:battle.time,requested:expected,played:track?.animation.name,trackTime:track?.trackTime,playId:visual.playId});}previous=visual;}return samples;},
 snapshot(){const u=this.owner,v=renderer.views.get(u.id);return{time:battle.time,slots:battle.deployedSlots(),sp:u.skill.spTotal,active:u.skill.active,
  activations:u.skill.activations,stopped:this.controller.stopped,hits:this.hits,attacks:this.attacks,hud:skillHud(u.skill),
  owner:{row:u.tileR,col:u.tileC,model:v?.key,requested:u.mem.regularFormVisual?.clip,track:v?.actor.spine.state.tracks[0]?.animation.name},
  errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
await mkdir(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
const reports = [], errors = [], failedResources = []; let captures = 0;
try {
  for (const mobile of [false, true]) for (const skill of [1, 2]) for (const dir of ['DOWN', 'UP']) {
    const label = `${mobile ? 'phone' : 'desktop'}-s${skill}-${dir.toLowerCase()}`, page = await browser.newPage();
    page.on('pageerror', e => errors.push({ label, error: String(e) }));
    page.on('requestfailed', r => failedResources.push({ label, url: r.url(), error: r.failure()?.errorText }));
    page.on('response', r => { if (r.status() >= 400) failedResources.push({ label, url: r.url(), status: r.status() }); });
    await page.setViewport(mobile ? { width: 844, height: 390, isMobile: true, hasTouch: true } : { width: 1280, height: 800 });
    await page.setRequestInterception(true);
    page.on('request', r => {
      const path = new URL(r.url()).pathname;
      if (path === '/favicon.ico') return r.respond({ status: 204 });
      if (r.url().startsWith(origin) && path === '/arkpedia/app.js') return r.respond({ status: 200, contentType: 'text/javascript', body: app + hook });
      if (r.url().startsWith(origin) && path === '/data/arkpedia-mvp.json') return r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
      return r.continue();
    });
    const capture = async suffix => { await page.screenshot({ path: out + label + '-' + suffix + '.png' }); captures++; };
    const drag = async (from, to) => {
      if (mobile) { await page.touchscreen.touchStart(from.x, from.y); await page.touchscreen.touchMove(to.x, to.y); await page.touchscreen.touchEnd(); }
      else { await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 12 }); await page.mouse.up(); }
    };
    const tile = async (row, col) => page.evaluate((r, c) => {
      const a = akkordReview.renderer, p = a.projection.project(c, r, a.heightAt(r, c));
      const box = document.querySelector('#battle-board').getBoundingClientRect(); return { x: p.x + box.x, y: p.y + box.y };
    }, row, col);
    const deploy = async (id, row, col, facing) => {
      const box = await (await page.$('#deployment [data-id="' + id + '"]')).boundingBox();
      await drag({ x: box.x + box.width / 2, y: box.y + box.height / 2 }, await tile(row, col));
      await page.waitForSelector('.facing-picker:not([hidden])');
      assert.equal(await page.evaluate(id => !!akkordReview.battle.bench[id].unit?.alive, id), false);
      const handle = await (await page.$('.facing-handle')).boundingBox();
      const x = handle.x + handle.width / 2, y = handle.y + handle.height / 2, dy = facing === 'UP' ? -65 : 65;
      if (mobile) { await page.touchscreen.touchStart(x, y); await page.touchscreen.touchMove(x, y + dy); }
      else { await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y + dy, { steps: 8 }); }
      assert.equal(await page.evaluate(id => !!akkordReview.battle.bench[id].unit?.alive, id), false);
      if (mobile) await page.touchscreen.touchEnd(); else await page.mouse.up();
      await page.waitForFunction(id => akkordReview.battle.bench[id].unit?.alive, {}, id);
    };
    await page.goto(origin + '/arkpedia/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.roster-item.chosen');
    for (const id of await page.$$eval('.roster-item.chosen', es => es.map(e => e.dataset.id))) {
      await page.click(`.roster-item[data-id="${id}"]`); await page.click('#toggle');
    }
    for (const id of [ID, ALLY]) {
      await page.$eval('#roster-search', (e, name) => { e.value = name; e.dispatchEvent(new Event('input', { bubbles: true })); }, data.operators[id].name);
      await page.click(`.roster-item[data-id="${id}"]`); await page.click('#toggle');
      if (id === ID) { assert.equal(await page.$eval('#skillId', e => e.options.length), 2); await page.select('#skillId', `skchr_akkord_${skill}`); }
    }
    await page.click('#start');
    await page.waitForFunction(() => window.akkordReview?.battle && document.querySelector('#deployment button'), { timeout: 60000 });
    await page.evaluate(() => akkordReview.setup());
    await deploy(ID, dir === 'UP' ? 1 : 4, 6, dir);
    await page.evaluate(() => akkordReview.advance(1.1));
    await deploy(ALLY, dir === 'UP' ? 3 : 2, 6, 'UP');
    await page.evaluate(row => { akkordReview.target(row); akkordReview.advance(.1); }, dir === 'UP' ? 3 : 2);
    await page.click(`#deployment [data-id="${ID}"]`); await capture('deployed');
    await page.evaluate(s => akkordReview.ready(s), skill);
    const ready = await page.evaluate(() => akkordReview.snapshot()); await capture('ready');
    if (skill === 2) { assert.equal(await page.$eval('#skill', e => e.disabled), false); await page.click('#skill'); await page.evaluate(() => akkordReview.active()); }
    const active = await page.evaluate(() => akkordReview.snapshot());
    assert.equal(active.owner.model.endsWith(dir === 'UP' ? '/back' : '/front'), true);
    assert.ok(active.hits.some(h => h.isSkill));
    if (skill === 2) assert.ok(active.hits.some(h => h.tags.includes('akkord:burst')));
    assert.equal(active.slots, 2); assert.deepEqual(active.errors, []); assert.equal(active.glError, 0); await capture('active');
    const playback = await page.evaluate(s => akkordReview.playback(s), skill); assert.equal(playback.length, 2);
    for (const p of playback) { assert.equal(p.requested, p.played); assert.ok(p.trackTime >= 0 && p.trackTime < .1); }
    assert.notEqual(playback[0].playId, playback[1].playId);
    await page.click(`#deployment [data-id="${ID}"]`); await page.click('#retreat');
    const retired = await page.evaluate(() => { akkordReview.advance(1); return akkordReview.snapshot(); });
    assert.equal(retired.stopped, true); assert.equal(retired.slots, 1); assert.deepEqual(retired.errors, []); await capture('retired');
    reports.push({ label, ready, active, playback, retired }); await page.close();
    console.log(label + ': roster/deployment, native animations, natural SP and source attacks passed');
  }
  assert.deepEqual(errors, []); assert.deepEqual(failedResources, []);
  await writeFile(out + 'report.json', JSON.stringify({ controlled: true, originalWaves: false, reports, captures, errors, failedResources }, null, 2) + '\n');
  console.log(JSON.stringify({ cases: reports.length, captures, errors, failedResources }));
} finally { await browser.close(); }
