// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {makeBattle} from './helpers/battleHarness.js';
import {startChapter17SnakeCounter as start,clickChapter17BossCounter as click,chapter17BossCounterSnapshot as snapshot} from '../server/sim/content/chapter17-boss-counter.js';
import {snakeCounterContract} from '../tools/arkpedia/snake-counter-contract.mjs';
const bytes=p=>readFileSync(new URL('../'+p,import.meta.url)),read=p=>JSON.parse(bytes(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const contract=read('data/candidates/arkpedia-ch17-snake-counter-contract.json'),key=contract.enemy;
function fixture(){const h=makeBattle({content:'none',autoFinish:false,timeLimit:1e6,defs:{enemies:{[key]:read('data/candidates/arkpedia-enemy-records.canonical.json').enemies[key].levels[0]}}});
 h.b.start();const owner=h.spawn(key,{pos:[10,6]});owner.base.moveSpeed=0;owner.profile.noAttack=true;owner.markDirty();
 const results=[],create=(kind='step',applyBuff=r=>results.push(r))=>start(h.b,owner,{kind,applyBuff});
 return{h,b:h.b,owner,results,create};}
const taps=(f,c,n)=>{for(let i=0;i<n;i++)assert.equal(click(f.b,c.input),true);};

test('snake counter contract reproduces the two retained actions, exact source hashes and closed enemy gate',async()=>{
 assert.deepEqual(await snakeCounterContract(),contract);
 for(const file of Object.values(contract.sources))assert.equal(sha(bytes(file.path)),file.sha256);
 const g=read(contract.sources.graph.path);
 for(const c of Object.values(contract.cases)){
  const event=JSON.parse(g.templates[c.template].originalJson).eventToActions._items.find(e=>e.key===c.event);
  assert.deepEqual(c.action,JSON.parse(event.value.SerializedState)[c.actionIndex]);
 }
 assert.equal(read('data/candidates/arkpedia-ch16-enemy-support.json').enemies[key].policy,null);
});
test('counter source derivation rejects an uncorroborated callback alias and unusable native button actions',async()=>{
 const reader=change=>async url=>{const raw=readFileSync(url),text=String(url);if(!text.endsWith(change.file))return raw;
  const value=JSON.parse(raw);change.update(value);return Buffer.from(JSON.stringify(value));};
 await assert.rejects(snakeCounterContract({read:reader({file:'arkpedia-buff-event-alias-source.json',update:v=>{v.events['2'].name='UNKNOWN';}})}),/alias not corroborated/);
 await assert.rejects(snakeCounterContract({read:reader({file:'arkpedia-ch17-firewall-boss-source.json',update:v=>{
  const t=v.templates.enemy_musnake_during_click,value=JSON.parse(t.originalJson),e=value.eventToActions._items.find(e=>e.key===2),nodes=JSON.parse(e.value.SerializedState);
  nodes[0]._requiredClickCount=0;e.value.SerializedState=JSON.stringify(nodes);t.originalJson=JSON.stringify(value);t.sha256=sha(t.originalJson);
 }})}),/Unsupported snake/);
});
test('ten successful step clicks dispatch only the native injury buff and retire before dispatch',()=>{
 const f=fixture(),seen=[];let c;c=f.create('step',r=>{seen.push(r);assert.equal(c.active,false);assert.deepEqual(snapshot(f.b),[]);});
 taps(f,c,9);assert.equal(c.clicks,9);assert.equal(c.active,true);assert.equal(seen.length,0);
 taps(f,c,1);assert.equal(seen.length,1);assert.equal(seen[0].buffKey,'enemy_musnake_stun_buff');assert.equal(seen[0].outcome,'success');
 assert.equal(seen[0].owner,f.owner);assert.equal(seen[0].ownerLife,f.owner.deploySeq);assert.equal(click(f.b,c.input),false);assert.deepEqual(f.b.errors,[]);
});
test('a partial step counter expires once on the real simulation clock and selects the native heal buff',()=>{
 const f=fixture(),c=f.create();taps(f,c,3);f.h.run(9.9);assert.equal(c.active,true);f.h.run(.2);
 assert.equal(c.active,false);assert.equal(f.results.length,1);assert.equal(f.results[0].buffKey,'enemy_musnake_heal_buff');assert.equal(f.results[0].outcome,'expired');
 f.h.run(1);assert.equal(f.results.length,1);assert.equal(click(f.b,c.input),false);assert.deepEqual(f.b.errors,[]);
});
for(const at of ['before','at','after'])test('step final click '+at+' deadline uses exact clock ordering',()=>{
 const f=fixture(),c=f.create();taps(f,c,9);f.b.time=c.deadline+(at==='before'?-1e-6:at==='after'?1e-6:0);
 assert.equal(click(f.b,c.input),at==='before');assert.equal(f.results.length,1);
 assert.equal(f.results[0].buffKey,at==='before'?'enemy_musnake_stun_buff':'enemy_musnake_heal_buff');
});
for(const success of [true,false])test('terminal counter requires fifteen clicks and selects finish buff on '+(success?'success':'expiry'),()=>{
 const f=fixture(),c=f.create('final');assert.equal(c.deadline-f.b.time,999999);assert.equal(c.required,15);
 taps(f,c,14);assert.equal(c.active,true);assert.equal(f.results.length,0);
 if(success)taps(f,c,1);else{f.b.time=c.deadline;assert.equal(click(f.b,c.input),false);}
 assert.equal(f.results.length,1);assert.equal(f.results[0].buffKey,'enemy_musnake_kill_self_buff');assert.equal(f.results[0].outcome,success?'success':'expired');
});
test('replacement cancels the prior button without its result and rejects stale progress packets',()=>{
 const f=fixture(),a=f.create();taps(f,a,9);const c=f.create('final');
 assert.equal(a.active,false);assert.equal(c.clicks,0);assert.notEqual(c.id,a.id);assert.equal(click(f.b,a.input),false);assert.equal(c.clicks,0);assert.equal(f.results.length,0);
 assert.deepEqual(snapshot(f.b),[{...c.input,kind:'final',clicks:0,required:15,remaining:999999}]);taps(f,c,15);assert.equal(f.results.length,1);
});
for(const retirement of ['death','removed','reuse','battleEnd','undeployed'])test('counter retires without applying a result on '+retirement,()=>{
 const f=fixture(),c=f.create();taps(f,c,9);
 if(retirement==='death')f.b.kill(f.owner,null);if(retirement==='removed')f.b.emit('removed',{unit:f.owner});
 if(retirement==='reuse')f.owner.deploySeq++;if(retirement==='battleEnd')f.b.forceEnd();if(retirement==='undeployed')f.owner.deployed=false;
 assert.equal(click(f.b,c.input),false);assert.equal(c.active,false);assert.deepEqual(snapshot(f.b),[]);assert.equal(f.results.length,0);
 assert.ok(!Object.values(f.b._hooks).flat().some(h=>h.owner===c));assert.deepEqual(f.b.errors,[]);
});
test('a new life on the same owner object cannot receive the prior deployment input',()=>{
 const f=fixture(),old=f.create();taps(f,old,8);f.owner.deploySeq++;const c=f.create();
 assert.equal(old.active,false);assert.notEqual(old.input.ownerLife,c.input.ownerLife);assert.equal(click(f.b,{...c.input,ownerLife:old.input.ownerLife}),false);assert.equal(c.clicks,0);
 taps(f,c,10);assert.equal(f.results.length,1);assert.equal(f.results[0].ownerLife,c.input.ownerLife);
});
test('invalid request identities do not consume valid counter progress or replace a counter',()=>{
 const f=fixture(),c=f.create();
 for(const input of [null,{}, {...c.input,ownerId:c.input.ownerId+1},{...c.input,ownerLife:c.input.ownerLife+1},{...c.input,counterId:c.id+1},{...c.input,counterId:String(c.id)}, {...c.input,ownerLife:NaN}])assert.equal(click(f.b,input),false);
 assert.equal(c.clicks,0);assert.equal(c.active,true);assert.equal(f.results.length,0);
 assert.throws(()=>f.create('firewall'),/Unreviewed/);assert.throws(()=>start(f.b,f.owner,{kind:'step'}),/dispatcher/);assert.equal(c.active,true);
});
test('unsupported record changes fail before altering an existing accepted counter',()=>{
 const f=fixture(),c=f.create(),original=f.owner.def;f.owner.def={...original,raw:structuredClone(original.raw)};f.owner.def.raw.talents.bb['StepKill.hp_ratio']=.1;
 assert.throws(()=>f.create(),/Unreviewed/);assert.equal(c.active,true);assert.equal(c.clicks,0);f.owner.def=original;taps(f,c,10);assert.equal(f.results.length,1);
});
test('one owner resolution can create a replacement counter without old cleanup deleting it',()=>{
 const f=fixture();let next;const c=f.create('step',r=>{f.results.push(r);next=f.create('final');});taps(f,c,10);
 assert.equal(c.active,false);assert.equal(next.active,true);assert.equal(snapshot(f.b)[0].counterId,next.id);taps(f,next,15);assert.equal(f.results.length,2);assert.deepEqual(snapshot(f.b),[]);
});
test('silence and action control do not pause the native button deadline or reject its clicks',()=>{
 const f=fixture(),c=f.create();f.b.addBuff(f.owner,{key:'fixture-control',persist:true,flags:{silence:true,stun:true}});taps(f,c,9);
 f.h.run(10.1);assert.equal(c.active,false);assert.equal(f.results[0].buffKey,'enemy_musnake_heal_buff');assert.deepEqual(f.b.errors,[]);
});
test('owner removal or replacement during button creation cannot leave orphan listeners',()=>{
 for(const remove of [true,false]){const f=fixture();let next;
  const handle=f.b.on('ch17BossCounterStarted',()=>{f.b.off(handle);if(remove)f.b.kill(f.owner,null);else next=f.create('final');});
  const c=f.create();assert.equal(c.active,false);assert.equal(f.results.length,0);assert.ok(!Object.values(f.b._hooks).flat().some(h=>h.owner===c));
  if(remove)assert.deepEqual(snapshot(f.b),[]);else{assert.equal(next.active,true);assert.equal(snapshot(f.b)[0].counterId,next.id);taps(f,next,15);}
  assert.deepEqual(f.b.errors,[]);
 }
});
test('independent owner buttons resolve and retire independently in one battle',()=>{
 const f=fixture(),a=f.create(),other=f.h.spawn(key,{pos:[10,9]});other.base.moveSpeed=0;other.profile.noAttack=true;other.markDirty();
 const results=[],c=start(f.b,other,{kind:'final',applyBuff:r=>results.push(r)});taps(f,a,4);taps(f,c,14);assert.equal(snapshot(f.b).length,2);
 f.b.kill(f.owner,null);assert.equal(c.active,true);assert.equal(snapshot(f.b).length,1);taps(f,c,1);assert.equal(results.length,1);assert.equal(f.results.length,0);assert.deepEqual(f.b.errors,[]);
});
test('result dispatcher may kill the source or throw without leaving replayable input/listeners',()=>{
 for(const throws of [true,false]){const f=fixture(),c=f.create('step',()=>{if(throws)throw Error('fixture dispatch');f.b.kill(f.owner,null);});taps(f,c,9);
  if(throws)assert.throws(()=>click(f.b,c.input),/fixture dispatch/);else taps(f,c,1);
  assert.equal(c.active,false);assert.equal(click(f.b,c.input),false);assert.deepEqual(snapshot(f.b),[]);assert.ok(!Object.values(f.b._hooks).flat().some(h=>h.owner===c));
 }
});
test('battle-local snapshots are plain copies and an absent battle state cannot accept input',()=>{
 const f=fixture(),g=fixture(),c=f.create(),d=g.create('final'),view=snapshot(f.b);view[0].clicks=999;
 assert.equal(c.clicks,0);assert.equal(d.clicks,0);assert.equal(click(g.b,{...d.input,counterId:d.id+1}),false);
 assert.equal(click({},c.input),false);assert.deepEqual(snapshot({}),[]);
});
