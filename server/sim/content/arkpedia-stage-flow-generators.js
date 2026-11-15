// SPDX-License-Identifier: GPL-3.0-or-later
import { flowGeneratorDefinition } from '../../../shared/arkpedia/device-runtime.js';
import { stageDeviceSpec } from '../../../shared/arkpedia/device-runtime.js';
import { absoluteRangeKeys, auraSelectable } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { dirVec, dirFromDelta } from '../dir.js';
const KEY = { ally: 'blower_s[atk]', enemy: 'blower_s[speed]' };
const relation = (a, z) => { const [ar, ac] = dirVec(a), [zr, zc] = dirVec(z); return ar * zr + ac * zc; };

/** One owned modifier per recipient. Overlap never duplicates ATK or speed. */
export class StageFlowGenerators {
  constructor(b, devices) {
    this.battle = b; this.entries = new Map(); this.recipients = new Map(); this.movement = new WeakMap();
    for (const d of devices) {
      if (!stageDeviceSpec(d)?.flowGenerator) continue;
      const spec = flowGeneratorDefinition(d.instance), id = `stage-device:${d.key}:${d.row}:${d.col}`;
      const unit = b.spawnDevice(d.key, d.row, d.col, { name: d.name, hp: spec.hp, blockCnt: 0, dir: spec.direction });
      if (!unit) throw Error(`Occupied Flow Generator tile: ${id}`);
      unit.def.profession = 'TRAP'; unit.deploymentSlotCost = 0; unit.mem.stageDeviceId = id;
      b.addBuff(unit, { key: 'stage:flowGenerator', persist: true, flags: { untargetable: true, noMove: true, noDisplace: true, disarm: true } });
      unit.rangeKeys = absoluteRangeKeys(spec.range, d.row, d.col, spec.direction);
      this.entries.set(id, { id, name: d.name, unit, spec, tiles: new Set(unit.rangeKeys), state: 'active' });
    }
    if (this.entries.size) b.on('tick', ({ dt }) => this.tick(dt));
  }
  moveDirection(u) {
    let state = this.movement.get(u);
    if (!state) {
      const point = u.route?.pts?.[u.route.ptIdx] ?? u.route?.legs?.find(l => l.t === 'move');
      const dx = (point?.x ?? point?.c ?? u.x) - u.x, dy = (point?.y ?? point?.r ?? u.y) - u.y;
      state = { x: u.x, y: u.y, dir: dirFromDelta(dy, dx) };
      this.movement.set(u, state);
    }
    const dx = u.x - state.x, dy = u.y - state.y;
    if (u.moving && Math.hypot(dx, dy) > 1e-8) state.dir = dirFromDelta(dy, dx, state.dir);
    state.x = u.x; state.y = u.y; return state.dir;
  }
  clear(u, state) {
    if (state.buff && u.findBuff(state.key) === state.buff) this.battle.removeBuff(u, state.buff);
    this.recipients.delete(u);
  }
  retreat(id) {
    const d = this.entries.get(id);
    if (!d?.unit.alive || !d.unit.deployed || this.battle.finished) throw Error('This device is no longer available.');
    this.battle._remove(d.unit, 'retreat', null, true);
    // Preplaced devices consumed no DP and no card; no paid cost to refund.
    this.tick(0);
  }
  tick(dt) {
    const b = this.battle, sources = [...this.entries.values()].filter(d => {
      if (!d.unit.alive || !d.unit.deployed) { d.state = 'spent'; return false; } return true;
    });
    const units = [...b.allyUnits, ...b.enemies];
    for (const u of units) {
      const enemy = u.side === 'enemy', direction = enemy ? this.moveDirection(u) : u.dir;
      const eligible = enemy ? auraSelectable(null, u) && u.kind === 'enemy' && u.def.dmgType !== 'heal'
        : u.kind === 'op' && u.alive && u.deployed && !u.hidden && !u.s.flags.untargetable && !u.s.flags.sleep && !u.s.flags.isolated;
      const previous = this.recipients.get(u);
      const available = eligible ? sources.filter(d => bodyInKeys(u, d.tiles)) : [];
      // Keep the current owner while it remains eligible; otherwise original
      // instance order supplies deterministic UNIQUE-family arbitration.
      const source = available.find(d => d === previous?.source) ?? available[0];
      if (!source) { if (previous) this.clear(u, previous); continue; }
      let state = previous;
      if (!state || state.source !== source || state.life !== u.deploySeq) {
        if (state) this.clear(u, state);
        state = { source, life: u.deploySeq, key: KEY[u.side], elapsed: 0, buff: null, relation: null };
        this.recipients.set(u, state);
      }
      state.elapsed += dt;
      if (enemy && state.elapsed + 1e-9 < source.spec.poll) continue;
      if (enemy) state.elapsed %= source.spec.poll;
      const r = relation(source.spec.direction, direction);
      if (r === state.relation && (!state.buff || u.findBuff(state.key) === state.buff)) continue;
      if (state.buff && u.findBuff(state.key) === state.buff) b.removeBuff(u, state.buff);
      state.relation = r; state.buff = null;
      if (!r) continue;
      const spec = source.spec, mods = enemy ? r > 0 ? { movePct: spec.speedBonus } : { moveMul: 1 + spec.speedPenalty }
        : r > 0 ? { atkPct: spec.atkBonus } : { atkMul: 1 + spec.atkPenalty };
      state.buff = b.addBuff(u, { key: state.key, source: source.unit, visible: true, mods });
    }
    for (const [u, state] of this.recipients) if (!u.alive || !u.deployed || u.deploySeq !== state.life) this.clear(u, state);
  }
}
