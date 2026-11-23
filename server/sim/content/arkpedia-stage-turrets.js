// SPDX-License-Identifier: GPL-3.0-or-later
import { turretDefinition } from '../../../shared/arkpedia/device-runtime.js';
import { stageDeviceSpec } from '../../../shared/arkpedia/device-runtime.js';
import { stageDeviceAttributes } from '../../../shared/arkpedia/stage-character-attributes.js';
import { canTargetAlly } from '../targeting.js';
import { dirVec } from '../dir.js';
import { ALLY_COLLIDER_RADIUS } from '../constants.js';
import { segmentCircleEntry } from '../projectile-collision.js';

export class StageTurrets {
  constructor(b, devices) {
    this.battle = b; this.entries = new Map(); this.hidden = new Map();
    for (const d of devices) {
      if (!stageDeviceSpec(d)?.turret) continue;
      // A hidden Turret waits for its alias: an activation branch (Faust's ballistae) or a wave action.
      if (d.hidden) {
        if (!d.alias || this.hidden.has(d.alias)) throw Error('Missing or ambiguous hidden Turret alias');
        this.hidden.set(d.alias, { d, activated: false }); continue;
      }
      this.spawn(d);
    }
    b.on('tick', ({ dt }) => this.tick(dt));
  }
  spawn(d, { allowOccupied = false } = {}) {
    const b = this.battle, spec = turretDefinition(d.instance), id = `stage-device:${d.key}:${d.row}:${d.col}`;
    const stats = stageDeviceAttributes(b.stageCardRules, d.key, { hp: spec.hp, atk: spec.atk, block: 0 }, spec.position);
    const unit = b.spawnDevice(d.key, d.row, d.col, { name: d.name, ...stats, blockCnt: 0, dir: spec.direction });
    // As for reward devices, an activation onto an occupied tile finishes without a body (no retry).
    if (!unit) { if (allowOccupied) return null; throw Error(`Occupied Turret tile: ${id}`); }
    unit.def.profession = 'TRAP'; unit.deploymentSlotCost = 0; unit.mem.stageDeviceId = id;
    b.changeDeviceSide(unit, 'enemy');
    // Native trap category is excluded from character selectors. Keep its
    // damage source/faction without making it an attackable wave enemy.
    b.addBuff(unit, { key: 'stage:turret', persist: true,
      flags: { invulnerable: true, untargetable: true, noMove: true, noDisplace: true, disarm: true, unblockable: true } });
    this.entries.set(id, { id, name: d.name, unit, spec, sp: spec.initSp, state: 'charging', cast: null });
    return unit;
  }
  /** ACTIVATE_PREDEFINED on a hidden Turret alias; false when the alias is not a Turret. */
  activate(alias) {
    const entry = this.hidden.get(alias);
    if (!entry) return false;
    if (!entry.activated) { entry.activated = true; this.spawn(entry.d, { allowOccupied: true }); }
    return true;
  }
  fire(d) {
    const b = this.battle, source = d.unit, spec = d.spec, [dr, dc] = dirVec(spec.direction);
    b.addProjectile({ from: source, source, to: { x: source.x + dc * spec.speed * spec.lifetime, y: source.y + dr * spec.speed * spec.lifetime },
      speed: spec.speed, maxAge: spec.lifetime, expireInPlace: true, visual: 'arrow', data: { arkpediaTrackedVisual: true, stageTurret: d.id },
      onMove: ({ projectile, previous, x, y }) => {
        const hits = b.allies(null, { includeTargetableDevices: true }).flatMap(u => {
          if (!canTargetAlly(source, u, true)) return [];
          const t = segmentCircleEntry(previous, { x, y }, u, spec.radius + ALLY_COLLIDER_RADIUS);
          return t == null ? [] : [{ u, t }];
        }).sort((a, z) => a.t - z.t || a.u.deploySeq - z.u.deploySeq);
        if (hits.length) {
          const { u, t } = hits[0]; projectile.x = previous.x + (x - previous.x) * t; projectile.y = previous.y + (y - previous.y) * t;
          projectile.removed = true;
          b.dealDamage(source, u, { amount: source.s.atk, type: 'phys', isAttack: false, isSkill: true, applyWay: 'ranged', tags: ['stage:turret'] });
        } else if (x < -.5 || y < -.5 || x > b.regularMapSize.cols - .5 || y > b.regularMapSize.rows - .5) projectile.removed = true;
      } });
  }
  tick(dt) {
    for (const d of this.entries.values()) {
      if (!d.unit.alive || !d.unit.deployed) { d.state = 'spent'; d.cast = null; continue; }
      if (d.cast != null) {
        d.cast += dt;
        if (d.cast + 1e-9 >= d.spec.release) { this.fire(d); d.cast = null; d.state = 'charging'; }
      } else {
        d.sp = Math.min(d.spec.spCost, d.sp + dt * d.spec.spPerSecond);
        if (d.sp + 1e-9 >= d.spec.spCost) { d.sp = 0; d.cast = 0; d.state = 'active'; }
      }
    }
  }
}
