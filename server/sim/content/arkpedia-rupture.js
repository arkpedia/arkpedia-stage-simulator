// SPDX-License-Identifier: GPL-3.0-or-later
// Native rupture uses one overrideKey and DamageByDistance start/trigger/finish.
// Local policy: first source/value wins; subsequent applications extend time.
// Sampling is every simulation step, with explicit displacement receipts so an
// out-and-back shift cannot disappear as zero net movement. Native five-frame
// sampling/teleport cutoff and closed UPDATE rules are not frame-certified.
const live = u => u?.alive && u.deployed;
export function applyDistanceRupture(b, source, target, bb, { key, tag, mods = null } = {}) {
  if (!live(target)) return null;
  const old = target.buffs.find(x => x.data?.regularRupture);
  if (old) { old.timeLeft = Math.max(old.timeLeft, bb.duration); return old; }
  let x = target.x, y = target.y, distance = 0, elapsed = 0, stopped = false;
  let tick, shift, death;
  const collect = (px = target.x, py = target.y) => {
    distance += Math.hypot(px - x, py - y); x = px; y = py;
  };
  const flush = () => {
    const amount = distance * bb.value; distance = 0;
    if (live(target) && amount > 0) b.dealDamage(source, target, { amount,
      type: 'true', isSkill: true, tags: ['dot', tag], applyWay: 'none', ignoreSelect: true });
  };
  const stop = () => {
    if (stopped) return; stopped = true; collect(); flush();
    if (tick) b.off(tick); if (shift) b.off(shift); if (death) b.off(death);
  };
  const buff = b.addBuff(target, { key, source, duration: bb.duration, mods,
    data: { regularRupture: true, value: bb.value, interval: bb.interval },
    onExpire: stop, onRemove: stop });
  if (!buff) return null;
  death = b.on('death', ({ unit }) => {
    if (unit !== target) return;
    stop(); b.removeBuff(target, key);
  }, { owner: target });
  shift = b.on('enemyDisplaced', ({ unit, from, to, distance: moved }) => {
    if (unit !== target || stopped) return;
    collect(from.x, from.y); distance += moved; x = to.x; y = to.y;
  }, { owner: target });
  tick = b.on('tick', ({ dt }) => {
    if (stopped) return;
    if (!target.findBuff(key)) { stop(); return; }
    collect(); elapsed += dt;
    if (elapsed + 1e-9 >= bb.interval) { elapsed %= bb.interval; flush(); }
  }, { owner: target });
  return buff;
}
