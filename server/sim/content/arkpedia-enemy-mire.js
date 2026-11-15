// SPDX-License-Identifier: GPL-3.0-or-later
/** The controller supplies contact; the enemy owns its independent benefit. */
export function mireWalker({ speed }) {
  return { iv: .1, tick(b, e) {
    const key = 'ab:mireWalker';
    if (e.mem.mireContact && !e.hidden && !e.isFlying) {
      if (!e.findBuff(key)) b.addBuff(e, { key, mods: { moveMul: 1 + speed } });
    } else b.removeBuff(e, key);
  } };
}
