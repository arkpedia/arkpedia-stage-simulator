// SPDX-License-Identifier: GPL-3.0-or-later
// Controlled public UI; unchanged original-wave/natural-DP clears are separate.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {publicReviewDriver} from './public-review-driver.mjs';
process.chdir(fileURLToPath(new URL('../../',import.meta.url)));
const origin=process.env.ARKPEDIA_REVIEW_ORIGIN??'http://127.0.0.1:3182',ID='char_4222_taraxa',T='char_4191_tippi';
const out=`.cache/arkpedia/cn-operators/${ID}/public-browser/`,candidate=process.argv.includes('--candidate');
const data=JSON.parse(await readFile(candidate?'.cache/arkpedia/arkpedia-taraxa-candidate.json':'data/arkpedia-mvp.json'));
assert.ok(!data.sd.localBase&&!data.stage.art?.localBase,'Review requires original immutable HTTPS assets');
assert.equal(data.operators[ID].name,'Taraxacum');data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},get controller(){return this.owner.mem.taraxa;},heals:[],receipts:[],
 render(){renderer.render(battle,battle.dt,battle.drainEvents());drawHud();},
 advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();this.render();},
 setup(){paused=true;battle.autoFinish=false;battle.timeLimit=1000;
  battle.on('calculatedHeal',h=>{if(h.source===this.owner)this.heals.push({time:battle.time,target:h.target.defId,amount:h.amount,tags:h.opts.tags,skill:h.opts.isSkill});});
  battle.on('attack',h=>{if(h.attacker===this.owner)this.receipts.push({time:battle.time,skill:h.isSkill,targets:h.targets.map(t=>t.defId)});});
  const label=document.createElement('div');label.textContent='CONTROLLED PUBLIC UI · original terrain / legal drops and swipes / 99 DP / empty waves / scripted ally HP / actual Tippi skill';
  label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);this.render();},
 until(kind){const end=battle.time+80,p=()=>kind==='ready'?this.owner.skill.ready&&battle.bench['${T}'].unit.skill.ready:
  kind==='born'?this.controller.payload.flights.size>0:kind==='direct'?this.heals.filter(h=>h.tags?.includes('taraxa:s1')).length>=3:
  kind==='outputs'?['primary','secondary','splash'].every(k=>this.heals.some(h=>h.tags?.includes('taraxa:s2-'+k))):!this.owner.skill.active;
  while(!p()&&battle.time<end&&!battle.finished)battle.step();if(!p())throw Error('Missing '+kind+' at '+battle.time);this.render();},
 injure(){for(const[id,ratio]of[['${T}',.2],['char_208_melan',.1],['char_122_beagle',.3]]){const u=battle.bench[id].unit;u.hp=u.s.maxHp*ratio;}this.heals=[];this.receipts=[];this.render();},
 snapshot(){const u=this.owner,c=this.controller,v=renderer.views.get(u.id),g=v?.hp.geometry.graphicsData??[];
  const hp=g.find(d=>d.fillStyle?.color===0x64d5ae),sp=g.find(d=>[0x9bd538,0xffa235].includes(d.fillStyle?.color));
  return{time:battle.time,mode:c.flight.mode,stopped:c.stopped,handles:c.handles.length,active:u.skill.active,ready:u.skill.ready,sp:u.skill.sp,slots:battle.deployedSlots(),hud:skillHud(u.skill),
   primaryFlights:c.payload?[...c.payload.flights.values()].map(p=>({kind:p.kind,target:p.target.defId})):[],heals:this.heals,receipts:this.receipts,
   owner:{hp:u.hp,maxHp:u.s.maxHp,atk:u.s.atk,baseAtk:u.base.atk,liftoff:!!u.s.flags.liftoff,sanctuary:u.s.physTakenMul,height:c.flight.heightNow(),model:v?.key,track:v?.actor?.spine.state.tracks[0]?.animation.name},
   gauges:{belowHp:!!(hp&&sp&&sp.shape.y>hp.shape.y+hp.shape.height),readyDiamond:g.some(d=>d.fillStyle?.color===0xffd953&&d.shape.points?.length===8)},
   tippi:{liftoff:!!battle.bench['${T}'].unit.s.flags.liftoff,sanctuary:battle.bench['${T}'].unit.s.physTakenMul,block:battle.bench['${T}'].unit.s.blockCnt,baseBlock:battle.bench['${T}'].unit.base.blockCnt},
   owned:{aura:c.aura.records.size,auraHandles:c.aura.handles.length,flightHandles:c.flight.handles.length,ordinaryFlights:c.flights.size,ordinaryWatchers:c.watchers.length,s2Flights:c.payload?.flights.size??0,s2Watchers:c.payload?.watchers.length??0},
   images:[...document.images].filter(i=>i.src.includes('Taraxacum')).map(i=>({src:i.src,loaded:i.complete&&i.naturalWidth>0})),errors:battle.errors,glError:renderer.three.getContext().getError()};}
};`;
const driver=await publicReviewDriver({origin,out,data,hook}),reports=[];
try{for(const mobile of[false,true])for(const skill of[1,2]){
 const label=(mobile?'phone':'desktop')+'-s'+skill,dir=mobile?'UP':'RIGHT';
 const placements=mobile?[[T,2,5],['char_208_melan',2,6],['char_122_beagle',3,5]]:[[T,2,5],['char_208_melan',3,5],['char_122_beagle',2,6]];
 const{page,deploy,capture}=await driver.open({label,mobile,operators:[ID,...placements.map(p=>p[0])],skillId:`skchr_taraxa_${skill}`});
 await page.evaluate(()=>cnReview.setup());await deploy(ID,mobile?1:2,mobile?5:4,dir);
 for(const[id,r,c]of placements)await deploy(id,r,c,'RIGHT');await page.evaluate(()=>cnReview.until('ready'));
 await page.click(`#deployment [data-id="${ID}"]`);await capture('ready');const ready=await page.evaluate(()=>cnReview.snapshot());
 assert.equal(ready.slots,4);assert.equal(ready.hud.ready,true);assert.equal(ready.gauges.belowHp,true);assert.equal(ready.gauges.readyDiamond,true);
 assert.ok(ready.owner.model.endsWith(mobile?'/back':'/front'));assert.ok(ready.images.length>=2&&ready.images.every(i=>i.loaded&&i.src.startsWith('https://raw.githubusercontent.com/')));
 await page.click(`#deployment [data-id="${T}"]`);await page.click('#skill');await page.evaluate(()=>cnReview.advance(1.1));await capture('tippi-liftoff');
 const flying=await page.evaluate(()=>cnReview.snapshot());assert.equal(flying.tippi.liftoff,true);assert.equal(flying.tippi.sanctuary,.9);assert.equal(flying.tippi.block,flying.tippi.baseBlock+1);
 await page.evaluate(()=>cnReview.injure());await page.click(`#deployment [data-id="${ID}"]`);await page.click('#skill');await page.evaluate(()=>cnReview.advance(.25));
 await capture('begin');const begin=await page.evaluate(()=>cnReview.snapshot());assert.equal(begin.active,true);assert.equal(begin.owner.track,`Skill_${skill}_Begin`);assert.equal(begin.owner.liftoff,true);
 assert.equal(begin.gauges.belowHp,true);assert.equal(begin.gauges.readyDiamond,false);assert.equal(begin.sp,0);
 if(skill===2){await page.evaluate(()=>cnReview.until('born'));await capture('carriers');const carriers=await page.evaluate(()=>cnReview.snapshot());assert.equal(carriers.receipts.length,1);assert.equal(carriers.primaryFlights.length,2);}
 await page.evaluate(kind=>cnReview.until(kind),skill===1?'direct':'outputs');await capture('healing');const healing=await page.evaluate(()=>cnReview.snapshot());
 assert.equal(healing.mode,skill===1?2:5);assert.equal(healing.owner.track,`Skill_${skill}_Loop`);assert.ok(healing.owner.height>.39);assert.equal(healing.active,true);assert.equal(healing.gauges.belowHp,true);
 if(skill===1){assert.equal(healing.primaryFlights.length,0);assert.ok(healing.heals.filter(h=>h.tags?.includes('taraxa:s1')).length>=3);}
 else{assert.equal(healing.heals.find(h=>h.tags?.includes('taraxa:s2-primary')).target,T);assert.equal(healing.receipts.length,1);assert.ok(healing.owner.atk>healing.owner.baseAtk);}
 await page.evaluate(()=>cnReview.until('ended'));await capture('end');const ended=await page.evaluate(()=>cnReview.snapshot());assert.equal(ended.active,false);assert.equal(ended.mode,skill===1?3:6);
 assert.equal(ended.owner.track,`Skill_${skill}_End`);assert.equal(ended.owner.atk,ended.owner.baseAtk);
 await page.evaluate(()=>cnReview.advance(1.1));await capture('grounded');const grounded=await page.evaluate(()=>cnReview.snapshot());assert.equal(grounded.mode,0);assert.equal(grounded.owner.liftoff,false);assert.equal(grounded.owner.sanctuary,1);assert.equal(grounded.owner.height,0);
 await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');await page.evaluate(()=>cnReview.advance(2));await capture('retired');const retired=await page.evaluate(()=>cnReview.snapshot());
 assert.equal(retired.stopped,true);assert.equal(retired.handles,0);assert.equal(retired.slots,3);assert.ok(Object.values(retired.owned).every(x=>x===0));
 for(const s of[ready,flying,begin,healing,ended,grounded,retired]){assert.deepEqual(s.errors,[]);assert.equal(s.glError,0);}assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);
 reports.push({label,ready,flying,begin,healing,ended,grounded,retired});await page.close();console.log(label+': real squad drops/swipes, natural ready gauges, Tippi interaction, source flight/healing modes, End and cleanup passed');
 }
 await writeFile(out+'report.json',JSON.stringify({candidate,originalWaves:false,browserVersion:driver.browserVersion,cacheDisabled:driver.cacheDisabled,externalAssetTransport:'Original immutable HTTPS, unintercepted external requests and normal TLS verification',sourceOrigin:driver.sourceOrigin,fixtureOrigin:driver.fixtureOrigin,reports,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources},null,2)+'\n');
 console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failedResources:driver.failedResources}));
}catch(error){console.error(JSON.stringify({errors:driver.errors,failedResources:driver.failedResources,completedCases:reports.length}));throw error;}finally{await driver.close();}
