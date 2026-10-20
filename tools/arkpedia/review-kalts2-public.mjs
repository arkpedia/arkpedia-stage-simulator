// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled public UI scenario: drop/swipe on high ground, an operator entering her range with the talent gift, an
// ordinary heal, S1/S2 from the button (S2 true damage with sluggish), and for S3 the anchor card outside her range,
// her flight, the free card of a transported operator refused outside and accepted inside her new range, and cleanup. Original-wave clears are separate tests.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {publicReviewDriver} from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182',ID='char_1052_kalts2',G='char_122_beagle',candidate=process.argv.includes('--candidate');
const out=`.cache/arkpedia/cn-operators/${ID}/public-browser/${candidate?'candidate':'normal'}/`;
const data=JSON.parse(await readFile(candidate?'.cache/arkpedia/arkpedia-kalts2-candidate.json':'data/arkpedia-mvp.json'));
assert.ok(!data.sd.localBase&&!data.stage.art?.localBase,'Review must use original HTTPS assets');
assert.deepEqual(data.reviewCandidates,candidate?[ID]:undefined);assert.equal(data.operators[ID].name,"Kal'tsit - Esperanta");
data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},get mate(){return battle.bench['${G}'].unit;},enemies:[],hits:[],heals:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){paused=true;battle.autoFinish=false;battle.timeLimit=1000;
  battle.on('damaged',h=>{if(h.source===this.owner)this.hits.push({time:battle.time,amount:h.amount,type:h.dmg.type,tags:h.dmg.tags});});
  battle.on('heal',h=>{if(h.source===this.owner)this.heals.push({time:battle.time,amount:h.amount,target:h.target?.defId});});
  const label=document.createElement('div');label.textContent='CONTROLLED UI CHECK · original terrain / legal deployment / 99 DP / empty waves / pinned healthy targets';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 targets(row,col){const e=battle.spawnEnemy('enemy_1007_slime',{pos:[row,col]});Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;
  battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true,noDisplace:true}});this.enemies.push(e);battle._buildEnemyIndex();this.render();},
 hurt(){const m=this.mate;m.hp=m.s.maxHp/2;this.render();},
 until(kind){const o=this.owner?.mem.kalts2Owner,end=battle.time+100,p=()=>kind==='ready'?this.owner.skill.ready:kind==='heal'?this.heals.length>0:kind==='hit'?this.hits.some(h=>h.tags?.includes('kalts2:s2')):kind==='landed'?!o.flight&&!o.anchor:kind==='ended'?!this.owner.skill.active:false;
  while(!p()&&battle.time<end)battle.step();if(!p())throw Error('Missing natural '+kind+' at '+battle.time);this.render();},
 snapshot(){const u=this.owner,v=u&&renderer.views.get(u.id),o=u?.mem.kalts2Owner,m=this.mate,e=this.enemies[0];return{time:battle.time,dp:battle.dp,active:u?.skill.active,activations:u?.skill.activations,hud:u&&skillHud(u.skill),
  owner:{tile:u&&[u.tileR,u.tileC],liftoff:!!u?.s.flags.liftoff,blockCnt:u?.s.blockCnt,model:v?.key,track:v?.actor?.spine.state.tracks[0]?.animation.name,hidden:!!u?.mem.regularHidden,flight:!!o?.flight,anchor:!!o?.anchor?.alive,anchorModel:o?.anchor&&renderer.views.get(o.anchor.id)?.key},
  mate:{alive:!!m?.alive,tile:m&&[m.tileR,m.tileC],regen:!!m?.findBuff('kalts2:t2:regen:'+u?.id),shield:!!m?.findBuff('kalts2:t2:shield:'+u?.id),cost:battle.cost('${G}'),ready:battle.bench['${G}'].readyAt<=battle.time},
  sluggish:!!e?.buffs.some(x=>x.status==='sluggish'),deployed:battle.deployedSlots(),hits:this.hits,heals:this.heals,
  images:Array.from(document.querySelectorAll('.operator-portrait img,.skill-icon')).map(i=>({url:i.src,loaded:i.complete&&i.naturalWidth>0})),errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver=await publicReviewDriver({origin,out,data,hook}),reports=[];
const swipe=async(page,mobile,dx)=>{await page.waitForSelector('.facing-picker:not([hidden])');const hb=await (await page.$('.facing-handle')).boundingBox(),hx=hb.x+hb.width/2,hy=hb.y+hb.height/2;
 if(mobile){await page.touchscreen.touchStart(hx,hy);await page.touchscreen.touchMove(hx+dx,hy);await page.touchscreen.touchEnd();}else{await page.mouse.move(hx,hy);await page.mouse.down();await page.mouse.move(hx+dx,hy,{steps:8});await page.mouse.up();}};
try{for(const mobile of[false,true])for(const skill of[1,2,3]){
 const label=`${mobile?'phone':'desktop'}-s${skill}`;
 const {page,deploy,capture,tile,drag}=await driver.open({label,mobile,operators:[ID,G],skillId:`skchr_kalts2_${skill}`});
 const card=async id=>{const c=await page.$(`#deployment [data-id="${id}"]`),b=await c.boundingBox();assert.ok(b);return{x:b.x+b.width/2,y:b.y+b.height/2};};
 await page.evaluate(()=>cnReview.setup());await deploy(ID,2,4,'RIGHT');await deploy(G,3,5,'RIGHT');
 await page.evaluate(()=>{cnReview.advance(.6);cnReview.hurt();cnReview.until('heal');});const ordinary=await page.evaluate(()=>cnReview.snapshot());await capture('heal');
 assert.ok(ordinary.owner.liftoff&&ordinary.owner.blockCnt===2&&ordinary.owner.model?.includes('char_1052_kalts2')&&ordinary.owner.track);
 assert.ok(ordinary.mate.regen);assert.ok(ordinary.heals.some(h=>h.target===G));
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.operator-portrait img,.skill-icon')).every(i=>i.complete&&i.naturalWidth>0));
 await page.click(`#deployment [data-id="${ID}"]`);
 await page.evaluate(()=>cnReview.until('ready'));const ready=await page.evaluate(()=>cnReview.snapshot());assert.equal(ready.hud.canActivate,true);
 if(skill===2)await page.evaluate(()=>cnReview.targets(3,6));
 await page.click('#skill');await page.evaluate(()=>cnReview.advance(.6));const started=await page.evaluate(()=>cnReview.snapshot());await capture('skill');assert.equal(started.active,true);
 const extra={};
 if(skill===2){await page.evaluate(()=>cnReview.until('hit'));const s=extra.hit=await page.evaluate(()=>cnReview.snapshot());await capture('hit');
  const h=s.hits.find(x=>x.tags?.includes('kalts2:s2'));assert.equal(h.type,'true');assert.equal(s.sluggish,true);}
 if(skill===3){
  await drag(await card('summon:char_1052_kalts2'),await tile(4,1));await swipe(page,mobile,65);
  await page.evaluate(()=>cnReview.advance(.7));const f=extra.flight=await page.evaluate(()=>cnReview.snapshot());await capture('flight');
  assert.equal(f.owner.flight,true);assert.equal(f.owner.hidden,true);assert.ok(f.owner.anchorModel?.includes('token_10068_kalts2_mtship'));
  assert.equal(f.mate.alive,false);assert.equal(f.mate.cost,0);assert.equal(f.mate.ready,true);
  await page.evaluate(()=>cnReview.until('landed'));const l=extra.landed=await page.evaluate(()=>cnReview.snapshot());await capture('landed');
  assert.deepEqual(l.owner.tile,[4,1]);assert.equal(l.owner.hidden,false);assert.equal(l.active,true);
  assert.match(await page.evaluate(g=>cnReview.battle.placementError(g,3,6),G)??'',/inside/);
  await drag(await card(G),await tile(3,6));await page.evaluate(()=>cnReview.advance(.1));assert.equal(await page.evaluate(()=>!!cnReview.mate?.alive),false,'outside her range is refused');
  await page.keyboard.press('Escape').catch(()=>{});
  await deploy(G,3,3,'RIGHT');const r=extra.returned=await page.evaluate(()=>cnReview.snapshot());await capture('returned');
  assert.deepEqual(r.mate.tile,[3,3]);assert.equal(r.dp,f.dp);
 }
 await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');await page.evaluate(()=>cnReview.advance(2));
 const retired=await page.evaluate(()=>({deployed:cnReview.battle.deployedSlots(),anchors:cnReview.battle.allyUnits.filter(t=>t.alive&&t.defId==='token_10068_kalts2_mtship').length,errors:cnReview.battle.errors,glError:cnReview.renderer.three.getContext().getError()}));await capture('retired');
 assert.equal(retired.deployed,1);assert.equal(retired.anchors,0);
 for(const s of[ordinary,started,retired,...Object.values(extra)]){assert.deepEqual(s.errors,[]);assert.equal(s.glError,0);}
 assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);reports.push({label,ordinary,started,extra,retired});await page.close();
 console.log(label+': drop/swipe, talent gift, ordinary heal, '+['S1','S2 true damage with sluggish','S3 anchor, flight, transported card refused outside and accepted inside her range'][skill-1]+', cleanup passed');
}
 await writeFile(out+'report.json',JSON.stringify({candidate,originalWaves:false,browserVersion:driver.browserVersion,cacheDisabled:driver.cacheDisabled,
  fixtureTransport:'loopback app/data overrides; external HTTPS unintercepted',reports,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources},null,2)+'\n');
 console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources}));
}catch(error){console.error(JSON.stringify({errors:driver.errors,failedResources:driver.failedResources,completedCases:reports.length}));throw error;}finally{await driver.close();}
