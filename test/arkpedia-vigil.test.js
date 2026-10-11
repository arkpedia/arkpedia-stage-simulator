// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import { StandardBattle } from '../server/sim/arkpedia.js';
import { defaultBuild } from '../shared/arkpedia/loadout.js';
import { summonRecordFor,summonCardId,summonUnitId } from '../shared/arkpedia/summons.js';
import { deployRegularSummon,retreatRegularSummon,regularSummonCards,summonPlacementError } from '../server/sim/content/arkpedia-summons.js';
import { acquireTargets,effectiveProfile } from '../server/sim/ai.js';
const ID='char_427_vigil',TOKEN='token_10028_vigil_wolf',S2='vigil_wolf_s_2',MARK='vigil_wolf_s_3[mark]';
const near=(a,e,tol=1e-5)=>assert.ok(Math.abs(a-e)<tol,`${a} != ${e}`);
const advance=(b,s)=>{for(let i=0;i<Math.round(s/b.dt);i++)b.step();assert.deepEqual(b.errors,[]);};
function make({skill=0,rank=10,elite=2,level=null,potential=1,trust=0,defer=false}={}){
 const source=structuredClone(data),o=source.operators[ID];source.stage.geometry.waves[0].spawns=[];source.stage.battle.dp_per_second=0;
 const build={...defaultBuild(o),elite,level:level??o.phases[elite].maxLevel,potential,trust,skillId:o.skills[skill].id,skillRank:rank};
 const b=new StandardBattle(source,{operators:[build]});b.autoFinish=false;b.setViewport('fullscreen-workspace');b.addDp('arkpedia',99);
 const deploy=()=>{b.addDp('arkpedia',99);const u=b.deployOperator(ID,1,4,'RIGHT');assert.ok(u);u.atkCd=1000;return u;};
 return {b,u:defer?null:deploy(),build,deploy};
}
const card=b=>regularSummonCards(b).find(s=>s.ownerId===ID);
function point(b,{warm=true}={}){const t=deployRegularSummon(b,summonCardId(ID),2,5);t.atkCd=1000;if(warm){advance(b,1.034);t.atkCd=1000;}return t;}
function cast(b,u){u.skill.setSpTotal(u.skill.spCost);assert.equal(u.skill.manual?b.activateOperator(ID):u.skill.activate('fixture'),true);u.atkCd=1000;}
function enemy(b,{hp=100000,x=5.7,y=2,def=0,res=0,fly=false}={}){
 const e=b.spawnEnemy('enemy_1007_slime',{pos:[0,0]});e.x=x;e.y=y;e.base.maxHp=100000;e.base.def=def;e.base.res=res;e.base.moveSpeed=0;if(fly)e.motion='FLY';e.markDirty();void e.s;e.hp=hp;b.addBuff(e,{key:'pin',flags:{noMove:true,disarm:true}});b._buildEnemyIndex();return e;
}
const hit=(b,u,e,s=.8)=>{b.forceAttack(u,[e]);u.atkCd=1000;advance(b,s);};
const silence=(b,u)=>b.addBuff(u,{key:'test:silence',flags:{silence:true}});

