// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { publicReviewDriver } from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const origin = 'http://127.0.0.1:3182', out = '.cache/arkpedia/cn-operators/char_4031_liesel/public-browser/';
const ID = 'char_4031_liesel', data = await (await fetch(origin + '/data/arkpedia-mvp.json')).json();
assert.equal(data.operators[ID].name, 'Ripresa');
data.stage.geometry.waves[0].spawns = []; data.stage.battle.initial_dp = 99; data.stage.battle.dp_per_second = 0;
const hook = `
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},hits:[],attacks:[],
 get owner(){return battle.bench['${ID}'].unit;},get controller(){return this.owner.mem.liesel;},
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++){battle.step();this.render();}},
 setup(){battle.autoFinish=false;battle.timeLimit=1000;paused=true;
  battle.on('damaged',x=>{if(x.source?.defId==='${ID}'||x.credit?.defId==='${ID}')this.hits.push({time:battle.time,tags:x.dmg.tags,amount:x.amount,source:!!x.source});});
  battle.on('attack',x=>{if(x.attacker?.defId==='${ID}')this.attacks.push({time:battle.time,targets:x.targets.map(t=>t.id)});});
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / 99 DP / empty waves / three pinned enemies';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 targets(row){for(const dx of [0,.15,-.15]){const t=battle.spawnEnemy('enemy_1007_slime',{pos:[row,6]});
  Object.assign(t.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:1});t.markDirty();void t.s;t.hp=t.s.maxHp;t.x+=dx;
  battle.addBuff(t,{key:'qa:pin',flags:{noMove:true,disarm:true,unblockable:true}});}battle._buildEnemyIndex();battle.getPlayer('arkpedia').dp=0;},
 ready(skill){const end=battle.time+90,done=()=>skill===1?this.owner.skill.activations>0:skillHud(this.owner.skill).canActivate;
  while(!done()&&battle.time<end)battle.step();if(!done())throw Error('Selected skill did not charge naturally');this.render();},
 launched(){const end=battle.time+2;while(battle.projectiles.list.filter(p=>p.data?.liesel).length<3&&battle.time<end){battle.step();this.render();}},
 active(skill){const tag=skill===1?'liesel:s1':'liesel:burst',count=skill===1?3:9,end=battle.time+8;
  while(this.hits.filter(h=>h.tags.includes(tag)).length<count&&battle.time<end){battle.step();this.render();}},
 playback(){const samples=[];let previous=this.owner.mem.regularFormVisual;const end=battle.time+14;
  while(samples.length<2&&battle.time<end){battle.step();this.render();const v=this.owner.mem.regularFormVisual;
   if(v!==previous&&['Attack','Skill_1'].includes(v?.clip)){const t=renderer.views.get(this.owner.id)?.actor.spine.state.tracks[0];
    samples.push({time:battle.time,requested:v.clip,played:t?.animation.name,trackTime:t?.trackTime,playId:v.playId});}previous=v;}return samples;},
 snapshot(){const u=this.owner,v=renderer.views.get(u.id);return{time:battle.time,slots:battle.deployedSlots(),sp:u.skill.spTotal,active:u.skill.active,
  activations:u.skill.activations,stopped:this.controller.stopped,hits:this.hits,attacks:this.attacks,hud:skillHud(u.skill),
  shots:battle.projectiles.list.filter(p=>p.data?.liesel).map(p=>({key:p.data.nativeKey,time:p.flightTime,target:p.target?.id})),
  owner:{row:u.tileR,col:u.tileC,atk:u.s.atk,model:v?.key,requested:u.mem.regularFormVisual?.clip,track:v?.actor.spine.state.tracks[0]?.animation.name},
  errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver = await publicReviewDriver({ origin, out, data, hook }), reports = [];
const checkPlayback = samples => {
  assert.equal(samples.length, 2);
  for (const p of samples) { assert.equal(p.requested, p.played); assert.ok(p.trackTime >= 0 && p.trackTime < .1); }
  assert.notEqual(samples[0].playId, samples[1].playId);
};
try {
  for (const mobile of [false, true]) for (const skill of [1, 2]) for (const dir of ['DOWN', 'UP']) {
    const label = `${mobile ? 'phone' : 'desktop'}-s${skill}-${dir.toLowerCase()}`;
    const { page, deploy, capture } = await driver.open({ label, mobile, operators: [ID], skillId: `skchr_liesel_${skill}` });
    await page.evaluate(() => cnReview.setup()); await deploy(ID, dir === 'UP' ? 1 : 4, 6, dir);
    await page.evaluate(row => { cnReview.targets(row); cnReview.advance(1.1); }, dir === 'UP' ? 2 : 3);
    await page.click(`#deployment [data-id="${ID}"]`); await capture('deployed');
    const beforePlayback = await page.evaluate(() => cnReview.playback()); checkPlayback(beforePlayback);
    await page.evaluate(s => cnReview.ready(s), skill); const ready = await page.evaluate(() => cnReview.snapshot()); await capture('ready');
    if (skill === 1) {
      assert.equal(ready.owner.requested, 'Skill_1'); assert.equal(ready.owner.track, 'Skill_1');
      assert.equal(ready.hits.some(h => h.tags.includes('liesel:s1')), false);
    }
    let launched = null;
    if (skill === 2) {
      await page.click('#skill'); const begin = await page.evaluate(() => { cnReview.render(); return cnReview.snapshot(); });
      assert.equal(begin.owner.track, 'Skill_2');
      await page.evaluate(() => cnReview.launched()); launched = await page.evaluate(() => cnReview.snapshot());
      assert.equal(launched.shots.length, 3); assert.equal(launched.active, false); assert.equal(new Set(launched.shots.map(p => p.target)).size, 3);
      assert.deepEqual(launched.shots.map(p => p.key), ['projectile_chr_liesel_s2_1', 'projectile_chr_liesel_s2_2', 'projectile_chr_liesel_s2_3']); await capture('launched');
    }
    await page.evaluate(s => cnReview.active(s), skill); const active = await page.evaluate(() => cnReview.snapshot());
    assert.equal(active.owner.model.endsWith(dir === 'UP' ? '/back' : '/front'), true);
    assert.ok(active.hits.filter(h => h.tags.includes(skill === 1 ? 'liesel:s1' : 'liesel:burst')).length >= (skill === 1 ? 3 : 9));
    assert.equal(active.slots, 1); assert.deepEqual(active.errors, []); assert.equal(active.glError, 0); await capture('active');
    if (skill === 2) {
      assert.equal(active.hits.some(h => h.tags.includes('liesel:dot')), false);
      await page.evaluate(() => cnReview.advance(1.1)); const dot = await page.evaluate(() => cnReview.snapshot());
      const ticks = dot.hits.filter(h => h.tags.includes('liesel:dot')); assert.ok(ticks.length >= 3); assert.ok(ticks.every(h => !h.source)); await capture('dot');
    }
    const afterPlayback = await page.evaluate(() => cnReview.playback()); checkPlayback(afterPlayback);
    if (skill === 1) await capture('repeat');
    const beforeRetreat = await page.evaluate(() => cnReview.snapshot());
    await page.click(`#deployment [data-id="${ID}"]`); await page.click('#retreat');
    const retired = await page.evaluate(() => { cnReview.advance(1.1); return cnReview.snapshot(); });
    assert.equal(retired.stopped, true); assert.equal(retired.slots, 0); assert.equal(retired.shots.length, 0);
    assert.equal(retired.hits.filter(h => h.tags.includes('liesel:burst')).length, beforeRetreat.hits.filter(h => h.tags.includes('liesel:burst')).length);
    assert.deepEqual(retired.errors, []); await capture('retired');
    reports.push({ label, ready, launched, active, beforePlayback, afterPlayback, retired }); await page.close();
    console.log(label + ': public high-ground drag/drop/swipe, original clips, natural SP, splash/projectile/DOT and cleanup passed');
  }
  assert.deepEqual(driver.errors, []); assert.deepEqual(driver.failedResources, []);
  await writeFile(out + 'report.json', JSON.stringify({ controlled: true, originalWaves: false, reports,
    captures: driver.captures, errors: driver.errors, failedResources: driver.failedResources }, null, 2) + '\n');
  console.log(JSON.stringify({ cases: reports.length, captures: driver.captures, errors: driver.errors, failedResources: driver.failedResources }));
} finally { await driver.close(); }
