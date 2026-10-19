// SPDX-License-Identifier: GPL-3.0-or-later
// Held S2 damage ability. The owner FSM, mode buff and animation wrapper are separate.
import {makeDamageInfo} from '../damage.js';
import {APHRISSA_ID as ID, selectedAphrissaInputs, aphrissaNativeInputs} from './arkpedia-aphrissa-source.js';
import {aphrissaRayCells, APHRISSA_RAY_CONTRACT} from './arkpedia-aphrissa-ray.js';
import {canTargetEnemy} from '../targeting.js';
import {bodyOnTile} from '../body.js';

export const APHRISSA_S2_BEAM_CONTRACT = Object.freeze({
  scope: 'Held selected S2 periodic Arts damage ability with explicit owner-mode and release permission adapters.',
  mapping: 'The caller starts one real active selected skill account. World-time pulses begin at native preDelay, repeat at native triggerDelta, and stop before selected duration. Each pulse resamples the current S2 ray and distinct legal ground/air recipient lives, then owns one nonempty skill attack receipt. Hits use current ATK, selected atk_scale and the normal Arts/RES pipeline. A rejected release consumes its clock position without backlog. Detach, account/activation/mode departure or source retirement discards all unborn work.',
  limits: 'First-pulse phase, timeMode3 interpretation, duration boundary, target timing alias, path-cell/stable-ID ordering and same-tick recipient batch are explicit local mappings. The caller supplies channel-current and release-permission policies; this component does not infer native control interruption/resumption or restartFSM0 from numeric fields. postDelayChecker is retained as source evidence, not interpreted as extra damage time. The owner account/FSM, mode buff, facing/animation wrapper, talents, native particles/audio, S3 and public admission remain separate gates.',
  frameParity: false,
});
const present = unit => unit?.alive && unit.deployed && !unit.removed && !unit._removing;
const due = (now, at) => now + 1e-7 >= at;

export function prepareAphrissaS2Beam(b, u, {contract, channelCurrent, mayRelease} = {}) {
  if (contract !== APHRISSA_S2_BEAM_CONTRACT || typeof channelCurrent !== 'function'
    || typeof mayRelease !== 'function' || u.def.charId !== ID || u.deploySeq !== 0 || u.mem.aphrissaS2Beam)
    throw Error('Fresh selected Aphrissa S2, exact beam contract and explicit channel/release policies required');
  const record = selectedAphrissaInputs(u), n = aphrissaNativeInputs(), a = n.s2Beam, t = n.s2Target;
  if (record.index !== 1 || record.source.skillType !== 'MANUAL' || record.source.durationType !== 'NONE'
    || !(record.source.duration > 0) || !(record.bb.atk_scale > 0) || record.bb.interval !== a._triggerDelta
    || a._waitForAttackEvent !== 0 || a._timeMode !== 3 || a._affectedBySlowDown !== 0
    || a._preDelay !== .16699999570846558 || a._triggerDelta !== .5 || a._postDelayChecker !== .6669999957084656
    || a._damageType !== 2 || a._attackType !== 1 || a._atkScaleKey !== 'atk_scale'
    || a._cooldownKey !== 'duration' || a._selectTargetTiming !== 1 || a._selectTargetSource !== 1
    || a._allowNoTarget !== 1 || a._interruptAbilityOnDetach !== 1 || a._ignoreIfOwnerDead !== 0
    || a._interuptIfTargetDead !== 0 || a._ignorePalsyInterrupt !== 0 || a._enableUpdateCooldown !== 0
    || t._targetSide !== 2 || t._targetMotion !== 3 || t._limitTargetNum !== 0
    || t._ignoreTargetFree !== 0 || t._postFilter !== 0 || t._forceIgnoreCamouflage !== 0)
    throw Error('Changed original Aphrissa S2 beam inputs');
  const controller = new S2Beam(b, u, record, a, channelCurrent, mayRelease);
  u.mem.aphrissaS2Beam = controller;
  return controller;
}

