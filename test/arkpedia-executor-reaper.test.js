// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import source from '../data/arkpedia-executor-reaper-prefabs.json' with { type: 'json' };
import { EXECUTOR_REAPER_OPERATORS as configs } from '../shared/arkpedia/executor-reaper-operators.js';
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { acquireTargets, effectiveProfile } from '../server/sim/ai.js';
const ID='char_1032_excu2', near=(a,e,t=1e-5)=>assert.ok(Math.abs(a-e)<t,`${a} != ${e}`);
const nodes=rs=>rs.flatMap(r=>r.components.map(c=>({pathId:c.pathId,...c.data})));
function build({id=ID,skill=0,rank=10,elite=2,potential=1}={}) {
 const o=data.operators[id];assert.ok(o,`Reviewed ${id} source snapshot required`);elite=Math.min(elite,o.phases.length-1);rank=Math.min(rank,elite===2?10:elite===1?7:4);
 return {...defaultBuild(o),elite,level:o.phases[elite].maxLevel,potential,skillId:o.skills[skill].id,skillRank:rank};
}
function make(opts={}) {
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 const b=new StandardBattle(d,{operators:[build(opts),...(opts.others??[]).map(id=>build({id}))],seed:opts.seed??17});
 b.setViewport('fullscreen-workspace');b.autoFinish=false;b.recordEvents=true;b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 b.receipts=[];b.on('damaged',c=>b.receipts.push({...c,time:b.time}));if(!opts.realRng)rng(b,[.99]);
 return {b,deploy:(r=3,c=4,dir='RIGHT',id=ID)=>{b.addDp('arkpedia',99);const u=b.deployOperator(id,r,c,dir);assert.ok(u);u.atkCd=1000;u.skill.rule='NEVER';return u;}};
}
function rng(b,values) {let n=0;const prior=b.rng,r=()=>values[Math.min(n++,values.length-1)];r.pick=prior.pick;r.int=prior.int;r.chance=p=>r()<p;b.rng=r;return()=>n;}
function advance(b,s){for(let i=0;i<Math.ceil(s/b.dt-1e-9);i++)b.step();assert.deepEqual(b.errors,[]);}
function enemy(b,{r=3,c=5,hp=100000,def=0,fly=false}={}) {const e=b.spawnEnemy('enemy_1007_slime',{pos:[r,c]});Object.assign(e.base,{maxHp:Math.max(100000,hp),def,res:0,moveSpeed:0});e.def={...e.def,immune:new Set(e.def.immune)};e.markDirty();void e.s;e.hp=hp;if(fly)e.motion='FLY';b.addBuff(e,{key:'pin',persist:true,flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;}
function move(b,e,r,c){e.x=c;e.y=r;e.tileR=r;e.tileC=c;b._enemiesDirty=true;b._buildEnemyIndex();}
function cast(u){u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),true);u.atkCd=1000;}
function shot(b,u,targets){assert.equal(b.forceAttack(u,targets==null?undefined:Array.isArray(targets)?targets:[targets]),true);u.atkCd=1000;return b._evq.filter(x=>x[0]==='atk'&&x[1]===u.id).at(-1)?.[4];}
const receipts=(b,u,e)=>b.receipts.filter(c=>c.source===u&&(!e||c.target===e));
function first(b,u,e){for(let i=0;i<100&&!receipts(b,u,e).length;i++)b.step();assert.ok(receipts(b,u,e).length);u.atkCd=1000;assert.deepEqual(b.errors,[]);}
function wound(u){u.hp=u.s.maxHp*.1;}
const lateranos=['char_192_falco','char_271_spikes','char_302_glaze','char_332_archet','char_213_mostma'];

