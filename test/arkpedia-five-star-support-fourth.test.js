// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with{type:'json'};
import source from '../data/arkpedia-five-star-support-fourth-prefabs.json' with{type:'json'};
import{FIVE_STAR_SUPPORT_FOURTH_OPERATORS as configs}from'../shared/arkpedia/five-star-support-fourth-operators.js';
import{StandardBattle}from'../server/sim/arkpedia.js';import{defaultBuild}from'../shared/arkpedia/loadout.js';
import{acquireTargets,effectiveProfile}from'../server/sim/ai.js';
import{installFiveStarSupportFourth}from'../server/sim/content/arkpedia-five-star-support-fourth.js';
import{enemyStealthed}from'../server/sim/targeting.js';
const NOT='char_455_nothin',TSU='char_343_tknogi',QUE='char_492_quercu',FAN='char_123_fang',BEA='char_122_beagle',VUL='char_163_hpsts',KRO='char_124_kroos';
const near=(x,y,t=1e-5)=>assert.ok(Math.abs(x-y)<t,`${x} != ${y}`);
const advance=(b,s)=>{for(let i=0;i<Math.round(s/b.dt);i++)b.step();assert.deepEqual(b.errors,[]);};
const bb=(id,s,rank=10)=>Object.fromEntries(data.operators[id].skills[s].levels[rank-1].blackboard.map(x=>[x.key,x.value]));
function build(id,{skill=0,rank=10,elite=2,potential=1}={}){const o=data.operators[id];assert.ok(o,`Reviewed snapshot needs ${id}`);return{...defaultBuild(o),elite,level:o.phases[elite].maxLevel,potential,skillId:o.skills[skill].id,skillRank:rank};}
function make(id,{skill=0,rank=10,elite=2,potential=1,others=[]}={}){const src=structuredClone(data);src.stage.geometry.waves[0].spawns=[];src.stage.battle.dp_per_second=0;const b=new StandardBattle(src,{operators:[build(id,{skill,rank,elite,potential}),...others.map(q=>typeof q==='string'?defaultBuild(src.operators[q]):q)]});b.autoFinish=false;b.setViewport('fullscreen-workspace');const deploy=(who=id,r=who===NOT?3:1,c=4,dir='UP')=>{b.addDp('arkpedia',99);const u=b.deployOperator(who,r,c,dir);assert.ok(u,`${who} ${r},${c}`);u.atkCd=1000;return u;};return{b,deploy};}
const wound=(u,hp=100,max=100000)=>{u.base.maxHp=max;u.markDirty();void u.s;u.hp=hp;};
function enemy(b,x=4,y=3){const e=b.spawnEnemy('enemy_1007_slime',{routeIndex:1});e.x=x;e.y=y;e.base.maxHp=100000;e.base.def=e.base.res=e.base.moveSpeed=0;e.markDirty();void e.s;e.hp=100000;b.addBuff(e,{key:'test:pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.manual?b.activateOperator(u.defId):u.skill.activate('test'),true);u.atkCd=1000;}
const row=(rows,p)=>rows.find(r=>r.pathId===p).data;

test('retains original primary bundle bytes, inclusive Sanctuary comparisons, exact literal clips and no false fidelity',()=>{
 for(const[id,c]of Object.entries(configs)){assert.equal(c.skillIds.length,2);assert.match(source.sourceBundles.find(x=>x.path===`charpack/${id}.ab`).sha256,/^[a-f0-9]{64}$/);for(const f of['Front','Back'])assert.match(source.models[id][f].sha256,/^[a-f0-9]{64}$/);}
 assert.equal(source.frameParity,false);assert.equal(source.buffTemplates['damage_resistance[aura]'].eventToActions.ON_BUFF_TRIGGER[0]._conditionNode._condType,'LE');assert.equal(source.buffTemplates['damage_resistance_GE[aura]'].eventToActions.ON_BUFF_TRIGGER[0]._conditionNode._condType,'GE');
 for(const[id,path]of[[TSU,'-7824920971074942445'],[QUE,'-9041218161622603165']]){const checker=row(source.characters[id],path)._buffs[0];near(checker.triggerInterval,.1);assert.equal(checker.waitFirstTriggerInterval,1);}
 assert.equal(source.models[QUE].Front.durations.Skill_begin,.667);assert.equal(source.models[NOT].Front.hits.Attack[0],.367);assert.ok(source.originalChararts[NOT].rows.some(r=>r.data._animations?.some(a=>a.animKey==='Skill_2_Idle'&&a.animName==='Idle_2')));
 assert.equal(row(source.characters[NOT],'-7281888954545959287')._restoreDelay,5);assert.ok(source.runtimeMapping.limits.some(x=>x.includes('delay4')));
});

test('six complete selected skills retain all ten source ranks and E0/E1 promotion gates',()=>{
 for(const id of Object.keys(configs))for(let skill=0;skill<2;skill++)for(let rank=1;rank<=10;rank++){const{b,deploy}=make(id,{skill,rank});const u=deploy();assert.equal(u.skill.id,configs[id].skillIds[skill]);assert.equal(u.skill.noSkill,false);assert.deepEqual(b.errors,[]);}
 for(const id of Object.keys(configs)){const{b,deploy}=make(id,{elite:0,rank:4}),u=deploy();assert.equal(u.def.talents.length,0);assert.deepEqual(b.errors,[]);}
});

test('Mr Nothing original merchant pays3DP/3sec, withdraws on insufficient balance and never refunds',()=>{
 const{b,deploy}=make(NOT),u=deploy();b.getPlayer('arkpedia').dp=10;advance(b,3.05);near(b.dp,7);advance(b,3);near(b.dp,4);b.retreatOperator(NOT);near(b.dp,4);assert.equal(u.alive,false);
 const q=make(NOT),z=q.deploy();q.b.getPlayer('arkpedia').dp=2;advance(q.b,3.1);assert.equal(z.alive,false);near(q.b.dp,2);
});

test('Mr Nothing S1 passive block+1 exists at every rank, active final zero-block overrides external additions',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make(NOT,{rank}),u=deploy();near(u.s.blockCnt,u.base.blockCnt+1);b.addBuff(u,{key:'test:block',mods:{blockCnt:2}});u.hp=u.s.maxHp*.1;cast(b,u);near(u.s.blockCnt,0);assert.equal(u.s.flags.disarm,true);near(u.s.taunt,(u.base.taunt??0)-1);near(u.s.hpRegen,u.s.maxHp*bb(NOT,0,rank).hp_recovery_per_sec_by_max_hp_ratio);u.skill.end('test');near(u.s.blockCnt,u.base.blockCnt+3);near(u.s.hpRegen,0);}
});

test('Mr Nothing S1 auto requires strict HP below20% but no enemy and lasts selected five seconds',()=>{
 const{b,deploy}=make(NOT),u=deploy();u.hp=u.s.maxHp*.2;u.skill.setSpTotal(u.skill.spCost);advance(b,.1);assert.equal(u.skill.active,false);u.hp-=1;advance(b,.05);assert.equal(u.skill.active,true);const hp=u.hp;advance(b,1);near(u.hp-hp,u.s.maxHp*.15);advance(b,4.05);assert.equal(u.skill.active,false);assert.equal(u.mem.regularFormVisual.clip,'Skill_1_End');advance(b,.6);assert.equal(u.mem.regularFormVisual,null);
});

test('Mr Nothing talent selected4sec initial wait, pre-DEF scale, one-attack consumption and accepted stun',()=>{
 for(const[elite,potential,scale,stun]of[[1,1,1.25,3],[1,5,1.3,3],[2,1,1.5,4],[2,5,1.55,4]]){const{b,deploy}=make(NOT,{elite,potential,rank:elite===1?7:10}),u=deploy(),e=enemy(b);e.base.def=100;e.markDirty();b.forceAttack(u,[e]);advance(b,.45);near(100000-e.hp,u.s.atk-100);assert.equal(Boolean(e.s.flags.stun),false);advance(b,3.65);const hp=e.hp;b.forceAttack(u,[e]);advance(b,.45);near(hp-e.hp,u.s.atk*scale-100);assert.equal(e.s.flags.stun,true);near(e.findBuff('nothing:stun').duration,stun);const hp2=e.hp;b.forceAttack(u,[e]);advance(b,.45);near(hp2-e.hp,u.s.atk-100);}
});

test('Mr Nothing talent ignores dodge and cancelled output but accepts absorbed damage event',()=>{
 for(const mode of['dodge','cancel','shield']){const{b,deploy}=make(NOT),u=deploy(),e=enemy(b);advance(b,4.1);if(mode==='dodge')b.addBuff(e,{key:'test:dodge',mods:{dodgePhys:1}});if(mode==='cancel')b.on('hit',c=>{if(c.source===u)c.dmg.cancel=true;});if(mode==='shield')b.addBuff(e,{key:'test:shield',shield:10000});b.forceAttack(u,[e]);advance(b,.45);near(e.hp,100000);assert.equal(Boolean(e.s.flags.stun),mode==='shield');}
});

test('Mr Nothing control interrupts a strike and still resets the attack-owned talent clock',()=>{
 const{b,deploy}=make(NOT),u=deploy(),e=enemy(b);advance(b,4.1);b.forceAttack(u,[e]);advance(b,.1);b.applyStatus(u,'stun',{duration:.1});advance(b,.3);near(e.hp,100000);b.forceAttack(u,[e]);advance(b,.45);near(100000-e.hp,u.s.atk);assert.equal(Boolean(e.s.flags.stun),false);
});

test('Mr Nothing S2 uses selectedATK and three source modes, nonrepeating next choice/manual cancellation',()=>{
 const{b,deploy}=make(NOT,{skill:1}),u=deploy();let previous;const selected=new Set();
 for(const chosen of['a','b','c','a']){b.rng.pick=candidates=>{assert.ok(candidates.includes(chosen));assert.ok(!candidates.includes(previous));return chosen;};cast(b,u);near(u.s.atk,u.base.atk*1.6);selected.add(chosen);if(chosen==='b')near(u.s.aspd,128);if(chosen==='c'){near(u.s.dodgePhys,.5);near(u.s.blockCnt,u.base.blockCnt+1);}assert.equal(u.skill.spec.manualCancel,true);assert.equal(b.activateOperator(NOT),true);assert.equal(u.skill.active,false);near(u.s.atk,u.base.atk);near(u.s.aspd,100);near(u.s.dodgePhys,0);near(u.s.blockCnt,u.base.blockCnt);previous=chosen;advance(b,.4);}
 assert.equal(selected.size,3);
});

test('Mr Nothing S2 A debuff uses original extend refresh and survives ending its source skill',()=>{
 const{b,deploy}=make(NOT,{skill:1}),u=deploy(),e=enemy(b);b.rng.pick=()=> 'a';cast(b,u);advance(b,1.15);b.forceAttack(u,[e]);advance(b,.6);near(e.s.aspd,e.base.aspd-35);advance(b,1);b.forceAttack(u,[e]);advance(b,.6);assert.equal(e.buffs.filter(x=>x.key==='nothin_s_2[a][attack_speed_down]').length,1);b.activateOperator(NOT);near(e.s.aspd,e.base.aspd-35);advance(b,4.5);near(e.s.aspd,e.base.aspd-35);advance(b,.6);near(e.s.aspd,e.base.aspd);
});

test('Mr Nothing S2 normal loops cannot attack until the entire source1.1begin clip finishes',()=>{
 const{b,deploy}=make(NOT,{skill:1}),u=deploy(),e=enemy(b);b.rng.pick=()=> 'b';cast(b,u);u.atkCd=0;advance(b,1.05);near(e.hp,100000);advance(b,.5);assert.ok(e.hp<100000);assert.equal(u.mem.regularFormVisual.clip,'Idle_2');const event=b.drainEvents().find(x=>x[0]==='atk');assert.equal(event[4].animation,'Skill_2_Loop');
});

test('Mr Nothing original normal windup caps source animation rate2, leaves passive initial delay unchanged',()=>{
 const{b,deploy}=make(NOT),u=deploy(),e=enemy(b);b.addBuff(u,{key:'test:aspd',mods:{aspd:200}});b.forceAttack(u,[e]);advance(b,.15);near(e.hp,100000);advance(b,.05);near(100000-e.hp,u.s.atk);
});

test('blessing normal Arts attacks preserve original cap1 events and speed8 flight in both facings',()=>{
 for(const id of[TSU,QUE])for(const dir of['UP','RIGHT']){const{b,deploy}=make(id),u=deploy(id,1,4,dir),e=enemy(b,4,3);b.forceAttack(u,[e]);const frame=source.models[id][dir==='UP'?'Back':'Front'].hits.Attack[0];advance(b,frame-.05);near(e.hp,100000);advance(b,.05);near(e.hp,100000);advance(b,.3);near(100000-e.hp,u.s.atk);}
});

test('blessing inclusive HP thresholds follow native LE/GE instead of strict description phrasing',()=>{
 for(const[id,ratio,inside]of[[TSU,.4,true],[TSU,.4001,false],[QUE,.7,true],[QUE,.6999,false]]){const{b,deploy}=make(id,{others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);a.hp=a.s.maxHp*ratio;advance(b,.15);near(a.s.physTakenMul,inside?1-u.def.talents[0].bb.damage_resistance:1);near(a.s.artsTakenMul,a.s.physTakenMul);}
});

test('blessing defensive auras retain unhealable allies but reject target-free and isolated other allies',()=>{
 for(const id of[TSU,QUE]){const{b,deploy}=make(id,{others:[VUL]}),u=deploy(),a=deploy(VUL,2,3);a.hp=a.s.maxHp*(id===TSU?.2:1);advance(b,.1);assert.ok(a.s.physTakenMul<1);b.addBuff(a,{key:'test:isolate',flags:{isolated:true}});advance(b,.15);near(a.s.physTakenMul,1);b.removeBuff(a,'test:isolate');b.addBuff(a,{key:'test:free',flags:{untargetable:true}});advance(b,.15);near(a.s.physTakenMul,1);b.removeBuff(a,'test:free');advance(b,.15);b.retreat(u);near(a.s.physTakenMul,1);}
});

test('Sanctuary multiple owned producers choose strongest without compounding, recover weaker live fallback',()=>{
 const{b,deploy}=make(TSU,{others:[FAN,BEA]}),u=deploy(),a=deploy(FAN,2,3),second=deploy(BEA,2,5);a.hp=a.s.maxHp*.2;const def=structuredClone(u.def);def.talents[0].bb.damage_resistance=.25;second.rangeGrid=structuredClone(u.rangeGrid);second.dir=u.dir;second.tileR=u.tileR;second.tileC=u.tileC;second.x=u.x;second.y=u.y;b._refreshRange(second);installFiveStarSupportFourth({battle:b,unit:second,def});advance(b,.15);near(a.s.physTakenMul,.75);b.retreat(second);near(a.s.physTakenMul,.82);b.retreat(u);near(a.s.physTakenMul,1);
});

test('Sanctuary reduces physical/Arts only; true damage and PURE HP loss stay intact',()=>{
 const{b,deploy}=make(TSU,{others:[FAN]}),u=deploy(),a=deploy(FAN,2,3),e=enemy(b);wound(a,10000);advance(b,.15);a.base.def=a.base.res=0;a.markDirty();let hp=a.hp;b.dealDamage(e,a,{amount:100,type:'phys'});near(hp-a.hp,82);hp=a.hp;b.dealDamage(e,a,{amount:100,type:'arts'});near(hp-a.hp,82);hp=a.hp;b.dealDamage(e,a,{amount:100,type:'true'});near(hp-a.hp,100);hp=a.hp;b.loseHp(a,100,{source:e});near(hp-a.hp,100);
});

test('Tsukinogi S1 selected dodge/reveal includes stealth, airborne and target-free but removes only owned aura',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make(TSU,{rank,others:[FAN,VUL]}),u=deploy(),a=deploy(FAN,2,3),v=deploy(VUL,2,5),e=enemy(b,4,2);b.addBuff(e,{key:'test:stealth',flags:{stealth:true,untargetable:true}});b.addBuff(e,{key:'other:reveal',flags:{reveal:true}});cast(b,u);advance(b,.05);near(a.s.dodgePhys,bb(TSU,0,rank)['attack@prob']);near(v.s.dodgeArts,a.s.dodgePhys);assert.ok(e.findBuff(`tsuki:reveal:${u.id}`));u.skill.end('test');near(a.s.dodgePhys,0);assert.ok(e.findBuff('other:reveal'));assert.equal(e.findBuff(`tsuki:reveal:${u.id}`),null);}
});

