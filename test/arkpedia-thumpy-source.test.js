// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import e from '../data/arkpedia-native-operators/char_4235_thumpy.json' with {type:'json'};
import {THUMPY_ID as ID,THUMPY_SKILLS as SKILLS,selectedThumpyBuild as select,thumpySourceComponent} from '../server/sim/content/arkpedia-thumpy-source.js';
import {near} from './helpers/mon3tr-fixture.js';
const build=(elite=2,index=0,rank=[4,7,10][elite],potential=1,trust=0)=>({elite,level:[50,80,90][elite],skillId:SKILLS[index],skillRank:rank,potential,trust,module:'none'});
test('Thumpy original receipt is immutable and held independently of any later gameplay admission',async()=>{
 const b=await readFile(new URL('../data/arkpedia-native-operators/char_4235_thumpy.json',import.meta.url));assert.equal(b.length,467378);assert.equal(createHash('sha256').update(b).digest('hex'),'9a727b44984f8286d4dd8921a0c2e4e6f47e1ac62f8407bca6be0a7b421e69da');
 assert.equal(e.source.commit,'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add');assert.equal(e.source.bundles.length,5);assert.deepEqual(e.enabledOperators,[]);assert.deepEqual(e.heldOperators,[ID]);
 for(const k of['frameParity','moduleSupport','nativeParticleSupport'])assert.equal(e[k],false);
 assert.deepEqual(e.nativeTemplateGaps,[]);assert.deepEqual(e.jsonTemplateGaps,[]);assert.deepEqual(e.projectiles,{});assert.equal(e.tokens,undefined);assert.equal(Object.keys(e.templates).length,15);
 assert.throws(()=>thumpySourceComponent('characters',ID,'absent'));
});
for(const elite of[0,1,2])for(const potential of[1,6])test(`Thumpy E${elite}/P${potential} keeps trust, potential and both visible talent operands`,()=>{
 const r=select(build(elite,0,[4,7,10][elite],potential,200));near(r.stats.maxHp,[1898,2565,3514][elite]+300+(potential===6?270:0));near(r.stats.atk,[412,536,671][elite]+30);near(r.stats.def,[313,430,559][elite]+30);
 near(r.stats.cost,[22,24,26][elite]-(potential===6?2:0));near(r.stats.baseAttackTime,1.6);near(r.stats.blockCnt,3);near(r.stats.respawnTime,70);near(r.stats.magicResistance,10);assert.deepEqual(r.rangeGrid,[[0,0]]);
 if(elite===0)assert.deepEqual(r.talentBb,[{},{}]);else{
  const t=r.talentBb[0];near(t.ep_damage_scale,(elite===1?.95:.85)-(potential===6?.05:0));near(t.duration_dec,potential===6?1.2:1);near(t['ep_damage_ratio[trigger]'],(elite===1?.08:.1)+(potential===6?.02:0));
  if(elite===2){assert.deepEqual(r.talentBb[1],{def:potential===6?11:8,atk:0,shield_value:potential===6?330:250,max_stack_cnt:30,scale:3});assert.deepEqual(r.talentBb.slice(2),[{},{}]);}
 }
});
const atk=[[.2,.22,.25,.28,.31,.34,.37,.4,.45,.5],[.4,.42,.45,.48,.51,.54,.57,.6,.65,.7],[.5,.55,.6,.65,.7,.75,.8,.85,.9,1]],
 def=[atk[0],atk[1],[.6,.65,.7,.75,.85,.95,1.05,1.15,1.25,1.35]],scale=[null,[.3,.32,.34,.37,.39,.41,.43,.45,.47,.5],[.2,.22,.24,.27,.29,.31,.33,.35,.37,.4]],
 costs=[[40,39,38,37,36,35,34,33,32,30],[33,32,31,30,29,28,27,26,25,23],[58,58,58,58,57,57,57,56,56,55]],init=[Array(10).fill(15),Array(10).fill(14),[39,39,39,39,40,40,40,41,41,42]];
