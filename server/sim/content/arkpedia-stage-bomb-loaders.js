// SPDX-License-Identifier: GPL-3.0-or-later
// Explosives Loading Point (trap_126_outset). Reviewed in shared/arkpedia/stage-bomb-loader.js. An ally-side trap the
// player activates (10 DP, 40 SP): it sends one Anti-Witchcraft bomb along its own branch route, and cannot send
// another while that bomb lives (trap_outset_hascar). Same command API as the manual devices (error/activate).
import { bombLoaderDefinition, stageDeviceSpec } from '../../../shared/arkpedia/device-runtime.js';
import { BOMB_LOADER_LORD_RADIUS } from '../../../shared/arkpedia/stage-bomb-loader.js';
import { canSpendDp, spendDp } from './arkpedia-dp-budget.js';

// Blord2Trigger's circle (stage-bomb-loader.js) plus Duq'arael's own collider (0.1, the prefab's root CircleCollider2D).
const LORD_REACH = BOMB_LOADER_LORD_RADIUS + Math.fround(.1);


export class StageBombLoaders {
  constructor(b, devices, geometry, stage = null) {
    this.battle = b; this.entries = new Map();
    const loaders = devices.filter(d => stageDeviceSpec(d)?.bombLoader);
    // A hidden one waits for the Bloodcalling Altar on its tile (ActiveOutset, reveal()).
    this.hidden = new Map();
    for (const d of loaders) {
      if (d.hidden && !(d.altarActivated && typeof d.alias === 'string')) throw Error('Hidden Explosives Loading Point requires an activation controller');
      const spec = bombLoaderDefinition(d.instance);
      if (!b.stageBranches?.branches[spec.branchId]) throw Error(`Missing Loading Point branch program: ${spec.branchId}`);
      if (d.hidden) { if (this.hidden.has(d.alias)) throw Error(`Duplicate hidden Loading Point: ${d.alias}`); this.hidden.set(d.alias, { d, spec }); continue; }
      this.place(d, spec);
    }
    if (loaders.length) b.on('tick', ({ dt }) => this.tick(dt));
  }
  place(d, spec) {
    const b = this.battle, id = `stage-device:${d.key}:${d.row}:${d.col}`;
    const unit = b.spawnDevice(d.key, d.row, d.col, { name: d.name, hp: 5000, blockCnt: 0, dir: spec.direction });
    if (!unit) throw Error(`Occupied Explosives Loading Point tile: ${id}`);
    unit.def.profession = 'TRAP'; unit.deploymentSlotCost = 0; unit.mem.stageDeviceId = id;
    b.addBuff(unit, { key: 'stage:bombLoader', persist: true, flags: { invulnerable: true, untargetable: true, disarm: true, noMove: true } });
    const entry = { id, name: d.name, key: d.key, row: d.row, col: d.col, unit, spec, sp: spec.initSp, state: 'charging', bomb: null, sent: 0,
      marked: false, lordsInside: new Set() };
    this.entries.set(id, entry);
    return entry;
  }
  /** ActivePredifinedInst from a destroyed Altar: the hidden Loading Point `alias` appears, charging from 0 SP. */
  reveal(alias) {
    const hidden = this.hidden.get(alias);
    if (!hidden) throw Error(`Unknown hidden Loading Point: ${alias}`);
    this.hidden.delete(alias);
    return this.place(hidden.d, hidden.spec);
  }
  error(id) {
    const d = this.entries.get(id), b = this.battle;
    if (!d || !d.unit.alive) return 'This device is no longer available.';
    if (b.finished) return 'The battle has ended.';
    if (d.bomb?.alive) return 'Its bomb is still on the field.';
    if (d.sp + 1e-9 < d.spec.spCost) return 'The device is charging.';
    if (!canSpendDp(b, 'arkpedia', d.spec.dpCost)) return 'Not enough DP.';
    return null;
  }
  activate(id) {
    const error = this.error(id); if (error) throw Error(error);
    const d = this.entries.get(id), b = this.battle;
    const bomb = b.stageBranches.summonUnharmful(d.spec.branchId);
    if (!bomb) throw Error('The bomb could not be sent.');
    spendDp(b, 'arkpedia', d.spec.dpCost);
    d.sp = 0; d.bomb = bomb; d.sent++; d.state = 'bomb-out';
    b.fx('pulse', { x: d.col, y: d.row, id: d.unit.id, kind: 'loader' });
    return bomb;
  }
  /** The Loading Point whose bomb this is (the bomb's host). */
  senderOf(bomb) { return [...this.entries.values()].find(d => d.bomb === bomb && d.unit.alive) ?? null; }
  /** enemy_blord2_fountain[outset] ON_BUFF_FINISH: every Loading Point marked enemy_blord2_kill[mark] dies. */
  destroyMarked() {
    const b = this.battle, out = [];
    for (const d of this.entries.values()) if (d.marked && d.unit.alive) {
      d.marked = false; d.state = 'spent';
      b.removeBuff(d.unit, 'stage:bombLoader'); b.kill(d.unit, null); out.push(d);
    }
    return out;
  }
  tick(dt) {
    const b = this.battle;
    // Blord2Trigger (radius 2, enemy_blord2_mark): Duq'arael's second form coming within reach (circles touching) gets
    // trap_outset_blord2[trigger] once per entry: the Loading Point is marked and Sunken Death forced, unless he is
    // casting it.
    const lords = b.enemies.filter(u => u.alive && u.deployed && !u.hidden && u.mem.bloodLordTwo);
    for (const d of this.entries.values()) {
      if (!d.unit.alive) { d.lordsInside.clear(); continue; }
      for (const u of [...d.lordsInside]) if (!lords.includes(u)) d.lordsInside.delete(u);
      for (const u of lords) {
        const inside = (u.x - d.col) ** 2 + (u.y - d.row) ** 2 <= LORD_REACH ** 2 + 1e-9;
        if (inside && !d.lordsInside.has(u)) { d.lordsInside.add(u); u.mem.bloodLordTwo.reached(d); }
        else if (!inside) d.lordsInside.delete(u);
      }
    }
    for (const d of this.entries.values()) {
      if (!d.unit.alive) { d.state = 'spent'; continue; }
      if (d.bomb && !d.bomb.alive) d.bomb = null;
      d.sp = Math.min(d.spec.spCost, d.sp + dt * d.spec.spPerSecond);
      d.state = d.bomb ? 'bomb-out' : d.sp + 1e-9 >= d.spec.spCost ? 'ready' : 'charging';
    }
  }
}
