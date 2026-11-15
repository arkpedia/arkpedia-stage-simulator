// SPDX-License-Identifier: GPL-3.0-or-later
import { areaSelectable } from '../targeting.js';

/** A pulse changes mode once; repeated pulses neither stack nor restart it. */
export function pulseCharged() {
  return {
    spawn(_b, e) { e.profile.pulseImmune = true; e.profile.dmgType = 'phys'; },
    pulse(_c, _b, e) { e.profile.dmgType = 'arts'; },
  };
}
export function pulseCaster({ cooldown, radius, chargedRadius }) {
  const targets = (b, e, a) => b.alliesInRadius(e.x, e.y, a.charged ? chargedRadius : radius)
    .filter(u => u.motion !== 'FLY' && !u.flying && areaSelectable(e, u));
  return {
    cd: cooldown, icd: 0,
    spawn(_b, e) { e.profile.pulseImmune = true; e.profile.noAttack = true; },
    pulse(_c, _b, _e, a) { if (!a.charged) { a.charged = true; a.left = 0; } },
    cond(b, e, a) { return e.canAct && !(a.charged && e.s.flags.silence) && targets(b, e, a).length > 0; },
    fire(b, e, a) {
      e.skillAnimUntil = -1;
      for (const u of targets(b, e, a)) b.dealDamage(e, u, { amount: e.s.atk, type: 'arts', isSkill: true,
        canDodge: false, tags: ['enemyAbility', 'pulseCaster'] });
    },
  };
}