test('Tsukinogi reveal reaches airborne hidden-stealth but rejects actual disappeared enemies and out-of-range',()=>{
 const{b,deploy}=make(TSU),u=deploy(),a=enemy(b,4,2),z=enemy(b,4,3),far=enemy(b,10,5);a.profile.canHitFly=true;a.motion='FLY';for(const e of[a,z,far])b.addBuff(e,{key:'test:stealth',flags:{stealth:true}});z.hidden=true;cast(b,u);advance(b,.05);assert.equal(enemyStealthed(a),false);assert.equal(z.findBuff(`tsuki:reveal:${u.id}`),null);assert.equal(enemyStealthed(far),true);u.skill.end('test');assert.equal(enemyStealthed(a),true);
});

test('Tsukinogi S1 healing uses original.75scale/speed8, impact isolation and source withdrawal lifecycle',()=>{
 for(const block of[null,'isolated','healFree']){const{b,deploy}=make(TSU,{others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);cast(b,u);const p=effectiveProfile(u);assert.equal(p.dmgType,'heal');assert.equal(p.heal,null);b.forceAttack(u,[a]);advance(b,.45);if(block)b.addBuff(a,{key:'test:blocked',flags:{[block]:true}});b.retreat(u);advance(b,.25);near(a.hp-100,block?0:u.s.atk*.75);}
});

test('Tsukinogi S2 stops all ordinary attacks and enhances inclusive threshold/Sanctuary at every selected rank',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make(TSU,{skill:1,rank,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);a.hp=a.s.maxHp*bb(TSU,1,rank)['talent@hp_ratio'];cast(b,u);advance(b,.15);near(a.s.physTakenMul,1-.18*bb(TSU,1,rank).talent_scale);assert.equal(u.s.flags.disarm,true);u.skill.end('test');advance(b,.15);near(a.s.physTakenMul,1);}
});

