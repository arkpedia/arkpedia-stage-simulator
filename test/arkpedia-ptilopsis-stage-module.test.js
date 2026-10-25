// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../data/arkpedia-mvp.json' with {type:'json'};
import tables from '../data/candidates/arkpedia-stage-predefined-module-tables.json' with {type:'json'};
import native from '../data/candidates/arkpedia-stage-predefined-module-native.json' with {type:'json'};
import {StandardBattle} from '../server/sim/arkpedia.js';
import {normalizeChess} from '../server/sim/simdata.js';
import {genericKit} from '../server/sim/content/generic.js';
import {defaultBuild,catalogueFor} from '../shared/arkpedia/loadout.js';
import {chessRec} from './helpers/battleHarness.js';
import {customizeFiveStarMedicKit,installFiveStarMedic,registerNamedSpRecovery} from '../server/sim/content/arkpedia-five-star-medic.js';
import {ptilopsisStageBuild,ptilopsisStageRecord,verifyPtilopsisStageModule} from '../server/sim/content/arkpedia-ptilopsis-stage-module.js';
const ID='char_128_plosis',build=ptilopsisStageBuild(),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function advance(b,t){for(let i=0;i<Math.ceil(t/b.dt-1e-8);i++)b.step();assert.deepEqual(b.errors,[]);}
function fixture({deploy=true}={}){
 const d=structuredClone(data);d.stage.geometry.waves[0].spawns=[];d.stage.battle.dp_per_second=0;
 d.stage.geometry.rows=19;d.stage.geometry.cols=21;d.stage.geometry.tileGrid=Array.from({length:19},()=>Array(21).fill(2));
 const b=new StandardBattle(d,{operators:[defaultBuild(d.operators.char_122_beagle)]});b.autoFinish=false;b.setViewport('fullscreen-workspace');
 b.grid.tiles=b.grid.tiles.map(t=>({...t,height:'LOW',build:'ALL',pass:'ALL'}));
 const raw=ptilopsisStageRecord(build,d),def=normalizeChess(raw),u=b._makeAlly(b.getPlayer('arkpedia'),def,'op',5,5,{dir:'RIGHT'}),kit=genericKit(def.skill.bb,def.raw,def);
 customizeFiveStarMedicKit({battle:b,id:ID,def,unit:u,kit});b._setupUnit(u,kit);installFiveStarMedic({battle:b,unit:u,def});if(deploy)assert.ok(b._deploy(u));u.atkCd=1000;
 let serial=0;
 const ally=(row,col,{kind='op',spType='INCREASE_WITH_TIME'}={})=>{
  const record=chessRec({id:`fixture:${++serial}`,stats:{maxHp:1e5,atk:0,def:0},skill:{spCost:100,initSp:0,spType}}),a=b._makeAlly(u.player,normalizeChess(record),kind,row,col,{dir:'RIGHT'});
  b._setupUnit(a,{talents:[],trait:{noAttack:true},skill:{kind:'duration',duration:10}});assert.ok(b._deploy(a));return a;
 };
 return{b,u,raw,ally,controller:u.mem.ptilopsisStageModule};
}

test('the exact hidden 17-16 build gains its module stats/range while public module selection remains closed',()=>{
 const r=ptilopsisStageRecord(build,data);assert.equal(r.stats.maxHp,1710);assert.equal(r.stats.atk,437);assert.equal(r.stats.def,150);assert.equal(r.rangeGrid.length,13);assert.ok(r.rangeGrid.some(([r,c])=>r===0&&c===3));
 assert.deepEqual(r.talents.map(t=>t.bb),[{sp_recovery_per_sec:.35},{sp_recovery_per_sec:.3}]);assert.deepEqual(catalogueFor(data)[ID].modules,[]);
 assert.throws(()=>new StandardBattle(structuredClone(data),{operators:[build]}));
 for(const changed of [{level:79},{skillRank:10},{potential:2},{trust:200},{moduleLevel:2},{stage:'17-14'},{skillId:'skcom_heal_up[3]'}])assert.throws(()=>ptilopsisStageRecord({...build,...changed},data),/Unreviewed/);
});

