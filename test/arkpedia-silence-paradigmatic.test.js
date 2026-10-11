// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-silence-paradigmatic-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { summonCardId, summonUnitId, summonRecordFor } from '../shared/arkpedia/summons.js';
import { deployRegularSummon, retreatRegularSummon, regularSummonCards, summonPlacementError } from '../server/sim/content/arkpedia-summons.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { silenceSanctuaryValue, installSilenceParadigmatic } from '../server/sim/content/arkpedia-silence-paradigmatic.js';
const ID='char_1031_slent2',TOKEN='token_10029_slent2_protrb',FAN='char_123_fang',BEA='char_122_beagle',KRO='char_124_kroos',VUL='char_163_hpsts';
const near=(a,e,t=1e-5)=>assert.ok(Math.abs(a-e)<t,`${a} != ${e}`);
const advance=(b,s)=>{for(let i=0;i<Math.round(s/b.dt);i++)b.step();assert.deepEqual(b.errors,[]);};
function make({skill=0,rank=10,elite=2,potential=1,trust=0,dir='RIGHT',others=[],defer=false}={}){
 const source=structuredClone(data),o=source.operators[ID];assert.ok(o,'Reviewed Silence2 snapshot required');source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;
 const build={...defaultBuild(o),elite,level:o.phases[elite].maxLevel,potential,trust,skillId:o.skills[skill].id,skillRank:rank};
 const b=new StandardBattle(source,{operators:[build,...others.map(id=>defaultBuild(source.operators[id]))]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
 const deploy=(id=ID,r=1,c=4)=>{b.addDp('arkpedia',99);const a=b.deployOperator(id,r,c,dir);assert.ok(a,`${id} ${r},${c}`);a.atkCd=1000;return a;};return{b,u:defer?null:deploy(),deploy,build};
}
function wound(a,hp=100,max=100000){a.base.maxHp=max;a.markDirty();void a.s;a.hp=hp;}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);assert.equal(b.activateOperator(u.defId),true);u.atkCd=1000;}
function enemy(b,{hp=100000,x=5,y=1,res=0,fly=false}={}){const e=b.spawnEnemy('enemy_1007_slime',{pos:[y,x]});e.x=x;e.y=y;e.base.maxHp=100000;e.base.def=0;e.base.res=res;e.base.moveSpeed=0;if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=hp;b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._enemiesDirty=true;b._buildEnemyIndex();return e;}
const bb=(skill,rank=10)=>Object.fromEntries(data.operators[ID].skills[skill].levels[rank-1].blackboard.map(x=>[x.key,x.value]));
const sourceRow=(part,id)=>evidence[part][ID].find(r=>r.pathId===id).data;
const drone=(b,r=2,c=4)=>deployRegularSummon(b,summonCardId(ID),r,c);
const shot=(b,u,a,s=1)=>{b.forceAttack(u,[a]);u.atkCd=1000;advance(b,s);};
function mutePlumes(b,u){for(const a of b.allyUnits)b.addBuff(a,{key:'test:no-regeneration',mods:{hpRegenMul:0}});}

test('retains exact all-rank/source-template/facing/token evidence and honest native dispatch limits',()=>{
 assert.equal(evidence.frameParity,false);assert.deepEqual(evidence.enabledOperators,[ID]);assert.equal(evidence.source.bundles.length,6);
 for(const r of evidence.source.bundles)assert.match(r.sha256,/^[a-f0-9]{64}$/);
 for(const sid of['skchr_slent2_1','skchr_slent2_2','skchr_slent2_3'])assert.equal(evidence.tables[ID].skillLevels[sid].length,10);
 for(const face of['Front','Back']){assert.equal(evidence.originalFacingBindings[ID][face].sha256,evidence.models[ID][face].sha256);near(evidence.models[ID][face].hits.Attack[0],.667);near(evidence.models[ID][face].hits.Skill[0],.633);}
 assert.equal(evidence.originalTokenModels.models[TOKEN].spineVersion,'3.8.99');assert.equal(evidence.originalTokenModels.models[TOKEN].noBasicAttack,true);assert.equal(evidence.originalTokenModels.models[TOKEN].durations.Start,1);
 assert.equal(evidence.buffTemplates['charge_token[finish]'].eventToActions.ON_OWNER_FINISH[0]._rechargeTiming,'ON_FINISH');
 assert.ok(evidence.verificationLimits.some(s=>s.includes('HpRatioTrigger')));assert.ok(evidence.verificationLimits.some(s=>s.includes('TrySetHpZero')));
});

