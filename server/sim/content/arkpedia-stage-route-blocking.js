// SPDX-License-Identifier: GPL-3.0-or-later
/** Test a hypothetical crate without mutating the live grid or its path cache. */
export function sealsStageRoute(b, row, col) {
  const g = b.grid, routes = b.stageGroundRoutes ?? [];
  const pairs = routes.filter(r => r && !r.placeholder && r.motion?.toLowerCase() === 'walk' && r.start && r.end)
    .map(r => [r.start, r.end]);
  const reachable = (start, end, candidate) => {
    const key = (r, c) => r * g.cols + c;
    const walk = (r, c) => g.inRect(r, c) && g.walkable(r, c) && !g.isCrate(r, c) && (!candidate || r !== row || c !== col);
    if (!walk(start.row, start.col) || !walk(end.row, end.col)) return false;
    const queue = [[start.row, start.col]], seen = new Set([key(start.row, start.col)]);
    for (let i = 0; i < queue.length; i++) {
      const [r, c] = queue[i]; if (r === end.row && c === end.col) return true;
      for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nr = r + dr, nc = c + dc, k = key(nr, nc);
        if (!seen.has(k) && walk(nr, nc)) { seen.add(k); queue.push([nr, nc]); }
      }
    }
    return false;
  };
  // Routes connected by teleports may already lack a ground start/end path.
  // Refuse only a connection which this placement would newly seal.
  return pairs.some(([a, z]) => reachable(a, z, false) && !reachable(a, z, true));
}
