// SPDX-License-Identifier: GPL-3.0-or-later
import { layeredBarrier } from './arkpedia-enemy-barriers.js';
import { timedEnemyCasts } from './arkpedia-enemy-timed-casts.js';
export function mudrock(p, ab) {
  const barrier = layeredBarrier({ layers: 3, amount: p.amount, type: 'arts', mods: { hpPct: .5, aspd: 50 } });
  const casts = timedEnemyCasts([
    { ...p.refresh, select: (_b, e) => [e], fire: (b, e) => barrier.refresh(b, e) },
    { ...p.occupy, select: (b, e) => [...(b.stageGramophones?.entries.values() ?? [])]
      .filter(d => d.unit.alive && d.unit.deployed && d.control !== 'enemy')
      .sort((a, z) => Math.hypot(e.x - a.unit.x, e.y - a.unit.y) - Math.hypot(e.x - z.unit.x, e.y - z.unit.y)
        || a.unit.deploySeq - z.unit.deploySeq).slice(0, 1),
      fire: (b, _e, targets) => { for (const d of targets) if (d.unit.alive && d.unit.deployed) b.stageGramophones.seize(d.id); } },
  ], { flags: { noDisplace: true }, immunities: ['stun'] });
  return { ...casts,
    spawn(b, e, a) { barrier.spawn(b, e); casts.spawn(b, e, a); (ab.immune ??= new Set()).add('sleep'); },
    before(_c, b, e) {
      b.addBuff(e, { key: 'ab:mudrockCharge', refresh: 'stack', stacks: 1, maxStacks: 6,
        persist: true, visible: true, mods: { atkPct: p.atkPct } });
    },
  };
}
