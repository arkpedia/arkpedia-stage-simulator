// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import evidence from '../data/arkpedia-thorns-prefabs.json' with { type: 'json' };
import { THORNS_OPERATORS as configs } from '../shared/arkpedia/thorns-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { effectiveProfile, acquireTargets } from '../server/sim/ai.js';
import { COLS } from '../server/sim/constants.js';
const ID='char_293_thorns';
const near=(a,e,t=1e-5)=>assert.ok(Math.abs(a-e)<t,`${a} != ${e}`);
const nodes=rows=>rows.flatMap(r=>r.components.map(c=>c.data??c));
const bb=(skill,rank=10)=>Object.fromEntries(data.operators[ID].skills[skill].levels[rank-1].blackboard.map(v=>[v.key,v.value]));
function buildFor(id,{skill=0,rank=10,elite=null,potential=1}={}){
 const op=data.operators[id];elite??=op.phases.length-1;rank=Math.min(rank,elite===2?10:elite===1?7:4);
 return{...defaultBuild(op),elite,level:op.phases[elite].maxLevel,potential,skillId:op.skills[skill].id,skillRank:rank};
}
function make(opts={},support=false){
 const source=structuredClone(data);source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;
 const b=new StandardBattle(source,support?{operators:[buildFor('char_264_f12yin',{elite:0,rank:4})],support:{id:ID,skillId:'skchr_thorns_3'}}:{operators:[buildFor(ID,opts)]});
 b.autoFinish=false;b.recordEvents=true;b.setViewport('fullscreen-workspace');b.grid.tiles=b.grid.tiles.map(v=>({...v,height:'LOW',build:'ALL',pass:'ALL'}));
 return{b,deploy:(r=3,c=4,dir='RIGHT')=>{b.addDp('arkpedia',99);const u=b.deployOperator(ID,r,c,dir);assert.ok(u);u.atkCd=1000;u.skill.rule='NEVER';return u;}};
}
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function cast(u){u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),true);u.atkCd=1000;}
function enemy(b,{r=3,c=6,fly=false,def=0,res=0,way='MELEE'}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});e.base.maxHp=100000;e.base.atk=1000;e.base.def=def;e.base.res=res;e.def={...e.def,applyWay:way};if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=100000;
 b.addBuff(e,{key:'test:pin',persist:true,flags:{disarm:true,noMove:true}});b._buildEnemyIndex();return e;
}
function move(b,e,r,c){e.x=c;e.y=r;e.tileR=r;e.tileC=c;b._enemiesDirty=true;b._buildEnemyIndex();}
function shot(b,u,e){b.forceAttack(u,[e]);u.atkCd=1000;}
function hit(b,e,u,damage={}){b.dealDamage(e,u,{amount:1,type:'true',isAttack:true,applyWay:'ranged',...damage});}
const talent=(u,k)=>u.def.talents.find(t=>t.bb[k]!=null)?.bb;
function wound(u){void u.s;u.hp=u.s.maxHp*.2;}

