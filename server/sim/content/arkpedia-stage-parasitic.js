// SPDX-License-Identifier: GPL-3.0-or-later
import { remainingRoute, spawnChildren } from './enemies.js';

/** Original level-owned host keys avoid copying a parasite talent into every
 * enemy adapter. A released summon keeps the defeated body's remaining route. */
export function installParasiticEnvironment(b, environment) {
  const hosts = new Set(environment.hosts), forced = new Set(environment.forced), released = new WeakSet();
  const eligible = unit => unit?.kind === 'enemy' && unit.side === 'enemy' && hosts.has(unit.defId)
    && ((unit.def.raw?.prefabKey ?? unit.defId) !== 'enemy_2065_skzjs' || forced.has(unit.defId));
  const attach = unit => {
    if (eligible(unit) && unit.alive && unit.deployed)
      b.addBuff(unit, { key: 'skzjs_hit[effect]', visible: true });
  };
  b.on('enemySpawn', ({ enemy }) => attach(enemy));
  for (const unit of b.enemies) attach(unit);
  b.on('death', ({ unit, reason }) => {
    if (reason !== 'killed' || !eligible(unit) || unit.mem.deathByFall || released.has(unit)) return;
    released.add(unit);
    const route = remainingRoute(unit), pos = [unit.y, unit.x];
    const spawn = () => spawnChildren(b, unit, environment.enemy, 1, { route, pos, mods: {}, countInTotal: false });
    if (b.stageWaveScheduler) b.stageWaveScheduler.scheduleSummon(unit, environment.delay, spawn, { dontBlockWave: true });
    else b.after(environment.delay, spawn, { holdsBattle: true });
  });
}
