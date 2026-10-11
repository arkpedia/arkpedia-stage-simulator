// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-blessing-expansion-prefabs.json' with { type: 'json' };
import { BLESSING_EXPANSION_OPERATORS } from '../shared/arkpedia/blessing-expansion-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { installBlessingExpansion } from '../server/sim/content/arkpedia-blessing-expansion.js';
const DEE='char_4019_ncdeer',XIN='char_4172_xingzh',FAN='char_123_fang',BEA='char_122_beagle',KRO='char_124_kroos',VUL='char_163_hpsts';
const near=(a,e,t=1e-5)=>assert.ok(Math.abs(a-e)<t,`${a} != ${e}`);
const advance=(b,s)=>{for(let n=0;n<Math.round(s/b.dt);n++)b.step();assert.deepEqual(b.errors,[]);};
function build(id,{skill=0,rank=10,elite=2,potential=1}={}){const o=data.operators[id];assert.ok(o,`Reviewed snapshot required ${id}`);return{...defaultBuild(o),elite,level:o.phases[elite].maxLevel,potential,skillId:o.skills[skill].id,skillRank:rank};}
function make(id,{skill=0,rank=10,elite=2,potential=1,others=[]}={}){
 const source=structuredClone(data);source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;
 const b=new StandardBattle(source,{operators:[build(id,{skill,rank,elite,potential}),...others.map(x=>typeof x==='string'?defaultBuild(source.operators[x]):x)]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
 const deploy=(who=id,r=1,c=4,dir='UP')=>{b.addDp('arkpedia',99);const u=b.deployOperator(who,r,c,dir);assert.ok(u,`${who} at ${r},${c}`);u.atkCd=1000;return u;};return{b,deploy};
}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(u.defId),true);u.atkCd=1000;}
function wound(u,hp=100,max=100000){u.base.maxHp=max;u.markDirty();void u.s;u.hp=hp;}
function enemy(b,x=4,y=2){const e=b.spawnEnemy('enemy_1007_slime',{routeIndex:1});e.x=x;e.y=y;e.base.maxHp=e.hp=100000;e.base.def=e.base.res=e.base.moveSpeed=0;e.markDirty();b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;}
const bb=(id,s,rank=10)=>Object.fromEntries(data.operators[id].skills[s].levels[rank-1].blackboard.map(x=>[x.key,x.value]));
const row=(rows,id)=>rows.find(x=>x.pathId===id).data;
const shot=(b,u,t,sec)=>{b.forceAttack(u,t);u.atkCd=1000;advance(b,sec);};

test('Blessing expansion retains six exact original bundles, four skills, direct versus projectile heals and all model events',()=>{
 assert.equal(evidence.sourceBundles.length,6);assert.equal(evidence.frameParity,false);
 for(const[id,cfg]of Object.entries(BLESSING_EXPANSION_OPERATORS)){
  assert.match(evidence.sourceBundles.find(x=>x.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);
  for(const face of['Front','Back'])assert.match(evidence.models[id][face].sha256,/^[a-f0-9]{64}$/);
  for(const sid of cfg.skillIds)assert.equal(evidence.tableContracts[id].skills[sid].length,10);
 }
 const direct=row(evidence.characters[DEE],'6051194220154441058');assert.equal(direct._isCont,0);assert.equal(direct._maxAnimScale,-1);assert.equal('_projectileKey'in direct,false);
 const limited=row(evidence.characters[XIN],'6127433169986213192');assert.equal(limited._maxNum,2);assert.equal(limited._selfOption,2);
 const heal=row(evidence.characters[XIN],'9085154804342281544');assert.equal(heal._interval,.5);assert.equal(heal._forceTick,1);
 const mark=row(evidence.characters[XIN],'3949454866968827208');assert.equal(mark._filterBuffSource,1);assert.deepEqual(mark._buffs,['xingzh_t_1[mark]']);
 assert.equal(row(evidence.projectiles.projectile_chr_xingzh_s1_logic,'-6252495444709828335')._speed,99);
 assert.equal(evidence.buffTemplates.ncdeer_s_2_resistance.eventToActions.ON_TAKE_DAMAGE[1]._applyWayFilter,'RANGED');
});

test('all four selected Blessing skills load every source rank without generic fallback',()=>{
 for(const[id,cfg]of Object.entries(BLESSING_EXPANSION_OPERATORS))for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(id,{skill,rank}),u=deploy();assert.equal(u.skill.id,cfg.skillIds[skill]);assert.equal(u.skill.noSkill,false);assert.deepEqual(b.errors,[]);
 }
});

