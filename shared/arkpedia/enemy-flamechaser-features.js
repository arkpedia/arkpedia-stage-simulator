// SPDX-License-Identifier: GPL-3.0-or-later
import soldierClocks from '../../data/arkpedia-flamechaser-animations.json' with { type: 'json' };
import { sameOutcomeValue as same } from './enemy-outcome-contracts.js';
import meleeClocks from '../../data/arkpedia-firelight-melee-animations.json' with { type: 'json' };
const clocks = { enemies: { ...soldierClocks.enemies, ...meleeClocks.enemies } };
const zero = r => r?.m_FileID === 0 && r.m_PathID === '0';
const type = name => `Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
export const isFlamechaserGuard = r => ['enemy_1292_duskld', 'enemy_1292_duskld_2'].includes(r.prefabKey);
export const isFlamechaser = r => isFlamechaserGuard(r) || ['enemy_1288_duskls', 'enemy_1288_duskls_2'].includes(r.prefabKey);
export const FLAMECHASER_BURN = 'Attacks deal additional <$ba.dt.burning>Burn damage</> while near burning Reeds';
export const FLAMECHASER_GUARD_BURN = 'Attacks deal additional <$ba.dt.burning>Burn damage</> and takes reduced Physical and Arts damage while near burning Reeds';
const emberText = /^When defeated, turns into an <\$ba.invisible>Invisible<\/> <Ember of (?:Resentment|Fury|Avarice)> that must be damaged (?:5|10) times to defeat; respawns after a period of time$/;
const buff = b => b && !b.loadFromDB && !b.isSilenceable && !b.isStunnable && !b.isFreezable
  && !b.isGroundBoundable && !b.isLevitatable && !b.isDamageMissable && b.maxStackCnt === 1 && !b.blackboard.length;
const noAttack = a => a?.m_Script.m_PathID === '4865767822664548221' && zero(a._selector);
export function flamechaserNative(r, n) {
  const guard = isFlamechaserGuard(r), prefix = guard ? 'enemy_duskld' : 'enemy_duskls';
  if (!isFlamechaser(r) || r.applyWay !== 'MELEE' || r.stats.dmgType !== 'arts' || r.stats.motion !== 'WALK' || r.sp
    || !same(r.talents.groups, { 'Revive[Trigger]': ['interval', 'prop_max_hp'], aura: guard ? ['damage_resistance', 'ep_damage_ratio', 'range_radius'] : ['ep_damage_ratio', 'range_radius'] })
    || Object.keys(r.talents.bbStr).length || r.talents.bb['Revive[Trigger].prop_max_hp'] !== (guard ? 10 : 5)
    || (guard && (r.talents.bb['aura.damage_resistance'] !== .5 || !r.stats.immunities.silence))
    || r.talents.bb['Revive[Trigger].interval'] !== 10 || r.talents.bb['aura.ep_damage_ratio'] !== 1 || r.talents.bb['aura.range_radius'] !== 1.5
    || r.abilities.length !== 2 || !r.abilities.some(a => a.text === (guard ? FLAMECHASER_GUARD_BURN : FLAMECHASER_BURN)) || !r.abilities.some(a => emberText.test(a.text))
    || !same(r.skills, [{ prefabKey: 'BornAnim', priority: 0, cooldown: 0, initCooldown: 0, spCost: 0, bb: {}, bbStr: {} }])) return false;
  const root = n[r.prefabKey]?.find(c => '_modes' in c), modes = root?._modes.map(n.$ref);
  if (root?._modes.length !== 2 || root._commonAbilities.length !== 1 || root._acceptDamageType !== 2
    || root._onlyAffectSpecificModeIndex !== 1 || root._specificModeIndex !== 1 || root._delayToBorn !== 0
    || modes.some(m => !m || m._generalAbilities.length || !zero(m._attack) || !zero(m._attackTrigger))) return false;
  const attack = n.$ref(modes[0]._combat), empty = n.$ref(modes[1]._combat);
  if (attack?.m_Script.m_PathID !== '4381884627089348317' || attack._damageType !== 2 || attack._atkScale !== 1
    || attack._attackType !== 1 || attack._activeBuffs.length || !zero(attack._selector) || attack._preDelay !== 0
    || attack._timeMode !== 0 || attack._waitForAttackEvent !== 1 || attack._epDamageRatio !== 0
    || empty?.m_Script.m_PathID !== '8145049199648393782' || empty._activeBuffs.length || !zero(empty._selector)) return false;
  const mark = n.$ref(root._commonAbilities[0]);
  if (mark?._buffs?.length !== 1 || mark._buffs[0].buffKey !== `${prefix}_mark` || mark._buffs[0].templateKey !== 'empty') return false;
  for (const [name, mode, script] of [['RebornToProp', 1, '-4458530021321694031'], ['RebornToDefault', 0, '-9067469794004961147']]) {
    const a = n[name]?.[0], reborn = n.$siblings(a).find(c => '_hpRechargeRatio' in c);
    if (!noAttack(a) || reborn?.m_Script.m_PathID !== script || reborn._modeIndex !== mode || reborn._hpRechargeRatio !== 1
      || reborn._maxRespawnCnt !== -1 || reborn._useAbilityToHandle || reborn._keepAlive || reborn._rebornAfterWave
      || reborn._buffs.length || !same(reborn._buffsRetainedWhenReborn, guard || r.prefabKey.endsWith('_2') ? [`${prefix}_mark`] : []) || reborn._extraRebornDataPresets.length
      || reborn._validWhenContainsBuff !== '' || !n.$ancestors(a).includes(modes[1 - mode].m_GameObject.m_PathID)) return false;
  }
  const revive = n['Revive[Trigger]']?.[0], listener = revive?._buffs?.[0], trigger = revive?._buffs?.[1];
  if (revive?._buffs.length !== 2 || !buff(listener) || listener.templateKey !== `${prefix}_revive_listener`
    || listener.lifeTimeType !== 2 || listener.triggerLifeType !== 2 || listener.triggerCnt !== 1 || listener.waitFirstTriggerInterval !== 1
    || !same(listener.attributes.abnormalFlags, [11]) || !buff(trigger) || trigger.templateKey !== `${prefix}_trigger_skill`
    || !n.$ancestors(revive).includes(modes[1].m_GameObject.m_PathID)) return false;
  const events = n.$template(`${prefix}_revive_listener`)?.eventToActions;
  if (!same(events, {
    ON_BUFF_TRIGGER: [{ $type: type('SwitchToRebornState'), _targetType: 'BUFF_OWNER', _isForce: true },
      { $type: type('UpdateAttributeRawData'), _targetType: 'BUFF_OWNER', _attributeType: 'MAX_HP', _valueKey: 'default_max_hp' }],
    ON_BUFF_START: [{ $type: type('AssignAttributeRawDataIntoBlackboard'), _blackBoardKey: 'default_max_hp', _targetType: 'BUFF_OWNER', _attributeType: 'MAX_HP' },
      { $type: type('UpdateAttributeRawData'), _targetType: 'BUFF_OWNER', _attributeType: 'MAX_HP', _valueKey: 'prop_max_hp' }],
  })) return false;
  const born = n.Born?.find(c => '_buffs' in c);
  if (born?._metadata.namedAsAlias !== 'anim_trigger' || born._buffs.length !== 1 || born._buffs[0].templateKey !== `${prefix}_anim_trigger`
    || !same(n.$template(`${prefix}_trigger_skill`)?.eventToActions, { ON_BUFF_START: [{ $type: type('TriggerAbility'),
      _ownerType: 'BUFF_OWNER', _targetType: 'BUFF_OWNER', _abilityName: 'anim_trigger', _checkCanUseAblityFlag: false,
      _castDirectly: true, _useFirstActiveAbility: false, _useCastResult: false }] })
    || !same(n.$template(`${prefix}_anim_trigger`)?.eventToActions, { ON_BUFF_START: [{ $type: type('TriggerEnemySkill'),
      _skillName: 'BornAnim', _checkSkillActive: false, _checkSkillReady: false, _ownerType: 'TARGET', _targetType: 'BUFF_OWNER',
      _interruptCurAbility: true, _interruptCurAbilityUnlessItIsExpectedAbility: false, _assignCombatAbility: false,
      _forceFindTargetBySkillSelector: false }] })) return false;
  const invisible = n.Invisible?.find(c => '_checker' in c), checker = n.$ref(invisible?._checker), stealth = invisible?._buffs?.[0];
  if (checker?._restoreDelay !== 3 || checker._disableWhenBlocked !== 1 || checker._isInitToggled !== 1
    || Object.entries(checker).some(([k,v]) => k.startsWith('_disable') && k !== '_disableWhenBlocked' && v !== 0)
    || invisible?._buffs.length !== 1 || !buff(stealth) || stealth.templateKey !== 'empty' || !same(stealth.attributes.abnormalFlags, [9])
    || invisible._isInverseToggle || invisible._buffsWhenToggleOff.length || invisible._unmanagedBuffsWhenToggleOn.length
    || !n.$ancestors(invisible).includes(modes[1].m_GameObject.m_PathID)) return false;
  const aura = n.aura?.find(c => '_checker' in c), near = n.$ref(aura?._checker), target = n.$ref(aura?._selector), ep = aura?._buffs?.[0];
  const circle = n.$siblings(target).find(c => 'm_Radius' in c);
  if (near?.m_Script.m_PathID !== '8859431269360254613' || near._selector.m_PathID !== aura._selector.m_PathID
    || n.$ref(near._rangeToLoad)?.m_GameObject.m_PathID !== circle?.m_GameObject.m_PathID || circle?.m_Radius !== .5 || circle.m_Offset.x || circle.m_Offset.y
    || target?._filterType !== 8 || target._options.checkTileMode !== 1 || target._options.modeIndex !== 1
    || target._options.checkBuildableOrPassable || target._options.checkTileTypes || target._options.checkHeightType
    || !same(target._tileOrTokenIdListPreferred, ['tile_reed','tile_reedf','tile_reedw'])
    || aura._isInverseToggle || aura._buffsWhenToggleOff.length || aura._unmanagedBuffsWhenToggleOn.length
    || aura._buffs.length !== (guard ? 2 : 1) || !buff(ep) || ep.templateKey !== `${prefix}_ep_damage`
    || !n.$ancestors(aura).includes(modes[0].m_GameObject.m_PathID)) return false;
  if (guard && !guardProtectionNative(aura._buffs[1], n)) return false;
  const damage = n.$template(ep.templateKey)?.eventToActions;
  if (!same(damage, { ON_CALCULATE_DAMAGE: [{ $type: type('ApplyElementDamage'), _elementDamageType: 'FIRE', _sourceType: 'SOURCE',
    _isFixedEpDamage: false, _baseOnHostAtk: false, _baseOnEnemyHostAtk: false, _fixedEpDamageKey: null, _fixedEpDamage: 0,
    _noSource: false, _forceUseProjectileCachedAtk: false, _multiplyWithBuffValidStackCnt: false, _buffKey: null,
    _buffSourceType: 'BUFF_OWNER', _targetType: 'TARGET', _isEnvElementDamage: false, _loadElementTypeFromBb: false,
    _fixedEpDamageScale: '', _epDamageScale: 'ep_damage_ratio' }] })) return false;
  const wrapper = n.BornAnim?.find(c => '_familyMask' in c), cast = n.BornAnim?.find(c => '_actions' in c), graphic = n.$ref(root._animator);
  const clock = clocks.enemies[r.prefabKey];
  return wrapper?._familyMask === 1 && zero(wrapper._trigger) && wrapper._maxTriggerTime === -1
    && cast?._animKey === 'Start' && cast._timeMode === 1 && cast._preDelay === 0 && cast._activeBuffs.length === 0
    && cast._actions.SerializedState === '[]' && n.$ref(graphic?._skeleton)?.skeletonDataAsset.m_PathID === clock.source.skeletonDataPathId
    && ['Die','Die_2','Start','Revive'].every(k => clock.durations[k] === (guard && k === 'Revive' ? Math.fround(1.2) : 1) && graphic._animations.some(a => a.animKey === k && a.animName === k && a.speed === 1))
    && graphic._animations.some(a => a.animKey === 'Attack' && a.animName === 'Attack' && Math.abs(a.speed - 1.4) < 1e-6);
}
export const FLAMECHASER_AURA = { kind: 'burningReedsAttack', params: r => ({ radius: r.talents.bb['aura.range_radius'], ratio: r.talents.bb['aura.ep_damage_ratio'], protection: r.talents.bb['aura.damage_resistance'] ?? 0 }) };
export const FLAMECHASER_FEATURES = {
  'talent:Revive[Trigger]': { matchesRecord: isFlamechaser, covers: flamechaserNative, explains: text => emberText.test(text),
    ability: { kind: 'emberRebirth', params: r => { const c = clocks.enemies[r.prefabKey]; return {
      hits: r.talents.bb['Revive[Trigger].prop_max_hp'], delay: r.talents.bb['Revive[Trigger].interval'],
      attackAnim: { dur: c.durations.Attack / 1.4, hit: c.events.Attack[0].time / 1.4 }, startDuration: c.durations.Start, reviveDuration: c.durations.Revive,
    }; } } },
  'skill:BornAnim': { covers: flamechaserNative, nativeClaim: () => ({ wrappers: 1, active: 1 }),
    note: 'Ember entry animation and shared marker; revival lifecycle owns the cast, not an automatic cooldown attack.' },
};

function guardProtectionNative(binding, n) {
  const buff = n.$buff('damage_resistance[inf]');
  return binding?.loadFromDB === 1 && binding.buffKey === 'damage_resistance[inf]' && !binding.blackboard.length
    && buff?.templateKey === 'damage_resistance' && buff.lifeTimeType === 'INFINITY' && !buff.isSilenceable
    && !buff.isStunnable && !buff.isFreezable && !buff.isDamageMissable && buff.maxStackCnt === 1
    && same(buff.priorityBBKeys, ['damage_resistance'])
    && same(n.$template('damage_resistance')?.eventToActions, { ON_TAKE_DAMAGE: [{
      $type: type('DamageScale'), _filterDamageType: true, _damageMask: 'PHYSICAL_AND_MAGICAL',
      _filterApplyWay: false, _applyWayFilter: 'NONE', _isOneMinus: true, _isStackable: false,
      _isValidStackCnt: false, _cachedDeltaValueToBBKey: '', _customKey: '',
    }] });
}
