// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {publicReviewDriver} from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182',ID='char_4203_kichi',out=`.cache/arkpedia/cn-operators/${ID}/public-browser/`,candidate=process.argv.includes('--candidate');
const data=candidate?JSON.parse(await readFile('.cache/arkpedia/arkpedia-kichi-candidate.json')):await(await fetch(origin+'/data/arkpedia-mvp.json')).json();
assert.equal(data.operators[ID].name,'Kichisei');data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},get controller(){return this.owner.mem.kichi;},enemies:[],hits:[],waves:[],states:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){battle.autoFinish=false;battle.timeLimit=1000;paused=true;
  battle.on('damaged',c=>{if(c.source?.defId==='${ID}')this.hits.push({time:battle.time,amount:c.amount,skill:c.dmg.isSkill,attackId:c.dmg.attackId});});
  battle.on('calculatedDamage',c=>{if(c.source?.defId==='${ID}'&&c.dmg.isSkill)this.states.push({time:battle.time,slow:!!c.target.findBuff('sluggish'),bind:!!c.target.findBuff('bind'),stun:!!c.target.findBuff('stun')});});
  battle.on('attack',c=>{if(c.attacker?.defId==='${ID}'&&c.isSkill)this.waves.push({time:battle.time,targets:c.targets.length});});
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / 99 DP / empty waves / two pinned targets';label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 target(){const u=this.owner;for(const dc of[0,-.35]){const e=battle.spawnEnemy('enemy_1007_slime',{pos:[u.tileR+(u.dir==='UP'?1:-1),u.tileC+dc]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true}});this.enemies.push(e);}battle._buildEnemyIndex();},
 until(kind){const end=battle.time+100;const pred=()=>kind==='ready'?this.owner.skill.ready:kind==='first'?this.waves.length>=1:kind==='second'?this.waves.length>=2:kind==='third'?this.waves.length>=3:kind==='capped'?this.controller.resources.skillStacks===4:!this.owner.skill.active;
  while(!pred()&&battle.time<end)battle.step();if(!pred())throw Error('Missing natural '+kind);this.render();},
 snapshot(){const u=this.owner,c=this.controller,v=renderer.views.get(u.id);return{time:battle.time,sp:u.skill.spTotal,active:u.skill.active,hud:skillHud(u.skill),attacks:u.stats.attacks,activations:u.skill.activations,
  stacks:c.resources.skillStacks,cycle:c.resources.cycle,marked:c.resources.marked.size,stopped:c.stopped,handles:c.handles.length,slots:battle.deployedSlots(),hits:this.hits,waves:this.waves,states:this.states,
  owner:{atk:u.s.atk,baseAtk:u.base.atk,model:v?.key,requested:u.mem.regularFormVisual?.clip,track:v?.actor.spine.state.tracks[0]?.animation.name},errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver=await publicReviewDriver({origin,out,data,hook}),reports=[];
try{
 for(const mobile of[false,true])for(const skill of[1,2])for(const dir of['DOWN','UP']){
  const label=`${mobile?'phone':'desktop'}-s${skill}-${dir.toLowerCase()}`;
  const{page,deploy,capture}=await driver.open({label,mobile,operators:[ID],skillId:`skchr_kichi_${skill}`});
  await page.evaluate(()=>cnReview.setup());await deploy(ID,dir==='UP'?1:4,6,dir);await page.evaluate(()=>{cnReview.advance(1.1);cnReview.target();});await page.click(`#deployment [data-id="${ID}"]`);await capture('deployed');
  await page.evaluate(()=>cnReview.until('ready'));const ready=await page.evaluate(()=>cnReview.snapshot());await capture('ready');assert.equal(ready.hud.canActivate,true);assert.ok(ready.attacks>0);assert.equal(ready.owner.model.endsWith(dir==='UP'?'/back':'/front'),true);
  await page.click('#skill');await page.evaluate(()=>cnReview.render());const begin=await page.evaluate(()=>cnReview.snapshot());await capture('begin');assert.equal(begin.owner.track,`Skill_${skill}_Begin`);assert.equal(begin.active,true);
  await page.evaluate(()=>cnReview.until('first'));const first=await page.evaluate(()=>cnReview.snapshot());await capture('first');assert.equal(first.owner.track,dir==='DOWN'?`Skill_Down_${skill}_Loop`:`Skill_${skill}_Loop`);assert.equal(first.waves[0].targets,2);assert.equal(first.hits.filter(h=>h.skill).length,2);
  let active;
  if(skill===1){
   assert.equal(first.stacks,1);await page.evaluate(()=>cnReview.until('capped'));active=await page.evaluate(()=>cnReview.snapshot());await capture('capped');assert.equal(active.stacks,4);assert.equal(active.waves.length,4);assert.equal(active.hits.filter(h=>h.skill).length,8);assert.equal(active.owner.atk,active.owner.baseAtk*2);
  }else{
   await page.evaluate(()=>cnReview.until('second'));const second=await page.evaluate(()=>cnReview.snapshot());await capture('second');assert.equal(second.cycle,2);
   await page.evaluate(()=>cnReview.until('third'));active=await page.evaluate(()=>cnReview.snapshot());await capture('third');assert.equal(active.cycle,0);assert.equal(active.waves.length,3);
   for(let i=0;i<6;i++){const s=active.states[i];assert.equal(s[['slow','bind','stun'][Math.floor(i/2)]],true);}
  }
  await page.evaluate(()=>cnReview.until('finish'));const ended=await page.evaluate(()=>cnReview.snapshot());await capture('ended');assert.equal(ended.active,false);assert.equal(ended.stacks,0);assert.equal(ended.cycle,0);assert.equal(ended.owner.atk,ended.owner.baseAtk);
  await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');const retired=await page.evaluate(()=>{cnReview.render();return cnReview.snapshot();});await capture('retired');assert.equal(retired.stopped,true);assert.equal(retired.handles,0);assert.equal(retired.slots,0);assert.equal(retired.marked,0);
  await page.evaluate(()=>cnReview.advance(3));const after=await page.evaluate(()=>cnReview.snapshot());assert.equal(after.hits.length,retired.hits.length);
  for(const s of[ready,begin,first,active,ended,retired,after]){assert.deepEqual(s.errors,[]);assert.equal(s.glError,0);}
  reports.push({label,ready,begin,first,active,ended,retired,after});await page.close();console.log(label+': natural SP, source waves/stacks/status cycle, original tracks, public controls and cleanup passed');
 }
 assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);await writeFile(out+'report.json',JSON.stringify({candidate,originalWaves:false,reports,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources},null,2)+'\n');console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources}));
}finally{await driver.close();}
