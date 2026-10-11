// SPDX-License-Identifier: GPL-3.0-or-later
// Native contracts for the complete kit; these are not combat verification.
import test from 'node:test';import assert from 'node:assert/strict';
import e from '../data/arkpedia-thorns-lodestar-prefabs.json' with{type:'json'};
import data from '../data/arkpedia-mvp.json' with{type:'json'};
import {REGULAR_OPERATORS}from'../shared/arkpedia/operators.js';
const ID='char_1039_thorn2',components=Object.values({...e.characters,...e.skills,...e.projectiles}).flatMap(rs=>rs.flatMap(r=>r.components));
const component=id=>{const c=components.find(c=>c.pathId===id);assert.ok(c,id);return c.data;};
const bb=rows=>Object.fromEntries(rows.map(r=>[r.key,r.value]));
const ranks=n=>e.tables.skills[`skchr_thorn2_${n}`].levels;
const type=n=>n.$type.split('+').at(-1).split(',')[0];
const nodes=v=>!v||typeof v!=='object'?[]:[...(v.$type?[v]:[]),...Object.values(v).flatMap(nodes)];
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('complete native Thorns source stays held pending all three skills and public lifecycle review',()=>{
 assert.deepEqual(e.enabledOperators,[]);assert.deepEqual(e.heldOperators,[ID]);assert.equal(REGULAR_OPERATORS[ID],undefined);assert.equal(data.operators[ID],undefined);
 assert.equal(e.frameParity,false);assert.equal(e.moduleSupport,false);assert.equal(e.nativeParticleSupport,false);
 assert.equal(e.source.commit,'57010cb5b2afea112cae57daa756b58676ba6850');assert.equal(e.source.nativeClient,'26-09-23-17-49-43_b9cc4a');
 assert.equal(e.source.bundles.length,5);assert.equal(components.length,148);assert.equal(new Set(components.map(c=>c.pathId)).size,148);
 assert.equal(Object.keys(e.projectiles).length,5);assert.equal(Object.keys(e.templates).length,13);assert.deepEqual(e.nativeTemplateGaps,[]);
 for(const rows of Object.values({...e.characters,...e.skills,...e.projectiles}))for(const row of rows){assert.equal(row.gameObjectData.m_Name,row.object);assert.equal(row.gameObjectData.m_IsActive,true);assert.equal(row.gameObjectData.m_Component.length>=row.components.length,true);}
 assert.deepEqual(Object.keys(e.originalTemplates),Object.keys(e.templates));assert.equal(e.recoveredFacts.length,8);
});
test('ordinary attack is source-timed Arts with independent emitted projectile lifetime',()=>{
 const a=component('5263414674818827161');assert.equal(a._projectileKey,'projectile_chr_thorn2');assert.equal(a._damageType,1);assert.equal(a._attackType,1);assert.equal(a._maxAnimScale,1);assert.equal(a._waitForAttackEvent,1);
 assert.equal(component('-7228355187252926179')._speed,10);const p=component('4915877701454457117');assert.equal(p._lifeTime,10);assert.equal(p._managedBySource,0);assert.equal(p._stopWhenSourceInvalid,0);
 for(const face of ['Front','Back'])assert.deepEqual(e.models[ID][face].hits.Attack,[.5]);
});
test('talent duration extension uses the original memo and capped count at ability start',()=>{
 const t=e.templates.thorn2_t_1,begin=t.eventToActions.ON_BUFF_START;assert.deepEqual(begin.map(n=>n._blackboardKey),['set_origin','projectile_time_origin']);assert.deepEqual(begin.map(n=>n._value),[0,0]);
 const start=nodes(t.eventToActions.ON_ABILITY_START),copy=start.find(n=>type(n)==='AssignCharacterSkillBlackboardToBB');assert.equal(copy._sourceBlackboardKey,'projectile_delay_time');assert.equal(copy._targetBlackboardKey,'projectile_time_origin');
 const calc=start.find(n=>n._outputKey==='projectile_extend_cur');assert.equal(calc._multiplyParamKey,'cnt');assert.equal(calc._maxValueKey,'projectile_extend_max');
 assert.deepEqual(start.filter(n=>type(n)==='ModifyAbilityBlackboard').map(n=>n._abilityName),['Token','Mark']);
 const talents=e.tables.character.talents[0].candidates;assert.deepEqual(talents.map(t=>[t.unlockCondition.phase,t.requiredPotentialRank,bb(t.blackboard).projectile_extend]),[['PHASE_0',0,1],['PHASE_0',4,2],['PHASE_1',0,2],['PHASE_1',4,3],['PHASE_2',0,3],['PHASE_2',4,4]]);
});
test('S1 selects an ally, waits for its original Skill event and creates cached-ATK healing',()=>{
 const s=component('-6304799235190838369');assert.equal(s._targetSide,1);assert.equal(s._targetMotion,3);assert.equal(s._postFilter,39);assert.equal(s._maxNum,1);
 assert.equal(component('-1564303750787978337')._projectileDestination,3);assert.equal(component('-1848820219359044614')._forceResetToTargetPosWhenReached,1);
 for(const face of ['Front','Back'])assert.deepEqual(e.models[ID][face].hits.Skill,[.6]);
 const heal=nodes(e.templates.thorn2_s1_buff).find(n=>type(n)==='CalculateBlackboardValueViaParams');assert.equal(heal._inputKey,'cached_atk');assert.equal(heal._multiplyParamKey,'hp_recovery_per_sec_ratio');assert.equal(heal._outputKey,'hp_recovery_per_sec');
 assert.deepEqual(Object.fromEntries(['def','projectile_delay_time','hp_recovery_per_sec_ratio'].map(k=>[k,bb(ranks(1).at(-1).blackboard)[k]])),{def:100,projectile_delay_time:8,hp_recovery_per_sec_ratio:.2});
});
test('S2 gains the second charge at rank seven and retains native Mark/Token movement',()=>{
 assert.deepEqual(ranks(2).map(r=>r.spData.maxChargeTime),[1,1,1,1,1,1,2,2,2,2]);
 assert.equal(component('5514365045461983801')._animKey,'Skill_2');assert.equal(component('4209454866455700025')._animKey,'Skill_2');
 assert.equal(component('8228061981174506041')._targetMotion,1);assert.equal(component('-4332766579279683015')._targetMotion,1);
 const motion=component('-4919525718460828233');assert.equal(motion._speed,10);near(motion._extraMoveSpeed,.2);assert.equal(component('5454475371213649335')._extendable,1);
 const m3=bb(ranks(2).at(-1).blackboard);assert.equal(m3.projectile_move_speed,.1);assert.equal(m3.value,.13);assert.equal(m3.remaining_time,15);
 for(const face of ['Front','Back'])assert.deepEqual(e.models[ID][face].hits.Skill_2,[.567]);
});
test('S3 retains passive mode, ally-anchor selector and polygon rather than a guessed circular splash',()=>{
 assert.equal(component('-6454678035786310245')._defaultModeIndex,1);for(const r of ranks(3))assert.equal(r.rangeId,'3-9');
 for(const id of ['2200626207338192283','1168203264450813339']){const s=component(id);assert.equal(s._postFilter,61);assert.equal(s._targetSide,1);assert.equal(s._maxTargetKey,'max_target_token');}
 assert.equal(component('5984532096528604571')._projectileKey,'projectile_chr_thorn2_s3_polygon');const polygon=component('-6779247284765065877');near(polygon._polygonLineColliderWide,.325);near(polygon._polygonColliderOffset,.325);
 for(const face of ['Front','Back'])assert.deepEqual(e.models[ID][face].hits.Skill_3_Loop,[.7]);
});
test('S3 arrival, first periodic hit and three independently clamped reductions remain source data',()=>{
 const motion=component('3790581397807824235');assert.equal(motion._delayToStart,.5);assert.equal(motion._delayAfterReached,1);assert.equal(motion._immediatelyReach,1);assert.equal(motion._followTarget,0);
 const hit=component('-1321748048543089301');assert.equal(hit._waitFirstPeriod,0);assert.equal(hit._intervalBbKey,'interval');assert.equal(hit._ignoreRangeScale,1);
 const ramp=component('-1955081288819212949');assert.equal(ramp._onlyIncreaseReached,1);assert.deepEqual(ramp._bbGroups.map(g=>[g.blackboardKey,g.increaseValueKey,g.maxValueKey]),[['atk','atk_per_interval','max_atk'],['def','def_per_interval','max_def'],['magic_resistance','magic_resistance_per_interval','max_magic_resistance']]);
 const n=nodes(e.templates.thorn2_s3_enemy_buff),damage=n.find(n=>type(n)==='NoSourceDamage');assert.equal(damage._damageType,'MAGICAL');assert.equal(damage._attackType,'BUFF');assert.equal(damage._damageKey,'cached_atk');
 for(const key of ['atk','def','magic_resistance'])assert.equal(n.find(n=>n._outputKey===key)._minValueKey,'max_'+key);
});
test('all thirty ranks retain skill triggers, automatic SP, charge counts and original durations',()=>{
 for(let n=1;n<=3;n++){const rs=ranks(n);assert.equal(rs.length,10);for(const [index,r]of rs.entries()){assert.equal(r.spData.spType,'INCREASE_WITH_TIME');assert.equal(r.duration,-1);assert.equal(r.skillType,n===1?'AUTO':'MANUAL');assert.equal(r.spData.maxChargeTime,n===2&&index>=6?2:1);assert.ok(r.spData.spCost>0);assert.ok(r.spData.initSp>=0);assert.ok(bb(r.blackboard).projectile_delay_time>0);}}
});
test('both source skeleton pointer chains have full-width string identifiers and byte receipts',()=>{
 for(const face of ['Front','Back']){const b=e.officialSkeletonBindings[ID][face],m=e.models[ID][face];for(const key of ['animatorPathId','skeletonAnimationPathId','skeletonDataAssetPathId','textAssetPathId'])assert.match(b[key],/^-?\d+$/);assert.equal(b.sha256,m.sha256);assert.equal(b.byteLength,m.bytes);assert.ok(m.bytes>100000);}
});
