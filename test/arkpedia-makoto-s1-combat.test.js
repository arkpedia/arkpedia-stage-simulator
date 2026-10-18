// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as base, enemy, advance, near, until} from './helpers/makoto-fixture.js';
import {MakotoSkillOneCombat,MAKOTO_S1_COMBAT_CONTRACT as CONTRACT,verifyMakotoS1Combat} from '../server/sim/content/arkpedia-makoto-s1-combat.js';
import {makotoS1Inputs} from '../server/sim/content/arkpedia-makoto-source.js';
import saria from '../data/arkpedia-saria-prefabs.json' with {type:'json'};
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const active=new Set();
test.afterEach(()=>{for(const f of active) {assert.deepEqual(f.b.errors,[]); f.combat.stop(); f.combat.drain();} active.clear();});
function make({mayBegin,defer=false,...options}={}) {
  const f=base({...options,skill:1,defer:true}); f.controller.stop();
  f.allow=true; f.heals=[];
  f.combat=new MakotoSkillOneCombat(f.b,f.u,{contract:CONTRACT,mayBegin:mayBegin?()=>mayBegin(f):()=>f.allow});
  f.b._setupUnit(f.u,{trait:f.combat.trait(),talents:[],skill:{kind:'instant',completeOnAttack:false,trigger:{rule:'NEVER'}}});
  f.combat.install(); f.b.on('calculatedHeal',h=>{if(h.source===f.u) f.heals.push({...h,time:f.b.time});});
  active.add(f); if(!defer) f.deploy(); return f;
}
function ally(f,{row=5,col=6,hp=10000,ratio=.1,flags={},kind='token'}={}) {
  const t=f.b.spawnToken(f.u,'diagnostic:makoto-recipient',row,col,{def:{name:'Diagnostic recipient',profession:'TOKEN',position:'MELEE',
    stats:{maxHp:hp,atk:0,def:0,blockCnt:0,cost:0},skill:null},kit:{trait:{noAttack:true,noBlock:true},talents:[],skill:{kind:'passive'}}});
  assert.ok(t); t.kind=kind; t.hp=t.s.maxHp*ratio; f.b.addBuff(t,{key:'fixture:recipient',flags}); return t;
}
const flight=f=>[...f.combat.flights.keys()][0];

test('S1 retains original ordered mixed selectors, marker clock and independent cached-ATK transport',()=>{verifyMakotoS1Combat(); const n=makotoS1Inputs();
  assert.equal(n.attack._useCachedAtkOnly,1); assert.equal(n.attack._transferSource,1);
  assert.equal(n.healSelector._maxHpRatio,.5); assert.equal(n.healSelector._maxHpExcludeEqual,0);
  assert.equal(n.heal._ignoreHealFree,0); assert.equal(n.attackSelector._targetMotion,1);
});
test('The half-HP mapping uses the same original selector class/fields as the separately reviewed Saria First Aid source',async()=>{
  const raw=await readFile(new URL('../data/arkpedia-saria-prefabs.json',import.meta.url));
  assert.equal(createHash('sha256').update(raw).digest('hex'),'6d3bc8b94653a034206f391edf323d10d4b65b260c17665ae25b0133b495d916');
  const reference=saria.skills.skchr_demkni_1.find(p=>p.pathId==='5749133806955102138').data,selected=makotoS1Inputs().healSelector;
  assert.equal(reference.m_Script.m_PathID,selected.m_Script.m_PathID);
  for(const key of ['_targetSide','_targetMotion','_targetCategory','_postFilter','_ignoreTargetFree','_ignoreHealFree','_filerMaxHp','_maxHpExcludeEqual','_maxHpRatio'])
    assert.equal(selected[key],reference[key]);
  // This matches reviewed source fields, not a claim to have run compiled Unity.
});
for(const[key,edit]of[
  ['branch priority',n=>n.wrapper._abilityConfigs.reverse()],['threshold strictness',n=>n.healSelector._maxHpExcludeEqual=1],
  ['HealFree bypass',n=>n.heal._ignoreHealFree=1],['air attack',n=>n.attackSelector._targetMotion=3],
  ['live rather than cached ATK',n=>n.attack._useCachedAtkOnly=0],['damage type',n=>n.attack._damageType=1],
  ['ASPD cap',n=>n.attack._maxAnimScale=1],['missing source slow',n=>n.heal._affectedBySlowDown=0],
  ['projectile lifetime',n=>n.projectile.flatMap(r=>r.components).find(c=>c.data._lifeTime!=null).data._lifeTime=Infinity],
  ['projectile source retirement',n=>n.projectile.flatMap(r=>r.components).find(c=>c.data._lifeTime!=null).data._stopWhenSourceInvalid=1],
])test(`Changed S1 ${key} fails source verification`,()=>{const n=structuredClone(makotoS1Inputs()); edit(n); assert.throws(()=>verifyMakotoS1Combat(n),/Changed original/);});

