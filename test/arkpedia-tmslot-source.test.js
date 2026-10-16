// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import e from '../data/arkpedia-native-operators/char_4236_tmslot.json' with {type:'json'};
import {TMSLOT_ID as ID,TMSLOT_SKILLS as SKILLS,selectedTimeslotBuild as select,timeslotSourceComponent as component,timeslotNativeInputs as inputs}
 from '../server/sim/content/arkpedia-tmslot-source.js';
import {near} from './helpers/mon3tr-fixture.js';
const build=(elite=2,skill=0,rank=[4,7,10][elite],potential=1,trust=0)=>({elite,level:e.tables.character.phases[elite].maxLevel,
 skillId:SKILLS[skill],skillRank:rank,potential,trust,module:'none'});
test('Timeslot source retains exact original owner, common S1, seven templates and five projectile graphs without approval',async()=>{
 const bytes=await readFile(new URL('../data/arkpedia-native-operators/char_4236_tmslot.json',import.meta.url));
 assert.equal(bytes.length,341653);assert.equal(createHash('sha256').update(bytes).digest('hex'),'8faaa4d95957d4db73907351051b8d8b5ffacf4edf22f63ee695e052afb7a7c2');
 assert.equal(e.source.commit,'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add');assert.equal(e.source.bundles.length,5);
 assert.deepEqual(e.enabledOperators,[]);assert.deepEqual(e.heldOperators,[ID]);for(const k of['frameParity','moduleSupport','nativeParticleSupport'])assert.equal(e[k],false);
 assert.deepEqual(e.nativeTemplateGaps,[]);assert.deepEqual(e.jsonTemplateGaps,[]);assert.equal(e.tokens,undefined);assert.equal(Object.keys(e.templates).length,7);
 assert.deepEqual(Object.keys(e.projectiles).sort(),['projectile_chr_tmslot','projectile_chr_tmslot_funnel','projectile_chr_tmslot_funnel_s2_1','projectile_chr_tmslot_funnel_s2_2','projectile_chr_tmslot_s2']);
 assert.deepEqual(e.skillBindings[SKILLS[0]],['skcom_atk_up']);assert.deepEqual(e.skillBindings[SKILLS[1]],['skchr_tmslot_2']);assert.throws(()=>component('characters',ID,'missing'));
});
for(const elite of[0,1,2])for(const potential of[1,6])test(`Timeslot E${elite}/P${potential} selects raw stats, trust, funnel operands and talent independently`,()=>{
 const r=select(build(elite,0,[4,7,10][elite],potential,200));
 near(r.stats.maxHp,[848,1102,1450][elite]+75);near(r.stats.atk,[222,285,340][elite]+45);near(r.stats.def,[76,105,125][elite]);
 near(r.stats.cost,[21,23,23][elite]-(potential===6?3:0));near(r.stats.baseAttackTime,1.3);near(r.stats.blockCnt,1);near(r.stats.magicResistance,[10,15,20][elite]);near(r.stats.respawnTime,potential===6?70:80);
 assert.equal(r.rangeGrid.length,elite===0?9:10);assert.deepEqual(r.traitBb,{init_atk_scale:.2,delta_atk_scale:.15,max_atk_scale:1.1,max_stack_cnt:6});
 if(elite===0)assert.deepEqual(r.talentBb,[]);else{near(r.talentBb[0].atk,(elite===1?.04:.08)+(potential===6?.03:0));near(r.talentBb[0].prob,.15);near(r.talentBb[0].sluggish,1.5);}
});
for(let rank=1;rank<=10;rank++)test(`Timeslot rank ${rank} retains common thirty-second S1 and forty-second overload S2 operands`,()=>{
 const a=select(build(2,0,rank)),b=select(build(2,1,rank));for(const r of[a,b]){assert.equal(r.source.skillType,'MANUAL');assert.equal(r.source.spData.spType,'INCREASE_WITH_TIME');near(r.source.spData.maxChargeTime,1);}
 near(a.source.duration,30);near(a.bb.atk,[.3,.35,.4,.45,.5,.55,.6,.75,.9,1][rank-1]);near(a.source.spData.spCost,[40,40,40,37,37,37,35,34,33,30][rank-1]);near(a.source.spData.initSp,[0,0,0,5,5,5,10,10,10,15][rank-1]);
 near(b.source.duration,40);near(b.bb.atk,[.17,.2,.23,.26,.29,.32,.35,.4,.45,.5][rank-1]);near(b.bb.attack_speed,[20,25,30,35,40,45,50,55,60,65][rank-1]);near(b.bb['attack@cnt'],1);
 near(b.source.spData.spCost,[50,48,46,45,43,41,40,40,40,40][rank-1]);near(b.source.spData.initSp,[10,10,10,15,15,15,20,20,20,25][rank-1]);
});
test('Timeslot original attacks distinguish owner animation clocks from three independent funnel abilities',()=>{
 const n=inputs();for(const[a,clip,key]of[[n.ordinary,'Attack','projectile_chr_tmslot'],[n.s2Attack,'Skill_2','projectile_chr_tmslot_s2']]){
  assert.equal(a._animKey,clip);assert.equal(a._selector.m_PathID,'0');assert.equal(a._timeMode,0);assert.equal(a._maxAnimScale,1);assert.equal(a._waitForAttackEvent,1);assert.equal(a._affectedBySlowDown,1);assert.equal(a._projectileKey,key);
 }
 for(const[a,alias]of[[n.funnel,'Funnel'],[n.s2Funnels[0],'S2Funnel_1'],[n.s2Funnels[1],'S2Funnel_2']]){assert.equal(a._metadata.namedAsAlias,alias);assert.equal(a._timeMode,2);assert.equal(a._animKey,'');assert.equal(a._maxAnimScale,-1);assert.equal(a._affectedBySlowDown,0);}
 assert.equal(n.funnel._waitForProjectileInvalid,0);for(const a of n.s2Funnels){assert.equal(a._waitForProjectileInvalid,1);assert.equal(a._fireAttackFinishWhenProjectileInvalid,1);assert.equal(a._activeBuffs[0].templateKey,'tmslot_s_2[mark]');assert.equal(a._activeBuffs[0].triggerInterval,.10000000149011612);}
 assert.deepEqual(n.s2Attack._funnelActions.map(p=>p.m_PathID),['-1575601179404714803','1681321537420803277']);
 for(const root of[n.s1,n.s2]){assert.equal(root._playSkillBeginAnim,0);assert.equal(root._beginAnim,'');assert.equal(root._allowSpRecoveryWhenAffecting,0);assert.equal(root._canSilenced,0);assert.equal(root._canCastDuringBorn,1);}assert.equal(n.s2._isOverloadSkill,1);
});
test('Timeslot projectiles preserve ordinary travel and distinct persistent source-owned S2 funnel timing',()=>{
 for(const key of['projectile_chr_tmslot','projectile_chr_tmslot_s2','projectile_chr_tmslot_funnel']){
  const rows=e.projectiles[key].flatMap(r=>r.components.map(c=>c.data)),root=rows.find(a=>'_stopWhenSourceInvalid'in a),travel=rows.find(a=>'_speed'in a);
  assert.equal(root._stopWhenSourceInvalid,0);assert.equal(root._alwaysHitTraceTargetInTheEnd,1);near(travel._speed,15);
 }
 for(const i of[1,2]){const rows=e.projectiles[`projectile_chr_tmslot_funnel_s2_${i}`].flatMap(r=>r.components.map(c=>c.data));
  const root=rows.find(a=>'_stopWhenSourceInvalid'in a),wait=rows.find(a=>'_preDelay'in a),travel=rows.find(a=>'_immediatelyReach'in a);
  assert.equal(root._stopWhenSourceInvalid,1);assert.equal(root._alwaysHitTraceTargetInTheEnd,0);assert.equal(root._lifeTimeType,2);assert.equal(travel._immediatelyReach,1);near(wait._preDelay,.6000000238418579);assert.equal(wait._customAbilityAlias,`S2Funnel_${i}`);assert.equal(wait._useAbilityPlaybackSpeed,1);
 }
});
test('Timeslot overload requires the source-marked target outside range, with derived hook and literal mode cleanup',()=>{
 const n=inputs(),mark=n.templates['tmslot_s_2[mark]'].eventToActions.ON_BUFF_TRIGGER;
 assert.deepEqual(mark.filter(a=>a.$type.endsWith('IfNot, Assembly-CSharp')).map(a=>mark.indexOf(a)),[2,6]);assert.equal(mark[0]._buffKeys[0],'tmslot_s_2[switch_mode]');assert.equal(mark[1]._buffKeys[0],'tmslot_s_2[overload]');
 assert.ok(mark[5].$type.includes('CheckEntityInAttackRange'));assert.equal(mark[5]._useOverlap,true);assert.ok(mark[7].$type.includes('ForceEnterSkillOverloadProgress'));
 const overload=n.templates['tmslot_s_2[overload]'].eventToActions;
 assert.equal(overload.ON_BUFF_START[0]._buff.templateKey,'tmslot_s_2[hook]');assert.equal(overload.ON_BUFF_START[0]._isDerivedBuff,true);assert.equal(overload.ON_SKILL_FINISH[0]._buffKey,'tmslot_s_2[switch_mode]');
 assert.equal(n.modeBuff._buffs[0].templateKey,'tmslot_s_2[switch_mode]');assert.equal(n.overloadBuff._forceFinishBuffOnCastEnd,0);
 assert.equal(n.templates['tmslot_s_2[switch_mode]'].eventToActions.ON_BUFF_START[0]._modeIndex,1);
 assert.equal(n.templates['tmslot_s_2[switch_mode]'].eventToActions.ON_BUFF_FINISH[0]._restoreDefault,true);
});
test('Timeslot talent rolls Slow only on source funnel aliases, not ordinary owner output',()=>{
 const a=inputs().templates.tmslot_t.eventToActions.ON_OUTPUT_DAMAGE[0];assert.equal(a._isAnd,false);
 assert.deepEqual(a._conditionsNode.map(v=>v._abilityName),['Funnel','S2Funnel_1','S2Funnel_2']);assert.equal(a._succeedNodes[0]._probKey,'prob');assert.equal(a._succeedNodes[1]._buff.buffKey,'sluggish');
});
test('Timeslot original Front/Back have distinct overload Begin clocks and only four declared mix edges',()=>{
 for(const face of['Front','Back']){const m=e.models[ID][face];near(m.eventPayloads.Attack[0].time,.6333333253860474);near(m.eventPayloads.Skill_2[0].time,.5);assert.equal(m.eventPayloads.Skill_2_Overload_Begin,undefined);}
 assert.deepEqual(inputs().mixes.map(m=>[m.sourceAnimName,m.targetAnimName,m.mixAnimName]),[
  ['Skill_2','Skill_2_Overload_Loop','Skill_2_Overload_Begin'],['Idle','Skill_2_Overload_Loop','Skill_2_Overload_Begin'],
  ['Skill_2_Overload_Loop','Idle','Skill_2_Overload_End'],['Skill_2_Overload_Loop','Attack','Skill_2_Overload_End']]);
});
test('Timeslot source refuses locked promotion, skill, rank, potential, trust and module inputs',()=>{
 for(const p of[{elite:3},{level:81},{potential:0},{trust:201},{skillRank:0},{skillRank:11},{skillId:'other'},{module:'mod-x'},
  {elite:0,level:50,skillRank:5},{elite:1,level:70,skillRank:8},{elite:0,level:50,skillRank:4,skillId:SKILLS[1]}])assert.throws(()=>select({...build(),...p}));
});
