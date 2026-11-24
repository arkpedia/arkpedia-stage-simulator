// SPDX-License-Identifier: GPL-3.0-or-later
// Allerdale's Guard (trap_087_allady, PRTS 阿勒黛的卫护): the chapter-11 card, and 11-19's placed instances.
// - Default mode (skill index 0, the card): range 1-1 (its own tile and the tile it faces). Its attack, once an ally
//   stands there (selector: own side, nearest), plays Skill (2.17 s, OnAttack 1.2 s) and puts trap_allady_t[stay]
//   (template trap_allady_protected, one trigger after 1 s) on that ally: allies in the 3x3 around it (x-4) get
//   allady_shield (trap_allady_shield: BlockDamage up to `dynamic` = 1000, any attack), lasting `shield_duration`
//   (10 s). When the cast ends the Guard kills itself (trap_allady_killself). With no ally in range it stays idle.
// - S2 mode (skill index 1, sktok_allady_2): switch_mode_restart_fsm to mode 1, which fires projectile_trap_allady at the
//   level's tile_end. That projectile only selects Steam Knight S (_filterID enemy_1534_stmkgt2) and deals the Guard's
//   ATK (0 at level 1) x 1: the shield shown on the protection point has no effect. Killself 3 s after the cast.
// Start (born) is 1 s.
import native from '../../data/arkpedia-device-native-source.json' with { type: 'json' };
import tables from '../../data/arkpedia-device-source.json' with { type: 'json' };
import clocks from '../../data/arkpedia-allady-animations.json' with { type: 'json' };

const f32 = Math.fround;
const scriptOf = id => c => c.m_Script?.m_PathID === id;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function alladyNativeReviewed(e = native, c = clocks) {
  const r = e.prefabs.trap_087_allady?.components.map(x => x.data) ?? [];
  const p = e.prefabs.projectile_trap_allady?.components.map(x => x.data) ?? [];
  const s2 = e.prefabs.sktok_allady_2?.components.map(x => x.data) ?? [];
  const root = r.find(x => '_modes' in x), modes = r.filter(scriptOf('5390319429299248724'));
  if (root?._modes?.length !== 2 || modes.length !== 2) return false;
  const byPath = id => e.prefabs.trap_087_allady.components.find(x => x.pathId === String(id))?.data;
  const [m0, m1] = root._modes.map(ref => byPath(ref.m_PathID));
  const a0 = byPath(m0?._attack?.m_PathID), a1 = byPath(m1?._attack?.m_PathID);
  const stay = a0?._activeBuffs?.[0], kills = r.filter(x => x._buffs?.[0]?.templateKey === 'trap_allady_killself');
  const T = e.templates ?? {}, prot = T.trap_allady_protected?.eventToActions?.ON_BUFF_START?.[0];
  const shield = T.trap_allady_shield?.eventToActions?.ON_TAKE_DAMAGE, kill = T.trap_allady_killself?.eventToActions;
  const range = r.find(x => '_useBlackboardRangeId' in x);
  const selector = r.find(x => x._targetSide === 1 && x._postFilter === 4 && x._maxNum === 1);
  const tileEnd = r.find(x => Array.isArray(x._tileOrTokenIdListPreferred));
  const proj = p.find(x => '_filterID' in x), life = p.find(x => '_maxHitNum' in x);
  const skill = tables.skills.sktok_allady?.levels?.[0], bb = Object.fromEntries((skill?.blackboard ?? []).map(x => [x.key, x.value]));
  const k = c.enemies?.trap_087_allady;
  return m0?._combat?.m_PathID === m0?._attack?.m_PathID && a0?._animKey === 'Skill' && a0._activeBuffs.length === 1
    && stay?.templateKey === 'trap_allady_protected' && stay.triggerCnt === 1 && stay.triggerInterval === 1 && stay.firstTriggerInterval === 1
    && kills.length === 2 && kills.every(x => x._runActionOnEvent === 3)
    && prot?.$type.includes('CreateBuffInRange') && prot._rangeId === 'x-4' && prot._targetOptions.targetSide === 'ALLY'
    && prot._buffs.length === 1 && prot._buffs[0].templateKey === 'trap_allady_shield' && prot._buffs[0].durationKey === 'shield_duration'
    && shield?.[0]?.$type.includes('BlockDamage') && shield[0]._useDynamicVar === true && shield[0]._damageMask === 'ANY_ATTACK'
    && same(kill?.ON_BUFF_FINISH?.map(x => x.$type.split('+')[1].split(',')[0]), ['InstantKill'])
    && range?._useBlackboardRangeId === 0 && selector?._targetMotion === 3
    && a1?._projectileKey === 'projectile_trap_allady' && same(tileEnd?._tileOrTokenIdListPreferred, ['tile_end'])
    && proj?._filterID === 'enemy_1534_stmkgt2' && life?._lifeTime === 5 && life._maxHitNum === 1
    && s2.some(x => x._buffs?.[0]?.templateKey === 'switch_mode_restart_fsm' && x._buffs[0].blackboard?.[0]?.value === 1)
    && tables.devices.trap_087_allady?.phases?.[0]?.rangeId === '1-1'
    && same(tables.ranges?.['1-1']?.grids, [{ row: 0, col: 0 }, { row: 0, col: 1 }])
    && bb.dynamic === 1000 && bb.shield_duration === 10
    && k?.durations?.Start === 1 && k.durations.Skill === f32(2.1666667461395264)
    && same(k.events?.Skill?.filter(x => x.name === 'OnAttack').map(x => x.time), [f32(1.2000000476837158)]);
}
/** The reviewed Guard: skill index 0 is the barrier, 1 the protection-point mode (no effect). Level 1 only. */
export function alladyDefinition(instance) {
  if (!alladyNativeReviewed() || instance?.level !== 1 || instance.skillLevel !== 1 || ![0, 1].includes(instance.skillIndex))
    throw Error('Unsupported original Allerdale\'s Guard instance');
  const frame = tables.devices.trap_087_allady.phases[0].attributesKeyFrames[0].data;
  const k = clocks.enemies.trap_087_allady, hit = k.events.Skill.find(x => x.name === 'OnAttack').time;
  const bb = Object.fromEntries(tables.skills.sktok_allady.levels[0].blackboard.map(x => [x.key, x.value]));
  return { kind: 'allerdale', mode: instance.skillIndex === 0 ? 'barrier' : 'door', hp: frame.maxHp, block: frame.blockCnt,
    start: k.durations.Start, cast: k.durations.Skill, hit, delay: 1, shield: bb.dynamic, duration: bb.shield_duration,
    reach: [[0, 0], [0, 1]], area: [-1, 0, 1].flatMap(dr => [-1, 0, 1].map(dc => [dr, dc])), doorLinger: 3 };
}