test('Tsukinogi S2 one-second pulses defer first heal, use live sourceATK/finalregen scalar and noHeal bypass',()=>{
 const{b,deploy}=make(TSU,{skill:1,others:[FAN,VUL]}),u=deploy(),a=deploy(FAN,2,3),v=deploy(VUL,2,5);wound(a);wound(v);b.addBuff(a,{key:'test:healFree',flags:{healFree:true,untargetable:true}});cast(b,u);advance(b,.9);near(a.hp,100);near(v.hp,100);advance(b,.15);near(a.hp-100,u.s.atk*.12);near(v.hp-100,u.s.atk*.12);const old=a.hp;b.addBuff(u,{key:'test:atk',mods:{atkPct:.5}});b.addBuff(v,{key:'test:zero',mods:{hpRegenMul:0}});advance(b,1);near(a.hp-old,u.s.atk*.12);near(v.hp,100+u.base.atk*.12);u.skill.end('test');const hp=a.hp;advance(b,1);near(a.hp,hp);
});

test('Tsukinogi S2 source isolation excludes regeneration and moving out removes pulse without hidden backlog',()=>{
 const{b,deploy}=make(TSU,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);cast(b,u);b.addBuff(a,{key:'test:isolated',flags:{isolated:true}});advance(b,1.1);near(a.hp,100);b.removeBuff(a,'test:isolated');advance(b,.9);near(a.hp,100);advance(b,.2);assert.ok(a.hp>100);a.x=10;a.tileC=10;const hp=a.hp;advance(b,2);near(a.hp,hp);
});

