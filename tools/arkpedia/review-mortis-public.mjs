// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled public UI scenario: drop/swipe, ordinary melee, the real skill
// button, S1 defence / S2 three-shot Arts, and the Fever HUD/start. Original-wave clears are separate tests.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {publicReviewDriver} from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182',ID='char_4183_mortis',candidate=process.argv.includes('--candidate');
const out=`.cache/arkpedia/cn-operators/${ID}/public-browser/${candidate?'candidate':'normal'}/`;
const data=JSON.parse(await readFile(candidate?'.cache/arkpedia/arkpedia-mortis-candidate.json':'data/arkpedia-mvp.json'));
assert.ok(!data.sd.localBase&&!data.stage.art?.localBase,'Review must use original HTTPS assets');
assert.deepEqual(data.reviewCandidates,candidate?[ID]:undefined);assert.equal(data.operators[ID].name,'Wakaba Mutsumi');
data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},get fever(){return battle._aveMujicaFever;},enemies:[],hits:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){paused=true;battle.autoFinish=false;battle.timeLimit=1000;
  battle.on('damaged',h=>{if(h.source===this.owner)this.hits.push({time:battle.time,target:h.target.id,amount:h.amount,tags:h.dmg.tags,skill:h.dmg.isSkill,attackId:h.dmg.attackId});});
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / legal deployment / 99 DP / empty waves / pinned healthy targets';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 targets(){const u=this.owner;for(const off of[0,1]){const row=u.tileR+(u.dir==='UP'?1+off:0),col=u.tileC+(u.dir==='UP'?0:1+off);
  const e=battle.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;
  battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true,noDisplace:true}});this.enemies.push(e);}battle._buildEnemyIndex();this.render();},
 until(kind){const end=battle.time+100,p=()=>kind==='ready'?this.owner.skill.ready:kind==='hit'?this.hits.length>0:
  kind==='skillHits'?this.owner.skill.id.endsWith('_1')?!!this.owner.findBuff('mortis:s1:'+this.owner.id):this.hits.filter(h=>h.tags.includes('mortis:s2')).length>=3:kind==='ended'?!this.owner.skill.active:false;
  while(!p()&&battle.time<end)battle.step();if(!p())throw Error('Missing natural '+kind+' at '+battle.time);this.render();},
 fillFever(){this.fever.value=this.fever.need;this.render();},
 snapshot(){const u=this.owner,v=renderer.views.get(u.id),f=this.fever,r=document.querySelector('#fever-reading');return{time:battle.time,sp:u.skill.spTotal,active:u.skill.active,hud:skillHud(u.skill),activations:u.skill.activations,
  fever:f?{value:f.value,active:f.active,remaining:f.remaining}:null,feverReading:r?{hidden:r.hidden,text:r.textContent,active:r.classList.contains('active')}:null,deployed:battle.deployedSlots(),hits:this.hits,
  owner:{atk:u.s.atk,model:v?.key,track:v?.actor?.spine.state.tracks[0]?.animation.name},
  images:Array.from(document.querySelectorAll('.operator-portrait img,.skill-icon')).map(i=>({url:i.src,loaded:i.complete&&i.naturalWidth>0})),errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver=await publicReviewDriver({origin,out,data,hook}),reports=[];
try{for(const mobile of[false,true])for(const skill of[1,2]){
 const label=`${mobile?'phone':'desktop'}-s${skill}`,dir=mobile?'UP':'RIGHT';
 const {page,deploy,capture}=await driver.open({label,mobile,operators:[ID],skillId:`skchr_mortis_${skill}`});
 await page.evaluate(()=>cnReview.setup());await deploy(ID,mobile?2:3,mobile?5:3,dir);
 await page.click(`#deployment [data-id="${ID}"]`);await capture('deployed');
 await page.evaluate(()=>{cnReview.targets();cnReview.until('hit');});const ordinary=await page.evaluate(()=>cnReview.snapshot());await capture('ordinary');
 assert.ok(ordinary.hits.length>0);assert.equal(ordinary.owner.track,'Attack');
 assert.equal(ordinary.owner.model.endsWith(mobile?'/back':'/front'),true);assert.equal(ordinary.feverReading.hidden,false);assert.match(ordinary.feverReading.text,/^Fever \d+\/450$/);
 await page.evaluate(()=>cnReview.until('ready'));await page.waitForFunction(()=>Array.from(document.querySelectorAll('.operator-portrait img,.skill-icon')).every(i=>i.complete&&i.naturalWidth>0));
 const ready=await page.evaluate(()=>cnReview.snapshot());await capture('ready');assert.equal(ready.hud.canActivate,true);assert.ok(ready.images.length>=2&&ready.images.every(i=>i.loaded));
 await page.click('#skill');await page.evaluate(()=>cnReview.until('skillHits'));const started=await page.evaluate(()=>cnReview.snapshot());await capture('skill-hits');
 assert.equal(started.active,true);assert.equal(started.fever.active,false);
 await page.evaluate(()=>cnReview.until('ended'));await page.evaluate(()=>{cnReview.until('ready');cnReview.fillFever();});const full=await page.evaluate(()=>cnReview.snapshot());await capture('fever-full');
 assert.equal(full.feverReading.text,'Fever 450/450');
 await page.click('#skill');await page.evaluate(()=>cnReview.advance(1));const fever=await page.evaluate(()=>cnReview.snapshot());await capture('fever-active');
 assert.equal(fever.fever.active,true);assert.equal(fever.fever.value,0);assert.equal(fever.feverReading.active,true);assert.match(fever.feverReading.text,/^FEVER · (19|20)s$/);
 await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');await page.evaluate(()=>cnReview.advance(2));
 const retired=await page.evaluate(()=>({deployed:cnReview.battle.deployedSlots(),joined:cnReview.fever.joined.size,errors:cnReview.battle.errors,glError:cnReview.renderer.three.getContext().getError()}));await capture('retired');
 assert.equal(retired.deployed,0);assert.equal(retired.joined,0);
 for(const s of[ordinary,ready,started,full,fever,retired]){assert.deepEqual(s.errors,[]);assert.equal(s.glError,0);}
 assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);reports.push({label,ordinary,ready,started,full,fever,retired});await page.close();
 console.log(label+': drop/swipe, ordinary melee, skill effects, Fever HUD/start and cleanup passed');
}
 await writeFile(out+'report.json',JSON.stringify({candidate,originalWaves:false,browserVersion:driver.browserVersion,cacheDisabled:driver.cacheDisabled,
  fixtureTransport:'loopback app/data overrides; external HTTPS unintercepted',reports,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources},null,2)+'\n');
 console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources}));
}catch(error){console.error(JSON.stringify({errors:driver.errors,failedResources:driver.failedResources,completedCases:reports.length}));throw error;}finally{await driver.close();}
