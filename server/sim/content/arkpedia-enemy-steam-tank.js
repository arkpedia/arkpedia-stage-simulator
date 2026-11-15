// SPDX-License-Identifier: GPL-3.0-or-later
import { timedEnemyCasts } from './arkpedia-enemy-timed-casts.js';
import { projectileSingleAttack } from './arkpedia-enemy-projectiles.js';
import { addSamplingProjectile } from './arkpedia-sampling-projectile.js';
const selectable = u => u.alive && u.deployed && !u.hidden
  && (u.kind !== 'device' || u.profile.characterLikeDevice)
  && !u.s.flags.untargetable && !u.s.flags.targetFree && !u.s.flags.sleep && !u.s.flags.stealth && !u.s.flags.camou;
export function steamTank(p) {
  const shot = projectileSingleAttack({ speed: 4, lifetime: 20, type: 'phys' });
  const casts = timedEnemyCasts([{ initial: p.initial, cooldown: p.cooldown, clip: 'Skill',
    duration: p.duration, release: p.release, slowDown: true,
    select(b, e) {
      const target = b.allyUnits.filter(u => selectable(u) && Math.hypot(u.x - e.x, u.y - e.y) <= p.lockRadius)
        .sort((a, z) => z.s.maxHp - a.s.maxHp || a.deploySeq - z.deploySeq)[0];
      return target ? [{ target, life: target.deploySeq, x: target.x, y: target.y }] : [];
    },
    fire(b, e, [input]) {
      const live = input.target.alive && input.target.deployed && input.target.deploySeq === input.life;
      const x = live ? input.target.x : input.x, y = live ? input.target.y : input.y;
      const row = Math.round(y), col = Math.round(x);
      addSamplingProjectile(b, { source: e, x, y, lifetime: 6, interval: .5, maxHits: 10, delay: Math.fround(.2),
        data: { steamTankBombardment: true },
        select: () => b.allyUnits.filter(u => selectable(u)
          && p.range.some(([dr, dc]) => Math.round(u.y) === row + dr && Math.round(u.x) === col + dc))
          .sort((a, z) => z.hpRatio - a.hpRatio || a.deploySeq - z.deploySeq)[0],
        hit: target => b.dealDamage(e, target, { amount: e.s.atk * p.scale, type: 'arts',
          isAttack: true, isSkill: false, applyWay: 'none', ignoreSelect: true, canDodge: true, tags: ['steamTankBombardment'] }),
      });
    },
  }], { flags: { noDisplace: true }, immunities: ['stun', 'silence', 'freeze', 'sleep', 'levitate'] });
  return [
    { spawn(b, e) { shot.spawn(b, e); e.def = { ...e.def, attackAnim: p.attackAnim }; }, attack: shot.attack },
    casts,
  ];
}
