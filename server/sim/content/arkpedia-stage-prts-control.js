// SPDX-License-Identifier: GPL-3.0-or-later
// Chapter 15: the PRTS control system's hand. Reviewed in shared/arkpedia/stage-prts-control.js (the system) and
// shared/arkpedia/enemy-intrusive-call-features.js (the Intrusive Call, kind intrusiveCall, below).
// - The wave program marks the hand's own spawn (`prtsHand`) and each enemy a grab order names (`prtsGrab`).
// - A grabbed enemy spawns at its scheduled time but is held out of play: not counted, not holding the battle.
// - One order at a time, in spawn order: the hand flies to the drag tile, plays Grab_Begin, flies to the enemy's
//   position (its route's start), plays Grab_End, and flies back to where it appeared [inference: one order ends
//   before the next starts, and each ends with the flight back].
// - At Grab_End's event the enemy is deployed, unless its tile is occupied: a lowland tile by an operator or a
//   summon, a highland tile by any placed unit. A flying enemy always deploys. A failed deploy removes the enemy
//   [inference] and the hand plays Angry.
import { MOVE_SCALE } from '../constants.js';
import { PRTS_NODE_ENEMY } from '../../../shared/arkpedia/stage-prts-control.js';
import { stageCharacterMultipliers } from '../../../shared/arkpedia/stage-character-attributes.js';

const HELD = 'stage:prtsCarried';

/** Kind `intrusiveCall`: INVINCIBLE, UNDEADABLE, cannot be selected, blocked or moved by anything but its orders. */
export function intrusiveCall(p) {
  if (!(p?.grab?.clip >= p.grab.at && p.release?.clip >= p.release.at && p.click?.clip >= p.click.at && p.angry > 0)) throw Error('Invalid Intrusive Call parameters');
  return {
    spawn(b, e) {
      e.profile.noAttack = true; e.profile.holdsBattle = false; e.lpr = 0; e.mem.noLeak = true;
      b.addBuff(e, { key: 'ab:intrusiveCall', persist: true,
        flags: { invulnerable: true, untargetable: true, undeadable: true, isolated: true, noMove: true, noDisplace: true, unblockable: true } });
      b.stagePrts?.adopt(e, p); // placed alone (no control system) it only hovers
    },
  };
}

