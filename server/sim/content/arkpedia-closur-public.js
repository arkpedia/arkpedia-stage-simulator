// SPDX-License-Identifier: GPL-3.0-or-later
// Selected source contracts are enforced during preparation; publication additionally
// requires the builder's source/artwork and completed browser review gates.
import { CLOSUR_ID as ID } from './arkpedia-closur-source.js';
import { prepareClosurCombat, CLOSUR_COMBAT_CONTRACT } from './arkpedia-closur-combat.js';
import { installClosurDeck } from './arkpedia-closur-deck.js';
export function customizePublicClosurKit({ battle, id, unit, kit }) {
  if (id !== ID) return;
  const prepared = prepareClosurCombat(battle, unit, { contract: CLOSUR_COMBAT_CONTRACT });
  unit.mem.closur = prepared;
  Object.assign(kit, prepared.kit);
}
export function installPublicClosur({ unit, def }) {
  if (def.charId !== ID) return;
  const prepared = unit.mem.closur;
  if (!prepared) throw Error('Missing Closure selected source controller');
  prepared.controller.install(); installClosurDeck(prepared.point);
}
