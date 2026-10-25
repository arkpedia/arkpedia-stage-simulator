// SPDX-License-Identifier: GPL-3.0-or-later
// Reproduce the geometry's ordered checkpoints, waits and teleports when a
// viewer export is absent. Distances here are stable point identifiers, not
// measured arc length; the stage adapter uses them to attach holds/breaks.
export function syntheticRoutePath(route) {
  const points = [], holds = [], breaks = [], checkpointPoints = new Map();
  const pair = (position, offset = {}) => {
    if (![position?.col, position?.row, offset.x ?? 0, offset.y ?? 0].every(Number.isFinite))
      throw Error('Invalid synthetic route position/offset');
    return [position.col + (offset.x ?? 0), position.row + (offset.y ?? 0)];
  };
  const add = (point, teleport = false) => {
    const last = points.at(-1);
    if (teleport || !last || point[0] !== last[0] || point[1] !== last[1]) {
      points.push(point);
      if (teleport) breaks.push(points.length - 1);
    }
    return points.length - 1;
  };
  checkpointPoints.set(-1, add(pair(route.start)));
  for (const [index, checkpoint] of (route.checkpoints ?? []).entries()) {
    if (checkpoint.type && !['move', 'appear_at_pos'].includes(checkpoint.type))
      throw Error('Unsupported synthetic route checkpoint: ' + checkpoint.type);
    // The adapter validates an APPEAR against its native position. Offsetting
    // teleports needs a separate reviewed transport contract.
    if (checkpoint.type === 'appear_at_pos' && (checkpoint.reachOffset?.x || checkpoint.reachOffset?.y))
      throw Error('Unsupported synthetic teleport offset');
    checkpointPoints.set(index, add(pair(checkpoint.position, checkpoint.reachOffset), checkpoint.type === 'appear_at_pos'));
  }
  add(pair(route.end));
  for (const wait of route.waits ?? []) {
    if (wait.type !== 'wait_for_seconds' || !Number.isInteger(wait.after_checkpoint)
      || !checkpointPoints.has(wait.after_checkpoint) || !Number.isFinite(wait.seconds) || wait.seconds < 0)
      throw Error('Unsupported synthetic route wait');
    holds.push({ at: checkpointPoints.get(wait.after_checkpoint), seconds: wait.seconds });
  }
  return { points, distances: points.map((_, at) => at), breaks, holds };
}
