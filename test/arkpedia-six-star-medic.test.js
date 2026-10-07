// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import evidence from '../data/arkpedia-six-star-medic-prefabs.json' with {type:'json'};
import {SIX_STAR_MEDIC_OPERATORS} from '../shared/arkpedia/six-star-medic-operators.js';
import {REGULAR_SUMMONS,summonCardId,summonUnitId} from '../shared/arkpedia/summons.js';
import {regularSummonCards,deployRegularSummon,retreatRegularSummon,summonPlacementError} from '../server/sim/content/arkpedia-summons.js';
import {StandardBattle} from '../server/sim/arkpedia.js';
import {defaultBuild} from '../shared/arkpedia/loadout.js';
import {acquireTargets,effectiveProfile} from '../server/sim/ai.js';
import {sortAllyTargets} from '../server/sim/targeting.js';
import {installSixStarMedic} from '../server/sim/content/arkpedia-six-star-medic.js';
const SHI='char_147_shining',NIG='char_179_cgbird',LUM='char_4042_lumen',FAN='char_123_fang',BEA='char_122_beagle',KRO='char_124_kroos';
const near=(a,e,t=1e-5)=>assert.ok(Math.abs(a-e)<t,`${a} != ${e}`);
const advance=(b,s)=>{for(let n=0;n<Math.round(s/b.dt);n++)b.step();assert.deepEqual(b.errors,[]);};
function build(id,{skill=0,rank=10,elite=2,potential=1}={}){const o=data.operators[id];assert.ok(o,`Reviewed snapshot required ${id}`);return{...defaultBuild(o),elite,level:o.phases[elite].maxLevel,potential,skillId:o.skills[skill].id,skillRank:rank};}
function make(id,{skill=0,rank=10,elite=2,potential=1,others=[]}={}){const source=structuredClone(data);source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;const b=new StandardBattle(source,{operators:[build(id,{skill,rank,elite,potential}),...others.map(x=>typeof x==='string'?defaultBuild(source.operators[x]):x)]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);const deploy=(who=id,r=1,c=4,dir='UP')=>{b.addDp('arkpedia',99);const u=b.deployOperator(who,r,c,dir);assert.ok(u);u.atkCd=1000;return u;};return{b,deploy};}
const wound=(u,hp=100,max=100000)=>{u.base.maxHp=max;u.markDirty();void u.s;u.hp=hp;};
function cast(b,u,charges=u.skill.maxCharges){u.skill.setSpTotal(u.skill.spCost*charges);assert.equal(u.skill.manual?b.activateOperator(u.defId):u.skill.activate('test'),true);u.atkCd=1000;}
const bb=(id,s,rank=10)=>Object.fromEntries(data.operators[id].skills[s].levels[rank-1].blackboard.map(x=>[x.key,x.value]));
function shot(b,u,targets,s=1.2){b.forceAttack(u,targets);u.atkCd=1000;advance(b,s);}
const row=(rows,id)=>rows.find(r=>r.pathId===id).data;

test('six-star source retains nine exact skills, original models, bundle digests and raw numeric dispatch caveats',()=>{
 for(const[id,cfg]of Object.entries(SIX_STAR_MEDIC_OPERATORS)){assert.equal(cfg.skillIds.length,3);assert.match(evidence.sourceBundles.find(x=>x.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);for(const face of['Front','Back'])assert.match(evidence.models[id][face].sha256,/^[a-f0-9]{64}$/);for(const sid of cfg.skillIds)assert.ok(evidence.skills[sid.split('[')[0]].length);}
 assert.equal(row(evidence.token,'8860484327227050235')._occupiedRemainingCharacterCnt,0);assert.equal(row(evidence.token,'8860484327227050235')._useRealBornTimeFromAnim,0);assert.equal(row(evidence.characters[LUM],'5308553534996653768')._replaceAnimPairs[0].toAnimKey,'Skill_3_Loop');assert.equal(evidence.buffTemplates['lumen_s_2_enhance_judge'].eventToActions.ON_BUFF_START[1].$type,'Torappu.Battle.Action.Nodes+ClearCharacterSp, Assembly-CSharp');assert.equal(evidence.frameParity,false);
 const aliases=row(evidence.animators[NIG],'9011652047420948756')._animations;
 assert.deepEqual(aliases.filter(x=>['Attack_A','Attack_B','Attack_C'].includes(x.animKey)).map(x=>[x.animKey,x.animName]),[['Attack_A','Attack'],['Attack_B','Attack'],['Attack_C','Attack']]);
});

test('all nine selected skills use every exact source rank without fallback installs',()=>{
 for(const[id,cfg]of Object.entries(SIX_STAR_MEDIC_OPERATORS))for(let skill=0;skill<3;skill++)for(let rank=1;rank<=10;rank++){const{b,deploy}=make(id,{skill,rank}),u=deploy();assert.equal(u.skill.id,cfg.skillIds[skill]);assert.equal(u.skill.noSkill,false);assert.deepEqual(b.errors,[]);}
});

test('ordinary heals follow original facing events and source single versus three-target selection',()=>{
 for(const id of[SHI,NIG,LUM])for(const dir of['UP','RIGHT']){
  const{b,deploy}=make(id,{others:[FAN,BEA,KRO]}),u=deploy(id,1,4,dir),a=deploy(FAN,2,3),z=deploy(BEA,2,5),k=deploy(KRO,1,3);for(const x of[a,z,k])wound(x);u.dir='UP';b._refreshRange(u);const targets=acquireTargets(b,u,effectiveProfile(u));assert.equal(targets.length,id===NIG?3:1);b.forceAttack(u,targets);advance(b,.2);for(const x of[a,z,k])near(x.hp,100);advance(b,1.1);assert.ok(targets.every(x=>x.hp>100));assert.equal(u.stats.attacks,1);
 }
});

test('ordinary healing excludes isolated, heal-free and no-heal allies while defensive auras retain no-heal recipients',()=>{
 for(const id of[SHI,NIG,LUM]){const{b,deploy}=make(id,{others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);b.addBuff(a,{key:'test:noHeal',flags:{noHeal:true}});advance(b,.05);assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[]);if(id===SHI)near(a.s.def,a.base.def+60);if(id===NIG)near(a.s.res,a.base.res+15);b.removeBuff(a,'test:noHeal');b.addBuff(a,{key:'test:isolate',flags:{isolated:true}});advance(b,.05);assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[]);near(a.s.def,a.base.def);near(a.s.res,a.base.res);}
});

test('Shining flat DEF and self ASPD talents follow source promotion and potential gates',()=>{
 for(const[elite,potential,def,aspd]of[[0,1,20,0],[0,6,25,0],[1,1,40,0],[1,6,45,0],[2,1,60,10],[2,3,60,13],[2,6,65,13]]){const{b,deploy}=make(SHI,{elite,potential,rank:[4,7,10][elite],others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);advance(b,.05);near(a.s.def,a.base.def+def);near(u.s.def,u.base.def+def);near(u.s.aspd,u.base.aspd+aspd);a.x=9;a.y=7;advance(b,.05);near(a.s.def,a.base.def);b.retreat(u);near(u.alive,false);}
});

test('Shining first skill selected ATK/ASPD and field additive DEF include late allies and clean up',()=>{
 for(let rank=1;rank<=10;rank++){const q=make(SHI,{rank}),v=q.deploy();cast(q.b,v);near(v.s.atk,v.base.atk*(1+bb(SHI,0,rank).atk));near(v.s.aspd,v.base.aspd+10+bb(SHI,0,rank).attack_speed);const{b,deploy}=make(SHI,{skill:2,rank,others:[FAN]}),u=deploy();cast(b,u);const a=deploy(FAN,2,3);advance(b,.05);near(a.s.def,(a.base.def+60)*(1+bb(SHI,2,rank).def));u.skill.end('duration');near(a.s.def,a.base.def+60);cast(b,u);b.retreat(u);near(a.s.def,a.base.def);}
});

test('Shining next-heal charge creates one timed full damage shield and removes DEF when exhausted',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make(SHI,{skill:1,rank,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3),s=bb(SHI,1,rank);wound(a,50000);cast(b,u);const charges=u.skill.charges;b.forceAttack(u,[a]);advance(b,.4);assert.equal(a.findBuff('shining_s_2'),null);advance(b,.2);const shield=a.findBuff('shining_s_2');near(shield.shield,u.s.atk*s.atk_scale);near(a.s.def,(a.base.def+60)*(1+s.def));assert.equal(u.skill.charges,charges);const hp=a.hp;b.dealDamage(null,a,{amount:shield.shield+100,type:'true',canDodge:false});near(hp-a.hp,100);assert.equal(a.findBuff('shining_s_2'),null);near(a.s.def,a.base.def+60);}
});

test('Shining and Nightingale shields expire by source selected duration without deleting foreign buffs',()=>{
 for(const id of[SHI,NIG]){const{b,deploy}=make(id,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);b.addBuff(a,{key:'foreign:def',mods:{defFlat:17}});cast(b,u);shot(b,u,[a]);const key=id===SHI?'shining_s_2':`cgbird_s_2:${u.id}`;assert.ok(a.findBuff(key));advance(b,bb(id,1).duration+.1);assert.equal(a.findBuff(key),null);assert.ok(a.findBuff('foreign:def'));}
});

test('Nightingale RES promotion, potential and source percentage field use flat-before-percent ordering',()=>{
 for(const[elite,potential,value]of[[0,1,5],[0,5,7],[1,1,10],[1,5,12],[2,1,15],[2,5,17]]){const{b,deploy}=make(NIG,{elite,potential,rank:[4,7,10][elite],others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);advance(b,.05);near(a.s.res,a.base.res+value);near(u.s.res,u.base.res+value);}
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make(NIG,{skill:2,rank,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);b.addBuff(a,{key:'foreign:res',mods:{resFlat:3,resPct:.1,resMul:.8}});cast(b,u);near(a.s.res,(a.base.res+18)*(1.1+bb(NIG,2,rank).magic_resistance)*.8);near(a.s.dodgeArts,bb(NIG,2,rank).prob);u.skill.end('duration');near(a.s.res,(a.base.res+18)*1.1*.8);near(a.s.dodgeArts,0);b.retreat(u);near(a.s.res,(a.base.res+3)*1.1*.8);}
});

test('Nightingale second skill shields all three actual recipients against Arts only, one charge',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make(NIG,{skill:1,rank,others:[FAN,BEA,KRO]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5),k=deploy(KRO,1,3);for(const x of[a,z,k])wound(x,50000);cast(b,u);const charges=u.skill.charges;shot(b,u,[a,z,k],1);for(const x of[a,z,k]){const shield=x.findBuff(`cgbird_s_2:${u.id}`);near(shield.shield,u.s.atk*bb(NIG,1,rank).atk_scale);near(x.s.res,x.base.res+15+bb(NIG,1,rank).magic_resistance);const before=shield.shield;b.dealDamage(null,x,{amount:10,type:'phys',canDodge:false});near(shield.shield,before);b.dealDamage(null,x,{amount:20,type:'arts',canDodge:false});near(shield.shield,before-20*(1-x.s.res/100));}assert.equal(u.skill.charges,charges);}
});

test('Lumen far healing and pre-output GE75% talent choose exact source Resist durations',()=>{
 for(const[elite,low,high]of[[0,0,0],[1,2,4],[2,4,6]]){const{b,deploy}=make(LUM,{elite,rank:[4,7,10][elite],others:[FAN]}),u=deploy(),a=deploy(FAN,3,5);wound(a);shot(b,u,[a]);near(a.hp-100,u.s.atk*.8);near(a.findBuff(`lumen:resist:${u.id}`)?.duration??0,low);if(elite){b.removeBuff(a,`lumen:resist:${u.id}`);a.hp=a.s.maxHp*.75;shot(b,u,[a]);near(a.findBuff(`lumen:resist:${u.id}`).duration,high);b.removeBuff(a,`lumen:resist:${u.id}`);a.hp=a.s.maxHp*.75-1;shot(b,u,[a]);near(a.findBuff(`lumen:resist:${u.id}`).duration,low);}}
});

test('Lumen Quick Fix has original initial cooldown, potential cooldown and actual negative-status application gate',()=>{
 for(const potential of[1,5]){const{b,deploy}=make(LUM,{potential,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a,50000);const cd=potential===1?12:10;b.applyStatus(a,'cold',{duration:1});near(a.hp,50000);advance(b,cd+.1);const hp=a.hp;b.applyStatus(a,'cold',{duration:1});near(a.hp-hp,u.s.atk*.8);b.applyStatus(a,'bind',{duration:1});near(a.hp-hp,u.s.atk*.8);advance(b,cd+.1);b.applyStatus(a,'fragile',{duration:1});near(a.hp-hp,u.s.atk*.8);b.addBuff(a,{key:'test:isolated',flags:{isolated:true}});b.applyStatus(a,'stun',{duration:.1});near(a.hp-hp,u.s.atk*.8);b.removeBuff(a,'test:isolated');b.applyStatus(a,'stun',{duration:.1});near(a.hp-hp,u.s.atk*1.6);}
});

test('Lumen second skill heals after original event, clears all SP and purifies only fully charged casts at every rank',()=>{
 for(let rank=1;rank<=10;rank++)for(const charged of[false,true]){const{b,deploy}=make(LUM,{skill:1,rank,others:[FAN,BEA,KRO]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5),k=deploy(KRO,1,3);for(const x of[a,z,k]){wound(x,50000);b.applyStatus(x,'cold',{duration:10});}cast(b,u,charged?2:1);near(u.skill.spTotal,0);advance(b,.7);for(const x of[a,z,k])near(x.hp,50000);advance(b,.2);for(const x of[a,z,k].slice(0,bb(LUM,1,rank).max_target)){near(x.hp-50000,u.s.atk*bb(LUM,1,rank).heal_scale);assert.equal(Boolean(x.s.flags.cold),!charged);}assert.ok(u.findBuff('lumen:cast'));advance(b,.6);assert.equal(u.findBuff('lumen:cast'),null);}
});

test('Lumen second skill interruption remembers brief stun before its original release',()=>{
 const{b,deploy}=make(LUM,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);cast(b,u);advance(b,.1);b.applyStatus(u,'stun',{duration:.05});advance(b,1.5);near(a.hp,100);assert.equal(u.findBuff('lumen:cast'),null);
});

test('Lumen third skill Common healing consumes no ammo, Special purifies at impact and ends at exact selected ammo',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make(LUM,{skill:2,rank,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);cast(b,u);const amount=u.s.atk,ammo=bb(LUM,2,rank)['attack@trigger_time'];assert.equal(u.skill.ammoLeft,ammo);shot(b,u,[a],.8);near(a.hp-100,amount);assert.equal(u.skill.ammoLeft,ammo);for(let i=0;i<ammo;i++){b.applyStatus(a,'cold',{duration:3});const hp=a.hp;b.forceAttack(u,[a]);advance(b,.3);assert.equal(a.s.flags.cold,true);advance(b,.5);near(a.hp-hp,amount*bb(LUM,2,rank).heal_scale);assert.equal(Boolean(a.s.flags.cold),false);assert.equal(u.skill.ammoLeft,i===ammo-1?0:ammo-i-1);}assert.equal(u.skill.active,false);near(u.s.atk,u.base.atk);advance(b,.5);assert.equal(u.mem.regularFormVisual,null);}
});

test('Lumen third skill prioritizes negative statuses including healthy targets and ignores unrelated ATK debuffs',()=>{
 const{b,deploy}=make(LUM,{skill:2,others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5);wound(a);cast(b,u);b.addBuff(z,{key:'test:atk',mods:{atkPct:-.5}});assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[a]);b.applyStatus(z,'cold',{duration:3});assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[z]);shot(b,u,[z],.8);assert.equal(Boolean(z.s.flags.cold),false);assert.equal(z.hp,z.s.maxHp);assert.equal(u.skill.ammoLeft,7);assert.ok(z.findBuff('test:atk'));
});

test('Lumen emitted healing rejects newly isolated targets without wasting a special ammo',()=>{
 const{b,deploy}=make(LUM,{skill:2,others:[FAN]}),u=deploy(),a=deploy(FAN,3,5);wound(a);cast(b,u);b.applyStatus(a,'cold',{duration:3});b.forceAttack(u,[a]);advance(b,.4);b.addBuff(a,{key:'test:isolate',flags:{isolated:true}});advance(b,.7);near(a.hp,100);assert.equal(u.skill.ammoLeft,8);assert.equal(a.s.flags.cold,true);
});

test('Lumen first skill creates original static x4 periodic zone, respects live membership and owner removal',()=>{
 const{b,deploy}=make(LUM,{others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,2);wound(a);wound(z);cast(b,u);shot(b,u,[a],.9);near(a.hp-100,u.s.atk);near(z.hp,100);advance(b,.9);assert.ok(z.hp>100);const hp=z.hp;z.x=9;z.y=7;advance(b,1);near(z.hp,hp);const next=a.hp;b.retreat(u);advance(b,5);near(a.hp,next);assert.equal(a.buffs.some(x=>x.key.startsWith('lumen:drizzle:')),false);
});

test('Nightingale Cage source unlock, cost, zero slots, original HP scaling/RES and no skill or attacks',()=>{
 for(const elite of[0,1]){const{b,deploy}=make(NIG,{elite,rank:[4,7][elite]}),u=deploy();assert.equal(regularSummonCards(b).length,0);}
 const{b,deploy}=make(NIG),u=deploy(),key=summonCardId(NIG),slots=b.deployedSlots(),dp=b.dp;assert.equal(REGULAR_SUMMONS[NIG].minimumElite,2);assert.equal(regularSummonCards(b)[0].stock,2);const token=deployRegularSummon(b,key,2,3);near(dp-b.dp,5);assert.equal(b.deployedSlots(),slots);near(token.s.maxHp,6000);near(token.base.res,75);near(token.s.res,90);near(token.s.blockCnt,0);near(token.s.taunt,1);near(token.s.dodgePhys,.3);assert.equal(token.profile.canAttack(b,token),false);assert.equal(token.skill.noSkill,true);token.hp-=100;near(b.heal(u,token,100),0);advance(b,.8);near(token.hp,5900);advance(b,.3);near(token.hp,5720);
});

test('Cage 3% PURE decay bypasses shields/mitigation/invulnerability with no defensive SP and correct remaining stock',()=>{
 const{b,deploy}=make(NIG),u=deploy(),key=summonCardId(NIG),token=deployRegularSummon(b,key,2,3);b.addBuff(token,{key:'test:shield',shield:10000,flags:{invulnerable:true},mods:{dmgTakenMul:.1}});advance(b,1.1);near(token.hp,5820);near(token.findBuff('test:shield').shield,10000);const before=b.dp;retreatRegularSummon(b,summonUnitId(token));near(b.dp-before,2);assert.equal(regularSummonCards(b)[0].stock,1);assert.equal(summonPlacementError(b,key,2,3),'Summon is still redeploying.');
});

test('Cage redeployment adds original born count to persisted stock and owner withdrawal removes active cages',()=>{
 const{b,deploy}=make(NIG),u=deploy(),key=summonCardId(NIG),token=deployRegularSummon(b,key,2,3);assert.equal(regularSummonCards(b)[0].stock,1);b.retreatOperator(NIG);assert.equal(token.alive,false);assert.equal(regularSummonCards(b)[0].available,false);advance(b,u.base.respawnTime+.1);b.addDp('arkpedia',99);const next=b.deployOperator(NIG,1,4,'UP');next.atkCd=1000;assert.equal(regularSummonCards(b)[0].stock,3);assert.equal(regularSummonCards(b)[0].record.stats.maxDeployCount,3);const again=deployRegularSummon(b,key,2,3);assert.equal(again.ownerUnit,next);assert.equal(regularSummonCards(b)[0].stock,2);
});


test('unhealable Vulcan retains defensive auras while Lumen heals a high-ground operator normally',()=>{
 for(const id of[SHI,NIG]){
  const{b,deploy}=make(id,{skill:2,others:['char_163_hpsts']}),u=deploy(),a=deploy('char_163_hpsts',2,3);cast(b,u);advance(b,.1);
  assert.equal(Boolean(a.profile.noHeal||a.s.flags.noHeal),true);
  if(id===SHI)near(a.s.def,(a.base.def+60)*2);else near(a.s.res,(a.base.res+15)*2.5);
 }
 const{b,deploy}=make(LUM,{others:[KRO]}),u=deploy(),a=deploy(KRO,1,3);wound(a);assert.equal(a.ground,false);assert.equal(a.isFlying,false);assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[a]);shot(b,u,[a]);near(a.hp-100,u.s.atk);
});

test('Shining source shared aura keys choose strongest without stacking and restore the weaker source',()=>{
 const{b,deploy}=make(SHI,{skill:2,rank:1,others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),second=deploy(BEA,2,5);
 const def=structuredClone(u.def);def.charId=SHI;def.talents[0].bb.def=65;def.skill.bb.def=1;
 second.rangeGrid=structuredClone(u.rangeGrid);second.dir=u.dir;second.tileR=u.tileR;second.tileC=u.tileC;second.x=u.x;second.y=u.y;b._refreshRange(second);second.skill.timeLeft=1000;second.skill.id='skchr_shining_3';second.skill.active=true;
 installSixStarMedic({battle:b,unit:second,def});cast(b,u);advance(b,.1);near(a.s.def,(a.base.def+65)*2);
 assert.equal(a.buffs.filter(x=>x.key==='char_shining_t_def').length,1);assert.equal(a.buffs.filter(x=>x.key==='shining_s_3').length,1);
 b.retreat(second);near(a.s.def,(a.base.def+60)*(1+bb(SHI,2,1).def));
});

test('Nightingale independent source auras retain distinct producers and clear only the withdrawn producer',()=>{
 const{b,deploy}=make(NIG,{skill:2,others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),second=deploy(BEA,2,5);
 const def=structuredClone(u.def);def.charId=NIG;def.talents[0].bb.magic_resistance=12;def.skill.bb.magic_resistance=.5;
 second.rangeGrid=structuredClone(u.rangeGrid);second.dir=u.dir;second.tileR=u.tileR;second.tileC=u.tileC;second.x=u.x;second.y=u.y;b._refreshRange(second);second.skill.timeLeft=1000;second.skill.id='skchr_cgbird_3';second.skill.active=true;
 installSixStarMedic({battle:b,unit:second,def});cast(b,u);advance(b,.1);near(a.s.res,(a.base.res+27)*3);
 assert.equal(a.buffs.filter(x=>x.key.startsWith('cgbird_t_1:')).length,2);
 b.retreat(second);near(a.s.res,(a.base.res+15)*2.5);assert.equal(a.buffs.filter(x=>x.key.startsWith('cgbird_t_1:')).length,1);
});

test('source next-heal dead targets refund the spent charge and live newly isolated targets receive no direct heal',()=>{
 for(const id of[SHI,NIG])for(const dead of[true,false]){
  const{b,deploy}=make(id,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);cast(b,u);const left=u.skill.charges;
  b.forceAttack(u,[a]);advance(b,.1);if(dead)b.kill(a);else b.addBuff(a,{key:'test:isolate',flags:{isolated:true}});
  advance(b,1);assert.equal(u.skill.charges,left+(dead?1:0));if(!dead)near(a.hp,100);
 }
});

test('a depleted source protection buff removes its modifier even after caster withdrawal',()=>{
 for(const id of[SHI,NIG]){
  const{b,deploy}=make(id,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a,50000);cast(b,u);shot(b,u,[a]);const key=id===SHI?'shining_s_2':`cgbird_s_2:${u.id}`;assert.ok(a.findBuff(key));b.retreat(u);
  b.dealDamage(null,a,{amount:10000,type:id===SHI?'true':'arts',canDodge:false});assert.equal(a.findBuff(key),null);near(a.s.def,a.base.def);near(a.s.res,a.base.res);
 }
});

test('source AUTO next-heal skills activate in the natural loop and Lumen can manually cancel unlimited Common mode',()=>{
 for(const id of[SHI,NIG,LUM]){
  const{b,deploy}=make(id,{skill:id===LUM?0:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);u.skill.setSpTotal(u.skill.spCost*u.skill.maxCharges);u.atkCd=0;advance(b,1.2);assert.equal(u.skill.activations,1);assert.ok(a.hp>100);assert.equal(u.skill.active,false);
 }
 const{b,deploy}=make(LUM,{skill:2}),u=deploy();cast(b,u);assert.equal(b.activateOperator(LUM),true);assert.equal(u.skill.active,false);near(u.s.atk,u.base.atk);advance(b,.4);assert.equal(u.mem.regularFormVisual,null);
});

test('Cage high taunt beats a later operator and decay dies after source HP ratio ticks without skill SP',()=>{
 const{b,deploy}=make(NIG,{others:[FAN]}),u=deploy(),token=deployRegularSummon(b,summonCardId(NIG),2,3),a=deploy(FAN,2,5);
 a.skill.spType='none';assert.deepEqual(sortAllyTargets({blockedBy:null},[a,token]),[token,a]);assert.deepEqual(sortAllyTargets({blockedBy:a},[a,token]),[a,token]);
 const dp=b.dp;advance(b,33.1);assert.equal(token.alive,true);near(token.hp,60);advance(b,1);assert.equal(token.alive,false);near(b.dp,dp);assert.equal(regularSummonCards(b)[0].stock,1);
});

test('Nightingale expanded-only aura recipients detach synchronously at skill end',()=>{
 const{b,deploy}=make(NIG,{skill:2,others:[KRO]}),u=deploy(),a=deploy(KRO,4,4);
 advance(b,.1);near(a.s.res,a.base.res);cast(b,u);near(a.s.res,(a.base.res+15)*2.5);
 assert.ok(a.findBuff(`cgbird_t_1:${u.id}`));assert.ok(a.findBuff(`cgbird_s_3:${u.id}`));
 u.skill.end('duration');near(a.s.res,a.base.res);assert.equal(a.findBuff(`cgbird_t_1:${u.id}`),null);assert.equal(a.findBuff(`cgbird_s_3:${u.id}`),null);
});

test('Lumen overlapping source zones share one periodic buff and stop at the bounded expiry',()=>{
 const{b,deploy}=make(LUM,{others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);
 cast(b,u);shot(b,u,[a],.9);cast(b,u);shot(b,u,[a],.9);
 const key=`lumen:drizzle:${u.id}`,zones=u.mem.lumenZones;
 assert.equal(zones.size,2);assert.equal(a.buffs.filter(x=>x.key===key).length,1);
 const zone=[...zones.values()].at(-1),hp=a.hp,perPulse=u.s.atk*bb(LUM,0)['aura.heal_scale'];
 advance(b,1);near(a.hp-hp,perPulse);assert.equal(a.buffs.filter(x=>x.key===key).length,1);
 // Current source adapter excludes the exact expiry boundary. The original
 // native expiry/interval dispatch order is deliberately not claimed.
 advance(b,zone.expires-b.time+.1);near(a.hp-hp,perPulse*4);
 assert.equal(zones.size,0);assert.equal(a.findBuff(key),null);const final=a.hp;advance(b,2);near(a.hp,final);
});
