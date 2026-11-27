// SPDX-License-Identifier: GPL-3.0-or-later
// Chapter 16's three devices, reviewed from their pinned prefabs, templates and records. Runtime:
// server/sim/content/arkpedia-stage-mainline16.js. The pollution system itself is reviewed in stage-mainline16.js.
//
// Heavily Polluted Facility `trap_271_fowstn` (PRTS 严重污染设施; enemy side, default category: operators can attack it):
// - `fowstn_t[shadow_tile]` (as long as it lives): Main16ChangeTileShadowViaRange marks its range `x-2` (the 5x5
//   around it without the corners) as shadowed at the start and unmarks it when the buff ends (its death).
// - It keeps the passability of its tile (`_keepCurrentPassableMask`): the Miner Guerrillas' routes run through it.
// - Immune to Stun, Cold, Freeze, Silence, Levitate and Sleep.
// Rock Wall `trap_272_nomstn` (PRTS 阻道岩壁; enemy side): TARGET_FREE (flag 2), its tile fly-only.
// Both:
// - `trap_fowstn_t[damage_scale]` ON_TAKE_DAMAGE: damage from a source holding `enemy_mcreep_self_mark` (a Miner
//   Guerrilla) is scaled by `damage_scale` (5).
// - StopMcreep: a ground unit holding `enemy_mcreep_self_mark` inside a circle of radius 0.8 is UNMOVABLE (flag 13)
//   for as long as it stays inside.
// Hidden Tunnel `trap_270_spawnp` (PRTS 隐蔽矿道; ally side, obstacle category, its tile fly-only):
// - Talent Summon `spawnp_t[summon_trigger]`, every `interval` (15) s: only with fewer than `max_mcreep_near_count` (3)
//   waiting Miner Guerrillas of its own and fewer than `max_mcreep_count` (5) in all, it summons one along action
//   `action_index` of the level branch `branch_id` (mcreep_route), unharmful. In mode Default (standby) the summon
//   also gets `spawnp_t[stop_move]` (UNMOVABLE_PRIVATE): it waits.
// - Skill sktok_spawnp (MANUAL, 15 SP at 1 SP/s from 0, no duration): switches to mode M1 (sortie), whose MoveMcreep
//   ends `spawnp_t[stop_move]` on every Miner Guerrilla this tunnel is holding (SelectMcreep has no target limit).
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };

const f32 = Math.fround;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const type = a => a?.$type?.split('+')[1]?.split(',')[0] ?? a?.$type;
const types = list => (list ?? []).map(type).join();
const keys = list => (list ?? []).map(b => b.buffKey).join();
export const POLLUTED_FACILITY = 'trap_271_fowstn', ROCK_WALL = 'trap_272_nomstn', HIDDEN_TUNNEL = 'trap_270_spawnp';
export const MINER_MARK = 'enemy_mcreep_self_mark', MINER_BRANCH = 'mcreep_route';
const FACILITY_RANGE = 'x-2';

const parts = (e, key) => {
  const rows = e.prefabs?.[key]?.components ?? [], root = rows.find(c => '_modes' in c.data)?.data;
  const byId = ref => rows.find(c => c.pathId === String(ref?.m_PathID))?.data;
  const named = name => rows.filter(c => c.object === name).map(c => c.data);
  return { rows, root, byId, named, modes: (root?._modes ?? []).map(byId), buffs: name => named(name).flatMap(d => d._buffs ?? []) };
};
const frames = (t, key) => (t.devices?.[key]?.phases?.[0]?.attributesKeyFrames ?? []).map(f => [f.level, f.data.maxHp, f.data.def, f.data.magicResistance, f.data.tauntLevel]);
const talent = (t, key, prefab) => (t.devices?.[key]?.talents ?? []).map(x => x.candidates?.[0]).find(c => c?.prefabKey === prefab);
/** The shared pieces: the x5 from Miner Guerrillas and the circle that stops them. */
const stopsMiners = (e, t, key) => {
  const p = parts(e, key), stop = p.named('StopMcreep'), aura = stop.find(d => d._buffs), circle = stop.find(d => d.m_Radius !== undefined);
  const scale = e.templates?.['trap_fowstn_t[damage_scale]']?.eventToActions?.ON_TAKE_DAMAGE;
  return keys(p.buffs('McreepDamageScale')) === 'trap_fowstn_t[damage_scale]'
    && types(scale) === 'CheckContainsBuff,DamageScale' && scale[0]._targetType === 'MODIFIER_SOURCE' && same(scale[0]._buffKeys, [MINER_MARK])
    && same((talent(t, key, 'McreepDamageScale')?.blackboard ?? []).map(x => [x.key, x.value]), [['damage_scale', 5]])
    && keys(aura?._buffs) === 'fowstn_a[stop_mcreep]' && same(aura._buffs[0].attributes?.abnormalFlags, [13]) && aura._removeBuffWhenTargetLeave === 1
    && same(p.byId(aura._targetValidator)?._buffs, [MINER_MARK]) && p.byId(aura._targetValidator)._targetOptions?.targetMotion === 1
    && circle?.m_Radius === f32(.8);
};

