// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-liesel-runtime-review.json' with { type: 'json' };
import { LIESEL_ID as ID } from './arkpedia-liesel-source.js';
import { prepareLiesel, LIESEL_CONTRACT } from './arkpedia-liesel.js';
function reviewed() {
  if (JSON.stringify(review.enabledOperators) !== JSON.stringify([ID]) || review.frameParity !== false
    || review.moduleSupport !== false || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-charged-splash-and-delayed-homing-v1'
    || review.verification.browser.status !== 'passed')
    throw Error('Missing Ripresa selected runtime review');
}
export function customizePublicLieselKit({ battle, id, unit, kit }) {
  if (id !== ID) return;
  reviewed(); Object.assign(kit, prepareLiesel(battle, unit, { contract: LIESEL_CONTRACT }).kit);
}
export function installPublicLiesel({ unit, def }) {
  if (def.charId !== ID) return;
  reviewed(); if (!unit.mem.liesel) throw Error('Missing Ripresa source controller');
  unit.mem.liesel.install();
}
