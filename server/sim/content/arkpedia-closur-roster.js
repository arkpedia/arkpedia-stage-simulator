// SPDX-License-Identifier: GPL-3.0-or-later
// Held selected-source roster contract; this cannot register a playable operator.
import e from '../../../data/arkpedia-native-operators/char_4228_closur.json' with { type: 'json' };
import { CLOSUR_ID as ID, selectedClosurBuild } from './arkpedia-closur-source.js';
export const CLOSUR_ROSTER_CONTRACT = Object.freeze({
  scope: 'Unmoduled selected Closure roster talent: strongest DP floor and Rhodes Island operator ATK',
  limits: 'Deck category/tag aliases and negative-DP recovery are explicit regular-stage mappings, not compiled Unity dispatch proof. No playable kit is installed.',
  frameParity: false,
});
export function installClosurRoster(b, builds, { contract } = {}) {
  if (contract !== CLOSUR_ROSTER_CONTRACT) throw Error('Closure requires its selected roster contract');
  if (!Array.isArray(builds) || !builds.length || builds.some(r => r.id !== ID) || b.regularClosurRoster)
    throw Error('Invalid or repeated Closure roster source');
  const selected = builds.map(selectedClosurBuild);
  const native = e.characters[ID].flatMap(r => r.components).find(p => p.pathId === '-794512117237428718').data;
  if (native._options.selector.filterTag !== 'rhodes' || native._options.selector.categoryMask !== 639
    || native._options.selector.excludeMe !== 0 || native._minCostExtremeSetting.key !== 'closur_t_2'
    || native._minCostExtremeSetting.takeMax !== 1) throw Error('Unreviewed Closure deck talent selector');
  const talents = selected.map(r => r.talentBb[1]).filter(Boolean);
  const floor = Math.min(0, ...talents.map(t => t.cost)), atk = Math.max(0, ...talents.map(t => t.atk));
  const playerId = 'arkpedia', key = 'closur:roster:rhodes-atk';
  if (!b.getPlayer(playerId) || ![0, -3, -4].includes(floor) || ![0, .04].includes(atk))
    throw Error('Unreviewed Closure roster talent values');
  b.regularDpFloors ??= new Map();
  if (b.regularDpFloors.has(playerId)) throw Error('Existing unreviewed regular DP floor');
  b.regularDpFloors.set(playerId, floor);
  const recipients = new Set();
  const apply = u => {
    if (atk === 0 || u.ownerId !== playerId || u.side !== 'ally' || u.kind !== 'op' || !u.def.tags.includes('rhodes')) return;
    b.addBuff(u, { key, mods: { atkPct: atk }, persist: true, allowDead: true }); recipients.add(u);
  };
  for (const u of b.allyUnits) apply(u);
  const deploy = b.on('deploy', ({ unit }) => apply(unit));
  const end = b.on('battleEnd', () => { b.off(deploy); b.off(end); });
  const result = { floor, atk, selected, recipients };
  b.regularClosurRoster = result; return result;
}
