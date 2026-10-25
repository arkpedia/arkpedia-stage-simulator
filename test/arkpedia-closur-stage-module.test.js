// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {catalogueFor} from '../shared/arkpedia/loadout.js';
import tables from '../data/candidates/arkpedia-stage-predefined-module-tables.json' with {type:'json'};
import native from '../data/candidates/arkpedia-stage-predefined-module-native.json' with {type:'json'};
import {selectedClosurBuild,selectedClosurToken} from '../server/sim/content/arkpedia-closur-source.js';
import {verifyClosurModuleSource} from '../server/sim/content/arkpedia-closur-module-source.js';
import {prepareClosurCombat,CLOSUR_COMBAT_CONTRACT} from '../server/sim/content/arkpedia-closur-combat.js';
import {installClosurRoster,CLOSUR_ROSTER_CONTRACT} from '../server/sim/content/arkpedia-closur-roster.js';
import {make as base,addOwner,ally,near,until} from './helpers/closur-point-fixture.js';
const build={id:'char_4228_closur',elite:2,level:90,potential:1,trust:100,skillId:'skchr_closur_3',skillRank:10,module:'uniequip_002_closur',moduleLevel:3,stage:'17-14'};
function fixture(){const empty=base({defer:true});empty.controller.stop();const f=addOwner(empty.b,build,{prepare:prepareClosurCombat,contract:CLOSUR_COMBAT_CONTRACT});assert.ok(empty.b._deploy(f.u));return{b:empty.b,...f,module:f.controller.module};}
function center(f){f.point.place(5,7);until(f,()=>f.point.active(),2);f.module.refresh();return f.point.point.unit;}
function enemy(f,target){const e=f.b.spawnEnemy('enemy_1007_slime',{pos:[target.y,target.x]});e.base.atk=1000;e.base.moveSpeed=0;e.markDirty();f.b.addBuff(e,{key:'fixture:pin',flags:{noMove:true,disarm:true}});assert.equal(f.b._checkBlock(e),true);assert.equal(e.blockedBy,target);return e;}
const hit=(f,source,target,type='phys')=>f.b.dealDamage(source,target,{amount:1000,type,canDodge:false});
test('module source retains all seven graphs and exact table/native checksums without stage admission',()=>{
 assert.equal(Object.keys(native.prefabs).length,7);assert.equal(Object.values(native.prefabs).reduce((n,g)=>n+g.components.length,0),39);
 for(const g of Object.values(native.prefabs))for(const c of g.components)assert.equal(createHash('sha256').update(c.originalJson).digest('hex'),c.sha256);
 assert.equal(createHash('sha256').update(readFileSync(new URL('../'+native.source.tables.path,import.meta.url))).digest('hex'),native.source.tables.sha256);
 assert.equal(verifyClosurModuleSource().level,3);assert.equal(tables.modules.uniequip_002_closur.stage,'17-14');
});
test('only the exact predefined Closure build receives its module stats and roster upgrade',()=>{
 const unmod=selectedClosurBuild({...build,module:'none'}),mod=selectedClosurBuild(build);near(mod.stats.maxHp,unmod.stats.maxHp+180);near(mod.stats.atk,unmod.stats.atk+30);near(mod.stats.def,unmod.stats.def+25);
 assert.deepEqual(mod.talentBb[1],{cost:-5,atk:.08});assert.deepEqual(mod.talentBb[2],{damage_scale:.85});
 assert.deepEqual(selectedClosurToken(build).stats,selectedClosurToken({...build,module:'none'}).stats,'owner module stats must not transfer to the token');
 for(const change of [{stage:'17-16'},{moduleLevel:2},{elite:1},{level:89},{potential:2},{trust:0},{skillRank:9},{skillId:'skchr_closur_2'}])assert.throws(()=>selectedClosurBuild({...build,...change}),/Unreviewed|Locked|Invalid/);
 const f=fixture(),r=installClosurRoster(f.b,[build],{contract:CLOSUR_ROSTER_CONTRACT});assert.equal(r.floor,-5);assert.equal(r.atk,.08);near(f.u.s.atk,mod.stats.atk*1.08);assert.deepEqual(f.b.errors,[]);
});
test('the command center takes fifteen percent less post-defence damage from its actual blocker',()=>{
 const f=fixture(),t=center(f),e=enemy(f,t);f.module.refresh();assert.ok(f.module.marks.has(t));t.base.maxHp=100000;t.base.def=100;t.markDirty();t.hp=t.s.maxHp;
 near(hit(f,e,t),765);f.b._unblock(e);near(hit(f,e,t),900);assert.deepEqual(f.b.errors,[]);
});
test('an exact owner-marked ally receives the module while source-unrelated and sourceless hits do not',()=>{
 const f=fixture();center(f);const t=ally(f,{row:5,col:8,hp:100000});f.module.refresh();assert.ok(f.module.marks.has(t));const e=enemy(f,t),other=f.b.spawnEnemy('enemy_1007_slime',{pos:[8,8]});f.b.addBuff(other,{key:'pin',flags:{noMove:true,disarm:true}});
 near(hit(f,e,t,'arts'),850);near(hit(f,e,t,'true'),850);near(hit(f,other,t),1000);near(hit(f,null,t),1000);assert.deepEqual(f.b.errors,[]);
});
test('module recipient life reuse, lost markings and aura cleanup cannot transfer reduction',()=>{
 const f=fixture();center(f);const t=ally(f,{row:5,col:8,hp:100000}),e=enemy(f,t);f.module.refresh();near(hit(f,e,t),850);t.deploySeq++;near(hit(f,e,t),1000);
 f.module.refresh();near(hit(f,e,t),850);t.x=15;t.y=15;f.module.refresh();near(hit(f,e,t),1000);assert.equal(f.module.marks.has(t),false);
 f.controller.stop();assert.equal(f.b._takenMultipliers?.size??0,0);assert.equal(f.module.marks.size,0);assert.deepEqual(f.b.errors,[]);
});
test('a retired or reused attacker cannot borrow its old blocking relation for a born hit',()=>{
 const f=fixture(),t=center(f),e=enemy(f,t);t.base.maxHp=100000;t.base.def=0;t.markDirty();t.hp=t.s.maxHp;f.module.refresh();const old={id:e.id,deploySeq:e.deploySeq,side:e.side,kind:e.kind,s:e.s,stats:e.stats,alive:false,deployed:false};
 e.deploySeq++;near(f.b._takenMultipliers.values().next().value(old,t,{}),1);f.b.kill(e,null);near(f.b._takenMultipliers.values().next().value(e,t,{}),1);assert.deepEqual(f.b.errors,[]);
});
test('source retirement cleans owned module marks and the multiplier without changing foreign buffs',()=>{
 const f=fixture();center(f);const t=ally(f,{row:5,col:8,hp:100000});f.b.addBuff(t,{key:'foreign',mods:{atkFlat:11}});f.module.refresh();const own=f.module.marks.get(t).buff;f.b.retreat(f.u,{permanent:true});assert.ok(f.module.stopped);assert.ok(!t.buffs.includes(own));assert.equal(f.b._takenMultipliers?.size??0,0);assert.ok(t.findBuff('foreign'));assert.deepEqual(f.b.errors,[]);
});
test('module source mutations fail closed for the exact damage condition and native durability',()=>{
 for(const mutate of [t=>t.modules.uniequip_002_closur.phase.attributeBlackboard[0].value++,t=>t.modules.uniequip_002_closur.phase.parts[1].resKey='other']){const t=structuredClone(tables);mutate(t);assert.throws(()=>verifyClosurModuleSource(t,native),/Unreviewed/);}
 for(const field of ['_checkBlockedBySource','_filterDamageType','_isStackable']){const n=structuredClone(native),item=n.templates.closur_e_002_tr.eventToActions._items[0],nodes=JSON.parse(item.value.SerializedState),node=field==='_checkBlockedBySource'?nodes[0]:nodes[1];node[field]=!node[field];item.value.SerializedState=JSON.stringify(nodes);assert.throws(()=>verifyClosurModuleSource(tables,n),/Unreviewed/);}
 const n=structuredClone(native),row=n.prefabs.closur_equip_1_1_p1.components.find(r=>JSON.parse(r.originalJson)._removeBuffWhenTargetLeave!==undefined),component=JSON.parse(row.originalJson);component._buffs[0].isDurableBuff=1;row.originalJson=JSON.stringify(component);assert.throws(()=>verifyClosurModuleSource(tables,n),/Unreviewed/);
});
test('a reused owner deployment retires its old module instead of adopting the replacement life',()=>{
 const f=fixture(),t=center(f);f.module.refresh();const marker=f.module.marks.get(t).buff;f.u.deploySeq++;f.b.emit('deploy',{unit:f.u,initial:false});assert.ok(f.module.stopped);assert.ok(!t.buffs.includes(marker));assert.equal(f.b._takenMultipliers?.size??0,0);assert.deepEqual(f.b.errors,[]);
});
test('the internal predefined module does not enable public module selection or stage admission',()=>{
 assert.deepEqual(catalogueFor(data).char_4228_closur.modules,[]);assert.throws(()=>new StandardBattle(structuredClone(data),{operators:[build]}));
 const index=JSON.parse(readFileSync(new URL('../data/arkpedia-stages.json',import.meta.url)));assert.equal(index.stages.some(s=>s.code==='17-14'),false);
});
test('overlapping module owners use one nonstacking incoming scale and clean only their own marks',()=>{
 const f=fixture();center(f);const second=addOwner(f.b,build,{row:6,col:5,prepare:prepareClosurCombat,contract:CLOSUR_COMBAT_CONTRACT});assert.ok(f.b._deploy(second.u));second.point.place(6,7);until(f,()=>second.point.active(),2);
 const otherRange=second.point.range(),key=[...f.point.range()].find(k=>otherRange.has(k)&&!f.b.unitAt(Math.floor(k/21),k%21));assert.notEqual(key,undefined);
 const t=ally(f,{row:Math.floor(key/21),col:key%21,hp:100000});f.module.refresh();second.controller.module.refresh();assert.ok(f.module.marks.has(t));assert.ok(second.controller.module.marks.has(t));const e=enemy(f,t);
 near(hit(f,e,t),850);second.controller.stop();near(hit(f,e,t),850);f.module.stop();near(hit(f,e,t),1000);assert.deepEqual(f.b.errors,[]);
});
test('the exact module composes with the real S3 attack and DP controllers',()=>{
 const f=fixture();installClosurRoster(f.b,[build],{contract:CLOSUR_ROSTER_CONTRACT});center(f);until(f,()=>f.controller.phase?.kind!=='born',5);
 const t=ally(f,{row:5,col:8,hp:100000}),e=enemy(f,t);e.base.maxHp=1e7;e.markDirty();e.hp=e.s.maxHp;f.module.refresh();const hits=[];f.b.on('damaged',c=>{if(c.source===f.u)hits.push(c);});
 f.u.player.dp=0;f.u.skill.setSpTotal(f.u.skill.spCost);assert.equal(f.u.skill.activate(),true);until(f,()=>hits.length>0,8);until(f,()=>f.command.state.pulses>=1,8);
 assert.ok(f.u.skill.active);assert.ok(f.u.player.dp>0);assert.ok(hits[0].amount>0);assert.ok(f.u.extraRangeKeys.length>0);near(hit(f,e,t),850);assert.deepEqual(f.b.errors,[]);
});
test('rejected module marks and foreign reinforcement markers cannot grant a reduction',()=>{
 const f=fixture();center(f);const reject=f.b.on('beforeBuff',c=>{if(c.unit.kind==='op'&&c.buff.key.startsWith('closur_e_002[friend]:'))c.cancel=true;});
 const t=ally(f,{row:5,col:8,hp:100000}),e=enemy(f,t);f.module.refresh();assert.equal(f.module.marks.has(t),false);near(hit(f,e,t),1000);f.b.off(reject);f.module.refresh();near(hit(f,e,t),850);
 f.b.removeBuff(t,f.point.friendKey);const foreign=f.b.addBuff(t,{key:f.point.friendKey,source:{id:'foreign-owner'}});f.module.refresh();assert.equal(f.module.marks.has(t),false);near(hit(f,e,t),1000);assert.equal(t.findBuff(f.point.friendKey),foreign);
 f.b.removeBuff(t,foreign);f.module.refresh();near(hit(f,e,t),850);assert.deepEqual(f.b.errors,[]);
});
