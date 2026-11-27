// SPDX-License-Identifier: GPL-3.0-or-later
// PRTS, Source Code (`enemy_1564_mpprts`, PRTS "PRTS，“源代码”") and the Mimic Machine (`enemy_1565_mpprme`, PRTS
// 拟态机械): the boss pair of 15-20 and H15-4. Reviewed from both pinned prefabs, the buff templates and the Mimic's
// projectiles below; clip clocks come from data/arkpedia-prts-source-animations.json. Runtime:
// server/sim/content/arkpedia-enemy-prts-source.js. Both record levels are reviewed (their numbers differ).
//
// PRTS, Source Code (a 2.95 x 4.95 body 2 above its tile; no attack; its route is one long wait):
// - Mode Default: `enemy_mpprts_inv` (INVINCIBLE). The common ability gives every Mimic Machine
//   `enemy_mpprts_canreborn`, the buff its Reborn needs.
// - `enemy_mpprts_dying_start` (set by the Mimic's downed state): Dizzy (clip Dizzy_Begin) and then mode Dizzy.
// - Mode Dizzy: no invincibility; `enemy_mpprts_dying` gives 1 SP every 1 s. A hit taken also gives SP [PRTS:
//   受击回复; "its recovery time is reduced by 1s each time PRTS, Source Code takes damage"].
// - DizzyEnd (`spCost` 50; clip Dizzy_End): `enemy_mpprts_inv2` (INVINCIBLE), `enemy_mpprts_dying` ends, which ends
//   `dying_start`, which ends the Mimic's `enemy_mpprme_inreborn`. Then mode Default.
// - Defeated while `dying_start` is on: the Mimic is killed without a revive (InstantKill `_skipReborn`).
// - TimeUp: `enemy_mpprts_time_up` after `TimeUp.interval` s, then `[real]` 0.5 s later: FinishGame LOSE.
//
// Mimic Machine (modes Default, FlyMode_P1, Normal_P2, FlyMode_P2, FlyMode_Ray_P2, Reborn):
// - Reborn (`_validWhenContainsBuff` `enemy_mpprts_canreborn`, `_modeIndex` 5): a lethal hit plays Die and enters mode
//   Reborn (INVINCIBLE, FORCE_DISARMED, UNMOVABLE_PRIVATE). `enemy_mpprme_inreborn`: `enemy_mpprme_reborned` (ATK
//   +`Reborn.atk`, up to `Reborn.max_stack_cnt`), `dying_start` on PRTS, Source Code, and the DP timer x0.33. When it
//   ends: RebornAnim (clip Revive_End), then mode Normal_P2. `_hpRechargeRatio` 0.5 is read as full HP, as for the
//   reviewed bosses (PRTS: 100%). `enemy_mpprme_mark_p1` (finish_current_wave_when_buff_finish) is not retained
//   through a revive, so the first downing releases the wave.
// - CardBoom (5 s in; clip Skill_1): `projectile_enemy_mpprme_ice` flies to the deck in at most 0.8 s and bursts 1 s
//   later: four CreateCardBuffToMaxCost for `duration` s. `_ice_2` (after a revive) also locks the top bar
//   (`enemy_mpprme_hold_ice`: interface only).
// - FireBall (clip Skill_2): `projectile_enemy_mpprme_ball`, speed 2, life 10 s, a 1.0 collider that marks it reached
//   when a target enters, a 0.75 s wait, then a splash of ATK x `damage_scale` within `range_radius`. Every
//   `scale_interval` s the collider scale, radius and damage scale step down to their floors.
// - StartFlyP1 / StartFlyP2 / StartFlyRay (`_preDelay` 1.1): `enemy_mpprme_s_fly[call]` puts MOVE_AND_DRAG_SOURCE
//   (priority 200) in the hand's queue. When the hand arrives, `[arrive]` and 0.27 s later the fly mode.
// - `enemy_mpprme_fly` (`duration` s): records HP ratio + `hp_ratio_offset`; motion FLY; released from its blocker.
//   It ends on its time, on a hit taken at or under that ratio, or on a lethal hit (the fly modes are UNDEADABLE).
//   Then: 0.9 s of BLOCK_FREE and FORCE_DISARMED, the landing skill, motion WALK, and Main15TryNextPrtsAction (the
//   hand moves on). The fly modes carry no UNMOVABLE flag: it keeps its route while it hovers.
// - FlyMode_Ray_P2: Ray fires `projectile_enemy_mpprme_ray` (width 0.5, extended 15 past its target) at up to 3
//   devices; `enemy_mpprme_ray_damage` deals Arts damage of ATK x `ray_atk_scale` every `interval` s. If Ray cannot
//   cast, the fly buff ends at once.
// - `enemy_mpprme_mark`: a lethal hit drops the hand's pending MOVE_AND_DRAG_SOURCE.
// - The Spawn talent (`enemy_mpprme_spawn_mark`) has no blackboard in the records and is off; a record that gives
//   it one is refused.
import clocks from '../../data/arkpedia-prts-source-animations.json' with { type: 'json' };

