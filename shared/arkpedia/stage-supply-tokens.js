// SPDX-License-Identifier: GPL-3.0-or-later
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };
import animation from '../../data/arkpedia-mrboom-animations.json' with { type: 'json' };
const zero = r => r?.m_FileID === 0 && r.m_PathID === '0';
export function stunTokenNativeReviewed(evidence = native) {
  const rows = evidence.prefabs.trap_018_bomb?.components.map(c => c.data) ?? [];
  const root = rows.find(c => '_modes' in c), mode = rows.find(c => '_attackTrigger' in c);
  const attack = rows.find(c => c._metadata?.namedAsAlias === 'Bomb'), selector = rows.find(c => '_targetSide' in c);
  const withdraw = rows.find(c => '_onlyCheckOnStopAffect' in c)?._buffs?.[0];
  const skill = evidence.prefabs.sktok_bomb?.components.map(c => c.data) ?? [];
  const controller = skill.find(c => '_allowSpRecoveryWhenAffecting' in c), buff = skill.find(c => '_buffs' in c)?._buffs?.[0];
  const trigger = evidence.templates.bomb_s?.eventToActions.ON_BUFF_START, exit = evidence.templates.suicide?.eventToActions.ON_BUFF_START;
  return root?._modes.length === 1 && root._occupiedRemainingCharacterCnt === 0 && root._category === 2 && root._sideType === 1
    && root._buildCondition.buildableType === 1 && !root._buildCondition.isTryingOverlapCharacater && root._withdrawable === 1
    && root._commonAbilities.length === 1 && mode?._generalAbilities.length === 0 && zero(mode._combat)
    && attack?._waitForAttackEvent === 1 && attack._affectedBySlowDown === 0 && attack._selectTargetTiming === 1
    && attack._allowNoTarget === 1 && attack._activeBuffs.length === 1 && attack._activeBuffs[0].buffKey === 'stun'
    && attack._activeBuffs[0].loadFromDB === 1 && attack._actions.SerializedState === '[]'
    && selector?._targetSide === 2 && selector._targetMotion === 3 && selector._limitTargetNum === 0 && selector._ignoreTargetFree === 0
    && withdraw?.templateKey === 'suicide' && controller?._attackBlackboardModeIndex === 0 && controller._attachInDummy === 1
    && buff?.templateKey === 'bomb_s' && trigger?.length === 1 && trigger[0]._abilityName === 'Bomb' && !trigger[0]._castDirectly
    && exit?.length === 1 && exit[0].$type === 'Torappu.Battle.Action.Nodes+Withdraw, Assembly-CSharp'
    && exit[0]._withdrawSource && exit[0]._switchToDeadState
    && animation.events.Start[0].time === .5 && animation.events.Attack[0].time === 1.5 && animation.durations.Attack === 1.5
    && rows.find(c => 'skeletonDataAsset' in c)?.skeletonDataAsset.m_PathID === animation.source.skeletonDataPathId;
}
export function stunTokenDefinition(instance) {
  if (!stunTokenNativeReviewed() || !Number.isSafeInteger(instance.level) || instance.level < 1 || instance.level > 30
    || instance.elite !== 0 || instance.potential !== 0 || instance.skill_index !== 0 || instance.skill_level !== 1)
    throw Error('Unsupported Mr. Boom instance');
  const record = tables.devices.trap_018_bomb, skill = tables.skills.sktok_bomb.levels[0];
  const bb = Object.fromEntries(skill.blackboard.map(p => [p.key, p.value]));
  if (skill.skillType !== 'PASSIVE' || bb['attack@duration'] !== animation.durations.Attack) throw Error('Changed Mr. Boom skill');
  return { groundBuildOnly: true, supplyCard: true, obstacle: false, cooldown: record.phases[0].attributesKeyFrames[0].data.respawnTime,
    maxActive: 1, release: animation.events.Start[0].time + animation.events.Attack[0].time,
    stun: bb['attack@stun'], range: tables.ranges[skill.rangeId].grids.map(p => [p.row, p.col]) };
}