for(const rank of Array.from({length:10},(_,i)=>i+1))for(const dir of ['RIGHT','UP'])test(`S1 rank${rank} ${dir} releases one source Arts projectile and no extra blocked/splash victim`,()=>{
  const f=make({rank,dir}),a=enemy(f),z=enemy(f); f.b.addBuff(f.u,{key:'fixture:many-block',mods:{blockCnt:8}});
  until(f,()=>!!f.combat.phase); const target=f.combat.phase.target,other=target===a?z:a;
  advance(f.b,.7); assert.equal(f.receipts.length,0); assert.equal(f.hits.length,0);
  until(f,()=>f.combat.flights.size===1); assert.equal(f.receipts.length,1);
  const shot=flight(f); assert.equal(shot.speed,10); assert.equal(shot.maxAge,10); assert.equal(shot.data.projectileKey,'projectile_chr_makoto_s1');
  f.allow=false; until(f,()=>f.hits.length===1);
  near(f.hits[0].amount,f.u.s.atk*f.record.bb['attack@atk_scale']);
  assert.equal(f.hits[0].target===target,true); assert.equal(f.hits[0].type,'arts');
  assert.equal(f.hits[0].dmg.isProjectile,true); assert.equal(f.hits[0].dmg.isSkill,false);
  near(other.hp,other.s.maxHp); assert.equal(f.heals.length,0);
});

