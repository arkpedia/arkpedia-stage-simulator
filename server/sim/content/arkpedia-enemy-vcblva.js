// SPDX-License-Identifier: GPL-3.0-or-later
// Kazdel fire elemental (enemy_8017_vcblva). Every number arrives in `p` from the reviewed contract
// (shared/arkpedia/enemy-vcblva-features.js).
// enemy_vcblva_t_tile triggers on attach and every `interval`: it copies the owner's root tile, and the deploy check
// (StandardBattle._placementError) refuses the `tiles` offsets around that tile while the owner lives.

export function deployDenyZone(p) {
  if (!Array.isArray(p?.tiles) || !p.tiles.length || p.tiles.some(t => !Number.isInteger(t.row) || !Number.isInteger(t.col))
    || !(p.interval > 0)) throw Error('Invalid deploy-deny zone parameters');
  const sample = (b, e, a) => {
    const r = Math.round(e.y), c = Math.round(e.x);
    if (a.root?.[0] === r && a.root?.[1] === c) return;
    a.root = [r, c];
    b.noDeployZones ??= new Map();
    b.noDeployZones.set(e, new Set(p.tiles.map(t => `${r + t.row},${c + t.col}`)));
  };
  return {
    spawn(b, e, a) { a.root = null; a.left = p.interval; sample(b, e, a); },
    tick(b, e, a, dt) {
      if (!e.alive) return;
      a.left -= dt;
      while (a.left <= 1e-9) { a.left += p.interval; sample(b, e, a); }
    },
    death(_c, b, e) { b.noDeployZones?.delete(e); },
  };
}
