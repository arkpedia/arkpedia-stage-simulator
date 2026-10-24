// SPDX-License-Identifier: GPL-3.0-or-later
// Stage catalogue: the one place that decides which stage the simulator loads.
// The global fight data (operators, tokens, enemy records, effects) stays in
// data/arkpedia-mvp.json; a stage entry either embeds its stage object there
// (`data: null`, the current 0-1 slice) or names a separate JSON file (the
// shape a new stage should use, so the 25 MB global payload does not grow).
//
// Adding a stage is therefore: build its stage object (code/name/description/
// battle/mapTags/geometry/pathing/art), save it as data/<file>, and add one
// entry here. The battle and the renderer consume `data.stage`, so no stage
// consumers change.

/** Parse/validate a catalogue; throws on an entry the client could not use. */
export function validateStageIndex(index) {
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
  error.stages = index.stages.filter(stage => experimental || !stage.testOnly);
  throw error;
}

/** URL of a stage stored beside the other Arkpedia data files. */
export function stageDataUrl(entry) {
  return entry.data ? `/data/${entry.data}` : null;
}

/**
 * Resolve and install the selected stage on `data` (`data.stage` stays the
 * public contract used by StandardBattle and StageRenderer). Returns the entry
 * and the installed stage. An embedded entry must already be the global stage.
 */
export async function applyStage(data, index, requested = null, fetchImpl = fetch, { experimental = false } = {}) {
  const entry = resolveStage(index, requested, { experimental });
  if (entry.data) {
    const response = await fetchImpl(stageDataUrl(entry));
    if (!response.ok) throw Error(`Stage data unavailable: ${entry.id}`);
    const stage = await response.json();
    if (!stage || typeof stage !== 'object' || !stage.geometry) throw Error(`Stage data is not a stage: ${entry.id}`);
    if (stage.enemyCatalogue && (!entry.testOnly || !experimental || stage.testOnly !== true))
      throw Error('Candidate enemy catalogue requires an experimental test-only stage');
    data.stage = { ...stage, code: entry.code, name: entry.name, description: entry.description ?? stage.description ?? '' };
    if (stage.operators && typeof stage.operators === 'object') data.operators = { ...(data.operators ?? {}), ...stage.operators };
    if (stage.enemies && typeof stage.enemies === 'object') data.enemies = { ...(data.enemies ?? {}), ...stage.enemies };
  } else {
    if (!data.stage || data.stage.code !== entry.code) throw Error(`Embedded stage is missing: ${entry.id}`);
  }
  return { entry, stage: data.stage };
}
