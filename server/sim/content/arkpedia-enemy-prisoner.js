// SPDX-License-Identifier: GPL-3.0-or-later
import { ordinaryEnemyAttackSequence } from './arkpedia-enemy-attack-sequence.js';
import { projectileSingleAttack } from './arkpedia-enemy-projectiles.js';
/** Native confinement keeps a warning mode between the penultimate attack and
 * liberation. Captured casts survive mode changes; new casts use the new mode. */
export function sniperPrisoner(p) {
  const shots = ['phys', 'arts'].map(type => projectileSingleAttack({ type, speed: p.speed, lifetime: p.lifetime, noAir: true }));
  const sequence = ordinaryEnemyAttackSequence((_b, _e, a) => a.nextAnimation ?? p.animations[a.mode],
    (b, e, u, c) => shots[c.animation.type === 'arts' ? 1 : 0].attack({ targets: [u], attackId: c.attackId }, b, e));
  const setMode = (b, e, a, mode) => {
    a.mode = mode; a.free = mode === 2;
    b.removeBuff(e, 'ab:confined'); b.removeBuff(e, 'ab:liberty');
    b.addBuff(e, { key: a.free ? 'ab:liberty' : 'ab:confined', persist: true,
      mods: a.free ? { atkPct: p.atk } : { aspd: p.aspd } });
    const c = p.animations[mode]; e.def = { ...e.def, attackAnim: { dur: c.duration, hit: c.releases[0] } };
    if (mode === 1) a.listenerAt = b.time + p.warningDelay;
  };
  const stance = (e, a) => {
    const suffix = ['', '2', '3'][a.mode];
    return { clip: `${e.moving ? 'Move' : 'Idle'}${suffix}`, idle: `Idle${suffix}`, move: `Move${suffix}`, die: `Die${suffix}`, replace: true };
  };
  return { ...sequence,
    confine(b, e, a) { if (!e.alive || !a.free) return; a.n = 0; a.listenerAt = Infinity; setMode(b, e, a, 0); },
    liberate(b, e, a) { if (e.alive && !a.free) setMode(b, e, a, 2); },
    spawn(b, e, a) {
      sequence.spawn(b, e, a); a.n = 0; a.listenerAt = Infinity; setMode(b, e, a, 0);
      e.profile.targetPriority = 'tag'; e.profile.priorityTag = 'prison'; e.profile.canTarget = u => !u.isFlying && !u.s.flags.liftoff;
    },
    before(_c, b, e, a) {
      // The source's restartFSM=false and interruptAbilityOnDetach=false keep
      // the current ability's damage type when its before-attack buff switches modes.
      a.nextAnimation = p.animations[a.mode];
      if (a.mode === 0 && ++a.n >= p.times - 1) setMode(b, e, a, 1);
      else if (a.mode === 1 && b.time + 1e-7 >= a.listenerAt) setMode(b, e, a, 2);
    },
    tick(b, e, a) { sequence.tick(b, e, a); if (!a.cast) e.mem.regularFormVisual = stance(e, a); },
    death(c, b, e, a) { sequence.death(c, b, e, a); const die = `Die${['', '2', '3'][a.mode]}`;
      e.mem.regularFormVisual = { clip: die, die, loop: false };
    },
  };
}
