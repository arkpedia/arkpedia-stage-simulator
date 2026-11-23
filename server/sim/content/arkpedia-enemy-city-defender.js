// SPDX-License-Identifier: GPL-3.0-or-later
// Trimounts City Defender and Captain (enemy_1326_cbagen[_2]). Every number arrives in `p` from the reviewed contract
// (shared/arkpedia/enemy-city-defender-features.js).
const KEY = 'cbagen_t_debuff';

export function cityDefenderBlock(p) {
  if (!(p?.duration > 0) || !(p.attackAnim?.dur > 0) || !(p.attackAnim.hit > 0) || typeof p.tileKey !== 'string'
    || !Number.isFinite(p.tileMul) || p.tileMul < 0 || !Number.isFinite(p.normalAdd)) throw Error('Invalid City Defender parameters');
  return {
    sil: true, // ReduceBlockCnt is silenceable
    spawn(b, e) { e.def = { ...e.def, attackAnim: p.attackAnim }; },
    dealt(c, b, e) {
      const t = c.target;
      if (!t?.alive || t.side === e.side) return;
      // The debuff's start checks the target's current tile once; a repeated hit extends the one shared override.
      const onSwitch = b.grid.tile(t.tileR, t.tileC)?.key === p.tileKey;
      const prior = t.findBuff(KEY);
      if (prior && prior.data?.onSwitch === onSwitch) {
        prior.timeLeft = Math.max(prior.timeLeft ?? 0, p.duration); return;
      }
      if (prior) b.removeBuff(t, KEY);
      b.addBuff(t, { key: KEY, source: e, duration: p.duration, visible: true, data: { onSwitch },
        mods: onSwitch ? { blockCntMul: p.tileMul } : { blockCnt: p.normalAdd } });
    },
  };
}
