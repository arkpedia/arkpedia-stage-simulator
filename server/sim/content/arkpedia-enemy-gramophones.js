// SPDX-License-Identifier: GPL-3.0-or-later
import { areaSelectable } from '../targeting.js';
import { ALLY_COLLIDER_RADIUS } from '../constants.js';
import { enemyPulseChannel } from './arkpedia-enemy-channel.js';
import { projectileSingleAttack } from './arkpedia-enemy-projectiles.js';

/** Native selector and SP payload share the channel lifecycle with healers. */
export function whispererChannel(p) {
  const entry = (b, u) => [...(b.stageGramophones?.entries.values() ?? [])].find(d => d.unit === u);
  const valid = (b, _e, u) => u.alive && u.deployed && entry(b, u)?.control !== 'enemy';
  return enemyPulseChannel(p, {
    key: 'ab:whispererChannel', data: { whispererChannel: true },
    shot: projectileSingleAttack({ speed: 10, lifetime: 10, type: 'arts', noAir: true }), valid,
    select: (b, e) => [...(b.stageGramophones?.entries.values() ?? [])].map(d => d.unit)
      .filter(u => valid(b, e, u) && Math.hypot(e.x - u.x, e.y - u.y) <= e.base.rangeRadius + .5)
      .sort((a, z) => Math.hypot(e.x - a.x, e.y - a.y) - Math.hypot(e.x - z.x, e.y - z.y) || a.deploySeq - z.deploySeq)[0],
    pulse: (b, _e, u) => { const d = entry(b, u); b.stageGramophones.modifySp(d.id, p.sp); return d.sp > 0; },
  });
}

/** Independent death payload: source position/ATK are frozen at emission. */
export function shamanDeath({ delay, radius, scale }) {
  return { sil: true, death(c, b, e) {
    if (c.reason !== 'killed') return;
    const { x, y } = e, amount = e.s.atk * scale;
    b.after(delay, () => {
      b.fx('explode', { x, y, r: radius, kind: 'arts' });
      for (const u of b.allies(null, { includeTargetableDevices: true })) {
        if (!areaSelectable(e, u) || u.isFlying || Math.hypot(u.x - x, u.y - y) > radius + ALLY_COLLIDER_RADIUS) continue;
        b.dealDamage(e, u, { amount, type: 'arts', isAttack: false, isSkill: true, applyWay: 'none', tags: ['shamanDeath'] });
      }
      const controller = b.stageGramophones;
      for (const d of controller?.entries.values() ?? []) if (d.unit.alive && d.unit.deployed
        && Math.hypot(d.unit.x - x, d.unit.y - y) <= radius + .5) controller.seize(d.id);
    }, { holdsBattle: true });
  } };
}
