// SPDX-License-Identifier: GPL-3.0-or-later
/** Shared Security Service danger clock. It consumes scheduler state rather
 * than owning a second wave program or changing enemy base definitions. */
export function installStageDanger(b, spec) {
  if (b.stageDanger) throw Error('Stage danger already installed');
  if (!Number.isInteger(spec.initial) || spec.initial < 0 || spec.initial > spec.max
    || !Number.isInteger(spec.max) || spec.max > 50 || !(spec.delay > 0) || !(spec.interval > 0)
    || !Number.isFinite(spec.delay) || !Number.isFinite(spec.interval)
    || !Array.isArray(spec.limits) || spec.limits.some((n,i) => !Number.isInteger(n) || n < 1 || n > spec.max || i && n < spec.limits[i-1])
    || spec.limits.length && spec.initial > spec.limits[0]
    || !Array.isArray(spec.blacklist) || !spec.perLevel
    || Object.keys(spec.perLevel).sort().join() !== 'aspdPct,atkPct,defPct,hpPct,movePct'
    || Object.values(spec.perLevel).some(v => !Number.isFinite(v) || v < 0 || v > 1)) throw Error('Invalid stage danger');
  const state = { level: spec.initial, elapsed: 0, nextAt: spec.delay, cap: spec.limits[0] ?? spec.max };
  const key = 'stage:danger', excluded = new Set(spec.blacklist);
  const attach = enemy => {
    if (!enemy.alive || enemy.side !== 'enemy' || enemy.kind !== 'enemy' || excluded.has(enemy.defId)) return;
    const mods = Object.fromEntries(Object.entries(spec.perLevel).map(([k,v]) => [k, v * state.level]));
    b.addBuff(enemy, { key, persist: true, mods });
    // Commit the max-HP change now so subsequent damage sees the same ratio.
    void enemy.s;
  };
  b.stageDanger = state;
  b.on('enemySpawn', ({ enemy }) => attach(enemy));
  for (const enemy of b.enemies) attach(enemy);
  b.on('tick', ({ dt }) => {
    const scheduler = b.stageWaveScheduler;
    state.cap = spec.limits[Math.min(scheduler?.wave ?? 0, spec.limits.length - 1)] ?? spec.max;
    if (scheduler?.done || scheduler?.postUntil != null) return;
    state.elapsed += dt;
    while (state.elapsed + 1e-9 >= state.nextAt) {
      state.nextAt += spec.interval;
      if (state.level >= state.cap) continue;
      state.level++;
      for (const enemy of b.enemies) attach(enemy);
      b.emit('stageDangerChanged', { level: state.level, cap: state.cap });
    }
  });
  return state;
}
