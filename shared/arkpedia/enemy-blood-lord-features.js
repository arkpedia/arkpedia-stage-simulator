// SPDX-License-Identifier: GPL-3.0-or-later
// Duq'arael, 'Regent's Crimson' (enemy_1547_blord and its second form enemy_1547_blord_2; PRTS 杜卡雷，“君主之红”).
// Reviewed from both pinned prefabs, their projectiles, the shared skeleton clocks (arkpedia-blood-lord-animations.json:
// A_* clips are the first form's, B_* the second's) and the templates below. The Throne of Blood's side is reviewed in
// stage-blood-throne.js; the bomb's in enemy-bomb-features.js and stage-bomb-loader.js.
// First form (RANGED, Arts):
// - BloodFog (【血霭遮月】; cooldown 25, initial 10; A_Skill_1, released at its OnAttack): Blood Mist on the tile of one
//   operator anywhere on the map (`_allowOutRangeTile`, `_alwaysRandomInTheEnd`: a random one).
// - BldoreMark: UNDEADABLE (flag 6); enemy_blord_fountain_trigger: when its HP would reach 0 it casts BloodFountain
//   (【血涌濯身】, A_Skill_2) at the Throne (`trap_bldore_fountain_mark`) instead; INVINCIBLE (flag 5) through the clip,
//   whose OnAttack gives the Throne enemy_blord_fountain[trigger] (20 s, every 5 s: Blood Surge) and whose end kills it
//   (enemy_blord_fountain_invincible ON_BUFF_FINISH InstantKill). enemy_blord_mark: 0.5 s in, without the Throne's
//   trap_bldore_summon[blord1] it dies.
// Second form (MELEE, Arts damage dealt as the Attack ability's `_damageType`; summoned by the Throne's destruction):
// - Attack: Blood Affliction (【坏血】, enemy_blord2_extra_damage[timer], `attack@duration` 10 s, refreshed by each hit):
//   the Blood Mist damage template (enemy_blord_fog_damage, first tick after 1 s) and its redeployment penalty.
// - HpAura (【绯红冠冕】) unless enemy_blord2_hp_aura[ctrl]: Sanctuary (`HpAura.damage_resistance`, 90%, Physical and
//   Arts) and +`HpAura.hp_recovery_per_sec` HP/s to the other enemies within 1.7. HpAuraCtrl every 0.5 s: hit by a bomb's
//   Explosion (`enemy_bmbcar_explosion_mark`), the aura is off for `HpAuraCtrl.duration` and Crimson Edict is interrupted.
// - BloodFog2 (【殷红敕令】; cooldown 30, initial 10): a `duration` (15 s) cast that summons Blood Amber
//   (`enemy_blord2_fog[summon].enemy_key`) every `.interval` s from its start (4: at 0, 5, 10 and 15 s) at a random
//   point within `.offset_bound` of its tile, each after `.delay` s; then B_Skill_1_End's OnAttack releases Blood Mist on
//   the unit blocking it, otherwise on its own tile (PRTS; the selector class is the Throne's).
// - KillBmbcar (radius 0.5): a bomb touching it explodes (enemy_blord2_kill[bmbcar]); unless it is already casting
//   Sunken Death, the bomb's Loading Point is marked (enemy_blord2_kill[mark]) and it casts BloodFountain2 (【沉沦之殁】).
//   The Loading Point's own Blord2Trigger (radius 2) does the same when it comes near (stage-bomb-loader.js).
// - BloodFountain2 (one of three identical B_Skill_2_* clips, 8.5 s): enemy_blord_fountain[trigger] (`duration` 10 s,
//   every 5 s: Blood Surge at ATK x `atk_scale`, stun `stun`); at the clip's OnAttack (7.37 s) every marked Loading Point
//   is destroyed (enemy_blord2_fountain[outset] ON_BUFF_FINISH -> FountainKillSelector -> instant_kill).
import clocks from '../../data/arkpedia-blood-lord-animations.json' with { type: 'json' };
import { BLOOD_LORD, BLOOD_LORD_TWO, BLOOD_AMBER_KEY, BLOOD_MIST_SELECTOR_SCRIPT, BLOOD_SURGE_CROSS,
  bloodMistNativeReviewed, bloodMistParams, bloodSurgeNativeReviewed } from './stage-blood-throne.js';

