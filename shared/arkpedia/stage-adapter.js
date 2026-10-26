// SPDX-License-Identifier: GPL-3.0-or-later
// Pure stage geometry adaptation, shared by runtime and source producers.
import{STAGE_DEVICES,STAGE_TOKEN_UNITS}from"./stage-devices.js";
export function stageAdapter(source) {
  const devices = (source.devices ?? []).filter(d => d.kind === 'device' && !String(d.key).startsWith('char_'));
  const unsupported = devices.filter(d => !STAGE_DEVICES[d.name]);
  if (unsupported.length) throw new Error(`Unsupported stage devices: ${[...new Set(unsupported.map(d => d.name))].join(', ')}`);
  const g = source.geometry;
  const supplied = Array.isArray(g.suppliedUnits) ? g.suppliedUnits.length
    : (g.suppliedUnits?.fixed_squad?.length || 0) + (g.suppliedUnits?.deployable_tokens?.length || 0);
  const tokenCards = Array.isArray(g.suppliedUnits) ? [] : (g.suppliedUnits?.deployable_tokens ?? []).filter(t => t.count !== 0);
  const unsupportedTokens = tokenCards.filter(t => !STAGE_TOKEN_UNITS[t.unit_id]);
  if (unsupportedTokens.length) throw new Error(`Unsupported stage tokens: ${[...new Set(unsupportedTokens.map(t => t.unit_id))].join(', ')}`);
  if (g.rows > 19 || g.cols > 21 || (g.hasConditionalSpawns && !source.conditionalHandled))
    throw new Error("Unsupported stage mechanics");
  const baseChars = ["#", "h", "r", "S", "E"];
  const chars = g.tileLegend.map((_, i) => baseChars[i] ?? String.fromCharCode(65 + i - baseChars.length));
  const legend = Object.fromEntries(
    g.tileLegend.map((t, i) => [
      chars[i],
      {
        height: t.height.toUpperCase(),
        build: t.deployable.toUpperCase(),
        pass: t.walkable ? "ALL" : t.flyable ? "FLY" : "NONE",
        key: t.key,
      },
    ]),
  );
  const pair = (p) => [p.row, p.col];
  const pollution = [];
  g.tileGrid.forEach((row, r) => row.forEach((type, c) => {
    if (String(g.tileLegend[type]?.key ?? '').includes('toxic')) pollution.push([r, c]);
  }));
  // A route no wave spawns on never has to walk, so a viewer export may omit it. Only refuse a missing path
  // for a route the stage actually uses.
  const usedRoutes = new Set(g.waves.flatMap(wave => (wave.spawns || []).map(spawn => spawn.route)));
  const routes = g.routes.map((route, index) => {
    if (!route || route.placeholder)
      return { start: [0, 0], end: [0, 0], checkpoints: [] };
    const path = source.pathing?.paths?.[index];
    if (!path && !usedRoutes.has(index))
      return { motion: route.motion, start: pair(route.start), end: pair(route.end), checkpoints: [] };
    if (path) {
      // A viewer break is a tunnel: disappear at the entrance point, wait the reviewed tunnel hold, then
      // appear at the first point after the break. The engine's DISAPPEAR/APPEAR legs already hide and teleport.
      const tunnels = new Map(), appears = (route.checkpoints ?? []).filter((c) => c.type === "appear_at_pos");
      for (const at of path.breaks) {
        const hold = path.holds.find((h) => h.tunnel && h.at === path.distances[at - 1]);
        if (hold) { tunnels.set(at, hold); continue; }
        // A viewer break with no tunnel hold is a teleport (`appear_at_pos`): keep it only when the level
        // geometry names that exact appear point, then use a zero-second DISAPPEAR/WAIT/APPEAR pair.
        const [col, row] = path.points[at] ?? [];
        if (!appears.some((c) => c.position.row === row && c.position.col === col)) throw new Error("Unsupported route tunnel");
        tunnels.set(at, { seconds: 0, synthetic: true });
      }
      for (const hold of path.holds.filter((h) => h.tunnel)) {
        const at = path.distances.findIndex((distance) => distance === hold.at) + 1;
        if (!tunnels.has(at)) throw new Error("Unsupported route tunnel");
      }
      const checkpoints = [];
      path.points.forEach(([col, row], at) => {
        if (at > 0) checkpoints.push(tunnels.has(at) ? { type: "APPEAR", pos: [row, col] } : { type: "MOVE", pos: [row, col] });
        for (const hold of path.holds.filter(
          (h) => h.at === path.distances[at] && !h.tunnel,
        ))
          checkpoints.push({
            type: "WAIT",
            pos: [row, col],
            time: hold.seconds,
          });
        const nextTunnel = tunnels.get(at + 1);
        if (nextTunnel) {
          checkpoints.push({ type: "DISAPPEAR" });
          checkpoints.push({ type: "WAIT", pos: [row, col], time: nextTunnel.seconds });
        }
      });
      return {
        motion: route.motion,
        start: pair(route.start),
        end: pair(route.end),
        checkpoints,
      };
    }
    throw new Error("Missing stage viewer path for route " + index);
  });
  // Waves run in sequence: a wave's pre_delay is measured from the END of the previous wave, and
  // each spawn's time is measured from the start of its own wave (Arkpedia stage playback).
  let cursor = 0;
  const spawns = g.waves.flatMap((wave) => {
    const waveStart = cursor + (wave.pre_delay || 0);
    for (const s of wave.spawns || []) if (s.unharmful != null && typeof s.unharmful !== 'boolean')
      throw Error('Invalid canonical unharmful spawn flag');
    const out = (wave.spawns || []).flatMap((s) =>
      Array.from({ length: Math.max(1, s.count || 1) }, (_, i) => ({
        enemyKey: s.enemy_id,
        time: waveStart + (s.time || 0) + i * (s.interval || 0),
        routeIndex: s.route,
        ownerPlayerId: "arkpedia",
        ...(s.unharmful === true ? { holdsBattle: false } : {}),
      })),
    );
    cursor = waveStart + (wave.duration || 0) + (wave.post_delay || 0);
    return out;
  }).sort((a, b) => a.time - b.time);
  return {
    fixedSquad: supplied && g.suppliedUnits.fixed_squad?.length ? g.suppliedUnits.fixed_squad : null,
    stage: {
      id: source.code,
      tokens: source.tokens ?? [],
      rows: g.tileGrid.map((row) => row.map((t) => chars[t]).join("")),
      legend,
    },
    rect: { r0: 0, r1: g.rows - 1, c0: 0, c1: g.cols - 1 },
    routes,
    spawns,
  };
}
