// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildOperatorLibrary } from '../tools/arkpedia/operator-library.mjs';
import { createOperatorLibrary, loadOperatorData, stageOperatorIds } from '../shared/arkpedia/operator-library.js';
import { catalogueFor, defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { regularTokenIdsFor } from '../shared/arkpedia/summons.js';
import { applyStage } from '../shared/arkpedia/stages.js';
const source = JSON.parse(await readFile(new URL('../data/arkpedia-mvp.json', import.meta.url)));
const built = buildOperatorLibrary(source);
function fixture(options = {}) {
  const requests = [], failed = new Set();
  const fetcher = async url => {
    const hash = url.split('/').at(-1).replace('.json', ''); requests.push(hash);
    if (failed.has(hash)) return new Response('no', { status: 503 });
    return new Response(built.objects.get(hash) ?? 'missing', { status: built.objects.has(hash) ? 200 : 404 });
  };
  return { library: createOperatorLibrary(built.bootstrap, fetcher, options), requests, failed };
}

test('all roster constraints and every hydrated build match the original snapshot', async () => {
  const { library, requests } = fixture();
  assert.deepEqual(catalogueFor(library.data), catalogueFor(source));
  assert.equal(requests.length, 0);
  const ids = Object.keys(source.operators);
  assert.throws(() => recordFor(defaultBuild(source.operators[ids[0]]), library.data), /must be loaded/);
  await library.ensureOperators(ids);
  for (const id of ids) {
    const build = defaultBuild(source.operators[id]);
    assert.deepEqual(recordFor(build, library.data), recordFor(build, source), id);
  }
  assert.equal(requests.length, ids.length);
  assert.deepEqual(library.data.tokens, {});
  assert.deepEqual(library.data.sd.models, {});
});

test('selected records share concurrent fetches, failed downloads retry, cached records stay independent', async () => {
  const { library, requests, failed } = fixture();
  const id = Object.keys(source.operators)[0], hash = built.bootstrap.operators[id];
  failed.add(hash);
  await assert.rejects(library.ensureOperators([id]), /unavailable/);
  assert.equal(library.data.operators[id].summaryOnly, true);
  failed.clear();
  await Promise.all([library.ensureOperators([id]), library.ensureOperators([id])]);
  assert.equal(requests.length, 2);
  library.data.operators[id].name = 'caller mutation';
  library.data.operators[id] = structuredClone(built.bootstrap.roster[id]);
  await library.ensureOperators([id]);
  assert.equal(library.data.operators[id].name, source.operators[id].name);
  assert.equal(requests.length, 2);
});

test('summon dependency closure loads every registered operator kit without unrelated records or artwork', async () => {
  for (const id of Object.keys(source.operators)) {
    const { library, requests } = fixture();
    library.data.stage = source.stage;
    await library.prepareBattle({ operators: [{ id }] });
    assert.deepEqual(Object.keys(library.data.tokens).sort(), regularTokenIdsFor([id]).sort(), id);
    assert.deepEqual(Object.keys(library.data.operators).filter(k => !library.data.operators[k].summaryOnly), [id]);
    assert.equal(requests.length, 1 + regularTokenIdsFor([id]).length, id);
    assert.deepEqual(library.data.sd.models, {});
  }
});

test('stage-local records, predefined cards and actors override the free squad; hydration survives stage changes', async () => {
  const { library } = fixture();
  const ids = Object.keys(source.operators).slice(0, 3), [card, actor, ignored] = ids;
  const stage = { ...source.stage, operators: { [card]: { ...source.operators[card], name: 'Stage copy' } },
    waveProgram: { predefined: { entries: [{ kind: 'card', build: { id: card } }, { kind: 'actor', build: { id: actor } }] } } };
  const index = { schemaVersion: 1, defaultStage: 'a', stages: [{ id: 'a', code: 'A', name: 'A', data: 'a.json' }, { id: 'b', code: 'B', name: 'B', data: 'b.json' }] };
  const fetcher = async url => new Response(JSON.stringify(url.endsWith('a.json') ? stage : source.stage));
  await applyStage(library.data, index, 'a', fetcher);
  assert.deepEqual(await library.prepareBattle({ operators: [{ id: ignored }] }), [card, actor]);
  assert.equal(library.data.operators[card].name, 'Stage copy');
  assert.equal(library.data.operators[ignored].summaryOnly, true);
  await applyStage(library.data, index, 'b', fetcher);
  await library.ensureOperators([card]);
  assert.equal(library.data.operators[card].name, source.operators[card].name);
  assert.deepEqual(stageOperatorIds({ fixedSquad: [{ unit_id: card }] }, { operators: [{ id: ignored }] }), [card]);
});

test('model metadata follows selected operators, summons and explicit enemy model aliases', async () => {
  const { library, requests } = fixture(), id = 'char_2023_ling';
  library.data.enemies = source.enemies;
  await library.ensureModels([id]);
  const keys = Object.keys(library.data.sd.models);
  assert.ok(keys.length > 2);
  assert.ok(keys.includes(`operator/${id}/default/front`));
  assert.equal(Object.keys(library.data.operators).filter(k => !library.data.operators[k].summaryOnly).length, 0);
  await library.ensureModels([id]);
  assert.equal(requests.length, new Set(requests).size);
  for (const key of keys) assert.deepEqual(library.data.sd.models[key], source.sd.models[key]);
});

test('on-demand hydration loads player builds alongside trial actors, and ignores player choices for actor-only tutorials', async () => {
  const { library } = fixture();
  const entries = [{ kind: 'actor', build: { id: 'char_220_grani' } }];
  library.data.stage = { waveProgram: { predefined: { squadMode: 'player', entries } } };
  const selection = { operators: [{ id: 'char_123_fang' }], support: { id: 'char_124_kroos' } };
  assert.deepEqual(await library.prepareBattle(selection), ['char_123_fang', 'char_124_kroos', 'char_220_grani']);
  for (const id of ['char_123_fang', 'char_124_kroos', 'char_220_grani']) assert.equal(library.data.operators[id].summaryOnly, undefined);
  library.data.stage.waveProgram.predefined.squadMode = 'fixed';
  assert.deepEqual(stageOperatorIds(library.data.stage, selection), ['char_220_grani']);
});

test('only absent manifests or explicit snapshot requests use the legacy bootstrap', async () => {
  let urls = [];
  const fetcher = async url => { urls.push(url); return url.endsWith('mvp.json') ? new Response(JSON.stringify(source)) : new Response('absent', { status: 404 }); };
  await loadOperatorData(fetcher);
  assert.equal(urls.length, 2);
  urls = []; await loadOperatorData(fetcher, { snapshot: true }); assert.deepEqual(urls, ['/data/arkpedia-mvp.json']);
  await assert.rejects(loadOperatorData(async () => new Response('broken', { status: 500 })), /unavailable/);
  await assert.rejects(loadOperatorData(async () => new Response('{}')), /Invalid operator library/);
});