test('all three skills/ranks load complete source kits without generic healing/passive installation',()=>{
 for(let skill=0;skill<3;skill++)for(let rank=1;rank<=10;rank++){const{b,u}=make({skill,rank});assert.equal(u.skill.id,`skchr_slent2_${skill+1}`);assert.equal(u.profile.heal,null);assert.equal(u.profile.install,null);assert.equal(u.skill.noSkill,false);assert.equal(u.s.atk,u.base.atk);assert.deepEqual(b.errors,[]);}
});

test('normal ranged Arts targets one ALL-motion victim at capped Attack .667 then speed8 flight',()=>{
 for(const fly of[false,true]){const{b,u}=make(),e=enemy(b,{res:20,fly}),z=enemy(b,{x:6});assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[e]);b.forceAttack(u,[e]);advance(b,.65);near(e.hp,100000);advance(b,.1);near(e.hp,100000);advance(b,.3);near(100000-e.hp,u.s.atk*.8);near(z.hp,100000);}
});

test('normal CAST reacquires entrant and rejects departed/hidden/target-free victims during windup',()=>{
 for(const state of['left','hidden','free']){const{b,u}=make(),e=enemy(b),z=enemy(b,{x:8});b.forceAttack(u,[e]);advance(b,.2);if(state==='left')e.x=9;else if(state==='hidden')e.hidden=true;else b.addBuff(e,{key:'free',flags:{untargetable:true}});z.x=5;advance(b,.8);near(e.hp,100000);assert.ok(z.hp<100000);}
});

test('each active mode replaces Arts with selected75% healing and source-specific literal release',()=>{
 for(let skill=0;skill<3;skill++)for(let rank=1;rank<=10;rank++){const{b,u,deploy}=make({skill,rank,others:[FAN]}),a=deploy(FAN,2,5),e=enemy(b);wound(a);mutePlumes(b,u);cast(b,u);const atk=u.s.atk;shot(b,u,a);near(a.hp-100,atk*.75);near(e.hp,100000);u.skill.end('duration');assert.equal(u.profile.dmgType,'arts');}
});

test('healing CAST selects lowest ratio/current range and impact revalidates source HEAL restrictions',()=>{
 const{b,u,deploy}=make({others:[FAN,BEA]}),a=deploy(FAN,2,5),z=deploy(BEA,2,7);wound(a);wound(z,500);mutePlumes(b,u);cast(b,u);assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[a]);b.forceAttack(u,[a]);advance(b,.2);a.x=9;z.x=5;advance(b,.8);near(a.hp,100);assert.ok(z.hp>500);
 for(const flag of['healFree','noHeal','isolated','untargetable']){const q=make({others:[FAN]}),v=q.deploy(FAN,2,5);wound(v);mutePlumes(q.b,q.u);cast(q.b,q.u);q.b.forceAttack(q.u,[v]);advance(q.b,.75);q.b.addBuff(v,{key:'deny',flags:{[flag]:true}});advance(q.b,.3);near(v.hp,100);}
});

test('active heal excludes unhealable allies and inactive mode never heals',()=>{
 const{b,u,deploy}=make({others:[VUL]}),a=deploy(VUL,2,5);wound(a);mutePlumes(b,u);cast(b,u);assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[]);shot(b,u,a);near(a.hp,100);u.skill.end('duration');assert.equal(u.profile.dmgType,'arts');
});

test('source normal cap1 versus uncapped active animation preserve accelerated release differences',()=>{
 for(const active of[false,true]){const{b,u,deploy}=make({others:[FAN]}),a=deploy(FAN,2,5),e=enemy(b);wound(a);mutePlumes(b,u);b.addBuff(u,{key:'fast',mods:{aspd:100}});if(active)cast(b,u);b.forceAttack(u,[active?a:e]);advance(b,.55);if(active)assert.ok(a.hp>100);else near(e.hp,100000);}
});

