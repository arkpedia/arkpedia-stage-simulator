// SPDX-License-Identifier: GPL-3.0-or-later
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };
const parts = n => n.prefabs.trap_161_lrcage?.components.map(c => c.data) ?? [];
export function witheredAltarNativeReviewed(n = native) {
  const rows = parts(n), root = rows.find(c => '_modes' in c), mode = rows.find(c => '_combat' in c);
  const buffs = rows.flatMap(c => c._buffs ?? []), passive = buffs.find(c => c.buffKey === 'trap_stormcoord_passive');
  const spawn = n.templates['trap_stormcoord[summon_and_suicide]']?.eventToActions.ON_OWNER_FINISH;
  return root?._sideType === 2 && root._category === 1 && root._modes.length === 1
    && root._occupiedRemainingCharacterCnt === 0 && root._withdrawable === 0 && root._rewriteTileOptions === 0
    && root._buildCondition.buildableType === 1 && root._buildCondition.isTryingOverlapCharacater === 0
    && mode?._combat.m_PathID === '0' && mode._generalAbilities.length === 0
    && passive?.attributes.abnormalImmunes.join() === '0,23,16,25,12'
    && passive.attributes.abnormalComboImmunes.join() === '0'
    && buffs.some(c => c.templateKey === 'trap_stormcoord[summon_and_suicide]' && c.lifeTimeType === 2 && c.isSilenceable === 0)
    && spawn?.length === 1 && spawn[0]._enemyKey === 'enemy_1421_lrchld' && spawn[0]._waitTime === 9999
    && spawn[0]._unharmful === true && spawn[0]._alwaysCountAsKilled === false && spawn[0]._spawnOffset === 0
    && spawn[0]._useSourceEndPosition === false && spawn[0]._targetTileViaBb === false;
}
export function witheredAltarDefinition(instance) {
  if (!witheredAltarNativeReviewed() || !Number.isSafeInteger(instance.level) || instance.level < 1 || instance.level > 30
    || instance.elite !== 0 || instance.potential !== 0 || instance.skill_index !== 0 || instance.skill_level !== 1)
    throw Error('Unsupported Withered Altar instance');
  const phase = tables.devices.trap_161_lrcage.phases[0], [a, z] = phase.attributesKeyFrames;
  const skill = tables.skills.sktok_lrcage.levels[0];
  if (skill.skillType !== 'PASSIVE' || skill.prefabId !== null || skill.blackboard.length) throw Error('Changed Withered Altar skill');
  return { kind: 'withered-altar', supplyCard: true, side: 'enemy', obstacle: false, destructible: true,
    hp: Math.round(a.data.maxHp + (z.data.maxHp - a.data.maxHp) * (instance.level - a.level) / (z.level - a.level)),
    cost: a.data.cost, cooldown: a.data.respawnTime, block: 0, groundBuildOnly: true, retreatable: false, refundRatio: 0,
    range: [], child: 'enemy_1421_lrchld', wait: 9999,
    description: 'Enemy-side altar. Destroy it to release a Beacon at this location. Does not block the route or occupy an operator slot. Cannot be retreated.' };
}
