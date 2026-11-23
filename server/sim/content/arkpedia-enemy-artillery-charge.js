// SPDX-License-Identifier: GPL-3.0-or-later
// Sarkaz artillery chargers. Every number arrives in `p` from the reviewed contract
// (shared/arkpedia/enemy-artillery-charge-features.js). Both use battle.chargeStageArtillery (modify_sp[start] on the
// first gunctrl unit in stage order; a no-op without one).

const pos = v => Number.isFinite(v) && v > 0;
const CAST = 'ab:artificerCharge';

/** Drone: every attack cast on a target charges the artillery by `sp`. */
export function droneArtilleryCharge(p) {
  if (!pos(p?.sp)) throw Error('Invalid drone charge parameters');
  return {
    attack(c, b) { for (const t of c.targets ?? []) if (t) b.chargeStageArtillery?.(p.sp); },
  };
}

/** Artificer: once its SP fills, a link to the artillery that adds `sp` every `interval` for `link` s. An interruption
 * (stun, freeze, levitation, or silence at the end) costs the artillery `penalty`. */
export function artificerArtilleryCharge(p) {
  if (!pos(p?.maxSp) || !(p.initSp >= 0) || !pos(p.increment) || !(p.preDelay >= 0) || !pos(p.link) || !pos(p.interval) || !pos(p.sp)
    || !(p.penalty < 0) || !(p.postDelay >= 0)) throw Error('Invalid artificer charge parameters');
  const end = (b, e, a, interrupted) => {
    if (interrupted || e.s.flags.silence) b.chargeStageArtillery?.(p.penalty);
    a.cast = null; e.profile.noAttack = a.priorNoAttack; e.skillAnimUntil = b.time; b.removeBuff(e, CAST);
    if (e.mem.regularFormVisual?.playId === `dmech:${e.id}`) e.mem.regularFormVisual = null;
  };
  return {
    spawn(b, e, a) { a.sp = p.initSp; a.used = false; a.cast = null; },
    tick(b, e, a, dt) {
      if (!e.alive) return;
      if (a.cast) {
        const c = a.cast;
        if (!e.canAct || e.s.flags.freeze || e.s.flags.levitate) { end(b, e, a, true); return; }
        c.elapsed += dt;
        // the link reaches at once after the pre-delay and re-hits every `interval` until it expires
        while (c.nextHit != null && c.elapsed + 1e-9 >= c.nextHit && c.nextHit < p.preDelay + p.link - 1e-9) {
          b.chargeStageArtillery?.(p.sp); c.nextHit += p.interval;
        }
        if (c.elapsed + 1e-9 >= p.preDelay + p.link + p.postDelay) end(b, e, a, false);
        return;
      }
      if (a.used) return;
      a.sp = Math.min(p.maxSp, a.sp + p.increment * dt);
      if (a.sp + 1e-9 < p.maxSp || !e.canAct || e.s.flags.silence || !b.mvpStageDevices?.some(d => d.key === 'trap_058_gunctrl')) return;
      a.used = true; a.sp = 0; a.priorNoAttack = e.profile.noAttack;
      a.cast = { elapsed: 0, nextHit: p.preDelay };
      e.attackControlEpoch = (e.attackControlEpoch ?? 0) + 1;
      e.profile.noAttack = true; e.skillAnimUntil = b.time + p.preDelay + p.link + p.postDelay;
      e.mem.regularFormVisual = { clip: 'Skill_Loop', loop: true, speed: 1, playId: `dmech:${e.id}` };
      b.addBuff(e, { key: CAST, persist: true, flags: { noMove: true } });
    },
    death(_c, b, e, a) { if (a.cast) { a.cast = null; b.removeBuff(e, CAST); } },
  };
}
