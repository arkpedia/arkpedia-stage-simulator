// SPDX-License-Identifier: GPL-3.0-or-later
// A native one-shot HP checker, independent of how HP fell (including HP loss).
// The checker can be silenceable while the resulting timed buff is not.
export function oneShotHpTrigger({ threshold, inclusive = false, silenceable = false, trigger }) {
  return {
    tick(b, e, a) {
      if (a.used || !e.alive || e.hp <= 0 || silenceable && e.s.flags.silence
        || !(inclusive ? e.hpRatio <= threshold : e.hpRatio < threshold)) return;
      a.used = true;
      trigger(b, e, a);
    },
  };
}
export function oneShotHpBuff({ threshold, duration, aspd, move, silenceable = false }) {
  return oneShotHpTrigger({ threshold, silenceable, trigger(b, e) {
    b.addBuff(e, { key: 'ab:oneShotHpBuff', duration, visible: true, mods: { aspd, moveMul: 1 + move } });
  } });
}
export function oneShotSelfFear({ fear, moveSpeed, duration }) {
  return oneShotHpTrigger({ threshold: .5, inclusive: true, trigger(b, e) {
    b.addBuff(e, { key: 'ab:fearRun', duration, mods: { moveMul: moveSpeed } });
    b.applyStatus(e, 'fear', { duration: fear, source: e });
  } });
}
