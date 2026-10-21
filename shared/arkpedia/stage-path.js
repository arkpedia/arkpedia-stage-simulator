// SPDX-License-Identifier: GPL-3.0-or-later
// A viewer export may omit a route. The stage geometry still has a reviewed
// start/checkpoint/end chain, which is enough for the engine's DISAPPEAR/WAIT/
// APPEAR legs and MOVE checkpoints.
export function syntheticRoutePath(route) {
  const points = [[route.start.col, route.start.row]];
  for (const checkpoint of route.checkpoints ?? []) if (checkpoint.position) points.push([checkpoint.position.col, checkpoint.position.row]);
  points.push([route.end.col, route.end.row]);
  const unique = points.filter((point, at) => at === 0 || point[0] !== points[at - 1][0] || point[1] !== points[at - 1][1]);
  return { points: unique, distances: unique.map((_, at) => at), breaks: [], holds: [] };
}
