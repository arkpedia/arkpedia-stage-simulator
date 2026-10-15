// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-varkis-runtime-review.json' with { type: 'json' };
import { VARKIS_ID as ID } from './arkpedia-varkis-source.js';
import { prepareVarkis, VARKIS_CONTRACT } from './arkpedia-varkis.js';
function reviewed(battle) {
  const approved = JSON.stringify(review.enabledOperators) === JSON.stringify([ID]) && review.verification.browser.status === 'passed';
  const candidate = battle.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-three-event-burst-minos-hp-predicate-overheal-barrier-v1')
    throw Error('Missing Varkáris selected runtime review or explicit held browser candidate');
}
export function customizePublicVarkisKit({ battle, id, unit, kit }) {
  if (id !== ID) return;
  reviewed(battle); Object.assign(kit, prepareVarkis(battle, unit, { contract: VARKIS_CONTRACT }).kit);
}
export function installPublicVarkis({ battle, unit, def }) {
  if (def.charId !== ID) return;
  reviewed(battle); if (!unit.mem.varkis) throw Error('Missing Varkáris selected source controller');
  unit.mem.varkis.install();
}
