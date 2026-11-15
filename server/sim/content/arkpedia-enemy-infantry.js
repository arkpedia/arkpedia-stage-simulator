// SPDX-License-Identifier: GPL-3.0-or-later
import { projectileBoxAttack } from './arkpedia-enemy-projectiles.js';

/** One native ranged cast followed by a permanent melee mode. Transport,
 * damage, ordinary melee targeting and buffs stay in their shared engines. */
export function singleGrenadeInfantry(p) {
  const shot = projectileBoxAttack({ speed: 5, lifetime: 10, width: 3, height: 3, damageScale: p.scale });
  const visual = e => ({ clip: e.moving ? 'Move_B' : 'Idle_B', move: 'Move_B',
    attack: 'Attack_B', die: 'Die_B', loop: true, speed: e.moving ? .5 : 1 });
  const finish = (b, e, a) => {
    a.cast = null; e.profile.noAttack = false; e.skillAnimUntil = b.time; e.mem.regularFormVisual = null;
    b.removeBuff(e, 'ab:singleGrenadeCast');
  };
  const change = (b, e, a) => {
    if (!e.alive || !e.deployed || a.melee) return;
    a.melee = true; finish(b, e, a);
    e.profile.melee = true; e.profile.deferHit = false; e.atkCd = 0; e.atkStandUntil = b.time;
    e.def = { ...e.def, attackAnim: p.meleeAnim };
    b.addBuff(e, { key: 'ab:infantrySpeed', persist: true, mods: { movePct: p.move } });
    e.mem.regularFormVisual = { ...visual(e), replace: true };
  };
  return {
    spawn(b, e, a) {
      shot.spawn(b, e); e.profile.canTarget = u => !u.isFlying;
      a.melee = false; a.spent = false; a.sequence = 0; e.mem.singleGrenade = a;
      e.atkCd = 0; e.def = { ...e.def, attackAnim: p.rangedAnim };
    },
    before(c, b, e, a) {
      if (a.melee) return;
      const target = c.targets[0]; c.targets = [];
      if (a.cast || a.spent || !target) return;
      a.cast = { elapsed: 0, released: false, target }; a.sequence++;
      e.profile.noAttack = true; b.addBuff(e, { key: 'ab:singleGrenadeCast', flags: { noMove: true } });
      e.mem.regularFormVisual = { clip: 'Attack_A', die: 'Die_A', loop: false, playId: `grenade:${a.sequence}`, speed: e.s.slowDownRate };
      e.skillAnimUntil = b.time + p.rangedAnim.dur;
    },
    tick(b, e, a, dt) {
      if (a.melee) { e.mem.regularFormVisual = visual(e); return; }
      const cast = a.cast; if (!cast) return;
      if (!e.canAct || e.s.flags.disarm) { finish(b, e, a); e.atkCd = e.s.interval; return; }
      cast.elapsed += dt * e.s.slowDownRate;
      if (e.mem.regularFormVisual) e.mem.regularFormVisual.speed = e.s.slowDownRate;
      e.skillAnimUntil = b.time + Math.max(0, p.rangedAnim.dur - cast.elapsed) / Math.max(.001, e.s.slowDownRate);
      if (!cast.released && cast.elapsed + 1e-9 >= p.rangedAnim.hit) {
        cast.released = true; a.spent = true; e.lastAttackAt = b.time; e.stats.attacks++;
        shot.attack({ targets: [cast.target], attackId: ++b._attackSeq }, b, e);
        // The native mode-switch buff has its own clock, unaffected by Slow
        // Down or control after release. It belongs to this deployment only.
        const life = e.deploySeq;
        b.after(p.switchDelay, () => { if (e.deploySeq === life) change(b, e, a); });
      }
      if (cast.elapsed + 1e-9 >= p.rangedAnim.dur) finish(b, e, a);
    },
    status(_c, b, e, a) {
      if (a.cast && (!e.canAct || e.s.flags.disarm)) { finish(b, e, a); e.atkCd = e.s.interval; }
    },
    death(_c, b, e, a) { finish(b, e, a); },
  };
}
