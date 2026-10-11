// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-eyja-alter-prefabs.json' with { type: 'json' };
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
import { installEyjaAlter } from '../server/sim/content/arkpedia-eyja-alter.js';
import { registerBerryProtection } from '../server/sim/content/arkpedia-five-star-medic-second.js';
const ID='char_1016_agoat2',FAN='char_123_fang',BEA='char_122_beagle',KRO='char_124_kroos',VUL='char_163_hpsts';
const near=(a,e,t=1e-5)=>assert.ok(Math.abs(a-e)<t,`${a} != ${e}`);
const advance=(b,s)=>{for(let i=0;i<Math.round(s/b.dt);i++)b.step();assert.deepEqual(b.errors,[]);};
function make({skill=0,rank=10,elite=2,potential=1,trust=0,dir='RIGHT',others=[],defer=false}={}){
 const source=structuredClone(data),o=source.operators[ID];assert.ok(o,'Reviewed Eyja alter snapshot required');source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;
 const build={...defaultBuild(o),elite,level:o.phases[elite].maxLevel,potential,trust,skillId:o.skills[skill].id,skillRank:rank};
 const b=new StandardBattle(source,{operators:[build,...others.map(id=>defaultBuild(source.operators[id]))]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
 const deploy=(id=ID,r=1,c=4)=>{b.addDp('arkpedia',99);const a=b.deployOperator(id,r,c,dir);assert.ok(a,`${id} ${r},${c}`);a.atkCd=1000;return a;};return{b,u:defer?null:deploy(),deploy,build};
}
function wound(a,hp=100,max=100000){a.base.maxHp=max;a.markDirty();void a.s;a.hp=hp;}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.manual ? b.activateOperator(u.defId) : u.skill.activate('source-auto-fixture'),true);u.atkCd=1000;}
const bb=(skill,rank=10)=>Object.fromEntries(data.operators[ID].skills[skill].levels[rank-1].blackboard.map(x=>[x.key,x.value]));
const shot=(b,u,a,s=.8)=>{b.forceAttack(u,[a]);u.atkCd=1000;advance(b,s);};
const element=(b,a,value=100,type='neural',extra={})=>b.dealDamage(null,a,{type:'element',element:type,amount:value,canDodge:false,...extra});
function barrier({rank=10,others=[FAN,BEA]}={}){const q=make({skill:1,rank,others});q.a=q.deploy(FAN,2,5);if(others.includes(BEA))q.z=q.deploy(BEA,2,6);cast(q.b,q.u);advance(q.b,1.1);assert.ok(q.u.mem.eyjaBarrier);return q;}
function secondProducer(b,u,a,{scale=1,pot=false}={}){a.def=structuredClone(u.def);a.def.talents[1].bb.max_hp=pot ? .08 : .06;a.skill.id='skchr_agoat2_3';a.skill.bb={talent_scale:scale};a.def.skill={...a.def.skill,id:a.skill.id,bb:a.skill.bb};a.skill.active=scale!==1;a.skill.kind='duration';a.skill.timeLeft=1000;a.tileR=u.tileR;a.tileC=u.tileC;a.x=u.x;a.y=u.y;installEyjaAlter({battle:b,unit:a,def:a.def});return a;}