export { BLOOD_LORD, BLOOD_LORD_TWO };
const f32 = Math.fround;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const type = a => a?.$type?.split('+')[1]?.split(',')[0];
const types = list => (list ?? []).map(type).join();
const keys = list => (list ?? []).map(b => b.buffKey).join();
export const isBloodLord = r => r?.prefabKey === BLOOD_LORD;
export const isBloodLordTwo = r => r?.prefabKey === BLOOD_LORD_TWO;
export const BLOOD_LORD_TEXT = Object.freeze(['First Form',
  '[Moon-Devouring Bloodmist] Releases a searing Blood Mist centered around a target, inflicting increasing amounts of Arts damage to allied units within while reducing their ASPD and increasing their Redeployment Time. Pieces of Blood Amber affected by this Blood Mist will turn into Bloodborn Spawn.',
  '[Blood Surge] When defeated, this skill will activate 4 times, selecting one target each time (prioritizing units that have not been hit). Deals Arts damage to the target and all units in the adjacent 4 tiles and stuns them.',
  'When defeated, returns to the Throne of Blood and revives after a period of time.',
  'Enters second form when the Throne of Blood is destroyed.',
  'Second Form',
  'Takes greatly reduced Physical and Arts damage and increases the HP recovery rate of other surrounding enemy units (this trait will be lost for a while when this unit is hit by an <Anti-Witchcraft Repositionable Bomb>)',
  '[Blood Affliction] Attacks deal continuous Arts damage that ramps up over time. If the target leaves the field during this duration, their Redeployment Time will be greatly increased.',
  '[Crimson Edict] Continuously spawns <Blood Amber> around this unit for a period of time. Afterward, Blood Mist will be released centered around this unit.',
  '[Sunken Death] When struck by an <Anti-Witchcraft Repositionable Bomb>, destroys the corresponding bomb loading point, and releases [Blood Surge] twice.']);

const MIST_BB = { projectile_life_time: 10, projectile_range: 1.7, baseDamage: 50, addOnDamage: 150, addOnDuration: 10, delay: 1,
  respawn_time: 2, attack_speed: -40 };
const ONE_SKILLS = [{ prefabKey: 'BloodFog', priority: 0, cooldown: 25, initCooldown: 10, spCost: 0,
  bb: { ...MIST_BB, hp_ratio: 0, max_target: 1 }, bbStr: { enemy_key: 'enemy_1360_dfello' } },
{ prefabKey: 'BloodFountain', priority: 1, cooldown: 0, initCooldown: 0, spCost: 0, bb: { duration: 20, interval: 5 }, bbStr: {} }];
const TWO_TALENTS = { 'HpAuraCtrl.duration': 15, 'HpAura.hp_recovery_per_sec': 300, 'HpAura.damage_resistance': 0.9,
  'Attack.attack@baseDamage': 50, 'Attack.attack@addOnDamage': 150, 'Attack.attack@addOnDuration': 10, 'Attack.attack@respawn_time': 2,
  'Attack.attack@duration': 10, 'Attack.attack@hp_ratio': 0, 'Attack.attack@ep_damage_ratio': 0 };
const TWO_SKILLS = [{ prefabKey: 'BloodFog2', priority: 0, cooldown: 30, initCooldown: 10, spCost: 0,
  bb: { duration: 15, ...MIST_BB, 'enemy_blord2_fog[summon].delay': 1, 'enemy_blord2_fog[summon].offset_bound': 0.3, 'enemy_blord2_fog[summon].interval': 5 },
  bbStr: { enemy_key: 'enemy_1360_dfello', 'enemy_blord2_fog[summon].enemy_key': BLOOD_AMBER_KEY } },
{ prefabKey: 'BloodFountain2', priority: 1, cooldown: 0, initCooldown: 0, spCost: 0, bb: { stun: 5, duration: 10, interval: 5, atk_scale: 0.5 }, bbStr: {} }];
// Level 1 lists only what differs (HpAuraCtrl.duration 10); it is read over level zero, as the game does.
// The record's 0.9, or the 0.3 that 14-20 writes; no other value is placed by a stage.
const sanctuaryValue = v => v === .9 || v === .3;
const twoTalents = r => ({ ...TWO_TALENTS, ...r.talents.bb });
const ordered = bb => JSON.stringify(Object.keys(bb).sort().map(k => [k, bb[k]]));
const skillsAre = (got, want) => got?.length === want.length && want.every((s, i) => got[i]?.prefabKey === s.prefabKey
  && got[i].cooldown === s.cooldown && got[i].initCooldown === s.initCooldown && ordered(got[i].bb) === ordered(s.bb) && same(got[i].bbStr, s.bbStr));

