// SPDX-License-Identifier: GPL-3.0-or-later
// Internal native action receiver; no fear enemy/stage admission follows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { makeBattle, enemyRec } from './helpers/battleHarness.js';
import { compileStageLocalEnemy } from '../shared/arkpedia/enemy-records.js';
import { fearProjectileAfflictions } from '../server/sim/content/chapter16-fear-affliction.js';
import {applyFearProjectileImpact,fearProjectileDamageAction,fearProjectileSourceReference} from '../server/sim/content/chapter16-fear-impact.js';
import {fearProjectileReached,fearProjectileMotionStep} from '../server/sim/content/chapter16-fear-movement.js';
import { battle as minerBattle, keys as minerKeys } from './helpers/ch17Harness.js';
import { chapter16Shadow } from '../server/sim/content/chapter16-shadow.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const parentKey='feawpj_a[mcreep_fear]';
test('selected speed-10 motion advances in three dimensions and snaps without overshoot',()=>{
 const origin={x:0,y:0,z:0};
 for(const axis of ['x','y','z']){
  const target={...origin,[axis]:5};
  assert.deepEqual(fearProjectileMotionStep(origin,target,.1),{...origin,[axis]:1,reached:false});
  assert.deepEqual(fearProjectileMotionStep(origin,target,1),{...target,reached:true});
  assert.deepEqual(target,{...origin,[axis]:5});
 }
 const diagonal=fearProjectileMotionStep(origin,{x:3,y:4,z:0},.1);
 assert.equal(diagonal.x,Math.fround(.6));
 // Native component*delta then *speed rounds twice: this is one ULP above
 // float32(0.8), which a combined distance multiplier would incorrectly return.
 assert.equal(diagonal.y,.8000000715255737);assert.equal(diagonal.z,0);
 assert.equal(diagonal.reached,false);assert.deepEqual(origin,{x:0,y:0,z:0});
});

test('motion uses the supplied current 3D destination and arrival tolerance after movement',()=>{
 const first=fearProjectileMotionStep({x:0,y:0,z:0},{x:5,y:0,z:0},.1);
 const second=fearProjectileMotionStep(first,{x:1,y:0,z:5},.1);
 assert.deepEqual(second,{x:1,y:0,z:1,reached:false});
 assert.deepEqual(fearProjectileMotionStep({x:0,y:0,z:0},{x:.09,y:0,z:0},0),{x:0,y:0,z:0,reached:true});
 assert.deepEqual(fearProjectileMotionStep({x:0,y:0,z:0},{x:0,y:0,z:0},0),{x:0,y:0,z:0,reached:true});
 for(const delta of [-1,NaN,Infinity])assert.throws(()=>fearProjectileMotionStep(first,second,delta));
 assert.throws(()=>fearProjectileMotionStep({x:0,y:0},{x:1,y:1,z:0},.1),/3D/);
});

