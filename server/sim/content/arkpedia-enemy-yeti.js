// SPDX-License-Identifier: GPL-3.0-or-later
import { projectileSingleAttack, chargedAttacks } from './arkpedia-enemy-projectiles.js';

/** Ordinary attacks charge SP, even under silence. The next eligible attack
 * spends the charge; its independently unmissable Cold travels with that shot. */
export function yetiColdAttack({ duration, initialSp, cost, increment, maxTargets, groundOnly=false }) {
  const transport = { speed: 10, lifetime: 10, type: 'arts' };
  const ordinary = projectileSingleAttack(transport);
  const charged = projectileSingleAttack({ ...transport,
    onImpact(b, e, target) { b.applyStatus(target, 'cold', { duration, source: e, sourceStatusResistable: 2 }); } });
  const attacks = chargedAttacks(ordinary, charged, { initialSp, cost, increment });
  return {
    ...attacks,
    spawn(b, e, a) {
      attacks.spawn(b, e, a);
      if(maxTargets!=null)e.profile.maxTargets=maxTargets;
      if(groundOnly){const prior=e.profile.canTarget;e.profile.canTarget=u=>!u.isFlying&&(!prior||prior(u));}
    },

  };
}
