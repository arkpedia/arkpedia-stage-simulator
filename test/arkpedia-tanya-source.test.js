// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import e from '../data/arkpedia-native-operators/char_4225_tanya.json' with {type:'json'};
import {TANYA_ID as ID,TANYA_SKILLS as SKILLS,selectedTanyaBuild as select,tanyaSourceComponent}
 from '../server/sim/content/arkpedia-tanya-source.js';
import {near} from './helpers/mon3tr-fixture.js';
const build=(elite=2,skill=0,rank=[4,7,10][elite],potential=1,trust=0)=>({elite,level:e.tables.character.phases[elite].maxLevel,
 skillId:SKILLS[skill],skillRank:rank,potential,trust,module:'none'});
test('Crackborne original source remains immutable and does not approve combat or rendering',async()=>{
 const bytes=await readFile(new URL('../data/arkpedia-native-operators/char_4225_tanya.json',import.meta.url));
 assert.equal(bytes.length,236082);assert.equal(createHash('sha256').update(bytes).digest('hex'),'03e393621ac50e478e6816846c0fbb9b3d0dc5409e4914d7ec483fc1858c967c');
 assert.equal(e.source.commit,'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add');assert.equal(e.source.bundles.length,5);
 assert.deepEqual(e.enabledOperators,[]);assert.deepEqual(e.heldOperators,[ID]);for(const key of['frameParity','moduleSupport','nativeParticleSupport'])assert.equal(e[key],false);
 assert.deepEqual(e.nativeTemplateGaps,[]);assert.deepEqual(e.jsonTemplateGaps,[]);assert.deepEqual(e.projectiles,{});assert.equal(e.tokens,undefined);assert.equal(Object.keys(e.templates).length,6);assert.equal(e.tables.character.trait,null);
 assert.throws(()=>tanyaSourceComponent('characters',ID,'missing'));
});
for(const elite of[0,1,2])for(const potential of[1,6])test(`Crackborne E${elite}/P${potential} selects original stats, trust and distinct elemental resistance operands`,()=>{
 const r=select(build(elite,0,[4,7,10][elite],potential,200));
 near(r.stats.maxHp,[1725,2300,3195][elite]);near(r.stats.atk,[360,481,602][elite]+30+(potential===6?25:0));near(r.stats.def,[324,439,549][elite]+50);
 near(r.stats.cost,[21,23,25][elite]-(potential===6?2:0));near(r.stats.baseAttackTime,1.6);near(r.stats.blockCnt,3);near(r.stats.magicResistance,10);near(r.stats.respawnTime,potential===6?66:70);
 assert.deepEqual(r.rangeGrid,[[0,0]]);if(elite===0)assert.deepEqual(r.talentBb,[]);else for(const key of['ep_damage_resistance[other]','ep_damage_resistance[water]'])near(r.talentBb[0][key],(elite===1?.05:.1)+(potential===6?.02:0));
});
for(let rank=1;rank<=10;rank++)test(`Crackborne rank ${rank} keeps timed HP/elemental recovery separate from instant DEF stacks`,()=>{
 const a=select(build(2,0,rank)),b=select(build(2,1,rank));for(const r of[a,b]){assert.equal(r.source.skillType,'MANUAL');assert.equal(r.source.spData.spType,'INCREASE_WITH_TIME');near(r.source.spData.maxChargeTime,1);}
 near(a.source.duration,20);near(a.bb.max_hp,[.4,.45,.5,.55,.6,.65,.7,.8,.9,1][rank-1]);near(a.bb.ep_heal,20+rank*10);
 near(a.source.spData.spCost,[40,39,38,37,36,35,34,33,32,30][rank-1]);near(a.source.spData.initSp,[5,5,5,7,7,7,10,13,14,15][rank-1]);
 near(b.source.duration,-1);near(b.bb.def,[.14,.15,.16,.17,.18,.19,.2,.2,.2,.2][rank-1]);near(b.bb.ep_damage_ratio,[.2,.2,.2,.2,.2,.2,.3,.31,.33,.35][rank-1]);near(b.bb.cnt,5);near(b.bb.max_stack_cnt,5);
 near(b.source.spData.spCost,[35,34,33,31,30,29,28,27,26,25][rank-1]);near(b.source.spData.initSp,[0,0,0,5,5,5,9,10,11,12][rank-1]);assert.equal(b.skillRangeGrid.length,9);
});
test('Crackborne source distinguishes the two ordinary clips, S1 mode attack and fixed-time S2',()=>{
 for(const[path,clip]of[['6791374229816730892','Attack_1'],['-1801412996564982516','Attack_2'],['7430027078427600140','Attack']]){
  const a=tanyaSourceComponent('characters',ID,path);assert.equal(a._animKey,clip);assert.equal(a._selectTargetTiming,0);assert.equal(a._waitForAttackEvent,1);assert.equal(a._timeMode,0);assert.equal(a._maxAnimScale,1);
 }
 const a=tanyaSourceComponent('skills',SKILLS[0],'-8578399732396500926');assert.equal(a._beginAnim,'Skill_1_Begin');assert.equal(a._allowSpRecoveryWhenAffecting,0);assert.equal(a._canCastDuringBorn,1);
 const b=tanyaSourceComponent('skills',SKILLS[1],'-312214920522589959');assert.equal(b._animKey,'Skill_2');assert.equal(b._timeMode,1);assert.equal(b._selectTargetTiming,0);
 for(const face of['Front','Back']){const m=e.models[ID][face];assert.equal(m.durations.Attack,undefined);
  for(const[clip,time]of[['Attack_1',.5666666626930237],['Attack_2',.5666666626930237],['Skill_1_Loop',.6333333253860474],['Skill_2',.6666666865348816]]){assert.equal(m.eventPayloads[clip].length,1);near(m.eventPayloads[clip][0].time,time);assert.equal(m.eventPayloads[clip][0].name,'OnAttack');}
 }
 assert.equal(e.chararts[ID][0].data._mixSettings.length,6);
});
test('Crackborne native templates retain additive WATER resistance and non-derived DEF stack operands',()=>{
 const r=e.templates.tanya_t.eventToActions.ON_APPLYING_MODIFIER[1];assert.equal(r._conditionNode._epType,'WATER');
 assert.equal(r._succeedNodes[0]._inputKey,'ep_damage_resistance[other]');assert.equal(r._succeedNodes[0]._addParamKey,'ep_damage_resistance[water]');
 for(const branch of[r._succeedNodes,r._failNodes])assert.equal(branch[1]._isOneMinus,true);
 const h=e.templates.tanya_s_1.eventToActions.ON_BUFF_TRIGGER[0];assert.ok(h.$type.includes('FixedValueElementHeal'));assert.equal(h._valueKey,'ep_heal');assert.equal(h._ignoreHealFree,false);
 const s=e.templates.tanya_s_2.eventToActions.ON_BUFF_START[0];assert.equal(s._stackCntKey,'max_stack_cnt');assert.equal(s._buff.overrideType,'STACK');assert.equal(s._isDerivedBuff,false);
 assert.equal(s._buff.attributes.attributeModifiers[0].attributeType,'DEF');assert.equal(s._buff.attributes.attributeModifiers[0].formulaItem,'MULTIPLIER');
});
test('Crackborne source selector refuses locked or unsupported inputs before any runtime exists',()=>{
 for(const p of[{elite:3},{level:81},{potential:0},{trust:201},{skillRank:0},{skillRank:11},{skillId:'other'},{module:'mod-x'},
  {elite:0,level:50,skillRank:5},{elite:1,level:70,skillRank:8},{elite:0,level:50,skillRank:4,skillId:SKILLS[1]}])assert.throws(()=>select({...build(),...p}));
});
