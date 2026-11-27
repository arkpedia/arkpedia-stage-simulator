// SPDX-License-Identifier: GPL-3.0-or-later
// Chapter 16's army soldiers that engage Miner Guerrillas (kind minerEngage). Every number arrives in `p` from the
// reviewed contract (shared/arkpedia/enemy-army-features.js).
// - Every `engage.interval` s, while it engages fewer than `engage.count` Miner Guerrillas, the nearest free ground one
//   within `engage.radius` is engaged: both it and the soldier stand (UNMOVABLE) until the Miner Guerrilla is further
//   than `engage.radius + engage.add`, or either is gone.
// - `neutralOnly`: its ordinary attack takes only ground units carrying the neutral mark.
// A circle catches a Miner Guerrilla when it touches its collider (MINER_BODY).
import { MINER_BODY } from './arkpedia-enemy-miner-guerrilla.js';

const HELD = 'ab:minerEngaged', SELF = 'ab:minerEngaging';
const live = u => u?.alive && u.deployed !== false && !u.hidden;
const dist = (a, u) => Math.hypot(u.x - a.x, u.y - a.y);

export function minerEngage(p) {
  const g = p?.engage;
  if (!(typeof p?.mark === 'string' && g?.interval > 0 && g.radius > 0 && g.add >= 0 && Number.isSafeInteger(g.count) && g.count >= 1))
    throw Error('Invalid Miner Guerrilla engagement parameters');
  const release = (b, e, a, m) => {
    a.held.delete(m);
    if (m.mem.minerEngagedBy === e) { m.mem.minerEngagedBy = null; if (m.alive) b.removeBuff(m, HELD); }
  };
  const sync = (b, e, a) => {
    if (a.held.size && e.alive) { if (!e.findBuff(SELF)) b.addBuff(e, { key: SELF, persist: true, flags: { noMove: true } }); }
    else if (e.findBuff(SELF)) b.removeBuff(e, SELF);
  };
  return {
    spawn(b, e, a) {
      Object.assign(a, { t: 0, held: new Set(), engaged: 0 });
      // Its record names no attack type; the prefab's Attack is a Physical strike on a marked neutral ground unit.
      if (p.neutralOnly) { e.profile.noAttack = false; e.profile.dmgType = 'phys'; e.profile.canTarget = u => u.side === 'neutral' && !u.isFlying && !!u.findBuff?.(p.mark); }
    },
    tick(b, e, a, dt) {
      if (!e.alive) { for (const m of [...a.held]) release(b, e, a, m); return; }
      a.t += dt;
      if (a.t + 1e-9 < g.interval) return;
      a.t -= g.interval;
      // block_mcreep[to_mcreep]: the hold ends once the Miner Guerrilla is out of the widened circle.
      for (const m of [...a.held]) if (!live(m) || dist(e, m) > g.radius + g.add + MINER_BODY + 1e-9) release(b, e, a, m);
      if (a.held.size < g.count && live(e)) {
        const m = b.neutralUnits.filter(u => live(u) && u.mem.minerGuerrilla && !u.isFlying && !u.mem.minerEngagedBy
          && dist(e, u) <= g.radius + MINER_BODY + 1e-9).sort((x, y) => dist(e, x) - dist(e, y) || String(x.id).localeCompare(String(y.id)))[0];
        if (m) {
          a.held.add(m); a.engaged += 1; m.mem.minerEngagedBy = e;
          b.addBuff(m, { key: HELD, persist: true, flags: { noMove: true } });
        }
      }
      sync(b, e, a);
    },
    killed(c, b, e, a) { for (const m of [...a.held]) release(b, e, a, m); return false; },
  };
}
