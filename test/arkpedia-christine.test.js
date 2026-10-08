// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-christine-prefabs.json' with { type: 'json' };
import { CHRISTINE_OPERATORS as configs } from '../shared/arkpedia/christine-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, acquireTargets } from '../server/sim/ai.js';
const ID='char_4198_christ', near=(a,z,e=1e-5)=>assert.ok(Math.abs(a-z)<e,`${a} != ${z}`);
const rows=r=>r.flatMap(x=>x.components.map(c=>({pathId:c.pathId,...c.data})));
function make({skill=0,rank=10,elite=2,potential=1,dir='RIGHT'}={}){
 const d=structuredClone(data),op=d.operators[ID];assert.ok(op,'Reviewed Christine snapshot required');
 d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;d.stage.geometry.rows=19;d.stage.geometry.cols=21;
 d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
 const build={...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,skillId:op.skills[skill].id,skillRank:Math.min(rank,[4,7,10][elite])};
 const b=new StandardBattle(d,{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.recordEvents=true;
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));b.addDp('arkpedia',99);
 const u=b.deployOperator(ID,5,5,dir);assert.ok(u);u.atkCd=1000;u.skill.rule='NEVER';const receipts=[];
 b.on('damaged',c=>receipts.push({...c,time:b.time}));return{b,u,receipts};
}
function advance(b,s){assert.ok(Number.isFinite(s)&&s>=0,`finite nonnegative wait required: ${s}`);for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function enemy(b,{x=6,y=5,hp=100000,def=0,res=0,fly=false,attacking=false}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});Object.assign(e.base,{maxHp:100000,def,res,moveSpeed:0});e.markDirty();void e.s;e.hp=hp;
 Object.defineProperty(e,'gaugeMax',{value:100000,configurable:true});if(fly)e.motion='FLY';
 b.addBuff(e,{key:'test:pin',flags:{noMove:true,...(!attacking?{disarm:true}:{})}});b._buildEnemyIndex();return e;
}
function move(b,e,x,y=5){e.x=x;e.y=y;e.tileR=Math.round(y);e.tileC=Math.round(x);b._enemiesDirty=true;b._buildEnemyIndex();}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(ID),true);u.atkCd=1000;}
function shot(b,u,e){assert.equal(b.forceAttack(u,[e]),true);u.atkCd=1000;}
const own=(rs,u,e,type='arts')=>rs.filter(r=>r.source===u&&r.type===type&&(!e||r.target===e));
const talent=u=>u.def.talents.find(t=>t.bb.atk_scale!=null)?.bb.atk_scale??0;
const point=dir=>dir==='LEFT'?{x:4,y:5}:dir==='UP'?{x:5,y:6}:dir==='DOWN'?{x:5,y:4}:{x:6,y:5};
function paralysis(b,u,e,n=1,producer=u){b.applyStatus(e,'palsy',{source:producer,value:n});e.atkCd=0;advance(b,2*b.dt);e.atkCd=1000;}

