// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {publicReviewDriver} from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182',ID='char_4211_snhunt';
const out=`.cache/arkpedia/cn-operators/${ID}/public-browser/`,candidate=process.argv.includes('--candidate');
const data=candidate?JSON.parse(await readFile('.cache/arkpedia/arkpedia-snhunt-candidate.json')):await(await fetch(origin+'/data/arkpedia-mvp.json')).json();
assert.equal(data.operators[ID].name,'Snow Hunter');data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},get controller(){return this.owner.mem.snhunt;},enemy:null,hits:[],shots:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){battle.autoFinish=false;battle.timeLimit=1000;paused=true;
  battle.on('damaged',c=>{if(c.source?.defId==='${ID}')this.hits.push({time:battle.time,amount:c.amount,kind:c.dmg.tags.find(t=>t.startsWith('snhunt:')),attackId:c.dmg.attackId});});
  const original=battle.addProjectile.bind(battle);battle.addProjectile=p=>{if(p.source?.defId==='${ID}')this.shots.push({time:battle.time,key:p.data.projectileKey});return original(p);};
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / 99 DP / empty waves / pinned target';label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 target(){const u=this.owner,e=battle.spawnEnemy('enemy_1007_slime',{pos:[u.tileR+(u.dir==='UP'?1:-1),u.tileC]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;
  battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true}});battle._buildEnemyIndex();this.enemy=e;},
 until(kind){const end=battle.time+90;const pred=()=>kind==='ready'?this.owner.skill.ready:kind==='powered'?this.controller.phase?.s1&&!this.controller.phase.released:kind==='powered-hit'?this.hits.some(h=>h.kind==='snhunt:s1'):kind==='first'?this.shots.some(h=>h.key==='projectile_chr_snhunt_02'):kind==='second'?this.shots.filter(h=>h.key==='projectile_chr_snhunt_02').length===2:!this.owner.skill.active;
  while(!pred()&&battle.time<end)battle.step();if(!pred())throw Error('Missing natural '+kind);this.render();},
 snapshot(){const u=this.owner,v=renderer.views.get(u.id),c=this.controller;return{time:battle.time,sp:u.skill.spTotal,active:u.skill.active,attacks:u.stats.attacks,activations:u.skill.activations,hud:skillHud(u.skill),
  ammo:{...c.magazine.ammoUi},stopped:c.stopped,handles:c.handles.length,flights:c.projectiles.flights.size,slots:battle.deployedSlots(),hits:this.hits,shots:this.shots,
  owner:{alive:u.alive,model:v?.key,requested:u.mem.regularFormVisual?.clip,track:v?.actor.spine.state.tracks[0]?.animation.name},
  enemy:{cold:!!this.enemy.s.flags.cold,freeze:!!this.enemy.s.flags.freeze},errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver=await publicReviewDriver({origin,out,data,hook}),reports=[];
try{
 for(const mobile of[false,true])for(const skill of[1,2])for(const dir of['DOWN','UP']){
  const label=`${mobile?'phone':'desktop'}-s${skill}-${dir.toLowerCase()}`;
  const{page,deploy,capture}=await driver.open({label,mobile,operators:[ID],skillId:`skchr_snhunt_${skill}`});
  await page.evaluate(()=>cnReview.setup());await deploy(ID,dir==='UP'?1:4,6,dir);
  await page.evaluate(()=>{cnReview.advance(1.1);cnReview.target();});await page.click(`#deployment [data-id="${ID}"]`);await capture('deployed');
  let ready,first,second,ended;
  if(skill===1){
   await page.evaluate(()=>cnReview.until('powered'));ready=await page.evaluate(()=>cnReview.snapshot());await capture('powered');
   assert.equal(ready.owner.track,dir==='DOWN'?'Skill_Down_1':'Skill_1');assert.equal(ready.active,true);assert.equal(ready.hud.canActivate,false);
   assert.ok(ready.attacks>=3);await page.evaluate(()=>cnReview.until('powered-hit'));first=await page.evaluate(()=>cnReview.snapshot());await capture('powered-hit');
   assert.equal(first.hits.filter(h=>h.kind==='snhunt:s1').length,1);assert.equal(first.attacks-ready.attacks,1);assert.equal(first.ammo.current,ready.ammo.current-1);
   assert.equal(first.enemy.cold,true);assert.equal(first.active,false);second=ended=first;
  }else{
   await page.evaluate(()=>cnReview.until('ready'));ready=await page.evaluate(()=>cnReview.snapshot());await capture('ready');assert.equal(ready.hud.canActivate,true);
   await page.click('#skill');await page.evaluate(()=>cnReview.render());const begin=await page.evaluate(()=>cnReview.snapshot());await capture('begin');
   assert.equal(begin.owner.track,dir==='DOWN'?'Skill_Down_2_Begin':'Skill_2_Begin');assert.equal(begin.active,true);
   await page.evaluate(()=>cnReview.until('first'));first=await page.evaluate(()=>cnReview.snapshot());await capture('first');
   await page.evaluate(()=>cnReview.until('second'));second=await page.evaluate(()=>cnReview.snapshot());await capture('second');
   assert.equal(second.ammo.current,ready.ammo.current);assert.equal(second.attacks,ready.attacks);
   const shots=second.shots.filter(s=>s.key==='projectile_chr_snhunt_02');assert.equal(shots.length,2);assert.ok(shots[1].time-shots[0].time>.16&&shots[1].time-shots[0].time<.22);
   assert.equal(second.enemy.cold,true);await page.evaluate(()=>cnReview.until('finish'));ended=await page.evaluate(()=>cnReview.snapshot());await capture('ended');
   assert.equal(ended.hits.filter(h=>h.kind==='snhunt:s2').length,2);assert.equal(ended.active,false);
  }
  assert.equal(ready.owner.model.endsWith(dir==='UP'?'/back':'/front'),true);assert.equal(ready.slots,1);
  await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');const retired=await page.evaluate(()=>{cnReview.render();return cnReview.snapshot();});await capture('retired');
  assert.equal(retired.stopped,true);assert.equal(retired.handles,0);assert.equal(retired.slots,0);
  await page.evaluate(()=>cnReview.advance(11));const after=await page.evaluate(()=>cnReview.snapshot());assert.equal(after.flights,0);assert.equal(after.hits.length,retired.hits.length);assert.deepEqual(after.ammo,retired.ammo);
  for(const s of[ready,first,second,ended,retired,after]){assert.deepEqual(s.errors,[]);assert.equal(s.glError,0);}
  reports.push({label,ready,first,second,ended,retired,after});await page.close();console.log(label+': natural SP, original skill tracks, source shots/ammunition, Cold, public controls and cleanup passed');
 }
 assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);
 await writeFile(out+'report.json',JSON.stringify({candidate,originalWaves:false,reports,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources},null,2)+'\n');
 console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources}));
}finally{await driver.close();}
