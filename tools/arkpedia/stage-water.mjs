// SPDX-License-Identifier: GPL-3.0-or-later
import { readOriginalLevel } from './original-level.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import native from '../../data/arkpedia-water-source.json' with { type: 'json' };

export function waterNativeReviewed(evidence = native) {
  const rows = evidence.prefabs?.sktok_tidectrl_3?.components ?? [];
  const aura = rows.find(r => r.object === 'Enemy' && r.data._targetValidator)?.data;
  const validator = rows.find(r => r.pathId === aura?._targetValidator.m_PathID)?.data;
  const buff = aura?._buffs?.[0], modifiers = buff?.attributes.attributeModifiers;
  const wrapper = rows.find(r => r.data._wrappedAbilities)?.data;
  const root = rows.find(r => r.data._trigger)?.data;
  const marker = rows.find(r => r.object === 'All' && r.data._targetValidator)?.data;
  const markerValidator = rows.find(r => r.pathId === marker?._targetValidator.m_PathID)?.data;
  const damage = evidence.templates?.periodic_damage_without_modify_no_fx?.eventToActions.ON_BUFF_TRIGGER;
  const validTile = key => {
    const tile = evidence.prefabs?.[key]?.components.find(r => r.data._tileKey === key)?.data;
    const marker = tile?._dynamicBuffs?.[0]?.buffs;
    return tile?._clearBuffsWhenLeft === 1 && tile._targetOptions.targetMotion === 1
      && tile._targetOptions.targetCategory === 1 && tile._targetOptions.ignoreTargetFree === 1
      && tile._targetOptions.ignoreTargetSide === 1 && tile._advancedBuildableMask === 2
      && marker?.length === 1 && marker[0].buffKey === 'under_sea[tile]' && marker[0].templateKey === 'empty';
  };
  return rows.length === 7 && aura?._forceTick === 1 && Math.abs(aura._interval - .2) < 1e-7
    && aura._removeBuffWhenAbilityDetached === 1 && aura._buffs.length === 2 && aura._passiveBuffs.length === 0
    && validator?._excludeKey === 0 && validator._buffs.join() === 'under_sea[tile]'
    && validator._targetOptions.targetSide === 2 && validator._targetOptions.targetMotion === 1
    && validator._targetOptions.targetCategory === 1 && validator._targetOptions.ignoreTargetFree === 1
    && buff.buffKey === 'sea_drown[enemy]' && buff.templateKey === 'periodic_damage_without_modify_no_fx'
    && buff.overrideKey === 'under_sea' && buff.maxStackCnt === 1 && buff.lifeTimeType === 2
    && buff.triggerInterval === 1 && buff.waitFirstTriggerInterval === 0 && buff.isSilenceable === 0
    && modifiers?.length === 2 && modifiers[0].attributeType === 7 && modifiers[0].formulaItem === 1
    && modifiers[1].attributeType === 6 && modifiers[1].formulaItem === 3 && modifiers.every(m => m.loadFromBlackboard === 1)
    && wrapper?._isInfinity === 1 && wrapper._preDelay === 0 && wrapper._wrappedAbilities.length === 2
    && wrapper._wrappedAbilities.every(ref => rows.some(r => r.pathId === ref.m_PathID && [aura, marker].includes(r.data)))
    && root?._allowNoTarget === 1 && root._canCastDuringBorn === 1 && root._extraAbilities.length === 0
    && root._defaultModeIndex === -1 && root._isRemoteControlled === 0
    && marker?._buffs.length === 1 && marker._buffs[0].buffKey === 'buff_sea' && marker._buffs[0].templateKey === 'empty'
    && markerValidator?._buffs.join() === 'under_sea[tile]' && markerValidator._excludeKey === 0
    && markerValidator._targetOptions.targetMotion === 1 && markerValidator._targetOptions.ignoreTargetSide === 1
    && damage?.length === 1 && damage[0]._damageType === 'PURE' && damage[0]._damageWithoutModify
    && damage[0]._ignoreForSp && !damage[0]._isEnvDamage && validTile('tile_deepsea') && validTile('tile_codpsea');
}