test('Wolfpack separate level/trust/potential stats and zero-slot placement retain strict original skill ranks',()=>{
 for(const elite of[0,1,2])for(const level of[1,data.operators[ID].phases[elite].maxLevel]){
  const{b,u,build}=make({elite,level,rank:[4,7,10][elite],potential:5,trust:200});const r=summonRecordFor(ID,build,data.tokens),p=data.tokens[TOKEN].phases[elite],kf=level===1?p.attributesKeyFrames[0]:p.attributesKeyFrames.at(-1);
  for(const k of['maxHp','atk','def'])near(r.stats[k],kf.data[k]);assert.equal(r.stats.cost,0);assert.equal(r.stats.respawnTime,[30,27,25][elite]);assert.equal(r.stats.blockCnt,0);
  const dp=b.dp,t=point(b);near(b.dp,dp);assert.equal(b.deployedSlots(),1);assert.equal(t.s.blockCnt,2);assert.equal(card(b).stock,0);assert.equal(u.s.flags.healFree,undefined);assert.equal(t.s.flags.healFree,true);
  assert.throws(()=>summonRecordFor(ID,{...build,skillRank:11},data.tokens));assert.ok(summonPlacementError(b,summonCardId(ID),2,6));
 }
});
test('initial warm1s, two heads then three after selected interval; capped growth never exceeds three',()=>{
 for(const elite of[0,1,2]){const{b,u}=make({elite,rank:[4,7,10][elite]});silence(b,u);const t=point(b,{warm:false});assert.equal(t.mem.vigilMode,'warming');assert.equal(t.s.blockCnt,0);advance(b,.967);assert.equal(t.mem.vigilMode,'warming');advance(b,.067);t.atkCd=1000;assert.equal(t.mem.vigilHeads,2);near(t.hp,t.s.maxHp);advance(b,[30,27,25][elite]+.1);assert.equal(t.mem.vigilHeads,3);assert.equal(t.s.blockCnt,3);advance(b,35);assert.equal(t.mem.vigilHeads,3);}
});
test('accepted fatal damage loses one head and repairs HP after correct loss bookkeeping; last head keeps point identity',()=>{
 const{b,u}=make();silence(b,u);const t=point(b),e=enemy(b),id=t.id;t.hp=200;const taken=t.stats.taken;near(b.dealDamage(e,t,{type:'true',amount:9999}),200);assert.equal(t.mem.vigilHeads,1);near(t.hp,t.s.maxHp);near(t.stats.taken-taken,200);assert.equal(t.alive,true);assert.equal(t.s.blockCnt,1);
 b.dealDamage(e,t,{type:'true',amount:9999});assert.equal(t.id,id);assert.equal(t.mem.vigilMode,0);assert.equal(t.s.blockCnt,0);near(t.hp,1);assert.equal(t.s.flags.invulnerable,true);advance(b,26.1);t.atkCd=1000;assert.equal(t.mem.vigilMode,1);assert.equal(t.mem.vigilHeads,1);near(t.hp,t.s.maxHp);
});
test('shields, canceled hits, full physical dodge and undeadable never consume a head',()=>{
 for(const what of['shield','cancel','dodge','undeadable']){const{b}=make(),t=point(b),e=enemy(b);t.hp=10;if(what==='shield')b.addBuff(t,{key:'shield',shield:20000});if(what==='cancel')b.on('hit',c=>{if(c.target===t)c.dmg.cancel=true;});if(what==='dodge')b.addBuff(t,{key:'dodge',mods:{dodgePhys:1}});if(what==='undeadable')b.addBuff(t,{key:'undeadable',flags:{undeadable:true}});b.dealDamage(e,t,{type:'phys',amount:9999});assert.equal(t.mem.vigilHeads,2);assert.equal(t.mem.vigilMode,1);}
});
test('manual retreat rests whole point, repeated retreat preserves timer; owner withdrawal permanently removes it',()=>{
 const{b,u}=make();silence(b,u);const t=point(b),dp=b.dp;retreatRegularSummon(b,summonUnitId(t));assert.equal(t.mem.vigilHeads,0);const ready=t.mem.vigilReadyAt;advance(b,2);retreatRegularSummon(b,summonUnitId(t));near(t.mem.vigilReadyAt,ready);near(b.dp,dp);b.retreatOperator(ID);assert.equal(t.alive,false);advance(b,30);assert.equal(t.alive,false);assert.equal(card(b).available,false);
});
test('normal Wolfpack hits one victim with independent per-head Physical receipts and source .4667 release',()=>{
 const{b,u}=make();silence(b,u);const t=point(b),e=enemy(b,{def:100}),other=enemy(b,{x:5.9});const receipts=[];b.on('damaged',c=>{if(c.source===t)receipts.push(c);});hit(b,t,e,.4);near(e.hp,100000);advance(b,.2);near(100000-e.hp,t.s.atk+(t.s.atk-100));near(other.hp,100000);assert.equal(receipts.length,2);assert.ok(acquireTargets(b,t,effectiveProfile(t)).length<=1);
});
test('three head attacks do not become AoE, gain extra attack SP, or target flying/sleeping enemies',()=>{
 const{b,u}=make();cast(b,u);const t=point(b),e=enemy(b),other=enemy(b,{x:5.9}),fly=enemy(b,{fly:true,x:5.8});t.mem.vigilEnhance();assert.equal(t.mem.vigilHeads,3);hit(b,t,e);near(100000-e.hp,3*t.s.atk);near(other.hp,100000);near(fly.hp,100000);b.applyStatus(e,'sleep',{duration:10});assert.ok(!acquireTargets(b,t,effectiveProfile(t)).includes(e));assert.ok(!acquireTargets(b,t,effectiveProfile(t)).includes(fly));
});
test('normal Vigil fires once at .2667; own-point trait1.5 and potential DEF ignore are conditional',()=>{
 for(const potential of[1,5]){const{b,u}=make({potential}),t=point(b),e=enemy(b,{x:4.8,y:1,def:300});e.blockedBy=t;const pen=potential===5?200:175;hit(b,u,e,.2);near(e.hp,100000);advance(b,.2);near(100000-e.hp,u.s.atk*1.5-(300-pen));e.hp=100000;e.blockedBy={ownerUnit:u,defId:'fake',alive:true,deployed:true,blocking:[e],x:e.x,y:e.y,s:{blockCnt:1,flags:{}}};hit(b,u,e);near(100000-e.hp,u.s.atk-300);}
});
test('Wolfpack E2 DEF penetration uses any blocker, whereas owner needs its own point',()=>{
 const{b,u}=make({potential:5}),t=point(b),e=enemy(b,{x:5.2,def:300});e.blockedBy={defId:'foreign',alive:true,deployed:true,blocking:[e],x:e.x,y:e.y,s:{blockCnt:1,flags:{}}};b.dealDamage(u,e,{type:'phys',amount:100});near(100000-e.hp,5);e.hp=100000;hit(b,t,e);near(100000-e.hp,(t.s.atk-100)+(t.s.atk-300));
});
test('every S1 rank grants instant7DP even without point, no fake1s SP/disarm cast',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u}=make({rank}),dp=b.dp;cast(b,u);near(b.dp-dp,7);assert.equal(u.skill.active,false);assert.equal(!!u.s.flags.disarm,false);assert.equal(!!u.s.flags.noSp,false);advance(b,.1);assert.ok(u.skill.spTotal>0);}
});
test('S1 adds head, full-heals only at cap, and invokes immediate1s rebirth from rest',()=>{
 const{b,u}=make(),t=point(b);t.hp=100;cast(b,u);assert.equal(t.mem.vigilHeads,3);near(t.hp,100);advance(b,1.1);cast(b,u);near(t.hp,t.s.maxHp);retreatRegularSummon(b,summonUnitId(t));advance(b,1.1);cast(b,u);assert.equal(t.mem.vigilMode,'warming');advance(b,1.1);t.atkCd=1000;assert.equal(t.mem.vigilHeads,1);near(t.hp,t.s.maxHp);
});
test('S1 natural time SP triggers instant commands without forced readiness or enemies',()=>{
 const{b,u}=make();const dp=b.dp;advance(b,16.1);assert.equal(u.skill.activations,1);near(b.dp-dp,7);assert.equal(u.skill.active,false);assert.ok(u.skill.spTotal>0);
});
test('every S2 rank grants instant2DP, heals once and consumes one nonstacking next-attack charge',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u}=make({skill:1,rank}),t=point(b),e=enemy(b),dp=b.dp;t.hp=100;cast(b,u);near(b.dp-dp,2);assert.ok(t.findBuff(S2));const v=u.def.skill.bb,receipts=[];b.on('damaged',c=>{if(c.source===t)receipts.push(c);});hit(b,t,e);near(100000-e.hp,t.s.atk*(v['vigil_wolf_s_2.atk_scale']+1));near(t.hp,100+t.s.maxHp*v['vigil_wolf_s_2.hp_ratio']);assert.equal(receipts.length,2);assert.equal(t.findBuff(S2),null);}
});
test('S2 command refresh does not stack, retains through rest; accepted kill awards1DP once',()=>{
 const{b,u}=make({skill:1}),t=point(b);cast(b,u);advance(b,1.1);cast(b,u);assert.equal(t.buffs.filter(v=>v.key===S2).length,1);retreatRegularSummon(b,summonUnitId(t));assert.ok(t.findBuff(S2));advance(b,26.1);t.atkCd=1000;const e=enemy(b,{hp:1}),dp=b.dp;hit(b,t,e);near(b.dp-dp,1);assert.equal(t.findBuff(S2),null);
});
test('interrupted unborn Wolfpack attack retains S2 charge; subsequent legal attack consumes it',()=>{
 const{b,u}=make({skill:1}),t=point(b),e=enemy(b);cast(b,u);b.forceAttack(t,[e]);t.atkCd=1000;advance(b,.2);b.applyStatus(t,'stun',{duration:.001});advance(b,.4);near(e.hp,100000);assert.ok(t.findBuff(S2));hit(b,t,e);assert.equal(t.findBuff(S2),null);
});
test('S3 first-event burst emits3 projectile receipts once, cycles A/B/C, normal attacks return to one',()=>{
 const{b,u}=make({skill:2}),e=enemy(b,{x:4.8,y:1});cast(b,u);const receipts=[];b.on('damaged',c=>{if(c.source===u)receipts.push(c);});for(let i=0;i<3;i++){hit(b,u,e,.3);assert.equal(u.mem.vigilCycle,i+1);}assert.equal(receipts.length,9);near(100000-e.hp,9*u.s.atk);u.skill.end('test');hit(b,u,e);assert.equal(receipts.length,10);
});
test('all S3 ranks deliver separate owner physical/Arts and per-head Arts using host ATK against own blocked victim',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u}=make({skill:2,rank}),t=point(b),e=enemy(b,{def:100,res:20});e.blockedBy=t;t.blocking=[e];cast(b,u);const coeff=u.def.skill.bb['attack@vigil_s_3.atk_scale'];hit(b,t,e);near(100000-e.hp,t.s.atk+(t.s.atk-100)+2*u.s.atk*coeff*.8);e.hp=100000;e.x=4.8;e.y=1;b._buildEnemyIndex();e.blockedBy=t;hit(b,u,e);near(100000-e.hp,3*u.s.atk*1.5+3*u.s.atk*coeff*.8);}
});
test('S3 samples blocking at projectile impact and suppresses recursive trait on derived Arts',()=>{
 const{b,u}=make({skill:2}),t=point(b),e=enemy(b,{x:4.8,y:1,res:20});cast(b,u);b.forceAttack(u,[e]);u.atkCd=1000;advance(b,.1);e.blockedBy=t;advance(b,.2);near(100000-e.hp,3*u.s.atk*1.5+3*u.s.atk*.5*.8);
});
test('S3 projectiles already emitted survive owner stun/skill expiry; new birth canceled by sub-dt control',()=>{
 for(const after of[false,true]){const{b,u}=make({skill:2}),e=enemy(b,{x:4.8,y:1});cast(b,u);b.forceAttack(u,[e]);u.atkCd=1000;if(after)advance(b,.1);b.applyStatus(u,'stun',{duration:.001});u.skill.end('test');advance(b,.3);near(100000-e.hp,after?3*u.s.atk:0);}
});
test('all S3 ranks gain9/10/11/12DP at source interval, never up front, and stop on end',()=>{
 for(let rank=1;rank<=10;rank++){const{b,u}=make({skill:2,rank}),dp=b.dp;cast(b,u);near(b.dp,dp);advance(b,.8);near(b.dp,dp);advance(b,14.3);near(b.dp-dp,u.def.skill.bb.value);assert.equal(u.skill.active,false);advance(b,3);near(b.dp-dp,u.def.skill.bb.value);}
});
test('S3 cancellation clears token marks and prevents later DP; new point inside active skill inherits mark',()=>{
 const{b,u}=make({skill:2});cast(b,u);const t=point(b);assert.ok(t.findBuff(MARK));const dp=b.dp;u.skill.end('test');assert.equal(t.findBuff(MARK),null);advance(b,3);near(b.dp,dp);
});
