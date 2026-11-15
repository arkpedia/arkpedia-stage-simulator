// SPDX-License-Identifier: GPL-3.0-or-later
/** Source layers share the ordinary post-mitigation shield pipeline. Overflow
 * crosses the original layers in this packet; newly created buffs never absorb
 * the packet again. Only depletion of the final layer changes the mode. */
export function layeredBarrier({ layers, amount, defense, speed, type, mods, afterMods }) {
  const refresh = (b, e) => {
    for (let i = 0; i < layers; i++) b.removeBuff(e, `ab:barrier:${i}`);
    b.removeBuff(e, 'ab:barrierBroken');
    b.addBuff(e, { key: 'ab:barrierDefense', persist: true, mods: mods ?? { defFlat: defense } });
    for (let i = 0; i < layers; i++) b.addBuff(e, {
      key: `ab:barrier:${i}`, source: e, persist: true, visible: true, shield: amount, shieldTypes: [type],
      onShieldAbsorb(c) {
        if (!c.depleted) return;
        b.removeBuff(e, c.buff);
        if (i !== layers - 1) return;
        b.removeBuff(e, 'ab:barrierDefense');
        b.addBuff(e, { key: 'ab:barrierBroken', persist: true, visible: true, mods: afterMods ?? (speed == null ? {} : { moveMul: speed }) });
        b.fx('shieldBreak', { x: e.x, y: e.y, id: e.id });
      },
    });
  };
  return { spawn: refresh, refresh };
}
