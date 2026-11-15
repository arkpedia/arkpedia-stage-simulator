// SPDX-License-Identifier: GPL-3.0-or-later
import { updateMire } from './terrain-mire.js';
import { recordStageOutcome } from './arkpedia-stage-outcomes.js';
export class StageMire {
  constructor(battle, spec) {
    if (spec.kind !== 'mire') throw Error('Unsupported Mire program');
    this.b = battle; this.spec = spec; this.tiles = new Set(spec.tiles.map(p => p.join(',')));
    this.contacts = new Map(); this.nextScan = 0;
    battle.on('tick', () => this.tick());
  }
  tick() {
    const b = this.b;
    if (b.time + 1e-9 < this.nextScan) return;
    this.nextScan = b.time + this.spec.scanInterval;
    const active = new Set();
    for (const u of b.units) {
      const tile = `${Math.round(u.y)},${Math.round(u.x)}`;
      // Tile contact respects target-free; the native controller independently
      // ignores ally-target-free when it attaches the mark/checker buffs.
      if (!u.alive || !u.deployed || u.removed || u.hidden || u.isFlying || u.kind === 'device'
        || u.s.flags.targetFree || u.s.flags.untargetable || !this.tiles.has(tile)) continue;
      active.add(u);
      const previous = this.contacts.get(u);
      if (u.side === 'ally' && (!previous || previous.life !== u.deploySeq || previous.tile !== tile))
        recordStageOutcome(b, u, 'locate_on_tile_mire');
      this.contacts.set(u, { life: u.deploySeq, tile });
      updateMire(b, u, true, this.spec);
    }
    for (const u of this.contacts.keys()) if (!active.has(u)) {
      updateMire(b, u, false); this.contacts.delete(u);
    }
  }
}
