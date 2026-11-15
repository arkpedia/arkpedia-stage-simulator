// SPDX-License-Identifier: GPL-3.0-or-later
import { imprisonmentNativeReviewed } from './stage-imprisonment.js';
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };
const rows = (key, evidence) => (evidence.prefabs[key]?.components ?? []).map(c => c.data);
const zero = ref => ref?.m_FileID === 0 && ref.m_PathID === '0';
const permanent = b => b?.lifeTimeType === 2 && b.isSilenceable === 0;
function terminalReviewed(evidence) {
  const device = rows('trap_008_farm', evidence), root = device.find(c => '_modes' in c);
  const modes = device.filter(c => '_tileOptions' in c), buffs = device.flatMap(c => c._buffs ?? []);
  const free = buffs.find(b => b.buffKey === 'farm_target_free'), talent = buffs.find(b => b.buffKey === 'farm_t_1');
  const skill = rows('sktok_farm', evidence), account = skill.find(c => '_allowSpRecoveryWhenAffecting' in c);
  const cast = skill.find(c => '_waitForCasting' in c), [upgrade, mode] = cast?._buffs ?? [];
  const life = evidence.templates?.farm_t_1?.eventToActions, limit = evidence.templates?.farm_s_1?.eventToActions;
  const [lose] = life?.ON_OWNER_FINISH ?? [], [grant] = limit?.ON_BUFF_START ?? [];
  const events = evidence.templates?.switch_mode_restart_fsm?.eventToActions;
  const [enter] = events?.ON_BUFF_START ?? [], [leave] = events?.ON_BUFF_FINISH ?? [];
  return root?._modes.length === 2 && root._commonAbilities.length === 1 && root._sideType === 1 && root._category === 1
    && root._occupiedRemainingCharacterCnt === 0 && root._withdrawable === 0 && root._filterTag.join() === 'building'
    && modes.length === 2 && modes.every(m => zero(m._combat) && zero(m._attack)
      && m._tileOptions.passableMask === 2 && m._tileOptions.buildableType === 0)
    && permanent(free) && free.attributes.abnormalFlags.join() === '7,15'
    && permanent(talent) && talent.templateKey === 'farm_t_1'
    && account?._allowSpRecoveryWhenAffecting === 0 && account._canCastWithNoSp === 0
    && account._allowNoTarget === 1 && account._canSilenced === 0 && account._checkHasTargetBeforeDoCast === 0
    && cast?._waitForCasting === 0 && cast._preDelay === 0 && cast._ignoreInfiniteBuffCooldown === 0
    && cast._enableUpdateCooldown === 0 && cast._buffs.length === 2
    && permanent(upgrade) && upgrade.templateKey === 'farm_s_1'
    && upgrade.attributes.attributeModifiers.map(m => `${m.attributeType}:${m.formulaItem}:${m.loadFromBlackboard}:${m.fetchBaseValueFromSourceEntity}`).join() === '2:1:1:0,3:0:1:0,13:0:1:0'
    && permanent(mode) && mode.templateKey === 'switch_mode_restart_fsm' && mode.blackboard.length === 1
    && mode.blackboard[0].key === 'mode' && mode.blackboard[0].value === 1
    && Object.keys(life ?? {}).join() === 'ON_OWNER_FINISH' && life.ON_OWNER_FINISH.length === 1
    && lose.$type === 'Torappu.Battle.Action.Nodes+ModifyLifePoint, Assembly-CSharp'
    && lose._sourceType === 'SOURCE' && lose._isSub === false && lose._blackboardKey === 'value' && lose._isReachExit === false
    && Object.keys(limit ?? {}).join() === 'ON_BUFF_START' && limit.ON_BUFF_START.length === 1
    && grant.$type === 'Torappu.Battle.Action.Nodes+ModifyCharacterLimit, Assembly-CSharp'
    && grant._sourceType === 'SOURCE' && grant._blackboardKey === 'value' && grant._isMins === false && grant._getPlayerSideSource === false
    && Object.keys(events ?? {}).sort().join() === 'ON_BUFF_FINISH,ON_BUFF_START'
    && events.ON_BUFF_START.length === 1 && events.ON_BUFF_FINISH.length === 1
    && [enter, leave].every(e => e.$type === 'Torappu.Battle.Action.Nodes+SwitchMode, Assembly-CSharp' && e._restartFSM && e._targetType === 'TARGET')
    && enter._modeIndex === 1 && enter._loadModeFromBlackboard && !enter._restoreDefault
    && leave._modeIndex === 0 && !leave._loadModeFromBlackboard && leave._restoreDefault;
}
export function manualDeviceNativeReviewed(key, evidence = native) {
  if (key === 'trap_025_prison') return imprisonmentNativeReviewed(evidence);
  if (key === 'trap_008_farm') return !!terminalReviewed(evidence);
  if (!['trap_002_emp', 'trap_005_sensor'].includes(key)) return false;
  const device = rows(key, evidence), root = device.find(c => '_modes' in c), mode = device.find(c => '_tileOptions' in c);
  const passive = device.find(c => c._buffs?.[0]?.attributes?.abnormalFlags?.includes(5));
  if (!root || root._modes.length !== 1 || root._commonAbilities.length || root._sideType !== 1
    || root._occupiedRemainingCharacterCnt !== 0 || root._filterTag.length
    || !zero(mode?._combat) || !zero(mode._attack) || mode._generalAbilities.length !== 1
    || passive?._buffs.length !== 1 || passive._buffs[0].attributes.abnormalFlags.join() !== '5'
    || passive._buffs[0].lifeTimeType !== 2 || passive._buffs[0].isSilenceable !== 0) return false;
  const skill = rows(key === 'trap_002_emp' ? 'sktok_emp' : 'sktok_sensor', evidence);
  const account = skill.find(c => '_allowSpRecoveryWhenAffecting' in c);
  if (!account || account._allowSpRecoveryWhenAffecting !== 0 || account._canCastWithNoSp !== 0
    || account._allowNoTarget !== 1 || account._canSilenced !== 0 || account._checkHasTargetBeforeDoCast !== 0) return false;
  if (key === 'trap_002_emp') {
    const attack = skill.find(c => '_damageType' in c), selector = skill.find(c => '_targetSide' in c);
    const withdrawal = skill.find(c => '_runActionOnEvent' in c), actions = JSON.parse(withdrawal?._actions?.SerializedState ?? '[]');
    const stun = attack?._activeBuffs?.[0];
    return attack?._damageType === 2 && attack._attackType === 1 && attack._atkScale === 1
      && attack._preDelay === .75 && attack._cooldown === 1.5 && attack._timeMode === 2
      && attack._waitForAttackEvent === 0 && attack._affectedBySlowDown === 0 && attack._selectTargetTiming === 1
      && attack._activeBuffs.length === 1 && stun.durationKey === 'stun' && stun.lifeTimeType === 1
      && stun.isDamageMissable === 0 && stun.statusResistable === 2 && stun.attributes.abnormalFlags.join() === '0'
      && selector?._targetSide === 2 && selector._targetMotion === 1 && selector._ignoreTargetFree === 1
      && selector._limitTargetNum === 0 && withdrawal?._runActionOnEvent === 3 && withdrawal._onlyRunOnce === 1
      && actions.length === 1 && actions[0].$type === 'Torappu.Battle.Action.Nodes+Withdraw'
      && actions[0]._withdrawSource && actions[0]._switchToDeadState && actions[0]._force;
  }
  const aura = skill.find(c => '_removeBuffWhenTargetLeave' in c), validator = skill.find(c => '_targetOptions' in c);
  const duration = skill.find(c => '_wrappedAbilities' in c), buff = aura?._buffs?.[0];
  return aura?._removeBuffWhenTargetLeave === 1 && aura._removeBuffWhenAbilityDetached === 1
    && aura._buffs.length === 1 && buff.attributes.abnormalImmunes.join() === '9'
    && buff.attributes.attributeModifiers.length === 0 && buff.lifeTimeType === 2 && buff.isSilenceable === 0
    && validator?._targetOptions.targetSide === 2 && validator._targetOptions.targetMotion === 3
    && validator._targetOptions.ignoreTargetFree === 1 && duration?._preDelay === 0 && duration._isInfinity === 0;
}

