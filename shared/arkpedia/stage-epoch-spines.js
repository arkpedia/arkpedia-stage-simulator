// SPDX-License-Identifier: GPL-3.0-or-later
import { sameOutcomeValue as same, passiveOutcomeBuff as passive, nativeKillLog } from './enemy-outcome-contracts.js';
const fields = (v, x) => !!v && Object.entries(x).every(([k, expected]) => same(v[k], expected));
const zero = ref => ref?.m_FileID === 0 && ref.m_PathID === '0';
const action = (name, fields) => ({ $type: `Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`, ...fields });
export function epochSpinesNativeReviewed(id, n) {
  if (id !== 'trap_760_skztzs') return false;
  const rows = n.prefabs[id]?.components ?? [], byId = new Map(rows.map(c => [c.pathId, c.data]));
  const get = ref => ref?.m_FileID === 0 ? byId.get(ref.m_PathID) : null;
  const root = rows.find(c => c.object === id)?.data, mode = get(root?._modes?.[0]), passiveAbility = get(root?._commonAbilities?.[0]);
  if (!fields(root, { _sideType: 2, _category: 1, _occupiedRemainingCharacterCnt: 0, _withdrawable: 0,
    _rewriteTileOptions: 0, _motionMode: 0, _isInfinity: 0, _customInitHpRatio: 0, _filterTag: [] })
    || root._modes.length !== 1 || root._commonAbilities.length !== 1 || !zero(root._traitAbility)
    || !zero(mode?._attack) || !zero(mode._attackTrigger) || !zero(mode._combat) || mode._generalAbilities.length
    || !fields(passiveAbility, { _selector: { m_FileID: 0, m_PathID: '0' }, _ignoreIfOwnerDead: 0 })
    || passiveAbility._buffs.length !== 3) return false;
  const [protection, mark, log] = passiveAbility._buffs;
  if (!fields(protection, { buffKey: 'skztzs_a[feature]', templateKey: 'empty', blackboard: [] })
    || !same(protection.attributes.abnormalImmunes, [0, 16]) || !same(protection.attributes.abnormalComboImmunes, [0])
    || !passive({ ...protection, attributes: { ...protection.attributes, abnormalImmunes: [], abnormalComboImmunes: [] } })
    || !passive(mark) || !fields(mark, { buffKey: 'skztzs_self_mark', templateKey: 'empty', blackboard: [] })
    || !passive(log) || !fields(log, { buffKey: 'skztzs_a[log_killed]', templateKey: 'log_killed', blackboard: [] })
    || !nativeKillLog({ $template: key => n.templates[key] })) return false;
  const talent = rows.find(c => c.object === '1' && c.data._buffs)?.data;
  return talent?._buffs.length === 1 && zero(talent._selector) && passive(talent._buffs[0])
    && fields(talent._buffs[0], { buffKey: 'skztzs_t[apoptosis]', templateKey: 'skztzs_t[apoptosis]', blackboard: [] })
    && same(n.templates['skztzs_t[apoptosis]']?.eventToActions, {
      ON_BUFF_START: [action('UnitSummonApopsisEnemy', { _source: 'BUFF_OWNER', _enemyKey: 'enemy_2088_skzdwz',
        _motionMode: 'FLY', _unharmful: false, _alwaysCountAsKilled: false, _addBuffToEnemy: false, _buffToEnemy: null })],
      ON_BUFF_FINISH: [action('HostKillSummonedApopsisEnemy', { _source: 'BUFF_OWNER' })],
    });
}
