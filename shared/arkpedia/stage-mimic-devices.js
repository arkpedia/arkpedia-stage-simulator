// SPDX-License-Identifier: GPL-3.0-or-later
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import { passiveOutcomeBuff, sameOutcomeValue as same } from './enemy-outcome-contracts.js';
const node = (name, fields) => ({ $type: `Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`, ...fields });

export function mimicDeviceNativeReviewed(id, n = native) {
  if (id !== 'trap_758_skzmbx') return false;
  const parts = n.prefabs[id]?.components ?? [], by = new Map(parts.map(c => [c.pathId, c.data]));
  const get = r => r?.m_FileID === 0 ? by.get(r.m_PathID) : null;
  const root = parts.find(c => c.object === id)?.data, mode = get(root?._modes?.[0]), attack = get(mode?._attack);
  const skills = n.prefabs.sktok_skzmbx?.components.map(c => c.data) ?? [];
  const wrapper = skills.find(c => c.m_Script?.m_PathID === '-2816356044270894278');
  const passive = skills.find(c => c.m_Script?.m_PathID === '3800760148018415462'), buff = passive?._buffs?.[0];
  return root?._sideType === 2 && root._category === 1 && root._occupiedRemainingCharacterCnt === 0
    && root._withdrawable === 0 && root._rewriteTileOptions === 0 && root._modes.length === 1
    && root._commonAbilities.length === 0 && root._traitAbility.m_PathID === '0'
    && root._customInitHpRatio === 0 && root._isInfinity === 0 && root._filterTag.length === 0
    && mode?._generalAbilities.length === 0 && mode._combat.m_PathID === '0'
    && attack?._selector.m_PathID === '0' && attack._activeBuffs.length === 0 && attack._preDelay === 0
    && get(mode._attackTrigger)?.m_Script.m_PathID === '248012603862317511'
    && skills.length === 2 && wrapper?._extraAbilities.length === 0 && wrapper._canSilenced === 0
    && passive?._selector.m_PathID === '0' && passive._buffs.length === 1
    && passiveOutcomeBuff(buff) && buff.templateKey === 'trap_badbox_s' && buff.buffKey === 'smbbox_s' && buff.blackboard.length === 0
    && same(n.templates.trap_badbox_s?.eventToActions, { ON_TAKE_DAMAGE: [
      node('PickRandomBranchPhase', { _notRepeatInOneLoop: false, _blockGameFinish: false }),
      node('InstantKill', { _targetType: 'TARGET', _killSource: false, _noSource: false, _withdrawIfRallyPoint: false,
        _resultIfInRallyPointMode: false, _skipReborn: false, _noReason: false, _markReachExit: false, _switchState: false }),
    ] });
}
