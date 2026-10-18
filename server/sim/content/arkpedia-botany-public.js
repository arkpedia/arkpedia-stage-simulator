// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-botany-runtime-review.json' with {type: 'json'};
import {BOTANY_ID as ID} from './arkpedia-botany-source.js';
import {prepareBotanyS1, BOTANY_S1_CONTRACT} from './arkpedia-botany-s1.js';
import {prepareBotanyS2, BOTANY_S2_CONTRACT} from './arkpedia-botany-s2.js';
function reviewed(b) {
  const approved = JSON.stringify(review.enabledOperators) === JSON.stringify([ID]) && review.verification.browser.status === 'passed';
  const candidate = b.regularReviewCandidates?.includes(ID) && review.enabledOperators.length === 0 && review.verification.browser.status === 'pending';
  if ((!approved && !candidate) || review.frameParity !== false || review.moduleSupport !== false
    || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-botany-erosion-burst-talent-and-two-retained-inputs-v1')
    throw Error('Missing Botany runtime review or explicit held browser candidate');
}
export function customizePublicBotanyKit({battle, id, unit, kit}) {
  if (id !== ID) return;
  reviewed(battle);
  if(!['skchr_botany_1','skchr_botany_2'].includes(unit.def.skill?.id))throw Error('Missing original selected Botany skill');
  const prepared = unit.def.skill.id === 'skchr_botany_1'
    ? prepareBotanyS1(battle, unit, {contract: BOTANY_S1_CONTRACT})
    : prepareBotanyS2(battle, unit, {contract: BOTANY_S2_CONTRACT});
  Object.assign(kit, prepared.kit);
}
export function installPublicBotany({battle, unit, def}) {
  if (def.charId !== ID) return;
  reviewed(battle);
  if (!unit.mem.botany) throw Error('Missing selected Botany controller');
  unit.mem.botany.install();
}
