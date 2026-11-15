// SPDX-License-Identifier: GPL-3.0-or-later
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };
const rows = n => n.prefabs.trap_016_peon?.components.map(c => c.data) ?? [];
export function workerNativeReviewed(n = native) {
  const parts = rows(n), root = parts.find(c => '_modes' in c), attack = parts.find(c => c._animKey === 'Attack');
  const select = parts.find(c => '_targetCategory' in c), withdrawal = parts.flatMap(c => c._buffs ?? []).find(b => b.buffKey === 'trap_peon[withdraw]');
  const end = n.templates['suicide_after_buff[switch_to_dead]']?.eventToActions.ON_BUFF_FINISH;
  return root?._category === 2 && root._sideType === 1 && root._modes.length === 1
    && root._occupiedRemainingCharacterCnt === 0 && root._withdrawable === 1 && root._withdrawCostRecoverRatio === 0
    && root._buildCondition.buildableType === 3 && root._buildCondition.needSpecifyDirection === 1
    && root._buildCondition.isTryingOverlapCharacater === 0 && root._rewriteTileOptions === 0
    && select?._targetSide === 1 && select._targetCategory === 2 && select._targetMotion === 3
    && select._filterTag === 'tree' && select._tagExcluded === 0 && select._postFilter === 4
    && select._limitTargetNum === 1 && select._maxNum === 1 && select._ignoreTargetFree === 0
    && attack?._waitForAttackEvent === 0 && attack._preDelay === Math.fround(.566)
    && attack._timeMode === 2 && attack._cooldown === 1 && attack._affectedBySlowDown === 0
    && attack._attackType === 1 && attack._damageType === 1 && attack._atkScale === 1 && attack._activeBuffs.length === 0
    && withdrawal?.templateKey === 'suicide_after_buff[switch_to_dead]' && withdrawal.lifeTimeType === 1
    && withdrawal.isSilenceable === 0 && withdrawal.isStunnable === 0 && withdrawal.isFreezable === 0
    && end?.length === 1 && end[0]._withdrawSource === true && end[0]._switchToDeadState === true;
}
export function workerDefinition(instance) {
  if (!workerNativeReviewed() || !Number.isSafeInteger(instance.level) || instance.level < 1 || instance.level > 30
    || instance.elite !== 0 || instance.potential !== 0 || instance.skill_index !== -1 || ![0, 1].includes(instance.skill_level))
    throw Error('Unsupported Temporary Employee instance');
  const record = tables.devices.trap_016_peon, stats = record.phases[0].attributesKeyFrames[0].data;
  const duration = record.talents[0].candidates[0].blackboard.find(p => p.key === 'duration')?.value;
  if (record.skills.length || stats.atk !== 13 || duration !== 9) throw Error('Changed Temporary Employee parameters');
  return { kind: 'worker', supplyCard: true, obstacle: false, hp: stats.maxHp, atk: stats.atk,
    cost: stats.cost, cooldown: stats.respawnTime, refundRatio: 0, anyBuildOnly: true, block: 0, chooseFacing: true,
    interval: 1, windup: rows(native).find(c => c._animKey === 'Attack')._preDelay, duration,
    range: tables.ranges[record.phases[0].rangeId].grids.map(p => [p.row, p.col]),
    description: 'Chops the Giant Mushroom directly ahead for 13 Physical damage each second. Cleared Mushrooms leave a ranged deployment tile. Automatically withdraws after 9 seconds; retreat gives no refund.' };
}
