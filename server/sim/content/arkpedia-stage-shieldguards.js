// SPDX-License-Identifier: GPL-3.0-or-later
// Shieldguard (trap_024_npcsld): an ally-side placed blocker. It blocks 3, strikes one blocked ground enemy with an
// ordinary melee attack (the engine's ally attack loop over its own tile), carries taunt level 1 and cannot be healed.
// Reviewed in shared/arkpedia/stage-shieldguard.js.
import { shieldguardDefinition, stageDeviceSpec } from '../../../shared/arkpedia/device-runtime.js';
import { stageDeviceAttributes } from '../../../shared/arkpedia/stage-character-attributes.js';
import { resolveProfile } from '../professions.js';
import { updateAlly } from '../ai.js';

export class StageShieldguards {
  constructor(b, devices) {
    this.battle = b; this.units = []; this.hidden = new Map();
    for (const d of devices) {
      if (!stageDeviceSpec(d)?.shieldguard) continue;
      if (d.hidden) {
        if (!d.alias || this.hidden.has(d.alias)) throw Error('Missing or ambiguous hidden Shieldguard alias');
        this.hidden.set(d.alias, { d, activated: false }); continue;
      }
      if (!this.spawn(d)) throw Error(`Occupied Shieldguard tile: ${d.row},${d.col}`);
    }
    // The core skips devices in its ally loop; a Shieldguard runs the ordinary one after it.
    b.on('tick', ({ dt }) => {
      for (const u of this.units) if (u.alive && u.deployed) updateAlly(b, u, dt);
    });
  }
  spawn(d) {
    const b = this.battle, spec = shieldguardDefinition(d.instance);
    const stats = stageDeviceAttributes(b.stageCardRules, d.key, { hp: spec.hp, atk: spec.atk, def: spec.def, res: spec.res, block: spec.block });
    const unit = b.spawnDevice(d.key, d.row, d.col, { name: d.name, hp: stats.hp, atk: stats.atk, def: stats.def, res: stats.res,
      blockCnt: stats.block, bat: spec.bat, aspd: spec.aspd, dir: spec.direction, obstacle: false });
    if (!unit) return null;
    unit.def.profession = 'TRAP'; unit.deploymentSlotCost = 0;
    unit.mem.stageShieldguard = spec;
    unit.profile = { ...resolveProfile({ type: 'device', profession: 'WARRIOR', subProf: null, stats: { atk: stats.atk } }),
      canHitFly: false, groundOnly: true, maxTargets: 1, characterLikeDevice: true, noHeal: true };
    unit.base.tauntLevel = spec.taunt;
    unit.markDirty();
    b.refreshRange(unit);
    this.units.push(unit);
    return unit;
  }
  /** ACTIVATE_PREDEFINED on a hidden Shieldguard alias; false when the alias is not a Shieldguard. */
  activate(alias) {
    const entry = this.hidden.get(alias);
    if (!entry) return false;
    // As for Turrets, an activation onto an occupied tile finishes without a body.
    if (!entry.activated) { entry.activated = true; this.spawn(entry.d); }
    return true;
  }
}
