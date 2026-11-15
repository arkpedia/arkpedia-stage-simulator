// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildStageRuleReceipt, createStageRuleImporter, writeStageRuleReceipt } from '../tools/arkpedia/stage-rule-receipt.mjs';
import { compileStageRules } from '../shared/arkpedia/stage-rules.js';
const commit = 'a'.repeat(40), stage = { id: 'main_99-01', slug: '99-1' };
function fixture(runes = null, options = { maxPlayTime: -1 }) {
  const bytes = Buffer.from(JSON.stringify({ mapData: {}, waves: [], options, runes }));
  const sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  return { stage, commit, tree: { truncated: false, tree: [{ type: 'blob', path: 'zh_CN/gamedata/levels/obt/main/level_main_99-01.json', sha }] },
    fetchImpl: async url => {
      assert.equal(url, `https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData/${commit}/zh_CN/gamedata/levels/obt/main/level_main_99-01.json`);
      return { ok: true, arrayBuffer: async () => bytes };
    } };
}
test('original level evidence is tied to immutable Git bytes and preserves an empty rule list', async () => {
  const input = fixture(), result = await buildStageRuleReceipt(input);
  assert.equal(result.status, 'ready'); assert.equal(result.receipt.runes, null);
  assert.deepEqual(result.receipt.options, { maxPlayTime: -1 });
  assert.equal(result.receipt.source.gitBlob, input.tree.tree[0].sha);
  assert.equal(result.receipt.source.commit, commit); assert.match(result.receipt.source.sha256, /^[a-f0-9]{64}$/);
});
test('older levels without an explicit timer retain that omission; invalid explicit timers are refused', async () => {
  const { receipt } = await buildStageRuleReceipt(fixture(null, {}));
  assert.equal(Object.hasOwn(receipt, 'options'), false);
  for (const maxPlayTime of [0, -2, null])
    await assert.rejects(buildStageRuleReceipt(fixture(null, { maxPlayTime })), /supported time limit/);
});
test('mismatched bytes, mutable pins, incomplete trees and ambiguous levels cannot create evidence', async () => {
  const input = fixture();
  await assert.rejects(buildStageRuleReceipt({ ...input, commit: 'master' }), /immutable/);
  await assert.rejects(buildStageRuleReceipt({ ...input, tree: { ...input.tree, truncated: true } }), /Incomplete/);
  await assert.rejects(buildStageRuleReceipt({ ...input, tree: { tree: [input.tree.tree[0], input.tree.tree[0]] } }), /found 2/);
  await assert.rejects(buildStageRuleReceipt({ ...input, fetchImpl: async () => ({ ok: true, arrayBuffer: async () => Buffer.from('{}') }) }), /Git blob/);
});
test('stage-table aliases resolve original filenames only from verified table bytes', async () => {
  const input = fixture(); input.stage = { id: 'wk_fixture', slug: 'fixture' };
  const stageTableBytes = Buffer.from(JSON.stringify({ stages: { wk_fixture: { levelId: 'Obt/Main/level_main_99-01' } } }));
  const sha = createHash('sha1').update(`blob ${stageTableBytes.length}\0`).update(stageTableBytes).digest('hex');
  input.tree.tree.push({ type: 'blob', path: 'zh_CN/gamedata/excel/stage_table.json', sha });
  await assert.rejects(buildStageRuleReceipt(input), /found 0/);
  const { receipt } = await buildStageRuleReceipt({ ...input, stageTableBytes });
  assert.equal(receipt.stageId, 'wk_fixture'); assert.equal(receipt.source.stageTable.gitBlob, sha);
  assert.equal(receipt.source.stageTable.levelId, 'Obt/Main/level_main_99-01');
  await assert.rejects(buildStageRuleReceipt({ ...input, stageTableBytes: Buffer.from('{}') }), /Stage table.*Git blob/);
});
test('unknown challenge rules are retained as blocked evidence, never treated as executable support', async () => {
  const input = fixture([{ difficultyMask: 'FOUR_STAR', key: 'unknown', professionMask: 1023, buildableMask: 'ALL', blackboard: [] }]);
  input.stage = { ...stage, id: stage.id + '#f#', variant: { kind: 'challenge_mode', of_stage_id: stage.id } };
  const result = await buildStageRuleReceipt(input);
  assert.equal(result.status, 'blocked'); assert.match(result.blocker, /Unsupported stage rune/);
  assert.equal(result.receipt.runes[0].key, 'unknown');
  assert.throws(() => compileStageRules(input.stage, result.receipt), /Unsupported stage rune/);
});
test('adverse environments resolve their own original level rather than their normal parent', async () => {
  const input = fixture([]), id = 'tough_99-01', path = 'zh_CN/gamedata/levels/obt/main/level_tough_99-01.json';
  input.stage = { id, slug: '99-1_adverse_environment', variant: { kind: 'adverse_environment',
    of_stage_id: stage.id, shares_parent_level_file: false } };
  const table = Buffer.from(JSON.stringify({ stages: { [stage.id]: { levelId: 'Obt/Main/level_main_99-01' },
    [id]: { levelId: 'Obt/Main/level_tough_99-01' } } }));
  const sha = createHash('sha1').update(`blob ${table.length}\0`).update(table).digest('hex');
  input.tree.tree.push({ ...input.tree.tree[0], path }, { type: 'blob', path: 'zh_CN/gamedata/excel/stage_table.json', sha });
  const fetchImpl = async url => {
    assert.ok(url.endsWith('/level_tough_99-01.json'));
    return input.fetchImpl(url.replace('level_tough_', 'level_main_'));
  };
  const { receipt, status } = await buildStageRuleReceipt({ ...input, stageTableBytes: table, fetchImpl });
  assert.equal(status, 'ready'); assert.equal(receipt.parentStageId, stage.id); assert.equal(receipt.source.path, path);
  assert.equal(receipt.source.stageTable.stageId, id);
  const parent = structuredClone(receipt); parent.source.stageTable.stageId = stage.id;
  assert.throws(() => compileStageRules(input.stage, parent), /incompatible/);
  const standalone = { ...input.stage, variant: { ...input.stage.variant, of_stage_id: null } };
  assert.doesNotThrow(() => compileStageRules(standalone, { ...receipt, parentStageId: null }));
  const runes = [{ difficultyMask: 'FOUR_STAR', key: 'enemy_attribute_mul', professionMask: 1023,
    buildableMask: 'ALL', blackboard: [{ key: 'atk', value: 1.2 }] }];
  assert.equal(compileStageRules(input.stage, { ...receipt, runes }).enemies.atk, 1.2,
    'chapter 10/11 adverse levels retain their original FOUR_STAR rules');
});

