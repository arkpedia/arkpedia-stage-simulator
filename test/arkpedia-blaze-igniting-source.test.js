// SPDX-License-Identifier: GPL-3.0-or-later
// These pin native facts; they do not certify regular-stage gameplay or Unity callbacks.
import test from 'node:test';import assert from 'node:assert/strict';
import e from '../data/arkpedia-blaze-igniting-prefabs.json' with{type:'json'};
import data from '../data/arkpedia-mvp.json' with{type:'json'};
import {REGULAR_OPERATORS} from '../shared/arkpedia/operators.js';
const ID='char_1040_blaze2',components=Object.values({...e.characters,...e.skills,...e.projectiles}).flat().flatMap(r=>r.components);
const comp=id=>{const c=components.find(c=>c.pathId===id);assert.ok(c,id);return c.data;};
const nodes=v=>!v||typeof v!=='object'?[]:[...(v.$type?[v]:[]),...Object.values(v).flatMap(nodes)];
const type=v=>v.$type.split('+').at(-1).split(',')[0];
const bb=rows=>Object.fromEntries(rows.map(r=>[r.key,r.valueStr??r.value]));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('Blaze native foundation is complete and held outside the playable registry',()=>{
 assert.deepEqual(e.enabledOperators,[]);assert.deepEqual(e.heldOperators,[ID]);assert.equal(REGULAR_OPERATORS[ID],undefined);assert.equal(data.operators[ID],undefined);
 assert.equal(e.frameParity,false);assert.equal(e.moduleSupport,false);assert.equal(e.nativeParticleSupport,false);
 assert.equal(e.source.commit,'57010cb5b2afea112cae57daa756b58676ba6850');assert.equal(e.source.nativeClient,'26-09-23-17-49-43_b9cc4a');assert.equal(e.source.bundles.length,5);
 assert.equal(components.length,143);assert.equal(new Set(components.map(c=>c.pathId)).size,143);assert.equal(Object.keys(e.templates).length,22);assert.equal(Object.keys(e.projectiles).length,3);
 assert.deepEqual(e.nativeTemplateGaps,[]);assert.deepEqual(Object.keys(e.originalTemplates),Object.keys(e.templates));
});
test('ordinary and S2 attacks retain capped original events and separate projectile speeds',()=>{
 for(const[id,clip]of [['-4687093889924373767','Attack'],['-3195934114113625351','Skill_2_Loop']]){const a=comp(id);assert.equal(a._waitForAttackEvent,1);assert.equal(a._maxAnimScale,1);assert.equal(a._animKey,clip);for(const face of ['Front','Back'])near(e.models[ID][face].eventPayloads[clip].find(v=>v.name==='OnAttack').time,.4333333);}
 assert.equal(comp('3811374675922069068')._speed,99);
});
test('S1 has its own operator selector, cached ATK and output-based FIRE injury',()=>{
 const s=comp('-5998297771449952549');assert.equal(s._targetSide,1);assert.equal(s._postFilter,19);assert.equal(s._professionMask,639);assert.equal(s._excludeOwner,0);
 const start=e.templates.blaze2_s_1.eventToActions.ON_BUFF_START[0];assert.equal(type(start),'AssignAttributeToBB');assert.equal(start._targetType,'BUFF_SOURCE');assert.equal(start._attributeType,'ATK');assert.equal(start._blackboardKey,'cached_atk');
 const action=e.templates.blaze2_s_1.eventToActions.ON_BUFF_TRIGGER[0];assert.equal(action._rangeRadius,1.5);assert.equal(action._targetOptions.targetMotion,'ALL');
 const hit=e.templates['blaze2_s_1[aura]'].eventToActions.ON_BUFF_START;assert.equal(hit[0]._noSourceDamage,true);assert.equal(hit[0]._damageKey,'cached_atk');assert.equal(hit[0]._assignRealDamageToBB,true);
 assert.equal(hit[1]._multiplyParamKey,'element_multiplier');assert.equal(hit[2]._elementDamageType,'FIRE');assert.equal(hit[2]._fixedEpDamageKey,'calculated_damage');
});
test('S2 cleanup distinguishes leaving a tile from finishing the skill',()=>{
 for(const k of ['blaze2_s_2[finish]','blaze2_s_2[cleaner]']){const a=e.templates[k].eventToActions.ON_BUFF_START[0];assert.equal(type(a),'FinishBuffsOfEveryEnemyById');assert.equal(a._buffKey,'blaze2_s_2[on_tile]');}
 const leave=e.templates['blaze2_s_2[leave_tile]'].eventToActions.ON_BUFF_START[0];assert.equal(type(leave),'FinishBuffsById');assert.equal(leave._buffKey,'blaze2_s_2[on_tile]');
 const start=e.templates['blaze2_s_2[on_tile]'].eventToActions.ON_BUFF_START[0];assert.equal(start._isDerivedBuff,true);assert.equal(start._finishDerivedBuffIfParentFinish,true);assert.equal(start._buff.lifeTimeType,'INFINITY');
 assert.equal(start._buff.attributes.attributeModifiers[0].attributeType,'MOVE_SPEED');assert.equal(start._buff.attributes.attributeModifiers[0].value,-.5);
 const tick=e.templates['blaze2_s_2[on_tile]'].eventToActions.ON_BUFF_TRIGGER;assert.equal(tick[0]._assignRealDamageToBB,true);assert.equal(tick[1]._multiplyParamKey,'element_damage_scale');assert.equal(tick[2]._elementDamageType,'FIRE');
});
test('S3 uses a delayed stop-only radius hit without borrowing an Attack event',()=>{
 const a=comp('-3061221568776543495');assert.equal(a._projectileKey,'projectile_chr_blaze2_s3');assert.equal(a._waitForAttackEvent,0);
 const motion=comp('-4200255773684481920');near(motion._delayToStart,.3);assert.equal(motion._immediatelyReach,1);assert.equal(motion._followTarget,0);
 near(comp('-5100262976928956288').m_Radius,1.7);const hit=comp('4306318509201735808');assert.equal(hit._onlyCheckHitWhenStop,1);assert.equal(hit._ignoreCamouflage,1);assert.equal(hit._targetOptions.targetMotion,3);
 const bonus=e.templates['blaze2_s_3[additional_damage]'].eventToActions.ON_BUFF_START;assert.equal(bonus[0]._recoveryType,'FIRE');assert.equal(bonus[1]._damageType,'ELEMENT');
});
test('FIRE-burst listener recovers ammunition before the burst and talent healing precedes its output',()=>{
 const ammo=e.templates['blaze2_s_3[listener]'].eventToActions.ON_BEFORE_EP_BREAK_START;assert.equal(ammo[0]._recoveryType,'FIRE');assert.equal(ammo[1]._recoverEventCount,true);assert.equal(ammo[1]._recoverCountBBKey,'ammo_recover');
 const t=e.templates.blaze2_t_1.eventToActions;assert.ok(nodes(t.ON_BEFORE_EP_BREAK_START).some(n=>type(n)==='HealViaMaxHpRatio'));assert.equal(t.ON_EP_BREAK_START[1]._damageType,'ELEMENT');assert.equal(t.ON_EP_BREAK_START[1]._atkScaleVar,'ep_damage_scale');
});
test('revival barrier excludes elemental damage and full HP returns through the original ability chain',()=>{
 const t=e.templates.blaze2_t_2.eventToActions;assert.ok(t.ON_BEFORE_TRY_SET_HP_ZERO);
 const all=nodes(t),state=all.find(n=>type(n)==='CreateBuff'&&n._buff.buffKey==='blaze2_t_2[reborn_state]');assert.ok(state);assert.equal(state._buff.attributes.attributeModifiers[0].attributeType,'HP_RECOVERY_PER_SEC_BY_MAX_HP_RATIO');
 const r=nodes(e.templates['blaze2_t_2[reborn_state]']),barrier=r.find(n=>type(n)==='BlockDamage');assert.equal(barrier._damageMask,'ANY_ATTACK_EXCEPT_ELEMENT');assert.equal(barrier._useDynamicVar,true);assert.equal(barrier._showShieldUI,true);
 assert.ok(r.some(n=>type(n)==='FilterByTargetHpRatio'&&n._condType==='GE'&&n._value===1));assert.ok(r.some(n=>n._abilityName==='blaze2[to_default_state]'));assert.ok(r.some(n=>n._targetAbilityName==='CauseStun'));
 for(const face of ['Front','Back']){near(e.models[ID][face].durations.Revive_Begin,1);near(e.models[ID][face].eventPayloads.Revive_End.find(v=>v.name==='OnAttack').time,.8);}
});
test('all thirty selected ranks retain source SP, duration, field and ammunition values',()=>{
 for(let n=1;n<=3;n++){const rs=e.tables.skills[`skchr_blaze2_${n}`].levels;assert.equal(rs.length,10);for(const r of rs){assert.equal(r.spData.spType,'INCREASE_WITH_TIME');assert.equal(r.skillType,n===1?'AUTO':'MANUAL');assert.equal(r.duration,n===2?35:-1);assert.ok(r.spData.spCost>0);const b=bb(r.blackboard);if(n===1){assert.equal(b.range_radius,1.5);assert.equal(b.interval,1);assert.equal(b.max_duration,20);}if(n===2){assert.equal(b['attack@max_target'],3);assert.equal(b['attack@hp_ratio'],.05);}if(n===3){assert.equal(b.base_attack_time,-1.3);assert.equal(b.ammo_recover,2);assert.equal(b.lose_hp_scale,.03);}}}
});
test('original Front/Back skeleton receipts preserve full-width pointer identities',()=>{
 for(const face of ['Front','Back']){const b=e.officialSkeletonBindings[ID][face],m=e.models[ID][face];for(const k of ['animatorPathId','skeletonAnimationPathId','skeletonDataAssetPathId','textAssetPathId'])assert.match(b[k],/^-?\d+$/);assert.equal(b.sha256,m.sha256);assert.equal(b.byteLength,m.bytes);assert.ok(m.bytes>100000);}
});