test('the module uses strongest per-recipient recovery and heals on its new default-range tile',()=>{
 const f=fixture(),inside=f.ally(5,8),outside=f.ally(8,9),token=f.ally(5,7,{kind:'token'});advance(f.b,.1);
 near(f.u.s.spRecovery,1.35);near(inside.s.spRecovery,1.35);near(outside.s.spRecovery,1.3);near(token.s.spRecovery,1);
 inside.hp=100;f.b.forceAttack(f.u,[inside]);f.u.atkCd=1000;advance(f.b,1.5);near(inside.hp,537);assert.deepEqual(f.b.errors,[]);
});

test('local recovery follows the current main S2 grid without using distance extensions or inherited extra coverage',()=>{
 const f=fixture(),edge=f.ally(6,8),far=f.ally(5,9);advance(f.b,.1);near(edge.s.spRecovery,1.3);near(far.s.spRecovery,1.3);
 f.b.addBuff(f.u,{key:'fixture:distance',mods:{rangeExtend:5}});f.b.setExtraRange(f.u,[5*21+9]);advance(f.b,.1);near(edge.s.spRecovery,1.3);near(far.s.spRecovery,1.3);
 f.u.skill.setSpTotal(f.u.skill.spCost);assert.ok(f.u.skill.activate('manual'));advance(f.b,.1);near(edge.s.spRecovery,1.35);near(far.s.spRecovery,1.3);
 near(f.u.s.bat,.95);assert.equal(f.u.skill.gainSp(20,'fixture'),0);near(f.u.skill.spTotal,0);f.u.skill.end('fixture');advance(f.b,.1);near(edge.s.spRecovery,1.3);
});

test('named effects take the maximum, personal recovery adds separately and retirement restores the surviving producer',()=>{
 const f=fixture(),a=f.ally(5,7),other=f.ally(9,9);const sync=registerNamedSpRecovery(f.b,other,.4);sync();near(a.s.spRecovery,1.4);
 f.b.addBuff(a,{key:'fixture:personal',mods:{spRecoveryFlat:.15}});near(a.s.spRecovery,1.55);f.b.kill(other,null);advance(f.b,.1);near(a.s.spRecovery,1.5);
 f.b.retreat(f.u,{permanent:true});near(a.s.spRecovery,1.15);assert.ok(f.controller.stopped);assert.ok(a.findBuff('fixture:personal'));assert.deepEqual(f.b.errors,[]);
});

test('nonhealable operators remain eligible while isolated/hidden recipients and tokens are excluded',()=>{
 const f=fixture(),a=f.ally(5,7);f.b.addBuff(a,{key:'fixture:unhealable',flags:{healFree:true,noHeal:true}});advance(f.b,.1);near(a.s.spRecovery,1.35);
 const iso=f.b.addBuff(a,{key:'fixture:isolated',flags:{isolated:true}});advance(f.b,.1);near(a.s.spRecovery,1);f.b.removeBuff(a,iso);advance(f.b,.1);near(a.s.spRecovery,1.35);
 a.hidden=true;advance(f.b,.1);near(a.s.spRecovery,1);a.hidden=false;advance(f.b,.1);near(a.s.spRecovery,1.35);
});

test('the global effect persists through owner disappearance while the local effect turns off',()=>{
 const f=fixture(),a=f.ally(5,7);advance(f.b,.1);near(a.s.spRecovery,1.35);f.u.hidden=true;advance(f.b,.1);near(a.s.spRecovery,1.3);
 f.u.hidden=false;advance(f.b,.1);near(a.s.spRecovery,1.35);f.b.emit('battleEnd',{});near(a.s.spRecovery,1);assert.ok(f.controller.stopped);
});

test('an old source lifetime cannot grant recovery after body reuse or remove a newer same-ID producer',()=>{
 const f=fixture(),a=f.ally(5,7);advance(f.b,.1);f.u.deploySeq++;advance(f.b,.1);near(a.s.spRecovery,1);assert.ok(f.controller.stopped);
 const fresh=registerNamedSpRecovery(f.b,f.u,.5);fresh();f.controller.stop();near(a.s.spRecovery,1.5);fresh.stop();near(a.s.spRecovery,1);
});

test('stopping an overwritten producer preserves the newer entry under that exact key',()=>{
 const f=fixture(),a=f.ally(5,7),other=f.ally(9,9);
 const old=registerNamedSpRecovery(f.b,other,.4),fresh=registerNamedSpRecovery(f.b,other,.5);fresh();near(a.s.spRecovery,1.5);
 old.stop();near(a.s.spRecovery,1.5);fresh.stop();near(a.s.spRecovery,1.35);
});

