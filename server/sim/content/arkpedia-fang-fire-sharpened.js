// SPDX-License-Identifier: GPL-3.0-or-later
// Complete original graphs and explicit simulator bounds are retained in
// data/arkpedia-fang-fire-sharpened-prefabs.json; no native frame-parity claim.
import evidence from '../../../data/arkpedia-fang-fire-sharpened-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { canTargetEnemy } from '../targeting.js';

const ID = 'char_1036_fang2', FIRST = 'skchr_fang2_1';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.originalModels[ID][u.dir === 'UP' ? 'Back' : 'Front'];
const rate = u => Math.min(1, u.s.aspd / 100);
const second = u => u.skill.id !== FIRST && u.skill.active;
const clip = u => u.skill.pending && u.skill.id === FIRST ? 'Skill_1' : second(u)
  ? u.dir === 'DOWN' ? 'Skill_Down_2_Loop' : 'Skill_2_Loop' : 'Attack';
const ordinaryOperator = (b, id) => !!b.bench[id] && !b.data.getChess(id)?.raw?.arkpedia?.isToken;

/** Original UNTIL_NEXT_SPAWN_DECK_TRIGGER_ONCE is a shared one-use card
 * addition. Own runtime_cost expires on the first successful deployment. */
export function adjustFangFireSharpenedCost(b, id, ordinaryCost) {
  if (!Number.isFinite(ordinaryCost) || !ordinaryOperator(b, id)) return ordinaryCost;
  const first = id === ID && b.bench[id].deployments === 0
    ? b.data.getChess(ID).talents[0]?.bb.runtime_cost ?? 0 : 0;
  return Math.max(0, ordinaryCost + first + (b._fangFireSharpenedCard ?? 0));
}
export function consumeFangFireSharpenedCard(b, id) {
  if (ordinaryOperator(b, id)) b._fangFireSharpenedCard = 0;
}
export function fangFireSharpenedRefund(entry) {
  // First-only and temporary discounts cannot mint DP on withdrawal.
  return Math.min(entry.lastCost, entry.unit.base.cost);
}
function clearCast(b, u, state) {
  if (!state || u.mem.fangFireSharpenedCast !== state) return;
  u.mem.fangFireSharpenedCast = null;
  b.removeBuff(u, 'fang2:s1-no-sp');
}
function windup(b, u) {
  const animation = clip(u), playback = rate(u);
  u.mem.fangFireSharpenedClip = animation;
  if (animation === 'Skill_1') {
    const state = { seq: u.deploySeq, epoch: u.attackControlEpoch,
      activation: u.skill.activations, rate: playback, emitted: false };
    u.mem.fangFireSharpenedCast = state;
    b.addBuff(u, { key: 'fang2:s1-no-sp', flags: { noSp: true } });
  }
  return model(u).hits[animation][0] / playback;
}
function strike(b, u, p, target, info) {
  if (!canTargetEnemy(u, target, p)) return;
  u.mem.fangFireSharpenedSkillHit = info.isSkill && u.skill.id === FIRST;
  try { resolveHit(b, u, { ...p, hits: 1, hitsFn: null, chain: null, splashRadius: 0 },
    target, info, target.x, target.y); }
  finally { u.mem.fangFireSharpenedSkillHit = false; }
}
function launch(b, u, p, target, info) {
  const state = u.mem.fangFireSharpenedCast;
  if (!info.isSkill || u.skill.id !== FIRST || !state) { strike(b, u, p, target, info); return; }
  if (!canTargetEnemy(u, target, p)) return;
  state.emitted = true;
  const targetSeq = target.deploySeq;
  strike(b, u, p, target, info);
  // Native MultiMelee explicitly does not wait for every literal OnAttack;
  // the second strike uses triggerDelta, not the unused .5 skeleton event.
  b.after(.25 / state.rate, () => {
    if (live(u) && u.mem.fangFireSharpenedCast === state && u.deploySeq === state.seq
      && u.attackControlEpoch === state.epoch && u.skill.activations === state.activation
      && u.canAct && !u.s.flags.disarm && target.deploySeq === targetSeq)
      strike(b, u, p, target, info);
    clearCast(b, u, state);
  }, { owner: u });
}
function beginSecond(b, u) {
  const seq = u.deploySeq;
  u.mem.regularFormVisual = { clip: 'Start_2', loop: false };
  b.after(model(u).durations.Start_2, () => {
    if (live(u) && u.deploySeq === seq && second(u))
      u.mem.regularFormVisual = { clip: 'Skill_2_Idle', loop: true };
  }, { owner: u });
}
function endSecond(b, u, reason) {
  if (reason === 'death' || !live(u)) { u.mem.regularFormVisual = null; return; }
  const seq = u.deploySeq;
  u.mem.regularFormVisual = { clip: 'Skill_2_End', loop: false };
  b.after(model(u).durations.Skill_2_End, () => {
    if (u.deploySeq === seq && !second(u)) u.mem.regularFormVisual = null;
  }, { owner: u });
}
export function customizeFangFireSharpenedKit({ battle: b, id, unit: u, def, kit }) {
  if (id !== ID) return;
  kit.install = null; kit.talents = [];
  kit.trait = { install: null, attack: 'melee', dmgType: 'phys', projectile: 'none',
    canHitFly: false, maxTargets: 1, maxTargetsByBlock: false, hitAllBlocked: false,
    allInRange: false, rangeAoe: false, hits: 1, hitsFn: null, chain: null, splashRadius: 0,
    dmgMul: null, interruptOnSkillChange: true, retargetOnRelease: false,
    windup, attackVisual: (_b, actor) => actor.mem.fangFireSharpenedClip, launchAttack: launch };
  const s = def.skill, bb = s.bb;
  kit.skill = s.id === FIRST ? { kind: 'instant', charges: bb.cnt, attack: {
    atkScale: bb.atk_scale,
    afterAttack: (_battle, actor, _targets, meta) => {
      const state = actor.mem.fangFireSharpenedCast;
      if (!state || state.emitted) return;
      if (meta.inputTargets.length && meta.inputTargets.every(e => !e.alive)) actor.skill.addCharge(1);
      clearCast(b, actor, state);
    } } }
    : { kind: 'duration', duration: s.duration, activateOnDeploy: true, spType: 'none', trigger: 'NEVER',
      isExhausted: () => u.skill?.activations >= 1,
      mods: { atkPct: bb.atk, defPct: bb.def, blockCnt: bb.block_cnt },
      attack: { maxTargetsByBlock: true, retargetOnRelease: true },
      onStart: () => beginSecond(b, u), onEnd: ({ reason }) => endSecond(b, u, reason) };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installFangFireSharpened({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  b.on('kill', ({ killer, victim }) => {
    if (killer === u && victim.side === 'enemy' && live(u))
      b.addDp(u.ownerId, def.traitBb.cost + (u.mem.fangFireSharpenedSkillHit ? def.skill.bb.cost : 0));
  }, { owner: u });
  b.on('death', ({ unit, reason }) => {
    if (unit !== u || reason !== 'retreat') return;
    const talent = def.talents[0]?.bb;
    if (talent) b._fangFireSharpenedCard = (b._fangFireSharpenedCard ?? 0) + talent.value;
  }, { owner: u });
  b.on('tick', () => {
    const state = u.mem.fangFireSharpenedCast;
    if (state && (!live(u) || !u.canAct || u.s.flags.disarm || u.attackControlEpoch !== state.epoch)) {
      clearCast(b, u, state);
      if (u.skill.pending) u.skill.end('interrupted');
    }
  }, { owner: u });
}