const clip = k => clocks.enemies[BLOOD_LORD].durations[k];
const hit = k => clocks.enemies[BLOOD_LORD].events[k].find(e => e.name === 'OnAttack').time;
/** Selector of a FountainDamage / FountainAlarm: one operator still holding the round mark. */
const markSelector = s => s?._buffKey === 'enemy_blord_fountain[mark]' && s._secondaryFilter === 3 && s._targetSide === 2
  && s._targetCategory === 1 && s._maxNum === 1 && s._postFilter === 4;

function fountainNative(n) {
  const T = k => n?.$template?.(k)?.eventToActions;
  const trig = T('enemy_blord_fountain[trigger]');
  const surge = (n?.FountainDamage ?? []).find(c => c._activeBuffs), hint = (n?.FountainHint ?? [])[0];
  const mark = n?.$ref?.(hint?._wrappedAbilities?.[0]);
  return types(trig?.ON_BUFF_START) === 'TriggerAbility,TriggerAbility' && trig.ON_BUFF_START[0]._abilityName === 'FountainHint'
    && trig.ON_BUFF_START[1]._abilityName === 'FountainAlarm' && types(trig.ON_BUFF_TRIGGER) === 'TriggerAbility'
    && trig.ON_BUFF_TRIGGER[0]._abilityName === 'FountainDamage' && types(trig.ON_BUFF_FINISH) === 'InterruptAbility,InterruptAbility'
    && (!surge || keys(surge._activeBuffs) === 'enemy_blord_fountain[damage],stun' && markSelector(n.$ref(surge._selector))
      && surge._projectileKey === 'projectile_enemy_blord_s[stun]')
    && (!mark || keys(mark._buffs) === 'enemy_blord_fountain[mark]')
    && bloodSurgeNativeReviewed(n.$projectile('projectile_enemy_blord_s[stun]'), new Proxy({}, { get: (_, k) => n.$template(k) }), n.$range('x-5'), { hitMark: false });
}

export function bloodLordNative(r, n) {
  if (!isBloodLord(r) || r.rank !== 'BOSS' || r.applyWay !== 'RANGED' || r.stats?.dmgType !== 'arts' || Object.keys(r.talents.bb).length
    || !skillsAre(r.skills, ONE_SKILLS)) return false;
  const T = k => n?.$template?.(k)?.eventToActions;
  const fogWrap = (n?.BloodFog ?? []).find(c => '_trigger' in c), fog = (n?.BloodFog ?? []).find(c => c._projectileKey);
  const tile = n?.$ref?.(fog?._selector), pick = n?.$ref?.(tile?._selector);
  const fount = (n?.BloodFountain ?? []).find(c => c._activeBuffs), fountSel = n?.$ref?.(fount?._selector);
  const inv = n?.$siblings?.(fount)?.find(c => c._buffs?.[0]?.buffKey === 'enemy_blord_fountain_invincible');
  const mark = (n?.BldoreMark ?? [])[0];
  const die = T('enemy_blord_mark')?.ON_BUFF_TRIGGER, lethal = T('enemy_blord_fountain_trigger')?.ON_BEFORE_TRY_SET_HP_ZERO;
  const trig = fount?._activeBuffs?.[0];
  return fogWrap?._familyMask === 3 && fog?._animKey === 'Skill_1' && fog._waitForAttackEvent === 1
    && keys(fog._activeBuffs) === 'enemy_blord_fog_buffs' && fog._projectileKey === 'projectile_enemy_blord_s[fog]'
    && tile?._alwaysRandomInTheEnd === 1 && tile._allowOutRangeTile === 1 && tile._maxNum === 1
    && pick?._targetSide === 2 && pick._targetCategory === 1 && pick._maxNum === 1
    && fount?._animKey === 'Skill_2' && fountSel?._buffKey === 'trap_bldore_fountain_mark' && fountSel._targetSide === 1
    && fountSel._targetCategory === 2 && trig?.templateKey === 'enemy_blord_fountain[trigger]' && trig.lifeTimeType === 1
    && trig.durationKey === 'duration' && trig.triggerLifeType === 2 && trig.triggerInterval === 5 && trig.waitFirstTriggerInterval === 1
    && same(inv?._buffs?.[0]?.attributes?.abnormalFlags, [5]) && inv._startEvent === 2 && inv._endEvent === 3
    && types(T('enemy_blord_fountain_invincible')?.ON_BUFF_FINISH) === 'InstantKill'
    && keys(mark?._buffs) === 'enemy_blord_mark,enemy_blord_undeadable,enemy_blord_fountain_trigger'
    && mark._buffs[0].triggerLifeType === 1 && mark._buffs[0].triggerCnt === 1 && mark._buffs[0].triggerInterval === 0.5
    && same(mark._buffs[1].attributes?.abnormalFlags, [6])
    && types(die) === 'CheckContainsBuff,IfNot,InstantKill' && same(die[0]._buffKeys, ['trap_bldore_summon[blord1]'])
    && types(lethal) === 'TriggerEnemySkill,FinishBuff' && lethal[0]._skillName === 'BloodFountain' && lethal[0]._interruptCurAbility === true
    && bloodMistNativeReviewed(n.$projectile('projectile_enemy_blord_s[fog]'), new Proxy({}, { get: (_, k) => n.$template(k) }))
    && fountainNative(n)
    && clip('A_Skill_1') === 6 && hit('A_Skill_1') === f32(1.4333332777023315) && clip('A_Skill_2') === 4 && hit('A_Skill_2') === 2;
}

