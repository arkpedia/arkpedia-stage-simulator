// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import{make,addOwner,ally,advance,near}from'./helpers/taraxa-fixture.js';
import{verifyTaraxaAura,taraxaAirBlocking}from'../server/sim/content/arkpedia-taraxa-aura.js';
import{taraxaNativeInputs}from'../server/sim/content/arkpedia-taraxa-source.js';
const fly=f=>f.b.addBuff(f.u,{key:'fixture:owner-flight',flags:{liftoff:true}});
const refresh=f=>advance(f.b,f.b.dt);
const owned=(f,t)=>f.aura.records.get(t);
test('Original aura keeps derived child ownership, source-specific Sanctuary and shared block family',()=>{
 verifyTaraxaAura();for(const change of[n=>n.talent._removeBuffWhenAbilityDetached=0,
 n=>n.templates['taraxa_t[aura]'].eventToActions.ON_BUFF_TRIGGER[0]._succeedNodes[0]._failNodes[0]._isDerivedBuff=false,
 n=>n.templates['taraxa_t[aura]'].eventToActions.ON_OWNER_BLOCK_MODE_CHANGED[0]._force=false]){
  const n=structuredClone(taraxaNativeInputs());change(n);assert.throws(()=>verifyTaraxaAura(n),/Changed original/);
 }
});
test('Grounded allies keep an aura parent but receive no flying-only attributes',()=>{
 const f=make(),t=ally(f);refresh(f);assert.ok(owned(f,t)?.parent);near(t.s.blockCnt,0);near(t.s.physTakenMul,1);
 assert.equal(owned(f,t).shield,null);assert.equal(owned(f,t).block,null);
});
for(const [elite,potential,value]of[[0,1,.03],[0,5,.05],[1,1,.07],[1,5,.09],[2,1,.1],[2,5,.12]])
 test(`E${elite} P${potential} flying aura uses its selected source strength`,()=>{
 const f=make({elite,rank:[4,7,10][elite],potential}),t=ally(f,{flags:{liftoff:true}});refresh(f);
 near(t.s.physTakenMul,1-value);near(t.s.artsTakenMul,1-value);near(t.s.blockCnt,1);
 });
