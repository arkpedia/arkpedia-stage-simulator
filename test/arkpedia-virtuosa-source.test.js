// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import e from '../data/arkpedia-virtuosa-prefabs.json' with { type: 'json' };
const components = group => Object.values(group).flatMap(rs => rs.flatMap(r => r.components.map(c => c.data)));
const rows = components({...e.characters,...e.skills,...e.projectiles});
const skillBuffs = id => components({[id]:e.skills[id]}).flatMap(d=>d._buffs??[]);
const near = (a,z) => assert.ok(Math.abs(a-z)<1e-6);
test('T1 original source uses non-silenceable first .9 tick/one second pulse and database Slow',()=>{
 const t=rows.flatMap(d=>d._buffs??[]).find(b=>b.buffKey==='cello_t_1');near(t.firstTriggerInterval,.9);near(t.triggerInterval,1);assert.equal(t.waitFirstTriggerInterval,1);assert.equal(t.isSilenceable,0);assert.equal(t.isStunnable,0);
 const actions=e.templates['cello_t_1[core]'].eventToActions.ON_BUFF_START;assert.equal(actions[0]._elementDamageType,'DARK');assert.equal(actions[0]._sourceType,'BUFF_SOURCE');assert.equal(actions[0]._epDamageScale,'ep_damage_ratio');assert.equal(actions[2]._buff.buffKey,'sluggish');assert.equal(actions[2]._buff.loadFromDB,true);assert.equal(e.buffDatabase.sluggish.durationKey,'sluggish');near(e.buffDatabase.sluggish.attributes.attributeModifiers[0].value,-.8);
});
test('T2 native injury-scale is DARK-only, nonstacking and distinct from elemental HP damage',()=>{
 const d=e.templates.cello_t_2.eventToActions.ON_TAKE_EP_DAMAGE.find(d=>/EpDamageScale/.test(d.$type));assert.equal(d._isStackable,false);assert.equal(d._isOneMinus,false);assert.equal(d._filterElementType,true);assert.equal(d._elementType,'DARK');
});
test('S1 trigger explicitly refuses element-break target and original no-basic-attack buff is retained',()=>{
 const trigger=components(e.skills).find(d=>d._CheckNotInElementBreak!=null);assert.equal(trigger._CheckNotInElementBreak,1);
 const disarm=rows.flatMap(d=>d._buffs??[]).find(b=>b.buffKey==='cello_s_1[disarm]');assert.deepEqual(disarm.attributes.abnormalFlags,[18]);
 const attack=components({s:e.skills.skchr_cello_1}).find(d=>d._projectileKey==='projectile_chr_cello_s1');assert.equal(attack._waitForAttackEvent,1);assert.equal(attack._elementDamageType,4);assert.equal(attack._atkScaleKey,'atk_scale');assert.equal(attack._selectTargetSource,2);
});
test('S2 source accepted output rider has no attack/type predicate and keeps Virtuosa source ownership',()=>{
 const a=e.templates['cello_s_2[attack]'].eventToActions.ON_OUTPUT_DAMAGE;assert.equal(a.length,2);assert.equal(a[0]._sideMask,'ENEMY');assert.equal(a[1]._sourceType,'BUFF_SOURCE');assert.equal(a[1]._targetType,'MODIFIER_TARGET');assert.equal(a[1]._baseOnHostAtk,false);assert.equal(a[1]._forceUseProjectileCachedAtk,false);assert.equal(a[1]._epDamageScale,'ep_damage_ratio');
 const buff=skillBuffs('skchr_cello_2').find(b=>b.buffKey==='cello_s_2');near(buff.triggerInterval,.3);assert.equal(buff.waitFirstTriggerInterval,0);
 const selector=components({s:e.skills.skchr_cello_2}).find(d=>d._postFilter===17);assert.equal(selector._excludeOwner,1);assert.equal(selector._professionMask,639);assert.equal(selector._maxNum,1);
});
test('S3 three selectors exclude owner and children are cleaned before selection with native multiplier attributes',()=>{
 const selectors=components({s:e.skills.skchr_cello_3}).filter(d=>d._postFilter!=null);assert.deepEqual(selectors.map(d=>d._postFilter).sort((a,z)=>a-z),[8,17,19]);assert.ok(selectors.every(d=>d._excludeOwner===1&&d._professionMask===639));
 const actions=e.templates.cello_s_3.eventToActions.ON_BUFF_TRIGGER;assert.match(actions[0].$type,/FinishDerivedBuff/);const children=actions.filter(d=>/CreateBuffUseAbilitySelector/.test(d.$type));assert.equal(children.length,3);assert.ok(children.every(d=>d._finishDerivedBuffIfParentFinish));assert.deepEqual(children.map(d=>d._buff.attributes.attributeModifiers[0].attributeType).sort(),['ATK','DEF','MAX_HP']);assert.ok(children.every(d=>d._buff.attributes.attributeModifiers[0].formulaItem==='MULTIPLIER'));
});
test('all three native projectiles are tracked single-hit speed10 and survive source invalidation',()=>{
 for(const nodes of Object.values(e.projectiles)){const rows=nodes.flatMap(n=>n.components.map(c=>c.data)),move=rows.find(d=>d._speed!=null),main=rows.find(d=>d._maxHitNum!=null);near(move._speed,10);assert.equal(main._maxHitNum,1);assert.equal(main._stopWhenSourceInvalid,0);assert.equal(main._canHitSameTargetMultipleTimes,0);}
});
