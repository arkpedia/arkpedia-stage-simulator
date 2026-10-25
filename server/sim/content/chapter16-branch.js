// SPDX-License-Identifier: GPL-3.0-or-later
// Complete original level bytes are supplied by the checksum-verified canonical
// candidate. Never interpret a branch routeIndex in the ordinary route space.
export function chapter16BranchSpawner(b, source) {
  if (source?.testOnly !== true || source.canonicalData?.repository !== 'arkpedia/arkpedia-data' || !source.rawLevel)
    throw Error('Chapter 16 branches require the verified canonical test-only level');
  const raw = source.rawLevel;
  const branch = raw.branches?.mcreep_route;
  const phase = branch?.phases?.[0];
  if (branch?.phases?.length !== 1 || phase?.preDelay !== 0 || !Array.isArray(phase.actions) || !phase.actions.length)
    throw Error('Unreviewed Chapter 16 miner branch phase');
  const entries = phase.actions.map(action => {
    if (action?.actionType !== 'SPAWN' || action.key !== 'enemy_3010_mcreep' || action.count !== 1
      || action.preDelay !== 0 || action.hiddenGroup || action.randomSpawnGroupKey || action.randomSpawnGroupPackKey
      || action.randomType !== 'ALWAYS' || action.refreshType !== 'ALWAYS' || action.weight !== 0
      || !Number.isInteger(action.routeIndex) || !raw.extraRoutes?.[action.routeIndex])
      throw Error('Unreviewed Chapter 16 miner branch action');
    const native = raw.extraRoutes[action.routeIndex];
    if (native.motionMode !== 'WALK' || native.allowDiagonalMove !== true || native.visitEveryTileCenter !== false
      || native.visitEveryNodeCenter !== false || typeof native.visitEveryCheckPoint !== 'boolean')
      throw Error('Unreviewed Chapter 16 branch traversal options');
    const point = p => {
      if (!Number.isInteger(p?.row) || !Number.isInteger(p?.col)) throw Error('Invalid Chapter 16 branch position');
      return [p.row, p.col];
    };
    const start = point(native.startPosition), end = point(native.endPosition);
    const points = Array.isArray(native.checkpoints) ? native.checkpoints
      : native.checkpoints && typeof native.checkpoints === 'object' && Object.keys(native.checkpoints).length === 0 ? [] : null;
    if (!points) throw Error('Unreviewed Chapter 16 branch checkpoints');
    let hidden = false;
    const checkpoints = points.map(cp => {
      if (cp.randomizeReachOffset || cp.reachDistance !== 0)
        throw Error('Unreviewed Chapter 16 branch checkpoint');
      const offset = cp.reachOffset ?? { x: 0, y: 0 };
      if (![offset.x, offset.y].every(Number.isFinite) || Math.abs(offset.x) >= .5 || Math.abs(offset.y) >= .5)
        throw Error('Invalid Chapter 16 branch reach offset');
      if (cp.type === 'MOVE' && cp.time === 0 && !hidden) {
        const position = point(cp.position);
        return { type: 'MOVE', pos: [position[0] + offset.y, position[1] + offset.x] };
      }
      if (offset.x !== 0 || offset.y !== 0) throw Error('Unreviewed Chapter 16 branch control offset');
      if (cp.type === 'DISAPPEAR' && cp.time === 0 && !hidden) {
        hidden = true; return { type: 'DISAPPEAR' };
      }
      if (cp.type === 'WAIT_FOR_SECONDS' && Number.isFinite(cp.time) && cp.time >= 0)
        return { type: 'WAIT', time: cp.time };
      if (cp.type === 'APPEAR_AT_POS' && cp.time === 0 && hidden) {
        hidden = false; return { type: 'APPEAR', pos: point(cp.position) };
      }
      throw Error('Unreviewed Chapter 16 branch checkpoint');
    });
    if (hidden) throw Error('Unclosed Chapter 16 branch disappearance');
    const offset = native.spawnOffset, spread = native.spawnRandomRange;
    if (![offset?.x, offset?.y, spread?.x, spread?.y].every(Number.isFinite)
      || spread.x < 0 || spread.y < 0) throw Error('Invalid Chapter 16 branch spawn distribution');
    return { action, native, start, end, checkpoints, offset, spread };
  });
  return (id, index, owner) => {
    if (id !== 'mcreep_route' || !Number.isInteger(index) || !entries[index]) throw Error('Unreviewed Chapter 16 branch selection');
    const { action, native, start, end, checkpoints, offset, spread } = entries[index];
    if (!b.data.getEnemy(action.key)) throw Error('Missing canonical miner branch dependency');
    const pos = [start[0] + offset.y + (b.rng() * 2 - 1) * spread.y,
      start[1] + offset.x + (b.rng() * 2 - 1) * spread.x];
    const child = b.spawnEnemy(action.key, { route: { motion: 'WALK', start, end, checkpoints }, pos, countInTotal: false });
    if (child) {
      child.mem.ch16Branch = { id, action: index, route: action.routeIndex, host: owner.id }; child.lpr = 0;
      child.route.cursorOffset = { x: pos[1] - start[1], y: pos[0] - start[0] };
      child.route.goal = { x: end[1], y: end[0] };
      child.route.visitEveryCheckPoint = native.visitEveryCheckPoint;
      child.route.nativeReachRadius = .05;
    }
    return child;
  };
}
