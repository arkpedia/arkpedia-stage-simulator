// SPDX-License-Identifier: GPL-3.0-or-later
// PRTS, Source Code (kind prtsSource) and the Mimic Machine (kind mimicMachine). Every number arrives in `p` from
// the reviewed contract (shared/arkpedia/enemy-prts-source-features.js). The hand that holds the Mimic in the air is
// b.stagePrts (arkpedia-stage-prts-control.js); the Weakening Nodes its beams aim at are b.stageWeakeningNodes.
import { ALLY_COLLIDER_RADIUS } from '../constants.js';

const pair = b => (b.prtsBossPair ??= { source: null, mimic: null });
const live = u => u?.alive && u.deployed !== false && !u.hidden;
const INV = 'ab:prtsSource:inv', DOWN = 'ab:mimicDown', STILL = 'ab:mimicStill', AIR = 'ab:mimicAir', STACK = 'ab:mimicReborned';

/** PRTS, Source Code. Invincible while the Mimic Machine is up. While it is down: no invincibility, 1 SP a second and
 * 1 SP for each hit taken; at `spCost` SP it is invincible again and the Mimic stands up. `deadline` s in: defeat. */
export function prtsSource(p) {
  if (!(p?.box?.w > 0 && p.deadline > 0 && p.loseDelay >= 0 && p.spCost > 0 && p.spInterval > 0 && p.dizzyBegin >= 0 && p.dizzyEnd >= 0))
    throw Error('Invalid PRTS, Source Code parameters');
  return {
    spawn(b, e, a) {
      e.hitArea = Object.freeze({ ...p.box }); e.profile.noAttack = true; e.attackControlEpoch = (e.attackControlEpoch ?? 0) + 1;
      b.addBuff(e, { key: 'ab:prtsSource', persist: true, flags: { noMove: true, noDisplace: true, unblockable: true } });
      b.addBuff(e, { key: INV, persist: true, flags: { invulnerable: true } });
      Object.assign(a, { mode: 'default', sp: 0, spT: 0, cast: null, pending: false, deadlineAt: b.time + p.deadline, loseAt: null });
      pair(b).source = { unit: e, a, dizzy: () => { a.pending = true; } };
      b.on('damaged', c => { if (c.target === e && a.mode === 'dizzy' && c.amount > 0) a.sp += 1; }, { owner: e });
      // enemy_mpprts_dying_start[ON_BEFORE_TRY_SET_HP_ZERO]: the Mimic Machine goes with it, without a revive.
      b.on('death', c => { if (c.unit === e) pair(b).mimic?.sourceDied(); }, { owner: e });
    },
    tick(b, e, a, dt) {
      if (!e.alive) return;
      if (a.loseAt == null && b.time + 1e-9 >= a.deadlineAt) a.loseAt = b.time + p.loseDelay;
      if (a.loseAt != null && b.time + 1e-9 >= a.loseAt && b.life > 0) { b.life = 0; return; } // FinishGame LOSE
      e.mem.prtsSourceSp = a.mode === 'dizzy' ? Math.min(p.spCost, a.sp) : null;
      if (a.cast) {
        a.cast.t += dt;
        if (a.cast.t + 1e-9 < a.cast.length) return;
        const kind = a.cast.kind; a.cast = null;
        if (kind === 'begin') { a.mode = 'dizzy'; a.sp = 0; a.spT = 0; b.removeBuff(e, INV); } else a.mode = 'default';
        return;
      }
      if (a.mode === 'default') {
        if (!a.pending) return;
        a.pending = false; a.mode = 'falling'; a.cast = { kind: 'begin', t: 0, length: p.dizzyBegin }; e.skillAnimUntil = b.time + p.dizzyBegin;
        return;
      }
      if (a.mode !== 'dizzy') return;
      a.spT += dt;
      while (a.spT + 1e-9 >= p.spInterval) { a.spT -= p.spInterval; a.sp += 1; }
      if (a.sp + 1e-9 < p.spCost) return;
      // DizzyEnd: invincible at once, and the Mimic's downed state ends.
      a.mode = 'rising'; a.sp = 0; a.cast = { kind: 'end', t: 0, length: p.dizzyEnd }; e.skillAnimUntil = b.time + p.dizzyEnd;
      b.addBuff(e, { key: INV, persist: true, flags: { invulnerable: true } });
      pair(b).mimic?.revive();
    },
  };
}

