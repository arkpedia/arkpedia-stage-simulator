// SPDX-License-Identifier: GPL-3.0-or-later
import {sameOutcomeValue as same} from './enemy-outcome-contracts.js';
export const corruptionDamageValue = value => Number.isFinite(value) && value >= 0;
/** Both persistent auras and projectile fields use the same original template.
 * Its blackboard values are fixed True damage chosen by the recipient's root
 * tile height, not ATK multipliers or the recipient's current flight state. */
export function nativeCorruptionTemplate(native) {
 const action=(name,fields)=>({$type:`Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`,...fields});
 const damage=key=>action('FixedValueDamage',{_damageType:'PURE',_damageKey:key,_ignoreForSp:true,_attackType:'BUFF',
  _skipModifierEvent:false,_considerUnhurtable:false,_noSourceDamage:false,_targetType:'TARGET',
  _assignRealDamageToBB:false,_multiplierByKey:false,_multiplierKey:'cnt',_damageTargetType:'TARGET',
  _triggerOnCalculateDamage:false,_isEnvDamage:false,_ignoreCancelReasonMask:'NONE',_forceDisplayDamageNum:false});
 return same(native.$template('polluted_area')?.eventToActions,{ON_BUFF_TRIGGER:[action('IfElse',{
  _conditionNode:action('CheckHeightTypeOfCharacterRootTile',{_targetType:'BUFF_OWNER',_heightType:'LOWLAND',_isUnset:false}),
  _succeedNodes:[damage('polluted_damage_low')],_failNodes:[damage('polluted_damage_high')],
 })]});
}