export const PRTS_SOURCE = 'enemy_1564_mpprts', MIMIC_MACHINE = 'enemy_1565_mpprme';
const f32 = Math.fround;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const type = a => a?.$type?.split('+')[1]?.split(',')[0] ?? a?.$type;
const types = list => (list ?? []).map(type).join();
const ordered = o => JSON.stringify(Object.entries(o ?? {}).sort(([a], [b]) => a < b ? -1 : 1));
const clip = (id, k) => clocks.enemies[id].durations[k];
const hit = (id, k) => clocks.enemies[id].events[k]?.find(e => e.name === 'OnAttack')?.time;
export const isPrtsSource = r => r?.prefabKey === PRTS_SOURCE && r.key === PRTS_SOURCE;
export const isMimicMachine = r => r?.prefabKey === MIMIC_MACHINE && r.key === MIMIC_MACHINE;
export const isPrtsBoss = r => isPrtsSource(r) || isMimicMachine(r);

const SOURCE_TEXT = Object.freeze(['[Safe Mode Standby] <PRTS, Source Code> cannot be attacked until <Mimic Machine> is defeated',
  '[Emergency Response Mode] While <Mimic Machine> is downed, its recovery time is reduced by 1s each time <PRTS, Source Code> takes damage',
  '[Hot Reboot] DP regeneration rate significantly increases when <Mimic Machine> is defeated',
  '[Cleanup Protocol] Drains all Life Points once <PRTS, Source Code> has been on the battlefield for a long time']);
const MIMIC_TEXT = Object.freeze(["['Rebuild'] Until <PRTS, Source Code> is defeated, <Mimic Machine> recovers whenever it is defeated, increasing its ATK with each recovery, maxing out after 5 increases",
  '[Write Restriction] Temporarily disables the 4 Operators with the highest DP in your Deployment Waiting Zone when it enters the battlefield; Becomes stronger after the first recovery, disabling more functions',
  '[Heavy Ion Elastic Recoil] Fires a slow-moving orb towards the nearest unit, dealing Arts splash damage when it hits; The further the orb moves, the less damage it deals, and the smaller the splash area',
  '[Dynamic Deployment] When grabbed by <PRTS, Source Code>, gains <$ba.float>Low-Altitude Hovering</>, Attack Range expands, Attack Interval shortens, and attacks 2 targets simultaneously; <Mimic Machine> can be shot down earlier by dealing a certain amount of damage; Becomes stronger after the first recovery',
  '[Chain Reaction] Can be cast after the first recovery; When grabbed by <PRTS, Source Code>, gains <$ba.float>Low-Altitude Hovering</>, and fires a beam at all neutral or PRTS-activated Weakening Nodes, dealing damage to units in its path; <Mimic Machine> can be shot down earlier by dealing a certain amount of damage']);

