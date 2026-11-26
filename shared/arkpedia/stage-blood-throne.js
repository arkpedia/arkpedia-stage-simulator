// SPDX-License-Identifier: GPL-3.0-or-later
// Throne of Blood (trap_127_bldore, PRTS 沥血王座; 13-21). An enemy-side trap (side 2, category 2: no character selector
// takes it, so it cannot be attacked), HEAL_FREE, immune to stun and freeze. It is bound to Duq'arael, 'Regent's
// Crimson' (enemy_1547_blord / _2, enemy-blood-lord-features.js). Reviewed from the pinned prefab, sktok_bldore, the
// Blood Mist and Blood Surge projectiles and the templates below.
// - Talent `1` ticks trap_bonore_upgraded[summon] and its Passive holds `trap_bonore_upgraded`: every `interval` (10 s,
//   the talent blackboard and PRTS; the buff's serialized 5 s is not used, as for the Altar) it summons one Blood Amber
//   (`talent@enemy_key`) on its own branch (`talent@branch_id`, the instance's `branch_id`), a random phase when the
//   branch has several.
// - DseedHpCtrl: Blood Amber (`enemy_bldore_mark`) gets `trap_bonore_dseed_hp_ctrl`, which stops its HP loss
//   (enemy_dseed_hp_loss) while the Throne stands.
// - sktok_bldore (AUTO, 20 SP at 1 SP/s from 15): Blood Mist (enemy_blord_fog_buffs in projectile_enemy_blord_s[fog]).
//   Its target selector is a field-less class (script 257106927554094637), the same as the second form's Crimson Edict
//   mist; PRTS gives that one "the unit blocking it, otherwise its own tile". The Throne blocks nothing, so its mist is
//   centred on its own tile (an inference). The skill lasts until the mist ends (`_waitForProjectileInvalid`, PRTS).
// - BlordReborn (global): the boss (`enemy_blord_mark`) holds trap_bldore_summon[blord1]. Killed, it starts the timer
//   on the Throne (`blordreborn.duration`, 40 s); then, if the Throne lives, SummonEnemiesFollowBranchRoute on
//   `blordreborn.branch_id`. When the Throne dies the buff ends and InstantKill takes the first form. When the boss
//   reaches the exit it finishes the Throne's `trap_bldore_block_game` (AddGameFinishBlockerByKey).
// - KillBmbcar (radius 1, `killbmbcar.` prefix): a bomb inside explodes (trap_bldore_kill[bmbcar]); at its end, if the
//   Throne still blocks the finish, PickRandomBranchPhase on `killbmbcar.branch_id` (the second form; it blocks the
//   finish) and the Throne dies (InstantKill); its Passive then finishes the current wave (FinishCurrentWave).
// - FountainHint / FountainAlarm / FountainDamage: enemy_blord_fountain[trigger] (the first form's death) ticks
//   FountainDamage every 5 s for 20 s: one operator still marked `enemy_blord_fountain[mark]` (FountainMark gives it
//   to every operator, a hit finishes it), 800 (`fountaindamage.value`) Arts damage without a source to the x-5 cross
//   around it and stun (`fountaindamage.stun`, 5 s).
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };
import { bombLoaderLordTriggerReviewed } from './stage-bomb-loader.js';

const f32 = Math.fround;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const type = a => a?.$type?.split('+')[1]?.split(',')[0];
const types = list => (list ?? []).map(type).join();
export const BLOOD_THRONE = 'trap_127_bldore';
export const BLOOD_LORD = 'enemy_1547_blord', BLOOD_LORD_TWO = 'enemy_1547_blord_2';
export const BLOOD_AMBER_KEY = 'enemy_1367_dseed', BLOODBORN_SPAWN = 'enemy_1360_dfello';
/** The selector class of the Throne's mist and of Crimson Edict's (both field-less). */
export const BLOOD_MIST_SELECTOR_SCRIPT = '257106927554094637';
/** x-5: the target's tile and the four next to it (projectile_enemy_blord_s[stun] `_rangeId`). */
export const BLOOD_SURGE_CROSS = Object.freeze([[1, 0], [0, -1], [0, 0], [0, 1], [-1, 0]].map(p => Object.freeze(p)));

