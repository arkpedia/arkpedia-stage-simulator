// SPDX-License-Identifier: GPL-3.0-or-later
/** Original permanent-water aura: independently timed entry damage and one
 * non-stacking movement/ASPD effect. Contact ends at the next aura scan. */
export class StageWater {
  constructor(battle, spec) {
    if (spec.kind !== 'permanent-deep-water') throw Error('Unsupported stage water program');
    this.b = battle; this.spec = spec;
    this.tiles = new Set(spec.tiles.map(([r, c]) => `${r},${c}`));
    this.contacts = new Map(); this.marked = new Set(); this.nextScan = 0;
    battle.on('tick', () => this.tick());
  }
  contains(row, col) { return this.tiles.has(`${row},${col}`) && !this.b.platformTiles?.has(`${row},${col}`); }
  eligible(unit) {
    return unit.alive && unit.deployed && !unit.removed && !unit.isFlying && unit.kind !== 'device'
      && this.contains(Math.round(unit.y), Math.round(unit.x));
  }
  clear(unit) {
    this.b.removeBuff(unit, 'stage:water');
    this.contacts.delete(unit);
  }
  tick() {
    const b = this.b, s = this.spec;
    if (b.time + 1e-9 >= this.nextScan) {
      this.nextScan = b.time + s.scanInterval;
      const marked = new Set(b.units.filter(u => this.eligible(u)));
      for (const unit of this.marked) if (!marked.has(unit)) b.removeBuff(unit, 'buff_sea');
      for (const unit of marked) if (!unit.findBuff('buff_sea')) b.addBuff(unit, { key: 'buff_sea' });
      this.marked = marked;
      for (const [unit, contact] of this.contacts)
        if (!this.eligible(unit) || contact.life !== unit.deploySeq) this.clear(unit);
      for (const unit of b.enemies) if (this.eligible(unit) && !this.contacts.has(unit)) {
        this.contacts.set(unit, { life: unit.deploySeq, nextDamage: b.time });
        b.addBuff(unit, { key: 'stage:water', mods: { aspd: s.aspd, moveMul: s.moveMul }, visible: true });
      }
    }
    for (const [unit, contact] of this.contacts) {
      if (!unit.alive || contact.life !== unit.deploySeq) { this.clear(unit); continue; }
      while (b.time + 1e-9 >= contact.nextDamage && unit.alive) {
        contact.nextDamage += s.damageInterval;
        if (s.damage) b.dealDamage(null, unit, { amount: s.damage, type: 'true', sourceless: true,
          unmodified: true, noSp: true, tags: ['dot', 'stage-water'] });
      }
    }
  }
}