test('sub-tick control interrupts unborn shots, while emitted projectiles survive control/skill end/source removal',()=>{
 for(const active of[false,true])for(const status of['stun','freeze','sleep','levitate']){const{b,u,deploy}=make({others:[FAN]}),a=deploy(FAN,2,5),e=enemy(b);wound(a);mutePlumes(b,u);if(active)cast(b,u);b.forceAttack(u,[active?a:e]);advance(b,.2);b.applyStatus(u,status,{duration:.001});advance(b,1);near(a.hp,100);near(e.hp,100000);}
 for(const finish of['control','end','retreat']){const{b,u,deploy}=make({others:[FAN]}),a=deploy(FAN,2,6);wound(a);mutePlumes(b,u);cast(b,u);b.forceAttack(u,[a]);advance(b,.8);const atk=u.s.atk;if(finish==='control')b.applyStatus(u,'stun',{duration:2});else if(finish==='end')u.skill.end('duration');else b.retreat(u);advance(b,.4);assert.ok(a.hp>100);near(a.hp-100,u.s.atk*.75);if(finish==='control')near(a.hp-100,atk*.75);}
});

test('Sentinel selected promotion reaches source endpoints and samples1% missing-HP bins',()=>{
 for(const[elite,min,max]of[[1,.08,.15],[2,.1,.24]]){const{b,u,deploy}=make({elite,rank:elite===1?7:10,others:[FAN]}),a=deploy(FAN,2,5);near(a.s.physTakenMul,1-min);wound(a,30000);advance(b,.12);near(a.s.physTakenMul,1-max);a.hp=10000;advance(b,.12);near(a.s.physTakenMul,1-max);}
 const t={damage_resistance_base:.1,resistance_scale:.02,hp_ratio:.01,min_hp_ratio:.3};near(silenceSanctuaryValue(t,1),.1);near(silenceSanctuaryValue(t,.990001),.1);near(silenceSanctuaryValue(t,.99),.102);near(silenceSanctuaryValue(t,.500001),.198);near(silenceSanctuaryValue(t,.5),.2);near(silenceSanctuaryValue(t,.3),.24);
 const e0=make({elite:0,rank:4,others:[FAN]}),a=e0.deploy(FAN,2,5);near(a.s.physTakenMul,1);
});

test('Sentinel waitFirst0 evaluates membership immediately then changes HP only at native.1 checker',()=>{
 const{b,u,deploy}=make({others:[FAN]}),a=deploy(FAN,2,5);near(a.s.physTakenMul,.9);wound(a,30000);advance(b,.05);near(a.s.physTakenMul,.9);advance(b,.07);near(a.s.physTakenMul,.76);a.x=9;advance(b,.04);near(a.s.physTakenMul,1);a.x=5;advance(b,.04);near(a.s.physTakenMul,.76);
});

test('Sentinel includes non-HEAL unhealable allies, rejects isolation/free and ordinary Sanctuary excludes True/HP loss',()=>{
 const{b,u,deploy}=make({others:[VUL]}),a=deploy(VUL,2,5);wound(a,30000);advance(b,.12);near(a.s.physTakenMul,.76);for(const flag of['isolated','untargetable']){b.addBuff(a,{key:'deny',flags:{[flag]:true}});advance(b,.04);near(a.s.physTakenMul,1);b.removeBuff(a,'deny');advance(b,.04);}
 let hp=a.hp;b.dealDamage(null,a,{amount:100,type:'true',canDodge:false});near(hp-a.hp,100);hp=a.hp;b.loseHp(a,100);near(hp-a.hp,100);
});

test('S3 scales only native Sentinel base and foreign Sanctuary falls back independently on end/removal',()=>{
 const{b,u,deploy}=make({skill:2,others:[FAN]}),a=deploy(FAN,2,5);wound(a,30000);advance(b,.12);cast(b,u);near(a.s.physTakenMul,1-.24*1.8);b.applyStatus(a,'sanctuary',{key:'foreign',value:.6});near(a.s.physTakenMul,.4);u.skill.end('manual');near(a.s.physTakenMul,.4);b.removeBuff(a,'foreign');near(a.s.physTakenMul,.76);b.retreat(u);near(a.s.physTakenMul,1);
});