export function pollutedFacilityNativeReviewed(e = native, t = tables) {
  const p = parts(e, POLLUTED_FACILITY), shadow = e.templates?.['fowstn_t[shadow_tile]']?.eventToActions;
  const passive = p.buffs('Passive'), immune = passive.find(b => b.buffKey === 'fowstn_a[passive]')?.attributes;
  return p.root?._sideType === 2 && p.root._category === 1 && p.modes.length === 1 && p.modes[0]?._keepCurrentPassableMask === 1
    && keys(p.buffs('ShadowTileController')) === 'fowstn_t[shadow_tile]' && p.buffs('ShadowTileController')[0].lifeTimeType === 2
    && type(shadow?.ON_BUFF_START?.[0]) === 'Main16ChangeTileShadowViaRange' && shadow.ON_BUFF_START[0]._changeTileShadowState === true
    && shadow.ON_BUFF_START[0]._toShadow === true && shadow.ON_BUFF_START[0]._target === 'BUFF_OWNER'
    && types(shadow.ON_BUFF_FINISH) === 'Main16ChangeTileShadowViaRange' && shadow.ON_BUFF_FINISH[0]._changeTileShadowState === true
    && shadow.ON_BUFF_FINISH[0]._toShadow === false
    && same(immune?.abnormalImmunes, [0, 23, 16, 12, 25]) && same(immune.abnormalComboImmunes, [0])
    && stopsMiners(e, t, POLLUTED_FACILITY)
    && t.devices?.[POLLUTED_FACILITY]?.name === '严重污染设施' && !t.devices[POLLUTED_FACILITY].skills.length
    && same(frames(t, POLLUTED_FACILITY)[0], [1, 30000, 300, 50, -1])
    && same((talent(t, POLLUTED_FACILITY, 'ShadowTileController')?.blackboard ?? []).map(x => [x.key, x.valueStr]), [['range_id', FACILITY_RANGE]])
    && t.ranges?.[FACILITY_RANGE]?.grids?.length === 21;
}

export function rockWallNativeReviewed(e = native, t = tables) {
  const p = parts(e, ROCK_WALL);
  return p.root?._sideType === 2 && p.root._category === 1 && p.modes.length === 1 && p.modes[0]?._tileOptions?.passableMask === 2
    && same(p.buffs('McreepDamageScale')[0]?.attributes?.abnormalFlags, [2])
    && stopsMiners(e, t, ROCK_WALL)
    && t.devices?.[ROCK_WALL]?.name === '阻道岩壁' && !t.devices[ROCK_WALL].skills.length
    && same(frames(t, ROCK_WALL)[0], [1, 8000, 300, 20, -1]);
}