/** Blood Mist (projectile_enemy_blord_s[fog] with enemy_blord_fog_buffs), from one caster's blackboard. */
export function bloodMistParams(bb) {
  const get = k => bb[k] ?? bb[k.toLowerCase()];
  return { lifetime: get('projectile_life_time'), radius: f32(get('projectile_range')), base: get('baseDamage'),
    add: get('addOnDamage'), ramp: get('addOnDuration'), aspd: get('attack_speed'), redeploy: get('respawn_time'),
    spawnDelay: get('delay'), spawnEnemy: get('enemy_key') };
}
const MIST = Object.freeze({ lifetime: 10, radius: f32(1.7), base: 50, add: 150, ramp: 10, aspd: -40, redeploy: 2, spawnDelay: 1,
  spawnEnemy: BLOODBORN_SPAWN });

/** The Blood Mist projectile and its templates, shared by every caster. */
export function bloodMistNativeReviewed(rows, T) {
  const life = rows.find(c => '_lifeTime' in c && '_actionController' in c), move = rows.find(c => '_immediatelyReach' in c);
  const hit = rows.find(c => '_tickInterval' in c), circle = rows.find(c => c.m_Radius !== undefined), scale = rows.find(c => '_scaleble' in c);
  const start = T?.enemy_blord_fog_buffs?.eventToActions?.ON_BUFF_START?.[0];
  const amber = start?._succeedNodes, op = start?._failNodes;
  const dmg = T?.enemy_blord_fog_damage?.eventToActions, spawn = T?.enemy_blord_fog_spawn?.eventToActions?.ON_BUFF_START;
  const respawn = T?.enemy_blord_fog_respawn?.eventToActions?.ON_OWNER_FINISH;
  const mod = op?.[0]?._buff?.attributes?.attributeModifiers;
  return life?._lifeTime === 10 && life._getLifeTimeFromBB === 1 && life._hitNumType === 2 && life._maxHitNum === 1
    && life._actionController?._detachAllBuffsWhenStopped === 1 && life._actionController._detachBuffsWhenTargetLeave === 0
    && move?._immediatelyReach === 1 && hit?._targetOptions?.targetSide === 3 && hit._targetOptions.targetCategory === 1
    && hit._targetOptions.targetMotion === 3 && circle?.m_Radius === 1 && scale?._scaleble === 1
    && type(start) === 'IfElse' && start._conditionNode?._sideMask === 'ENEMY'
    && types(amber) === 'CheckContainsBuff,CreateBuff' && same(amber[0]._buffKeys, ['enemy_bldore_mark'])
    && amber[1]._buff.templateKey === 'enemy_blord_fog_spawn'
    && types(op) === 'CreateBuff,CreateBuff' && op[0]._buff.templateKey === 'enemy_blord_fog_damage'
    && op[0]._buff.triggerInterval === 1 && op[0]._buff.waitFirstTriggerInterval === false && op[0]._buff.maxStackCnt === 1
    && mod?.length === 1 && mod[0].attributeType === 'ATTACK_SPEED' && mod[0].loadFromBlackboard === true
    && op[1]._buff.templateKey === 'enemy_blord2_listener'
    && types(dmg?.ON_BUFF_START) === 'BleedingDamageIncreasingReset,AlwaysNext,CheckContainsBuff,IfNot,CreateBuff'
    && dmg.ON_BUFF_START[4]._buff.templateKey === 'enemy_blord_fog_respawn'
    && types(dmg.ON_BUFF_TRIGGER) === 'BleedingDamagePerSec' && dmg.ON_BUFF_TRIGGER[0]._damageType === 'MAGICAL'
    && dmg.ON_BUFF_TRIGGER[0]._isIncreasingToCap === true && dmg.ON_BUFF_TRIGGER[0]._baseDamageKey === 'baseDamage'
    && dmg.ON_BUFF_TRIGGER[0]._damageKey === 'addOnDamage' && dmg.ON_BUFF_TRIGGER[0]._durationToIncreaseKey === 'addOnDuration'
    && types(respawn) === 'CreateCardBuff' && respawn[0]._lifeType === 'UNTIL_NEXT_SPAWN' && respawn[0]._isRatio === true
    && types(spawn) === 'SummonEnemiesFollowMyRoute,InstantKill' && spawn[0]._enemyKey === null && spawn[0]._delayTime === 1
    && spawn[0]._useMapPosition === true && spawn[0]._useRandomDelay === false && spawn[0]._managedByScheduler === true
    && spawn[0]._summonCount === 1;
}