test('Quercus source modes show literal begin/idle/heal-loop/end and restore Arts after cancel/expiry',()=>{
 for(let skill=0;skill<2;skill++){const{b,deploy}=make(QUE,{skill}),u=deploy();cast(b,u);assert.equal(u.mem.regularFormVisual.clip,skill?'Skill_2_begin':'Skill_begin');assert.equal(u.profile.dmgType,'heal');advance(b,.75);assert.equal(u.mem.regularFormVisual.clip,skill?'Skill_2_Idle':'Skill_Idle');const p=effectiveProfile(u);assert.equal(p.attackVisual,skill?'Skill_2_Loop':'Skill_Loop');u.skill.end('test');assert.equal(u.profile.dmgType,'arts');assert.equal(u.mem.regularFormVisual.clip,skill?'Skill_2_End':'Skill_End');advance(b,.75);assert.equal(u.mem.regularFormVisual,null);}
});

test('Quercus S1 selectedATK allranks and manual cancel remain skill/SP correct',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make(QUE,{rank}),u=deploy();cast(b,u);near(u.s.atk,u.base.atk*(1+bb(QUE,0,rank).atk));assert.equal(u.skill.spec.manualCancel,true);assert.equal(b.activateOperator(QUE),true);near(u.s.atk,u.base.atk);near(u.skill.spTotal,0);advance(b,.7);assert.ok(u.skill.spTotal>0);}
});