test('Plumes promotion/potential/source strict50% gate and first1s delayed regen use current owner ATK',()=>{
 for(const[elite,potential,ratio]of[[1,1,0],[2,1,.05],[2,5,.06]]){const{b,u,deploy}=make({elite,potential,rank:elite===1?7:10,others:[FAN]}),a=deploy(FAN,2,5);wound(a);advance(b,.15);advance(b,.8);near(a.hp,100);const atk=u.s.atk;advance(b,.2);near(a.hp-100,atk*ratio);}
 const{b,u,deploy}=make({others:[FAN]}),a=deploy(FAN,2,5);wound(a,50000);advance(b,1.2);near(a.hp,50000);a.hp=49999;advance(b,.2);b.addBuff(u,{key:'foreign-atk',mods:{atkPct:.3}});advance(b,1);near(a.hp-49999,u.s.atk*.05);
});

test('Rhine tag doubles two native regen channels and HP threshold/reentry resets delayed clocks',()=>{
 const{b,u,deploy}=make({others:[FAN]}),a=deploy(FAN,2,5);a.def.raw.tags=['rhine'];wound(a);advance(b,1.2);near(a.hp-100,u.s.atk*.1);a.hp=60000;advance(b,.15);assert.equal(a.findBuff('slent2_t_2[normal]'),null);assert.equal(a.findBuff('slent2_t_2[rhine]'),null);a.hp=100;advance(b,.2);advance(b,.7);near(a.hp,100);advance(b,.4);near(a.hp-100,u.s.atk*.1);
});

test('Plumes ignores HealFree/target-free but rejects isolation, device and HPregen final0',()=>{
 for(const mode of['healFree','noHeal','untargetable','isolated','zero']){const{b,u,deploy}=make({others:[FAN]}),a=deploy(FAN,2,5);wound(a);if(mode==='zero')b.addBuff(a,{key:'deny',mods:{hpRegenMul:0}});else b.addBuff(a,{key:'deny',flags:{[mode]:true}});advance(b,1.2);near(a.hp-100,['isolated','zero'].includes(mode)?0:u.s.atk*.05);}
});

test('Plumes default priority selects strongest nonstacking normal/Rhine producer and restores owned fallback',()=>{
 const{b,u,deploy}=make({others:[FAN,BEA]}),a=deploy(FAN,2,5),z=deploy(BEA,2,7);z.def=structuredClone(u.def);z.def.talents[1].bb.atk_to_hp_recovery_ratio=.06;z.tileR=u.tileR;z.tileC=u.tileC;z.x=u.x;z.y=u.y;z.rangeKeySet=u.rangeKeySet;z.base.atk=1000;z.markDirty();wound(a);installSilenceParadigmatic({battle:b,unit:z,def:z.def});advance(b,1.2);near(a.hp-100,z.s.atk*.06);assert.equal(a.buffs.filter(x=>x.key==='slent2_t_2[normal]').length,1);b.retreat(z);advance(b,1.1);near(a.hp-100,60+u.s.atk*.05);
});

test('drone card is selected-S2-only stock0 before activation and unavailable outside active skill',()=>{
 for(const skill of[0,2])assert.equal(regularSummonCards(make({skill}).b).length,0);
 const{b,u}=make({skill:1});let s=regularSummonCards(b)[0];assert.equal(s.stock,0);assert.equal(s.available,false);assert.equal(summonPlacementError(b,summonCardId(ID),2,4),'Activate the summoner skill first.');cast(b,u);s=regularSummonCards(b)[0];assert.equal(s.stock,1);assert.equal(s.available,true);u.skill.end('duration');assert.equal(regularSummonCards(b)[0].stock,0);
});