/** Blood Surge (FountainDamage's projectile and damage), shared by the Throne and the second form. The x-5 cells are
 * checked where the range is retained (the enemy evidence); the device evidence keeps only the range id. The hit-mark
 * template is retained with the Throne's evidence only (the projectile references it), so the enemy review skips it. */
export function bloodSurgeNativeReviewed(rows, T, range, { hitMark = true } = {}) {
  const life = rows.find(c => '_actionController' in c), hit = rows.find(c => '_rangeToLoad' in c);
  const end = life?._actionController?._extraBuffsInTheEnd?.[0];
  const dmg = T?.['enemy_blord_fountain[damage]']?.eventToActions?.ON_BUFF_START;
  const mark = T?.['enemy_blord_fountain[hit_mark]']?.eventToActions?.ON_BUFF_START;
  return end?.templateKey === 'enemy_blord_fountain[hit_mark]' && hit?._targetOptions?.targetSide === 2 && hit._goThroughWall === 1
    && rows.some(c => c._rangeId === 'x-5') && (range === undefined || same(range?.grids?.map(p => [p.row, p.col]), BLOOD_SURGE_CROSS))
    && types(dmg) === 'FixedValueDamage' && dmg[0]._damageType === 'MAGICAL' && dmg[0]._noSourceDamage === true
    && (!hitMark || types(mark) === 'FinishBuffsById' && mark[0]._targetType === 'TARGET');
}