test('complete Thorns source keeps actual non-event counter and official facing byte identity',()=>{
 assert.deepEqual(Object.keys(configs),[ID]);assert.equal(evidence.sourceVersion,'26-09-23-17-49-43_b9cc4a');
 for(const face of ['Front','Back'])assert.equal(evidence.originalModels[ID][face].sha256,evidence.officialSkeletonBindings[ID][face].sha256);
 const skill=nodes(evidence.skills.skchr_thorns_2),extra=skill.find(v=>v.pathId==='-2109432450500820856');assert.ok(extra);assert.equal(extra._waitForAttackEvent,0);near(extra._preDelay,.5);assert.equal(extra._cooldownKey,'cooldown');assert.equal(extra._selectTargetTiming,0);assert.equal(extra._timeMode,3);
 const holder=skill.find(v=>v._extraAbilities?.length);assert.equal(holder._extraAbilities[0].m_PathID,extra.pathId);
 const regen=nodes(evidence.characters[ID]).find(v=>v._restoreDelay!=null);assert.equal(regen._disableWhenInAttackState,1);assert.equal(regen._disableWhenInCombatState,1);assert.equal(regen._disableWhenAttack,0);near(regen._restoreDelay,2);
 assert.ok(evidence.verificationLimits.some(v=>v.includes('timer phase')));
});
test('all three original skills and ten ranks execute selected promotion/potential and maxed support',()=>{
 for(let skill=0;skill<3;skill++)for(let rank=1;rank<=10;rank++){const{b,deploy}=make({skill,rank}),u=deploy();assert.equal(u.skill.id,configs[ID].skillIds[skill]);assert.equal(u.skill.noSkill,false);assert.deepEqual(b.errors,[]);}
 const zero=make({elite:0,rank:4}),z=zero.deploy();assert.equal(z.def.talents.length,0);wound(z);advance(zero.b,4);near(z.hp,z.s.maxHp*.2);
 const support=make({},true),s=support.deploy();assert.equal(s.def.raw.arkpedia.elite,2);assert.equal(s.skill.id,'skchr_thorns_3');near(talent(s,'damage[normal]')['damage[normal]'],140);
});
test('normal Combat and RANGED modes independently preserve physical mitigation and source .8 penalty',()=>{
 for(const c of [5,6]){const{b,deploy}=make(),u=deploy(),e=enemy(b,{c,def:100});shot(b,u,e);advance(b,.85);near(100000-e.hp,u.s.atk*(c===5?1:.8)-100);const a=b._evq.find(v=>v[0]==='atk'&&v[1]===u.id);near(a[4].windup,.5);assert.equal(a[4].animation,c===5?'Attack_1':'Attack_2');}
});
test('source CAST acquisition replaces a dead startup input and preserves original range/air eligibility',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b),z=enemy(b,{c:6.2,fly:true});assert.equal(acquireTargets(b,u,effectiveProfile(u)).length,1);shot(b,u,e);b.kill(e);advance(b,.85);near(100000-z.hp,u.s.atk*.8);assert.ok(z.findBuff(`thorns:poison:${u.id}`));
});
test('ordinary source melee/ranged animation caps stay independent of high ASPD',()=>{
 for(const c of [5,6]){const{b,deploy}=make(),u=deploy(),e=enemy(b,{c});b.addBuff(u,{key:'external-speed',mods:{aspd:200}});shot(b,u,e);const a=b._evq.find(v=>v[0]==='atk'&&v[1]===u.id);near(a[4].windup,.5/(c===5?1.1:1));}
});
test('S1 all ranks apply the selected ATK percentage and retain ordinary ranged trait',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make({rank}),u=deploy(),e=enemy(b);const x=bb(0,rank);cast(u);near(u.s.atk,u.base.atk*(1+x.atk));near(u.skill.timeLeft,30);shot(b,u,e);advance(b,.85);near(100000-e.hp,u.s.atk*.8);u.skill.end('test');near(u.s.atk,u.base.atk);}
});
test('poison first fires one second after impact and applies fixed selected E1/E2/potential Arts damage',()=>{
 for(const elite of [1,2])for(const potential of [1,5]){const{b,deploy}=make({elite,potential,rank:7}),u=deploy(),e=enemy(b,{res:50});shot(b,u,e);advance(b,.85);const hp=e.hp;advance(b,.6);near(e.hp,hp);advance(b,.4);near(hp-e.hp,talent(u,'damage[normal]')['damage[normal]']*.5);}
});
test('poison RANGED classification follows actual source applyWay, never distance or flight',()=>{
 for(const way of ['MELEE','RANGED']){const{b,deploy}=make(),u=deploy(),e=enemy(b,{way});shot(b,u,e);advance(b,.85);const hp=e.hp;move(b,e,3,9);advance(b,1);near(hp-e.hp,talent(u,'damage[normal]')[way==='RANGED'?'damage[ranged]':'damage[normal]']);}
});
test('poison reapplication preserves existing trigger cadence rather than delaying the first tick',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b);shot(b,u,e);advance(b,.85);const key=`thorns:poison:${u.id}`,p=e.findBuff(key);assert.ok(p);advance(b,.2);shot(b,u,e);advance(b,.8);const hits=b._evq.filter(v=>v[0]==='dmg'&&v[1]===e.id&&v[3]==='arts');assert.equal(hits.length,1);assert.equal(e.findBuff(key),p);near(p.interval,1);assert.ok(p.timeLeft>2.5);
});
test('poison trigger uses native current enemy applyWay and remains source-credited after retreat',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b);shot(b,u,e);advance(b,.55);assert.ok(b.projectiles.list.length);b.retreatOperator(ID);advance(b,.3);const hp=e.hp;assert.ok(e.findBuff(`thorns:poison:${u.id}`));e.def={...e.def,applyWay:'RANGED'};advance(b,1);near(hp-e.hp,250);assert.ok(u.stats.dmg>u.base.atk*.8);assert.equal(u.deployed,false);advance(b,2.2);assert.ok(!e.findBuff(`thorns:poison:${u.id}`));
});
test('already-fired normal projectile retains source mode but uses uncached current ATK at impact',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b);cast(u);shot(b,u,e);advance(b,.55);assert.ok(b.projectiles.list.length);u.skill.end('test');advance(b,.3);near(100000-e.hp,u.base.atk*.8);
});
test('poison is non-damage-missable additive impact buff even for shielded primary damage',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b);b.addBuff(e,{key:'shield',shieldHits:1});shot(b,u,e);advance(b,.85);near(e.hp,100000);assert.ok(e.findBuff(`thorns:poison:${u.id}`));advance(b,1);near(e.hp,100000-125);
});
test('E2 regeneration initial restoreDelay waits exactly two seconds and selected potential ratio',()=>{
 for(const potential of [1,3]){const{b,deploy}=make({potential}),u=deploy();wound(u);const hp=u.hp;advance(b,2);near(u.hp,hp);advance(b,.1);assert.ok(u.hp>hp);near(u.s.hpRegen,u.s.maxHp*talent(u,'delay').hp_recovery_per_sec_by_max_hp_ratio);}
});
test('hostile approach and taking damage/blocking alone do not reset the native attack/combat gate',()=>{
 const{b,deploy}=make(),u=deploy();wound(u);advance(b,2.2);assert.ok(u.findBuff('thorns:idle-regen'));const e=enemy(b);const hp=u.hp;advance(b,.2);assert.ok(u.hp>hp);hit(b,e,u);assert.ok(u.findBuff('thorns:idle-regen'));e.blockedBy=u;u.blocking=[e];advance(b,.1);assert.ok(u.findBuff('thorns:idle-regen'));
});
test('ordinary attack holds regeneration through original clip then source two-second delay',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b);wound(u);advance(b,2.2);assert.ok(u.findBuff('thorns:idle-regen'));shot(b,u,e);assert.ok(!u.findBuff('thorns:idle-regen'));const start=b.time;advance(b,3.15);assert.ok(!u.findBuff('thorns:idle-regen'));advance(b,.15);assert.ok(u.findBuff('thorns:idle-regen'));assert.ok(b.time>=start+1.2+2);
});
test('continuous actual normal attacks keep regeneration disabled, then recover after final state exit',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b);wound(u);u.atkCd=0;advance(b,4);assert.ok(u.stats.attacks>=3);assert.ok(!u.findBuff('thorns:idle-regen'));b.kill(e);const exit=u.mem.thornsAttackUntil;advance(b,Math.max(0,exit+2-b.time)+.1);assert.ok(u.findBuff('thorns:idle-regen'));
});
test('sub-frame accepted control cancels unborn normal output and exits mapped state without refunded time',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b);shot(b,u,e);b.applyStatus(u,'stun',{duration:.001});advance(b,.85);near(e.hp,100000);assert.equal(u.mem.thornsIdleAt>=0,true);assert.ok(!e.findBuff(`thorns:poison:${u.id}`));
});
test('S2 all ranks retain original duration/ATK/DEF and do not acquire ordinary attacks',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make({skill:1,rank}),u=deploy(),e=enemy(b);cast(u);const x=bb(1,rank);near(u.s.atk,u.base.atk*(1+x.atk));near(u.s.def,u.base.def*(1+x.def));u.atkCd=0;advance(b,.8);near(e.hp,100000);near(u.stats.attacks,0);assert.equal(u.mem.regularFormVisual.clip,'Skill1_2');}
});
test('S2 enemy NORMAL receipt releases after source .5; direct BUFF/friendly damage does not',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b);cast(u);hit(b,e,u,{isAttack:false});b.dealDamage(u,u,{amount:1,type:'true',isAttack:true});advance(b,.6);near(e.hp,100000);hit(b,e,u);advance(b,.45);near(e.hp,100000);advance(b,.1);near(100000-e.hp,u.s.atk*.8);assert.ok(e.findBuff(`thorns:poison:${u.id}`));
});
test('S2 source ALL motion/range/max_target selects four current victims, excludes outside/hidden/free',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),es=Array.from({length:6},(_,i)=>enemy(b,{c:6+i*.04,fly:i===0})),outside=enemy(b,{r:1,c:8});cast(u);b.addBuff(es[4],{key:'free',flags:{untargetable:true}});es[5].hidden=true;hit(b,es[0],u);advance(b,.6);for(const e of es.slice(0,4))near(100000-e.hp,u.s.atk*.8);near(es[4].hp,100000);near(es[5].hp,100000);near(outside.hp,100000);
});
test('S2 CAST selects entering targets and excludes targets that left during non-event predelay',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b),z=enemy(b,{r:1,c:8});cast(u);hit(b,e,u);move(b,e,1,8);move(b,z,3,6);advance(b,.6);near(e.hp,100000);near(100000-z.hp,u.s.atk*.8);
});
test('S2 selected cooldown is independent of ASPD and starts at accepted reaction initiation',()=>{
 for(const rank of [1,7,10]){const{b,deploy}=make({skill:1,rank}),u=deploy(),e=enemy(b);cast(u);b.addBuff(u,{key:'speed',mods:{aspd:200}});hit(b,e,u);advance(b,.55);near(u.stats.attacks,1);const first=u.mem.thornsCounterReadyAt;hit(b,e,u);advance(b,.01);near(u.stats.attacks,1);advance(b,Math.max(0,first-b.time)+b.dt);hit(b,e,u);advance(b,.55);near(u.stats.attacks,2);}
});
test('S2 fully absorbed NORMAL receipt still triggers; cancelled and dodged receipts do not',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b);cast(u);b.addBuff(u,{key:'shield',shieldHits:1});const hp=u.hp;hit(b,e,u);near(u.hp,hp);advance(b,.6);near(u.stats.attacks,1);advance(b,.1);b.addBuff(u,{key:'dodge',mods:{dodgePhys:1}});b.rng=()=>0;hit(b,e,u,{amount:100,type:'phys'});advance(b,.6);near(u.stats.attacks,1);
});
test('S2 counter does not reset native ordinary Attack/Combat regen state',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b);wound(u);cast(u);advance(b,2.2);assert.ok(u.findBuff('thorns:idle-regen'));hit(b,e,u);advance(b,.6);near(u.stats.attacks,1);assert.ok(u.findBuff('thorns:idle-regen'));assert.equal(u.mem.thornsAttackUntil,u.skill.lastStart);
});
test('S2 short-control/skill-end/withdrawal cancel unborn counter, completed poison survives independently',()=>{
 for(const mode of ['control','end','retreat']){const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b);cast(u);hit(b,e,u);if(mode==='control')b.applyStatus(u,'stun',{duration:.001});else if(mode==='end')u.skill.end('test');else b.retreatOperator(ID);advance(b,.6);near(e.hp,100000);assert.equal(u.mem.thornsCounterToken,null);}
 const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b);cast(u);hit(b,e,u);advance(b,.6);const hp=e.hp;b.retreatOperator(ID);advance(b,1);near(hp-e.hp,125);assert.equal(u.mem.regularFormVisual,null);
});
test('S2 duration end restores range/ordinary profile and exact original End clip, then clears lock',()=>{
 const{b,deploy}=make({skill:1}),u=deploy();cast(u);advance(b,.2);u.skill.end('test');assert.equal(u.mem.regularFormVisual.clip,'Skill1_3');assert.ok(u.s.flags.disarm);advance(b,.3);assert.equal(u.mem.regularFormVisual,null);assert.ok(!u.s.flags.disarm);assert.ok(!effectiveProfile(u).noAttack);near(u.s.atk,u.base.atk);near(u.s.def,u.base.def);
});
test('S3 all ten ranks first/subsequent source stats, source range and permanent life bind per entity',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make({skill:2,rank}),u=deploy(),x=bb(2,rank);cast(u);near(u.s.atk,u.base.atk*(1+x.atk));near(u.s.aspd,100+x.attack_speed);near(u.skill.timeLeft,30);assert.ok(u.rangeKeys.includes(3*COLS+7));u.skill.end('test');cast(u);near(u.s.atk,u.base.atk*(1+x['thorns_s_3[b].atk']));near(u.s.aspd,100+x['thorns_s_3[b].attack_speed']);assert.equal(u.skill.timeLeft,Infinity);advance(b,31);assert.equal(u.skill.active,true);}
});
test('S3 normal and ranged damage both remove source ranged penalty and force literal Front Skill2_2',()=>{
 for(const dir of ['RIGHT','UP','LEFT','DOWN']){const{b,deploy}=make({skill:2}),u=deploy(3,4,dir),e=enemy(b,dir==='UP'?{r:5,c:4}:dir==='LEFT'?{c:2}:dir==='DOWN'?{r:1,c:4}:{});cast(u);shot(b,u,e);advance(b,.7);near(100000-e.hp,u.s.atk);const a=b._evq.find(v=>v[0]==='atk'&&v[1]===u.id);assert.equal(a[4].animation,'Skill2_2');near(a[4].windup,.3);assert.equal(u.mem.regularAttackFacing,'Front');}
});
test('S3 source expanded range actually acquires far target and offensive SP remains blocked while active',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b,{r:4,c:7});assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[]);cast(u);assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[e]);shot(b,u,e);advance(b,.85);near(100000-e.hp,u.s.atk);near(u.skill.spTotal,0);u.skill.end('test');assert.deepEqual(acquireTargets(b,u,effectiveProfile(u)),[]);const z=enemy(b);shot(b,u,z);advance(b,.85);near(u.skill.spTotal,1);
});
test('S3 source ordinary attack state uses .8 Front clip end plus two-second regen delay',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b);wound(u);cast(u);shot(b,u,e);advance(b,2.75);assert.ok(!u.findBuff('thorns:idle-regen'));advance(b,.15);assert.ok(u.findBuff('thorns:idle-regen'));
});
test('S3 first-use counter/stat/range/Front state is reset by actual withdrawal and fresh deployment',()=>{
 const{b,deploy}=make({skill:2}),u=deploy();cast(u);u.skill.end('test');cast(u);assert.equal(u.mem.thornsEnhanced,true);b.retreatOperator(ID);assert.equal(u.mem.regularAttackFacing,null);assert.equal(u.skill.active,false);assert.ok(!u.findBuff('thorns:s3'));b.bench[ID].readyAt=b.time;const v=deploy();assert.notEqual(v,u);cast(v);assert.equal(v.mem.thornsEnhanced,false);near(v.skill.timeLeft,30);near(v.s.atk,v.base.atk*1.6);
});

