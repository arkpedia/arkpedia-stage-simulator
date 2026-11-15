// SPDX-License-Identifier: GPL-3.0-or-later
import { holdDeploymentCard } from './arkpedia-card-locks.js';
import { ordinaryMeleeSequence } from './arkpedia-enemy-melee-sequence.js';
const eligible = (e, u) => u && e.blockedBy === u && u.alive && u.deployed && !u.hidden
  && !u.isFlying && !u.s.flags.liftoff && u.kind !== 'device' && u.def.profession !== 'TRAP'
  && !u.tags.has('DEVOUR_IMMU');
export function witherDevourer(p) {
  const melee = ordinaryMeleeSequence((_b, _e, a) => p.attacks[a.strong ? 1 : 0]);
  const stance = (e, a) => ({ clip: e.moving ? a.strong ? 'Move_B' : 'Move_A' : a.strong ? 'Idle_B' : 'Idle_A',
    move: a.strong ? 'Move_B' : 'Move_A', idle: a.strong ? 'Idle_B' : 'Idle_A',
    die: a.strong ? 'Die_B' : 'Die_A', replace: true });
  const finish = (b, e, a) => {
    if (!a.devour) return;
    e.profile.noAttack = a.devour.previousNoAttack; a.devour = null;
    b.removeBuff(e, 'ab:devourCast'); e.skillAnimUntil = b.time; e.atkCd = e.s.interval;
    e.mem.regularFormVisual = stance(e, a);
  };
  const begin = (b, e, a) => {
    if (a.used || a.devour || !e.canAct || !eligible(e, e.blockedBy)) return false;
    melee.cancel(b, e, a);
    const target = e.blockedBy;
    a.devour = { target, life: target.deploySeq, elapsed: 0, previousNoAttack: e.profile.noAttack };
    e.profile.noAttack = true; b.addBuff(e, { key: 'ab:devourCast', flags: { noMove: true } });
    e.mem.regularFormVisual = { clip: 'Attack_A', loop: false, speed: e.s.slowDownRate,
      die: 'Die_A', playId: `devour:${++a.sequence}` };
    e.skillAnimUntil = b.time + p.duration / Math.max(.001, e.s.slowDownRate);
    return true;
  };
  return { ...melee,
    spawn(b, e, a) { melee.spawn(b, e, a); a.used = false; a.strong = false;
      e.def = { ...e.def, attackAnim: { dur: p.attacks[0].duration, hit: p.attacks[0].releases[0] } };
    },
    blocked(_c, b, e, a) { begin(b, e, a); },
    before(c, b, e, a) { if (begin(b, e, a) || a.devour) c.targets = []; },
    tick(b, e, a, dt) {
      if (!a.devour) begin(b, e, a);
      const cast = a.devour;
      if (cast) {
        const u = cast.target;
        if (!e.canAct || !cast.released && (!eligible(e, u) || u.deploySeq !== cast.life)) { finish(b, e, a); return; }
        cast.elapsed += dt * e.s.slowDownRate;
        e.mem.regularFormVisual.speed = e.s.slowDownRate;
        if (!cast.released && cast.elapsed + 1e-7 >= p.release) {
          cast.released = true; a.used = true;
          a.releaseCard = holdDeploymentCard(b, u, e, { message: 'Devoured: defeat the Wither Devourer to recover this operator.', readyOnRelease: true });
          // InstantKill deliberately keeps the core rebirth path.
          b.kill(u, e);
          if (!e.alive) return;
          a.strong = true;
          b.addBuff(e, { key: 'enemy_nhkodo_buff', persist: true, mods: { defFlat: p.def, movePct: p.move } });
          e.def = { ...e.def, attackAnim: { dur: p.attacks[1].duration, hit: p.attacks[1].releases[0] } };
          // Native switch_mode_no_restore restarts the FSM at release.
          finish(b, e, a); return;
        }
        e.skillAnimUntil = b.time + Math.max(0, p.duration - cast.elapsed) / Math.max(.001, e.s.slowDownRate);
        if (cast.elapsed + 1e-7 >= p.duration) finish(b, e, a);
        return;
      }
      melee.tick(b, e, a);
      if (!a.cast) e.mem.regularFormVisual = stance(e, a);
    },
    status(c, b, e, a) { if (a.devour && !e.canAct) finish(b, e, a); melee.status(c, b, e, a); },
    death(c, b, e, a) { finish(b, e, a); melee.death(c, b, e, a); a.releaseCard?.();
      e.mem.regularFormVisual = { clip: a.strong ? 'Die_B' : 'Die_A', die: a.strong ? 'Die_B' : 'Die_A', loop: false };
    },
  };
}
