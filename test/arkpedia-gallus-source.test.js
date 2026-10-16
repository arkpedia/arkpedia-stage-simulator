// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-native-operators/char_4227_gallus.json' with {type:'json'};
import {GALLUS_ID as ID,selectedGallusBuild as select,gallusNativeInputs as inputs,gallusSourceComponent} from '../server/sim/content/arkpedia-gallus-source.js';
import {selectedCNSourceBuild,selectedCNPassiveSourceBuild} from '../server/sim/content/arkpedia-selected-cn-source.js';
import active from '../data/arkpedia-native-operators/char_4230_mcnist.json' with {type:'json'};
const build=(more={})=>({elite:0,level:30,skillId:null,skillRank:null,potential:1,trust:0,module:'none',...more});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
for(let potential=1;potential<=6;potential++)for(const trust of[0,100,200])test(`GALLUS² P${potential}/trust ${trust} selects literal skillless source stats and talent`,()=>{
 const r=select(build({potential,trust}));assert.equal(r.index,-1);assert.equal(r.source,null);assert.deepEqual(r.bb,{});assert.deepEqual(r.skillRangeGrid,[]);assert.equal(r.talents.length,1);
 assert.deepEqual([r.stats.maxHp,r.stats.atk,r.stats.def,r.stats.magicResistance,r.stats.cost,r.stats.respawnTime,r.stats.baseAttackTime],[525+(trust?100:0),261+(trust?35:0),52,10,3,200,1.6]);
 near(r.talentBb[0].duration,20);near(r.talentBb[0].buff_duration,10);near(r.talentBb[0].magic_resistance,-.15-.02*(potential-1));assert.deepEqual(r.rangeGrid,e.tables.ranges['3-6'].grids.map(g=>[g.row,g.col]));
});
for(const level of[1,7,15,29])test(`GALLUS² level ${level} interpolates its own source phase and rounds only final HP/ATK/DEF`,()=>{
 const r=select(build({level,trust:40})),[lo,hi]=e.tables.character.phases[0].attributesKeyFrames,ratio=(level-1)/29;
 for(const key of['maxHp','atk','def'])near(r.stats[key],Math.round(lo.data[key]+(hi.data[key]-lo.data[key])*ratio+e.tables.character.favorKeyFrames.at(-1).data[key]*.4));
});
test('GALLUS² retains original source closure, both literal facing clocks and no invented skills',()=>{
 assert.equal(e.source.commit,'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add');assert.equal(e.source.bundles.length,5);assert.deepEqual(e.enabledOperators,[]);assert.deepEqual(e.heldOperators,[ID]);assert.deepEqual(e.tables.character.skills,[]);assert.deepEqual(e.tables.skills,{});assert.deepEqual(e.skills,{});assert.deepEqual(e.nativeTemplateGaps,[]);assert.deepEqual(e.jsonTemplateGaps,[]);assert.deepEqual(Object.keys(e.templates),['empty','gallus_t_1','gallus_t_1[mark]']);
 for(const face of['Front','Back']){const m=e.models[ID][face];near(m.durations.Attack,1.6);near(m.durations.Start,1);near(m.hits.Attack[0],.6);assert.equal(m.sha256,e.officialSkeletonBindings[ID][face].sha256);}
 assert.equal(e.models[ID].Back.durations.Die,undefined);assert.equal(e.frameParity,false);assert.equal(e.moduleSupport,false);
});
test('GALLUS² keeps both native modes and mark-avoiding selector separate',()=>{
 const n=inputs();assert.equal(n.root._modes.length,2);assert.equal(n.normalMode._attack.m_PathID,'-145074444227699120');assert.equal(n.markedMode._attack.m_PathID,'6850085078635388496');
 for(const a of[n.ordinary,n.preferred]){assert.equal(a._waitForAttackEvent,1);assert.equal(a._animKey,'Attack');assert.equal(a._projectileKey,'projectile_chr_gallus');assert.equal(a._damageType,2);assert.equal(a._affectedBySlowDown,1);near(a._maxAnimScale,1.2999999523162842);}
 assert.equal(n.preferredSelector._buffKey,'gallus_t_1[buff]');assert.equal(n.preferredSelector._withoutThisBuff,1);assert.equal(n.preferredSelector._targetMotion,3);assert.equal(n.talent._influenceSkillBlackboard,0);
});
test('GALLUS² RES reduction checks the source deployment mark, persists independently and restores the ordinary mode when its mark ends',()=>{
 const n=inputs(),branch=n.templates.gallus_t_1.eventToActions.ON_BUFF_START[0];assert.equal(branch._conditionNode._targetType,'BUFF_SOURCE');assert.deepEqual(branch._conditionNode._buffKeys,['gallus_t_1[mark]']);
 const buff=branch._succeedNodes[0]._buff;assert.equal(buff.buffKey,'gallus_t_1[buff]');assert.equal(buff.independentCharacterSource,true);assert.equal(buff.durationKey,'buff_duration');assert.equal(buff.attributes.attributeModifiers[0].attributeType,'MAGIC_RESISTANCE');assert.equal(buff.attributes.attributeModifiers[0].formulaItem,'FINAL_SCALER');
 assert.equal(n.mark._buffs[0].durationKey,'duration');assert.equal(n.mark._buffs[0].isSilenceable,0);const end=n.templates['gallus_t_1[mark]'].eventToActions.ON_BUFF_FINISH[0];assert.equal(end._modeIndex,1);assert.equal(end._restartFSM,false);
});
test('GALLUS² keeps original speed-ten finite homing projectile inputs',()=>{
 const rows=e.projectiles.projectile_chr_gallus.flatMap(r=>r.components.map(c=>c.data)),move=rows.find(c=>'_speed'in c),root=rows.find(c=>'_lifeTime'in c);near(move._speed,10);near(move._delayToStart,0);near(root._lifeTime,10);assert.equal(root._maxHitNum,1);assert.equal(root._stopWhenSourceInvalid,0);assert.equal(root._alwaysHitTraceTargetInTheEnd,1);
});
test('Passive source selection rejects invented active skills, missing/promoted builds and modules',()=>{
 for(const more of[{elite:1},{level:31},{level:0},{potential:7},{trust:201},{skillRank:2},{skillId:'invented'},{module:'gallus-x'}])assert.throws(()=>select(build(more)));
 assert.throws(()=>select(null));assert.throws(()=>selectedCNSourceBuild(e,ID,build()));assert.throws(()=>selectedCNPassiveSourceBuild(active,active.operatorId,build()));assert.throws(()=>gallusSourceComponent('characters',ID,'0'));
 const changed=structuredClone(e);changed.skills.invented=[];assert.throws(()=>selectedCNPassiveSourceBuild(changed,ID,build()));
});
