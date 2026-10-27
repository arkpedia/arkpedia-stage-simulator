// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {battle,keys} from './helpers/ch17Harness.js';
import {chapter16Shadow} from '../server/sim/content/chapter16-shadow.js';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const contract=read('data/candidates/arkpedia-ch16-miner-listener-contract.json');
const bloodKey=contract.blood.buffKey,listenerKey=contract.listener.buff.buffKey,shadowKey=contract.shadow.buff.buffKey;
function fixture(){const f=battle(keys[0]);f.state=f.e.mem.ch16MinerListeners;f.env=chapter16Shadow(f.b);f.tile=10*21+6;return f;}
function feared(f){f.e.hp=2000;assert.equal(f.b.applyStatus(f.e,'fear',{duration:30}),true);f.h.runUntil(()=>!!f.state.blood,1);return f.state.blood;}
test('literal listener recipe reproduces graph, aliases, independent first interval and terminal shadow finish',()=>{
 for(const pin of Object.values(contract.sources))assert.equal(createHash('sha256').update(readFileSync(new URL('../'+pin.path,import.meta.url))).digest('hex'),pin.sha256);
 assert.equal(contract.blood.firstTriggerInterval,1);assert.equal(contract.blood.triggerInterval,1);
 assert.equal(contract.mapping.shadowFinishesOnGuardian,true);assert.equal(contract.testOnly,true);assert.equal(contract.frameParity,false);
 execFileSync(process.execPath,['tools/arkpedia/miner-listener-contract.mjs','--check'],{stdio:'pipe'});
});
test('fear detection waits for its scan, then blood waits a separate full second',()=>{
 const f=fixture();f.e.hp=2000;f.b.applyStatus(f.e,'fear',{duration:30});
 f.h.run(.2);assert.equal(f.state.blood,null);assert.equal(f.e.hp,2000);
 f.h.runUntil(()=>!!f.state.blood,1);const p=f.state.blood;
 assert.ok(p.next-f.b.time>.9);f.h.run(.9);assert.equal(f.e.hp,2000);
 f.h.run(.15);assert.equal(f.e.hp,1800);assert.equal(f.state.blood,p);assert.deepEqual(f.b.errors,[]);
});
test('repeated listener scans retain the same blood child and never postpone its clock',()=>{
 const f=fixture(),p=feared(f),due=p.next;f.h.run(.6);
 assert.equal(f.state.blood,p);assert.equal(p.next,due);f.h.run(.5);assert.equal(f.e.hp,1800);
 f.h.run(1);assert.equal(f.e.hp,1600);assert.deepEqual(f.b.errors,[]);
});
test('full HP skips a blood pulse without deleting or restarting the independent child',()=>{
 const f=fixture(),p=feared(f);f.e.hp=f.e.s.maxHp;f.h.run(1.1);
 assert.equal(f.state.blood,p);assert.equal(f.e.hp,f.e.s.maxHp);const next=p.next;
 f.e.hp=2000;f.h.runUntil(()=>f.b.time>next+.05,2);assert.equal(f.e.hp,1800);assert.equal(f.state.blood,p);
});
test('Fear removal is sampled by the listener and removes the blood child at the next scan',()=>{
 const f=fixture(),p=feared(f);f.b.removeBuff(f.e,'fear');
 assert.equal(f.state.blood,p);f.h.run(.35);assert.equal(f.state.blood,null);assert.equal(f.e.findBuff(bloodKey),null);
 f.h.run(1.2);assert.equal(f.e.hp,2000);assert.deepEqual(f.b.errors,[]);
});
test('finishing the listener does not erase its explicitly non-derived blood child',()=>{
 const f=fixture(),p=feared(f);f.b.removeBuff(f.e,f.state.listener);f.b.removeBuff(f.e,'fear');
 f.h.run(1.1);assert.equal(f.state.blood,p);assert.equal(f.e.hp,1800);
 f.h.run(1);assert.equal(f.e.hp,1600);assert.deepEqual(f.b.errors,[]);
});
test('an externally replaced blood child is not adopted or ticked by the old receipt',()=>{
 const f=fixture(),old=feared(f),external=f.b.addBuff(f.e,{key:bloodKey,persist:true});
 assert.notEqual(external,old.buff);f.h.run(1.2);assert.equal(f.state.blood,null);
 assert.equal(f.e.findBuff(bloodKey),external);assert.equal(f.e.hp,2000);
});
test('root replacement stops the old listener while preserving its independent blood child',()=>{
 const f=fixture(),p=feared(f),replacement=f.b.addBuff(f.e,{key:listenerKey,persist:true});
 f.b.removeBuff(f.e,'fear');f.h.run(1.1);assert.equal(f.e.findBuff(listenerKey),replacement);
 assert.equal(f.state.blood,p);assert.equal(f.e.hp,1800);
});
test('a rejected blood application retries on a later scan without phantom damage',()=>{
 const f=fixture();let reject=true;f.b.on('beforeBuff',c=>{if(reject&&c.unit===f.e&&c.buff.key===bloodKey)c.cancel=true;});
 f.e.hp=2000;f.b.applyStatus(f.e,'fear',{duration:30});f.h.run(1.2);
 assert.equal(f.state.blood,null);assert.equal(f.e.hp,2000);reject=false;
 f.h.runUntil(()=>!!f.state.blood,1);f.h.run(.9);assert.equal(f.e.hp,2000);f.h.run(.15);assert.equal(f.e.hp,1800);
});
for(const control of ['stun','freeze','sleep','levitate','silence'])test(control+' does not pause the native nonsuppressible blood clock',()=>{
 const f=fixture(),p=feared(f),due=p.next,buff=f.b.addBuff(f.e,{key:'control',persist:true,flags:{[control]:true}});
 f.h.run(1.1);assert.equal(p.next,due+1);
 // The shared damage pipeline refuses sleeping recipients; the source clock
 // still advances instead of postponing or replaying that attempted pulse.
 assert.equal(f.e.hp,control==='sleep'?2000:1800);f.b.removeBuff(f.e,buff);
 const hp=f.e.hp;f.h.run(1);assert.equal(f.e.hp,hp-200);assert.deepEqual(f.b.errors,[]);
});
test('hidden miners retain their listener and blood world clocks',()=>{
 const f=fixture(),p=feared(f),due=p.next;f.e.hidden=true;f.h.run(1.1);
 assert.equal(p.next,due+1);assert.equal(f.e.hp,2000,'shared damage admission excludes hidden recipients');
 f.e.hidden=false;f.h.run(1);assert.equal(f.e.hp,1800);assert.deepEqual(f.b.errors,[]);
});
for(const invalid of ['death','reuse','removed','battleEnd'])test(invalid+' retires owned roots and blood without affecting replacement buffs',()=>{
 const f=fixture(),p=feared(f),roots=[f.state.listener,f.state.shadow,p.buff];
 if(invalid==='death')f.b.kill(f.e,null);else if(invalid==='reuse')f.e.deploySeq++;
 else if(invalid==='removed'){f.e.deployed=false;f.b.emit('removed',{unit:f.e});}else f.b.emit('battleEnd',{});
 const hp=f.e.hp;f.h.run(.1);assert.equal(f.state.active,false);assert.ok(roots.every(root=>!f.e.buffs.includes(root)));
 const replacement=f.b.addBuff(f.e,{key:bloodKey,persist:true});f.h.run(1.1);
 assert.equal(f.e.hp,hp);assert.equal(f.e.findBuff(bloodKey),replacement);assert.deepEqual(f.b.errors,[]);
});
for(const invalid of ['death','reuse','battleEnd'])test('reentrant '+invalid+' during blood admission leaves no child',()=>{
 const f=fixture();f.e.hp=2000;f.b.applyStatus(f.e,'fear',{duration:30});
 f.b.on('beforeBuff',c=>{if(c.unit!==f.e||c.buff.key!==bloodKey)return;
  if(invalid==='death')f.b.kill(f.e,null);else if(invalid==='reuse')f.e.deploySeq++;else f.b.emit('battleEnd',{});
 });
 f.h.run(.4);assert.equal(f.e.findBuff(bloodKey),null);f.h.run(.1);assert.equal(f.state.active,false);assert.deepEqual(f.b.errors,[]);
});
test('Guardian finishes shadow work permanently; existing suppression expires on its own clock',()=>{
 const f=fixture();f.h.run(.4);const expiry=f.env.shadowSuppressedUntil.get(f.tile);assert.ok(expiry>f.b.time);
 const mark=f.b.addBuff(f.e,{key:'gyegrd_a[exist]',persist:true});f.h.run(.35);
 assert.equal(f.state.shadow,null);assert.equal(f.e.findBuff(shadowKey),null);assert.equal(f.env.shadowSuppressedUntil.get(f.tile),expiry);
 f.b.removeBuff(f.e,mark);f.h.run(.7);assert.equal(f.env.shadowSuppressedUntil.get(f.tile),expiry);
 f.h.run(3);assert.equal(f.env.shadowSuppressedUntil.has(f.tile),false);assert.equal(f.state.shadow,null);assert.deepEqual(f.b.errors,[]);
});
test('Guardian is checked before Fear, while an unsampled short marker does not finish the root',()=>{
 const f=fixture();f.b.applyStatus(f.e,'fear',{duration:30});const mark=f.b.addBuff(f.e,{key:'gyegrd_a[exist]',persist:true});
 f.h.run(.4);assert.equal(f.state.shadow,null);f.b.removeBuff(f.e,mark);
 const g=fixture(),short=g.b.addBuff(g.e,{key:'gyegrd_a[exist]',persist:true});g.h.run(.1);g.b.removeBuff(g.e,short);
 g.h.run(.3);assert.ok(g.state.shadow);assert.ok(g.env.shadowSuppressedUntil.get(g.tile)>g.b.time);
});
test('external shadow-root removal or replacement never revives the old controller',()=>{
 for(const replace of [false,true]){
  const f=fixture();let external;
  if(replace)external=f.b.addBuff(f.e,{key:shadowKey,persist:true});else f.b.removeBuff(f.e,f.state.shadow);
  f.h.run(.7);assert.equal(f.env.shadowSuppressedUntil.size,0);
  assert.equal(f.e.findBuff(shadowKey),external??null);assert.deepEqual(f.b.errors,[]);
 }
});
test('fatal blood damage retires the listener receipts without an extra pulse',()=>{
 const f=fixture();feared(f);f.e.hp=100;f.h.run(1.1);
 assert.equal(f.e.alive,false);assert.equal(f.state.active,false);assert.equal(f.e.findBuff(bloodKey),null);assert.deepEqual(f.b.errors,[]);
});
test('almost-full HP still receives the literal non-full blood pulse',()=>{
 const f=fixture();feared(f);f.e.hp=f.e.s.maxHp-.001;const hp=f.e.hp;
 f.h.run(1.1);assert.equal(hp-f.e.hp,200);assert.deepEqual(f.b.errors,[]);
});
test('an unrelated raw fear flag does not satisfy the native named-buff condition',()=>{
 const f=fixture();f.e.hp=2000;f.b.addBuff(f.e,{key:'unrelated-flag',persist:true,flags:{fear:true}});
 f.h.run(1.4);assert.equal(f.state.blood,null);assert.equal(f.e.hp,2000);
 assert.ok(f.env.shadowSuppressedUntil.get(f.tile)>f.b.time);assert.deepEqual(f.b.errors,[]);
});
test('the literal fear buff key triggers the listener independently of its abnormal flags',()=>{
 const f=fixture();f.e.hp=2000;f.b.addBuff(f.e,{key:'fear',persist:true});
 assert.equal(!!f.e.s.flags.fear,false);f.h.run(1.4);assert.ok(f.state.blood);assert.equal(f.e.hp,1800);
 assert.equal(f.env.shadowSuppressedUntil.size,0);assert.deepEqual(f.b.errors,[]);
});
for(const invalid of ['reuse','death','battleEnd'])test('reentrant '+invalid+' during a blood damage callback prevents later output',()=>{
 const f=fixture();feared(f);let calls=0;
 f.b.on('damageFinal',c=>{
  if(c.source!==f.e||!c.dmg.tags?.includes('miner-fear-blood'))return;calls++;
  if(invalid==='reuse')f.e.deploySeq++;else if(invalid==='death')f.b.kill(f.e,null);else f.b.emit('battleEnd',{});
 });
 f.h.run(1.1);const hp=f.e.hp;f.h.run(1.2);
 assert.equal(calls,1);assert.equal(f.e.hp,hp);assert.equal(f.state.active,false);
 assert.equal(f.e.findBuff(bloodKey),null);assert.deepEqual(f.b.errors,[]);
});
test('a reentrant newer blood admission supersedes the older pending receipt',()=>{
 const f=fixture();f.e.hp=2000;f.b.applyStatus(f.e,'fear',{duration:30});let newer,once=false;
 f.b.on('beforeBuff',c=>{if(c.unit===f.e&&c.buff.key===bloodKey&&!once){once=true;f.state.createBlood();newer=f.state.blood;}});
 f.h.run(.4);assert.ok(newer);assert.equal(f.state.blood,newer);assert.equal(f.e.findBuff(bloodKey),newer.buff);
 assert.equal(f.e.buffs.filter(b=>b.key===bloodKey).length,1);f.h.run(1);assert.equal(f.e.hp,1800);assert.deepEqual(f.b.errors,[]);
});
test('retiring an old listener life preserves independently replaced root buff objects',()=>{
 const f=fixture();feared(f);
 const roots=[listenerKey,shadowKey,bloodKey].map(key=>f.b.addBuff(f.e,{key,persist:true}));
 f.e.deploySeq++;f.h.run(.1);assert.equal(f.state.active,false);
 assert.ok(roots.every(root=>f.e.findBuff(root.key)===root));assert.deepEqual(f.b.errors,[]);
});
