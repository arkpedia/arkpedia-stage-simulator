// SPDX-License-Identifier: GPL-3.0-or-later
import { SkillRuntime } from '../skills.js';
import { bodyInRadius } from '../body.js';
import { absoluteRangeKeys } from '../targeting.js';
import { configureStageSupply } from './arkpedia-stage-supply-account.js';
import { stageDeviceSpec } from '../../../shared/arkpedia/device-runtime.js';
import { predefinedMineDefinition } from '../../../shared/arkpedia/device-runtime.js';
import { stageDeviceAttributes } from '../../../shared/arkpedia/stage-character-attributes.js';

export function installPredefinedMines(b, devices) {
  for (const d of devices) {
    if (!stageDeviceSpec(d)?.mine) continue;
    const spec = stageDeviceAttributes(b.stageCardRules, d.key, predefinedMineDefinition(d.instance), 'MELEE');
    const unit = b.spawnDevice(d.key, d.row, d.col, { hp: spec.hp, def: spec.def ?? 0,
      res: spec.res ?? 0, blockCnt: 0, obstacle: false, name: spec.name });
    if (!unit) throw Error('Occupied Interference Mine tile');
    installStageMine(b, unit, spec);
  }
}

export function installStageMine(b, unit, spec) {
  configureStageSupply(unit, spec);
  unit.base.spRecovery = spec.spRecovery; unit.base.blockCnt = 0; unit.base.tauntLevel = 0; unit.markDirty();
  unit.rangeKeys = absoluteRangeKeys(spec.range, unit.tileR, unit.tileC, 'RIGHT');
  // The native selector ignores target-free states, including stealth. Damage
  // immunity is still resolved by the common damage pipeline.
  const targets = () => b.enemies.filter(e => e.alive && e.deployed && !e.hidden && !e.isFlying
    && bodyInRadius(e, unit.x, unit.y, spec.radius));
  unit.skill = new SkillRuntime(b, unit, { id: 'sktok_mine', name: 'Contact Explosion', skillType: 'AUTO',
    spType: 'time', spCost: spec.spCost, initSp: spec.initSp }, {
    kind: 'instant', trigger: 'SP_FULL', silenceable: false,
    canActivate: () => targets().length > 0,
    onStart: () => {
      for (const e of targets()) {
        // Source order matters: the first blast receives its own multiplier.
        // A shared key replaces the previous mine's effect rather than stacking.
        b.addBuff(e, { key: 'stage:mineDamageTaken', source: unit, visible: true, duration: spec.duration,
          refresh: 'replace', mods: { dmgTakenMul: spec.damageScale } });
        b.dealDamage(unit, e, { amount: spec.damage, type: 'true', isAttack: false, applyWay: 'none',
          canDodge: false, ignoreSelect: true, tags: ['stage:mine'] });
      }
      b._remove(unit, 'withdraw', null, true);
    },
  });
  unit.skill.reset();
}