test('Quercus S2 heals at its distinct.833 sourceevent, gives1SP only accepted legal healing and preserves noSp',()=>{
 for(const block of[null,'noSp','isolated','healFree']){const{b,deploy}=make(QUE,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);a.skill.setSpTotal(0);b.addBuff(a,{key:'test:noTime',mods:{spRecoveryMul:0}});cast(b,u);advance(b,.7);b.forceAttack(u,[a]);advance(b,.5);near(a.hp,100);if(block)b.addBuff(a,{key:'test:blocked',flags:{[block]:true}});advance(b,.4);near(a.hp-100,['isolated','healFree'].includes(block)?0:u.s.atk*.75);near(a.skill.spTotal,block?0:1);}
});

test('Quercus emitted heal survives ending source mode but no longer carries removed S2SP listener',()=>{
 const{b,deploy}=make(QUE,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);a.skill.setSpTotal(0);b.addBuff(a,{key:'test:noTime',mods:{spRecoveryMul:0}});cast(b,u);advance(b,.7);b.forceAttack(u,[a]);advance(b,.6);u.skill.end('test');advance(b,.4);near(a.hp-100,u.s.atk*.75);near(a.skill.spTotal,0);
});

test('Quercus healing acquires lowest legal HPratio and rejects unhealable ally without targeting enemies',()=>{
 const{b,deploy}=make(QUE,{others:[FAN,BEA,VUL]}),u=deploy(),a=deploy(FAN,2,3),z=deploy(BEA,2,5),v=deploy(VUL,3,3);wound(a,200);wound(z,100);wound(v,1);cast(b,u);advance(b,.7);assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[z]);b.addBuff(z,{key:'test:isolate',flags:{isolated:true}});assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[a]);
});

