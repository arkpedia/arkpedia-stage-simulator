// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled public mouse/touch checks: original terrain, empty waves, 99 DP.
import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const executablePath = process.env.ARKPEDIA_REVIEW_CHROME;
if (!executablePath) throw Error('Set ARKPEDIA_REVIEW_CHROME and start port 3182.');
const origin = 'http://127.0.0.1:3182', out = '.cache/arkpedia/mon3tr-source/public-browser/';
const ID = 'char_4179_monstr', TOKEN = 'token_10050_monstr_prosts';
const data = await (await fetch(origin + '/data/arkpedia-mvp.json')).json();
assert.ok(data.operators[ID]); assert.equal(data.sd.commit, '5205aa71124bcfde0493b8ea32e057d8bf7e0eed');
data.stage.geometry.waves[0].spawns = []; data.stage.battle.initial_dp = 99; data.stage.battle.dp_per_second = 0;
const app = await readFile('public/arkpedia/app.js', 'utf8');
const hook = `
globalThis.mon3trReview={get battle(){return battle;},get renderer(){return renderer;},hits:[],heals:[],
 get owner(){return battle.bench['${ID}'].unit;},get controller(){return this.owner.mem.mon3trHealing;},
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){battle.autoFinish=false;battle.timeLimit=1000;paused=true;
  battle.on('damaged',x=>{if(x.source?.defId==='${ID}'&&x.dmg.tags.includes('mon3tr:s3'))this.hits.push({tags:x.dmg.tags,loss:x.hpLoss});});
  battle.on('calculatedHeal',x=>{if(x.source?.defId==='${ID}')this.heals.push({tag:x.opts.mon3trTag,amount:x.amount});});
  const label=document.createElement('div');label.textContent='CONTROLLED PUBLIC UI CHECK · original terrain / 99 DP / empty waves / pinned target';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 ready(){const end=battle.time+120;const done=()=>this.owner.skill.id==='skchr_monstr_1'?this.owner.skill.activations>0:skillHud(this.owner.skill).canActivate;
  while(!done()&&battle.time<end)battle.step();if(!done())throw Error('Selected skill did not charge naturally');this.render();},
 enemy(){const t=battle.spawnEnemy('enemy_1007_slime',{pos:[3,8]});Object.assign(t.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});t.markDirty();t.hp=t.s.maxHp;
  battle.addBuff(t,{key:'qa:pin',flags:{noMove:true,disarm:true}});battle._buildEnemyIndex();},
 returned(){const end=battle.time+30;while(this.controller.ownerSkills.state&&battle.time<end)battle.step();
  if(this.controller.ownerSkills.state)throw Error('S3 did not return');this.render();},
 playback(skill){const expected=skill===1?'Attack':skill===2?'Skill_2_Loop':'Skill_3_Loop',samples=[];
  let previous=this.owner.mem.regularFormVisual;const end=battle.time+12;
  while(samples.length<2&&battle.time<end){battle.step();this.render();const visual=this.owner.mem.regularFormVisual;
   if(visual!==previous&&visual?.clip===expected){const actor=renderer.views.get(this.owner.id)?.actor;
    const track=actor?.spine.state.tracks[0];samples.push({time:battle.time,requested:expected,played:track?.animation.name,trackTime:track?.trackTime});}
   previous=visual;
  }return samples;},
 snapshot(){const u=this.owner,c=this.controller,s=c.ownerSkills?.state;
  const track=t=>renderer.views.get(t.id)?.actor.spine?.state.tracks[0]?.animation.name;
  return{time:battle.time,dp:battle.dp,slots:battle.deployedSlots(),active:u.skill.active,activations:u.skill.activations,sp:u.skill.sp,
   owner:{row:u.tileR,col:u.tileC,hp:u.hp,atk:u.s.atk,model:renderer.views.get(u.id)?.key,requested:u.mem.regularFormVisual?.clip,track:track(u)},
   stopped:c.stopped,mode:s?.mode,heals:this.heals,hits:this.hits,errors:battle.errors,
   point:c.deck.point?{id:c.deck.point.unit.id,model:renderer.views.get(c.deck.point.unit.id)?.key,track:track(c.deck.point.unit),hp:c.deck.point.unit.hp}:null,
   marker:s?.marker?{id:s.marker.id,row:s.marker.tileR,col:s.marker.tileC,slots:s.marker.deploymentSlotCost,hideHp:s.marker.mem.regularHideHp,track:track(s.marker)}:null,
   glError:renderer.three.getContext().getError()};}
};`;
await mkdir(out, { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'] });
const reports = [], errors = [], failedResources = []; let captures = 0;
try {
  for (const skill of [1, 2, 3]) for (const mobile of [false, true]) {
    const label = `s${skill}-${mobile ? 'landscape-phone' : 'desktop'}`, page = await browser.newPage();
    page.on('pageerror', e => errors.push({ label, message: e.message }));
    page.on('console', m => { if (m.type() === 'error') errors.push({ label, message: m.text() }); });
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
    const cardCenter = async id => {
      const box = await (await page.$(`#deployment [data-id="${id}"]`)).boundingBox();
      assert.ok(box); return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    const tileCenter = async (row, col) => page.evaluate((r, c) => {
      const a = mon3trReview.renderer, p = a.projection.project(c, r, a.heightAt(r, c));
      const box = document.querySelector('#battle-board').getBoundingClientRect(); return { x: p.x + box.x, y: p.y + box.y };
    }, row, col);
    await page.goto(origin + '/arkpedia/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.roster-item.chosen');
    for (const id of await page.$$eval('.roster-item.chosen', es => es.map(e => e.dataset.id))) {
      await page.click(`.roster-item[data-id="${id}"]`); await page.click('#toggle');
    }
    await page.$eval('#roster-search', (e, name) => { e.value = name; e.dispatchEvent(new Event('input', { bubbles: true })); }, data.operators[ID].name);
    await page.click(`.roster-item[data-id="${ID}"]`); await page.click('#toggle');
    assert.equal(await page.$eval('#skillId', e => e.options.length), 3);
    await page.select('#skillId', `skchr_monstr_${skill}`); await page.click('#start');
    await page.waitForFunction(() => window.mon3trReview?.battle && document.querySelector('#deployment button'), { timeout: 60000 });
    await page.evaluate(() => mon3trReview.setup());
    await drag(await cardCenter(ID), await tileCenter(4, 6));
    await page.waitForSelector('.facing-picker:not([hidden])');
    assert.equal(await page.evaluate(() => !!mon3trReview.owner?.alive), false);
    const h = await (await page.$('.facing-handle')).boundingBox(), x = h.x + h.width / 2, y = h.y + h.height / 2;
    if (mobile) { await page.touchscreen.touchStart(x, y); await page.touchscreen.touchMove(x, y - 65); }
    else { await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x, y - 65, { steps: 8 }); }
    assert.equal(await page.evaluate(() => !!mon3trReview.owner?.alive), false);
    if (mobile) await page.touchscreen.touchEnd(); else await page.mouse.up();
    await page.waitForFunction(() => mon3trReview.owner?.alive);
    await page.evaluate(() => mon3trReview.advance(1.1));
    await drag(await cardCenter(`summon:${ID}`), await tileCenter(3, 7));
    await page.waitForFunction(() => !!mon3trReview.controller.deck.point);
    await page.evaluate(() => mon3trReview.render());
    assert.equal(await page.$eval('.facing-picker', e => e.hidden), true);
    const born = await page.evaluate(() => mon3trReview.snapshot());
    if (!born.point.track) console.log(JSON.stringify({ born, errors, failedResources, resources: await page.evaluate(() => [...mon3trReview.renderer.preloaded.keys()].filter(k => k.includes('monstr'))) }));
    assert.equal(born.slots, 1); assert.equal(born.point.track, 'Start'); await capture('reconstruction-start');
    await page.evaluate(() => { mon3trReview.advance(1.1); mon3trReview.ready(); });
    await page.click(`#deployment [data-id="${ID}"]`);
    const ready = await page.evaluate(() => mon3trReview.snapshot());
    assert.ok(ready.owner.model.endsWith('/back')); assert.equal(ready.glError, 0); await capture('ready');
    let returned = null;
    if (skill > 1) { assert.equal(await page.$eval('#skill', e => e.disabled), false); await page.click('#skill'); }
    if (skill === 3) {
      await page.evaluate(() => mon3trReview.advance(.8));
      const moved = await page.evaluate(() => mon3trReview.snapshot());
      assert.equal(moved.owner.row, 3); assert.equal(moved.owner.col, 7); assert.ok(moved.owner.model.endsWith('/front'));
      assert.equal(moved.owner.track, 'Skill_3_ReStart'); assert.equal(moved.point, null);
      assert.equal(moved.marker.row, 4); assert.equal(moved.marker.col, 6); assert.equal(moved.marker.track, 'Skill_3');
      assert.equal(moved.marker.hideHp, true); assert.equal(moved.marker.slots, 0); await capture('reborn');
      await page.evaluate(() => { mon3trReview.enemy(); mon3trReview.advance(2); });
    } else await page.evaluate(s => {
      if (s === 1) mon3trReview.advance(.8);
      else {
        const end = mon3trReview.battle.time + 8;
        while (!mon3trReview.heals.some(h => h.tag === 's2-extra') && mon3trReview.battle.time < end)
          mon3trReview.battle.step();
        mon3trReview.render();
      }
    }, skill);
    const active = await page.evaluate(() => mon3trReview.snapshot());
    if (skill === 1) assert.ok(active.heals.some(h => h.amount > active.owner.atk * 1.5));
    if (skill === 2) assert.ok(active.heals.some(h => h.tag === 's2-extra'));
    if (skill === 3) { assert.ok(active.hits.length); assert.ok(active.heals.some(h => h.tag === 's3')); }
    assert.equal(active.slots, 1); assert.deepEqual(active.errors, []); assert.equal(active.glError, 0); await capture('active');
    const playback = await page.evaluate(s => mon3trReview.playback(s), skill);
    assert.equal(playback.length, 2);
    for (const shot of playback) {
      assert.equal(shot.played, shot.requested);
      assert.ok(shot.trackTime >= 0 && shot.trackTime < .1, JSON.stringify({ label, shot }));
    }
    if (skill === 3) {
      await page.evaluate(() => mon3trReview.returned()); returned = await page.evaluate(() => mon3trReview.snapshot());
      assert.equal(returned.owner.row, 4); assert.equal(returned.owner.col, 6); assert.ok(returned.owner.model.endsWith('/back'));
      assert.equal(returned.owner.track, 'Skill_3_Back'); assert.equal(returned.marker, null); await capture('returned');
    }
    await page.click(`#deployment [data-id="${ID}"]`); await page.click('#retreat');
    const retired = await page.evaluate(() => { mon3trReview.advance(2); return mon3trReview.snapshot(); });
    assert.equal(retired.stopped, true); assert.equal(retired.point, null); assert.equal(retired.marker, null);
    assert.equal(retired.slots, 0); assert.deepEqual(retired.errors, []); await capture('retired');
    reports.push({ label, born, ready, active, playback, returned, retired }); await page.close();
    console.log(label + ': public drag/swipe, natural SP, original owner/token poses and cleanup passed');
  }
  assert.deepEqual(errors, []); assert.deepEqual(failedResources, []);
  await writeFile(out + 'report.json', JSON.stringify({ controlled: true, originalWaves: false, reports, errors, failedResources }, null, 2) + '\n');
  console.log(JSON.stringify({ cases: reports.length, captures, errors, failedResources }));
} finally { await browser.close(); }
