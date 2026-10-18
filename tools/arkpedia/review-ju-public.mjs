// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled public UI scenario; original-wave/natural-DP clears are separate.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {publicReviewDriver} from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182',ID='char_4221_ju';
const out=`.cache/arkpedia/cn-operators/${ID}/public-browser/`,candidate=process.argv.includes('--candidate');
// Read the raw snapshot: the convenience preview may rewrite SD URLs to a local asset checkout.
const data=JSON.parse(await readFile(candidate?'.cache/arkpedia/arkpedia-ju-candidate.json':'data/arkpedia-mvp.json'));
assert.ok(!data.sd.localBase&&!data.stage.art?.localBase,'Review must use original HTTPS assets');
assert.equal(data.operators[ID].name,'Ju');data.stage.geometry.waves[0].spawns=[];
data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},get controller(){return this.owner.mem.ju;},enemies:[],hits:[],attacks:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){paused=true;battle.autoFinish=false;battle.timeLimit=1000;
  battle.on('damaged',h=>{if(h.source===this.owner)this.hits.push({time:battle.time,target:h.target.id,amount:h.amount,tags:h.dmg.tags,skill:h.dmg.isSkill,attackId:h.dmg.attackId});});
  battle.on('attack',h=>{if(h.attacker===this.owner)this.attacks.push({time:battle.time,skill:h.isSkill,targets:h.targets.map(t=>t.id)});});
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / legal deployment / 99 DP / empty waves / pinned targets and scripted half-HP trigger';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 targets(count=1){const u=this.owner;for(let i=0;i<count;i++){
  const row=u.tileR+(u.dir==='UP'?2:0)+(u.dir==='UP'?i*.2:0),col=u.tileC+(u.dir==='UP'?0:2)+(u.dir==='UP'?0:i*.2);
  const e=battle.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e7,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp*.9;
  battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true,noDisplace:true}});this.enemies.push(e);
 }battle._buildEnemyIndex();this.render();},
 eligible(){for(const e of this.enemies)e.hp=e.s.maxHp*.49;this.render();},
 moveOut(){for(const e of this.enemies){e.x=0;e.y=0;}battle._buildEnemyIndex();this.advance(3);},
 wound(){const e=this.enemies[0],u=this.owner;e.x=u.tileC+(u.dir==='UP'?0:2);e.y=u.tileR+(u.dir==='UP'?2:0);e.hp=100;
  battle._buildEnemyIndex();this.until('wound');},
 until(kind){const end=battle.time+100,p=()=>kind==='ready'?this.owner.skill.ready:kind==='charges'?this.owner.skill.charges===2:
  kind==='ordinary'?this.hits.some(h=>h.tags.includes('ju:ordinary')):kind==='cast'?this.owner.skill.active:
  kind==='s1hit'?this.hits.some(h=>h.tags.includes('ju:s1')):kind==='s1done'?this.owner.skill.activations===2&&!this.owner.skill.active:
  kind==='s2hit'?this.hits.filter(h=>h.tags.includes('ju:s2:attack')).length>=2:kind==='extras'?this.hits.filter(h=>h.tags.includes('ju_s2_extra')).length>=2:
  kind==='wound'?!!this.enemies[0]?.findBuff('cripple'):!this.owner.skill.active;
  while(!p()&&battle.time<end)battle.step();if(!p())throw Error('Missing natural '+kind+' at '+battle.time);this.render();},
 snapshot(){const u=this.owner,c=this.controller,v=renderer.views.get(u.id);return{time:battle.time,sp:u.skill.spTotal,charges:u.skill.charges,active:u.skill.active,hud:skillHud(u.skill),activations:u.skill.activations,
  mode:!!c.mode,phase:c.phase?.kind,stopped:c.stopped,handles:c.handles.length,flights:c.flights.size,flightWatchers:c.watchers.length,
  wounds:c.wounds.pending.size,woundWatchers:c.wounds.watchers.length,extraPending:c.extra?.pending.size??0,extraWatchers:c.extra?.watchers.length??0,extraHandles:c.extra?.handles.length??0,
  deployed:battle.deployedSlots(),hits:this.hits,attacks:this.attacks,
  owner:{hp:u.hp,maxHp:u.s.maxHp,atk:u.s.atk,model:v?.key,requested:u.mem.regularFormVisual?.clip,track:v?.actor?.spine.state.tracks[0]?.animation.name},
  enemies:this.enemies.map(t=>({id:t.id,hp:t.hp,alive:t.alive,wounded:!!t.findBuff('cripple'),done:!!t.findBuff('ju_s_2[done]')})),errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver=await publicReviewDriver({origin,out,data,hook}),reports=[];
try{for(const mobile of[false,true])for(const skill of[1,2]){
 const label=`${mobile?'phone':'desktop'}-s${skill}`,dir=mobile?'UP':'RIGHT';
 const {page,deploy,capture}=await driver.open({label,mobile,operators:[ID],skillId:`skchr_ju_${skill}`});
 await page.evaluate(()=>cnReview.setup());await deploy(ID,mobile?1:2,mobile?5:4,dir);
 await page.click(`#deployment [data-id="${ID}"]`);await capture('deployed');
 await page.evaluate(k=>cnReview.until(k),skill===1?'charges':'ready');const ready=await page.evaluate(()=>cnReview.snapshot());await capture('ready');
 assert.equal(ready.owner.model.endsWith(mobile?'/back':'/front'),true);assert.equal(ready.hud.ready,skill===2);assert.equal(ready.hud.canActivate,skill===2);assert.equal(ready.deployed,1);
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.operator-portrait img,.skill-icon')).every(i=>i.complete&&i.naturalWidth>0));
 await page.evaluate(n=>cnReview.targets(n),skill===1?1:2);
 let started,release,extra,ended;
 if(skill===1){
  assert.equal(ready.charges,2);await page.evaluate(()=>cnReview.until('ordinary'));const healthy=await page.evaluate(()=>cnReview.snapshot());assert.equal(healthy.activations,0);assert.equal(healthy.charges,2);
  await page.evaluate(()=>{cnReview.eligible();cnReview.until('cast');});started=await page.evaluate(()=>cnReview.snapshot());await capture('cast');
  assert.equal(started.charges,1);assert.equal(started.hud.text,'Skill active');assert.equal(started.owner.track,'Skill_1');
  await page.evaluate(()=>cnReview.until('s1hit'));release=await page.evaluate(()=>cnReview.snapshot());await capture('release');
  assert.equal(release.hits.filter(h=>h.tags.includes('ju:s1')).length,1);assert.equal(release.active,true);
  await page.evaluate(()=>cnReview.until('s1done'));ended=await page.evaluate(()=>cnReview.snapshot());await capture('two-charges-spent');
  assert.equal(ended.charges,0);assert.equal(ended.activations,2);assert.equal(ended.hits.filter(h=>h.tags.includes('ju:s1')).length,2);extra=ended;
 }else{
  await page.click('#skill');await page.evaluate(()=>cnReview.advance(.25));started=await page.evaluate(()=>cnReview.snapshot());await capture('begin');
  assert.equal(started.active,true);assert.equal(started.owner.track,'Skill_2_Begin');assert.equal(started.mode,false);
  await page.evaluate(()=>cnReview.until('s2hit'));release=await page.evaluate(()=>cnReview.snapshot());await capture('two-targets');
  assert.equal(release.mode,true);assert.equal(release.owner.atk,ready.owner.atk*2);
  const hits=release.hits.filter(h=>h.tags.includes('ju:s2:attack'));assert.equal(hits.length,2);assert.equal(new Set(hits.map(h=>h.attackId)).size,1);
  await page.evaluate(()=>{cnReview.eligible();cnReview.until('extras');});extra=await page.evaluate(()=>cnReview.snapshot());await capture('delayed-extra');
  const extras=extra.hits.filter(h=>h.tags.includes('ju_s2_extra'));assert.equal(extras.length,2);assert.ok(extras[1].time-extras[0].time>=.3-1e-6);assert.ok(extra.enemies.every(e=>e.done));
  await page.evaluate(()=>{cnReview.moveOut();cnReview.advance(cnReview.owner.skill.timeLeft+.05);});ended=await page.evaluate(()=>cnReview.snapshot());await capture('ended');
  assert.equal(ended.active,false);assert.equal(ended.mode,false);assert.equal(ended.owner.atk,ready.owner.atk);assert.equal(ended.owner.track,'Skill_2_End');
 }
 await page.evaluate(()=>cnReview.moveOut());await page.evaluate(()=>cnReview.wound());const wounded=await page.evaluate(()=>cnReview.snapshot());await capture('wounded');
 assert.equal(wounded.enemies[0].hp,1);assert.equal(wounded.enemies[0].wounded,true);assert.equal(wounded.enemies[0].alive,true);
 await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');await page.evaluate(()=>cnReview.advance(11));const retired=await page.evaluate(()=>cnReview.snapshot());await capture('retired');
 assert.equal(retired.stopped,true);assert.equal(retired.handles,0);assert.equal(retired.flightWatchers,0);assert.equal(retired.flights,0);assert.equal(retired.wounds,0);assert.equal(retired.woundWatchers,0);
 assert.equal(retired.extraPending,0);assert.equal(retired.extraWatchers,0);assert.equal(retired.extraHandles,0);assert.equal(retired.deployed,0);assert.equal(retired.enemies[0].alive,false);
 for(const s of[ready,started,release,extra,ended,wounded,retired]){assert.deepEqual(s.errors,[]);assert.equal(s.glError,0);}
 assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);reports.push({label,ready,started,release,extra,ended,wounded,retired});await page.close();
 console.log(label+': actual drop/swipe, natural SP, original assets/tracks, source attacks, delayed damage, wounds and cleanup passed');
}
 await writeFile(out+'report.json',JSON.stringify({candidate,originalWaves:false,browserVersion:driver.browserVersion,cacheDisabled:driver.cacheDisabled,fixtureTransport:'loopback app/data overrides; external HTTPS unintercepted',sourceOrigin:driver.sourceOrigin,fixtureOrigin:driver.fixtureOrigin,reports,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources},null,2)+'\n');
 console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources}));
}catch(error){console.error(JSON.stringify({errors:driver.errors,failedResources:driver.failedResources,completedCases:reports.length}));throw error;}finally{await driver.close();}
