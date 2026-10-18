// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {make as fixture,ally,advance,until,near} from './helpers/taraxa-fixture.js';
import {TaraxaSkillTwoHeals,TARAXA_S2_HEALS_CONTRACT,verifyTaraxaS2Heals} from '../server/sim/content/arkpedia-taraxa-s2-heals.js';
import {taraxaNativeInputs} from '../server/sim/content/arkpedia-taraxa-source.js';
function make(opts={}){
 const f=fixture({skill:2,...opts,defer:true}),payload=new TaraxaSkillTwoHeals(f.b,f.u,{contract:TARAXA_S2_HEALS_CONTRACT});
 f.deploy();payload.bind();f.payload=payload;f.heals=[];f.b.on('calculatedHeal',h=>{if(h.source===f.u)f.heals.push({...h,time:f.b.time});});return f;
}
const healKind=(f,kind)=>f.heals.filter(h=>h.opts.tags?.includes(`taraxa:s2-${kind}`));
const drained=f=>until(f,()=>f.payload.flights.size===0);
const launch=(f,t,options={})=>assert.equal(f.payload.launch(t,{attackId:77,...options}),true);
test('Selected S2 payload rejects absent contracts, another skill and changed source emission/transport',()=>{
 verifyTaraxaS2Heals();const f=fixture({skill:2,defer:true});assert.throws(()=>new TaraxaSkillTwoHeals(f.b,f.u),/exact healing contract/);
 assert.throws(()=>new TaraxaSkillTwoHeals(f.b,f.u,{contract:TARAXA_S2_HEALS_CONTRACT}) .bind(),/living deployment/);
 assert.throws(()=>make({skill:1}),/selected Taraxacum S2/);
 for(const change of[n=>n.templates['taraxa_s2[second_heal]'].eventToActions.ON_ABILITY_CAST_ON_TARGET[0]._blockMode='WALK',
  n=>n.templates['taraxa_s2[splash]'].eventToActions.ON_BUFF_START[0]._excludeTarget=false,
  n=>n.projectiles.projectile_chr_taraxa_s2_2.flatMap(r=>r.components).find(c=>c.data._speed===5).data._speed=10]){
  const n=structuredClone(taraxaNativeInputs());change(n);assert.throws(()=>verifyTaraxaS2Heals(n),/Changed original/);
 }
});
test('Primary acquisition prefers injured air blockers, while motion FLY alone retains ordinary ratio priority',()=>{
 const f=make(),ground=ally(f,{ratio:.01}),air=ally(f,{col:7,ratio:.8,flags:{liftoff:true}});
 assert.equal(f.payload.primary(),air);f.b.removeBuff(air,'fixture:flags');air.motion='FLY';assert.equal(f.payload.primary(),ground);
 ground.hp=ground.s.maxHp;air.hp=air.s.maxHp;assert.equal(f.payload.primary(),null);
});
test('Primary has independent speed-ten transport and normal attack-healing identity',()=>{
 const f=make(),t=ally(f);launch(f,t);const [p,record]=[...f.payload.flights][0];assert.equal(p.speed,10);assert.equal(p.maxAge,10);
 assert.equal(record.kind,'primary');assert.equal(f.heals.length,0);drained(f);const h=healKind(f,'primary')[0];
 assert.equal(h.target,t);near(h.amount,f.u.s.atk);assert.equal(h.opts.isAttack,true);assert.equal(h.opts.isProjectile,true);assert.equal(h.opts.attackId,77);
});
test('An air-blocking primary emits one distinct full-scale secondary without another attack receipt',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true}}),other=ally(f,{col:7,ratio:.3});launch(f,t,{secondary:true});
 assert.equal(f.payload.flights.size,2);assert.equal(f.u.stats.attacks,0);assert.equal([...f.payload.flights.values()].filter(p=>p.kind==='secondary').length,1);
 drained(f);const h=healKind(f,'secondary')[0];assert.equal(h.target,other);near(h.amount,f.u.s.atk);assert.equal(h.opts.isAttack,false);assert.equal(h.opts.attackId,77);
});
for(const kind of['ground','FLY'])test(`${kind} movement without air-blocking state cannot trigger the extra S2 heal`,()=>{
 const f=make(),t=ally(f,{motion:kind==='FLY'?'FLY':'WALK'});ally(f,{col:7});launch(f,t,{secondary:true});
 assert.equal([...f.payload.flights.values()].filter(p=>p.kind==='secondary').length,0);drained(f);assert.equal(healKind(f,'secondary').length,0);
});
test('Absent/rejected second-heal passive allowance does not suppress the primary carrier',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true}});ally(f,{col:7});launch(f,t);assert.equal(f.payload.flights.size,1);
 drained(f);assert.equal(healKind(f,'primary').length,1);assert.equal(healKind(f,'secondary').length,0);
});
test('Secondary selector excludes the primary and admits a full-health legal ally',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true}}),other=ally(f,{col:7,ratio:1});assert.notEqual(f.payload.secondary(t),t);
 f.b.addBuff(f.u,{key:'fixture:no-heal',flags:{healFree:true}});assert.equal(f.payload.secondary(t),other);
 launch(f,t,{secondary:true});drained(f);assert.equal(healKind(f,'secondary')[0].target,other);
});
test('Secondary is selected from owner range at release, independently from the primary-centred splash grid',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true},col:6}),outsideSplash=ally(f,{row:7,col:5,ratio:.01});
 assert.equal(f.payload.secondary(t),outsideSplash);launch(f,t,{secondary:true});drained(f);
 assert.equal(healKind(f,'secondary')[0].target,outsideSplash);assert.ok(!healKind(f,'splash').some(h=>h.target===outsideSplash));
});
test('Original x-4 splash selects two lowest-ratio neighbours, excludes its centre and can reach outside owner range',()=>{
 const f=make(),t=ally(f,{col:8,ratio:.01}),a=ally(f,{row:6,col:9,ratio:.1}),b=ally(f,{row:5,col:9,ratio:.2}),c=ally(f,{row:4,col:8,ratio:.3});
 assert.deepEqual(f.payload.splashRecipients(t),[a,b]);launch(f,t);until(f,()=>healKind(f,'primary').length===1);
 const ps=[...f.payload.flights].filter(([,r])=>r.kind==='splash');assert.equal(ps.length,2);assert.ok(ps.every(([p])=>p.speed===5&&p.maxAge===10));
 drained(f);const hs=healKind(f,'splash');assert.deepEqual(hs.map(h=>h.target),[b,a]);
 for(const h of hs){near(h.amount,f.u.s.atk*.5);assert.equal(h.opts.isAttack,false);assert.equal(h.opts.attackId,77);}near(c.hp,3000);
});
for(const rank of[1,7,10])test(`Splash rank${rank} uses selected count and secondary-heal coefficient`,()=>{
 const f=make({rank}),t=ally(f,{col:6}),a=ally(f,{row:6,col:7,ratio:.1});ally(f,{row:5,col:7,ratio:.2});launch(f,t);drained(f);
 assert.equal(healKind(f,'splash').length,f.record.bb['attack@splash_num']);
 for(const h of healKind(f,'splash'))near(h.amount,f.u.s.atk*f.record.bb['attack@heal_scale_2']);assert.ok(healKind(f,'splash').some(h=>h.target===a));
});
test('Primary becoming full health before arrival still admits its separate splash buff',()=>{
 const f=make(),t=ally(f),other=ally(f,{col:7});launch(f,t);t.hp=t.s.maxHp;drained(f);
 assert.equal(healKind(f,'primary').length,1);assert.ok(healKind(f,'splash').some(h=>h.target===other));
});
test('A newly heal-free primary receives no healing but does not suppress a separately accepted splash',()=>{
 const f=make(),t=ally(f),other=ally(f,{col:7});launch(f,t);const hp=t.hp;f.b.addBuff(t,{key:'fixture:no',flags:{healFree:true}});drained(f);
 assert.equal(t.hp,hp);assert.equal(healKind(f,'primary').length,0);assert.ok(healKind(f,'splash').some(h=>h.target===other));
});
test('Neither secondary nor splash carries the primary active splash buff or recurses into more projectiles',()=>{
 const f=make(),t=ally(f,{flags:{liftoff:true}});ally(f,{col:7});ally(f,{row:6,col:6});launch(f,t,{secondary:true});
 const counts={};f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('taraxa_s2[splash]:'))counts[c.unit.id]=(counts[c.unit.id]??0)+1;});
 drained(f);assert.deepEqual(counts,{[t.id]:1});assert.ok(f.heals.length<=4);assert.equal(f.payload.watchers.length,0);advance(f.b,1);assert.equal(f.payload.flights.size,0);
});
test('Rejected splash buff preserves the primary heal and creates no daughter payloads',()=>{
 const f=make(),t=ally(f);ally(f,{col:7});f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('taraxa_s2[splash]:'))c.cancel=true;});launch(f,t);drained(f);
 assert.equal(healKind(f,'primary').length,1);assert.equal(healKind(f,'splash').length,0);
});
test('A prematurely finished splash admission cannot execute its late buff or leave it attached',()=>{
 const f=make(),t=ally(f);ally(f,{col:7});f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('taraxa_s2[splash]:'))c.buff.onRemove();});launch(f,t);drained(f);
 assert.equal(healKind(f,'splash').length,0);assert.ok(!t.buffs.some(b=>b.data?.taraxaSplash));
});
for(const phase of['main','splash'])test(`A replaced recipient life cannot inherit an old ${phase} carrier`,()=>{
 const f=make(),t=ally(f),other=ally(f,{col:7});launch(f,t);
 if(phase==='splash')until(f,()=>[...f.payload.flights.values()].some(r=>r.kind==='splash'));
 const recipient=phase==='main'?t:other,hp=recipient.hp;recipient.deploySeq++;drained(f);assert.equal(recipient.hp,hp);
 assert.equal((phase==='main'?healKind(f,'primary'):healKind(f,'splash').filter(h=>h.target===other)).length,0);
});
test('A recipient replaced in primary healing callbacks cannot become a new splash origin',()=>{
 const f=make(),t=ally(f);ally(f,{col:7});const hp=t.hp;f.b.on('heal',h=>{if(h.target===t&&h.opts.tags.includes('taraxa:s2-primary'))t.deploySeq++;});launch(f,t);drained(f);
 assert.equal(t.hp,hp);assert.equal(healKind(f,'splash').length,0);
});
test('A recipient replaced during splash-buff admission leaves neither late buff nor daughter carriers',()=>{
 const f=make(),t=ally(f);ally(f,{col:7});f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('taraxa_s2[splash]:'))t.deploySeq++;});launch(f,t);drained(f);
 assert.equal(healKind(f,'splash').length,0);assert.ok(!t.buffs.some(b=>b.data?.taraxaSplash));
});
test('Splash range and origin follow the primary recipient current tile at impact',()=>{
 const f=make(),t=ally(f),nearOld=ally(f,{col:7}),nearNew=ally(f,{row:8,col:9});launch(f,t);
 t.x=8;t.y=8;t.tileR=8;t.tileC=8;drained(f);assert.ok(healKind(f,'splash').some(h=>h.target===nearNew));
 assert.ok(!healKind(f,'splash').some(h=>h.target===nearOld));
});
test('Live matching source output and recipient modifiers are sampled at impact',()=>{
 const f=make(),t=ally(f);launch(f,t);f.b.addBuff(f.u,{key:'fixture:output',mods:{atkMul:2,atkScaleMul:1.2,healingDealtMul:1.5}});
 f.b.addBuff(t,{key:'fixture:incoming',mods:{healingTakenMul:1.3}});drained(f);near(healKind(f,'primary')[0].amount,f.u.s.atk*1.2*1.5*1.3);
});
for(const newMultiplier of[0,9])test(`Source retirement/new-life healing multiplier${newMultiplier} cannot alter a born S2 primary`,()=>{
 const f=make(),t=ally(f);f.b.addBuff(f.u,{key:'fixture:birth',mods:{healingDealtMul:1.5}});const atk=f.u.s.atk;launch(f,t);
 f.b.retreat(f.u);f.u.deploySeq++;f.u.base.atk=99999;f.u.markDirty();f.b.addBuff(f.u,{key:'fixture:new-life',mods:{healingDealtMul:newMultiplier}});
 drained(f);near(healKind(f,'primary')[0].amount,atk*1.5);
});
test('A source retired by its primary heal retains the last matching impact attributes in daughter payloads',()=>{
 const f=make(),t=ally(f),other=ally(f,{col:7});launch(f,t);f.b.addBuff(f.u,{key:'fixture:impact-boost',mods:{atkMul:2,healingDealtMul:1.5}});const atk=f.u.s.atk;
 f.b.on('heal',h=>{if(h.opts.tags.includes('taraxa:s2-primary')){f.b.retreat(f.u);f.u.deploySeq++;f.u.base.atk=99999;f.u.markDirty();}});
 drained(f);near(healKind(f,'splash').find(h=>h.target===other).amount,atk*.5*1.5);
});
test('Retiring a source after splash birth cannot erase its independent daughter heals',()=>{
 const f=make(),t=ally(f),other=ally(f,{col:7});launch(f,t);until(f,()=>[...f.payload.flights.values()].some(p=>p.kind==='splash'));const atk=f.u.s.atk;
 f.b.retreat(f.u);f.u.base.atk=99999;f.u.markDirty();drained(f);near(healKind(f,'splash').find(h=>h.target===other).amount,atk*.5);
});
test('An arriving splash still applies normal heal-free and incoming-healing guards',()=>{
 const f=make(),t=ally(f),other=ally(f,{col:7});launch(f,t);until(f,()=>[...f.payload.flights.values()].some(p=>p.kind==='splash'));
 const hp=other.hp;f.b.addBuff(other,{key:'fixture:free',flags:{healFree:true}});drained(f);assert.equal(other.hp,hp);
});
test('External projectile removal releases all payload listeners without arrival effects',()=>{
 const f=make(),t=ally(f);launch(f,t);f.b.removeProjectiles(p=>f.payload.flights.has(p));advance(f.b,.1);
 assert.equal(f.payload.flights.size,0);assert.equal(f.payload.watchers.length,0);assert.equal(f.heals.length,0);
});
test('Battle end during primary callback drains all carriers before any splash buff can be admitted',()=>{
 const f=make(),t=ally(f);ally(f,{col:7});f.b.on('heal',h=>{if(h.opts.tags.includes('taraxa:s2-primary')){f.b.finished=true;f.b.emit('battleEnd',{});}});
 launch(f,t);advance(f.b,.3);assert.equal(f.payload.ended,true);assert.equal(f.payload.flights.size,0);assert.equal(f.payload.watchers.length,0);
 assert.equal(healKind(f,'splash').length,0);
});
test('Battle end inside splash admission removes its late buff and forbids daughter transport',()=>{
 const f=make(),t=ally(f);ally(f,{col:7});f.b.on('beforeBuff',c=>{if(c.buff.key.startsWith('taraxa_s2[splash]:')){f.b.finished=true;f.b.emit('battleEnd',{});}});
 launch(f,t);advance(f.b,.3);assert.equal(f.payload.flights.size,0);assert.ok(!t.buffs.some(b=>b.data?.taraxaSplash));assert.equal(f.payload.watchers.length,0);
});