test('mode-only level paths resolve exactly in the pinned tree without a stage-table alias', async () => {
  const input = fixture();
  const mode = { id: 'obt/main/level_main_99-01', slug: 'mode-fixture' };
  const result = await buildStageRuleReceipt({ ...input, stage: mode, stageTableBytes: Buffer.from('{}') });
  assert.equal(result.receipt.stageId, mode.id);
  assert.equal(result.receipt.source.stageTable, undefined);
  for (const id of ['../level_main_99-01', '/obt/main/level_main_99-01', 'obt//main/level_main_99-01'])
    await assert.rejects(buildStageRuleReceipt({ ...input, stage: { ...mode, id } }), /Unsupported original level identity/);
  await assert.rejects(buildStageRuleReceipt({ ...input, stage: { ...mode, id: 'other/level_main_99-01' } }), /found 0/);
});
test('receipt installation is append-only and does not publish a stage', async t => {
  const root = await mkdtemp(join(tmpdir(), 'stage-rule-evidence-')); t.after(() => rm(root, { recursive: true, force: true }));
  const { receipt } = await buildStageRuleReceipt(fixture());
  const path = await writeStageRuleReceipt(root, stage.slug, receipt), before = await readFile(path, 'utf8');
  await assert.rejects(writeStageRuleReceipt(root, stage.slug, { changed: true }), { code: 'EEXIST' });
  assert.equal(await readFile(path, 'utf8'), before);
  await assert.rejects(readFile(join(root, 'data/arkpedia-stages.json')), { code: 'ENOENT' });
});

test('a batch importer shares verified downloads and rejects a corrupt cached level on resume', async t => {
  const root = await mkdtemp(join(tmpdir(), 'stage-rule-cache-')); t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'data'));
  await writeFile(join(root, 'data/arkpedia-mvp.json'), JSON.stringify({ sources: { 'Kengxxiao/ArknightsGameData': commit } }));
  const input = fixture();
  const table = Buffer.from(JSON.stringify({ stages: { [stage.id]: { levelId: 'Obt/Main/level_main_99-01' } } }));
  const sha = createHash('sha1').update(`blob ${table.length}\0`).update(table).digest('hex');
  input.tree.tree.push({ type: 'blob', path: 'zh_CN/gamedata/excel/stage_table.json', sha });
  let downloads = 0;
  const importer = await createStageRuleImporter({ root, fetchImpl: async url => {
    if (url.includes('/git/trees/')) return { ok: true, json: async () => input.tree };
    if (url.endsWith('/stage_table.json')) return { ok: true, arrayBuffer: async () => table };
    downloads++; return input.fetchImpl(url);
  } });
  const variant = { ...stage, id: stage.id + '#f#', variant: { kind: 'challenge_mode', of_stage_id: stage.id } };
  const [normal, challenge] = await Promise.all([importer(stage), importer(variant)]);
  assert.equal(downloads, 1);
  assert.equal(normal.receipt.source.gitBlob, challenge.receipt.source.gitBlob);
  assert.equal(challenge.status, 'blocked', 'an empty challenge rule list is not evidence of support');
  const resume = await createStageRuleImporter({ root, fetchImpl: () => { throw Error('must use verified cache'); } });
  assert.deepEqual((await resume(stage)).receipt, normal.receipt);
  await writeFile(join(root, '.cache/arkpedia/original-level-blobs', `${input.tree.tree[0].sha}.json`), '{}');
  await assert.rejects(resume(stage), /checksum mismatch/);
});
