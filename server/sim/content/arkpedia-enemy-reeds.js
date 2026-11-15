// SPDX-License-Identifier: GPL-3.0-or-later
export function reedsStealth() {
  const key = 'ab:reedsStealth';
  const interrupt = (b, e, a) => { a.restoreAt = b.time + 3; b.removeBuff(e, key); };
  return {
    iv: .1,
    spawn(b, e, a) {
      a.restoreAt = 0;
      b.on('attack', ({ attacker }) => { if (attacker === e) interrupt(b, e, a); }, { owner: e });
      b.on('blocked', ({ enemy }) => { if (enemy === e) interrupt(b, e, a); }, { owner: e });
      b.on('unblocked', ({ enemy, enemies }) => { if (enemy === e || enemies?.includes(e)) interrupt(b, e, a); }, { owner: e });
    },
    tick(b, e, a) {
      if (e.blockedBy) interrupt(b, e, a);
      if (!e.mem.reedsExtinct || e.hidden || e.blockedBy || b.time + 1e-9 < a.restoreAt) b.removeBuff(e, key);
      else if (!e.findBuff(key)) b.addBuff(e, { key, flags: { stealth: true }, data: { stealthRestore: 0 } });
    },
  };
}
