// SPDX-License-Identifier: GPL-3.0-or-later
import { burdenbeastSupplierNative, isBurdenbeastSupplier, burdenbeastSupplierParameters } from './enemy-burdenbeast-features.js';
import clocks from '../../data/arkpedia-fatty-animations.json' with { type: 'json' };
import { nativeAuxiliaryClaims } from './enemy-native-auxiliaries.js';
import { isBasorobeast, basorobeastNative, BASOROBEAST_WEAKNESS, BASOROBEAST_EXPLAINS } from './enemy-basorobeast-features.js';
const ID = 'enemy_2085_skzjxd', type = s => `Torappu.Battle.Action.Nodes+${s}, Assembly-CSharp`;
const keys = (o, list) => Object.keys(o ?? {}).sort().join() === [...list].sort().join();
export function directionalNative(r, n) {
  if (r.prefabKey !== ID || ![ID, `${ID}_2`].includes(r.key)) return false;
  const root = n[ID]?.[0], modes = root?._modes.map(ref => n.$ref(ref));
  const show = n.Show?.find(c => '_timeMode' in c), wrapper = n.Show?.find(c => '_familyMask' in c);
  const animator = n.$ref(root?._animator), clock = clocks.enemies[ID], skill = r.skills[0];
  const shield = n.Weakness?.[0]?._buffs?.[0], trigger = n.ShowTrigger?.[0]?._buffs?.[0];
  if (r.applyWay !== 'NONE' || r.stats.motion !== 'WALK' || r.stats.dmgType !== 'none'
    || r.skills.length !== 1 || skill.prefabKey !== 'Show' || skill.cooldown !== 0 || skill.initCooldown !== 0 || skill.spCost !== 0
    || !keys(skill.bb, []) || !keys(skill.bbStr, []) || !keys(r.talents.groups, ['Weakness', 'ShowTrigger'])
    || !keys(r.talents.bb, ['Weakness.damage_resistance', 'ShowTrigger.interval']) || !keys(r.talents.bbStr, [])
    || r.talents.bb['Weakness.damage_resistance'] !== .8 || r.talents.bb['ShowTrigger.interval'] !== 30
    || root?._modes.length !== 2 || root._commonAbilities.length !== 1 || root._useMoveDirAsFaceDir !== 0
    || modes.some(m => m._combat.m_PathID !== '0' || m._generalAbilities.length !== 1
      || n.$ref(m._attack)?.m_Script.m_PathID !== '4865767822664548221')
    || wrapper?._familyMask !== 3 || wrapper._ignoreSilence !== 0 || wrapper._immuneStunWhenAffecting !== 0
    || show?._animKey !== 'Special' || show._timeMode !== 1 || show._affectedBySlowDown !== 1
    || show._activeBuffs.length || show._waitForAttackEvent !== 0 || show._allowNoTarget !== 1
    || shield?.templateKey !== 'skzjxd_t[shield]' || shield.isSilenceable !== 0 || shield.lifeTimeType !== 2
    || trigger?.templateKey !== 'skzjxd_t[show_trigger]' || trigger.waitFirstTriggerInterval !== 1
    || trigger.triggerLifeType !== 2 || trigger.isSilenceable !== 0
    || n.$ref(animator?._skeleton)?.skeletonDataAsset.m_PathID !== clock.source.skeletonDataPathId
    || clock.durations.Special !== Math.fround(115 / 30)) return false;
  const clip = animator._animations.find(c => c.animKey === 'Special');
  if (clip?.animName !== 'Special' || clip.speed !== 1 || clip.loop !== 0) return false;
  for (let i = 0; i < modes.length; i++) {
    const buffs = n.$ref(modes[i]._generalAbilities[0])?._buffs;
    if (buffs?.length !== 3 || buffs[0].templateKey !== `skzjxd_a[${i ? 'back' : 'face'}_listener]`
      || buffs[1].templateKey !== 'skzjxd_a[direction_listener]' || buffs[2].templateKey !== 'empty'
      || buffs.slice(0, 2).some(b => b.triggerInterval !== Math.fround(.3) || b.isSilenceable !== 0 || b.lifeTimeType !== 2)
      || buffs.some(b => Object.values(b.attributes).some(a => a.length))) return false;
    const actions = n.$template(buffs[0].templateKey)?.eventToActions.ON_BUFF_TRIGGER;
    if (actions?.length !== 2 || actions[0].$type !== type('CheckEnemyFaceAndMoveDir') || actions[0]._checkType !== (i ? 'SAME' : 'OPPOSITE')
      || actions[1].$type !== type('SwitchMode') || actions[1]._modeIndex !== 1 - i || !actions[1]._restartFSM) return false;
  }
  const direction = n.$template('skzjxd_a[direction_listener]')?.eventToActions;
  const face = direction?.ON_BUFF_TRIGGER?.[0], opt = face?._targetOptions;
  if (face?.$type !== type('FaceToLOrRViaMoreTargets') || direction.ON_BUFF_TRIGGER.length !== 1
    || opt?.targetSide !== 'ENEMY' || opt.targetMotion !== 'ALL' || !opt.ignoreTargetFree
    || opt.professionMask !== 'WARRIOR, SNIPER, TANK, MEDIC, SUPPORT, CASTER, SPECIAL, PIONEER') return false;
  for (const event of ['ON_BUFF_START', 'ON_BUFF_FINISH']) if (direction[event]?.length !== 1
    || direction[event][0].$type !== type('DisableEnemySwitchFaceByMove') || !direction[event][0]._disabled) return false;
  const reduction = n.$template(shield.templateKey)?.eventToActions.ON_TAKE_DAMAGE;
  const force = n.$template(trigger.templateKey)?.eventToActions.ON_BUFF_TRIGGER;
  return reduction?.length === 2 && reduction[0].$type === type('CheckIfSourceGridPosFaceTargetGridPos')
    && reduction[0]._source === 'BUFF_OWNER' && reduction[0]._target === 'MODIFIER_SOURCE' && reduction[0]._faceType === 'FRONT'
    && reduction[0]._faceIfSameCol === 'NONE' && reduction[0]._targetColOffset === 0
    && reduction[1].$type === type('DamageScale') && reduction[1]._damageMask === 'PHYSICAL_AND_MAGICAL'
    && reduction[1]._filterDamageType && !reduction[1]._filterApplyWay && reduction[1]._isOneMinus && !reduction[1]._isStackable
    && force?.length === 1 && force[0].$type === type('TriggerEnemySkill') && force[0]._skillName === 'Show'
    && !force[0]._checkSkillReady && !force[0]._checkSkillActive && force[0]._interruptCurAbility;
}
export const DIRECTIONAL_FEATURES = {
  // Basorobeast/Gravorobeast share the key: they dispatch to their own contract (enemy-basorobeast-features.js).
  'talent:Weakness': { matchesRecord: r => r.prefabKey === ID || isBurdenbeastSupplier(r) || isBasorobeast(r),
    covers: (r, n) => isBasorobeast(r) ? basorobeastNative(r, n) : directionalNative(r, n) || burdenbeastSupplierNative(r, n),
    nativeClaim: (p, n) => p.rootName.startsWith('enemy_1307_mhrhcr') ? { active: 0 }
      : p.rootName.startsWith('enemy_4007_murino') ? { active: 2 }
      : { wrappers: 1, active: 2 + nativeAuxiliaryClaims(p, n).active },
    explains: (text, r) => isBasorobeast(r) ? BASOROBEAST_EXPLAINS(text) : isBurdenbeastSupplier(r)
      ? /^(Damage from the front is greatly reduced\.|Always faces the side where you have more units\.)$/.test(text)
      : /^(Always faces the direction with the most Operators\.|Takes 80% less Physical\/Arts damage from the front\.|始终面向我方干员数量较多的方向|受到来自正面的物理\/法术伤害降低80%)$/.test(text),
    ability: r => isBasorobeast(r) ? BASOROBEAST_WEAKNESS : { kind: 'crowdDirectionalGuard', params: r => isBurdenbeastSupplier(r)
      ? burdenbeastSupplierParameters(r)
      : ({ reduction: r.talents.bb['Weakness.damage_resistance'],
      poll: Math.fround(.3), interval: r.talents.bb['ShowTrigger.interval'], showDuration: clocks.enemies[ID].durations.Special }) } },
  'talent:ShowTrigger': { covers: directionalNative },
  'skill:Show': { covers: directionalNative },
};
