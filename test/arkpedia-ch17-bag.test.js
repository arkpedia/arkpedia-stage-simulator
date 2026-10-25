// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pollutionBag} from '../server/sim/content/chapter17-bag.js';
import {attach,installFeatureDispatch} from '../server/sim/content/enemies.js';
import {makeBattle,chessRec} from './helpers/battleHarness.js';
import {applySourceSlowDown,NATIVE_SLOW_DOWN_CONTRACT} from '../server/sim/content/arkpedia-slow-down.js';
import {installEnemyFeatures} from '../server/sim/content/arkpedia-enemy-features.js';
import {deriveEnemySupport,prefabPath} from '../shared/arkpedia/enemy-support.js';
const read=p=>JSON.parse(readFileSync(new URL('../data/'+p,import.meta.url)));
const review=read('candidates/arkpedia-ch17-reviewed-bag.json'),records=read('candidates/arkpedia-enemy-records.canonical.json').enemies;
const keys=Object.keys(review.enemies),murad='enemy_10211_murad',PARENT='enemy_mubag_kill_murad',FLAG=PARENT+'[flag]',FEED='enemy_mubag_atk_up',STACK=FEED+'[atk]';
function fixture(key=keys[0],automatic=false){
 const h=makeBattle({content:'generic',autoFinish:false,timeLimit:180,setup:automatic?installEnemyFeatures:installFeatureDispatch,
  defs:{enemies:{[key]:records[key].levels[0],[murad]:records[murad].levels[0]},chess:{dummy:chessRec({id:'dummy',stats:{maxHp:1e6,atk:0,def:0,res:0,blockCnt:0}})}},units:[{chessId:'dummy',row:10,col:7}]});
 h.b.start();const e=h.spawn(key,{pos:[10,7]}),a=automatic?e.mem.ab.list.find(a=>a.contacts):pollutionBag(records[key].levels[0]);if(!automatic)attach(h.b,e,[a]);e.base.moveSpeed=0;e.markDirty();
 const hits=[],consumed=[];h.b.on('damaged',c=>{if(c.dmg?.tags?.includes('bag-aura'))hits.push(c);});h.b.on('ch17BagConsumed',c=>consumed.push(c));
 return{h,b:h.b,e,a,u:h.unit('dummy'),hits,consumed};
}
function leak(f,pos=[10,7]){const t=f.h.spawn(murad,{pos});t.base.moveSpeed=0;t.profile.noAttack=true;t.mem.regularHidden=true;t.markDirty();f.b.addBuff(t,{key:'fixture-source',persist:true,flags:{untargetable:true,noMove:true}});return t;}
function begin(f){f.a.trace.refresh(true);assert.ok(f.h.runUntil(()=>!!f.a.phase,1));return f.a.phase;}
function age(f,p,time){f.h.run(Math.max(0,time-(f.b.time-p.startedAt)));}
const stacks=f=>f.e.findBuff(STACK)?.stacks??0;