test('original device own stats/cost0/slot0/ALL tiles/no facing/hideHP/no attack and HEAL exclusion',()=>{
 for(const[r,c]of[[2,4],[1,3]]){const{b,u}=make({skill:1,trust:200,potential:6});cast(b,u);const slots=b.deployedSlots(),dp=b.dp,t=drone(b,r,c);assert.equal(t.kind,'device');assert.equal(t.ownerUnit,u);near(b.dp,dp);assert.equal(b.deployedSlots(),slots);assert.equal(t.base.maxHp,1000);assert.equal(t.base.atk,0);assert.equal(t.base.def,0);assert.equal(t.base.cost,0);assert.equal(t.mem.regularHideHp,true);assert.equal(t.profile.noAttack,true);assert.equal(t.profile.noHeal,true);advance(b,.2);near(t.stats.attacks,0);assert.equal(regularSummonCards(b)[0].deployed,1);assert.equal(summonPlacementError(b,summonCardId(ID),2,5),'No summons remaining.');}
});

test('drone selected rank scales only its own original talent base on exact surrounding8 range',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u,deploy,build}=make({skill:1,rank,others:[FAN]}),a=deploy(FAN,2,5);wound(a,30000);cast(b,u);const record=summonRecordFor(ID,build,data.tokens);near(record.stats.respawnTime,5);near(record.talents[0].bb.damage_resistance_base,.1);const t=drone(b);near(a.s.physTakenMul,1-.24*bb(1,rank).damage_resistance_scale);a.x=8;advance(b,.05);near(a.s.physTakenMul,1);assert.equal(t.ownerUnit,u);}
});

test('drone recharge begins at manual removal/death then independently waits5s before a new placement',()=>{
 for(const remove of['retreat','death']){const{b,u}=make({skill:1});cast(b,u);const t=drone(b);advance(b,1);if(remove==='retreat')retreatRegularSummon(b,summonUnitId(t));else b.kill(t);let s=regularSummonCards(b)[0];assert.equal(s.stock,1);near(s.readyAt,b.time+5);assert.equal(summonPlacementError(b,summonCardId(ID),2,5),'Summon is still redeploying.');advance(b,4.8);assert.throws(()=>drone(b,2,5),/redeploying/);advance(b,.25);const v=drone(b,2,5);assert.notEqual(v,t);}
});

test('S2 duration/manual end/owner withdrawal destroys actual device and clears stock/aura immediately',()=>{
 for(const finish of['end','expiry','retreat','death']){const{b,u,deploy}=make({skill:1,others:[FAN]}),a=deploy(FAN,2,5);wound(a,30000);cast(b,u);const t=drone(b);assert.ok(a.findBuff(`slent2:sentinel:${t.id}`));if(finish==='end')u.skill.end('duration');else if(finish==='expiry')advance(b,12.1);else if(finish==='retreat')b.retreat(u);else b.kill(u);assert.equal(t.deployed,false);assert.equal(a.findBuff(`slent2:sentinel:${t.id}`),null);assert.equal(regularSummonCards(b)[0].stock,0);}
});

test('new S2 activation recharges exactly one source device and does not retain leftover end cooldown',()=>{
 const{b,u}=make({skill:1});cast(b,u);const t=drone(b);advance(b,.3);retreatRegularSummon(b,summonUnitId(t));u.skill.end('duration');cast(b,u);assert.equal(regularSummonCards(b)[0].stock,1);assert.ok(drone(b,2,5));
});

test('S3 all selected ranks protect one fatal recipient for exact grave duration and never reduce nonfatal damage',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u,deploy}=make({skill:2,rank,others:[FAN,BEA]}),a=deploy(FAN,2,5),z=deploy(BEA,2,6);cast(b,u);const e=enemy(b);b.dealDamage(e,a,{amount:a.hp+10000,type:'true',canDodge:false});assert.equal(a.alive,true);near(a.hp,1);assert.equal(u.mem.slent2GraveAvailable,false);b.dealDamage(e,z,{amount:z.hp+10000,type:'true',canDodge:false});assert.equal(z.alive,false);b.dealDamage(e,a,{amount:100,type:'true',canDodge:false});near(a.hp,1);near(a.findBuff('slent2_shallow_grave').timeLeft,bb(2,rank).grave_duration);advance(b,bb(2,rank).grave_duration+.1);b.dealDamage(e,a,{amount:a.hp+1000,type:'true',canDodge:false});assert.equal(a.alive,false);}
});

