// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-guard-six-star-prefabs.json' with { type: 'json' };
import { GUARD_SIX_STAR_OPERATORS as configs } from '../shared/arkpedia/guard-six-star-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, acquireTargets } from '../server/sim/ai.js';
const SKADI='char_263_skadi',SILVER='char_172_svrash',HELL='char_188_helage';
const near=(a,e,t=1e-5)=>assert.ok(Math.abs(a-e)<t,`${a} != ${e}`);
const nodes=rows=>rows.flatMap(r=>r.components);
function buildFor(id,{skill=0,rank=10,elite=null,potential=1}={}){
 const op=data.operators[id];elite??=op.phases.length-1;rank=Math.min(rank,elite===2?10:elite===1?7:4);return{...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,skillId:op.skills[skill].id,skillRank:rank};
}
function make(id,opts={},more=[],support=null){
 const source=structuredClone(data);source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;
 const builds=[buildFor(id,opts),...more.map(v=>typeof v==='string'?buildFor(v):v)];
 const b=new StandardBattle(source,{operators:builds,...(support?{support}: {})});b.autoFinish=false;b.recordEvents=true;b.setViewport('fullscreen-workspace');
 b.grid.tiles=b.grid.tiles.map(v=>({...v,height:'LOW',build:'ALL',pass:'ALL'}));
 const rng=()=>.999;rng.int=()=>0;b.rng=rng;
 return{b,deploy:(r=3,c=4,dir='RIGHT',which=id)=>{b.addDp('arkpedia',99);const u=b.deployOperator(which,r,c,dir);assert.ok(u);u.atkCd=1000;u.skill.rule='NEVER';return u;}};
}
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function cast(u){u.skill.setSpTotal(u.skill.spCost*u.skill.maxCharges);assert.equal(u.skill.activate('test'),true);u.atkCd=1000;}
function enemy(b,{r=3,c=5,fly=false,def=0}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});e.base.maxHp=100000;e.base.atk=1000;e.base.def=def;e.base.res=0;if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=100000;
 b.addBuff(e,{key:'test:pin',persist:true,flags:{disarm:true,noMove:true}});b._buildEnemyIndex();return e;
}
function move(b,e,r,c){e.x=c;e.y=r;e.tileR=r;e.tileC=c;b._enemiesDirty=true;b._buildEnemyIndex();}
function block(b,u,e){move(b,e,u.tileR,u.tileC+.1);e.blockedBy=u;u.blocking=[e];b._buildEnemyIndex();advance(b,b.dt);}
function shot(b,u,targets){b.forceAttack(u,Array.isArray(targets)?targets:[targets]);u.atkCd=1000;}
const bb=(id,skill,rank=10)=>Object.fromEntries(data.operators[id].skills[skill].levels[rank-1].blackboard.map(v=>[v.key,v.value]));
const talent=(u,k)=>u.def.talents.find(t=>t.bb[k]!=null)?.bb;
function wounded(u,ratio=.5){void u.s;u.hp=u.s.maxHp*ratio;}

