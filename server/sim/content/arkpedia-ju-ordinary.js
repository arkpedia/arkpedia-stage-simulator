// SPDX-License-Identifier: GPL-3.0-or-later
// Ordinary attack component only. Full Ju skill/public admission is separate.
import evidence from '../../../data/arkpedia-native-operators/char_4221_ju.json' with {type: 'json'};
import clocks from '../../../data/arkpedia-ju-clocks.json' with {type: 'json'};
import {JU_ID, juNativeInputs, selectedJuInputs} from './arkpedia-ju-source.js';
import {canTargetEnemy, sortEnemyTargets} from '../targeting.js';
import {bodyInKeys} from '../body.js';

export const JU_ORDINARY_CONTRACT = Object.freeze({
  scope: 'Original Ju input-time single-target ordinary attack and independent speed-ten projectile; no skill or public registration.',
  mapping: 'Native selector27 maps to heaviest-first local sorting. New acquisition excludes the shared cripple family; a retained live input is not reselected. Attack clocks sample min(1,BAT/interval), without an additional slowdown multiplier. Cooldown lasts at least the release marker. Born transport retains its target life and one attack receipt, with live ATK while its source life is present and launch ATK fallback afterwards.',
  limitations: 'Selector aliases, acquisition/FSM/cycle ordering, Start duration and source-invalid ATK dispatch remain local mappings. Original artwork delivery, skill composition, native effects/audio and game-frame parity remain unverified.',
  frameParity: false,
});
const present = u => u?.alive && u.deployed && !u.removed;
const due = (a, z) => a >= z - 1e-8;
const legal = (u, t) => present(t) && canTargetEnemy(u, t, {canHitFly: true, groundOnly: false});
const retained = t => present(t) && !t.hidden && t.side === 'enemy';

export function verifyJuOrdinarySource(n = juNativeInputs()) {
  const a = n.ordinary, s = n.ordinarySelector, p = n.ordinaryProjectile;
  if (a._animKey !== 'Attack' || a._waitForAttackEvent !== 1 || a._selectTargetTiming !== 0
    || a._selectTargetSource !== 1 || a._affectedBySlowDown !== 0 || a._maxAnimScale !== 1
    || a._projectileKey !== 'projectile_chr_ju' || a._useCachedAtkOnly !== 0 || a._timeMode !== 0
    || s._postFilter !== 27 || s._abnormalFlag !== 44 || s._maxTargetKey !== 'max_target'
    || p._managedBySource !== 0 || p._stopWhenSourceInvalid !== 0 || p._lifeTime !== 10
    || p._alwaysHitTraceTargetInTheEnd !== 1 || n.ordinaryMovement._speed !== 10)
    throw Error('Changed original Ju ordinary inputs');
}

