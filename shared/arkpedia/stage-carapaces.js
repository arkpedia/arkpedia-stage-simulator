// SPDX-License-Identifier: GPL-3.0-or-later
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };
import { sameOutcomeValue as same, emptyOutcomeAttributes as empty } from './enemy-outcome-contracts.js';
export const CARAPACE = 'trap_156_dsshell';
const fields = (v, expected) => !!v && Object.entries(expected).every(([k, x]) => same(v[k], x));
const is = (v, type) => v?.$type === `Torappu.Battle.Action.Nodes+${type}, Assembly-CSharp`;
export function carapaceNativeReviewed(n = native) {
  const parts = n.prefabs[CARAPACE]?.components.map(c => c.data) ?? [];
  const root = parts.find(c => '_modes' in c), mode = parts.find(c => '_tileOptions' in c), passive = parts.find(c => '_buffs' in c);
  if (!fields(root, { _sideType: 1, _category: 1, _occupiedRemainingCharacterCnt: 0, _withdrawable: 0,
      _rewriteTileOptions: 1, _ignoreBlockAnyRoutes: 1, _blockRadiusSquare: .5, _commonAbilities: [] })
    || root._modes.length !== 1 || !fields(mode, { _keepCurrentPassableMask: 1, _keepCurrentBuildableType: 0,
      _rewriteTileHeightType: 1, _rewriteTileHeight: 1, _rewriteHeight: Math.fround(.4), _generalAbilities: [] })
    || !fields(mode._tileOptions, { buildableType: 2, overrideObstacleLikeMoveCost: 1 })
    || passive?._buffs.length !== 2) return false;
  if (!fields(root._buildCondition.overlapOptions, { _verifySourceProfession: 1, _verifySourceProfessions: 639,
    _verifySourceId: 0, _excludeSourceId: 0, _verifySourceTargetTokenRelationship: 0 })) return false;
  const skillParts = n.prefabs.sktok_dsshell?.components.map(c => c.data) ?? [];
  if (!skillParts.some(c => c._canSilenced === 0 && same(c._extraAbilities, []))
    || !skillParts.some(c => c.m_Script?.m_PathID === '4865767822664548221' && c._selector?.m_PathID === '0')) return false;
  const [core, periodic] = passive._buffs;
  if (!fields(core, { templateKey: 'empty', lifeTimeType: 2, isSilenceable: 0 })
    || !same(core.attributes.abnormalFlags, [7, 2, 15]) || !same(core.attributes.abnormalImmunes, [0, 16, 25])
    || !same(core.attributes.abnormalComboImmunes, [0])
    || !fields(periodic, { templateKey: 'trap_156_dsshell_passive', lifeTimeType: 2, triggerInterval: .5,
      waitFirstTriggerInterval: 1, triggerLifeType: 2, isSilenceable: 0 }) || !empty(periodic.attributes)) return false;
  const events = n.templates.trap_156_dsshell_passive?.eventToActions;
  if (!events || !same(Object.keys(events), ['ON_OWNER_FINISH', 'ON_OWNER_OVERLAPPED', 'ON_BUFF_TRIGGER'])
    || events.ON_OWNER_FINISH.length !== 1 || !is(events.ON_OWNER_FINISH[0], 'KillCharacterOnTileIfExists')
    || !fields(events.ON_OWNER_FINISH[0], { _noSource: true, _skipReborn: false, _skipClearCharacterIfExists: false })
    || events.ON_OWNER_OVERLAPPED.length !== 3 || events.ON_BUFF_TRIGGER.length !== 2) return false;
  const [onIt, log, block] = events.ON_OWNER_OVERLAPPED;
  if (!is(onIt, 'CreateBuff') || !fields(onIt._buff, { templateKey: 'trap_156_dsshell[on_it]', lifeTimeType: 'INFINITY' })
    || onIt._buffOwner !== 'TARGET' || !is(log, 'LogExtraBattleInfo') || log._key !== 'dsshell_overlapped'
    || !is(block, 'CreateBuff') || block._buff.templateKey !== 'highland_common[block]'
    || !fields(events.ON_BUFF_TRIGGER[0], { _targetType: 'BUFF_OWNER', _tileKey: ['tile_creep', 'tile_creepf'], _isExclude: false })
    || !is(events.ON_BUFF_TRIGGER[1], 'SwitchDynamicBuffTileMode') || !fields(events.ON_BUFF_TRIGGER[1], { _operation: 'INDEX', _modeIndex: 0, _useOwnerRootTile: true })) return false;
  const ref = n.templates['trap_156_dsshell[on_it]']?.eventToActions.ON_BUFF_START;
  const card = n.templates['trap_156_dsshell[ref]']?.eventToActions.ON_OWNER_BEFORE_DEAD;
  const highland = n.templates['highland_common[block]']?.eventToActions.ON_BUFF_START;
  if (highland?.length !== 4 || !is(highland[0], 'CheckBlockMode') || highland[0]._blockMode !== 'WALK'
    || !is(highland[3], 'CreateBuff') || !same(highland[3]._buff.attributes.abnormalFlags, ['BLOCK_FREE'])) return false;
  if (ref?.length !== 1 || !is(ref[0], 'CreateBuffUseTargetAsSource')
    || !fields(ref[0], { _buffOwner: 'BUFF_SOURCE', _target: 'TARGET', _isDerivedBuff: false })
    || ref[0]._buff.templateKey !== 'trap_156_dsshell[ref]' || card?.length !== 1 || !is(card[0], 'CreateCardBuff')
    || !fields(card[0], { _target: 'BUFF_SOURCE', _lifeType: 'UNTIL_NEXT_SPAWN', _isRatio: true })) return false;
  const record = tables.devices[CARAPACE], skill = tables.skills.sktok_dsshell?.levels[0];
  return record?.profession === 'TRAP' && record.phases.length === 1 && record.phases[0].maxLevel === 30
    && same(record.talents[0].candidates[0].blackboard, [{ key: 'respawn_time', value: -.35, valueStr: null }])
    && skill?.skillType === 'PASSIVE' && skill.prefabId === 'sktok_dsshell' && skill.blackboard.length === 0;
}
export function carapaceDefinition(instance) {
  if (!carapaceNativeReviewed() || !Number.isSafeInteger(instance?.level) || instance.level < 1 || instance.level > 30
    || instance.skillLevel !== 1) throw Error('Unsupported Excrescent Carapace instance');
  const [a, z] = tables.devices[CARAPACE].phases[0].attributesKeyFrames;
  const ratio = (instance.level - a.level) / (z.level - a.level);
  const stat = key => Math.round(a.data[key] + (z.data[key] - a.data[key]) * ratio);
  return { unitId: CARAPACE, name: 'Excrescent Carapace', hp: stat('maxHp'), def: stat('def'),
    res: stat('magicResistance'), block: stat('blockCnt'), taunt: stat('tauntLevel'),
    blockRadiusSquare: .5, redeployRatio: -.35, scanInterval: .5, immune: ['stun', 'frozen', 'levitate', 'sleep'] };
}
