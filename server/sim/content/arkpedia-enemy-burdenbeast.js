// SPDX-License-Identifier: GPL-3.0-or-later
import { faceOperatorCrowd } from './arkpedia-enemy-directional.js';
import { triggerStageEnvironment } from './arkpedia-stage-environments.js';

export function burdenbeastSupplier({ reduction, poll, attackAnim }) {
  return {
    spawn(b, e, a) {
      e.def = { ...e.def, attackAnim };
      e.mem.nativeFacing = 1; a.poll = 0; a.blocked = false;
      b.addBuff(e, { key: 'ab:burdenbeastFront', persist: true, status: 'sanctuary',
        data: { frontSourceSanctuary: reduction } });
      for (const event of ['blocked', 'unblocked']) b.on(event, ({ enemy }) => {
        if (enemy === e) { a.blocked = event === 'blocked'; a.poll = 0; }
      }, { owner: e });
      b.on('beforeAttack', ({ attacker, targets }) => {
        if (attacker !== e || !targets[0]) return;
        const dx = targets[0].x - e.x;
        if (dx) e.mem.nativeFacing = Math.sign(dx);
      }, { owner: e });
    },
    tick(b, e, a, dt) {
      const blocked = !!e.blockedBy;
      // The source toggle removes the listener while blocked. Reattaching it
      // starts a fresh first-trigger interval, including after brief blocking.
      if (blocked !== a.blocked) { a.blocked = blocked; a.poll = 0; }
      if (blocked) return;
      a.poll += dt;
      if (a.poll + 1e-9 >= poll) { a.poll %= poll; faceOperatorCrowd(b, e); }
    },
    death(c, b, e, a) {
      if (c.reason !== 'killed' || a.triggered) return;
      a.triggered = true;
      triggerStageEnvironment(b, e, 'env_010_cooperate');
    },
  };
}
