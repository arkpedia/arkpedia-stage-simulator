// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-hadiya-runtime-review.json' with {type: 'json'};
import {HADIYA_ID as ID} from './arkpedia-hadiya-source.js';
import {prepareHadiya, HADIYA_OWNER_CONTRACT} from './arkpedia-hadiya-owner.js';
function reviewed(b) {
  const approved = JSON.stringify(review.enabledOperators) === JSON.stringify([ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-hadiya-dp-casts-adaptation-and-stacked-talent-v1')
    throw Error('Missing Hadiya runtime review or explicit held browser candidate');
}
export function customizePublicHadiyaKit({battle, id, unit, kit}) {
  if (id !== ID) return;
  reviewed(battle);
  if (!['skchr_hadiya_1', 'skchr_hadiya_2'].includes(unit.def.skill?.id)) throw Error('Missing original selected Hadiya skill');
  const prepared = prepareHadiya(battle, unit, {contract: HADIYA_OWNER_CONTRACT});
  Object.assign(kit, prepared.kit); unit.mem.hadiyaPrepared = prepared.controller;
}
export function installPublicHadiya({battle, unit, def}) {
  if (def.charId !== ID) return;
  reviewed(battle);
  const controller = unit.mem.hadiyaPrepared;
  if (!controller) throw Error('Missing selected Hadiya owner');
  delete unit.mem.hadiyaPrepared; controller.install();
}
