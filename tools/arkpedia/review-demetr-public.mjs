// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled public UI scenario: drop/swipe on the lane, ordinary hit with DEF shred, S1 automatic double hit,
// S2 three targets from the skill button, S3 pursuit move and return, and cleanup. Original-wave clears are separate tests.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {publicReviewDriver} from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182',ID='char_4037_demetr',G='char_122_beagle',candidate=process.argv.includes('--candidate');
const out=`.cache/arkpedia/cn-operators/${ID}/public-browser/${candidate?'candidate':'normal'}/`;
const data=JSON.parse(await readFile(candidate?'.cache/arkpedia/arkpedia-demetr-candidate.json':'data/arkpedia-mvp.json'));
assert.ok(!data.sd.localBase&&!data.stage.art?.localBase,'Review must use original HTTPS assets');
assert.deepEqual(data.reviewCandidates,candidate?[ID]:undefined);assert.equal(data.operators[ID].name,'Bellone');
data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},enemies:[],hits:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){paused=true;battle.autoFinish=false;battle.timeLimit=1000;
  battle.on('damaged',h=>{if(h.source===this.owner||h.credit===this.owner)this.hits.push({time:battle.time,amount:h.amount,type:h.dmg.type,tags:h.dmg.tags,target:h.target.id});});
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / legal deployment / 99 DP / empty waves / pinned healthy targets';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 targets(){for(const c of[3.4,4,5]){const e=battle.spawnEnemy('enemy_1007_slime',{pos:[3,c]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;
  battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true,noDisplace:true}});this.enemies.push(e);}battle._buildEnemyIndex();this.render();},
 until(kind){const end=battle.time+100,p=()=>kind==='ready'?this.owner.skill.ready:kind==='hit'?this.hits.some(h=>!h.tags?.includes('demetr')):kind==='cast'?this.owner.skill.activations>0:kind==='ended'?!this.owner.skill.active:kind==='s1'?this.hits.some(h=>h.tags?.includes('demetr:s1-second')):kind==='three'?new Set(this.hits.filter(h=>!h.tags?.includes('demetr')).map(h=>h.target)).size>=3:false;
  while(!p()&&battle.time<end)battle.step();if(!p())throw Error('Missing natural '+kind+' at '+battle.time);this.render();},
 snapshot(){const u=this.owner,v=renderer.views.get(u.id);return{time:battle.time,dp:battle.dp,active:u.skill.active,activations:u.skill.activations,hud:skillHud(u.skill),o:{tile:[u.tileR,u.tileC],shred:this.enemies.filter(e=>e.findBuff('demetr:shred:'+u.id)).length},
  deployed:battle.deployedSlots(),hits:this.hits,owner:{atk:u.s.atk,model:v?.key,track:v?.actor?.spine.state.tracks[0]?.animation.name},
  images:Array.from(document.querySelectorAll('.operator-portrait img,.skill-icon')).map(i=>({url:i.src,loaded:i.complete&&i.naturalWidth>0})),errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver=await publicReviewDriver({origin,out,data,hook}),reports=[];
try{for(const mobile of[false,true])for(const skill of[1,2,3]){
 const label=`${mobile?'phone':'desktop'}-s${skill}`,dir=mobile?'UP':'RIGHT';
 const {page,deploy,capture}=await driver.open({label,mobile,operators:[ID,G],skillId:`skchr_demetr_${skill}`});
 await page.evaluate(()=>cnReview.setup());await deploy(ID,3,3,'RIGHT');await deploy(G,3,1,'RIGHT');
 await page.click(`#deployment [data-id="${ID}"]`);await capture('deployed');
 await page.evaluate(()=>{cnReview.targets();cnReview.until('hit');});const ordinary=await page.evaluate(()=>cnReview.snapshot());await capture('hit');
 assert.ok(ordinary.o.shred>=1);
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.operator-portrait img,.skill-icon')).every(i=>i.complete&&i.naturalWidth>0));
 let started;
 if(skill===1){await page.evaluate(()=>cnReview.until('s1'));started=await page.evaluate(()=>cnReview.snapshot());await capture('auto');}
 else{await page.evaluate(()=>cnReview.until('ready'));if(skill===3)await page.evaluate(()=>{cnReview.battle.kill(cnReview.enemies[0]);cnReview.render();});
  const ready=await page.evaluate(()=>cnReview.snapshot());assert.equal(ready.hud.canActivate,true);await page.click('#skill');
  if(skill===2){await page.evaluate(()=>cnReview.until('three'));started=await page.evaluate(()=>cnReview.snapshot());}
  else{await page.evaluate(()=>cnReview.advance(.3));started=await page.evaluate(()=>cnReview.snapshot());assert.notDeepEqual(started.o.tile,[3,3],'moved onto an enemy');}
  await capture('skill');assert.equal(started.active,true);
  if(skill===3){await page.evaluate(()=>{cnReview.owner.skill.end('review');cnReview.advance(.3);});const home=await page.evaluate(()=>cnReview.snapshot());await capture('home');assert.deepEqual(home.o.tile,[3,3]);}}
 await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');await page.evaluate(()=>cnReview.advance(2));
 const retired=await page.evaluate(()=>({deployed:cnReview.battle.deployedSlots(),tile:[cnReview.owner.tileR,cnReview.owner.tileC],errors:cnReview.battle.errors,glError:cnReview.renderer.three.getContext().getError()}));await capture('retired');
 assert.equal(retired.deployed,1);
 for(const s of[ordinary,started,retired]){assert.deepEqual(s.errors,[]);assert.equal(s.glError,0);}
 assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);reports.push({label,ordinary,started,retired});await page.close();
 console.log(label+': drop/swipe, DEF shred, '+['S1 double hit','S2 three targets','S3 pursuit and return'][skill-1]+', cleanup passed');
}
 await writeFile(out+'report.json',JSON.stringify({candidate,originalWaves:false,browserVersion:driver.browserVersion,cacheDisabled:driver.cacheDisabled,
  fixtureTransport:'loopback app/data overrides; external HTTPS unintercepted',reports,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources},null,2)+'\n');
 console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources}));
}catch(error){console.error(JSON.stringify({errors:driver.errors,failedResources:driver.failedResources,completedCases:reports.length}));throw error;}finally{await driver.close();}