export function bloodLordTwoNative(r, n) {
  if (!isBloodLordTwo(r) || r.rank !== 'BOSS' || r.applyWay !== 'MELEE' || !skillsAre(r.skills, TWO_SKILLS)) return false;
  const bb = twoTalents(r);
  // 14-20 places him with a weaker Sanctuary (`HpAura.damage_resistance` 0.3 for the record's 0.9).
  if (ordered({ ...bb, 'HpAuraCtrl.duration': 15, 'HpAura.damage_resistance': .9 }) !== ordered(TWO_TALENTS)
    || ![10, 15].includes(bb['HpAuraCtrl.duration']) || !sanctuaryValue(bb['HpAura.damage_resistance'])) return false;
  const T = k => n?.$template?.(k)?.eventToActions;
  const combat = (n?.Combat ?? [])[0], affliction = T('enemy_blord2_extra_damage[timer]');
  const fog = (n?.BloodFog2 ?? []).find(c => c._projectileKey), fogSel = n?.$ref?.(fog?._selector);
  const summonBuff = n?.$siblings?.(fog)?.find(c => c._buffs?.[0]?.buffKey === 'enemy_blord2_fog[summon]')?._buffs?.[0];
  const summon = n?.$template?.('enemy_blord2_fog[summon]')?.eventToActions?.ON_BUFF_TRIGGER;
  const ctrl = (n?.HpAuraCtrl ?? [])[0], ctrlRun = T('enemy_blord2_hp_aura[trigger]')?.ON_BUFF_TRIGGER;
  const aura = (n?.HpAura ?? [])[0], check = n?.$ref?.(aura?._checker);
  const resist = n?.$ref?.(aura?._abilities?.[0]), heal = n?.$ref?.(aura?._abilities?.[1]);
  const healCircle = n?.$siblings?.(heal)?.find(c => c.m_Radius !== undefined);
  const killer = (n?.KillBmbcar ?? [])[0], killCircle = n?.$siblings?.(killer)?.find(c => c.m_Radius !== undefined);
  const killRun = T('enemy_blord2_kill[bmbcar]'), outset = T('enemy_blord2_fountain[outset]');
  const sw = (n?.BloodFountain2 ?? []).find(c => c._abilityConfigs);
  const variants = (sw?._abilityConfigs ?? []).map(x => n.$ref(x._ability));
  const victims = n?.$ref?.((n?.FountainKillSelector ?? [])[0]?._selector);
  return combat?._animKey === 'Attack' && keys(combat._activeBuffs) === 'enemy_blord2_extra_damage[timer]'
    && combat._activeBuffs[0].lifeTimeType === 1 && combat._activeBuffs[0].durationKey === 'duration'
    && types(affliction?.ON_BUFF_START) === 'CheckContainsBuff,IfNot,CreateBuff,CreateBuff'
    && affliction.ON_BUFF_START[2]._buff.templateKey === 'enemy_blord_fog_damage' && affliction.ON_BUFF_START[2]._buff.waitFirstTriggerInterval === true
    && affliction.ON_BUFF_START[2]._buff.triggerInterval === 1 && affliction.ON_BUFF_START[3]._buff.templateKey === 'enemy_blord2_listener'
    && fog?._timeMode === 3 && keys(fog._activeBuffs) === 'enemy_blord_fog_buffs' && fog._projectileKey === 'projectile_enemy_blord_s[fog]'
    && fogSel?.m_Script?.m_PathID === BLOOD_MIST_SELECTOR_SCRIPT && Object.keys(fogSel).every(k => k.startsWith('m_'))
    && summonBuff?.durationKey === 'duration' && summonBuff.triggerLifeType === 2 && summonBuff.waitFirstTriggerInterval === 0
    && types(summon) === 'SummonEnemiesFollowMyRoute' && summon[0]._enemyKey === null && summon[0]._managedByScheduler === true
    && summon[0]._useRandomDelay === false && summon[0]._useMapPosition === false
    && keys(ctrl?._buffs) === 'enemy_blord2_hp_aura[trigger],enemy_blord2_mark' && ctrl._buffs[0].triggerInterval === 0.5
    && types(ctrlRun) === 'CheckContainsBuff,FinishBuffsById,CreateBuff,CheckEnemyAbilityName,InterruptEnemyAbility,FinishBuffsById'
    && same(ctrlRun[0]._buffKeys, ['enemy_bmbcar_explosion_mark']) && ctrlRun[2]._buff.buffKey === 'enemy_blord2_hp_aura[ctrl]'
    && ctrlRun[3]._abilityName === 'BloodFog2' && ctrlRun[5]._buffKey === 'enemy_blord2_fog[summon]'
    && check?._excludeBuff === 1 && check._buffKey === 'enemy_blord2_hp_aura[ctrl]'
    && keys(resist?._buffs) === 'damage_resistance[inf],enemy_blord2_t[effect]'
    && keys(heal?._buffs) === 'enemy_blord_hp_recover' && heal._buffs[0].attributes?.attributeModifiers?.[0]?.attributeType === 13
    && heal._selfOption === 2 && heal._removeBuffWhenTargetLeave === 1 && healCircle?.m_Radius === f32(1.7)
    && keys(killer?._buffs) === 'enemy_blord2_kill[bmbcar]' && killCircle?.m_Radius === .5
    && same(n.$ref(killer._targetValidator)?._buffs, ['enemy_bmbcar1_passive'])
    && types(killRun?.ON_BUFF_START) === 'TriggerEnemySkill' && killRun.ON_BUFF_START[0]._skillName === 'Explosion'
    && types(killRun.ON_BUFF_FINISH) === 'CheckUnitAlive,IfElse'
    && variants.length === 3 && variants.every((v, i) => v?._animKey === `Skill_2_${i + 1}`)
    && variants.every(v => keys(n.$siblings(v).find(c => c._buffs?.[0]?.buffKey === 'enemy_blord_fountain[trigger]')?._buffs) === 'enemy_blord_fountain[trigger]')
    && variants.every(v => n.$siblings(v).some(c => c._buffs?.[0]?.buffKey === 'enemy_blord2_fountain[outset]' && c._startEvent === 2 && c._endEvent === 4))
    && types(outset?.ON_BUFF_FINISH) === 'CreateBuffUseAbilitySelector' && outset.ON_BUFF_FINISH[0]._abilityName === 'FountainKillSelector'
    && outset.ON_BUFF_FINISH[0]._buff.templateKey === 'instant_kill'
    && victims?._buffKey === 'enemy_blord2_kill[mark]' && victims._targetCategory === 2 && victims._targetSide === 2
    && bloodMistNativeReviewed(n.$projectile('projectile_enemy_blord_s[fog]'), new Proxy({}, { get: (_, k) => n.$template(k) }))
    && fountainNative(n)
    && clip('B_Skill_1_End') === 2 && hit('B_Skill_1_End') === f32(.4333333373069763)
    && ['B_Skill_2_1', 'B_Skill_2_2', 'B_Skill_2_3'].every(k => clip(k) === 8.5 && hit(k) === f32(7.366666793823242))
    && clip('B_Attack') === f32(2.5333333015441895) && hit('B_Attack') === 1;
}

