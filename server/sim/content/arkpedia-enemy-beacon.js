// SPDX-License-Identifier: GPL-3.0-or-later
/** Beacon's movement restriction permits external displacement, unlike static bodies. */
export function beacon() {
  return { spawn(b, e) {
    e.profile.noAttack = true; e.profile.cannotExit = true; e.profile.holdsBattle = false; e.mem.noLeak = true;
    e.def = { ...e.def, immune: new Set([...e.def.immune, 'stun', 'frozen', 'cold', 'silence', 'levitate', 'disarm', 'sleep']) };
    b.addBuff(e, { key: 'enemy_stormcoord[passive]', persist: true, flags: { noMove: true, unblockable: true } });
    b.addBuff(e, { key: 'immune_shu_blink', persist: true });
    b.on('hit', ({ target, dmg }) => {
      if (target === e) dmg.hpFloor = Math.max(dmg.hpFloor ?? 0, e.s.maxHp);
    }, { owner: e });
  } };
}
