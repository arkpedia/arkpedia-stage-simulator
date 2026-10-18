// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled public UI scenario; original-wave/natural-DP clears are separate.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {publicReviewDriver} from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182',ID='char_4223_botany';
const out=`.cache/arkpedia/cn-operators/${ID}/public-browser/`,candidate=process.argv.includes('--candidate');
// The convenience preview can rewrite SD URLs to a local checkout. Review the raw immutable bindings.
const data=JSON.parse(await readFile(candidate?'.cache/arkpedia/arkpedia-botany-candidate.json':'data/arkpedia-mvp.json'));
assert.ok(!data.sd.localBase&&!data.stage.art?.localBase,'Review must use original HTTPS assets');
assert.equal(data.operators[ID].name,'Botani');data.stage.geometry.waves[0].spawns=[];
data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},get controller(){return this.owner.mem.botany;},enemies:[],hits:[],attacks:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){paused=true;battle.autoFinish=false;battle.timeLimit=1000;
  battle.on('damaged',h=>{if(h.source===this.owner)this.hits.push({time:battle.time,target:h.target.id,amount:h.amount,tags:h.dmg.tags,skill:h.dmg.isSkill,attackId:h.dmg.attackId});});
  battle.on('attack',h=>{if(h.attacker===this.owner)this.attacks.push({time:battle.time,skill:h.isSkill,targets:h.targets.map(t=>t.id)});});
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / legal deployment / 99 DP / empty waves / pinned healthy targets';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 targets(count=1){const u=this.owner;for(let i=0;i<count;i++){
  const row=u.tileR+(u.dir==='UP'?2+i*.2:0),col=u.tileC+(u.dir==='UP'?0:2+i*.2);
  const e=battle.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e7,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;
  battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true,noDisplace:true}});this.enemies.push(e);
 }battle._buildEnemyIndex();this.render();},
 moveOut(){for(const e of this.enemies){e.x=0;e.y=0;}battle._buildEnemyIndex();this.advance(3);},
 until(kind){const end=battle.time+100,p=()=>kind==='ready'?this.owner.skill.ready:kind==='cast'?this.owner.skill.active:
  kind==='s1hit'?this.hits.some(h=>h.tags.includes('botany:s1-injury')):
  kind==='s2hit'?this.hits.filter(h=>h.tags.includes('botany:s2-injury')).length>=2:
  kind==='bursts'?this.enemies.every(e=>e.findBuff('erosionBurst')):!this.owner.skill.active;
  while(!p()&&battle.time<end)battle.step();if(!p())throw Error('Missing natural '+kind+' at '+battle.time);this.render();},
 snapshot(){const u=this.owner,c=this.controller,v=renderer.views.get(u.id);return{time:battle.time,sp:u.skill.spTotal,charges:u.skill.charges,active:u.skill.active,hud:skillHud(u.skill),activations:u.skill.activations,
  mode:!!c.mode,phase:c.phase?.kind,stopped:c.stopped,handles:c.handles.length,flights:c.flights.size,flightWatchers:c.watchers.length,
  talentStacks:c.talent.gift?.stacks??0,talentHandles:c.talent.handles.length,recoveryParents:c.recovery?.records.size??0,recoveryHandles:c.recovery?.handles.length??0,
  deployed:battle.deployedSlots(),hits:this.hits,attacks:this.attacks,
  owner:{hp:u.hp,maxHp:u.s.maxHp,atk:u.s.atk,aspd:u.s.aspd,model:v?.key,requested:u.mem.regularFormVisual?.clip,track:v?.actor?.spine.state.tracks[0]?.animation.name},
  enemies:this.enemies.map(t=>({id:t.id,hp:t.hp,alive:t.alive,erosion:t.elem.erosion,burstLeft:t.findBuff('erosionBurst')?.timeLeft??0})),errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver=await publicReviewDriver({origin,out,data,hook}),reports=[];
try{for(const mobile of[false,true])for(const skill of[1,2]){
 const label=`${mobile?'phone':'desktop'}-s${skill}`,dir=mobile?'UP':'RIGHT';
 const {page,deploy,capture}=await driver.open({label,mobile,operators:[ID],skillId:`skchr_botany_${skill}`});
 await page.evaluate(()=>cnReview.setup());await deploy(ID,mobile?1:2,mobile?5:4,dir);
 await page.click(`#deployment [data-id="${ID}"]`);await capture('deployed');
 await page.evaluate(()=>cnReview.until('ready'));const ready=await page.evaluate(()=>cnReview.snapshot());await capture('ready');
 assert.equal(ready.owner.model.endsWith(mobile?'/back':'/front'),true);assert.equal(ready.hud.ready,skill===2);
 assert.equal(ready.hud.canActivate,skill===2);assert.equal(ready.deployed,1);assert.equal(ready.activations,0);
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.operator-portrait img,.skill-icon')).every(i=>i.complete&&i.naturalWidth>0));
 await page.evaluate(n=>cnReview.targets(n),skill===1?1:2);
 let started,release,burst,ended;
 if(skill===1){
  assert.equal(ready.charges,1);await page.evaluate(()=>cnReview.until('cast'));started=await page.evaluate(()=>cnReview.snapshot());await capture('cast');
  assert.equal(started.charges,0);assert.equal(started.hud.text,'Skill active');assert.equal(started.owner.track,'Skill_1');
  await page.evaluate(()=>cnReview.until('s1hit'));release=await page.evaluate(()=>cnReview.snapshot());await capture('release');
  for(const tag of['botany:s1','botany:s1-extra','botany:s1-extra-injury','botany:s1-injury'])assert.equal(release.hits.filter(h=>h.tags.includes(tag)).length,1);
  assert.equal(release.active,true);assert.equal(release.attacks.length,1);
  await page.evaluate(()=>cnReview.until('ended'));ended=await page.evaluate(()=>cnReview.snapshot());await capture('ended');
  assert.equal(ended.active,false);assert.equal(ended.charges,0);assert.equal(ended.activations,1);burst=null;
 }else{
  await page.click('#skill');await page.evaluate(()=>cnReview.advance(.2));started=await page.evaluate(()=>cnReview.snapshot());await capture('begin');
  assert.equal(started.active,true);assert.equal(started.owner.track,'Skill_2_Begin');assert.equal(started.mode,false);
  await page.evaluate(()=>cnReview.until('s2hit'));release=await page.evaluate(()=>cnReview.snapshot());await capture('two-targets');
  assert.equal(release.mode,true);assert.equal(release.owner.atk,ready.owner.atk);assert.equal(release.owner.track,'Skill_2_Loop');
  const primary=release.hits.filter(h=>h.tags.includes('botany:s2')),extra=release.hits.filter(h=>h.tags.includes('botany:s2-extra'));
  assert.equal(primary.length,2);assert.equal(extra.length,2);assert.equal(new Set(primary.map(h=>h.target)).size,2);
  assert.equal(new Set(primary.map(h=>h.attackId)).size,1);assert.equal(release.attacks.length,1);
  await page.evaluate(()=>cnReview.until('bursts'));const before=await page.evaluate(()=>cnReview.snapshot());await page.evaluate(()=>cnReview.advance(1));
  burst=await page.evaluate(()=>cnReview.snapshot());await capture('bursts');assert.equal(burst.talentStacks,2);assert.equal(burst.recoveryParents,2);
  assert.ok(Math.abs(before.enemies[0].burstLeft-burst.enemies[0].burstLeft-1.25)<1e-5);
  await page.evaluate(()=>{cnReview.moveOut();cnReview.advance(cnReview.owner.skill.timeLeft+.05);});ended=await page.evaluate(()=>cnReview.snapshot());await capture('ended');
  assert.equal(ended.active,false);assert.equal(ended.mode,false);assert.equal(ended.owner.atk,ready.owner.atk);assert.equal(ended.owner.track,'Skill_2_End');assert.equal(ended.recoveryParents,0);
 }
 await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');await page.evaluate(()=>cnReview.advance(3));const retired=await page.evaluate(()=>cnReview.snapshot());await capture('retired');
 assert.equal(retired.stopped,true);assert.equal(retired.handles,0);assert.equal(retired.flightWatchers,0);assert.equal(retired.flights,0);
 assert.equal(retired.talentHandles,0);assert.equal(retired.recoveryParents,0);assert.equal(retired.recoveryHandles,0);assert.equal(retired.deployed,0);
 for(const s of[ready,started,release,burst,ended,retired].filter(Boolean)){assert.deepEqual(s.errors,[]);assert.equal(s.glError,0);}
 assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);reports.push({label,ready,started,release,burst,ended,retired});await page.close();
 console.log(label+': actual drop/swipe, natural SP, original HTTPS assets/tracks, skill payloads, erosion and cleanup passed');
}
 await writeFile(out+'report.json',JSON.stringify({candidate,originalWaves:false,browserVersion:driver.browserVersion,cacheDisabled:driver.cacheDisabled,
  fixtureTransport:'loopback app/data overrides; external HTTPS unintercepted',sourceOrigin:driver.sourceOrigin,fixtureOrigin:driver.fixtureOrigin,reports,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources},null,2)+'\n');
 console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources}));
}catch(error){console.error(JSON.stringify({errors:driver.errors,failedResources:driver.failedResources,completedCases:reports.length}));throw error;}finally{await driver.close();}
