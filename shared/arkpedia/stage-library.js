// SPDX-License-Identifier: GPL-3.0-or-later
// Static component graphs: the source compiler runs at build time, never in a
// user's browser. Artwork continues to use the separate shared-model manifest.
import { createComponentStore } from './component-store.js';
export const STAGE_LIBRARY_URL = '/data/arkpedia-library.json';
export const STAGE_OBJECT_BASE = '/data/arkpedia-stage-library/objects/';
const hashPattern = /^[a-f0-9]{64}$/;
export function stageObjectUrl(hash) {
  if (!hashPattern.test(hash ?? '')) throw Error('Invalid stage component reference');
  return `${STAGE_OBJECT_BASE}${hash}.json`;
}
export function validateStageLibrary(index) {
  if (index?.schemaVersion !== 2 || !Array.isArray(index.stages) || !index.stages.length)
    throw Error('Invalid stage library');
  if (!Array.isArray(index.capabilities)) throw Error('Missing stage capability catalogue');
  const ids = new Set();
  for (const entry of index.stages) {
    if (!/^[a-z0-9_-]+$/i.test(entry?.id ?? '') || ids.has(entry.id)
      || typeof entry.code !== 'string' || !entry.code || typeof entry.name !== 'string' || !entry.name)
      throw Error('Invalid or duplicate stage library identity');
    ids.add(entry.id);
    if (entry.availability === 'available') {
      stageObjectUrl(entry.bundle);
      if (entry.missing?.length) throw Error('Available stage has unresolved capabilities');
    } else if (entry.availability !== 'blocked' || entry.bundle != null || !Array.isArray(entry.missing) || !entry.missing.length
      || entry.missing.some(i => !Number.isSafeInteger(i) || !index.capabilities[i]))
      throw Error('Invalid stage availability');
  }
  if (!index.stages.some(e => e.id === index.defaultStage && e.availability === 'available'))
    throw Error('Stage library needs an available default stage');
  return index;
}

export function createStageLibraryLoader(fetchImpl = fetch, options = {}) {
  const { component, stats } = createComponentStore(fetchImpl, options);
  async function load(entry) {
    if (entry.availability !== 'available') {
      const error = Error(`Stage ${entry.id} needs unimplemented mechanics`);
      error.code = 'STAGE_UNSUPPORTED'; error.stage = entry; error.blockers = entry.blockers; throw error;
    }
    const graph = await component(entry.bundle);
    if (graph?.schemaVersion !== 1 || graph.kind !== 'stage' || graph.id !== entry.id
      || !graph.enemies || Array.isArray(graph.enemies)) throw Error('Invalid stage component graph');
    const [definition, geometry, pathing, enemies, operators, waveProgram] = await Promise.all([
      component(graph.definition), component(graph.geometry), component(graph.pathing),
      Promise.all(Object.entries(graph.enemies).map(async ([id, refs]) => {
        const [record, stats] = await Promise.all([component(refs.definition), component(refs.stats)]);
        if (record.key !== id) throw Error(`Stage enemy identity mismatch: ${id}`);
        return [id, { ...record, stats }];
      })),
      Promise.all(Object.entries(graph.operators ?? {}).map(async ([id, ref]) => {
        const record = await component(ref); if (record.id !== id) throw Error(`Stage operator identity mismatch: ${id}`);
        return [id, record];
      })),
      graph.waveProgram ? component(graph.waveProgram) : null,
    ]);
    if (!geometry?.rows || !geometry.cols || !pathing?.paths || !definition?.battle)
      throw Error('Invalid compiled stage components');
    return structuredClone({ ...definition, geometry, pathing, enemies: Object.fromEntries(enemies),
      ...(waveProgram ? { waveProgram } : {}),
      ...(operators.length ? { operators: Object.fromEntries(operators) } : {}) });
  }
  return { load, stats };
}
