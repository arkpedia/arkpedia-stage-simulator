// SPDX-License-Identifier: GPL-3.0-or-later
import { carapaceDefinition, stageDeviceSpec } from '../../../shared/arkpedia/device-runtime.js';
import { stageDeviceAttributes } from '../../../shared/arkpedia/stage-character-attributes.js';
import { attachRangedPlatform } from './arkpedia-platforms.js';
import { grantCardRedeployRatio } from './arkpedia-card-redeploy.js';
import { recordStageOutcome } from './arkpedia-stage-outcomes.js';
export function canSpawnCarapace(b, row, col) {
  const tile = b.grid.tile(row, col);
  return b.grid.groundPassable(row, col) && b.grid.isLow(row, col)
    && !['tile_start', 'tile_end', 'tile_telin', 'tile_telout'].includes(tile.key)
    && !b.unitAt(row, col) && !b.tileReservation(row, col) && !b.downOn(row, col);
}
export function spawnCarapace(b, row, col, definition = carapaceDefinition({ level: 1, skillLevel: 1 })) {
  const p = stageDeviceAttributes(b.stageCardRules, definition.unitId, definition);
  const unit = b.spawnDevice(p.unitId, row, col, { name: p.name, hp: p.hp, def: p.def, res: p.res,
    blockCnt: p.block, blockRadiusSquare: p.blockRadiusSquare, obstacle: true });
  if (!unit) return null;
  unit.def = { ...unit.def, profession: 'TRAP', immune: new Set(p.immune) }; unit.base.tauntLevel = p.taunt;
  unit.tags.add('SANDBOX_FACTORY'); unit.profile.characterLikeDevice = true;
  unit.profile.enemyTargetableDevice = true; unit.deploymentSlotCost = 0;
  b.addBuff(unit, { key: 'trap_156_dsshell[core]', persist: true,
    flags: { targetFree: true, isolated: true, noHeal: true } });
  let lastGuest = null, next = b.time + p.scanInterval;
  attachRangedPlatform(b, unit, { onLost: guest => {
    b.removeBuff(guest, `carapace:highland:${unit.id}`);
    b.kill(guest);
  } });
  b.on('deploy', ({ unit: guest }) => {
    if (guest.mem.regularHostedBy !== unit) return;
    lastGuest = guest;
    b.addBuff(guest, { key: `carapace:highland:${unit.id}`, flags: { noBlock: true } });
    recordStageOutcome(b, unit, 'dsshell_overlapped');
  }, { owner: unit });
  b.on('kill', ({ victim }) => {
    if (victim !== unit || !lastGuest) return;
    const cardUnit = b.bench?.[lastGuest.defId]?.unit ?? lastGuest;
    grantCardRedeployRatio(b, cardUnit, `carapace:${unit.id}`, p.redeployRatio);
  }, { owner: unit, priority: 2000 });
  b.on('tick', () => {
    if (!unit.alive || b.time + 1e-9 < next) return;
    next += p.scanInterval;
    // The Nethersea controller owns tile modes; platforms do not duplicate
    // its propagation or elemental damage state.
    b.stageNethersea?.clearTile(row, col);
  }, { owner: unit });
  return unit;
}
export class StageCarapaces {
  constructor(b, devices) {
    this.units = [];
    for (const d of devices) if (stageDeviceSpec(d)?.carapace) {
      const unit = spawnCarapace(b, d.row, d.col, carapaceDefinition(d.instance));
      if (!unit) throw Error('Occupied Excrescent Carapace tile');
      this.units.push(unit);
    }
  }
}
