// SPDX-License-Identifier: GPL-3.0-or-later
// Energy Aggregate (trap_021_flame, PRTS 能量聚合体): the Black Snake's summon on chapter-8 maps. An enemy-side device
// (_sideType 2, _category 1: operators can attack it) with 6000 HP / 200 DEF / 20 RES. Its skill sktok_flame is auto
// (25 SP, +1/s, starts at 0): it plays Die and fires projectile_flame in the four directions (_useEightDirections 0);
// each fireball (speed 2.5, lifetime 60, one hit, through walls, collider 0.25) deals the skill's fixed `damage` as
// Arts (FixedValueDamage x cnt, cnt absent = 1) and applies Burning Breath (dragon_fire, the skill's own values), then
// the device withdraws itself (flame_s[withdraw]). Destroyed before then, it never fires.
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };
const rows = key => native.prefabs[key]?.components.map(c => c.data) ?? [];
const script = (rowsOf, id) => rowsOf.find(c => c.m_Script?.m_PathID === id);
export function flameNativeReviewed(e = native) {
  const r = e.prefabs.trap_021_flame?.components.map(c => c.data) ?? [], s = e.prefabs.sktok_flame?.components.map(c => c.data) ?? [];
  const p = e.prefabs.projectile_flame?.components.map(c => c.data) ?? [];
  const root = r.find(c => '_modes' in c), mode = r.find(c => '_tileOptions' in c);
  const cast = s.find(c => c._projectileKey !== undefined), account = s.find(c => '_canCastWithNoSp' in c), withdraw = s.find(c => c._buffs?.[0]?.templateKey === 'flame_s[withdraw]');
  const move = p.find(c => '_speed' in c), life = p.find(c => '_maxHitNum' in c), hit = p.find(c => '_targetOptions' in c), circle = p.find(c => 'm_Radius' in c);
  const T = e.templates, fs = T?.flame_s?.eventToActions, fw = T?.['flame_s[withdraw]']?.eventToActions;
  return root?._sideType === 2 && root._category === 1 && root._initHpRatio === 1 && root._modes.length === 1
    && mode?._tileOptions.passableMask === 2 && mode._generalAbilities.length === 0
    && cast?._projectileKey === 'projectile_flame' && cast._useEightDirections === 0 && cast._damageType === 1 && cast._animKey === 'Die'
    && cast._activeBuffs.length === 1 && cast._activeBuffs[0].templateKey === 'flame_s' && cast._activeBuffs[0].blackboard.length === 0
    && account?._canCastWithNoSp === 0 && account._canSilenced === 0 && account._allowSpRecoveryWhenAffecting === 0
    && withdraw?._buffs.length === 1
    && move?._speed === 2.5 && move._moveType === 4 && move._useSourceDirection === 1 && move._comeBack === 0 && move._delayToStart === 0
    && life?._lifeTime === 60 && life._maxHitNum === 1 && life._stopAfterMaxHit === 1 && life._canHitSameTargetMultipleTimes === 0
    && hit?._targetOptions.targetSide === 2 && hit._targetOptions.targetMotion === 3 && hit._targetOptions.ignoreTargetFree === 0 && hit._goThroughWall === 1
    && circle?.m_Radius === .25
    && JSON.stringify(fs?.ON_BUFF_START?.map(a => a.$type.split('+')[1].split(',')[0])) === '["FixedValueDamage","CreateBuffById"]'
    && fs.ON_BUFF_START[0]._damageType === 'MAGICAL' && fs.ON_BUFF_START[0]._damageKey === 'damage' && fs.ON_BUFF_START[0]._multiplierKey === 'cnt'
    && fs.ON_BUFF_START[1]._buffKey === 'dragon_fire'
    && JSON.stringify(fw?.ON_BUFF_FINISH?.map(a => [a.$type.split('+')[1].split(',')[0], a._withdrawSource, a._force])) === '[["Withdraw",true,true]]';
}
export function flameDefinition(instance) {
  if (!flameNativeReviewed() || !instance || instance.level !== 1 || ![1, 2].includes(instance.skillLevel))
    throw Error('Unsupported original Energy Aggregate instance');
  const record = tables.devices.trap_021_flame, skill = tables.skills.sktok_flame?.levels?.[instance.skillLevel - 1];
  const frame = record?.phases?.[0]?.attributesKeyFrames?.[0]?.data, bb = Object.fromEntries((skill?.blackboard ?? []).map(x => [x.key, x.value]));
  if (!frame || skill.skillType !== 'AUTO' || skill.spData.spType !== 'INCREASE_WITH_TIME' || skill.spData.spCost !== 25 || skill.spData.initSp !== 0
    || skill.spData.increment !== 1 || Object.keys(bb).sort().join() !== 'damage,dragon_fire.addondamage,dragon_fire.addonduration,dragon_fire.basedamage,dragon_fire.duration'
    || !(bb.damage > 0)) throw Error('Changed Energy Aggregate skill');
  return { kind: 'flame', hp: frame.maxHp, def: frame.def, res: frame.magicResistance, spCost: skill.spData.spCost, initSp: skill.spData.initSp,
    spPerSecond: skill.spData.increment, damage: bb.damage, speed: 2.5, lifetime: 60, radius: .25, directions: 4,
    breath: { duration: bb['dragon_fire.duration'], base: bb['dragon_fire.basedamage'], add: bb['dragon_fire.addondamage'], ramp: bb['dragon_fire.addonduration'] } };
}
