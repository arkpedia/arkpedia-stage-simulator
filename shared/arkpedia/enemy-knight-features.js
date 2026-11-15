// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-knight-animations.json' with { type: 'json' };
const type = n => `Torappu.Battle.Action.Nodes+${n}, Assembly-CSharp`;
const zero = r => r?.m_FileID === 0 && r.m_PathID === '0';
const ids = ['enemy_1513_dekght', 'enemy_1513_dekght_2'];
const exactKeys = (o, keys) => Object.keys(o ?? {}).sort().join() === [...keys].sort().join();
function templateReviewed(n, ranged) {
  const actions = n.$template(ranged ? 'enemy_dekght_2[aoe]' : 'enemy_dekght[aoe]')?.eventToActions;
  const list = actions?.[ranged ? 'ON_BUFF_TRIGGER' : 'ON_BUFF_FINISH'];
  const splash = list?.[ranged ? 1 : 0], options = splash?._targetOptions;
  if (!list || list.length !== (ranged ? 5 : 1) || splash.$type !== type('AOEDamage') || !splash._excludeTarget
    || splash._damageType !== (ranged ? 'MAGICAL' : 'PHYSICAL') || splash._attackType !== 'SPLASH'
    || splash._damageScale !== 'atk_scale' || splash._useRadius || splash._checkTargetAlive || splash._buffs.length
    || options?.targetSide !== 'ENEMY' || options.targetMotion !== (ranged ? 'ALL' : 'WALK_ONLY') || options.ignoreTargetFree) return false;
  return !ranged || list[0].$type === type('IfTarget') && list[0]._targetType === 'SOURCE' && list[0]._checkTargetAlive
    && list[3].$type === type('FinishBuff') && list[4].$type === type('AdvancedApplyDamage')
    && list[4]._attackType === 'NORMAL' && list[4]._damageType === 'MAGICAL' && !list[4]._forceUseProjectileCachedAtk;
}
export function knightNative(r, n) {
  if (!ids.includes(r.prefabKey)) return false;
  const ranged = r.prefabKey.endsWith('_2'), root = n[r.prefabKey]?.[0], mode = n.$ref(root?._modes?.[0]);
  const ordinary = n.$ref(mode?._combat), skillRows = n[ranged ? 'TripleAttack' : 'ChargeAttack'] ?? [];
  const skill = skillRows.find(c => '_atkScale' in c), wrapper = skillRows.find(c => '_familyMask' in c);
  const rage = n.TriggerRage?.find(c => '_targetValidator' in c), partner = n.$ref(rage?._targetValidator);
  const anim = n.$ref(root?._animator), clock = clocks.enemies[r.prefabKey];
  const effect = n.$ref(root?._commonAbilities?.[0])?._buffs?.[0];
  const s = r.skills[0], bb = r.talents.bb;
  if (r.applyWay !== (ranged ? 'RANGED' : 'MELEE') || r.stats.motion !== 'WALK' || r.skills.length !== 1
    || s.prefabKey !== (ranged ? 'TripleAttack' : 'ChargeAttack') || s.cooldown !== 22 || s.initCooldown !== 22 || s.spCost !== 0
    || !exactKeys(r.talents.groups, ranged ? ['triggerrage'] : ['aoe', 'triggerrage'])
    || !exactKeys(bb, ['triggerrage.atk', 'triggerrage.attack_speed', 'triggerrage.move_speed', ...(!ranged ? ['aoe.attack@dekght[aoe].atk_scale'] : [])])
    || !exactKeys(r.talents.bbStr, ranged ? [] : ['aoe.attack@dekght[aoe].range_id'])
    || !exactKeys(s.bb, ranged ? ['dekght_2[aoe].interval', 'dekght_2[aoe].atk_scale'] : ['atk_scale', 'dekght[aoe].atk_scale', 'duration'])
    || !exactKeys(s.bbStr, [ranged ? 'dekght_2[aoe].range_id' : 'dekght[aoe].range_id'])
    || bb['triggerrage.atk'] !== .8 || bb['triggerrage.attack_speed'] !== 100 || bb['triggerrage.move_speed'] !== 1.5
    || root?._modes.length !== 1 || root._commonAbilities.length !== 1 || mode._generalAbilities.length
    || effect?.templateKey !== 'empty' || Object.values(effect.attributes).some(a => a.length)
    || !clock || n.$ref(anim?._skeleton)?.skeletonDataAsset.m_PathID !== clock.source.skeletonDataPathId
    || wrapper?._familyMask !== 3 || wrapper._ignoreSilence !== 1 || wrapper._immuneStunWhenAffecting !== 0
    || skill?._waitForAttackEvent !== 1 || skill._interuptIfTargetDead !== 0 || skill._activeBuffs.length !== 1
    || skill._activeBuffs[0].isDamageMissable !== 0 || skill._activeBuffs[0].isSilenceable !== 0
    || rage?._buffs.length !== 1 || rage._buffs[0].templateKey !== 'enemy_dekght[trigger_rage]'
    || partner?._targetId !== ids[ranged ? 0 : 1] || partner._reverse !== 0 || partner._loadFromBlackboard !== 0
    || !templateReviewed(n, ranged)) return false;
  for (const name of ranged ? ['Skill'] : ['Skill_Start', 'Skill_Loop', 'Skill_End']) {
    const clip = anim._animations.find(a => a.animKey === name);
    if (!clip || clip.animName !== name || clip.speed !== 1 || clip.loop !== Number(name === 'Skill_Loop')) return false;
  }
  if (!ranged) {
    const duration = n.$siblings(skill).find(c => '_default' in c);
    if (duration?._default.beginAnim !== 'Skill_Start' || duration._default.loopAnim !== 'Skill_Loop'
      || duration._default.endAnim !== 'Skill_End' || duration._delayToFireAttackSkillEvent !== 1 || duration._delaySecond !== 0
      || clock.durations.Skill_Start + clock.durations.Skill_End > s.bb.duration) return false;
  }
  const trigger = n.$template('enemy_dekght[trigger_rage]')?.eventToActions.ON_BUFF_FINISH;
  const mods = trigger?.[0]?._buff?.attributes.attributeModifiers;
  if (trigger?.length !== 1 || trigger[0].$type !== type('CreateBuff') || mods?.length !== 3
    || mods.map(m => `${m.attributeType}:${m.formulaItem}`).join() !== 'ATK:MULTIPLIER,ATTACK_SPEED:ADDITION,MOVE_SPEED:MULTIPLIER'
    || mods.some(m => !m.loadFromBlackboard) || trigger[0]._buff.lifeTimeType !== 'INFINITY') return false;
  if (!ranged) return zero(mode._attack) && ordinary?._damageType === 1 && ordinary._atkScale === 1
    && ordinary._activeBuffs[0]?.templateKey === 'enemy_dekght[aoe]' && skill._timeMode === 3 && skill._affectedBySlowDown === 0
    && skill._activeBuffs[0].templateKey === 'enemy_dekght[aoe]' && s.bb.duration === 4 && s.bb.atk_scale === 3
    && s.bb['dekght[aoe].atk_scale'] === 3 && s.bbStr['dekght[aoe].range_id'] === 'x-5'
    && bb['aoe.attack@dekght[aoe].atk_scale'] === 1 && r.talents.bbStr['aoe.attack@dekght[aoe].range_id'] === 'x-5'
    && clock.events.Skill_End?.[0]?.time === Math.fround(1.1) && clock.durations.Skill_End === Math.fround(64 / 30);
  for (const [attack, max] of [[ordinary, 2], [skill, 3]]) {
    const selector = n.$ref(attack?._selector);
    if (selector?._maxNum !== max || selector._limitTargetNum !== 1 || selector._targetSide !== 2 || selector._targetMotion !== 3
      || selector._ignoreTargetFree !== 0 || !n.$siblings(selector).some(c => c.m_Radius === 2.5)) return false;
  }
  for (const key of ['projectile_enemy_dekght', 'projectile_enemy_dekght_s']) {
    const p = n.$projectile(key), motion = p.find(c => '_speed' in c), life = p.find(c => '_lifeTime' in c);
    if (motion?._speed !== 10 || motion._flyToTargetLocationOnly !== 0 || life?._lifeTime !== 5
      || life._maxHitNum !== 1 || life._hitNumType !== 1 || life._managedBySource !== 0 || life._canHitSameTargetMultipleTimes !== 0
      || life._actionController._extraBuffsInTheEnd.length || life._stopWhenSourceInvalid !== 0 || life._alwaysHitTraceTargetInTheEnd !== 1) return false;
  }
  return ordinary._projectileKey === 'projectile_enemy_dekght' && ordinary._damageType === 2 && ordinary._activeBuffs.length === 0
    && skill._projectileKey === 'projectile_enemy_dekght_s' && skill._atkScale === 0 && skill._affectedBySlowDown === 1
    && skill._activeBuffs[0].templateKey === 'enemy_dekght_2[aoe]' && skill._activeBuffs[0].waitFirstTriggerInterval === 1
    && s.bb['dekght_2[aoe].interval'] === 2.5 && s.bb['dekght_2[aoe].atk_scale'] === 1.6 && s.bbStr['dekght_2[aoe].range_id'] === 'x-5'
    && clock.events.Skill?.[0]?.time === 1 && clock.durations.Skill === Math.fround(50 / 30);
}
function params(r) {
  const ranged = r.prefabKey.endsWith('_2'), s = r.skills[0], c = clocks.enemies[r.prefabKey];
  return { ranged, partner: ids[ranged ? 0 : 1], cooldown: s.cooldown, initial: s.initCooldown,
    range: 2.5, speed: 10, lifetime: 5, delay: s.bb['dekght_2[aoe].interval'],
    scale: ranged ? s.bb['dekght_2[aoe].atk_scale'] : s.bb.atk_scale,
    duration: ranged ? c.durations.Skill : s.bb.duration,
    release: ranged ? c.events.Skill[0].time : s.bb.duration - c.durations.Skill_End + c.events.Skill_End[0].time,
    rage: { atkPct: r.talents.bb['triggerrage.atk'], aspd: r.talents.bb['triggerrage.attack_speed'], moveMul: 1 + r.talents.bb['triggerrage.move_speed'] } };
}
export const KNIGHT_FEATURES = {
  'talent:triggerrage': { matchesRecord: r => ids.includes(r.prefabKey), covers: knightNative, ability: { kind: 'knightPair', params }, nativeClaim: () => ({ wrappers: 1, active: 1 }),
    explains: /^(Attacks deal Physical damage to the target and adjacent allied units|Does charged attacks, dealing heavy Physical damage to the targets and any adjacent units|Gains greatly increased ATK, ASPD, and Movement Speed when <(?:Withered|Corrupted) Knight> dies|Fires explosive arrows at three targets which explode after a short delay, dealing high Arts damage to the target and surrounding four tiles)$/ },
  'skill:ChargeAttack': { covers: (r, n) => r.prefabKey === ids[0] && knightNative(r, n) },
  'skill:TripleAttack': { covers: (r, n) => r.prefabKey === ids[1] && knightNative(r, n) },
};