const distToSegment = (px, py, x1, y1, x2, y2) => {
  const dx = x2 - x1, dy = y2 - y1, len = dx * dx + dy * dy;
  const t = len > 0 ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len)) : 0;
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
};

/** Mimic Machine. On the ground it seals deck cards, fires orbs and calls the hand to hold it in the air; a lethal hit
 * puts it down for PRTS, Source Code to recover (ATK +`stack.atk` each time) until PRTS, Source Code is defeated. */
export function mimicMachine(p) {
  if (!(p?.die >= 0 && p.revive >= 0 && p.dpInterval > 0 && p.stack?.max > 0 && p.seal?.cast >= p.seal.windUp && p.seal.count > 0
    && p.orb?.cast >= p.orb.windUp && p.orb.speed > 0 && p.orb.steps >= 0 && p.fly?.length === 2 && p.fly.every(f => f.duration > 0 && f.range > 0)
    && p.ray?.duration > 0 && p.ray.interval > 0 && p.takeOff?.preDelay >= 0 && p.land?.clip >= 0)) throw Error('Invalid Mimic Machine parameters');
  const hand = b => b.stagePrts?.hand?.alive && b.stagePrts.p?.hold ? b.stagePrts : null;
  const nodes = b => [...(b.stageWeakeningNodes?.entries?.values() ?? [])].filter(d => d.unit?.alive && !(d.state === 'active' && d.mode === 'ally')).slice(0, p.ray.maxNodes);
  const targets = b => b.allies().filter(live);
  const still = (b, e, on) => {
    e.profile.noAttack = on; e.attackControlEpoch = (e.attackControlEpoch ?? 0) + 1;
    if (on) b.addBuff(e, { key: STILL, persist: true, flags: { noMove: true } }); else b.removeBuff(e, STILL);
  };
  const clocks = (b, a) => {
    a.sealAt = b.time + p.seal.initial; a.orbAt = b.time + p.orb.initial;
    a.flyAt = b.time + p.fly[a.phase2 ? 1 : 0].initial; a.rayAt = a.phase2 ? b.time + p.ray.initial : null;
  };
  const dpBoost = (b, e, on) => { if (on) b.stageDpIntervalScale = p.dpInterval; else if (b.stageDpIntervalScale === p.dpInterval) b.stageDpIntervalScale = null; };

  // Write Restriction: the cards that are waiting, ready and not sealed; highest cost first, then the later card.
  const seal = (b, e, a) => {
    const rows = Object.entries(b.bench ?? {}).map(([id, entry], i) => ({ id, entry, i }))
      .filter(({ entry }) => !entry.unit?.alive && !entry.hidden && !entry.removedFromDeck && !entry.noCard && !(entry.readyAt > b.time) && !entry.deploymentLocks?.size)
      .sort((x, y) => b.cost(y.id) - b.cost(x.id) || y.i - x.i).slice(0, p.seal.count);
    for (const { entry } of rows) {
      const token = { owner: e, message: 'Sealed by the Mimic Machine.' };
      (entry.deploymentLocks ??= new Map()).set(token, token);
      a.seals.push({ until: b.time + p.seal.duration, entry, token });
    }
    a.sealed += rows.length;
  };
  const orbs = (b, e, a, dt) => {
    for (const o of a.orbs.splice(0)) {
      if (o.fuse != null) {
        o.fuse -= dt;
        if (o.fuse > 1e-9) { a.orbs.push(o); continue; }
        for (const u of b.alliesInRadius(o.x, o.y, o.radius + ALLY_COLLIDER_RADIUS)) if (live(u))
          b.dealDamage(e, u, { amount: o.atk * o.scale, type: 'arts', applyWay: 'ranged', isSkill: true, isSplash: true, tags: ['mimic:orb'] });
        b.fx?.('explode', { x: o.x, y: o.y, r: o.radius, kind: 'arts' });
        a.orbHits += 1;
        continue;
      }
      o.age += dt;
      if (o.age + 1e-9 >= p.orb.life) continue; // its life ends without a burst
      const k = Math.min(p.orb.steps, Math.floor((o.age + 1e-9) / p.orb.step));
      o.hit = p.orb.hit + p.orb.hitAdd * k; o.radius = p.orb.radius + p.orb.radiusAdd * k; o.scale = p.orb.scale + p.orb.scaleAdd * k;
      if (live(o.target)) { o.tx = o.target.x; o.ty = o.target.y; }
      const dx = o.tx - o.x, dy = o.ty - o.y, d = Math.hypot(dx, dy), step = p.orb.speed * dt;
      if (d <= step) { o.x = o.tx; o.y = o.ty; } else { o.x += dx / d * step; o.y += dy / d * step; }
      if (targets(b).some(u => Math.hypot(u.x - o.x, u.y - o.y) <= o.hit + ALLY_COLLIDER_RADIUS + 1e-9)) o.fuse = p.orb.fuse;
      a.orbs.push(o);
    }
  };
  const beams = (b, e, a) => {
    for (const d of a.fly.nodes) {
      if (!d.unit?.alive) continue;
      const dx = d.col - e.x, dy = d.row - e.y, len = Math.hypot(dx, dy) || 1;
      const x2 = d.col + dx / len * p.ray.extend, y2 = d.row + dy / len * p.ray.extend;
      for (const u of targets(b)) if (distToSegment(u.x, u.y, e.x, e.y, x2, y2) <= p.ray.width / 2 + ALLY_COLLIDER_RADIUS + 1e-9)
        b.dealDamage(e, u, { amount: e.s.atk * p.ray.scale, type: 'arts', applyWay: 'none', isSkill: true, tags: ['mimic:ray'] });
    }
  };
  /** Out of the air: the float and the flight's range, interval and target count go. */
  const grounded = (b, e, a) => {
    const f = a.fly; a.fly = null;
    b.removeBuff(e, AIR);
    if (f?.saved) { e.base.rangeRadius = f.saved.range; e.base.bat = f.saved.bat; e.profile.maxTargets = f.saved.targets; e.markDirty(); }
    return f;
  };
  const land = (b, e, a) => {
    if (a.mode !== 'fly') return;
    const f = grounded(b, e, a);
    a.mode = 'landing'; a.t = 0; a.landFor = p.land.settle + (f.kind === 'ray' ? p.land.rayClip : p.land.clip);
    still(b, e, true); e.skillAnimUntil = b.time + a.landFor;
    b.stagePrts?.releaseHold(e);
  };
  const takeFlight = (b, e, a) => {
    const kind = a.take.kind, spec = kind === 'ray' ? p.ray : p.fly[a.phase2 ? 1 : 0];
    a.take = null; a.mode = 'fly'; a.flights += 1;
    // The take-off skill lasts until the hand has hold of it (`_waitForAttachFinishEvent`); its cooldown is counted
    // from there [inference], which leaves cooldown - duration seconds on the ground between flights.
    if (kind === 'ray') a.rayAt = b.time + p.ray.cooldown; else a.flyAt = b.time + spec.cooldown;
    a.fly = { kind, left: spec.duration, threshold: Math.max(kind === 'ray' ? p.ray.minRatio : -Infinity, e.hp / e.s.maxHp + spec.hpOffset), nodes: [], rayT: 0 };
    // FLY, released from its blocker, and it cannot be downed in the air (UNDEADABLE, UNBALANCE_IMMUNE).
    b.addBuff(e, { key: AIR, persist: true, flags: { unblockable: true, float: true, noDisplace: true, undeadable: true } });
    still(b, e, false);
    if (kind === 'fly') {
      a.fly.saved = { range: e.base.rangeRadius, bat: e.base.bat, targets: e.profile.maxTargets };
      e.base.rangeRadius = spec.range; e.base.bat = Math.max(.1, e.base.bat + spec.bat); e.profile.maxTargets = spec.targets; e.markDirty();
      return;
    }
    e.profile.noAttack = true; e.attackControlEpoch = (e.attackControlEpoch ?? 0) + 1;
    a.fly.nodes = nodes(b);
    if (!a.fly.nodes.length) land(b, e, a); // Ray cannot cast: enemy_mpprme_fly_ray ends the flight at once
  };

  return {
    spawn(b, e, a) {
      Object.assign(a, { started: false, phase2: false, mode: 'ground', cast: null, take: null, fly: null, t: 0, stacks: 0, firstDown: false,
        orbs: [], seals: [], pendingSeals: [], sealed: 0, orbHits: 0, flights: 0, downs: 0, gone: false });
      pair(b).mimic = { unit: e, a,
        revive: () => { if (a.mode === 'down') { a.mode = 'reviving'; a.t = 0; dpBoost(b, e, false); e.skillAnimUntil = b.time + p.revive; } },
        sourceDied: () => { a.gone = true; dpBoost(b, e, false); b.removeBuff(e, DOWN); b.removeBuff(e, AIR); if (e.alive) b.kill(e, null); } };
      b.on('damaged', c => {
        if (c.target !== e || a.mode !== 'fly' || !(c.amount > 0)) return;
        // enemy_mpprme_fly[ON_TAKE_DAMAGE]: at or under the recorded ratio; [ON_BEFORE_TRY_SET_HP_ZERO]: a lethal hit.
        if (e.hp / e.s.maxHp <= a.fly.threshold + 1e-9 || e.hp <= 1 + 1e-9) land(b, e, a);
      }, { owner: e });
      b.on('death', c => {
        if (c.unit !== e) return;
        dpBoost(b, e, false); b.stagePrts?.releaseHold(e);
        for (const s of a.seals.splice(0)) s.entry.deploymentLocks?.delete(s.token);
      }, { owner: e });
    },
    /** Reborn: valid while PRTS, Source Code stands (`enemy_mpprts_canreborn`). */
    killed(c, b, e, a) {
      if (a.gone || !pair(b).source?.unit.alive || a.mode === 'down' || a.mode === 'reviving') return false;
      b.stagePrts?.releaseHold(e); // enemy_mpprme_mark: the pending hold order is dropped
      grounded(b, e, a);
      a.cast = null; a.take = null; a.mode = 'down'; a.t = 0; a.downStarted = false; a.downs += 1;
      e.hp = e.s.maxHp; e.skillAnimUntil = b.time + p.die;
      b.removeBuff(e, STILL);
      e.profile.noAttack = true; e.attackControlEpoch = (e.attackControlEpoch ?? 0) + 1;
      b.addBuff(e, { key: DOWN, persist: true, visible: true, flags: { invulnerable: true, noMove: true, disarm: true } });
      // enemy_mpprme_mark_p1 is not kept through the revive: only the first downing releases the wave.
      if (!a.firstDown) { a.firstDown = true; b.stageWaveScheduler?.releaseCurrentWave(e); }
      return true;
    },
    tick(b, e, a, dt) {
      if (!e.alive) return;
      for (const s of a.seals.splice(0)) if (b.time + 1e-9 >= s.until) s.entry.deploymentLocks?.delete(s.token); else a.seals.push(s);
      for (const at of a.pendingSeals.splice(0)) if (b.time + 1e-9 >= at) seal(b, e, a); else a.pendingSeals.push(at);
      orbs(b, e, a, dt);
      if (e.mem.prtsCarried) return; // the hand has not put it on the field yet
      if (!a.started) { a.started = true; clocks(b, a); }
      if (a.mode === 'down') {
        a.t += dt;
        if (!a.downStarted && a.t + 1e-9 >= p.die) {
          a.downStarted = true; a.stacks = Math.min(p.stack.max, a.stacks + 1);
          b.addBuff(e, { key: STACK, persist: true, visible: true, mods: { atkFlat: p.stack.atk * a.stacks } });
          dpBoost(b, e, true); pair(b).source?.dizzy();
        }
        return;
      }
      if (a.mode === 'reviving') {
        a.t += dt;
        if (a.t + 1e-9 < p.revive) return;
        a.mode = 'ground'; a.phase2 = true; b.removeBuff(e, DOWN);
        e.profile.noAttack = false; e.attackControlEpoch = (e.attackControlEpoch ?? 0) + 1; e.atkCd = 0;
        clocks(b, a); // its skills start over [inference: the card seal is cast again after each recovery]
        return;
      }
      if (a.mode === 'takeoff') {
        const k = a.take; k.t += dt;
        if (!k.called && k.t + 1e-9 >= p.takeOff.preDelay) {
          k.called = true;
          if (!hand(b)?.requestHold(e, () => { k.arriveAt = b.time + p.takeOff.arrive; })) {
            if (k.kind === 'ray') a.rayAt = b.time + p.ray.cooldown; else a.flyAt = b.time + p.fly[a.phase2 ? 1 : 0].cooldown;
            a.take = null; a.mode = 'ground'; still(b, e, false); return;
          }
        }
        if (k.arriveAt != null && b.time + 1e-9 >= k.arriveAt) takeFlight(b, e, a);
        return;
      }
      if (a.mode === 'fly') {
        const f = a.fly; f.left -= dt;
        if (f.kind === 'ray') { f.rayT -= dt; if (f.rayT <= 1e-9) { f.rayT += p.ray.interval; beams(b, e, a); } }
        if (a.mode === 'fly' && f.left <= 1e-9) land(b, e, a);
        return;
      }
      if (a.mode === 'landing') {
        a.t += dt;
        if (a.t + 1e-9 >= a.landFor) { a.mode = 'ground'; still(b, e, false); }
        return;
      }
      if (a.cast) {
        const c = a.cast; c.t += dt;
        if (!c.fired && c.t + 1e-9 >= c.windUp) {
          c.fired = true;
          if (c.kind === 'seal') a.pendingSeals.push(b.time + p.seal.flight + p.seal.delay);
          else {
            const t = targets(b).sort((x, y) => Math.hypot(x.x - e.x, x.y - e.y) - Math.hypot(y.x - e.x, y.y - e.y))[0];
            if (t) a.orbs.push({ x: e.x, y: e.y, tx: t.x, ty: t.y, target: t, age: 0, fuse: null, atk: e.s.atk, hit: p.orb.hit, radius: p.orb.radius, scale: p.orb.scale });
          }
        }
        if (c.t + 1e-9 >= c.length) { a.cast = null; still(b, e, false); }
        return;
      }
      // One skill at a time, the higher priority first: CardBoom 3, StartFlyRay 2, StartFly 1, FireBall 0.
      const cast = (kind, spec) => { a.cast = { kind, t: 0, windUp: spec.windUp, length: spec.cast, fired: false }; still(b, e, true); e.skillAnimUntil = b.time + spec.cast; };
      if (b.time + 1e-9 >= a.sealAt) { a.sealAt = b.time + p.seal.cooldown; cast('seal', p.seal); return; }
      const up = kind => { a.mode = 'takeoff'; a.take = { kind, t: 0, called: false, arriveAt: null }; still(b, e, true); };
      if (a.rayAt != null && b.time + 1e-9 >= a.rayAt && hand(b) && nodes(b).length) { a.rayAt = Infinity; up('ray'); return; }
      if (b.time + 1e-9 >= a.flyAt && hand(b)) { a.flyAt = Infinity; up('fly'); return; }
      if (b.time + 1e-9 >= a.orbAt && targets(b).length) { a.orbAt = b.time + p.orb.cooldown; cast('orb', p.orb); }
    },
  };
}