test('active Blessing modes heal through the natural AI loop and restore enemy attacks after ending',()=>{
 for(const[id,skill]of[[DEE,0],[DEE,1],[XIN,1]]){
  const{b,deploy}=make(id,{skill,others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5),e=enemy(b,4,3);
  wound(a);wound(z);let ordinaryHeals=0;b.on('heal',c=>{if(c.source===u&&!c.opts.regen)ordinaryHeals++;});
  cast(b,u);advance(b,.4);u.atkCd=0;advance(b,1.05);assert.ok(ordinaryHeals>0);assert.ok(u.stats.attacks>0);near(e.hp,100000);
  u.skill.end('duration');advance(b,.4);u.atkCd=0;advance(b,1);assert.ok(e.hp<100000);assert.equal(u.profile.dmgType,'arts');
 }
});

test('both ordinary attacks retain original facing event, Arts damage and actual source projectile speed',()=>{
 for(const id of[DEE,XIN])for(const dir of['RIGHT','UP']){
  const{b,deploy}=make(id),u=deploy(id,1,4,dir),e=enemy(b);e.base.res=40;e.markDirty();
  b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.55);near(e.hp,100000);advance(b,.08);
  const p=b.projectiles.list[0];assert.ok(p);assert.equal(p.speed,id===DEE?8:10);advance(b,.3);near(100000-e.hp,u.s.atk*.6);
 }
});

test('Nine-Colored Deer Sanctuary uses all promotion values and the original delayed first checker',()=>{
 for(const[elite,value]of[[0,.08],[1,.14],[2,.20]]){
  const{b,deploy}=make(DEE,{elite,rank:[4,7,10][elite],others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a,40000);
  assert.equal(a.findBuff(`ncdeer:sanctuary:${u.id}`),null);advance(b,.05);assert.equal(a.findBuff(`ncdeer:sanctuary:${u.id}`),null);advance(b,.05);
  near(a.findBuff(`ncdeer:sanctuary:${u.id}`).data.value,value);
  const hp=a.hp;b.dealDamage(null,a,{amount:100,type:'true'});near(hp-a.hp,100);
  a.hp=40000.01;advance(b,.1);assert.equal(a.findBuff(`ncdeer:sanctuary:${u.id}`),null);
 }
});

test('Nine-Colored Deer Sanctuary retains unhealable allies but rejects source target-free and isolation',()=>{
 const{b,deploy}=make(DEE,{others:[VUL,FAN,BEA]}),u=deploy(),v=deploy(VUL,2,3),a=deploy(FAN,2,5),z=deploy(BEA,3,5);
 for(const q of[v,a,z])wound(q,30000);b.addBuff(a,{key:'test:free',flags:{untargetable:true}});b.addBuff(z,{key:'test:isolate',flags:{isolated:true}});advance(b,.15);
 assert.ok(v.profile.noHeal);assert.ok(v.findBuff(`ncdeer:sanctuary:${u.id}`));assert.equal(a.findBuff(`ncdeer:sanctuary:${u.id}`),null);assert.equal(z.findBuff(`ncdeer:sanctuary:${u.id}`),null);
 b.applyStatus(v,'sanctuary',{key:'other:protection',value:.3});const hp=v.hp,expected=100*(1-v.s.res/100)*.7;b.dealDamage(null,v,{amount:100,type:'arts'});near(hp-v.hp,expected);
 b.retreat(u);assert.equal(v.findBuff(`ncdeer:sanctuary:${u.id}`),null);assert.ok(v.findBuff('other:protection'));
});

test('Nine-Colored Deer checker preserves its native cadence through HP changes and restarts on range reentry',()=>{
 const{b,deploy}=make(DEE,{others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a,50000);advance(b,.05);a.hp=30000;
 advance(b,.05);assert.ok(a.findBuff(`ncdeer:sanctuary:${u.id}`));a.x=9;a.y=7;advance(b,.05);assert.equal(a.findBuff(`ncdeer:checker:${u.id}`),null);
 a.x=3;a.y=2;advance(b,.05);assert.equal(a.findBuff(`ncdeer:sanctuary:${u.id}`),null);advance(b,.1);assert.ok(a.findBuff(`ncdeer:sanctuary:${u.id}`));
});

test('Nine-Colored Deer S1 uses selected ATK and direct .75 healing at the uncapped Skill_Loop event',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(DEE,{rank,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);cast(b,u);near(u.s.atk,u.base.atk*(1+bb(DEE,0,rank).atk));advance(b,.4);
  assert.equal(u.mem.regularFormVisual.clip,'Skill_Idle');assert.equal(u.mem.regularFormVisual.attack,'Skill_Loop');
  b.addBuff(u,{key:'test:fast',mods:{aspd:100}});const p=effectiveProfile(u);near(p.windup(b,u),.433/2);
  b.forceAttack(u,[a]);u.atkCd=1000;advance(b,.2);near(a.hp,100);advance(b,.05);near(a.hp-100,u.s.atk*.75);assert.equal(b.projectiles.list.length,0);
  u.skill.end('duration');assert.equal(u.profile.dmgType,'arts');advance(b,.4);assert.equal(u.mem.regularFormVisual,null);
 }
});

test('Nine-Colored Deer S2 selected ASPD raises Sanctuary threshold and heals only legal injured allies',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(DEE,{skill:1,rank,others:[FAN,VUL]}),u=deploy(),a=deploy(FAN,2,3),v=deploy(VUL,2,5);wound(a,90000);wound(v);
  advance(b,.1);assert.equal(a.findBuff(`ncdeer:sanctuary:${u.id}`),null);cast(b,u);near(u.s.aspd,u.base.aspd+bb(DEE,1,rank).attack_speed);
  advance(b,.1);assert.ok(a.findBuff(`ncdeer:sanctuary:${u.id}`));advance(b,.3);assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[a]);
  const hp=a.hp;shot(b,u,[a],.45);near(a.hp-hp,u.s.atk*.75);near(v.hp,100);u.skill.end('duration');advance(b,.1);assert.equal(a.findBuff(`ncdeer:sanctuary:${u.id}`),null);
 }
});

