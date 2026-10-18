// SPDX-License-Identifier: GPL-3.0-or-later
// Actual squad/deploy/skill UI; controlled targets, original-wave clears separate.
import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
import {publicReviewDriver} from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182',ID='char_4218_aigis',candidate=process.argv.includes('--candidate'),out=`.cache/arkpedia/cn-operators/${ID}/public-browser/`;
const data=JSON.parse(await readFile(candidate?'.cache/arkpedia/arkpedia-aegis-candidate.json':'data/arkpedia-mvp.json'));assert.ok(!data.sd.localBase&&!data.stage.art?.localBase);assert.equal(data.operators[ID].name,'Aegis');
data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},get controller(){return this.owner.mem.aegis;},enemies:[],hits:[],attacks:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){paused=true;battle.autoFinish=false;battle.timeLimit=1000;battle.on('damaged',h=>{if(h.source===this.owner)this.hits.push({time:battle.time,target:h.target.id,amount:h.amount,tags:h.dmg.tags,skill:h.dmg.isSkill,attackId:h.dmg.attackId});});
  battle.on('attack',h=>{if(h.attacker===this.owner)this.attacks.push({time:battle.time,skill:h.isSkill,targets:h.targets.map(t=>t.id)});});
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / legal deployment / 99 DP / empty waves / pinned targets';label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 targets(count=1,air=false){const u=this.owner;for(let i=0;i<count;i++){const row=u.tileR+(u.dir==='UP'?2+i*.2:0),col=u.tileC+(u.dir==='UP'?0:2+i*.2),e=battle.spawnEnemy('enemy_1007_slime',{pos:[row,col]});
  Object.assign(e.base,{maxHp:1e7,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;e.motion=air?'FLY':'WALK';battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true,noDisplace:true}});this.enemies.push(e);}battle._buildEnemyIndex();this.render();},
 clearEnemies(){for(const e of this.enemies)if(e.alive)battle.kill(e,null);this.render();},
 until(kind){const end=battle.time+100,p=()=>kind==='ready'?this.owner.skill.ready:kind==='ordinary'?this.attacks.some(a=>!a.skill):kind==='s1hit'?this.hits.filter(h=>h.tags.includes('aegis:s1')).length===2:
  kind==='stun'?this.controller.flight.mode===3:kind==='s1return'?this.controller.phase?.kind==='s1-return':kind==='s1ended'?this.controller.flight.mode===0:
  kind==='s2first'?this.attacks.filter(a=>a.skill).length===1:kind==='kick'?this.controller.phase?.kind==='s2-kick':kind==='end'?this.controller.phase?.kind==='s2-end':!this.owner.skill.active;
  while(!p()&&battle.time<end)battle.step();if(!p())throw Error('Missing natural '+kind+' at '+battle.time);this.render();},
 snapshot(){const u=this.owner,c=this.controller,v=renderer.views.get(u.id);return{time:battle.time,sp:u.skill.spTotal,charges:u.skill.charges,active:u.skill.active,hud:skillHud(u.skill),activations:u.skill.activations,
  mode:c.flight.mode??null,phase:c.phase?.kind,blockMode:u.mem.regularBlockMode?.mode??null,height:c.flight.heightNow(),stopped:c.stopped,canAct:u.canAct,canBlock:u.s.blockCnt,
  handles:c.handles.length,accountHandles:c.accountHandles.length,flights:c.payload.flights.size,flightWatchers:c.payload.watchers.length,flightHandles:c.flight.handles.length,talentHandles:c.talent.handles.length,deployed:battle.deployedSlots(),hits:this.hits,attacks:this.attacks,
  owner:{hp:u.hp,maxHp:u.s.maxHp,model:v?.key,requested:u.mem.regularFormVisual?.clip,track:v?.actor?.spine.state.tracks[0]?.animation.name},
  images:Array.from(document.querySelectorAll('.operator-portrait img,.skill-icon')).map(i=>({url:i.src,loaded:i.complete&&i.naturalWidth>0})),errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver=await publicReviewDriver({origin,out,data,hook}),reports=[];
try{for(const mobile of[false,true])for(const skill of[1,2]){
 const label=`${mobile?'phone':'desktop'}-s${skill}`,dir=mobile?'UP':'RIGHT',{page,deploy,capture}=await driver.open({label,mobile,operators:[ID],skillId:`skchr_aigis_${skill}`});
 await page.evaluate(()=>cnReview.setup());await deploy(ID,mobile?1:2,mobile?5:4,dir);await page.click(`#deployment [data-id="${ID}"]`);await capture('deployed');
 await page.evaluate(()=>{cnReview.targets(1,true);cnReview.until('ordinary');});const ordinary=await page.evaluate(()=>cnReview.snapshot());await capture('ordinary');assert.equal(ordinary.owner.track,'Attack');assert.equal(ordinary.attacks.length,1);assert.equal(ordinary.attacks[0].skill,false);
 await page.evaluate(()=>{cnReview.clearEnemies();cnReview.until('ready');});await page.waitForFunction(()=>Array.from(document.querySelectorAll('.operator-portrait img,.skill-icon')).every(i=>i.complete&&i.naturalWidth>0));
 const ready=await page.evaluate(()=>cnReview.snapshot());await capture('ready');assert.equal(ready.owner.model.endsWith(mobile?'/back':'/front'),true);assert.equal(ready.hud.ready,true);assert.equal(ready.hud.canActivate,skill===1);assert.equal(ready.deployed,1);assert.equal(ready.activations,0);assert.ok(ready.images.length>=2&&ready.images.every(i=>i.loaded));
 await page.evaluate(()=>cnReview.targets(2));await page.click('#skill');await page.evaluate(()=>cnReview.advance(.2));const started=await page.evaluate(()=>cnReview.snapshot());await capture('begin');assert.equal(started.active,true);assert.equal(started.charges,0);assert.equal(started.owner.track,`Skill_${skill}_Begin`);
 let release,kick,stun,returning,ended;
 if(skill===1){await page.evaluate(()=>cnReview.until('s1hit'));release=await page.evaluate(()=>cnReview.snapshot());await capture('release');assert.equal(release.owner.track,'Skill_1_Loop');assert.equal(release.blockMode,'WALK');assert.equal(release.hits.filter(h=>h.tags.includes('aegis:s1')).length,2);assert.equal(release.attacks.filter(a=>a.skill).length,1);
  await page.evaluate(()=>cnReview.until('stun'));stun=await page.evaluate(()=>cnReview.snapshot());await capture('stun');assert.equal(stun.active,false);assert.equal(stun.canAct,false);assert.equal(stun.blockMode,'WALK');
  await page.evaluate(()=>cnReview.advance(1));const recovery=await page.evaluate(()=>cnReview.snapshot());await capture('stun-sp');assert.ok(recovery.sp>.9);assert.equal(recovery.canAct,false);
  await page.evaluate(()=>cnReview.until('s1return'));returning=await page.evaluate(()=>cnReview.snapshot());await capture('return');assert.equal(returning.blockMode,'FLY');if(!mobile)assert.equal(returning.owner.track,'nSkill_1_Stun_End');
  await page.evaluate(()=>cnReview.until('s1ended'));ended=await page.evaluate(()=>cnReview.snapshot());await capture('ended');assert.equal(ended.mode,0);assert.equal(ended.active,false);kick=null;
 }else{await page.evaluate(()=>cnReview.until('s2first'));release=await page.evaluate(()=>cnReview.snapshot());await capture('missiles');assert.equal(release.owner.track,'Skill_2_Begin');assert.equal(release.hud.text,'Skill active');assert.equal(release.attacks.filter(a=>a.skill).length,1);assert.equal(release.blockMode,'WALK');
  await page.evaluate(()=>cnReview.until('kick'));kick=await page.evaluate(()=>cnReview.snapshot());await capture('kick');assert.equal(kick.owner.track,'Skill_2_Loop');assert.equal(kick.phase,'s2-kick');assert.equal(kick.attacks.filter(a=>a.skill).length,2);assert.equal(kick.blockMode,'WALK');
  await page.evaluate(()=>cnReview.until('end'));returning=await page.evaluate(()=>cnReview.snapshot());await capture('return');assert.equal(returning.owner.track,'Skill_2_End');assert.equal(returning.blockMode,'FLY');assert.equal(returning.hits.filter(h=>h.tags.includes('aegis:s2')).length,14);
  assert.equal(new Set(returning.hits.filter(h=>h.tags.includes('aegis:s2:missile')).map(h=>h.attackId)).size,1);await page.evaluate(()=>cnReview.until('ended'));ended=await page.evaluate(()=>cnReview.snapshot());await capture('ended');assert.equal(ended.active,false);assert.equal(ended.attacks.filter(a=>a.skill).length,2);stun=null;
 }
 assert.equal(ended.owner.track,'Idle');assert.equal(ended.blockMode,'FLY');assert.equal(ended.height,.4000000059604645);
 await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');await page.evaluate(()=>cnReview.advance(3));const retired=await page.evaluate(()=>cnReview.snapshot());await capture('retired');assert.equal(retired.stopped,true);
 for(const key of['handles','accountHandles','flights','flightWatchers','flightHandles','talentHandles','deployed'])assert.equal(retired[key],0,key);
 for(const s of[ordinary,ready,started,release,kick,stun,returning,ended,retired].filter(Boolean)){assert.deepEqual(s.errors,[]);assert.equal(s.glError,0);}assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);
 reports.push({label,ordinary,ready,started,release,kick,stun,returning,ended,retired});await page.close();console.log(label+': public drop/swipe, original HTTPS, aerial ordinary, natural SP, manual skill sequence and cleanup passed');
}
 await writeFile(out+'report.json',JSON.stringify({candidate,originalWaves:false,browserVersion:driver.browserVersion,cacheDisabled:driver.cacheDisabled,fixtureTransport:'Loopback app/data fixtures; external HTTPS unintercepted',sourceOrigin:driver.sourceOrigin,fixtureOrigin:driver.fixtureOrigin,reports,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources},null,2)+'\n');console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources}));
}catch(error){console.error(JSON.stringify({errors:driver.errors,failedResources:driver.failedResources,completedCases:reports.length}));throw error;}finally{await driver.close();}
