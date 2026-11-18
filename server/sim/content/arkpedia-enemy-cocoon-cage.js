// SPDX-License-Identifier: GPL-3.0-or-later
// Cocoon Cage (enemy_1432_lrccon), Theresa's 茧缚. Parameters come from the reviewed
// contract (shared/arkpedia/enemy-cocoon-cage-features.js). The battle keeps one cage per
// tile (the native `lrccon_flag` tile blackboard) in `b.cocoonCages`.
export const COCOON_CAGE = 'enemy_1432_lrccon';
const LOCK = 'enemy_lrccon[lock_core]', EMPTY = 'enemy_lrccon[invincible]', BODY = 'enemy_lrccon_immune';
const keyOf = (row, col) => `${row},${col}`;
const tileOf = u => [Math.round(u.y), Math.round(u.x)];

/** The live cages by tile. */
export function cocoonCages(b) { return (b.cocoonCages ??= new Map()); }
/** Live cages on the field (Theresa's Doom counter). */
export function cocoonCount(b) {
  let n = 0;
  for (const cage of cocoonCages(b).values()) if (cage.alive) n++;
  return n;
}
export function hasCocoon(b, row, col) { return !!cocoonCages(b).get(keyOf(row, col))?.alive; }
/** SummonEnemyWithRuntimeRoute + the lrccon_flag check: at most one cage per tile. */
export function summonCocoon(b, row, col) {
  if (!b.grid.inRect(row, col) || hasCocoon(b, row, col)) return null;
  const cage = b.spawnEnemy(COCOON_CAGE, { pos: [row, col], countInTotal: false });
  if (cage) cocoonCages(b).set(keyOf(row, col), cage);
  return cage;
}

export function cocoonCage(p) {
  const locked = (b, e) => b.allies(null, { includeTargetableDevices: true }).filter(u => u.buffs.some(x => x.key === LOCK && x.source === e));
  const release = (b, e) => { for (const u of locked(b, e)) b.removeBuff(u, LOCK); };
  const poll = (b, e, a) => {
    if (!e.alive) return;
    const [row, col] = a.tile;
    // enemy_lrccon[lock] → lock_checker: default-category operators on the cage's own tile (target-free ones included).
    for (const u of b.allies()) {
      if (!u.alive || !u.deployed || u.hidden || u.kind === 'device' || u.tileR !== row || u.tileC !== col) continue;
      if (u.buffs.some(x => x.key === LOCK)) continue;
      b.addBuff(u, { key: LOCK, source: e, persist: true, visible: true, statusResistable: false,
        flags: { stun: true, disarm: true, skillNotActivatable: true, noRetreat: true, noBlock: true, invulnerable: true } });
    }
    // lock_core: a cage that holds an operator loses its invincibility and, at full HP, 1 HP; an empty one regains it.
    if (locked(b, e).length) {
      b.removeBuff(e, EMPTY);
      if (e.hp >= e.s.maxHp) e.hp = Math.max(1, e.hp - p.hpLoss);
    } else if (!e.buffs.some(x => x.key === EMPTY)) b.addBuff(e, { key: EMPTY, persist: true, flags: { invulnerable: true } });
  };
  return {
    spawn(b, e, a) {
      a.tile = tileOf(e);
      cocoonCages(b).set(keyOf(...a.tile), e);
      e.x = a.tile[1]; e.y = a.tile[0];
      e.profile.noAttack = true; e.profile.cannotExit = true; e.mem.noLeak = true;
      // enemy_lrccon_immune: forced disarm, unblockable, self-bound, unbalance-immune, no healing.
      b.addBuff(e, { key: BODY, persist: true, flags: { disarm: true, unblockable: true, selfBound: true, noMove: true, noDisplace: true, healFree: true } });
      b.addBuff(e, { key: EMPTY, persist: true, flags: { invulnerable: true } });
      a.lock = b.every(p.interval, () => poll(b, e, a), { owner: e, immediate: true });
    },
    hitIn(c) {
      // enemy_lrccon[block_no_source_dmg]: damage without a source is cancelled.
      if (!c.source) c.dmg.cancel = true;
    },
    death(c, b, e, a) {
      a.lock?.cancel();
      release(b, e);
      const here = keyOf(...a.tile);
      if (cocoonCages(b).get(here) === e) cocoonCages(b).delete(here);
      if (c.reason !== 'killed') return;
      // enemy_lrccon[transport]: to the defeating unit's tile if it is free; without a source, back on its own tile.
      // PRTS: a source that can no longer be found (gone from the field) also leaves the cage on its own tile.
      const killer = c.killer;
      if (killer?.alive && killer.deployed && !killer.hidden) summonCocoon(b, ...tileOf(killer));
      else summonCocoon(b, ...a.tile);
    },
  };
}
