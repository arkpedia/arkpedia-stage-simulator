// SPDX-License-Identifier: GPL-3.0-or-later
import { STAGE_LIBRARY_URL, validateStageLibrary, createStageLibraryLoader } from './stage-library.js';
// The capability-generated library is the primary catalogue. Legacy standalone
// stage files remain readable for fixtures and older static deployments.
// Both formats install the same data.stage contract. The library discovers
// compatible stages from reusable capabilities; it needs no manual stage entry.

/** Parse/validate a catalogue; throws on an entry the client could not use. */
export function validateStageIndex(index) {
  if (index?.schemaVersion === 2) return validateStageLibrary(index);
  if (!index || index.schemaVersion !== 1 || !Array.isArray(index.stages) || !index.stages.length)
    throw Error('Invalid stage catalogue');
  const ids = new Set();
  for (const entry of index.stages) {
    if (!entry || typeof entry.id !== 'string' || !entry.id) throw Error('Stage entry without an id');
    if (ids.has(entry.id)) throw Error(`Duplicate stage: ${entry.id}`);
    ids.add(entry.id);
    if (typeof entry.code !== 'string' || !entry.code) throw Error(`Stage ${entry.id} has no code`);
    if (typeof entry.name !== 'string' || !entry.name) throw Error(`Stage ${entry.id} has no name`);
    if (entry.data != null && (typeof entry.data !== 'string' || !/^[a-z0-9._-]+\.json$/i.test(entry.data)))
      throw Error(`Stage ${entry.id} has an invalid data file`);
    if (entry.testOnly != null && typeof entry.testOnly !== 'boolean') throw Error(`Stage ${entry.id} has an invalid testOnly flag`);
  }
  if (!ids.has(index.defaultStage)) throw Error(`Unknown default stage: ${index.defaultStage}`);
  return index;
}

/** The entry to load: an explicit `?stage=` selection or the catalogue default. Test-only stages need `experimental`. */
export function resolveStage(index, requested = null, { experimental = false } = {}) {
  validateStageIndex(index);
  const id = requested || index.defaultStage;
  const entry = index.stages.find(stage => stage.id === id);
  if (entry?.availability === 'blocked') {
    const error = Error(`Stage ${id} needs unimplemented mechanics`);
    error.code = 'STAGE_UNSUPPORTED'; error.stage = entry;
    error.blockers = entry.missing.map(i => index.capabilities[i]);
    error.stages = index.stages.filter(e => e.availability === 'available');
    throw error;
  }
  if (entry && (!entry.testOnly || experimental)) return entry;
  if (entry) {
    const error = Error(`Stage ${id} is test-only: open it with ?experimental=1`);
    error.code = 'STAGE_TEST_ONLY';
    error.stage = entry;
    error.stages = index.stages.filter(stage => !stage.testOnly);
    throw error;
  }
  const error = Error(`Unknown stage: ${id}`);
  error.code = 'STAGE_NOT_FOUND';
  error.stages = index.stages.filter(stage => stage.availability !== 'blocked' && (experimental || !stage.testOnly));
  throw error;
}

/** URL of a stage stored beside the other Arkpedia data files. */
export function stageDataUrl(entry) {
  return entry.data ? `/data/${entry.data}` : null;
}

export async function loadStageCatalogue(fetchImpl = fetch) {
  const response = await fetchImpl(STAGE_LIBRARY_URL);
  if (response.ok) return validateStageLibrary(await response.json());
  // An absent library identifies an older deployment. A broken published
  // library must not silently fall back to stale, unvalidated stage rules.
  if (response.status !== 404) throw Error('Stage library unavailable');
  const legacy = await fetchImpl('/data/arkpedia-stages.json');
  if (!legacy.ok) throw Error('Stage catalogue unavailable');
  return validateStageIndex(await legacy.json());
}
const baseData = new WeakMap(), libraryLoaders = new WeakMap();

/**
 * Resolve and install the selected stage on `data` (`data.stage` stays the
 * public contract used by StandardBattle and StageRenderer). Returns the entry
 * and the installed stage. An embedded entry must already be the global stage.
 */
export async function applyStage(data, index, requested = null, fetchImpl = fetch, { experimental = false, embeddedDefault = false } = {}) {
  const entry = resolveStage(index, requested, { experimental });
  if (!baseData.has(data)) baseData.set(data, { stage: data.stage, operators: { ...data.operators }, enemies: { ...data.enemies } });
  const base = baseData.get(data);
  let stage;
  // The bootstrap still contains a complete default scene. Explicit opt-in
  // reuses it for the home page and controlled operator-review fixtures. An
  // explicit stage selection always uses the capability-generated graph.
  if (embeddedDefault && !requested && base.stage?.code === entry.code && base.stage.geometry) {
    stage = base.stage;
  } else if (entry.bundle) {
    if (!libraryLoaders.has(fetchImpl)) libraryLoaders.set(fetchImpl, createStageLibraryLoader(fetchImpl));
    stage = await libraryLoaders.get(fetchImpl).load(entry);
  } else if (entry.data) {
    const response = await fetchImpl(stageDataUrl(entry));
    if (!response.ok) throw Error(`Stage data unavailable: ${entry.id}`);
    stage = await response.json();
    if (!stage || typeof stage !== 'object' || !stage.geometry) throw Error(`Stage data is not a stage: ${entry.id}`);
  } else {
    if (!base.stage || base.stage.code !== entry.code) throw Error(`Embedded stage is missing: ${entry.id}`);
    stage = base.stage;
  }
  // Commit only after the complete graph resolves. Prior stage overrides never
  // become the base of the next stage, including fixed-squad support operators.
  data.stage = { ...stage, code: entry.code, name: entry.name, description: entry.description ?? stage.description ?? '' };
  data.operators = { ...base.operators, ...stage.operators };
  data.enemies = { ...base.enemies, ...stage.enemies };
  return { entry, stage: data.stage };
}
