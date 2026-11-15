// SPDX-License-Identifier: GPL-3.0-or-later
import { ordinaryMeleeSequence } from './arkpedia-enemy-melee-sequence.js';
export function epochGuard(p) {
  const sequence = ordinaryMeleeSequence((_b, _e, a) => p.animations[a.mode]);
  const animation = (e, a) => {
    const clip = p.animations[a.mode];
    e.def = { ...e.def, attackAnim: { dur: clip.duration, hit: clip.releases[0] } };
  };
  return { ...sequence,
    spawn(b, e, a) { sequence.spawn(b, e, a); a.mode = 0; a.next = b.time + p.interval; animation(e, a); },
    tick(b, e, a) {
      if (b.time + 1e-7 >= a.next) {
        a.next += p.interval;
        const mode = b.stageEpoch?.has(e) ? 1 : 0;
        if (mode !== a.mode) {
          sequence.cancel(b, e, a); a.mode = mode; animation(e, a);
          if (mode) b.addBuff(e, { key: 'skzwdd_a[effect]' }); else b.removeBuff(e, 'skzwdd_a[effect]');
        }
      }
      sequence.tick(b, e, a);
    },
  };
}