test('S3 source purpose0 includes isolated/free/unhealable Operators but not devices or out-of-range',()=>{
 for(const flag of['isolated','untargetable','healFree','noHeal']){const{b,u,deploy}=make({skill:2,others:[FAN]}),a=deploy(FAN,2,5);b.addBuff(a,{key:'special',flags:{[flag]:true}});cast(b,u);b.loseHp(a,a.hp+100);assert.equal(a.alive,true);near(a.hp,1);}
 const{b,u,deploy}=make({skill:2,others:[FAN]}),a=deploy(FAN,2,7);a.x=9;cast(b,u);b.loseHp(a,a.hp+100);assert.equal(a.alive,false);assert.equal(u.mem.slent2GraveAvailable,true);
});

test('S3 existing UNDEADABLE/shield/dodge/canceled damage do not consume source marker; scripted kill bypasses it',()=>{
 for(const mode of['undeadable','shield','dodge','cancel','kill']){const{b,u,deploy}=make({skill:2,others:[FAN]}),a=deploy(FAN,2,5),e=enemy(b);cast(b,u);if(mode==='undeadable')b.addBuff(a,{key:'foreign',flags:{undeadable:true}});else if(mode==='shield')b.addBuff(a,{key:'foreign',shield:100000});else if(mode==='dodge')b.addBuff(a,{key:'foreign',mods:{dodgePhys:1}});else if(mode==='cancel')b.on('hit',c=>{if(c.target===a)c.dmg.cancel=true;});if(mode==='kill')b.kill(a);else b.dealDamage(e,a,{amount:a.hp+10000,type:mode==='dodge'?'phys':'true'});assert.equal(u.mem.slent2GraveAvailable,true);assert.equal(a.findBuff('slent2_shallow_grave'),null);if(mode==='kill')assert.equal(a.alive,false);}
});

test('born grave is nonderived and survives skill end/range departure/owner removal but not scripted retreat',()=>{
 for(const finish of['end','retreat','death','leave']){const{b,u,deploy}=make({skill:2,others:[FAN]}),a=deploy(FAN,2,5);cast(b,u);b.loseHp(a,a.hp+100);if(finish==='end')u.skill.end('manual');else if(finish==='retreat')b.retreat(u);else if(finish==='death')b.kill(u);else a.x=9;advance(b,.2);assert.ok(a.findBuff('slent2_shallow_grave'));b.loseHp(a,100);near(a.hp,1);b.retreat(a);assert.equal(a.deployed,false);}
});

test('S3 source battle cap2 survives operator redeployment and manual cancel reuses existing command pathway',()=>{
 const{b,u}=make({skill:2});cast(b,u);assert.equal(u.skill.remainingUses,1);assert.equal(b.activateOperator(ID),true);assert.equal(u.skill.active,false);b.retreatOperator(ID);advance(b,u.base.respawnTime+.1);b.addDp('arkpedia',99);const z=b.deployOperator(ID,1,4,'RIGHT');z.atkCd=1000;cast(b,z);assert.equal(z.skill.remainingUses,0);assert.equal(b.activateOperator(ID),true);z.skill.setSpTotal(z.skill.spCost);assert.equal(b.activateOperator(ID),false);assert.equal(z.skill.exhausted,true);
});

test('S3 original beginning/end are literal presentation with no invented combat disarm and stale callbacks stay isolated',()=>{
 const{b,u}=make({skill:2});cast(b,u);assert.deepEqual(u.mem.regularFormVisual,{clip:'Skill_2_Begin',loop:false});assert.equal(Boolean(u.s.flags.disarm),false);advance(b,.3);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Idle');u.skill.end('manual');assert.equal(u.mem.regularFormVisual.clip,'Skill_2_End');cast(b,u);advance(b,.3);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Idle');u.skill.end('duration');advance(b,.3);assert.equal(u.mem.regularFormVisual,null);
});
