// SPDX-License-Identifier: GPL-3.0-or-later
// Held default-mode Arts attack. Owner skills/talents compose separately.
import evidence from '../../../data/arkpedia-native-operators/char_4229_aphris.json' with {type: 'json'};
import clocks from '../../../data/arkpedia-aphrissa-clocks.json' with {type: 'json'};
import {APHRISSA_ID as ID, selectedAphrissaInputs, aphrissaNativeInputs} from './arkpedia-aphrissa-source.js';
import {aphrissaRayCells, APHRISSA_RAY_CONTRACT} from './arkpedia-aphrissa-ray.js';
import {sourceAbilityDelta} from './arkpedia-slow-down.js';
import {canTargetEnemy} from '../targeting.js';
import {bodyOnTile} from '../body.js';

export const APHRISSA_ORDINARY_CONTRACT = Object.freeze({
  scope: 'Diagnostic default-mode original Arts line attack and attack receipts only; not a playable kit.',
  mapping: 'An explicit owner-mode predicate permits acquisition. Original Start holds the opening. Sampled BAT/interval playback is capped at the native maximum one; eligible elapsed time applies live slow_down once. The original OnAttack marker resamples the current diagnostic ray, captures distinct legal ground/air recipient lives, and owns one ordinary attack receipt. Recipient Arts hits use live ATK and the source 0.05-second stagger on the same ability clock. Captured recipients do not gain replacements or another range test after acceptance. Control, hiding, mode departure or source retirement cancels unborn work.',
  limits: 'Custom ray traversal, first-path-cell/stable-ID recipient order, retained batch, sampled cooldown/playback, initial birth and stagger clock are explicit local mappings. Compiled selectTargetTiming3, hit-order/frame semantics and default direction transitions are unverified. Relay ATK, RES aura, S1/S2/S3, particles/audio, modules and public artwork/admission remain separate gates.',
  frameParity: false,
});
const present = unit => unit?.alive && unit.deployed && !unit.removed && !unit._removing;
const due = (value, goal) => value >= goal - 1e-7;

export function prepareAphrissaOrdinary(b, u, {contract, mayBegin} = {}) {
  if (contract !== APHRISSA_ORDINARY_CONTRACT || typeof mayBegin !== 'function'
    || u.def.charId !== ID || u.deploySeq !== 0 || u.mem.aphrissaOrdinary)
    throw Error('Fresh selected Aphrissa, explicit ordinary contract and mode predicate required');
  const n = aphrissaNativeInputs(), attack = n.ordinary, target = n.ordinaryTarget;
  if (attack._animKey !== 'Attack' || attack._downAnimKey !== 'Attack_Down'
    || attack._waitForAttackEvent !== 1 || attack._timeMode !== 0 || attack._maxAnimScale !== 1
    || attack._affectedBySlowDown !== 1 || attack._damageType !== 2 || attack._attackType !== 1
    || attack._selectTargetTiming !== 3 || attack._allowNoTarget !== 0 || attack._interuptIfTargetDead !== 0
    || attack._faceToTarget !== 0 || attack._faceToDefault !== 1 || attack._preDelay !== 0
    || target._targetMotion !== 3 || target._targetSide !== 2 || target._limitTargetNum !== 0
    || attack._hitInterval !== .05000000074505806) throw Error('Changed original Aphrissa ordinary attack inputs');
  selectedAphrissaInputs(u);
  const controller = new AphrissaOrdinary(b, u, mayBegin, attack);
  u.mem.aphrissaOrdinary = controller;
  return controller;
}