test('whole-kit source retains exact five bundles, original facing bindings and explicit ammo dispatcher bounds',()=>{
 assert.deepEqual(Object.keys(configs),[ID]);assert.equal(source.frameParity,false);assert.equal(source.sourceBundles.length,5);
 for(const x of source.sourceBundles)assert.match(x.sha256,/^[0-9a-f]{64}$/);
 for(const face of['Front','Back'])assert.equal(source.models[ID][face].sha256,source.officialSkeletonBindings[ID][face].sha256);
 assert.deepEqual(source.models[ID].Front.hits.Attack_B,[.3,.367]);assert.deepEqual(source.models[ID].Front.hits.Skill_3_Attack_B,[.267,.367]);
 assert.ok(source.verificationLimits.some(x=>x.includes('event4')));assert.ok(source.verificationLimits.some(x=>x.includes('final')));
 const n=nodes(source.characters[ID]);assert.ok(n.some(x=>x._behaviours?.length));
});
test('all thirty selected ranks and promotion/potential candidates instantiate complete kits',()=>{
 for(let skill=0;skill<3;skill++)for(let rank=1;rank<=10;rank++){const{b,deploy}=make({skill,rank}),u=deploy();assert.equal(u.skill.id,configs[ID].skillIds[skill]);assert.equal(u.skill.kind,'ammo');assert.equal(u.skill.noSkill,false);assert.deepEqual(b.errors,[]);}
 for(const elite of[0,1,2]){const{deploy}=make({elite}),u=deploy();assert.equal(u.def.traitBb.value,50);assert.equal(u.def.talents.length,elite===0?0:elite===1?1:2);}
});
test('natural normal all-range physical release hits each ground victim once without secondary splash duplication',()=>{
 const{b,deploy}=make(),u=deploy(),es=[enemy(b),enemy(b,{c:5.1}),enemy(b,{c:5.2})],air=enemy(b,{fly:true});u.atkCd=0;b.step();u.atkCd=1000;advance(b,.35);
 assert.equal(u.stats.attacks,1);for(const e of es){assert.equal(receipts(b,u,e).length,1);near(100000-e.hp,u.s.atk);}near(air.hp,100000);assert.equal(b.projectiles.list.length,0);
});
test('normal single and double events have independent DEF mitigation and native normal-only extra SP receipt',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b,{def:100});u.skill.spType='attack';u.skill.setSpTotal(0);rng(b,[0]);const v=shot(b,u,e);assert.equal(v.animation,'Attack_B');near(v.windup,.3);advance(b,.45);const rs=receipts(b,u,e);assert.equal(rs.length,2);for(const x of rs)near(x.amount,u.s.atk-100);assert.equal(new Set(rs.map(x=>x.dmg.attackId)).size,1);near(u.skill.spTotal,2);
});
test('real seeded RNG drives natural attack and melee evasion without a fabricated next method',()=>{
 const{b,deploy}=make({skill:1,realRng:true}),u=deploy(),e=enemy(b);assert.equal(typeof b.rng,'function');assert.equal(b.rng.next,undefined);cast(u);advance(b,.4);u.atkCd=0;advance(b,.8);u.atkCd=1000;assert.ok(receipts(b,u,e).length);for(let i=0;i<10;i++)b.dealDamage(e,u,{amount:1,type:'true',applyWay:'melee',isAttack:true});assert.deepEqual(b.errors,[]);
});
test('one talent lottery is shared by all victims rather than independently rerolled per target',()=>{
 const{b,deploy}=make(),u=deploy(),es=[enemy(b),enemy(b,{c:5.1}),enemy(b,{c:5.2})],calls=rng(b,[0,.99]);shot(b,u);advance(b,.5);assert.equal(calls(),1);for(const e of es)assert.equal(receipts(b,u,e).length,2);
});
test('source normal input list is retained while later entrants and air targets remain excluded',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b),z=enemy(b,{r:1,c:8});rng(b,[0]);shot(b,u);move(b,z,3,5.1);advance(b,.5);assert.equal(receipts(b,u,e).length,2);near(z.hp,100000);
});
test('a killed or hidden first input cannot replace its double tail with another victim',()=>{
 for(const why of['kill','hide']){const{b,deploy}=make(),u=deploy(),e=enemy(b),z=enemy(b,{r:1,c:8});rng(b,[0]);shot(b,u,e);first(b,u,e);if(why==='kill')b.kill(e);else e.hidden=true;move(b,z,3,5);advance(b,.2);assert.equal(receipts(b,u,e).length,1);near(z.hp,100000);}
});
test('normal full-ground double tail checks accepted sub-frame control and rejected immunity independently',()=>{
 for(const immune of[false,true]){const{b,deploy}=make(),u=deploy(),e=enemy(b);if(immune){u.def={...u.def,immune:new Set(u.def.immune)};u.def.immune.add('stun');}rng(b,[0]);shot(b,u,e);first(b,u,e);b.applyStatus(u,'stun',{duration:.001});advance(b,.2);assert.equal(receipts(b,u,e).length,immune?2:1);}
});
test('literal DOWN and Back A/B skill clips preserve original hit events',()=>{
 for(const dir of['DOWN','UP','LEFT','RIGHT'])for(const skill of[0,1,2]){const{b,deploy}=make({skill}),u=deploy(3,4,dir),e=enemy(b);cast(u);if(skill)advance(b,.4);rng(b,[0]);const v=shot(b,u,e),expected=skill?`Skill_${skill+1}_Attack_B`:'Attack_B';assert.equal(v.animation,dir==='DOWN'?skill?`Skill_Down_${skill+1}_Attack_B`:'Attack_Down_B':expected);advance(b,v.windup+.3);assert.equal(receipts(b,u,e).length,2);}
});
test('trait self healing remains blocked for external allies but exact 50 output value bypasses HealFree',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b);wound(u);const hp=u.hp;near(b.heal(e,u,100),0);b.dealDamage(u,e,{amount:1,type:'phys',isAttack:true});near(u.hp-hp,50);b.addBuff(u,{key:'heal-taken',mods:{healingTakenMul:.5}});advance(b,.15);const p=u.hp;b.dealDamage(u,e,{amount:1,type:'true'});near(u.hp-p,25);
});
test('trait accepted-output bridge heals shielded zero but rejects dodge/cancel/gauge/HPLOSS',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b);wound(u);let hp=u.hp;b.addBuff(e,{key:'shield',shield:1000});b.dealDamage(u,e,{amount:100,type:'phys'});near(u.hp-hp,50);advance(b,.15);hp=u.hp;rng(b,[0]);b.addBuff(e,{key:'dodge',mods:{dodgePhys:1}});b.dealDamage(u,e,{amount:100,type:'phys'});b.removeBuff(e,'dodge');const h=b.on('hit',c=>{if(c.source===u)c.dmg.cancel=true;});b.dealDamage(u,e,{amount:100,type:'phys'});b.off(h);b.loseHp(e,1,{source:u});b.dealDamage(u,e,{amount:1,type:'element',element:'burn'});b.dealDamage(u,e,{amount:1,type:'elemental',element:'burn'});advance(b,.2);near(u.hp,hp);
});
test('trait .05 cap samples current block count and .12 queue retains two distinct receipts',()=>{
 const{b,deploy}=make(),u=deploy(),es=[enemy(b),enemy(b,{c:5.1}),enemy(b,{c:5.2})];wound(u);const hp=u.hp;for(const e of es)b.dealDamage(u,e,{amount:1,type:'phys'});near(u.hp-hp,50);advance(b,.1);near(u.hp-hp,50);advance(b,.04);near(u.hp-hp,100);b.addBuff(u,{key:'zero-block',mods:{blockCntMul:0}});const before=u.hp;advance(b,.2);b.dealDamage(u,es[0],{amount:1,type:'phys'});near(u.hp,before);
});
test('S1 selected ATK, DEF-ignore and ammunition execute at all ten ranks',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make({rank}),u=deploy(),e=enemy(b,{def:500});cast(u);const atk=u.base.atk*(1+u.skill.bb.atk);near(u.s.atk,atk);assert.equal(u.skill.ammoLeft,9);shot(b,u,e);advance(b,.4);near(receipts(b,u,e)[0].amount,Math.max(atk*.05,atk-Math.max(0,500-u.skill.bb.def_penetrate_fixed)));assert.equal(u.skill.ammoLeft,8);}
});
test('S1 and S3 source extended grid acquires an actual far target excluded by normal range',()=>{
 for(const skill of[0,2]){const{b,deploy}=make({skill}),u=deploy(),e=enemy(b,{c:6});assert.ok(!acquireTargets(b,u,effectiveProfile(u)).includes(e));cast(u);if(skill)advance(b,.4);assert.ok(acquireTargets(b,u,effectiveProfile(u)).includes(e));shot(b,u);advance(b,.7);assert.ok(e.hp<100000);}
});
test('Laterano ammunition samples only current deployed operators including self and caps at four',()=>{
 const{b,deploy}=make({others:lateranos}),u=deploy();for(let i=0;i<lateranos.length;i++)deploy(1,i+1,'RIGHT',lateranos[i]);cast(u);assert.equal(u.skill.ammoLeft,12);assert.equal(u.skill.ammoMax,12);b.retreatOperator(lateranos[0]);assert.equal(u.skill.ammoLeft,12);
 const single=make({others:lateranos}),a=single.deploy();cast(a);assert.equal(a.skill.ammoLeft,9);
});
test('Laterano non-HEAL validator retains isolated and target-free allies without accepting unrelated nation',()=>{
 const{b,deploy}=make({others:['char_192_falco','char_222_bpipe']}),u=deploy(),p=deploy(1,1,'RIGHT','char_192_falco'),z=deploy(1,2,'RIGHT','char_222_bpipe');b.addBuff(p,{key:'free',flags:{untargetable:true,isolated:true}});assert.ok(p.tags.has('laterano'));assert.ok(!z.tags.has('laterano'));cast(u);assert.equal(u.skill.ammoLeft,10);
});
test('E0/E1 lack laterano ammo talent while selected E1/E2 potentials preserve double probabilities',()=>{
 for(const[elite,potential,prob]of[[0,1,0],[1,1,.1],[1,5,.13],[2,1,.2],[2,5,.23]]){const{b,deploy}=make({elite,potential}),u=deploy(),e=enemy(b);near(u.mem.excu2Prob,prob);cast(u);assert.equal(u.skill.ammoLeft,elite===2?9:8);rng(b,[.99]);shot(b,u,e);advance(b,.4);near(u.mem.excu2Prob,prob+(elite?elite===1?.03:.05:0));u.skill.end('manual');near(u.mem.excu2Prob,prob);}
});
test('S2 all ranks apply source additive ATK/DEF and block plus one after exact Begin',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make({skill:1,rank}),u=deploy();b.addBuff(u,{key:'external',mods:{atkPct:.2,defPct:.3,blockCnt:1}});cast(u);near(u.s.atk,u.base.atk*(1+.2+u.skill.bb.atk));near(u.s.def,u.base.def*(1+.3+u.skill.bb.def));assert.equal(u.s.blockCnt,u.base.blockCnt+2);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Begin');assert.ok(u.s.flags.disarm);advance(b,.4);assert.equal(u.mem.regularFormVisual.clip,'Skill_2_Idle');assert.equal(Boolean(u.s.flags.disarm),false);}
});
test('S2 enemy melee ANY_ATTACK evades actual damage and restores one capped ammo, independent of distance',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b,{r:1,c:8});cast(u);advance(b,.4);u.skill.ammoLeft-=3;rng(b,[0]);const hp=u.hp,left=u.skill.ammoLeft;b.dealDamage(e,u,{amount:100,type:'true',isAttack:true,applyWay:'melee'});near(u.hp,hp);assert.equal(u.skill.ammoLeft,left+1);u.skill.ammoLeft=u.skill.ammoMax;b.dealDamage(e,u,{amount:100,type:'arts',applyWay:'melee'});assert.equal(u.skill.ammoLeft,u.skill.ammoMax);near(u.hp,hp);
});
test('S2 source-restricted evasion cannot trigger on adjacent ranged, NONE, allied or sourceless damage',()=>{
 for(const origin of['ranged','none','ally','null']){const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b,{c:4});cast(u);advance(b,.4);u.skill.ammoLeft-=2;rng(b,[0]);const hp=u.hp,left=u.skill.ammoLeft;b.dealDamage(origin==='null'?null:origin==='ally'?u:e,u,{amount:100,type:'true',applyWay:origin==='ally'?'melee':origin});near(hp-u.hp,100);assert.equal(u.skill.ammoLeft,left);}
});
test('S2 rejected lottery takes damage without ammo and previously cancelled hit never refunds',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b);cast(u);advance(b,.4);u.skill.ammoLeft-=2;rng(b,[.99]);const hp=u.hp,left=u.skill.ammoLeft;b.dealDamage(e,u,{amount:100,type:'true',applyWay:'melee'});near(hp-u.hp,100);assert.equal(u.skill.ammoLeft,left);
});
test('one active family spends one ammo for all victims and both independently armored waves',()=>{
 for(const skill of[0,1,2]){const{b,deploy}=make({skill}),u=deploy(),es=[enemy(b,{def:100}),enemy(b,{c:5.1,def:100})];cast(u);if(skill)advance(b,.4);const left=u.skill.ammoLeft,calls=rng(b,[0]);shot(b,u);advance(b,.8);assert.equal(u.skill.ammoLeft,left-1);assert.equal(calls(),1);for(const e of es)assert.equal(receipts(b,u,e).length,2);}
});
test('executed ammo family spends despite dodged/cancelled output while wholly unborn control spends zero',()=>{
 for(const why of['dodge','cancel','stun']){const{b,deploy}=make(),u=deploy(),e=enemy(b);cast(u);const left=u.skill.ammoLeft;let h;if(why==='dodge'){rng(b,[0]);b.addBuff(e,{key:'dodge',mods:{dodgePhys:1}});}if(why==='cancel')h=b.on('hit',c=>{if(c.source===u)c.dmg.cancel=true;});shot(b,u,e);if(why==='stun')b.applyStatus(u,'stun',{duration:.001});advance(b,.5);if(h)b.off(h);near(e.hp,100000);assert.equal(u.skill.ammoLeft,left-(why==='stun'?0:1));}
});
test('final single bullet ends once without allowing another zero-ammo family',()=>{
 const{b,deploy}=make(),u=deploy(),e=enemy(b);cast(u);u.skill.ammoLeft=1;shot(b,u,e);advance(b,.4);assert.equal(u.skill.active,false);assert.equal(receipts(b,u,e).length,1);assert.equal(u.mem.excu2Prob,.2);
});
test('final double bullet preserves active modifiers until its free tail and blocks new zero-ammo starts',()=>{
 for(const skill of[0,1,2]){const{b,deploy}=make({skill}),u=deploy(),e=enemy(b);cast(u);if(skill)advance(b,.4);u.skill.ammoLeft=1;rng(b,[0]);shot(b,u,e);first(b,u,e);assert.equal(u.skill.ammoLeft,0);assert.equal(u.skill.active,true);assert.equal(u.profile.canAttack(b,u),false);const attacks=u.stats.attacks;u.atkCd=0;b.step();u.atkCd=1000;assert.equal(u.stats.attacks,attacks);advance(b,.25);assert.equal(u.skill.active,false);assert.equal(receipts(b,u,e).length,2);if(skill===2)assert.ok(u.mem.excu2Phase);}
});
test('S2 evasion can restore last consumed ammo before a final double tail ends the mode',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b);cast(u);advance(b,.4);u.skill.ammoLeft=1;rng(b,[0]);shot(b,u,e);first(b,u,e);assert.equal(u.skill.ammoLeft,0);b.dealDamage(e,u,{amount:1,type:'true',applyWay:'melee'});advance(b,.2);assert.equal(u.skill.active,true);assert.equal(u.skill.ammoLeft,1);assert.equal(receipts(b,u,e).length,2);
});
test('sub-frame control cancels final double tail but still finishes its already consumed last bullet',()=>{
 for(const skill of[0,1,2]){const{b,deploy}=make({skill}),u=deploy(),e=enemy(b);cast(u);if(skill)advance(b,.4);u.skill.ammoLeft=1;rng(b,[0]);shot(b,u,e);first(b,u,e);b.applyStatus(u,'freeze',{duration:.001});advance(b,.25);assert.equal(receipts(b,u,e).length,1);assert.equal(u.skill.active,false);}
});
test('retreat/death after first wave cancels direct double tail and clears all own S3 state',()=>{
 for(const why of['retreat','death']){const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b);cast(u);advance(b,.4);rng(b,[0]);shot(b,u,e);first(b,u,e);if(why==='retreat')b.retreatOperator(ID);else b.kill(u);advance(b,1.5);assert.equal(receipts(b,u,e).length,1);assert.equal(u.mem.excu2Phase,null);assert.equal(u.mem.excu2Marks.size,0);assert.equal(u.findBuff('excu2:s3-atk'),null);}
});
test('manual cancellation cancels an unborn double tail and returns exact S2 End',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b);cast(u);advance(b,.4);rng(b,[0]);shot(b,u,e);first(b,u,e);u.skill.end('manual');assert.equal(u.mem.regularFormVisual.clip,'Skill_2_End');advance(b,.4);assert.equal(receipts(b,u,e).length,1);assert.equal(u.mem.regularFormVisual,null);assert.equal(Boolean(u.s.flags.disarm),false);
});
test('S3 source BAT flat addition composes differently from percent and ordinary animation cap remains one',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b);b.addBuff(u,{key:'external',mods:{batPct:.2,batFlat:.1,aspd:100}});cast(u);advance(b,.4);near(u.s.interval,(u.base.bat+.1+.5)*1.2/2);rng(b,[.99]);near(shot(b,u,e).windup,.267/Math.min(1,u.base.bat/u.s.interval));
});
test('S3 double cap1.2 is distinct from single cap1 and exact event separation scales',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b);cast(u);advance(b,.4);b.addBuff(u,{key:'aspd',mods:{aspd:400}});rng(b,[0]);const v=shot(b,u,e);near(v.windup,.267/1.2);advance(b,.4);const rs=receipts(b,u,e);assert.equal(rs.length,2);near(rs[1].time-rs[0].time,.1/1.2,b.dt*1.1);
});
test('S3 all-rank main wave uses previous ATK stack while double tail uses one newly consumed-ammo stack',()=>{
 for(let rank=1;rank<=10;rank++){const{b,deploy}=make({skill:2,rank}),u=deploy(),e=enemy(b,{def:100});cast(u);advance(b,.4);const initial=u.s.atk;rng(b,[0]);shot(b,u,e);advance(b,.8);const rs=receipts(b,u,e);assert.equal(rs.length,2);near(rs[0].amount,initial-100);near(rs[1].amount,initial+u.base.atk*u.skill.bb['attack@atk']-100);assert.equal(u.mem.excu2Stacks,1);}
});
test('S3 additive stack cap30 and probability cap1 retain foreign ATK and reset only own probability at finish',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b,{hp:1000000});b.addBuff(u,{key:'external',mods:{atkPct:.2}});cast(u);advance(b,.4);u.skill.addAmmo(40);for(let i=0;i<35;i++){rng(b,[.99]);const v=shot(b,u,e);advance(b,v.windup+.2);}assert.equal(u.mem.excu2Stacks,30);near(u.mem.excu2Prob,1);near(u.s.atk,u.base.atk*(1+.2+u.skill.bb.atk+30*u.skill.bb['attack@atk']));u.skill.end('manual');near(u.mem.excu2Prob,.2);advance(b,1.2);near(u.s.atk,u.base.atk*1.2);
});
test('S3 marks accepted shielded zero and arbitrary HP output but never dodged/cancelled/gauge/HPLOSS',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),es=Array.from({length:6},(_,i)=>enemy(b,{c:5+i*.02}));cast(u);advance(b,.4);b.addBuff(es[0],{key:'shield',shield:1000});b.dealDamage(u,es[0],{amount:100,type:'phys'});assert.ok(u.mem.excu2Marks.has(es[0]));b.dealDamage(u,es[1],{amount:1,type:'true',isAttack:false});assert.ok(u.mem.excu2Marks.has(es[1]));rng(b,[0]);b.addBuff(es[2],{key:'dodge',mods:{dodgePhys:1}});b.dealDamage(u,es[2],{amount:1,type:'phys'});const h=b.on('hit',c=>{if(c.target===es[3])c.dmg.cancel=true;});b.dealDamage(u,es[3],{amount:1,type:'phys'});b.off(h);b.dealDamage(u,es[4],{amount:1,type:'element',element:'burn'});b.loseHp(es[5],1,{source:u});assert.deepEqual([...u.mem.excu2Marks.keys()],[es[0],es[1]]);
});
test('S3 end exact .4 finisher and1.1 cleanup are separate from active skill SP and own ATK duration',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b);cast(u);advance(b,.4);b.dealDamage(u,e,{amount:1,type:'true'});const atk=u.s.atk,prior=e.hp;u.skill.end('manual');assert.equal(u.skill.active,false);assert.equal(u.mem.regularFormVisual.clip,'Skill_3_End');near(u.s.atk,atk);near(u.skill.gainSp(1,'talent'),0);advance(b,.35);near(e.hp,prior);advance(b,.1);near(prior-e.hp,atk*u.skill.bb['attack@final_atk_scale']);assert.equal(receipts(b,u,e).filter(x=>x.dmg.tags.includes('excu2:finisher')).length,1);assert.ok(u.mem.excu2Phase);advance(b,.7);assert.equal(u.mem.excu2Phase,null);near(u.s.atk,u.base.atk);assert.equal(Boolean(u.s.flags.noSp),false);assert.equal(u.skill.gainSp(1,'talent'),1);
});
test('S3 global own-mark ALL-motion/free selector selects marked far air/sleep/target-free while core Sleep immunity remains',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),es=[enemy(b),enemy(b,{c:5.1}),enemy(b,{c:5.2}),enemy(b,{c:5.3})],other=enemy(b,{c:5.4});cast(u);advance(b,.4);for(const e of es)b.dealDamage(u,e,{amount:1,type:'true'});for(const e of es)move(b,e,1,8);es[0].motion='FLY';b.applyStatus(es[1],'sleep',{duration:10});b.addBuff(es[2],{key:'free',flags:{untargetable:true}});b.addBuff(es[3],{key:'stealth',flags:{stealth:true}});const hp=es.map(e=>e.hp);u.skill.end('manual');advance(b,.5);for(let i=0;i<es.length;i++)if(i===1)near(es[i].hp,hp[i]);else assert.ok(es[i].hp<hp[i]);near(other.hp,100000);assert.equal(u.mem.excu2Marks.size,0);
});
test('S3 finisher excludes dead/disappeared/replaced marks and does not re-mark its own output',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b),z=enemy(b,{c:5.1}),q=enemy(b,{c:5.2});cast(u);advance(b,.4);for(const x of[e,z,q])b.dealDamage(u,x,{amount:1,type:'true'});b.kill(e);z.hidden=true;q.deploySeq++;const hp=q.hp;u.skill.end('manual');advance(b,.5);near(q.hp,hp);assert.equal(u.mem.excu2Marks.size,0);assert.equal(b.receipts.filter(x=>x.dmg.tags.includes('excu2:finisher')).length,0);
});
test('S3 finisher control cancels unborn output while unrelated buffs and delayed cleanup remain safe',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b);b.addBuff(u,{key:'external',mods:{atkPct:.2}});cast(u);advance(b,.4);b.dealDamage(u,e,{amount:1,type:'true'});const hp=e.hp;u.skill.end('manual');b.applyStatus(u,'stun',{duration:.001});advance(b,1.2);near(e.hp,hp);assert.ok(u.findBuff('external'));assert.equal(u.mem.excu2Phase,null);assert.equal(Boolean(u.s.flags.disarm),false);
});
test('S3 receipt-sampled queued trait multiplier survives manual finish and finisher heals selected value',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b),z=enemy(b,{c:5.1});wound(u);cast(u);advance(b,.4);const hp=u.hp,value=50*u.skill.bb.trait_ratio;b.dealDamage(u,e,{amount:1,type:'phys'});b.dealDamage(u,z,{amount:1,type:'phys'});near(u.hp-hp,value);u.skill.end('manual');advance(b,.15);near(u.hp-hp,2*value);advance(b,.4);assert.ok(u.hp-hp>=3*value);advance(b,1);const before=u.hp;b.dealDamage(u,e,{amount:1,type:'phys'});near(u.hp-before,50);
});
test('S3 full End phase prevents recasting while cleared state admits the next skill safely',()=>{
 const{b,deploy}=make({skill:2}),u=deploy();cast(u);advance(b,.4);u.skill.end('manual');u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),false);advance(b,1.2);u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.activate('test'),true);assert.equal(u.mem.excu2Stacks,0);assert.equal(u.mem.excu2Marks.size,0);
});
test('inactive normal double receives native extra attackSP for every selected attack-recovery skill without multiplying per victim',()=>{
 for(const skill of[0,1,2]){const{b,deploy}=make({skill}),u=deploy(),es=[enemy(b),enemy(b,{c:5.1})];u.skill.setSpTotal(0);rng(b,[0]);shot(b,u);advance(b,.5);near(u.skill.spTotal,2);for(const e of es)assert.equal(receipts(b,u,e).length,2);}
});
test('normal extraSP honors explicit attack-recovery mask and shared noSP rather than synthetic time skills',()=>{
 for(const state of['time','noSP']){const{b,deploy}=make(),u=deploy(),e=enemy(b);u.skill.setSpTotal(0);if(state==='time')u.skill.spType='time';else b.addBuff(u,{key:'lock',flags:{noSp:true}});rng(b,[0]);shot(b,u,e);advance(b,.5);if(state==='time')assert.ok(u.skill.spTotal<1);else near(u.skill.spTotal,0);assert.equal(receipts(b,u,e).length,2);}
});
test('normal extraSP is an executed-spell grant despite dodge/cancel while an interrupted direct tail grants none',()=>{
 for(const state of['dodge','cancel','control']){const{b,deploy}=make(),u=deploy(),e=enemy(b);u.skill.setSpTotal(0);rng(b,[0]);let h;if(state==='dodge')b.addBuff(e,{key:'dodge',mods:{dodgePhys:1}});if(state==='cancel')h=b.on('hit',c=>{if(c.source===u)c.dmg.cancel=true;});shot(b,u,e);if(state==='control'){first(b,u,e);b.applyStatus(u,'stun',{duration:.001});}advance(b,.5);if(h)b.off(h);near(u.skill.spTotal,state==='control'?1:2);}
});
test('ammo double tail never borrows normal ModifySp even after consuming its last bullet',()=>{
 for(const skill of[0,1,2]){const{b,deploy}=make({skill}),u=deploy(),e=enemy(b);cast(u);if(skill)advance(b,.4);u.skill.ammoLeft=1;rng(b,[0]);shot(b,u,e);advance(b,.8);near(u.skill.spTotal,0);assert.equal(receipts(b,u,e).length,2);}
});
test('a last-bullet main-wave kill consumes exactly one family without creating a replacement double victim',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b,{hp:1}),z=enemy(b,{r:1,c:8});cast(u);advance(b,.4);u.skill.ammoLeft=1;rng(b,[0]);shot(b,u,e);first(b,u,e);assert.equal(e.alive,false);move(b,z,3,5);advance(b,1.5);assert.equal(receipts(b,u,e).length,1);near(z.hp,100000);assert.equal(u.skill.active,false);assert.equal(u.mem.excu2Phase,null);assert.equal(u.mem.excu2Marks.size,0);
});
test('S3 retreat during End cancels unborn finisher and redeployment owns fresh probability, marks and stacks',()=>{
 const{b,deploy}=make({skill:2}),u=deploy(),e=enemy(b);cast(u);advance(b,.4);b.dealDamage(u,e,{amount:1,type:'true'});u.skill.end('manual');const hp=e.hp;b.retreatOperator(ID);b.bench[ID].readyAt=b.time;const v=deploy();advance(b,1.5);near(e.hp,hp);assert.notEqual(v,u);near(v.mem.excu2Prob,.2);assert.equal(v.mem.excu2Marks.size,0);assert.equal(v.mem.excu2Stacks,0);assert.equal(v.mem.excu2Phase,null);assert.equal(v.findBuff('excu2:s3-atk'),null);
});
test('already cancelled incoming melee cannot roll source evasion or recover S2 ammo',()=>{
 const{b,deploy}=make({skill:1}),u=deploy(),e=enemy(b);cast(u);advance(b,.4);u.skill.ammoLeft-=2;const calls=rng(b,[0]),hp=u.hp,left=u.skill.ammoLeft,h=b.on('hit',c=>{if(c.target===u)c.dmg.cancel=true;},{priority:100});b.dealDamage(e,u,{amount:100,type:'true',applyWay:'melee'});b.off(h);near(u.hp,hp);assert.equal(u.skill.ammoLeft,left);assert.equal(calls(),0);
});
test('natural active all-range family hits each selected victim twice and spends once in every ammo skill',()=>{
 for(const skill of[0,1,2]){const{b,deploy}=make({skill}),u=deploy(),es=[enemy(b),enemy(b,{c:5.1}),enemy(b,{c:5.2})],air=enemy(b,{fly:true});cast(u);if(skill)advance(b,.4);const left=u.skill.ammoLeft;const calls=rng(b,[0]);u.atkCd=0;b.step();u.atkCd=1000;advance(b,.8);assert.equal(u.stats.attacks,1);assert.equal(u.skill.ammoLeft,left-1);assert.equal(calls(),1);for(const e of es)assert.equal(receipts(b,u,e).length,2);near(air.hp,100000);assert.equal(b.projectiles.list.length,0);}
});
