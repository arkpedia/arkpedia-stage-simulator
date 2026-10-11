// SPDX-License-Identifier: GPL-3.0-or-later
import { ZUOLE_OPERATORS } from '../../../shared/arkpedia/zuole-operators.js';
import evidence from '../../../data/arkpedia-zuole-prefabs.json' with { type: 'json' };
import { acquireTargets, resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { applyHpLoss, makeDamageInfo } from '../damage.js';

const ID = 'char_4121_zuole';
const S1 = 'skchr_zuole_1', S2 = 'skchr_zuole_2', S3 = 'skchr_zuole_3';
const live = u => u?.alive && u.deployed && !u.hidden;
const model = u => evidence.originalModels[ID][['UP', 'LEFT'].includes(u.dir) ? 'Back' : 'Front'];
const speed = (u, cap = Infinity) => Math.min(cap, u.s.aspd / 100);
const one = p => ({ ...p, hits: 1, hitsFn: null, chain: null, splashRadius: 0, dmgMul: null });
const second = u => u.skill.active && u.skill.id === S2;
function setMods(b, u, key, value) {
  if (!value) { b.removeBuff(u, key); return; }
  if (JSON.stringify(u.findBuff(key)?.mods) !== JSON.stringify(value)) b.addBuff(u, { key, source: u, mods: value });
}
function tenacity(b, u) {
  const t = u.def.talents.find(t => t.bb.min_attack_speed != null)?.bb;
  if (!live(u) || !t) { b.removeBuff(u, 'zuole:tenacity'); return; }
  const ratio = Math.max(0, Math.min(1, (1 - u.hpRatio) / (1 - t.min_hp_ratio)));
  setMods(b, u, 'zuole:tenacity', { aspd: t.min_attack_speed * ratio,
    spRecoveryFlat: t.min_sp_recovery_per_sec * ratio });
}
function barrier(b, u, key, amount, cap, duration = Infinity) {
  const old = u.findBuff(key);
  if (old) {
    // Dynamic shield addition reads remaining value; it never refills the
    // amount already consumed and never restarts an existing decay cadence.
    old.shield = Math.max(0, Math.min(cap, old.shield + amount));
    if (duration !== Infinity) {
      old.timeLeft = Math.max(old.timeLeft, duration);
      old.duration = Math.max(old.duration, duration);
    }
    u.markDirty();
    return old;
  }
  return b.addBuff(u, { key, source: u, shield: Math.max(0, Math.min(cap, amount)), duration,
    ...(key === 'zuole:s2-barrier' ? { interval: 1, onTick: ({ buff }) => {
      if (second(u)) return;
      buff.shield = Math.max(0, buff.shield + u.def.skill.bb.shield_decrease);
      u.markDirty();
      if (buff.shield <= 0) b.removeBuff(u, buff);
    } } : {}) });
}
function clearS1(b, u, token) {
  if (!token || u.mem.zuoleS1 !== token) return;
  b.removeBuff(u, 'zuole:s1-no-sp');
  u.mem.zuoleS1 = null;
}
function clearS3(b, u, token, presentation = true) {
  if (!token || u.mem.zuoleS3 !== token) return;
  token.watch?.cancel();
  b.removeBuff(u, 'zuole:s3-lock');
  u.mem.zuoleS3 = null;
  u.mem.zuoleOpening = true;
  if (presentation) u.mem.regularFormVisual = null;
}
function sourceWindup(b, u) {
  if (u.mem.regularFormVisual?.clip === 'Attack_End' || u.mem.regularFormVisual?.clip === 'Skill_1_End')
    u.mem.regularFormVisual = null;
  const charge = u.skill.pending && u.skill.id === S1;
  const clip = charge ? 'Skill_1_Loop' : second(u) ? 'Skill_2_Loop' : 'Attack';
  const rate = speed(u, second(u) ? 1 : Infinity);
  const opening = charge || !second(u) && u.mem.zuoleOpening;
  const begin = charge ? 'Skill_1_Begin' : 'Attack_Begin';
  const beginDuration = opening ? model(u).durations[begin] / speed(u) : 0;
  u.mem.zuoleOpening = false;
  u.mem.zuoleAttackVisual = opening ? { begin, loop: clip, beginDuration } : clip;
  u.mem.zuoleEngaged = true;
  u.mem.zuoleAnimationEnd = b.time + beginDuration + model(u).durations[clip] / rate;
  if (charge) {
    const bb = u.def.skill.bb, ratio = u.hpRatio;
    b.addBuff(u, { key: 'zuole:s1-no-sp', flags: { noSp: true } });
    const token = { seq: u.deploySeq, activation: u.skill.activations, epoch: u.attackControlEpoch,
      count: ratio < bb.hp_ratio_tripple ? 3 : ratio < bb.hp_ratio_double ? 2 : 1, rate };
    u.mem.zuoleS1 = token;
    // Source Begin+Loop define the explicitly bounded affect window. The
    // analytical calculator's fixed1.2 lock estimate is not a native FSM.
    const affect = beginDuration + model(u).durations[clip] / rate;
    u.atkCd = Math.max(u.atkCd, affect);
    b.after(affect, () => {
      if (u.mem.zuoleS1 !== token) return;
      clearS1(b, u, token);
      if (live(u) && u.attackControlEpoch === token.epoch) {
        u.mem.regularFormVisual = { clip: 'Skill_1_End', loop: false };
        b.addBuff(u, { key: 'zuole:s1-end', flags: { disarm: true } });
        b.after(model(u).durations.Skill_1_End / token.rate, () => {
          b.removeBuff(u, 'zuole:s1-end');
          if (u.mem.regularFormVisual?.clip === 'Skill_1_End') u.mem.regularFormVisual = null;
        }, { owner: u });
      }
    }, { owner: u });
  }
  return beginDuration + model(u).hits[clip][0] / rate;
}
function launch(b, u, p, target, info) {
  if (!canTargetEnemy(u, target, p)) return;
  const charge = info.isSkill && u.skill.id === S1;
  const token = charge ? u.mem.zuoleS1 : null;
  if (charge) u.mem.zuoleS1Emitted = info.attackId;
  resolveHit(b, u, one(p), target, info, target.x, target.y);
  if (!token || token.count === 1) return;
  const victimSeq = target.deploySeq;
  const valid = () => live(u) && u.mem.zuoleS1 === token && u.deploySeq === token.seq
    && u.skill.activations === token.activation && u.attackControlEpoch === token.epoch
    && u.canAct && !u.s.flags.disarm;
  // ConditionalAbility samples HP before casting. Every extra spell retains
  // that branch and the first release victim even if trait healing raises HP.
  for (let i = 1; i < token.count; i++) b.after(.10000000149011612 * i / token.rate, () => {
    if (valid() && target.deploySeq === victimSeq && canTargetEnemy(u, target, p))
      resolveHit(b, u, one(p), target, info, target.x, target.y);
  }, { owner: u });
}
function thirdTargets(b, u) {
  const keys = absoluteRangeKeys(evidence.ranges['3-2'], u.tileR, u.tileC, u.dir);
  const p = { canHitFly: false };
  const candidates = b.enemiesInKeys(keys, u, p);
  sortEnemyTargets(b, u, candidates);
  return candidates.slice(0, 3);
}
function thirdCast(b, u) {
  const bb = u.def.skill.bb, m = model(u);
  b.addBuff(u, { key: 'zuole:s3-lock', flags: { noSp: true, disarm: true } });
  const token = { seq: u.deploySeq, activation: u.skill.activations,
    epoch: u.attackControlEpoch, attackId: ++b._attackSeq, wave: 0 };
  u.mem.zuoleS3 = token;
  u.mem.regularFormVisual = { clip: 'Skill_3', loop: false };
  const valid = () => live(u) && u.mem.zuoleS3 === token && u.deploySeq === token.seq
    && u.skill.activations === token.activation && u.attackControlEpoch === token.epoch && u.canAct;
  token.watch = b.every(b.dt, () => { if (!valid()) clearS3(b, u, token); }, { owner: u });
  // Original timeMode1 is absolute, with seven literal OnAttack events on
  // both facings. One event increments spell_times once, never per victim.
  for (let i = 0; i < m.hits.Skill_3.length; i++) b.after(m.hits.Skill_3[i], () => {
    if (!valid()) { clearS3(b, u, token); return; }
    token.wave = i + 1;
    const targets = thirdTargets(b, u), last = token.wave >= bb.times;
    for (const target of targets) {
      const hook = last && b.on('hit', ctx => {
        if (ctx.source === u && ctx.target === target && ctx.dmg.attackId === token.attackId
          && ctx.dmg.tags?.includes('zuole:s3') && !ctx.dmg.cancel)
          b.applyStatus(target, 'stun', { source: u, duration: bb.stun });
      });
      try { resolveHit(b, u, { ...one(u.profile), dmgType: 'phys', applyWay: 'melee',
        atkScale: bb.atk_scale * (last ? bb.last_atk_bonus : 1),
        tags: ['zuole:s3'] }, target, { isSkill: true, attackId: token.attackId }, target.x, target.y); }
      finally { if (hook) b.off(hook); }
    }
  }, { owner: u });
  b.after(m.durations.Skill_3, () => {
    if (valid()) { u.atkCd = 0; clearS3(b, u, token); }
    else clearS3(b, u, token);
  }, { owner: u });
}
function secondStart(b, u) {
  const bb = u.def.skill.bb;
  // Native PURE/NORMAL, noSP, skipModifierEvent and undeadable cut: preserve
  // direct cost semantics and fractional1HP floor without borrowing HPLOSS.
  applyHpLoss(b, u, u, Math.max(0, Math.min(u.hp * bb.hp_ratio, u.hp - Math.min(1, u.s.maxHp))),
    makeDamageInfo({ type: 'true', applyWay: 'none', isAttack: true, noSp: true, canDodge: false,
      tags: ['zuole:s2-cut'] }));
  barrier(b, u, 'zuole:s2-barrier', u.s.maxHp * bb.scale, u.s.maxHp * bb.max_scale);
  tenacity(b, u);
  b.addBuff(u, { key: 'zuole:s2-begin', flags: { disarm: true } });
  const seq = u.deploySeq;
  u.mem.regularFormVisual = { clip: 'Skill_2_Begin', loop: false };
  b.after(model(u).durations.Skill_2_Begin, () => {
    b.removeBuff(u, 'zuole:s2-begin');
    if (live(u) && u.deploySeq === seq && second(u))
      u.mem.regularFormVisual = { clip: 'Skill_2_Idle', loop: true };
  }, { owner: u });
}
function secondEnd(b, u, reason) {
  b.removeBuff(u, 'zuole:s2-begin');
  u.mem.zuoleOpening = true;
  if (reason === 'death' || reason === 'retreat' || !live(u)) { u.mem.regularFormVisual = null; return; }
  b.addBuff(u, { key: 'zuole:s2-end', flags: { disarm: true, noSp: true } });
  const seq = u.deploySeq;
  u.mem.regularFormVisual = { clip: 'Skill_2_End', loop: false };
  b.after(model(u).durations.Skill_2_End, () => {
    b.removeBuff(u, 'zuole:s2-end');
    if (u.deploySeq === seq && u.mem.regularFormVisual?.clip === 'Skill_2_End') u.mem.regularFormVisual = null;
  }, { owner: u });
}
export function customizeZuoleKit({ battle: b, id, def, unit: u, kit }) {
  if (!ZUOLE_OPERATORS[id]) return;
  kit.install = null; kit.talents = [];
  kit.trait = { install: null, attack: 'melee', projectile: 'none', dmgType: 'phys',
    noHeal: true, selfHeal: null, canHitFly: false, maxTargets: 1,
    maxTargetsByBlock: false, hitAllBlocked: false, allInRange: false, rangeAoe: false,
    hits: 1, hitsFn: null, chain: null, splashRadius: 0, dmgMul: null,
    retargetOnRelease: false, interruptOnSkillChange: true,
    windup: sourceWindup, attackVisual: (_b, unit) => unit.mem.zuoleAttackVisual, launchAttack: launch };
  const s = def.skill, bb = s.bb;
  if (s.id === S1) kit.skill = { kind: 'instant', canActivate: () => !u.mem.zuoleS1 && !u.s.flags.disarm,
    attack: { atkScale: bb.atk_scale, retargetOnRelease: true,
      afterAttack: (_b, unit, targets, meta) => {
        if (unit.mem.zuoleS1Emitted === meta.attackId) return;
        clearS1(b, unit, unit.mem.zuoleS1);
        if (!targets.some(e => e.alive) && meta.inputTargets.length
          && meta.inputTargets.every(e => !e.alive)) unit.skill.addCharge(1);
      } } };
  else if (s.id === S2) kit.skill = { kind: 'duration', duration: s.duration,
    mods: { atkPct: bb.atk, blockCnt: bb.block_cnt },
    attack: { retargetOnRelease: true, maxTargetsByBlock: true, allowZeroBlockTargetLimit: false },
    onStart: () => secondStart(b, u), onEnd: ({ reason }) => secondEnd(b, u, reason) };
  else kit.skill = { kind: 'instant', canActivate: () => !u.mem.zuoleS3 && u.canAct
    && !u.s.flags.disarm && thirdTargets(b, u).length > 0, onStart: () => thirdCast(b, u) };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installZuole({ battle: b, unit: u, def }) {
  if (!ZUOLE_OPERATORS[def.charId]) return;
  u.mem.zuoleOpening = true; u.mem.zuoleEngaged = false;
  u.mem.zuoleSeenControlEpoch = u.attackControlEpoch;
  u.mem.zuoleS1 = null; u.mem.zuoleS3 = null;
  b.on('deploy', ({ unit }) => {
    if (unit !== u) return;
    tenacity(b, u);
    // DB trigger cadence is not serialized. This explicit quarter-second
    // linear sampling follows the reviewed Musha bridge, anchored to birth.
    b.every(.25, () => tenacity(b, u), { owner: u });
  }, { owner: u });
  b.on('damaged', ({ source, target, dmg }) => {
    if (source !== u || !live(u) || target.side !== 'enemy' || !dmg.isAttack
      || ['element', 'elemental'].includes(dmg.type) || dmg.tags?.includes('HPLOSS')
      || dmg.tags?.some(t => t === 'inverse' || t === 'REFLECT' || t.endsWith(':inverse'))) return;
    // Accepted post-dodge/post-shield output is a bounded native-event bridge:
    // an absorbed0 receipt counts; a cancelled/dodged/nonattack one does not.
    const t = def.talents.find(t => t.bb.prob_1 != null)?.bb;
    const prob = t && (u.hpRatio < t.hp_ratio ? t.prob_2 : t.prob_1);
    if (u.mem.zuoleS3) barrier(b, u, 'zuole:s3-barrier', Math.abs(def.traitBb.value * def.skill.bb.shield_scale),
      u.s.maxHp * def.skill.bb.max_scale, def.skill.bb.shield_duration);
    else b.heal(u, u, def.traitBb.value, { self: true, ignoreHealFree: true });
    if (t && b.rng() < prob) u.skill.gainSp(t.sp, 'talent');
  }, { owner: u });
  b.on('tick', () => {
    if (u.mem.zuoleSeenControlEpoch !== u.attackControlEpoch) {
      u.mem.zuoleSeenControlEpoch = u.attackControlEpoch;
      u.mem.zuoleOpening = true;
    }
    const token = u.mem.zuoleS1;
    if (token && (!live(u) || token.epoch !== u.attackControlEpoch)) clearS1(b, u, token);
    if (!u.canAct) {
      u.mem.zuoleOpening = true;
      u.mem.regularFormVisual = null;
    }
    if (u.mem.zuoleEngaged && !u.mem.zuoleS1 && !u.mem.zuoleS3 && !second(u)
      && b.time >= u.mem.zuoleAnimationEnd && !acquireTargets(b, u, u.profile).length) {
      u.mem.zuoleEngaged = false; u.mem.zuoleOpening = true;
      u.mem.regularFormVisual = { clip: 'Attack_End', loop: false };
      const seq = u.deploySeq;
      b.after(model(u).durations.Attack_End / speed(u), () => {
        if (u.deploySeq === seq && !u.mem.zuoleEngaged) u.mem.regularFormVisual = null;
      }, { owner: u });
    }
  }, { owner: u });
  b.on('death', ({ unit }) => {
    if (unit !== u) return;
    clearS1(b, u, u.mem.zuoleS1); clearS3(b, u, u.mem.zuoleS3);
    u.mem.regularFormVisual = null;
  }, { owner: u });
}
