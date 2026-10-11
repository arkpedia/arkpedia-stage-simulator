// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test'; import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import source from '../data/arkpedia-support-aura-prefabs.json' with {type:'json'};
import { SUPPORT_AURA_OPERATORS as configs } from '../shared/arkpedia/support-aura-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, acquireTargets } from '../server/sim/ai.js';
import { installSupportAura } from '../server/sim/content/arkpedia-support-auras.js';
const HEI='char_4045_heidi',ANG='char_291_aglina',SUZ='char_358_lisa',FAN='char_123_fang',BEA='char_122_beagle',VUL='char_163_hpsts',SOR='char_101_sora',PTI='char_128_plosis',KRO='char_124_kroos';
const near=(x,y,t=1e-5)=>assert.ok(Math.abs(x-y)<t,`${x} != ${y}`);
const advance=(b,s)=>{for(let i=0;i<Math.round(s/b.dt);i++)b.step();assert.deepEqual(b.errors,[]);};
function build(id,{skill=0,rank=10,elite=2,potential=1}={}){const o=data.operators[id];assert.ok(o,`Snapshot needs ${id}`);return{...defaultBuild(o),elite,level:o.phases[elite].maxLevel,potential,skillId:o.skills[skill].id,skillRank:rank};}
function make(id,{skill=0,rank=10,elite=2,potential=1,others=[],tags=[]}={}){const src=structuredClone(data);src.stage.geometry.waves[0].spawns=[];src.stage.battle.dp_per_second=0;src.stage.mapTags=tags;const b=new StandardBattle(src,{operators:[build(id,{skill,rank,elite,potential}),...others.map(q=>typeof q==='string'?defaultBuild(src.operators[q]):q)]});b.autoFinish=false;b.setViewport('fullscreen-workspace');const deploy=(who=id,r=who===HEI||who===ANG||who===SUZ||who===SOR||who===PTI?1:2,c=4,dir='UP')=>{b.addDp('arkpedia',99);const u=b.deployOperator(who,r,c,dir);assert.ok(u,`${who} ${r},${c}`);u.atkCd=1000;return u;};return{b,deploy};}
const wound=(u,hp=100,max=100000)=>{u.base.maxHp=max;u.markDirty();void u.s;u.hp=hp;};
function enemy(b,x=4,y=3){const e=b.spawnEnemy('enemy_1007_slime',{routeIndex:1});e.x=x;e.y=y;e.base.maxHp=100000;e.base.def=e.base.res=e.base.moveSpeed=0;e.markDirty();void e.s;e.hp=100000;b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.manual?b.activateOperator(u.defId):u.skill.activate('test'),true);u.atkCd=1000;}
const rows=[...Object.values(source.characters).flat(),...Object.values(source.skills).flat()];
const row=p=>rows.find(r=>r.pathId===p).data;