for(let index=0;index<3;index++)for(let rank=1;rank<=10;rank++)test(`Thumpy S${index+1}/rank ${rank} retains separate duration, SP and skill operands`,()=>{
 const r=select(build(2,index,rank)),b=r.bb;assert.equal(r.source.skillType,'MANUAL');assert.equal(r.source.spData.spType,'INCREASE_WITH_TIME');near(r.source.duration,[30,20,60][index]);near(r.source.spData.spCost,costs[index][rank-1]);near(r.source.spData.initSp,init[index][rank-1]);near(b.atk,atk[index][rank-1]);near(b.def,def[index][rank-1]);
 if(index===0)near(b['attack@force'],0);else{near(b.atk_scale,scale[index][rank-1]);near(b.max_cnt,5);near(b['ep_damage_ratio[trigger]'],0);near(b.interval,index===1?.7:1);
  if(index===1){near(b.sluggish,.5);near(b['ep_damage_ratio[damage]'],.15);}else{near(b.block_cnt,2);near(b.conveyor_speed,.8);near(b.mass_level,4);near(b['thumpy[ep_break_water].def'],-30);}}
});
test('Thumpy keeps ordinary/mode selectors, unrestricted native animation scale and fixed tile-cast clocks distinct',()=>{
 for(const[path,clip]of[['-2378400315842738559','Attack'],['-5622621863668726143','Skill_1_Loop'],['1731050891850696321','Skill_2_Loop'],['2386333457900390017','Skill_3_Loop']]){
  const a=thumpySourceComponent('characters',ID,path);assert.equal(a._animKey,clip);assert.equal(a._waitForAttackEvent,1);assert.equal(a._timeMode,0);assert.equal(a._maxAnimScale,-1);assert.equal(a._selectTargetTiming,0);
 }
 const s=thumpySourceComponent('characters',ID,'-9128282027876530559');assert.equal(s._limitTargetNum,0);assert.equal(s._limitedMaxTargetNumToBlockedCnt,1);
 for(const[index,path,clip]of[[1,'183103851251834538','Skill_2_Begin'],[2,'495910900133952371','Skill_3_Begin']]){const a=thumpySourceComponent('skills',SKILLS[index],path);assert.equal(a._animKey,clip);assert.equal(a._timeMode,1);assert.equal(a._affectedBySlowDown,1);assert.equal(a._selectTargetSource,1);}
 assert.deepEqual(e.chararts[ID][0].data._mixSettings.map(x=>[x.sourceAnimName,x.targetAnimName,x.mixAnimName]),[1,2,3].map(i=>[`Skill_${i}_Idle`,'Idle',`Skill_${i}_End`]));
});
test('Thumpy native talents preserve physical-output filtering and separate mark/burst resource dispatch',()=>{
 const a=e.templates['thumpy[t_2]'].eventToActions;assert.equal(a.ON_TAKE_EP_DAMAGE[0]._isOneMinus,false);assert.equal(a.ON_TAKE_EP_DAMAGE[0]._isStackable,false);
 assert.equal(a.ON_AFTER_OUTPUT_DAMAGE[0]._damageMask,'PHYSICAL');const branch=a.ON_AFTER_OUTPUT_DAMAGE[1];assert.equal(branch._conditionNode._elementType,'WATER');assert.ok(branch._succeedNodes[0].$type.includes('ReduceEpBreakCooldownDuration'));assert.equal(branch._succeedNodes[0]._durationSecondsKey,'duration_dec');assert.equal(branch._failNodes[0]._epDamageScale,'ep_damage_ratio[trigger]');
 const mark=e.templates['thumpy[t_1]'].eventToActions.ON_AFTER_OUTPUT_DAMAGE;assert.equal(mark[0]._filterDamageType,false);assert.equal(mark.at(-1)._isDerivedBuff,true);assert.equal(mark.at(-1)._buff.independentCharacterSource,true);
 const detect=e.templates['thumpy[water_break_detect]'].eventToActions.ON_BEFORE_EP_BREAK_START;assert.equal(detect[0]._recoveryType,'WATER');assert.equal(detect[0]._skipInEPBreakRecoveryCheck,true);assert.equal(detect[1]._buff.overrideType,'STACK');assert.equal(detect[1]._isDerivedBuff,false);
});
test('Thumpy rejects locked promotion/rank, unknown skills and unsupported modules',()=>{
 for(const p of[{elite:3},{level:91},{potential:0},{trust:201},{skillRank:0},{skillRank:11},{skillId:'other'},{module:'mod-x'},
  {elite:0,level:50,skillRank:5},{elite:1,level:80,skillRank:8},{elite:0,level:50,skillRank:4,skillId:SKILLS[1]},{elite:1,level:80,skillRank:7,skillId:SKILLS[2]}])assert.throws(()=>select({...build(),...p}));
});

test('Thumpy preserves the table/raw-template cap difference and initial/explicit shield trigger paths',()=>{
 const r=select(build()),nodes=e.templates['thumpy[water_break_detect]'].eventToActions.ON_BEFORE_EP_BREAK_START;
 assert.equal(r.talentBb[1].max_stack_cnt,30);assert.equal(nodes[1]._buff.maxStackCnt,20);
 assert.ok(nodes[2]._failNodes[0].$type.includes('CreateBuff'));assert.deepEqual(nodes[3]._buffKeys,['thumpy[shield]']);assert.equal(nodes[3]._forceTrigger,true);
 const shield=e.templates['thumpy[shield]'].eventToActions;
 assert.equal(shield.ON_BUFF_START[1]._blackboardKey,'dynamic');assert.equal(shield.ON_BUFF_START[1]._value,0);
 for(const [event,index] of [['ON_BUFF_START',2],['ON_BUFF_TRIGGER',1]]){const a=shield[event][index];assert.equal(a._addParamKey,'shield_value');assert.equal(a._maxValueKey,'shield_max_value');}
});