export function bloodThroneNativeReviewed(e = native, t = tables) {
  const P = k => e.prefabs?.[k]?.components ?? [], rows = k => P(k).map(c => c.data), T = e.templates ?? {};
  const root = rows(BLOOD_THRONE).find(c => '_modes' in c), byId = id => P('sktok_bldore').find(c => c.pathId === String(id?.m_PathID ?? id))?.data;
  const passive = P(BLOOD_THRONE).find(c => c.object === 'Passive' && c.data._buffs)?.data._buffs ?? [];
  const amber = P(BLOOD_THRONE).find(c => c.object === '1' && c.data._buffs)?.data._buffs;
  const hpCtrl = P(BLOOD_THRONE).find(c => c.object === 'DseedHpCtrl' && c.data._buffs)?.data;
  const ext = name => P('sktok_bldore').find(c => c.object === name && (c.data._buffs || c.data._activeBuffs || c.data._wrappedAbilities || c.data._uniqueBuff))?.data;
  const main = rows('sktok_bldore').find(c => c._projectileKey === 'projectile_enemy_blord_s[fog]');
  const kill = P('sktok_bldore').find(c => c.object === 'KillBmbcar' && c.data.m_Radius !== undefined)?.data;
  const reborn = ext('BlordReborn'), killer = ext('KillBmbcar'), surge = ext('FountainDamage'), hint = ext('FountainHint');
  const surgeSelect = byId(surge?._selector), markAura = P('sktok_bldore').find(c => c.object === 'FountainMark' && c.data._buffs)?.data;
  const summon = T['trap_bldore_summon[blord1]']?.eventToActions, timer = T['trap_bldore_summon[blord1][timer]']?.eventToActions?.ON_BUFF_FINISH;
  const boom = T['trap_bldore_kill[bmbcar]']?.eventToActions, block = T.trap_bldore_block_game?.eventToActions;
  const wave = T.trap_bldore_finish_current_wave?.eventToActions?.ON_OWNER_KILLED;
  const run = T['trap_bonore_upgraded[summon]']?.eventToActions?.ON_BUFF_TRIGGER;
  const record = t.devices?.[BLOOD_THRONE], frames = record?.phases?.[0]?.attributesKeyFrames ?? [];
  const skill = t.skills?.sktok_bldore?.levels, bb = Object.fromEntries((skill?.[0]?.blackboard ?? []).map(x => [x.key, x.valueStr ?? x.value]));
  const talent = record?.talents?.[0]?.candidates;
  return root?._sideType === 2 && root._category === 2 && root._modes?.length === 1
    && passive.map(x => x.buffKey).join() === 'trap_bonore_passive,trap_bonore_upgraded,trap_bldore_block_game,trap_bldore_fountain_mark'
    && passive[0].templateKey === 'trap_bldore_finish_current_wave' && same(passive[0].attributes?.abnormalFlags, [7])
    && passive[2].templateKey === 'trap_bldore_block_game' && passive.every(x => x.lifeTimeType === 2)
    && amber?.length === 1 && amber[0].templateKey === 'trap_bonore_upgraded[summon]' && amber[0].triggerLifeType === 2
    && talent?.length === 1 && talent[0].prefabKey === '1' && same(talent[0].blackboard, [{ key: 'interval', value: 10, valueStr: null }])
    && types(run) === 'CheckContainsBuff,SummonEnemiesFollowBranchRoute' && run[1]._managedByScheduler === true
    && hpCtrl?._buffs?.[0]?.buffKey === 'trap_bonore_dseed_hp_ctrl'
    && same(P(BLOOD_THRONE).find(c => c.pathId === String(hpCtrl._targetValidator?.m_PathID))?.data?._buffs, ['enemy_bldore_mark'])
    && main?._activeBuffs?.[0]?.templateKey === 'enemy_blord_fog_buffs' && main._waitForProjectileInvalid === 1
    && byId(main._selector)?.m_Script?.m_PathID === BLOOD_MIST_SELECTOR_SCRIPT
    && Object.keys(byId(main._selector)).every(k => k.startsWith('m_'))
    && bloodMistNativeReviewed(rows('projectile_enemy_blord_s[fog]'), T)
    && kill?.m_Radius === 1 && killer?._buffs?.[0]?.templateKey === 'trap_bldore_kill[bmbcar]' && killer._metadata?.blackboardPrefix === 'killbmbcar.'
    && reborn?._buffs?.[0]?.templateKey === 'trap_bldore_summon[blord1]' && reborn._metadata?.blackboardPrefix === 'blordreborn.'
    && same(P('sktok_bldore').find(c => c.pathId === String(reborn._targetValidator?.m_PathID))?.data?._buffs, ['enemy_blord_mark'])
    && types(summon?.ON_OWNER_KILLED) === 'CheckUnitAlive,CreateBuff' && summon.ON_OWNER_KILLED[1]._buffOwner === 'BUFF_SOURCE'
    && types(summon.ON_BUFF_FINISH) === 'InstantKill' && types(summon.ON_OWNER_REACH_EXIT) === 'FinishBuffsById'
    && summon.ON_OWNER_REACH_EXIT[0]._buffKey === 'trap_bldore_block_game'
    && types(timer) === 'CheckUnitAlive,SummonEnemiesFollowBranchRoute' && timer[1]._managedByScheduler === true && timer[1]._overrideEnemyKey === ''
    && types(boom?.ON_BUFF_START) === 'TriggerEnemySkill' && boom.ON_BUFF_START[0]._skillName === 'Explosion'
    && types(boom.ON_BUFF_FINISH) === 'CheckUnitAlive,CheckUnitAlive,IfElse,InstantKill'
    && same(boom.ON_BUFF_FINISH[2]._conditionNode?._buffKeys, ['trap_bldore_block_game'])
    && types(boom.ON_BUFF_FINISH[2]._succeedNodes) === 'PickRandomBranchPhase' && boom.ON_BUFF_FINISH[2]._succeedNodes[0]._blockGameFinish === true
    && boom.ON_BUFF_FINISH[3]._targetType === 'BUFF_SOURCE'
    && types(block?.ON_BUFF_START) === 'AddGameFinishBlockerByKey' && types(block.ON_BUFF_FINISH) === 'RemoveGameFinishBlockerByKey'
    && types(wave) === 'FinishCurrentWave' && wave[0]._trackSourceAtNextWave === false && wave[0]._finishAndSkip === false
    && hint?._isInfinity === 1 && markAura?._buffs?.[0]?.buffKey === 'enemy_blord_fountain[mark]'
    && surge?._projectileKey === 'projectile_enemy_blord_s[stun]' && surge._metadata?.blackboardPrefix === 'fountaindamage.'
    && surge._activeBuffs?.map(x => x.buffKey).join() === 'enemy_blord_fountain[damage],stun'
    && surgeSelect?._buffKey === 'enemy_blord_fountain[mark]' && surgeSelect._secondaryFilter === 3 && surgeSelect._targetSide === 2
    && bloodSurgeNativeReviewed(rows('projectile_enemy_blord_s[stun]'), T)
    && record?.profession === 'TRAP' && frames.length === 2 && ['maxHp', 'def', 'magicResistance'].every(k => frames[0].data[k] === frames[1].data[k])
    && frames[0].data.maxHp === 10000 && frames[0].data.def === 2000 && frames[0].data.magicResistance === 20
    && skill?.length === 1 && skill[0].skillType === 'AUTO' && skill[0].spData.spType === 'INCREASE_WITH_TIME'
    && skill[0].spData.spCost === 20 && skill[0].spData.initSp === 15 && skill[0].spData.increment === 1
    && bb['talent@enemy_key'] === BLOOD_AMBER_KEY && bb['talent@branch_id'] === 'bldore_dfello'
    && same(bloodMistParams(bb), MIST)
    && bb['blordreborn.branch_id'] === 'blord1' && bb['blordreborn.duration'] === 40 && bb['killbmbcar.branch_id'] === 'blord2'
    && bb['fountaindamage.value'] === 800 && bb['fountaindamage.stun'] === 5
    && bombLoaderLordTriggerReviewed(e);
}