test('all eight selected source skills and original hashes, aliases, timings and primary nonstack terms are retained',()=>{
 assert.equal(Object.values(configs).flatMap(c=>c.skillIds).length,8);assert.equal(source.frameParity,false);
 for(const[id,c]of Object.entries(configs)){assert.match(source.sourceBundles.find(x=>x.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);for(const f of['Front','Back'])assert.match(source.models[id][f].sha256,/^[a-f0-9]{64}$/);for(const s of c.skillIds)assert.equal(source.tableContracts[id].skills[s].length,10);}
 assert.match(source.gameTerms['ba.inspire'].description,/strongest/);assert.match(source.gameTerms['ba.weightless'].description,/do not stack/);
 assert.equal(source.buffTemplates['hp_to_hp[final_addition]'].eventToActions.ON_BUFF_TRIGGER[0]._formulaType,'FINAL_ADDITION');
 for(const id of[HEI,ANG])assert.equal(source.models[id].Front.path,source.models[id].Back.path);
 assert.ok(source.originalChararts[ANG].rows.some(r=>r.data._animations?.some(a=>a.animKey==='Skill_2_Begin'&&a.animName==='Skill1_Begin')));
 near(row('-8255035156222705407')._buffs[0].triggerInterval,.03);assert.equal(row('-8255035156222705407')._buffs[0].waitFirstTriggerInterval,1);
 near(row('4036527608785600769')._buffs[0].triggerInterval,1);assert.equal(row('4036527608785600769')._buffs[0].waitFirstTriggerInterval,1);
 assert.equal(row('-7522688794400547836')._targetOptions.purposeMask,0);
});

test('every selected rank creates the exact full kit; E0/E1 gates do not leak future talents',()=>{
 for(const[id,c]of Object.entries(configs))for(let skill=0;skill<c.skillIds.length;skill++)for(let rank=1;rank<=10;rank++){const{b,deploy}=make(id,{skill,rank}),u=deploy();assert.equal(u.skill.id,c.skillIds[skill]);assert.equal(u.skill.noSkill,false);assert.deepEqual(b.errors,[]);}
 for(const id of Object.keys(configs)){const{b,deploy}=make(id,{elite:0,rank:4}),u=deploy();assert.equal(u.def.talents.length,0);assert.deepEqual(b.errors,[]);}
});

test('Heidi never attacks and default recovery uses original immediate pulse/1sec/liveATK/finalregeneration',()=>{
 const{b,deploy}=make(HEI,{others:[FAN,VUL]}),a=deploy(FAN,2,3),v=deploy(VUL,2,5);wound(a);wound(v);const u=deploy(),e=enemy(b);advance(b,.05);assert.equal(e.hp,100000);near(a.hp-100,u.s.atk*.1);near(v.hp-100,u.s.atk*.1);const hp=a.hp;advance(b,.8);near(a.hp,hp);b.addBuff(u,{key:'test:atk',mods:{atkPct:.5}});b.addBuff(v,{key:'test:zero',mods:{hpRegenMul:0}});advance(b,.25);near(a.hp-hp,u.s.atk*.1);near(v.hp,100+u.base.atk*1.05*.1);b.retreatOperator(HEI);const now=a.hp;advance(b,2);near(a.hp,now);
});

test('Heidi selected talent switchesATK/DEF, promotion/potential source values and aura legality independent of HealFree',()=>{
 for(const[skill,elite,potential,value]of[[0,1,1,.02],[0,2,5,.06],[1,1,5,.03],[1,2,1,.05]]){const{b,deploy}=make(HEI,{skill,elite,potential,rank:elite===1?7:10,others:[VUL]}),u=deploy(),a=deploy(VUL,2,3);b.addBuff(a,{key:'test:isolated',flags:{isolated:true,untargetable:true}});advance(b,.05);near(skill===0?a.s.atk:a.s.def,(skill===0?a.base.atk:a.base.def)*(1+value));b.retreat(u);near(skill===0?a.s.atk:a.s.def,skill===0?a.base.atk:a.base.def);}
});

test('Heidi S1 allrank block-3 and finalATK Inspiration remain distinct recipient channels',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make(HEI,{rank,others:[BEA]}),u=deploy(),a=deploy(BEA,2,3);b.addBuff(a,{key:'test:atk',mods:{atkPct:.4,atkMul:1.2,atkFinalFlat:11}});const before=a.s.atk;cast(b,u);near(a.s.atk,before+u.s.atk*u.def.skill.bb.atk);near(a.s.blockCnt,0);near(u.s.blockCnt,0);assert.equal(u.findBuff(`heidi:inspire:${u.id}`),null);u.skill.end('test');near(a.s.atk,before);near(a.s.blockCnt,3);}
});

test('Heidi S2 allrank DEF/MAXHP final addition follows percent/scalars and source Block+1',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make(HEI,{skill:1,rank,others:[BEA]}),u=deploy(),a=deploy(BEA,2,3);b.addBuff(a,{key:'test:stats',mods:{defPct:.5,defMul:1.1,hpPct:.2,hpMul:1.3}});const def=a.s.def,hp=a.s.maxHp;cast(b,u);near(a.s.def,def+u.s.def*u.def.skill.bb.def);near(a.s.maxHp,hp+u.s.maxHp*u.def.skill.bb.max_hp);near(a.s.blockCnt,4);u.skill.end('test');near(a.s.def,def);near(a.s.maxHp,hp);near(a.s.blockCnt,3);}
});