export class StagePrtsControl {
  constructor(b, spec) {
    if (!Number.isInteger(spec?.drag?.row) || !Number.isInteger(spec.drag.col)) throw Error('Invalid PRTS control program');
    this.battle = b; this.drag = [spec.drag.row, spec.drag.col]; this.hand = null; this.p = null; this.origin = null;
    this.queue = []; this.job = null; this.deployed = 0; this.failed = 0; this.activated = 0;
    this.statics = spec.statics ?? {}; this.staticsPlaced = 0;
    b.on('enemySpawn', ({ enemy }) => { if (b.stageWaveScheduler?.flags.get(enemy.tag)?.prtsGrab) this.hold(enemy); }, { priority: 900 });
    b.on('tick', ({ dt }) => this.tick(dt));
  }
  adopt(e, p) {
    if (this.hand) throw Error('Only one Intrusive Call is on the field');
    this.hand = e; this.p = p; this.origin = [e.y, e.x];
  }
  /** trap_mpweak_s_ready (MOVE_AND_CREATEBUFF, priority 100): a charged Weakening Node calls the hand; the order goes
   * before the waiting grab orders. */
  requestActivate(node) {
    if (!this.hand?.alive) return false;
    this.enqueue({ activate: node, target: [node.row, node.col], phase: 'toNode', t: 0, released: false, failed: false }, 100);
    return true;
  }
  /** Orders run by priority, first come first served within one (grab orders 0, a node's call 100, a hold 200). */
  enqueue(job, priority = 0) {
    job.priority = priority;
    const at = this.queue.findIndex(q => (q.priority ?? 0) < priority);
    if (at < 0) this.queue.push(job); else this.queue.splice(at, 0, job);
  }
  /** MOVE_AND_DRAG_SOURCE (priority 200): the hand flies to `unit`, takes hold of it (`onHold` at the clip's event)
   * and stays with it until releaseHold. False without a hand. */
  requestHold(unit, onHold) {
    if (!this.hand?.alive || !this.p?.hold) return false;
    this.enqueue({ hold: unit, onHold, phase: 'toSource', t: 0, released: false, failed: false, ending: false }, 200);
    return true;
  }
  /** The held unit lands, or its order is dropped (Main15SkipPrtsAction): the hand lets go and moves on. */
  releaseHold(unit) {
    this.queue = this.queue.filter(q => q.hold !== unit);
    const j = this.job;
    if (j?.hold !== unit || j.ending) return;
    j.ending = true;
    if (j.phase === 'holding') { j.phase = 'holdEnd'; j.t = 0; } else j.phase = 'toOrigin';
  }
  holding(unit) { return this.job?.hold === unit && this.job.phase === 'holding'; }
  /** The tile the hand is carrying an enemy to (the client marks it). */
  get marker() { const j = this.job; return j && !j.activate && !j.hold && ['toDrag', 'grab', 'toTarget', 'release'].includes(j.phase) && !j.released ? j.target : null; }
  hold(e) {
    const b = this.battle;
    e.mem.prtsCarried = true; e.hidden = true; e.pauseUntil = Infinity;
    b.addBuff(e, { key: HELD, persist: true, flags: { noMove: true, untargetable: true, invulnerable: true, disarm: true } });
    const holds = e.profile.holdsBattle; e.profile.holdsBattle = false;
    this.enqueue({ enemy: e, target: [Math.round(e.y), Math.round(e.x)], holds, phase: 'toDrag', t: 0, released: false, failed: false,
      node: (e.def?.key ?? e.defId) === PRTS_NODE_ENEMY }, 0);
  }
  free(job) {
    const b = this.battle, e = job.enemy;
    b.removeBuff(e, HELD); e.hidden = false; e.pauseUntil = -Infinity; e.mem.prtsCarried = false;
    if (job.holds === undefined) delete e.profile.holdsBattle; else e.profile.holdsBattle = job.holds;
  }
  occupied([row, col]) {
    const b = this.battle, highland = b.grid.tile(row, col)?.height === 'HIGH';
    // PRTS: a highland target is taken by a character unit of any kind and either side, so a fixed form already
    // standing there (itself a device) stops a second drop (TR-26's third machine on 2,6).
    return b.units.some(u => u.alive && u.deployed && !u.mem.prtsCarried && u.kind !== 'enemy' && u.tileR === row && u.tileC === col
      && (highland || u.kind !== 'device' || u.profile?.characterLikeDevice))
      || highland && b.enemies.some(e => e.alive && e.mem.prtsStatic && Math.round(e.y) === row && Math.round(e.x) === col);
  }
  /** Grab_End's event. */
  release(job) {
    const b = this.battle, e = job.enemy;
    job.released = true;
    if (!e.alive) return;
    if (!e.isFlying && this.occupied(job.target)) {
      job.failed = true; this.failed++; this.free(job);
      b._remove(e, 'withdraw', null, true);
      return;
    }
    if (job.node) { // the Weakening Node enemy only stands for the device the hand deploys
      this.free(job); b._remove(e, 'withdraw', null, true);
      if (b.stageWeakeningNodes?.place(job.target[0], job.target[1])) this.deployed++; else { job.failed = true; this.failed++; }
      return;
    }
    this.free(job); this.deployed++;
    const form = b.grid.tile(job.target[0], job.target[1])?.height === 'HIGH' ? this.statics[e.def?.key ?? e.defId] : null;
    if (form) this.makeStatic(e, form, job.target);
    b.fx?.('pulse', { x: e.x, y: e.y, id: e.id, kind: 'prtsDeploy' });
  }
  makeStatic(e, form, target) { applyPrtsStaticForm(this.battle, e, form, target); this.staticsPlaced++; }
  fly([row, col], dt) {
    // The game's own rule: tiles per second = move speed x the level's 0.5. The battle's walking scale (0.65) is not
    // used: TR-26's script places Amiya on a drop tile at 49 s "in advance", and at 0.5 that delivery lands at 50.0 s
    // (at 0.65 it would land at 44.6 s, before her).
    const h = this.hand, speed = h.s.moveSpeed * MOVE_SCALE;
    const dx = col - h.x, dy = row - h.y, d = Math.hypot(dx, dy), step = speed * dt;
    if (d <= step + 1e-9) { h.x = col; h.y = row; return true; }
    h.x += dx / d * step; h.y += dy / d * step; return false;
  }
  tick(dt) {
    const b = this.battle, p = this.p;
    if (b.finished) return;
    if (!this.hand?.alive) { // no hand: nothing can carry them
      if (this.job) { if (!this.job.released && this.job.enemy) this.release(this.job); this.job = null; }
      for (const job of this.queue.splice(0)) if (job.enemy) this.release(job);
      return;
    }
    if (!this.job) { this.job = this.queue.shift() ?? null; if (!this.job) return; }
    const j = this.job;
    // The activate order: fly to the node, Click (the cast lands at its event), then back.
    if (j.phase === 'toNode') { if (this.fly(j.target, dt)) { j.phase = 'click'; j.t = 0; } return; }
    if (j.phase === 'click') {
      j.t += dt;
      if (!j.released && j.t + 1e-9 >= p.click.at) {
        j.released = true;
        if (b.stageWeakeningNodes?.prtsActivate(j.activate)) this.activated++; else { j.failed = true; this.failed++; }
      }
      if (j.t + 1e-9 >= p.click.clip) { j.phase = j.failed ? 'angry' : 'toOrigin'; j.t = 0; }
      return;
    }
    // The hold order: fly to the unit, take hold (Grab_Begin_2), stay on it until it lands, let go (Grab_End_2).
    if (j.hold) {
      const u = j.hold;
      if (!u.alive && !j.ending) { j.ending = true; j.phase = 'toOrigin'; }
      if (j.phase === 'toSource') { if (this.fly([u.y, u.x], dt)) { j.phase = 'holdBegin'; j.t = 0; } return; }
      if (j.phase === 'holdBegin') {
        j.t += dt;
        if (!j.released && j.t + 1e-9 >= p.hold.at) { j.released = true; j.onHold?.(); }
        if (j.t + 1e-9 >= p.hold.clip) j.phase = 'holding';
        return;
      }
      if (j.phase === 'holding') { this.hand.x = u.x; this.hand.y = u.y; return; }
      if (j.phase === 'holdEnd') { j.t += dt; if (j.t + 1e-9 >= p.hold.end) j.phase = 'toOrigin'; return; }
      if (this.fly(this.origin, dt)) this.job = null;
      return;
    }
    if (j.phase === 'toDrag') { if (this.fly(this.drag, dt)) { j.phase = 'grab'; j.t = 0; } return; }
    if (j.phase === 'grab') { j.t += dt; if (j.t + 1e-9 >= p.grab.clip) j.phase = 'toTarget'; return; }
    if (j.phase === 'toTarget') { if (this.fly(j.target, dt)) { j.phase = 'release'; j.t = 0; } return; }
    if (j.phase === 'release') {
      j.t += dt;
      if (!j.released && j.t + 1e-9 >= p.release.at) this.release(j);
      if (j.t + 1e-9 >= p.release.clip) { j.phase = j.failed ? 'angry' : 'toOrigin'; j.t = 0; }
      return;
    }
    if (j.phase === 'angry') { j.t += dt; if (j.t + 1e-9 >= p.angry) j.phase = 'toOrigin'; return; }
    if (this.fly(this.origin, dt)) this.job = null;
  }
}

