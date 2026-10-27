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
import { battle as minerBattle, keys as minerKeys } from './helpers/ch17Harness.js';
import { chapter16Shadow } from '../server/sim/content/chapter16-shadow.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const parentKey='feawpj_a[mcreep_fear]';
function fixture({marked=true,full=false,local=false}={}){
 const ref=read('data/candidates/arkpedia-stage-16-9-source.json').rawLevel.enemyDbRefs.find(r=>r.useDb===false);
 const targetRec=local?compileStageLocalEnemy(ref,{damageType:'NO_DAMAGE'}):enemyRec({key:'recipient',maxHp:1000,atk:0,moveSpeed:0});
 const h=makeBattle({content:'generic',autoFinish:false,defs:{enemies:{source:enemyRec({key:'source',atk:0,moveSpeed:0}),[targetRec.key]:targetRec}}});
 h.b.start();const source=h.spawn('source',{pos:[10,6]}),target=h.spawn(targetRec.key,{pos:[10,7]});
 for(const u of [source,target]){u.profile.noAttack=true;u.base.moveSpeed=0;u.markDirty();}
 if(marked)h.b.addBuff(target,{key:'enemy_mcreep_self_mark',persist:true});
 target.hp=full?target.s.maxHp:target.s.maxHp/2;
 return{h,b:h.b,source,target,manager:fearProjectileAfflictions(h.b)};
}
function apply(f){const p=f.manager.apply(f.source,f.target);assert.ok(p);return p;}
function assertClean(f){assert.equal(f.target.findBuff(parentKey),null);assert.equal(f.target.buffs.some(b=>b.key.startsWith('ch16:fearpj:')),false);assert.deepEqual(f.b.errors,[]);}
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