const MIMIC_TALENTS = Object.freeze({ 'MoveFly_p1.attack@max_target': 2, 'MoveFly_p1.attack@ability_range_radius': 3.5, 'MoveFly_p1.base_attack_time': -.5,
  'MoveFly_p1.duration': 25, 'MoveFly_p1.hp_ratio_offset': -.3, 'MoveFly_p2.attack@max_target': 2, 'MoveFly_p2.attack@ability_range_radius': 4.5,
  'MoveFly_p2.base_attack_time': -1, 'MoveFly_p2.duration': 25, 'MoveFly_p2.hp_ratio_offset': -.3, 'FlyRay.duration': 20, 'FlyRay.hp_ratio_offset': -.3,
  'FlyRay.attack@interval': 1, 'FlyRay.attack@ray_atk_scale': .5, 'Reborn.max_stack_cnt': 5, 'Reborn.atk': 100 });
const MIMIC_TALENT_NAMES = Object.freeze({ 'MoveFly_p1.skill_name': 'Land', 'MoveFly_p2.skill_name': 'LandP2', 'FlyRay.skill_name': 'Skill_4_End' });
const ORB = Object.freeze({ projectile_range: .6, scale_interval: .25, scale: 1, scale_add: -.05, scale_max: .3, range_radius: 1.5,
  range_radius_add: -.075, range_radius_max: .45, damage_scale: 2.4, damage_scale_add: -.1, damage_scale_max: 1 });
// [prefabKey, priority, cooldown, initCooldown, bb, bbStr]
const MIMIC_SKILLS = Object.freeze([['FireBall', 0, 12, 12, ORB, {}], ['StartFlyP1', 1, 35, 20, { mode: 1 }, { ability_name: 'StartFlyP1' }],
  ['CardBoom', 3, 999, 5, { duration: 20, 'respawn_disabled ': 1 }, {}], ['Land', 4, 0, 0, {}, {}],
  ['StartFlyP2', 1, 50, 50, { mode: 3 }, { ability_name: 'StartFlyP2' }], ['StartFlyRay', 2, 30, 10, { mode: 4 }, { ability_name: 'StartFlyRay' }],
  ['LandP2', 4, 0, 0, {}, {}], ['Skill_4_End', 4, 0, 0, {}, {}]]);
const skillIs = (s, [key, priority, cooldown, initCooldown, bb, bbStr]) => s?.prefabKey === key && s.priority === priority && s.cooldown === cooldown
  && s.initCooldown === initCooldown && s.spCost === 0 && ordered(s.bb) === ordered(bb) && ordered(s.bbStr) === ordered(bbStr);
const flags = buff => buff?.attributes?.abnormalFlags ?? [];
const buffsOf = (n, name) => (n?.[name] ?? []).flatMap(c => c._buffs ?? []);

