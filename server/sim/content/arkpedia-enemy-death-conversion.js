// SPDX-License-Identifier: GPL-3.0-or-later
import {enterEnemyHusk} from './arkpedia-enemy-ability-runtime.js';
import {remainingRoute,spawnChildren} from './arkpedia-enemy-spawn.js';

/** A global death-conversion aura. One native buff key has one current owner;
 * detaching another emitter must not remove it or duplicate the summon. */
export function deathConversionAura({ child, delay, excludedPrefabs, excludedTags, buffKey }) {
  const excluded = new Set(excludedPrefabs);
  const eligible = (e, u) => u !== e && u.side === e.side && u.kind === 'enemy' && u.alive && u.deployed
    && !excluded.has(u.def.raw?.prefabKey ?? u.defId) && !excludedTags.some(tag => u.tags.has(tag));
  const clear = (b, e, a) => {
    for (const u of a.targets) if (u.findBuff(buffKey)?.source === e) b.removeBuff(u, buffKey);
    a.targets.clear();
  };
  const refresh = (b, e, a) => {
    if (!e.alive || !e.deployed) { clear(b, e, a); return; }
    for (const u of a.targets) if (!eligible(e, u)) {
      if (u.findBuff(buffKey)?.source === e) b.removeBuff(u, buffKey);
      a.targets.delete(u);
    }
    for (const u of b.enemies) if (eligible(e, u)) {
      if (!u.findBuff(buffKey)) b.addBuff(u, { key: buffKey, source: e });
      if (u.findBuff(buffKey)?.source === e) a.targets.add(u);
    }
  };
  return {
    spawn(b, e, a) {
      a.targets = new Set(); refresh(b, e, a);
      b.on('enemySpawn', () => refresh(b, e, a), { owner: e });
      b.on('death', ({ unit, reason }) => {
        if (unit === e) { clear(b, e, a); return; }
        if (!e.alive || reason !== 'killed' || unit.mem.deathByFall || unit.findBuff(buffKey)?.source !== e) return;
        a.targets.delete(unit);
        // Capture the defeated body's remaining route and position now. The
        // summoned record supplies its own stats; no victim stat mods travel.
        const route = remainingRoute(unit), pos = [unit.y, unit.x];
        const spawn = () => {
          const children = spawnChildren(b, unit, child, 1, { route, pos, mods: {}, countInTotal: false });
          for (const summoned of children) if (!enterEnemyHusk(b, summoned))
            throw Error(`Death-conversion child has no hit-count form: ${child}`);
          return children;
        };
        if (b.stageWaveScheduler) b.stageWaveScheduler.scheduleSummon(unit, delay, spawn);
        else b.after(delay, spawn, { holdsBattle: true });
      }, { owner: e });
    },
    tick: refresh,
    death(_c, b, e, a) { clear(b, e, a); },
  };
}
