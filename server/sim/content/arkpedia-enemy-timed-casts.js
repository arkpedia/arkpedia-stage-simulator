// SPDX-License-Identifier: GPL-3.0-or-later
/** Prioritized independent cooldowns with one active cast. Content supplies
 * selection, release effects and source clocks; interruption owns cleanup. */
export function timedEnemyCasts(specs, { flags = {}, immunities = [], silenceable = true, canCast = () => true, beforeCast = () => {} } = {}) {
  const finish = (b, e, a) => {
    if (a.cast && specs[a.cast.index].cooldownFromEnd) a.clocks[a.cast.index] = specs[a.cast.index].cooldown;
    if (a.cast) e.profile.noAttack = a.cast.previousNoAttack;
    a.cast = null; e.mem.regularFormVisual = null;
    b.removeBuff(e, 'ab:timedCast'); e.skillAnimUntil = b.time;
  };
  return {
    spawn(b, e, a) {
      a.clocks = specs.map(s => s.initial); a.sequence = 0;
      a.off = b.on('beforeStatus', c => {
        if (c.target === e && a.cast && immunities.includes(c.status)) c.cancel = true;
      });
    },
    tick(b, e, a, dt) {
      a.clocks = a.clocks.map(left => left - dt);
      if (a.cast) {
        if (!e.canAct || silenceable && e.s.flags.silence || !canCast(b,e)) { finish(b, e, a); return; }
        const c = a.cast, spec = specs[c.index]; c.elapsed += dt * (spec.slowDown ? e.s.slowDownRate : 1);
        if (spec.slowDown && e.mem.regularFormVisual) e.mem.regularFormVisual.speed = e.s.slowDownRate;
        if (!c.released && c.elapsed + 1e-9 >= spec.release) {
          c.released = true; spec.fire(b, e, c.targets);
        }
        e.skillAnimUntil = b.time + Math.max(0, spec.duration - c.elapsed) / (spec.slowDown ? Math.max(.001, e.s.slowDownRate) : 1);
        if (c.elapsed + 1e-9 >= spec.duration) finish(b, e, a);
        return;
      }
      if (!e.canAct || silenceable && e.s.flags.silence || !canCast(b,e)) return;
      for (let i = 0; i < specs.length; i++) {
        if (a.clocks[i] > 1e-9) continue;
        const s = specs[i], targets = s.select(b, e);
        if (!targets.length && s.requiresTargets !== false) continue;
        beforeCast(b,e,i);if(!e.alive||!e.deployed)return;
        a.clocks[i] = s.cooldown; a.cast = { index: i, elapsed: 0, released: false, targets, previousNoAttack: e.profile.noAttack }; a.sequence++;
        e.profile.noAttack = true; e.attackControlEpoch = (e.attackControlEpoch ?? 0) + 1;
        b.addBuff(e, { key: 'ab:timedCast', flags: { noMove: true, ...flags } });
        e.mem.regularFormVisual = { clip: s.clip, loop: false, speed: s.slowDown ? e.s.slowDownRate : 1, playId: `cast:${a.sequence}` };
        e.skillAnimUntil = b.time + s.duration / (s.slowDown ? Math.max(.001, e.s.slowDownRate) : 1);
        break;
      }
    },
    status(_c, b, e, a) { if (a.cast && (!e.canAct || silenceable && e.s.flags.silence || !canCast(b,e))) finish(b, e, a); },
    death(_c, b, e, a) { finish(b, e, a); b.off(a.off); },
  };
}
