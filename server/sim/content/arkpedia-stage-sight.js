// SPDX-License-Identifier: GPL-3.0-or-later
// Chapter-12 sight (shared/arkpedia/stage-sight.js). Each own-side unit on the field contributes its attack-range tiles
// (`rangeKeySet`, which follows skill range switches), refreshed on its own `[g]mainline12_sightManager` clock: when
// it arrives, then every 0.5 s, and at each of its skill starts and ends. A unit that leaves stops contributing.
// `b.stageSight.inSight(row, col)` is KEEP_REVEALED for identification.
import { COLS } from '../constants.js';

export function installStageSight(b, environment) {
  if (b.stageSight) throw Error('Duplicate chapter-12 sight');
  const interval = environment.interval, contributions = new Map(), clocks = new Map();
  const own = u => u?.side === 'ally' && u.alive && u.deployed !== false && !u.hidden;
  const refresh = u => { if (own(u)) contributions.set(u, new Set(u.rangeKeySet ?? [])); else contributions.delete(u); };
  const sight = b.stageSight = {
    interval,
    inSight(row, col) {
      const key = row * COLS + col;
      for (const [u, tiles] of contributions) if (own(u) && tiles.has(key)) return true;
      return false;
    },
    tiles() { const all = new Set(); for (const [u, tiles] of contributions) if (own(u)) for (const k of tiles) all.add(k); return all; },
    refresh,
  };
  b.on('tick', () => {
    for (const u of b.units) {
      if (!own(u)) { contributions.delete(u); clocks.delete(u); continue; }
      if (!clocks.has(u)) { clocks.set(u, b.time); refresh(u); continue; }
      if (b.time + 1e-9 >= clocks.get(u) + interval) { clocks.set(u, clocks.get(u) + interval); refresh(u); }
    }
  }, { priority: 190 });
  b.on('skillStart', ({ unit }) => refresh(unit));
  b.on('skillEnd', ({ unit }) => refresh(unit));
  b.on('death', ({ unit }) => { contributions.delete(unit); clocks.delete(unit); });
  return sight;
}
