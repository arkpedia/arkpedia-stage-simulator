// SPDX-License-Identifier: GPL-3.0-or-later
import { timedEnemyCasts } from './arkpedia-enemy-timed-casts.js';
import { projectileSingleAttack } from './arkpedia-enemy-projectiles.js';
import { scatterFragments } from './arkpedia-enemy-summons.js';

export function mutantSpider(p) {
  const shot = projectileSingleAttack({ speed: 12, lifetime: 10, type: 'phys', noAir: true });
  const casts = timedEnemyCasts([{ ...p.cast, clip: 'Skill', slowDown: true,
    select: (_b, e) => [e], fire: (b, e) => scatterFragments(b, e, p.child, p.count, {
      delay: 0, radius: 0, randomDelay: false, groundOnly: true,
    }),
  }]);
  return { ...casts,
    spawn(b, e, a) {
      shot.spawn(b, e); casts.spawn(b, e, a);
      e.def = { ...e.def, attackAnim: p.attackAnim }; e.mem.mutantSpider = a;
    },
    attack: shot.attack,
    death(c, b, e, a) {
      casts.death(c, b, e, a);
      if (c.reason === 'killed' && !e.mem.deathByFall && !e.s.flags.silence)
        scatterFragments(b, e, p.child, p.deathCount, { delay: p.deathDelay, radius: p.radius, randomDelay: false, groundOnly: true });
    },
  };
}
