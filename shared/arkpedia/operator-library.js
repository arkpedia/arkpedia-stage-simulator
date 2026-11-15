// SPDX-License-Identifier: GPL-3.0-or-later
import { createComponentStore, componentUrl } from './component-store.js';
import { regularTokenIdsFor } from './summons.js';
import { enemyModelKey, stageDeviceModelKeys } from './facing.js';
import { stageUsesFixedSquad } from './stage-roster.js';

export const OPERATOR_LIBRARY_URL = '/data/arkpedia-operators.json';
export function validateOperatorLibrary(index) {
  if (index?.schemaVersion !== 1 || index.kind !== 'operator-library' || !index.common?.sd
    || !index.roster || !Object.keys(index.roster).length) throw Error('Invalid operator library');
  for (const key of ['operators', 'tokens', 'models']) {
    if (!index[key] || Array.isArray(index[key])) throw Error(`Invalid ${key} catalogue`);
    for (const hash of Object.values(index[key])) componentUrl(hash);
  }
  if (Object.keys(index.operators).length !== Object.keys(index.roster).length)
    throw Error('Operator roster does not match records');
  for (const [id, op] of Object.entries(index.roster))
    if (op.id !== id || !op.summaryOnly || !index.operators[id]) throw Error(`Invalid operator summary: ${id}`);
  return index;
}

export function stageOperatorIds(stage, selection) {
  const entries = stage.waveProgram?.predefined?.entries;
  const cards = stageUsesFixedSquad(stage) ? entries ? entries.filter(e => e.kind === 'card').map(e => e.build.id)
    : stage.fixedSquad.map(e => e.unit_id) : null;
  return [...new Set([...(cards ?? [...selection.operators.map(b => b.id), ...(selection.support ? [selection.support.id] : [])]),
    ...(entries ?? []).filter(e => e.kind === 'actor').map(e => e.build.id)])];
}

export function createOperatorLibrary(index, fetchImpl = fetch, options = {}) {
  validateOperatorLibrary(index);
  const store = createComponentStore(fetchImpl, options);
  const data = { ...structuredClone(index.common), operators: structuredClone(index.roster), tokens: {}, enemies: {} };
  async function ensureOperators(ids) {
    const records = await Promise.all([...new Set(ids)].map(async id => {
      if (!data.operators[id]) throw Error(`Unknown operator: ${id}`);
      if (!data.operators[id].summaryOnly) return [id, data.operators[id]]; // Stage-local full records take precedence.
      const op = await store.component(index.operators[id]);
      if (op.id !== id || op.summaryOnly) throw Error(`Operator identity mismatch: ${id}`);
      return [id, structuredClone(op)];
    }));
    Object.assign(data.operators, Object.fromEntries(records));
  }
  async function prepareBattle(selection) {
    const ids = stageOperatorIds(data.stage, selection), tokenIds = regularTokenIdsFor(ids);
    // Stats are required for simulation. Artwork metadata is optional, loaded separately.
    const [, records] = await Promise.all([ensureOperators(ids), Promise.all(tokenIds.map(async id => {
      if (!index.tokens[id]) throw Error(`Missing summon record: ${id}`);
      const token = await store.component(index.tokens[id]);
      if (token.id !== id) throw Error(`Summon identity mismatch: ${id}`);
      return [id, structuredClone(token)];
    }))]);
    Object.assign(data.tokens, Object.fromEntries(records));
    return ids;
  }
  async function ensureModels(ids) {
    const tokens = regularTokenIdsFor(ids);
    const keys = [...new Set([
      ...[...ids, ...tokens].flatMap(id => ['front', 'back'].map(f => `operator/${id}/default/${f}`)),
      ...tokens.map(id => `operator/${id}/default/down`),
      ...Object.entries(data.enemies).map(([id, record]) => enemyModelKey(id, record)),
      ...stageDeviceModelKeys(data.stage),
    ])].filter(key => index.models[key]);
    const records = await Promise.all(keys.map(async key => {
      const model = await store.component(index.models[key]);
      if (`${model.kind}/${model.id}/${model.variant}/${model.facing}` !== key) throw Error(`Model identity mismatch: ${key}`);
      return [key, structuredClone(model)];
    }));
    Object.assign(data.sd.models, Object.fromEntries(records));
  }
  return { data, ensureOperators, prepareBattle, ensureModels, stats: store.stats };
}

export async function loadOperatorData(fetchImpl = fetch, { snapshot = false } = {}) {
  if (!snapshot) {
    const response = await fetchImpl(OPERATOR_LIBRARY_URL);
    if (response.ok) return createOperatorLibrary(await response.json(), fetchImpl);
    if (response.status !== 404) throw Error('Operator library unavailable');
  }
  // Explicit snapshot mode supports controlled QA fixtures. A missing manifest
  // supports older static deployments; corrupt published libraries never fall back.
  const response = await fetchImpl('/data/arkpedia-mvp.json');
  if (!response.ok) throw Error('Operator snapshot unavailable');
  const data = await response.json();
  return { data, ensureOperators: async () => {}, ensureModels: async () => {},
    prepareBattle: async selection => stageOperatorIds(data.stage, selection) };
}
