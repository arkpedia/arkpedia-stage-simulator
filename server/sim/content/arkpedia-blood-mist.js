// SPDX-License-Identifier: GPL-3.0-or-later
// Blood Mist and Blood Surge, shared by the Throne of Blood and both of Duq'arael's forms. Numbers arrive from the
// reviewed contracts (shared/arkpedia/stage-blood-throne.js, enemy-blood-lord-features.js).
// - Blood Mist (projectile_enemy_blord_s[fog], enemy_blord_fog_buffs): a circle of `radius` for `lifetime` s. Each unit
//   that touches it is hit once (`_maxHitNum` 1) and keeps the effect until that mist ends, also outside it
//   (`_detachBuffsWhenTargetLeave` 0, `_detachAllBuffsWhenStopped` 1). Blood Amber (enemy_bldore_mark) leaves at once
//   and, `spawnDelay` s later, a Bloodborn Spawn takes its place and route (enemy_blord_fog_spawn). An operator gets
//   ASPD `aspd` and Arts damage without a source every 1 s from the hit (first tick at once), rising linearly from `base`
//   to `base + add` over `ramp` s; leaving the field meanwhile multiplies that redeployment by `redeploy`
//   (enemy_blord_fog_respawn, UNTIL_NEXT_SPAWN). A unit already under a mist is not hit again by another (PRTS: the
//   effects do not stack; an inference for the timing: the first mist's clock and end hold).
// - The redeployment penalty is shared with Blood Affliction (PRTS: they do not stack): one buff, held while either is.
// - Blood Surge (FountainDamage, projectile_enemy_blord_s[stun]): one operator, preferring those this round has not hit
//   (the round mark; PRTS "优先"), at random; Arts damage without a source and a stun to every operator on the x-5 cross
//   around its tile; hit ones lose the round mark.
import { remainingRoute, spawnChildren } from './arkpedia-enemy-spawn.js';
import { BLOOD_AMBER_KEY } from '../../../shared/arkpedia/stage-blood-throne.js';

const MIST = 'bloodMist', REDEPLOY = 'bloodMist:redeploy';
const live = u => u?.alive && u.deployed !== false && !u.hidden;
const isAmber = e => e.defId === BLOOD_AMBER_KEY || e.def?.key === BLOOD_AMBER_KEY;
const pos = v => Number.isFinite(v) && v > 0;

export function validMist(p) {
  return pos(p?.lifetime) && pos(p.radius) && p.base >= 0 && p.add >= 0 && pos(p.ramp) && Number.isFinite(p.aspd) && p.redeploy >= 1
    && pos(p.spawnDelay) && typeof p.spawnEnemy === 'string';
}

/** The redeployment penalty (×`mul`) while any holder lasts; one buff, so mist and Affliction never stack. */
export function holdRedeploy(b, u, holder, mul) {
  const set = u.mem.bloodRedeploy ??= new Set();
  set.add(holder);
  if (!u.findBuff(REDEPLOY)) b.addBuff(u, { key: REDEPLOY, persist: true, mods: { redeployMul: mul } });
}
export function releaseRedeploy(b, u, holder) {
  const set = u.mem.bloodRedeploy;
  if (!set?.delete(holder) || set.size) return;
  b.removeBuff(u, REDEPLOY);
}

/** Damage of the ramp at `t` s after its start. */
export const rampDamage = (p, t) => p.base + p.add * Math.min(1, Math.max(0, t) / p.ramp);

