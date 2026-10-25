// SPDX-License-Identifier: GPL-3.0-or-later
// Complete original level bytes are supplied by the checksum-verified canonical
// candidate. Never interpret a branch routeIndex in the ordinary route space.
export function chapter16BranchSpawner(b, source) {
  if (source?.testOnly !== true || source.canonicalData?.repository !== 'arkpedia/arkpedia-data' || !source.rawLevel)
    throw Error('Chapter 16 branches require the verified canonical test-only level');
  const raw = source.rawLevel;
  const branch = raw.branches?.mcreep_route;
  const phase = branch?.phases?.[0];
  const action = phase?.actions?.[0];
  if (branch?.phases?.length !== 1 || phase?.preDelay !== 0 || phase?.actions?.length !== 1
    || action?.actionType !== 'SPAWN' || action.key !== 'enemy_3010_mcreep' || action.count !== 1
    || action.preDelay !== 0 || action.hiddenGroup || action.randomSpawnGroupKey || action.randomSpawnGroupPackKey
    || action.randomType !== 'ALWAYS' || action.refreshType !== 'ALWAYS' || action.weight !== 0
    || !Number.isInteger(action.routeIndex) || !raw.extraRoutes?.[action.routeIndex])
    throw Error('Unreviewed Chapter 16 miner branch action');
  const native = raw.extraRoutes[action.routeIndex];
  if (native.motionMode !== 'WALK' || native.allowDiagonalMove !== true || native.visitEveryTileCenter !== false
    || native.visitEveryNodeCenter !== false || native.visitEveryCheckPoint !== true)
    throw Error('Unreviewed Chapter 16 branch traversal options');
  const point = p => {
    if (!Number.isInteger(p?.row) || !Number.isInteger(p?.col)) throw Error('Invalid Chapter 16 branch position');
    return [p.row, p.col];
  };
  const start = point(native.startPosition), end = point(native.endPosition);
  const checkpoints = native.checkpoints.map(cp => {
    if (cp.type !== 'MOVE' || cp.time !== 0 || cp.randomizeReachOffset || cp.reachDistance !== 0)
      throw Error('Unreviewed Chapter 16 branch checkpoint');
    const position = point(cp.position);
    const offset = cp.reachOffset ?? { x: 0, y: 0 };
    if (![offset.x, offset.y].every(Number.isFinite) || Math.abs(offset.x) >= .5 || Math.abs(offset.y) >= .5)
      throw Error('Invalid Chapter 16 branch reach offset');
    return { type: 'MOVE', pos: [position[0] + offset.y, position[1] + offset.x] };
  });
  const offset = native.spawnOffset, spread = native.spawnRandomRange;
  if (![offset?.x, offset?.y, spread?.x, spread?.y].every(Number.isFinite)
    || spread.x < 0 || spread.y < 0) throw Error('Invalid Chapter 16 branch spawn distribution');
  return (id, index, owner) => {
    if (id !== 'mcreep_route' || index !== 0) throw Error('Unreviewed Chapter 16 branch selection');
    if (!b.data.getEnemy(action.key)) throw Error('Missing canonical miner branch dependency');
    const pos = [start[0] + offset.y + (b.rng() * 2 - 1) * spread.y,
      start[1] + offset.x + (b.rng() * 2 - 1) * spread.x];
    const child = b.spawnEnemy(action.key, { route: { motion: 'WALK', start, end, checkpoints }, pos, countInTotal: false });
    if (child) { child.mem.ch16Branch = { id, action: index, route: action.routeIndex, host: owner.id }; child.lpr = 0; }
    return child;
  };
}
