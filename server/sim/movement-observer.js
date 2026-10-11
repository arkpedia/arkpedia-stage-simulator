// SPDX-License-Identifier: GPL-3.0-or-later
// Optional content observes accepted movement before blocking, a new route leg
// or the exit can consume it. An observer that relocates/removes the body ends
// this tick's move; the next tick plans from its new position.
export function observeEnemyMove(b, enemy, from, kind = 'route') {
  if (!from || !b.hasHook('enemyMoved')) return false;
  const to = { x: enemy.x, y: enemy.y };
  if (from.x === to.x && from.y === to.y) return false;
  b.emit('enemyMoved', { enemy, from, to, kind });
  return !enemy.alive || enemy.hidden || enemy.x !== to.x || enemy.y !== to.y;
}

// The local engine uses nearest tile centres for root positions. Trace every
// crossed root, including fast/diagonal segments; a simultaneous corner crossing
// enters the diagonal root once. This is an explicit local geometry mapping.
export function* crossedRootTiles(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  let c = Math.round(from.x), r = Math.round(from.y);
  yield [r, c];
  const endC = Math.round(to.x), endR = Math.round(to.y);
  const sx = Math.sign(dx), sy = Math.sign(dy);
  for (let guard = 0; (c !== endC || r !== endR) && guard < 2048; guard++) {
    const tx = c === endC || !sx ? Infinity : (c + .5 * sx - from.x) / dx;
    const ty = r === endR || !sy ? Infinity : (r + .5 * sy - from.y) / dy;
    if (tx <= ty + 1e-12) c += sx;
    if (ty <= tx + 1e-12) r += sy;
    yield [r, c];
  }
}
