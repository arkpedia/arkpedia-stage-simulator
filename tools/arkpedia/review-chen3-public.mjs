// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled public UI scenario: drop/swipe on the lane, weakness-typed ordinary hit, S1 double hit and
// silence, S2 away window (drawn off the field) and move onto its target, S3 bouncing sword wave, and cleanup. Original-wave clears are separate tests.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {publicReviewDriver} from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182',ID='char_1050_chen3',G='char_122_beagle',candidate=process.argv.includes('--candidate');
const out=`.cache/arkpedia/cn-operators/${ID}/public-browser/${candidate?'candidate':'normal'}/`;
const data=JSON.parse(await readFile(candidate?'.cache/arkpedia/arkpedia-chen3-candidate.json':'data/arkpedia-mvp.json'));
assert.ok(!data.sd.localBase&&!data.stage.art?.localBase,'Review must use original HTTPS assets');
assert.deepEqual(data.reviewCandidates,candidate?[ID]:undefined);assert.equal(data.operators[ID].name,"Ch'en the Dawnstreak");
data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},enemies:[],hits:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){paused=true;battle.autoFinish=false;battle.timeLimit=1000;
  battle.on('damaged',h=>{if(h.source===this.owner||h.credit===this.owner)this.hits.push({time:battle.time,amount:h.amount,type:h.dmg.type,tags:h.dmg.tags});});
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / legal deployment / 99 DP / empty waves / pinned healthy targets';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 targets(){for(const c of[4]){const e=battle.spawnEnemy('enemy_1007_slime',{pos:[3,c]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;
  battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true,noDisplace:true}});this.enemies.push(e);}battle._buildEnemyIndex();this.render();},
 until(kind){const end=battle.time+100,p=()=>kind==='ready'?this.owner.skill.ready:kind==='hit'?this.hits.some(h=>!h.tags?.includes('chen3')):kind==='cast'?this.owner.skill.activations>0:kind==='ended'?!this.owner.skill.active:kind==='s1'?this.hits.some(h=>h.tags?.includes('chen3:s1-second')):kind==='away'?!!this.owner.mem.regularHidden:kind==='back'?!this.owner.mem.chen3Owner?.away:kind==='wave'?this.hits.some(h=>h.tags?.includes('chen3:s3-wave')):false;
  while(!p()&&battle.time<end)battle.step();if(!p())throw Error('Missing natural '+kind+' at '+battle.time);this.render();},
 snapshot(){const u=this.owner,v=renderer.views.get(u.id);return{time:battle.time,dp:battle.dp,active:u.skill.active,activations:u.skill.activations,hud:skillHud(u.skill),o:{tile:[u.tileR,u.tileC],hidden:!!u.mem.regularHidden,visible:v?.actor?.spine.visible,silenced:this.enemies.filter(e=>e.s.flags.silence).length,t1:!!u.findBuff('chen3:t1'),wave:!!battle.regularVisualProjectiles?.size},
  deployed:battle.deployedSlots(),hits:this.hits,owner:{atk:u.s.atk,model:v?.key,track:v?.actor?.spine.state.tracks[0]?.animation.name},
  images:Array.from(document.querySelectorAll('.operator-portrait img,.skill-icon')).map(i=>({url:i.src,loaded:i.complete&&i.naturalWidth>0})),errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver=await publicReviewDriver({origin,out,data,hook}),reports=[];
try{for(const mobile of[false,true])for(const skill of[1,2,3]){
 const label=`${mobile?'phone':'desktop'}-s${skill}`,dir=mobile?'UP':'RIGHT';
 const {page,deploy,capture}=await driver.open({label,mobile,operators:[ID,G],skillId:`skchr_chen3_${skill}`});
 await page.evaluate(()=>cnReview.setup());await deploy(ID,3,3,'RIGHT');await deploy(G,3,1,'RIGHT');
 await page.click(`#deployment [data-id="${ID}"]`);await capture('deployed');
 await page.evaluate(()=>{cnReview.targets();cnReview.until('hit');});const ordinary=await page.evaluate(()=>cnReview.snapshot());await capture('hit');
 assert.ok(ordinary.hits.some(h=>h.type==='arts'),'weakness: a 0 DEF/0 RES tie keeps Arts');assert.equal(ordinary.o.t1,true);
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.operator-portrait img,.skill-icon')).every(i=>i.complete&&i.naturalWidth>0));
 await page.evaluate(()=>cnReview.until('ready'));const ready=await page.evaluate(()=>cnReview.snapshot());assert.equal(ready.hud.canActivate,true);
 await page.click('#skill');let started;
 if(skill===1){await page.evaluate(()=>cnReview.until('s1'));const s1=started=await page.evaluate(()=>cnReview.snapshot());await capture('skill');assert.equal(s1.active,true);assert.equal(s1.o.silenced,1);}
 else if(skill===2){await page.evaluate(()=>cnReview.until('away'));const away=await page.evaluate(()=>cnReview.snapshot());await capture('away');assert.equal(away.o.visible,false);
  await page.evaluate(()=>{cnReview.until('back');cnReview.advance(.3);});const back=started=await page.evaluate(()=>cnReview.snapshot());await capture('arrived');
  assert.equal(back.o.visible,true);assert.deepEqual(back.o.tile,[3,4]);assert.equal(back.hits.filter(h=>h.tags?.includes('chen3:s2-slash')).length,10);}
 else{await page.evaluate(()=>cnReview.until('wave'));const s3=started=await page.evaluate(()=>cnReview.snapshot());await capture('skill');assert.equal(s3.active,true);assert.equal(s3.o.wave,true);}
 await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');await page.evaluate(()=>cnReview.advance(2));
 const retired=await page.evaluate(()=>({deployed:cnReview.battle.deployedSlots(),wave:!!cnReview.battle.regularVisualProjectiles?.size,silenced:cnReview.enemies.filter(e=>e.s.flags.silence).length,errors:cnReview.battle.errors,glError:cnReview.renderer.three.getContext().getError()}));await capture('retired');
 assert.equal(retired.deployed,1);assert.equal(retired.wave,false);assert.equal(retired.silenced,0);
 for(const s of[ordinary,started,retired]){assert.deepEqual(s.errors,[]);assert.equal(s.glError,0);}
 assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);reports.push({label,ordinary,started,retired});await page.close();
 console.log(label+': drop/swipe, weakness hit, '+['S1 silence','S2 away and move','S3 sword wave'][skill-1]+', cleanup passed');
}
 await writeFile(out+'report.json',JSON.stringify({candidate,originalWaves:false,browserVersion:driver.browserVersion,cacheDisabled:driver.cacheDisabled,
  fixtureTransport:'loopback app/data overrides; external HTTPS unintercepted',reports,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources},null,2)+'\n');
 console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources}));
}catch(error){console.error(JSON.stringify({errors:driver.errors,failedResources:driver.failedResources,completedCases:reports.length}));throw error;}finally{await driver.close();}
