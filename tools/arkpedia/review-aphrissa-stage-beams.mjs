// SPDX-License-Identifier: GPL-3.0-or-later
// Actual held battle/drop/swipe -> original ray beams. Mounts/globals explicit.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {publicReviewDriver} from './public-review-driver.mjs';
import {APHRISSA_BEAM_STYLES} from '../../shared/arkpedia/aphrissa-beam-presentation.js';
const ID='char_4229_aphris',KEY='summon:'+ID,out='.cache/arkpedia/cn-operators/'+ID+'/beam-battle-browser/';
const data=JSON.parse(await readFile('.cache/arkpedia/arkpedia-aphrissa-candidate.json','utf8'));
assert.deepEqual(data.reviewCandidates,[ID]);data.stage.geometry.waves[0].spawns=[];data.stage.battle.initial_dp=99;data.stage.battle.dp_per_second=0;
const hook=`
globalThis.cnReview={get battle(){return battle;},get renderer(){return renderer;},get owner(){return battle.bench['${ID}'].unit;},hits:[],
 async setup(){paused=true;battle.autoFinish=false;
 const T=await import('/vendor/three.module.js'),{loadAphrissaReviewBeams}=await import('/arkpedia/aphrissa-review-beam-assets.js'),
  {createAphrissaStateMounts}=await import('/arkpedia/aphrissa-state-mounts.js'),{APHRISSA_STATE_CONTRACT}=await import('/shared/arkpedia/aphrissa-state-presentation.js'),
  {createAphrissaActorMounts}=await import('/arkpedia/aphrissa-actor-mounts.js'),{APHRISSA_BEAM_CONTRACT}=await import('/shared/arkpedia/aphrissa-beam-presentation.js');
 this.T=T;this.instanceIds=new WeakMap();this.instanceSequence=0;
 this.mounts=createAphrissaActorMounts({three:T,renderer,contract:APHRISSA_BEAM_CONTRACT,
  endAt:({point})=>[point.col,renderer.heightAt(point.row,point.col)+.6499999761581421,point.row],
  orientationAt:()=>({rotation:[0,0,0,1],scale:[1,1,1]})});
 this.stateMounts=createAphrissaStateMounts({three:T,renderer,contract:APHRISSA_STATE_CONTRACT,
  anchorFor:({state})=>state.kind.startsWith('charge')?'specialPoint1':state.kind==='wing'?'specialPoint0':'actorFoot',
  orientationAt:()=>({rotation:[0,0,0,1],scale:[1,1,1]})});
 this.pass=await loadAphrissaReviewBeams({three:T,renderer:renderer.three,heightAt:(r,c)=>renderer.heightAt(r,c),
  anchorAt:this.mounts.anchorAt,pointFrameAt:this.mounts.pointFrameAt,
  stateFrameAt:this.stateMounts.stateFrameAt,hitFrameAt:({hit})=>({position:[hit.x,renderer.heightAt(hit.row,hit.col)+.4,hit.y],rotation:[0,0,0,1],scale:[1,1,1]}),shaderGlobals:{_HG_UV_ROTATION:0}});
 const dispose=this.pass.dispose;this.pass.dispose=()=>{dispose();this.mounts.dispose();this.stateMounts.dispose();};
 renderer.nativeEffects=this.pass;renderer.externalNativeEffects=true;
 battle.on('damaged',h=>{if(h.source===this.owner)this.hits.push({time:battle.time,amount:h.amount,tags:h.dmg.tags});});
 const label=document.createElement('div');label.textContent='HELD BEAM REVIEW · source muzzle bone in rendered actor plane · endpoint/orientation fixtures · native dispatch pending';label.style.cssText='position:fixed;bottom:0;left:0;z-index:99999;background:#142027;color:white;font:11px sans-serif;pointer-events:none';workspace.append(label);
 await this.render();},
 async render(){const dt=this.renderedBattleTime===undefined?0:Math.max(0,battle.time-this.renderedBattleTime);this.renderedBattleTime=battle.time;
 renderer.render(battle,dt,battle.drainEvents());await this.pass.ready();renderer.render(battle,0,battle.drainEvents());drawHud();},
 async advance(s){paused=true;for(let n=0;n<Math.ceil(s/battle.dt-1e-9);n++)battle.step();await this.render();},
 target(){const u=this.owner,d={UP:[1,0],DOWN:[-1,0],LEFT:[0,-1],RIGHT:[0,1]}[u.dir],e=battle.spawnEnemy('enemy_1007_slime',{pos:[u.tileR+d[0],u.tileC+d[1]]});
 Object.assign(e.base,{maxHp:1e9,atk:0,def:0,res:0,moveSpeed:0});e.markDirty();void e.s;e.hp=e.s.maxHp;battle.addBuff(e,{key:'qa:pin',flags:{noMove:true,disarm:true}});battle._buildEnemyIndex();},
 async until(mode){const end=battle.time+50;while(!this.owner.mem.aphrissaLinePresentation.snapshot().some(t=>t.mode===mode)&&battle.time<end)battle.step();
 if(!this.owner.mem.aphrissaLinePresentation.snapshot().some(t=>t.mode===mode))throw Error('Missing held beam '+mode);await this.advance(.06);},
 mountCheck(){const T=this.T,size=renderer.three.getSize(new T.Vector2());return this.mounts.inspect().map(r=>{
 const view=renderer.views.get(r.ownerId),bone=view.actor.spine.skeleton.findBone(r.bone),pixel=view.actor.spine.toGlobal({x:bone.worldX,y:bone.worldY}),
  p=new T.Vector3(r.position[0],r.position[2],r.position[1]).project(renderer.camera),projected=[(p.x+1)*size.x/2,(1-p.y)*size.y/2],
  error=Math.max(Math.abs(projected[0]-pixel.x),Math.abs(projected[1]-pixel.y),Math.abs(r.pixel[0]-pixel.x),Math.abs(r.pixel[1]-pixel.y));
 if(error>1e-6||r.time!==battle.time)throw Error('Muzzle mount does not match the current visible source bone');
 return{...r,referencePixel:[pixel.x,pixel.y],projectedPixel:projected,error,facing:view.facing,actorClock:view.actor.clock};
 });},
 stateMountCheck(){return this.stateMounts.inspect().map(r=>{if(!r.source)return r;const view=renderer.views.get(r.ownerId),bone=view.actor.spine.skeleton.findBone(r.source.bone),
  pixel=view.actor.spine.toGlobal({x:bone.worldX,y:bone.worldY}),size=renderer.three.getSize(new this.T.Vector2()),p=new this.T.Vector3(r.position[0],r.position[2],r.position[1]).project(renderer.camera),
  error=Math.max(Math.abs((p.x+1)*size.x/2-pixel.x),Math.abs((1-p.y)*size.y/2-pixel.y));
  if(error>1e-6)throw Error('State mount does not match the original live bone');return{...r,error};});},
 rawZeroProbe(){const view=renderer.views.get(this.owner.id),receipt=this.mounts.inspect()[0],bone=view.actor.spine.skeleton.findBone(receipt.bone),
  sample=()=>[bone.worldX,bone.worldY],before=sample(),samples=[];
 for(let n=0;n<4;n++){view.actor.spine.update(0);samples.push(sample());}
 return {before,samples,maxChange:Math.max(...samples.flatMap(p=>p.map((v,i)=>Math.abs(v-before[i]))))};},
 instanceId(value){if(!value)return null;if(!this.instanceIds.has(value))this.instanceIds.set(value,++this.instanceSequence);return this.instanceIds.get(value);},
 snapshot(){return {time:battle.time,mounts:this.mountCheck(),tracks:this.owner.mem.aphrissaLinePresentation.snapshot(),states:this.owner.mem.aphrissaStatePresentation.snapshot(),stateMounts:this.stateMountCheck(),segments:this.pass.inspect().map(e=>({key:e.key,instanceId:this.instanceId(e.instance),kind:e.kind,hit:e.hit,state:e.state,point:e.point,mode:e.track.mode,root:e.root,clip:e.clip,positions:e.positions,placement:e.placement,time:e.time,bornAt:e.bornAt,emissionUntil:e.emissionUntil,
  particleLedger:e.kind==='state'?e.instance?.draws.filter(d=>d.emitter).map(d=>({component:d.component,particles:(d.lastParticles??[]).map(p=>({id:p.id,age:p.age,life:p.lifetime,
   birth:(p.born+d.particleSource.startDelay.scalar-(d.particleSource.prewarm&&d.particleSource.looping?d.particleSource.lengthInSec:0))/d.particleSource.simulationSpeed}))})):undefined,layers:e.instance?.draws.length,
  complete:e.instance?.inspection===null&&e.instance.blocked.length===0,sourceRenderers:e.instance?[...e.instance.pose.renderers].filter(([,r])=>r.enabled).map(([id])=>id).sort():[],playedRenderers:e.instance?.draws.map(d=>d.component).sort()})),
 instances:this.pass.instanceCount,hits:this.hits,ammo:this.owner.skill.ammoLeft,sp:this.owner.skill.spTotal,errors:battle.errors,glError:renderer.three.getContext().getError(),nativeFrameParity:false,nativeMountMappingVerified:false,nativeProgressiveDrawVerified:false};}
};`;
const driver=await publicReviewDriver({origin:'http://127.0.0.1:3185',out,data,hook}),reports=[],scenarios=[
 ...[false,true].flatMap(mobile=>[1,2,3].map(skill=>({mobile,skill,dir:mobile?'UP':'RIGHT',row:mobile?1:2,col:mobile?5:4,relayRow:mobile?3:2,relayCol:5}))),
 {mobile:false,skill:2,dir:'LEFT',row:2,col:4,relayRow:2,relayCol:3,extra:true},
 {mobile:true,skill:3,dir:'DOWN',row:4,col:5,relayRow:2,relayCol:5,extra:true}];
