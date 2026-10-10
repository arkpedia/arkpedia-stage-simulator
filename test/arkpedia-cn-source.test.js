// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import cn from '../data/arkpedia-cn-source.json' with { type: 'json' };
import roster from '../data/arkpedia-roster-target.json' with { type: 'json' };
import coverage from '../data/arkpedia-coverage.json' with { type: 'json' };
import data from '../data/arkpedia-mvp.json' with { type: 'json' };
import { compileOperatorRecord, compileReviewedOperators, operatorChannel } from '../tools/arkpedia/operator-source.mjs';
import { REGULAR_OPERATORS } from '../shared/arkpedia/operators.js';
import { prepareCNSource, gitBlob } from '../tools/arkpedia/cn-source.mjs';
import prior from '../data/arkpedia-entelechia-prefabs.json' with { type: 'json' };
import { coverageFor } from '../tools/arkpedia/coverage.mjs';

test('CN candidate pin matches the full roster and never increases playable coverage', () => {
  assert.equal(cn.source.repository, roster.source.repository);
  assert.equal(cn.source.commit, roster.source.commit);
  assert.equal(cn.globalSource.commit, data.sources[cn.globalSource.repository]);
  for (const row of roster.source.tables)
    assert.deepEqual(cn.source.tables.find(r => r.path === row.path)?.sha256, row.sha256);
  assert.deepEqual(cn.enabledOperators, []);
  // This candidate snapshot predates the explicit Global patch-table import.
  // Guard and Medic Amiya also exist in Global; do not label them CN-only.
  const globalForms = new Set(data.globalAlternateFormSource?.formIds ?? []);
  assert.equal(Object.keys(cn.tables.characters).filter(id => !globalForms.has(id) && !data.operators[id]).length,
    coverage.fullRosterTarget.remainingOutsideGlobalSnapshot);
  for (const id of Object.keys(cn.tables.characters)) {
    if (data.operators[id]) {
      assert.ok(globalForms.has(id));
      assert.equal(REGULAR_OPERATORS[id].sourceForm, 'patch');
      assert.equal(operatorChannel(id, REGULAR_OPERATORS[id]), 'global');
    } else {
      assert.ok(coverage.fullRosterTarget.missingForms.includes(id));
      assert.equal(REGULAR_OPERATORS[id], undefined);
    }
  }
  assert.equal(cn.summary.skills, 132); assert.equal(cn.summary.skillRanks, 1320);
  assert.deepEqual(cn.source.tables.map(r => r.path.split('/').at(-1)),
    ['character_table.json', 'char_patch_table.json', 'skill_table.json', 'range_table.json']);
  for (const row of cn.source.tables) {
    assert.match(row.gitBlob, /^[a-f0-9]{40}$/); assert.match(row.sha256, /^[a-f0-9]{64}$/); assert.ok(row.bytes > 0);
  }
});
for (const [id, c] of Object.entries(cn.tables.characters)) test(`${id}: all phases, skill ranks, potential and talent ranges compile from the CN channel`, () => {
  const compiled = compileOperatorRecord(id, cn.tables);
  const row = roster.operators.find(r => r.id === id);
  assert.deepEqual(compiled.skills.map(s => s.id), row.skills);
  assert.deepEqual(compiled.phases.map(p => p.attributesKeyFrames), c.phases.map(p => p.attributesKeyFrames));
  assert.deepEqual(compiled.favorKeyFrames, c.favorKeyFrames);
  assert.equal(compiled.name, row.sourceName);
  for (const s of compiled.skills) {
    assert.equal(s.levels.length, 10);
    for (const [i, rank] of s.levels.entries()) {
      const { rangeGrid, ...original } = rank;
      assert.deepEqual(original, cn.tables.skills[s.id].levels[i]);
      if (rank.rangeId) assert.deepEqual(rangeGrid, cn.tables.ranges[rank.rangeId].grids.map(p => [p.row, p.col]));
    }
  }
});
test('two Amiya alternate forms retain their own skills, class and phases', () => {
  const guard = compileOperatorRecord('char_1001_amiya2', cn.tables), medic = compileOperatorRecord('char_1037_amiya3', cn.tables);
  assert.equal(guard.profession, 'WARRIOR'); assert.equal(medic.profession, 'MEDIC');
  assert.notDeepEqual(guard.skills.map(s => s.id), medic.skills.map(s => s.id));
  assert.notDeepEqual(guard.phases, medic.phases);
});
test('a CN-only record needs an explicit channel; missing and unknown sources fail closed', () => {
  const id = 'char_4227_gallus', registry = { [id]: { sourceChannel: 'cn' } };
  assert.equal(operatorChannel(id, {}), 'global');
  assert.throws(() => operatorChannel(id, { sourceChannel: 'latest' }), /Unknown.*channel/);
  assert.throws(() => compileReviewedOperators({ registry, global: { characters: {} } }), /Missing pinned cn/);
  assert.throws(() => compileReviewedOperators({ registry: { [id]: {} }, global: { characters: {}, skills: {}, ranges: {} }, cn: cn.tables }), /Unsupported operator shape/);
  assert.deepEqual(compileReviewedOperators({ registry, global: { characters: {} }, cn: cn.tables })[id], compileOperatorRecord(id, cn.tables));
});
test('Global precedence preserves the complete existing Entelechia record in a mixed build', () => {
  const id = 'char_4010_etlchi', newId = 'char_4227_gallus';
  const global = { characters: { [id]: prior.tables.character }, skills: prior.tables.skills, ranges: prior.tables.ranges };
  const hostileCN = { ...cn.tables, characters: { ...cn.tables.characters,
    [id]: { ...prior.tables.character, name: 'different regional record' } } };
  const mixed = compileReviewedOperators({ registry: { [id]: REGULAR_OPERATORS[id], [newId]: { sourceChannel: 'cn' } }, global, cn: hostileCN });
  assert.deepEqual(mixed[id], data.operators[id]);
  assert.equal(mixed[newId].name, cn.tables.characters[newId].name);
});
test('full-roster coverage counts reviewed forms outside Global while leaving the Global catalogue separate', () => {
  // An existing reviewed record exercises the outside-snapshot calculation
  // without registering an unimplemented CN kit just for a test.
  const id = 'char_4010_etlchi', missing = 'char_4227_gallus';
  const report = coverageFor({ characters: {}, enemies: { enemies: [] }, chess: {}, inherited: { chess: [] },
    data: { operators: { [id]: data.operators[id] }, sd: {}, enemies: {}, sources: {} },
    assetModels: {}, rosterTarget: { summary: { operatorForms: 2 }, source: cn.source,
      operators: [{ id }, { id: missing }] } });
  assert.equal(report.summary.playableOperators, 0);
  assert.equal(report.fullRosterTarget.playableOperatorForms, 1);
  assert.equal(report.fullRosterTarget.remainingOperatorForms, 1);
  assert.equal(report.fullRosterTarget.remainingOutsideGlobalSnapshot, 1);
  assert.deepEqual(report.fullRosterTarget.missingForms, [missing]);
});
test('mixed-channel ids, missing ranks and missing ranges cannot silently prepare a candidate', () => {
  const id = 'char_4227_gallus', op = cn.tables.characters[id];
  const args = { roster: { operators: [{ id, skills: [] }] }, globalCharacters: {}, characters: { [id]: op },
    patchCharacters: {}, skills: {}, ranges: cn.tables.ranges, source: {}, globalSource: {} };
  const candidate = prepareCNSource(args); assert.equal(candidate.summary.operatorForms, 1);
  assert.equal(prepareCNSource({ ...args, globalCharacters: { [id]: op } }).summary.operatorForms, 0);
  assert.throws(() => prepareCNSource({ ...args, characters: {} }), /differs from.*roster/);
  assert.throws(() => prepareCNSource({ ...args, characters: { [id]: { ...op, isNotObtainable: true } } }), /differs from.*roster/);
  assert.throws(() => prepareCNSource({ ...args, ranges: {} }), /Missing CN range/);
  const skillId = 'skchr_wintim_1', withSkill = { ...op, skills: [{ skillId }] };
  assert.throws(() => prepareCNSource({ ...args, characters: { [id]: withSkill } }), /differs from.*roster/);
  assert.throws(() => prepareCNSource({ ...args, roster: { operators: [{ id, skills: [skillId] }] }, characters: { [id]: withSkill } }), /Missing CN skill/);
  assert.throws(() => prepareCNSource({ ...args, roster: { operators: [{ id, skills: [skillId] }] },
    characters: { [id]: withSkill }, skills: { [skillId]: { levels: [] } } }), /Incomplete CN skill ranks/);
  // Known Git object vector verifies byte-header hashing rather than ordinary SHA-1.
  assert.equal(gitBlob(Buffer.from('hello\n')), 'ce013625030ba8dba906f756967f9e9ca394464a');
});
