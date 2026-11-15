// SPDX-License-Identifier: GPL-3.0-or-later
/** Ordinary attacks retain the core attack receipt and cooldown while
 * resolving each original animation marker against captured deployments.
 * Content supplies the melee or projectile release action. */
export function ordinaryEnemyAttackSequence(select, fire) {
  const key = 'ab:ordinaryMeleeSequence';
  const finish = (b, e, a) => {
    if (!a.cast) return;
    a.cast = null; e.profile.noAttack = a.priorNoAttack;
    e.mem.regularFormVisual = null; e.skillAnimUntil = b.time; b.removeBuff(e, key);
  };
  return {
    cancel: finish,
    spawn(_b, e, a) { e.profile.deferHit = true; e.profile.shot = 'none'; a.sequence = 0; },
    attack(c, b, e, a) {
      const target = c.targets[0], animation = select(b, e, a);
      if (!target) return;
      a.priorNoAttack = e.profile.noAttack;
      a.cast = { target, life: target.deploySeq, targets: c.targets.map(unit => ({ unit, life: unit.deploySeq })), attackId: b._attackSeq, animation,
        elapsed: 0, last: b.time, index: 0 };
      e.profile.noAttack = true; b.addBuff(e, { key, flags: { noMove: true } });
      e.mem.regularFormVisual = { clip: animation.clip, loop: false, speed: e.s.slowDownRate,
        playId: `ordinaryMelee:${++a.sequence}` };
      e.skillAnimUntil = b.time + animation.duration / Math.max(.001, e.s.slowDownRate);
    },
    tick(b, e, a) {
      const c = a.cast; if (!c) return;
      if (!e.canAct || e.s.flags.disarm || e.s.flags.fear) { finish(b, e, a); return; }
      c.elapsed += (b.time - c.last) * e.s.slowDownRate; c.last = b.time;
      e.mem.regularFormVisual.speed = e.s.slowDownRate;
      while (a.cast === c && c.index < c.animation.releases.length
        && c.elapsed + 1e-7 >= c.animation.releases[c.index]) {
        c.index++;
        for (const { unit: u, life } of c.targets) {
          if (u.alive && u.deployed && !u.hidden && u.deploySeq === life) fire(b, e, u, c);
          if (!e.alive) return;
        }
      }
      if (a.cast !== c) return;
      e.skillAnimUntil = b.time + Math.max(0, c.animation.duration - c.elapsed) / Math.max(.001, e.s.slowDownRate);
      if (c.elapsed + 1e-7 >= c.animation.duration) finish(b, e, a);
    },
    status(_c, b, e, a) { if (!e.canAct) finish(b, e, a); },
    death(_c, b, e, a) { finish(b, e, a); },
  };
}

/** Shared data contract for adapters driven by native animation markers. */
export function validateEnemyAttackAnimation(animation){
  if(!animation||typeof animation.clip!=='string'||!animation.clip||!Number.isFinite(animation.duration)||animation.duration<=0
    ||!Array.isArray(animation.releases)||!animation.releases.length||animation.releases.length>64
    ||animation.releases.some((t,i)=>!Number.isFinite(t)||t<0||t>animation.duration||i>0&&t<=animation.releases[i-1]))
    throw Error('Invalid enemy attack animation');
}
