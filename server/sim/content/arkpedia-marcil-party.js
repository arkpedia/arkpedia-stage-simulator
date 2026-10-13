// SPDX-License-Identifier: GPL-3.0-or-later
// Source deck-talent diagnostic; Marcille's public kit remains unregistered.
import { MARCIL_ID as ID, validateMarcilDefinition, marcilSourceComponent as component }
  from './arkpedia-marcil-source.js';
import data from '../../../data/arkpedia-mvp.json' with { type: 'json' };

export const MARCIL_PARTY_CONTRACT = Object.freeze({
  scope: 'Selected E2 squad talent for four Laios-party operator cards, including support and bench',
  membership: 'Immutable unique selected operator-card identities and source faction tags decide the threshold. Deployment, retreat, death, concealment and summoned bodies do not change squad membership. Marcille need not deploy; her selected E2 talent remains active from the squad.',
  stats: 'Each selected party operator receives one selected DEF-percent/ASPD modifier at successful deployment, including Marcille herself and fresh redeployments. Other rooms, teams, players, tokens and devices do not receive it. The independent initial-mana bonus stays in the existing wallet preprocessor.',
  limits: 'Native categoryMask639/card-state decoding, deck-buff birth ordering, hidden/timed card dispatch and C# attribute-bucket parity are unresolved. This diagnostic uses immutable regular-stage operator cards and existing additive DEF-percent/ASPD buckets. No dynamic roster edit, public registration, native effects/audio, module or full Marcille gameplay approval.',
  frameParity: false,
});
const KEY = 'marcil:party';
const live = u => u?.alive && u.deployed && !u._removing;
export function verifyMarcilPartySource() {
  const d = component('-4543140451280208917'), s = d._options.selector, buff = d._deckBuffs[0]?.buff;
  if (d._options.minCntToTrig !== 4 || d._options.useOtherSelectorWhenGetBuff !== 0
    || s.categoryMask !== 639 || s.filterTag !== 'laios' || s.onlySelectMe !== 0 || s.excludeMe !== 0
    || s.excludeNotInHand !== 0 || s.excludeNotShowInCardList !== 0 || s.excludeHiddenByCardState !== 0
    || d._deckBuffs.length !== 1 || buff.buffKey !== 'marcil_t_2[laios]'
    || buff.maxStackCnt !== 1 || buff.independentCharacterSource !== 0
    || buff.isSilenceable !== 0 || buff.isStunnable !== 0 || buff.isFreezable !== 0
    || JSON.stringify(buff.attributes.attributeModifiers) !== JSON.stringify([
      { attributeType: 2, formulaItem: 1, value: 0, loadFromBlackboard: 1, fetchBaseValueFromSourceEntity: 0 },
      { attributeType: 7, formulaItem: 0, value: 0, loadFromBlackboard: 1, fetchBaseValueFromSourceEntity: 0 },
    ])) throw Error('Unreviewed Marcille party deck source');
}

export function installMarcilParty(b, { contract } = {}) {
  if (contract !== MARCIL_PARTY_CONTRACT) throw Error('Marcille requires her explicit party contract');
  if (b._marcilParty) throw Error('Marcille party already installed');
  const entry = b.bench?.[ID];
  if (!entry || b.finished || b._endReq || b.time !== 0
    || Object.values(b.bench).some(e => e.deployments > 0)
    || b.allyUnits.some(u => u.kind === 'op' && u.deploySeq > 0))
    throw Error('Marcille party requires a fresh selected roster');
  const record = validateMarcilDefinition(b.data.getChess(ID));
  for (const k of ['elite', 'level', 'potential', 'trust', 'skillId', 'skillRank', 'module']) {
    const fallback = k === 'trust' ? 0 : k === 'module' ? 'none' : undefined;
    if ((entry.build?.[k] ?? fallback) !== (record.build[k] ?? fallback))
      throw Error('Incomplete Marcille selected squad build');
  }
  verifyMarcilPartySource();
  const members = new Map();
  for (const id of Object.keys(b.bench)) {
    const def = b.data.getChess(id);
    if (!def || def.id !== id || def.charId !== id || def.raw.arkpedia?.isToken
      || def.raw.isToken || !def.profession) continue;
    const expected = id === ID ? record.tags : data.operators[id]?.factionTags
      ?? [data.operators[id]?.nationId, data.operators[id]?.groupId, data.operators[id]?.teamId]
        .filter(t => typeof t === 'string' && t);
    if (def.tags.includes('laios') && !expected.includes('laios'))
      throw Error('Unreviewed Marcille party member source');
    if (expected.includes('laios') && JSON.stringify(def.tags) !== JSON.stringify(expected))
      throw Error('Incomplete Marcille party member tags');
    if (expected.includes('laios')) members.set(id, def);
  }
  const talent = record.talents.find(t => t.prefabKey === '2'), bb = record.talentBb[record.talents.indexOf(talent)];
  if (talent && (bb.def !== .35 || bb.attack_speed !== 25 || bb.mana_init !== 25))
    throw Error('Unreviewed Marcille party values');
  const enabled = !!talent && members.size >= 4;
  let closed = false;
  const affected = new Map(), handles = [];
  const state = Object.freeze({ enabled, members: Object.freeze([...members.keys()]),
    mods: Object.freeze(enabled ? { defPct: bb.def, aspd: bb.attack_speed } : {}),
    get closed() { return closed; },
    stop() {
      if (closed) return; closed = true;
      for (const [u, buff] of affected) if (u.buffs.includes(buff)) b.removeBuff(u, buff);
      affected.clear(); for (const h of handles) b.off(h); handles.length = 0;
    },
  });
  b._marcilParty = state;
  handles.push(b.on('battleEnd', () => state.stop()));
  if (!enabled) return state;
  handles.push(b.on('deploy', ({ unit: u, move }) => {
    if (closed || b.finished || b._endReq || move || u.ownerId !== 'arkpedia' || u.side !== 'ally'
      || u.kind !== 'op' || !live(u) || !members.has(u.defId) || u.def.charId !== u.defId
      || !u.def.tags.includes('laios') || u.def.raw.arkpedia?.isToken) return;
    const seq = u.deploySeq;
    const buff = b.addBuff(u, { key: KEY, mods: { ...state.mods }, tags: ['marcil:deck'] });
    if (!buff) return;
    if (closed || b.finished || b._endReq || !live(u) || seq !== u.deploySeq) { b.removeBuff(u, buff); return; }
    affected.set(u, buff);
  }));
  handles.push(b.on('death', ({ unit: u }) => affected.delete(u)));
  return state;
}