test('blessing natural attack loops heal injured allies in active modes and never strike nearby enemies',()=>{
 for(const[id,skill]of[[TSU,0],[QUE,0],[QUE,1]]){
  const{b,deploy}=make(id,{skill,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3),e=enemy(b,4,2);wound(a);cast(b,u);u.atkCd=0;
  advance(b,2.6);assert.ok(a.hp>100);near(e.hp,100000);assert.ok(u.stats.attacks>0);assert.ok(u.stats.heal>0);
  u.skill.end('test');a.hp=100;advance(b,.8);u.atkCd=0;const hp=e.hp;advance(b,1.5);assert.ok(e.hp<hp);
 }
});

test('Quercus S2 emits the selected duration expiry/end and restores ordinary enemy targeting',()=>{
 for(const rank of[1,7,10]){
  const{b,deploy}=make(QUE,{skill:1,rank}),u=deploy(),e=enemy(b,4,2);cast(b,u);const duration=data.operators[QUE].skills[1].levels[rank-1].duration;
  advance(b,duration-.1);assert.equal(u.skill.active,true);advance(b,.2);assert.equal(u.skill.active,false);assert.equal(u.profile.dmgType,'arts');assert.equal(u.mem.regularFormVisual.clip,'Skill_2_End');
  advance(b,.75);assert.equal(u.mem.regularFormVisual,null);assert.ok(acquireTargets(b,u,effectiveProfile(u)).includes(e));
 }
});

test('Tsukinogi owner death removes only owned dodge/reveal/Sanctuary and cancels source regeneration',()=>{
 const{b,deploy}=make(TSU,{skill:1,others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);wound(a);b.applyStatus(a,'sanctuary',{key:'other:sanctuary',value:.1});cast(b,u);advance(b,1.1);assert.ok(a.hp>100);assert.ok(a.findBuff(`tsuki:regen:${u.id}`));
 b.kill(u);const hp=a.hp;advance(b,1.2);near(a.hp,hp);assert.equal(a.findBuff(`tsuki:regen:${u.id}`),null);assert.equal(a.findBuff(`blessing:sanctuary:${u.id}`),null);assert.ok(a.findBuff('other:sanctuary'));near(a.s.physTakenMul,.9);
});

test('blessing source delayed-first .1s checker leaves early damage unprotected before evaluating each recipient',()=>{
 for(const id of[TSU,QUE]){
  const{b,deploy}=make(id,{others:[FAN]}),u=deploy(),a=deploy(FAN,2,3),e=enemy(b);wound(a,id===TSU?20000:100000);a.base.def=a.base.res=0;a.markDirty();
  near(a.s.physTakenMul,1);let hp=a.hp;b.dealDamage(e,a,{amount:100,type:'phys'});near(hp-a.hp,100);advance(b,.05);near(a.s.physTakenMul,1);advance(b,.05);near(a.s.physTakenMul,1-u.def.talents[0].bb.damage_resistance);
  hp=a.hp;b.dealDamage(e,a,{amount:100,type:'phys'});near(hp-a.hp,100*(1-u.def.talents[0].bb.damage_resistance));
 }
});

test('blessing HP threshold changes wait for the next .1s source trigger and leave/reentry resets first interval',()=>{
 for(const id of[TSU,QUE]){
  const{b,deploy}=make(id,{others:[FAN]}),u=deploy(),a=deploy(FAN,2,3);a.hp=a.s.maxHp*(id===TSU?.2:1);advance(b,.1);assert.ok(a.s.physTakenMul<1);
  a.hp=a.s.maxHp*(id===TSU?.8:.1);advance(b,b.dt);assert.ok(a.s.physTakenMul<1);advance(b,.1);near(a.s.physTakenMul,1);
  a.hp=a.s.maxHp*(id===TSU?.2:1);advance(b,.1);assert.ok(a.s.physTakenMul<1);a.x=10;a.tileC=10;advance(b,b.dt);near(a.s.physTakenMul,1);assert.equal(a.findBuff(`blessing:checker:${u.id}`),null);
  a.x=3;a.tileC=3;advance(b,b.dt);near(a.s.physTakenMul,1);advance(b,.05);near(a.s.physTakenMul,1);advance(b,.1);assert.ok(a.s.physTakenMul<1);
  b.retreat(u);assert.equal(a.findBuff(`blessing:checker:${u.id}`),null);near(a.s.physTakenMul,1);
 }
});
