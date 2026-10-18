// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';import assert from 'node:assert/strict';
import {make as fixture,enemy,advance,near,until} from './helpers/yukari-fixture.js';
import {YukariSkillOneTransport,YUKARI_S1_TRANSPORT_CONTRACT,verifyYukariS1Transport} from '../server/sim/content/arkpedia-yukari-s1-transport.js';
import {yukariNativeInputs} from '../server/sim/content/arkpedia-yukari-source.js';
const fs=[],make=opts=>{const f=fixture({...opts,defer:true});fs.push(f);const payload=new YukariSkillOneTransport(f.b,f.u,{contract:YUKARI_S1_TRANSPORT_CONTRACT});f.deploy();payload.bind();return{...f,payload};};
test.afterEach(()=>{for(const f of fs.splice(0))assert.deepEqual(f.b.errors,[]);});
const launch=(f,t,index=3,more={})=>assert.equal(f.payload.launch({target:t,index,attackId:77,...more}),true),hits=f=>f.hits.filter(h=>h.dmg.tags.some(t=>t.startsWith('yukari:s1-')));
test('Only a fresh selected S1 and exact payload contract bind one living deployment',()=>{
 assert.deepEqual(verifyYukariS1Transport(),{radius:1.100000023841858,lifeTime:10,speed:20});const f=fixture({defer:true});assert.throws(()=>new YukariSkillOneTransport(f.b,f.u),/exact transport/);assert.throws(()=>make({skill:2}),/exact transport/);
 const g=make();assert.throws(()=>g.payload.bind(),/one living/);assert.throws(()=>new YukariSkillOneTransport(g.b,g.u,{contract:YUKARI_S1_TRANSPORT_CONTRACT}),/Fresh selected/);const t=enemy(g);
 for(const index of[-1,4,NaN,1.5])assert.equal(g.payload.launch({target:t,index}),false);assert.equal(g.payload.launch({target:t,index:0,x:NaN}),false);assert.equal(g.payload.launch({target:g.u,index:0}),false);
});
for(const field of['last','count','cache','fallback','baseSpeed','finalSpeed','sourceBound','oneHit','radius','motion','reach','camouflage','override','damageKey','applyWay','alive','derived','resist','duration'])test(`Changed ${field} cannot keep original S1 payload approval`,()=>{
 const n=structuredClone(yukariNativeInputs()),base=n.projectiles.projectile_chr_yukari_s1.flatMap(r=>r.components),final=n.projectiles.projectile_chr_yukari_s1_final.flatMap(r=>r.components),root=final.find(c=>c.data._lifeTime!=null).data,area=final.find(c=>c.data._onlyCheckHitWhenReachTarget!=null).data,
  action=final.find(c=>c.data._overwriteActions===1).data,actions=JSON.parse(action._actions.SerializedState);
 if(field==='last')n.s1Attack._hookTheLastProjectile='projectile_chr_yukari_s1';if(field==='count')n.s1Attack._additionalTimes=4;if(field==='cache')n.s1Attack._useCachedAtkOnly=1;if(field==='fallback')n.s1Attack._emitToInputPosWhenTargetIsInvalid=0;
 if(field==='baseSpeed')base.find(c=>c.data._speed!=null).data._speed=10;if(field==='finalSpeed')final.find(c=>c.data._speed!=null).data._speed=10;if(field==='sourceBound')root._managedBySource=1;if(field==='oneHit')root._stopAfterFirstHit=0;
 if(field==='radius')final.find(c=>c.type==='CircleCollider2D').data.m_Radius=2;if(field==='motion')area._targetOptions.targetMotion=2;if(field==='reach')area._onlyCheckHitWhenReachTarget=0;if(field==='camouflage')area._ignoreCamouflage=0;
 if(field==='override')action._overwriteActions=0;if(field==='damageKey')actions[0]._atkScaleVar='multi_atk_scale';if(field==='applyWay')actions[0]._applyWay='RANGED';if(field==='alive')actions[1]._ownerType='SOURCE';
 if(field==='derived')actions[2]._isDerivedBuff=true;if(field==='resist')actions[2]._buff.statusResistable='NEVER';if(field==='duration')actions[2]._buff.durationKey='duration';action._actions.SerializedState=JSON.stringify(actions);
 assert.throws(()=>verifyYukariS1Transport(n),/Changed original/);
});
for(let rank=1;rank<=10;rank++)test(`Rank${rank} separates three multi-scale arrows from one final-scale area action and levitation`,()=>{
 const f=make({rank}),a=enemy(f),nearby=enemy(f,{col:7.4}),atk=f.u.s.atk;for(const i of[0,1,2])launch(f,a,i);advance(f.b,.14);assert.equal(hits(f).length,3);near(a.s.maxHp-a.hp,atk*f.record.bb.multi_atk_scale*3);near(nearby.hp,nearby.s.maxHp);assert.equal(a.s.flags.levitate,undefined);
 launch(f,a);advance(f.b,.14);assert.equal(hits(f).length,5);near(a.s.maxHp-a.hp,atk*(f.record.bb.multi_atk_scale*3+f.record.bb.final_atk_scale));near(nearby.s.maxHp-nearby.hp,atk*f.record.bb.final_atk_scale);
 assert.equal(a.s.flags.levitate,true);assert.equal(nearby.s.flags.levitate,true);assert.equal(f.receipts.length,0);assert.equal(f.heals.length,0);assert.ok(hits(f).every(h=>h.type==='arts'&&h.dmg.isSkill&&h.dmg.isProjectile&&h.dmg.attackId===77));
 assert.equal(hits(f)[0].dmg.applyWay,'ranged');assert.equal(hits(f)[3].dmg.applyWay,'none');assert.equal(f.payload.flights.size,0);assert.equal(f.payload.watchers.length,0);
});
test('Each arrow has its own native prefab, speed and finite travel instead of instant combined damage',()=>{
 const f=make(),a=enemy(f,{col:9});launch(f,a,0);launch(f,a,3);const ps=[...f.payload.flights.keys()];assert.deepEqual(ps.map(p=>p.data.projectileKey),['projectile_chr_yukari_s1','projectile_chr_yukari_s1_final']);for(const p of ps){near(p.speed,20);near(p.maxAge,10);}
 advance(f.b,.16);assert.equal(hits(f).length,0);until(f,()=>hits(f).length===2);near(hits(f)[0].time,.2,.04);
});
test('The final collider includes ground, air and exact edge recipients but does not turn the small arrows into splash',()=>{
 const f=make(),a=enemy(f),air=enemy(f,{col:7.5,motion:'FLY'}),edge=enemy(f,{col:8.1}),out=enemy(f,{col:8.101});launch(f,a);advance(f.b,.14);
 assert.equal(hits(f).length,3);assert.equal(air.s.flags.levitate,undefined);assert.equal(a.s.flags.levitate,true);assert.equal(edge.s.flags.levitate,true);near(out.hp,out.s.maxHp);
});
test('Final area recipients are selected at arrival and follow the live primary destination',()=>{
 const f=make(),a=enemy(f),leave=enemy(f,{col:7.2}),enter=enemy(f,{col:10.3});launch(f,a);a.x=10;leave.x=7;f.b._buildEnemyIndex();until(f,()=>hits(f).length===2);
 assert.deepEqual(hits(f).map(h=>h.target.id).sort(),[a.id,enter.id].sort());near(leave.hp,leave.s.maxHp);
});
for(const flag of['stealth','untargetable','sleep','hidden'])test(`Final area excludes ${flag} recipients instead of forcing an illegal primary hit`,()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.2});launch(f,a);if(flag==='hidden'){a.hidden=true;other.hidden=true;}else{f.b.addBuff(a,{key:'fixture:late',flags:{[flag]:true}});f.b.addBuff(other,{key:'fixture:late',flags:{[flag]:true}});}advance(f.b,.4);assert.equal(hits(f).length,0);
});
test('Final area ignores camouflage; the typed Arts pipeline retains each recipient RES and live penetration',()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.2,flags:{camou:true}});a.base.res=50;a.markDirty();launch(f,a);f.b.addBuff(f.u,{key:'fixture:live',mods:{atkPct:1,artsDealtMul:2,resIgnoreFlat:30}});advance(f.b,.14);
 near(hits(f).find(h=>h.target===a).amount,f.u.s.atk*f.record.bb.final_atk_scale*.8*2);near(hits(f).find(h=>h.target===other).amount,f.u.s.atk*f.record.bb.final_atk_scale*2);
});
test('The selected final action reads uncached live ATK separately between area victims',()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.2}),atk=f.u.s.atk;f.b.on('damaged',c=>{if(c.target===a)f.b.addBuff(f.u,{key:'fixture:between',mods:{atkPct:1}});});launch(f,a);advance(f.b,.14);near(hits(f)[0].amount,atk*f.record.bb.final_atk_scale);near(hits(f)[1].amount,atk*f.record.bb.final_atk_scale*2);
});
for(const when of['beforeBirth','inFlight'])for(const change of['death','replacement','hidden'])test(`A ${change} input ${when} leaves a captured point for the final arrow without homing to a new life`,()=>{
 const f=make(),a=enemy(f),nearby=enemy(f,{col:7.2}),life=a.deploySeq,x=a.x,y=a.y;const changeInput=()=>{if(change==='death')f.b.kill(a,null);if(change==='replacement'){a.deploySeq++;a.x=15;a.y=15;}if(change==='hidden')a.hidden=true;};
 if(when==='beforeBirth')changeInput();launch(f,a,3,{life,x,y});if(when==='inFlight')changeInput();advance(f.b,.3);assert.equal(hits(f).length,1);assert.equal(hits(f)[0].target.id,nearby.id);
});
test('Small arrows never donate direct output to a replaced target life or a nearby enemy',()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.2});launch(f,a,0);a.deploySeq++;advance(f.b,.3);assert.equal(hits(f).length,0);near(other.hp,other.s.maxHp);
});
for(const reason of['retreat','death','replacement','retire'])test(`Born S1 arrows survive source ${reason} with original attributes and ledger`,()=>{
 const f=make(),a=enemy(f),atk=f.u.s.atk,ledger=f.u.stats;launch(f,a,0);launch(f,a,3);if(reason==='retreat')f.b.retreat(f.u);if(reason==='death')f.b.kill(f.u,null);if(reason==='replacement')f.u.deploySeq++;if(reason==='retire')f.payload.retire();
 f.u.base.atk=99999;f.u.stats={...ledger,dmg:0};f.u.ownerId='new-owner';f.u.markDirty();advance(f.b,.3);near(a.s.maxHp-a.hp,atk*(f.record.bb.multi_atk_scale+f.record.bb.final_atk_scale));assert.equal(a.s.flags.levitate,true);assert.ok(hits(f).every(h=>h.source!==f.u&&h.source.stats===ledger));near(f.u.stats.dmg,0);assert.equal(f.payload.launch({target:a,index:0}),false);assert.equal(f.payload.watchers.length,0);
});
test('Source death during the first area action does not cancel already born output to later victims',()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.2}),atk=f.u.s.atk;f.b.on('outputDamage',c=>{if(c.target===a)f.b.kill(f.u,null);});launch(f,a);advance(f.b,.3);assert.equal(hits(f).length,2);near(hits(f)[1].amount,atk*f.record.bb.final_atk_scale);assert.notEqual(hits(f)[1].source,f.u);assert.equal(other.s.flags.levitate,true);
});
for(const event of['outputDamage','hit','damageFinal','calculatedDamage'])test(`Recipient replacement inside ${event} accepts neither old damage nor levitation`,()=>{
 const f=make(),a=enemy(f);f.b.on(event,c=>{if(c.dmg.tags.includes('yukari:s1-final'))a.deploySeq++;});launch(f,a);advance(f.b,.3);near(a.hp,a.s.maxHp);assert.equal(a.s.flags.levitate,undefined);assert.equal(hits(f).length,0);
});
test('A dying victim does not receive levitation, while canceled damage on a living target still follows the source alive check',()=>{
 const f=make(),a=enemy(f,{hp:1});launch(f,a);advance(f.b,.3);assert.equal(a.alive,false);assert.equal(a.s.flags.levitate,undefined);
 const g=make(),t=enemy(g);g.b.on('hit',c=>{if(c.dmg.tags.includes('yukari:s1-final'))c.cancel=true;});launch(g,t);advance(g.b,.3);near(t.hp,t.s.maxHp);assert.equal(t.s.flags.levitate,true);
});
for(const what of['weight','resist','immunity','already'])test(`Levitation retains the shared ${what} rules independently of Arts damage`,()=>{
 const f=make(),a=enemy(f);if(what==='weight'){a.base.massLevel=9;a.markDirty();}if(what==='resist')f.b.applyStatus(a,'resist',{duration:10,value:.5});if(what==='immunity')a.def={...a.def,immune:new Set([...a.def.immune,'levitate'])};if(what==='already')f.b.applyStatus(a,'levitate',{duration:10});launch(f,a);advance(f.b,.14);assert.equal(hits(f).length,1);
 const owned=a.buffs.find(b=>b.data?.yukariLevitate);if(what==='immunity'||what==='already')assert.equal(owned,undefined);else near(owned.duration,f.record.bb.levitate*.5);
});
for(const where of['beforeStatus','beforeBuff'])for(const mutation of['veto','replacement'])test(`${mutation} in ${where} cannot grant levitation to the rejected recipient`,()=>{
 const f=make(),a=enemy(f);f.b.on(where,c=>{if(where==='beforeStatus'?c.status!=='levitate':!c.buff.data?.yukariLevitate)return;if(mutation==='veto')c.cancel=true;else a.deploySeq++;});launch(f,a);advance(f.b,.3);assert.equal(a.s.flags.levitate,undefined);assert.equal(hits(f).length,1);
});
test('A transformed levitation descriptor is rejected without attaching invented status modifiers',()=>{
 const f=make(),a=enemy(f);f.b.on('beforeBuff',c=>{if(c.buff.data?.yukariLevitate)c.buff.mods={atkPct:99};});launch(f,a);advance(f.b,.3);assert.equal(a.s.flags.levitate,undefined);near(a.s.atk,a.base.atk);
});
test('The nonderived levitation remains after transport retirement and expires on its own source duration',()=>{
 const f=make(),a=enemy(f);launch(f,a);advance(f.b,.14);assert.equal(a.s.flags.levitate,true);f.payload.retire();f.b.retreat(f.u);assert.equal(a.s.flags.levitate,true);advance(f.b,f.record.bb.levitate+.1);assert.equal(a.s.flags.levitate,undefined);
});
test('Impact is claimed before recursive callbacks, and later captured victim lives cannot be replaced during the first hit',()=>{
 const f=make(),a=enemy(f),other=enemy(f,{col:7.2});launch(f,a);const p=[...f.payload.flights.keys()][0];f.b.on('outputDamage',c=>{if(c.target===a){p.onHit({x:a.x,y:a.y});other.deploySeq++;}});advance(f.b,.3);assert.equal(hits(f).length,1);near(other.hp,other.s.maxHp);assert.equal(other.s.flags.levitate,undefined);
});
for(const how of['intercept','remove','drain','battleEnd'])test(`${how} drains transport watchers and rejects replayed late impacts`,()=>{
 const f=make(),a=enemy(f);launch(f,a);const p=[...f.payload.flights.keys()][0];if(how==='intercept')f.b.projectiles.registerInterceptor({owner:f.u,intercept:()=>true});if(how==='remove')f.b.removeProjectiles(x=>x===p);if(how==='drain')f.payload.drain();if(how==='battleEnd'){f.b.finished=true;f.b.emit('battleEnd',{});}advance(f.b,.3);assert.equal(f.payload.flights.size,0);assert.equal(f.payload.watchers.length,0);p.onHit({x:a.x,y:a.y});assert.equal(hits(f).length,0);assert.equal(a.s.flags.levitate,undefined);
});