const surgeCross = () => BLOOD_SURGE_CROSS.map(p => [...p]);
export function bloodLordParams(r) {
  const [fog, fountain] = r.skills;
  return { mist: { ...bloodMistParams({ ...fog.bb, ...fog.bbStr }), initial: fog.initCooldown, cooldown: fog.cooldown,
    cast: clip('A_Skill_1'), release: hit('A_Skill_1') },
  surge: { duration: fountain.bb.duration, interval: fountain.bb.interval, cast: clip('A_Skill_2'), release: hit('A_Skill_2'), cross: surgeCross() },
  markCheck: .5 };
}
export function bloodLordTwoParams(r) {
  const bb = twoTalents(r), [edict, sunken] = r.skills;
  const s = k => edict.bb[`enemy_blord2_fog[summon].${k}`];
  return {
    affliction: { duration: bb['Attack.attack@duration'], base: bb['Attack.attack@baseDamage'], add: bb['Attack.attack@addOnDamage'],
      ramp: bb['Attack.attack@addOnDuration'], redeploy: bb['Attack.attack@respawn_time'], firstTick: 1 },
    aura: { sanctuary: bb['HpAura.damage_resistance'], heal: bb['HpAura.hp_recovery_per_sec'], radius: f32(1.7), off: bb['HpAuraCtrl.duration'], check: .5 },
    edict: { initial: edict.initCooldown, cooldown: edict.cooldown, duration: edict.bb.duration, amber: edict.bbStr['enemy_blord2_fog[summon].enemy_key'],
      every: s('interval'), delay: s('delay'), offset: s('offset_bound'), end: clip('B_Skill_1_End'), release: hit('B_Skill_1_End'),
      mist: bloodMistParams({ ...edict.bb, ...edict.bbStr }) },
    sunken: { duration: sunken.bb.duration, interval: sunken.bb.interval, scale: sunken.bb.atk_scale, stun: sunken.bb.stun,
      cast: clip('B_Skill_2_1'), destroyAt: hit('B_Skill_2_1'), cross: surgeCross() },
    bombContact: .5, loaderContact: 2,
  };
}

