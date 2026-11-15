// SPDX-License-Identifier: GPL-3.0-or-later
import clocks from '../../data/arkpedia-firelight-ranged-animations.json' with { type: 'json' };
import { sameOutcomeValue as same } from './enemy-outcome-contracts.js';
const zero = r => r?.m_FileID === 0 && r.m_PathID === '0';
const script = (c, id) => c?.m_Script?.m_PathID === id;
const node = (a, name) => a?.$type === `Torappu.Battle.Action.Nodes+${name}`;
export const isCannoneer = r => ['enemy_1289_dubmb', 'enemy_1289_dubmb_2'].includes(r.prefabKey);
export const isFlamecaller = r => ['enemy_1290_duflm', 'enemy_1290_duflm_2'].includes(r.prefabKey);
export const CANNONEER_TEXT = 'After two attacks, the next attack deals Splash damage';
export const FLAMECALLER_TEXT = ['Attacks ignite Reeds beneath the target', 'When defeated, deals Arts damage to all nearby friendly units and ignites all Reeds'];
const ignition = a => same(a, { _operation: 'INDEX', _modeIndex: 1, _decBbKey: '', _useSwitchResult: false,
  _specifyTileType: true, _tileType: 'REED_TILE', _useOwnerRootTile: false, $type: 'Torappu.Battle.Action.Nodes+SwitchDynamicBuffTileMode' });