test('S2 native restart abandons interrupted ordinary Attack state before the two-second idle gate',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b);wound(u);shot(b,u,e);advance(b,.1);cast(u);assert.equal(u.mem.thornsAttackUntil,b.time);advance(b,1.95);assert.ok(!u.findBuff('thorns:idle-regen'));advance(b,.15);assert.ok(u.findBuff('thorns:idle-regen'));near(e.hp,100000);
});

test('S2 actual six legal victims are capped to four and every counter hit independently mitigates DEF',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),es=Array.from({length:6},(_,i)=>enemy(b,{c:6+i*.04,def:100}));cast(u);hit(b,es[0],u);advance(b,.6);assert.equal(es.filter(e=>e.hp<100000).length,4);for(const e of es.filter(e=>e.hp<100000))near(100000-e.hp,u.s.atk*.8-100);assert.equal(u.stats.attacks,1);
});
test('S2 element-gauge and explicitly cancelled NORMAL damage cannot create a reaction',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b);cast(u);b.dealDamage(e,u,{amount:1,type:'element',element:'neural',isAttack:true});const h=b.on('hit',c=>{if(c.target===u)c.dmg.cancel=true;});hit(b,e,u);b.off(h);advance(b,.6);near(e.hp,100000);near(u.stats.attacks,0);
});
test('a late actual deployment starts its own two-second regeneration clock',()=>{
 const{b,deploy}=make();advance(b,4);const u=deploy();wound(u);const hp=u.hp;advance(b,2);near(u.hp,hp);advance(b,.1);assert.ok(u.hp>hp);
});

test('source NORMAL includes geometric splash, while an explicitly annotated native SPLASH does not',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b);cast(u);hit(b,e,u,{isSplash:true});advance(b,.6);near(u.stats.attacks,1);advance(b,.1);const h=b.on('hit',c=>{if(c.target===u)c.dmg.nativeAttackType='SPLASH';});hit(b,e,u);b.off(h);advance(b,.6);near(u.stats.attacks,1);
});