test('Bag review remains bound to every retained original source and rejects altered exact records',()=>{
 for(const file of Object.values(review.sources))assert.equal(createHash('sha256').update(readFileSync(new URL('../'+file.path,import.meta.url))).digest('hex'),file.sha256);
 for(const key of keys){const r=structuredClone(records[key].levels[0]);r.skills[0].bb.atk+=.01;assert.throws(()=>pollutionBag(r),/Unreviewed/);}
});
for(const key of keys)test(key+' pulses Arts once per second independently of ordinary attacks and controls',()=>{
 const f=fixture(key);f.b.addBuff(f.e,{key:'fixture-controls',persist:true,flags:{stun:true,silence:true}});
 f.h.run(.9);assert.equal(f.hits.length,0);f.h.run(.2);assert.equal(f.hits.length,1);assert.equal(f.hits[0].amount,records[key].levels[0].stats.atk);assert.equal(f.e.stats.attacks,0);assert.deepEqual(f.b.errors,[]);
});
test('feeding grants ten permanent stacks, kills only at10.5 seconds and holds the skill until11',()=>{
 const f=fixture(),t=leak(f),p=begin(f);age(f,p,.9);assert.equal(stacks(f),0);age(f,p,1.1);assert.equal(stacks(f),1);
 age(f,p,10.4);assert.equal(stacks(f),10);assert.ok(t.alive);assert.equal(f.consumed.length,0);
 age(f,p,10.6);assert.equal(t.alive,false);assert.equal(f.consumed.length,1);assert.equal(f.a.phase,p);assert.ok(f.e.s.flags.noMove);
 age(f,p,11.1);assert.equal(f.a.phase,null);assert.equal(f.e.findBuff(FEED),null);assert.equal(stacks(f),10);assert.deepEqual(f.b.errors,[]);
});
test('feeding clock and earned permanent stacks are unaffected by slow_down',()=>{
 const f=fixture(),t=leak(f),p=begin(f);
 applySourceSlowDown(f.b,f.u,f.e,{key:'bag-clock',increment:.5,maxStrength:.5,maxStacks:1,duration:30,contract:NATIVE_SLOW_DOWN_CONTRACT});
 age(f,p,10.6);assert.equal(stacks(f),10);assert.equal(t.alive,false);age(f,p,11.1);assert.equal(f.a.phase,null);assert.deepEqual(f.b.errors,[]);
});
for(const status of ['stun','freeze','sleep','levitate'])test('brief '+status+' interrupts feeding without a late source kill or stack rollback',()=>{
 const f=fixture(),t=leak(f),p=begin(f);age(f,p,2.2);const before=stacks(f);
 const buff=f.b.addBuff(f.e,{key:'fixture-control',persist:true,flags:{[status]:true}});f.b.removeBuff(f.e,buff);f.h.run(.1);
 assert.equal(f.a.phase,null);assert.equal(f.e.findBuff(FEED),null);f.h.run(10);assert.ok(t.alive);assert.equal(stacks(f),before);assert.equal(f.consumed.length,0);assert.deepEqual(f.b.errors,[]);
});
test('disarm does not cancel a nonattack feeding ability',()=>{
 const f=fixture(),t=leak(f),p=begin(f);f.b.addBuff(f.e,{key:'fixture-disarm',persist:true,flags:{disarm:true}});age(f,p,10.6);assert.equal(t.alive,false);assert.equal(stacks(f),10);assert.deepEqual(f.b.errors,[]);
});
test('silence blocks a new skill but does not silence the accepted non-silenceable feeding parent',()=>{
 const f=fixture(),t=leak(f),sil=f.b.addBuff(f.e,{key:'fixture-silence',persist:true,flags:{silence:true}});f.h.run(1.2);assert.equal(f.a.phase,null);
 f.b.removeBuff(f.e,sil);const p=begin(f);f.b.addBuff(f.e,{key:'fixture-silence',persist:true,flags:{silence:true}});age(f,p,10.6);assert.equal(t.alive,false);assert.equal(stacks(f),10);assert.deepEqual(f.b.errors,[]);
});
test('source departure removes its derived flag and interrupts only on the next feeding pulse',()=>{
 const f=fixture(),t=leak(f),p=begin(f);age(f,p,2.2);t.x+=2;f.h.run(.1);assert.equal(t.findBuff(PARENT),null);assert.equal(f.e.findBuff(FLAG),null);assert.equal(f.a.phase,p);
 age(f,p,3.1);assert.equal(f.a.phase,null);assert.equal(stacks(f),2);f.h.run(8);assert.ok(t.alive);assert.equal(f.consumed.length,0);assert.deepEqual(f.b.errors,[]);
});
test('interrupt-without-reset preserves the remaining15-second cooldown from cast start',()=>{
 const f=fixture(),t=leak(f),p=begin(f);age(f,p,2.2);t.x+=2;age(f,p,3.1);assert.equal(f.a.phase,null);t.x-=2;
 age(f,p,14.9);assert.equal(f.a.phase,null);age(f,p,15.1);assert.ok(f.a.phase);assert.deepEqual(f.b.errors,[]);
});
test('overlapping sources replace one flag; retiring an older parent cannot delete its replacement',()=>{
 const f=fixture(),first=leak(f),second=leak(f);f.h.run(.1);
 assert.equal(f.e.findBuff(FLAG).source,second);const p=f.a.phase;first.x+=2;f.h.run(.1);assert.equal(f.e.findBuff(FLAG).source,second);
 age(f,p,10.6);assert.equal(first.alive,true);assert.equal(second.alive,false);assert.equal(f.consumed.length,1);assert.equal(f.consumed[0].target,second);assert.deepEqual(f.b.errors,[]);
});
test('separate Bags own separate contact parents and derived flags on the same source',()=>{
 const f=fixture(),t=leak(f),e=f.h.spawn(keys[0],{pos:[10,7]}),a=pollutionBag(records[keys[0]].levels[0]);e.base.moveSpeed=0;e.markDirty();attach(f.b,e,[a]);f.h.run(.1);
 assert.equal(t.buffs.filter(b=>b.key===PARENT).length,2);f.a.detach();assert.equal(t.buffs.filter(b=>b.key===PARENT).length,1);assert.ok(a.currentContact());assert.equal(e.findBuff(FLAG).source,t);assert.deepEqual(f.b.errors,[]);
});
for(const event of ['death','battleEnd','reuse'])test(event+' retires feeding, contact ownership, trace and future passive output',()=>{
 const f=fixture(),t=leak(f);begin(f);f.h.run(2);
 if(event==='death')f.b.kill(f.e,null);else if(event==='battleEnd')f.b.emit('battleEnd',{});else f.e.deploySeq++;
 f.h.run(.1);const hits=f.hits.length;f.h.run(11);
 assert.ok(t.alive);assert.equal(f.a.active,false);assert.equal(f.a.contacts.size,0);assert.equal(f.e.profile.nativeFlyingTrace,undefined);assert.equal(f.hits.length,hits);assert.equal(f.consumed.length,0);assert.deepEqual(f.b.errors,[]);
});
test('early feeding parent removal cannot manufacture natural completion',()=>{
 const f=fixture(),t=leak(f),p=begin(f);age(f,p,2.2);f.b.removeBuff(f.e,p.feed);age(f,p,11.1);
 assert.ok(t.alive);assert.equal(stacks(f),2);assert.equal(f.consumed.length,0);assert.deepEqual(f.b.errors,[]);
});
test('permanent ATK contributions accumulate across distinct feeding cycles and cap at40',()=>{
 const f=fixture();
 for(let i=0;i<5;i++){
  leak(f);assert.ok(f.h.runUntil(()=>!!f.a.phase,16));const p=f.a.phase;age(f,p,11.1);
  assert.equal(stacks(f),Math.min(40,(i+1)*10));
 }
 assert.ok(Math.abs(f.e.s.atk-150*3.8)<1e-8);assert.equal(f.consumed.length,5);assert.deepEqual(f.b.errors,[]);
});
test('aura reads current ATK after previous feeding pulses rather than a cached spawn value',()=>{
 const f=fixture();leak(f);const p=begin(f);age(f,p,2.2);
 assert.equal(f.hits[0].amount,150);assert.equal(f.hits[1].amount,160.5);assert.deepEqual(f.b.errors,[]);
});
for(const [flag,hit]of [['camou',true],['liftoff',true],['sleep',false],['untargetable',false],['hidden',false]])test('aura current '+flag+' selection is '+hit,()=>{
 const f=fixture();if(flag==='hidden')f.u.hidden=true;else f.b.addBuff(f.u,{key:'fixture-selection',persist:true,flags:{[flag]:true}});
 f.h.run(1.1);assert.equal(f.hits.length,hit?1:0);assert.deepEqual(f.b.errors,[]);
});
test('aura all-motion selection and canonical radius use current body positions',()=>{
 const f=fixture();f.u.motion='FLY';f.u.x=f.e.x+1.84;f.h.run(1.1);assert.equal(f.hits.length,1);
 f.u.x=f.e.x+1.86;f.h.run(1);assert.equal(f.hits.length,1);assert.deepEqual(f.b.errors,[]);
});
test('a rejected derived contact flag cannot start feeding or schedule source removal',()=>{
 const f=fixture(),t=leak(f);f.b.on('beforeBuff',c=>{if(c.buff.key===FLAG)c.cancel=true;});f.h.run(12);
 assert.equal(f.a.phase,null);assert.equal(f.consumed.length,0);assert.ok(t.alive);assert.equal(stacks(f),0);assert.deepEqual(f.b.errors,[]);
});
test('a source killed during derived flag admission cannot leave an orphan flag or start feeding',()=>{
 const f=fixture(),t=leak(f);f.b.on('beforeBuff',c=>{if(c.buff.key===FLAG)f.b.kill(t,null);});f.h.run(12);
 assert.equal(f.a.contacts.size,0);assert.equal(f.e.findBuff(FLAG),null);assert.equal(f.a.phase,null);assert.equal(f.consumed.length,0);assert.deepEqual(f.b.errors,[]);
});
test('owner death during contact parent admission removes even the just-returned parent',()=>{
 const f=fixture(),t=leak(f);f.b.on('beforeBuff',c=>{if(c.buff.key===PARENT)f.b.kill(f.e,null);});f.h.run(.2);
 assert.equal(f.a.active,false);assert.equal(t.findBuff(PARENT),null);assert.equal(f.e.findBuff(FLAG),null);assert.deepEqual(f.b.errors,[]);
});
test('battle end during feeding parent admission retires the just-returned buff and movement hold',()=>{
 const f=fixture(),t=leak(f);f.b.on('beforeBuff',c=>{if(c.buff.key===FEED)f.b.emit('battleEnd',{});});f.h.run(12);
 assert.ok(t.alive);assert.equal(f.a.active,false);assert.equal(f.e.findBuff(FEED),null);assert.equal(f.e.findBuff('ch17:bag-feeding'),null);assert.equal(f.e.findBuff(FLAG),null);assert.equal(f.consumed.length,0);assert.deepEqual(f.b.errors,[]);
});
test('a source reused outside contact cannot be killed through its old parent/flag',()=>{
 const f=fixture(),t=leak(f),p=begin(f);age(f,p,2.2);t.deploySeq++;t.x+=3;age(f,p,11.1);
 assert.ok(t.alive);assert.equal(f.consumed.length,0);assert.equal(f.a.contacts.size,0);assert.deepEqual(f.b.errors,[]);
});
test('Bag exact support rejects absent evidence, changed native/record claims and new active components',()=>{
 const native=read('candidates/arkpedia-ch17-bag-native.json'),index=read('arkpedia-enemy-clock-source.json');
 const evidence={...native,chapter16Families:{bag:{graphSha256:review.sources.graph.sha256}}},entries=Object.fromEntries(keys.map(k=>[k,records[k]]));
 for(const key of keys){
  assert.equal(read('candidates/arkpedia-ch16-enemy-support.json').enemies[key].policy,'stats-attacks-and-features');
  assert.equal(deriveEnemySupport(entries,index.prefabs,evidence)[key].policy,'stats-attacks-and-features');
  assert.equal(deriveEnemySupport(entries,index.prefabs,native)[key].policy,null);
  const changed=structuredClone(evidence);changed.prefabs[prefabPath(key)][0].originalJson+=' ';
  assert.equal(deriveEnemySupport(entries,index.prefabs,changed)[key].policy,null);
  const wrong=structuredClone(entries);wrong[key].levels[0].skills[0].bb.atk+=.01;assert.equal(deriveEnemySupport(wrong,index.prefabs,evidence)[key].policy,null);
  const added=structuredClone(index.prefabs);added[prefabPath(key)].clockComponents.push({fields:{_familyMask:1,_trigger:{}}});assert.equal(deriveEnemySupport(entries,added,evidence)[key].policy,null);
 }
});
for(const key of keys)test(key+' automatically owns one feeding controller with an independent nonattack aura',()=>{
 const f=fixture(key,true);assert.ok(f.a);assert.equal(f.e.mem.ab.list.filter(a=>a.contacts).length,1);
 f.u.x+=4;
 leak(f);const p=begin(f);age(f,p,10.6);assert.equal(stacks(f),10);assert.equal(f.consumed.length,1);assert.equal(f.e.stats.attacks,0);assert.deepEqual(f.b.errors,[]);
});