test('retains exact source all30 levels, five verified bundles and actual native facings/clocks',()=>{
 assert.equal(evidence.frameParity,false);assert.deepEqual(evidence.enabledOperators,[ID]);assert.equal(evidence.source.bundles.length,5);for(const r of evidence.source.bundles)assert.match(r.sha256,/^[a-f0-9]{64}$/);
 for(let i=1;i<=3;i++)assert.equal(evidence.tables[ID].skillLevels[`skchr_agoat2_${i}`].length,10);
 for(const face of['Front','Back']){assert.equal(evidence.originalFacingBindings[ID][face].sha256,evidence.models[ID][face].sha256);near(evidence.models[ID][face].hits.Attack[0],.4);near(evidence.models[ID][face].hits.Skill_1_Loop[0],.433);near(evidence.models[ID][face].hits.Skill_2[0],.267);near(evidence.models[ID][face].hits.Skill_3_Loop[0],.267);assert.equal(evidence.models[ID][face].hits.Skill_3_End,undefined);}
 assert.ok(evidence.verificationLimits.some(x=>x.includes('EXTEND')));assert.ok(evidence.verificationLimits.some(x=>x.includes('LOWER_PRIORITY')));assert.ok(evidence.verificationLimits.some(x=>x.includes('targetFamilyMask31')));
});
test('all selected skills/ranks suppress inherited medic/talent installation and use complete original kits',()=>{
 for(let skill=0;skill<3;skill++)for(let rank=1;rank<=10;rank++){const{b,u}=make({skill,rank});assert.equal(u.skill.id,`skchr_agoat2_${skill+1}`);assert.equal(u.skill.noSkill,false);assert.equal(u.profile.install,null);assert.equal(u.profile.heal,null);assert.equal(u.s.atk,u.base.atk);assert.deepEqual(b.errors,[]);}
});
test('normal healing releases at source.4 then speed7 and restores HP plus ATK.5 elemental injury',()=>{
 const{b,u,deploy}=make({elite:0,rank:4,others:[FAN]}),a=deploy(FAN,2,6);wound(a);a.elem.neural=800;const atk=u.s.atk;b.forceAttack(u,[a]);advance(b,.35);near(a.hp,100);advance(b,.15);near(a.hp,100);advance(b,.4);near(a.hp-100,atk);near(a.elem.neural,800-atk*.5);
});
test('full-HP elemental injury is a legal ordinary heal and EP priority outranks lower HP',()=>{
 const{b,u,deploy}=make({others:[FAN,BEA]}),a=deploy(FAN,2,5),z=deploy(BEA,2,6);wound(a);z.hp=z.s.maxHp;z.elem.neural=600;assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[z]);shot(b,u,z);near(z.elem.neural,600-u.s.atk*.5);near(a.hp,100);
});
test('normal CAST reacquires current legal targets while S1 retains START inputs through range departure',()=>{
 for(const active of[false,true]){const{b,u,deploy}=make({others:[FAN,BEA]}),a=deploy(FAN,2,5),z=deploy(BEA,2,7);wound(a);wound(z,500);if(active)cast(b,u);b.forceAttack(u,[a]);advance(b,.2);a.x=9;z.x=5;advance(b,1.2);if(active){assert.ok(a.hp>100);near(z.hp,500);}else{near(a.hp,100/1.06);assert.ok(z.hp>500);}}
});
test('HEAL selection and emitted impacts reject isolation/free/heal-free/noHeal and devices',()=>{
 for(const flag of['isolated','untargetable','healFree','noHeal']){const{b,u,deploy}=make({others:[FAN]}),a=deploy(FAN,2,6);wound(a);a.elem.neural=500;b.addBuff(a,{key:'deny',flags:{[flag]:true}});assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[]);b.removeBuff(a,'deny');b.forceAttack(u,[a]);advance(b,.55);b.addBuff(a,{key:'deny',flags:{[flag]:true}});advance(b,.05);const hp=a.hp;advance(b,.6);near(a.hp,hp);near(a.elem.neural,500);}
 const{b,u,deploy}=make({others:[FAN]}),a=deploy(FAN,2,5);wound(a);a.kind='device';assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[]);
});
test('ordinary/S1/S3 source animation cap1 holds accelerated windup, S2 is uncapped',()=>{
 for(const skill of[0,1,2]){const{b,u,deploy}=make({skill,elite:skill===0?0:skill===1?1:2,rank:skill===0?4:skill===1?7:10,others:[FAN]}),a=deploy(FAN,2,5);wound(a);b.addBuff(u,{key:'fast',mods:{aspd:100}});if(skill!==1) {if(skill===2){cast(b,u);wound(a);}b.forceAttack(u,[a]);advance(b,skill===2?.2:.35);near(a.hp,100);}else{cast(b,u);advance(b,.2);assert.ok(a.hp>100);}}
});
test('S1 active source cap holds.433 event while S3 repeats use fixed.2 timers under foreign BAT/ASPD',()=>{
 const{b,u,deploy}=make({others:[FAN]}),a=deploy(FAN,2,5);wound(a);b.addBuff(u,{key:'speed',mods:{aspd:100,batPct:.5}});cast(b,u);near(effectiveProfile(u).windup(b,u),.433);
 const q=make({skill:2,others:[FAN]}),z=q.deploy(FAN,2,5);wound(z);q.b.addBuff(q.u,{key:'speed',mods:{aspd:100,batPct:.5}});cast(q.b,q.u);const times=[];const h=q.b.on('heal',ctx=>{if(ctx.source===q.u)times.push(q.b.time);});q.b.forceAttack(q.u,[z]);advance(q.b,1.2);q.b.off(h);assert.equal(times.length,5);for(let i=1;i<5;i++)near(times[i]-times[i-1],.2,q.b.dt+1e-6);
});
test('unborn ordinary heal is canceled by sub-tick controls, born flight survives owner removal',()=>{
 for(const status of['stun','freeze','sleep','levitate']){const{b,u,deploy}=make({elite:0,rank:4,others:[FAN]}),a=deploy(FAN,2,6);wound(a);b.forceAttack(u,[a]);advance(b,.2);b.applyStatus(u,status,{duration:.001});advance(b,1);near(a.hp,100);}
 const{b,u,deploy}=make({elite:0,rank:4,others:[FAN]}),a=deploy(FAN,2,6);wound(a);b.forceAttack(u,[a]);advance(b,.55);const atk=u.s.atk;b.retreat(u);advance(b,.5);near(a.hp-100,atk);
});
test('T1 promotion sources delay first1s and restore independent HP and EP for4/6seconds',()=>{
 for(const[elite,duration,scale]of[[1,4,.08],[2,6,.1]]){const{b,u,deploy}=make({elite,rank:elite===1?7:10,others:[FAN]}),a=deploy(FAN,2,5);wound(a);a.elem.neural=900;shot(b,u,a,.7);const hp=a.hp,ep=a.elem.neural;assert.ok(a.findBuff('agoat2_t_1'));advance(b,.7);near(a.hp,hp);advance(b,.4);near(a.hp-hp,u.s.atk*scale);near(ep-a.elem.neural,u.s.atk*scale*.5);advance(b,duration);assert.equal(a.findBuff('agoat2_t_1'),null);}
 const q=make({elite:0,rank:4,others:[FAN]}),a=q.deploy(FAN,2,5);wound(a);shot(q.b,q.u,a);assert.equal(a.findBuff('agoat2_t_1'),null);
});
test('T1 common counter caps3, renews lifetime, retains pulse phase and overwrites source ATK snapshot',()=>{
 const{b,u,deploy}=make({others:[FAN]}),a=deploy(FAN,2,5);wound(a);for(let i=0;i<4;i++)shot(b,u,a,.7);let old=a.findBuff('agoat2_t_1');assert.equal(old.data.count,3);assert.ok(old.timeLeft>5.7);const phase=old._acc;b.addBuff(u,{key:'atk',mods:{atkPct:.5}});shot(b,u,a,.7);old=a.findBuff('agoat2_t_1');near(old.data.atk,u.s.atk);assert.equal(old.data.count,3);assert.ok(old._acc!==0);assert.ok(phase>=0);
 const hp=a.hp;const until=1-old._acc;advance(b,until+.03);near(a.hp-hp,old.data.atk*.3);
});
test('T1 born healing persists after owner retreat and keeps cached ATK despite later source buffs',()=>{
 const{b,u,deploy}=make({others:[FAN]}),a=deploy(FAN,2,5);wound(a);a.elem.neural=900;shot(b,u,a,.7);const snapshot=a.findBuff('agoat2_t_1').data.atk,hp=a.hp,ep=a.elem.neural;b.addBuff(u,{key:'later',mods:{atkPct:1}});b.retreat(u);const afterRemoval=a.s.maxHp&&a.hp;advance(b,1);near(a.hp-afterRemoval,snapshot*.1);near(ep-a.elem.neural,snapshot*.05);
});
test('T1 actual direct periodic healing obeys heal immunity and does not use HP-regeneration scaler',()=>{
 for(const flag of['healFree','noHeal','hpRegen0']){const{b,u,deploy}=make({others:[FAN]}),a=deploy(FAN,2,5);wound(a);a.elem.neural=900;shot(b,u,a,.7);const hp=a.hp,ep=a.elem.neural;b.addBuff(a,{key:'deny',...(flag==='hpRegen0'?{mods:{hpRegenMul:0}}:{flags:{[flag]:true}})});advance(b,1);near(a.hp-hp,flag==='hpRegen0'?u.s.atk*.1:0);near(ep-a.elem.neural,flag==='hpRegen0'?u.s.atk*.05:0);}
});
test('T2 source promotion/potential applies HP percentage and nonstacking elemental protection',()=>{
 for(const[elite,potential,hp]of[[0,1,0],[1,1,0],[2,1,.06],[2,5,.08]]){const{b,u,deploy}=make({elite,potential,rank:elite===0?4:elite===1?7:10,others:[FAN]}),a=deploy(FAN,2,5);near(a.s.maxHp,a.base.maxHp*(1+hp));element(b,a,100);near(a.elem.neural,elite===2?88:100);}
});
test('T2 purpose0 includes legal unhealable tokens/operators, rejects isolation/free and detaches on range loss',()=>{
 const{b,u,deploy}=make({others:[VUL]}),a=deploy(VUL,2,5);near(a.s.maxHp,a.base.maxHp*1.06);near(a.s.elemTakenMul,.88);for(const flag of['isolated','untargetable']){b.addBuff(a,{key:'deny',flags:{[flag]:true}});advance(b,.05);near(a.s.maxHp,a.base.maxHp);near(a.s.elemTakenMul,1);b.removeBuff(a,'deny');advance(b,.05);near(a.s.elemTakenMul,.88);}a.x=9;advance(b,.05);near(a.s.elemTakenMul,1);a.x=5;advance(b,.05);near(a.s.elemTakenMul,.88);b.retreat(u);near(a.s.maxHp,a.base.maxHp);near(a.s.elemTakenMul,1);
});
test('T2 overlaps canonical Berry protection once and restores weaker protection after producer removal',()=>{
 const{b,u,deploy}=make({others:[FAN,BEA]}),a=deploy(FAN,2,5),z=deploy(BEA,2,6);registerBerryProtection(b,z,.3,()=>true,()=>z.alive&&z.deployed)();near(a.s.elemTakenMul,.7);b.retreat(z);advance(b,.05);near(a.s.elemTakenMul,.88);b.retreat(u);near(a.s.elemTakenMul,1);
});
test('strongest T2 HP source remains one channel with independent weaker fallback',()=>{
 const{b,u,deploy}=make({others:[FAN,BEA]}),a=deploy(FAN,2,5),z=deploy(BEA,2,6);secondProducer(b,u,z,{scale:2});advance(b,.05);near(a.s.maxHp,a.base.maxHp*1.12);near(a.s.elemTakenMul,.76);assert.equal(a.buffs.filter(x=>x.key==='agoat2_t_2[maxhp]').length,1);b.retreat(z);advance(b,.05);near(a.s.maxHp,a.base.maxHp*1.06);near(a.s.elemTakenMul,.88);
});
test('S1 AUTO fullSP activates without allies and remains infinite with selected ATK/ranks',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u}=make({rank});u.skill.setSpTotal(u.skill.spCost);advance(b,.1);assert.equal(u.skill.active,true);near(u.s.atk,u.base.atk*(1+bb(0,rank).atk));advance(b,5);assert.equal(u.skill.active,true);}
});
test('S1 two START targets produce one cycle and normal T1 on both without damaging enemies',()=>{
 const{b,u,deploy}=make({others:[FAN,BEA]}),a=deploy(FAN,2,5),z=deploy(BEA,2,6);wound(a);wound(z,500);cast(b,u);assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[a,z]);const attacks=u.stats.attacks;b.forceAttack(u,[a,z]);advance(b,.9);near(a.hp-100,u.s.atk);near(z.hp-500,u.s.atk);assert.equal(u.stats.attacks-attacks,1);assert.equal(a.findBuff('agoat2_t_1').data.count,1);assert.equal(z.findBuff('agoat2_t_1').data.count,1);
});
test('S1 aura independently restores EP after1s even on fullHP/heal-free/free recipients, rejects isolation',()=>{
 for(const flag of['none','healFree','noHeal','untargetable','isolated']){const{b,u,deploy}=make({others:[FAN]}),a=deploy(FAN,2,5);a.elem.neural=900;if(flag!=='none')b.addBuff(a,{key:'deny',flags:{[flag]:true}});cast(b,u);advance(b,.9);near(a.elem.neural,900);advance(b,.2);near(a.elem.neural,900-(flag==='isolated'?0:u.s.atk*.08));}
});
test('S1 aura range/source reentry restarts delayed pulse and live owner ATK is used',()=>{
 const{b,u,deploy}=make({others:[FAN]}),a=deploy(FAN,2,5);a.elem.neural=900;cast(b,u);advance(b,.5);a.x=9;advance(b,.1);a.x=5;advance(b,.8);near(a.elem.neural,900);b.addBuff(u,{key:'more-atk',mods:{atkPct:.2}});advance(b,.3);near(a.elem.neural,900-u.s.atk*.08);const ep=a.elem.neural;b.retreat(u);advance(b,1.3);near(a.elem.neural,ep);
});
test('S2 all-rank single charge heals every legal recipient at.267 and creates exactly one owner pool',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u,deploy}=make({skill:1,rank,others:[FAN,BEA]}),a=deploy(FAN,2,5),z=deploy(BEA,2,6);wound(a);wound(z,500);a.elem.neural=600;z.elem.burn=600;cast(b,u);advance(b,.2);near(a.hp,100);assert.equal(u.mem.eyjaBarrier,undefined);advance(b,.2);near(a.hp-100,u.s.atk);near(z.hp-500,u.s.atk);near(a.elem.neural,600-u.s.atk*.5);near(z.elem.burn,600-u.s.atk*.5);near(u.mem.eyjaBarrier.value,u.s.atk*bb(1,rank)['agoat2_s_2[shield].atk_scale']);assert.equal(u.skill.maxCharges,1);assert.equal(a.findBuff('agoat2_t_1'),null);}
});
test('S2 no-target command still creates barrier and cast tail holds ordinary attacks/SP through full source clip',()=>{
 const{b,u}=make({skill:1});cast(b,u);advance(b,.4);assert.ok(u.mem.eyjaBarrier);assert.equal(u.s.flags.disarm,true);assert.equal(u.s.flags.noSp,true);near(u.skill.spTotal,0);advance(b,.5);near(u.skill.spTotal,0);advance(b,.25);assert.equal(u.mem.eyjaCast,null);assert.equal(!!u.s.flags.disarm,false);assert.ok(u.skill.spTotal>0);
});
test('S2 transient predelay controls cancel unborn heal/barrier and tail controls preserve emitted pool',()=>{
 for(const status of['stun','freeze','sleep','levitate']){const{b,u,deploy}=make({skill:1,others:[FAN]}),a=deploy(FAN,2,5);wound(a);cast(b,u);advance(b,.1);b.applyStatus(u,status,{duration:.001});advance(b,1.2);near(a.hp,100);assert.equal(u.mem.eyjaBarrier,undefined);assert.equal(u.mem.eyjaCast,null);}
 const{b,u}=barrier();b.applyStatus(u,'stun',{duration:1});assert.ok(u.mem.eyjaBarrier);advance(b,.5);assert.ok(u.mem.eyjaBarrier);
});
test('S2 shared pool absorbs successive recipients/allfive element types after final protection',()=>{
 const{b,u,a,z}=barrier();const total=u.mem.eyjaBarrier.value;for(const[i,type]of['neural','burn','necrosis','apoptosis','erosion'].entries()){const recipient=i%2?a:z;element(b,recipient,100,type);near(recipient.elem[type],0);}near(u.mem.eyjaBarrier.value,total-5*88);assert.equal(a.buffs.filter(x=>x.shield>0).length,0);assert.equal(z.buffs.filter(x=>x.shield>0).length,0);
});
test('S2 partial capacity releases exact post-resistance remainder and incoming modifier priority is respected',()=>{
 const{b,u,a}=barrier();u.mem.eyjaBarrier.value=50;const hook=b.on('elementHit',ctx=>{ctx.dmg.amount*=2;},{priority:0});element(b,a,100);near(a.elem.neural,126);near(u.mem.eyjaBarrier.value,-126);b.off(hook);advance(b,.15);assert.equal(u.mem.eyjaBarrier,null);
});
test('S2 lower-priority pool composes canonical foreign protection and raw EP resistance without double scaling',()=>{
 const{b,u,a,z}=barrier();registerBerryProtection(b,z,.3,()=>true,()=>z.alive&&z.deployed)();a.def=structuredClone(a.def);a.def.epResistance=20;u.mem.eyjaBarrier.value=40;element(b,a,100);near(a.elem.neural,16);near(u.mem.eyjaBarrier.value,-16);
});
test('S2 exact zero pool survives source strictLT0 and next hit produces gauge damage then delayed cleanup',()=>{
 const{b,u,a}=barrier();u.mem.eyjaBarrier.value=88;element(b,a,100);near(u.mem.eyjaBarrier.value,0);near(a.elem.neural,0);advance(b,.2);assert.ok(u.mem.eyjaBarrier);element(b,a,10);near(a.elem.neural,8.8);assert.ok(u.mem.eyjaBarrier);advance(b,.15);assert.equal(u.mem.eyjaBarrier,null);
});
test('S2 non-element/canceled/burst-locked damage never consumes the owner shared barrier',()=>{
 const{b,u,a}=barrier();wound(a,50000);const value=u.mem.eyjaBarrier.value;b.dealDamage(null,a,{amount:100,type:'true',canDodge:false});near(u.mem.eyjaBarrier.value,value);b.loseHp(a,100);near(u.mem.eyjaBarrier.value,value);const h=b.on('elementHit',ctx=>{ctx.dmg.cancel=true;},{priority:1});element(b,a,100);near(u.mem.eyjaBarrier.value,value);b.off(h);b.applyStatus(a,'neuralBurst',{duration:2});element(b,a,100);near(u.mem.eyjaBarrier.value,value);
});
test('S2 nearby purpose0 barrier includes unhealable allies but excludes free/isolation and outside range',()=>{
 for(const flag of['none','noHeal','healFree','untargetable','isolated','far']){const{b,u,a}=barrier({others:[FAN]});if(flag==='far')a.x=9;else if(flag!=='none')b.addBuff(a,{key:'deny',flags:{[flag]:true}});const value=u.mem.eyjaBarrier.value;element(b,a,100);const allowed=!['untargetable','isolated','far'].includes(flag);near(u.mem.eyjaBarrier.value,value-(allowed?88:0));near(a.elem.neural,allowed?0:88);}
});
test('S2 renews selected lifetime/replaces ATK capacity, expires by.1 checker and cleans on owner withdrawal',()=>{
 const{b,u,a}=barrier({rank:1});element(b,a,100);advance(b,2);b.addBuff(u,{key:'atk',mods:{atkPct:.5}});cast(b,u);advance(b,1.1);near(u.mem.eyjaBarrier.value,u.s.atk*3.5);const remaining=u.mem.eyjaBarrier.endAt-b.time;assert.ok(remaining<10&&remaining>8);advance(b,remaining+.2);assert.equal(u.mem.eyjaBarrier,null);cast(b,u);advance(b,1.1);assert.ok(u.mem.eyjaBarrier);b.retreat(u);assert.equal(u.mem.eyjaBarrier,null);
});
test('S3 all ranks scale both global T2 keys and restore normal scope after originalEnd fallback',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u,deploy}=make({skill:2,rank,others:[FAN]}),a=deploy(FAN,2,7);a.x=9;advance(b,.05);near(a.s.maxHp,a.base.maxHp);cast(b,u);near(a.s.maxHp,a.base.maxHp*(1+.06*bb(2,rank).talent_scale));near(a.s.elemTakenMul,1-.12*bb(2,rank).talent_scale);u.skill.end('duration');advance(b,.35);near(a.s.elemTakenMul,1-.12*bb(2,rank).talent_scale);assert.equal(u.profile.noAttack,true);advance(b,.25);near(a.s.elemTakenMul,1);near(a.s.maxHp,a.base.maxHp);assert.equal(u.profile.noAttack,false);}
});
test('S3 five separate native heal pulses prefer different current targets with single attack accounting',()=>{
 const{b,u,deploy}=make({skill:2,others:[FAN,BEA,KRO]}),a=deploy(FAN,2,5),z=deploy(BEA,2,6),k=deploy(KRO,4,4);for(const v of[a,z,k]){wound(v);v.elem.neural=900;}cast(b,u);for(const v of[a,z,k])wound(v);const hits=[];const h=b.on('heal',ctx=>{if(ctx.source===u)hits.push([b.time,ctx.target.id,ctx.amount]);});const attacks=u.stats.attacks;b.forceAttack(u,[a]);advance(b,.25);assert.equal(hits.length,0);advance(b,.95);b.off(h);assert.equal(hits.length,5);assert.equal(new Set(hits.slice(0,3).map(x=>x[1])).size,3);for(const[,id,amount] of hits)near(amount,u.s.atk*.6);assert.equal(u.stats.attacks-attacks,1);assert.ok(hits[1][0]-hits[0][0]>=.19);assert.equal(hits[2][0]-hits[1][0]>=.19,true);
});
test('S3 single target fallback completes five heals and normal-heal T1 caps3',()=>{
 const{b,u,deploy}=make({skill:2,others:[FAN]}),a=deploy(FAN,2,5);wound(a);cast(b,u);wound(a);shot(b,u,a,1.2);near(a.hp-100,u.s.atk*.6*5);assert.equal(a.findBuff('agoat2_t_1').data.count,3);
});
test('S3 repeated pulses use currentATK and current legal targets; withdrawn first input does not cancel later repeats',()=>{
 const{b,u,deploy}=make({skill:2,others:[FAN,BEA]}),a=deploy(FAN,2,5),z=deploy(BEA,2,6);wound(a);wound(z,500);cast(b,u);wound(a);wound(z,500);b.forceAttack(u,[a]);advance(b,.4);assert.ok(a.hp>100);b.retreat(a);b.addBuff(u,{key:'atk',mods:{atkPct:.5}});advance(b,.8);near(z.hp-500,u.s.atk*.6*4);
});
test('S3 retains valid START input but dead/isolated input can hand off the noninterrupting repeat sequence',()=>{
 for(const state of['dead','isolated']){const{b,u,deploy}=make({skill:2,others:[FAN,BEA]}),a=deploy(FAN,2,5),z=deploy(BEA,2,6);wound(a);wound(z,500);cast(b,u);wound(a);wound(z,500);b.forceAttack(u,[a]);advance(b,.1);if(state==='dead')b.kill(a,{reason:'source-test'});else b.addBuff(a,{key:'deny',flags:{isolated:true}});advance(b,1.1);near(z.hp-500,u.s.atk*.6*5);if(state==='isolated')near(a.hp,100/1.3);}
});
test('S3 remaining unborn repeats cancel on transient control/skill end/owner removal, preserving already emitted healing',()=>{
 for(const finish of['control','end','retreat']){const{b,u,deploy}=make({skill:2,others:[FAN]}),a=deploy(FAN,2,5);wound(a);cast(b,u);wound(a);b.forceAttack(u,[a]);advance(b,.4);near(a.hp-100,u.s.atk*.6);const hp=a.hp;if(finish==='control')b.applyStatus(u,'stun',{duration:.001});else if(finish==='end')u.skill.end('duration');else b.retreat(u);advance(b,.7);near(a.hp,finish==='end'?hp*1.06/1.3:finish==='retreat'?hp/1.3:hp);}
});
test('S3 starts no ordinary attack without an injured ally and emptyEnd does not invent healing',()=>{
 const{b,u,deploy}=make({skill:2,others:[FAN]}),a=deploy(FAN,2,5);cast(b,u);assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[]);advance(b,.5);wound(a);const hp=a.hp;u.skill.end('duration');advance(b,.6);near(a.hp,hp*1.06/1.3);
});
