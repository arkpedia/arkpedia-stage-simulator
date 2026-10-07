// SPDX-License-Identifier: GPL-3.0-or-later
import { THORNS_OPERATORS } from '../../../shared/arkpedia/thorns-operators.js';
import evidence from '../../../data/arkpedia-thorns-prefabs.json' with { type: 'json' };
import { resolveHit } from '../ai.js';
import { absoluteRangeKeys, canTargetEnemy, sortEnemyTargets } from '../targeting.js';
import { bodyOnTile } from '../body.js';
import { frontOf } from '../dir.js';

const ID = 'char_293_thorns';
const live = u => u?.alive && u.deployed && !u.hidden;
const isS2 = u => u.skill.active && u.skill.id === 'skchr_thorns_2';
const isS3 = u => u.skill.active && u.skill.id === 'skchr_thorns_3';
const combat = (u, e) => e.blockedBy === u || bodyOnTile(e, u.tileR, u.tileC)
  || bodyOnTile(e, ...frontOf(u.tileR, u.tileC, u.dir));
const model = u => evidence.originalModels[ID][isS3(u) || !['UP', 'LEFT'].includes(u.dir) ? 'Front' : 'Back'];
const rate = (u, melee) => Math.min(melee ? 1.1 : 1, u.s.aspd / 100);
const clip = u => isS3(u) ? 'Skill2_2' : u.mem.thornsCombat ? 'Attack_1' : 'Attack_2';
const single = p => ({ ...p, hits: 1, hitsFn: null, chain: null, splashRadius: 0, dmgMul: null });

