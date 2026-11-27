// SPDX-License-Identifier: GPL-3.0-or-later
// Intrusive Call `enemy_10072_mpprhd` (PRTS 侵入式调用; chapter 15): the hand of the PRTS control system
// (stage-prts-control.js). Reviewed from its pinned prefab, its templates and its skeleton clocks
// (data/arkpedia-intrusive-call-animations.json).
// - Ability0 `enemy_mpprhd_passive` (every 0.3 s; INVINCIBLE, UNDEADABLE, TARGET_FREE, ALLY_TARGET_FREE): unless it is in an
//   action it tries the next PRTS action (Main15TryNextPrtsAction, compiled).
// - Its four skills GrabBegin, GrabEnd, Click and Angry are clips that wait for their attack event, hold
//   `enemy_mpprhd_in_action`, and try the next action when they end. A failed sub-action makes that buff's end
//   trigger Angry.
// - The actions themselves are compiled (MOVE_AND_SPAWNENEMY with the sub-actions MOVE_TO_DRAG and MOVE_TO_ORIGIN).
//   PRTS describes them: it flies to the drag tile, grabs the enemy a later spawn action names, carries it to that
//   enemy's position and deploys it there; an occupied target makes the deploy fail.
// - SpawnEnemy / SpawnTrap (`enemy_mpprhd_spawn_enemy`, `enemy_mpprhd_spawn_trap`: Main15InsertPrtsAction) are talents
//   the record does not use (its talent blackboard is empty); PRTS notes the fallback they served was removed.
import clocks from '../../data/arkpedia-intrusive-call-animations.json' with { type: 'json' };
import { PRTS_INTRUSIVE_CALL } from './stage-prts-control.js';

const f32 = Math.fround;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const type = a => a?.$type?.split('+')[1]?.split(',')[0];
const types = list => (list ?? []).map(type).join();
const keys = list => (list ?? []).map(b => b.buffKey).join();
const CLOCK = clocks.enemies?.enemy_10072_mpprhd;
const clip = k => CLOCK?.durations?.[k], hit = k => CLOCK?.events?.[k]?.find(e => e.name === 'OnAttack')?.time;
export const isIntrusiveCall = r => r?.key === PRTS_INTRUSIVE_CALL && r.prefabKey === PRTS_INTRUSIVE_CALL;
const SKILLS = ['GrabBegin', 'GrabEnd', 'Click', 'Angry'];

export function intrusiveCallNative(r, n) {
  if (!isIntrusiveCall(r) || r.level !== 0 || r.stats.motion !== 'FLY' || r.notCountInTotal !== true || !same(r.talents.bb, {})
    || !same(r.skills.map(s => [s.prefabKey, s.cooldown, s.initCooldown, s.spCost]), SKILLS.map(k => [k, 0, 0, 0]))) return false;
  const T = k => n?.$template?.(k)?.eventToActions;
  const cast = k => (n?.[k] ?? []).find(c => '_animKey' in c), passive = (n?.Ability0 ?? [])[0]?._buffs;
  const actions = c => { try { return JSON.parse(c._actions.SerializedState); } catch { return undefined; } };
  const root = (n?.[PRTS_INTRUSIVE_CALL] ?? []).find(c => '_modes' in c), tick = T('enemy_mpprhd_passive')?.ON_BUFF_TRIGGER;
  const done = T('enemy_mpprhd_in_action')?.ON_BUFF_FINISH;
  return same(SKILLS.map(k => cast(k)?._animKey), ['Grab_Begin', 'Grab_End', 'Click', 'Angry'])
    && SKILLS.every(k => cast(k)._waitForAttackEvent === 1 && cast(k)._timeMode === 1
      && keys(n.$siblings(cast(k)).find(c => c._buffs)?._buffs) === 'enemy_mpprhd_in_action')
    && ['GrabBegin', 'GrabEnd', 'Click'].every(k => types(actions(cast(k))) === 'Main15TryNextPrtsAction') && actions(cast('Angry')) === null
    && keys(passive) === 'enemy_mpprhd_passive' && passive[0].triggerInterval === f32(.3) && same(passive[0].attributes?.abnormalFlags, [5, 6, 2, 15])
    && types(tick?.slice(0, 3)) === 'CheckContainsBuff,IfNot,Main15TryNextPrtsAction' && same(tick[0]._buffKeys, ['enemy_mpprhd_in_action'])
    && types(done) === 'CheckContainsBuff,FinishBuffsById,TriggerEnemySkill,CreateBuff' && same(done[0]._buffKeys, ['enemy_mpprhd_subaction_fail'])
    && done[2]._skillName === 'Angry'
    && keys((n?.SpawnEnemy ?? [])[0]?._buffs) === 'enemy_mpprhd_spawn_enemy' && keys((n?.SpawnTrap ?? [])[0]?._buffs) === 'enemy_mpprhd_spawn_trap'
    && root?._modes?.length === 1 && root._canNotExit === 1 && root._sideTypeIndex === 2
    && clip('Grab_Begin') === f32(1.1666666269302368) && hit('Grab_Begin') === f32(.9333333373069763)
    && clip('Grab_End') === f32(1.6666666269302368) && hit('Grab_End') === f32(.3333333432674408)
    && clip('Click') === f32(1.4333332777023315) && hit('Click') === f32(.46666666865348816) && clip('Angry') === f32(1.9333332777023315);
}

export const intrusiveCallParams = () => ({
  grab: { clip: clip('Grab_Begin'), at: hit('Grab_Begin') }, release: { clip: clip('Grab_End'), at: hit('Grab_End') },
  click: { clip: clip('Click'), at: hit('Click') }, angry: clip('Angry'),
  // The second clip set holds a unit in the air (the Mimic Machine, enemy-prts-source-features.js).
  hold: { clip: clip('Grab_Begin_2'), at: hit('Grab_Begin_2'), end: clip('Grab_End_2') } });

export const INTRUSIVE_CALL_FEATURE = Object.freeze({ matchesRecord: isIntrusiveCall, covers: intrusiveCallNative,
  nativeClaim: () => ({ active: 1 }), ability: { kind: 'intrusiveCall', params: () => intrusiveCallParams() },
  note: 'Intrusive Call: grabs the enemy a later spawn action names and deploys it at that enemy\'s position (stage-prts-control.js)' });