test('native arrival includes the float32 0.1 boundary and checks all three mount-point axes',()=>{
 const zero={x:0,y:0,z:0},radius=Math.fround(.1),outside=Math.fround(radius+2**-27);
 const source=read('data/candidates/arkpedia-windows-fear-movement-source.json');
 assert.equal(source.arrivalTolerance.float32,radius);assert.equal(source.arrivalTolerance.dimensions,3);
 for(const axis of ['x','y','z']){
  assert.equal(fearProjectileReached(zero,{...zero,[axis]:radius}),true,axis+' inclusive');
  assert.equal(fearProjectileReached(zero,{...zero,[axis]:outside}),false,axis+' outside');
 }
 assert.equal(fearProjectileReached(zero,{x:.06,y:.06,z:.06}),false,'3D distance exceeds radius despite each axis fitting');
 assert.equal(fearProjectileReached({x:12,y:-3,z:4},{x:12.05,y:-3.05,z:4}),true);
 assert.equal(fearProjectileReached(zero,{x:0,y:0}),false,'missing mount-point height is not silently flattened');
 for(const value of [NaN,Infinity,-Infinity])assert.equal(fearProjectileReached(zero,{x:0,y:0,z:value}),false);
 assert.equal(fearProjectileReached(null,zero),false);
});
function fixture({marked=true,full=false,local=false}={}){
 const ref=read('data/candidates/arkpedia-stage-16-9-source.json').rawLevel.enemyDbRefs.find(r=>r.useDb===false);
 const targetRec=local?compileStageLocalEnemy(ref,{damageType:'PHYSIC'}):enemyRec({key:'recipient',maxHp:1000,atk:0,moveSpeed:0});
 const h=makeBattle({content:'generic',autoFinish:false,defs:{enemies:{source:enemyRec({key:'source',atk:0,moveSpeed:0}),[targetRec.key]:targetRec}}});
 h.b.start();const source=h.spawn('source',{pos:[10,6]}),target=h.spawn(targetRec.key,{pos:[10,7]});
 for(const u of [source,target]){u.profile.noAttack=true;u.base.moveSpeed=0;u.markDirty();}
 if(marked)h.b.addBuff(target,{key:'enemy_mcreep_self_mark',persist:true});
 target.hp=full?target.s.maxHp:target.s.maxHp/2;
 return{h,b:h.b,source,target,manager:fearProjectileAfflictions(h.b)};
}
function apply(f){const p=f.manager.apply(f.source,f.target);assert.ok(p);return p;}
function assertClean(f){assert.equal(f.target.findBuff(parentKey),null);assert.equal(f.target.buffs.some(b=>b.key.startsWith('ch16:fearpj:')),false);assert.deepEqual(f.b.errors,[]);}

test('born source reference captures preprocessing ATK but resolves later same-life ATK',()=>{
 const f=fixture();f.source.base.atk=200;f.source.markDirty();const ref=fearProjectileSourceReference(f.b,f.source);
 f.source.base.atk=325;f.source.markDirty();const hp=f.target.hp;
 fearProjectileDamageAction(f.b,ref)({target:f.target});assert.equal(ref.cachedAtk,200);assert.equal(hp-f.target.hp,325);
 ref.release();assert.equal(ref.resolveSource(),null);assert.deepEqual(f.b.errors,[]);
});

test('dead or inactive but unretired source keeps its same-life reference until removal',()=>{
 const f=fixture(),ref=fearProjectileSourceReference(f.b,f.source);
 f.source.alive=false;f.source.deployed=false;f.b.emit('death',{unit:f.source});
 assert.equal(ref.resolveSource(),f.source);f.b.emit('removed',{unit:f.source});assert.equal(ref.resolveSource(),null);
});

for(const retire of ['removed','reuse','battleEnd'])test('source reference '+retire+' preserves cached damage and rejects replacement stats',()=>{
 const f=fixture();f.source.base.atk=210;f.source.markDirty();const ref=fearProjectileSourceReference(f.b,f.source);
 if(retire==='removed')f.b.kill(f.source,null);else if(retire==='reuse')f.source.deploySeq++;else f.b.emit('battleEnd',{});
 f.source.base.atk=9999;f.source.markDirty();assert.equal(ref.resolveSource(),null);assert.equal(ref.cachedAtk,210);
 const hp=f.target.hp;fearProjectileDamageAction(f.b,ref)({target:f.target});
 assert.equal(hp-f.target.hp,retire==='battleEnd'?0:210);assert.deepEqual(f.b.errors,[]);
});

for(const retiredFirst of [false,true])test('source reference prevents post-battle cached output without affliction manager, retired='+retiredFirst,()=>{
 const h=makeBattle({content:'generic',autoFinish:false,defs:{enemies:{source:enemyRec({key:'source',atk:200,moveSpeed:0}),target:enemyRec({key:'target',maxHp:1000,moveSpeed:0})}}});
 h.b.start();const source=h.spawn('source',{pos:[10,6]}),target=h.spawn('target',{pos:[10,7]});
 const ref=fearProjectileSourceReference(h.b,source);assert.equal(h.b.chapter16FearAfflictions,undefined);
 if(retiredFirst)h.b.kill(source,null);
 h.b.emit('battleEnd',{});const hp=target.hp;fearProjectileDamageAction(h.b,ref)({target});
 assert.equal(target.hp,hp);assert.equal(ref.isBattleActive(),false);
});