test('Nine-Colored Deer direct heal is interruptible by sub-tick control and revalidates ally legality at release',()=>{
 for(const mode of['control','isolate','healFree']){
  const{b,deploy}=make(DEE,{others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);cast(b,u);advance(b,.4);b.forceAttack(u,[a]);u.atkCd=1000;
  if(mode==='control')b.applyStatus(u,'stun',{duration:.001});else b.addBuff(a,{key:'test:invalid',flags:{[mode==='isolate'?'isolated':'healFree']:true}});
  advance(b,.7);near(a.hp,100);assert.equal(b.projectiles.list.length,0);
 }
});

test('Nine-Colored Deer ranged Physical resist uses selected probability and blocks before shields without cancelling accepted output',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(DEE,{skill:1,rank}),u=deploy();u.base.def=u.base.res=0;u.markDirty();cast(b,u);advance(b,.4);
  let prob,accepted;b.rng.chance=p=>{prob=p;return true;};b.on('damaged',ctx=>{if(ctx.target===u)accepted=ctx;});
  b.addBuff(u,{key:'test:shield',shield:1000});const hp=u.hp;b.dealDamage(null,u,{amount:100,type:'phys',applyWay:'ranged',canDodge:false});
  near(prob,bb(DEE,1,rank).prob);near(u.hp,hp);near(u.findBuff('test:shield').shield,1000);assert.ok(accepted);near(accepted.amount,0);
 }
});

test('Nine-Colored Deer ranged Physical resist distinguishes actual applyWay, excludes melee/Arts/none/HP loss and ends with skill',()=>{
 const{b,deploy}=make(DEE,{skill:1}),u=deploy();u.base.def=u.base.res=0;u.markDirty();cast(b,u);advance(b,.4);b.rng.chance=()=>true;
 for(const[type,applyWay,expected]of[['phys','melee',80],['arts','ranged',80],['phys','none',80],['true','ranged',100]]){
  const hp=u.hp;b.dealDamage(null,u,{amount:100,type,applyWay,canDodge:false});near(hp-u.hp,expected);
 }
 const hp=u.hp;b.loseHp(u,100);near(hp-u.hp,100);u.skill.end('duration');advance(b,.4);const end=u.hp;b.dealDamage(null,u,{amount:100,type:'phys',applyWay:'ranged',canDodge:false});near(end-u.hp,100);
});

