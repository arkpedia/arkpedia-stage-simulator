// SPDX-License-Identifier: GPL-3.0-or-later
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };
const rows = (n, id) => n.prefabs[id]?.components.map(c => c.data) ?? [];
export function sceneryNativeReviewed(id, n = native) {
  if (!['trap_001_crate', 'trap_015_tree'].includes(id)) return false;
  const parts = rows(n, id), root = parts.find(c => '_modes' in c), tree = id === 'trap_015_tree';
  if (root?._modes.length !== 1 || root._sideType !== 1 || root._occupiedRemainingCharacterCnt !== 0
    || root._category !== (tree ? 2 : 4) || root._withdrawable !== (tree ? 0 : 1)
    || root._rewriteTileOptions !== (tree ? 0 : 1) || root._blockRadiusSquare !== (tree ? .5 : Math.fround(.2))) return false;
  if (!tree) {
    const tile = parts.find(c => '_tileOptions' in c)?._tileOptions;
    const skill = tables.skills.sktok_crate.levels[0];
    return root._withdrawCostRecoverRatio === .5 && root._buildCondition.buildableType === 1
      && root._ignoreBlockAnyRoutes === 0 && tile?.passableMask === 0 && tile.buildableType === 0
      && tile.overrideObstacleLikeMoveCost === 1 && skill.prefabId === null && skill.skillType === 'PASSIVE'
      && skill.blackboard.length === 0;
  }
  const skill = rows(n, 'sktok_tree'), aura = skill.find(c => '_removeBuffWhenTargetLeave' in c);
  const buff = aura?._buffs[0], select = skill.find(c => '_targetOptions' in c)?._targetOptions;
  return root._filterTag.join() === 'tree' && aura?._removeBuffWhenTargetLeave === 1
    && aura._removeBuffWhenAbilityDetached === 1 && aura._buffs.length === 1
    && buff.templateKey === 'empty' && buff.buffKey === 'tree_s_1' && buff.disableOverride === 0
    && buff.independentCharacterSource === 0 && buff.isSilenceable === 0 && buff.lifeTimeType === 2
    && buff.attributes.attributeModifiers.length === 1 && buff.attributes.attributeModifiers[0].attributeType === 2
    && buff.attributes.attributeModifiers[0].formulaItem === 0 && buff.attributes.attributeModifiers[0].loadFromBlackboard === 1
    && select?.targetSide === 1 && select.targetCategory === 1 && select.targetMotion === 3
    && select.ignoreTargetFree === 0 && select.ignoreAllyTargetFree === 1;
}
export function sceneryDefinition(id, instance) {
  if (!sceneryNativeReviewed(id) || !Number.isSafeInteger(instance?.level) || instance.level < 1 || instance.level > 30
    || instance.skillLevel !== 1) throw Error(`Unsupported scenery instance: ${id}`);
  const record = tables.devices[id], stats = record.phases[0].attributesKeyFrames[0].data;
  const root = rows(native, id).find(c => '_modes' in c), tree = id === 'trap_015_tree';
  const skill = tables.skills[record.skills[0].skillId].levels[0];
  return { unitId: id, kind: tree ? 'mushroom' : 'obstacle', name: tree ? 'Giant Mushroom' : 'Roadblock',
    hp: stats.maxHp, def: stats.def, res: stats.magicResistance, block: stats.blockCnt, taunt: stats.tauntLevel,
    cost: stats.cost, cooldown: stats.respawnTime, refundRatio: root._withdrawCostRecoverRatio,
    blockRadiusSquare: root._blockRadiusSquare, range: tables.ranges[skill.rangeId]?.grids.map(p => [p.row, p.col]) ?? [],
    ...(tree ? { passive: true, defense: skill.blackboard.find(p => p.key === 'def').value, statusLabel: 'Natural cover active',
      description: 'Adjacent allied characters gain 150 DEF. Multiple Mushrooms do not stack. Cannot be retreated.' }
      : { groundBuildOnly: true, supplyCard: true, obstacle: 'crate',
        description: 'Changes enemy routes and blocks up to three enemies. Enemies can destroy it when blocked. Retreat to clear the tile.' }) };
}
export function roadblockDefinition(instance) {
  if (instance.elite !== 0 || instance.potential !== 0 || ![0, -1].includes(instance.skill_index)
    || !Number.isSafeInteger(instance.level) || instance.level < 0 || instance.level > 30)
    throw Error('Unsupported Roadblock supply card');
  // Original 7-12 serializes level zero. The attribute curve clamps to its
  // first frame; -1 omits a passive skill with no prefab or effects.
  return sceneryDefinition('trap_001_crate', { level: Math.max(1, instance.level), skillLevel: instance.skill_level });
}
