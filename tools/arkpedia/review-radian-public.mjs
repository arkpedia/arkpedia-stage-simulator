// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled public UI scenario: drop/swipe on high ground, the skill's own original tower placed from its card,
// an ordinary tower hit (melee, bullet or Arts), the skill from the button with one more summon, and cleanup. Original-wave clears are separate tests.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {publicReviewDriver} from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182',ID='char_4195_radian',G='char_122_beagle',candidate=process.argv.includes('--candidate');
const out=`.cache/arkpedia/cn-operators/${ID}/public-browser/${candidate?'candidate':'normal'}/`;
const data=JSON.parse(await readFile(candidate?'.cache/arkpedia/arkpedia-radian-candidate.json':'data/arkpedia-mvp.json'));
assert.ok(!data.sd.localBase&&!data.stage.art?.localBase,'Review must use original HTTPS assets');
assert.deepEqual(data.reviewCandidates,candidate?[ID]:undefined);assert.equal(data.operators[ID].name,'Raidian');
data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},enemies:[],hits:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){paused=true;battle.autoFinish=false;battle.timeLimit=1000;
  battle.on('damaged',h=>{if(/radian_tower/.test(h.source?.defId??''))this.hits.push({time:battle.time,amount:h.amount,type:h.dmg.type,tags:h.dmg.tags});});
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / legal deployment / 99 DP / empty waves / pinned healthy targets';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 targets(row,col){const e=battle.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;
  battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true,noDisplace:true}});this.enemies.push(e);battle._buildEnemyIndex();this.render();},
 towers(){return battle.allyUnits.filter(t=>t.alive&&/^token_1005[123]_radian_tower/.test(t.defId));},
 until(kind){const end=battle.time+100,p=()=>kind==='ready'?this.owner.skill.ready:kind==='hit'?this.hits.length>0:kind==='cast'?this.owner.skill.activations>0:kind==='ended'?!this.owner.skill.active:kind==='towers'?this.towers().length>=1:false;
  while(!p()&&battle.time<end)battle.step();if(!p())throw Error('Missing natural '+kind+' at '+battle.time);this.render();},
 snapshot(){const u=this.owner,v=renderer.views.get(u.id);return{time:battle.time,dp:battle.dp,active:u.skill.active,activations:u.skill.activations,hud:skillHud(u.skill),o:{towers:this.towers().map(t=>({id:t.defId,model:renderer.views.get(t.id)?.key,shield:t.buffs.reduce((a,x)=>a+(x.shield??0),0)})),stock:battle.regularSummons?.get('summon:char_4195_radian')?.stock??0,bullets:u.mem.radianOwner?.bullets.size??0},
  deployed:battle.deployedSlots(),hits:this.hits,owner:{atk:u.s.atk,model:v?.key,track:v?.actor?.spine.state.tracks[0]?.animation.name},
  images:Array.from(document.querySelectorAll('.operator-portrait img,.skill-icon')).map(i=>({url:i.src,loaded:i.complete&&i.naturalWidth>0})),errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver=await publicReviewDriver({origin,out,data,hook}),reports=[];
try{for(const mobile of[false,true])for(const skill of[1,2,3]){
 const label=`${mobile?'phone':'desktop'}-s${skill}`,dir=mobile?'UP':'RIGHT';
 const {page,deploy,capture,tile,drag}=await driver.open({label,mobile,operators:[ID,G],skillId:`skchr_radian_${skill}`});
 await page.evaluate(()=>cnReview.setup());await deploy(G,3,1,'RIGHT');await deploy(ID,2,4,'UP');
 const T=['token_10051_radian_tower1','token_10052_radian_tower2','token_10053_radian_tower3'][skill-1],[tr,tc]=skill===3?[1,5]:[3,5],[er,ec]=[[3,5],[3,6],[2,6]][skill-1];
 const card=await page.$('#deployment [data-id="summon:char_4195_radian"]'),cbox=await card.boundingBox();assert.ok(cbox);await drag({x:cbox.x+cbox.width/2,y:cbox.y+cbox.height/2},await tile(tr,tc));
 await page.waitForSelector('.facing-picker:not([hidden])');const hb=await (await page.$('.facing-handle')).boundingBox(),hx=hb.x+hb.width/2,hy=hb.y+hb.height/2;
 if(mobile){await page.touchscreen.touchStart(hx,hy);await page.touchscreen.touchMove(hx+65,hy);await page.touchscreen.touchEnd();}else{await page.mouse.move(hx,hy);await page.mouse.down();await page.mouse.move(hx+65,hy,{steps:8});await page.mouse.up();}
 await page.evaluate(()=>cnReview.until('towers'));await page.evaluate(()=>cnReview.advance(.6));const placed=await page.evaluate(()=>cnReview.snapshot());await capture('tower');
 await page.click(`#deployment [data-id="${ID}"]`);await capture('deployed');
 assert.equal(placed.o.towers.length,1);assert.equal(placed.o.towers[0].id,T);assert.ok(placed.o.towers[0].model?.includes(T));
 await page.evaluate(([r,c])=>{cnReview.targets(r,c);cnReview.until('hit');},[er,ec]);const ordinary=await page.evaluate(()=>cnReview.snapshot());await capture('hit');
 assert.equal(ordinary.hits[0].type,skill===3?'arts':'phys');
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.operator-portrait img,.skill-icon')).every(i=>i.complete&&i.naturalWidth>0));
 await page.evaluate(()=>cnReview.until('ready'));const ready=await page.evaluate(()=>cnReview.snapshot());assert.equal(ready.hud.canActivate,true);await page.click('#skill');await page.evaluate(()=>cnReview.advance(.6));
 const started=await page.evaluate(()=>cnReview.snapshot());await capture('skill');assert.equal(started.active,true);assert.equal(started.o.stock,ready.o.stock+1);
 if(skill===1)assert.ok(started.o.towers[0].shield>0);if(skill===2)assert.ok(started.o.bullets>=3||started.hits.length>ordinary.hits.length);
 await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');await page.evaluate(()=>cnReview.advance(2));
 const retired=await page.evaluate(()=>({deployed:cnReview.battle.deployedSlots(),towers:cnReview.towers().length,errors:cnReview.battle.errors,glError:cnReview.renderer.three.getContext().getError()}));await capture('retired');
 assert.equal(retired.deployed,1);assert.equal(retired.towers,0);
 for(const s of[ordinary,started,retired]){assert.deepEqual(s.errors,[]);assert.equal(s.glError,0);}
 assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);reports.push({label,ordinary,started,retired});await page.close();
 console.log(label+': drop/swipe, '+['melee tower','bullet tower','Arts tower'][skill-1]+' from the card, ordinary hit, skill button with one more summon, cleanup passed');
}
 await writeFile(out+'report.json',JSON.stringify({candidate,originalWaves:false,browserVersion:driver.browserVersion,cacheDisabled:driver.cacheDisabled,
  fixtureTransport:'loopback app/data overrides; external HTTPS unintercepted',reports,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources},null,2)+'\n');
 console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources}));
}catch(error){console.error(JSON.stringify({errors:driver.errors,failedResources:driver.failedResources,completedCases:reports.length}));throw error;}finally{await driver.close();}
