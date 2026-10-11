// SPDX-License-Identifier: GPL-3.0-or-later
import { BAGPIPE_OPERATORS } from '../../../shared/arkpedia/bagpipe-operators.js';
import evidence from '../../../data/arkpedia-bagpipe-prefabs.json' with { type: 'json' };
import { acquireTargets, resolveHit } from '../ai.js';
import { canTargetEnemy, sortEnemyTargets } from '../targeting.js';

const ID = 'char_222_bpipe';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.originalModels[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const playback = (u, cap = Infinity) => Math.min(cap, u.s.aspd / 100);
const single = p => ({ ...p, hits: 1, hitsFn: null, chain: null, splashRadius: 0, dmgMul: null });
const charged = u => u.skill.pending && u.skill.id === 'skchr_bpipe_2';
const triple = u => u.skill.active && u.skill.id === 'skchr_bpipe_3';
const clip = (u, skill) => skill === 2 ? u.dir === 'DOWN' && model(u).hits.Skill_Down
  ? 'Skill_Down' : 'Skill' : skill === 3 ? u.dir === 'DOWN' && model(u).hits.Skill_2_Loop_Down
    ? 'Skill_2_Loop_Down' : 'Skill_2_Loop' : u.dir === 'DOWN' && model(u).hits.Attack_Loop_Down
      ? 'Attack_Loop_Down' : 'Attack_Loop';

/** Selected native deck buffs apply even while Bagpipe remains in the squad. */
export function installBagpipeSquad({ battle: b, records }) {
  const bb = records[ID]?.talents.find(t => t.bb.sp != null)?.bb;
  if (!bb) return;
  b.on('deploy', ({ unit: u }) => {
    if (u.side === 'ally' && u.kind === 'op' && records[u.defId]
      && u.def.profession === 'PIONEER') u.skill.gainSp(bb.sp, 'talent');
  });
}

function criticalHit(b, u, p, target, info) {
  if (!canTargetEnemy(u, target, p)) return;
  const bb = u.def.talents.find(t => t.bb.prob != null)?.bb;
  // Original ON_CALCULATE_DAMAGE, rather than one beforeAttack roll for the
  // entire two/three-hit family. Splash output has an explicit duplicate lock.
  const hook = bb && b.on('hit', ctx => {
    if (ctx.source !== u || ctx.target !== target || !ctx.dmg.isAttack
      || ctx.dmg.attackId !== info.attackId || ctx.dmg.cancel
      || ctx.dmg.tags?.includes('bagpipe:duplicate-lock') || b.rng() >= bb.prob) return;
    ctx.dmg.amount *= bb.atk_scale;
    // SplashDamage SOURCE/exclude TARGET supplies no serialized range/count.
    // Primary text establishes one additional victim; owner-current-range and
    // ordinary priority, with the same selected spell scale, are bounded maps.
    const candidates = b.enemiesInKeys(u.rangeKeys, u, p).filter(e => e !== target);
    sortEnemyTargets(b, u, candidates, p.priority ?? null);
    const extra = candidates[0];
    if (extra) b.dealDamage(u, extra, { amount: ctx.dmg.amount, type: 'phys', applyWay: 'melee',
      isAttack: true, isSplash: true, isSkill: info.isSkill, attackId: info.attackId,
      tags: ['bagpipe:duplicate-lock'] });
  });
  try { resolveHit(b, u, single(p), target, info, target.x, target.y); }
  finally { if (hook) b.off(hook); }
}

function sourceWindup(b, u) {
  if (u.mem.regularFormVisual?.clip === 'Attack_End') u.mem.regularFormVisual = null;
  const skill = charged(u) ? 2 : triple(u) ? 3 : 0;
  const currentClip = clip(u, skill), rate = playback(u, skill ? Infinity : 1);
  const opening = !skill && u.mem.bagpipeOpening;
  const beginRate = playback(u);
  u.mem.bagpipeOpeningVisual = opening;
  if (opening) u.mem.bagpipeOpening = false;
  u.mem.bagpipeClip = currentClip;
  u.mem.bagpipeRate = rate;
  u.mem.bagpipeBeginDuration = opening ? model(u).durations.Attack_Begin / beginRate : 0;
  u.mem.bagpipeEngaged = true;
  u.mem.bagpipeAnimationEnd = b.time + u.mem.bagpipeBeginDuration
    + model(u).durations[currentClip] / rate;
  if (skill === 2) {
    const key = 'bagpipe:s2-no-sp';
    b.addBuff(u, { key, source: u, flags: { noSp: true } });
    u.mem.bagpipeCast = { seq: u.deploySeq, activation: u.skill.activations,
      epoch: u.attackControlEpoch, key };
  }
  return u.mem.bagpipeBeginDuration + model(u).hits[currentClip][0] / rate;
}
function sourceVisual(_b, u) {
  return u.mem.bagpipeOpeningVisual ? { begin: 'Attack_Begin', loop: u.mem.bagpipeClip,
    beginDuration: u.mem.bagpipeBeginDuration } : u.mem.bagpipeClip;
}
function clearCast(b, u, token) {
  if (!token || u.mem.bagpipeCast !== token) return;
  b.removeBuff(u, token.key); u.mem.bagpipeCast = null;
}
function launch(b, u, p, target, info) {
  if (!canTargetEnemy(u, target, p)) return;
  const charge = info.isSkill && u.skill.id === 'skchr_bpipe_2';
  const count = charge ? 2 : info.isSkill && u.skill.id === 'skchr_bpipe_3' ? 3 : 1;
  if (charge) u.mem.bagpipeEmitted = info.attackId;
  const token = charge ? u.mem.bagpipeCast : null;
  const seq = u.deploySeq, activation = u.skill.activations, epoch = u.attackControlEpoch;
  const victimSeq = target.deploySeq;
  const times = model(u).hits[u.mem.bagpipeClip], rate = u.mem.bagpipeRate;
  criticalHit(b, u, p, target, info);
  if (count === 1) return;
  const valid = () => live(u) && u.deploySeq === seq && u.skill.activations === activation
    && u.attackControlEpoch === epoch && u.canAct && !u.s.flags.disarm;
  let canceled = false;
  const watch = b.every(b.dt, () => {
    if (!valid()) { canceled = true; if (token) clearCast(b, u, token); }
  }, { owner: u });
  for (let i = 1; i < count; i++) b.after((times[i] - times[0]) / rate, () => {
    if (!canceled && valid() && target.deploySeq === victimSeq && canTargetEnemy(u, target, p))
      criticalHit(b, u, p, target, info);
    if (i === count - 1) { watch.cancel(); if (token) clearCast(b, u, token); }
  }, { owner: u });
}

export function customizeBagpipeKit({ battle: b, id, def, unit: u, kit }) {
  if (!BAGPIPE_OPERATORS[id]) return;
  kit.install = null; kit.talents = [];
  kit.trait = { install: null, attack: 'melee', projectile: 'none', dmgType: 'phys', canHitFly: false,
    maxTargets: 1, maxTargetsByBlock: false, hitAllBlocked: false, allInRange: false, rangeAoe: false,
    hits: 1, hitsFn: null, chain: null, splashRadius: 0, dmgMul: null,
    interruptOnSkillChange: true, retargetOnRelease: true,
    windup: sourceWindup, attackVisual: sourceVisual, launchAttack: launch };
  const s = def.skill, bb = s.bb;
  if (s.id === 'skchr_bpipe_2') kit.skill = { kind: 'instant', attack: {
    atkScale: bb.atk_scale, retargetOnRelease: false,
    afterAttack: (_b, unit, targets, meta) => {
      if (unit.mem.bagpipeEmitted === meta.attackId) return;
      clearCast(b, unit, unit.mem.bagpipeCast);
      if (!targets.some(e => e.alive) && meta.inputTargets.length
        && meta.inputTargets.every(e => !e.alive)) unit.skill.addCharge(1);
    } } };
  else kit.skill = { kind: 'duration', duration: s.duration,
    ...(s.id === 'skchr_bpipe_3' ? { attack: {} } : {}),
    mods: s.id === 'skchr_bpipe_3'
      ? { atkPct: bb.atk, defPct: bb.def, batPct: bb.base_attack_time, blockCnt: bb.block_cnt }
      : { atkPct: bb.atk, aspd: bb.attack_speed },
    onStart: () => { if (s.id === 'skchr_bpipe_3') u.mem.bagpipeOpening = true; },
    onEnd: () => { if (s.id === 'skchr_bpipe_3') u.mem.bagpipeOpening = true; } };
  kit.skill.id = s.id; kit.skill.name = s.name;
}

export function installBagpipe({ battle: b, unit: u, def }) {
  if (!BAGPIPE_OPERATORS[def.charId]) return;
  u.mem.bagpipeOpening = true; u.mem.bagpipeEngaged = false; u.mem.bagpipeCast = null;
  b.on('kill', ({ killer, victim }) => {
    if (killer === u && victim.side === 'enemy') b.addDp(u.ownerId, def.traitBb.cost);
  }, { owner: u });
  b.on('tick', () => {
    const token = u.mem.bagpipeCast;
    if (token && (!live(u) || u.attackControlEpoch !== token.epoch)) clearCast(b, u, token);
    if (u.mem.bagpipeEngaged && !u.skill.pending && !triple(u)
      && b.time >= u.mem.bagpipeAnimationEnd && !acquireTargets(b, u, u.profile).length) {
      u.mem.bagpipeEngaged = false; u.mem.bagpipeOpening = true;
      u.mem.regularFormVisual = { clip: 'Attack_End', loop: false };
      const seq = u.deploySeq;
      b.after(model(u).durations.Attack_End / playback(u), () => {
        if (u.deploySeq === seq && !u.mem.bagpipeEngaged) u.mem.regularFormVisual = null;
      }, { owner: u });
    }
  }, { owner: u });
}