test('Air-blocking liftoff is distinct from actual FLY motion and the ally isFlying getter',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true}}),m=ally(f,{col:7,motion:'FLY'});refresh(f);
 assert.equal(t.isFlying,false);assert.equal(taraxaAirBlocking(t),true);assert.equal(taraxaAirBlocking(m),false);
 near(t.s.blockCnt,1);near(m.s.blockCnt,0);near(m.s.physTakenMul,1);
 const buff=f.b.addBuff(m,{key:'fixture:air-block',flags:{liftoff:true}});refresh(f);near(m.s.blockCnt,1);
 f.b.removeBuff(m,buff);refresh(f);near(m.s.blockCnt,0);
});
test('A flying owner receives its own talent without modifying base attributes',()=>{
 const f=make();fly(f);refresh(f);near(f.u.s.blockCnt,f.u.base.blockCnt+1);near(f.u.s.physTakenMul,.9);
 assert.equal(f.u.base.blockCnt,f.record.stats.blockCnt);f.b.removeBuff(f.u,'fixture:owner-flight');refresh(f);
 near(f.u.s.blockCnt,f.u.base.blockCnt);near(f.u.s.physTakenMul,1);
});
test('Landing removes both derived children while preserving the accepted aura parent',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true}});refresh(f);const p=owned(f,t),parent=p.parent;
 f.b.removeBuff(t,'fixture:flags');refresh(f);assert.equal(owned(f,t).parent,parent);near(t.s.blockCnt,0);near(t.s.physTakenMul,1);
 assert.equal(p.shield,null);assert.equal(p.block,null);
});
test('Range exit removes parent and children; reentry creates a fresh owned record',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true}});refresh(f);const old=owned(f,t);t.x=18;t.y=17;t.tileR=17;t.tileC=18;
 refresh(f);assert.equal(owned(f,t),undefined);near(t.s.blockCnt,0);near(t.s.physTakenMul,1);
 t.x=6;t.y=5;t.tileR=5;t.tileC=6;refresh(f);assert.ok(owned(f,t));assert.notEqual(owned(f,t),old);
});
test('Recipient replacement cannot inherit old parent/children or change the new life through removal',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true}});refresh(f);const old=owned(f,t);t.deploySeq++;refresh(f);
 assert.notEqual(owned(f,t),old);assert.equal(old.finished,true);assert.equal(t.buffs.includes(old.parent),false);near(t.s.blockCnt,1);
});
test('Sanctuary reduces Physical/Arts only and chooses the stronger existing source',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true}}),e=f.b.spawnEnemy('enemy_1007_slime',{pos:[5,8]});refresh(f);
 for(const[type,expected]of[['phys',90],['arts',90],['true',100],['elemental',100]]){
  const hp=t.hp;f.b.dealDamage(e,t,{amount:100,type,ignoreSelect:true});near(hp-t.hp,expected);
 }
 const foreign=f.b.addBuff(t,{key:'fixture:stronger-sanctuary',status:'sanctuary',mods:{physTakenMul:.7,artsTakenMul:.7}});
 near(t.s.physTakenMul,.7);f.aura.stop();near(t.s.physTakenMul,.7);assert.ok(t.buffs.includes(foreign));
});
test('No-heal status does not turn a nonhealing aura into a heal or suppress its block bonus',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true,noHeal:true,healFree:true}});refresh(f);near(t.s.blockCnt,1);near(t.s.physTakenMul,.9);
});
for(const kind of['hidden','untargetable','isolated','sleep','device'])test(`A ${kind} recipient cannot receive the friendly aura`,()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true,...(['untargetable','isolated','sleep'].includes(kind)?{[kind]:true}:{})},device:kind==='device'});
 if(kind==='hidden')t.hidden=true;refresh(f);assert.equal(owned(f,t),undefined);near(t.s.blockCnt,0);
});
test('Source silence and control do not disable an unsilenceable, unstunnable passive aura',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true}});f.b.addBuff(f.u,{key:'fixture:source-control',flags:{silence:true,stun:true}});refresh(f);
 near(t.s.blockCnt,1);near(t.s.physTakenMul,.9);
});
test('Rejected parent admission cannot grant children or leave a record',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true}});f.b.on('beforeBuff',c=>{if(c.unit===t&&c.buff.key.startsWith('taraxa_t[aura]'))c.cancel=true;});refresh(f);
 assert.equal(owned(f,t),undefined);near(t.s.blockCnt,0);near(t.s.physTakenMul,1);
});
test('Shield and block admission are independent original actions',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true}});f.b.on('beforeBuff',c=>{if(c.unit===t&&c.buff.status==='sanctuary')c.cancel=true;});refresh(f);
 near(t.s.physTakenMul,1);near(t.s.blockCnt,1);assert.equal(owned(f,t).shield,null);
});
test('A foreign block family is not adopted, stacked, refreshed or removed',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true}}),foreign=f.b.addBuff(t,{key:'taraxa_t[block]',mods:{blockCnt:3},source:{}});refresh(f);
 near(t.s.blockCnt,3);assert.equal(owned(f,t).block,null);f.aura.stop();assert.equal(t.findBuff('taraxa_t[block]'),foreign);near(t.s.blockCnt,3);
});
test('Two independent producers never stack the common block bonus and retain ordinary strongest Sanctuary',()=>{
 const f=make(),other=addOwner(f.b,{row:5,col:4,potential:6}),t=ally(f,{flags:{liftoff:true}});refresh(f);
 near(t.s.blockCnt,1);near(t.s.physTakenMul,.88);f.aura.stop();refresh(f);near(t.s.blockCnt,1);near(t.s.physTakenMul,.88);
 other.aura.stop();near(t.s.blockCnt,0);near(t.s.physTakenMul,1);
});
test('Source withdrawal removes all owned records and callbacks',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true}});refresh(f);f.b.retreat(f.u);
 assert.equal(f.aura.records.size,0);assert.equal(f.aura.handles.length,0);near(t.s.blockCnt,0);near(t.s.physTakenMul,1);
});
test('External parent removal cleans its children without adopting an unrelated replacement',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true}});refresh(f);const p=owned(f,t);f.b.removeBuff(t,p.parent);
 near(t.s.blockCnt,0);near(t.s.physTakenMul,1);assert.equal(owned(f,t),undefined);refresh(f);assert.notEqual(owned(f,t),p);
});
test('Reentrant aura scans during admission cannot recursively create parents',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true}});let calls=0;
 f.b.on('beforeBuff',c=>{if(c.unit===t&&c.buff.key.startsWith('taraxa_t[aura]')){calls++;f.aura.tick();}});refresh(f);
 assert.equal(calls,1);near(t.s.blockCnt,1);
});
test('Replacement during child admission removes late old-life output',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true}});let entered=false;
 f.b.on('beforeBuff',c=>{if(!entered&&c.unit===t&&c.buff.status==='sanctuary'){entered=true;t.deploySeq++;}});refresh(f);
 near(t.s.blockCnt,0);near(t.s.physTakenMul,1);assert.equal(owned(f,t),undefined);
});
test('Source withdrawal during parent admission cannot leave a late parent or children',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true}});let entered=false;
 f.b.on('beforeBuff',c=>{if(!entered&&c.unit===t&&c.buff.key.startsWith('taraxa_t[aura]')){entered=true;f.b.retreat(f.u);}});refresh(f);
 assert.equal(f.aura.records.size,0);assert.equal(f.aura.handles.length,0);assert.ok(!t.buffs.some(b=>b.key.startsWith('taraxa_t[aura]')));near(t.s.blockCnt,0);
});
test('Battle end drains derived resources and cannot mutate a new recipient life',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true}});refresh(f);f.b.finished=true;f.b.emit('battleEnd',{});
 assert.equal(f.aura.records.size,0);assert.equal(f.aura.handles.length,0);near(t.s.blockCnt,0);near(t.s.physTakenMul,1);
});

