// SPDX-License-Identifier: GPL-3.0-or-later
import { characterLikeTarget } from '../targeting.js';
const tileKey = (r, c) => `${r},${c}`;
/** Shared three-state terrain. Enemy abilities request ignition through this
 * controller; they never duplicate spread, extinguishing or damage logic. */
export class StageReeds {
  constructor(battle, spec) {
    if (spec.kind !== 'reeds') throw Error('Unsupported Reeds program');
    this.b = battle; this.spec = spec; this.nextScan = 0; this.contacts = new Map();
    this.tiles = new Map(spec.tiles.map(t => [tileKey(t.row, t.col), { ...t, mode: t.initialMode ?? 0, timer: 0, occupied: false }]));
    battle.on('tick', () => this.tick());
    battle.on('deploy', () => this.scan());
    battle.on('enemySpawn', () => this.scan());
  }
  at(row, col) { return this.tiles.get(tileKey(row, col)); }
  ignite(row, col) {
    const t = this.at(row, col);
    if (!t || t.mode !== 0) return false;
    this.switchMode(t, 1); return true;
  }
  hasBurningNear(x, y, radius) {
    const squared = radius * radius;
    for (const tile of this.tiles.values()) if (tile.mode === 1
      && (tile.col - x) ** 2 + (tile.row - y) ** 2 <= squared + 1e-9) return true;
    return false;
  }
  igniteNear(x, y, radius) {
    for (const tile of this.tiles.values()) if ((tile.col - x) ** 2 + (tile.row - y) ** 2 <= radius ** 2 + 1e-9)
      this.ignite(tile.row, tile.col);
  }
  igniteAll() { for (const t of this.tiles.values()) this.ignite(t.row, t.col); }
  switchMode(tile, mode) {
    tile.mode = mode; tile.timer = 0; tile.occupied = false;
    this.scan();
  }
  clear(unit) {
    unit.mem.reedsExtinct = false;
    this.b.removeBuff(unit, 'stage:reeds:camouflage');
    this.contacts.delete(unit);
  }
  eligible(u) {
    return u.alive && u.deployed && !u.removed && !u.hidden && characterLikeTarget(u)
      && !(u.side === 'ally' && u.s.flags.untargetable);
  }
  scan() {
    const b = this.b, seen = new Set();
    for (const u of b.units) {
      const tile = this.at(Math.round(u.y), Math.round(u.x));
      if (!tile || !this.eligible(u)) continue;
      seen.add(u);
      let contact = this.contacts.get(u);
      if (!contact || contact.life !== u.deploySeq || contact.tile !== tile || contact.mode !== tile.mode) {
        if (contact) this.clear(u);
        contact = { life: u.deploySeq, tile, mode: tile.mode, nextDamage: b.time + this.spec.damageInterval };
        this.contacts.set(u, contact);
        if (u.side === 'ally' && tile.mode !== 1) b.addBuff(u, { key: 'stage:reeds:born', duration: this.spec.entryStealth, flags: { stealth: true } });
      }
      u.mem.reedsExtinct = tile.mode !== 1;
      if (u.side === 'ally') {
        if (tile.mode !== 1 && !u.blocking?.some(e => e.alive && e.blockedBy === u)) {
          if (!u.findBuff('stage:reeds:camouflage')) b.addBuff(u, { key: 'stage:reeds:camouflage', flags: { camou: true } });
        } else b.removeBuff(u, 'stage:reeds:camouflage');
      }
    }
    for (const u of this.contacts.keys()) if (!seen.has(u)) this.clear(u);
  }
  tick() {
    const b = this.b, dt = b.dt;
    if (b.time + 1e-9 >= this.nextScan) { this.nextScan = b.time + this.spec.scanInterval; this.scan(); }
    // Gather transitions before applying them so newly ignited neighbors cannot
    // advance during the same step or depend on source map insertion order.
    const spread = new Set(), cool = [], ready = [];
    for (const t of this.tiles.values()) {
      if (t.mode === 2) { t.timer += dt; if (t.timer + 1e-9 >= t.cooldown_duration) ready.push(t); continue; }
      if (t.mode !== 1) continue;
      const occupied = b.allyUnits.some(u => this.eligible(u) && Math.round(u.y) === t.row && Math.round(u.x) === t.col);
      if (occupied !== t.occupied) { t.occupied = occupied; t.timer = 0; }
      t.timer += dt;
      if (occupied) { if (t.timer + 1e-9 >= t.extinct_duration) cool.push(t); }
      else if (t.timer + 1e-9 >= t.ignite_duration) {
        t.timer %= t.ignite_duration;
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const other = this.at(t.row + dr, t.col + dc); if (other?.mode === 0) spread.add(other);
        }
      }
    }
    for (const t of cool) this.switchMode(t, 2);
    for (const t of ready) this.switchMode(t, 0);
    for (const t of spread) if (t.mode === 0) this.switchMode(t, 1);
    for (const [u, contact] of this.contacts) {
      if (u.side !== 'ally' || contact.mode !== 1 || !this.eligible(u) || u.deploySeq !== contact.life) continue;
      while (b.time + 1e-9 >= contact.nextDamage && u.alive && u.deploySeq === contact.life) {
        contact.nextDamage += this.spec.damageInterval;
        b.dealDamage(null, u, { amount: contact.tile.damage, type: 'arts', sourceless: true, noSp: true,
          canDodge: false, tags: ['terrain', 'periodic', 'reeds'] });
        if (u.alive && u.deploySeq === contact.life) b.dealDamage(null, u, { amount: contact.tile.ep_damage,
          type: 'element', element: 'burn', sourceless: true, noSp: true, tags: ['terrain', 'reeds'] });
      }
    }
  }
  resultTiles() {
    return [...this.tiles.values()].map(t => ({ key: 'tile_reed_mode', row: t.row, col: t.col, value: t.mode }));
  }
}