test('A repeated or recursive primary callback cannot exceed its native one-hit cap or duplicate splash',()=>{
 const f=make(),t=ally(f);ally(f,{col:7,ratio:.3});launch(f,t);const p=[...f.payload.flights.keys()][0];let entered=false;
 f.b.on('heal',h=>{if(!entered&&h.opts.tags.includes('taraxa:s2-primary')){entered=true;p.onHit();}});
 drained(f);p.onHit();assert.equal(healKind(f,'primary').length,1);assert.ok(healKind(f,'splash').length<=2);assert.equal(f.payload.flights.size,0);
});
test('A retired or replaced source cannot launch new S2 payloads through its old binding',()=>{
 const f=make(),t=ally(f);f.u.deploySeq++;assert.equal(f.payload.launch(t),false);assert.equal(f.payload.flights.size,0);
});

for(const multiplier of[0,9])test(`A present replacement source life with healing multiplier${multiplier} cannot alter an old S2 payload`,()=>{
 const f=make(),t=ally(f);f.b.addBuff(f.u,{key:'fixture:old-output',mods:{healingDealtMul:1.5}});const atk=f.u.s.atk;launch(f,t);
 f.u.deploySeq++;f.u.base.atk=99999;f.u.markDirty();f.b.addBuff(f.u,{key:'fixture:new-output',mods:{healingDealtMul:multiplier}});
 drained(f);near(healKind(f,'primary')[0].amount,atk*1.5);
});