/** The static form: the same unit, fixed on its tile with the device's numbers; it never has to be defeated. */
export function applyPrtsStaticForm(b, e, form, [row, col]) {
  const scale = stageCharacterMultipliers(b.stageCardRules, { id: form.trap, profession: 'TRAP', position: 'NONE', side: 'ENEMY' });
  Object.assign(e.base, { maxHp: form.hp * (scale.maxHp ?? 1), atk: form.atk * (scale.atk ?? 1), def: form.def * (scale.def ?? 1), res: form.res,
    tauntLevel: form.taunt, massLevel: form.mass });
  e.route.legs = []; e.route.legIdx = 0; e.x = col; e.y = row; e.lpr = 0; e.mem.noLeak = true; e.mem.prtsStatic = form.trap;
  e.profile.holdsBattle = false;
  b.addBuff(e, { key: 'stage:prtsStatic', persist: true, flags: { noMove: true, noDisplace: true, unblockable: true } });
  e.markDirty(); e.hp = e.s.maxHp;
  (b.noDeployZones ??= new Map()).set(e, new Set([`${row},${col}`]));
}

/** A device the level placed itself (15-3's Cold Drink Machines): its paired enemy appears on the tile as the fixed form. */
export function placePrtsStatic(b, enemyKey, form, [row, col]) {
  const e = b.spawnEnemy(enemyKey, { pos: [row, col], countInTotal: false, route: { start: [row, col], steps: [{ t: 'wait', s: 1e9 }] } });
  if (!e) return null;
  e.counted = false;
  applyPrtsStaticForm(b, e, form, [row, col]);
  return e;
}
