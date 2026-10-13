// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-muelsyse-runtime-review.json' with { type: 'json' };
import { MUELSYSE_ID as ID } from './arkpedia-muelsyse.js';
import { MUELSYSE_FORM_SKILL_CONTRACT, prepareMuelsyseFormSkills } from './arkpedia-muelsyse-form-skills.js';
import { MUELSYSE_SQUAD_CONTRACT, installMuelsyseSquad } from './arkpedia-muelsyse-squad.js';
function reviewed() {
  if (review.enabledOperators.length !== 1 || review.enabledOperators[0] !== ID
    || review.frameParity !== false || review.moduleSupport !== false || review.nativeParticleSupport !== false
    || review.s1PulsePolicy !== 'source-interval-duration-clipping-v1'
    || review.cloneProtectionPolicy !== 'warming-only-v1')
    throw Error('Muelsyse source lacks a public runtime review');
}
export function installPublicMuelsyseSquad(b) {
  if (!b.bench[ID]) return;
  reviewed(); installMuelsyseSquad(b, { contract: MUELSYSE_SQUAD_CONTRACT });
}
export function customizePublicMuelsyseKit({ battle, id, unit, kit }) {
  if (id !== ID) return;
  reviewed(); Object.assign(kit, prepareMuelsyseFormSkills(battle, unit,
    { contract: MUELSYSE_FORM_SKILL_CONTRACT }).kit);
}
export function installPublicMuelsyse({ unit, def }) {
  if (def.charId !== ID) return;
  const controller = unit.mem.muelsyseController;
  if (!controller) throw Error('Missing selected Muelsyse controller');
  controller.install();
}
