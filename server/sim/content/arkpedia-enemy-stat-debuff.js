// SPDX-License-Identifier: GPL-3.0-or-later
import { canTargetAlly, sortAllyTargets } from '../targeting.js';

// A single shared cast controller. Content supplies its clock, exclusion key,
// stat and modifier; the target is sampled again at the release event.
export function targetedStatDebuff(p) {
  const targets = (b, e) => sortAllyTargets(e, b.allies(null, { includeTargetableDevices: true })
    .filter(u => canTargetAlly(e, u, true) && !u.findBuff(p.key)))
    .sort((a, b) => b.s[p.stat] - a.s[p.stat]);
  const finish = (b, e, a) => {
    a.cast = null; e.profile.noAttack = false;
    e.skillAnimUntil = b.time; b.removeBuff(e, 'ab:statDebuffCast');
  };
  return {
    cd: p.cooldown, icd: p.initial,
    cancel: finish,
    spawn(_b, _e, a) { a.cast = null; },
    tick(b, e, a, dt) {
      a.left -= dt;
      if (a.cast) {
        if (!e.canAct || e.s.flags.silence) { finish(b, e, a); return; }
        const cast = a.cast; cast.elapsed += dt * e.s.slowDownRate;
        if (!cast.released && cast.elapsed + 1e-9 >= p.release) {
          cast.released = true;
          const target = targets(b, e)[0];
          if (target) b.addBuff(target, { key: p.key, source: e, duration: p.duration, visible: true, mods: p.mods });
        }
        e.skillAnimUntil = b.time + Math.max(0, p.castDuration - cast.elapsed) / Math.max(.001, e.s.slowDownRate);
        if (cast.elapsed + 1e-9 >= p.castDuration) finish(b, e, a);
        return;
      }
      if (a.left > 1e-9 || !e.canAct || e.s.flags.silence || !targets(b, e).length) return;
      a.left = p.cooldown; a.cast = { elapsed: 0, released: false };
      e.profile.noAttack = true; e.skillAnimUntil = b.time + p.castDuration;
      b.addBuff(e, { key: 'ab:statDebuffCast', flags: { noMove: true } });
    },
    status(_c, b, e, a) { if (a.cast && (!e.canAct || e.s.flags.silence)) finish(b, e, a); },
  };
}

export function bladeKnight(p, rebornAbility) {
  const cast = targetedStatDebuff(p);
  const rebirth = rebornAbility({ dur: p.rebirthDuration, hpRatio: p.hpRatio,
    onKo: (b, e, a) => cast.cancel(b, e, a),
    onReborn: (_b, e) => { e.profile.noAttack = false; } });
  return { ...cast, ...rebirth,
    spawn(b, e, a) {
      cast.spawn(b, e, a); e.profile.shot = 'none'; e.profile.deferHit = true;
      e.def = { ...e.def, attackAnim: p.attackAnim };
      e.profile.canTarget = u => !u.isFlying;
    },
    attack(c, b, e) {
      for (const target of c.targets) b.dealDamage(e, target, { amount: e.s.atk, type: 'arts',
        isAttack: true, attackId: b._attackSeq, applyWay: 'ranged', tags: ['bladeKnightAttack'] });
    },
  };
}
