// SPDX-License-Identifier: GPL-3.0-or-later
// Kindling Revenant (PRTS 引火的死魂灵; 14-18). Two records: the first form `enemy_1553_lrdead_2` (the wave's enemy: a
// controller that dwells in the Core Amplifiers) and the second form `enemy_1553_lrdead` (summoned by the first).
// Reviewed from both pinned prefabs and the templates below; the devices and the beam system are reviewed in
// stage-kindling-revenant.js. Both record levels are reviewed (their numbers differ); level 1 is H14-3's, and that
// stage stays refused by the beam rule and the core levels (stage-kindling-revenant.js).
// First form (INVINCIBLE, ALLY_TARGET_FREE, UNBALANCE_IMMUNE, UNMOVABLE, BLOCK_FREE, HEAL_FREE; no attack):
// - CtrlGuns `enemy_lrking[init]`: every core gets `enemy_lrking[initCore]` (checked every 0.5 s) and counts one
//   stack; every gun gets `trap_lrlgun[syncAtk]` (this form's ATK added to its own); `enemy_lrking[ctrl]` runs every 1 s;
//   Soul Echo (LaserDefault) is forced `first_interval` s in.
// - Soul Echo (LaserDefault, LaserS1, LaserS2, LaserS3: `expose_core.unlock` 1 to 4): every gun's `laser` fires and the
//   core with that `unlock` loses `trap_lrcore[invincible_ctrl]`. LaserS3 also gives every gun +`atk` (100) ATK for good.
// - initCore: an exposed core at 1 HP or less is broken: one stack less, INVINCIBLE again, and its branch moves to its
//   next phase (MoveNextLevelBranch).
// - ctrl: when the stack count changed, the guns stop (`enemy_lrking[switchmode]`: mode = cores broken) and the next
//   Soul Echo is forced `second_interval` / `third_interval` / `forth_interval` s later. With no stack left
//   (`enemy_lrking[suicide][p1]`): the guns shut down, the cores stop absorbing, and `reborn_interval` s later the
//   current wave is released and the second form is summoned on this form's tile (unharmful, waiting).
// - Passive `enemy_lrking[suicide_p1]`: `lrdead_suicide_p1` s in, unless the second form was called, 99 life points
//   are lost and it dies.
// Second form (a 3.95 x 4.95 body 0.5 left of and 2 above its tile; UNMOVABLE, BLOCK_FREE; no attack; `_delayToBorn` 3):
// - Laser (once; cast 3.84 s, the trigger 1.84 s in): `enemy_lrdead[triggerSkill]`, Mainline14TriggerSkill on the beam
//   system as the boss, and every core switches to its second mode. Then it switches to its own second mode.
// - LaserS1 (first 12 s after that switch, then every 15 s; the trigger 2.84 s in): the same trigger.
// - LaserHalfHp (once, at HP ratio `max_hp_ratio` 0.4 or less; the trigger 1.84 s in, or 2.84 s in its second mode):
//   the same trigger.
// - Suicide (priority 2; first at 200 s): Arts damage of ATK x1 to the operators, 99 life points lost, and it dies.
// - Its death informs the beam system (Mainline14InformLrdeadDeath); `trap_lrdead[kill_p1]` on the first form checks
//   every 1 s and kills it once the second form is dead.
import { REVENANT_FIRST, REVENANT_SECOND, REVENANT_SYSTEM } from './stage-kindling-revenant-beams.js';

