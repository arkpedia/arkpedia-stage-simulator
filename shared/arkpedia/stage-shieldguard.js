// SPDX-License-Identifier: GPL-3.0-or-later
// Shieldguard (trap_024_npcsld, PRTS 盾卫): an ally-side placed blocker (M8-6, PL-5, VI-1 and Integrated Strategies).
// - Root: side 1 (ally), category 1, one mode, not withdrawable, block radius² 0.5, melee build tile.
// - Default mode: an ordinary attack (`_attackType` 1 melee, `_damageType` 1 Physical, ATK x1, no cooldown of its own,
//   so the record's 4 s base attack time paces it) on one target (`_maxNum` 1) selected by an enemy-side, ground-only
//   selector (`_targetMotion` 1) that skips DISABLE_COMBAT (flag 20) and SHELTERING (combo 1) targets, in range 0-1:
//   its own tile, so it hits what it blocks (block 3).
// - Common abilities: `hpsts_unhealable` (HEAL_FREE, flag 7, for life) and two battle-log buffs (no effect).
// - Skill sktok_npcsld (passive, 列阵！): `npcsld_skill` adds the blackboard `taunt_level` (1) to TAUNT_LEVEL (attribute 20).
// - Record: 20000 HP, 700 ATK, 1000 DEF, 60 RES at every level (both key frames equal).
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const STAT_KEYS = ['maxHp', 'atk', 'def', 'magicResistance', 'blockCnt', 'baseAttackTime', 'attackSpeed'];

export function shieldguardNativeReviewed(e = native, t = tables) {
  const prefab = e.prefabs?.trap_024_npcsld, skillPrefab = e.prefabs?.sktok_npcsld;
  if (!prefab || !skillPrefab) return false;
  const rows = prefab.components.map(x => x.data), byPath = id => prefab.components.find(x => x.pathId === String(id))?.data;
  const root = rows.find(x => '_modes' in x);
  if (root?._modes?.length !== 1 || root._commonAbilities?.length !== 2) return false;
  const mode = byPath(root._modes[0].m_PathID), attack = byPath(mode?._attack?.m_PathID);
  const trigger = byPath(mode?._attackTrigger?.m_PathID);
  const selector = rows.find(x => '_targetSide' in x && '_postFilter' in x), range = rows.find(x => '_useBlackboardRangeId' in x);
  const common = root._commonAbilities.map(ref => byPath(ref.m_PathID));
  const unhealable = common.find(x => x?._buffs?.[0]?.buffKey === 'hpsts_unhealable');
  const logs = common.find(x => x?._buffs?.every(b => /^log_/.test(b.templateKey)));
  const S = e.statusDefinitions ?? {};
  const skillBuff = skillPrefab.components.map(x => x.data).find(x => x._buffs)?._buffs;
  const skillAccount = skillPrefab.components.map(x => x.data).find(x => '_canCastWithNoSp' in x);
  const record = t.devices?.trap_024_npcsld, frames = record?.phases?.[0]?.attributesKeyFrames ?? [];
  const level = t.skills?.sktok_npcsld?.levels;
  return root._sideType === 1 && root._category === 1 && root._withdrawable === 0 && root._blockRadiusSquare === .5
    && root._motionMode === 0 && root._blockMode === 0 && root._buildCondition?.buildableType === 1
    && mode._combat?.m_PathID === mode._attack?.m_PathID && mode._generalAbilities?.length === 0
    && attack?._attackType === 1 && attack._damageType === 1 && attack._atkScale === 1 && attack._cooldown === 0
    && attack._activeBuffs?.length === 0 && attack._elementDamageType === 0 && attack._extraDamageType === 0 && attack._animKey === 'Attack'
    && trigger?._minTargetNum === 1 && range?._useBlackboardRangeId === 0
    && selector?._targetSide === 2 && selector._targetMotion === 1 && selector._targetCategory === 1 && selector._postFilter === 4
    && selector._abnormalFlag === S.DISABLE_COMBAT && S.DISABLE_COMBAT === 20 && selector._abnormalCombo === S.SHELTERING && S.SHELTERING === 1
    && selector._maxNum === 1 && selector._limitTargetNum === 1 && selector._needProfessionMask === 0 && selector._sortByTauntAtLast === 0
    && unhealable?._buffs.length === 1 && same(unhealable._buffs[0].attributes.abnormalFlags, [S.HEAL_FREE]) && S.HEAL_FREE === 7
    && unhealable._buffs[0].lifeTimeType === 2 && unhealable._buffs[0].attributes.attributeModifiers.length === 0
    && logs?._buffs.every(b => b.attributes.attributeModifiers.length === 0 && b.attributes.abnormalFlags.length === 0)
    && skillBuff?.length === 1 && skillBuff[0].attributes.attributeModifiers.length === 1
    && skillBuff[0].attributes.attributeModifiers[0].attributeType === S.TAUNT_LEVEL && S.TAUNT_LEVEL === 20
    && skillBuff[0].attributes.attributeModifiers[0].loadFromBlackboard === 1 && skillBuff[0].attributes.attributeModifiers[0].formulaItem === 0
    && skillBuff[0].lifeTimeType === 2 && skillAccount?._canCastWithNoSp === 0
    && record?.profession === 'TRAP' && record.phases.length === 1 && record.phases[0].rangeId === '0-1'
    && same(t.ranges?.['0-1']?.grids, [{ row: 0, col: 0 }])
    && frames.length === 2 && STAT_KEYS.every(k => frames[0].data[k] === frames[1].data[k])
    && level?.length === 1 && level[0].skillType === 'PASSIVE' && same(level[0].blackboard.map(x => [x.key, x.value]), [['taunt_level', 1]]);
}

/** Reviewed Shieldguard stats; the instance level does not change them. */
export function shieldguardDefinition(instance) {
  if (!shieldguardNativeReviewed() || !instance || !Number.isSafeInteger(instance.level) || instance.level < 1 || instance.level > 30
    || instance.skillLevel !== 1 || !['UP', 'RIGHT', 'DOWN', 'LEFT'].includes(instance.direction)) throw Error('Unsupported original Shieldguard instance');
  const d = tables.devices.trap_024_npcsld.phases[0].attributesKeyFrames[0].data;
  const taunt = tables.skills.sktok_npcsld.levels[0].blackboard[0].value;
  return Object.freeze({ kind: 'shieldguard', hp: d.maxHp, atk: d.atk, def: d.def, res: d.magicResistance, block: d.blockCnt,
    bat: d.baseAttackTime, aspd: d.attackSpeed, taunt, direction: instance.direction,
    description: `Blocks ${d.blockCnt} and strikes one blocked ground enemy for ${d.atk} Physical damage every ${d.baseAttackTime} s. More likely to be attacked; cannot be healed.` });
}
