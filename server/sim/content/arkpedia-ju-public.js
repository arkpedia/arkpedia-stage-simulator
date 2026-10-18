// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-ju-runtime-review.json' with {type: 'json'};
import {JU_ID as ID} from './arkpedia-ju-source.js';
import {prepareJuS1, JU_S1_CONTRACT} from './arkpedia-ju-s1.js';
import {prepareJuS2, JU_S2_CONTRACT} from './arkpedia-ju-s2.js';
function reviewed(b) {
  const approved = JSON.stringify(review.enabledOperators) === JSON.stringify([ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-ju-wounds-conditional-charges-and-serialized-extra-v1')
    throw Error('Missing Ju runtime review or explicit held browser candidate');
}
export function customizePublicJuKit({battle, id, unit, kit}) {
  if (id !== ID) return;
  reviewed(battle);
  const prepared = unit.def.skill.id === 'skchr_ju_1'
    ? prepareJuS1(battle, unit, {contract: JU_S1_CONTRACT})
    : prepareJuS2(battle, unit, {contract: JU_S2_CONTRACT});
  Object.assign(kit, prepared.kit);
}
export function installPublicJu({battle, unit, def}) {
  if (def.charId !== ID) return;
  reviewed(battle);
  if (!unit.mem.ju) throw Error('Missing selected Ju controller');
  unit.mem.ju.install();
}
