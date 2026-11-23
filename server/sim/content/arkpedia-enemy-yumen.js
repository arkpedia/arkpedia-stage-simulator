// SPDX-License-Identifier: GPL-3.0-or-later
// 'Wallbreaker' / 'Fortbreaker' and 'Sandwalker' / 'Sand Voyager' (enemy_1301_ymcnon[_2], enemy_1302_ymtro[_2]).
// Every number arrives in `p` from the reviewed contract (shared/arkpedia/enemy-yumen-features.js).
import { animatedProjectileAttack } from './arkpedia-enemy-projectiles.js';
import { EnemyPassengerContainer } from './arkpedia-enemy-passengers.js';

const stageHasDevices = b => (b.mvpStageDevices?.length ?? 0) > 0 || b.units.some(u => u.kind === 'device');

export function wallbreaker(p) {
  const shot = animatedProjectileAttack(p);
  return {
    ...shot,
    spawn(b, e, a) {
      // Its Trigger selector (_postFilter 48) prefers units on Yumen Catastrophe Defenses, which are stage devices.
      if (stageHasDevices(b)) throw Error('Wallbreaker defense priority (_postFilter 48) is not implemented on device stages');
      shot.spawn(b, e, a);
    },
  };
}

export function sandwalker(p) {
  if (!(p?.capacity >= 1) || !(p.radius > 0) || typeof p.ladder !== 'string' || !(p.attackAnim?.dur > 0)) throw Error('Invalid Sandwalker parameters');
  const MARK = 'enemy_ymtro_t[mark]';
  // The Bus validator: ground enemies of normal or elite level (no Leaders), not machines, not already carried.
  const eligible = u => u.side === 'enemy' && u.kind === 'enemy' && !u.isBoss && u.def.rank !== 'BOSS' && !u.tags.has('machine')
    && !u.findBuff(MARK) && !u.isFlying && !u.s.flags.liftoff && !u.s.flags.untargetable && !u.s.flags.isolated && !u.s.flags.sleep;
  return {
    spawn(b, e, a) {
      for (const t of b.grid.tiles ?? []) if (t?.key === p.ladder) throw Error('Sandwalker Ladder unloading (tile_stairs) is not implemented');
      e.def = { ...e.def, attackAnim: p.attackAnim };
      b.addBuff(e, { key: MARK, persist: true });
      a.passengers = new EnemyPassengerContainer(b, e, { capacity: p.capacity, radius: p.radius, offset: p.offset, eligible,
        useHostRoute: false, tileCenter: true });
    },
    tick(_b, _e, a) { a.passengers.tick(); },
    death(c, _b, _e, a) { a.passengers.release(c.reason); },
  };
}