class S2Beam {
  constructor(b, u, record, native, channelCurrent, mayRelease) {
    Object.assign(this, {b, u, record, native, channelCurrent, mayRelease, seq: null, account: null,
      spec: null, phase: null, lastActivation: 0, stopped: false, querying: false, ticking: false,
      accepting: false, handles: []});
  }
  valid() { return !this.stopped && !this.b.finished && present(this.u) && this.seq === this.u.deploySeq
    && this.u.mem.aphrissaS2Beam === this && this.u.skill === this.account && this.account?.spec === this.spec; }
  owns(p) { return !!p && this.valid() && this.phase === p && this.account.active
    && this.account.activations === p.activation; }
  current(p) {
    if (!this.owns(p) || this.querying) return false;
    this.querying = true;
    let current;
    try { current = this.channelCurrent() === true; }
    catch (error) { this.phase = null; throw error; }
    finally { this.querying = false; }
    return current && this.owns(p);
  }
  start() {
    if (!this.valid() || this.phase || this.querying || !this.account.active
      || !Number.isInteger(this.account.activations) || this.account.activations <= this.lastActivation
      || this.account._lastActivation !== this.account.activations) return false;
    const activation = this.account.activations;
    // Claim the account before calling the external mode adapter.
    this.lastActivation = activation;
    const p = this.phase = {activation, startedAt: this.b.time, next: this.native._preDelay,
      pulses: 0, batch: null};
    if (!this.current(p)) { if (this.phase === p) this.phase = null; return false; }
    return true;
  }
  detach() { this.phase = null; this.accepting = false; }
  legal(target) { return present(target) && target.side === 'enemy' && !target.hidden
    && canTargetEnemy(this.u, target, {canHitFly: true}) && (!target.s.flags.camou || !!target.blockedBy); }
  selection() {
    const ray = aphrissaRayCells(this.b, this.u, {contract: APHRISSA_RAY_CONTRACT, skill2: true, includePath: true});
    const targets = this.b.enemies.filter(target => this.legal(target)).map(target => ({target,
      index: ray.cells.findIndex(cell => bodyOnTile(target, cell.row, cell.col))}))
      .filter(row => row.index >= 0).sort((a, z) => a.index - z.index || a.target.id.localeCompare(z.target.id))
      .map(row => ({unit: row.target, life: row.target.deploySeq}));
    return {ray, targets};
  }
  choices() { return this.selection().targets; }
  permitted(p) {
    if (!this.current(p) || this.querying || this.u.hidden) return false;
    this.querying = true;
    let allowed;
    try { allowed = this.mayRelease() === true; }
    catch (error) { this.phase = null; throw error; }
    finally { this.querying = false; }
    return allowed && this.owns(p) && !this.u.hidden && this.current(p);
  }
  admit(targets) {
    const p = this.phase, batch = p?.batch;
    return this.accepting && !!batch && !batch.accepted && this.permitted(p) && p.batch === batch
      && targets.length > 0 && targets.length === batch.inputs.length
      && targets.every((target, i) => target === batch.inputs[i].unit
        && target.deploySeq === batch.inputs[i].life && this.legal(target));
  }
  release(targets, info) {
    if (!this.admit(targets)) return false;
    const p = this.phase, batch = p.batch;
    batch.accepted = true; batch.attackId = info.attackId; // Claim before damage hooks or reentrant forceAttack.
    for (const input of batch.inputs) {
      if (!this.permitted(p) || this.phase !== p || p.batch !== batch) break;
      if (input.unit.deploySeq !== input.life || !this.legal(input.unit)) continue;
      batch.delivering = input;
      try {
        const damage = batch.deliveringDamage = makeDamageInfo({amount: this.u.s.atk * this.record.bb.atk_scale * this.u.s.atkScaleMul,
          type: 'arts', isAttack: true, isSkill: true, attackId: info.attackId,
          applyWay: 'ranged', tags: ['aphrissa:s2']});
        this.b.dealDamage(this.u, input.unit, damage);
      } finally { batch.delivering = null; batch.deliveringDamage = null; }
    }
    return true;
  }
  tick() {
    const p = this.phase;
    if (this.ticking || !p) return;
    this.ticking = true;
    try {
      if (!this.current(p)) { if (this.phase === p) this.detach(); return; }
      const age = this.b.time - p.startedAt;
      if (due(age, this.record.source.duration)) { this.detach(); return; }
      while (this.current(p) && this.phase === p && due(age, p.next) && p.next < this.record.source.duration - 1e-7) {
        p.next += this.native._triggerDelta; p.pulses++; // Consume even an empty/disallowed pulse.
        if (!this.permitted(p)) continue;
        const selection = this.selection(), inputs = selection.targets;
        if(!this.current(p)||this.phase!==p)continue;
        if(this.u.mem.aphrissaLinePresentation)this.b._safe(()=>this.u.mem.aphrissaLinePresentation.onPulse(this,p,selection.ray),'aphrissa.linePresentation',this.u);
        if (!this.current(p) || this.phase !== p || !inputs.length) continue;
        const batch = p.batch = {inputs, accepted: false};
        this.accepting = true;
        try { this.b.forceAttack(this.u, inputs.map(input => input.unit)); }
        finally { this.accepting = false; if (p.batch === batch) p.batch = null; }
      }
    } finally { this.ticking = false; }
  }
  trait() {
    return {noAttack: true, attackDrivenSkill: true, isSkill: true, attack: 'ranged', dmgType: 'arts', projectile: 'none',
      canHitFly: true, groundOnly: false, allInRange: true, maxTargets: 9999, hits: 1, windup: 0,
      attackVisual: 'none', requiresAcceptedLaunch: true,
      acceptAreaAttack: (_b, _u, _p, targets) => this.admit(targets),
      launchAreaAttack: (_b, _u, _p, targets, info) => this.release(targets, info)};
  }
  install() {
    if (this.stopped || this.handles.length || this.u.deploySeq !== 0 || !this.u.skill)
      throw Error('Fresh Aphrissa S2 beam account installation required');
    this.account = this.u.skill; this.spec = this.account.spec;
    this.handles = [this.b.on('deploy', ({unit, move}) => {
      if (unit !== this.u || move) return;
      if (this.seq !== null) this.stop(); else this.seq = unit.deploySeq;
    }, {owner: this.u}), this.b.on('tick', () => {
      if (this.seq !== null && !this.valid()) this.stop(); else this.tick();
    }, {owner: this.u}), this.b.on('death', ({unit}) => { if (unit === this.u) this.stop(); }, {owner: this.u}),
    this.b.on('battleEnd', () => this.stop(), {owner: this.u})];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.detach();
    for (const handle of this.handles) this.b.off(handle);
    this.handles = [];
  }
}