test('Heidi Inspiration samples live producer stats each1sec and source detach removes pending checker',()=>{
 const{b,deploy}=make(HEI,{others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);cast(b,u);const bonus=a.s.atk-a.base.atk*1.05;b.addBuff(u,{key:'test:atk',mods:{atkPct:.5}});advance(b,.8);near(a.s.atk-a.base.atk*1.05,bonus);advance(b,.25);near(a.s.atk-a.base.atk*1.05,u.s.atk*1.1);b.retreat(u);near(a.s.atk,a.base.atk);assert.equal(a.findBuff(`heidi:inspire-checker:${u.id}`),null);
});

test('Heidi/Sora independent Inspiration strongest perstat with expiry fallback and explicit noInspire/Bard immunity',()=>{
 const{b,deploy}=make(HEI,{others:[build(SOR,{skill:1}),FAN]}),u=deploy(),sora=deploy(SOR,1,5),a=deploy(FAN,2,5);b.addBuff(sora,{key:'test:atk',mods:{atkPct:3}});cast(b,sora);cast(b,u);advance(b,.05);assert.ok(sora.s.atk*sora.def.skill.bb.atk>u.s.atk*1.1);near(a.s.atk,a.base.atk*1.05+u.s.atk*1.1);b.retreat(u);advance(b,.05);near(a.s.atk,a.base.atk+sora.s.atk*sora.def.skill.bb.atk);a.mem.noInspire=true;advance(b,.05);near(a.s.atk,a.base.atk);assert.equal(u.findBuff(`sora:inspiration:${sora.id}`),null);
});

test('Heidi block/recovery exclude isolation, Inspiration includes isolation but rejects immune_to_encourage',()=>{
 const{b,deploy}=make(HEI,{skill:1,others:[VUL]}),u=deploy(),a=deploy(VUL,2,3);wound(a);b.addBuff(a,{key:'test:isolated',flags:{isolated:true,untargetable:true}});cast(b,u);advance(b,.05);near(a.s.blockCnt,a.base.blockCnt);assert.ok(a.s.maxHp>a.base.maxHp);const hp=a.hp;advance(b,1.1);near(a.hp,hp);b.addBuff(a,{key:'immune_to_encourage'});advance(b,.05);near(a.s.maxHp,a.base.maxHp);b.removeBuff(a,'test:isolated');b.removeBuff(a,'immune_to_encourage');advance(b,.05);near(a.s.blockCnt,a.base.blockCnt+1);
});

test('Heidi S2 stronger heal starts immediate and owned clocks reset at both skill boundaries',()=>{
 const{b,deploy}=make(HEI,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);advance(b,.05);const hp=a.hp,max=a.s.maxHp;cast(b,u);near(a.hp,(max+u.s.maxHp*.3)*hp/max+u.s.atk*.3);const old=a.hp,skillMax=a.s.maxHp;u.skill.end('test');near(a.hp,old*max/skillMax+u.s.atk*.1);const rest=a.hp;advance(b,.8);near(a.hp,rest);
});

test('Heidi main10/E2 SP aura range/maptag gate and highest Ptilopsis channel preserve active/noSP restrictions',()=>{
 for(const tags of[[],['main_10']]){const{b,deploy}=make(HEI,{tags,others:[FAN,defaultBuild(data.operators[PTI])]}),u=deploy(),a=deploy(FAN,2,3),p=deploy(PTI,1,5);advance(b,.05);near(a.s.spRecovery,tags.length?1.5:1.3);a.skill.setSpTotal(0);advance(b,1);near(a.skill.sp,tags.length?1.5:1.3);b.addBuff(a,{key:'test:noSp',flags:{noSp:true}});const before=a.skill.sp;advance(b,1);near(a.skill.sp,before);b.removeBuff(a,'test:noSp');b.retreat(u);near(a.s.spRecovery,1.3);b.retreat(p);near(a.s.spRecovery,1);}
 const{b,deploy}=make(HEI,{elite:1,rank:7,tags:['main_10'],others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);advance(b,.05);near(a.s.spRecovery,1);
});

test('Angelina whole-map ASPD/idleHP regeneration include highground/unhealable; isolation/sourcewithdraw remove only owned effects',()=>{
 const{b,deploy}=make(ANG,{others:[VUL,KRO]}),u=deploy(),a=deploy(VUL,3,3),k=deploy(KRO,1,7);wound(a);wound(k);advance(b,1);near(a.s.aspd,107);near(k.s.aspd,107);near(a.hp-100,20);near(k.hp-100,20);b.addBuff(a,{key:'test:isolated',flags:{isolated:true}});advance(b,.05);near(a.s.aspd,100);near(a.s.hpRegen,0);b.addBuff(k,{key:'test:zero',mods:{hpRegenMul:0}});const hp=k.hp;advance(b,1);near(k.hp,hp);b.retreat(u);near(k.s.aspd,100);near(k.s.hpRegen,0);
});

test('Angelina selectedpromotion/potential talents remain exact and idle recovery stops for allthree skills',()=>{
 for(const[elite,potential,speed,heal]of[[1,1,3,0],[1,6,4,0],[2,1,7,20],[2,6,8,25]]){const{b,deploy}=make(ANG,{elite,potential,rank:elite===1?7:10,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);advance(b,.05);near(a.s.aspd,100+speed);near(a.s.hpRegen,heal);}
 for(let skill=0;skill<3;skill++){const{b,deploy}=make(ANG,{skill,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);advance(b,.05);near(a.s.hpRegen,20);cast(b,u);near(a.s.hpRegen,0);near(a.s.aspd,107);u.skill.end('test');near(a.s.hpRegen,20);}
});

test('Angelina S1 normal Arts/sluggish fixed original event/cap1/projectile10 and offensive autoactivation',()=>{
 const{b,deploy}=make(ANG),u=deploy(),e=enemy(b);b.forceAttack(u,[e]);advance(b,.6);near(e.hp,100000);advance(b,.3);near(100000-e.hp,u.s.atk);assert.ok(e.findBuff('sluggish'));near(e.findBuff('sluggish').duration,.8);u.skill.setSpTotal(u.skill.spCost);advance(b,.05);assert.equal(u.skill.active,true);near(u.s.atk,u.base.atk*2.1);
});

test('Angelina S2/S3 cannot attack idle and source startup aliases preserve full .5second lock',()=>{
 for(const skill of[1,2]){const{b,deploy}=make(ANG,{skill}),u=deploy(),e=enemy(b);u.atkCd=0;advance(b,1);near(e.hp,100000);assert.equal(u.mem.regularFormVisual.clip,'Idle_Charge');cast(b,u);u.atkCd=0;assert.equal(u.mem.regularFormVisual.clip,'Skill1_Begin');advance(b,.45);near(e.hp,100000);advance(b,.65);assert.ok(e.hp<100000);u.skill.end('test');advance(b,.6);assert.equal(u.mem.regularFormVisual.clip,'Idle_Charge');const hp=e.hp;u.atkCd=0;advance(b,1);near(e.hp,hp);}
});

test('Angelina S2 allrank finalBAT scalar, source outputArts scale and rapid natural attacks',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make(ANG,{skill:1,rank}),u=deploy(),e=enemy(b);e.base.res=30;e.markDirty();cast(b,u);near(u.s.interval,u.base.bat*u.def.skill.bb.base_attack_time*100/u.s.aspd);advance(b,.55);b.forceAttack(u,[e]);advance(b,.4);near(100000-e.hp,u.s.atk*u.def.skill.bb.damage_scale*.7);}
 const{b,deploy}=make(ANG,{skill:1}),u=deploy(),e=enemy(b);cast(b,u);advance(b,.55);u.atkCd=0;advance(b,1.05);assert.ok(100000-e.hp>=u.s.atk*.45*3);assert.deepEqual(b.errors,[]);
});

test('Angelina S3 selectedrange/maxfive/ATK and global namedweightless do not stack with another same-name source',()=>{
 const{b,deploy}=make(ANG,{skill:2}),u=deploy();const foes=Array.from({length:6},(_,i)=>enemy(b,3+i*.3,3));for(const e of foes){e.base.massLevel=3;e.markDirty();}const far=enemy(b,12,5);far.base.massLevel=3;far.markDirty();b.applyStatus(far,'weightless',{key:'other:weight',value:1});cast(b,u);near(u.s.atk,u.base.atk*2.5);assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,5);for(const e of foes)near(e.weight,2);near(far.weight,2);u.skill.end('test');for(const e of foes)near(e.weight,3);near(far.weight,2);b.removeBuff(far,'other:weight');near(far.weight,3);
});

test('Angelina nonHEAL global weight aura retainsstealth/Sleep/air, rejects disappeared/targetfree, and respects original source expiry',()=>{
 const{b,deploy}=make(ANG,{skill:2}),u=deploy(),stealth=enemy(b),sleep=enemy(b),air=enemy(b),hidden=enemy(b),free=enemy(b);for(const e of[stealth,sleep,air,hidden,free]){e.base.massLevel=2;e.markDirty();}b.addBuff(stealth,{key:'test:stealth',flags:{stealth:true}});b.applyStatus(sleep,'sleep');air.motion='FLY';hidden.hidden=true;b.addBuff(free,{key:'test:free',flags:{untargetable:true}});cast(b,u);for(const e of[stealth,sleep,air])near(e.weight,1);for(const e of[hidden,free])near(e.weight,2);advance(b,25.05);for(const e of[stealth,sleep,air])near(e.weight,2);
});

test('Suzuran global named SP boosts only SUPPORT, chooses highest live recovery and excludes isolation',()=>{
 const{b,deploy}=make(SUZ,{others:[ANG,FAN,PTI]}),u=deploy(),a=deploy(ANG,1,5),f=deploy(FAN,2,3),p=deploy(PTI,1,7);advance(b,.05);near(a.s.spRecovery,1.4);near(f.s.spRecovery,1.3);b.addBuff(a,{key:'test:isolate',flags:{isolated:true}});advance(b,.05);near(a.s.spRecovery,1);b.removeBuff(a,'test:isolate');advance(b,.05);b.retreat(u);near(a.s.spRecovery,1.3);b.retreat(p);near(a.s.spRecovery,1);
});

test('Suzuran Fragile delayed checker requires namedSluggish, not an unrelated move multiplier',()=>{
 const{b,deploy}=make(SUZ),u=deploy(),e=enemy(b);b.addBuff(e,{key:'test:movement',mods:{moveMul:.2}});advance(b,.1);near(e.s.dmgTakenMul,1);b.applyStatus(e,'sluggish',{key:'other:slow',duration:.8});near(e.s.dmgTakenMul,1);advance(b,.05);near(e.s.dmgTakenMul,1.2);b.removeBuff(e,'other:slow');advance(b,.05);near(e.s.dmgTakenMul,1);b.applyStatus(e,'sluggish',{duration:2});advance(b,.05);near(e.s.dmgTakenMul,1.2);b.retreat(u);near(e.s.dmgTakenMul,1);assert.ok(e.findBuff('sluggish'));
});

test('Suzuran Fragile potential and stronger owned channel fallback survive another source leaving',()=>{
 const{b,deploy}=make(SUZ,{potential:5,others:[FAN]}),u=deploy(),e=enemy(b),a=deploy(FAN,2,3);b.applyStatus(e,'sluggish',{duration:10});b.applyStatus(e,'fragile',{key:'other:fragile',value:.3});advance(b,.05);near(e.s.dmgTakenMul,1.3);b.removeBuff(e,'other:fragile');near(e.s.dmgTakenMul,1.23);b.retreat(u);near(e.s.dmgTakenMul,1);
});

test('Suzuran S1 everyrank source ATK/ASPD automatictimed and S2 permanent selectedtargetcount remain exact',()=>{
 for(let rank=1;rank<=10;rank++){for(const skill of[0,1]){const{b,deploy}=make(SUZ,{skill,rank}),u=deploy();cast(b,u);near(u.s.atk,u.base.atk*(1+u.def.skill.bb.atk));near(u.s.aspd,100+(skill===0?u.def.skill.bb.attack_speed:0));if(skill===1){assert.equal(u.skill.spec.manualCancel,undefined);assert.equal(b.activateOperator(SUZ),false);advance(b,35);assert.equal(u.skill.active,true);}else{advance(b,u.def.skill.duration+.1);assert.equal(u.skill.active,false);}}}
});

test('Suzuran S2 original Skill2 cap1 event fires selectedmultitarget Arts/sluggish projectiles',()=>{
 const{b,deploy}=make(SUZ,{skill:1}),u=deploy(),foes=[enemy(b,3.5,3),enemy(b,4,3),enemy(b,4.5,3),enemy(b,5,3)];cast(b,u);const targets=acquireTargets(b,u,effectiveProfile(u));assert.equal(targets.length,3);b.forceAttack(u,targets);advance(b,.75);for(const e of foes)near(e.hp,100000);advance(b,.35);assert.equal(foes.filter(e=>e.hp<100000).length,3);for(const e of targets)assert.ok(e.buffs.some(q=>q.status==='sluggish'));assert.equal(u.skill.active,true);
});

test('Suzuran S3 allrank rangedSluggish/enhancedFragile/noattacks and delayed liveATK regeneration',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make(SUZ,{skill:2,rank,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3),e=enemy(b,4,4);wound(a);cast(b,u);assert.equal(u.s.flags.disarm,true);near(e.s.moveSpeed,0);assert.ok(e.findBuff(`suzuran:sluggish:${u.id}`));advance(b,.1);near(e.s.dmgTakenMul,1+.2*u.def.skill.bb.scale_delta_to_one);near(a.hp,100);advance(b,.95);near(a.hp-100,u.s.atk*u.def.skill.bb['attack@atk_to_hp_recovery_ratio']);near(e.hp,100000);u.skill.end('test');assert.equal(e.findBuff(`suzuran:sluggish:${u.id}`),null);advance(b,.05);near(e.s.dmgTakenMul,1);}
});

