// SPDX-License-Identifier: GPL-3.0-or-later
// Grounded healing component only. Flight/skills and public admission are separate.
import evidence from '../../../data/arkpedia-native-operators/char_4222_taraxa.json' with {type: 'json'};
import clocks from '../../../data/arkpedia-taraxa-clocks.json' with {type: 'json'};
import {TARAXA_ID, taraxaNativeInputs, selectedTaraxaInputs} from './arkpedia-taraxa-source.js';
import {COLS} from '../constants.js';

export const TARAXA_ORDINARY_CONTRACT = Object.freeze({
  scope: 'Selected original Taraxacum grounded single-recipient heal and independent speed-eleven transport; no skill controller or public admission.',
  mapping: 'Grounded acquisition uses injured friendly recipients on the attack grid, mapped to lowest HP ratio then latest deployment. One input life is retained through the original Attack marker and a finite ten-second speed-eleven heal projectile. Matching present source life supplies live ATK and attack scale; source retirement uses the launch ATK/attack-scale/output-healing snapshot. Recipient healing multipliers and normal modifier callbacks still apply. The exact animation is separate from source BAT2.85. Source-capped playback samples min(1,BAT/interval), without another slowdown multiplier. Control cancels an unfired phase while preserving cooldown.',
  limitations: 'Native selector aliases/ties, acquisition/FSM ordering and source-invalid attributes remain explicit local mappings. Takeoff/landing, both skill controllers, original art delivery, native effects/audio and game-frame/pixel parity are not admitted.',frameParity:false,
});
const present = u => u?.alive && u.deployed && !u.removed;
// Native animation payloads use float32; do not delay a source frame solely
// because its 0.6 marker is encoded as 0.6000000238418579.
const due = (a, z) => a >= z - 1e-7;
export const taraxaHealable = (b,u,t) => present(t) && !t._removing && !t.hidden && t.side === 'ally' && t.kind !== 'device'
  && !t.s.flags.untargetable && !t.s.flags.healFree && b.allySelectable(t,u)
  && (t === u || !t.s.flags.noHeal && !t.profile?.noHeal);
export const sortTaraxaRecipients = ts => ts.sort((a,b) => a.hp/a.s.maxHp-b.hp/b.s.maxHp
  || b.deploySeq-a.deploySeq || String(a.id).localeCompare(String(b.id)));
const retained = t => present(t) && !t.hidden && t.side === 'ally';
const ordinaryShot = Object.freeze({clip:'Attack',scale:1,projectileSpeed:11,isSkill:false,tag:'taraxa:ordinary'});
export function verifyTaraxaOrdinarySource(n = taraxaNativeInputs()) {
  const a=n.modes[0].attack,parts=n.projectiles.projectile_chr_taraxa_a.flatMap(r=>r.components.map(c=>c.data));
  const p=parts.find(d=>d._lifeTime!=null),m=parts.find(d=>d._speed!=null);
  if(a._animKey!=='Attack'||a._endAnimKey!=='Idle'||a._waitForAttackEvent!==1||a._selectTargetTiming!==0
    ||a._selectTargetSource!==2||a._affectedBySlowDown!==0||a._maxAnimScale!==1||a._timeMode!==0
    ||a._projectileKey!=='projectile_chr_taraxa_a'||a._useCachedAtkOnly!==0||a._ignoreHealFree!==0
    ||p._canHitSameTargetMultipleTimes!==0||p._maxHitNum!==1||p._managedBySource!==0||p._stopWhenSourceInvalid!==0||p._lifeTime!==10||p._alwaysHitTraceTargetInTheEnd!==1
    ||m._speed!==11)throw Error('Changed original Taraxacum ordinary inputs');
}

