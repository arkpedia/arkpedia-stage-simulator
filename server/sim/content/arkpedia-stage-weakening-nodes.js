// SPDX-License-Identifier: GPL-3.0-or-later
// Weakening Node (trap_227_mpweak; chapter 15). Reviewed in shared/arkpedia/stage-weakening-node.js. An ally-side trap
// nothing can attack. Nodes are placed by the level or deployed by the Intrusive Call (arkpedia-stage-prts-control.js).
// - It charges 30 SP at 1 SP/s. When full it calls the Intrusive Call, which flies over and activates it against the
//   operators (ground ally units in its 3x3: DEF x0.5, RES x0.5) for 20 s.
// - While it is full the player may activate it first for 10 DP: every enemy in its 3x3 has DEF x0.5 and RES x0.5 for
//   30 s. The hand then finds it already active and is Angry.
// - A unit keeps the penalty only while it stays in range. Afterwards the node charges again from 0.
import { weakeningNodeDefinition, stageDeviceSpec } from '../../../shared/arkpedia/device-runtime.js';
import { canSpendDp, spendDp } from './arkpedia-dp-budget.js';

const KEY = 'trap_227_mpweak';
const TEXT = 'When charged, PRTS activates it against your operators nearby (DEF and RES halved for 20 s). Activate it first for 10 DP to halve the DEF and RES of enemies nearby for 30 s.';
const live = u => u?.alive && u.deployed !== false && !u.hidden;

export class StageWeakeningNodes {
  constructor(b, devices = []) {
    this.battle = b; this.entries = new Map();
    for (const d of devices) {
      if (!stageDeviceSpec(d)?.weakeningNode) continue;
      if (d.hidden) throw Error('Hidden Weakening Node requires an activation controller');
      if (!this.place(d.row, d.col, { name: d.name, spec: weakeningNodeDefinition(d.instance) })) throw Error(`Occupied Weakening Node tile: ${d.row},${d.col}`);
    }
    b.on('tick', ({ dt }) => this.tick(dt));
  }
  /** A node on a free tile; null when the tile is taken. */
  place(row, col, { name = 'Weakening Node', spec = weakeningNodeDefinition({ level: 1, skillLevel: 1 }) } = {}) {
    const b = this.battle, id = `stage-device:${KEY}:${row}:${col}`;
    if (this.entries.has(id)) return null;
    const unit = b.spawnDevice(KEY, row, col, { name, hp: spec.hp, blockCnt: 0 });
    if (!unit) return null;
    unit.def.profession = 'TRAP'; unit.deploymentSlotCost = 0; unit.mem.stageDeviceId = id; unit.base.tauntLevel = -1; unit.markDirty();
    b.addBuff(unit, { key: 'stage:weakeningNode', persist: true,
      flags: { untargetable: true, invulnerable: true, undeadable: true, noMove: true, noDisplace: true, disarm: true, noHeal: true } });
    const entry = { id, name, key: KEY, row, col, unit, sp: spec.initSp, state: 'charging', mode: null, activeAt: null, until: null,
      affected: new Set(), uses: { player: 0, prts: 0 }, tiles: new Set(spec.range.map(([r, c]) => `${row + r},${col + c}`)),
      spec: { ...spec, kind: 'weakening-node', description: TEXT, range: spec.range } };
    Object.defineProperty(entry.spec, 'statusLabel', { enumerable: true, get: () => entry.state === 'active'
      ? `${entry.mode === 'ally' ? 'Weakening enemies' : 'Weakening operators'} · ${Math.max(0, Math.ceil(entry.until - b.time))}s`
      : entry.state === 'ready' ? 'Charged · PRTS is coming' : `${Math.floor(entry.sp)} / ${spec.spCost} SP` });
    unit.rangeKeys = [...entry.tiles].map(k => k.split(',').map(Number)).filter(([r, c]) => b.grid.inRect(r, c)).map(([r, c]) => r * b.grid.cols + c);
    this.entries.set(id, entry);
    return entry;
  }
  error(id) {
    const d = this.entries.get(id), b = this.battle;
    if (!d || !d.unit.alive) return 'This device is no longer available.';
    if (b.finished) return 'The battle has ended.';
    if (d.state === 'active') return 'This device is already active.';
    if (d.state !== 'ready') return 'The device is charging.';
    if (!canSpendDp(b, 'arkpedia', d.spec.dpCost)) return 'Not enough DP.';
    return null;
  }
  /** The player's cast: mode Ally. */
  activate(id) {
    const error = this.error(id); if (error) throw Error(error);
    const d = this.entries.get(id);
    spendDp(this.battle, 'arkpedia', d.spec.dpCost);
    d.uses.player++; this.start(d, 'ally', d.spec.duration);
  }
  /** The Intrusive Call's cast on arrival: mode Enemy. False when the node is not waiting for it (the hand is Angry). */
  prtsActivate(d) {
    if (!d?.unit.alive || d.state !== 'ready') return false;
    d.uses.prts++; this.start(d, 'enemy', d.spec.prtsDuration);
    return true;
  }
  start(d, mode, duration) {
    const b = this.battle;
    d.state = 'active'; d.mode = mode; d.sp = 0; d.activeAt = b.time; d.until = b.time + duration;
    b.fx?.('pulse', { x: d.col, y: d.row, id: d.unit.id, kind: mode === 'ally' ? 'weakenEnemies' : 'weakenAllies' });
  }
  targets(d) {
    const b = this.battle, inside = u => d.tiles.has(`${Math.round(u.tileR ?? u.y)},${Math.round(u.tileC ?? u.x)}`);
    return d.mode === 'ally' ? b.enemies.filter(u => live(u) && u.kind !== 'device' && !u.mem.prtsCarried && inside(u))
      : b.allyUnits.filter(u => live(u) && u.kind !== 'device' && !u.isFlying && inside(u));
  }
  tick(dt) {
    const b = this.battle;
    for (const d of this.entries.values()) {
      if (!d.unit.alive) continue;
      const buff = `stage:weakened:${d.id}`;
      if (d.state === 'charging') {
        d.sp = Math.min(d.spec.spCost, d.sp + d.spec.spPerSecond * dt);
        if (d.sp + 1e-9 >= d.spec.spCost) { d.state = 'ready'; b.stagePrts?.requestActivate(d); }
        continue;
      }
      if (d.state !== 'active') continue;
      const ended = b.time + 1e-9 >= d.until, now = ended ? new Set() : new Set(this.targets(d));
      for (const u of d.affected) if (!now.has(u)) { d.affected.delete(u); if (u.alive) b.removeBuff(u, buff); }
      for (const u of now) if (!d.affected.has(u)) {
        d.affected.add(u);
        b.addBuff(u, { key: buff, persist: true, visible: true, mods: { defMul: d.spec.defScale, resMul: d.spec.resScale } });
      }
      if (ended) { d.state = 'charging'; d.mode = null; d.sp = 0; d.until = null; }
    }
  }
}
