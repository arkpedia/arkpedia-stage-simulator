// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as fixture,addOwner,enemy,near,advance} from './helpers/skybox-fixture.js';
import {SKYBOX_TALENT_CONTRACT,verifySkyboxTalentSource} from '../server/sim/content/arkpedia-skybox-talent.js';
import {skyboxNativeInputs} from '../server/sim/content/arkpedia-skybox-source.js';
const damage=(f,t,more={})=>f.b.dealDamage(f.u,t,{amount:100,type:'phys',...more});
const silence=t=>t.buffs.find(b=>b.data.skyboxSilence);
const fixtures=[],make=opts=>{const f=fixture(opts);fixtures.push(f);return f;};
test.afterEach(()=>{for(const f of fixtures.splice(0))assert.deepEqual(f.b.errors,[]);});
test('The exact source contract preserves parent, first-mark ownership, AlwaysNext and separate missability',()=>{
 assert.throws(()=>make({contract:{...SKYBOX_TALENT_CONTRACT}}),/exact talent contract/);verifySkyboxTalentSource();
 for(const mutate of[n=>n.talent._buffs[0].isSilenceable=1,n=>n.buffDatabase.silence.isDamageMissable=false,
  n=>n.templates.skybx_t_1.eventToActions.ON_BEFORE_TARGET_APPLY_MODIFIER[5]._isDerivedBuff=false,
  n=>n.templates.skybx_t_1.eventToActions.ON_BEFORE_TARGET_APPLY_MODIFIER[1]._checkBuffSource=false]){
  const n=structuredClone(skyboxNativeInputs());mutate(n);assert.throws(()=>verifySkyboxTalentSource(n),/Changed original/);
 }
});
test('E0 cannot invent the locked Silence talent',()=>{
 const f=make({elite:0}),t=enemy(f);damage(f,t);assert.equal(!!f.talent.parent,false);assert.equal(f.talent.records.size,0);assert.equal(!!t.s.flags.silence,false);
});
for(const elite of[1,2])for(const potential of[1,6])test(`E${elite}/P${potential} uses the selected ${elite===1?4:7}-second nonderived Silence`,()=>{
 const f=make({elite,potential}),t=enemy(f);damage(f,t);near(silence(t).timeLeft,elite===1?4:7);assert.equal(f.talent.records.size,1);
 advance(f.b,(elite===1?4:7)+.1);assert.equal(!!t.s.flags.silence,false);assert.equal(f.talent.records.size,1);
 assert.equal(f.talent.silences.size,0);assert.equal(f.talent.watchers.length,0);
});
test('Silence lands before HP arithmetic and a second packet never refreshes a spent recipient',()=>{
 const f=make(),t=enemy(f),order=[];f.b.on('statusApplied',c=>{if(c.target===t){order.push('silence');near(t.hp,t.s.maxHp);}});
 f.b.on('calculatedDamage',()=>{assert.equal(t.s.flags.silence,true);order.push('damage');});
 damage(f,t);assert.deepEqual(order,['silence','damage']);advance(f.b,1);damage(f,t);near(silence(t).timeLeft,6);assert.equal(f.talent.records.size,1);
});
for(const motion of['WALK','FLY'])test(`The native modifier target check admits ${motion} recipients beyond current range`,()=>{
 const f=make(),t=enemy(f,{motion,col:15});damage(f,t);assert.equal(t.s.flags.silence,true);assert.equal(f.talent.records.size,1);
});
for(const status of['silence','stun','freeze','disarm'])test(`Source ${status} does not disable this unsilenceable passive`,()=>{
 const f=make(),t=enemy(f);f.b.applyStatus(f.u,status,{duration:10});damage(f,t);assert.equal(t.s.flags.silence,true);
});
test('Source hiding suspends new events while preserving existing first-target memory',()=>{
 const f=make(),a=enemy(f),b=enemy(f);damage(f,a);f.u.hidden=true;
 damage(f,b);assert.equal(!!b.s.flags.silence,false);assert.equal(f.talent.records.size,1);advance(f.b,1);
 f.u.hidden=false;damage(f,a);near(silence(a).timeLeft,6);damage(f,b);assert.equal(b.s.flags.silence,true);assert.equal(f.talent.records.size,2);
});
for(const kind of['dodge','accuracy'])test(`A ${kind} miss skips missable Silence but spends the non-missable mark`,()=>{
 const f=make(),t=enemy(f),unit=kind==='dodge'?t:f.u;
 const buff=f.b.addBuff(unit,{key:'fixture:miss',mods:kind==='dodge'?{dodgePhys:1}:{hitRatePhys:-1}});
 near(damage(f,t),0);assert.equal(!!t.s.flags.silence,false);assert.equal(f.talent.records.size,1);assert.equal(f.talent.silences.size,0);
 f.b.removeBuff(unit,buff);near(damage(f,t),100);assert.equal(!!t.s.flags.silence,false);assert.equal(f.talent.records.size,1);
});
for(const kind of['shield','zero-multiplier'])test(`${kind} zero HP removal does not turn an accepted modifier into a miss`,()=>{
 const f=make(),t=enemy(f);f.b.addBuff(t,{key:'fixture:zero',...(kind==='shield'?{shield:1e7}:{mods:{physTakenMul:0}})});
 near(damage(f,t),0);assert.equal(t.s.flags.silence,true);assert.equal(f.talent.records.size,1);
});
for(const kind of['protection','cancellation'])test(`Terminal ${kind} does not enter the locally admitted talent event`,()=>{
 const f=make(),t=enemy(f),block=kind==='protection'?f.b.addBuff(t,{key:'fixture:invulnerable',flags:{invulnerable:true}})
  :f.b.on('hit',c=>{c.cancel=true;});
 near(damage(f,t),0);assert.equal(f.talent.records.size,0);assert.equal(!!t.s.flags.silence,false);
 if(kind==='protection')f.b.removeBuff(t,block);else f.b.off(block);damage(f,t);assert.equal(t.s.flags.silence,true);
});
test('Silence immunity still follows AlwaysNext into the first-target mark',()=>{
 const f=make(),t=enemy(f);t.def.immune.add('silence');damage(f,t);assert.equal(!!t.s.flags.silence,false);assert.equal(f.talent.records.size,1);
 t.def.immune.delete('silence');damage(f,t);assert.equal(!!t.s.flags.silence,false);
});
for(const boundary of['beforeStatus','beforeBuff'])test(`Refused Silence at ${boundary} does not suppress the independent mark`,()=>{
 const f=make(),t=enemy(f);f.b.on(boundary,c=>{if(c.status==='silence'||c.buff?.status==='silence')c.cancel=true;});
 damage(f,t);assert.equal(!!t.s.flags.silence,false);assert.equal(f.talent.records.size,1);assert.equal(f.talent.silences.size,0);
});
test('Refused marks do not become a permanent JS seen-set or remove accepted Silence',()=>{
 const f=make(),t=enemy(f),hook=f.b.on('beforeBuff',c=>{if(c.buff.data.skyboxMark)c.cancel=true;});
 damage(f,t);assert.equal(t.s.flags.silence,true);assert.equal(f.talent.records.size,0);advance(f.b,1);f.b.off(hook);
 damage(f,t);near(silence(t).timeLeft,7);assert.equal(f.talent.records.size,1);assert.equal(f.talent.silences.size,1);
});
test('Dispelled marks permit another event; dispelling Silence alone does not clear its first-target memory',()=>{
 const f=make(),t=enemy(f);damage(f,t);advance(f.b,1);f.b.removeBuff(t,f.talent.records.get(t).buff);damage(f,t);near(silence(t).timeLeft,7);
 f.b.removeBuff(t,silence(t));damage(f,t);advance(f.b,.1);assert.equal(!!t.s.flags.silence,false);assert.equal(f.talent.records.size,1);
 assert.equal(f.talent.silences.size,0);assert.equal(f.talent.watchers.length,0);
});
test('A same-source native foreign mark suppresses the event without being adopted or removed',()=>{
 const f=make(),t=enemy(f),foreign=f.b.addBuff(t,{key:'skybx_t_1[mark]',source:f.u});damage(f,t);
 assert.equal(!!t.s.flags.silence,false);assert.equal(f.talent.records.size,0);f.talent.stop();assert.ok(t.buffs.includes(foreign));
});
test('Another source native mark does not suppress this owner first-target event',()=>{
 const f=make(),t=enemy(f),foreign=f.b.addBuff(t,{key:'skybx_t_1[mark]',source:{}});damage(f,t);
 assert.equal(t.s.flags.silence,true);assert.equal(f.talent.records.size,1);f.talent.stop();assert.ok(t.buffs.includes(foreign));
});
test('Two owners retain independent marks and nonderived Silence lifetimes',()=>{
 const f=make(),g=addOwner(f.b,{elite:1,row:4}),t=enemy(f);damage(f,t);damage(g,t);assert.equal(f.talent.records.size,1);assert.equal(g.talent.records.size,1);
 f.talent.stop();assert.equal(g.talent.records.size,1);advance(f.b,4.1);assert.equal(t.s.flags.silence,true);assert.equal(g.talent.silences.size,0);
 advance(f.b,3);assert.equal(!!t.s.flags.silence,false);assert.equal(f.talent.watchers.length,0);
});
for(const action of['retreat','death','replacement','parent-dispel','battle-end'])test(`Source ${action} clears derived marks; independent Silence has its own lifetime`,()=>{
 const f=make(),t=enemy(f);damage(f,t);
 if(action==='retreat')f.b.retreat(f.u);else if(action==='death')f.b.kill(f.u,null);
 else if(action==='replacement'){f.u.deploySeq++;advance(f.b,.1);}else if(action==='parent-dispel')f.b.removeBuff(f.u,f.talent.parent.buff);
 else{f.b.finished=true;f.b.emit('battleEnd',{});}
 assert.equal(f.talent.handles.length,0);assert.equal(f.talent.records.size,0);assert.equal(!!f.talent.parent,false);
 if(action!=='battle-end'){assert.equal(t.s.flags.silence,true);advance(f.b,7.1);}
 assert.equal(!!t.s.flags.silence,false);assert.equal(f.talent.silences.size,0);assert.equal(f.talent.watchers.length,0);
});
for(const boundary of['beforeStatus','beforeBuff','statusApplied'])test(`Replacement inside ${boundary} cannot receive an old-life status or mark`,()=>{
 const f=make(),t=enemy(f);f.b.on(boundary,c=>{if(c.status==='silence'||c.buff?.status==='silence')t.deploySeq++;});
 near(damage(f,t),0);near(t.hp,t.s.maxHp);assert.equal(!!t.s.flags.silence,false);assert.equal(f.talent.records.size,0);
 assert.equal(f.talent.silences.size,0);assert.equal(f.talent.watchers.length,0);
});
test('Recipient replacement or death drains owned marks and independent status watches',()=>{
 for(const action of['replacement','death']){const f=make(),t=enemy(f);damage(f,t);
  if(action==='replacement'){t.deploySeq++;advance(f.b,.1);}else f.b.kill(t,null);
  assert.equal(f.talent.records.size,0);assert.equal(f.talent.silences.size,0);assert.equal(f.talent.watchers.length,0);assert.equal(!!t.s.flags.silence,false);
 }
});
test('Source retirement during Silence admission preserves that nonderived delivery and prevents a late derived mark',()=>{
 const f=make(),t=enemy(f);f.b.on('beforeStatus',()=>f.b.retreat(f.u));damage(f,t);
 assert.equal(t.s.flags.silence,true);assert.equal(f.talent.records.size,0);assert.equal(f.talent.handles.length,0);
 advance(f.b,7.1);assert.equal(f.talent.silences.size,0);assert.equal(f.talent.watchers.length,0);
});
test('Parent removal while a mark is being admitted cannot leave an old-parent resource',()=>{
 const f=make(),t=enemy(f);f.b.on('beforeBuff',c=>{if(c.buff.data.skyboxMark)f.b.removeBuff(f.u,f.talent.parent.buff);});damage(f,t);
 assert.equal(t.s.flags.silence,true);assert.equal(f.talent.records.size,0);assert.ok(!t.buffs.some(b=>b.data.skyboxMark));assert.equal(f.talent.handles.length,0);
});
test('Parent expiry without onRemove still ends derived memory while leaving accepted Silence independent',()=>{
 const f=make(),t=enemy(f);damage(f,t);f.talent.parent.buff.timeLeft=.01;advance(f.b,.1);
 assert.equal(f.talent.records.size,0);assert.equal(f.talent.handles.length,0);assert.equal(t.s.flags.silence,true);
 advance(f.b,7.1);assert.equal(f.talent.watchers.length,0);
});
test('Already released actions can finish if source or recipient hides inside status admission',()=>{
 for(const hidden of['source','recipient']){const f=make(),t=enemy(f);f.b.on('beforeStatus',()=>{(hidden==='source'?f.u:t).hidden=true;});
  damage(f,t);assert.equal(t.s.flags.silence,true);assert.equal(f.talent.records.size,1);advance(f.b,1);near(silence(t).timeLeft,6);
 }
});
test('A retired parent cannot contribute to a projectile modifier that arrives after source departure',()=>{
 const f=make(),t=enemy(f);f.b.on('outputDamage',()=>f.b.retreat(f.u));damage(f,t);
 assert.equal(!!t.s.flags.silence,false);assert.equal(f.talent.records.size,0);assert.equal(f.talent.silences.size,0);
});
for(const type of['arts','true'])test(`The native event has no invented Physical-only restriction for ${type} HP modifiers`,()=>{
 const f=make(),t=enemy(f);damage(f,t,{type});assert.equal(t.s.flags.silence,true);assert.equal(f.talent.records.size,1);
});
for(const part of['silence','mark'])test(`Pre-finished ${part} admission cannot install a late owned resource`,()=>{
 const f=make(),t=enemy(f);f.b.on('beforeBuff',c=>{if(c.buff.data[part==='silence'?'skyboxSilence':'skyboxMark'])c.buff.onRemove();});damage(f,t);
 if(part==='silence'){assert.equal(!!t.s.flags.silence,false);assert.equal(f.talent.records.size,1);assert.equal(f.talent.silences.size,0);}
 else{assert.equal(t.s.flags.silence,true);assert.equal(f.talent.records.size,0);assert.ok(!t.buffs.some(b=>b.data.skyboxMark));}
});
for(const kind of['cancelled','pre-finished','foreign'])test(`A ${kind} self-parent grant cannot enable or adopt the talent`,()=>{
 let foreign;const f=make({beforeInstall:(b,u)=>b.on('beforeBuff',c=>{if(c.unit!==u||!c.buff.data.skyboxParent)return;
  if(kind==='cancelled')c.cancel=true;else if(kind==='pre-finished')c.buff.onRemove();else{
   if(!foreign)foreign=b.addBuff(u,{key:c.buff.key,source:{}});
  }})}),t=enemy(f);damage(f,t);assert.equal(!!t.s.flags.silence,false);assert.equal(f.talent.records.size,0);f.talent.stop();
 if(foreign)assert.ok(f.u.buffs.includes(foreign));
});
test('Foreign Silence or mark collisions are never adopted, refreshed or removed',()=>{
 for(const kind of['silence','mark']){const f=make(),t=enemy(f),key=kind==='silence'?f.talent.silenceKey(t,t.deploySeq):f.talent.markKey(t);let foreign,injected=false;
  f.b.on('beforeBuff',c=>{if(c.buff.key===key&&!injected){injected=true;foreign=f.b.addBuff(t,{key,source:{},duration:1});}});damage(f,t);
  near(foreign.timeLeft,1);f.talent.stop();assert.ok(t.buffs.includes(foreign));
  if(kind==='silence')assert.equal(f.talent.silences.size,0);else assert.equal(f.talent.records.size,0);
 }
});
test('Same-recipient recursion cannot duplicate the action list; another recipient can process independently',()=>{
 const f=make(),a=enemy(f),b=enemy(f),applied=[];let reentered=false;
 f.b.on('beforeStatus',c=>{if(c.target===a&&!reentered){reentered=true;damage(f,a);damage(f,b);}});
 f.b.on('statusApplied',c=>{if(c.status==='silence')applied.push(c.target.id);});damage(f,a);
 assert.deepEqual(applied.sort((a,b)=>a-b),[a.id,b.id]);assert.equal(f.talent.records.size,2);assert.equal(f.talent.silences.size,2);
 near(a.s.maxHp-a.hp,200);near(b.s.maxHp-b.hp,100);
});
test('Other-source, sourceless and elemental packets cannot forge this source enemy-modifier event',()=>{
 const f=make(),t=enemy(f),g=addOwner(f.b,{elite:0,row:4});damage(g,t);damage(f,t,{sourceless:true});
 f.b.dealDamage(f.u,t,{amount:100,type:'element',element:'erosion'});assert.equal(f.talent.records.size,0);assert.equal(!!t.s.flags.silence,false);
 damage(f,g.u);assert.equal(f.talent.records.size,0);damage(f,t);assert.equal(t.s.flags.silence,true);
});
test('Fabricated and replayed receipts cannot create another first-target action list',()=>{
 const f=make(),t=enemy(f);const fake={source:f.u,target:t,targetLife:t.deploySeq,outcome:'accepted'};
 f.b.emit('beforeTargetModifier',fake);f.talent.modifier(fake);assert.equal(f.talent.records.size,0);let receipt;
 f.b.on('beforeTargetModifier',c=>{receipt=c;});damage(f,t);f.b.removeBuff(t,f.talent.records.get(t).buff);f.b.removeBuff(t,silence(t));
 f.b.emit('beforeTargetModifier',receipt);assert.equal(!!t.s.flags.silence,false);assert.equal(f.talent.records.size,0);
});
for(const part of['parent','silence','mark'])test(`A transformed ${part} candidate cannot leave a late claimed resource`,()=>{
 const field=part==='parent'?'skyboxParent':part==='silence'?'skyboxSilence':'skyboxMark';
 const f=make({beforeInstall:b=>b.on('beforeBuff',c=>{if(c.buff.data[field])c.buff.data={foreign:true};})}),t=enemy(f);damage(f,t);
 assert.ok(![...f.u.buffs,...t.buffs].some(b=>b.data.foreign));
 if(part==='parent'){assert.equal(!!f.talent.parent,false);assert.equal(f.talent.records.size,0);}
 if(part==='silence'){assert.equal(f.talent.silences.size,0);assert.equal(f.talent.records.size,1);}
 if(part==='mark')assert.equal(f.talent.records.size,0);
});