export class TaraxaOrdinaryHeals {
  constructor(b, u, {contract, mayBegin} = {}) {
    if (contract !== TARAXA_ORDINARY_CONTRACT || typeof mayBegin !== 'function' || u.deploySeq !== 0 || u.def.charId !== TARAXA_ID)
      throw Error('Fresh selected Taraxacum, exact ordinary contract and explicit skill composition predicate required');
    verifyTaraxaOrdinarySource();
    this.b = b; this.u = u; this.record = selectedTaraxaInputs(u); this.mayBegin = mayBegin;
    this.seq = null; this.stopped = false; this.ended = false; this.accepting = false;
    this.phase = null; this.facing = u.dir; this.visualSeq = 0; this.bornUntil = Infinity;
    this.handles = []; this.watchers = []; this.flights = new Map();
  }
  valid() { return !this.stopped && !this.b.finished && present(this.u) && this.u.deploySeq === this.seq; }
  model() { const face = this.facing === 'UP' ? 'Back' : 'Front';
    return {...evidence.models[TARAXA_ID][face], ...clocks.models[face]}; }
  visual(clip, speed = 1, loop = false) {
    if (this.model().exactDurations[clip] == null) throw Error('Missing original Taraxacum clip: ' + clip);
    this.u.mem.regularVisualDirection = this.facing;
    this.u.mem.regularFormVisual = {clip, speed, loop, ...(loop ? {replace:true} : {}),
      ...(!loop ? {playId: `taraxa:ordinary:${this.seq}:${++this.visualSeq}`} : {})};
    this.u.mem.regularDeathVisual = this.facing === 'UP' ? {hide: true, duration: 1} : {clip: 'Die', die: 'Die', duration: 1};
  }
  idle() { this.facing = this.u.dir; this.visual('Idle', 1, true); }
  face(t) { const x = t.x - this.u.x, y = t.y - this.u.y;
    if (Math.hypot(x, y) > 1e-8) this.facing = Math.abs(y) > Math.abs(x) ? y > 0 ? 'UP' : 'DOWN' : x < 0 ? 'LEFT' : 'RIGHT'; }
  choices() {
    if (this.b.rangeChanged(this.u)) this.b._refreshRange(this.u);
    return sortTaraxaRecipients(this.b.allyUnits.filter(t => taraxaHealable(this.b,this.u,t)
      && t.hp < t.s.maxHp-1e-8 && this.u.rangeKeySet.has(t.tileR*COLS+t.tileC))).slice(0,1);
  }
  begin(target, shot = ordinaryShot) {
    this.face(target);
    const speed = Math.min(1, this.u.base.bat / this.u.s.interval);
    const releaseAge = this.model().eventPayloads[shot.clip][0].time;
    const period = Math.max(this.u.s.interval, releaseAge / speed);
    this.phase = {target, life: target.deploySeq, epoch: this.u.attackControlEpoch, shot,
      speed, releaseAge, age: 0, lastAt: this.b.time, untilAge: period * speed,
      released: false, accepted: false};
    this.u.atkCd = period; this.visual(shot.clip, speed);
  }
  admit(targets) {
    const p = this.phase;
    return this.accepting && this.valid() && !this.u.hidden && this.mayBegin() && this.u.canAct && !this.u.s.flags.disarm
      && p && !p.accepted && p.epoch === this.u.attackControlEpoch && due(p.age, p.releaseAge)
      && targets.length === 1 && targets[0] === p.target && targets[0].deploySeq === p.life && retained(targets[0]);
  }
  release(targets, info) {
    if (!this.admit(targets)) return false;
    const p = this.phase, target = targets[0], sourceLife = this.seq;
    p.accepted = true;
    const launchAtk = this.u.s.atk * this.u.s.atkScaleMul, launchHealingDealtMul = this.u.s.healingDealtMul;
    let projectile, claimed = false;
    projectile = this.b.addProjectile({from: this.u, target, source: this.u, speed: p.shot.projectileSpeed, maxAge: 10,
      visual: 'orb', data: {arkpediaTrackedVisual: true, taraxaOrdinary: !p.shot.isSkill},
      onHit: () => {
        if (claimed) return; claimed = true;
        this.flights.delete(projectile);
        if (!this.ended && !this.b.finished && target.deploySeq === p.life && retained(target)) {
          const matchingSource = present(this.u) && this.u.deploySeq === sourceLife;
          const atk = matchingSource ? this.u.s.atk * this.u.s.atkScaleMul : launchAtk;
          this.b.heal(this.u,target,atk*p.shot.scale,{isSkill:p.shot.isSkill,isAttack:true,
            isProjectile:true,attackId:info.attackId,tags:[p.shot.tag],
            ...(!matchingSource?{sourceHealingDealtMul:launchHealingDealtMul}:{})});
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
    if (u.hidden || !u.canAct || u.s.flags.disarm || p && p.epoch !== u.attackControlEpoch) {
      this.interrupted(p); this.phase = null; if (this.valid()) this.idle(); return;
    }
    if (p) {
      p.age += Math.max(0, this.b.time - p.lastAt) * p.speed; p.lastAt = this.b.time;
      if (!p.released && due(p.age, p.releaseAge)) {
        p.released = true; this.accepting = true;
        try { this.b.forceAttack(u, [p.target]); } finally { this.accepting = false; }
      }
      if (!this.valid() || this.phase !== p || !due(p.age, p.untilAge)) return;
      this.completed(p);
      if (!this.valid() || this.phase !== p) return;
      this.phase = null;
    }
    if (u.atkCd > 1e-8) return;
    const target = this.choices()[0]; if (target) this.begin(target); else this.idle();
  }
  interrupted(_phase) {}
  completed(_phase) {}
  trait() { return {noAttack: true, attackDrivenSkill: true, attack: 'ranged', dmgType: 'heal', canHitFly: true,
    groundOnly: false, heal: {mode:'single'}, projectile: 'none', priority: 'normal', maxTargets: 1, maxTargetsByBlock: false,
    hitAllBlocked: false, allInRange: false, hits: 1, hitsFn: null, chain: null, splashRadius: 0, windup: 0, attackVisual:'none',
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
    if (this.handles.length || this.stopped) throw Error('Taraxacum ordinary attacks cannot be reinstalled');
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
    if (this.u.deploySeq === this.seq) {
      delete this.u.mem.regularFormVisual; delete this.u.mem.regularVisualDirection;
    }
    if (this.b.finished) this.drain();
  }
}
