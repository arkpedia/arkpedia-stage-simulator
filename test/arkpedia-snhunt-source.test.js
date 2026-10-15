// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import e from '../data/arkpedia-native-operators/char_4211_snhunt.json' with {type:'json'};
import {SNHUNT_ID as ID,SNHUNT_SKILLS as SKILLS,selectedSnhuntBuild as select,selectedSnhuntTrait,snhuntNativeInputs,snhuntSourceComponent}
 from '../server/sim/content/arkpedia-snhunt-source.js';
import tier3 from '../server/sim/content/kits/tier3.js';
import {normalizeChess} from '../server/sim/simdata.js';
import {near} from './helpers/mon3tr-fixture.js';
const build=(elite=2,skill=0,rank=[4,7,10][elite],potential=1,trust=0)=>({elite,level:e.tables.character.phases[elite].maxLevel,
 skillId:SKILLS[skill],skillRank:rank,potential,trust,module:'none'});
test('Snow Hunter retains immutable original receipt bytes and makes no public/compiled/rendering approval',async()=>{
 const raw=await readFile(new URL('../data/arkpedia-native-operators/char_4211_snhunt.json',import.meta.url));
 assert.equal(raw.length,378496);assert.equal(createHash('sha256').update(raw).digest('hex'),'37d0ab829cd389fe71eb180e858aa6d82bb43bea0f34bec1a70658ba361d95dd');
 assert.equal(e.source.commit,'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add');assert.equal(e.source.nativeClient,'26-09-22-07-47-20_6c71fa');
 assert.deepEqual(e.enabledOperators,[]);assert.deepEqual(e.heldOperators,[ID]);
 for(const k of['frameParity','moduleSupport','nativeParticleSupport'])assert.equal(e[k],false);
 assert.deepEqual(e.nativeTemplateGaps,[]);assert.deepEqual(e.jsonTemplateGaps,[]);assert.equal(e.source.bundles.length,5);
 assert.equal(Object.keys(e.templates).length,13);assert.equal(Object.keys(e.projectiles).length,4);
 assert.throws(()=>snhuntSourceComponent('characters',ID,'missing'));
});
for(const elite of[0,1,2])for(const potential of[1,6])test(`Snow Hunter E${elite}/P${potential} selects source stats, ammunition capacity and talent`,()=>{
 const b=build(elite,0,[4,7,10][elite],potential,200),r=select(b),t=selectedSnhuntTrait(b);
 near(r.stats.maxHp,[1026,1316,1710][elite]+200);near(r.stats.atk,[650,824,981][elite]+70+(potential===6?32:0));
 near(r.stats.def,[139,177,222][elite]);near(r.stats.cost,[15,17,19][elite]-(potential===6?2:0));
 near(r.stats.respawnTime,potential===6?66:70);near(r.stats.baseAttackTime,1.6);near(t.bb.value,[4,6,8][elite]);near(t.bb.atk_scale,1.2);
 if(elite===0)assert.deepEqual(r.talentBb,[]);else{near(r.talentBb[0].atk_scale,(elite===1?1.5:1.8)+(potential===6?.05:0));near(r.talentBb[0].cold,elite===1?2:3);}
});
for(let rank=1;rank<=10;rank++)test(`rank ${rank} keeps offensive S1 and manual charged S2 source inputs; inherited S1 coefficient agrees`,()=>{
 const b=build(2,0,rank),a=select(b),c=select(build(2,1,rank));
 assert.equal(a.source.skillType,'AUTO');assert.equal(a.source.spData.spType,'INCREASE_WHEN_ATTACK');near(a.source.spData.spCost,[5,5,5,4,4,4,4,4,4,3][rank-1]);
 near(a.bb.atk_scale,[1.7,1.75,1.8,1.85,1.9,1.95,2,2.1,2.2,2.3][rank-1]);
 assert.equal(c.source.skillType,'MANUAL');assert.equal(c.source.spData.spType,'INCREASE_WITH_TIME');
 near(c.source.spData.spCost,[24,24,20,20,18,15,14,13,12,10][rank-1]);near(c.source.spData.initSp,7);
 near(c.source.spData.maxChargeTime,rank<7?1:2);near(c.bb.ct,rank<7?1:2);
 near(c.bb.atk_scale_1,[1.2,1.3,1.4,1.6,1.65,1.7,1.8,1.9,2,2.2][rank-1]);
 near(c.bb.atk_scale_2,[1.6,1.7,1.8,1.85,1.9,2,2.1,2.2,2.4,2.6][rank-1]);
 const def=normalizeChess({chessId:ID,charId:ID,stats:a.stats,talents:a.talents,trait:selectedSnhuntTrait(b),
  skill:{...a.source,...a.source.spData,skillId:SKILLS[0],bb:a.bb}});
 const inherited=tier3.chess_char_3_11_a(a.bb,def.raw,def);
 assert.equal(inherited.skills[SKILLS[0]].kind,'instant');near(inherited.skills[SKILLS[0]].attack.atkScale,a.bb.atk_scale);
 // This comparison deliberately does not install its seasonal auto-cast/module hooks or approve its S2/talent timing.
});
test('invalid, locked and module-bearing Snow Hunter builds fail before any combat installation',()=>{
 for(const patch of[{elite:-1},{elite:3},{level:0},{level:81},{potential:0},{potential:7},{trust:-1},{trust:201},
  {skillRank:0},{skillRank:11},{skillId:'other'},{module:'mod-x'},{module:''},{module:false},
  {elite:0,level:50,skillRank:5},{elite:1,level:70,skillRank:8},{elite:0,level:50,skillRank:4,skillId:SKILLS[1]}])
  assert.throws(()=>select({...build(),...patch}));
});
test('native ordinary/S1 projectile release, reload clocks and S2 timed second launch remain distinct',()=>{
 const n=snhuntNativeInputs();
 for(const a of[n.ordinaryA,n.ordinaryB,n.s1Shot]){assert.equal(a._selectTargetTiming,1);assert.equal(a._timeMode,0);assert.equal(a._useCachedAtkOnly,0);assert.equal(a._maxAnimScale,-1);}
 assert.equal(n.reload._timeMode,1);assert.equal(n.s1Shot._animKey,'Skill_1');assert.equal(n.s2Shot._additionalTimes,1);
 assert.equal(n.s2Shot._selectTargetTiming,2);assert.equal(n.s2Shot._waitAttackEventForAllAttacks,0);near(n.s2Shot._triggerDelta,.18000000715255737);
 for(const p of[n.ordinaryProjectile,n.s1Projectile,n.s2Projectile]){near(p._lifeTime,10);assert.equal(p._stopWhenSourceInvalid,0);}
 for(const p of[n.ordinaryMotion,n.s1Motion,n.s2Motion])near(p._speed,10);
 near(n.beast._lifeTime,.10000000149011612);assert.equal(n.beast._stopWhenSourceInvalid,0);
 for(const face of['Front','Back']){const m=e.models[ID][face];near(m.eventPayloads.Attack_Loop[0].time,.06666667014360428);
  assert.equal(m.eventPayloads.Skill_1[0].name,'BeastOnAttack');near(m.eventPayloads.Skill_1[0].time,0);near(m.eventPayloads.Skill_1[1].time,.23333333432674408);
  near(m.eventPayloads.Skill_2_Loop[0].time,.03333333507180214);near(m.eventPayloads.Skill_2_Loop[1].time,.20000000298023224);}
});
test('native S2 bonus explicitly includes TRAP recipients even when the enemy is moving',()=>{
 const c=snhuntNativeInputs().templates['snhunt_2[atk_up]'].eventToActions.ON_BEING_CALCULATE_DAMAGE[0];
 assert.equal(c._isAnd,false);assert.match(c._conditionsNode[0].$type,/CheckEnemyIsStayStill/);
 assert.deepEqual(c._conditionsNode[1]._profession,['TRAP']);assert.equal(c._succeedNodes[0]._atkScaleKey,'atk_scale_2');assert.equal(c._failNodes[0]._atkScaleKey,'atk_scale_1');
});
test('native magazine initialization, reload addition/subtraction and both original model families stay source-bound',()=>{
 const n=snhuntNativeInputs(),init=n.templates.snhunt_tr_init.eventToActions.ON_BUFF_START;
 assert.equal(init[0]._blackboardKeys,'max_cnt');assert.equal(init[1]._blackboardKeys,'cnt');
 assert.equal(init[0]._fromBlackboardKeys,'value');assert.equal(init[1]._fromBlackboardKeys,'value');
 assert.equal(n.templates.snhunt_tr_sub.eventToActions.ON_BUFF_START[0]._isSub,true);
 assert.ok(e.models[ID].Front.durations.Attack_Down_Loop);assert.equal(e.models[ID].Back.durations.Attack_Down_Loop,undefined);
 assert.ok(e.models[ID].Front.durations.Die);assert.equal(e.models[ID].Back.durations.Die,undefined);
 assert.equal(e.frameParity,false);assert.equal(e.moduleSupport,false);
});