/** Permanent water is one reusable contact effect; timed tidal controllers
 * retain a separate blocker until their scheduled activation is implemented. */
export function compileStageWater(level, geometry, devices, evidence = native) {
  const originals = (level.predefines?.tokenInsts ?? []).filter(p => p.inst?.characterKey === 'trap_042_tidectrl');
  const exported = devices.filter(d => d.key === 'trap_042_tidectrl');
  if (!originals.length && !exported.length) return null;
  if (!waterNativeReviewed(evidence)) throw Error('Unreviewed permanent deep-water source');
  if (originals.length !== 1 || exported.length !== 1) throw Error('Unsupported overlapping water controllers');
  const p = originals[0], d = exported[0];
  if (p.skillIndex !== 2 || p.hidden !== false) throw Error('Scheduled tide activation requires a controller');
  if (p.position.row !== d.row || p.position.col !== d.col || p.hidden !== d.hidden
    || p.inst.level !== 1 || ![0, 'PHASE_0'].includes(p.inst.phase) || p.inst.favorPoint !== 0 || p.inst.potentialRank !== 0
    || p.uniEquipIds?.length || p.masterInfos?.length || p.overrideTalents != null || p.tmplId)
    throw Error('Unsupported permanent water instance');
  if ((level.waves ?? []).some(w => w.fragments.some(f => f.actions.some(a => a.key === p.alias || a.key === d.key))))
    throw Error('Scheduled tide activation requires a controller');
  const skill = evidence.skill.levels[p.mainSkillLvl - 1];
  if (!skill || skill.prefabId !== 'sktok_tidectrl_3' || skill.spData.spType !== 8 || skill.spData.spCost !== 0)
    throw Error('Unsupported permanent water skill');
  const bb = Object.fromEntries(skill.blackboard.map(v => [v.key, v.value])), seen = new Set();
  for (const value of p.overrideSkillBlackboard ?? []) {
    if (seen.has(value.key) || !Number.isFinite(value.value) || value.valueStr != null && value.valueStr !== ''
      || !['sea_drown[enemy].damage', 'sea_drown[enemy].attack_speed', 'sea_drown[enemy].move_speed', 'duration'].includes(value.key))
      throw Error(`Unsupported permanent water parameter: ${value.key}`);
    seen.add(value.key); bb[value.key] = value.value;
  }
  const damage = bb['sea_drown[enemy].damage'], aspd = bb['sea_drown[enemy].attack_speed'] * 100, moveMul = bb['sea_drown[enemy].move_speed'];
  if (!(damage >= 0 && damage <= 1e9 && aspd >= -100 && aspd <= 0 && moveMul > 0 && moveMul <= 1))
    throw Error('Invalid permanent water values');
  const tiles = [];
  for (const tile of level.mapData?.tiles ?? []) if (['tile_deepsea', 'tile_codpsea'].includes(tile.tileKey)
    && (tile.blackboard?.length || tile.effects?.length)) throw Error('Unsupported permanent water tile parameters');
  geometry.tileGrid.forEach((cells, row) => cells.forEach((type, col) => {
    const tile = geometry.tileLegend[type];
    if (['tile_deepsea', 'tile_codpsea'].includes(tile.key)) tiles.push([row, col]);
  }));
  return { kind: 'permanent-deep-water', tiles, damage, aspd, moveMul, scanInterval: .2, damageInterval: 1 };
}

export async function prepareStageWater({ root, rules, geometry, devices }) {
  if (!devices.some(d => d.key === 'trap_042_tidectrl')) return { water: null, sources: [] };
  const { level, source } = await readOriginalLevel(root, rules);
  const water = compileStageWater(level, geometry, devices);
  const path = 'data/arkpedia-water-source.json';
  return { water, sources: [source, { path, sha256: createHash('sha256').update(await readFile(join(root, path))).digest('hex') }] };
}
