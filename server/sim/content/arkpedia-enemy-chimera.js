// SPDX-License-Identifier: GPL-3.0-or-later
import { areaSelectable } from '../targeting.js';
import { registerOriginiumPollution, syncOriginiumPollution } from './arkpedia-originium-pollution.js';

export function profaneChimera({ damage, spRatio, atkFlat }) {
  const finish = (b, e, a) => {
    if (a.on || !e.alive) return;
    a.on = true; e.skillAnimUntil = b.time;
    b.removeBuff(e, 'ab:chimeraCast');
    b.addBuff(e, { key: 'ab:chimeraAttack', mods: { atkFlat }, visible: true });
    e.mem.ab.atkType = 'arts';
    a.removeAura = registerOriginiumPollution(b, { id: e, owner: e, kind: 'chimera', damage, spRatio, interval: .5,
      contains(u) {
        return u !== e && u.kind !== 'device' && (u.def?.profession ?? u.def?.raw?.profession) !== 'TRAP' && !u.isFlying && !u.s.flags.liftoff
          && (u.side === e.side || areaSelectable(e, u)) && Math.hypot(u.x - e.x, u.y - e.y) <= 1.2 + 1e-9;
      } });
  };
  return {
    spawn(b, _e, a) { a.nextCheck = b.time + .5; },
    tick(b, e, a, dt) {
      if (a.on) return;
      if (a.casting) {
        if (!e.canAct) { finish(b, e, a); return; }
        a.elapsed += dt * e.s.slowDownRate;
        e.skillAnimUntil = b.time + Math.max(0, 56 / 30 - a.elapsed) / Math.max(.001, e.s.slowDownRate);
        if (a.elapsed + 1e-9 >= 56 / 30) finish(b, e, a);
        return;
      }
      if (b.time + 1e-9 < a.nextCheck) return;
      a.nextCheck += .5;
      const tile = b.grid.tile(Math.round(e.y), Math.round(e.x));
      const pollutedTile = b.mvpStagePollution ? b.mvpStagePollution.has(`${Math.round(e.y)},${Math.round(e.x)}`)
        : tile?.key?.includes('toxic') || tile?.terrain === 'infection';
      const polluted = pollutedTile
        || e.findBuff('device:pollution') || e.findBuff('ab:storm') || e.findBuff('ab:originium');
      if (!polluted || !e.canAct || e.s.flags.silence) return;
      a.casting = true; a.elapsed = 0;
      b.addBuff(e, { key: 'ab:chimeraCast', flags: { noMove: true, disarm: true } });
      e.skillAnimUntil = b.time + 56 / 30 / Math.max(.001, e.s.slowDownRate);
    },
    status(_c, b, e, a) { if (a.casting && !a.on && !e.canAct) finish(b, e, a); },
    death(_c, b, _e, a) { a.removeAura?.(); syncOriginiumPollution(b); },
  };
}