export class BloodMists {
  constructor(b) {
    this.battle = b; this.mists = []; this.released = 0; this.conversions = 0;
    b.on('tick', () => this.tick());
  }
  /** Release a mist centred on (x, y). Returns it. */
  release(source, x, y, p) {
    if (!validMist(p)) throw Error('Invalid Blood Mist parameters');
    const b = this.battle, m = { source, x, y, p, end: b.time + p.lifetime, hit: new Set(), affected: new Set() };
    this.mists.push(m); this.released++;
    b.fx('telegraph', { x, y, r: p.radius, kind: 'bloodMist' });
    this.sweep(m);
    return m;
  }
  tick() {
    const b = this.battle;
    for (const m of [...this.mists]) {
      for (const u of [...m.affected]) if (!live(u)) this.clear(u, m); else this.hurt(u, m);
      if (b.time + 1e-9 >= m.end) { this.expire(m); continue; }
      this.sweep(m);
    }
  }
  inside(m, u) { return (u.x - m.x) ** 2 + (u.y - m.y) ** 2 <= m.p.radius ** 2 + 1e-9; }
  sweep(m) {
    const b = this.battle;
    for (const e of b.enemies) if (live(e) && isAmber(e) && !m.hit.has(e) && this.inside(m, e)) { m.hit.add(e); this.convert(e, m); }
    for (const u of b.allies()) if (live(u) && !m.hit.has(u) && this.inside(m, u)) { m.hit.add(u); this.affect(u, m); }
  }
  /** enemy_blord_fog_spawn: the Amber leaves now; a Bloodborn Spawn takes its place and route `spawnDelay` s later. */
  convert(e, m) {
    const b = this.battle, route = remainingRoute(e), at = [e.y, e.x];
    b.kill(e, null); this.conversions++;
    const spawn = () => spawnChildren(b, e, m.p.spawnEnemy, 1, { route, pos: at, mods: {}, countInTotal: false });
    if (b.stageWaveScheduler) b.stageWaveScheduler.scheduleSummon(e, m.p.spawnDelay, spawn);
    else b.after(m.p.spawnDelay, spawn, { holdsBattle: true });
  }
  affect(u, m) {
    const b = this.battle;
    if (u.mem.bloodMist) return; // already under another mist: not stacked
    u.mem.bloodMist = m; m.affected.add(u);
    b.addBuff(u, { key: MIST, visible: true, mods: { aspd: m.p.aspd } });
    holdRedeploy(b, u, m, m.p.redeploy);
    // Ticks 1 s apart from the hit (the first at once); the one due at the mist's own end is not dealt, since the effect
    // detaches with the stopped mist.
    (m.ticks ??= new Map()).set(u, { start: b.time, next: b.time });
    this.hurt(u, m);
  }
  hurt(u, m) {
    const b = this.battle, t = m.ticks?.get(u);
    while (t && live(u) && b.time + 1e-9 >= t.next && t.next + 1e-9 < m.end) {
      b.dealDamage(null, u, { amount: rampDamage(m.p, t.next - t.start), type: 'arts', sourceless: true, noSp: true, canDodge: false,
        applyWay: 'none', tags: ['periodic', 'bloodMist'] });
      t.next += 1;
    }
  }
  clear(u, m) {
    const b = this.battle;
    m.affected.delete(u); m.ticks?.delete(u);
    if (u.mem.bloodMist !== m) return;
    u.mem.bloodMist = null;
    b.removeBuff(u, MIST);
    releaseRedeploy(b, u, m);
  }
  expire(m) {
    this.mists = this.mists.filter(x => x !== m);
    for (const u of [...m.affected]) this.clear(u, m);
  }
}
export const bloodMists = b => b.bloodMists ??= new BloodMists(b);

/** One Blood Surge round: `count` hits, every `interval` s from its start (the first after one interval). */
export class BloodSurgeRound {
  constructor(b, source, p) {
    if (!(pos(p?.interval) && pos(p.duration) && pos(p.stun) && Array.isArray(p.cross) && (pos(p.damage) || pos(p.scale))))
      throw Error('Invalid Blood Surge parameters');
    this.battle = b; this.source = source; this.p = p; this.hit = new Set(); this.hits = 0; this.t = 0;
    this.count = Math.floor(p.duration / p.interval + 1e-9);
  }
  /** Advance `dt`; false once the round is over (hits at interval, 2 x interval, ... up to the duration). */
  tick(dt) {
    this.t += dt;
    while (this.hits < this.count && this.t + 1e-9 >= (this.hits + 1) * this.p.interval) this.fire();
    return this.hits < this.count && this.t + 1e-9 < this.p.duration;
  }
  fire() {
    const b = this.battle, ops = b.allies().filter(live);
    if (!ops.length) { this.hits++; return null; }
    const fresh = ops.filter(u => !this.hit.has(u)), pool = fresh.length ? fresh : ops;
    const target = pool[pool.length === 1 ? 0 : b.rng.int(pool.length)];
    const r = Math.round(target.y), c = Math.round(target.x);
    const tiles = new Set(this.p.cross.map(([dr, dc]) => `${r + dr},${c + dc}`));
    const amount = this.p.damage ?? this.source.s.atk * this.p.scale;
    for (const u of ops) {
      if (!tiles.has(`${Math.round(u.y)},${Math.round(u.x)}`)) continue;
      this.hit.add(u);
      b.dealDamage(null, u, { amount, type: 'arts', sourceless: true, isSkill: true, applyWay: 'none', tags: ['bloodSurge'] });
      if (u.alive) b.applyStatus(u, 'stun', { duration: this.p.stun, source: this.source });
    }
    this.hits++;
    b.fx('telegraph', { x: c, y: r, r: 1, kind: 'bloodSurge' });
    return target;
  }
}
