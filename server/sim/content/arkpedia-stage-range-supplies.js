// SPDX-License-Identifier: GPL-3.0-or-later
import { configureStageSupply } from './arkpedia-stage-supply-account.js';
import { absoluteRangeKeys, auraSelectable } from '../targeting.js';
import { bodyInKeys } from '../body.js';
import { OwnedStageAura } from './arkpedia-stage-auras.js';
const live = u => u.alive && u.deployed && !u.hidden;
/** Supplies share range ownership and removal; each recipient owns its SP clock. */
export function installRangeSupply(b, unit, spec, dir) {
  configureStageSupply(unit, spec); unit.dir = dir;
  unit.rangeKeys = absoluteRangeKeys(spec.range, unit.tileR, unit.tileC, dir);
  if (spec.kind === 'jammer') {
    unit.profile.enemyTargetableDevice = true;
    unit.base.tauntLevel = spec.taunt;
    b.addBuff(unit, { key: 'stage:jammerBody', persist: true, flags: { noBlock: true, healFree: true, isolated: true },
      mods: { hpRegenMul: 0 } });
  }
  const tracked = new Map();
  const aura = spec.kind === 'jammer' ? new OwnedStageAura(b, unit, { key: 'stage:jammer', strength: 1 - spec.moveMul,
    flags: { disarm: true, silence: true }, mods: { moveMul: spec.moveMul } }) : null;
  const clear = u => tracked.delete(u);
  let offDeath;
  const off = b.on('tick', ({ dt }) => {
    if (!live(unit)) { aura?.clear(); tracked.clear(); b.off(off); b.off(offDeath); return; }
    const candidates = spec.kind === 'jammer' ? b.enemies : b.allyUnits;
    const targets = new Set(candidates.filter(u => u !== unit && live(u) && bodyInKeys(u, unit.rangeKeys)
      && (spec.kind === 'jammer' ? u.tags.has('drone') && auraSelectable(unit, u)
        : u.skill && !u.s.flags.sleep && !u.s.flags.untargetable && (u.kind !== 'device' || u.mem.regularSummonCard))));
    if (aura) { aura.update(targets); return; }
    for (const u of tracked.keys()) if (!targets.has(u)) clear(u);
    for (const u of targets) {
      {
        let elapsed = (tracked.get(u) ?? 0) + dt;
        while (elapsed + 1e-9 >= spec.interval) { elapsed -= spec.interval; u.skill.gainSp(spec.sp, 'external'); }
        tracked.set(u, elapsed);
      }
    }
  });
  offDeath = b.on('death', ({ unit: dead }) => {
    if (dead !== unit) return;
    aura?.clear();
    for (const u of tracked.keys()) clear(u);
    b.off(off); b.off(offDeath);
  });
}
