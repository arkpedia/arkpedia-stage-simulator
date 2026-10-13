// SPDX-License-Identifier: GPL-3.0-or-later
import review from '../../../data/arkpedia-rmixer-runtime-review.json' with { type: 'json' };
import { RMIXER_ID } from './arkpedia-rmixer-source.js';
import { RMIXER_RUNTIME_CONTRACT, prepareRmixerSkills } from './arkpedia-rmixer-skills.js';
export function customizeRmixerKit({ battle, id, unit, kit }) {
  if (id !== RMIXER_ID) return;
  if (review.enabledOperators.length !== 1 || review.enabledOperators[0] !== id
    || review.recipientPolicy !== RMIXER_RUNTIME_CONTRACT.recipientPolicy || review.frameParity !== false)
    throw Error('Sankta source lacks a public runtime review');
  Object.assign(kit, prepareRmixerSkills(battle, unit, { contract: RMIXER_RUNTIME_CONTRACT }).kit);
}
export function installRmixer({ battle, unit, def }) {
  if (def.charId !== RMIXER_ID) return;
  const controller = unit.mem.rmixerAttacks;
  if (!controller || controller.contract !== RMIXER_RUNTIME_CONTRACT) throw Error('Missing selected Sankta controller');
  controller.install();
}