export function hiddenTunnelNativeReviewed(e = native, t = tables) {
  const p = parts(e, HIDDEN_TUNNEL), T = k => e.templates?.[k]?.eventToActions;
  const summon = p.buffs('Summon')[0], run = T('spawnp_t[summon_trigger]')?.ON_BUFF_TRIGGER, branch = run?.[2];
  const hold = T('spawnp_t[count_manager_m0]')?.ON_BUFF_START, free = T('spawnp_t[move_mcreep]')?.ON_BUFF_START;
  const select = p.named('SelectMcreep').map(d => p.byId(d._selector)).find(Boolean);
  const skill = (e.prefabs?.sktok_spawnp?.components ?? []).map(c => c.data).find(d => '_switchToMode' in d);
  const level = t.skills?.sktok_spawnp?.levels, summonTalent = talent(t, HIDDEN_TUNNEL, 'Summon');
  return p.root?._sideType === 1 && p.root._category === 4 && p.modes.length === 2
    && p.modes.every(m => m?._tileOptions?.passableMask === 2)
    && (p.modes[0]._generalAbilities ?? []).length === 0
    && p.modes[1]._generalAbilities.map(r => keys(p.byId(r)?._buffs)).join() === 'spawnp_t[move_mcreep],spawnp_s[start_effect]'
    && summon?.templateKey === 'spawnp_t[summon_trigger]' && summon.triggerLifeType === 2
    && types(run) === 'FilterByBuffStackCount,FilterByBuffStackCount,IfElse'
    && run[0]._buffKey === 'spawnp_t[mcreep_stack_near]' && run[0]._stackCountKey === 'max_mcreep_near_count' && run[0]._condType === 'LT'
    && run[1]._buffKey === 'spawnp_t[mcreep_stack]' && run[1]._stackCountKey === 'max_mcreep_count' && run[1]._condType === 'LT'
    && type(branch._conditionNode) === 'CheckUnitCurrentMode' && branch._conditionNode._checkCurModeIndex === 0
    && types(branch._succeedNodes) === 'SummonEnemiesFollowBranchRoute' && branch._succeedNodes[0]._unharmful === true
    && branch._succeedNodes[0]._buffToEnemy.templateKey === 'spawnp_t[count_manager_m0]'
    && types(branch._failNodes) === 'SummonEnemiesFollowBranchRoute' && branch._failNodes[0]._unharmful === true
    && branch._failNodes[0]._buffToEnemy.templateKey === 'spawnp_t[count_manager_m1]'
    && types(hold) === 'CreateBuffToHost,CreateBuffToHost,CreateBuff' && hold[2]._buff.buffKey === 'spawnp_t[stop_move]'
    && same(hold[2]._buff.attributes?.abnormalFlags, ['UNMOVABLE_PRIVATE'])
    && types(free) === 'CreateBuffUseAbilitySelector' && free[0]._abilityName === 'SelectMcreep'
    && free[0]._buff.templateKey === 'spawnp_t[move_mcreep_core]'
    && T('spawnp_t[move_mcreep_core]')?.ON_BUFF_START?.[0]?._buffKey === 'spawnp_t[stop_move]'
    && select?._buffKey === 'spawnp_t[count_manager_m0]' && select._filterBuffSource === 1 && !select._limitTargetNum
    && skill?._switchToMode === 1
    && t.devices?.[HIDDEN_TUNNEL]?.name === '隐蔽矿道' && same(t.devices[HIDDEN_TUNNEL].skills.map(s => s.skillId), ['sktok_spawnp'])
    && same(frames(t, HIDDEN_TUNNEL)[0], [1, 3000, 100, 0, -1]) && summonTalent?.blackboard.length === 0
    && level?.length === 1 && level[0].skillType === 'MANUAL' && level[0].spData.spType === 'INCREASE_WITH_TIME'
    && level[0].spData.spCost === 15 && level[0].spData.initSp === 0 && level[0].duration === -1
    && same(level[0].blackboard.map(x => [x.key, x.valueStr ?? x.value]), [['talent@max_mcreep_count', 5], ['talent@action_index', 0],
      ['talent@interval', 15], ['talent@max_mcreep_near_count', 3], ['talent@branch_id', MINER_BRANCH]]);
}

const plain = instance => instance?.level === 1 && instance.skillLevel === 1;
export function pollutedFacilityDefinition(instance) {
  if (!pollutedFacilityNativeReviewed() || !plain(instance)) throw Error('Unsupported Heavily Polluted Facility instance');
  return { hp: 30000, def: 300, res: 50, taunt: -1, range: tables.ranges[FACILITY_RANGE].grids.map(g => [g.row, g.col]), minerDamageScale: 5,
    stopRadius: f32(.8), immune: ['stun', 'cold', 'frozen', 'silence', 'levitate', 'sleep'] };
}
export function rockWallDefinition(instance) {
  if (!rockWallNativeReviewed() || !plain(instance)) throw Error('Unsupported Rock Wall instance');
  return { hp: 8000, def: 300, res: 20, taunt: -1, minerDamageScale: 5, stopRadius: f32(.8) };
}
/** `actionIndex`: which action of the branch this tunnel's Miner Guerrillas follow (the level's `talent@action_index`). */
export function hiddenTunnelDefinition(instance) {
  if (!hiddenTunnelNativeReviewed() || !plain(instance) || !Number.isSafeInteger(instance.actionIndex) || instance.actionIndex < 0)
    throw Error('Unsupported Hidden Tunnel instance');
  return { hp: 3000, def: 100, taunt: -1, spCost: 15, initSp: 0, spPerSecond: 1, interval: 15, maxCount: 5, maxWaiting: 3,
    branchId: MINER_BRANCH, actionIndex: instance.actionIndex };
}