test('three complete source kits retain nine original skills, all facings, independent deck and hit selectors',()=>{
 assert.equal(Object.keys(configs).length,3);assert.equal(evidence.sourceVersion,'26-09-23-17-49-43_b9cc4a');
 for(const[id,c]of Object.entries(configs)){
  assert.match(evidence.sourceBundles.find(v=>v.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);
  for(const face of ['Front','Back'])assert.match(evidence.originalModels[id][face].sha256,/^[a-f0-9]{64}$/);
  for(const sid of c.skillIds)assert.ok(evidence.skills[sid.replace(/\[.*\]$/,'')].length);
 }
 assert.equal(nodes(evidence.characters[SKADI]).find(v=>v.pathId==='-6203921406167984886')._options.selector.filterTag,'abyssal');
 const p=nodes(evidence.projectiles.projectile_svrash_s1);assert.ok(p.some(c=>c._lifeTime>.21&&c._lifeTime<.23));
 assert.equal(nodes(evidence.skills.skchr_svrash_1).find(c=>c._recoverSpIfTargetDead!=null)._recoverSpIfTargetDead,1);
 assert.equal(evidence.buffTemplates.helage_trait.eventToActions.ON_OUTPUT_DAMAGE[0]._ignoreHealFree,true);
 assert.equal(evidence.deferredOperators.char_293_thorns,undefined);assert.equal(evidence.resolvedDeferrals.char_293_thorns.reviewedSuccessor,'data/arkpedia-thorns-prefabs.json');assert.match(evidence.deferredOperators.char_350_surtr.reason,/Whole kit deferred/);
 assert.ok(evidence.verificationLimits.some(v=>v.includes('refund')));
});
test('all nine skills and all ten source ranks load, while unlocks remain source gated',()=>{
 for(const[id,c]of Object.entries(configs))for(let skill=0;skill<3;skill++)for(let rank=1;rank<=10;rank++){
  const{b,deploy}=make(id,{skill,rank}),u=deploy();assert.equal(u.skill.id,c.skillIds[skill]);assert.equal(u.skill.noSkill,false);assert.deepEqual(b.errors,[]);
 }
 for(const id of Object.keys(configs)){const{deploy}=make(id,{elite:0,rank:4}),u=deploy();assert.ok(u.def.raw.arkpedia.elite===0);assert.equal(u.def.talents.some(t=>t.bb.hp_recovery_per_sec!=null),false);}
});
test('Skadi deck ATK uses real faction tags from bench and remains after source retreat without buffing outsiders',()=>{
 const{b,deploy}=make(SKADI,{},['char_143_ghost','char_282_catap']),u=deploy(),hunter=deploy(3,6,'RIGHT','char_143_ghost'),other=deploy(2,3,'RIGHT','char_282_catap');
 assert.ok(u.tags.has('abyssal'));assert.ok(hunter.tags.has('abyssal'));assert.ok(!other.tags.has('abyssal'));
 near(u.s.atk,u.base.atk*(1+talent(u,'atk').atk));near(hunter.s.atk,hunter.base.atk*(1+talent(u,'atk').atk));near(other.s.atk,other.base.atk);
 b.retreat(u);assert.ok(hunter.findBuff('skadi:deck'));near(hunter.s.atk,hunter.base.atk*(1+talent(u,'atk').atk));
 const again=make(SKADI,{},['char_143_ghost']);const a=again.deploy(3,4,'RIGHT','char_143_ghost');assert.ok(a.findBuff('skadi:deck')); // source still on bench
});
test('Skadi E1/E2 and potential deck selection is exact and repeated deployment does not stack it',()=>{
 for(const elite of [1,2])for(const potential of [1,5]){
  const{b,deploy}=make(SKADI,{elite,potential,rank:elite===1?7:10}),u=deploy();const bonus=talent(u,'atk').atk;near(u.s.atk,u.base.atk*(1+bonus));
  b.retreat(u);advance(b,75);const v=deploy();near(v.s.atk,v.base.atk*(1+bonus));assert.equal(v.buffs.filter(x=>x.key==='skadi:deck').length,1);
 }
 const{deploy}=make(SKADI,{elite:0,rank:4}),u=deploy();assert.ok(!u.findBuff('skadi:deck'));near(u.s.atk,u.base.atk);
});
test('Skadi native flat ten-second redeploy reduction remains distinct from SilverAsh percentage deck effect',()=>{
 const{b,deploy}=make(SKADI,{},[SILVER]),u=deploy();near(u.base.respawnTime,60);near(u.s.redeployMul,.9);b.retreat(u);near(b.bench[SKADI].readyAt-b.time,54);
 const{b:alone,deploy:d}=make(SKADI),a=d();alone.retreat(a);near(alone.bench[SKADI].readyAt-alone.time,60);
});
test('Skadi source opening adds begin once, resets after target loss/control, and preserves uncapped ASPD',()=>{
 const{b,deploy}=make(SKADI),u=deploy(),e=enemy(b);shot(b,u,e);let at=b._evq.filter(v=>v[0]==='atk').at(-1);assert.deepEqual(at[4].animation,{begin:'Attack_Begin',loop:'Attack',beginDuration:.167});near(at[4].windup,1.034);
 advance(b,1);near(e.hp,100000);advance(b,.1);near(100000-e.hp,u.s.atk);shot(b,u,e);at=b._evq.filter(v=>v[0]==='atk').at(-1);assert.equal(at[4].animation,'Attack');near(at[4].windup,.867);
 advance(b,.95);move(b,e,0,0);advance(b,.1);assert.equal(u.mem.skadiOpening,true);move(b,e,3,5);b.addBuff(u,{key:'test:ASPD',mods:{aspd:200}});near(u.profile.windup(b,u,[e]),1.034/3);
 b.applyStatus(u,'stun',{duration:.1,source:e});advance(b,.15);assert.equal(u.mem.skadiOpening,true);
});
test('Skadi natural combat loop remains single-target and refuses flying targets',()=>{
 const{b,deploy}=make(SKADI),u=deploy(),a=enemy(b),z=enemy(b,{c:5.3}),air=enemy(b,{c:4.5,fly:true});u.atkCd=0;advance(b,3.6);
 const touched=[a,z].filter(e=>e.hp<100000);assert.equal(touched.length,1);assert.ok(u.stats.attacks>=2);near(air.hp,100000);
});
test('Skadi S1 all selected coefficients and original35-second duration clean up',()=>{
 for(const rank of [1,7,10]){const{b,deploy}=make(SKADI,{rank}),u=deploy(),atk=u.s.atk,aspd=u.s.aspd;cast(u);near(u.s.atk,u.base.atk*(1+talent(u,'atk').atk+bb(SKADI,0,rank).atk));near(u.s.aspd,aspd+bb(SKADI,0,rank).attack_speed);
 advance(b,35.1);assert.equal(u.skill.active,false);near(u.s.atk,atk);near(u.s.aspd,aspd);}
});
test('Skadi S2 activates once on each deployment and ends at selected duration without manual reactivation',()=>{
 for(const rank of [1,7,10]){const{b,deploy}=make(SKADI,{skill:1,rank}),u=deploy();assert.equal(u.skill.active,true);assert.equal(u.skill.activations,1);near(u.s.atk,u.base.atk*(1+talent(u,'atk').atk+bb(SKADI,1,rank).atk));
 advance(b,bb(SKADI,1,rank).duration+.1);assert.equal(u.skill.active,false);near(u.s.atk,u.base.atk*(1+talent(u,'atk').atk));assert.equal(u.skill.activate('test'),false);
 b.retreat(u);advance(b,75);const v=deploy();assert.equal(v.skill.active,true);assert.equal(v.skill.activations,1);}
});
test('Skadi S3 applies and removes source ATK/DEF/MAXHP percentages at all selected ranks',()=>{
 for(const rank of [1,7,10]){const{b,deploy}=make(SKADI,{skill:2,rank}),u=deploy(),atk=u.s.atk,def=u.s.def,hp=u.s.maxHp;cast(u);const s=bb(SKADI,2,rank);near(u.s.atk,u.base.atk*(1+talent(u,'atk').atk+s.atk));near(u.s.def,def*(1+s.def));near(u.s.maxHp,hp*(1+s.max_hp));near(u.skill.timeLeft,data.operators[SKADI].skills[2].levels[rank-1].duration);
 u.skill.end('test');near(u.s.atk,atk);near(u.s.def,def);near(u.s.maxHp,hp);assert.equal(u.s.blockCnt,1);}
});
test('SilverAsh redeploy deck effect includes source, outsiders and bench while self ATK stays selected',()=>{
 const{b,deploy}=make(SILVER,{},['char_208_melan']),u=deploy(),other=deploy(3,6,'RIGHT','char_208_melan');near(u.s.atk,u.base.atk*(1+talent(u,'atk').atk));near(u.base.respawnTime,70);near(u.s.redeployMul,.9);near(other.s.redeployMul,.9);
 b.retreat(u);near(b.bench[SILVER].readyAt-b.time,63);assert.ok(other.findBuff('silverash:deck'));b.retreat(other);near(b.bench.char_208_melan.readyAt-b.time,other.base.respawnTime*.9);
 const again=make(SILVER,{},['char_208_melan']),a=again.deploy(3,4,'RIGHT','char_208_melan');near(a.s.redeployMul,.9);
});
test('SilverAsh potential percentage redeploy does not become a flat stat and absent E0 talent adds no deck effect',()=>{
 for(const potential of [1,3]){const{deploy}=make(SILVER,{potential}),u=deploy();near(u.base.respawnTime,70+(potential>=3?-4:0));near(u.s.redeployMul,1+talent(u,'respawn_time').respawn_time);}
 const{deploy}=make(SILVER,{elite:0,rank:4}),u=deploy();near(u.s.atk,u.base.atk);near(u.s.redeployMul,1);assert.ok(!u.findBuff('silverash:deck'));
});
test('SilverAsh normal ranged80% and blocked full damage retain actual source hit origins',()=>{
 const{b,deploy}=make(SILVER),u=deploy(),e=enemy(b);const origins=[];b.on('damaged',c=>{if(c.source===u)origins.push(c.dmg.applyWay);});shot(b,u,e);advance(b,.55);near(e.hp,100000);advance(b,.25);near(100000-e.hp,u.s.atk*.8);assert.deepEqual(origins,['ranged']);
 e.hp=100000;block(b,u,e);shot(b,u,e);advance(b,.8);near(100000-e.hp,u.s.atk);assert.deepEqual(origins,['ranged','melee']);
});
test('SilverAsh fixed source .22 flight survives source retreat and is independent of range distance',()=>{
 for(const c of [5,6]){const{b,deploy}=make(SILVER),u=deploy(),e=enemy(b,{c});shot(b,u,e);advance(b,.55);assert.ok(b.projectiles.list.length>0);near(e.hp,100000);b.retreat(u);advance(b,.25);near(100000-e.hp,u.s.atk*.8);}
});
test('SilverAsh source normal animation cap1.1 and S1 uncapped release remain distinct',()=>{
 const{b,deploy}=make(SILVER),u=deploy(),e=enemy(b);b.addBuff(u,{key:'test:ASPD',mods:{aspd:200}});near(u.profile.windup(b,u,[e]),.5/1.1);block(b,u,e);near(u.profile.windup(b,u,[e]),.733/1.1);cast(u);near(effectiveProfile(u).windup(b,u,[e]),.5/3);
});
test('SilverAsh S1 uses full selected scaling for ranged and blocked targets without normal trait penalty',()=>{
 for(const rank of [1,7,10])for(const blocked of [false,true]){const{b,deploy}=make(SILVER,{rank}),u=deploy(),e=enemy(b,{def:100});if(blocked)block(b,u,e);cast(u);shot(b,u,e);advance(b,.8);
 near(100000-e.hp,u.s.atk*bb(SILVER,0,rank).atk_scale-100);assert.equal(u.skill.active,false);near(u.skill.spTotal,0);}
});
test('SilverAsh S1 refunds only a target dead before emission and retains charge when brief control prevents firing',()=>{
 const{b,deploy}=make(SILVER),u=deploy(),e=enemy(b);cast(u);shot(b,u,e);advance(b,.2);b.kill(e);advance(b,.4);assert.equal(u.skill.active,false);assert.equal(u.skill.charges,1);
 const second=make(SILVER),a=second.deploy(),z=enemy(second.b);cast(a);shot(second.b,a,z);advance(second.b,.55);second.b.kill(z);advance(second.b,.25);near(a.skill.spTotal,0);
 const third=make(SILVER),v=third.deploy(),target=enemy(third.b);cast(v);shot(third.b,v,target);third.b.applyStatus(v,'stun',{duration:.1,source:target});advance(third.b,.7);assert.equal(v.skill.pending,true);near(target.hp,100000);
});
test('SilverAsh E2 reveal uses current range, includes flying and target-free enemies, preserves foreign reveal ownership',()=>{
 const{b,deploy}=make(SILVER,{skill:1}),u=deploy(),a=enemy(b),air=enemy(b,{c:6,fly:true}),far=enemy(b,{r:0,c:0});b.addBuff(a,{key:'test:stealth',flags:{stealth:true}});b.addBuff(air,{key:'test:free',flags:{untargetable:true,stealth:true}});advance(b,.1);assert.equal(a.s.flags.reveal,true);assert.equal(air.s.flags.reveal,true);assert.ok(!far.s.flags.reveal);
 b.addBuff(a,{key:'test:other-reveal',flags:{reveal:true}});cast(u);advance(b,.1);assert.ok(!air.findBuff(`silverash:reveal:${u.id}`));u.skill.end('manual');advance(b,.1);assert.ok(air.findBuff(`silverash:reveal:${u.id}`));
 move(b,a,0,0);advance(b,.1);assert.ok(!a.findBuff(`silverash:reveal:${u.id}`));assert.equal(a.s.flags.reveal,true);b.retreat(u);assert.ok(!air.findBuff(`silverash:reveal:${u.id}`));assert.equal(a.s.flags.reveal,true);
});
test('SilverAsh reveal E1 gate and death cleanup retain enemy stealth itself',()=>{
 const{b,deploy}=make(SILVER,{elite:1,rank:7}),u=deploy(),e=enemy(b);b.addBuff(e,{key:'test:stealth',flags:{stealth:true}});advance(b,.1);assert.ok(!e.s.flags.reveal);
 const second=make(SILVER),a=second.deploy(),z=enemy(second.b);second.b.addBuff(z,{key:'test:stealth',flags:{stealth:true}});advance(second.b,.1);assert.equal(z.s.flags.reveal,true);second.b.kill(a);assert.ok(!z.s.flags.reveal);assert.equal(z.s.flags.stealth,true);
});
test('SilverAsh S2 toggle changes ground-only range, full melee damage, selected defense and max-HP regeneration',()=>{
 for(const rank of [1,7,10]){const{b,deploy}=make(SILVER,{skill:1,rank}),u=deploy(),e=enemy(b),air=enemy(b,{c:5.3,fly:true});const armor=u.s.def;wounded(u);const hp=u.hp;cast(u);near(u.s.def,armor*(1+bb(SILVER,1,rank).def));assert.ok(!acquireTargets(b,u,effectiveProfile(u)).includes(air));assert.ok(acquireTargets(b,u,effectiveProfile(u)).includes(e));shot(b,u,e);advance(b,1);near(100000-e.hp,u.s.atk);near(u.hp-hp,u.s.maxHp*bb(SILVER,1,rank).hp_recovery_per_sec_by_max_hp_ratio,2);
 u.skill.end('manual');advance(b,.1);near(u.s.def,armor);const h=u.hp;advance(b,.5);near(u.hp,h);assert.ok(b.enemiesInKeys(u.rangeKeys,u,effectiveProfile(u)).includes(air));}
});
test('SilverAsh S2 manual cancellation works through actual battle activation API and recharges five SP',()=>{
 const{b,deploy}=make(SILVER,{skill:1}),u=deploy();u.skill.setSpTotal(5);assert.equal(b.activateOperator(u.defId),true);assert.equal(u.skill.active,true);assert.equal(b.activateOperator(u.defId),true);assert.equal(u.skill.active,false);advance(b,5.1);assert.equal(u.skill.ready,true);
});
test('SilverAsh S3 final DEF multiplier composes with outside percentage while source cap varies by rank',()=>{
 for(const rank of [1,7,10]){const{b,deploy}=make(SILVER,{skill:2,rank}),u=deploy();b.addBuff(u,{key:'test:DEF',mods:{defPct:1}});const base=u.s.def;cast(u);near(u.s.def,base*.3);near(u.s.atk,u.base.atk*(1+talent(u,'atk').atk+bb(SILVER,2,rank).atk));near(effectiveProfile(u).maxTargets,bb(SILVER,2,rank)['attack@max_target']);u.skill.end('test');near(u.s.def,base);}
});
test('SilverAsh S3 naturally strikes at most six ground/air targets across extended range and restores range afterward',()=>{
 const{b,deploy}=make(SILVER,{skill:2}),u=deploy(),es=Array.from({length:7},(_,i)=>enemy(b,{c:5+i*.15,fly:i%2===1})),far=enemy(b,{r:3,c:7});cast(u);assert.ok(b.enemiesInKeys(u.rangeKeys,u,effectiveProfile(u)).includes(far));u.atkCd=0;advance(b,.6);assert.equal([...es,far].filter(e=>e.hp<100000).length,6);
 for(const e of es.filter(e=>e.hp<100000))near(100000-e.hp,u.s.atk);u.skill.end('test');assert.ok(!acquireTargets(b,u,effectiveProfile(u)).includes(far));
});
test('Hellagur trait self-heals selected promotion value per output and rejects external heals',()=>{
 for(const elite of [0,1,2]){const{b,deploy}=make(HELL,{elite,rank:elite<2?4:10}),u=deploy(),e=enemy(b);wounded(u);const hp=u.hp;shot(b,u,e);advance(b,.5);near(u.hp-hp,u.def.traitBb.value+(elite===2?talent(u,'hp_recovery_per_sec').hp_recovery_per_sec*.5:0),2);near(b.heal(e,u,100),0);}
});
test('Hellagur HP-to-ASPD samples every .25s, clamps at selected minimum ratio, and cannot duplicate generic tenacity',()=>{
 for(const elite of [0,1,2]){const{b,deploy}=make(HELL,{elite,rank:elite<2?4:10}),u=deploy(),e=enemy(b);block(b,u,e);const t=talent(u,'min_attack_speed'),base=u.base.aspd;u.hp=u.s.maxHp*.7;advance(b,.3);near(u.s.aspd,base+t.min_attack_speed*.3/(1-t.min_hp_ratio));u.hp=u.s.maxHp*.1;advance(b,.3);near(u.s.aspd,base+t.min_attack_speed);u.hp=u.s.maxHp;advance(b,.3);near(u.s.aspd,base);assert.equal(u.buffs.filter(v=>v.key==='hellagur:tenacity').length,1);}
});
test('Hellagur E2 no-block recovery follows actual live blockers and upgraded potential',()=>{
 for(const potential of [1,5]){const{b,deploy}=make(HELL,{potential}),u=deploy(),e=enemy(b);wounded(u);let hp=u.hp;advance(b,1);near(u.hp-hp,talent(u,'hp_recovery_per_sec').hp_recovery_per_sec,2);block(b,u,e);hp=u.hp;advance(b,1);near(u.hp,hp);b.kill(e);advance(b,.1);hp=u.hp;advance(b,1);near(u.hp-hp,talent(u,'hp_recovery_per_sec').hp_recovery_per_sec,2);}
});
test('Hellagur self-healing bypasses HealFree but cancelled output/dodge yields no receipt',()=>{
 const{b,deploy}=make(HELL),u=deploy(),e=enemy(b);block(b,u,e);wounded(u);b.addBuff(u,{key:'test:healFree',flags:{healFree:true}});const hp=u.hp;shot(b,u,e);advance(b,.7);near(u.hp-hp,u.def.traitBb.value);
 b.addBuff(e,{key:'test:dodge',mods:{dodgePhys:1}});const h=u.hp;shot(b,u,e);advance(b,.7);near(u.hp,h);
});
test('Hellagur S1 keeps two independently armored source hits and two self-heals after instant skill ends',()=>{
 for(const rank of [1,7,10]){const{b,deploy}=make(HELL,{rank}),u=deploy(),e=enemy(b,{def:100});block(b,u,e);wounded(u);const hp=u.hp,atk=u.s.atk;cast(u);shot(b,u,e);advance(b,.62);assert.equal(u.skill.active,false);near(100000-e.hp,atk*bb(HELL,0,rank).atk_scale-100);near(u.hp-hp,u.def.traitBb.value);advance(b,.15);near(100000-e.hp,2*(atk*bb(HELL,0,rank).atk_scale-100));near(u.hp-hp,2*u.def.traitBb.value);near(u.skill.spTotal,0);}
});
test('Hellagur S1 second event retains original target and cancels on brief control, death or retreat',()=>{
 for(const mode of ['control','death','retreat']){const{b,deploy}=make(HELL),u=deploy(),e=enemy(b);block(b,u,e);cast(u);shot(b,u,e);advance(b,.6);const damage=100000-e.hp;if(mode==='control')b.applyStatus(u,'stun',{duration:.03,source:e});else if(mode==='death')b.kill(e);else b.retreat(u);advance(b,.2);if(mode!=='death')near(100000-e.hp,damage);}
 const{b,deploy}=make(HELL),u=deploy(),e=enemy(b),z=enemy(b,{c:5.3});block(b,u,e);cast(u);shot(b,u,e);advance(b,.6);move(b,e,0,0);advance(b,.2);near(z.hp,100000);
});
test('Hellagur second strike retains a sub-frame control interruption after instant skill end',()=>{
 const{b,deploy}=make(HELL),u=deploy(),e=enemy(b);block(b,u,e);cast(u);shot(b,u,e);advance(b,.6);const hp=e.hp;
 b.applyStatus(u,'stun',{duration:.01});advance(b,.2);assert.equal(Boolean(u.s.flags.stun),false);near(e.hp,hp);
});
test('Hellagur S2 selected ATK and physical dodge do not dodge Arts, with independent double-hit mitigation',()=>{
 for(const rank of [1,7,10]){const{b,deploy}=make(HELL,{skill:1,rank}),u=deploy(),e=enemy(b,{def:100});block(b,u,e);cast(u);near(u.s.atk,u.base.atk*(1+bb(HELL,1,rank).atk));const atk=u.s.atk;shot(b,u,e);advance(b,.8);near(100000-e.hp,2*(atk-100));
 const rng=()=>0;rng.int=()=>0;b.rng=rng;wounded(u);const hp=u.hp;b.dealDamage(e,u,{amount:u.s.def+100,type:'phys',isAttack:true});near(u.hp,hp);b.dealDamage(e,u,{amount:100,type:'arts',isAttack:true});near(u.hp,hp-100);u.skill.end('test');near(u.s.atk,u.base.atk);near(u.s.dodgePhys,0);}
});
test('Hellagur S3 native begin/loop events and mastery front extension acquire three ground targets',()=>{
 for(const rank of [1,7,10]){const{b,deploy}=make(HELL,{skill:2,rank}),u=deploy(),front=enemy(b,{c:rank===10?7:6}),z=enemy(b,{c:5}),a=enemy(b,{c:5.1}),extra=enemy(b,{r:0,c:0}),air=enemy(b,{c:4.5,fly:true});cast(u);const p=effectiveProfile(u),targets=acquireTargets(b,u,p);assert.equal(targets.length,3);assert.ok(targets.includes(front));assert.ok(!targets.includes(air));
 shot(b,u,front);let at=b._evq.filter(v=>v[0]==='atk').at(-1);assert.deepEqual(at[4].animation,{begin:'Skill_3_Begin',loop:'Skill_3_Loop',beginDuration:.2});near(at[4].windup,.533);advance(b,.6);near(100000-front.hp,u.s.atk);shot(b,u,z);at=b._evq.filter(v=>v[0]==='atk').at(-1);assert.equal(at[4].animation,'Skill_3_Loop');near(at[4].windup,.333);advance(b,.4);u.skill.end('test');assert.ok(!acquireTargets(b,u,effectiveProfile(u)).includes(front));assert.ok(a.hp<100000);near(extra.hp,100000);near(air.hp,100000);}
});
test('Hellagur source selectTargetTiming CAST reselects an enemy entering during normal windup',()=>{
 const{b,deploy}=make(HELL),u=deploy(),e=enemy(b),z=enemy(b,{r:0,c:0});shot(b,u,e);move(b,e,0,1);move(b,z,3,5);advance(b,.5);near(e.hp,100000);near(100000-z.hp,u.s.atk);
});
test('Hellagur natural double attacks produce one shared attack identity with two damage receipts',()=>{
 const{b,deploy}=make(HELL,{skill:1}),u=deploy(),e=enemy(b);block(b,u,e);cast(u);const ids=[];b.on('damaged',c=>{if(c.source===u)ids.push(c.dmg.attackId);});u.atkCd=0;advance(b,.8);assert.equal(ids.length,2);assert.equal(ids[0],ids[1]);near(100000-e.hp,2*u.s.atk);
});

test('Skadi and SilverAsh original deck effects work from actual maxed support cards without deployment',()=>{
 for(const supportId of[SKADI,SILVER]){const allyId=supportId===SKADI?'char_143_ghost':'char_208_melan';const{b,deploy}=make(allyId,{},[],{id:supportId,skillId:configs[supportId].skillIds[0]}),u=deploy();assert.equal(b.bench[supportId].unit,null);if(supportId===SKADI){assert.ok(u.tags.has('abyssal'));near(u.s.atk,u.base.atk*(1+.16));}else near(u.s.redeployMul,.88);}
});