test('impact damage reads the resolved source ATK after buff and attachment callbacks',()=>{
 const f=fixture(),hp=f.target.hp,damage=fearProjectileDamageAction(f.b,{cachedAtk:200,resolveSource:()=>f.source});
 applyFearProjectileImpact(f.b,{source:f.source,target:f.target,
  applyAttachments:()=>{f.b.addBuff(f.source,{key:'impact-atk',persist:true,mods:{atkFlat:350}});},runActions:damage});
 assert.equal(hp-f.target.hp,350);assert.deepEqual(f.b.errors,[]);
});

test('missing source reference uses the supplied preprocessed ATK without transferring damage credit',()=>{
 const f=fixture(),hp=f.target.hp,packets=[];
 f.b.on('damaged',c=>{if(c.target===f.target)packets.push(c);});
 const damage=fearProjectileDamageAction(f.b,{cachedAtk:225,resolveSource:()=>null});
 applyFearProjectileImpact(f.b,{source:f.source,target:f.target,applyAttachments:()=>{},runActions:damage});
 assert.equal(hp-f.target.hp,225);assert.equal(packets.length,1);assert.equal(packets[0].source,null);
 assert.deepEqual(f.b.errors,[]);
});

test('source alive flag alone does not override an explicit native-reference resolver',()=>{
 const f=fixture(),hp=f.target.hp;f.source.base.atk=175;f.source.markDirty();f.b.kill(f.source,null);
 const amount=f.source.s.atk,damage=fearProjectileDamageAction(f.b,{cachedAtk:999,resolveSource:()=>f.source});
 applyFearProjectileImpact(f.b,{source:f.source,target:f.target,applyAttachments:()=>{},runActions:damage});
 assert.equal(hp-f.target.hp,amount);assert.deepEqual(f.b.errors,[]);
});

test('reentrant source resolution cannot damage a replacement recipient life',()=>{
 const f=fixture(),hp=f.target.hp;
 const damage=fearProjectileDamageAction(f.b,{cachedAtk:225,resolveSource:()=>{f.target.deploySeq++;return null;}});
 damage({target:f.target});assert.equal(f.target.hp,hp);
 for(const cachedAtk of [-1,NaN,Infinity])assert.throws(()=>fearProjectileDamageAction(f.b,{cachedAtk,resolveSource:()=>null}),/requires/);
});

test('an ended battle rejects damage before invoking a source resolver',()=>{
 const f=fixture();f.b.emit('battleEnd',{});let calls=0;
 fearProjectileDamageAction(f.b,{cachedAtk:200,resolveSource:()=>{calls++;return f.source;}})({target:f.target});
 assert.equal(calls,0);assert.deepEqual(f.b.errors,[]);
});

test('impact runs the caller attachments and damage actions after Fear/Disarm admission',()=>{
 const f=fixture(),order=[],hp=f.target.hp;
 const ok=applyFearProjectileImpact(f.b,{source:f.source,target:f.target,
  applyAttachments:({target})=>{assert.equal(target.s.flags.disarm,true);assert.equal(target.s.flags.fear,true);order.push('attachments');},
  runActions:({source,target})=>{assert.equal(target.s.flags.disarm,true);order.push('damage');f.b.dealDamage(source,target,{amount:100,type:'arts',canDodge:false});}});
 assert.equal(ok,true);assert.deepEqual(order,['attachments','damage']);assert.equal(f.target.hp,hp-100);
 assert.deepEqual(f.b.errors,[]);
});

test('unmarked impact recipients still receive caller actions after the parent finishes',()=>{
 const f=fixture({marked:false});let count=0;
 assert.equal(applyFearProjectileImpact(f.b,{source:f.source,target:f.target,
  applyAttachments:()=>{count++;},runActions:()=>{count++;}}),true);
 assert.equal(count,2);assertClean(f);
});

