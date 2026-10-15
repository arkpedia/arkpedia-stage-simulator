// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { publicReviewDriver } from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const origin = 'http://127.0.0.1:3182', out = '.cache/arkpedia/cn-operators/char_4237_jcinta/public-browser/';
const ID = 'char_4237_jcinta', ALLY = 'char_122_beagle';
const data = await (await fetch(origin + '/data/arkpedia-mvp.json')).json();
assert.equal(data.operators[ID].name, 'Jacinta');
data.stage.geometry.waves[0].spawns = []; data.stage.battle.initial_dp = 99; data.stage.battle.dp_per_second = 0;
const hook = `
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},hits:[],attacks:[],grants:[],
 get owner(){return battle.bench['${ID}'].unit;},get controller(){return this.owner.mem.jcinta;},get recipient(){return battle.bench['${ALLY}'].unit;},
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++){battle.step();this.render();}},
 setup(){battle.autoFinish=false;battle.timeLimit=1000;paused=true;
  battle.on('damaged',x=>{if(x.source?.defId==='${ID}')this.hits.push({amount:x.amount,time:battle.time});});
  battle.on('attack',x=>{if(x.attacker?.defId==='${ID}')this.attacks.push({time:battle.time,targets:x.targets.map(t=>t.id)});});
  const add=battle.addDp.bind(battle);battle.addDp=(id,value)=>{if(id==='arkpedia')this.grants.push({time:battle.time,value});return add(id,value);};
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / 99 DP / empty waves / pinned enemy / wounded Beagle';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 target(row){const a=this.recipient;a.base.maxHp=100000;a.markDirty();void a.s;a.hp=10000;battle.addBuff(a,{key:'qa:still',flags:{disarm:true}});
  const t=battle.spawnEnemy('enemy_1007_slime',{pos:[row,6]});Object.assign(t.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:1});t.markDirty();t.hp=t.s.maxHp;
  battle.addBuff(t,{key:'qa:pin',flags:{noMove:true,disarm:true,unblockable:true}});battle._buildEnemyIndex();battle.getPlayer('arkpedia').dp=0;},
 ready(){const end=battle.time+90;while(!skillHud(this.owner.skill).canActivate&&battle.time<end)battle.step();
  if(!skillHud(this.owner.skill).canActivate)throw Error('Selected skill did not charge naturally');this.render();},
 finish(){const end=battle.time+35;while(this.owner.skill.active&&battle.time<end)battle.step();this.render();},
 playback(){const samples=[];let previous=this.owner.mem.regularFormVisual;const end=battle.time+12;
  while(samples.length<2&&battle.time<end){battle.step();this.render();const visual=this.owner.mem.regularFormVisual;
   if(visual!==previous&&visual?.clip==='Attack'){const track=renderer.views.get(this.owner.id)?.actor.spine.state.tracks[0];
    samples.push({time:battle.time,played:track?.animation.name,trackTime:track?.trackTime,playId:visual.playId});}previous=visual;}return samples;},
 snapshot(){const u=this.owner,v=renderer.views.get(u.id),a=this.recipient;return{time:battle.time,dp:battle.dp,slots:battle.deployedSlots(),sp:u.skill.spTotal,active:u.skill.active,
  activations:u.skill.activations,stopped:this.controller.stopped,hits:this.hits,attacks:this.attacks,grants:this.grants,hud:skillHud(u.skill),
  owner:{row:u.tileR,col:u.tileC,atk:u.s.atk,block:u.s.blockCnt,model:v?.key,requested:u.mem.regularFormVisual?.clip,track:v?.actor.spine.state.tracks[0]?.animation.name},
  recipient:{hp:a.hp,sanctuary:a.findBuff('jcinta:aerial-sanctuary:'+u.id)?.data.flyingSourceSanctuary??0},errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver = await publicReviewDriver({ origin, out, data, hook }), reports = [];
const checkPlayback = samples => {
  assert.equal(samples.length, 2);
  for (const p of samples) { assert.equal(p.played, 'Attack'); assert.ok(p.trackTime >= 0 && p.trackTime < .1); }
  assert.notEqual(samples[0].playId, samples[1].playId);
};
try {
  for (const mobile of [false, true]) for (const skill of [1, 2]) for (const dir of ['DOWN', 'UP']) {
    const label = `${mobile ? 'phone' : 'desktop'}-s${skill}-${dir.toLowerCase()}`, row = dir === 'UP' ? 2 : 3;
    const { page, deploy, capture } = await driver.open({ label, mobile, operators: [ID, ALLY],
      skillId: skill === 1 ? 'skcom_assist_cost[3]' : 'skchr_jcinta_2' });
    await page.evaluate(() => cnReview.setup()); await deploy(ID, row, 6, dir); await deploy(ALLY, row, 5, 'RIGHT');
    await page.evaluate(r => { cnReview.target(r); cnReview.advance(1.1); }, dir === 'UP' ? 3 : 2);
    await page.click(`#deployment [data-id="${ID}"]`); await capture('deployed');
    const beforePlayback = await page.evaluate(() => cnReview.playback()); checkPlayback(beforePlayback);
    await page.evaluate(() => cnReview.ready()); const ready = await page.evaluate(() => cnReview.snapshot()); await capture('ready');
    assert.equal(ready.grants.length, 0); assert.equal(ready.recipient.hp, 10000);
    await page.click('#skill'); const begin = await page.evaluate(() => { cnReview.render(); return cnReview.snapshot(); });
    assert.equal(begin.owner.track, `Skill_${skill}_Begin`); assert.equal(begin.owner.block, 0); await capture('begin');
    await page.evaluate(() => cnReview.advance(1.2)); const active = await page.evaluate(() => cnReview.snapshot());
    assert.equal(active.owner.track, `Skill_${skill}_Loop`); assert.equal(active.owner.model.endsWith(dir === 'UP' ? '/back' : '/front'), true);
    assert.equal(active.attacks.length, ready.attacks.length); assert.ok(active.grants.length > 0); assert.ok(active.dp > 0);
    assert.equal(active.recipient.hp > ready.recipient.hp, skill === 2);
    assert.equal(active.recipient.sanctuary > ready.recipient.sanctuary, skill === 2);
    assert.equal(active.slots, 2); assert.deepEqual(active.errors, []); assert.equal(active.glError, 0); await capture('active');
    await page.evaluate(() => cnReview.finish()); const ended = await page.evaluate(() => cnReview.snapshot());
    assert.equal(ended.active, false); assert.equal(ended.owner.block, 1); assert.equal(ended.owner.track, `Skill_${skill}_End`);
    assert.equal(ended.dp, skill === 1 ? 18 : 27); assert.equal(ended.attacks.length, ready.attacks.length);
    assert.equal(ended.recipient.sanctuary, ready.recipient.sanctuary); await capture('ended');
    const afterPlayback = await page.evaluate(() => cnReview.playback()); checkPlayback(afterPlayback);
    await page.click(`#deployment [data-id="${ID}"]`); await page.click('#retreat');
    const retired = await page.evaluate(() => { cnReview.advance(1); return cnReview.snapshot(); });
    assert.equal(retired.stopped, true); assert.equal(retired.slots, 1); assert.equal(retired.recipient.sanctuary, 0);
    assert.deepEqual(retired.errors, []); await capture('retired');
    reports.push({ label, ready, begin, active, ended, beforePlayback, afterPlayback, retired }); await page.close();
    console.log(label + ': public drag/drop/swipe, original clips, natural SP, channel DP/healing/aura and cleanup passed');
  }
  assert.deepEqual(driver.errors, []); assert.deepEqual(driver.failedResources, []);
  await writeFile(out + 'report.json', JSON.stringify({ controlled: true, originalWaves: false, reports,
    captures: driver.captures, errors: driver.errors, failedResources: driver.failedResources }, null, 2) + '\n');
  console.log(JSON.stringify({ cases: reports.length, captures: driver.captures, errors: driver.errors, failedResources: driver.failedResources }));
} finally { await driver.close(); }
