// SPDX-License-Identifier: GPL-3.0-or-later
// Selected source contracts are enforced during preparation; publication additionally
// requires the builder's source/artwork and completed browser review gates.
import review from '../../../data/arkpedia-closur-runtime-review.json' with { type: 'json' };
import { CLOSUR_ID as ID } from './arkpedia-closur-source.js';
import { prepareClosurCombat, CLOSUR_COMBAT_CONTRACT } from './arkpedia-closur-combat.js';
import { installClosurDeck } from './arkpedia-closur-deck.js';
function reviewed() {
  if (JSON.stringify(review.enabledOperators) !== JSON.stringify([ID]) || review.frameParity !== false
    || review.moduleSupport !== false || review.nativeParticleSupport !== false || review.nativePixelParity !== false
    || review.mechanicsPolicy !== 'source-cn-command-center-continuous-fire-and-debt-v1'
    || review.verification.browser.status !== 'passed') throw Error('Missing Closure selected runtime review');
}
export function customizePublicClosurKit({ battle, id, unit, kit }) {
  if (id !== ID) return;
  reviewed();
  const prepared = prepareClosurCombat(battle, unit, { contract: CLOSUR_COMBAT_CONTRACT });
  unit.mem.closur = prepared;
  Object.assign(kit, prepared.kit);
}
export function installPublicClosur({ unit, def }) {
  if (def.charId !== ID) return;
  reviewed();
  const prepared = unit.mem.closur;
  if (!prepared) throw Error('Missing Closure selected source controller');
  prepared.controller.install(); installClosurDeck(prepared.point);
}