const f32 = Math.fround;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const type = a => a?.$type?.split('+')[1]?.split(',')[0];
const types = list => (list ?? []).map(type).join();
const keys = list => (list ?? []).map(b => b.buffKey).join();
const ordered = o => JSON.stringify(Object.entries(o).sort(([a], [b]) => a < b ? -1 : 1));
export const isRevenantFirst = r => r?.prefabKey === REVENANT_FIRST && r.key === REVENANT_FIRST;
export const isRevenantSecond = r => r?.prefabKey === REVENANT_SECOND && r.key === REVENANT_SECOND;
export const isRevenant = r => isRevenantFirst(r) || isRevenantSecond(r);
const TEXT = Object.freeze(['Drains all Life Points after a long time has passed in the battle', 'First Form',
  '[Soul Echo] Controls <Torrent Beam Activators> to deal continuous damage in a large area to the left. Disabled when a <Core Amplifier> is destroyed.',
  'Allows <Core Amplifiers> to capture Soul Maelstroms. Capturing a Soul Maelstrom increases the damage of the next [Soul Echo].',
  'Dwells in <Core Amplifiers> and cannot be attacked. Changes to second form when all <Core Amplifiers> are destroyed.',
  'Second Form', '[Raging Souls] Deals continuous damage in a large area to its right. Damage increases with the number of casts.',
  'Casts [Raging Souls] whenever a certain amount of HP is lost.']);
// Level 1 has no `reborn_interval`: its two timed buffs then last 0 s (read as: at once) [inference].
const FIRST_TALENTS = Object.freeze([
  { 'Passive.enemy_lrking[suicide_p1].lrdead_suicide_p1': 500, 'Passive.enemy_lrking[suicide_p1].value': -99,
    'CtrlGuns.first_interval': 0, 'CtrlGuns.second_interval': 90, 'CtrlGuns.third_interval': 80, 'CtrlGuns.forth_interval': 60, 'CtrlGuns.reborn_interval': 5 },
  { 'Passive.enemy_lrking[suicide_p1].lrdead_suicide_p1': 400, 'Passive.enemy_lrking[suicide_p1].value': -99,
    'CtrlGuns.first_interval': 80, 'CtrlGuns.second_interval': 60, 'CtrlGuns.third_interval': 60, 'CtrlGuns.forth_interval': 40 }]);
const SECOND_SKILLS = Object.freeze([
  [['Laser', 20, 0], ['LaserS1', 15, 12], ['Suicide', 400, 200, { value: -99 }], ['LaserHalfHp', 0, 0, { max_hp_ratio: .4 }]],
  [['Laser', 15, 0], ['LaserS1', 12, 8], ['Suicide', 400, 350, { value: -99 }], ['LaserHalfHp', 0, 0, { max_hp_ratio: .25 }]]]);
const SECOND_DELAY = Object.freeze([0, 40]);
const skill = (s, key, cooldown, initCooldown, bb = {}) => s?.prefabKey === key && s.cooldown === cooldown && s.initCooldown === initCooldown
  && s.spCost === 0 && s.priority === (key === 'Suicide' ? 2 : 0) && same(s.bb, bb) && same(s.bbStr, {});

