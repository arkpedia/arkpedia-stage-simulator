// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-skybox-runtime-review.json' with {type: 'json'};
import {SKYBOX_ID as ID} from './arkpedia-skybox-source.js';
import {prepareSkyboxS1, SKYBOX_S1_CONTRACT} from './arkpedia-skybox-s1.js';
import {prepareSkyboxS2, SKYBOX_S2_CONTRACT} from './arkpedia-skybox-s2.js';
function reviewed(b) {
  const approved = JSON.stringify(review.enabledOperators) === JSON.stringify([ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-skybox-flight-independent-silence-and-remaining-ammo-burst-v1')
    throw Error('Missing Skybox runtime review or explicit held browser candidate');
}
export function customizePublicSkyboxKit({battle, id, unit, kit}) {
  if (id !== ID) return;
  reviewed(battle);
  if(!['skchr_skybx_1','skchr_skybx_2'].includes(unit.def.skill?.id))throw Error('Missing original selected Skybox skill');
  const prepared = unit.def.skill.id === 'skchr_skybx_1'
    ? prepareSkyboxS1(battle, unit, {contract: SKYBOX_S1_CONTRACT})
    : prepareSkyboxS2(battle, unit, {contract: SKYBOX_S2_CONTRACT});
  Object.assign(kit, prepared.kit);
}
export function installPublicSkybox({battle, unit, def}) {
  if (def.charId !== ID) return;
  reviewed(battle);
  if (!unit.mem.skybox) throw Error('Missing selected Skybox controller');
  unit.mem.skybox.install();
}
