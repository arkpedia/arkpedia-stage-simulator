// SPDX-License-Identifier: GPL-3.0-or-later
import clock from '../../data/arkpedia-ratking-animations.json' with { type: 'json' };
const node = (a, name) => a?.$type === `Torappu.Battle.Action.Nodes+${name}, Assembly-CSharp`;
const selector = (n, value, order) => value?._targetSide === 2 && value._targetCategory === 1
  && value._targetMotion === 1 && value._maxNum === 1 && value._postFilter === order
  && value._ignoreTargetFree === 0 && value._forceIgnoreCamouflage === 0
  && n.$siblings(value).some(c => c.m_Script?.m_PathID === '6275044311115013764');
export function ratKingNative(r, n) {
  const cb10 = r.level === 0 && r.skills.map(s => s.prefabKey).join() === 'SandStorm,DriftSand';
  if (r.prefabKey !== 'enemy_1509_mousek' || ![0, 1].includes(r.level) || r.applyWay !== 'RANGED'
    || r.stats.dmgType !== 'arts' || r.skills.length !== (cb10 ? 2 : 3) || r.stats.rawRangeRadius !== 2.5) return false;
  const expected = { 'shield.dynamic': r.level ? 7334 : 4667, 'defup.def': 3000,
    'enrage.hp_ratio': .5, 'enrage.damage_scale': r.level ? 1.7 : 1.5 };
  if (Object.keys(r.talents.bb).length !== 4 || Object.keys(r.talents.bbStr).length
    || Object.entries(expected).some(([k, v]) => r.talents.bb[k] !== v)) return false;
  const root = n[r.prefabKey]?.[0], animator = n.$ref(root?._animator);
  if (root?._modes.length !== 2 || root._commonAbilities.length !== 1
    || n.$ref(animator?._skeleton)?.skeletonDataAsset.m_PathID !== clock.source.skeletonDataPathId) return false;
  const sleep = n.$ref(root._commonAbilities[0])?._buffs;
  if (sleep?.length !== 1 || sleep[0].isSilenceable !== 0 || sleep[0].attributes.abnormalComboImmunes.join() !== '0') return false;
  for (const ref of root._modes) {
    const mode = n.$ref(ref), attack = n.$ref(mode?._attack);
    if (mode?._generalAbilities.length || n.$ref(mode._combat) !== attack
      || attack?._projectileKey !== 'projectile_mousek' || attack._damageType !== 2 || attack._atkScale !== 1
      || attack._activeBuffs.length || attack._animKey !== 'Attack' || attack._timeMode !== 0 || attack._waitForAttackEvent !== 1) return false;
    const sel = n.$siblings(mode._attackTrigger).find(c => '_targetSide' in c);
    if (sel?._targetMotion !== 1 || sel._targetSide !== 2 || sel._maxNum !== 1) return false;
  }
  for (const [clip, duration, hit] of [['Attack', 70 / 30, 41 / 30], ['Skill_1', 70 / 30, 59 / 30], ['Skill_2', 40 / 30, 20 / 30]]) {
    const binding = animator._animations.find(a => a.animKey === clip), event = clock.events[clip];
    if (binding?.animName !== clip || binding.speed !== 1 || binding.loop !== 0
      || clock.durations[clip] !== Math.fround(duration) || event.length !== 1 || event[0].time !== Math.fround(hit)) return false;
  }
  for (const [i, name] of ['DriftSand', 'SandStorm', 'Mark'].entries()) {
    const s = r.skills.find(s => s.prefabKey === name);
    const wrapper = n[name]?.find(c => '_familyMask' in c);
    if (wrapper?._ignoreSilence !== 1 || wrapper._familyMask !== 3 || wrapper._maxTriggerTime !== (i === 2 ? 1 : -1)
      || wrapper._resetMainAbilityCdWhenCastEnd !== 0) return false;
    if (!s) { if (cb10 && i === 2) continue; return false; }
    if (s.prefabKey !== name || s.spCost !== 0 || Object.keys(s.bbStr).length
      || s.cooldown !== [15, r.level ? 20 : 25, 9999][i] || s.initCooldown !== [r.level ? 10 : 20, r.level ? 15 : cb10 ? 65 : 60, 1][i]
      || s.priority !== (i === 2 || i === 1 && r.level ? 1 : 0)) return false;
    if (i === 2) { if (Object.keys(s.bb).length) return false; continue; }
    const cast = n[name].find(c => '_projectileKey' in c);
    if (cast?._projectileKey !== `projectile_mousek_s${i + 1}` || cast._atkScale !== 0
      || cast._timeMode !== 1 || cast._waitForAttackEvent !== 1 || cast._affectedBySlowDown !== 1
      || cast._animKey !== `Skill_${i + 1}` || cast._selectTargetSource !== 3
      || !selector(n, n.$ref(cast._selector), 19 + i)) return false;
    const buffs = cast._activeBuffs;
    if (buffs.length !== i + 1 || buffs[0].templateKey !== (i ? 'instant_damage_magic[buff]' : 'instant_damage_physical[splash]')
      || buffs.some(b => b.isDamageMissable !== 0 || b.isSilenceable !== 0 || b.statusResistable !== 2)) return false;
    if (i === 0 && (Object.keys(s.bb).join() !== 'damage' || s.bb.damage !== (r.level ? 1500 : cb10 ? 1200 : 800))) return false;
    if (i === 1) {
      const mod = buffs[1].attributes.attributeModifiers;
      if (Object.keys(s.bb).sort().join() !== 'atk,damage,duration' || s.bb.atk !== -.7 || s.bb.duration !== 15
        || s.bb.damage !== (r.level ? 100 : 70) || buffs[1].overrideType !== 2 || buffs[1].lifeTimeType !== 1
        || mod.length !== 1 || mod[0].attributeType !== 1 || mod[0].formulaItem !== 3 || mod[0].loadFromBlackboard !== 1) return false;
    }
  }
  for (const [name, order] of [['MaxHpAsc', 20], ['MaxHpDes', 19]]) {
    const c = n[name]?.find(c => '_uniqueBuff' in c);
    if (!selector(n, n.$ref(c?._selector), order) || c._uniqueBuff.templateKey !== 'empty' || c._uniqueBuff.lifeTimeType !== 2) return false;
  }
  const shields = n.shield?.find(c => '_buffs' in c)?._buffs, def = n.defup?.[0]?._buffs?.[0]?.attributes.attributeModifiers;
  if (shields?.length !== 3 || shields.some((b, i) => b.templateKey !== (i === 2 ? 'mousek_shield_end' : 'mousek_shield')
    || b.isSilenceable !== 0 || b.lifeTimeType !== 2) || shields[2].blackboard[0]?.value !== 1
    || def?.length !== 1 || def[0].attributeType !== 2 || def[0].formulaItem !== 0 || def[0].loadFromBlackboard !== 1) return false;
  for (const name of ['mousek_shield', 'mousek_shield_end']) {
    const a = n.$template(name)?.eventToActions.ON_TAKE_DAMAGE;
    if (!node(a?.[0], 'BlockDamage') || !a[0]._filterDamageType || a[0]._damageMask !== 'MAGICAL'
      || !a[0]._useDynamicVar || a[0]._useFixedValue || a[0]._allowNegativeDynamicVar
      || !node(a[1], 'IsBlackboardZero') || a[1]._var !== 'dynamic' || !node(a[2], 'FinishBuff')
      || name.endsWith('_end') && (!node(a[3], 'SwitchMode') || !a[3]._loadModeFromBlackboard)) return false;
  }
  const rage = n.enrage?.find(c => '_checker' in c), hp = n.$ref(rage?._checker);
  if (hp?._toggleOnce !== 0 || hp._minHpRatio !== 0 || hp._restoreDelay !== 0 || rage._buffs.length !== 1
    || rage._buffs[0].templateKey !== 'damage_scale[out]' || rage._buffs[0].isSilenceable !== 1) return false;
  const projectile = n.$projectile('projectile_mousek'), move = projectile.find(c => '_speed' in c), life = projectile.find(c => '_lifeTime' in c);
  if (move?._speed !== 10 || move._flyToTargetLocationOnly !== 0 || life?._lifeTime !== 10 || life._maxHitNum !== 1) return false;
  for (const [i, key] of ['projectile_mousek_s1', 'projectile_mousek_s2'].entries()) {
    const p = n.$projectile(key), life = p.find(c => '_lifeTime' in c), move = p.find(c => '_followTarget' in c);
    if (life?._stopWhenSourceInvalid !== 0 || life._lifeTime !== (i ? 15 : 10)
      || move?._followTarget !== 0 || move._keepUpdate !== 0 || move._delayTime !== 0) return false;
    const boxes = p.filter(c => c.m_Size).map(c => `${c.m_Size.x},${c.m_Size.y}`).sort().join(';');
    if (boxes !== (i ? '3,3' : '1,7;7,1') || p.filter(c => c.m_Size).some(c => c.m_Offset.x || c.m_Offset.y)) return false;
    if (i) {
      const repeat = p.find(c => '_interval' in c), sel = p.find(c => '_targetSide' in c);
      if (repeat?._interval !== 1 || repeat._waitFirstPeriod !== 0 || life._keepAlreadyHitTime !== 1
        || sel?._targetMotion !== 3 || sel._forceIgnoreCamouflage !== 0 || sel._ignoreTargetFree !== 0) return false;
    } else if (!p.some(c => c._ignoreCamouflage === 1 && c._targetOptions.targetMotion === 3)) return false;
  }
  for (const [key, type, noSp] of [['instant_damage_physical[splash]', 'PHYSICAL', true], ['instant_damage_magic[buff]', 'MAGICAL', false]]) {
    const a = n.$template(key)?.eventToActions.ON_BUFF_START;
    if (a?.length !== 1 || !node(a[0], 'FixedValueDamage') || a[0]._damageType !== type
      || a[0]._damageKey !== 'damage' || a[0]._noSourceDamage || a[0]._ignoreForSp !== noSp) return false;
  }
  return true;
}
const skill = (r, key) => r.skills.find(s => s.prefabKey === key);
const cast = (r, name, clip) => ({ cooldown: skill(r, name).cooldown, initial: skill(r, name).initCooldown, priority: skill(r, name).priority,
  order: r.skills.indexOf(skill(r, name)), clip, slowDown: true, duration: clock.durations[clip], release: clock.events[clip][0].time });
