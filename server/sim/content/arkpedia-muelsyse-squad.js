// SPDX-License-Identifier: GPL-3.0-or-later
// Opt-in squad diagnostic; this does not register Muelsyse in the public roster.
import evidence from '../../../data/arkpedia-muelsyse-prefabs.json' with { type: 'json' };
import { flattenBlackboard as flat, normalizeChess } from '../simdata.js';
import { MUELSYSE_ID as ID, selectedMuelsyseBuild, muelsyseSourceComponent as component } from './arkpedia-muelsyse.js';

export const MUELSYSE_SQUAD_CONTRACT = Object.freeze({
  scope: 'Selected E2 Rhine Lab squad cost and first successful operator deployment diagnostic',
  mapping: 'Source-tagged Rhine squad cards receive the selected permanent cost addition while Muelsyse remains on the bench or has retired. The selected runtime addition applies once to the first successful Rhine operator birth, including Muelsyse. Failed placement and summoned tokens do not consume it.',
  limits: 'Both additions use the existing regular-stage card-cost bucket after the ordinary redeploy multiplier, with a zero floor. Native C# cost rounding/bucket order and card/deck event dispatch are unrecovered; this is an explicit local mapping, not compiled parity. This independent diagnostic does not approve owner skills, clone protection, artwork, copy UI, modules or public selection.',
  frameParity: false,
});

function verify() {
  const deck = component('7978323624740392138'), cards = component('-2980648226026091318');
  const runtime = component('8460009272480042186');
  const finish = evidence.templates.mlyss_t_2.eventToActions.ON_BUFF_START;
  if (deck._options.selector.filterTag !== 'rhine' || deck._options.selector.excludeMe !== 0
    || deck._options.minCntToTrig !== 1 || deck._deckBuffs.length !== 1
    || deck._deckBuffs[0].buff.templateKey !== 'mlyss_t_2'
    || cards._selector.filterTag !== 'rhine' || cards._selector.enableOverride !== 1
    || runtime._options.selector.filterTag !== 'rhine'
    || runtime._options.trackSourceCardInCardBuff !== 1 || runtime._options.minCntToTrig !== 0
    || finish.length !== 2 || !finish[0].$type.includes('+FinishCardBuffsByKey,')
    || finish[0]._cardBuffKey !== ID || !finish[0]._findAllCard || finish[0]._ignoreOwner
    || finish[1]._deckBuffKey !== 'mlyss_t_2' || !finish[1]._removeFromAllCard)
    throw Error('Unreviewed Muelsyse squad source');
}

export function installMuelsyseSquad(b, { contract } = {}) {
  if (contract !== MUELSYSE_SQUAD_CONTRACT) throw Error('Muelsyse requires the reviewed squad contract');
  if (b._muelsyseSquad) throw Error('Muelsyse squad diagnostic is already installed');
  const entry = b.bench[ID];
  if (!entry || b.finished || b.time > 0 || Object.values(b.bench).some(e => e.deployments > 0)
    || b.allyUnits.some(u => u.kind === 'op' && u.deploySeq > 0))
    throw Error('Muelsyse squad requires a fresh selected roster');
  const selected = selectedMuelsyseBuild(entry.build), def = b.data.getChess(ID);
  if (!def || def.charId !== ID || JSON.stringify(def.stats) !== JSON.stringify(normalizeChess({ stats: selected.stats }).stats)
    || JSON.stringify(def.talents.map(t => t.bb)) !== JSON.stringify(selected.talents.map(t => flat(t.blackboard)))
    || JSON.stringify(def.tags) !== JSON.stringify(selected.tags))
    throw Error('Incomplete Muelsyse selected squad source');
  verify();
  const talent = selected.talents.find(t => t.prefabKey === '2');
  const bb = flat(talent?.blackboard);
  if (talent && (bb.cost !== -2 || bb.runtime_cost !== (entry.build.potential >= 5 ? -2 : -1)))
    throw Error('Unreviewed Muelsyse squad values');
  const eligible = new Set(Object.keys(b.bench).filter(id => {
    const d = b.data.getChess(id);
    return d && !d.raw.arkpedia?.isToken && d.tags.includes('rhine');
  }));
  const state = { eligible, cost: bb.cost ?? 0, firstCost: bb.runtime_cost ?? 0, firstUsed: false };
  b._muelsyseSquad = state;
  // Consume at the successful engine birth, before ordinary deployment callbacks
  // can deploy another Rhine card. Failed _deploy calls never emit this event.
  b.on('deploy', ({ unit }) => {
    if (unit.ownerId === 'arkpedia' && unit.side === 'ally' && unit.kind === 'op'
      && state.eligible.has(unit.defId)) state.firstUsed = true;
  }, { priority: Number.MAX_SAFE_INTEGER });
  return state;
}

export function adjustMuelsyseSquadCost(b, id, ordinaryCost) {
  const s = b._muelsyseSquad;
  if (!s || !s.eligible.has(id) || !Number.isFinite(ordinaryCost)) return ordinaryCost;
  return Math.max(0, ordinaryCost + s.cost + (s.firstUsed ? 0 : s.firstCost));
}