test('retirement during aura admission cannot leave a late buff from the dead source',()=>{
 const f=fixture({deploy:false}),a=f.ally(5,7);f.b.on('beforeBuff',c=>{if(c.unit===a&&c.buff.key==='source:spRecover'&&c.buff.source===f.u)f.b.kill(f.u,null);});
 assert.ok(f.b._deploy(f.u));assert.equal(f.u.alive,false);near(a.s.spRecovery,1);advance(f.b,.1);near(a.s.spRecovery,1);assert.equal(a.findBuff('source:spRecover'),null);
});

test('rejecting the independent local offer preserves the global recovery effect',()=>{
 const f=fixture({deploy:false}),a=f.ally(5,7);let rejects=0;
 f.b.on('beforeBuff',c=>{if(c.unit===a&&c.buff.key==='source:spRecover'&&c.buff.mods.spRecoveryFlat===.35){c.cancel=true;rejects++;}});
 assert.ok(f.b._deploy(f.u));advance(f.b,.1);near(a.s.spRecovery,1.3);assert.ok(rejects>0);assert.equal(a.findBuff('source:spRecover').source,f.u);
});

test('retirement during admission restores a different surviving producer immediately',()=>{
 const f=fixture({deploy:false}),a=f.ally(5,7),other=f.ally(9,9),sync=registerNamedSpRecovery(f.b,other,.2);sync();near(a.s.spRecovery,1.2);
 f.b.on('beforeBuff',c=>{if(c.unit===a&&c.buff.key==='source:spRecover'&&c.buff.source===f.u)f.b.kill(f.u,null);});
 assert.ok(f.b._deploy(f.u));assert.equal(f.u.alive,false);near(a.s.spRecovery,1.2);assert.equal(a.findBuff('source:spRecover').source,other);
 advance(f.b,.1);near(a.s.spRecovery,1.2);
});

test('target replacement during admission cannot receive an offer from its previous life',()=>{
 const f=fixture({deploy:false}),a=f.ally(5,7);let replaced=false;
 f.b.on('beforeBuff',c=>{if(!replaced&&c.unit===a&&c.buff.key==='source:spRecover'){replaced=true;a.deploySeq++;}});
 assert.ok(f.b._deploy(f.u));assert.ok(replaced);
 // Other independent producers may offer again to the new life, but no old
 // receipt is allowed to survive the original admission.
 const buff=a.findBuff('source:spRecover');if(buff)assert.equal(buff.data.namedSpRecovery.targetLife,a.deploySeq);
 advance(f.b,.1);near(a.s.spRecovery,1.35);assert.equal(a.findBuff('source:spRecover').data.namedSpRecovery.targetLife,a.deploySeq);
});

test('only automatic SP recovery accrues time SP even though the native attribute aura can be present',()=>{
 const f=fixture(),auto=f.ally(5,7),attack=f.ally(6,7,{spType:'INCREASE_WHEN_ATTACK'});auto.skill.setSpTotal(0);attack.skill.setSpTotal(0);advance(f.b,1);
 near(auto.skill.spTotal,1.35);near(attack.skill.spTotal,0);
});

test('range, module phase and native local/global source mutations fail closed',()=>{
 for(const change of [t=>t.modules.uniequip_002_plosis.phase.attributeBlackboard[1].value++,t=>t.ranges['y-3'].grids.pop(),
  t=>t.modules.uniequip_002_plosis.phase.parts[1].addOrOverrideTalentDataBundle.candidates[0].blackboard[0].value=.4]){
  const t=structuredClone(tables);change(t);assert.throws(()=>verifyPtilopsisStageModule(t,native),/Unreviewed/);
 }
 for(const field of ['_removeBuffWhenTargetLeave','_extendable']){const n=structuredClone(native),rows=n.prefabs.plosis_equip_1_3_p2.components,row=rows.find(c=>Object.hasOwn(JSON.parse(c.originalJson),field)),d=JSON.parse(row.originalJson);d[field]=1-d[field];row.originalJson=JSON.stringify(d);assert.throws(()=>verifyPtilopsisStageModule(tables,n),/Unreviewed/);}
});
