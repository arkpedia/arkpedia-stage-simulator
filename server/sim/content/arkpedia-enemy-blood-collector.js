// SPDX-License-Identifier: GPL-3.0-or-later
// Sarkaz Bloodwalker / Bloodnexus (enemy_1366_dcolle, _2), talent Collect. Numbers arrive in `p` from the reviewed
// contract (shared/arkpedia/enemy-blood-collector-features.js). The Collector's held Amber are its
// `enemy_bonore_mark` buffs: `e.mem.bonoreMarks` is their count, which a Bloodcalling Altar's pulse reads and empties
// (arkpedia-stage-blood-altars.js).
import { remainingRoute, spawnChildren } from './arkpedia-enemy-spawn.js';

const live = u => u?.alive && u.deployed !== false && !u.hidden;

export function bloodCollector(p) {
  if (!(Number.isSafeInteger(p?.max) && p.max > 0 && p.contact > 0 && typeof p.amber === 'string')) throw Error('Invalid Blood Collector parameters');
  return {
    spawn(b, e) { e.mem.bonoreMarks = 0; },
    tick(b, e) {
      if (!live(e) || e.mem.bonoreMarks >= p.max) return;
      // enemy_dcolle_collected: ground Amber whose collider overlaps the circle, while below max_stack_cnt; each is
      // killed (InstantKill) and becomes one mark on the Collector.
      const near = b.enemies.filter(u => u !== e && live(u) && u.motion !== 'FLY' && u.defId === p.amber
        && (u.x - e.x) ** 2 + (u.y - e.y) ** 2 <= p.contact ** 2 + 1e-9)
        .sort((x, y) => (x.x - e.x) ** 2 + (x.y - e.y) ** 2 - ((y.x - e.x) ** 2 + (y.y - e.y) ** 2) || String(x.id).localeCompare(String(y.id)));
      for (const u of near) {
        if (e.mem.bonoreMarks >= p.max) break;
        e.mem.bonoreMarks++;
        b.kill(u, null);
      }
    },
    // enemy_dcolle_bonore[action] ON_OWNER_KILLED: unless it fell, each mark drops one Amber on the Collector's route.
    death(c, b, e) {
      const held = e.mem.bonoreMarks ?? 0;
      e.mem.bonoreMarks = 0;
      if (c.reason !== 'killed' || e.mem.deathByFall || !(held > 0)) return;
      spawnChildren(b, e, p.amber, held, { route: remainingRoute(e) });
    },
  };
}
