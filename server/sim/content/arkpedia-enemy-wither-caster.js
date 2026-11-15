// SPDX-License-Identifier: GPL-3.0-or-later
import { enemyPulseChannel } from './arkpedia-enemy-channel.js';
import { projectileSingleAttack } from './arkpedia-enemy-projectiles.js';

export function witherCasterChannel(p) {
  const valid = (_b, e, t) => t.side === e.side && t.def.id === 'trap_086_larva' && t.alive && t.deployed;
  const selectable = (b, e, t) => valid(b, e, t) && !t.hidden && !t.s.flags.healFree && !t.s.flags.noHeal && !t.s.flags.isolated
    && !t.s.flags.sleep && !t.s.flags.untargetable && t.hp < t.s.maxHp;
  return enemyPulseChannel(p, {
    key: 'ab:witherCasterChannel', data: { witherCasterChannel: true }, valid,
    shot: projectileSingleAttack({ speed: 10, lifetime: 10, type: 'arts' }),
    select: (b, e) => b.units.filter(t => selectable(b, e, t)
      && Math.hypot(e.x - t.x, e.y - t.y) <= e.base.rangeRadius + .5)
      .sort((a, z) => a.hp / a.s.maxHp - z.hp / z.s.maxHp || a.deploySeq - z.deploySeq)[0],
    pulse: (b, e, t) => { b.heal(e, t, t.s.maxHp * p.ratio, { isSkill: true }); return true; },
  });
}
