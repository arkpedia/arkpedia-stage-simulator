// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-reckpr-runtime-review.json' with { type: 'json' };
import { RECKPR_ID as ID } from './arkpedia-reckpr-source.js';
import { prepareReckpr, RECKPR_CONTRACT } from './arkpedia-reckpr.js';
function reviewed(battle) {
  const approved = JSON.stringify(review.enabledOperators) === JSON.stringify([ID]) && review.verification.browser.status === 'passed';
  const candidate = battle.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-charged-healing-and-recipient-reactive-listeners-v1')
    throw Error('Missing Record Keeper selected runtime review or explicit held browser candidate');
}
export function customizePublicReckprKit({ battle, id, unit, kit }) {
  if (id !== ID) return;
  reviewed(battle); Object.assign(kit, prepareReckpr(battle, unit, { contract: RECKPR_CONTRACT }).kit);
}
export function installPublicReckpr({ battle, unit, def }) {
  if (def.charId !== ID) return;
  reviewed(battle); if (!unit.mem.reckpr) throw Error('Missing Record Keeper selected source controller');
  unit.mem.reckpr.install();
}
