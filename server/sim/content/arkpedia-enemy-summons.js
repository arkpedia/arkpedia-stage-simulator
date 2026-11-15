// SPDX-License-Identifier: GPL-3.0-or-later
import { remainingRoute, spawnChildren } from './arkpedia-enemy-spawn.js';

/** Ground summons cannot appear in obstacles. Resolve a blocked origin to the
 * nearest passable tile; equal-distance ties use row/column order. */
export function groundSummonPosition(grid, pos) {
  if (grid.groundPassable(Math.round(pos[0]), Math.round(pos[1]))) return pos;
  const { r0, r1, c0, c1 } = grid.rect;
  let best = null, distance = Infinity;
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    if (!grid.groundPassable(r, c)) continue;
    const d = (r - pos[0]) ** 2 + (c - pos[1]) ** 2;
    if (d < distance) { best = [r, c]; distance = d; }
  }
  return best;
}

/** Scheduler-owned children retain the route captured at release, even after
 * their parent dies. Native families opt into fixed delay and ground placement. */
export function scatterFragments(b, e, key, count, {
  delay = Math.fround(.7), radius = .5, randomDelay = true, groundOnly = false,
} = {}) {
  const route = remainingRoute(e), center = [e.y, e.x];
  for (let i = 0; i < count; i++) {
    const wait = randomDelay ? b.rng.range(0, delay) : delay;
    const offset = center.map(p => radius ? p + b.rng.range(-radius, radius) : p);
    b.after(wait, () => {
      const pos = groundOnly ? groundSummonPosition(b.grid, offset) : offset;
      if (pos) spawnChildren(b, e, key, 1, { route, pos });
    }, { holdsBattle: true });
  }
}

/** Death spawn ("被击倒后生成N个<X>"). */
export const deathSpawn = (key, cnt, extra = {}) => ({
  death(c, b, e) { if (c.reason === 'killed' && key && cnt > 0) spawnChildren(b, e, key, cnt, extra); },
});

/** A delayed split ("Splits into N <X> upon death"): the children follow the dead parent's remaining route. */
export const deathSpawnDelayed = ({ key, cnt, delay = 0 }) => ({
  death(c, b, e) {
    if (c.reason !== 'killed' || !key || !(cnt > 0)) return;
    const route = remainingRoute(e);
    const spawn = () => spawnChildren(b, e, key, cnt, { route });
    // The defeated parent no longer holds victory. Its pending children take
    // that ownership until the callback creates their live bodies.
    if (delay > 0) b.after(delay, spawn, {holdsBattle:true}); else spawn();
  },
});

export const spawnEnemyAbilities=Object.freeze({
  // Prototype distributor: periodic helper spawn.
  periodicSpawn: ({ key, count, cooldown, init }) => ({
    spawn(b, e, a) { a.next = b.time + init; },
    tick(b, e, a) { if (b.time >= a.next) { a.next = b.time + cooldown; spawnChildren(b, e, key, count); } },
  }),
  // Existing Withering Apostle timing and staggered positions.
  seedSummoner: ({ key, count, cooldown, init }) => ({
    spawn(b, e, a) { a.next = b.time + init; },
    tick(b, e, a) {
      if (!e.alive || b.time < a.next) return;
      a.next = b.time + cooldown;
      for (let i = 0; i < count; i++) spawnChildren(b, e, key, 1, { pos: [e.y, e.x + (i - (count - 1) / 2) * 0.4] });
    },
  }),
  deathSpawn: ({ key, cnt }) => deathSpawn(key, cnt),
  deathSpawnDelayed: ({ key, cnt, delay }) => deathSpawnDelayed({ key, cnt, delay }),
});