export function prtsSourceNative(r, n) {
  if (!isPrtsSource(r) || ![0, 1].includes(r.level) || r.stats.maxHp !== [50000, 60000][r.level] || r.stats.motion !== 'WALK'
    || ordered(r.talents.bb) !== ordered({ 'TimeUp.interval': 420 }) || r.skills.length !== 1) return false;
  const [end] = r.skills;
  if (end.prefabKey !== 'DizzyEnd' || end.spCost !== 50 || end.cooldown !== 0 || end.initCooldown !== 0) return false;
  const T = k => n?.$template?.(k)?.eventToActions, root = n?.[PRTS_SOURCE]?.[0];
  const all = buffsOf(n, 'Ability0'), inv = all.find(b => b.buffKey === 'enemy_mpprts_inv'), dying = all.find(b => b.buffKey === 'enemy_mpprts_dying');
  const can = (n?.Ability0 ?? []).find(c => c._buffs?.[0]?.buffKey === 'enemy_mpprts_canreborn'), validator = n?.$ref?.(can?._targetValidator);
  const dizzy = (n?.Dizzy ?? []).find(c => c._animKey), dizzyEnd = (n?.DizzyEnd ?? []).find(c => c._animKey);
  const endSteps = dizzyEnd ? n.$siblings(dizzyEnd) : [], beginSteps = dizzy ? n.$siblings(dizzy) : [];
  const modeOf = steps => steps.map(c => { try { return JSON.parse(c._actions?.SerializedState ?? 'null'); } catch { return null; } })
    .flat().find(a => type(a) === 'SwitchMode')?._modeIndex;
  const time = buffsOf(n, 'TimeUp')[0], up = T('enemy_mpprts_time_up')?.ON_BUFF_TRIGGER, real = T('enemy_mpprts_time_up[real]')?.ON_BUFF_TRIGGER;
  const tick = T('enemy_mpprts_dying'), start = T('enemy_mpprts_dying_start');
  const box = (n?.[PRTS_SOURCE] ?? []).map(c => c).concat(root ? n.$siblings(root) : []).find(c => c?.m_Size && c?.m_Offset);
  return !!root && root._modes?.length === 2 && root._commonAbilities?.length === 1
    && same(flags(inv), [5]) && dying?.templateKey === 'enemy_mpprts_dying' && dying.triggerInterval === 1
    && validator?._targetId === MIMIC_MACHINE
    && dizzy?._animKey === 'Dizzy_Begin' && modeOf(beginSteps) === 1
    && dizzyEnd?._animKey === 'Dizzy_End' && modeOf(endSteps) === 0
    && endSteps.some(c => c._buffs?.[0]?.buffKey === 'enemy_mpprts_inv2' && same(flags(c._buffs[0]), [5]))
    && endSteps.some(c => (c._actions?.SerializedState ?? '').includes('"_buffKey":"enemy_mpprts_dying"'))
    && time?.templateKey === 'enemy_mpprts_time_up' && same(flags(time), [22, 8])
    && types(up) === 'CreateEffect,CreateBuff' && up[1]._buff.templateKey === 'enemy_mpprts_time_up[real]' && up[1]._buff.triggerInterval === .5
    && types(real) === 'FinishGame' && real[0]._gameResult === 'LOSE'
    && types(tick?.ON_BUFF_TRIGGER) === 'ModifySp' && tick.ON_BUFF_TRIGGER[0]._modifyValue === 1
    && types(tick.ON_BUFF_FINISH) === 'FinishBuffsById' && tick.ON_BUFF_FINISH[0]._buffKey === 'enemy_mpprts_dying_start'
    && type(start?.ON_BUFF_START?.[0]) === 'TriggerAbility' && start.ON_BUFF_START[0]._abilityName === 'Dizzy'
    && types(start.ON_BUFF_FINISH) === 'FinishBuffsById' && start.ON_BUFF_FINISH[0]._buffKey === 'enemy_mpprme_inreborn'
    && types(start.ON_BEFORE_TRY_SET_HP_ZERO) === 'InstantKill' && start.ON_BEFORE_TRY_SET_HP_ZERO[0]._skipReborn === true
    && (!box || same([box.m_Offset.x ?? 0, box.m_Offset.y, box.m_Size.x, box.m_Size.y], [0, 2, f32(2.95), f32(4.95)]))
    && [2.667, 1.867].every((v, i) => Math.abs(clip(PRTS_SOURCE, ['Dizzy_Begin', 'Dizzy_End'][i]) - v) < .01);
}