test('Suzuran S3 regen bypasses HealFree/noHeal/targetfree but sourcefinal zero/isolation controls eligiblepulses',()=>{
 const{b,deploy}=make(SUZ,{skill:2,others:[VUL,FAN]}),u=deploy(),v=deploy(VUL,2,3),a=deploy(FAN,2,5);wound(v);wound(a);b.addBuff(v,{key:'test:free',flags:{healFree:true,untargetable:true}});b.addBuff(a,{key:'test:zero',mods:{hpRegenMul:0}});cast(b,u);advance(b,1.05);near(v.hp-100,u.s.atk*.2);near(a.hp,100);b.addBuff(v,{key:'test:isolated',flags:{isolated:true}});b.addBuff(u,{key:'test:atk',mods:{atkPct:.5}});const hp=v.hp;advance(b,1.05);near(v.hp,hp);b.removeBuff(v,'test:isolated');advance(b,.9);near(v.hp,hp);advance(b,.15);near(v.hp-hp,u.s.atk*.2);b.retreat(u);const now=v.hp;advance(b,2);near(v.hp,now);
});

test('Suzuran source range leave/hidden/targetfree drops owned slow+checker; death preserves unrelatedSluggish',()=>{
 const{b,deploy}=make(SUZ,{skill:2}),u=deploy(),e=enemy(b),free=enemy(b),hidden=enemy(b);b.addBuff(free,{key:'test:free',flags:{untargetable:true}});hidden.hidden=true;cast(b,u);advance(b,.1);assert.equal(free.findBuff(`suzuran:checker:${u.id}`),null);assert.equal(hidden.findBuff(`suzuran:sluggish:${u.id}`),null);e.x=15;e.y=5;advance(b,.05);assert.equal(e.findBuff(`suzuran:checker:${u.id}`),null);near(e.s.dmgTakenMul,1);e.x=4;e.y=3;b.applyStatus(e,'sluggish',{key:'other:slow',duration:20});advance(b,.05);b.retreat(u);assert.ok(e.findBuff('other:slow'));assert.equal(e.findBuff(`suzuran:checker:${u.id}`),null);near(e.s.dmgTakenMul,1);
});