for(const event of ['death','reuse','battleEnd'])test('impact '+event+' during buff admission prevents later output for that recipient life',()=>{
 const f=fixture();let calls=0;
 f.b.on('beforeBuff',c=>{if(c.unit!==f.target||c.buff.key!==parentKey)return;
  if(event==='death')f.b.kill(f.target,null);else if(event==='reuse')f.target.deploySeq++;else f.b.emit('battleEnd',{});});
 assert.equal(applyFearProjectileImpact(f.b,{source:f.source,target:f.target,
  applyAttachments:()=>calls++,runActions:()=>calls++}),false);
 assert.equal(calls,0);
});

test('impact revalidates the recipient after attachment callbacks before running damage actions',()=>{
 const f=fixture();let calls=0;
 assert.equal(applyFearProjectileImpact(f.b,{source:f.source,target:f.target,
  applyAttachments:()=>{f.target.deploySeq++;},runActions:()=>calls++}),false);
 assert.equal(calls,0);
});

test('a completed battle rejects later impacts even when the caller still holds live object references',()=>{
 const f=fixture();f.b.emit('battleEnd',{});let calls=0;
 assert.equal(applyFearProjectileImpact(f.b,{source:f.source,target:f.target,
  applyAttachments:()=>calls++,runActions:()=>calls++}),false);
 assert.equal(calls,0);assertClean(f);
});

