// SPDX-License-Identifier: GPL-3.0-or-later
const channels = new WeakMap();
/** Independent owners, one strongest named effect, immediate fallback on exit. */
export class OwnedStageAura {
  constructor(battle, source, { key, strength, mods, flags, stackable = false }) {
    this.b = battle; this.source = source; this.key = key; this.strength = strength;
    this.spec = { mods, flags }; this.targets = new Set();
    this.stackable = stackable; this.owned = new Map();
    let map = channels.get(battle); if (!map) channels.set(battle, map = new Map());
    if (!map.has(key)) map.set(key, new Map());
    this.channel = map.get(key);
  }
  update(targets) {
    const next = new Set(targets);
    if (this.stackable) {
      for (const [u, buff] of this.owned) if (!next.has(u) || !u.alive || !u.deployed) {
        this.b.removeBuff(u, buff); this.owned.delete(u);
      }
      for (const u of next) if (u.alive && u.deployed && !u.buffs.includes(this.owned.get(u))) {
        const buff = this.b.addBuff(u, { key: this.key, source: this.source, ...this.spec,
          refresh: 'independent', maxStacks: Number.MAX_SAFE_INTEGER, data: { auraOwnerId: this.source.id } });
        if (buff) this.owned.set(u, buff);
      }
      this.targets = next; return;
    }
    for (const u of this.targets) if (!next.has(u)) {
      this.channel.get(u)?.delete(this); this.refresh(u);
    }
    for (const u of next) {
      let owners = this.channel.get(u); if (!owners) this.channel.set(u, owners = new Set());
      owners.add(this); this.refresh(u);
    }
    this.targets = next;
  }
  refresh(u) {
    const owners = this.channel.get(u);
    const winner = owners && [...owners].reduce((a, c) => !a || c.strength > a.strength ? c : a, null);
    const buff = u.findBuff(this.key);
    if (!winner || !u.alive || !u.deployed) {
      if (buff) this.b.removeBuff(u, this.key);
      if (!owners?.size) this.channel.delete(u);
      return;
    }
    if (buff?.data?.auraOwnerId === winner.source.id) return;
    this.b.addBuff(u, { key: this.key, source: winner.source, ...winner.spec, data: { auraOwnerId: winner.source.id } });
  }
  clear() { this.update([]); }
}
