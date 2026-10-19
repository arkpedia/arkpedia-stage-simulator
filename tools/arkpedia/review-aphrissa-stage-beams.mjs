// SPDX-License-Identifier: GPL-3.0-or-later
// Actual held battle/drop/swipe -> original ray beams. Mounts/globals explicit.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {publicReviewDriver} from './public-review-driver.mjs';
const ID='char_4229_aphris',KEY='summon:'+ID,out='.cache/arkpedia/cn-operators/'+ID+'/beam-battle-browser/';
const data=JSON.parse(await readFile('.cache/arkpedia/arkpedia-aphrissa-candidate.json','utf8'));
assert.deepEqual(data.reviewCandidates,[ID]);data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},hits:[],
 async setup(){paused=true;battle.autoFinish=false;
 const T=await import('/vendor/three.module.js'),{loadAphrissaReviewBeams}=await import('/arkpedia/aphrissa-review-beam-assets.js');
 this.pass=await loadAphrissaReviewBeams({three:T,renderer:renderer.three,heightAt:(r,c)=>renderer.heightAt(r,c),
  anchorAt:({point})=>[point.col,renderer.heightAt(point.row,point.col)+.6499999761581421,point.row],shaderGlobals:{_HG_UV_ROTATION:0}});
 renderer.nativeEffects=this.pass;renderer.externalNativeEffects=true;
 battle.on('damaged',h=>{if(h.source===this.owner)this.hits.push({time:battle.time,amount:h.amount,tags:h.dmg.tags});});
 const label=document.createElement('div');label.textContent='HELD BEAM REVIEW · explicit tile-height mounts and UV switch=0 · native dispatch pending';label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);
 await this.render();},
 async render(){renderer.render(battle,battle.dt,battle.drainEvents());await this.pass.ready();renderer.render(battle,0,battle.drainEvents());drawHud();},
 async advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();await this.render();},
 target(){const u=this.owner,e=battle.spawnEnemy('enemy_1007_slime',{pos:[u.tileR+(u.dir==='UP'?1:0),u.tileC+(u.dir==='UP'?0:1)]});
 Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true}});battle._buildEnemyIndex();},
 async until(mode){const end=battle.time+50;while(!this.owner.mem.aphrissaLinePresentation.snapshot().some(t=>t.mode===mode)&&battle.time<end)battle.step();
 if(!this.owner.mem.aphrissaLinePresentation.snapshot().some(t=>t.mode===mode))throw Error('Missing held beam '+mode);await this.advance(.06);},
 snapshot(){return {time:battle.time,tracks:this.owner.mem.aphrissaLinePresentation.snapshot(),segments:this.pass.inspect().map(e=>({key:e.key,mode:e.track.mode,root:e.track.root,clip:e.track.clip,positions:e.positions,time:e.time,layers:e.instance?.draws.length})),
 instances:this.pass.instanceCount,hits:this.hits,ammo:this.owner.skill.ammoLeft,sp:this.owner.skill.spTotal,errors:battle.errors,glError:renderer.three.getContext().getError(),nativeFrameParity:false,nativeMountMappingVerified:false,nativeProgressiveDrawVerified:false};}
};`;
const driver=await publicReviewDriver({origin:'http://127.0.0.1:3185',out,data,hook}),reports=[];
try{for(const mobile of [false,true])for(const skill of [1,2,3]){
 const label=`${mobile?'touch':'desktop'}-s${skill}`,dir=mobile?'UP':'RIGHT',row=mobile?1:2,col=mobile?5:4,
  {page,deploy,capture,tile,drag}=await driver.open({label,mobile,operators:[ID],skillId:`skchr_aphris_${skill}`});
 await page.evaluate(()=>cnReview.setup());await deploy(ID,row,col,dir);
 await page.evaluate(async()=>{cnReview.target();await cnReview.until('normal');});await capture('ordinary');
 const ordinary=await page.evaluate(()=>cnReview.snapshot());assert.ok(ordinary.instances>0);assert.ok(ordinary.hits.length>0);
 await page.evaluate(()=>{cnReview.owner.skill.gainSp(cnReview.owner.skill.spCost,'fixture');});
 if(skill!==1){await page.click(`#deployment [data-id="${ID}"]`);await page.click('#skill');}
 await page.evaluate(mode=>cnReview.until(mode),`s${skill}`);
 // Deploy the relay through the real drop + separate direction-swipe controls.
 const before=await page.evaluate(()=>cnReview.owner.mem.aphrissaOwner.deck.own().length),card=await page.$(`#deployment [data-id="${KEY}"]`),box=await card.boundingBox();
 await drag({x:box.x+box.width/2,y:box.y+box.height/2},await tile(mobile?3:2,5));await page.waitForSelector('.facing-picker:not([hidden])');
 const h=await(await page.$('.facing-handle')).boundingBox(),from={x:h.x+h.width/2,y:h.y+h.height/2},dx=mobile?65:0,dy=mobile?0:-65;
 if(mobile){await page.touchscreen.touchStart(from.x,from.y);await page.touchscreen.touchMove(from.x+dx,from.y+dy);}
 else{await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(from.x+dx,from.y+dy,{steps:8});}
 assert.equal(await page.evaluate(()=>cnReview.owner.mem.aphrissaOwner.deck.own().length),before);
 if(mobile)await page.touchscreen.touchEnd();else await page.mouse.up();
 await page.waitForFunction(n=>cnReview.owner.mem.aphrissaOwner.deck.own().length===n+1,{},before);
 if(skill===2)await page.evaluate(()=>cnReview.advance(.08));
 else await page.evaluate(async mode=>{const before=cnReview.owner.mem.aphrissaLinePresentation.snapshot().filter(t=>t.mode===mode).map(t=>t.id),end=cnReview.battle.time+12;
  while(!cnReview.owner.mem.aphrissaLinePresentation.snapshot().some(t=>t.mode===mode&&!before.includes(t.id))&&cnReview.battle.time<end)cnReview.battle.step();await cnReview.advance(.06);},`s${skill}`);
 await page.waitForFunction(()=>cnReview.owner.mem.aphrissaOwner.deck.own().every(t=>cnReview.renderer.views.has(t.id)));
 const output=await page.evaluate(()=>cnReview.snapshot());await capture('relay-beam');
 const tracks=output.tracks.filter(t=>t.mode===`s${skill}`);assert.ok(tracks.length>0);assert.ok(tracks.some(t=>t.points.some(p=>p.role==='waypoint')));
 assert.ok(output.segments.length>=2);assert.ok(output.segments.every(s=>s.layers===8));assert.ok(output.hits.length>ordinary.hits.length);
 const paused=await page.evaluate(async()=>{const before=cnReview.snapshot();await cnReview.render();const after=cnReview.snapshot();return{before:before.segments,after:after.segments,timeBefore:before.time,timeAfter:after.time};});
 assert.deepEqual(paused.before,paused.after);assert.equal(paused.timeBefore,paused.timeAfter);
 await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');await page.evaluate(()=>cnReview.advance(.1));
 const retired=await page.evaluate(()=>cnReview.snapshot());await capture('retired');assert.equal(retired.instances,0);assert.deepEqual(retired.tracks,[]);
 for(const s of [ordinary,output,retired]){assert.deepEqual(s.errors,[]);assert.equal(s.glError,0);}
 assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);reports.push({label,ordinary,output,retired});await page.close();
 console.log(label+': actual held attack markers, relay turns, source shaders and retirement passed');
}
 await writeFile(out+'report.json',JSON.stringify({heldOnly:true,actualBattle:true,originalWaves:false,explicitShaderGlobals:{_HG_UV_ROTATION:0},
  endpointMapping:'Explicit review fixture: native waypoint height used for start/end tile-centre anchors; native muzzle mapping remains unverified.',
  nativeFrameParity:false,nativeProgressiveDrawVerified:false,reports,captures:driver.captures,errors:driver.errors,failed:driver.failedResources},null,2)+'\n');
 console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failed:driver.failedResources}));
}finally{await driver.close();}