test('born impact accepts an explicitly retained dead source and does not choose its damage packet',()=>{
 const f=fixture();f.b.kill(f.source,null);let actionSource;
 assert.equal(applyFearProjectileImpact(f.b,{source:f.source,target:f.target,
  applyAttachments:()=>{},runActions:({source})=>{actionSource=source;}}),true);
 assert.equal(actionSource,f.source);assert.equal(f.target.s.flags.disarm,true);
 assert.throws(()=>applyFearProjectileImpact(f.b,{source:f.source,target:f.target,runActions:()=>{}}),/explicit/);
});
test('affliction producer reproduces native graph, alias receipt and exact derived-buff action contract',()=>{
 const c=read('data/candidates/arkpedia-ch16-fear-affliction-contract.json');assert.equal(c.testOnly,true);assert.equal(c.frameParity,false);
 for(const row of Object.values(c.sources))assert.equal(createHash('sha256').update(readFileSync(new URL('../'+row.path,import.meta.url))).digest('hex'),row.sha256);
 assert.equal(c.defaults.interval,.5);assert.equal(c.defaults.fearDuration,999999);
 execFileSync(process.execPath,['tools/arkpedia/fear-affliction-contract.mjs','--check'],{stdio:'pipe'});
 assert.equal(read('data/candidates/arkpedia-ch16-enemy-support.json').enemies.enemy_10128_fearpj.policy,null);
 assert.equal(read('data/arkpedia-stages.json').stages.some(s=>s.code==='16-9'),false);
});
test('unmarked recipients finish the parent without fear or disarm',()=>{
 const f=fixture({marked:false});assert.equal(f.manager.apply(f.source,f.target),null);
 assert.equal(!!f.target.s.flags.fear,false);assert.equal(!!f.target.s.flags.disarm,false);assertClean(f);
});
test('marked injured recipient retains derived fear/disarm until the first full-HP sampled trigger',()=>{
 const f=fixture(),p=apply(f);assert.equal(p.children.length,2);assert.equal(f.target.s.flags.fear,true);assert.equal(f.target.s.flags.disarm,true);
 f.h.run(.3);f.b.heal(f.source,f.target,1e6);assert.equal(f.target.hp,f.target.s.maxHp);f.h.run(.1);assert.equal(p.active,true);
 f.h.run(.11);assert.equal(p.active,false);assert.equal(!!f.target.s.flags.fear,false);assert.equal(!!f.target.s.flags.disarm,false);assertClean(f);
});
test('initial full HP still waits for the first half-second parent trigger',()=>{
 const f=fixture({full:true}),p=apply(f);f.h.run(.4);assert.equal(p.active,true);f.h.run(.11);assert.equal(p.active,false);assertClean(f);
});
test('the literal16-9 miner rejects Fear through its actual immunity while derived Disarm remains owned',()=>{
 const f=fixture({local:true}),p=apply(f);assert.ok(f.target.def.immune.has('feared'));
 assert.equal(!!f.target.s.flags.fear,false);assert.equal(f.target.s.flags.disarm,true);assert.equal(p.children.length,1);
 f.b.heal(f.source,f.target,1e6);f.h.run(.51);assert.equal(!!f.target.s.flags.disarm,false);assertClean(f);
});
test('finishing one parent preserves unrelated fear and disarm status owners',()=>{
 const f=fixture();f.b.applyStatus(f.target,'fear',{key:'other-fear',duration:30,source:f.source});
 const other=f.b.addBuff(f.target,{key:'other-disarm',persist:true,flags:{disarm:true}}),p=apply(f);
 f.manager.finish(p);assertClean(f);assert.ok(f.target.findBuff('other-fear'));assert.ok(f.target.buffs.includes(other));
 assert.equal(f.target.s.flags.fear,true);assert.equal(f.target.s.flags.disarm,true);
});
test('parent replacement retires only its old children and resets its own half-second trigger',()=>{
 const f=fixture(),old=apply(f);f.h.run(.3);const next=apply(f);
 assert.equal(old.active,false);assert.ok(old.children.length===0);assert.equal(next.active,true);
 assert.equal(f.target.buffs.filter(b=>b.key===parentKey).length,1);assert.equal(f.target.buffs.filter(b=>b.key.startsWith('ch16:fearpj:')).length,2);
 f.b.heal(f.source,f.target,1e6);f.h.run(.3);assert.equal(next.active,true);f.h.run(.21);assert.equal(next.active,false);assertClean(f);
});
test('removing the miner mark after activation does not invent a periodic marker check',()=>{
 const f=fixture(),p=apply(f);f.b.removeBuff(f.target,'enemy_mcreep_self_mark');f.h.run(1.1);
 assert.equal(p.active,true);assert.equal(f.target.s.flags.fear,true);f.manager.finish(p);assertClean(f);
});
for(const control of ['stun','silence','freeze','sleep','levitate'])test('parent full-HP check is not paused by recipient '+control,()=>{
 const f=fixture(),p=apply(f);f.b.addBuff(f.target,{key:'control',persist:true,flags:{[control]:true}});
 f.target.hp=f.target.s.maxHp;f.h.run(.51);assert.equal(p.active,false);assertClean(f);
});
for(const invalid of ['sourceDeath','sourceReuse','recipientDeath','recipientReuse','recipientRemoved','battleEnd','parentRemoved','parentReplaced'])
test('derived ownership handles '+invalid+' without donating children or removing replacements',()=>{
 const f=fixture(),p=apply(f),original=p.source;
 if(invalid==='sourceDeath')f.b.kill(f.source,null);
 else if(invalid==='sourceReuse'){f.source.deploySeq++;f.source.stats={...f.source.stats};}
 else if(invalid==='recipientDeath')f.b.kill(f.target,null);
 else if(invalid==='recipientReuse')f.target.deploySeq++;
 else if(invalid==='recipientRemoved'){f.target.deployed=false;f.b.emit('removed',{unit:f.target});}
 else if(invalid==='battleEnd')f.b.emit('battleEnd',{});
 else if(invalid==='parentRemoved')f.b.removeBuff(f.target,p.parent);
 else f.b.addBuff(f.target,{key:parentKey,persist:true});
 f.h.run(.6);
 if(invalid.startsWith('source')){
  assert.equal(p.active,true);assert.equal(p.source,original);assert.notEqual(p.source,f.source);assert.equal(f.target.s.flags.disarm,true);f.manager.finish(p);assertClean(f);
 }else{
  assert.equal(p.active,false);
  if(invalid==='parentReplaced'){assert.ok(f.target.findBuff(parentKey));assert.equal(f.target.buffs.some(b=>b.key.startsWith('ch16:fearpj:')),false);}
  else assertClean(f);
 }
 assert.deepEqual(f.b.errors,[]);
});
for(const reject of ['parent','fear','disarm'])test('rejected '+reject+' never creates orphan derived output',()=>{
 const f=fixture();f.b.on('beforeBuff',c=>{if(reject==='parent'?c.buff.key===parentKey:c.buff.key.startsWith(`ch16:fearpj:${reject}:`))c.cancel=true;});
 const p=f.manager.apply(f.source,f.target);
 if(reject==='parent'){assert.equal(p,null);assertClean(f);}else{assert.ok(p);assert.equal(p.children.length,1);f.manager.finish(p);assertClean(f);}
});
for(const at of ['beforeStatus','statusApplied','disarmBeforeBuff'])test('reentrant parent finish at '+at+' leaves no orphan child',()=>{
 const f=fixture();const stop=()=>f.b.removeBuff(f.target,parentKey);
 if(at==='disarmBeforeBuff')f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('ch16:fearpj:disarm:'))stop();});
 else f.b.on(at,c=>{if(c.target===f.target&&c.status==='fear')stop();});
 assert.equal(f.manager.apply(f.source,f.target),null);assertClean(f);
});
test('reentrant application while retiring old children preserves the newer parent without orphan statuses',()=>{
 const f=fixture(),old=apply(f);let newer;
 old.children[0].onRemove=()=>{newer=f.manager.apply(f.source,f.target);};
 assert.equal(f.manager.apply(f.source,f.target),null);
 assert.ok(newer?.active);assert.equal(f.target.buffs.filter(b=>b.key===parentKey).length,1);
 assert.equal(f.target.buffs.filter(b=>b.key.startsWith('ch16:fearpj:')).length,2);
 f.manager.finish(newer);assertClean(f);
});
test('recipient replacement during old-child cleanup refuses the pending new application',()=>{
 const f=fixture(),old=apply(f);old.children[0].onRemove=()=>{f.target.deploySeq++;};
 assert.equal(f.manager.apply(f.source,f.target),null);assertClean(f);
});
test('almost-full HP never finishes the literal full-HP recovery check',()=>{
 const f=fixture(),p=apply(f);f.target.hp=f.target.s.maxHp-.01;f.h.run(1.1);
 assert.equal(p.active,true);f.manager.finish(p);assertClean(f);
});
test('source replacement during old-child cleanup cannot donate replacement stats or credit',()=>{
 const f=fixture(),old=apply(f),stats=f.source.stats,atk=f.source.s.atk;
 old.children[0].onRemove=()=>{f.source.deploySeq++;f.source.stats={...stats};f.source.base.atk=99999;f.source.markDirty();};
 const next=apply(f);assert.equal(next.source.stats,stats);assert.equal(next.source.s.atk,atk);
 f.manager.finish(next);assertClean(f);
});
test('actual miner fear-loss and shadow suppression recover after the owned parent clears at full HP',()=>{
 const{h,b,e}=minerBattle(minerKeys[0],[{stats:{atk:0}}]);h.run(.31);
 const env=chapter16Shadow(b),tile=10*21+6,prior=env.shadowSuppressedUntil.get(tile);e.hp=2000;
 const p=fearProjectileAfflictions(b).apply(h.allies()[0],e);assert.ok(p);
 h.run(1.4);assert.equal(e.hp,1800);assert.equal(env.shadowSuppressedUntil.get(tile),prior);
 b.heal(h.allies()[0],e,1e6);h.run(.6);assert.equal(p.active,false);assert.equal(e.hp,e.s.maxHp);
 assert.ok(env.shadowSuppressedUntil.get(tile)>prior);assert.equal(!!e.s.flags.fear,false);assert.equal(!!e.s.flags.disarm,false);
 h.run(1.1);assert.equal(e.hp,e.s.maxHp);assert.deepEqual(b.errors,[]);
});
test('a hidden recipient keeps its parent clock and can recover at full HP without being selectable',()=>{
 const f=fixture(),p=apply(f);f.target.hidden=true;f.h.run(.6);assert.equal(p.active,true);
 f.target.hp=f.target.s.maxHp;f.h.run(.41);assert.equal(p.active,false);assertClean(f);
});
