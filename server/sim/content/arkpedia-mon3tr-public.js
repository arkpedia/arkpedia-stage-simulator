// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-mon3tr-runtime-review.json' with { type: 'json' };
import { MON3TR_ID as ID } from './arkpedia-mon3tr-source.js';
import { prepareMon3trReconstruction, MON3TR_RECONSTRUCTION_CONTRACT } from './arkpedia-mon3tr-reconstruction.js';
function reviewed() {
  if (JSON.stringify(review.enabledOperators) !== JSON.stringify([ID]) || review.frameParity !== false
    || review.moduleSupport !== false || review.nativeParticleSupport !== false
    || review.nativePixelParity !== false || review.mechanicsPolicy !== 'source-selected-chain-respawn-v1')
    throw Error('Mon3tr lacks its selected public runtime review');
}
export function customizePublicMon3trKit({ battle, id, unit, kit }) {
  if (id !== ID) return;
  reviewed();
  const p = prepareMon3trReconstruction(battle, unit, { contract: MON3TR_RECONSTRUCTION_CONTRACT });
  Object.assign(kit, p.kit);
}
export function installPublicMon3tr({ unit, def }) {
  if (def.charId !== ID) return;
  reviewed();
  if (!unit.mem.mon3trHealing?.deck) throw Error('Missing Mon3tr selected owner and Reconstruction deck');
  unit.mem.mon3trHealing.install();
}
