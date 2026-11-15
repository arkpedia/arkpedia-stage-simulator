// SPDX-License-Identifier: GPL-3.0-or-later
import { configureStageSupply } from './arkpedia-stage-supply-account.js';
import { absoluteRangeKeys } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { performAttack } from '../ai.js';

/** An allied tree selector drives the common attack receipt/damage pipeline. */
export function installStageWorker(b, unit, spec, dir) {
  configureStageSupply(unit, spec); unit.dir = dir;
  unit.base.atk = spec.atk; unit.base.blockCnt = 0; unit.base.tauntLevel = 0; unit.markDirty();
  unit.rangeKeys = absoluteRangeKeys(spec.range, unit.tileR, unit.tileC, dir);
  unit.mem.stageSupplyReleaseAt = b.time + spec.duration;
  const profile = { attack: 'melee', dmgType: 'phys', windup: spec.windup, tags: ['stage:worker'] };
  const expiry = b.after(spec.duration, () => b._remove(unit, 'withdraw', null, true), { owner: unit });
  let offDeath;
  const off = b.on('tick', ({ dt }) => {
    if (!unit.alive || !unit.deployed || !unit.canAct || unit.s.flags.disarm) return;
    unit.atkCd = Math.max(0, unit.atkCd - dt);
    if (unit.atkCd > 1e-9) return;
    const target = b.allyUnits.find(t => t.alive && t.deployed && !t.hidden && t.tags.has('tree')
      && !t.s.flags.untargetable && bodyInKeys(t, unit.rangeKeys));
    if (!target) return;
    performAttack(b, unit, profile, [target]);
    unit.atkCd = Math.max(unit.atkCd, spec.interval);
  });
  offDeath = b.on('death', ({ unit: dead }) => {
    if (dead !== unit) return;
    expiry.cancel(); b.off(off); b.off(offDeath);
  });
}
