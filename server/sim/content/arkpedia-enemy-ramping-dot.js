// SPDX-License-Identifier: GPL-3.0-or-later
import { makeDamageInfo } from '../damage.js';
/** An independent, cached-ATK effect. Its fixed pulse clock is separate from
 * the recipient's resistable lifetime; removing the buff cancels all work. */
export function attachRampingDot(b, target, { key, amount, initial, increment, every, duration, interval = 1 }) {
  const pulse = ({ unit, buff }) => {
    if (!unit.alive || !unit.deployed) return;
    const packet = makeDamageInfo({ amount: amount * (initial + increment * Math.floor(buff.data.pulses / every)),
      type: 'arts', sourceless: true, canDodge: false, isAttack: false, applyWay: 'none', tags: [key, 'dot'] });
    let accepted = false;
    const off = b.on('calculatedDamage', c => { if (c.dmg === packet) accepted = true; });
    try { b.dealDamage(null, unit, packet); } finally { b.off(off); }
    if (accepted) buff.data.pulses++;
  };
  const buff = b.addBuff(target, { key, duration: duration * (1 - b.resistOf(target)),
    refresh: 'independent', maxStacks: Number.MAX_SAFE_INTEGER, sourceStatusResistable: true,
    interval, onTick: ctx => {
      // The generic buff loop processes its callback before expiry. A pulse at
      // the lifetime boundary belongs to the expired effect, not a 21st tick.
      if (ctx.buff.timeLeft > b.dt * target.s.slowDownRate + 1e-9) pulse(ctx);
    }, visible: true, data: { pulses: 0 } });
  if (buff) pulse({ unit: target, buff });
  return buff;
}
