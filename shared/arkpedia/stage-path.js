// SPDX-License-Identifier: GPL-3.0-or-later
// A viewer export may omit a route. The stage geometry still has a reviewed
// start/checkpoint/end chain, which is enough for the engine's DISAPPEAR/WAIT/
// APPEAR legs and MOVE checkpoints.
export function syntheticRoutePath(route) {
  const points = [[route.start.col, route.start.row]], positions = [0], breaks = [], holds = [];
  const append = (p, teleport = false) => {
    const previous = points.at(-1);
    // A same-position teleport is still a lifecycle event and cannot be deduped.
    if (teleport || previous[0] !== p.col || previous[1] !== p.row) points.push([p.col, p.row]);
    if (teleport) breaks.push(points.length - 1);
    return points.length - 1;
  };
  for (const checkpoint of route.checkpoints ?? [])
    positions.push(checkpoint.position ? append(checkpoint.position, checkpoint.type === 'appear_at_pos') : points.length - 1);
  append(route.end);
  for (const wait of route.waits ?? []) {
    if (!Number.isSafeInteger(wait.after_checkpoint) || wait.after_checkpoint < -1
      || wait.after_checkpoint >= positions.length - 1 || !Number.isFinite(wait.seconds) || wait.seconds < 0)
      throw Error('Invalid synthetic route wait');
    // Absolute clocks are reconstructed from geometry by stageRouteClockWaits.
    if (['wait_current_fragment_time', 'wait_current_wave_time', 'wait_for_play_time'].includes(wait.type)) continue;
    if (wait.type !== 'wait_for_seconds') throw Error(`Unsupported synthetic route wait: ${wait.type}`);
    const at = positions[wait.after_checkpoint + 1];
    const tunnel = wait.tunnel ?? breaks.includes(at + 1);
    if (tunnel && !breaks.includes(at + 1)) throw Error('Synthetic tunnel wait has no exit');
    const existing = holds.find(h => h.at === at && h.tunnel === tunnel);
    if (existing) existing.seconds += wait.seconds;
    else holds.push({ at, seconds: wait.seconds, tunnel });
  }
  return { points, distances: points.map((_, at) => at), breaks, holds };
}

/** Viewer holds describe arrival-relative pauses only. Clock checkpoints come
 * from original geometry and retain their position in the ordered route. */
export function stageRouteClockWaits(route, path) {
  const clocks = { wait_current_fragment_time: 'fragment', wait_current_wave_time: 'wave', wait_for_play_time: 'battle' };
  const waits = (route.waits ?? []).filter(w => clocks[w.type]);
  const result = new Map();
  if (!waits.length) return result;
  const positions = [-1]; let cursor = 0;
  for (const cp of route.checkpoints ?? []) {
    const at = path.points.findIndex(([col, row], i) => i >= cursor && col === cp.position.col && row === cp.position.row);
    if (at < 0) throw Error('Clock checkpoint missing from viewer path');
    positions.push(at); cursor = at;
  }
  const clockPositions = new Set(waits.map(w => w.after_checkpoint));
  for (const wait of (route.waits ?? []).filter(w => clockPositions.has(w.after_checkpoint))) {
    if (!Number.isSafeInteger(wait.after_checkpoint) || wait.after_checkpoint < -1
      || wait.after_checkpoint >= positions.length - 1 || !Number.isFinite(wait.seconds) || wait.seconds < 0)
      throw Error('Invalid original route clock checkpoint');
    const at = wait.after_checkpoint === -1 ? 0 : positions[wait.after_checkpoint + 1];
    if (!result.has(at)) result.set(at, []);
    if (clocks[wait.type]) result.get(at).push({ type: 'WAIT_UNTIL', time: wait.seconds, clock: clocks[wait.type] });
    else if (wait.type === 'wait_for_seconds') result.get(at).push({ type: 'WAIT', time: wait.seconds });
    else throw Error(`Unsupported clock-adjacent route wait: ${wait.type}`);
  }
  return result;
}