/** Level and skill rank belong to the original instance; assets and source
 * records stay shared. Static devices currently admit the reviewed first skill. */
export function manualDeviceDefinition(key, instance) {
  if (!manualDeviceNativeReviewed(key) || !instance || !Number.isSafeInteger(instance.level)
    || instance.level < 1 || instance.level > 90 || instance.skillLevel !== 1)
    throw Error(`Missing or unsupported manual device instance: ${key}`);
  if (key === 'trap_025_prison' && (instance.level > 30 || !['UP', 'RIGHT', 'DOWN', 'LEFT'].includes(instance.direction)))
    throw Error('Unsupported Imprisonment Device direction or level');
  const record = tables.devices[key], skill = tables.skills[record.skills[0].skillId].levels[0];
  const [first, last] = [record.phases[0].attributesKeyFrames[0], record.phases[0].attributesKeyFrames.at(-1)];
  const fraction = Math.min(1, Math.max(0, (instance.level - first.level) / (last.level - first.level)));
  const bb = Object.fromEntries(skill.blackboard.map(x => [x.key, x.value]));
  const stat = key => Math.round(first.data[key] + (last.data[key] - first.data[key]) * fraction);
  const kind = { trap_002_emp: 'blast', trap_005_sensor: 'reveal', trap_008_farm: 'terminal', trap_025_prison: 'prison' }[key];
  const result = { kind, position: record.position, spCost: skill.spData.spCost,
    initSp: skill.spData.initSp, spPerSecond: skill.spData.increment, dpCost: bb.cost ?? 0,
    range: tables.ranges[skill.rangeId]?.grids.map(p => [p.row, p.col]) ?? [], duration: skill.duration,
    ...(kind === 'prison' ? { stats: { hp: stat('maxHp'), def: stat('def'), res: stat('magicResistance'), block: 0,
      spRecovery: stat('spRecoveryPerSec') },
      taunt: stat('tauntLevel'), stun: bb.stun, finish: Math.fround(4.17), direction: instance.direction, immune: ['stun', 'frozen'] } : {}),
    ...(kind === 'terminal' ? { permanent: true, stats: { hp: stat('maxHp'), def: stat('def'), res: stat('magicResistance') },
      taunt: stat('tauntLevel'), slots: bb.value, mods: { defPct: bb.def, resFlat: bb.magic_resistance, hpRegen: bb.hp_recovery_per_sec },
      lifeDelta: record.talents[0].candidates[0].blackboard.find(p => p.key === 'value').value } : {}),
    ...(kind === 'blast' ? { damage: stat('atk'),
      stun: bb.stun, release: .75, finish: 1.5 } : {}) };
  if (kind === 'prison') {
    if (skill.skillType !== 'MANUAL' || skill.spData.spCost !== 25 || skill.spData.initSp !== 0
      || skill.spData.increment !== 1 || skill.duration !== 0 || skill.rangeId !== '3-15'
      || !Object.is(bb.cost, 5) || !Object.is(bb.stun, 2)) throw Error('Changed Imprisonment Device skill');
    result.range = result.range.map(([r, c]) => instance.direction === 'UP' ? [c, -r]
      : instance.direction === 'DOWN' ? [-c, r] : instance.direction === 'LEFT' ? [-r, -c] : [r, c])
      .map(pair => pair.map(value => value || 0));
  }
  result.description = kind === 'prison' ? `Spend ${result.dpCost} DP to stun enemies in range for ${result.stun} seconds and reconfine liberated prisoners. Already-confined attack counts are preserved.` : kind === 'blast'
    ? `Spend ${result.dpCost} DP to deal ${result.damage} Arts damage and stun nearby ground enemies for ${result.stun} seconds. This device is consumed after activation.`
    : kind === 'reveal' ? `Reveal invisible enemies in range for ${result.duration} seconds. Recharges after the effect ends.`
      : `Spend ${result.dpCost} DP to permanently add ${result.slots} deployment slot, increase this terminal's DEF and RES, and restore ${result.mods.hpRegen} HP per second. Lose ${-result.lifeDelta} life point if it is destroyed.`;
  return result;
}
