// SPDX-License-Identifier: GPL-3.0-or-later
import { knightNative } from './enemy-knight-features.js';
function demolitionist(r, nat) {
  if (!['enemy_1076_bsthmr', 'enemy_1076_bsthmr_2'].includes(r.prefabKey) || r.applyWay !== 'MELEE'
    || r.skills.length || r.talents.groups.aoe?.join() !== 'attack@bsthmr_range.atk_scale'
    || r.talents.bb['aoe.attack@bsthmr_range.atk_scale'] !== .5) return false;
  const combat = nat.Combat?.[0], buff = combat?._activeBuffs?.[0];
  const actions = nat.$template?.('bsthmr_range')?.eventToActions?.ON_BUFF_FINISH;
  const action = actions?.[0], range = nat.$range?.('x-5');
  return nat.Combat?.length === 1 && nat.AOE?.length === 1
    && nat.AOE[0].m_Script?.m_PathID === '4865767822664548221'
    && combat._damageType === 1 && combat._attackType === 1 && combat._atkScale === 1
    && combat._waitForAttackEvent === 1 && combat._timeMode === 0 && combat._selectTargetSource === 2
    && combat._selector?.m_PathID === '0' && combat._activeBuffs.length === 1
    && buff.templateKey === 'bsthmr_range' && buff.isSilenceable === 0 && buff.isDamageMissable === 0
    && buff.lifeTimeType === 0 && buff.lifeTime === 0 && buff.stripBlackboardParamsWithBuffKey === 1
    && Object.values(buff.attributes).every(a => Array.isArray(a) && !a.length)
    && buff.blackboard?.length === 1 && buff.blackboard[0].key === 'range_id' && buff.blackboard[0].valueStr === 'x-5'
    && actions?.length === 1 && action.$type === 'Torappu.Battle.Action.Nodes+AOEDamage, Assembly-CSharp'
    && action._sourceType === 'BUFF_SOURCE' && action._targetType === 'BUFF_OWNER' && action._damageType === 'PHYSICAL'
    && action._sourceApplyWay === 'MELEE' && action._excludeTarget === true && action._useRadius === false
    && action._useAbilitySelector === false && action._damageScale === 'atk_scale' && action._attackType === 'SPLASH'
    && action._checkTargetAlive === false && action._buffs?.length === 0 && action._isNoSourceDamage === false
    && action._targetOptions.targetMotion === 'WALK_ONLY' && action._targetOptions.targetSide === 'ENEMY'
    && action._targetOptions.ignoreTargetFree === false && action._targetOptions.purposeMask === 'DAMAGE'
    && range?.direction === 1 && range.grids?.length === 5
    && range.grids.map(p => `${p.row},${p.col}`).sort().join('|') === '-1,0|0,-1|0,0|0,1|1,0';
}
export const AREA_ENEMY_FEATURES = Object.freeze({
  'talent:aoe': {
    covers: (r, n) => demolitionist(r, n) || r.prefabKey === 'enemy_1513_dekght' && knightNative(r, n),
    ability: r => r.prefabKey === 'enemy_1513_dekght' ? null : ({ kind: 'secondaryAreaAttack', params: r => ({ scale: r.talents.bb['aoe.attack@bsthmr_range.atk_scale'],
      shape: 'plus', radius: 1, type: 'phys', tag: 'demolitionSplash' }) }),
    explains: /^Attacks cause an explosion, dealing Splash damage to units around the primary target\.$/,
    note: 'Full primary melee hit, separate 50% ATK Physical splash to the four orthogonal neighboring tiles, excluding the primary and airborne units.',
  },
});
