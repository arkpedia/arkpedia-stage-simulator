// SPDX-License-Identifier: GPL-3.0-or-later
import { isCannoneer, cannoneerNative, CANNONEER_ABILITY, CANNONEER_TEXT } from './enemy-firelight-ranged-features.js';
import { isCleanupSquad, CLEANUP_SQUAD_POWER_ATTACK } from './enemy-cleanup-squad-features.js';
import clocks from '../../data/arkpedia-wine-animations.json' with { type: 'json' };
export const brokenBlades = r => ['enemy_1207_sfji', 'enemy_1207_sfji_2'].includes(r.prefabKey);
const node = (a, name) => a?.$type === `Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
export const porcelainCaster = r => ['enemy_1205_sfpin', 'enemy_1205_sfpin_2'].includes(r.prefabKey);
export function porcelainCasterNative(r, n) {
  if (!porcelainCaster(r) || r.applyWay !== 'RANGED' || r.stats.dmgType !== 'arts' || r.skills.length !== 1
    || r.sp?.type !== 'INCREASE_WHEN_ATTACK' || r.sp.maxSp !== 5 || r.sp.initSp !== 3 || r.sp.increment !== 1
    || Object.keys(r.talents.bb).join() !== 'DeadSpawn.cnt' || r.talents.bb['DeadSpawn.cnt'] !== 1
    || Object.keys(r.talents.bbStr).join() !== 'DeadSpawn.enemy_key'
    || r.talents.bbStr['DeadSpawn.enemy_key'] !== `enemy_1206_msfpin${r.prefabKey.endsWith('_2') ? '_2' : ''}`) return false;
  const s = r.skills[0], bb = s.bb, root = n[r.prefabKey]?.[0], mode = n.$ref(root?._modes?.[0]);
  const attack = n.$ref(mode?._attack), power = n.PowerAttack?.find(c => '_projectileKey' in c);
  const wrapper = n.PowerAttack?.find(c => '_familyMask' in c), selector = n.$siblings(mode?._attackTrigger).find(c => '_targetSide' in c);
  const animation = n.$ref(root?._animator), clock = clocks.enemies[r.prefabKey];
  if (s.prefabKey !== 'PowerAttack' || s.spCost !== 5 || s.cooldown !== 5 || s.initCooldown !== 0
    || Object.keys(bb).sort().join() !== 'atk_scale_add,atk_scale_init,duration,times'
    || bb.atk_scale_init !== .3 || bb.atk_scale_add !== .3 || bb.times !== 4 || bb.duration !== 20
    || Object.keys(s.bbStr).length || root?._modes.length !== 1 || root._commonAbilities.length
    || mode?._generalAbilities.length || n.$ref(mode._combat) !== attack
    || selector?._targetSide !== 2 || selector._targetMotion !== 1 || selector._targetCategory !== 1
    || selector._maxNum !== 1 || selector._ignoreTargetFree !== 0 || selector._forceIgnoreCamouflage !== 0
    || wrapper?._familyMask !== 3 || wrapper._ignoreSilence !== 0 || wrapper._resetMainAbilityCdWhenCastEnd !== 0
    || !clock || n.$ref(animation?._skeleton)?.skeletonDataAsset.m_PathID !== clock.source.skeletonDataPathId) return false;
  for (const [cast, clip, projectile] of [[attack, 'Attack', 'projectile_enemy_sfpin'], [power, 'Skill', 'projectile_enemy_sfpin_ex']]) {
    const binding = animation._animations.find(a => a.animKey === clip), events = clock.events[clip];
    if (cast?._projectileKey !== projectile || cast._damageType !== 2 || cast._atkScale !== 1 || cast._attackType !== 1
      || cast._selectTargetSource !== 2 || cast._timeMode !== 0 || cast._waitForAttackEvent !== 1
      || cast._animKey !== clip || cast._affectedBySlowDown !== 1 || cast._useCachedAtkOnly !== 0
      || binding?.animName !== clip || binding.speed !== 1 || binding.loop !== 0
      || clock.durations[clip] !== Math.fround(55 / 30) || events?.length !== 1
      || events[0].name !== 'OnAttack' || events[0].time !== Math.fround(25 / 30)) return false;
    const components = n.$projectile(projectile), motion = components.find(c => '_speed' in c), life = components.find(c => '_lifeTime' in c);
    if (motion?._speed !== 10 || motion._flyToTargetLocationOnly !== 0 || motion._forceReachedWhenTimeup !== 1
      || life?._lifeTime !== 10 || life._maxHitNum !== 1 || life._hitNumType !== 1 || life._stopWhenSourceInvalid !== 0
      || life._alwaysHitTraceTargetInTheEnd !== 1 || life._canHitSameTargetMultipleTimes !== 0
      || life._actionController._dontAddBuffs !== 0 || life._actionController._extraBuffsInTheEnd.length) return false;
  }
  const buff = power._activeBuffs[0];
  if (attack._activeBuffs.length || power._activeBuffs.length !== 1 || buff.templateKey !== 'enemy_sfpin_power_attack[resist]'
    || buff.statusResistable !== 1 || buff.isSilenceable !== 0 || buff.isDamageMissable !== 0 || buff.disableOverride !== 1) return false;
  const parent = n.$template('enemy_sfpin_power_attack[resist]')?.eventToActions.ON_BUFF_START;
  const child = parent?.[0]?._buff, actions = n.$template('enemy_sfpin_power_attack[real]')?.eventToActions;
  const pulse = actions?.ON_BUFF_TRIGGER, start = actions?.ON_BUFF_START;
  if (parent?.length !== 1 || !node(parent[0], 'CreateBuff') || child?.templateKey !== 'enemy_sfpin_power_attack[real]'
    || child.disableOverride !== true || child.triggerInterval !== 1 || child.waitFirstTriggerInterval !== false
    || start?.length !== 1 || start[0]._blackboardKeys !== 'triggered_cnt_add' || start[0]._value !== 1
    || pulse?.length !== 5 || !node(pulse[0], 'ApplyCacheAtkDamageFromBuff') || pulse[0]._damageScaleKey !== 'atk_scale_init'
    || pulse[0]._damageType !== 'MAGICAL' || pulse[0]._applyWay !== 'NONE' || pulse[0]._attackType !== 'BUFF'
    || !node(pulse[1], 'ModifyBlackboard') || pulse[1]._blackboardKeys !== 'triggered_cnt'
    || pulse[1]._fromBlackboardKeys !== 'triggered_cnt_add' || !pulse[1]._addBasedOriginValue
    || !node(pulse[2], 'FilterByBlackboardValue') || pulse[2]._blackboardKey !== 'triggered_cnt'
    || pulse[2]._anotherKeyToCompare !== 'times' || pulse[2]._condType !== 'GE'
    || pulse[3]._blackboardKeys !== 'triggered_cnt' || pulse[3]._value !== 0 || pulse[3]._addBasedOriginValue
    || pulse[4]._blackboardKeys !== 'atk_scale_init' || pulse[4]._fromBlackboardKeys !== 'atk_scale_add' || !pulse[4]._addBasedOriginValue) return false;
  const death = n.$template('enemy_dead_spawn')?.eventToActions.ON_OWNER_KILLED;
  return n.DeadSpawn?.[0]?._buffs?.[0]?.templateKey === 'enemy_dead_spawn'
    && death?.some(a => node(a, 'FilterDeathReason') && a._finishReason === 'FALLDOWN')
    && death.some(a => node(a, 'SummonEnemiesFollowMyRoute') && a._randomOffsetBound === .5
      && a._useRandomDelay && a._randomDelayRange === Math.fround(.7) && a._managedByScheduler && !a._dontBlockWave);
}
export const PORCELAIN_FEATURES = {
  // The Cleanup Squads share the key: they dispatch to their own contract (enemy-cleanup-squad-features.js).
  'skill:PowerAttack': { matchesRecord: r => isCannoneer(r) || porcelainCaster(r) || isCleanupSquad(r),
    covers: (r,n) => isCleanupSquad(r) ? CLEANUP_SQUAD_POWER_ATTACK.covers(r,n) : isCannoneer(r) ? cannoneerNative(r,n) : porcelainCasterNative(r,n), nativeClaim: () => ({ wrappers: 1, active: 0 }),
    ability: r => isCleanupSquad(r) ? CLEANUP_SQUAD_POWER_ATTACK.ability : isCannoneer(r) ? CANNONEER_ABILITY : porcelainCaster(r) ? { kind: 'porcelainCaster', params: r => ({ initialSp: r.sp.initSp, cost: r.skills[0].spCost,
      cooldown: r.skills[0].cooldown, initialScale: r.skills[0].bb.atk_scale_init, increment: r.skills[0].bb.atk_scale_add,
      every: r.skills[0].bb.times, duration: r.skills[0].bb.duration,
      attackAnim: { dur: clocks.enemies[r.prefabKey].durations.Attack, hit: clocks.enemies[r.prefabKey].events.Attack[0].time } }) } : null,
    explains: (text, r) => isCleanupSquad(r) ? CLEANUP_SQUAD_POWER_ATTACK.explains(text) : text === CANNONEER_TEXT || /^After several attacks, inflicts continuous Arts damage that slowly increases over time \(can be <\$ba.buffres>Resisted<\/>\)$/.test(text) },
};
export function brokenBladesNative(r, n) {
  if (!brokenBlades(r) || r.skills.length || r.applyWay !== 'MELEE' || r.stats.dmgType !== 'phys') return false;
  const elite = r.prefabKey.endsWith('_2'), atkKey = elite ? 'AtkUp.atk' : 'Atkup.atk';
  if (Object.keys(r.talents.bb).length !== 3 || r.talents.bb['DeadSpawn.cnt'] !== 4
    || r.talents.bb['DeadSpawn.cnt_add'] !== -1 || r.talents.bb[atkKey] !== (elite ? .8 : .7)
    || Object.keys(r.talents.bbStr).join() !== 'DeadSpawn.enemy_key'
    || r.talents.bbStr['DeadSpawn.enemy_key'] !== `enemy_1208_msfji${elite ? '_2' : ''}`) return false;
  const root = n[r.prefabKey]?.[0], clock = clocks.enemies[r.prefabKey];
  if (root?._modes.length !== 2 || root._commonAbilities.length || !clock
    || n.$ref(n.$ref(root._animator)?._skeleton)?.skeletonDataAsset.m_PathID !== clock.source.skeletonDataPathId) return false;
  for (const ref of root._modes) {
    const mode = n.$ref(ref), attack = n.$ref(mode?._combat);
    if (mode?._generalAbilities.length || attack?._damageType !== 1 || attack._atkScale !== 1
      || attack._activeBuffs.length || attack._selectTargetSource !== 2 || attack._timeMode !== 0
      || attack._animKey !== 'Attack' || attack._waitForAttackEvent !== 1) return false;
  }
  const buff = n.AtkUp?.[0]?._buffs?.[0], mod = buff?.attributes.attributeModifiers;
  if (buff?.buffKey !== 'enemy_sfji_atkup' || buff.templateKey !== 'empty' || buff.isSilenceable !== 0
    || buff.lifeTimeType !== 2 || mod?.length !== 1 || mod[0].attributeType !== 1
    || mod[0].formulaItem !== 1 || mod[0].loadFromBlackboard !== 1
    || n.DeadSpawn?.[0]?._buffs?.[0]?.templateKey !== 'enemy_dead_spawn[sfji]') return false;
  const events = n.$template('enemy_dead_spawn[sfji]')?.eventToActions, output = events?.ON_OUTPUT_ATK_OR_HEAL;
  const death = events?.ON_OWNER_KILLED, finish = events?.ON_ABILITY_FINISH;
  return output?.[0]?._blackboardKey === 'cnt' && output[0]._valueToCompare === 1 && output[0]._condType === 'GE'
    && node(output[1], 'ModifyBlackboard') && output[1]._fromBlackboardKeys === 'cnt_add' && output[1]._addBasedOriginValue
    && death?.[0]?._conditionNode?._valueToCompare === 0 && death[0]._succeedNodes?.[0]?._value === 1
    && node(death[1], 'FilterDeathReason') && death[1]._finishReason === 'FALLDOWN' && node(death[2], 'IfNot')
    && node(death[3], 'SummonEnemiesFollowMyRoute') && death[3]._managedByScheduler && !death[3]._dontBlockWave
    && death[3]._randomOffsetBound === .5 && death[3]._useRandomDelay && death[3]._randomDelayRange === Math.fround(.7)
    && finish?.[0]?._blackboardKey === 'cnt' && finish[0]._valueToCompare === 0 && finish[0]._condType === 'LE'
    && finish[1]._buffKey === 'enemy_sfji_atkup' && node(finish[2], 'SwitchMode') && finish[2]._modeIndex === 1;
}
export const BROKEN_BLADE_ABILITY = { kind: 'brokenBlades', params: r => ({
  count: r.talents.bb['DeadSpawn.cnt'], atk: r.talents.bb['Atkup.atk'] ?? r.talents.bb['AtkUp.atk'],
  child: r.talents.bbStr['DeadSpawn.enemy_key'],
  duration: clocks.enemies[r.prefabKey].durations.Attack, release: clocks.enemies[r.prefabKey].events.Attack[0].time,
}) };
export const BROKEN_BLADE_TEXT = /^Consumes Broken Blades to gain increased ATK$|^When defeated, each unconsumed Broken Blade will spawn a <(?:Bronze|Iron) Spearhead> \(minimum 1\)$/;

export const lampBearer = r => ['enemy_1209_sfden', 'enemy_1209_sfden_2'].includes(r.prefabKey);
export function lampBearerNative(r, n) {
  if (!lampBearer(r) || r.applyWay !== 'MELEE' || r.stats.dmgType !== 'arts' || r.stats.rawRangeRadius !== 2
    || r.skills.length !== 1 || Object.keys(r.talents.bb).length !== 2 || r.talents.bb['DeadSpawn.cnt'] !== 1
    || r.talents.bb['InvisibleShield.duration'] !== 3
    || r.talents.bbStr['DeadSpawn.enemy_key'] !== `enemy_1210_msfden${r.prefabKey.endsWith('_2') ? '_2' : ''}`) return false;
  const s = r.skills[0], root = n[r.prefabKey]?.[0], clock = clocks.enemies[r.prefabKey];
  const cast = n.InvisibleShield?.find(c => '_activeBuffs' in c), wrapper = n.InvisibleShield?.find(c => '_familyMask' in c);
  const aura = n.AuraInvisible?.[0], envelope = n.InvisibleShield?.find(c => '_wrappedAbilities' in c);
  const selector = n.$ref(aura?._targetValidator), geometry = n.$siblings(aura), mode = n.$ref(root?._modes?.[0]);
  const attack = n.$ref(mode?._attack);
  if (s.prefabKey !== 'InvisibleShield' || s.cooldown !== 15 || s.initCooldown !== 5 || s.spCost !== 0
    || Object.keys(s.bb).join() !== 'duration' || s.bb.duration !== (r.prefabKey.endsWith('_2') ? 3 : 5)
    || root?._modes.length !== 1 || root._commonAbilities.length || mode?._generalAbilities.length
    || attack?._damageType !== 2 || attack._atkScale !== 1 || attack._selectTargetSource !== 2
    || wrapper?._ignoreSilence !== 1 || wrapper._familyMask !== 3 || wrapper._resetMainAbilityCdWhenCastEnd !== 0
    || cast?._animKey !== 'Skill' || cast._timeMode !== 1 || cast._waitForAttackEvent !== 1 || cast._affectedBySlowDown !== 1
    || n.$ref(cast._selector)?.m_Script?.m_PathID !== '8735719249224227112'
    || envelope?._metadata.namedAsAlias !== 'InvisibleShieldAbility' || envelope._isInfinity !== 0
    || envelope._durationKey !== 'duration' || envelope._wrappedAbilities.length !== 1
    || n.$ref(envelope._wrappedAbilities[0]) !== aura
    || aura?._selfOption !== 2 || aura._removeBuffWhenTargetLeave !== 1 || aura._removeBuffWhenAbilityDetached !== 1
    || aura._buffs.length !== 1 || aura._buffs[0].templateKey !== 'enemy_sfden_invisible' || aura._buffs[0].isSilenceable !== 0
    || selector?._targetOptions.targetSide !== 1 || selector._targetOptions.targetCategory !== 1 || selector._targetOptions.targetMotion !== 3
    || !geometry.some(c => c.m_Radius === 1 && c.m_Offset.x === 0 && c.m_Offset.y === 0)
    || !clock || n.$ref(n.$ref(root._animator)?._skeleton)?.skeletonDataAsset.m_PathID !== clock.source.skeletonDataPathId) return false;
  let actions; try { actions = JSON.parse(cast._actions.SerializedState); } catch { return false; }
  const template = n.$template('enemy_sfden_invisible')?.eventToActions;
  if (actions?.length !== 2 || actions[0]._abilityName !== 'InvisibleShieldAbility') return false;
  for (const event of ['ON_BUFF_START', 'ON_OWNER_BLOCKEE_CHANGED']) {
    const branch = template?.[event]?.[0];
    if (!node(branch?._conditionNode, 'CheckBlocked') || !node(branch._succeedNodes?.[0], 'FinishDerivedBuff')
      || branch._failNodes?.[0]?._buff?.attributes.abnormalFlags.join() !== 'INVISIBLE'
      || branch._failNodes[0]._buff.isSilenceable) return false;
  }
  const death = n.$template('enemy_dead_spawn')?.eventToActions.ON_OWNER_KILLED;
  return n.DeadSpawn?.[0]?._buffs[0].templateKey === 'enemy_dead_spawn'
    && death?.some(a => node(a, 'SummonEnemiesFollowMyRoute') && a._randomOffsetBound === .5
      && a._useRandomDelay && a._randomDelayRange === Math.fround(.7));
}
export const LAMP_FEATURES = {
  'talent:InvisibleShield': { covers: lampBearerNative },
  'skill:InvisibleShield': { covers: lampBearerNative, nativeClaim: () => ({ wrappers: 1, active: 0 }),
    ability: { kind: 'lampBearer', params: r => ({ radius: r.stats.rawRangeRadius, auraDuration: r.talents.bb['InvisibleShield.duration'],
      initial: r.skills[0].initCooldown, cooldown: r.skills[0].cooldown,
      duration: clocks.enemies[r.prefabKey].durations.Skill, release: clocks.enemies[r.prefabKey].events.Skill[0].time }) },
    explains: /^Periodically grants temporary <\$ba.invisible>Invisibility<\/> to surrounding enemy units$/ },
};