export function revenantFirstNative(r, n) {
  if (!isRevenantFirst(r) || r.rank !== 'BOSS' || !FIRST_TALENTS[r.level] || ordered(r.talents.bb) !== ordered(FIRST_TALENTS[r.level])
    || r.skills.length !== 4 || !['LaserDefault', 'LaserS1', 'LaserS2'].every((k, i) => skill(r.skills[i], k, 9999, 9999))
    || !skill(r.skills[3], 'LaserS3', 9999, 9999, { atk: 100 })) return false;
  const T = k => n?.$template?.(k)?.eventToActions;
  const echo = name => (n?.[name] ?? []).find(c => c._buffs)?._buffs, wrap = name => (n?.[name] ?? []).find(c => '_trigger' in c);
  const passive = (n?.Passive ?? []).find(c => c._buffs)?._buffs, ctrlGuns = (n?.CtrlGuns ?? []).find(c => c._buffs)?._buffs;
  const init = T('enemy_lrking[init]')?.ON_BUFF_START, core = T('enemy_lrking[initCore]'), ctrl = T('enemy_lrking[ctrl]')?.ON_BUFF_TRIGGER?.[0];
  const changed = ctrl?._succeedNodes?.[1]?._failNodes, end = T('enemy_lrking[suicide][p1]')?.ON_BUFF_START;
  const late = T('enemy_lrking[suicide_p1]')?.ON_BUFF_FINISH, summon = T('enemy_lrking[summonP2]')?.ON_BUFF_FINISH;
  const expose = T('enemy_lrking[finish_invin]')?.ON_BUFF_START, fire = T('enemy_lrking[triggerLaser]')?.ON_BUFF_START;
  const gun = T('enemy_lrking[initGun]')?.ON_BUFF_START, boost = T('enemy_lrking[atk_boost]')?.ON_BUFF_START;
  const unlock = name => echo(name)?.find(b => b.buffKey === 'enemy_lrking[expose_core]')?.blackboard?.find(x => x.key === 'unlock')?.value;
  return keys(passive) === 'enemy_lrking_p1_immune,enemy_lrking[mark][p1],enemy_lrking[suicide_p1],enemy_lrdead[inform_death][p1]'
    && same(passive[0].attributes?.abnormalFlags, [15, 8, 22, 3, 7, 5]) && same(passive[0].attributes?.abnormalImmunes, [0, 16, 25, 11])
    && passive[2].lifeTimeType === 1 && passive[2].durationKey === 'lrdead_suicide_p1'
    && keys(ctrlGuns) === 'enemy_lrking[init],enemy_lrking[blackboard][p1]'
    && ['LaserDefault', 'LaserS1', 'LaserS2'].every(k => keys(echo(k)) === 'enemy_lrking[triggerLaser],enemy_lrking[expose_core]')
    && keys(echo('LaserS3')) === 'enemy_lrking[triggerLaser],enemy_lrking[atk_boost],enemy_lrking[expose_core]'
    && same(['LaserDefault', 'LaserS1', 'LaserS2', 'LaserS3'].map(unlock), [1, 2, 3, 4])
    && ['LaserDefault', 'LaserS1', 'LaserS2', 'LaserS3'].every(k => wrap(k)?._maxTriggerTime === 1 && wrap(k)._ignoreSilence === 1)
    && types(init) === 'CreateBuffUseAbilitySelector,CreateBuffUseAbilitySelector,CreateBuff,CreateBuff'
    && init[0]._abilityName === 'SelectCore' && init[0]._buff.templateKey === 'enemy_lrking[initCore]' && init[0]._buff.triggerInterval === .5
    && init[1]._abilityName === 'SelectGun' && init[1]._buff.templateKey === 'enemy_lrking[initGun]'
    && init[2]._buff.templateKey === 'enemy_lrking[ctrl]' && init[2]._buff.triggerInterval === 1
    && init[3]._buff.templateKey === 'enemy_lrking[trigger_skill][default]' && init[3]._buff.durationKey === 'first_interval'
    && types(gun) === 'AssignAttributeToBB,CreateBuff,SpShowBuff' && gun[0]._attributeType === 'ATK' && gun[0]._targetType === 'BUFF_SOURCE'
    && gun[1]._buff.buffKey === 'trap_lrlgun[syncAtk]' && gun[1]._buff.attributes.attributeModifiers[0].attributeType === 'ATK'
    && types(core?.ON_BUFF_TRIGGER) === 'FilterByTargetHp,FinishBuffsById,CreateBuff,FinishBuffsById,MoveNextLevelBranch,AlwaysNext,FinishBuff'
    && core.ON_BUFF_TRIGGER[0]._condType === 'LE' && core.ON_BUFF_TRIGGER[1]._buffKey === 'enemy_lrking[coreCount][stack]'
    && same(core.ON_BUFF_TRIGGER[2]._buff.attributes?.abnormalFlags, ['INVINCIBLE']) && core.ON_BUFF_TRIGGER[4]._maxValidEnemyCount === -1
    && type(ctrl) === 'IfElse' && same(ctrl._conditionNode?._buffKeys, ['enemy_lrking[coreCount][stack]'])
    && types(changed) === 'CalculateBlackboardValueViaParams,CreateBuffUseAbilitySelector,AssignBuffBlackboard,SwitchMode,CreateBuffUseAbilitySelector,IfElse'
    && changed[1]._buff.templateKey === 'enemy_lrking[switchmode]' && changed[5]._succeedNodes[0]._buff.durationKey === 'second_interval'
    && changed[5]._failNodes[0]._succeedNodes[0]._buff.durationKey === 'third_interval'
    && changed[5]._failNodes[0]._failNodes[0]._succeedNodes[0]._buff.durationKey === 'forth_interval'
    && types(ctrl._failNodes) === 'CreateBuff,FinishBuff' && ctrl._failNodes[0]._buff.templateKey === 'enemy_lrking[suicide][p1]'
    && types(end) === 'CreateBuffUseAbilitySelector,CreateBuff,CreateBuff,CreateBuff,CreateBuffUseAbilitySelector'
    && end[0]._buff.templateKey === 'enemy_lrking[shutdown]' && end[1]._buff.templateKey === 'finish_current_wave_when_buff_finish'
    && end[1]._buff.durationKey === 'reborn_interval' && end[2]._buff.templateKey === 'enemy_lrking[summonP2]' && end[2]._buff.durationKey === 'reborn_interval'
    && end[3]._buff.buffKey === 'enemy_lrking[donot_boom]' && end[4]._buff.buffKey === 'enemy_lrking[disableAbsorb]'
    && types(summon) === 'SummonEnemyWithRuntimeRoute' && summon[0]._enemyKey === REVENANT_SECOND && summon[0]._unharmful === true && summon[0]._host === 'BUFF_OWNER'
    && types(late) === 'CheckContainsBuff,IfNot,ModifyLifePoint,CreateEffect,CreateBuff,CreateBuff,CreateBuff,InstantKill'
    && same(late[0]._buffKeys, ['enemy_lrking[donot_boom]']) && late[2]._blackboardKey === 'value'
    && types(expose) === 'AssignBuffBlackboardFromOthers,FilterByBlackboardValue,FinishBuffsById,CreateBuff'
    && expose[1]._condType === 'EQUALS' && expose[2]._buffKey === 'trap_lrcore[invincible_ctrl]'
    && types(fire) === 'CreateBuffUseAbilitySelector,CreateBuffUseAbilitySelector,CreateBuffUseAbilitySelector'
    && fire[0]._buff.templateKey === 'enemy_lrking[triggerGun]' && types(T('enemy_lrking[triggerGun]')?.ON_BUFF_START) === 'TriggerAbility'
    && types(boost) === 'CreateBuffUseAbilitySelector' && boost[0]._abilityName === 'SelectGun' && boost[0]._buff.lifeTimeType === 'INFINITY'
    && boost[0]._buff.attributes.attributeModifiers[0].attributeType === 'ATK';
}

