// SPDX-License-Identifier: GPL-3.0-or-later
// The stage catalogue is the single place a stage is selected. This checks the
// committed index, the embedded 0-1 stage and the file-backed shape a future
// stage uses, without starting a browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { applyStage, resolveStage, stageDataUrl, validateStageIndex } from '../shared/arkpedia/stages.js';
import index from '../data/arkpedia-stages.json' with { type: 'json' };
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };

test('the committed catalogue is valid and its default is the embedded 0-1 stage', () => {
  validateStageIndex(index);
  assert.equal(index.defaultStage, '0-1');
  const entry = resolveStage(index);
  assert.equal(entry.id, mvp.stage.code);
  assert.equal(entry.code, mvp.stage.code);
  assert.equal(entry.name, mvp.stage.name);
  assert.equal(entry.data, null, '0-1 stays embedded in the global payload');
});
test('an explicit stage wins over the default and an unknown stage lists the alternatives', () => {
  const catalogued = { ...index, stages: [...index.stages, { id: 'test-2', code: 'T-2', name: 'Test', data: 'arkpedia-stage-test-2.json' }] };
  assert.equal(resolveStage(catalogued, 'test-2').id, 'test-2');
  assert.throws(() => resolveStage(catalogued, 'missing'), error => {
    assert.equal(error.code, 'STAGE_NOT_FOUND');
    assert.deepEqual(error.stages.map(stage => stage.id), ['0-1', 'test-2']);
    return true;
  });
});
test('a file-backed stage replaces data.stage and keeps the catalogue label', async () => {
  const data = structuredClone(mvp);
  const catalogued = { ...index, stages: [{ id: 'test-2', code: 'T-2', name: 'Test Stage', description: 'Catalogue description',
    data: 'arkpedia-stage-test-2.json' }], defaultStage: 'test-2' };
  const requested = [];
  const result = await applyStage(data, catalogued, null, async url => {
    requested.push(url);
    return { ok: true, json: async () => ({ geometry: { rows: 6, cols: 9 }, code: 'IGNORED', name: 'IGNORED', description: 'Stage description' }) };
  });
  assert.deepEqual(requested, ['/data/arkpedia-stage-test-2.json']);
  assert.equal(result.entry.id, 'test-2');
  assert.equal(data.stage.code, 'T-2');
  assert.equal(data.stage.name, 'Test Stage');
  assert.equal(data.stage.description, 'Catalogue description');
  assert.equal(data.stage.geometry.cols, 9);
});
test('an embedded catalogue entry can never silently load a different stage', async () => {
  const data = structuredClone(mvp);
  const catalogued = { ...index, defaultStage: '0-1', stages: [{ id: '0-1', code: '9-9', name: 'Wrong', data: null }] };
  await assert.rejects(applyStage(data, catalogued), /Embedded stage is missing/);
});
test('every data-backed stage names a committed file', async () => {
  for (const entry of index.stages) {
    const url = stageDataUrl(entry);
    if (!url) continue;
    await access(new URL(`../data/${entry.data}`, import.meta.url));
  }
});