test('Hidden source suspends its derived aura and can resume on the same living deployment',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true}});refresh(f);f.u.hidden=true;refresh(f);
 near(t.s.blockCnt,0);near(t.s.physTakenMul,1);assert.equal(f.aura.stopped,false);
 f.u.hidden=false;refresh(f);near(t.s.blockCnt,1);near(t.s.physTakenMul,.9);
});
test('Source life replacement retires old children and all source handles',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true}});refresh(f);f.u.deploySeq++;refresh(f);
 near(t.s.blockCnt,0);near(t.s.physTakenMul,1);assert.equal(f.aura.records.size,0);assert.equal(f.aura.handles.length,0);
});
test('Landing during Sanctuary admission cannot attach a block child afterwards',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true}});let entered=false;
 f.b.on('beforeBuff',c=>{if(!entered&&c.unit===t&&c.buff.status==='sanctuary'){entered=true;f.b.removeBuff(t,'fixture:flags');}});refresh(f);
 near(t.s.blockCnt,0);near(t.s.physTakenMul,1);assert.equal(owned(f,t).block,null);assert.equal(owned(f,t).shield,null);
});
test('A parent finished inside admission cannot leave its late accepted instance behind',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true}});
 f.b.on('beforeBuff',c=>{if(c.unit===t&&c.buff.key.startsWith('taraxa_t[aura]'))c.buff.onRemove();});refresh(f);
 assert.equal(owned(f,t),undefined);assert.ok(!t.buffs.some(b=>b.key.startsWith('taraxa_t[aura]')));near(t.s.blockCnt,0);
});
test('Source retreat during a block admission cannot leave either late child',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true}});let entered=false;
 f.b.on('beforeBuff',c=>{if(!entered&&c.unit===t&&c.buff.key==='taraxa_t[block]'){entered=true;f.b.retreat(f.u);}});refresh(f);
 near(t.s.blockCnt,0);near(t.s.physTakenMul,1);assert.equal(f.aura.records.size,0);assert.equal(f.aura.handles.length,0);
});
test('A rejected block still retains an accepted Sanctuary child',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true}});f.b.on('beforeBuff',c=>{if(c.unit===t&&c.buff.key==='taraxa_t[block]')c.cancel=true;});refresh(f);
 near(t.s.blockCnt,0);near(t.s.physTakenMul,.9);assert.equal(owned(f,t).block,null);
});
