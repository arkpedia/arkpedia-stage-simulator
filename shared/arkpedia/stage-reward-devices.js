// SPDX-License-Identifier: GPL-3.0-or-later
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };
import { nativeKillLog, passiveOutcomeBuff } from './enemy-outcome-contracts.js';
import { rescueDeviceNativeReviewed } from './stage-rescue-devices.js';
import { mimicDeviceNativeReviewed } from './stage-mimic-devices.js';
import { epochSpinesNativeReviewed } from './stage-epoch-spines.js';

export function rewardDeviceNativeReviewed(id, n = native) {
  if (id === 'trap_760_skztzs') return epochSpinesNativeReviewed(id, n);
  if (id === 'trap_758_skzmbx') return mimicDeviceNativeReviewed(id, n);
  if (id === 'trap_759_skzwyx') return rescueDeviceNativeReviewed(id, n);
  if (id !== 'trap_757_skzbox') return false;
  const parts = n.prefabs[id]?.components ?? [], by = new Map(parts.map(c => [c.pathId, c.data]));
  const get = ref => ref?.m_FileID === 0 ? by.get(ref.m_PathID) : null;
  const root = parts.find(c => c.object === id)?.data, mode = get(root?._modes?.[0]);
  const helper = get(root?._commonAbilities?.[0]), buff = helper?._buffs?.[0], attack = get(mode?._attack);
  return root?._sideType === 2 && root._category === 1 && root._occupiedRemainingCharacterCnt === 0
    && root._withdrawable === 0 && root._rewriteTileOptions === 0 && root._modes.length === 1
    && root._commonAbilities.length === 1 && root._traitAbility.m_PathID === '0'
    && root._customInitHpRatio === 0 && root._isInfinity === 0 && root._filterTag.length === 0
    && mode?._generalAbilities.length === 0 && mode._combat.m_PathID === '0'
    && attack?._selector.m_PathID === '0' && attack._activeBuffs.length === 0 && attack._preDelay === 0
    && helper?._selector.m_PathID === '0' && helper._buffs.length === 1
    && helper.m_Script.m_PathID === '3800760148018415462'
    && buff?.attributes.abnormalImmunes.join() === '0,16,12'
    && passiveOutcomeBuff({ ...buff, attributes: { ...buff.attributes, abnormalImmunes: [] } })
    && buff.templateKey === 'log_killed' && buff.buffKey === 'skzbox_t'
    && JSON.stringify(buff.blackboard) === JSON.stringify([{ key: 'key', value: 0, valueStr: id }])
    && nativeKillLog({ $template: key => n.templates[key] });
}

export function rewardDeviceDefinition(id, instance) {
  if (!rewardDeviceNativeReviewed(id) || !Number.isSafeInteger(instance?.level) || instance.level < 1 || instance.level > 30
    || instance.skillLevel !== 1) throw Error(`Unsupported reward device: ${id}`);
  const record = tables.devices[id], frames = record.phases[0].attributesKeyFrames;
  const a = frames[0], z = frames.at(-1), t = (instance.level - a.level) / (z.level - a.level);
  const value = key => Math.round(a.data[key] + (z.data[key] - a.data[key]) * t);
  if (id === 'trap_760_skztzs') {
    if (record.skills.length || record.talents.length !== 1 || record.talents[0].candidates.length !== 1
      || record.talents[0].candidates[0].prefabKey !== '1' || record.talents[0].candidates[0].rangeId !== 'x-4'
      || record.talents[0].candidates[0].blackboard.length) throw Error('Unsupported Epoch spines talent');
    return { unitId: id, name: 'Spines of Epoch', hp: value('maxHp'), def: value('def'), res: value('magicResistance'),
      block: value('blockCnt'), taunt: value('tauntLevel'), side: 'enemy', counter: 'killed',
      immune: ['stun', 'frozen', 'sleep'], epochChild: 'enemy_2088_skzdwz' };
  }
  const skill = tables.skills[record.skills[0].skillId].levels[0];
  const mimic = id === 'trap_758_skzmbx';
  if (skill.skillType !== 'PASSIVE' || skill.prefabId !== (mimic ? 'sktok_skzmbx' : null) || skill.blackboard.length)
    throw Error('Unsupported reward device skill');
  if (mimic && (typeof instance.branchId !== 'string' || !instance.branchId)) throw Error('Missing mimic branch binding');
  const rescue = id === 'trap_759_skzwyx';
  return { unitId: id, name: mimic ? 'Stagnant Contraption' : rescue ? 'Dying Fowlbeast' : 'Treasure Chest', hp: value('maxHp'), def: value('def'), res: value('magicResistance'),
    block: value('blockCnt'), taunt: value('tauntLevel'), counter: id, side: rescue ? 'ally' : 'enemy', rescue, mimic,
    ...(mimic ? { branchId: instance.branchId } : {}), immune: mimic ? [] : rescue ? ['stun'] : ['stun', 'frozen', 'silence'] };
}
