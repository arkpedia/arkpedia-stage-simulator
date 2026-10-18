// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as fixture,enemy,near} from './helpers/botany-fixture.js';
import {isCurrentTargetModifierReceipt} from '../server/sim/damage.js';
const fixtures=[],make=opts=>{const f=fixture(opts);fixtures.push(f);return f;};
test.afterEach(()=>{for(const f of fixtures.splice(0))assert.deepEqual(f.b.errors,[]);});
const damage=(f,t,more={})=>f.b.dealDamage(f.u,t,{amount:100,type:'phys',...more});
test('The modifier receipt follows hit/miss resolution and precedes damage arithmetic and HP removal',()=>{
 const f=make(),t=enemy(f),order=[];
 for(const event of['outputDamage','hit','damageFinal','calculatedDamage','damaged'])f.b.on(event,()=>order.push(event));
 f.b.on('beforeTargetModifier',c=>{order.push('modifier');assert.equal(c.source.id,f.u.id);assert.equal(c.target.id,t.id);
  assert.equal(c.targetLife,t.deploySeq);assert.equal(c.outcome,'accepted');near(t.hp,t.s.maxHp);t.base.def=40;t.markDirty();});
 near(damage(f,t),60);assert.deepEqual(order,['outputDamage','hit','modifier','damageFinal','calculatedDamage','damaged']);
});
for(const reason of['dodge','accuracy'])test(`A ${reason} failure still exposes one missed modifier attempt without HP damage`,()=>{
 const f=make(),t=enemy(f),events=[];f.b.on('beforeTargetModifier',c=>events.push(c.outcome));
 if(reason==='dodge')f.b.addBuff(t,{key:'fixture:miss',mods:{dodgePhys:1}});
 else f.b.addBuff(f.u,{key:'fixture:miss',mods:{hitRatePhys:-1}});
 near(damage(f,t),0);near(t.hp,t.s.maxHp);assert.deepEqual(events,['missed']);
});
test('Full shields retain an accepted modifier receipt independently of zero HP removal',()=>{
 const f=make(),t=enemy(f),events=[];f.b.addBuff(t,{key:'fixture:shield',shield:1000});
 f.b.on('beforeTargetModifier',c=>events.push(c.outcome));near(damage(f,t),0);near(t.hp,t.s.maxHp);assert.deepEqual(events,['accepted']);
});
test('A protected packet stays terminal if its modifier observer removes the protection',()=>{
 const f=make(),t=enemy(f),events=[],buff=f.b.addBuff(t,{key:'fixture:invulnerable',flags:{invulnerable:true}});
 f.b.on('beforeTargetModifier',c=>{events.push(c.outcome);f.b.removeBuff(t,buff);});
 near(damage(f,t),0);near(damage(f,t),100);assert.deepEqual(events,['protected','accepted']);
});
test('Recipient-only hit cancellation exposes one cancelled attempt without reopening damage',()=>{
 const f=make(),t=enemy(f),events=[];f.b.on('hit',c=>{c.cancel=true;});
 f.b.on('beforeTargetModifier',c=>events.push(c.outcome));near(damage(f,t),0);assert.deepEqual(events,['cancelled']);
});
for(const boundary of['outputDamage','hit','dodge'])test(`Replacement inside ${boundary} cannot receive an old modifier receipt`,()=>{
 const f=make(),t=enemy(f),events=[];if(boundary==='dodge')f.b.addBuff(t,{key:'fixture:avoid',mods:{dodgePhys:1}});
 f.b.on(boundary,()=>{t.deploySeq++;});f.b.on('beforeTargetModifier',c=>events.push(c.outcome));
 near(damage(f,t),0);near(t.hp,t.s.maxHp);assert.deepEqual(events,[]);
});
test('Replacement in a modifier observer prevents the old HP packet from reaching the next life',()=>{
 const f=make(),t=enemy(f);f.b.on('beforeTargetModifier',()=>{t.deploySeq++;});near(damage(f,t),0);near(t.hp,t.s.maxHp);
});
test('Modifier identity, outcome and life are immutable and the receipt is active only during its real dispatch',()=>{
 const f=make(),t=enemy(f);let receipt;
 f.b.on('beforeTargetModifier',c=>{receipt=c;assert.equal(isCurrentTargetModifierReceipt(c),true);
  for(const [key,value]of[['targetLife',999],['source',null],['outcome','missed']])assert.equal(Reflect.set(c,key,value),false);});
 near(damage(f,t),100);assert.equal(isCurrentTargetModifierReceipt(receipt),false);assert.equal(isCurrentTargetModifierReceipt({...receipt}),false);
});
test('Sourceless HP packets retain credit but no talent source; elemental packets have no HP-modifier receipt',()=>{
 const f=make(),t=enemy(f),events=[];f.b.on('beforeTargetModifier',c=>events.push({source:c.source,credit:c.credit.id}));
 near(damage(f,t,{sourceless:true}),100);f.b.dealDamage(f.u,t,{amount:10,type:'element',element:'erosion'});
 assert.deepEqual(events,[{source:null,credit:f.u.id}]);
});
test('Owned non-valued statuses preserve exact token data and removal notification',()=>{
 const f=make(),t=enemy(f),token={finished:false},life=t.deploySeq;
 assert.equal(f.b.applyStatus(t,'silence',{key:'fixture:owned-silence',duration:4,source:f.u,
  buffData:{token},admit:()=>t.deploySeq===life&&!token.finished,onBuffRemove:()=>{token.finished=true;}}),true);
 const buff=t.findBuff('fixture:owned-silence');assert.equal(buff.data.token,token);assert.equal(t.s.flags.silence,true);
 f.b.removeBuff(t,buff);assert.equal(token.finished,true);assert.equal(!!t.s.flags.silence,false);
});
for(const boundary of['beforeStatus','beforeBuff'])test(`Owned status admission rejects target replacement inside ${boundary}`,()=>{
 const f=make(),t=enemy(f),life=t.deploySeq,applied=[];f.b.on(boundary,()=>{t.deploySeq++;});
 f.b.on('statusApplied',c=>applied.push(c.status));
 assert.equal(f.b.applyStatus(t,'silence',{duration:7,source:f.u,admit:()=>t.deploySeq===life}),false);
 assert.equal(!!t.s.flags.silence,false);assert.deepEqual(applied,[]);
});
test('A pre-finished owned status cannot be admitted after its beforeBuff callback',()=>{
 const f=make(),t=enemy(f),token={finished:false};f.b.on('beforeBuff',c=>{if(c.buff.status==='silence')c.buff.onRemove();});
 assert.equal(f.b.applyStatus(t,'silence',{duration:7,source:f.u,buffData:{token},admit:()=>!token.finished,
  onBuffRemove:()=>{token.finished=true;}}),false);assert.equal(!!t.s.flags.silence,false);
});
test('A guarded producer never refreshes a foreign status injected at the admission boundary',()=>{
 const f=make(),t=enemy(f),key='fixture:owned',token={};let injected=false,foreign;
 f.b.on('beforeBuff',c=>{if(c.buff.key===key&&!injected){injected=true;foreign=f.b.addBuff(t,{key,duration:1,source:{},flags:{silence:true}});}});
 const admit=()=>!t.findBuff(key)||t.findBuff(key).data.token===token;
 assert.equal(f.b.applyStatus(t,'silence',{key,duration:7,source:f.u,buffData:{token},admit}),false);
 assert.equal(t.findBuff(key),foreign);near(foreign.timeLeft,1);
});
test('The final admission predicate can refuse a transformed candidate before it enters the recipient',()=>{
 const f=make(),t=enemy(f),token={};f.b.on('beforeBuff',c=>{if(c.buff.status==='silence')c.buff.data={foreign:true};});
 assert.equal(f.b.applyStatus(t,'silence',{key:'fixture:bound',duration:7,source:f.u,buffData:{token},
  admit:(_target,buff)=>!buff||buff.data.token===token}),false);assert.equal(!!t.findBuff('fixture:bound'),false);
});
test('A target-only guard allows an accepted nonderived status to outlive source retirement',()=>{
 const f=make(),t=enemy(f),life=t.deploySeq;f.b.on('beforeStatus',()=>f.b.retreat(f.u));
 assert.equal(f.b.applyStatus(t,'silence',{duration:7,source:f.u,admit:()=>t.deploySeq===life}),true);
 assert.equal(t.s.flags.silence,true);assert.equal(f.u.deployed,false);
});
test('Guarded admission does not silently claim valued-status aggregation support',()=>{
 const f=make(),t=enemy(f);assert.throws(()=>f.b.applyStatus(t,'weaken',{duration:3,value:.2,admit:()=>true}),/non-valued status path/);
 assert.equal(!!t.findBuff('weaken'),false);
});