export function revenantSecondNative(r, n) {
  if (!isRevenantSecond(r) || r.rank !== 'BOSS' || !SECOND_SKILLS[r.level] || !same(r.talents.bb, { delay_to_appear: SECOND_DELAY[r.level] })
    || r.skills.length !== 4 || !SECOND_SKILLS[r.level].every((x, i) => skill(r.skills[i], ...x))
    || !same(r.abilities.map(a => a.text), TEXT)) return false;
  const T = k => n?.$template?.(k)?.eventToActions;
  const cast = name => (n?.[name] ?? []).filter(c => '_preDelay' in c && '_cooldown' in c);
  const wraps = name => (n?.[name] ?? []).filter(c => '_trigger' in c && '_maxTriggerTime' in c);
  // The event-bound buff components are referenced rows on each cast's own object.
  const steps = name => cast(name).flatMap(c => n.$siblings(c)).filter(c => c._buffs && '_runActionOnEvent' in c);
  const laser = cast('Laser'), surge = cast('LaserS1'), low = cast('LaserHalfHp'), boom = cast('Suicide');
  const immune = (n?.Immunes ?? []).find(c => c._buffs)?._buffs, root = (n?.[REVENANT_SECOND] ?? []).find(c => '_modes' in c);
  const box = n?.$siblings?.(root)?.find(c => c.m_Size !== undefined);
  const trigger = T('enemy_lrdead[triggerSkill]')?.ON_BUFF_START, dead = T('enemy_lrdead[inform_death]')?.ON_OWNER_FINISH;
  const kill = T('trap_lrdead[kill_p1]')?.ON_BUFF_TRIGGER, end = T('enemy_lrdead[suicide_p2]')?.ON_BUFF_START;
  const timed = (c, pre, total) => c?._preDelay === f32(pre) && c._cooldown === f32(total) && c._timeMode === 2;
  const fires = name => steps(name).some(c => c._runActionOnEvent === 4 && c._buffs[0].buffKey === 'enemy_lrdead[triggerSkill]');
  // Both modes hold their own copies of LaserHalfHp and Suicide; the second mode's low-HP cast has LaserS1's timing.
  return laser.length === 1 && timed(laser[0], 1.84, 3.84) && surge.length === 1 && timed(surge[0], 2.84, 4.84)
    && low.length === 2 && low.some(c => timed(c, 1.84, 3.84)) && low.some(c => timed(c, 2.84, 4.84)) && boom.length === 2 && boom.every(c => c._cooldown === 1 && c._atkScale === 1 && c._damageType === 2)
    && fires('Laser') && fires('LaserS1') && fires('LaserHalfHp')
    && steps('Laser').some(c => c._runActionOnEvent === 3 && c._buffs[0].buffKey === 'enemy_lrdead[switch_mode_after_skill]')
    && wraps('LaserHalfHp').length === 2 && wraps('LaserHalfHp').every(c => c._maxTriggerTime === 1)
    && wraps('Laser').every(c => c._maxTriggerTime === -1) && wraps('LaserS1').every(c => c._maxTriggerTime === -1)
    && steps('Suicide').every(c => c._runActionOnEvent === 3 && c._buffs[0].buffKey === 'enemy_lrdead[suicide_p2]')
    && keys(immune) === 'enemy_lrdead_immune,enemy_lrdead[kill_p1],enemy_lrdead[p2_mark],enemy_lrdead[ctrlTraps],enemy_lrdead[inform_death]'
    && same(immune[0].attributes?.abnormalFlags, [22, 3]) && same(immune[0].attributes?.abnormalImmunes, [0, 16, 18])
    && root?._modes?.length === 2 && root._delayToBorn === 3
    && same([box?.m_Offset?.x, box?.m_Offset?.y, box?.m_Size?.x, box?.m_Size?.y], [-.5, 2, f32(3.95), f32(4.95)])
    && types(trigger) === 'Mainline14TriggerSkill,CheckContainsBuff,CreateBuffUseAbilitySelector,FinishBuffsById'
    && trigger[0]._evnSysKey === REVENANT_SYSTEM && trigger[0]._isTriggeredByBoss === true && same(trigger[1]._buffKeys, ['enemy_lrdead[ctrlTraps]'])
    && trigger[2]._abilityName === 'SelectCore' && trigger[2]._buff.templateKey === 'enemy_lrdead[switchmode]'
    && types(T('enemy_lrdead[switchmode]')?.ON_BUFF_START) === 'SwitchMode' && T('enemy_lrdead[switchmode]').ON_BUFF_START[0]._modeIndex === 1
    && type(dead?.at(-1)) === 'Mainline14InformLrdeadDeath' && dead.at(-1)._evnSysKey === REVENANT_SYSTEM
    && types(kill) === 'CheckUnitAlive,IfNot,InstantKill' && kill[0]._ownerType === 'BUFF_SOURCE'
    && type(end?.[0]) === 'ModifyLifePoint' && end[0]._blackboardKey === 'value' && type(end.at(-1)) === 'InstantKill';
}

