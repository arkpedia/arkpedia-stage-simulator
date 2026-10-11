// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import evidence from '../data/arkpedia-kaltsit-prefabs.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {summonRecordFor,summonCardId,summonUnitId} from '../shared/arkpedia/summons.js';
import {deployRegularSummon,retreatRegularSummon,regularSummonCards,summonPlacementError} from '../server/sim/content/arkpedia-summons.js';
import {effectiveProfile,acquireTargets} from '../server/sim/ai.js';
import {skillSourceFor,skillHud} from '../shared/arkpedia/skill-hud.js';
import {isHpLoss} from '../server/sim/damage.js';
const ID='char_003_kalts',TOKEN='token_10002_kalts_mon3tr',FAN='char_123_fang',BEA='char_122_beagle',HIB='char_120_hibisc';
const near=(a,e,t=1e-5)=>assert.ok(Math.abs(a-e)<t,`${a} != ${e}`);
const advance=(b,s)=>{for(let i=0;i<Math.round(s/b.dt);i++)b.step();assert.deepEqual(b.errors,[]);};
function make({skill=0,rank=10,elite=2,level=null,potential=1,trust=0,dir='RIGHT',others=[],defer=false}={}){
 const source=structuredClone(data),o=source.operators[ID];assert.ok(o,'Reviewed Kaltsit snapshot required');source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;
 const build={...defaultBuild(o),elite,level:level??o.phases[elite].maxLevel,potential,trust,skillId:o.skills[skill].id,skillRank:rank};
 const b=new StandardBattle(source,{operators:[build,...others.map(id=>defaultBuild(source.operators[id]))]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
 const deploy=(id=ID,r=1,c=4)=>{b.addDp('arkpedia',99);const u=b.deployOperator(id,r,c,dir);assert.ok(u);u.atkCd=1000;return u;};return{b,u:defer?null:deploy(),build,deploy};
}
const bb=(skill,rank=10)=>Object.fromEntries(data.operators[ID].skills[skill].levels[rank-1].blackboard.map(x=>[x.key,x.value]));
const mon=(b,r=2,c=5,dir='RIGHT')=>{const t=deployRegularSummon(b,summonCardId(ID),r,c,dir);assert.ok(t);t.atkCd=1000;return t;};
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(ID),true);u.atkCd=1000;}
function enemy(b,{hp=100000,x=6,y=2,def=0,res=0,fly=false}={}){const e=b.spawnEnemy('enemy_1007_slime',{pos:[0,0]});e.x=x;e.y=y;e.base.maxHp=100000;e.base.def=def;e.base.res=res;e.base.moveSpeed=0;if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=hp;b.addBuff(e,{key:'pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;}
const shot=(b,u,t,s=.9)=>{b.forceAttack(u,[t]);u.atkCd=1000;advance(b,s);};
const row=(rs,id)=>rs.find(r=>r.pathId===id).data;

test('all30 original skills, six verified bundles and exact owner/token animator bytes are retained',()=>{
 assert.equal(evidence.frameParity,false);assert.deepEqual(evidence.enabledOperators,[ID]);assert.equal(evidence.source.bundles.length,6);for(const r of evidence.source.bundles)assert.match(r.sha256,/^[a-f0-9]{64}$/);
 for(let i=1;i<=3;i++)assert.equal(evidence.tables[ID].skillLevels[`skchr_kalts_${i}`].length,10);
 for(const face of['Front','Back']){near(evidence.models[ID][face].hits.Attack[0],.433);assert.equal(evidence.originalFacingBindings[ID][face].sha256,evidence.models[ID][face].sha256);}
 const binding=evidence.originalTokenBinding;assert.equal(binding.nativeSingleSkeleton,true);assert.equal(binding.sha256,evidence.models[TOKEN].files[TOKEN+'.skel'].sha256);for(const[clip,time]of[['Attack',.233],['Skill',.367],['Skill_2',.667]])near(evidence.models[TOKEN].hits[clip][0],time);
 assert.ok(evidence.verificationLimits.some(x=>x.includes('initial-reached')));assert.ok(evidence.verificationLimits.some(x=>x.includes('undeadable')));
});
test('all skills/all ranks suppress inherited medic/talent behavior and keep source healing enabled',()=>{
 for(let skill=0;skill<3;skill++)for(let rank=1;rank<=10;rank++){const{b,u}=make({skill,rank});assert.equal(u.skill.id,`skchr_kalts_${skill+1}`);assert.equal(u.skill.kind,'duration');assert.equal(u.profile.install,null);assert.equal(u.profile.dmgType,'heal');assert.equal(u.s.atk,u.base.atk);assert.equal(u.s.def,u.base.def);assert.deepEqual(b.errors,[]);}
});
test('Mon3tr source exists from E0 with stock1/ground-facing/one-slot/cost10 and no arbitrary owner-range deployment cap',()=>{
 const{b,u}=make({elite:0,rank:4});assert.equal(regularSummonCards(b).length,1);assert.equal(regularSummonCards(b)[0].stock,1);assert.equal(summonPlacementError(b,summonCardId(ID),1,5),'Choose a melee tile.');const dp=b.dp,slots=b.deployedSlots(),t=mon(b,3,3);near(dp-b.dp,10);assert.equal(b.deployedSlots(),slots+1);assert.equal(t.ownerUnit,u);assert.equal(t.base.blockCnt,3);assert.equal(regularSummonCards(b)[0].stock,0);assert.equal(summonPlacementError(b,summonCardId(ID),3,4),'No summons remaining.');
});
test('token own phase/level keyframes never inherit parent trust/potential ATK/HP/DEF',()=>{
 for(const elite of[0,1,2])for(const level of[1,data.operators[ID].phases[elite].maxLevel])for(const potential of[1,6]){const{b,u,build}=make({elite,level,potential,trust:200,rank:[4,7,10][elite]}),t=mon(b),s=data.tokens[TOKEN].phases[elite],lo=s.attributesKeyFrames[0],hi=s.attributesKeyFrames.at(-1),r=(level-lo.level)/(hi.level-lo.level);for(const key of['atk','def','maxHp'])near(t.base[key],Math.round(lo.data[key]+(hi.data[key]-lo.data[key])*r));near(t.base.respawnTime,[35,30,25][elite]);assert.equal(t.def.skill,null);assert.notEqual(t.base.atk,u.base.atk);assert.equal(build.potential,potential);}
});
test('source token records reject missing/fabricated/locked builds instead of copying generic owner stats',()=>{
 const{build}=make(),tokens=structuredClone(data.tokens);delete tokens[TOKEN];assert.throws(()=>summonRecordFor(ID,build,tokens),/Missing reviewed/);assert.throws(()=>summonRecordFor(ID,{...build,elite:3},data.tokens),/promotion/);assert.throws(()=>summonRecordFor(ID,{...build,level:91},data.tokens),/promotion/);
});
test('DEF outside owner range uses final scalar0 and restores unchanged source/foreign percentages on reentry',()=>{
 const{b,u}=make(),t=mon(b);b.addBuff(t,{key:'foreign',mods:{defPct:.5,defFlat:25}});const inside=(t.base.def+25)*1.5;near(t.s.def,inside);t.x=10;advance(b,.1);near(t.s.def,0);b.addBuff(t,{key:'inspire',mods:{defFinalFlat:30}});near(t.s.def,30);t.x=5;advance(b,.1);near(t.s.def,inside+30);u.dir='LEFT';b._refreshRange(u);advance(b,.1);near(t.s.def,30);
});
test('own HealFree exception permits only Kaltsit while external noHeal/isolation still forbid',()=>{
 const{b,u,deploy}=make({others:[HIB]}),h=deploy(HIB,1,6),t=mon(b);t.hp-=1000;assert.equal(t.s.flags.healFree,true);assert.equal(!!t.s.flags.noHeal,false);near(b.heal(h,t,100),0);assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[t]);assert.deepEqual(acquireTargets(b,h,effectiveProfile(h)),[]);shot(b,u,t);near(t.s.maxHp-t.hp,1000-u.s.atk);
 for(const flag of['noHeal','isolated','untargetable']){b.addBuff(t,{key:'deny',flags:{[flag]:true}});assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[]);const hp=t.hp;shot(b,u,t);near(t.hp,hp);b.removeBuff(t,'deny');}
});
test('self and own Mon3tr heal priority precedes lower-HP ordinary ally, then lowest ratio within priority pair',()=>{
 const{b,u,deploy}=make({others:[FAN]}),a=deploy(FAN,2,6),t=mon(b);a.hp=1;u.hp=u.s.maxHp*.9;t.hp=t.s.maxHp*.8;assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[t]);t.hp=t.s.maxHp;assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[u]);u.hp=u.s.maxHp;assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[a]);
});
test('unowned HealFree token, devices and source-free/hidden recipients do not gain the owned exception',()=>{
 const{b,u}=make(),t=mon(b);t.hp-=100;for(const mutate of[t=>{t.ownerUnit=null;},t=>{t.kind='device';},t=>{t.hidden=true;}]){const own=t.ownerUnit,kind=t.kind;mutate(t);assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[]);const hp=t.hp;shot(b,u,t);near(t.hp,hp);t.ownerUnit=own;t.kind=kind;t.hidden=false;}
});
test('normal owner healing releases at literal .433 then original speed5, CAST selection follows entrants',()=>{
 const{b,u,deploy}=make({others:[FAN,BEA]}),a=deploy(FAN,2,6),z=deploy(BEA,2,7);a.hp=100;z.hp=200;const atk=u.s.atk;b.forceAttack(u,[a]);advance(b,.2);a.x=10;z.x=5;advance(b,.2);near(z.hp,200);advance(b,.1);near(z.hp,200);advance(b,.45);near(a.hp,100);near(z.hp,200+atk);
});
test('owner cap1 ASPD windup holds under foreign speed while S2 still shortens ordinary interval',()=>{
 const{b,u}=make({skill:1});mon(b);b.addBuff(u,{key:'fast',mods:{aspd:100}});cast(b,u);near(effectiveProfile(u).windup(b,u),.433);near(u.s.aspd,300);near(u.s.interval,u.base.bat/3);
});
test('source sub-dt control cancels unborn owner heal but emitted healing survives owner withdrawal',()=>{
 const{b,u}=make(),t=mon(b);t.hp-=1000;b.forceAttack(u,[t]);advance(b,.2);b.applyStatus(u,'stun',{duration:.001});advance(b,.7);near(t.s.maxHp-t.hp,1000);b.forceAttack(u,[t]);advance(b,.5);assert.ok(b.projectiles.list.length);const hp=t.hp;b.retreatOperator(ID);assert.equal(t.alive,false);advance(b,.6);near(t.hp,hp); // removed target cannot be healed
 const q=make({others:[FAN]}),a=q.deploy(FAN,2,6);a.hp=100;const atk=q.u.s.atk;q.b.forceAttack(q.u,[a]);advance(q.b,.5);q.b.retreatOperator(ID);advance(q.b,.7);near(a.hp,100+atk);
});
test('retained heal projectile rejects target restrictions introduced after emission',()=>{
 for(const flag of['isolated','untargetable','noHeal','healFree']){const{b,u,deploy}=make({others:[FAN]}),a=deploy(FAN,2,7);a.hp=100;b.forceAttack(u,[a]);advance(b,.5);b.addBuff(a,{key:'deny',flags:{[flag]:true}});advance(b,1);near(a.hp,100);}
});
test('normal Mon3tr is single-target physical at original .233 and cannot hit airborne enemies',()=>{
 const{b}=make(),t=mon(b),a=enemy(b,{def:100}),z=enemy(b,{x:6.1,y:2});b.forceAttack(t,[a]);advance(b,.2);near(a.hp,100000);advance(b,.1);near(100000-a.hp,Math.max(t.s.atk-100,t.s.atk*.05));near(z.hp,100000);const f=enemy(b,{fly:true,x:5,y:2});assert.ok(!acquireTargets(b,t,effectiveProfile(t)).includes(f));
});
test('normal token CAST windup reacquires range entrants and excludes departed/hidden/free targets',()=>{
 for(const kind of['leave','hidden','free']){const{b}=make(),t=mon(b),a=enemy(b),z=enemy(b,{x:8,y:2});b.forceAttack(t,[a]);advance(b,.1);if(kind==='leave')a.x=9;if(kind==='hidden')a.hidden=true;if(kind==='free')b.addBuff(a,{key:'free',flags:{untargetable:true}});z.x=6;b._buildEnemyIndex();advance(b,.3);near(a.hp,100000);assert.ok(z.hp<100000);}
});
test('S1 works without Mon3tr while S2/S3 require valid deployed token and hold selected SP',()=>{
 const first=make();cast(first.b,first.u);assert.equal(first.u.skill.active,true);
 for(const skill of[1,2]){const{b,u}=make({skill});u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(ID),false);near(u.skill.spTotal,u.skill.spCost);mon(b);cast(b,u);assert.equal(u.skill.active,true);}
});
test('binding SP checker delays first .1 then clears all charges/stops time and gifted SP until token appears',()=>{
 const{b,u}=make({skill:1});u.skill.setSpTotal(10);advance(b,.067);assert.ok(u.skill.spTotal>0);assert.equal(!!u.s.flags.noSp,false);advance(b,.067);near(u.skill.spTotal,0);assert.equal(u.s.flags.noSp,true);u.skill.gainSp(20,'gift');advance(b,2);near(u.skill.spTotal,0);mon(b);assert.equal(u.s.flags.noSp,true);advance(b,.1);assert.equal(!!u.s.flags.noSp,false);advance(b,1);assert.ok(u.skill.spTotal>.9);
});
test('defeated or withdrawn token ends bound skill on next owner .1 clock and clears SP without refund',()=>{
 for(const reason of['kill','retreat'])for(const skill of[1,2]){const{b,u}=make({skill}),t=mon(b);cast(b,u);advance(b,.133);if(reason==='kill')b.kill(t);else retreatRegularSummon(b,summonUnitId(t));assert.equal(u.skill.active,true);advance(b,.1);assert.equal(u.skill.active,false);assert.equal(u.s.flags.noSp,true);near(u.skill.spTotal,0);}
});
test('every S1 rank gives exact own and owner-range Mon3tr DEF for selected duration',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u}=make({rank}),t=mon(b),v=bb(0,rank);cast(b,u);near(u.s.def,u.base.def*(1+v.def));near(t.s.def,t.base.def*(1+v['attack@def']));t.x=10;advance(b,.1);near(t.s.def,0);assert.equal(t.findBuff('kalts_s_1[token_eff]'),null);t.x=5;advance(b,.1);near(t.s.def,t.base.def*(1+v['attack@def']));advance(b,u.skill.duration+.1);near(u.s.def,u.base.def);near(t.s.def,t.base.def);}
});
test('S1 source physical BlockDamage cancels both melee/ranged before mitigation and never Arts/TRUE',()=>{
 const{b,u}=make();cast(b,u);b.rng=()=>0;const hp=u.hp;for(const applyWay of['melee','ranged'])b.dealDamage(null,u,{amount:u.s.def+100,type:'phys',applyWay,canDodge:false});near(u.hp,hp);b.dealDamage(null,u,{amount:100,type:'arts',canDodge:false});b.dealDamage(null,u,{amount:100,type:'true',canDodge:false});near(u.hp,hp-200);b.rng=()=>.99;b.dealDamage(null,u,{amount:u.s.def+100,type:'phys',canDodge:false});near(u.hp,hp-300);u.skill.end();b.rng=()=>0;b.dealDamage(null,u,{amount:u.s.def+100,type:'phys',canDodge:false});near(u.hp,hp-400);
});
test('S1 does not pass its physical block chance to Mon3tr',()=>{
 const{b,u}=make(),t=mon(b);cast(b,u);b.rng=()=>0;const hp=t.hp;b.dealDamage(null,t,{amount:t.s.def+100,type:'phys',canDodge:false});near(t.hp,hp-100);
});
test('all S2 ranks buff owner ASPD and global Mon3tr ATK, capped block-based multi melee at .367',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u}=make({skill:1,rank}),t=mon(b),v=bb(1,rank);cast(b,u);near(u.s.aspd,u.base.aspd+v.attack_speed);near(t.s.atk,t.base.atk*(1+v['attack@atk']));near(effectiveProfile(t).windup(b,t),.367);assert.equal(effectiveProfile(t).attackVisual(b,t),'Skill');assert.equal(effectiveProfile(t).maxTargetsByBlock,true);t.x=10;advance(b,.1);near(t.s.atk,t.base.atk*(1+v['attack@atk']));near(t.s.def,0);u.skill.end();near(t.s.atk,t.base.atk);near(u.s.aspd,u.base.aspd);assert.equal(effectiveProfile(t).attackVisual(b,t),'Attack');}
});
test('S2 source target limit follows current block capacity across unblocked victims and min1 at zero',()=>{
 const{b,u}=make({skill:1}),t=mon(b);cast(b,u);const es=Array.from({length:4},(_,i)=>enemy(b,{x:6+i*.01}));b._buildEnemyIndex();const targets=acquireTargets(b,t,effectiveProfile(t));assert.equal(t.blocking.length,0);assert.equal(targets.length,3);b.forceAttack(t,targets);advance(b,.45);assert.equal(es.filter(e=>e.hp<100000).length,3);b.addBuff(t,{key:'moreblock',mods:{blockCnt:1}});assert.equal(acquireTargets(b,t,effectiveProfile(t)).length,4);b.removeBuff(t,'moreblock');b.addBuff(t,{key:'zero',mods:{blockCntMul:0}});assert.equal(acquireTargets(b,t,effectiveProfile(t)).length,1);
});
test('S2 airborne restrictions and transient controls remain effective under source multiattack',()=>{
 const{b,u}=make({skill:1}),t=mon(b);cast(b,u);const e=enemy(b),f=enemy(b,{fly:true});assert.equal(acquireTargets(b,t,effectiveProfile(t)).includes(f),false);b.forceAttack(t,[e]);advance(b,.15);b.applyStatus(t,'stun',{duration:.001});advance(b,.5);near(e.hp,100000);
});
test('all S3 ranks use immediate ATK percent, DEF percent, TRUE single-target .667 literal Skill_2',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u}=make({skill:2,rank}),t=mon(b),v=bb(2,rank);cast(b,u);near(t.s.atk,t.base.atk*(1+v['attack@atk']));near(t.s.def,t.base.def*(1+v['attack@def']));assert.equal(effectiveProfile(t).dmgType,'true');assert.equal(effectiveProfile(t).attackVisual(b,t),'Skill_2');near(effectiveProfile(t).windup(b,t),.667);const e=enemy(b,{def:99999,res:100});b.forceAttack(t,[e]);advance(b,.6);near(e.hp,100000);advance(b,.167);near(100000-e.hp,t.base.atk*(1+v['attack@atk']));}
});
test('S3 ATK remaining ratio is sampled on immediate/1s native clock, preserving foreign percentages',()=>{
 const{b,u}=make({skill:2}),t=mon(b);b.addBuff(t,{key:'foreign',mods:{atkPct:.5}});cast(b,u);const v=bb(2);near(t.s.atk,t.base.atk*(1+.5+v['attack@atk']));advance(b,.7);near(t.s.atk,t.base.atk*(1+.5+v['attack@atk']));advance(b,.35);near(t.s.atk,t.base.atk*(1+.5+v['attack@atk']*19/20),t.base.atk*.01);advance(b,1);near(t.s.atk,t.base.atk*(1+.5+v['attack@atk']*18/20),t.base.atk*.01);
});
test('S3 retains global mode/ATK outside owner range while final DEF stays0, restoring on reentry',()=>{
 const{b,u}=make({skill:2}),t=mon(b);cast(b,u);t.x=10;advance(b,.1);assert.equal(effectiveProfile(t).dmgType,'true');near(t.s.def,0);assert.ok(t.s.atk>t.base.atk);t.x=5;advance(b,.1);near(t.s.def,t.base.def*3);
});
test('S3 no kill finish deals half MaxHP PURE NORMAL without hpLoss, damage modifiers or shields',()=>{
 const{b,u}=make({skill:2}),t=mon(b);cast(b,u);b.addBuff(t,{key:'shield',shield:100000,mods:{dmgTakenMul:0,flatDamageResistance:100000}});const hp=t.hp;let seen=null,hits=0;b.on('hit',ctx=>{if(ctx.target===t)hits++;});b.on('damaged',ctx=>{if(ctx.target===t&&ctx.dmg.tags.includes('kalts_s_3:finish'))seen=ctx;});u.skill.end();near(t.hp,hp-t.s.maxHp*.5);near(t.findBuff('shield').shield,100000);assert.equal(hits,0);assert.ok(seen);assert.equal(isHpLoss(seen.dmg),false);assert.equal(seen.dmg.type,'true');assert.equal(seen.dmg.isAttack,true);assert.equal(seen.dmg.noSp,false);assert.equal(seen.dmg.applyWay,'none');assert.equal(effectiveProfile(t).dmgType,'phys');
});
test('only genuine Mon3tr enemy kill during current S3 removes penalty, shield/dodge/unrelated kills do not',()=>{
 for(const kind of['own','other','absorbed','dodged']){const{b,u}=make({skill:2}),t=mon(b),e=enemy(b,{hp:1});cast(b,u);if(kind==='own')shot(b,t,e,.75);if(kind==='other')b.kill(e,u);if(kind==='absorbed'){b.addBuff(e,{key:'shield',shield:100000});shot(b,t,e,.75);}if(kind==='dodged'){b.addBuff(e,{key:'inv',flags:{invulnerable:true}});shot(b,t,e,.75);}const hp=t.hp;u.skill.end();near(hp-t.hp,kind==='own'?0:t.s.maxHp*.5);}
});
test('S3 resets no-kill marker each activation rather than carrying earlier kills',()=>{
 const{b,u}=make({skill:2}),t=mon(b),e=enemy(b,{hp:1});cast(b,u);shot(b,t,e,.75);u.skill.end();const hp=t.hp;cast(b,u);assert.ok(t.findBuff('kalts_s_3[no_kill_mark]'));u.skill.end();near(hp-t.hp,t.s.maxHp*.5);
});
test('switching to or from S2/S3 cancels the previous mode unborn strike without canceling emitted output',()=>{
 for(const skill of[1,2]){const{b,u}=make({skill}),t=mon(b),e=enemy(b);b.forceAttack(t,[e]);advance(b,.1);cast(b,u);advance(b,.3);near(e.hp,100000);b.forceAttack(t,[e]);advance(b,.1);u.skill.end();advance(b,.7);near(e.hp,100000);}
});
test('genuine defeat E2 emits retained expiry1s true blast+stun in exact x-4 including airborne',()=>{
 const{b}=make(),t=mon(b),e=enemy(b,{x:6,y:2}),f=enemy(b,{x:5,y:3,fly:true}),far=enemy(b,{x:7,y:2});b.kill(t);advance(b,.9);near(e.hp,100000);advance(b,.2);near(e.hp,98800);near(f.hp,98800);near(far.hp,100000);assert.equal(e.s.flags.stun,true);assert.equal(f.s.flags.stun,true);advance(b,3.1);assert.equal(e.s.flags.stun,false);
});
test('E1 has no death blast; E2 potential5 selects exact1400/3.5 native token talent',()=>{
 const low=make({elite:1,rank:7}),a=mon(low.b),e=enemy(low.b);low.b.kill(a);advance(low.b,1.2);near(e.hp,100000);
 const high=make({potential:5}),z=mon(high.b),f=enemy(high.b);high.b.kill(z);advance(high.b,1.2);near(f.hp,98600);advance(high.b,3.2);assert.equal(f.s.flags.stun,true);advance(high.b,.4);assert.equal(f.s.flags.stun,false);
});
test('death blast survives owner withdrawal but excludes disappeared/free/Sleep/invisible while allowing camouflage',()=>{
 const{b,u}=make(),t=mon(b),es=['hidden','untargetable','sleep','stealth','camou'].map((kind,i)=>{const e=enemy(b,{x:6,y:2});if(kind==='hidden')e.hidden=true;else b.addBuff(e,{key:'flag'+i,flags:{[kind]:true}});return e;});b.kill(t);b.retreatOperator(ID);advance(b,1.2);for(let i=0;i<4;i++)near(es[i].hp,100000);near(es[4].hp,98800);assert.equal(u.alive,false);
});
test('manual retreat/owner withdrawal emits no death blast and refunds only explicit half-token cost',()=>{
 for(const owner of[false,true]){const{b,u}=make(),t=mon(b),e=enemy(b),dp=b.dp;if(owner)b.retreatOperator(ID);else retreatRegularSummon(b,summonUnitId(t));assert.equal(t.alive,false);if(!owner)near(b.dp-dp,5);advance(b,1.2);near(e.hp,100000);assert.equal(e.s.flags.stun,false);if(owner)assert.equal(t.removeReason,'owner-removed');}
});
test('S3 owner withdrawal removes token without penalty/explosion while genuine penalty death does explode',()=>{
 const q=make({skill:2}),t=mon(q.b),e=enemy(q.b);cast(q.b,q.u);t.hp=100;q.b.retreatOperator(ID);assert.equal(t.removeReason,'owner-removed');advance(q.b,1.2);near(e.hp,100000);
 const p=make({skill:2}),z=mon(p.b),f=enemy(p.b);cast(p.b,p.u);z.hp=100;p.u.skill.end();assert.equal(z.removeReason,'killed');advance(p.b,1.2);near(f.hp,98800);
});
test('token removal starts source phase cooldown, restores exactly stock1 once and redeploys with full source HP',()=>{
 for(const elite of[0,1,2]){const{b}=make({elite,rank:[4,7,10][elite]}),t=mon(b);advance(b,40);b.kill(t);const state=regularSummonCards(b)[0];assert.equal(state.stock,1);near(state.readyAt,b.time+[35,30,25][elite]);b.kill(t);assert.equal(regularSummonCards(b)[0].stock,1);assert.equal(summonPlacementError(b,summonCardId(ID),2,5),'Summon is still redeploying.');advance(b,[35,30,25][elite]+.1);const fresh=mon(b);assert.notEqual(fresh,t);near(fresh.hp,fresh.s.maxHp);assert.equal(fresh.mem.kaltsitTrueMode,undefined);}
});
test('new owner born charges one card and cleanup cannot leak source buffs into next deployment',()=>{
 const{b,u}=make({skill:2}),t=mon(b);cast(b,u);b.retreatOperator(ID);advance(b,70.1);b.addDp('arkpedia',99);const fresh=b.deployOperator(ID,1,4,'RIGHT');fresh.atkCd=1000;assert.equal(regularSummonCards(b)[0].stock,1);const z=mon(b);assert.equal(z.ownerUnit,fresh);assert.equal(z.findBuff('kalts_s_3[ratio_atk]'),null);near(z.s.atk,z.base.atk);near(z.s.def,z.base.def);assert.equal(t.alive,false);
});
test('valid-token binding is structural and distinct from hidden aura/heal target eligibility',()=>{
 const{b,u}=make({skill:1}),t=mon(b);t.hidden=true;advance(b,.2);assert.equal(!!u.s.flags.noSp,false);u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(ID),true);assert.equal(t.findBuff('kalts_s_2[token_eff]'),null);advance(b,.2);assert.equal(u.skill.active,true);t.hidden=false;advance(b,.1);near(t.s.atk,t.base.atk*1.9);assert.deepEqual(b.errors,[]);
});
test('natural medic loop prioritizes wounded own token and heals only once per source interval',()=>{
 const{b,u,deploy}=make({others:[FAN]}),t=mon(b),a=deploy(FAN,2,6);t.hp-=3000;a.hp=100;u.atkCd=0;const times=[];b.on('heal',ctx=>{if(ctx.source===u&&ctx.target===t)times.push(b.time);});advance(b,6);assert.equal(times.length,2);near(times[1]-times[0],u.s.interval,b.dt+.001);near(a.hp,100);near(t.s.maxHp-t.hp,3000-u.s.atk*2);
});
test('natural S2 attack loop uses source capped multiattack and ASPD-independent token interval',()=>{
 const{b,u}=make({skill:1}),t=mon(b);cast(b,u);const es=Array.from({length:4},(_,i)=>enemy(b,{x:6+i*.01}));t.atkCd=0;const times=[];b.on('attack',ctx=>{if(ctx.attacker===t)times.push(b.time);});advance(b,4.8);assert.equal(times.length,3);for(let i=1;i<3;i++)near(times[i]-times[i-1],2,b.dt+.001);assert.equal(es.filter(e=>e.hp<100000).length,3);near(es.slice(0,3).reduce((v,e)=>v+100000-e.hp,0),t.s.atk*9);
});
test('owner noHeal has no special self exemption in original ordinary priority selection or emitted heal',()=>{
 const{b,u,deploy}=make({others:[FAN]}),a=deploy(FAN,2,6);u.hp=100;a.hp=500;b.addBuff(u,{key:'deny',flags:{noHeal:true}});assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[a]);shot(b,u,u);near(u.hp,100);assert.ok(a.hp>500);b.removeBuff(u,'deny');a.hp=a.s.maxHp;b.forceAttack(u,[u]);advance(b,.2);b.addBuff(u,{key:'deny',flags:{noHeal:true}});advance(b,.6);near(u.hp,100);
});

test('Mon3tr skill HUD and controls reference live owner without sharing runtime or receiving defensive SP',()=>{
 const{b,u}=make({skill:2}),t=mon(b);assert.equal(t.mem.skillOwner,u);assert.equal(skillSourceFor(t),u);assert.equal(t.skill.noSkill,true);assert.notEqual(t.skill,u.skill);u.skill.setSpTotal(u.skill.spCost);assert.equal(skillHud(skillSourceFor(t).skill).ready,true);near(skillHud(skillSourceFor(t).skill).fraction,1);b.dealDamage(null,t,{amount:100,type:'true',canDodge:false});near(t.skill.spTotal,0);assert.equal(b.activateOperator(skillSourceFor(t).defId),true);assert.equal(u.skill.active,true);assert.equal(effectiveProfile(t).dmgType,'true');b.retreatOperator(ID);assert.equal(t.alive,false);assert.equal(skillSourceFor(t),t);assert.equal(skillHud(skillSourceFor(t).skill),null);
});