export class JuOrdinaryAttacks {
  constructor(b, u, {contract, mayBegin} = {}) {
    if (contract !== JU_ORDINARY_CONTRACT || typeof mayBegin !== 'function' || u.deploySeq !== 0 || u.def.charId !== JU_ID)
      throw Error('Fresh selected Ju, exact ordinary contract and explicit skill composition predicate required');
    verifyJuOrdinarySource();
    this.b = b; this.u = u; this.record = selectedJuInputs(u); this.mayBegin = mayBegin;
    this.seq = null; this.stopped = false; this.ended = false; this.accepting = false;
    this.phase = null; this.facing = u.dir; this.visualSeq = 0; this.bornUntil = Infinity;
    this.handles = []; this.watchers = []; this.flights = new Map();
  }
  valid() { return !this.stopped && !this.b.finished && present(this.u) && this.u.deploySeq === this.seq; }
  model() { const face = this.facing === 'UP' ? 'Back' : 'Front';
    return {...evidence.models[JU_ID][face], ...clocks.models[face]}; }
  visual(clip, speed = 1, loop = false) {
    if (this.model().exactDurations[clip] == null) throw Error('Missing original Ju clip: ' + clip);
    this.u.mem.regularVisualDirection = this.facing;
    this.u.mem.regularFormVisual = {clip, speed, loop,
      ...(!loop ? {playId: `ju:ordinary:${this.seq}:${++this.visualSeq}`} : {})};
    this.u.mem.regularDeathVisual = this.facing === 'UP' ? {hide: true, duration: 1} : {clip: 'Die', die: 'Die', duration: 1};
  }
  idle() { this.facing = this.u.dir; this.visual('Idle', 1, true); }
  face(t) { const x = t.x - this.u.x, y = t.y - this.u.y;
    if (Math.hypot(x, y) > 1e-8) this.facing = Math.abs(y) > Math.abs(x) ? y > 0 ? 'UP' : 'DOWN' : x < 0 ? 'LEFT' : 'RIGHT'; }
  choices() {
    if (this.b.rangeChanged(this.u)) this.b._refreshRange(this.u);
    const candidates = this.b.enemies.filter(t => legal(this.u, t) && !t.findBuff('cripple')
      && bodyInKeys(t, this.u.rangeKeySet));
    // The shared regular-stage rule keeps an attacker able to hit its own
    // blocker even when the source's long-range grid omits adjacent tiles.
    for (const t of this.b.blockedTargets(this.u, {canHitFly: true, canTarget: (_u, e) => !e.findBuff('cripple')}))
      if (!candidates.includes(t)) candidates.push(t);
    return sortEnemyTargets(this.b, this.u, candidates, 'heaviest').slice(0, 1);
  }
  begin(target) {
    this.face(target);
    const speed = Math.min(1, this.u.base.bat / this.u.s.interval);
    const releaseAge = this.model().eventPayloads.Attack[0].time;
    const period = Math.max(this.u.s.interval, releaseAge / speed);
    this.phase = {target, life: target.deploySeq, epoch: this.u.attackControlEpoch,
      speed, releaseAge, age: 0, lastAt: this.b.time, untilAge: period * speed,
      released: false, accepted: false};
    this.u.atkCd = period; this.visual('Attack', speed);
  }
  admit(targets) {
    const p = this.phase;
    return this.accepting && this.valid() && this.mayBegin() && this.u.canAct && !this.u.s.flags.disarm
      && p && !p.accepted && p.epoch === this.u.attackControlEpoch && due(p.age, p.releaseAge)
      && targets.length === 1 && targets[0] === p.target && targets[0].deploySeq === p.life && retained(targets[0]);
  }
  release(targets, info) {
    if (!this.admit(targets)) return false;
    const p = this.phase, target = targets[0], sourceLife = this.seq;
    p.accepted = true;
    const launchAtk = this.u.s.atk * this.u.s.atkScaleMul;
    let projectile;
    projectile = this.b.addProjectile({from: this.u, target, source: this.u, speed: 10, maxAge: 10,
      visual: 'arrow', data: {arkpediaTrackedVisual: true, juOrdinary: true},
      onHit: () => {
        this.flights.delete(projectile);
        if (!this.ended && !this.b.finished && target.deploySeq === p.life && retained(target)) {
          const atk = present(this.u) && this.u.deploySeq === sourceLife
            ? this.u.s.atk * this.u.s.atkScaleMul : launchAtk;
          this.b.dealDamage(this.u, target, {amount: atk, type: 'phys', isAttack: true,
            isProjectile: true, isSkill: false, attackId: info.attackId, applyWay: 'ranged', tags: ['ju:ordinary']});
        }
        this.unwatch();
      }});
    this.flights.set(projectile, {target, life: p.life});
    if (this.b.finished) this.drain(); else this.watch();
    return true;
  }
  tick() {
    if (!this.valid()) return;
    if (!this.mayBegin()) { this.phase = null; return; }
    if (!due(this.b.time, this.bornUntil)) return;
    const u = this.u; let p = this.phase;
    if (!u.canAct || u.s.flags.disarm || p && p.epoch !== u.attackControlEpoch) {
      this.phase = null; this.idle(); return;
    }
    if (p) {
      p.age += Math.max(0, this.b.time - p.lastAt) * p.speed; p.lastAt = this.b.time;
      if (!p.released && due(p.age, p.releaseAge)) {
        p.released = true; this.accepting = true;
        try { this.b.forceAttack(u, [p.target]); } finally { this.accepting = false; }
      }
      if (!this.valid() || this.phase !== p || !due(p.age, p.untilAge)) return;
      this.phase = null;
    }
    if (u.atkCd > 1e-8) return;
    const target = this.choices()[0]; if (target) this.begin(target); else this.idle();
  }
  trait() { return {noAttack: true, attackDrivenSkill: true, attack: 'ranged', dmgType: 'phys', canHitFly: true,
    groundOnly: false, heal: null, projectile: 'none', priority: 'heaviest', maxTargets: 1, maxTargetsByBlock: false,
    hitAllBlocked: false, allInRange: false, hits: 1, hitsFn: null, chain: null, splashRadius: 0, windup: 0,
    requiresAcceptedLaunch: true, acceptAreaAttack: (_b, _u, _p, ts) => this.admit(ts),
    launchAreaAttack: (_b, _u, _p, ts, info) => this.release(ts, info)}; }
  watch() {
    if (this.watchers.length || !this.flights.size) return;
    this.watchers = [this.b.on('tick', () => {
      for (const p of this.flights.keys()) if (!this.b.projectiles.list.includes(p) && !this.b.projectiles.arriving.includes(p)) this.flights.delete(p);
      this.unwatch();
    }), this.b.on('battleEnd', () => this.drain())];
  }
  unwatch() { if (this.flights.size) return; for (const h of this.watchers) this.b.off(h); this.watchers = []; }
  drain() { this.ended = true; this.b.removeProjectiles(p => this.flights.has(p)); this.flights.clear(); this.unwatch(); }
  install() {
    if (this.handles.length || this.stopped) throw Error('Ju ordinary attacks cannot be reinstalled');
    this.handles = [this.b.on('deploy', ({unit, move}) => {
      if (unit !== this.u || move) return;
      this.seq = unit.deploySeq; this.facing = unit.dir;
      this.bornUntil = this.b.time + this.model().exactDurations.Start;
      unit.mem.regularBornUntil = this.bornUntil; this.visual('Start');
    }, {owner: this.u}),
    this.b.on('tick', () => { if (this.seq !== null && !this.valid()) this.stop(); else this.tick(); }, {owner: this.u}),
    this.b.on('removed', ({unit}) => { if (unit === this.u) this.stop(); }, {owner: this.u}),
    this.b.on('death', ({unit}) => { if (unit === this.u) this.stop(); }, {owner: this.u}),
    this.b.on('battleEnd', () => { this.stop(); this.drain(); }, {owner: this.u})];
  }
  stop() {
    if (this.stopped) return;
    this.stopped = true; this.phase = null; this.accepting = false;
    for (const h of this.handles) this.b.off(h); this.handles = [];
    delete this.u.mem.regularFormVisual; delete this.u.mem.regularVisualDirection;
    if (this.b.finished) this.drain();
  }
}
