// SPDX-License-Identifier: GPL-3.0-or-later
import { vendor, vendorNative } from './enemy-snack-features.js';
import { taggedArtsBonusNative } from './enemy-tagged-projectile-features.js';
const IDS = new Set(['enemy_1213_mtrsnp', 'enemy_1213_mtrsnp_2', 'enemy_1214_mtrmgc', 'enemy_1214_mtrmgc_2']);
const zero = ref => ref?.m_FileID === 0 && ref.m_PathID === '0';
const sniper = r => r.prefabKey.startsWith('enemy_1213_');
const cannon = r => ['enemy_1216_cansld', 'enemy_1216_cansld_2'].includes(r.prefabKey);
const nuncio = r => ['enemy_1219_mtrbty', 'enemy_1219_mtrbty_2'].includes(r.prefabKey);
const positive = value => Number.isFinite(value) && value > 0;
function projectile(n, key, lifetime) {
  const p = n.$projectile(key), motion = p.find(c => '_speed' in c), life = p.find(c => '_lifeTime' in c);
  return motion?._speed === 10 && motion._moveType === 1 && motion._delayToStart === 0
    && motion._flyToTargetLocationOnly === 0 && motion._forceReachedWhenTimeup === 1
    && life?._lifeTime === lifetime && life._maxHitNum === 1 && life._hitNumType === 1
    && life._stopAfterMaxHit === 1 && life._stopWhenSourceInvalid === 0 && life._alwaysHitTraceTargetInTheEnd === 1
    && life._canHitSameTargetMultipleTimes === 0 && life._actionController?._extraBuffsInTheEnd?.length === 0;
}
function templates(n) {
  const events = n.$template('enemy_spmode_check')?.eventToActions, [choice] = events?.ON_BEFORE_ATTACK ?? [];
  const cond = choice?._conditionNode;
  const switched = (nodes, from, to) => nodes?.length === 2
    && nodes[0].$type === 'Torappu.Battle.Action.Nodes+CheckUnitCurrentMode, Assembly-CSharp'
    && nodes[0]._targetType === 'BUFF_OWNER' && nodes[0]._checkCurModeIndex === from && nodes[0]._loadCurModeBbKey === ''
    && nodes[1].$type === 'Torappu.Battle.Action.Nodes+SwitchMode, Assembly-CSharp'
    && nodes[1]._modeIndex === to && !nodes[1]._loadModeFromBlackboard && !nodes[1]._restoreDefault
    && !nodes[1]._restartFSM && nodes[1]._targetType === 'TARGET';
  const spendEvents = n.$template('enemy_spmode_sp_reduce')?.eventToActions, [spend] = spendEvents?.ON_BUFF_START ?? [];
  return Object.keys(events ?? {}).join() === 'ON_BEFORE_ATTACK' && events.ON_BEFORE_ATTACK.length === 1
    && choice.$type === 'Torappu.Battle.Action.Nodes+IfElse, Assembly-CSharp'
    && cond?.$type === 'Torappu.Battle.Action.Nodes+CheckHasSp, Assembly-CSharp'
    && cond._ownerType === 'BUFF_OWNER' && cond._checkHasSp === 1 && cond._checkKey === 'sp' && cond._condType === 'GE'
    && switched(choice._succeedNodes, 0, 1) && switched(choice._failNodes, 1, 0)
    && Object.keys(spendEvents ?? {}).join() === 'ON_BUFF_START' && spendEvents.ON_BUFF_START.length === 1
    && spend.$type === 'Torappu.Battle.Action.Nodes+ModifySp, Assembly-CSharp' && spend._targetType === 'BUFF_OWNER'
    && !spend._modifyByRatio && !spend._modifyBySpCost && !spend._isMinis && spend._forceFlag
    && spend._spMask === 'ALL' && spend._spString === 'sp' && spend._modifyValue === 0;
}
/** One native SP account controls the attack mode; Silence does not disable it. */
export function ammoNative(r, n) {
  if (cannon(r) || nuncio(r)) return meleeAmmoNative(r, n);
  if (!IDS.has(r.prefabKey) || r.applyWay !== 'RANGED' || r.skills.length
    || Object.keys(r.talents.groups).join() !== 'shotbuff'
    || r.sp?.type !== 'INCREASE_WITH_TIME' || r.sp.maxSp !== 1 || r.sp.initSp !== 1 || r.sp.increment !== 0) return false;
  const s = sniper(r), value = s ? 'atk_scale' : 'ep_damage_ratio';
  if (r.talents.groups.shotbuff.join() !== `attack@headshot_${value},attack@headshot_sp`
    || !positive(r.talents.bb[`shotbuff.attack@headshot_${value}`])
    || r.talents.bb['shotbuff.attack@headshot_sp'] !== -1) return false;
  const [root] = n[r.prefabKey] ?? [], [normal] = n.Default ?? [], [charged] = n[s ? 'HeadShot' : 'FireShot'] ?? [];
  const [passive] = n.ShotBuff ?? [], buff = passive?._buffs?.[0];
  if (!root || root._modes.length !== 2 || n.$ref(root._modes[0]) !== normal || n.$ref(root._modes[1]) !== charged
    || root._commonAbilities.length || root._showSpAsBulletMode !== 1 || root._hideBulletSpModes.length
    || !zero(passive?._selector) || passive._buffs.length !== 1 || buff.templateKey !== 'enemy_spmode_check'
    || buff.isSilenceable !== 0 || buff.lifeTimeType !== 2) return false;
  for (const [mode, powered] of [[normal, false], [charged, true]]) {
    const attack = n.$ref(mode?._attack), combat = n.$ref(mode?._combat);
    const trigger = n.$ref(mode?._attackTrigger), selection = n.$siblings(mode?._attackTrigger).find(c => '_targetSide' in c);
    if (!mode || mode._generalAbilities.length || !zero(attack?._selector)
      || attack._waitForAttackEvent !== 1 || attack._atkScale !== 1 || attack._activeBuffs.length
      || attack._attackType !== 1 || attack._damageType !== (s ? 1 : 2) || attack._useCachedAtkOnly !== 0
      || attack._elementDamageType !== (!s && powered ? 3 : 0) || attack._selectTargetSource !== 2
      || attack._metadata.blackboardPrefix !== (powered ? 'headshot_' : '')
      || attack._projectileKey !== `projectile_enemy_${s ? 'mtrsnp' : 'mtrmgc'}${powered ? '_headshot' : ''}`
      || !projectile(n, attack._projectileKey, s ? 5 : 10)
      || trigger?._minTargetNum !== 1 || trigger._keepTarget !== 0
      || selection?._targetSide !== 2 || selection._targetMotion !== 1 || selection._maxNum !== 1
      || selection._ignoreTargetFree !== 0 || selection._forceIgnoreCamouflage !== 0) return false;
    if (s && !powered) {
      if (combat?._damageType !== 1 || combat._attackType !== 1 || combat._atkScale !== 1
        || '_projectileKey' in combat || combat._activeBuffs.length) return false;
    } else if (combat !== attack) return false;
  }
  const spender = n.$siblings(charged._attack).find(c => '_runActionOnEvent' in c), debit = spender?._buffs?.[0];
  return spender?._runActionOnEvent === 4 && spender._extraCondition === 0 && spender._onlyRunOnce === 0
    && spender._buffs.length === 1 && debit.templateKey === 'enemy_spmode_sp_reduce'
    && debit.lifeTimeType === 0 && debit.isSilenceable === 0 && templates(n);
}
function meleeAmmoNative(r, n) {
  const c = cannon(r), count = c ? 2 : 1, logged = c || r.prefabKey === 'enemy_1219_mtrbty';
  if (r.applyWay !== 'ALL' || r.skills.length || Object.keys(r.talents.groups).join() !== 'shotbuff'
    || r.talents.groups.shotbuff.join() !== (c ? 'attack@headshot_atk_scale,attack@headshot_sp,attack@headshot_trapdamage' : 'attack@headshot_atk_scale,attack@headshot_disarmed_duration,attack@headshot_sp,attack@headshot_trapdamage')
    || !positive(r.talents.bb['shotbuff.attack@headshot_atk_scale']) || !positive(r.talents.bb['shotbuff.attack@headshot_trapdamage'])
    || r.talents.bb['shotbuff.attack@headshot_sp'] !== -1 || r.sp?.type !== 'INCREASE_WITH_TIME'
    || r.sp.maxSp !== count || r.sp.initSp !== count || r.sp.increment !== 0 || !templates(n)) return false;
  const [root] = n[r.prefabKey] ?? [], [normal] = n.Default ?? [], [charged] = n.HeadShot ?? [];
  const attack = n.$ref(charged?._attack), combat = n.$ref(normal?._combat);
  const [passive] = n.ShotBuff ?? [], buffs = passive?._buffs ?? [];
  const selection = n.$siblings(charged?._attackTrigger).find(c => '_targetSide' in c);
  if (!root || root._modes.length !== 2 || n.$ref(root._modes[0]) !== normal || n.$ref(root._modes[1]) !== charged
    || root._commonAbilities.length || root._showSpAsBulletMode !== 1 || normal._generalAbilities.length || charged._generalAbilities.length
    || !zero(normal._attack) || !zero(normal._attackTrigger) || n.$ref(charged._combat) !== attack
    || combat?._damageType !== (c ? 1 : 2) || combat._atkScale !== 1 || combat._attackType !== 1 || combat._activeBuffs.length
    || attack?._damageType !== (c ? 1 : 2) || attack._atkScale !== 1 || attack._attackType !== 1 || attack._useDynamicAttackType !== 1
    || attack._projectileKey !== (c ? 'projectile_enemy_cansld' : 'projectile_enemy_mtrbty') || attack._useCachedAtkOnly !== 0 || !zero(attack._selector)
    || attack._waitForAttackEvent !== 1 || attack._selectTargetSource !== 2 || attack._metadata.blackboardPrefix !== 'headshot_'
    || selection?._targetSide !== 2 || selection._targetMotion !== 1 || selection._maxNum !== 1
    || selection._ignoreTargetFree !== 0 || selection._forceIgnoreCamouflage !== 0
    || buffs.length !== (logged ? 3 : 2) || !buffs.every(b => b.isSilenceable === 0 && b.lifeTimeType === 2)
    || buffs.map(b => b.templateKey).join() !== `enemy_melee_and_ranged_spmode_check,enemy_spmode_check${logged ? ',' + (c ? 'enemy_cansld_log' : 'log_killed') : ''}`
    || buffs[0].triggerLifeType !== 2 || buffs[0].triggerInterval !== Math.fround(.1)) return false;
  const spend = n.$siblings(charged._attack).find(c => '_runActionOnEvent' in c);
  if (!(c ? taggedArtsBonusNative(attack, n, 'TAG_TRAP_WPNSTS') : nuncioPayload(r, n, attack, selection))
    || spend?._runActionOnEvent !== 4 || spend._extraCondition !== 0 || spend._onlyRunOnce !== 0
    || spend._buffs.length !== 1 || spend._buffs[0].templateKey !== 'enemy_spmode_sp_reduce') return false;
  if (c) {
    const p = n.$projectile('projectile_enemy_cansld'), life = p.find(c => '_lifeTime' in c), motion = p.find(c => '_speed' in c);
    const hit = p.find(c => '_targetOptions' in c), box = p.find(c => 'm_Size' in c);
    if (motion?._speed !== 4 || motion._flyToTargetLocationOnly !== 0 || motion._forceReachedWhenTimeup !== 1
      || life?._lifeTime !== 10 || life._hitNumType !== 2 || life._stopWhenSourceInvalid !== 0 || life._alwaysHitTraceTargetInTheEnd !== 1
      || life._canHitSameTargetMultipleTimes !== 0 || life._actionController._extraBuffsInTheEnd.length
      || hit?._onlyCheckHitWhenReachTarget !== 1 || hit._onlyTraceTarget !== 0 || hit._ignoreCamouflage !== 1
      || hit._targetOptions.targetSide !== 2 || hit._targetOptions.targetMotion !== 3 || hit._targetOptions.ignoreTargetFree !== 0
      || box?.m_Size.x !== 3 || box.m_Size.y !== 3 || box.m_Offset.x !== 0 || box.m_Offset.y !== 0) return false;
  } else if (!projectile(n, 'projectile_enemy_mtrbty', 5)) return false;
  const events = n.$template('enemy_melee_and_ranged_spmode_check')?.eventToActions, [blocked] = events?.ON_BUFF_TRIGGER ?? [];
  const hasSp = blocked?._failNodes?.[0], condition = hasSp?._conditionNode;
  const checkMode = (nodes, from, to) => nodes?.length === 3
    && nodes[0].$type === 'Torappu.Battle.Action.Nodes+CheckUnitInAttackState, Assembly-CSharp' && nodes[0]._isUnset
    && nodes[1]._checkCurModeIndex === from && nodes[1]._targetType === 'BUFF_OWNER'
    && nodes[2]._modeIndex === to && !nodes[2]._restartFSM && !nodes[2]._restoreDefault && !nodes[2]._loadModeFromBlackboard;
  const log = n.$template('enemy_cansld_log')?.eventToActions?.ON_APPLIED_MODIFIER;
  return Object.keys(events ?? {}).join() === 'ON_BUFF_TRIGGER' && events.ON_BUFF_TRIGGER.length === 1
    && blocked._conditionNode?.$type === 'Torappu.Battle.Action.Nodes+CheckBlocked, Assembly-CSharp'
    && blocked._conditionNode._targetType === 'BUFF_OWNER' && blocked._succeedNodes === null && blocked._failNodes.length === 1
    && condition?.$type === 'Torappu.Battle.Action.Nodes+CheckHasSp, Assembly-CSharp' && condition._checkHasSp === 1 && condition._condType === 'GE'
    && checkMode(hasSp._succeedNodes, 0, 1) && checkMode(hasSp._failNodes, 1, 0)
    && (!c || log?.length === 2 && log[0]._modifierTargetType === 'SP' && log[0]._condType === 'GT'
    && log[1]._logType === 'ATTRIBUTE' && log[1]._attributeType === 'SP' && log[1]._target === 'BUFF_OWNER');
}
function nuncioPayload(r, n, attack, selection) {
  const [status, bonus] = attack._activeBuffs ?? [], db = n.$buff('disarmed_and_cant_use_skill');
  const log = n.$template('log_killed')?.eventToActions;
  return positive(r.talents.bb['shotbuff.attack@headshot_disarmed_duration'])
    && attack._activeBuffs.length === 2 && status.buffKey === 'disarmed_and_cant_use_skill' && status.loadFromDB === 1
    && taggedArtsBonusNative({ _activeBuffs: [bonus] }, n, 'TAG_TRAP_WPNSTS')
    && selection._secondaryFilter === 3 && selection._buffKey === 'disarmed' && selection._withoutThisBuff === 1 && selection._filterBuffSource === 0
    && db?.buffKey === 'disarmed' && db.attributes.abnormalFlags.join() === 'DISARMED,SILENCED'
    && db.isDamageMissable && !db.isSilenceable && db.statusResistable === 'AUTOMATIC'
    && db.durationKey === 'disarmed_duration' && db.lifeTimeType === 'LIMITED' && db.templateKey === 'empty'
    && Object.values(log ?? {}).flat().every(a => a.$type === 'Torappu.Battle.Action.Nodes+LogExtraBattleInfo, Assembly-CSharp');
}
export const AMMO_ENEMY_FEATURES = {
  'talent:shotbuff': { covers: (r, n) => ammoNative(r, n) || vendorNative(r, n),
    stageMultipliers: { 'shotbuff.attack@headshot_atk_scale': positive, 'shotbuff.attack@headshot_ep_damage_ratio': positive,
      'shotbuff.attack@headshot_trapdamage': positive, 'shotbuff.attack@headshot_disarmed_duration': positive, 'shotbuff.attack@combat_atk_scale': positive },
    ability: r => vendor(r) ? null : ({ kind: 'ammoAttack', params: r => ({ max: r.sp.maxSp, initial: r.sp.initSp,
      type: sniper(r) || cannon(r) ? 'phys' : 'arts', lifetime: sniper(r) || nuncio(r) ? 5 : 10, meleeWhenEmpty: sniper(r) || cannon(r) || nuncio(r),
      ...(cannon(r) || nuncio(r) ? { rangedOnlyWithAmmo: true,
        ...(cannon(r) ? { area: { width: 3, height: 3, speed: 4, lifetime: 10 } } : { disarmDuration: r.talents.bb['shotbuff.attack@headshot_disarmed_duration'] }),
        bonus: { tag: 'TAG_TRAP_WPNSTS', damage: r.talents.bb['shotbuff.attack@headshot_trapdamage'] } } : {}),
      damageScale: r.talents.bb['shotbuff.attack@headshot_atk_scale'] ?? 1,
      elementRatio: r.talents.bb['shotbuff.attack@headshot_ep_damage_ratio'] ?? 0 }) }),
    note: 'Native bounded ammunition account, attack-mode switching, unsilenceable expenditure and distinct charged projectile payload',
    explains: /^(While this unit is holding Ammo, (ATK increases|attacks inflict <\$ba.dt.burning>Burn damage<\/>)\. Ammo capacity: 1|While this unit is holding Ammo, attacks become long-ranged and deal Splash Damage\. Ammo capacity: 2|While this unit is holding Ammo, attacks become long-ranged and prevent the target from attacking or healing for a period of time\. Ammo Capacity: 1|Deals additional Arts damage to 'Gelato Stops')$/ },
};
