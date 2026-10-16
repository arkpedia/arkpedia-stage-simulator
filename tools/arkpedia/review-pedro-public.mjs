// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled public UI fixture; original-wave completion is tested separately.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {publicReviewDriver} from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182',ID='char_4234_pedro',SKILLS=['skchr_pedro_1','skchr_pedro_2'],out=`.cache/arkpedia/cn-operators/${ID}/public-browser/`,candidate=process.argv.includes('--candidate');
const data=candidate?JSON.parse(await readFile('.cache/arkpedia/arkpedia-pedro-candidate.json')):await(await fetch(origin+'/data/arkpedia-mvp.json')).json();
assert.equal(data.operators[ID].name,'Pedro');data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},get controller(){return this.owner.mem.pedro;},get resources(){return this.owner.mem.pedroResources;},enemies:[],hits:[],attacks:[],heals:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){paused=true;battle.autoFinish=false;battle.timeLimit=1000;
  battle.on('damaged',x=>{if(x.source===this.owner||x.credit===this.owner)this.hits.push({time:battle.time,amount:x.amount,type:x.type,tags:x.dmg.tags,skill:x.dmg.isSkill,attackId:x.dmg.attackId});});
  battle.on('attack',x=>{if(x.attacker===this.owner)this.attacks.push({time:battle.time,skill:x.isSkill,targets:x.targets.length});});
  battle.on('heal',x=>{if(x.target===this.owner)this.heals.push({time:battle.time,source:x.source?.id,amount:x.amount});});
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / legal ranged tile / 99 DP / empty waves / pinned targets / scripted half-HP trigger';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 target(){for(const dc of[0,.35]){const e=battle.spawnEnemy('enemy_1007_slime',{pos:[3,5+dc]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true,noDisplace:true}});this.enemies.push(e);}battle._buildEnemyIndex();},
 until(kind){const end=battle.time+100,pred=()=>kind==='ready'?this.owner.skill.ready:kind==='charges'?this.owner.skill.charges===2:kind==='cast'?this.owner.skill.active:kind==='marked'?this.enemies.every(t=>!!t.findBuff('pedro:s1:trigger')):kind==='protected'?!!this.owner.findBuff('pedro:s2:protection'):!this.owner.skill.active;
  while(!pred()&&battle.time<end)battle.step();if(!pred())throw Error('Missing natural '+kind);this.render();},
 injure(){this.owner.hp=this.owner.s.maxHp*.5;this.advance(.21);},
 clear(){for(const t of this.enemies)if(t.alive)battle.kill(t,null);this.advance(.1);},
 snapshot(){const u=this.owner,c=this.controller,r=this.resources,v=renderer.views.get(u.id);return{time:battle.time,sp:u.skill.spTotal,charges:u.skill.charges,active:u.skill.active,hud:skillHud(u.skill),activations:u.skill.activations,
  phase:c.phase?.kind,stopped:c.stopped,handles:c.handles.length,flightHandles:c.flightHandles.length,marks:r.field.marks.size,fieldHandles:r.field.handles.length,deployed:battle.deployedSlots(),hits:this.hits,attacks:this.attacks,heals:this.heals,
  protected:!!u.findBuff('pedro:s2:protection'),taunt:u.s.taunt,enemyMarks:this.enemies.filter(t=>!!t.findBuff('pedro:s1:trigger')).length,
  owner:{id:u.id,hp:u.hp,maxHp:u.s.maxHp,atk:u.s.atk,baseAtk:c.record.stats.atk,model:v?.key,requested:u.mem.regularFormVisual?.clip,track:v?.actor.spine.state.tracks[0]?.animation.name},errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver=await publicReviewDriver({origin,out,data,hook}),reports=[];
try{
 for(const mobile of[false,true])for(const skill of[1,2])for(const dir of['DOWN','UP']){
  const label=`${mobile?'phone':'desktop'}-s${skill}-${dir.toLowerCase()}`;
  const {page,deploy,capture}=await driver.open({label,mobile,operators:[ID],skillId:SKILLS[skill-1]});
  await page.evaluate(()=>cnReview.setup());await deploy(ID,dir==='UP'?1:4,5,dir);await page.evaluate(()=>{cnReview.advance(1.1);cnReview.target();});await page.click(`#deployment [data-id="${ID}"]`);await capture('deployed');
  await page.evaluate(kind=>cnReview.until(kind),skill===2?'charges':'ready');const ready=await page.evaluate(()=>cnReview.snapshot());await capture('ready');assert.ok(ready.attacks.length>0);assert.equal(ready.owner.model.endsWith(dir==='UP'?'/back':'/front'),true);assert.equal(ready.hud.canActivate,skill===2);
  if(skill===2){assert.equal(ready.charges,2);await page.click('#skill');await page.evaluate(()=>cnReview.render());}else await page.evaluate(()=>cnReview.until('cast'));
  const cast=await page.evaluate(()=>cnReview.snapshot());await capture('cast');assert.equal(cast.active,true);assert.equal(cast.hud.text,skill===1?'Skill active · Marking shot':'Skill active · Protection');assert.equal(cast.owner.track,dir==='DOWN'?`Skill_Down_${skill}`:`Skill_${skill}`);if(skill===2)assert.equal(cast.charges,1);
  await page.evaluate(kind=>cnReview.until(kind),skill===1?'marked':'protected');const released=await page.evaluate(()=>cnReview.snapshot());await capture('released');
  if(skill===1){assert.equal(released.enemyMarks,2);assert.equal(released.attacks.filter(a=>a.skill).length,1);assert.equal(released.attacks.find(a=>a.skill).targets,2);assert.equal(released.sp,0);assert.equal(released.hits.filter(h=>h.skill).length,2);}else{assert.equal(released.protected,true);assert.equal(released.heals.length,0);assert.ok(released.attacks.every(a=>!a.skill));}
  await page.evaluate(()=>cnReview.until('finish'));const ended=await page.evaluate(()=>cnReview.snapshot());await capture('ended');assert.equal(ended.active,false);assert.equal(ended.owner.atk,ready.owner.atk);
  let triggered=ended;if(skill===2){await page.evaluate(()=>cnReview.injure());triggered=await page.evaluate(()=>cnReview.snapshot());await capture('triggered');assert.equal(triggered.protected,false);assert.equal(triggered.owner.hp,triggered.owner.maxHp);assert.equal(triggered.taunt,-1);assert.equal(triggered.heals.length,1);assert.equal(triggered.heals[0].source,triggered.owner.id);}
  await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');const retired=await page.evaluate(()=>{cnReview.render();return cnReview.snapshot();});await capture('retired');assert.equal(retired.stopped,true);assert.equal(retired.handles,0);assert.equal(retired.deployed,0);
  await page.evaluate(()=>{cnReview.advance(11);cnReview.clear();});const cleaned=await page.evaluate(()=>cnReview.snapshot());assert.equal(cleaned.flightHandles,0);assert.equal(cleaned.fieldHandles,0);assert.equal(cleaned.marks,0);assert.equal(cleaned.attacks.length,retired.attacks.length);
  for(const s of[ready,cast,released,ended,triggered,retired,cleaned]){assert.deepEqual(s.errors,[]);assert.equal(s.glError,0);}
  assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);reports.push({label,ready,cast,released,ended,triggered,retired,cleaned});await page.close();console.log(label+': legal deployment, natural offensive/time SP, original clips, source trigger work and cleanup passed');
 }
 const report={candidate,originalWaves:false,browserVersion:driver.browserVersion,cacheDisabled:driver.cacheDisabled,fixtureTransport:'loopback app/data overrides; external HTTPS unintercepted',sourceOrigin:driver.sourceOrigin,fixtureOrigin:driver.fixtureOrigin,reports,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources};
 assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);await writeFile(out+'report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources}));
}finally{await driver.close();}
