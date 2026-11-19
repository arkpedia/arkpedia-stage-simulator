// SPDX-License-Identifier: GPL-3.0-or-later
// Lost Colossus (enemy_2003_rockman), Jetman (enemy_2004_balloon) and Wandering Puppet (enemy_2013_csbot).
// Every number arrives in `p` from the reviewed contracts (shared/arkpedia/enemy-phantom-midboss-features.js).
import { canTargetAlly } from '../targeting.js';
import { ALLY_COLLIDER_RADIUS } from '../constants.js';

const live = u => u?.alive && u.deployed !== false && !u.hidden;
const pos = v => Number.isFinite(v) && v > 0;
const anim = x => pos(x?.dur) && pos(x.hit) && x.hit <= x.dur;
const stunned = u => u.buffs.some(x => x.status === 'stun');

/** Lost Colossus: a melee attack, and every 13 s a rock (70% ATK Physical, Stun) at an operator in reach with no Stun. */
export function lostColossus(p) {
  const r = p?.rock;
  if (!anim(p?.attack?.anim) || !pos(r?.cooldown) || !(r.initial >= 0) || !pos(r.range) || !pos(r.scale) || !pos(r.stun) || !pos(r.speed) || !anim(r.anim))
    throw Error('Invalid Lost Colossus parameters');
  const CAST = 'ab:rockmanCast';
  // The StunAttack selector: ground or aerial operators within the 2.5 trigger, excluding any unit with the stun buff;
  // its _postFilter 11 is read as the nearest one.
  const target = (b, e) => b.alliesInRadius(e.x, e.y, r.range + ALLY_COLLIDER_RADIUS)
    .filter(u => live(u) && canTargetAlly(e, u, true) && !stunned(u))
    .sort((x, y) => Math.hypot(x.x - e.x, x.y - e.y) - Math.hypot(y.x - e.x, y.y - e.y))[0] ?? null;
  const finish = (b, e, a) => { a.cast = null; e.profile.noAttack = false; e.skillAnimUntil = b.time; b.removeBuff(e, CAST); };
  return {
    spawn(b, e, a) { a.cast = null; a.left = r.initial; e.def = { ...e.def, attackAnim: p.attack.anim }; },
    tick(b, e, a, dt) {
      if (!e.alive) return;
      a.left -= dt; // the cooldown runs from the cast start
      if (a.cast) {
        a.cast.elapsed += dt * e.s.slowDownRate;
        if (!a.cast.released && a.cast.elapsed + 1e-9 >= r.anim.hit) {
          a.cast.released = true;
          const t = a.cast.target;
          if (live(t)) b.addProjectile({ from: e, target: t, speed: r.speed, visual: 'enemy', source: e, onHit: c => {
            const hit = c.target;
            if (!hit?.alive) return;
            b.dealDamage(e, hit, { amount: e.s.atk * r.scale, type: 'phys', isSkill: true, applyWay: 'ranged', tags: ['rockmanRock'] });
            if (hit.alive) b.applyStatus(hit, 'stun', { duration: r.stun, source: e });
          } });
        }
        if (a.cast.elapsed + 1e-9 >= r.anim.dur) finish(b, e, a);
        return;
      }
      if (a.left > 1e-9 || !e.canAct) return;
      const t = target(b, e);
      if (!t) return;
      a.left = r.cooldown;
      a.cast = { target: t, elapsed: 0, released: false };
      e.profile.noAttack = true; e.skillAnimUntil = b.time + r.anim.dur;
      b.addBuff(e, { key: CAST, persist: true, flags: { noMove: true } });
    },
  };
}