export const RAT_KING_FEATURES = {
  'skill:DriftSand': { covers: ratKingNative, nativeClaim: () => ({ wrappers: 3, active: 1 }),
    stageSkillSetOverride: (r, keys) => r.prefabKey === 'enemy_1509_mousek' && r.level === 0 && keys.join() === 'SandStorm,DriftSand',
    stageSkillTimingOverrides: { SandStorm: { initCooldown: v => v === 65 } },
    stageSkillOverrides: { DriftSand: { damage: v => v === 1200 } },
    ability: { kind: 'ratKing', params: r => ({ shield: r.talents.bb['shield.dynamic'], defense: r.talents.bb['defup.def'],
      threshold: r.talents.bb['enrage.hp_ratio'], enrage: r.talents.bb['enrage.damage_scale'], speed: 10,
      cross: cast(r, 'DriftSand', 'Skill_1'), sand: cast(r, 'SandStorm', 'Skill_2'), markInitial: skill(r, 'Mark')?.initCooldown ?? Infinity,
      crossDamage: skill(r, 'DriftSand').bb.damage, sandDamage: skill(r, 'SandStorm').bb.damage, atkDown: skill(r, 'SandStorm').bb.atk,
      debuffDuration: skill(r, 'SandStorm').bb.duration, fieldDuration: 15,
      attackAnim: { dur: clock.durations.Attack, hit: clock.events.Attack[0].time } }) },
    explains: /^(\[Singing Sands\] Targets a unit with the highest Max HP, dealing heavy physical damage to the target and nearby allied units within a cross area|\[Sand Tomb\] Targets a unit with the lowest Max HP, continuously inflicting Arts damage to the target and nearby allies, also reducing their ATK|Appears with a Barrier that can absorb a large amount of Arts damage, gains significantly increased DEF while Barrier is active|Deals more damage when HP drops below half)$/ },
  'skill:SandStorm': { covers: ratKingNative },
  'skill:Mark': { covers: ratKingNative },
  'talent:enrage': { covers: ratKingNative },
};
