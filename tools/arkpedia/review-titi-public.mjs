// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled public UI scenario: drop/swipe on high ground, Arts hit with the non-moving bonus,
// every skill from the skill button, S2 self/ally sleep and its manual stop, and cleanup. Original-wave clears are separate tests.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {publicReviewDriver} from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182',ID='char_4056_titi',G='char_122_beagle',candidate=process.argv.includes('--candidate');
const out=`.cache/arkpedia/cn-operators/${ID}/public-browser/${candidate?'candidate':'normal'}/`;
const data=JSON.parse(await readFile(candidate?'.cache/arkpedia/arkpedia-titi-candidate.json':'data/arkpedia-mvp.json'));
assert.ok(!data.sd.localBase&&!data.stage.art?.localBase,'Review must use original HTTPS assets');
assert.deepEqual(data.reviewCandidates,candidate?[ID]:undefined);assert.equal(data.operators[ID].name,'Titi');
data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},enemies:[],hits:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){paused=true;battle.autoFinish=false;battle.timeLimit=1000;
  battle.on('damaged',h=>{if(h.source===this.owner||h.credit===this.owner)this.hits.push({time:battle.time,amount:h.amount,type:h.dmg.type,tags:h.dmg.tags});});
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / legal deployment / 99 DP / empty waves / pinned healthy targets';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 targets(){const e=battle.spawnEnemy('enemy_1007_slime',{pos:[3,3.6]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;
  battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true,noDisplace:true}});this.enemies.push(e);battle._buildEnemyIndex();this.render();},
 until(kind){const end=battle.time+100,p=()=>kind==='ready'?this.owner.skill.ready:kind==='hit'?this.hits.some(h=>h.tags?.includes('titi:still')):kind==='cast'?this.owner.skill.activations>0:kind==='ended'?!this.owner.skill.active:kind==='sleep'?this.enemies.some(e=>e.s.flags.sleep):false;
  while(!p()&&battle.time<end)battle.step();if(!p())throw Error('Missing natural '+kind+' at '+battle.time);this.render();},
 snapshot(){const u=this.owner,v=renderer.views.get(u.id);return{time:battle.time,dp:battle.dp,active:u.skill.active,activations:u.skill.activations,hud:skillHud(u.skill),sleep:{owner:!!u.s.flags.sleep,ally:!!battle.bench['${G}'].unit?.s.flags.sleep,enemy:this.enemies.some(e=>e.s.flags.sleep)},
  deployed:battle.deployedSlots(),hits:this.hits,owner:{atk:u.s.atk,model:v?.key,track:v?.actor?.spine.state.tracks[0]?.animation.name},
  images:Array.from(document.querySelectorAll('.operator-portrait img,.skill-icon')).map(i=>({url:i.src,loaded:i.complete&&i.naturalWidth>0})),errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver=await publicReviewDriver({origin,out,data,hook}),reports=[];
try{for(const mobile of[false,true])for(const skill of[1,2,3]){
 const label=`${mobile?'phone':'desktop'}-s${skill}`,dir=mobile?'UP':'RIGHT';
 const {page,deploy,capture}=await driver.open({label,mobile,operators:[ID,G],skillId:`skchr_titi_${skill}`});
 await page.evaluate(()=>cnReview.setup());await deploy(G,3,3,'RIGHT');await deploy(ID,2,4,'UP');await page.evaluate(()=>{const g=cnReview.battle.bench['char_122_beagle'].unit;g.hp=g.s.maxHp*.3;});
 await page.click(`#deployment [data-id="${ID}"]`);await capture('deployed');
 await page.evaluate(()=>{cnReview.targets();cnReview.until('hit');});const ordinary=await page.evaluate(()=>cnReview.snapshot());await capture('hit');
 assert.ok(ordinary.hits.some(h=>h.type==='arts'&&!h.tags?.includes('titi')));
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.operator-portrait img,.skill-icon')).every(i=>i.complete&&i.naturalWidth>0));
 await page.evaluate(()=>cnReview.until('ready'));const ready=await page.evaluate(()=>cnReview.snapshot());assert.equal(ready.hud.canActivate,true);
 await page.click('#skill');await page.evaluate(n=>cnReview.advance(n===3?5:1.1),skill);const started=await page.evaluate(()=>cnReview.snapshot());await capture('skill');
 assert.equal(started.active,true);
 if(skill===2){assert.deepEqual(started.sleep,{owner:true,ally:true,enemy:true});await page.click('#skill');await page.evaluate(()=>cnReview.advance(.2));const stopped=await page.evaluate(()=>cnReview.snapshot());await capture('stopped');
  assert.equal(stopped.active,false);assert.equal(stopped.sleep.owner,false);assert.equal(stopped.sleep.ally,false);}
 else{await page.evaluate(()=>cnReview.until('sleep'));const slept=await page.evaluate(()=>cnReview.snapshot());assert.equal(slept.active,true);assert.equal(slept.sleep.enemy,true);}
 await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');await page.evaluate(()=>cnReview.advance(2));
 const retired=await page.evaluate(()=>({deployed:cnReview.battle.deployedSlots(),titiBuffs:cnReview.battle.bench['char_122_beagle'].unit?.buffs.filter(b=>String(b.key).startsWith('titi:')).length,errors:cnReview.battle.errors,glError:cnReview.renderer.three.getContext().getError()}));await capture('retired');
 assert.equal(retired.deployed,1);assert.equal(retired.titiBuffs,0);
 for(const s of[ordinary,started,retired]){assert.deepEqual(s.errors,[]);assert.equal(s.glError,0);}
 assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);reports.push({label,ordinary,started,retired});await page.close();
 console.log(label+': drop/swipe, Arts hit and non-moving bonus, skill start (S2 sleep and stop), cleanup passed');
}
 await writeFile(out+'report.json',JSON.stringify({candidate,originalWaves:false,browserVersion:driver.browserVersion,cacheDisabled:driver.cacheDisabled,
  fixtureTransport:'loopback app/data overrides; external HTTPS unintercepted',reports,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources},null,2)+'\n');
 console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources}));
}catch(error){console.error(JSON.stringify({errors:driver.errors,failedResources:driver.failedResources,completedCases:reports.length}));throw error;}finally{await driver.close();}