/** Jetman: armed every 25 s; armed and blocked, he takes off for 7 s (aerial, block-free, faster, no attacks). */
export function jetman(p) {
  const t = p?.takeOff;
  if (!anim(p?.attack?.anim) || !pos(t?.cooldown) || !(t.initial >= 0) || !pos(t.check) || !pos(t.fly?.dur) || !Number.isFinite(t.fly.movePct)
    || !pos(t.rise?.dur) || !pos(t.rise.moveMul) || !pos(t.land?.dur) || !pos(t.land.moveMul)) throw Error('Invalid Jetman parameters');
  const FLY = 'balloon_s[fly]', RISE = 'balloon_s[take_off]', LAND = 'balloon_s[land]';
  const land = (b, e, a) => {
    a.flying = false;
    if (!e.alive) return;
    e.motion = 'WALK'; e.profile.noAttack = false;
    b.addBuff(e, { key: LAND, duration: t.land.dur, visible: true, flags: { unblockable: true }, mods: { moveMul: t.land.moveMul } });
  };
  const takeOff = (b, e, a) => {
    a.armed = false; a.flying = true;
    // balloon_s[fly]: motion FLY and the Fly mode (no attack; the restarted state machine drops the attack under way).
    e.motion = 'FLY'; e.profile.noAttack = true;
    e.attackControlEpoch = (e.attackControlEpoch ?? 0) + 1;
    b.addBuff(e, { key: FLY, duration: t.fly.dur, visible: true, flags: { unblockable: true }, mods: { movePct: t.fly.movePct },
      onExpire: ({ battle }) => land(battle, e, a) });
    b.addBuff(e, { key: RISE, duration: t.rise.dur, mods: { moveMul: t.rise.moveMul } });
    b._unblock(e);
  };
  return {
    spawn(b, e, a) {
      a.armLeft = t.initial; a.armed = false; a.checkLeft = 0; a.flying = false;
      e.def = { ...e.def, attackAnim: p.attack.anim };
    },
    tick(b, e, a, dt) {
      if (!e.alive) return;
      a.armLeft -= dt;
      // TakeOff (self selector) casts whenever it is ready and he can act; a waiting balloon_s[trigger] is not doubled.
      if (a.armLeft <= 1e-9 && e.canAct) {
        a.armLeft = t.cooldown;
        if (!a.armed) { a.armed = true; a.checkLeft = t.check; }
      }
      if (!a.armed) return;
      a.checkLeft -= dt;
      while (a.armed && a.checkLeft <= 1e-9) {
        a.checkLeft += t.check;
        if (e.blockedBy) takeOff(b, e, a);
      }
    },
  };
}

/** Wandering Puppet: while not blocked, every operator on the map takes `damage` Arts per second (one aura per operator). */
export function wanderingPuppet(p) {
  const s = p?.poison;
  if (!anim(p?.attack?.anim) || !pos(s?.damage) || !pos(s.interval)) throw Error('Invalid Wandering Puppet parameters');
  const KEY = 'enemy_csbot_t';
  const playing = e => e.alive && !e.removed && e.deployed !== false && !e.hidden && !e.blockedBy;
  const clear = (b, e) => { for (const u of b.allies(null)) { const x = u.findBuff(KEY); if (x?.data?.src === e) b.removeBuff(u, x); } };
  return {
    spawn(b, e, a) { a.playing = false; e.def = { ...e.def, attackAnim: p.attack.anim }; },
    tick(b, e, a) {
      const on = playing(e);
      if (!on) { if (a.playing) clear(b, e); a.playing = false; return; }
      a.playing = true;
      // One shared key, one stack and disableOverride: an operator keeps the first puppet's buff; another puppet's lands
      // only after that one is removed (its puppet blocked or gone).
      for (const u of b.allies(null)) {
        if (!live(u) || u.findBuff(KEY)) continue;
        b.addBuff(u, { key: KEY, source: e, persist: true, visible: true, interval: s.interval, data: { src: e },
          onTick: ({ battle, unit, buff }) => {
            if (!playing(buff.data.src)) { battle.removeBuff(unit, buff); return; }
            battle.dealDamage(null, unit, { amount: s.damage, type: 'arts', sourceless: true, noSp: true, canDodge: false,
              ignoreSelect: true, tags: ['csbotPoison'] });
          } });
      }
    },
  };
}