export function revenantFirstParams(r) {
  const bb = r.talents.bb;
  return { second: REVENANT_SECOND, intervals: [bb['CtrlGuns.first_interval'], bb['CtrlGuns.second_interval'], bb['CtrlGuns.third_interval'], bb['CtrlGuns.forth_interval']],
    reborn: bb['CtrlGuns.reborn_interval'] ?? 0, deadline: bb['Passive.enemy_lrking[suicide_p1].lrdead_suicide_p1'],
    lifeLoss: -bb['Passive.enemy_lrking[suicide_p1].value'], lastEchoAtk: r.skills[3].bb.atk, coreCheck: .5, ctrlCheck: 1 };
}
export function revenantSecondParams(r) {
  const [laser, surge, boom, low] = r.skills;
  return { box: { w: 3.95, h: 4.95, dx: -.5, dy: 2 }, born: 3 + r.talents.bb.delay_to_appear,
    ignite: { initial: laser.initCooldown, windUp: 1.84, cast: 3.84 },
    surge: { initial: surge.initCooldown, cooldown: surge.cooldown, windUp: 2.84, cast: 4.84 },
    lowHp: { ratio: low.bb.max_hp_ratio, windUp: [1.84, 2.84], cast: [3.84, 4.84] },
    suicide: { initial: boom.initCooldown, scale: 1, lifeLoss: -boom.bb.value }, firstCheck: 1 };
}

