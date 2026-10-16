// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import e from '../data/arkpedia-native-operators/char_4234_pedro.json' with {type:'json'};
import {PEDRO_ID as ID,PEDRO_SKILLS as SKILLS,selectedPedroBuild as select,pedroSourceComponent as component,pedroNativeInputs as inputs}
 from '../server/sim/content/arkpedia-pedro-source.js';
import {near} from './helpers/mon3tr-fixture.js';
const build=(elite=2,skill=0,rank=[4,7,10][elite],potential=1,trust=0)=>({elite,level:e.tables.character.phases[elite].maxLevel,
 skillId:SKILLS[skill],skillRank:rank,potential,trust,module:'none'});
test('Pedro retains exact held source, both literal skills, six templates and two original projectile graphs',async()=>{
 const bytes=await readFile(new URL('../data/arkpedia-native-operators/char_4234_pedro.json',import.meta.url));
 assert.equal(bytes.length,264076);assert.equal(createHash('sha256').update(bytes).digest('hex'),'7439d18a99868fb6aeb5a664588e1d4745c5a7b7bd116817980e1befd373528c');
 assert.equal(e.source.commit,'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add');assert.equal(e.source.bundles.length,5);
 assert.deepEqual(e.enabledOperators,[]);assert.deepEqual(e.heldOperators,[ID]);for(const k of['frameParity','moduleSupport','nativeParticleSupport'])assert.equal(e[k],false);
 assert.deepEqual(e.nativeTemplateGaps,[]);assert.deepEqual(e.jsonTemplateGaps,[]);assert.equal(e.tokens,undefined);assert.equal(Object.keys(e.templates).length,6);
 assert.deepEqual(Object.keys(e.projectiles).sort(),['projectile_chr_pedro','projectile_chr_pedro_s1']);assert.deepEqual(e.ownerModeSkills,[]);
 for(const s of SKILLS)assert.deepEqual(e.skillBindings[s],[s]);assert.throws(()=>component('characters',ID,'missing'));
});
for(const elite of[0,1,2])for(const potential of[1,6])test(`Pedro E${elite}/P${potential} selects raw stats, trust and conditional talent independently`,()=>{
 const r=select(build(elite,0,[4,7,10][elite],potential,200));
 near(r.stats.maxHp,[911,1232,1580][elite]+225);near(r.stats.atk,[494,634,765][elite]+45+(potential===6?30:0));near(r.stats.def,[140,184,210][elite]);
 near(r.stats.cost,[14,16,16][elite]-(potential===6?2:0));near(r.stats.baseAttackTime,2.1);near(r.stats.blockCnt,1);near(r.stats.magicResistance,10);near(r.stats.respawnTime,potential===6?66:70);
 assert.equal(r.rangeGrid.length,elite===0?10:14);assert.deepEqual(r.skillRangeGrid,[]);
 if(elite===0)assert.deepEqual(r.talentBb,[]);else{near(r.talentBb[0].atk,(elite===1?.05:.1)+(potential===6?.02:0));near(r.talentBb[0].cnt,2);}
});
for(let rank=1;rank<=10;rank++)test(`Pedro rank ${rank} separates offensive-auto S1 marks from manual two-charge S2 protection`,()=>{
 const a=select(build(2,0,rank)),b=select(build(2,1,rank));for(const r of[a,b])near(r.source.duration,-1);
 assert.equal(a.source.skillType,'AUTO');assert.equal(a.source.spData.spType,'INCREASE_WHEN_ATTACK');near(a.source.spData.maxChargeTime,1);
 near(a.source.spData.spCost,[8,8,8,7,7,7,6,5,5,4][rank-1]);near(a.source.spData.initSp,0);near(a.bb.max_target,2);
 near(a.bb.atk_scale,[1.05,1.05,1.1,1.1,1.15,1.15,1.2,1.25,1.25,1.35][rank-1]);near(a.bb.debuff_atk_scale,[1.35,1.4,1.45,1.5,1.6,1.7,1.8,1.9,2.05,2.2][rank-1]);
 assert.equal(b.source.skillType,'MANUAL');assert.equal(b.source.spData.spType,'INCREASE_WITH_TIME');near(b.source.spData.maxChargeTime,2);
 near(b.source.spData.spCost,[34,33,32,31,30,29,28,26,24,22][rank-1]);near(b.source.spData.initSp,[15,15,15,16,16,16,17,18,18,19][rank-1]);
 near(b.bb.atk_scale,1.1+.1*rank);near(b.bb.duration,8);near(b.bb.taunt_level,-1);near(b.bb.max_target,3);near(b.bb.hp_ratio,.5);
});
test('Pedro literal attack and heal abilities retain separate time modes, downward tracks and recipient selectors',()=>{
 const n=inputs();for(const[a,clip,down]of[[n.ordinary,'Attack','Attack_Down'],[n.s1Attack,'Skill_1','Skill_Down_1'],[n.s2Heal,'Skill_2','Skill_Down_2']]){
  assert.equal(a._animKey,clip);assert.equal(a._downAnimKey,down);assert.equal(a._maxAnimScale,1);assert.equal(a._waitForAttackEvent,1);assert.equal(a._affectedBySlowDown,1);
 }
 assert.equal(n.ordinary._timeMode,0);assert.equal(n.s1Attack._timeMode,0);assert.equal(n.s2Heal._timeMode,1);assert.equal(n.s2Heal._hasNoActionNode,1);
 assert.equal(n.ordinary._projectileKey,'projectile_chr_pedro');assert.equal(n.s1Attack._projectileKey,'projectile_chr_pedro_s1');
 assert.equal(n.s1Selector._buffKey,'pedro_s1_debuff');assert.equal(n.s2Selector._buffKey,'pedro_s2_buff');
 assert.equal(n.s1Selector._withoutThisBuff,1);assert.equal(n.s2Selector._withoutThisBuff,1);assert.equal(n.s1Selector._targetSide,2);assert.equal(n.s2Selector._targetSide,1);
 for(const s of[n.s1,n.s2]){assert.equal(s._playSkillBeginAnim,0);assert.equal(s._allowSpRecoveryWhenAffecting,0);}
 assert.equal(n.s1._recoverSpIfTargetDead,1);assert.equal(n.s2._canCastDuringBorn,1);
});
test('Pedro released ordinary/S1 shots retain speed fifteen, trace-target final hit and no source-invalid stop',()=>{
 for(const key of Object.keys(e.projectiles)){
  const rows=e.projectiles[key].flatMap(r=>r.components.map(c=>c.data)),root=rows.find(a=>'_stopWhenSourceInvalid'in a),travel=rows.find(a=>'_speed'in a);
  assert.equal(root._stopWhenSourceInvalid,0);assert.equal(root._alwaysHitTraceTargetInTheEnd,1);near(travel._speed,15);
 }
});
test('Pedro S1 consumes an Arts trigger mark before cached extra damage and excludes recursive marked damage',()=>{
 const n=inputs(),mark=n.s1Attack._activeBuffs[0];assert.equal(mark.templateKey,'pedro_s1_debuff');assert.equal(mark.takeSnapshotWhenExtend,1);
 const a=n.templates.pedro_s1_debuff.eventToActions.ON_TAKE_DAMAGE;
 assert.equal(a[0]._damageMask,'MAGICAL');assert.equal(a[1]._customKey,'pedro_s1_debuff_damage');assert.ok(a[2].$type.includes('IfNot'));assert.ok(a[3].$type.includes('FinishBuff'));
 assert.equal(a[4]._atkScaleVar,'debuff_atk_scale');assert.equal(a[4]._modifierKey,'pedro_s1_debuff_damage');assert.equal(a[4]._damageType,'MAGICAL');
 assert.equal(a[4]._forceUseProjectileCachedAtk,true);assert.equal(a[4]._getCachedAtkFromBlackboard,true);assert.equal(a[4]._cachedAtkKey,'cached_atk');assert.equal(a[4]._noSource,true);
});
test('Pedro S2 compares accepted heal snapshots, holds a one-use infinite mark and polls the inclusive half-HP threshold',()=>{
 const n=inputs(),a=n.templates.pedro_s2.eventToActions.ON_BUFF_START[0],start=n.templates.pedro_s2_buff.eventToActions.ON_BUFF_START;
 assert.equal(a._conditionsNode[0]._buffKeys[0],'pedro_s2_buff');assert.equal(a._succeedNodes[1]._attributeType,'ATK');assert.equal(a._succeedNodes[1]._scaleVar,'atk_scale');
 assert.equal(a._succeedNodes[3]._condType,'GE');assert.ok(a._succeedNodes[4].$type.includes('FinishBuffsById'));
 for(const x of[a._succeedNodes[5],a._failNodes[0]]){assert.equal(x._buff.lifeTimeType,'INFINITY');near(x._buff.triggerInterval,.20000000298023224);assert.equal(x._buff.independentCharacterSource,false);}
 assert.equal(start[0]._attributeType,'ATK');assert.equal(start[0]._blackboardKey,'dynamic');
 const t=n.templates.pedro_s2_buff.eventToActions.ON_BUFF_TRIGGER;assert.equal(t[0]._condType,'LE');near(t[0]._value,.5);assert.ok(t[1].$type.includes('FinishBuff'));assert.equal(t[2]._useDynamicVar,true);
 assert.equal(t[4]._buff.buffKey,'pedro_s2_buff[taunt]');assert.equal(t[4]._buff.lifeTimeType,'LIMITED');assert.equal(t[4]._buff.durationKey,'duration');assert.equal(t[4]._buff.attributes.attributeModifiers[0].attributeType,'TAUNT_LEVEL');
});
test('Pedro talent counts source-independent nearby ally marks and removes its derived ATK when the count falls',()=>{
 const n=inputs();assert.equal(n.talentAura._selfOption,2);assert.equal(n.talentAura._removeBuffWhenTargetLeave,1);assert.equal(n.talentAura._removeBuffWhenAbilityDetached,1);assert.equal(n.talentAura._buffs[0].independentCharacterSource,1);
 const events=n.templates['pedro_t_1[mark]'].eventToActions;assert.equal(events.ON_BUFF_START[0]._buff.overrideType,'STACK');assert.equal(events.ON_BUFF_START[0]._buff.maxStackCnt,-1);assert.equal(events.ON_BUFF_START[0]._buff.triggerInterval,.20000000298023224);
 assert.equal(events.ON_BUFF_FINISH[0]._decCntIfStack,true);assert.equal(events.ON_BUFF_FINISH[0]._decCnt,1);
 const t=n.templates.pedro_t_1.eventToActions;assert.equal(t.ON_BUFF_TRIGGER[0]._conditionsNode[0]._stackCountKey,'cnt');assert.equal(t.ON_BUFF_TRIGGER[0]._conditionsNode[0]._condType,'GE');
 assert.equal(t.ON_BUFF_TRIGGER[0]._succeedNodes[2]._isDerivedBuff,true);assert.equal(t.ON_BUFF_TRIGGER[0]._succeedNodes[2]._finishDerivedBuffIfParentFinish,true);assert.ok(t.ON_BUFF_FINISH[0].$type.includes('FinishDerivedBuff'));
});
test('Pedro original markers distinguish ordinary attack, S1 and S2 without fabricated Back downward/death clips or mixes',()=>{
 assert.deepEqual(inputs().mixes,[]);
 for(const face of['Front','Back']){const m=e.models[ID][face];for(const[clip,time]of[['Attack',.6000000238418579],['Skill_1',.5333333611488342],['Skill_2',.7333333492279053]])near(m.eventPayloads[clip][0].time,time);}
 assert.equal(e.models[ID].Back.durations.Attack_Down,undefined);assert.equal(e.models[ID].Back.durations.Die,undefined);
});
test('Pedro source refuses locked skill/promotion/rank, invalid builds and unreviewed modules',()=>{
 for(const p of[{elite:3},{level:81},{potential:0},{trust:201},{skillRank:0},{skillRank:11},{skillId:'other'},{module:'mod-x'},
  {elite:0,level:50,skillRank:5},{elite:1,level:70,skillRank:8},{elite:0,level:50,skillRank:4,skillId:SKILLS[1]}])assert.throws(()=>select({...build(),...p}));
});
