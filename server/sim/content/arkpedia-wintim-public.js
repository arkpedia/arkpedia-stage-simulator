// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-wintim-runtime-review.json' with { type: 'json' };
import { WINTIM_ID as ID } from './arkpedia-wintim-source.js';
import { prepareWintim, WINTIM_CONTRACT } from './arkpedia-wintim.js';
function reviewed() {
  if (JSON.stringify(review.enabledOperators) !== JSON.stringify([ID]) || review.frameParity !== false
    || review.moduleSupport !== false || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-cast-dp-and-output-damage-v1'
    || review.verification.browser.status !== 'passed') throw Error('Missing Snegurochka selected runtime review');
}
export function customizePublicWintimKit({ battle, id, unit, kit }) {
  if (id !== ID) return;
  reviewed(); Object.assign(kit, prepareWintim(battle, unit, { contract: WINTIM_CONTRACT }).kit);
}
export function installPublicWintim({ unit, def }) {
  if (def.charId !== ID) return;
  reviewed(); if (!unit.mem.wintim) throw Error('Missing Snegurochka source controller');
  unit.mem.wintim.install();
}
