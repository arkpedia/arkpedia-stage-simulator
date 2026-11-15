// SPDX-License-Identifier: GPL-3.0-or-later
const TYPES = ['phys', 'arts', 'elemental', 'true'];
const WINDOW = 5;

/** Observe settled HP loss without changing combat. One ledger per squad operator,
 * including support, persists across deaths/redeployments and owns summon damage. */
export function createBattleMetrics(battle) {
  const rows = new Map(Object.keys(battle.bench).map(id => [id, {
    id, total: 0, types: Object.fromEntries(TYPES.map(type => [type, 0])), recent: [],
  }]));
  const prune = row => {
    while (row.recent.length && battle.time - row.recent[0].time >= WINDOW - 1e-9)
      row.recent.shift();
  };
  const handle = battle.on('damaged', ({ source, credit, target, hpLoss, type }) => {
    const producer = credit ?? source;
    if (producer?.side !== 'ally' || target?.side !== 'enemy' ||
        !TYPES.includes(type) || !Number.isFinite(hpLoss) || hpLoss <= 0) return;
    // Element gauge events have no hpLoss. Read the per-hit receipt rather than
    // cumulative stats: a damaged handler can synchronously cause another hit.
    let owner = producer;
    const seen = new Set();
    while (owner && !seen.has(owner)) {
      seen.add(owner);
      if (owner.kind === 'op' && rows.has(owner.defId)) break;
      owner = owner.ownerUnit;
    }
    if (owner?.kind !== 'op') return;
    const row = rows.get(owner.defId);
    if (!row) return;
    row.total += hpLoss;
    row.types[type] += hpLoss;
    prune(row);
    const last = row.recent.at(-1);
    if (last?.time === battle.time) last.amount += hpLoss;
    else row.recent.push({ time: battle.time, amount: hpLoss });
  }, { priority: Number.MAX_SAFE_INTEGER });
  return {
    read() {
      return [...rows.values()].map(row => {
        prune(row);
        return { id: row.id, total: row.total, types: { ...row.types },
          dps: row.recent.reduce((sum, hit) => sum + hit.amount, 0) / WINDOW };
      }).sort((a, b) => b.total - a.total || a.id.localeCompare(b.id));
    },
    dispose() { battle.off(handle); },
  };
}
