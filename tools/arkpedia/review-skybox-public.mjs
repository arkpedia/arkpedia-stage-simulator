// SPDX-License-Identifier: GPL-3.0-or-later
// Actual squad and deployment UI; controlled targets/waves, original-wave clears separate.
import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
import {publicReviewDriver} from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182',ID='char_4213_skybx',candidate=process.argv.includes('--candidate'),
 out=`.cache/arkpedia/cn-operators/${ID}/public-browser/`;
const data=JSON.parse(await readFile(candidate?'.cache/arkpedia/arkpedia-skybox-candidate.json':'data/arkpedia-mvp.json'));
assert.ok(!data.sd.localBase&&!data.stage.art?.localBase,'Use original immutable HTTPS bindings');assert.equal(data.operators[ID].name,'Skybox');
data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},get controller(){return this.owner.mem.skybox;},enemies:[],hits:[],attacks:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){paused=true;battle.autoFinish=false;battle.timeLimit=1000;
  battle.on('damaged',h=>{if(h.source===this.owner)this.hits.push({time:battle.time,target:h.target.id,amount:h.amount,tags:h.dmg.tags,skill:h.dmg.isSkill,attackId:h.dmg.attackId});});
  battle.on('attack',h=>{if(h.attacker===this.owner)this.attacks.push({time:battle.time,skill:h.isSkill,targets:h.targets.map(t=>t.id)});});
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / legal deployment / 99 DP / empty waves / pinned targets';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 targets(count=1,air=false){const u=this.owner;for(let i=0;i<count;i++){
  const row=u.tileR+(u.dir==='UP'?2+i*.2:0),col=u.tileC+(u.dir==='UP'?0:2+i*.2),e=battle.spawnEnemy('enemy_1007_slime',{pos:[row,col]});
  Object.assign(e.base,{maxHp:1e7,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;e.motion=air?'FLY':'WALK';
  battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true,noDisplace:true}});this.enemies.push(e);
 }battle._buildEnemyIndex();this.render();},
 clearEnemies(){for(const e of this.enemies)if(e.alive)battle.kill(e,null);this.render();},
 until(kind){const end=battle.time+100,p=()=>kind==='ready'?this.owner.skill.ready:kind==='ordinary'?this.attacks.some(a=>!a.skill):
  kind==='cast'?this.owner.skill.active:kind==='s1hit'?this.hits.filter(h=>h.tags.includes('skybox:s1')).length===2:
  kind==='s1end'?this.controller.phase?.kind==='s1-end':kind==='s2hit'?this.hits.filter(h=>h.tags.includes('skybox:s2')).length>=2:
  kind==='overload'?this.owner.skill.ammoLeft===5:kind==='burst'?this.attacks.filter(a=>a.skill).length===6:
  kind==='return'?this.controller.flight.mode===3:!this.owner.skill.active;
  while(!p()&&battle.time<end)battle.step();if(!p())throw Error('Missing natural '+kind+' at '+battle.time);this.render();},
 snapshot(){const u=this.owner,c=this.controller,v=renderer.views.get(u.id);return{time:battle.time,sp:u.skill.spTotal,charges:u.skill.charges,active:u.skill.active,ammo:u.skill.ammoLeft,hud:skillHud(u.skill),activations:u.skill.activations,
  mode:c.flight.mode??null,phase:c.phase?.kind,closeCount:c.phase?.count??null,blockMode:u.mem.regularBlockMode?.mode??null,height:c.flight.heightNow(),stopped:c.stopped,
  handles:c.handles.length,accountHandles:c.accountHandles.length,flights:c.payload.flights.size,flightWatchers:c.payload.watchers.length,ordinaryFlights:c.flights.size,ordinaryWatchers:c.watchers.length,
  flightHandles:c.flight.handles.length,talentHandles:c.talent.handles.length,deployed:battle.deployedSlots(),hits:this.hits,attacks:this.attacks,
  owner:{hp:u.hp,maxHp:u.s.maxHp,model:v?.key,requested:u.mem.regularFormVisual?.clip,track:v?.actor?.spine.state.tracks[0]?.animation.name},
  errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver=await publicReviewDriver({origin,out,data,hook}),reports=[];
try{for(const mobile of[false,true])for(const skill of[1,2]){
 const label=`${mobile?'phone':'desktop'}-s${skill}`,dir=mobile?'UP':'RIGHT',
  {page,deploy,capture}=await driver.open({label,mobile,operators:[ID],skillId:`skchr_skybx_${skill}`});
 await page.evaluate(()=>cnReview.setup());await deploy(ID,mobile?1:2,mobile?5:4,dir);
 await page.click(`#deployment [data-id="${ID}"]`);await capture('deployed');
 await page.evaluate(()=>{cnReview.targets(1,true);cnReview.until('ordinary');});const ordinary=await page.evaluate(()=>cnReview.snapshot());await capture('ordinary');
 assert.equal(ordinary.owner.track,'Attack');assert.equal(ordinary.attacks.length,1);assert.equal(ordinary.attacks[0].skill,false);
 await page.evaluate(()=>{cnReview.clearEnemies();cnReview.until('ready');});const ready=await page.evaluate(()=>cnReview.snapshot());await capture('ready');
 assert.equal(ready.owner.model.endsWith(mobile?'/back':'/front'),true);assert.equal(ready.hud.ready,skill===2);assert.equal(ready.hud.canActivate,skill===2);
 assert.equal(ready.deployed,1);assert.equal(ready.activations,0);
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.operator-portrait img,.skill-icon')).every(i=>i.complete&&i.naturalWidth>0));
 await page.evaluate(()=>cnReview.targets(2));let started,release,overload,burst,returning,ended;
 if(skill===1){
  await page.evaluate(()=>cnReview.until('cast'));started=await page.evaluate(()=>cnReview.snapshot());await capture('begin');
  assert.equal(started.owner.track,'Skill_1_Begin');assert.equal(started.hud.text,'Skill active');assert.equal(started.charges,0);
  await page.evaluate(()=>cnReview.until('s1hit'));release=await page.evaluate(()=>cnReview.snapshot());await capture('release');
  assert.equal(release.hits.filter(h=>h.tags.includes('skybox:s1')).length,2);assert.equal(release.attacks.filter(a=>a.skill).length,1);assert.equal(release.blockMode,'WALK');
  await page.evaluate(()=>cnReview.until('s1end'));returning=await page.evaluate(()=>cnReview.snapshot());await capture('return');assert.equal(returning.owner.track,'Skill_1_End');
  await page.evaluate(()=>cnReview.until('ended'));ended=await page.evaluate(()=>cnReview.snapshot());await capture('ended');assert.equal(ended.blockMode,'FLY');
  assert.equal(ended.active,false);assert.equal(ended.charges,0);overload=null;burst=null;
 }else{
  await page.click('#skill');await page.evaluate(()=>cnReview.advance(.2));started=await page.evaluate(()=>cnReview.snapshot());await capture('begin');
  assert.equal(started.owner.track,'Skill_2_Begin');assert.equal(started.mode,1);assert.equal(started.active,true);
  await page.evaluate(()=>cnReview.until('s2hit'));release=await page.evaluate(()=>cnReview.snapshot());await capture('loop');
  assert.equal(release.owner.track,'Skill_2_Loop');assert.equal(release.mode,2);assert.equal(release.blockMode,'WALK');assert.equal(release.ammo,9);assert.equal(release.height,0);
  await page.evaluate(()=>cnReview.until('overload'));overload=await page.evaluate(()=>cnReview.snapshot());await capture('overload');
  assert.equal(overload.hud.state,'overloaded');assert.equal(overload.hud.canCancel,true);assert.equal(overload.ammo,5);
  await page.click('#skill');await page.evaluate(()=>cnReview.advance(.2));const close=await page.evaluate(()=>cnReview.snapshot());await capture('close');
  assert.equal(close.owner.track,'Skill_2_Close');assert.equal(close.closeCount,5);assert.equal(close.hud.canCancel,false);
  await page.evaluate(()=>cnReview.until('burst'));burst=await page.evaluate(()=>cnReview.snapshot());await capture('burst');assert.equal(burst.ammo,4);
  await page.evaluate(()=>cnReview.until('return'));returning=await page.evaluate(()=>cnReview.snapshot());await capture('return');
  assert.equal(returning.owner.track,'Skill_2_End');assert.equal(returning.mode,3);assert.equal(returning.blockMode,'FLY');
  await page.evaluate(()=>cnReview.until('ended'));ended=await page.evaluate(()=>cnReview.snapshot());await capture('ended');
  assert.equal(ended.active,false);assert.equal(ended.mode,0);assert.equal(ended.attacks.filter(a=>a.skill).length,10);
  assert.equal(ended.hits.filter(h=>h.tags.includes('skybox:s2')).length,20);
 }
 assert.equal(ended.owner.track,'Idle');await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');await page.evaluate(()=>cnReview.advance(3));
 const retired=await page.evaluate(()=>cnReview.snapshot());await capture('retired');assert.equal(retired.stopped,true);
 for(const key of['handles','accountHandles','flights','flightWatchers','ordinaryFlights','ordinaryWatchers','flightHandles','talentHandles','deployed'])assert.equal(retired[key],0,key);
 for(const s of[ordinary,ready,started,release,overload,burst,returning,ended,retired].filter(Boolean)){assert.deepEqual(s.errors,[]);assert.equal(s.glError,0);}
 assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);reports.push({label,ordinary,ready,started,release,overload,burst,returning,ended,retired});await page.close();
 console.log(label+': public drop/swipe, original HTTPS, aerial ordinary, natural SP, source skill/ammo/flight and cleanup passed');
}
 await writeFile(out+'report.json',JSON.stringify({candidate,originalWaves:false,browserVersion:driver.browserVersion,cacheDisabled:driver.cacheDisabled,
  fixtureTransport:'Loopback app/data fixtures; external HTTPS unintercepted',sourceOrigin:driver.sourceOrigin,fixtureOrigin:driver.fixtureOrigin,reports,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources},null,2)+'\n');
 console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources}));
}catch(error){console.error(JSON.stringify({errors:driver.errors,failedResources:driver.failedResources,completedCases:reports.length}));throw error;}finally{await driver.close();}