for(const rank of [1,4,7,10])test(`S1 rank${rank} heals a selected low-HP ally immediately at the source marker instead of attacking`,()=>{
  const f=make({rank}),t=ally(f),e=enemy(f); const hp=t.hp;
  until(f,()=>!!f.combat.phase); assert.equal(f.combat.phase.kind,'heal'); advance(f.b,.7); near(t.hp,hp);
  until(f,()=>f.heals.length===1); f.allow=false;
  near(t.hp-hp,f.u.s.atk*f.record.bb['attack@heal_scale']); assert.equal(f.receipts.length,1);
  assert.equal(f.heals[0].opts.isProjectile,false); assert.equal(f.heals[0].opts.isSkill,false);
  assert.equal(f.heals[0].opts.attackId,1); assert.equal(f.combat.flights.size,0);
  near(e.hp,e.s.maxHp); assert.equal(f.hits.length,0);
});
test('Lowest HP ratio wins, ties use the latest deployment, and exactly half HP follows the explicit inclusive local mapping',()=>{
  const f=make(),a=ally(f,{ratio:.3}),z=ally(f,{ratio:.2,col:4}),last=ally(f,{ratio:.2,row:6,col:5});
  assert.equal(f.combat.choices().target===last,true); last.hp=5001; assert.equal(f.combat.choices().target===z,true);
  z.hp=5000; a.hp=5001; assert.equal(f.combat.choices().target===z,true);
  z.hp=5000.0001; assert.equal(f.combat.choices(),null);
});
test('Self healing is legal and a healable summon needs no invented operator-only profession mask',()=>{
  const f=make(); f.u.hp=100; const t=ally(f,{ratio:.1});
  assert.equal(f.combat.choices().target===f.u,true); f.u.hp=f.u.s.maxHp;
  assert.equal(f.combat.choices().target===t,true);
});
test('Explicit begin cannot bypass the original enemy acquisition range',()=>{
  const f=make(),t=enemy(f,{col:9}); assert.equal(f.combat.begin({kind:'attack',target:t}),false);
  assert.equal(f.combat.phase===null,true); assert.equal(f.u.stats.attacks,0);
});
test('Explicit begin cannot bypass the half-HP heal filter',()=>{
  const f=make(),t=ally(f,{ratio:.9}); assert.equal(f.combat.begin({kind:'heal',target:t}),false);
  assert.equal(f.combat.phase===null,true);
});
test('Explicit begin cannot bypass the source heal-first branch priority',()=>{
  const f=make(),t=enemy(f); ally(f); assert.equal(f.combat.begin({kind:'attack',target:t}),false);
  assert.equal(f.combat.phase===null,true);
});
for(const flags of [{healFree:true},{noHeal:true},{isolated:true},{untargetable:true}])test(`S1 does not choose an ineligible ally ${JSON.stringify(flags)}`,()=>{
  const f=make(); ally(f,{flags}); const e=enemy(f);
  assert.equal(f.combat.choices().kind,'attack'); assert.equal(f.combat.choices().target===e,true);
});
test('Hidden, withdrawn, device and out-of-range allies do not take priority over an in-range ground enemy',()=>{
  const f=make(),a=ally(f),z=ally(f,{col:4}),d=ally(f,{kind:'device',row:6,col:5}),far=ally(f,{row:9,col:9}); a.hidden=true; f.b.retreat(z);
  const e=enemy(f); assert.equal(f.combat.choices().target===e,true); assert.equal(f.combat.choices().target===far,false); assert.equal(d.kind,'device');
});
test('Air, camouflage and target-free enemies are not acquired; range is the selected nonextended x-1 grid',()=>{
  const f=make(); const a=enemy(f,{motion:'FLY'}),z=enemy(f,{flags:{untargetable:true}}),c=enemy(f,{flags:{camou:true}}),far=enemy(f,{col:8});
  f.b.addBuff(f.u,{key:'fixture:range',mods:{rangeExtend:20}});
  assert.equal(f.combat.choices(),null); f.b.removeBuff(c,'fixture:pin'); assert.equal(f.combat.choices().target===c,true);
  assert.equal(f.combat.choices().target===a,false); assert.equal(f.combat.choices().target===z,false); assert.equal(f.combat.choices().target===far,false);
});
test('Native target-free selection does not acquire an invulnerable enemy for an S1 attack',()=>{
  const f=make(),t=enemy(f,{flags:{invulnerable:true}});assert.equal(f.combat.choices(),null);advance(f.b,1);assert.equal(f.receipts.length,0);near(t.hp,t.s.maxHp);
});
test('A newly low-HP ally during enemy windup does not steal its already selected projectile',()=>{
  const f=make(),e=enemy(f),a=ally(f,{ratio:.9}); until(f,()=>!!f.combat.phase); a.hp=100;
  until(f,()=>f.hits.length===1); f.allow=false; assert.equal(f.hits[0].target===e,true); assert.equal(f.heals.length,0);
});
test('A healed-above-threshold retained recipient still receives its selected direct heal without switching to the enemy',()=>{
  const f=make(),a=ally(f),e=enemy(f); until(f,()=>!!f.combat.phase); a.hp=6000;
  until(f,()=>f.heals.length===1); f.allow=false; near(a.hp,6000+f.u.s.atk*f.record.bb['attack@heal_scale']); near(e.hp,e.s.maxHp);
});
test('Healing samples live marker ATK and ordinary output/incoming modifiers; source heal callbacks remain active',()=>{
  const f=make(),a=ally(f); until(f,()=>!!f.combat.phase);
  f.b.addBuff(f.u,{key:'fixture:power',mods:{atkPct:1,healingDealtMul:1.5}}); f.b.addBuff(a,{key:'fixture:incoming',mods:{healingTakenMul:.5}});
  const hp=a.hp; f.b.on('heal',h=>{if(h.source===f.u) h.amount*=2;});
  until(f,()=>f.heals.length===1); f.allow=false; near(a.hp-hp,f.u.s.atk*f.record.bb['attack@heal_scale']*1.5*.5*2);
});
test('Enemy projectiles cache launch ATK while a later source change still supplies current outgoing Arts modifiers',()=>{
  const f=make(),e=enemy(f,{col:7}); until(f,()=>f.combat.flights.size===1); const cached=f.u.s.atk;
  f.allow=false; f.b.addBuff(f.u,{key:'fixture:after-launch',mods:{atkPct:1,artsDealtMul:2}});
  until(f,()=>f.hits.length===1); near(f.hits[0].amount,cached*f.record.bb['attack@atk_scale']*2);
  assert.equal(f.hits[0].target===e,true);
});
test('Projectile impact respects RES and is neither Physical nor true damage',()=>{
  const f=make(),e=enemy(f); e.base.res=50; e.base.def=999999; e.markDirty();
  until(f,()=>f.hits.length===1); f.allow=false; near(f.hits[0].amount,f.u.s.atk*f.record.bb['attack@atk_scale']*.5);
});
for(const kind of ['heal','attack'])for(const how of ['death','replacement','hidden'])test(`${kind} input ${how} during windup never redirects to another life or target`,()=>{
  const f=make(),t=kind==='heal'?ally(f):enemy(f); until(f,()=>!!f.combat.phase);
  if(how==='death') f.b.kill(t,null); if(how==='replacement') t.deploySeq++; if(how==='hidden') t.hidden=true;
  advance(f.b,.8); assert.equal(f.hits.length,0); assert.equal(f.heals.length,0); assert.equal(f.combat.flights.size,0);
});
test('A recipient becoming HealFree before its marker rejects that output instead of substituting an enemy attack',()=>{
  const f=make(),t=ally(f); enemy(f); until(f,()=>!!f.combat.phase); f.b.addBuff(t,{key:'fixture:noheal',flags:{healFree:true}});
  advance(f.b,.8); assert.equal(f.heals.length,0); assert.equal(f.hits.length,0); assert.equal(f.receipts.length,0);
});
for(const how of ['retreat','death','replacement','stop'])test(`A born S1 projectile survives source ${how} and credits its original ledger`,()=>{
  const f=make(),e=enemy(f,{col:7}); until(f,()=>f.combat.flights.size===1);
  const ledger=f.u.stats,atk=f.u.s.atk; f.allow=false;
  if(how==='retreat') f.b.retreat(f.u); if(how==='death') f.b.kill(f.u,null); if(how==='stop') f.combat.stop();
  if(how==='replacement') {f.u.deploySeq++; f.u.stats={...ledger,dmg:0}; f.u.mem.regularFormVisual={clip:'new-life'}; f.b.addBuff(f.u,{key:'fixture:new-power',mods:{atkPct:9}});}
  until(f,()=>e.hp<e.s.maxHp); near(e.s.maxHp-e.hp,atk*f.record.bb['attack@atk_scale']);
  assert.ok(ledger.dmg>0); if(how==='replacement') {near(f.u.stats.dmg,0); assert.equal(f.u.mem.regularFormVisual.clip,'new-life');}
  assert.equal(f.combat.flights.size,0); assert.equal(f.combat.watchers.length,0);
});
for(const how of ['death','replacement','hidden'])test(`A born projectile's ${how} input is never adopted by a new target life`,()=>{
  const f=make(),e=enemy(f,{col:7}); until(f,()=>f.combat.flights.size===1); f.allow=false;
  if(how==='death') f.b.kill(e,null); if(how==='replacement') e.deploySeq++; if(how==='hidden') e.hidden=true;
  advance(f.b,.5); assert.equal(f.hits.length,0); assert.equal(f.combat.flights.size,0);
});
test('A born homing projectile retains its selected life after target-free/air and range changes',()=>{
  const f=make(),e=enemy(f,{col:7}); until(f,()=>f.combat.flights.size===1); f.allow=false;
  e.x=8; e.motion='FLY'; f.b.addBuff(e,{key:'fixture:now-free',flags:{untargetable:true,stealth:true}});
  until(f,()=>f.hits.length===1); assert.equal(f.hits[0].target===e,true);
});
test('An externally removed projectile cannot run a retained arrival callback or leak its watcher',()=>{
  const f=make(),e=enemy(f,{col:7}); until(f,()=>f.combat.flights.size===1); f.allow=false;
  const p=flight(f); f.b.removeProjectiles(q=>q===p); p.onHit({target:e});
  assert.equal(f.hits.length,0); advance(f.b,.1); assert.equal(f.combat.flights.size,0); assert.equal(f.combat.watchers.length,0);
});
test('Duplicate and reentrant arrival callbacks claim one cached Arts output',()=>{
  const f=make(),e=enemy(f,{col:7}); until(f,()=>f.combat.flights.size===1); f.allow=false;
  const p=flight(f); f.b.on('damaged',h=>{if(h.source===f.u)p.onHit({target:e});});
  p.onHit({target:e}); p.onHit({target:e}); advance(f.b,.5);
  assert.equal(f.hits.length,1); assert.equal(f.combat.flights.size,0);
});
test('Ten-second lifetime bounds a shot against a continuously fleeing retained input',()=>{
  const f=make(),e=enemy(f,{col:7}); until(f,()=>f.combat.flights.size===1); f.allow=false;
  const born=f.b.time; while(f.combat.flights.size && f.b.time-born<11) {e.x+=10; advance(f.b,f.b.dt);}
  assert.equal(f.combat.flights.size,0); assert.ok(f.b.time-born<=10+f.b.dt+1e-6);
  assert.ok(f.hits.length<=1); assert.equal(f.combat.watchers.length,0);
});
test('Healing callback source replacement credits the entering source ledger and preserves replacement presentation',()=>{
  const f=make(),a=ally(f),ledger=f.u.stats; let newer;
  f.b.on('heal',h=>{if(h.source!==f.u)return; f.u.deploySeq++; newer=f.u.stats={...ledger,heal:0}; f.u.mem.regularFormVisual={clip:'new-life'};});
  until(f,()=>a.hp>1000); assert.ok(ledger.heal>0); assert.equal(newer.heal,0);
  assert.equal(f.u.mem.regularFormVisual.clip,'new-life'); assert.equal(f.heals.length,1);
});
test('Healing callback recipient replacement cannot heal the next recipient life',()=>{
  const f=make(),a=ally(f); f.b.on('heal',h=>{if(h.source===f.u) a.deploySeq++;});
  advance(f.b,1.1); near(a.hp,1000); assert.equal(f.u.stats.heal,0); assert.equal(f.heals.length,0);
});
test('Source hiding cancels unborn work while preserving a foreign presentation and positive cooldown',()=>{
  const f=make(); ally(f); until(f,()=>!!f.combat.phase); const foreign={clip:'hidden-owner'}; f.u.mem.regularFormVisual=foreign; f.u.hidden=true;
  advance(f.b,.7); assert.equal(f.combat.phase===null,true); assert.equal(f.heals.length,0);
  assert.equal(f.u.mem.regularFormVisual===foreign,true); assert.ok(f.u.atkCd>0);
});
for(const action of ['veto','substitute','recursive','sourceReplacement','control'])test(`S1 ${action} beforeAttack cannot duplicate or substitute an original mixed command`,()=>{
  const f=make(),a=ally(f),e=enemy(f); f.b.on('beforeAttack',h=>{if(h.attacker!==f.u)return;
    if(action==='veto')h.targets=[]; if(action==='substitute')h.targets=[e]; if(action==='recursive')f.b.forceAttack(f.u,[a]);
    if(action==='sourceReplacement')f.u.deploySeq++; if(action==='control')f.b.applyStatus(f.u,'stun',{duration:.1});
  }); advance(f.b,1.1); assert.equal(f.heals.length,action==='recursive'?1:0); assert.equal(f.hits.length,0);
  assert.equal(f.receipts.length,action==='recursive'?1:0);
});
for(const stage of ['windup','admission'])test(`Predicate replacement at ${stage} cannot transfer an old S1 action to the next source life`,()=>{
  let replace=false,checks=0;
  const f=make({mayBegin(f){if(replace && (stage==='windup' || f.combat.accepting&&++checks===2)) {replace=false; f.u.deploySeq++; f.u.mem.regularFormVisual={clip:'new-life'}; f.u.atkCd=7;} return true;}});
  ally(f); if(stage==='windup') {replace=true; assert.equal(f.combat.begin(f.combat.choices()),false);} else {until(f,()=>!!f.combat.phase); replace=true; advance(f.b,.8);}
  assert.equal(f.heals.length,0); assert.equal(f.receipts.length,0); assert.equal(f.u.mem.regularFormVisual.clip,'new-life');
});
test('Live slow/zero elapsed time and an uncapped sampled speed preserve one original marker',()=>{
  const f=make(); enemy(f); f.b.addBuff(f.u,{key:'fixture:fast',mods:{aspd:200}}); until(f,()=>!!f.combat.phase);
  const p=f.combat.phase; near(p.speed,3); advance(f.b,.1); f.b.addBuff(f.u,{key:'fixture:zero',mods:{slowDownMul:0}});
  const age=p.age; advance(f.b,1); near(p.age,age); assert.equal(f.receipts.length,0);
  f.b.removeBuff(f.u,'fixture:zero'); f.b.addBuff(f.u,{key:'fixture:slow',mods:{slowDownMul:.5}});
  until(f,()=>f.receipts.length===1); f.allow=false; assert.equal(f.receipts.length,1);
});
test('Mid-phase ASPD changes do not retime the sampled original release',()=>{
  const f=make(); ally(f); until(f,()=>!!f.combat.phase); const speed=f.combat.phase.speed,started=f.b.time;
  f.b.addBuff(f.u,{key:'fixture:fast',mods:{aspd:300}}); advance(f.b,.7); assert.equal(f.heals.length,0);
  until(f,()=>f.heals.length===1); f.allow=false; near(f.heals[0].time-started,.800000011920929/speed,f.b.dt+1e-6);
});
for(const how of ['stun','freeze','sleep','palsyTriggered','retreat','death','stop','mode'])test(`${how} cancels an unborn persona action`,()=>{
  const f=make(); ally(f); until(f,()=>!!f.combat.phase);
  if(['stun','freeze','sleep'].includes(how))f.b.applyStatus(f.u,how,{duration:3});
  if(how==='palsyTriggered')f.b.emit('palsyTriggered',{unit:f.u});
  if(how==='retreat')f.b.retreat(f.u); if(how==='death')f.b.kill(f.u,null); if(how==='stop')f.combat.stop();
  if(how==='mode') {f.allow=false; f.u.mem.regularFormVisual={clip:'other-mode'};}
  advance(f.b,.8); assert.equal(f.heals.length,0); assert.equal(f.receipts.length,0);
  if(how==='mode')assert.equal(f.u.mem.regularFormVisual.clip,'other-mode');
});
test('Stored palsy and silence do not invent an interruption',()=>{
  const f=make(); ally(f); until(f,()=>!!f.combat.phase); f.b.applyStatus(f.u,'palsy',{duration:3,value:1}); f.b.applyStatus(f.u,'silence',{duration:3});
  until(f,()=>f.heals.length===1); f.allow=false; assert.equal(f.receipts.length,1);
});
test('A fresh explicit S1 begin cannot skip the positive cooldown left by a real interruption',()=>{
  const f=make();enemy(f);until(f,()=>!!f.combat.phase);f.b.emit('palsyTriggered',{unit:f.u});assert.ok(f.u.atkCd>0);
  assert.equal(f.combat.begin(f.combat.choices()),false);assert.equal(f.combat.phase===null,true);
});
test('Battle end drains born transport and all listeners without a late impact',()=>{
  const f=make(); enemy(f,{col:7}); until(f,()=>f.combat.flights.size===1); f.b.finished=true; f.b.emit('battleEnd',{});
  assert.equal(f.combat.flights.size,0); assert.equal(f.combat.watchers.length,0); assert.equal(f.combat.handles.length,0);
  advance(f.b,1); assert.equal(f.hits.length,0);
});
test('Fresh selected S1, explicit predicate/contract and single installation are required',()=>{
  const f=make({defer:true}); assert.throws(()=>new MakotoSkillOneCombat(f.b,f.u),/Fresh selected/);
  assert.throws(()=>new MakotoSkillOneCombat(f.b,f.u,{contract:{...CONTRACT},mayBegin:()=>true}),/Fresh selected/);
  assert.throws(()=>f.combat.install(),/reinstalled/);
  const other=base({skill:2,defer:true}); other.controller.stop(); assert.throws(()=>new MakotoSkillOneCombat(other.b,other.u,{contract:CONTRACT,mayBegin:()=>true}),/Fresh selected/);
  f.deploy(); assert.throws(()=>new MakotoSkillOneCombat(f.b,f.u,{contract:CONTRACT,mayBegin:()=>true}),/Fresh selected/);
});