class AphrissaOrdinary {
  constructor(b, u, mayBegin, native) {
    Object.assign(this, {b, u, mayBegin, native, seq: null, stopped: false, phase: null,
      accepting: false, bornUntil: Infinity, visualSeq: 0, visuals: new WeakSet(), handles: []});
  }
  valid() { return !this.stopped && !this.b.finished && present(this.u) && this.seq === this.u.deploySeq
    && this.u.mem.aphrissaOrdinary === this; }
  allowed() {
    if (!this.valid()) return false;
    let allowed;
    try { allowed = this.mayBegin() === true; }
    catch (error) { this.phase = null; throw error; }
    return allowed && this.valid() && this.u.canAct && !this.u.hidden && !this.u.s.flags.disarm;
  }
  model() { return this.u.dir === 'UP' ? 'Back' : 'Front'; }
  visual(clip, speed = 1, loop = false) {
    if (!this.valid()) return;
    if (clocks.models[this.model()].exactDurations[clip] == null) throw Error('Missing original Aphrissa ordinary clip');
    const visual = {clip, speed, loop, ...(loop ? {} : {playId: `aphrissa:ordinary:${this.seq}:${++this.visualSeq}`})};
    this.visuals.add(visual); this.u.mem.regularFormVisual = visual;
    this.u.mem.regularVisualDirection = this.u.dir;
    return visual;
  }
  choices() {
    const ray = aphrissaRayCells(this.b, this.u, {contract: APHRISSA_RAY_CONTRACT});
    return this.b.enemies.filter(t => this.legal(t)).map(target => ({target,
      index: ray.cells.findIndex(cell => bodyOnTile(target, cell.row, cell.col))}))
      .filter(row => row.index >= 0).sort((a, z) => a.index - z.index || a.target.id.localeCompare(z.target.id))
      .map(row => row.target);
  }
  legal(target) {
    return present(target) && target.side === 'enemy' && !target.hidden
      && canTargetEnemy(this.u, target, {canHitFly: true}) && (!target.s.flags.camou || !!target.blockedBy);
  }
  begin() {
    const clip = this.u.dir === 'DOWN' ? 'Attack_Down' : 'Attack';
    const face = this.model(), marker = evidence.models[ID][face].eventPayloads[clip]?.filter(event => event.name === 'OnAttack');
    if (marker?.length !== 1) throw Error('Missing original Aphrissa ordinary attack marker');
    const speed = Math.min(this.native._maxAnimScale, this.u.base.bat / this.u.s.interval);
    const period = Math.max(this.u.s.interval, marker[0].time / speed);
    this.phase = {clip, epoch: this.u.attackControlEpoch, age: 0, lastAt: this.b.time, speed,
      releaseAge: marker[0].time, endAge: period * speed, released: false, accepted: false,
      inputs: [], pending: [], next: 0};
    this.u.atkCd = period;
    this.phase.visual = this.visual(clip, speed * this.u.s.slowDownRate);
  }
  admit(targets) {
    const p = this.phase;
    return this.accepting && this.allowed() && this.phase === p && p && !p.accepted
      && p.epoch === this.u.attackControlEpoch && targets.length === p.inputs.length && targets.length > 0
      && targets.every((target, i) => target === p.inputs[i].unit
        && target.deploySeq === p.inputs[i].life && this.legal(target));
  }
  release(targets, info) {
    if (!this.admit(targets)) return false;
    const p = this.phase;
    p.accepted = true;
    p.pending = p.inputs.map((input, index) => ({...input, at: p.releaseAge + index * this.native._hitInterval}));
    p.attackId = info.attackId;
    this.flush(p);
    return true;
  }
  flush(p) {
    while (this.phase === p && this.allowed() && this.phase === p && p.epoch === this.u.attackControlEpoch
      && p.next < p.pending.length && due(p.age, p.pending[p.next].at)) {
      const input = p.pending[p.next++]; // Claim before damage callbacks.
      if (input.unit.deploySeq !== input.life || !this.legal(input.unit)) continue;
      this.b.dealDamage(this.u, input.unit, {amount: this.u.s.atk * this.u.s.atkScaleMul,
        type: 'arts', isAttack: true, isSkill: false, attackId: p.attackId,
        applyWay: 'ranged', tags: ['aphrissa:ordinary']});
    }
  }
  tick() {
    if (!this.valid()) return;
    if (!this.allowed()) { this.phase = null; return; }
    if (!due(this.b.time, this.bornUntil)) return;
    const p = this.phase;
    if (p && p.epoch !== this.u.attackControlEpoch) { this.phase = null; this.visual('Idle', 1, true); return; }
    if (p) {
      p.age += sourceAbilityDelta(this.u, Math.max(0, this.b.time - p.lastAt), true) * p.speed;
      p.lastAt = this.b.time;
      if (this.u.mem.regularFormVisual === p.visual) p.visual.speed = p.speed * this.u.s.slowDownRate;
      if (!p.released && due(p.age, p.releaseAge)) {
        p.released = true;
        p.inputs = this.choices().map(unit => ({unit, life: unit.deploySeq}));
        this.accepting = true;
        try { this.b.forceAttack(this.u, p.inputs.map(input => input.unit)); }
        finally { this.accepting = false; }
      }
      this.flush(p);
      if (!this.allowed() || this.phase !== p || !due(p.age, p.endAge)
        || p.next < p.pending.length) return;
      this.phase = null;
    }
    if (this.u.atkCd > 1e-8) return;
    if (this.choices().length) this.begin();
    else this.visual('Idle', 1, true);
  }
  trait() {
    return {noAttack: true, attackDrivenSkill: true, attack: 'ranged', dmgType: 'arts', projectile: 'none',
      canHitFly: true, groundOnly: false, allInRange: true, maxTargets: 9999, hits: 1, windup: 0,
      attackVisual: 'none', requiresAcceptedLaunch: true,
      acceptAreaAttack: (_b, _u, _p, targets) => this.admit(targets),
      launchAreaAttack: (_b, _u, _p, targets, info) => this.release(targets, info)};
  }
  install() {
    if (this.stopped || this.handles.length) throw Error('Aphrissa ordinary attacks cannot be reinstalled');
    const b = this.b, u = this.u;
    this.handles = [b.on('deploy', ({unit, move}) => {
      if (unit !== u || move) return;
      if (this.seq !== null) { this.stop(); return; }
      this.seq = u.deploySeq;
      this.bornUntil = b.time + clocks.models[this.model()].exactDurations.Start;
      this.visual('Start');
      u.mem.regularDeathVisual = this.model() === 'Back' ? {hide: true, duration: 1}
        : {clip: 'Die', die: 'Die', duration: clocks.models.Front.exactDurations.Die};
    }, {owner: u}), b.on('tick', () => {
      if (this.seq !== null && !this.valid()) this.stop(); else this.tick();
    }, {owner: u}), b.on('death', ({unit}) => { if (unit === u) this.stop(); }, {owner: u}),
    b.on('battleEnd', () => this.stop(), {owner: u})];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.phase = null; this.accepting = false;
    for (const handle of this.handles) this.b.off(handle);
    this.handles = [];
    if (this.visuals.has(this.u.mem.regularFormVisual)) {
      delete this.u.mem.regularFormVisual; delete this.u.mem.regularVisualDirection;
    }
  }
}
