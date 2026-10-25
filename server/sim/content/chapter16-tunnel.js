// SPDX-License-Identifier: GPL-3.0-or-later
// Native spawnp_t summon/count/stop/move actions. The caller supplies the
// reviewed branch action; this module never substitutes a main route for it.
import { chapter16BranchSpawner } from './chapter16-branch.js';
export const TUNNEL_CONTRACT = Object.freeze({ interval: 15, total: 5, waiting: 3,
  spCost: 15, initSp: 0, spPerSecond: 1, branch: 'mcreep_route', action: 0 });
const live = u => u?.alive && u.deployed && !u.hidden;

export function hiddenTunnel(b, owner, { spawnBranch, actionIndex = TUNNEL_CONTRACT.action }) {
  if (typeof spawnBranch !== 'function') throw Error('Hidden Tunnel requires a reviewed branch spawner');
  if (!Number.isInteger(actionIndex) || actionIndex < 0) throw Error('Unreviewed Hidden Tunnel branch action');
  owner.base.spRecovery = TUNNEL_CONTRACT.spPerSecond;
  owner.markDirty();
  const life = owner.deploySeq;
  const valid = () => live(owner) && owner.deploySeq === life;
  const children = new Map();
  let elapsed = 0;
  const state = { mode: 0, sp: TUNNEL_CONTRACT.initSp, spCost: TUNNEL_CONTRACT.spCost,
    get total() { return [...children.values()].filter(c => c.counted).length; },
    get waiting() { return [...children.values()].filter(c => c.waiting).length; },
    canActivate() {
      return valid() && !owner.s.flags.stun && !owner.s.flags.sleep && !owner.s.flags.freeze
        && !owner.s.flags.levitate && state.sp >= state.spCost - 1e-9;
    },
    activate() {
      // The retained skill cannot be cast in an abnormal action state, but
      // cannot be silenced. A ready activation always toggles, even with no miners.
      if (!state.canActivate()) return false;
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
      const child = spawnBranch(TUNNEL_CONTRACT.branch, actionIndex, owner);
      if (!child) continue;
      if (!child.mem.ch16Miner) throw Error('Hidden Tunnel branch did not spawn the canonical miner');
      const record = { life: child.deploySeq, counted: true, waiting: state.mode === 0 };
      children.set(child, record);
      child.mem.ch16TunnelHost = { unit: owner, life };
      // Native summons are unmanaged/unharmful, irrespective of level overrides.
      child.counted = false; child.lpr = 0; child.holdsBattle = false;
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

/** Preplaced ally-side trap, independent of operator cards. */
export function installChapter16Tunnels(b, devices, source) {
  const tunnels = devices.filter(d => d.key === 'trap_270_spawnp');
  if (!tunnels.length) return;
  const spawnBranch = chapter16BranchSpawner(b, source);
  b.stageDeviceActions ??= new Map();
  for (const d of tunnels) {
    const owner = b.spawnDevice(d.key, d.row, d.col, { name: d.name,
      hp: 3000, def: 100, res: 0, blockCnt: 0 });
    if (!owner) throw Error('Hidden Tunnel could not be placed at its canonical position');
    const instances = source.rawLevel.predefines?.tokenInsts;
    const inst = Array.isArray(instances) ? instances.find(t => t.inst?.characterKey === d.key
      && t.position?.row === d.row && t.position?.col === d.col && !t.hidden) : null;
    if (!inst || inst.skillIndex !== 0 || inst.mainSkillLvl !== 1 || inst.overrideTalents != null)
      throw Error('Unreviewed Hidden Tunnel native instance');
    const override = inst.overrideSkillBlackboard ?? [];
    if (!Array.isArray(override) || override.length > 1 || override.some(x => x.key !== 'talent@action_index' || x.valueStr != null))
      throw Error('Unreviewed Hidden Tunnel skill override');
    const actionIndex = override[0]?.value ?? TUNNEL_CONTRACT.action;
    if (!Number.isInteger(actionIndex) || !source.rawLevel.branches.mcreep_route.phases[0].actions[actionIndex])
      throw Error('Unreviewed Hidden Tunnel branch action');
    const state = hiddenTunnel(b, owner, { spawnBranch, actionIndex });
    owner.mem.ch16Tunnel = state;
    let commandName = d.name;
    if (tunnels.length === 2) {
      const other = tunnels.find(t => t !== d);
      const location = d.row !== other.row ? d.row < other.row ? 'Upper' : 'Lower'
        : d.col < other.col ? 'Left' : 'Right';
      commandName = `${location} ${d.name}`;
    }
    b.stageDeviceActions.set(`tunnel:${owner.id}`, { name: commandName, owner, state });
  }
}
