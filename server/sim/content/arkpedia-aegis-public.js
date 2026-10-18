// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-aegis-runtime-review.json' with {type: 'json'};
import {AEGIS_ID as ID} from './arkpedia-aegis-source.js';
import {prepareAegisS1, AEGIS_S1_CONTRACT} from './arkpedia-aegis-s1.js';
import {prepareAegisS2, AEGIS_S2_CONTRACT} from './arkpedia-aegis-s2.js';
function reviewed(b) {
  const approved = JSON.stringify(review.enabledOperators) === JSON.stringify([ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-aegis-independent-flight-six-marker-missiles-and-kick-v1')
    throw Error('Missing Aegis runtime review or explicit held browser candidate');
}
export function customizePublicAegisKit({battle, id, unit, kit}) {
  if (id !== ID) return;
  reviewed(battle);
  if(!['skchr_aigis_1','skchr_aigis_2'].includes(unit.def.skill?.id))throw Error('Missing original selected Aegis skill');
  const prepared = unit.def.skill.id === 'skchr_aigis_1'
    ? prepareAegisS1(battle, unit, {contract: AEGIS_S1_CONTRACT})
    : prepareAegisS2(battle, unit, {contract: AEGIS_S2_CONTRACT});
  Object.assign(kit, prepared.kit);
}
export function installPublicAegis({battle, unit, def}) {
  if (def.charId !== ID) return;
  reviewed(battle);
  if (!unit.mem.aegis) throw Error('Missing selected Aegis controller');
  unit.mem.aegis.install();
}
