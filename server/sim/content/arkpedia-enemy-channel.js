// SPDX-License-Identifier: GPL-3.0-or-later
import { addEnemyPulseLink } from './arkpedia-enemy-links.js';

/** A timed begin/loop/end channel over the common travelling pulse link.
 * Selection and payload belong to the feature; this owns locks and cleanup.
 * The captured deployment cannot be replaced by a later body at that tile. */
export function enemyPulseChannel(p, { key, select, valid, pulse, shot, data = {} }) {
  const unlock = (b, e, a) => {
    b.removeBuff(e, key);
    if (a.locked) e.profile.noAttack = a.previousNoAttack;
    a.locked = false; e.mem.regularFormVisual = null;
  };
  const finish = (b, e, a, interrupted = false) => {
    if (a.cast?.projectile) a.cast.projectile.removed = true;
    a.cast = null; a.recovery = interrupted ? 0 : p.recovery;
    if (interrupted) unlock(b, e, a);
  };
  const targetValid = (b, e, cast) => cast.target.alive && cast.target.deployed
    && cast.target.deploySeq === cast.targetSeq && valid(b, e, cast.target);
  const visual = (e, a, suffix, loop = false) => {
    e.mem.regularFormVisual = { clip: `Skill_${suffix}`, loop, speed: 1, playId: `${key}:${suffix}:${a.sequence}` };
  };
  return {
    spawn(b, e, a) {
      shot?.spawn(b, e); a.left = p.initial; a.cast = null; a.recovery = 0; a.sequence = 0;
      if (p.attackAnim) e.def = { ...e.def, attackAnim: p.attackAnim };
    },
    attack: shot?.attack,
    tick(b, e, a, dt) {
      a.left -= dt;
      if (a.cast && (!e.canAct || e.s.flags.silence || !targetValid(b, e, a.cast)))
        finish(b, e, a, !e.canAct || !!e.s.flags.silence);
      if (a.cast?.projectile?.removed) finish(b, e, a);
      if (a.recovery > 0) {
        a.recovery -= dt; visual(e, a, 'End');
        if (a.recovery <= 1e-9) unlock(b, e, a);
        return;
      }
      if (a.cast) {
        const cast = a.cast; cast.elapsed += dt;
        if (cast.elapsed + 1e-9 >= p.begin) visual(e, a, 'Loop', true);
        if (cast.elapsed + 1e-9 >= p.begin + (p.release ?? 0) && !cast.projectile) {
          cast.projectile = addEnemyPulseLink(b, { source: e, target: cast.target, duration: p.duration,
            valid: () => a.cast === cast && e.alive && e.deployed && e.canAct && !e.s.flags.silence && targetValid(b, e, cast),
            onPulse: () => pulse(b, e, cast.target),
            onFinish: () => { if (a.cast === cast) finish(b, e, a); }, data });
        }
        return;
      }
      if (a.left > 1e-9 || !e.canAct || e.s.flags.silence) return;
      const target = select(b, e);
      if (!target) return;
      a.left = p.cooldown; a.cast = { target, targetSeq: target.deploySeq, elapsed: 0, projectile: null }; a.sequence++;
      a.previousNoAttack = e.profile.noAttack; a.locked = true; e.profile.noAttack = true;
      e.attackControlEpoch = (e.attackControlEpoch ?? 0) + 1;
      b.addBuff(e, { key, flags: { noMove: true } }); visual(e, a, 'Begin');
    },
    status(_c, b, e, a) {
      if (a.locked && (!e.canAct || e.s.flags.silence)) finish(b, e, a, true);
    },
    death(_c, b, e, a) { finish(b, e, a, true); },
  };
}
