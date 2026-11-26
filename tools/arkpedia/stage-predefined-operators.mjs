// SPDX-License-Identifier: GPL-3.0-or-later
import { catalogueFor } from '../../shared/arkpedia/loadout.js';
import { validateLoadout } from '../../shared/arkpedia/squad.js';
import { originalDeviceDirection } from './stage-device-instances.mjs';
import { createHash } from 'node:crypto';
import favor from '../../data/arkpedia-favor-source.json' with { type: 'json' };

const favorBytes = Buffer.from(favor.originalJson);
if (createHash('sha1').update(`blob ${favorBytes.length}\0`).update(favorBytes).digest('hex') !== 'bfad1ea682d10a3eea5bd7254362c825f33dd22e')
  throw Error('Predefined operator favor table checksum mismatch');
const favorTable = JSON.parse(favor.originalJson);
export function predefinedTrust(points) {
  if (!Number.isSafeInteger(points) || points < 0 || points > favorTable.maxFavor) throw Error('Invalid predefined operator favor points');
  const lower = favorTable.favorFrames.findLast(f => f.level <= points);
  // favorFrames are point thresholds, not a continuous stat curve. The
  // source's integer battlePhase changes only when the next threshold is met.
  // The build stores equivalent combat trust (2 * phase); loadout.js then
  // interpolates the operator's separate stat keyframes at exactly that phase.
  // See docs/STAGE-PREDEFINED-TRUST-REVIEW.md for sources and scope.
  return lower.data.battlePhase * 2;
}

/** Source-owned cards and actors share normal operator records and kits. Reject
 * duplicate identities and unimplemented instance overrides before publication. */
export function compilePredefinedOperators(level, geometry, operators, rules = {}) {
  const pre = level.predefines ?? {}, sourceCards = pre.characterCards ?? [], sourceActors = pre.characterInsts ?? [];
  const toggles = rules?.predefinedOperators ?? {}, sourceEntries = [...sourceCards, ...sourceActors];
  for (const [key, enabled] of Object.entries(toggles)) {
    if (typeof enabled !== 'boolean' || sourceEntries.filter(p => (p.alias || p.inst?.characterKey) === key).length !== 1)
      throw Error(`Unknown or ambiguous predefined-operator alias: ${key}`);
  }
  const initial = p => Object.hasOwn(toggles, p.alias || p.inst?.characterKey)
    ? { ...p, hidden: !toggles[p.alias || p.inst.characterKey] } : p;
  const cards = sourceCards.map(initial);
  const actions = (level.waves ?? []).flatMap(w => w.fragments.flatMap(f => f.actions));
  const activated = new Set(actions.filter(a => [6, 'ACTIVATE_PREDEFINED'].includes(a.actionType)).map(a => a.key));
  // Initial enable rules run before scheduled actions; inactive actors without
  // a later activation never enter this variant. Source records stay unchanged.
  const actors = sourceActors.map(initial).filter(p => !p.hidden || activated.has(p.alias || p.inst?.characterKey));
  const needsControl = Object.keys(toggles).length || actors.length || cards.some(p => p.hidden) || actions.some(a => [6, 'ACTIVATE_PREDEFINED'].includes(a.actionType)
    && [...cards, ...actors].some(p => (p.alias || p.inst?.characterKey) === a.key));
  if (!needsControl) return null;
  if (!operators) throw Error('Missing predefined operator records');
  if (!cards.length && typeof level.options?.isTrainingLevel !== 'boolean') throw Error('Unknown predefined squad mode');
  const squadMode = cards.length || level.options?.isTrainingLevel ? 'fixed' : 'player';
  const catalogue = catalogueFor({ operators }), ids = new Map(), keys = new Set();
  const entries = [...cards.map(p => ({ kind: 'card', p })), ...actors.map(p => ({ kind: 'actor', p }))].map(({ kind, p }) => {
    const raw = p.inst, id = raw?.characterKey, key = p.alias || id, op = operators[id];
    // A later hidden actor of an operator already preset (14-10's `#2` entries) is that operator redeployed with its
    // own build: it replaces its predecessor when its wave action activates it (one bench entry per operator).
    const prior = ids.get(id);
    const successor = prior && kind === 'actor' && prior.kind === 'actor' && p.hidden === true && activated.has(key);
    if (!op || (prior && !successor) || keys.has(key)) throw Error(`Unknown or duplicate predefined operator: ${id}`);
    ids.set(id, { kind, key }); keys.add(key);
    if (typeof p.hidden !== 'boolean' || p.uniEquipIds?.length || p.masterInfos?.length || p.tmplId
      || p.overrideSkillBlackboard != null || p.overrideTalents != null)
      throw Error(`Unsupported predefined operator override: ${id}`);
    const elite = typeof raw.phase === 'number' ? raw.phase : Number(String(raw.phase).replace('PHASE_', ''));
    if (!Number.isSafeInteger(p.skillIndex) || p.skillIndex < -1 || (p.skillIndex === -1 && op.skills.length && op.rarity > 3))
      throw Error(`Unsupported predefined operator skill selection: ${id}`);
    const disableSkill = p.skillIndex === -1 && op.skills.length > 0;
    const skill = p.skillIndex === -1 ? op.skills[0] ?? null : op.skills[p.skillIndex];
    if (p.skillIndex >= 0 && !skill) throw Error(`Missing predefined operator skill: ${id}`);
    const build = { id, elite, level: raw.level, potential: raw.potentialRank + 1, trust: predefinedTrust(raw.favorPoint),
      skillId: skill?.id ?? null, skillRank: skill ? disableSkill ? 1 : p.mainSkillLvl : null };
    validateLoadout(build, catalogue);
    if (kind === 'actor' && (!Number.isInteger(p.position?.row) || !Number.isInteger(p.position?.col)
      || p.position.row < 0 || p.position.row >= geometry.rows || p.position.col < 0 || p.position.col >= geometry.cols))
      throw Error(`Invalid predefined operator position: ${id}`);
    return { key, kind, hidden: p.hidden, build, ...(disableSkill ? { disableSkill: true } : {}), ...(kind === 'actor' ? { row: p.position.row, col: p.position.col,
      direction: originalDeviceDirection(p.direction) } : {}), ...(successor ? { successorOf: prior.key } : {}),
      ...(kind === 'actor' && rules?.predefinedDeckCards ? { deckCard: true } : {}) };
  });
  const exported = geometry.suppliedUnits?.fixed_squad ?? [];
  if (exported.length !== cards.length || entries.filter(e => e.kind === 'card').some(e => {
    const c = exported.find(c => c.unit_id === e.build.id);
    const original = sourceCards.find(p => p.inst.characterKey === e.build.id);
    return !c || c.elite !== e.build.elite || c.level !== e.build.level || c.potential !== e.build.potential - 1
      || c.skill_index !== original.skillIndex || c.skill_level !== original.mainSkillLvl
      || !!c.hidden !== original.hidden;
  })) throw Error('Original/viewer predefined card mismatch');
  return { entries, squadMode };
}
