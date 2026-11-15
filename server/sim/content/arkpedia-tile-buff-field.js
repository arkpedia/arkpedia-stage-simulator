// SPDX-License-Identifier: GPL-3.0-or-later
/** Tile-bound emitters share recipient buffs. Keeping contacts at field scope
 * prevents overlap from multiplying damage or restarting a periodic clock.
 * A source owns only its tile contribution, never another source's buffs. */
export class TileBuffField {
  constructor(battle, { enemyInterval, selectable, attach, detach }) {
    this.b = battle; this.enemyInterval = enemyInterval; this.selectable = selectable;
    this.attach = attach; this.detach = detach; this.sources = new Map(); this.tiles = new Map();
    this.contacts = new Map(); this.nextEnemyScan = 0;
    battle.on('tick', () => this.refresh(), { priority: 200 });
    battle.on('deploy', () => this.refresh(true));
    battle.on('death', ({ unit }) => {
      if (this.sources.delete(unit)) this.rebuild();
      this.refresh(true);
    });
  }
  add(owner, tiles, parameters) {
    this.sources.set(owner, { tiles, parameters }); this.rebuild(); this.refresh(true);
  }
  rebuild() {
    this.tiles.clear();
    for (const [source, entry] of this.sources) for (const [row, col] of entry.tiles) {
      const key = `${row},${col}`;
      if (!this.tiles.has(key)) this.tiles.set(key, { row, col, source, parameters: entry.parameters });
    }
  }
  refresh(force = false) {
    const scanEnemies = force || this.b.time + 1e-9 >= this.nextEnemyScan;
    if (scanEnemies) this.nextEnemyScan = this.b.time + this.enemyInterval;
    const alive = new Set();
    for (const unit of this.b.units) {
      const previous = this.contacts.get(unit);
      if (unit.side === 'enemy' && !scanEnemies) { if (previous) alive.add(unit); continue; }
      const tile = this.tiles.get(`${Math.round(unit.y)},${Math.round(unit.x)}`);
      if (!tile || !this.selectable(unit)) continue;
      alive.add(unit);
      if (previous?.life === unit.deploySeq) continue;
      if (previous) this.detach(unit);
      this.attach(unit, tile.parameters, tile.source);
      this.contacts.set(unit, { life: unit.deploySeq });
    }
    for (const unit of this.contacts.keys()) if (!alive.has(unit)) {
      this.detach(unit); this.contacts.delete(unit);
    }
  }
}