const lines = new Set(BLOOD_LORD_TEXT);
export const BLOOD_LORD_FEATURES = Object.freeze({
  'skill:BloodFog': { matchesRecord: isBloodLord, covers: bloodLordNative, nativeClaim: () => ({ wrappers: 2, active: 1 }),
    explains: text => lines.has(text), ability: r => ({ kind: 'bloodLord', params: () => bloodLordParams(r) }),
    dependsOn: r => [r.skills[0].bbStr.enemy_key],
    note: 'Duq\'arael, first form: Blood Mist on a random operator; undying, his defeat makes the Throne of Blood surge and revive him' },
  'skill:BloodFountain': { matchesRecord: isBloodLord, covers: bloodLordNative, ability: null,
    note: 'Duq\'arael, first form: Blood Surge from the Throne (implemented with skill:BloodFog, kind bloodLord)' },
  'skill:BloodFog2': { matchesRecord: isBloodLordTwo, covers: bloodLordTwoNative, nativeClaim: () => ({ wrappers: 2, active: 3 }),
    ability: r => ({ kind: 'bloodLordTwo', params: () => bloodLordTwoParams(r) }),
    dependsOn: r => [r.skills[0].bbStr.enemy_key, r.skills[0].bbStr['enemy_blord2_fog[summon].enemy_key']],
    note: 'Duq\'arael, second form: Crimson Edict, Sunken Death, Blood Affliction and his Sanctuary/heal aura' },
  'skill:BloodFountain2': { matchesRecord: isBloodLordTwo, covers: bloodLordTwoNative, ability: null,
    note: 'Sunken Death (implemented with skill:BloodFog2, kind bloodLordTwo)' },
  'talent:HpAuraCtrl': { matchesRecord: isBloodLordTwo, covers: bloodLordTwoNative, ability: null, note: 'aura switch (kind bloodLordTwo)' },
  'talent:HpAura': { matchesRecord: isBloodLordTwo, covers: bloodLordTwoNative, ability: null, note: 'Sanctuary and heal aura (kind bloodLordTwo)',
    stageOverrides: { 'HpAura.damage_resistance': sanctuaryValue } },
});
