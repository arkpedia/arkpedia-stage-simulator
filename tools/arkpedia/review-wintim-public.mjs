// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { publicReviewDriver } from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const origin = 'http://127.0.0.1:3182', out = '.cache/arkpedia/cn-operators/char_4208_wintim/public-browser/';
const ID = 'char_4208_wintim';
const data = await (await fetch(origin + '/data/arkpedia-mvp.json')).json();
assert.equal(data.operators[ID].name, 'Snegurochka'); assert.equal(data.operators[ID].sourceAppellation, 'Снегурочка');
data.stage.geometry.waves[0].spawns = []; data.stage.battle.initial_dp = 99; data.stage.battle.dp_per_second = 0;
const hook = `
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},hits:[],attacks:[],grants:[],
 get owner(){return battle.bench['${ID}'].unit;},get controller(){return this.owner.mem.wintim;},
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){battle.autoFinish=false;battle.timeLimit=1000;paused=true;
  battle.on('damaged',x=>{if(x.source?.defId==='${ID}')this.hits.push({tags:x.dmg.tags,amount:x.amount,isSkill:x.dmg.isSkill,attackId:x.dmg.attackId,time:battle.time});});
  battle.on('attack',x=>{if(x.attacker?.defId==='${ID}')this.attacks.push(x.targets.map(t=>t.id));});
  const add=battle.addDp.bind(battle);battle.addDp=(id,value)=>{if(id==='arkpedia')this.grants.push({time:battle.time,value});return add(id,value);};
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / 99 DP / empty waves / pinned target';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 target(row){const t=battle.spawnEnemy('enemy_1007_slime',{pos:[row,6]});Object.assign(t.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:1});t.markDirty();t.hp=t.s.maxHp;
  battle.addBuff(t,{key:'qa:pin',flags:{noMove:true,disarm:true,unblockable:true}});battle._buildEnemyIndex();this.targetUnit=t;},
 ready(skill){const end=battle.time+90,done=()=>skill===1?this.owner.skill.activations>0:skillHud(this.owner.skill).canActivate;
  while(!done()&&battle.time<end)battle.step();if(!done())throw Error('Selected skill did not charge naturally');this.render();},
 active(skill){const end=battle.time+8;while(!this.hits.some(h=>h.tags.includes('wintim:s'+skill))&&battle.time<end)battle.step();this.render();},
 playback(skill){const expected=skill===1?'Attack':'Skill_2_Loop',samples=[];
  let previous=this.owner.mem.regularFormVisual;const end=battle.time+12;
  while(samples.length<2&&battle.time<end){battle.step();this.render();const visual=this.owner.mem.regularFormVisual;
   if(visual!==previous&&visual?.clip===expected){const track=renderer.views.get(this.owner.id)?.actor.spine.state.tracks[0];
    samples.push({time:battle.time,requested:expected,played:track?.animation.name,trackTime:track?.trackTime,playId:visual.playId});}previous=visual;}return samples;},
 snapshot(){const u=this.owner,v=renderer.views.get(u.id);return{time:battle.time,dp:battle.dp,slots:battle.deployedSlots(),sp:u.skill.spTotal,active:u.skill.active,
  activations:u.skill.activations,stopped:this.controller.stopped,hits:this.hits,attacks:this.attacks,grants:this.grants,hud:skillHud(u.skill),
  owner:{row:u.tileR,col:u.tileC,aspd:u.s.aspd,model:v?.key,requested:u.mem.regularFormVisual?.clip,track:v?.actor.spine.state.tracks[0]?.animation.name},
  targetSpeed:this.targetUnit?.s.moveSpeed,errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver = await publicReviewDriver({ origin, out, data, hook });
const reports = [];
try {
  for (const mobile of [false, true]) for (const skill of [1, 2]) for (const dir of ['DOWN', 'UP']) {
    const label = `${mobile ? 'phone' : 'desktop'}-s${skill}-${dir.toLowerCase()}`;
    const { page, deploy, capture } = await driver.open({ label, mobile, operators: [ID], skillId: `skchr_wintim_${skill}` });
    await page.evaluate(() => cnReview.setup());
    await deploy(ID, dir === 'UP' ? 2 : 3, 6, dir);
    await page.evaluate(row => { cnReview.target(row); cnReview.advance(1.1); }, dir === 'UP' ? 3 : 2);
    await page.click(`#deployment [data-id="${ID}"]`); await capture('deployed');
    await page.evaluate(s => cnReview.ready(s), skill);
    const ready = await page.evaluate(() => cnReview.snapshot()); await capture('ready');
    if (skill === 1) {
      assert.ok(ready.grants.some(g => g.value === 3)); assert.equal(ready.hits.some(h => h.tags.includes('wintim:s1')), false);
      assert.equal(ready.owner.requested, 'Skill_1'); assert.equal(ready.owner.track, 'Skill_1');
    } else {
      assert.equal(ready.grants.length, 0); assert.equal(await page.$eval('#skill', e => e.disabled), false);
      await page.click('#skill'); const begin = await page.evaluate(() => { cnReview.render(); return cnReview.snapshot(); });
      assert.equal(begin.owner.track, 'Skill_2_Begin'); await capture('begin');
    }
    await page.evaluate(s => cnReview.active(s), skill);
    const active = await page.evaluate(() => cnReview.snapshot());
    assert.equal(active.owner.model.endsWith(dir === 'UP' ? '/back' : '/front'), true);
    assert.ok(active.hits.some(h => h.tags.includes(`wintim:s${skill}`))); assert.ok(active.dp >= ready.dp);
    if (skill === 2) { assert.ok(active.grants.some(g => g.value === 1)); assert.equal(active.targetSpeed, .2); }
    assert.equal(active.slots, 1); assert.deepEqual(active.errors, []); assert.equal(active.glError, 0); await capture('active');
    const playback = await page.evaluate(s => cnReview.playback(s), skill); assert.equal(playback.length, 2);
    for (const p of playback) { assert.equal(p.requested, p.played); assert.ok(p.trackTime >= 0 && p.trackTime < .1); }
    assert.notEqual(playback[0].playId, playback[1].playId);
    await page.click(`#deployment [data-id="${ID}"]`); await page.click('#retreat');
    const retired = await page.evaluate(() => { cnReview.advance(1); return cnReview.snapshot(); });
    assert.equal(retired.stopped, true); assert.equal(retired.slots, 0); assert.deepEqual(retired.errors, []); await capture('retired');
    reports.push({ label, ready, active, playback, retired }); await page.close();
    console.log(label + ': public deployment, native clips, natural SP, source DP/slow and cleanup passed');
  }
  assert.deepEqual(driver.errors, []); assert.deepEqual(driver.failedResources, []);
  await writeFile(out + 'report.json', JSON.stringify({ controlled: true, originalWaves: false, reports,
    captures: driver.captures, errors: driver.errors, failedResources: driver.failedResources }, null, 2) + '\n');
  console.log(JSON.stringify({ cases: reports.length, captures: driver.captures, errors: driver.errors, failedResources: driver.failedResources }));
} finally { await driver.close(); }
