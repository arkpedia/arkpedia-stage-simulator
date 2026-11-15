// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-steam-tank-animations.json' with { type: 'json' };
import { sameOutcomeValue as same, emptyOutcomeAttributes } from './enemy-outcome-contracts.js';
const RANGE = Object.freeze([[-1,-1],[-1,0],[-1,1],[0,-1],[0,0],[0,1],[1,-1],[1,0],[1,1]].map(Object.freeze));
const ids = ['enemy_1273_stmgun', 'enemy_1273_stmgun_2'];
const fields = (v, expected) => !!v && Object.entries(expected).every(([k, x]) => same(v[k], x));
export function steamTankNative(r, n) {
  if (!ids.includes(r.prefabKey) || r.applyWay !== 'RANGED' || r.skills.length !== 1 || Object.keys(r.talents.groups).length
    || !fields(r.skills[0], { prefabKey: 'Cannon', priority: 0, cooldown: 25, initCooldown: 10, spCost: 0 })
    || !same(r.skills[0].bb, { atk_scale: .55 }) || Object.keys(r.skills[0].bbStr).length) return false;
  if (!same(n.$range('x-4')?.grids.map(p => `${p.row},${p.col}`).sort(), RANGE.map(p => p.join(',')).sort())) return false;
  const root = n[r.prefabKey]?.[0], mode = n.$ref(root?._modes?.[0]), attack = n.$ref(mode?._attack);
  const cast = n.Cannon?.find(c => '_projectileKey' in c), wrapper = n.Cannon?.find(c => '_familyMask' in c);
  const protection = n.$siblings(cast).find(c => '_buffs' in c)?._buffs;
  if (root?._modes.length !== 1 || root._commonAbilities.length || mode._generalAbilities.length
    || !fields(attack, { _projectileKey: 'projectile_enemy_stmgun', _atkScale: 1, _damageType: 1, _waitForAttackEvent: 1 })
    || attack._activeBuffs.length || !fields(wrapper, { _familyMask: 3, _ignoreSilence: 0, _castLikeAttack: 0,
      _maxTriggerTime: -1, _resetMainAbilityCdWhenCastEnd: 0, _overwriteInitCooldown: -1 })
    || !fields(cast, { _projectileKey: 'projectile_enemy_stmgun_s', _waitForAttackEvent: 1, _selectTargetSource: 2,
      _selectTargetTiming: 0, _timeMode: 1, _alwaysIncludeTarget: 1, _allowNoTarget: 1, _animKey: 'Skill',
      _preDelay: 0, _affectedBySlowDown: 1, _atkScale: 0, _damageType: 1, _emitToInputPosWhenTargetIsInvalid: 1 })
    || cast._activeBuffs.length !== 1 || protection?.length !== 1) return false;
  const shield = protection[0];
  if (!fields(shield, { templateKey: 'empty', lifeTimeType: 2, isSilenceable: 0, isStunnable: 0, isFreezable: 0 })
    || !same(shield.attributes.abnormalFlags, [8]) || !same(shield.attributes.abnormalImmunes, [0, 12, 25, 16])
    || !same(shield.attributes.abnormalComboImmunes, [0]) || shield.attributes.attributeModifiers.length) return false;
  const selector = n.$siblings(wrapper._trigger).find(c => '_postFilter' in c);
  if (!fields(selector, { _targetSide: 2, _targetMotion: 3, _targetCategory: 1, _postFilter: 19,
    _ignoreTargetFree: 0, _forceIgnoreCamouflage: 0, _maxNum: 1, _ignoreHitRange: 0 })
    || !n.$siblings(wrapper._trigger).some(c => c.m_Radius === 2.5 && same(c.m_Offset, { x: 0, y: 0 }))) return false;
  const buff = cast._activeBuffs[0], actions = n.$template('enemy_stmgun_s[damage]')?.eventToActions.ON_BUFF_TRIGGER;
  if (!fields(buff, { templateKey: 'enemy_stmgun_s[damage]', lifeTimeType: 2, triggerLifeType: 1,
    triggerCnt: 1, triggerInterval: Math.fround(.2), waitFirstTriggerInterval: 1, isSilenceable: 0 })
    || !emptyOutcomeAttributes(buff.attributes) || buff.blackboard.length
    || actions?.length !== 3 || !fields(actions[0], { _damageType: 'MAGICAL', _atkScaleVar: 'atk_scale',
      _targetType: 'TARGET', _applyWay: 'NONE', _attackType: 'NORMAL',
      _forceUseProjectileCachedAtk: false, _skipModifierEvent: false })
    || !actions[2].$type.includes('FinishBuff')) return false;
  const parts = n.$projectile('projectile_enemy_stmgun_s'), ordinary = n.$projectile('projectile_enemy_stmgun');
  if (!ordinary.some(c => c._speed === 4) || !ordinary.some(c => c._lifeTime === 20 && c._stopWhenSourceInvalid === 0)
    || !parts.some(c => c._lifeTime === 6 && c._maxHitNum === 10 && c._stopWhenSourceInvalid === 1)
    || !parts.some(c => c._interval === .5 && c._waitFirstPeriod === 1 && c._hitPasserby === 0)
    || !parts.some(c => c._immediatelyReach === 1 && c._followTarget === 0 && c._keepUpdate === 0)
    || !parts.some(c => c._postFilter === 45 && c._targetMotion === 3 && c._targetCategory === 1 && c._maxNum === 1)
    || !parts.some(c => c._rangeId === 'x-4')) return false;
  const c = clocks.enemies[r.prefabKey], graphic = n.$ref(root._animator);
  return n.$ref(graphic?._skeleton)?.skeletonDataAsset.m_PathID === c.source.skeletonDataPathId
    && c.durations.Skill === 10 && c.durations.Attack === 2
    && same(c.events.Skill.filter(e => e.name === 'OnAttack'), [{ time: Math.fround(121 / 30), name: 'OnAttack', int: 0, float: 0, string: '' }]);
}
export const STEAM_TANK_FEATURE = {
  matchesRecord: r => ids.includes(r.prefabKey), covers: steamTankNative, nativeClaim: () => ({ wrappers: 1 }),
  explains: text => text === 'Capable of long-range attacks'
    || text === 'Locks on to the target with the highest max HP and bombards it several times, dealing Arts damage to the unit in range with the highest HP percentage',
  ability: { kind: 'steamTank', params: r => ({ initial: r.skills[0].initCooldown, cooldown: r.skills[0].cooldown,
    scale: r.skills[0].bb.atk_scale, duration: 10, release: Math.fround(121 / 30), lockRadius: r.stats.rangeRadius + .25,
    range: RANGE,
    attackAnim: { dur: 2, hit: Math.fround(1 / 30) } }) },
};
