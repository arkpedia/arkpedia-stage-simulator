// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled public UI scenario: drop/swipe, Arts attack or passive healing,
// talent Sanctuary, S1 auto heal with DEF, S2 heal buff, and cleanup. Original-wave clears are separate tests.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {publicReviewDriver} from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182',ID='char_1022_flwr2',G='char_122_beagle',candidate=process.argv.includes('--candidate');
const out=`.cache/arkpedia/cn-operators/${ID}/public-browser/${candidate?'candidate':'normal'}/`;
const data=JSON.parse(await readFile(candidate?'.cache/arkpedia/arkpedia-flwr2-candidate.json':'data/arkpedia-mvp.json'));
assert.ok(!data.sd.localBase&&!data.stage.art?.localBase,'Review must use original HTTPS assets');
assert.deepEqual(data.reviewCandidates,candidate?[ID]:undefined);assert.equal(data.operators[ID].name,'Perfumer the Distilled');
data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},get ally(){return battle.bench['${G}'].unit;},enemies:[],hits:[],heals:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){paused=true;battle.autoFinish=false;battle.timeLimit=1000;
  battle.on('damaged',h=>{if(h.source===this.owner)this.hits.push({time:battle.time,type:h.dmg.type,amount:h.amount});});
  battle.on('heal',h=>{if(h.source===this.owner)this.heals.push({time:battle.time,target:h.target.id,amount:h.amount});});
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / legal deployment / 99 DP / empty waves / pinned healthy targets';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 targets(){const e=battle.spawnEnemy('enemy_1007_slime',{pos:[3,5]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;
  battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true,noDisplace:true}});this.enemies.push(e);battle._buildEnemyIndex();this.render();},
 hurt(){this.ally.hp=this.ally.s.maxHp*.3;this.render();},
 until(kind){const end=battle.time+100,p=()=>kind==='hit'?this.hits.length>0:kind==='heal'?this.heals.some(h=>h.target===this.ally.id):false;
  while(!p()&&battle.time<end)battle.step();if(!p())throw Error('Missing natural '+kind+' at '+battle.time);this.render();},
 snapshot(){const u=this.owner,v=renderer.views.get(u.id),a=this.ally;return{time:battle.time,hits:this.hits,heals:this.heals,
  sanctuary:!!a.findBuff('flwr2:sanctuary:'+u.id),s1:a.findBuff('flwr2:s1:'+u.id)?.mods??null,s2:a.findBuff('flwr2:s2:'+u.id)?.mods??null,deployed:battle.deployedSlots(),
  owner:{model:v?.key,track:v?.actor?.spine.state.tracks[0]?.animation.name},
  images:Array.from(document.querySelectorAll('.operator-portrait img,.skill-icon')).map(i=>({url:i.src,loaded:i.complete&&i.naturalWidth>0})),errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver=await publicReviewDriver({origin,out,data,hook}),reports=[];
try{for(const mobile of[false,true])for(const skill of[1,2]){
 const label=`${mobile?'phone':'desktop'}-s${skill}`,dir=mobile?'UP':'RIGHT';
 const {page,deploy,capture}=await driver.open({label,mobile,operators:[ID,G],skillId:`skchr_flwr2_${skill}`});
 await page.evaluate(()=>cnReview.setup());await deploy(ID,2,4,dir);await deploy(G,3,4,'RIGHT');
 await page.click(`#deployment [data-id="${ID}"]`);await capture('deployed');
 await page.evaluate(()=>cnReview.targets());
 let first;
 if(skill===1){await page.evaluate(()=>cnReview.until('hit'));first=await page.evaluate(()=>cnReview.snapshot());await capture('arts-attack');assert.ok(first.hits.every(h=>h.type==='arts'));}
 await page.evaluate(()=>{cnReview.hurt();cnReview.until('heal');cnReview.advance(.1);});const healed=await page.evaluate(()=>cnReview.snapshot());await capture('healed');
 assert.equal(healed.sanctuary,true);if(skill===1)assert.ok(healed.s1&&healed.s1.defPct>0);else{assert.ok(healed.s2&&healed.s2.atkPct>0);assert.equal(healed.hits.length,0);}
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.operator-portrait img,.skill-icon')).every(i=>i.complete&&i.naturalWidth>0));
 await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');await page.evaluate(()=>cnReview.advance(2));
 const retired=await page.evaluate(()=>({deployed:cnReview.battle.deployedSlots(),sanctuary:!!cnReview.ally.findBuff('flwr2:sanctuary:'+cnReview.owner.id),errors:cnReview.battle.errors,glError:cnReview.renderer.three.getContext().getError()}));await capture('retired');
 assert.equal(retired.deployed,1);assert.equal(retired.sanctuary,false);
 for(const s of[healed,retired,...(first?[first]:[])]){assert.deepEqual(s.errors,[]);assert.equal(s.glError,0);}
 assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);reports.push({label,first,healed,retired});await page.close();
 console.log(label+': drop/swipe, attack/heal, Sanctuary, skill effects and cleanup passed');
}
 await writeFile(out+'report.json',JSON.stringify({candidate,originalWaves:false,browserVersion:driver.browserVersion,cacheDisabled:driver.cacheDisabled,
  fixtureTransport:'loopback app/data overrides; external HTTPS unintercepted',reports,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources},null,2)+'\n');
 console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources}));
}catch(error){console.error(JSON.stringify({errors:driver.errors,failedResources:driver.failedResources,completedCases:reports.length}));throw error;}finally{await driver.close();}
