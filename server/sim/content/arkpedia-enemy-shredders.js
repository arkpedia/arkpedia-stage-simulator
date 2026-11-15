// SPDX-License-Identifier: GPL-3.0-or-later
/** Ordinary attacks charge a separate, silenceable tile-destruction skill.
 * Both casts use the retained model events; terrain mutation is battle-owned. */
export function stumpShredder(p) {
  const finish = (b, e, a) => {
    a.cast = null; e.profile.noAttack = false; e.skillAnimUntil = b.time;
    e.mem.regularFormVisual = null; b.removeBuff(e, 'ab:shredderCast');
  };
  const start = (b, e, a, target, skill) => {
    const dy = (skill ? target.row : target.y) - e.y;
    const clip = dy > .1 ? 'Attack_Up' : dy < -.1 ? 'Attack_Down' : 'Attack';
    a.cast = { target, skill, clip, elapsed: 0, released: false, attackId: b._attackSeq };
    e.profile.noAttack = true;
    b.addBuff(e, { key: 'ab:shredderCast', flags: { noMove: true } });
    e.mem.regularFormVisual = { clip, loop: false, playId: `shredder:${++a.sequence}`, speed: 1 };
    e.skillAnimUntil = b.time + p.animations[clip].dur;
  };
  const interrupted = (e, cast) => !e.canAct || e.mem.regularShift || e.s.flags.disarm || cast.skill && e.s.flags.silence;
  return {
    spawn(b, e, a) {
      a.sp = p.initialSp; a.sequence = 0; e.mem.stumpShredder = a;
      e.profile.melee = false; e.base.rangeRadius = p.attackRadius;
      e.profile.deferHit = true; e.profile.canTarget = u => !u.isFlying;
      e.def = { ...e.def, attackAnim: p.animations.Attack };
    },
    attack(c, b, e, a) { if (!a.cast && c.targets[0]) start(b, e, a, c.targets[0], false); },
    tick(b, e, a, dt) {
      const cast = a.cast;
      if (cast) {
        if (interrupted(e, cast)) { finish(b, e, a); return; }
        const speed = e.s.slowDownRate * (cast.skill ? 1 : Math.min(1, e.base.bat / e.s.interval));
        const anim = p.animations[cast.clip]; cast.elapsed += dt * speed;
        e.mem.regularFormVisual.speed = speed;
        e.skillAnimUntil = b.time + Math.max(0, anim.dur - cast.elapsed) / Math.max(.001, speed);
        if (!cast.released && cast.elapsed + 1e-9 >= anim.hit) {
          cast.released = true;
          if (cast.skill) b.stageScenery?.destroyStump(cast.target.row, cast.target.col, e);
          else {
            const target = cast.target;
            if (target.alive && target.deployed) b.dealDamage(e, target, { amount: e.s.atk, type: 'phys',
              applyWay: 'melee', isAttack: true, attackId: cast.attackId });
            a.sp = Math.min(p.spCost, a.sp + p.increment);
          }
        }
        if (cast.elapsed + 1e-9 >= anim.dur) finish(b, e, a);
        return;
      }
      if (a.sp < p.spCost || !e.canAct || e.mem.regularShift || e.s.flags.silence || e.s.flags.disarm) return;
      const target = b.rng.pick(b.stageScenery?.destructibleStumps(e, p.skillRadius) ?? []);
      if (!target) return;
      a.sp -= p.spCost; start(b, e, a, target, true);
    },
    status(_c, b, e, a) { if (a.cast && interrupted(e, a.cast)) finish(b, e, a); },
    death(_c, b, e, a) { finish(b, e, a); },
  };
}
