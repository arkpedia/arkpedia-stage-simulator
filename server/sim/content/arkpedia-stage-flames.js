// SPDX-License-Identifier: GPL-3.0-or-later
// Energy Aggregates (trap_021_flame; shared/arkpedia/stage-flames.js). Hidden instances wait for their alias: the
// Black Snake's looping SummonFlame branch activates five at a time, and an alias may come back after its previous
// body withdrew. Each body is an enemy-side, attackable device; 25 s after it appears it fires four fireballs (up,
// right, down, left) and withdraws. Killed first, it never fires.
import { flameDefinition, stageDeviceSpec } from '../../../shared/arkpedia/device-runtime.js';
import { canTargetAlly } from '../targeting.js';
import { ALLY_COLLIDER_RADIUS } from '../constants.js';
import { segmentCircleEntry } from '../projectile-collision.js';
import { applyBurningBreath } from './arkpedia-burning-breath.js';

const DIRECTIONS = [[-1, 0], [0, 1], [1, 0], [0, -1]];

export class StageFlames {
  constructor(b, devices) {
    this.battle = b; this.hidden = new Map(); this.live = new Set();
    for (const d of devices) {
      if (!stageDeviceSpec(d)?.flame) continue;
      if (!d.hidden || !d.branchActivated || !d.alias || this.hidden.has(d.alias)) throw Error('Energy Aggregates must be hidden branch-activated aliases');
      this.hidden.set(d.alias, { d, spec: flameDefinition(d.instance), unit: null });
    }
    b.on('tick', ({ dt }) => this.tick(dt));
  }
  /** ACTIVATE_PREDEFINED on an Energy Aggregate alias: a new body unless the previous one is still standing. */
  activate(alias) {
    const entry = this.hidden.get(alias);
    if (!entry) return false;
    if (entry.unit?.alive && entry.unit.deployed) return true;
    const b = this.battle, { d, spec } = entry;
    const unit = b.spawnDevice(d.key, d.row, d.col, { name: d.name, hp: spec.hp, def: spec.def, res: spec.res, blockCnt: 0 });
    // An occupied tile finishes without a body, as for the other activated devices.
    if (!unit) { entry.unit = null; return true; }
    unit.def.profession = 'TRAP'; unit.deploymentSlotCost = 0; unit.mem.stageDeviceId = `stage-device:${d.key}:${d.row}:${d.col}`;
    b.changeDeviceSide(unit, 'enemy');
    // It stands still and never attacks; operators may attack it (category 1, "easily attacked by our units").
    b.addBuff(unit, { key: 'stage:flame', persist: true, flags: { noMove: true, noDisplace: true, disarm: true, unblockable: true } });
    entry.unit = unit; this.live.add(entry);
    unit.mem.flame = { sp: spec.initSp };
    return true;
  }
  fire(entry) {
    const b = this.battle, source = entry.unit, spec = entry.spec;
    for (const [dr, dc] of DIRECTIONS) b.addProjectile({ from: source, source,
      to: { x: source.x + dc * spec.speed * spec.lifetime, y: source.y + dr * spec.speed * spec.lifetime },
      speed: spec.speed, maxAge: spec.lifetime, expireInPlace: true, visual: 'enemy', data: { arkpediaTrackedVisual: true, stageFlame: entry.d.alias },
      onMove: ({ projectile, previous, x, y }) => {
        const hits = b.allies(null, { includeTargetableDevices: true }).flatMap(u => {
          if (!canTargetAlly(source, u, true)) return [];
          const t = segmentCircleEntry(previous, { x, y }, u, spec.radius + ALLY_COLLIDER_RADIUS);
          return t == null ? [] : [{ u, t }];
        }).sort((a, z) => a.t - z.t || a.u.deploySeq - z.u.deploySeq);
        if (hits.length) {
          const { u, t } = hits[0]; projectile.x = previous.x + (x - previous.x) * t; projectile.y = previous.y + (y - previous.y) * t;
          projectile.removed = true;
          b.dealDamage(source, u, { amount: spec.damage, type: 'arts', isSkill: true, applyWay: 'ranged', tags: ['stage:flame'] });
          applyBurningBreath(b, source, u, spec.breath, { refresh: true, tag: 'flameBreath' });
        } else if (x < -.5 || y < -.5 || x > b.regularMapSize.cols - .5 || y > b.regularMapSize.rows - .5) projectile.removed = true;
      } });
  }
  tick(dt) {
    for (const entry of [...this.live]) {
      const unit = entry.unit;
      if (!unit?.alive || !unit.deployed) { this.live.delete(entry); continue; }
      const state = unit.mem.flame;
      state.sp = Math.min(entry.spec.spCost, state.sp + dt * entry.spec.spPerSecond);
      if (state.sp + 1e-9 < entry.spec.spCost) continue;
      this.fire(entry);
      // flame_s[withdraw]: the device leaves (no defeat, no reward).
      this.live.delete(entry);
      this.battle._remove(unit, 'flame-withdrawn', null, true);
    }
  }
}
