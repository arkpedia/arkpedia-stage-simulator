// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import e from '../data/arkpedia-native-operators/char_4214_cairn.json' with {type:'json'};
import {CAIRN_ID as ID,CAIRN_SKILLS as SKILLS,selectedCairnBuild as select,cairnSourceComponent,cairnNativeInputs}
 from '../server/sim/content/arkpedia-cairn-source.js';
import {near} from './helpers/mon3tr-fixture.js';
const build=(elite=2,skill=0,rank=[4,7,10][elite],potential=1,trust=0)=>({elite,level:e.tables.character.phases[elite].maxLevel,
 skillId:SKILLS[skill],skillRank:rank,potential,trust,module:'none'});
test('Cairn original receipt is immutable and grants no combat, module or rendering approval',async()=>{
 const bytes=await readFile(new URL('../data/arkpedia-native-operators/char_4214_cairn.json',import.meta.url));
 assert.equal(bytes.length,245569);assert.equal(createHash('sha256').update(bytes).digest('hex'),'c3b66218299c5e18daea25e691e7777a3273329e96ae757f067434ba118e876a');
 assert.equal(e.source.commit,'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add');assert.equal(e.source.bundles.length,5);
 assert.deepEqual(e.enabledOperators,[]);assert.deepEqual(e.heldOperators,[ID]);
 for(const k of['frameParity','moduleSupport','nativeParticleSupport'])assert.equal(e[k],false);
 assert.deepEqual(e.nativeTemplateGaps,[]);assert.deepEqual(e.jsonTemplateGaps,[]);assert.deepEqual(e.projectiles,{});assert.equal(e.tokens,undefined);
 assert.equal(Object.keys(e.templates).length,8);assert.equal(e.tables.character.trait,null);assert.throws(()=>cairnSourceComponent('characters',ID,'missing'));
});
for(const elite of[0,1,2])for(const potential of[1,6])test(`Cairn E${elite}/P${potential} preserves stats, three blocks and blocked-enemy injury talent`,()=>{
 const r=select(build(elite,0,[4,7,10][elite],potential,200));
 near(r.stats.maxHp,[1880,2507,3483][elite]+150);near(r.stats.atk,[327,436,546][elite]+60+(potential===6?25:0));
 near(r.stats.def,[331,448,560][elite]);near(r.stats.cost,[21,23,25][elite]-(potential===6?2:0));
 near(r.stats.baseAttackTime,1.6);near(r.stats.blockCnt,3);near(r.stats.magicResistance,10);near(r.stats.respawnTime,potential===6?66:70);
 assert.deepEqual(r.rangeGrid,[[0,0]]);
 if(elite===0)assert.deepEqual(r.talentBb,[]);else near(r.talentBb[0].ep_damage_ratio,(elite===1?.04:.09)+(potential===6?.01:0));
});
for(let rank=1;rank<=10;rank++)test(`Cairn rank ${rank} keeps timed HP S1 and instant shield/DOT S2 separate`,()=>{
 const a=select(build(2,0,rank)),b=select(build(2,1,rank));
 for(const r of[a,b]){assert.equal(r.source.skillType,'MANUAL');assert.equal(r.source.spData.spType,'INCREASE_WITH_TIME');near(r.source.spData.maxChargeTime,1);}
 near(a.bb.max_hp,[.4,.5,.6,.7,.8,.9,1,1.1,1.2,1.3][rank-1]);near(a.source.duration,30);
 near(a.source.spData.spCost,[45,43,42,40,38,36,35,33,31,30][rank-1]);near(a.source.spData.initSp,[5,7,9,11,13,15,16,17,18,20][rank-1]);
 near(b.source.duration,-1);near(b.bb.buff_duration,10);near(b.bb.shield_hp_ratio,[.3,.4,.5,.6,.7,.8,.9,.9,.9,.9][rank-1]);near(b.bb.shield_max_hp_ratio,b.bb.shield_hp_ratio);
 near(b.bb.atk_scale,[.2,.3,.3,.4,.5,.5,.6,.6,.7,.8][rank-1]);near(b.bb.ep_damage_ratio,rank<4?.05:rank<7?.07:.1);
 near(b.source.spData.spCost,[30,29,28,27,26,25,24,23,23,22][rank-1]);near(b.source.spData.initSp,[5,5,5,7,7,9,10,12,13,14][rank-1]);assert.equal(b.skillRangeGrid.length,9);
});
test('Cairn source retains input-time melee targets and marker-time ground-only S2 application',()=>{
 const n=cairnNativeInputs();
 for(const a of[n.ordinary,n.s1Attack]){assert.equal(a._waitForAttackEvent,1);assert.equal(a._selectTargetTiming,0);assert.equal(a._animKey,'Attack');assert.equal(a._maxAnimScale,1);assert.equal(a._damageType,1);}
 for(const s of[n.ordinarySelector,n.s1Selector]){assert.equal(s._limitedMaxTargetNumToBlockedCnt,0);assert.equal(s._limitTargetNum,1);assert.equal(s._maxNum,1);assert.equal(s._targetMotion,1);}
 assert.equal(n.s2Attack._animKey,'Skill_2');assert.equal(n.s2Attack._selectTargetTiming,1);assert.equal(n.s2Attack._allowNoTarget,1);assert.equal(n.s2Selector._targetMotion,1);assert.equal(n.s2Selector._limitTargetNum,0);
 const d=n.s2Attack._activeBuffs[0];assert.equal(d.templateKey,'cairn_s_2[damage]');assert.equal(d.isDamageMissable,0);assert.equal(d.durationKey,'buff_duration');near(d.triggerInterval,1);near(d.firstTriggerInterval,1);
 // Preserve the raw lifetime/counter fields; their compiled dispatcher is not recovered by this receipt.
 near(d.lifeTime,4);near(d.triggerCnt,4);assert.equal(d.triggerLifeType,2);assert.equal(n.s2Shield._runActionOnEvent,4);
 for(const face of['Front','Back'])for(const clip of['Attack','Skill_1_Loop','Skill_2']){
  const a=e.models[ID][face].eventPayloads[clip];assert.equal(a.length,1);assert.equal(a[0].name,'OnAttack');near(a[0].time,.6);
 }
 assert.equal(n.s1._playSkillBeginAnim,1);assert.equal(n.s1._beginAnim,'Skill_1_Begin');assert.equal(n.s2._playSkillBeginAnim,0);
});
test('Cairn native templates distinguish current-ATK blocked injury from snapshotted lasting skill damage',()=>{
 const n=cairnNativeInputs(),t=n.templates;
 const check=t['cairn_t_1[check_target]'].eventToActions.ON_BUFF_START[0];assert.equal(check._conditionsNode[0]._abnormalFlag,'INVINCIBLE');
 const child=check._failNodes[0];assert.equal(child._isDerivedBuff,true);assert.equal(child._finishDerivedBuffIfParentFinish,true);near(child._buff.triggerInterval,1);
 assert.equal(t['cairn_t_1[damage]'].eventToActions.ON_BUFF_TRIGGER[0]._isFixedEpDamage,false);
 const dot=t['cairn_s_2[damage]'].eventToActions;assert.equal(dot.ON_BUFF_START[0]._attributeType,'ATK');assert.equal(dot.ON_BUFF_START[0]._blackboardKey,'atk');
 const arts=dot.ON_BUFF_TRIGGER[0];assert.equal(arts._getCachedAtkFromBlackboard,true);assert.equal(arts._cachedAtkKey,'atk');assert.equal(arts._damageType,'MAGICAL');
 const branch=dot.ON_BUFF_TRIGGER[2];assert.ok(branch._conditionsNode[0].$type.includes('CheckUnitAlive'));assert.equal(branch._succeedNodes[0]._noSource,false);assert.equal(branch._failNodes[0]._noSource,true);
 const shield=t['cairn_s_2[create_shield]'].eventToActions.ON_BUFF_START[0];assert.equal(shield._conditionsNode[0]._checkBuffSource,false);
 assert.equal(shield._succeedNodes[3]._addParamKey,'shield_add');assert.equal(shield._succeedNodes[3]._maxValueKey,'shield_max');
 for(const nodes of[shield._succeedNodes,shield._failNodes]){const a=nodes.find(x=>x.$type.includes('+CreateBuff,'));assert.equal(a._buff.overrideType,'EXTEND');assert.equal(a._buff.durationKey,'buff_duration');assert.equal(a._isDerivedBuff,false);}
});
test('Cairn locked and unsupported source builds fail before combat installation',()=>{
 for(const p of[{elite:3},{level:81},{potential:0},{trust:201},{skillRank:0},{skillRank:11},{skillId:'other'},{module:'mod-x'},
  {elite:0,level:50,skillRank:5},{elite:1,level:70,skillRank:8},{elite:0,level:50,skillRank:4,skillId:SKILLS[1]}])assert.throws(()=>select({...build(),...p}));
});