const lines = new Set(TEXT);
const first = (note, extra = {}) => ({ matchesRecord: isRevenantFirst, covers: revenantFirstNative, ability: null, note, ...extra });
const second = (note, extra = {}) => ({ matchesRecord: isRevenantSecond, covers: revenantSecondNative, ability: null, note, ...extra });
export const REVENANT_FEATURES = Object.freeze({
  'talent:CtrlGuns': first('Kindling Revenant, first form: Soul Echo through the guns and cores, then the second form', {
    nativeClaim: () => ({ wrappers: 4, active: 2 }), ability: r => ({ kind: 'revenantFirst', params: () => revenantFirstParams(r) }),
    dependsOn: () => [REVENANT_SECOND] }),
  'skill:LaserDefault': first('Soul Echo, first core (kind revenantFirst)'),
  'skill:LaserS2': first('Soul Echo, third core (kind revenantFirst)'),
  'skill:LaserS3': first('Soul Echo, fourth core (kind revenantFirst)'),
  'talent:delay_to_appear': second('Kindling Revenant, second form: Raging Souls on the beam system, and its deadline', {
    nativeClaim: () => ({ wrappers: 6, active: 4 }), explains: text => lines.has(text),
    ability: r => ({ kind: 'revenantSecond', params: () => revenantSecondParams(r) }) }),
  'skill:Suicide': second('the second form\'s deadline (kind revenantSecond)'),
  'skill:LaserHalfHp': second('Raging Souls at low HP (kind revenantSecond)'),
});
/** Keys other families also use: a Revenant record takes these entries (enemy-features.js `withFamily`). */
export const REVENANT_SHARED_FEATURES = Object.freeze({
  'talent:Passive': first('the first form\'s immunities and deadline (kind revenantFirst)'),
  'skill:Laser': second('Raging Souls, first cast (kind revenantSecond)'),
  'skill:LaserS1': { matchesRecord: isRevenant, covers: (r, n) => isRevenantFirst(r) ? revenantFirstNative(r, n) : revenantSecondNative(r, n),
    ability: null, note: 'Soul Echo, second core / Raging Souls (kinds revenantFirst, revenantSecond)' },
});