/** One instance: its own Amber branch (instance `branch_id`). Level, skill level and facing change nothing. */
export function bloodThroneDefinition(instance) {
  if (!bloodThroneNativeReviewed() || !instance || !Number.isSafeInteger(instance.level) || instance.level < 1 || instance.level > 30
    || instance.skillLevel !== 1 || !['UP', 'RIGHT', 'DOWN', 'LEFT'].includes(instance.direction)
    || typeof instance.branchId !== 'string' || !instance.branchId)
    throw Error('Unsupported original Throne of Blood instance');
  const d = tables.devices[BLOOD_THRONE].phases[0].attributesKeyFrames[0].data;
  return { kind: 'bloodThrone', hp: d.maxHp, def: d.def, res: d.magicResistance, direction: instance.direction,
    branchId: instance.branchId, amberInterval: 10, amberEnemy: BLOOD_AMBER_KEY,
    mist: { ...MIST, spCost: 20, initSp: 15, spPerSecond: 1 },
    rebornBranchId: 'blord1', rebornDelay: 40, formTwoBranchId: 'blord2', bombRadius: 1,
    surge: { damage: 800, stun: 5, interval: 5, duration: 20 },
    description: 'Every 10 s summons Blood Amber; releases Blood Mist on itself; revives Duq\'arael 40 s after each defeat. A bomb that reaches it destroys it and calls his second form.' };
}