export function mimicMachineNative(r, n) {
  if (!isMimicMachine(r) || ![0, 1].includes(r.level) || r.stats.motion !== 'WALK' || r.stats.rangeRadius !== 2.5 || r.stats.bat !== 4
    || ordered(r.talents.bb) !== ordered(MIMIC_TALENTS) || ordered(r.talents.bbStr) !== ordered(MIMIC_TALENT_NAMES)
    || r.skills.length !== MIMIC_SKILLS.length || !MIMIC_SKILLS.every((s, i) => skillIs(r.skills[i], s))) return false;
  const T = k => n?.$template?.(k)?.eventToActions, root = n?.[MIMIC_MACHINE]?.[0];
  const reborn = (n?.Reborn ?? []).find(c => '_hpRechargeRatio' in c) ?? (n?.Reborn ?? []).flatMap(c => n.$siblings(c)).find(c => '_hpRechargeRatio' in c);
  const fly = T('enemy_mpprme_fly'), call = T('enemy_mpprme_s_fly[call]')?.ON_BUFF_START, arrive = T('enemy_mpprme_s_fly[arrive]')?.ON_BUFF_START;
  const down = T('enemy_mpprme_inreborn'), ray = T('enemy_mpprme_ray_damage')?.ON_BUFF_TRIGGER, flyRay = T('enemy_mpprme_fly_ray');
  const mark = T('enemy_mpprme_mark')?.ON_BEFORE_TRY_SET_HP_ZERO;
  const end = k => (fly?.ON_BUFF_FINISH ?? []).find(x => type(x) === k);
  const undead = [...buffsOf(n, 'Ability0'), ...buffsOf(n, 'Ability1')];
  const takeOff = name => (n?.[name] ?? []).find(c => '_preDelay' in c)?._preDelay;
  const P = k => n?.$projectile?.(k) ?? [], move = k => P(k).find(c => '_speed' in c);
  const ball = P('projectile_enemy_mpprme_ball'), ice = move('projectile_enemy_mpprme_ice'), beam = P('projectile_enemy_mpprme_ray');
  const decay = ball.find(c => c._bbGroups), hitbox = ball.find(c => c.m_Radius != null), laser = beam.find(c => '_laserWidth' in c);
  return !!root && root._modes?.length === 6 && root._commonAbilities?.length === 1
    && reborn?._modeIndex === 5 && reborn._validWhenContainsBuff === 'enemy_mpprts_canreborn' && reborn._maxRespawnCnt === -1
    && reborn._hpRechargeRatio === .5 && same(reborn._buffsRetainedWhenReborn, ['enemy_mpprme_reborned', 'enemy_mpprme_mark'])
    && undead.filter(b => b.buffKey === 'enemy_mpprme_fly_undead').every(b => same(flags(b), [6, 8]))
    && undead.some(b => b.buffKey === 'enemy_mpprme_inreborn_effect' && same(flags(b), [5, 18, 22]))
    && ['StartFlyP1', 'StartFlyP2', 'StartFlyRay'].every(k => takeOff(k) === f32(1.1))
    && types(call) === 'Main15InsertPrtsAction' && call[0]._actionType === 'MOVE_AND_DRAG_SOURCE' && call[0]._priority === 200
    && types(arrive) === 'InterruptAbility,CreateBuff' && arrive[1]._buff.lifeTime === f32(.27)
    && types(fly?.ON_BUFF_START) === 'RecordCurrentHpRatio,FinishBuffsById,ReleaseFromBlocker,ChangeMotionMode'
    && fly.ON_BUFF_START[0]._needOffset === true && fly.ON_BUFF_START[3]._motionMode === 'FLY'
    && types(fly.ON_TAKE_DAMAGE) === 'FilterByTargetHpRatio,FinishBuff' && fly.ON_TAKE_DAMAGE[0]._condType === 'LE'
    && types(fly.ON_BEFORE_TRY_SET_HP_ZERO) === 'FinishBuff'
    && same(fly.ON_BUFF_FINISH.map(type).sort(), ['ChangeMotionMode', 'CreateBuff', 'FinishManagedProjectiles', 'Main15TryNextPrtsAction', 'ReleaseFromBlocker', 'TriggerEnemySkill'])
    && end('CreateBuff')._buff.lifeTime === f32(.9) && same(end('CreateBuff')._buff.attributes.abnormalFlags, ['BLOCK_FREE', 'FORCE_DISARMED'])
    && end('ChangeMotionMode')._motionMode === 'WALK' && end('Main15TryNextPrtsAction')._forceNext === true
    && type(flyRay?.ON_BUFF_LATE_ENABLE?.[0]) === 'IfElse' && flyRay.ON_BUFF_LATE_ENABLE[0]._conditionNode._abilityName === 'Ray'
    && types(flyRay.ON_BUFF_LATE_ENABLE[0]._failNodes) === 'FinishBuff,FinishBuffsById'
    && types(ray) === 'AdvancedApplyDamage' && ray[0]._damageType === 'MAGICAL' && ray[0]._atkScaleVar === 'ray_atk_scale'
    && types(mark) === 'Main15SkipPrtsAction' && mark[0]._actionType === 'MOVE_AND_DRAG_SOURCE'
    && types(down?.ON_BUFF_START) === 'CreateBuff,CreateBuffUseAbilitySelector,AddCostTimerModifier,AddOrRemoveRuntimeUIPlugin'
    && down.ON_BUFF_START[0]._buff.buffKey === 'enemy_mpprme_reborned'
    && down.ON_BUFF_START[0]._buff.attributes.attributeModifiers[0].attributeType === 'ATK'
    && down.ON_BUFF_START[0]._buff.attributes.attributeModifiers[0].formulaItem === 'ADDITION'
    && down.ON_BUFF_START[1]._buff.buffKey === 'enemy_mpprts_dying_start' && down.ON_BUFF_START[2]._value === f32(.33)
    && type(down.ON_BUFF_FINISH?.[0]) === 'TriggerAbility' && down.ON_BUFF_FINISH[0]._abilityName === 'RebornAnim'
    && type(T('finish_current_wave_when_buff_finish')?.ON_BUFF_FINISH?.[0]) === 'FinishCurrentWave'
    && move('projectile_enemy_mpprme')?._speed === 10 && move('projectile_enemy_mpprme_ball')?._speed === 2
    && move('projectile_enemy_mpprme_ball')._delayAfterReached === .75 && hitbox?.m_Radius === 1
    && ball.some(c => c._lifeTime === 10) && ball.some(c => c._markReachedOnlyWhenTargetEnter === 1 && c._goThroughWall === 1)
    && same(decay?._bbGroups?.map(g => [g.blackboardKey, g.increaseValueKey, g.maxValueKey]), [['scale', 'scale_add', 'scale_max'], ['damage_scale', 'damage_scale_add', 'damage_scale_max']])
    && decay._intervalKey === 'scale_interval'
    && ice?._onlyReachedInTime === f32(.8) && ice._delayAfterReached === 1
    && laser?._laserWidth === .5 && beam.some(c => c._extendLenth === 15)
    && [1, 1.733, 1.667, 1.667, 1.167, 1.9].every((v, i) => Math.abs(clip(MIMIC_MACHINE, ['Die', 'Revive_End', 'Landing', 'Skill_4_End', 'TakeOff_Begin', 'Skill_4_TakeOff_Begin'][i]) - v) < .01)
    && [hit(MIMIC_MACHINE, 'Skill_1'), hit(MIMIC_MACHINE, 'Skill_2')].every(Number.isFinite);
}

