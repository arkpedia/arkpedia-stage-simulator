// SPDX-License-Identifier: GPL-3.0-or-later
// Native spawnp_t summon/count/stop/move actions. The caller supplies the
// reviewed branch action; this module never substitutes a main route for it.
export const TUNNEL_CONTRACT = Object.freeze({ interval: 15, total: 5, waiting: 3,
  spCost: 15, initSp: 0, spPerSecond: 1, branch: 'mcreep_route', action: 0 });
const live = u => u?.alive && u.deployed && !u.hidden;

export function hiddenTunnel(b, owner, { spawnBranch }) {
  if (typeof spawnBranch !== 'function') throw Error('Hidden Tunnel requires a reviewed branch spawner');
  owner.base.spRecovery = TUNNEL_CONTRACT.spPerSecond;
  owner.markDirty();
  const life = owner.deploySeq;
  const valid = () => live(owner) && owner.deploySeq === life;
  const children = new Map();
  let elapsed = 0;
  const state = { mode: 0, sp: TUNNEL_CONTRACT.initSp, spCost: TUNNEL_CONTRACT.spCost,
    get total() { return [...children.values()].filter(c => c.counted).length; },
    get waiting() { return [...children.values()].filter(c => c.waiting).length; },
    activate() {
      // The retained skill cannot be cast in an abnormal action state, but
      // cannot be silenced. A ready activation always toggles, even with no miners.
      if (!valid() || owner.s.flags.stun || owner.s.flags.sleep || owner.s.flags.freeze
        || owner.s.flags.levitate || state.sp < state.spCost - 1e-9) return false;
      state.sp = 0;
      state.mode = 1 - state.mode;
      if (state.mode === 1) for (const [child, record] of children)
        if (record.counted && record.stopBuff) b.removeBuff(child, record.stopBuff);
      return true;
    },
  };
  const forget = child => {
    const record = children.get(child);
    if (!record) return;
    children.delete(child);
    if (record.stopBuff) b.removeBuff(child, record.stopBuff);
    if (record.countBuff) b.removeBuff(child, record.countBuff);
  };
  b.on('death', ({ unit }) => forget(unit));
  b.on('tick', ({ dt }) => {
    for (const [child, record] of children)
      if (!child.alive || !child.deployed || child.deploySeq !== record.life) forget(child);
    if (!valid()) return;
    if (!owner.s.flags.noSp) state.sp = Math.min(state.spCost, state.sp + dt * owner.s.spRecovery);
    elapsed += dt;
    while (elapsed >= TUNNEL_CONTRACT.interval - 1e-9) {
      elapsed -= TUNNEL_CONTRACT.interval;
      // Failed attempts consume their interval; a freed slot is checked on the
      // next scheduled attempt, not filled immediately or added to a backlog.
      if (state.total >= TUNNEL_CONTRACT.total || state.waiting >= TUNNEL_CONTRACT.waiting) continue;
      const child = spawnBranch(TUNNEL_CONTRACT.branch, TUNNEL_CONTRACT.action, owner);
      if (!child) continue;
      if (!child.mem.ch16Miner) throw Error('Hidden Tunnel branch did not spawn the canonical miner');
      const record = { life: child.deploySeq, counted: true, waiting: state.mode === 0 };
      children.set(child, record);
      child.mem.ch16TunnelHost = { unit: owner, life };
      // Native summons are unmanaged/unharmful, irrespective of level overrides.
      child.counted = false; child.lpr = 0;
      const key = `spawnp_t[count_manager_m${state.mode}]`;
      record.countBuff = b.addBuff(child, { key, source: owner, persist: true,
        onRemove() { record.counted = false; if (!record.waiting) children.delete(child); } });
      if (record.waiting) record.stopBuff = b.addBuff(child, { key: 'spawnp_t[stop_move]', source: owner,
        persist: true, flags: { noMove: true },
        onRemove() { record.waiting = false; if (!record.counted) children.delete(child); } });
    }
  });
  return state;
}