test('Christine original source retains all20 ranks, exact five bundles/facings and explicit runtime limits',()=>{
 assert.deepEqual(Object.keys(configs),[ID]);assert.deepEqual(configs[ID].skillIds,['skchr_christ_1','skchr_christ_2']);assert.equal(source.frameParity,false);assert.equal(source.source.bundles.length,5);
 for(const face of['Front','Back']){assert.equal(source.models[ID][face].sha256,source.originalFacingBindings[ID][face].sha256);near(source.models[ID][face].hits.Attack[0],.433);near(source.models[ID][face].hits.Skill_1[0],.467);}
 const a=rows(source.skills.skchr_christ_2),fire=a.find(x=>x.pathId==='-32333568376156583');near(fire._preDelay,.2666670084);assert.equal(fire._waitForAttackEvent,0);assert.equal(fire._waitForProjectileInvalid,1);near(fire._minPostDelayWhenProjectileInvalid,.1666669995);
 const p=rows(source.projectiles.projectile_chr_christ_s2);assert.equal(p.find(x=>x._lifeTime!=null)._lifeTime,10);assert.equal(p.find(x=>x._getLifeTimeFromBB!=null)._getLifeTimeFromBB,0);assert.equal(p.find(x=>x._stopWhenSourceInvalid!=null)._stopWhenSourceInvalid,0);assert.equal(p.find(x=>x._waitFirstPeriod!=null)._waitFirstPeriod,0);
 assert.equal(source.buffTemplates['christ_s_2'].eventToActions.ON_BUFF_START[0]._conditionNode._elementType,'SANITY');
 assert.ok(source.verificationLimits.some(x=>x.includes('PALSYING')));assert.ok(source.verificationLimits.some(x=>x.includes('after-arrival')));
});
test('all ranks preserve both source SP/selected durations and exact ATK/two-target/injury/field scales',()=>{
 for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){
  const{b,u}=make({skill,rank}),r=source.tables[ID].skills[u.skill.id].levels[rank-1];near(u.skill.spCost,r.spData.spCost);near(u.skill.spTotal,r.spData.initSp);near(u.skill.duration,r.duration);
  const bb=Object.fromEntries(r.blackboard.map(x=>[x.key,x.value]));assert.deepEqual(u.skill.bb,bb);
  if(!skill){cast(b,u);near(u.s.atk,u.base.atk*(1+bb.atk));assert.equal(effectiveProfile(u).maxTargets,2);}else{enemy(b);cast(b,u);assert.equal(effectiveProfile(u).noAttack,true);near(u.mem.christineFields.length,0);}advance(b,.1);
 }
});
test('T1 exact E0/E1/E2 and potential law uses no generic passive damage approximation',()=>{
 for(const[elite,potential,scale]of[[0,1,0],[1,1,.8],[1,5,.9],[2,1,1.2],[2,5,1.3]]){
  const{b,u,receipts}=make({elite,potential}),e=enemy(b,{x:5.5,attacking:true});near(talent(u),scale);near(u.s.atk,u.base.atk);paralysis(b,u,e);near(100000-e.hp,u.s.atk*scale);assert.equal(own(receipts,u,e,'elemental').length,scale?1:0);
 }
});
test('normal natural AI attacks exactly one nearby ground/flying victim without inherited splash or injury',()=>{
 for(const fly of[false,true]){const{b,u,receipts}=make(),e=enemy(b,{fly}),z=enemy(b,{x:6.1,fly});u.atkCd=0;b.step();u.atkCd=1000;advance(b,.8);assert.equal(u.stats.attacks,1);assert.equal(own(receipts,u).length,1);assert.equal([e,z].filter(x=>x.hp<100000).length,1);near(e.elem.neural+z.elem.neural,0);}
});
test('normal .433 event and speed10 flight preserve NORMAL ranged origin across all native facings',()=>{
 for(const dir of['RIGHT','LEFT','UP','DOWN']){const{b,u,receipts}=make({dir}),e=enemy(b,point(dir));shot(b,u,e);advance(b,.4);assert.equal(b.projectiles.list.length,0);near(e.hp,100000);advance(b,.067);assert.equal(b.projectiles.list.length,1);advance(b,.2);near(100000-e.hp,u.s.atk);const r=own(receipts,u,e)[0];assert.equal(r.dmg.applyWay,'ranged');assert.equal(r.dmg.isAttack,true);}
});
test('granting palsy, unrelated stun and Nervous burst grant no talent damage before actual consumption',()=>{
 const{b,u,receipts}=make(),e=enemy(b,{x:5.5});b.applyStatus(e,'palsy',{source:u,value:3});near(e.hp,100000);b.applyStatus(e,'stun',{source:u,duration:1});advance(b,.2);near(e.hp,100000);assert.equal(own(receipts,u,e,'elemental').length,0);
 const z=enemy(b,{x:5.6});delete z.gaugeMax;z.elem.neural=999;b.dealDamage(u,z,{amount:1,type:'element',element:'neural',canDodge:false});assert.ok(z.findBuff('neuralBurst'));assert.equal(own(receipts,u,z,'elemental').length,0);
});
test('actual three consumed stacks produce exactly three independent HP damage hits and interrupt enemy attacks',()=>{
 const{b,u,receipts}=make(),e=enemy(b,{x:5.5,attacking:true});const hp=u.hp;b.applyStatus(e,'palsy',{source:u,value:3});near(e.hp,100000);
 for(let n=0;n<3;n++){e.atkCd=0;advance(b,2*b.dt);e.atkCd=1000;near(100000-e.hp,(n+1)*u.s.atk*talent(u));}
 assert.equal(e.findBuff('palsy'),null);near(u.hp,hp);assert.equal(own(receipts,u,e,'elemental').length,3);e.atkCd=0;advance(b,.3);assert.ok(u.hp<hp);
});
test('foreign and sourceless palsy producers still trigger live Christine talent rather than producer attribution',()=>{
 for(const producer of['self','none']){const{b,u,receipts}=make(),e=enemy(b,{x:5.5,attacking:true});paralysis(b,u,e,1,producer==='self'?e:null);near(100000-e.hp,u.s.atk*talent(u));assert.equal(own(receipts,u,e,'elemental')[0].dmg.applyWay,'none');assert.equal(own(receipts,u,e,'elemental')[0].dmg.isAttack,true);near(e.elem.neural,0);}
});
test('T1 actual edge respects current range/owner attachment and accepts elemental damage through high DEF/RES',()=>{
 const{b,u,receipts}=make(),e=enemy(b,{x:5.5,def:10000,res:100,attacking:true});paralysis(b,u,e);near(100000-e.hp,u.s.atk*talent(u));move(b,e,15);b.emit('palsyTriggered',{unit:e,source:u});assert.equal(own(receipts,u,e,'elemental').length,1);move(b,e,6);b.retreat(u);b.emit('palsyTriggered',{unit:e,source:u});assert.equal(own(receipts,u,e,'elemental').length,1);
});
test('T1 purposeNONE aura retains stealth, respects Sleep damage immunity and rejects hidden/free without source-control detachment',()=>{
 for(const state of['stealth','sleep','hidden','free','source-stun','source-hide']){const{b,u,receipts}=make(),e=enemy(b);if(state==='stealth')b.addBuff(e,{key:'stealth',flags:{stealth:true}});if(state==='sleep')b.applyStatus(e,'sleep',{duration:3});if(state==='hidden')e.hidden=true;if(state==='free')b.addBuff(e,{key:'free',flags:{untargetable:true}});if(state==='source-stun')b.applyStatus(u,'stun',{duration:3});if(state==='source-hide')u.hidden=true;
  b.emit('palsyTriggered',{unit:e,source:null});assert.equal(own(receipts,u,e,'elemental').length,['sleep','hidden','free','source-hide'].includes(state)?0:1);
 }
});
test('S1 natural loop hits exactly two victims and adds accepted Arts-based Nervous injury once each',()=>{
 const{b,u,receipts}=make(),a=enemy(b),z=enemy(b,{x:6.1}),other=enemy(b,{x:6.2});cast(b,u);u.atkCd=0;b.step();u.atkCd=1000;advance(b,.8);assert.equal(u.stats.attacks,1);assert.equal(own(receipts,u).length,2);assert.equal([a,z,other].filter(e=>e.hp<100000).length,2);near(a.elem.neural+z.elem.neural+other.elem.neural,2*u.s.atk*u.skill.bb['attack@ep_damage_ratio']);
});
test('S1 all10 ranks use received Arts after RES and output scale, not bare source ATK',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u}=make({rank}),e=enemy(b,{res:60});b.addBuff(u,{key:'output',mods:{atkScaleMul:2}});cast(b,u);shot(b,u,e);advance(b,.8);const dealt=u.s.atk*2*.4;near(100000-e.hp,dealt);near(e.elem.neural,dealt*u.skill.bb['attack@ep_damage_ratio']);}
});
test('S1 shield/dodge/cancel/invulnerability admit only accepted remaining Arts for gauge',()=>{
 for(const state of['shield','half-shield','dodge','cancel','immune']){const{b,u}=make(),e=enemy(b);cast(b,u);if(state==='shield')b.addBuff(e,{key:state,shield:100000});if(state==='half-shield')b.addBuff(e,{key:state,shield:u.s.atk/2});if(state==='dodge')b.addBuff(e,{key:state,mods:{dodgeArts:1}});if(state==='immune')b.addBuff(e,{key:state,flags:{invulnerable:true}});if(state==='cancel')b.on('hit',c=>{if(c.source===u&&c.dmg.type==='arts')c.dmg.cancel=true;});shot(b,u,e);advance(b,.8);near(e.elem.neural,state==='half-shield'?u.s.atk/2*u.skill.bb['attack@ep_damage_ratio']:0);}
});
test('S1 no injury observer leaks or borrows unrelated later damage, and normal after expiration has no injury',()=>{
 const{b,u}=make(),e=enemy(b),other=enemy(b,{x:15});const hooks=b._hooks.damaged.length;cast(b,u);shot(b,u,e);advance(b,.8);assert.equal(b._hooks.damaged.length,hooks);b.dealDamage(u,other,{amount:10,type:'arts',isAttack:true,attackId:999});near(other.elem.neural,0);u.skill.end('test');const gauge=e.elem.neural;shot(b,u,e);advance(b,.8);near(e.elem.neural,gauge);
});
test('S1 born selected injury survives source retirement without a fake current skill or ATK snapshot',()=>{
 const{b,u,receipts}=make(),e=enemy(b,{x:7});cast(b,u);shot(b,u,e);advance(b,.567);assert.equal(b.projectiles.list.length,1);b.retreat(u);advance(b,.5);near(100000-e.hp,u.s.atk);near(e.elem.neural,u.s.atk*u.skill.bb['attack@ep_damage_ratio']);assert.equal(own(receipts,u,e)[0].dmg.isSkill,true);
});
test('ordinary/S1 CAST reselects current victims and sub-tick controls cancel only unborn releases',()=>{
 for(const skilled of[false,true])for(const state of['enter','leave','stun','immune']){const{b,u}=make(),old=enemy(b),next=enemy(b,{x:15});if(skilled)cast(b,u);shot(b,u,old);if(state==='enter'){move(b,old,15);move(b,next,6);}if(state==='leave')move(b,old,15);if(state==='immune')u.def.immune.add('stun');if(state==='stun'||state==='immune')b.applyStatus(u,'stun',{duration:.001});advance(b,.9);assert.equal(old.hp<100000,state==='immune');assert.equal(next.hp<100000,state==='enter');}
});
test('actual1000 Nervous gauge creates recovery and palsy stacks without creating the talent hit at grant',()=>{
 const{b,u,receipts}=make(),e=enemy(b);delete e.gaugeMax;cast(b,u);e.elem.neural=999;shot(b,u,e);advance(b,.8);assert.ok(e.findBuff('neuralBurst'));assert.ok(e.findBuff('palsy'));assert.equal(own(receipts,u,e,'elemental').length,0);
});
test('S2 full readiness rejects empty field without spending, and legal air input can create a field',()=>{
 const{b,u}=make({skill:1});u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(ID),false);assert.equal(u.skill.ready,true);enemy(b,{fly:true});assert.equal(b.activateOperator(ID),true);advance(b,.4);assert.equal(u.mem.christineFields.length,1);
});
test('S2 explicit release, moving immediate sample, actual arrival and next1s stationary pulse remain distinct',()=>{
 const{b,u,receipts}=make({skill:1}),far=enemy(b,{x:8}),nearby=enemy(b,{x:4});cast(b,u);advance(b,.233);assert.equal(u.mem.christineFields.length,0);advance(b,.067);const f=u.mem.christineFields[0];assert.ok(f);assert.equal(f.arrivedAt,null);assert.equal(own(receipts,u,nearby).length,1);near(far.hp,100000);advance(b,.2);assert.equal(f.arrivedAt,null);near(far.hp,100000);advance(b,.2);assert.ok(f.arrivedAt);near(f.x,8);near(far.hp,100000);advance(b,.667);assert.equal(own(receipts,u,far).length,1);assert.equal(own(receipts,u,nearby).length,1);
});
test('S2 all ranks uses selected Arts scale/radius and only SANITY recovery gets independent HP Elemental bonus',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u,receipts}=make({skill:1,rank}),e=enemy(b,{res:60}),z=enemy(b,{x:6.1,res:60}),wrong=enemy(b,{x:6.2,res:60});b.addBuff(e,{key:'neuralBurst',flags:{burstLock:true}});b.addBuff(wrong,{key:'burnBurst',flags:{burstLock:true}});cast(b,u);advance(b,.4);near(100000-e.hp,u.s.atk*u.skill.bb.atk_scale*.4+u.s.atk*u.skill.bb.atk_scale_ep);for(const v of[z,wrong])near(100000-v.hp,u.s.atk*u.skill.bb.atk_scale*.4);assert.equal(own(receipts,u,e,'elemental').length,1);assert.equal(own(receipts,u,wrong,'elemental').length,0);}
});
test('S2 literal radius1.5 includes air/body overlap, rejects outside circle, and reevaluates membership',()=>{
 const{b,u,receipts}=make({skill:1}),main=enemy(b),air=enemy(b,{x:6,y:6.4,fly:true}),outside=enemy(b,{x:6,y:7.5}),body=enemy(b,{x:6,y:7});body.hitArea={w:.2,h:1.2,dx:0,dy:0};cast(b,u);advance(b,.8);move(b,main,15);advance(b,.6);assert.ok(air.hp<100000);assert.ok(body.hp<100000);near(outside.hp,100000);const n=own(receipts,u,main).length;advance(b,1);assert.equal(own(receipts,u,main).length,n);
});
test('S2 late entrants receive each cadence without swept passerby hits or stale target membership',()=>{
 const{b,u,receipts}=make({skill:1}),main=enemy(b),late=enemy(b,{x:15});cast(b,u);advance(b,.5);move(b,late,6);advance(b,.3);near(late.hp,100000);advance(b,.6);assert.equal(own(receipts,u,late).length,1);move(b,late,15);advance(b,1);assert.equal(own(receipts,u,late).length,1);
});
test('S2 camouflage is collateral eligible but unrevealed invisibility/hidden/free/Sleep remain rejected',()=>{
 const{b,u}=make({skill:1}),main=enemy(b),cam=enemy(b,{x:6.1}),stealth=enemy(b,{x:6.2}),hidden=enemy(b,{x:6.3}),free=enemy(b,{x:6.4}),sleep=enemy(b,{x:6.5});b.addBuff(cam,{key:'cam',flags:{camou:true}});b.addBuff(stealth,{key:'stealth',flags:{stealth:true}});hidden.hidden=true;b.addBuff(free,{key:'free',flags:{untargetable:true}});b.applyStatus(sleep,'sleep',{duration:3});cast(b,u);advance(b,1.4);assert.ok(main.hp<100000);assert.ok(cam.hp<100000);for(const e of[stealth,hidden,free,sleep])near(e.hp,100000);
});
test('S2 missing CAST victim and accepted sub-tick control abort unborn field then End instead of fake20s lock',()=>{
 for(const state of['leave','stun','immune']){const{b,u}=make({skill:1}),e=enemy(b);cast(b,u);if(state==='leave')move(b,e,15);if(state==='immune')u.def.immune.add('stun');if(state!=='leave')b.applyStatus(u,'stun',{duration:.001});advance(b,.35);assert.equal(u.mem.christineFields.length,state==='immune'?1:0);if(state!=='immune')assert.equal(u.mem.regularFormVisual.clip,'Skill_2_End');assert.equal(u.skill.gainSp(1,'test'),0);advance(b,.2);assert.equal(u.skill.active,state==='immune');if(state!=='immune'){assert.equal(effectiveProfile(u).noAttack,false);assert.ok(u.skill.gainSp(1,'test')>0);}}
});
test('S2 born spirit survives control and owner death/withdraw with current retired-source ATK and bounded cleanup',()=>{
 for(const state of['stun','retreat','death']){const{b,u,receipts}=make({skill:1}),e=enemy(b);cast(b,u);advance(b,.4);const f=u.mem.christineFields[0],first=own(receipts,u,e).length;b.addBuff(u,{key:'late',mods:{atkPct:.5}});if(state==='stun')b.applyStatus(u,'stun',{duration:4});if(state==='retreat')b.retreat(u);if(state==='death')b.kill(u,null);advance(b,1);assert.equal(u.mem.christineFields.length,1);assert.ok(own(receipts,u,e).length>first);near(own(receipts,u,e).at(-1).amount,u.s.atk*u.skill.bb.atk_scale);advance(b,21);assert.equal(u.mem.christineFields.length,0);assert.equal(b._sched.filter(x=>x.interval>0&&!x.cancelled&&x.owner==null).length,0);assert.equal(f.done,true);}
});
test('S2 retained field keeps old source identity through a new deployment, without borrowing new build buffs',()=>{
 const{b,u,receipts}=make({skill:1}),e=enemy(b);cast(b,u);advance(b,.4);b.retreat(u);b.bench[ID].readyAt=b.time;b.addDp('arkpedia',99);const z=b.deployOperator(ID,5,5,'RIGHT');assert.ok(z);z.atkCd=1000;z.skill.rule='NEVER';b.addBuff(z,{key:'new',mods:{atkPct:3}});advance(b,1);assert.notEqual(z.id,u.id);assert.equal(own(receipts,z,e).length,0);near(own(receipts,u,e).at(-1).amount,u.s.atk*u.skill.bb.atk_scale);
});
test('S2 selected after-arrival20s lifetime overrides raw10 and retains noAttack/noSP until original End completes',()=>{
 const{b,u}=make({skill:1}),e=enemy(b);cast(b,u);advance(b,.5);const f=u.mem.christineFields[0];assert.ok(f.arrivedAt);near(f.until-f.arrivedAt,u.skill.bb.projectile_delay_time);advance(b,10);assert.equal(f.done,false);assert.equal(u.skill.active,true);assert.equal(u.skill.gainSp(10,'test'),0);const remain=f.until-b.time;advance(b,remain-.1);assert.equal(f.done,false);assert.equal(u.stats.attacks,0);advance(b,.1+b.dt);assert.equal(f.done,true);assert.equal(u.skill.active,true);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_End');assert.equal(u.skill.gainSp(1,'test'),0);advance(b,.2);assert.equal(u.skill.active,false);assert.equal(!!effectiveProfile(u).noAttack,false);assert.ok(u.skill.gainSp(1,'test')>0);u.atkCd=0;b.step();u.atkCd=1000;advance(b,.8);assert.equal(u.stats.attacks,1);
});
test('S2 strict expiry has no pulse after cleanup and no leaked unowned timer',()=>{
 const{b,u,receipts}=make({skill:1}),e=enemy(b);cast(b,u);advance(b,.5);const f=u.mem.christineFields[0];advance(b,f.until-b.time+.3);const n=own(receipts,u,e).length;advance(b,2);assert.equal(own(receipts,u,e).length,n);assert.equal(u.mem.christineFields.length,0);assert.equal(b._sched.filter(x=>x.interval>0&&!x.cancelled&&x.owner==null).length,0);
});
test('S2 born spirit survives parent end but projectile removal before arrival releases graph and parent end gate',()=>{
 for(const state of['parent','remove']){const{b,u,receipts}=make({skill:1}),e=enemy(b,{x:8});cast(b,u);advance(b,.4);const f=u.mem.christineFields[0];assert.ok(f);if(state==='parent')u.skill.end('test');else b.removeProjectiles(p=>p===f.projectile);advance(b,1.2);if(state==='parent'){assert.equal(u.mem.christineFields.length,1);assert.ok(own(receipts,u,e).length>0);}else{assert.equal(u.mem.christineFields.length,0);assert.equal(u.skill.active,false);}}
});
test('S2 uses existing literal Begin/FrontLoop/BackIdle/End across each facing without inventing a Back alias',()=>{
 for(const dir of['RIGHT','LEFT','UP','DOWN']){const{b,u}=make({skill:1,dir});enemy(b,point(dir));cast(b,u);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Begin');advance(b,.4);assert.equal(u.mem.regularFormVisual.clip,['UP','LEFT'].includes(dir)?'Skill_2_Idle':'Skill_2_Loop');advance(b,.2);const f=u.mem.christineFields[0];assert.ok(Number.isFinite(f.until));advance(b,f.until-b.time+b.dt);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_End');advance(b,.2);assert.equal(u.mem.regularFormVisual,null);}
});
test('S2 hidden owner preserves structural completion clock: unborn abort ends and born field remains until cleanup',()=>{
 for(const born of[false,true]){const{b,u,receipts}=make({skill:1}),e=enemy(b);cast(b,u);advance(b,born?.4:.1);u.hidden=true;advance(b,.5);assert.equal(u.skill.active,born);if(born){const f=u.mem.christineFields[0];assert.ok(f&&Number.isFinite(f.until));const n=own(receipts,u,e).length;advance(b,1);assert.ok(own(receipts,u,e).length>n);advance(b,f.until-b.time+.3);assert.equal(u.mem.christineFields.length,0);assert.equal(u.skill.active,false);}else assert.equal(u.mem.christineFields.length,0);u.hidden=false;assert.equal(!!effectiveProfile(u).noAttack,false);}
});