test('Xingzhu marks exactly two other operators, keeps surviving recipients and fills released slots',()=>{
 const{b,deploy}=make(XIN,{others:[FAN,BEA,KRO]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5),k=deploy(KRO,1,3);
 assert.deepEqual(u.mem.xingMarked,[a,z]);assert.equal(u.findBuff(`xingzh_t_1[mark]:${u.id}`),null);assert.equal(k.findBuff(`xingzh_t_1[mark]:${u.id}`),null);
 wound(z,50000);advance(b,.1);assert.deepEqual(u.mem.xingMarked,[a,z]);a.x=9;a.y=7;advance(b,.05);assert.deepEqual(u.mem.xingMarked,[z,k]);
 assert.equal(a.findBuff(`xingzh_t_1[mark]:${u.id}`),null);assert.equal(a.findBuff(`xingzhu:sanctuary:${u.id}`),null);a.x=3;a.y=2;advance(b,.05);assert.deepEqual(u.mem.xingMarked,[z,k]);
});

test('Xingzhu promotion/potential Sanctuary respects source unhealable eligibility, isolation and strongest fallback',()=>{
 for(const[elite,potential,value]of[[0,1,0],[1,1,.07],[1,5,.09],[2,1,.10],[2,5,.12]]){
  const{b,deploy}=make(XIN,{elite,potential,rank:[4,7,10][elite],others:[VUL,FAN,BEA]}),u=deploy(),v=deploy(VUL,2,3),a=deploy(FAN,2,5),z=deploy(BEA,3,5);
  if(!value){assert.deepEqual(u.mem.xingMarked,[]);continue;}
  near(v.findBuff(`xingzhu:sanctuary:${u.id}`).data.value,value);b.applyStatus(v,'sanctuary',{key:'test:independent',value:.3});
  b.addBuff(a,{key:'test:isolated',flags:{isolated:true}});advance(b,.05);assert.deepEqual(u.mem.xingMarked,[v,z]);
  b.addBuff(z,{key:'test:free',flags:{untargetable:true}});advance(b,.05);assert.deepEqual(u.mem.xingMarked,[v]);
  b.retreat(u);assert.ok(v.findBuff('test:independent'));assert.equal(v.findBuff(`xingzhu:sanctuary:${u.id}`),null);
 }
});

test('Xingzhu S1 heals every legal ally at the selected separate heal_scale rather than multiplying trait .75',()=>{
 for(let rank=1;rank<=10;rank++)for(const dir of['RIGHT','UP']){
  const{b,deploy}=make(XIN,{rank,others:[FAN,BEA,KRO]}),u=deploy(XIN,1,4,dir),a=deploy(FAN,2,3),z=deploy(BEA,2,5),k=deploy(KRO,1,3);
  // Preserve the original absolute range while inspecting facing-specific events.
  u.dir='UP';b._refreshRange(u);u.dir=dir;
  for(const q of[u,a,z,k])wound(q);cast(b,u);advance(b,.5);for(const q of[u,a,z,k])near(q.hp,100);
  advance(b,.25);for(const q of[u,a,z,k])near(q.hp-100,u.s.atk*bb(XIN,0,rank).heal_scale);
  assert.ok(u.findBuff('xingzhu:cast'));advance(b,1);assert.equal(u.findBuff('xingzhu:cast'),null);
 }
});

test('Xingzhu S1 selects healthy targets too but excludes heal-free, unhealable and isolated recipients',()=>{
 const{b,deploy}=make(XIN,{others:[FAN,BEA,VUL]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5),v=deploy(VUL,3,5);wound(a);wound(z);wound(v);
 b.addBuff(a,{key:'test:free',flags:{healFree:true}});b.addBuff(z,{key:'test:isolate',flags:{isolated:true}});cast(b,u);advance(b,.8);
 for(const q of[a,z,v])near(q.hp,100);assert.equal(u.hp,u.s.maxHp);assert.equal(u.skill.activations,1);
});

test('Xingzhu interruptible S1 remembers sub-tick controls and emitted unmanaged projectiles survive withdrawal',()=>{
 for(const status of['stun','freeze','sleep','levitate']){
  const{b,deploy}=make(XIN,{others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);cast(b,u);advance(b,.1);b.applyStatus(u,status,{duration:.001});advance(b,.8);
  near(a.hp,100);assert.equal(u.canAct,true);assert.equal(u.findBuff('xingzhu:cast'),null);assert.equal(u.mem.regularFormVisual,null);
  cast(b,u);b.after(evidence.models[XIN].Back.hits.Skill_1[0],()=>b.retreat(u));advance(b,.8);assert.ok(a.hp>100);
 }
});

test('Xingzhu S2 selects two injured allies and preserves source event cap1 and actual speed10 healing flights',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(XIN,{skill:1,rank,others:[FAN,BEA,KRO]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5),k=deploy(KRO,1,3);for(const q of[a,z,k])wound(q);
  cast(b,u);advance(b,.2);near(u.s.aspd,u.base.aspd+bb(XIN,1,rank).attack_speed);const p=effectiveProfile(u),targets=acquireTargets(b,u,p);assert.deepEqual(targets,[a,z]);near(p.windup(b,u),.533);
  b.forceAttack(u,targets);u.atkCd=1000;advance(b,.5);near(a.hp,100);near(z.hp,100);advance(b,.08);assert.equal(b.projectiles.list.length,2);assert.ok(b.projectiles.list.every(p=>p.speed===10));advance(b,.15);
  near(a.hp-100,u.s.atk*.75);near(z.hp-100,u.s.atk*.75);near(k.hp,100);
 }
});

test('Xingzhu S2 only own marked recipients regenerate, waits selected one-second first pulse and uses live ATK',()=>{
 for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(XIN,{skill:1,rank,others:[FAN,BEA,KRO]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5),k=deploy(KRO,1,3);for(const q of[a,z,k,u])wound(q);
  b.addBuff(k,{key:'xingzh_t_1[mark]:foreign',source:z});cast(b,u);advance(b,.9);for(const q of[a,z,k,u])near(q.hp,100);
  b.addBuff(u,{key:'test:atk',mods:{atkPct:.5}});advance(b,.15);const amount=u.s.atk*bb(XIN,1,rank)['attack@xingzh_s_2[heal].atk_to_hp_recovery_ratio'];
  near(a.hp-100,amount);near(z.hp-100,amount);near(k.hp,100);near(u.hp,100);u.skill.end('duration');advance(b,1);near(a.hp-100,amount);
 }
});

test('Xingzhu S2 regeneration bypasses HealFree/noHeal but honors final HP recovery scaler and source detach',()=>{
 const{b,deploy}=make(XIN,{skill:1,others:[VUL,FAN]}),u=deploy(),v=deploy(VUL,2,3),a=deploy(FAN,2,5);wound(v);wound(a);
 b.addBuff(a,{key:'test:regen-zero',mods:{hpRegenMul:0},flags:{healFree:true}});cast(b,u);advance(b,1.05);
 near(v.hp-100,u.s.atk*.2);near(a.hp,100);b.removeBuff(a,'test:regen-zero');b.addBuff(a,{key:'test:healFree',flags:{healFree:true}});advance(b,1);assert.ok(a.hp>100);
 b.addBuff(v,{key:'test:isolate',flags:{isolated:true}});advance(b,.05);const hp=v.hp;assert.equal(v.findBuff(`xingzhu:recovery:${u.id}`),null);advance(b,1);near(v.hp,hp);
 b.retreat(u);const stop=a.hp;advance(b,2);near(a.hp,stop);assert.equal(a.findBuff(`xingzhu:recovery:${u.id}`),null);
});

test('Xingzhu S2 half-second discovery starts a new recipient clock after an owned mark transfers',()=>{
 const{b,deploy}=make(XIN,{skill:1,others:[FAN,BEA,KRO]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5),k=deploy(KRO,1,3);for(const q of[a,z,k])wound(q);cast(b,u);
 advance(b,.6);a.x=9;a.y=7;advance(b,.05);assert.equal(k.findBuff(`xingzhu:recovery:${u.id}`),null);advance(b,.4);assert.ok(k.findBuff(`xingzhu:recovery:${u.id}`));near(k.hp,100);
 advance(b,.9);near(k.hp,100);advance(b,.15);near(k.hp-100,u.s.atk*.2);near(a.hp,100);
});

test('Xingzhu independent producers keep their own two marks and regeneration without deleting foreign Sanctuary',()=>{
 const{b,deploy}=make(XIN,{skill:1,others:[FAN,BEA,KRO]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5),second=deploy(KRO,1,3);
 const def=structuredClone(u.def);def.charId=XIN;second.def=def;second.defId=XIN;second.rangeGrid=structuredClone(u.rangeGrid);second.dir=u.dir;second.tileR=u.tileR;second.tileC=u.tileC;second.x=u.x;second.y=u.y;b._refreshRange(second);
 installBlessingExpansion({battle:b,unit:second,def});advance(b,.05);assert.ok(a.findBuff(`xingzh_t_1[mark]:${u.id}`));assert.ok(a.findBuff(`xingzh_t_1[mark]:${second.id}`));
 b.retreat(u);assert.equal(a.findBuff(`xingzhu:sanctuary:${u.id}`),null);assert.ok(a.findBuff(`xingzhu:sanctuary:${second.id}`));assert.ok(a.findBuff(`xingzh_t_1[mark]:${second.id}`));assert.deepEqual(b.errors,[]);
});
