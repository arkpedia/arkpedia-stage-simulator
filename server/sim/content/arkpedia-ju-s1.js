// SPDX-License-Identifier: GPL-3.0-or-later
import {JU_ID, selectedJuInputs, juNativeInputs} from './arkpedia-ju-source.js';
import {JuOrdinaryAttacks, JU_ORDINARY_CONTRACT} from './arkpedia-ju-ordinary.js';
import {JuWounds, JU_WOUND_CONTRACT} from './arkpedia-ju-wounds.js';

export const JU_S1_CONTRACT = Object.freeze({
  scope: 'Selected Ju ordinary attacks, accepted wound talent and original automatic two-charge conditional S1; no S2 or public registration.',
  mapping: 'Before a new attack, the S1 selector independently chooses a legal target at or below half HP. One charge is spent at activation; its retained input uses the original Skill_1 marker and speed-fifteen projectile. The source account holds SP through that sampled attack cycle. An unfired interruption preserves the active account until its existing deadline, mapping stopAffectOnInterrupt0 without releasing a stale shot. Completion refunds one charge only for a lost input life before accepted projectile birth. Healthy inputs do not refund after a veto, and born projectiles never refund. Ordinary shots remain available when full S1 charges have no eligible target.',
  limitations: 'Native controller/attack-finished/SP-window/interruption ordering, selector aliases and source-invalid ATK fallback remain explicit local mappings rather than compiled-client/frame parity. S2, original art delivery, modules and native effects/audio are not admitted.',
  frameParity: false,
});
const present = u => u?.alive && u.deployed && !u.removed;
const due = (a, z) => a >= z - 1e-8;

export function verifyJuS1(n = juNativeInputs()) {
  const s = n.s1, a = n.s1Attack, filter = n.s1Selector, p = n.s1Projectile;
  if (s._playSkillBeginAnim !== 0 || s._allowSpRecoveryWhenAffecting !== 0
    || s._recoverSpIfTargetDead !== 1 || s._cancelIfSearchTargetFailed !== 0
    || s._stopAffectOnInterrupt !== 0 || s._earlySkillFinishAtAttackFinished !== 1
    || s._canSilenced !== 0 || s._canUseInAbnormalState !== 0
    || a._animKey !== 'Skill_1' || a._projectileKey !== 'projectile_chr_ju_s1'
    || a._selectTargetTiming !== 0 || a._waitForAttackEvent !== 1 || a._timeMode !== 0
    || a._affectedBySlowDown !== 0 || a._maxAnimScale !== 1 || a._useCachedAtkOnly !== 0
    || a._atkScaleKey !== 'atk_scale_s1' || a._waitForProjectileInvalid !== 0
    || filter._filerMaxHp !== 1 || filter._maxHpExcludeEqual !== 0 || filter._maxHpRatio !== .5
    || filter._filterMinHp !== 0 || filter._postFilter !== 27
    || p._managedBySource !== 0 || p._stopWhenSourceInvalid !== 0 || p._lifeTime !== 10
    || p._alwaysHitTraceTargetInTheEnd !== 1 || n.s1Movement._speed !== 15)
    throw Error('Changed original Ju S1 inputs');
}