export function prtsSourceParams(r) {
  return { mimic: MIMIC_MACHINE, box: { w: 2.95, h: 4.95, dx: 0, dy: 2 }, deadline: r.talents.bb['TimeUp.interval'], loseDelay: .5,
    spCost: r.skills[0].spCost, spInterval: 1, dizzyBegin: clip(PRTS_SOURCE, 'Dizzy_Begin'), dizzyEnd: clip(PRTS_SOURCE, 'Dizzy_End') };
}
export function mimicMachineParams(r) {
  const bb = r.talents.bb, skill = k => r.skills.find(s => s.prefabKey === k), orb = skill('FireBall'), seal = skill('CardBoom');
  const fly = (s, group) => ({ initial: skill(s).initCooldown, cooldown: skill(s).cooldown, range: bb[`${group}.attack@ability_range_radius`],
    bat: bb[`${group}.base_attack_time`], targets: bb[`${group}.attack@max_target`], duration: bb[`${group}.duration`], hpOffset: bb[`${group}.hp_ratio_offset`] });
  const steps = Math.round((orb.bb.scale_max - orb.bb.scale) / orb.bb.scale_add);
  return { source: PRTS_SOURCE, die: clip(MIMIC_MACHINE, 'Die'), revive: clip(MIMIC_MACHINE, 'Revive_End'), dpInterval: .33,
    stack: { atk: bb['Reborn.atk'], max: bb['Reborn.max_stack_cnt'] },
    seal: { initial: seal.initCooldown, cooldown: seal.cooldown, windUp: hit(MIMIC_MACHINE, 'Skill_1'), cast: clip(MIMIC_MACHINE, 'Skill_1'),
      flight: .8, delay: 1, count: 4, duration: seal.bb.duration },
    orb: { initial: orb.initCooldown, cooldown: orb.cooldown, windUp: hit(MIMIC_MACHINE, 'Skill_2'), cast: clip(MIMIC_MACHINE, 'Skill_2'),
      speed: 2, life: 10, fuse: .75, step: orb.bb.scale_interval, steps, hit: 1 * orb.bb.scale, hitAdd: 1 * orb.bb.scale_add,
      radius: orb.bb.range_radius, radiusAdd: orb.bb.range_radius_add, scale: orb.bb.damage_scale, scaleAdd: orb.bb.damage_scale_add },
    fly: [fly('StartFlyP1', 'MoveFly_p1'), fly('StartFlyP2', 'MoveFly_p2')],
    ray: { initial: skill('StartFlyRay').initCooldown, cooldown: skill('StartFlyRay').cooldown, duration: bb['FlyRay.duration'],
      hpOffset: bb['FlyRay.hp_ratio_offset'], minRatio: .01, interval: bb['FlyRay.attack@interval'], scale: bb['FlyRay.attack@ray_atk_scale'],
      width: .5, extend: 15, maxNodes: 3 },
    takeOff: { preDelay: 1.1, arrive: .27 }, land: { settle: .9, clip: clip(MIMIC_MACHINE, 'Landing'), rayClip: clip(MIMIC_MACHINE, 'Skill_4_End') } };
}

