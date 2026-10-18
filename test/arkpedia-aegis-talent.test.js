// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {make as fixture,enemy,advance,near} from './helpers/aegis-fixture.js';
import {AegisPhysicalTalent,AEGIS_TALENT_CONTRACT,verifyAegisTalent} from '../server/sim/content/arkpedia-aegis-talent.js';
import {aegisNativeInputs} from '../server/sim/content/arkpedia-aegis-source.js';
const fs=[];const make=opts=>{const f=fixture({flight:false,...opts});fs.push(f);return f;};
test.afterEach(()=>{for(const f of fs.splice(0))assert.deepEqual(f.b.errors,[]);});
const owned=f=>f.u.buffs.filter(x=>x.data?.aegisTalent);
test('Physical talent binds exact selected source parent and distinct typed native actions',()=>{
 verifyAegisTalent();assert.throws(()=>make({talentContract:{...AEGIS_TALENT_CONTRACT}}),/exact talent/);const f=make();
 assert.throws(()=>new AegisPhysicalTalent(f.b,f.u,{contract:AEGIS_TALENT_CONTRACT}),/Fresh selected/);
 for(const mutate of[n=>n.talent._buffs[0].isSilenceable=1,n=>n.templates.aigis_t_1.eventToActions.ON_OUTPUT_DAMAGE[0]._damageMask='ALL',
  n=>n.templates.aigis_t_1.eventToActions.ON_TAKE_DAMAGE[0]._isOneMinus=false,n=>n.templates.aigis_t_1.eventToActions.ON_OUTPUT_DAMAGE[0]._isStackable=true]){
  const n=structuredClone(aegisNativeInputs());mutate(n);assert.throws(()=>verifyAegisTalent(n),/Changed original/);
 }
});
for(const [elite,potential,scale,resist]of[[0,1,1,0],[1,1,1.05,.05],[1,5,1.07,.07],[2,1,1.1,.1],[2,5,1.12,.12]])test(`E${elite} P${potential} preserves independent Physical output/incoming after DEF without baking ATK`,()=>{
 const f=make({elite,potential}),e=enemy(f);e.base.def=100;e.markDirty();const atk=f.u.s.atk;near(atk,f.record.stats.atk);assert.equal(owned(f).length,elite===0?0:1);
 for(const type of['phys','arts','true','elemental']){
  const amount=f.b.dealDamage(f.u,e,{amount:1000,type,applyWay:'ranged',isSkill:true});near(amount,type==='phys'?900*scale:1000);
  f.u.hp=f.u.s.maxHp;const loss=f.b.dealDamage(e,f.u,{amount:500,type,applyWay:'ranged'});near(loss,type==='phys'?(500-f.u.s.def)*(1-resist):500);
 }
 f.u.hp=f.u.s.maxHp;near(f.b.loseHp(f.u,100),100);near(f.u.s.atk,atk);
});
test('Unrelated typed modifiers combine through shared channels while Arts/True retain their own channels',()=>{
 const f=make(),e=enemy(f);f.b.addBuff(f.u,{key:'fixture:independent',mods:{physDealtMul:2,physTakenMul:.5,artsDealtMul:1.5}});
 near(f.b.dealDamage(f.u,e,{amount:100,type:'phys',applyWay:'ranged'}),220);near(f.b.dealDamage(f.u,e,{amount:100,type:'arts',applyWay:'ranged'}),150);
 near(f.b.dealDamage(e,f.u,{amount:500,type:'phys',applyWay:'ranged'}),(500-f.u.s.def)*.45);
});
test('Silence, stun and hiding do not disable the non-silenceable/non-stunnable passive parent',()=>{
 const f=make(),e=enemy(f);f.b.addBuff(f.u,{key:'fixture:control',flags:{silence:true,stun:true,disarm:true}});f.u.hidden=true;advance(f.b,.2);
 near(f.b.dealDamage(f.u,e,{amount:100,type:'phys',applyWay:'ranged'}),110);assert.equal(f.talent.parentLive(),true);
});
test('Repeated packets and duplicate starts cannot stack the original nonstacking parent',()=>{
 const f=make(),e=enemy(f);for(let i=0;i<6;i++){f.talent.start();f.b.emit('deploy',{unit:f.u});near(f.b.dealDamage(f.u,e,{amount:100,type:'phys'}),110);}
 assert.equal(owned(f).length,1);near(f.u.s.physDealtMul,1.1);
});
test('Dispel removes only the owned Physical parent and leaves a foreign multiplier intact',()=>{
 const f=make(),e=enemy(f),foreign=f.b.addBuff(f.u,{key:'fixture:foreign',mods:{physDealtMul:2}});f.b.removeBuff(f.u,f.talent.parent.buff);
 assert.equal(f.talent.stopped,true);assert.equal(f.talent.handles.length,0);assert.equal(f.u.findBuff(foreign.key),foreign);near(f.b.dealDamage(f.u,e,{amount:100,type:'phys'}),200);
});
for(const kind of['veto','retreat','replace','finish','data','source','value','extra','flag','status','stack','duration'])test(`${kind} at talent admission cannot grant invented or stale modifiers`,()=>{
 const f=make({beforeInstall:(b,u)=>b.on('beforeBuff',c=>{if(!c.buff.key.startsWith('aigis_t_1:'))return;
  if(kind==='veto')c.cancel=true;if(kind==='retreat')b.retreat(u);if(kind==='replace')u.deploySeq++;if(kind==='finish')c.buff.onRemove();if(kind==='data')c.buff.data={foreign:true};
  if(kind==='source')c.buff.source={};if(kind==='value')c.buff.mods.physDealtMul=9;if(kind==='extra')c.buff.mods.atkPct=9;
  if(kind==='flag')c.buff.flags={stun:true};if(kind==='status')c.buff.status='stun';if(kind==='stack')c.buff.stacks=2;if(kind==='duration')c.buff.timeLeft=1;
 })});advance(f.b,.1);assert.equal(owned(f).length,0);near(f.u.s.physDealtMul,1);near(f.u.s.physTakenMul,1);near(f.u.s.atk,f.record.stats.atk);
});
for(const why of['retreat','death','replacement','battleEnd','stop'])test(`${why} drains the owned parent and listeners without adopting foreign resources`,()=>{
 const f=make(),foreign=f.b.addBuff(f.u,{key:'fixture:foreign',mods:{physDealtMul:2}});
 if(why==='retreat')f.b.retreat(f.u);if(why==='death')f.b.kill(f.u,null);if(why==='replacement'){f.u.deploySeq++;f.b.emit('deploy',{unit:f.u});}
 if(why==='battleEnd'){f.b.finished=true;f.b.emit('battleEnd',{});}if(why==='stop')f.talent.stop();
 assert.equal(owned(f).length,0);assert.equal(f.talent.handles.length,0);assert.equal(f.talent.stopped,true);
 if(['replacement','battleEnd','stop'].includes(why))assert.equal(f.u.findBuff(foreign.key),foreign);assert.throws(()=>f.talent.install(),/cannot be reinstalled/);
});
test('A foreign same-key parent is retained rather than adopted or removed',()=>{
 let once=false,foreign;const f=make({beforeInstall:(b,u)=>b.on('beforeBuff',c=>{if(once||!c.buff.key.startsWith('aigis_t_1:'))return;once=true;
  foreign=b.addBuff(u,{key:c.buff.key,source:{},duration:5,mods:{physDealtMul:2},data:{foreign:true}});})});advance(f.b,.1);
 assert.equal(f.u.findBuff(foreign.key),foreign);assert.equal(owned(f).length,0);near(f.u.s.physDealtMul,2);
});