export class JuSkillOne extends JuOrdinaryAttacks {
  constructor(b, u, wounds, {contract} = {}) {
    if (contract !== JU_S1_CONTRACT || selectedJuInputs(u).index !== 0)
      throw Error('Original selected Ju S1 and exact contract required');
    super(b, u, {contract: JU_ORDINARY_CONTRACT, mayBegin: () => true});
    verifyJuS1(); this.wounds = wounds; this.reservation = null; this.startingInput = null; this.finishing = false;
    this.mayBegin = () => !this.reservation?.interrupted;
    this.skillShot = Object.freeze({clip: 'Skill_1', scale: this.record.bb.atk_scale_s1,
      projectileSpeed: 15, isSkill: true, tag: 'ju:s1'});
  }
  skillChoices() { return super.choices({hpAtMost: .5}); }
  choices() {
    if (this.u.skill.ready && !this.u.skill.active) {
      const candidates = this.skillChoices(); if (candidates.length) return candidates;
    }
    return super.choices();
  }
  canStart() {
    return this.valid() && this.u.canAct && !this.u.s.flags.disarm && !this.u.skill.active
      && !this.phase && due(this.b.time, this.bornUntil) && this.u.atkCd <= 1e-8 && this.skillChoices().length > 0;
  }
  canCast() { return !!this.startingInput && this.canStart(); }
  begin(target) {
    if (this.u.skill.ready && this.canStart()) {
      const input = this.skillChoices()[0];
      this.startingInput = {target: input, life: input.deploySeq};
      try { this.u.skill.activate('source-auto'); } finally { this.startingInput = null; }
      return;
    }
    super.begin(target);
  }
  startSkill() {
    if (!this.valid() || !this.u.skill.active) return;
    const input = this.startingInput;
    if (!input) throw Error('Ju S1 requires its captured activation input');
    const {target, life} = input;
    super.begin(target, this.skillShot);
    const p = this.phase;
    p.life = life;
    this.reservation = {phase: p, activation: this.u.skill.activations, sourceLife: this.seq,
      target, life, interrupted: false,
      endsAt: this.b.time + p.untilAge / p.speed};
  }
  admit(targets) {
    if (this.phase?.shot.isSkill && (!this.u.skill.active || !this.u.skill.pending
      || this.reservation?.activation !== this.u.skill.activations || this.reservation?.interrupted)) return false;
    return super.admit(targets);
  }
  finishSkill(reason, refund = false) {
    const reservation = this.reservation;
    if (reservation && reservation.activation !== this.u.skill.activations) return;
    this.finishing = true;
    try {
      if (this.u.skill.active) this.u.skill.end(reason);
      if (refund && this.valid()) this.u.skill.addCharge(1);
    } finally { this.finishing = false; this.reservation = null; }
  }
  completeReservation(reason) {
    const r = this.reservation;
    if (!r || !this.valid()) return;
    const lost = !present(r.target) || r.target.deploySeq !== r.life;
    this.finishSkill(reason, !r.phase.accepted && lost);
  }
  completed(p) { if (p.shot.isSkill && this.reservation?.phase === p) this.completeReservation('attack-finished'); }
  interrupted(p) {
    if (p?.shot.isSkill && this.reservation?.phase === p) this.reservation.interrupted = true;
  }
  skillEnded() {
    if (this.finishing) return;
    this.reservation = null;
    if (this.phase?.shot.isSkill) this.phase = null;
    if (this.valid()) this.idle();
  }
  tick() {
    if (this.valid() && this.reservation?.interrupted && due(this.b.time, this.reservation.endsAt)) {
      this.completeReservation('interrupted-cycle-finished');
      if (this.valid()) this.idle();
    }
    super.tick();
  }
  spec() { return {kind: 'instant', silenceable: false, trigger: {rule: 'NEVER'}, flags: {noSp: true}, holdSpWhileActive: true,
    attack: {}, completeOnAttack: false, pendingText: 'Skill active',
    canActivate: () => this.canCast(), onStart: () => this.startSkill(), onEnd: () => this.skillEnded()}; }
  install() { this.wounds.install(); super.install(); }
  stop() { super.stop(); this.reservation = null; this.wounds.stop(); }
}

export function prepareJuS1(b, u, {contract} = {}) {
  if (contract !== JU_S1_CONTRACT || u.def.charId !== JU_ID || u.deploySeq !== 0 || u.mem.ju)
    throw Error('Fresh selected Ju S1 and exact controller contract required');
  const wounds = new JuWounds(b, u, {contract: JU_WOUND_CONTRACT});
  const controller = new JuSkillOne(b, u, wounds, {contract}); u.mem.ju = controller;
  return {record: controller.record, wounds, controller, kit: {install: null, talents: [],
    trait: controller.trait(), skill: controller.spec()}};
}
