// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled public UI scenario: drop/swipe, real skill button and the Equipment
// Adaptation field button. Original-wave/natural-DP clears are separate tests.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {publicReviewDriver} from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182',ID='char_394_hadiya',candidate=process.argv.includes('--candidate');
const out=`.cache/arkpedia/cn-operators/${ID}/public-browser/${candidate?'candidate':'normal'}/`;
const data=JSON.parse(await readFile(candidate?'.cache/arkpedia/arkpedia-hadiya-candidate.json':'data/arkpedia-mvp.json'));
assert.ok(!data.sd.localBase&&!data.stage.art?.localBase,'Review must use original HTTPS assets');
assert.deepEqual(data.reviewCandidates,candidate?[ID]:undefined);assert.equal(data.operators[ID].name,'Hadiya');
data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},get controller(){return this.owner.mem.hadiyaOwner;},enemies:[],hits:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){paused=true;battle.autoFinish=false;battle.timeLimit=1000;
  battle.on('damaged',h=>{if(h.source===this.owner)this.hits.push({time:battle.time,target:h.target.id,amount:h.amount,type:h.dmg.type,skill:h.dmg.isSkill});});
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / legal deployment / 99 DP / empty waves / pinned healthy targets';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 targets(count=1){const u=this.owner;for(let i=0;i<count;i++){
  const row=u.tileR+(u.dir==='UP'?1:0),col=u.tileC+(u.dir==='UP'?i*.15:1+i*.15);
  const e=battle.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;
  battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true,noDisplace:true}});this.enemies.push(e);
 }battle._buildEnemyIndex();this.render();},
 until(kind){const end=battle.time+100,c=()=>this.controller,p=()=>kind==='ready'?this.owner.skill.ready:kind==='hit'?this.hits.length>0:
  kind==='state'?!!c()?.state&&c().state.deadline!=null:kind==='extra'?!!c()?.state?.extra:kind==='ended'?!this.owner.skill.active&&c()?.mode===0:false;
  while(!p()&&battle.time<end)battle.step();if(!p())throw Error('Missing natural '+kind+' at '+battle.time);this.render();},
 snapshot(){const u=this.owner,c=this.controller,v=renderer.views.get(u.id),s=document.querySelector('#secondary');return{time:battle.time,dp:battle.dp,sp:u.skill.spTotal,active:u.skill.active,
  hud:skillHud(u.skill),activations:u.skill.activations,mode:c?.mode,deadline:c?.state?.deadline??null,extra:!!c?.state?.extra,stopped:c?c.stopped:true,
  secondary:s?{disabled:s.disabled,ready:s.classList.contains('ready'),label:s.getAttribute('aria-label')}:null,deployed:battle.deployedSlots(),hits:this.hits,
  owner:{hp:u.hp,atk:u.s.atk,def:u.s.def,model:v?.key,track:v?.actor?.spine.state.tracks[0]?.animation.name,action:!!u.mem.regularSecondaryAction},
  images:Array.from(document.querySelectorAll('.operator-portrait img,.skill-icon')).map(i=>({url:i.src,loaded:i.complete&&i.naturalWidth>0})),errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver=await publicReviewDriver({origin,out,data,hook}),reports=[];
try{for(const mobile of[false,true])for(const skill of[1,2]){
 const label=`${mobile?'phone':'desktop'}-s${skill}`,dir=mobile?'UP':'RIGHT';
 const {page,deploy,capture}=await driver.open({label,mobile,operators:[ID],skillId:`skchr_hadiya_${skill}`});
 await page.evaluate(()=>cnReview.setup());await deploy(ID,mobile?2:3,mobile?5:3,dir);
 await page.click(`#deployment [data-id="${ID}"]`);await capture('deployed');
 await page.evaluate(n=>{cnReview.targets(n);cnReview.until('hit');},skill===2?3:1);const ordinary=await page.evaluate(()=>cnReview.snapshot());await capture('ordinary');
 assert.ok(ordinary.hits.every(h=>h.amount>0&&h.type==='phys'));assert.match(ordinary.owner.track,/^Attack_[AB]$/);assert.equal(ordinary.owner.model.endsWith(mobile?'/back':'/front'),true);
 assert.equal(ordinary.secondary.disabled,true);
 await page.evaluate(()=>cnReview.until('ready'));await page.waitForFunction(()=>Array.from(document.querySelectorAll('.operator-portrait img,.skill-icon')).every(i=>i.complete&&i.naturalWidth>0));
 const ready=await page.evaluate(()=>cnReview.snapshot());await capture('ready');assert.equal(ready.hud.canActivate,true);assert.ok(ready.images.length>=2&&ready.images.every(i=>i.loaded));
 let started,adapted;
 if(skill===1){
  // Equipment Adaptation starts S1 from full SP for 10 DP.
  assert.equal(ready.secondary.disabled,false);assert.match(ready.secondary.label,/Equipment Adaptation · 10 DP/);
  await page.click('#secondary');await page.evaluate(()=>{cnReview.until('extra');cnReview.advance(1);});adapted=started=await page.evaluate(()=>cnReview.snapshot());await capture('adaptation-start');
  assert.equal(adapted.dp,ready.dp-10);assert.equal(adapted.activations,1);assert.equal(adapted.active,true);assert.equal(adapted.secondary.disabled,true);assert.ok(adapted.owner.def>ready.owner.def&&adapted.owner.atk>ready.owner.atk);
 }else{
  assert.equal(ready.secondary.disabled,true);
  await page.click('#skill');await page.evaluate(()=>cnReview.until('state'));started=await page.evaluate(()=>cnReview.snapshot());await capture('skill-mode');
  assert.equal(started.dp,ready.dp-10);assert.equal(started.secondary.disabled,false);assert.match(started.secondary.label,/15 DP/);
  await page.click('#secondary');await page.evaluate(()=>cnReview.advance(.1));adapted=await page.evaluate(()=>cnReview.snapshot());await capture('adaptation-extend');
  assert.equal(adapted.dp,started.dp-15);assert.ok(Math.abs(adapted.deadline-started.deadline-15)<1e-6);assert.equal(adapted.secondary.disabled,true);
  const n=adapted.hits.length;await page.evaluate(()=>cnReview.advance(2));const multi=await page.evaluate(()=>cnReview.snapshot());await capture('three-targets');
  assert.ok(new Set(multi.hits.slice(n).map(h=>h.target)).size>=2);
 }
 await page.evaluate(()=>cnReview.until('ended'));const ended=await page.evaluate(()=>cnReview.snapshot());await capture('ended');assert.equal(ended.active,false);
 await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');await page.evaluate(()=>cnReview.advance(2));
 const retired=await page.evaluate(()=>({deployed:cnReview.battle.deployedSlots(),errors:cnReview.battle.errors,glError:cnReview.renderer.three.getContext().getError(),secondary:document.querySelector('#secondary')?.offsetParent!=null}));await capture('retired');
 assert.equal(retired.deployed,0);assert.equal(retired.secondary,false);
 for(const s of[ordinary,ready,started,adapted,ended,retired]){assert.deepEqual(s.errors,[]);assert.equal(s.glError,0);}
 assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);reports.push({label,ordinary,ready,started,adapted,ended,retired});await page.close();
 console.log(label+': drop/swipe, ordinary hits, skill button, Equipment Adaptation button, DP and cleanup passed');
}
 await writeFile(out+'report.json',JSON.stringify({candidate,originalWaves:false,browserVersion:driver.browserVersion,cacheDisabled:driver.cacheDisabled,
  fixtureTransport:'loopback app/data overrides; external HTTPS unintercepted',reports,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources},null,2)+'\n');
 console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources}));
}catch(error){console.error(JSON.stringify({errors:driver.errors,failedResources:driver.failedResources,completedCases:reports.length}));throw error;}finally{await driver.close();}