function sourceWindup(b, u, targets) {
  u.mem.thornsCombat = combat(u, targets[0]);
  const animation = clip(u), speed = rate(u, u.mem.thornsCombat);
  u.mem.thornsAttackUntil = b.time + model(u).durations[animation] / speed;
  u.mem.thornsAttackControlEpoch = u.attackControlEpoch;
  u.mem.thornsIdleAt = null;
  // The native conditional buff disables while in Attack/Combat state. Its
  // exact C# state-exit phase is not recovered; this adapter explicitly holds
  // that state through the source clip, then waits the exact restoreDelay2.
  b.removeBuff(u, 'thorns:idle-regen');
  return model(u).hits[animation][0] / speed;
}
function sourceLaunch(b, u, p, target, info) {
  if (!canTargetEnemy(u, target, p)) return;
  const melee = combat(u, target), full = isS3(u);
  const hit = { ...single(p), atkScale: (p.atkScale ?? 1) * (melee || full ? 1 : .8),
    applyWay: melee ? 'melee' : 'ranged' };
  if (melee) resolveHit(b, u, hit, target, info, target.x, target.y);
  else b.addProjectile({ from: u, source: u, target, speed: 10, maxAge: 10, visual: 'bolt',
    data: { arkpediaTrackedVisual: true }, onHit: c => {
      if (c.target && canTargetEnemy(u, c.target, p)) resolveHit(b, u, hit, c.target, info, c.x, c.y);
    } });
}
function startS2Form(b, u) {
  const seq = u.deploySeq, activation = u.skill.activations;
  u.mem.regularFormVisual = { clip: 'Skill1_1', loop: false };
  b.after(model(u).durations.Skill1_1, () => {
    if (live(u) && u.deploySeq === seq && isS2(u) && u.skill.activations === activation)
      u.mem.regularFormVisual = { clip: 'Skill1_2', loop: true };
  }, { owner: u });
}
function endS2Form(b, u, reason) {
  u.mem.thornsCounterToken = null;
  if (!live(u) || ['death', 'retreat'].includes(reason)) { u.mem.regularFormVisual = null; return; }
  const seq = u.deploySeq, duration = model(u).durations.Skill1_3;
  u.mem.regularFormVisual = { clip: 'Skill1_3', loop: false };
  b.addBuff(u, { key: 'thorns:form-end', source: u, duration, flags: { disarm: true } });
  b.after(duration, () => { if (u.deploySeq === seq && !u.skill.active) u.mem.regularFormVisual = null; }, { owner: u });
}
function counterTargets(b, u) {
  const keys = absoluteRangeKeys(evidence.ranges['3-1'], u.tileR, u.tileC, u.dir);
  const list = b.enemiesInKeys(keys, u, { canHitFly: true });
  sortEnemyTargets(b, u, list);
  return list.slice(0, u.skill.bb.max_target);
}
function sourceCounter(b, u) {
  if (!live(u) || !isS2(u) || !u.canAct || u.s.flags.disarm
    || b.time + 1e-9 < u.mem.thornsCounterReadyAt || u.mem.thornsCounterToken) return;
  const token = {}, seq = u.deploySeq, activation = u.skill.activations, control = u.attackControlEpoch;
  u.mem.thornsCounterToken = token;
  // Original _cooldownKey selects .6/.75/.8 independently of ASPD. The exact
  // native resetCdStrategy1 lifecycle is bounded here to accepted cast start.
  u.mem.thornsCounterReadyAt = b.time + u.skill.bb.cooldown;
  const valid = () => live(u) && isS2(u) && u.skill.activations === activation && u.deploySeq === seq
    && u.mem.thornsCounterToken === token && u.canAct && !u.s.flags.disarm && u.attackControlEpoch === control;
  let cancelled = false;
  const watch = b.every(b.dt, () => { if (!valid()) cancelled = true; }, { owner: u });
  b.after(.5, () => {
    watch.cancel();
    if (!cancelled && valid()) {
      const targets = counterTargets(b, u), attackId = ++b._attackSeq;
      // This extra MultiMeleeAttack has no animation event and _preDelay.5.
      // It is not an ordinary Attack/Combat state, so it does not reset T2.
      const p = { ...single(u.profile), attack: 'melee', applyWay: 'melee', atkScale: .8,
        canHitFly: true, onEachHit: u.profile.onEachHit };
      for (const e of targets) if (canTargetEnemy(u, e, p))
        resolveHit(b, u, p, e, { isSkill: true, attackId }, e.x, e.y);
      if (targets.length) { u.stats.attacks++; b.emit('attack', { attacker: u, targets, isSkill: true }); }
    }
    if (u.mem.thornsCounterToken === token) u.mem.thornsCounterToken = null;
  }, { owner: u });
}
function syncRegen(b, u, t) {
  if (!t || !live(u)) { b.removeBuff(u, 'thorns:idle-regen'); return; }
  const activeState = u.mem.thornsAttackUntil > b.time + 1e-9
    && u.mem.thornsAttackControlEpoch === u.attackControlEpoch;
  if (activeState) { u.mem.thornsIdleAt = null; b.removeBuff(u, 'thorns:idle-regen'); return; }
  if (u.mem.thornsIdleAt == null) u.mem.thornsIdleAt = u.mem.thornsAttackControlEpoch === u.attackControlEpoch
    ? Math.min(b.time, u.mem.thornsAttackUntil) : b.time;
  if (b.time + 1e-9 >= u.mem.thornsIdleAt + t.delay) {
    if (!u.findBuff('thorns:idle-regen')) b.addBuff(u, { key: 'thorns:idle-regen', source: u,
      mods: { hpRegenRatio: t.hp_recovery_per_sec_by_max_hp_ratio } });
  } else b.removeBuff(u, 'thorns:idle-regen');
}
export function customizeThornsKit({ battle: b, id, def, unit: u, kit }) {
  if (!THORNS_OPERATORS[id]) return;
  kit.install = null;
  const s = def.skill, bb = s.bb;
  kit.trait = { install: null, attack: 'ranged', projectile: 'bolt', dmgType: 'phys', hits: 1, hitsFn: null,
    chain: null, splashRadius: 0, maxTargets: 1, maxTargetsByBlock: false, hitAllBlocked: false,
    allInRange: false, dmgMul: null, canHitFly: true, retargetOnRelease: true, interruptOnSkillChange: true,
    windup: sourceWindup, launchAttack: sourceLaunch,
    attackVisual: (_b, unit) => clip(unit) };
  if (s.id === 'skcom_atk_up[3]') kit.skill = { kind: 'duration', duration: s.duration, mods: { atkPct: bb.atk }, attack: {} };
  else if (s.id === 'skchr_thorns_2') kit.skill = { kind: 'duration', duration: s.duration,
    mods: { atkPct: bb.atk, defPct: bb.def }, attack: { noAttack: true },
    onStart: () => {
      // Native switch_mode_restart_fsm leaves the ordinary attack/combat
      // state; its abandoned clip must not hold the regeneration timer.
      u.mem.thornsAttackUntil = b.time; u.mem.thornsIdleAt = b.time;
      u.mem.thornsAttackControlEpoch = u.attackControlEpoch;
      u.mem.thornsCounterReadyAt = b.time; startS2Form(b, u);
    },
    onEnd: ({ reason }) => endS2Form(b, u, reason) };
  else kit.skill = { kind: 'duration', duration: s.duration, mods: {}, attack: {}, targeting: { rangeGrid: s.rangeGrid },
    onStart: () => {
      const enhanced = u.skill.activations > 1;
      u.mem.thornsEnhanced = enhanced;
      u.mem.regularAttackFacing = 'Front';
      b.addBuff(u, { key: 'thorns:s3', source: u, mods: { atkPct: enhanced ? bb['thorns_s_3[b].atk'] : bb.atk,
        aspd: enhanced ? bb['thorns_s_3[b].attack_speed'] : bb.attack_speed } });
      if (enhanced) u.skill.timeLeft = Infinity;
    }, onEnd: () => { b.removeBuff(u, 'thorns:s3'); u.mem.regularAttackFacing = null; } };
  kit.skill.id = s.id; kit.skill.name = s.name;
}
export function installThorns({ battle: b, unit: u, def }) {
  if (def.charId !== ID) return;
  u.mem.thornsAttackUntil = -Infinity; u.mem.thornsAttackControlEpoch = u.attackControlEpoch;
  u.mem.thornsIdleAt = b.time; u.mem.thornsCounterReadyAt = b.time; u.mem.thornsCounterToken = null;
  const poison = def.talents.find(v => v.bb['damage[normal]'] != null)?.bb;
  const regen = def.talents.find(v => v.bb.hp_recovery_per_sec_by_max_hp_ratio != null)?.bb;
  if (poison) u.profile.onEachHit = (battle, source, target) => {
    if (!target.alive) return;
    // Each source owns its own fixed-value poison. Reapplication extends the
    // lifetime without resetting the existing one-second trigger cadence.
    battle.addBuff(target, { key: `thorns:poison:${source.id}`, source, duration: poison.duration,
      refresh: 'extend', interval: 1, onTick: () => {
        const ranged = target.def.applyWay === 'RANGED' || target.def.applyWay === 'ranged';
        battle.dealDamage(source, target, { amount: poison[ranged ? 'damage[ranged]' : 'damage[normal]'],
          type: 'arts', canDodge: false, isAttack: false, isSkill: false, applyWay: 'none', tags: ['thorns:poison'] });
      } });
  };
  b.on('damaged', ({ source, target, dmg, type }) => {
    if (target === u && source?.side === 'enemy' && dmg?.isAttack && (!dmg.nativeAttackType || dmg.nativeAttackType === 'NORMAL') && type !== 'element') sourceCounter(b, u);
  }, { owner: u });
  b.on('tick', () => syncRegen(b, u, regen), { owner: u });
  const cleanup = ({ unit }) => { if (unit !== u) return; u.mem.thornsCounterToken = null;
    u.mem.regularFormVisual = null; u.mem.regularAttackFacing = null; b.removeBuff(u, 'thorns:idle-regen'); b.removeBuff(u, 'thorns:s3'); };
  b.on('death', cleanup, { owner: u }); b.on('retreat', cleanup, { owner: u });
}
