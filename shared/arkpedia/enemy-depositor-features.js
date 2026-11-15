// SPDX-License-Identifier: GPL-3.0-or-later
import { sameOutcomeValue as same, passiveOutcomeBuff } from './enemy-outcome-contracts.js';
import { carapaceDefinition } from './device-runtime.js';
const fields = (v, expected) => !!v && Object.entries(expected).every(([k, x]) => same(v[k], x));
export function depositorNative(r, n) {
  if (r.prefabKey !== 'enemy_1434_dsshel' || r.skills.length || Object.keys(r.talents.groups).length
    || r.applyWay !== 'MELEE' || r.stats.dmgType !== 'phys' || r.stats.tauntLevel !== 1) return false;
  const buff = n['0']?.find(c => '_buffs' in c)?._buffs;
  const events = n.$template('dsshel_t_1')?.eventToActions, spawn = events?.ON_OWNER_KILLED?.[0];
  if (buff?.length !== 1 || !passiveOutcomeBuff(buff[0]) || buff[0].templateKey !== 'dsshel_t_1'
    || !same(Object.keys(events ?? {}), ['ON_OWNER_KILLED']) || events.ON_OWNER_KILLED.length !== 1
    || spawn.$type !== 'Torappu.Battle.Action.Nodes+SpawnTokenOnTargetTileWithCondition, Assembly-CSharp'
    || !fields(spawn, { _sourceType: 'SOURCE', _targetType: 'BUFF_OWNER', _specifierSideType: true,
      _spawnedTokenSideType: 'ALLY', _checkBuildableType: false, _tileFromBlackboard: false,
      _buffs: [], _tileBlackList: 'tile_start|tile_end|tile_telin|tile_telout' })
    || !fields(spawn._options, { buildableType: 'MELEE', allowNoneBuildableType: false,
      passableMask: 'ALL', allowNonePassableMask: false, checkBuildableOrPassable: true,
      heightType: 'LOWLAND', checkHeightType: true, checkTileMode: false, checkTileMoveCost: true,
      moveCostCompareType: 'EQUALS', moveCostThreshold: 1 })
    || !same(spawn._tokenToSpawn, { uniEquipIds: [], showSpIllust: false,
      inst: { characterKey: 'trap_156_dsshell', level: 1, phase: 'PHASE_0', favorPoint: 0, potentialRank: 0 },
      skillIndex: 0, mainSkillLvl: 1, skinId: null, tmplId: null, overrideSkillBlackboard: null })) return false;
  try { carapaceDefinition({ level: 1, skillLevel: 1 }); } catch { return false; }
  return true;
}
export const DEPOSITOR_FEATURE = {
  matchesRecord: r => r.prefabKey === 'enemy_1434_dsshel', covers: depositorNative,
  ability: { kind: 'depositor', params: () => ({}) },
};