try{for(const {mobile,skill,dir,row,col,relayRow,relayCol,extra}of scenarios){
 const label=`${mobile?'touch':'desktop'}-${extra?dir.toLowerCase()+'-':''}s${skill}`,
  {page,deploy,capture,tile,drag}=await driver.open({label,mobile,operators:[ID],skillId:`skchr_aphris_${skill}`});
 await page.evaluate(()=>cnReview.setup());await deploy(ID,row,col,dir);
 await page.evaluate(async()=>{cnReview.target();await cnReview.until('normal');});await capture('ordinary');
 const ordinary=await page.evaluate(()=>cnReview.snapshot());assert.ok(ordinary.instances>0);assert.ok(ordinary.hits.length>0);
 // Render the complete finite ordinary clip, including its near-zero width
 // transition, rather than inspecting only the first visible attack frame.
 const swept=await page.evaluate(async()=>{for(let n=0;n<9;n++)await cnReview.advance(.1);return cnReview.snapshot();});
 assert.deepEqual(swept.errors,[]);assert.equal(swept.glError,0);
 await page.evaluate(()=>{cnReview.owner.skill.gainSp(cnReview.owner.skill.spCost,'fixture');});
 if(skill!==1){await page.click(`#deployment [data-id="${ID}"]`);await page.click('#skill');}
 let charged=null;
 if(skill===3){await page.evaluate(()=>cnReview.advance(.4));charged=await page.evaluate(()=>cnReview.snapshot());
  assert.ok(charged.states.some(s=>s.kind==='charge'));assert.ok(charged.segments.some(s=>s.kind==='state'&&s.state.kind==='charge'));await capture('source-charge');}
 await page.evaluate(mode=>cnReview.until(mode),`s${skill}`);
 // Deploy the relay through the real drop + separate direction-swipe controls.
 const before=await page.evaluate(()=>cnReview.owner.mem.aphrissaOwner.deck.own().length),card=await page.$(`#deployment [data-id="${KEY}"]`),box=await card.boundingBox();
 await drag({x:box.x+box.width/2,y:box.y+box.height/2},await tile(relayRow,relayCol));await page.waitForSelector('.facing-picker:not([hidden])');
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
 assert.ok(output.mounts.length>0);for(const m of output.mounts)assert.ok(m.error<1e-6);
 if(dir==='LEFT')assert.equal(output.mounts[0].facing,-1);
 const tracks=output.tracks.filter(t=>t.mode===`s${skill}`);assert.ok(tracks.length>0);assert.ok(tracks.some(t=>t.points.some(p=>p.role==='waypoint')));
 assert.ok(output.segments.length>=2);assert.ok(output.hits.length>ordinary.hits.length);
 for(const view of [ordinary,output]){
  for(const segment of view.segments){if(segment.kind==='line')assert.equal(segment.layers,9);else assert.ok(segment.layers>0);
   assert.equal(segment.complete,true);assert.deepEqual(segment.playedRenderers,segment.sourceRenderers);}
  assert.ok(view.segments.some(s=>s.kind==='hit'));
  for(const hit of view.segments.filter(s=>s.kind==='hit')){assert.equal(hit.time,view.time-hit.hit.startedAt);assert.equal(hit.layers,hit.mode==='s3'?27:19);assert.equal(hit.placement.position[0],hit.hit.x);assert.equal(hit.placement.position[2],hit.hit.y);}
  assert.ok(view.segments.some(s=>s.point?.role==='start'));assert.ok(view.segments.some(s=>s.point?.role==='end'));
  for(const track of view.tracks){const mount=view.mounts.find(m=>m.ownerId===track.ownerId),line=view.segments.find(s=>s.key===track.id+':0');
   assert.ok(mount&&line);assert.deepEqual(line.positions[0],mount.position);}
 }
 assert.ok(output.segments.some(s=>s.point?.role==='waypoint'));
 const stateKinds=output.segments.filter(s=>s.kind==='state').map(s=>s.state.kind);
 if(skill===1)assert.ok(stateKinds.includes('s1'));
 if(skill===3){assert.ok(stateKinds.includes('active'));assert.ok(stateKinds.includes('wing'));
  const wing=output.segments.find(s=>s.kind==='state'&&s.state.kind==='wing'),face=output.stateMounts.find(m=>m.stateId===wing.state.id).face;
  assert.equal(wing.root,face==='back'?'aphris_skill_03_buff_02_back':'aphris_skill_03_buff_02_front');assert.equal(wing.clip.clip.length,2);}

 const paused=await page.evaluate(async()=>{const before=cnReview.snapshot();await cnReview.render();const after=cnReview.snapshot();return{before:before.segments,after:after.segments,timeBefore:before.time,timeAfter:after.time};});
 assert.deepEqual(paused.before,paused.after);assert.equal(paused.timeBefore,paused.timeAfter);
 let resized=null;
 if(extra){
  await page.setViewport(mobile?{width:980,height:420,isMobile:true,hasTouch:true}:{width:1100,height:700});
  await page.evaluate(async()=>{cnReview.renderer.resize();await cnReview.render();});resized=await page.evaluate(()=>cnReview.snapshot());await capture('resized-muzzle');
  assert.equal(resized.time,output.time);assert.equal(resized.mounts[0].actorClock,output.mounts[0].actorClock);
  const identities=view=>view.segments.map(s=>[s.key,s.instanceId,s.bornAt,s.time,s.clip]).sort((a,b)=>a[0].localeCompare(b[0]));
  assert.deepEqual(identities(resized),identities(output));assert.ok(resized.mounts.every(m=>m.error<1e-6));
 }
 let ending=null;
 if(skill===2){
  await page.evaluate(async()=>{const end=cnReview.battle.time+10;while(cnReview.owner.skill.active&&cnReview.battle.time<end)cnReview.battle.step();await cnReview.advance(.05);});
  ending=await page.evaluate(()=>cnReview.snapshot());await capture('point-end');
  const points=ending.segments.filter(s=>s.mode==='s2'&&s.kind==='point');assert.ok(points.length>=3);
  for(const point of points){assert.equal(point.clip.clip,APHRISSA_BEAM_STYLES.s2.points[point.point.role].end.id);assert.ok(point.time>point.clip.time);}
  assert.deepEqual(ending.errors,[]);assert.equal(ending.glError,0);
 }
 const rawZero=await page.evaluate(()=>cnReview.rawZeroProbe());
 assert.equal(rawZero.maxChange,0);
 let opened=null;
 if(skill===3){await page.evaluate(()=>cnReview.advance(1.1));opened=await page.evaluate(()=>cnReview.snapshot());
  const wing=opened.segments.find(s=>s.kind==='state'&&s.state.kind==='wing');assert.ok(wing.time>.8333333134651184);assert.equal(wing.clip.clip.length,2);
  assert.deepEqual(opened.errors,[]);assert.equal(opened.glError,0);await capture('source-wing-open');}
 let cancelled=null,draining=null,drained=null;
 if(skill===3){await page.click(`#deployment [data-id="${ID}"]`);await page.click('#skill');await page.evaluate(()=>cnReview.advance(.05));
  cancelled=await page.evaluate(()=>cnReview.snapshot());assert.ok(cancelled.states.length>0);assert.ok(cancelled.states.every(s=>Number.isFinite(s.finishedAt)));
  assert.equal(cancelled.states.some(s=>s.kind==='active'),false);
  const oldWing=opened.segments.find(s=>s.kind==='state'&&s.state.kind==='wing'),wing=cancelled.segments.find(s=>s.kind==='state'&&s.state.kind==='wing');
  assert.equal(wing.instanceId,oldWing.instanceId);assert.equal(wing.bornAt,oldWing.bornAt);assert.ok(wing.time>oldWing.time);
  for(const effect of cancelled.segments.filter(s=>s.kind==='state'))for(const row of effect.particleLedger)for(const p of row.particles)assert.ok(p.birth<effect.emissionUntil);
  await capture('source-particle-drain');await page.evaluate(()=>cnReview.advance(.25));draining=await page.evaluate(()=>cnReview.snapshot());
  const later=draining.segments.find(s=>s.kind==='state'&&s.state.kind==='wing');assert.equal(later.instanceId,wing.instanceId);assert.equal(later.emissionUntil,wing.emissionUntil);
  for(const effect of draining.segments.filter(s=>s.kind==='state'))for(const row of effect.particleLedger)for(const p of row.particles)assert.ok(p.birth<effect.emissionUntil);
  await page.evaluate(()=>cnReview.advance(5.8));drained=await page.evaluate(()=>cnReview.snapshot());assert.deepEqual(drained.states,[]);
  assert.equal(drained.segments.some(s=>s.kind==='state'),false);assert.deepEqual(drained.errors,[]);assert.equal(drained.glError,0);await capture('source-state-cleanup');}
 await page.click(`#deployment [data-id="${ID}"]`);await page.click('#retreat');await page.evaluate(()=>cnReview.advance(.1));
 const retired=await page.evaluate(()=>cnReview.snapshot());await capture('retired');assert.equal(retired.instances,0);assert.deepEqual(retired.tracks,[]);
 for(const s of [ordinary,output,retired]){assert.deepEqual(s.errors,[]);assert.equal(s.glError,0);}
 assert.deepEqual(driver.errors,[]);assert.deepEqual(driver.failedResources,[]);reports.push({label,ordinary,swept,charged,output,resized,ending,opened,cancelled,draining,drained,retired,rawZero});await page.close();
 console.log(label+': actual held attack markers, relay turns, source shaders and retirement passed');
}
 await writeFile(out+'report.json',JSON.stringify({heldOnly:true,actualBattle:true,originalWaves:false,explicitShaderGlobals:{_HG_UV_ROTATION:0},
  endpointMapping:'Source F_Muzzle/B_Muzzle follows the current visible actor in its camera-facing depth plane; endpoints use explicit tile-height fixtures and identity point orientation. Native mount/depth/rotation mapping remains unverified.',
  nativeFrameParity:false,nativeProgressiveDrawVerified:false,reports,captures:driver.captures,errors:driver.errors,failed:driver.failedResources},null,2)+'\n');
 console.log(JSON.stringify({cases:reports.length,captures:driver.captures,errors:driver.errors,failed:driver.failedResources}));
}finally{await driver.close();}
