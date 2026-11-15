// SPDX-License-Identifier: GPL-3.0-or-later
/** Block ownership drives both sides of a duel. One shared blocker penalty
 * survives until its final source unblocks; each enemy owns its own defense. */
export function blockedDuel({ selfDef, blockerDef, taunt, otherDamage }) {
  const refreshBlocker = (b, unit) => {
    const sources = unit.mem.regularDuels;
    const value = sources?.size ? Math.min(...sources.values()) : null;
    if (value == null) b.removeBuff(unit, 'ab:duelBlocker');
    else if (unit.findBuff('ab:duelBlocker')?.mods.defPct !== value)
      b.addBuff(unit, { key: 'ab:duelBlocker', mods: { defPct: value }, visible: true });
  };
  const sync = (b, enemy, state) => {
    const blocker = enemy.alive && enemy.blockedBy?.alive && enemy.blockedBy.deployed ? enemy.blockedBy : null;
    if (state.blocker !== blocker) {
      if (state.blocker) { state.blocker.mem.regularDuels?.delete(enemy.id); refreshBlocker(b, state.blocker); }
      state.blocker = blocker;
      if (blocker) { (blocker.mem.regularDuels ??= new Map()).set(enemy.id, blockerDef); refreshBlocker(b, blocker); }
    }
    const active = !!blocker && !enemy.s.flags.silence;
    if (active && !enemy.findBuff('ab:duelSelf'))
      b.addBuff(enemy, { key: 'ab:duelSelf', mods: { defPct: selfDef, taunt }, visible: true });
    else if (!active) b.removeBuff(enemy, 'ab:duelSelf');
    return active;
  };
  const changed = (_c, b, e, state) => sync(b, e, state);
  return {
    spawn: sync, tick: sync, blocked: changed, unblocked: changed, death: changed, status: changed,
    hitIn(c, b, e, state) {
      if (sync(b, e, state) && c.source !== state.blocker) c.dmg.mul *= otherDamage;
    },
  };
}
