// SPDX-License-Identifier: GPL-3.0-or-later
import { PROFESSION_BITS } from '../../../shared/arkpedia/stage-card-rules.js';
import { recordStageOutcome } from './arkpedia-stage-outcomes.js';
/** The source selector uses CREATED_TIME_DES (34), not taunt or random order.
 * Standard-stage placements create new units; stable unit IDs break same-tick
 * ties. Movement/redeployment of the same instance does not create a new one. */
export function portalCardRemoval() {
  return { death(c, battle, enemy, state) {
    if (c.reason !== 'killed' || state.released) return;
    state.released = true;
    const target = battle.allyUnits.filter(unit => unit.kind === 'op' && unit.alive && unit.deployed && !unit.isFlying
      && (639 & (PROFESSION_BITS[unit.def.profession ?? unit.def.raw?.profession] ?? 0)) !== 0
      && !unit.findBuff('enemy_entlec_self_mark'))
      .sort((a, b) => b.id - a.id)[0];
    if (!target) return;
    const entry = battle.bench?.[target.defId];
    if (entry) { entry.removedFromDeck = true; entry.readyAt = Infinity; }
    target.mem.regularCardRemoved = true;
    const event = recordStageOutcome(battle, enemy, 'rogue_first_step');
    event.operator = target.defId; event.operatorInstance = target.id; event.operatorName = target.name;
    // Native skipReborn=false: a surviving rebirth does not restore the card.
    battle.kill(target, enemy);
  } };
}