function actions(field) { try { return JSON.parse(field?.SerializedState); } catch { return null; } }
function rootContract(r, n) {
  const root = n[r.prefabKey]?.[0], mode = n.$ref(root?._modes?.[0]), attack = n.$ref(mode?._attack);
  const graphic = n.$ref(root?._animator), clock = clocks.enemies[r.prefabKey], binding = graphic?._animations.find(a => a.animKey === 'Attack');
  const trigger = n.$ref(mode?._attackTrigger);
  return r.applyWay === 'RANGED' && r.stats.motion === 'WALK' && script(root, '-6629209555389654693')
    && root._modes.length === 1 && !root._commonAbilities.length && root._delayToBorn === 0
    && !mode._generalAbilities.length && n.$ref(mode._combat) === attack
    && script(trigger, '8607874384982393801') && trigger._minTargetNum === 1 && trigger._keepTarget === 0
    && clock && n.$ref(graphic._skeleton)?.skeletonDataAsset.m_PathID === clock.source.skeletonDataPathId
    && binding?.animName === 'Attack' && binding.speed === 1 && binding.loop === 0
    && clock.events.Attack?.length === 1 && clock.events.Attack[0].name === 'OnAttack';
}
function castContract(a, key, damageType) {
  return a?._projectileKey === key && a._damageType === damageType && a._atkScale === 1 && a._attackType === 1
    && a._selectTargetSource === 2 && zero(a._selector) && !a._activeBuffs.length && !a._extraProjectileKeys.length
    && a._animKey === 'Attack' && a._timeMode === 0 && a._waitForAttackEvent === 1 && a._affectedBySlowDown === 1
    && a._useCachedAtkOnly === 0 && a._preDelay === 0 && a._epDamageRatio === 0 && a._projectileDestination === 0;
}
function transport(n, key, speed, lifetime, splash = false) {
  const parts = n.$projectile(key), motion = parts.find(c => '_speed' in c), life = parts.find(c => '_lifeTime' in c);
  return motion?._speed === speed && motion._flyToTargetLocationOnly === 0 && motion._forceReachedWhenTimeup === 1
    && life?._lifeTime === lifetime && life._stopWhenSourceInvalid === 0 && life._maxHitNum === 1
    && life._alwaysHitTraceTargetInTheEnd === 1 && life._canHitSameTargetMultipleTimes === 0
    && life._hitNumType === (splash ? 2 : 1) && life._actionController._dontAddBuffs === 0
    && !life._actionController._extraBuffsInTheEnd.length;
}
function collider(c, motion) {
  const o = c?._targetOptions;
  return script(c, '-3494225671239136090') && c._onlyCheckHitWhenReachTarget === 1 && c._onlyCheckHitWhenStop === 0
    && c._ignoreCamouflage === 1 && c._exceptTraceTarget === 0 && c._onlyTraceTarget === 0 && c._exceptFlyCharacter === 0
    && o?.targetSide === 2 && o.targetMotion === motion && o.targetCategory === 1 && o.ignoreTargetFree === 0
    && !o.containAbnormalFlag && !o.excludeAbnormalFlag && !o.containSomeAbnormalFlags && !o.excludeSomeAbnormalFlags && !o.checkUnitType;
}
export function cannoneerNative(r, n) {
  if (!isCannoneer(r) || !rootContract(r,n) || r.stats.dmgType !== 'phys'
    || !same(r.sp, { type: 'INCREASE_WHEN_ATTACK', maxSp: 3, initSp: 0, increment: 1 })
    || !same(r.talents, { bb: {}, bbStr: {}, groups: {} })
    || !same(r.skills, [{ prefabKey: 'PowerAttack', priority: 0, cooldown: 0, initCooldown: 0, spCost: 2, bb: {}, bbStr: {} }])
    || r.abilities.length !== 1 || r.abilities[0].text !== CANNONEER_TEXT) return false;
  const attack = n.Attack?.[0], power = n.PowerAttack?.find(c => '_projectileKey' in c), wrapper = n.PowerAttack?.find(c => '_familyMask' in c);
  if (!script(attack, '4156651312234227407') || !script(power, '4156651312234227407')
    || !castContract(attack, 'projectile_enemy_dubmb', 1) || !castContract(power, 'projectile_enemy_dubmb_2', 1)
    || wrapper?._familyMask !== 3 || wrapper._ignoreSilence !== 0 || !zero(wrapper._trigger)
    || wrapper._maxTriggerTime !== -1 || wrapper._resetMainAbilityCdWhenCastEnd !== 0) return false;
  for (const [key, splash] of [['projectile_enemy_dubmb', false], ['projectile_enemy_dubmb_2', true]]) {
    const parts = n.$projectile(key), motion = parts.find(c => '_speed' in c);
    if (!transport(n,key,5,10,splash) || !script(motion, '5247176549481151122') || motion._delayTime !== 0 || motion._raiseHeight !== Math.fround(.7)) return false;
    if (splash && (!parts.some(c => same(c.m_Size, { x: 3, y: 3 }) && same(c.m_Offset, { x: 0, y: 0 }))
      || !collider(parts.find(c => '_targetOptions' in c), 3))) return false;
  }
  return true;
}
export function flamecallerNative(r, n) {
  if (!isFlamecaller(r) || !rootContract(r,n) || r.stats.dmgType !== 'arts' || !r.stats.immunities.silence || r.sp || r.skills.length
    || !same(r.talents, { bb: { 'Boom.atk_scale': 1, 'Boom.projectile_range': 1.5 }, bbStr: {}, groups: { Boom: ['atk_scale','projectile_range'] } })
    || r.abilities.length !== 2 || !r.abilities.every(a => FLAMECALLER_TEXT.includes(a.text))) return false;
  const attack = n.Attack?.[0], extra = actions(attack?._actions), boom = n.Boom?.[0], blast = actions(boom?._projectileActions);
  const buff = boom?._buffs?.[0], death = n.$template('ememy_duflm_die')?.eventToActions;
  if (!script(attack, '551713621458524560') || !castContract(attack,'projectile_enemy_duflm',2)
    || attack._actionEvent !== 2 || attack._overwriteAbilityActions !== 0 || extra?.length !== 1 || !ignition(extra[0])
    || !script(boom, '2574888870568471093') || boom._buffs.length !== 1 || boom._projectileBuffs.length || boom._ignoredProjectileEvents.length
    || buff.templateKey !== 'ememy_duflm_die' || buff.isSilenceable || buff.isDamageMissable || buff.lifeTimeType !== 2 || buff.loadFromDB
    || !same(buff.blackboard, [{ key: 'projectile', value: 0, valueStr: 'projectile_enemy_duflm_2' }])
    || !same(Object.keys(death ?? {}), ['ON_OWNER_KILLED']) || death.ON_OWNER_KILLED.length !== 1
    || blast?.length !== 3 || !node(blast[0], 'AdvancedApplyDamage') || !node(blast[1], 'AlwaysNext') || !ignition(blast[2])) return false;
  const emit = death.ON_OWNER_KILLED[0], damage = blast[0];
  if (emit.$type !== 'Torappu.Battle.Action.Nodes+EmitProjectileOnSourceRootTile, Assembly-CSharp'
    || emit._sourceType !== 'SOURCE' || emit._overwriteActions || emit._actions !== null || emit._ev !== 'ON_HIT_OBJECT'
    || damage._damageType !== 'MAGICAL' || damage._atkScaleVar !== 'atk_scale' || damage._defaultAtkScale !== 1
    || damage._applyWay !== 'NONE' || damage._attackType !== 'SPLASH' || damage._sourceType !== 'SOURCE' || damage._targetType !== 'TARGET'
    || damage._forceUseProjectileCachedAtk || damage._noSource || damage._baseOnHostAtk || damage._ignoreForSp
    || damage._ignoreMissFlag !== 'NONE' || damage._ignoreCancelReasonMask !== 'NONE') return false;
  const shot = n.$projectile('projectile_enemy_duflm'), tiles = shot.find(c => '_selector' in c);
  if (!transport(n,'projectile_enemy_duflm',10,5) || shot.find(c => '_speed' in c)?._moveType !== 1
    || tiles?._onlyCheckHitWhenReachTarget !== 1 || tiles._onlyCheckHitWhenStop !== 0
    || !script(n.$projectileRef('projectile_enemy_duflm', tiles._selector), '257106927554094637')) return false;
  const parts = n.$projectile('projectile_enemy_duflm_2'), life = parts.find(c => '_lifeTime' in c), range = parts.find(c => '_scaleble' in c);
  const tileHit = parts.find(c => '_selector' in c), selection = n.$projectileRef('projectile_enemy_duflm_2',tileHit?._selector);
  return life?._lifeTime === Math.fround(.462) && life._alwaysReachInTheEnd === 1 && life._stopWhenSourceInvalid === 0
    && life._maxHitNum === 0 && life._stopAfterMaxHit === 0 && !parts.some(c => '_speed' in c)
    && range?._scaleble === 0 && range._extendable === 0 && parts.some(c => c.m_Radius === Math.fround(1.65) && same(c.m_Offset,{x:0,y:0}))
    && collider(parts.find(c => '_targetOptions' in c),1) && tileHit?._onlyCheckHitWhenReachTarget === 1
    && script(selection,'-7891991905135157257') && selection._targetSide === 3 && selection._targetMotion === 3
    && selection._filterType === 0 && selection._limitTargetNum === 0 && selection._excludeOwnerRootTile === 0
    && !selection._options.checkTileMode && !selection._options.checkTileTypes && !selection._options.checkBuildableOrPassable;
}
const attackAnim = r => ({ dur: clocks.enemies[r.prefabKey].durations.Attack, hit: clocks.enemies[r.prefabKey].events.Attack[0].time });
export const CANNONEER_ABILITY = { kind: 'cannoneer', params: r => ({ attackAnim: attackAnim(r), initialSp: r.sp.initSp, cost: r.skills[0].spCost, increment: r.sp.increment, maxSp: r.sp.maxSp }) };
export const FLAMECALLER_ABILITY = { kind: 'flamecaller', params: r => ({ attackAnim: attackAnim(r), radius: Math.fround(1.65), delay: Math.fround(.462), scale: r.talents.bb['Boom.atk_scale'] }) };