const sourceLines = new Set(SOURCE_TEXT), mimicLines = new Set(MIMIC_TEXT);
const source = (note, extra = {}) => ({ matchesRecord: isPrtsSource, covers: prtsSourceNative, ability: null, note, ...extra });
const mimic = (note, extra = {}) => ({ matchesRecord: isMimicMachine, covers: mimicMachineNative, ability: null, note, ...extra });
export const PRTS_SOURCE_FEATURES = Object.freeze({
  'talent:TimeUp': source('PRTS, Source Code: invincible until the Mimic Machine is down, then SP to its recovery; the deadline', {
    nativeClaim: () => ({ wrappers: 1, active: 4 }), explains: text => sourceLines.has(text),
    ability: r => ({ kind: 'prtsSource', params: () => prtsSourceParams(r) }) }),
  'skill:DizzyEnd': source('the recovery at full SP (kind prtsSource)'),
  'talent:MoveFly_p1': mimic('Mimic Machine: revive while PRTS, Source Code stands; card seal, orb, held flights and beams', {
    nativeClaim: () => ({ wrappers: 10, active: 7 }), explains: text => mimicLines.has(text),
    ability: r => ({ kind: 'mimicMachine', params: () => mimicMachineParams(r) }) }),
  'talent:MoveFly_p2': mimic('Dynamic Deployment after the first recovery (kind mimicMachine)'),
  'talent:FlyRay': mimic('Chain Reaction (kind mimicMachine)'),
  'skill:FireBall': mimic('Heavy Ion Elastic Recoil (kind mimicMachine)'),
  'skill:StartFlyP1': mimic('Dynamic Deployment, take-off (kind mimicMachine)'),
  'skill:StartFlyP2': mimic('Dynamic Deployment after the first recovery, take-off (kind mimicMachine)'),
  'skill:StartFlyRay': mimic('Chain Reaction, take-off (kind mimicMachine)'),
  'skill:Land': mimic('landing (kind mimicMachine)'),
  'skill:LandP2': mimic('landing after the first recovery (kind mimicMachine)'),
  'skill:Skill_4_End': mimic('Chain Reaction, landing (kind mimicMachine)'),
});
/** Keys other families also use: a Mimic Machine record takes these entries (enemy-features.js `withFamily`). */
export const PRTS_SOURCE_SHARED_FEATURES = Object.freeze({
  'talent:Reborn': mimic('the revive while PRTS, Source Code stands, and its ATK stacks (kind mimicMachine)'),
  'skill:CardBoom': mimic('Write Restriction: four deck cards sealed (kind mimicMachine)'),
});
