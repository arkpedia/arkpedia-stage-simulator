// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled public UI fixture; original-wave completion is tested separately.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {publicReviewDriver} from './public-review-driver.mjs';
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182';
const out='.cache/arkpedia/cn-operators/char_4228_closur/public-browser/';
const ID='char_4228_closur',ALLY='char_122_beagle',CARD=`summon:${ID}`;
const data=await(await fetch(origin+'/data/arkpedia-mvp.json')).json();assert.equal(data.operators[ID].name,'Closure');
data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},
 get prepared(){return this.owner.mem.closur;},get point(){return this.prepared.point.point;},hits:[],attacks:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++){battle.step();this.render();}},
 setup(){paused=true;battle.autoFinish=false;battle.timeLimit=1000;
  battle.on('damaged',x=>{if(x.source===this.owner)this.hits.push({amount:x.amount,time:battle.time});});
  battle.on('attack',x=>{if(x.attacker===this.owner)this.attacks.push({time:battle.time,targets:x.targets.map(t=>t.id)});});
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / 99 DP / empty waves / pinned enemy';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 target(){const u=this.owner,t=battle.spawnEnemy('enemy_1007_slime',{pos:[u.tileR+(u.dir==='UP'?1:0),u.tileC+(u.dir==='UP'?0:1)]});
  Object.assign(t.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:1});t.markDirty();t.hp=t.s.maxHp;
  battle.addBuff(t,{key:'qa:pin',flags:{noMove:true,disarm:true,unblockable:true}});battle._buildEnemyIndex();battle.getPlayer('arkpedia').dp=0;this.render();},
 ready(){const end=battle.time+100;while(!this.owner.skill.active&&!skillHud(this.owner.skill).canActivate&&battle.time<end)battle.step();this.render();},
 finish(){const end=battle.time+35;while(this.owner.skill.active&&battle.time<end)battle.step();this.render();},
 snapshot(){const u=this.owner,p=this.point,t=p?.unit,v=renderer.views.get(u.id),pv=t&&renderer.views.get(t.id);
 return{time:battle.time,dp:battle.dp,floor:battle.dpMinimumFor(),slots:battle.deployedSlots(),active:u.skill.active,sp:u.skill.spTotal,hud:skillHud(u.skill),
 owner:{alive:u.alive,model:v?.key,requested:u.mem.regularFormVisual?.clip,track:v?.actor.spine.state.tracks[0]?.animation.name},
 point:t?{alive:t.alive,hp:t.hp,maxHp:t.s.maxHp,mode:p.mode,dir:t.dir,model:pv?.key,track:pv?.actor.spine.state.tracks[0]?.animation.name}:null,
 cards:regularSummonCards(battle).map(c=>({key:c.key,stock:c.stock,available:c.available,deployed:c.deployed})),
 hits:this.hits,attacks:this.attacks,errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver=await publicReviewDriver({origin,out,data,hook}),reports=[];
try{
 for(const mobile of [false,true])for(const skill of [1,2,3]){
  const label=`${mobile?'phone':'desktop'}-s${skill}`,dir=skill===2?'UP':'RIGHT';
  const {page,deploy,capture,drag,tile}=await driver.open({label,mobile,operators:[ID,ALLY],skillId:`skchr_closur_${skill}`});
  await page.evaluate(()=>cnReview.setup());await deploy(ID,1,3,dir);await page.evaluate(()=>cnReview.advance(1.1));
  // The fixed-facing device deploys on drop, without opening a direction picker.
  const box=await(await page.$(`#deployment [data-id="${CARD}"]`)).boundingBox();assert.ok(box);
  await drag({x:box.x+box.width/2,y:box.y+box.height/2},await tile(skill===2?2:1,skill===2?3:4));
  await page.waitForFunction(()=>cnReview.point?.unit.alive);assert.equal(await page.$eval('.facing-picker',e=>e.hidden),true);
  await page.evaluate(()=>cnReview.advance(1.1));let deployed=await page.evaluate(()=>cnReview.snapshot());
  assert.equal(deployed.point.dir,'RIGHT');assert.equal(deployed.point.mode,'active');assert.equal(deployed.slots,1);
  assert.equal(deployed.cards[0].stock,0);assert.equal(deployed.cards[0].deployed,1);await capture('point');
  await page.evaluate(()=>cnReview.target());await page.evaluate(()=>cnReview.advance(3));
  let ordinary=await page.evaluate(()=>cnReview.snapshot());assert.ok(ordinary.hits.length>0);assert.ok(ordinary.attacks.every(a=>a.targets.length===1));
  await page.click(`#deployment [data-id="${ID}"]`);await page.evaluate(()=>cnReview.ready());
  if(skill>1)await page.click('#skill');await page.evaluate(()=>cnReview.render());
  const begin=await page.evaluate(()=>cnReview.snapshot());assert.equal(begin.active,true);await capture('begin');
  await page.evaluate(()=>cnReview.advance(1.2));const active=await page.evaluate(()=>cnReview.snapshot());assert.equal(active.active,true);
  assert.deepEqual(active.errors,[]);assert.equal(active.glError,0);await capture('active');
  await page.evaluate(()=>cnReview.finish());const ended=await page.evaluate(()=>cnReview.snapshot());assert.equal(ended.active,false);await capture('ended');
  // Select the point from its map tile and withdraw it through the public panel.
  // Dismiss the previous unit's floating field controls before choosing an
  // adjacent tile, which they may cover at landscape phone size.
  await page.click('.inspector-close');
  const target=await tile(skill===2?2:1,skill===2?3:4);
  if(mobile)await page.touchscreen.tap(target.x,target.y);else await page.mouse.click(target.x,target.y);
  assert.equal(await page.$eval('#command h2',e=>e.textContent),'Command Center');
  await page.click('#retreat');const recharge=await page.evaluate(()=>{cnReview.render();return cnReview.snapshot();});
  assert.equal(recharge.point.mode,'recharge');assert.equal(recharge.point.hp,1);assert.equal(recharge.slots,1);
  if(mobile)await page.touchscreen.tap(target.x,target.y);else await page.mouse.click(target.x,target.y);
  assert.match(await page.$eval('#command',e=>e.textContent),/Command center recovering/);await capture('recharge');
  await page.evaluate(()=>cnReview.advance(15.5));const restored=await page.evaluate(()=>cnReview.snapshot());
  assert.equal(restored.point.mode,'active');assert.equal(restored.point.hp,restored.point.maxHp);await capture('restored');
  await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');
  const removed=await page.evaluate(()=>{cnReview.render();return cnReview.snapshot();});assert.equal(removed.owner.alive,false);
  assert.equal(removed.point.alive,false);assert.equal(removed.cards.length,0);assert.equal(removed.slots,0);
  assert.deepEqual(removed.errors,[]);reports.push({label,deployed,ordinary,begin,active,ended,recharge,restored,removed});await page.close();
 }
 assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);
 await writeFile(out+'report.json',JSON.stringify({fixture:'Original 0-1 terrain; empty waves, 99 DP, pinned enemy. Browser emulation, not physical device or original-frame proof.',reports,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources},null,2)+'\n');
 console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources}));
}finally{await driver.close();}
