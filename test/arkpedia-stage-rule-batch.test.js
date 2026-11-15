// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importStageRules } from '../tools/arkpedia/stage-rule-batch.mjs';
import { loadStageRuleReceipt } from '../tools/arkpedia/stage-rule-storage.mjs';
import { compileStageRules } from '../shared/arkpedia/stage-rules.js';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'rule-batch-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'source'); await mkdir(join(source, 'stages'), { recursive: true });
  const stages = [
    { id: 'main_fixture', slug: 'normal', battle: {} },
    { id: 'main_fixture#f#', slug: 'challenge', battle: {}, variant: { kind: 'challenge_mode', of_stage_id: 'main_fixture' } },
    { id: 'broken', slug: 'broken', battle: {} },
    { id: 'story', slug: 'story' },
  ];
  for (const stage of stages) await writeFile(join(source, 'stages', `${stage.slug}.json`), JSON.stringify(stage));
  const runes = [{ key: 'unknown_rule', difficultyMask: 'FOUR_STAR', professionMask: 1023, buildableMask: 'ALL', blackboard: [] }];
  const importer = async stage => {
    if (stage.slug === 'broken') throw Error('fixture download failed');
    const receipt = { schemaVersion: 1, stageId: stage.id,
      ...(stage.variant ? { parentStageId: stage.variant.of_stage_id } : {}),
      source: { repository: 'fixture', commit: 'a'.repeat(40), path: 'same-level.json', sha256: 'b'.repeat(64) }, runes };
    let blocker;
    try { compileStageRules(stage, receipt); } catch (error) { blocker = error.message; }
    return { receipt, status: blocker ? 'blocked' : 'ready', blocker };
  };
  return { root, source, ids: stages.map(s => s.slug), importer, stages };
}

test('batch preview performs no downloads or writes', async t => {
  const input = await fixture(t);
  const result = await importStageRules({ ...input, importer: () => { throw Error('must not download'); } });
  assert.deepEqual(result.counts, { pending: 3, 'non-combat': 1 });
  await assert.rejects(readdir(join(input.root, 'data')), { code: 'ENOENT' });
});

test('batch imports are independently atomic, resumable, deduplicated and fail closed for unknown rules', async t => {
  const input = await fixture(t), progress = [];
  const result = await importStageRules({ ...input, ids: [...input.ids, 'normal'], apply: true, onProgress: p => progress.push(p) });
  assert.deepEqual(result.counts, { imported: 2, failed: 1, 'non-combat': 1 });
  assert.equal(progress.length, 4);
  assert.equal(result.results.find(r => r.id === 'normal').rules, 'ready');
  assert.equal(result.results.find(r => r.id === 'challenge').rules, 'blocked');
  const { receipt } = await loadStageRuleReceipt(input.root, 'challenge');
  assert.throws(() => compileStageRules(input.stages[1], receipt), /Unsupported stage rune/);
  assert.equal((await readdir(join(input.root, 'data/stage-rules/levels'))).length, 1);
  await assert.rejects(readFile(join(input.root, 'data/arkpedia-stages.json')), { code: 'ENOENT' });
  const again = await importStageRules({ ...input, apply: true, importer: () => { throw Error('no existing receipt may be replaced'); } });
  assert.deepEqual(again.counts, { existing: 2, failed: 1, 'non-combat': 1 });
  const binding = JSON.parse(await readFile(join(input.root, 'data/stage-rules/normal.json')));
  await writeFile(join(input.root, 'data/stage-rules', binding.level.path), '{}');
  const corrupt = await importStageRules({ ...input, ids: ['normal'], apply: true });
  assert.match(corrupt.results[0].error, /checksum mismatch/);
});
test('concurrent evidence refresh serializes guarded publication and preserves shared old evidence', async t => {
  const input = await fixture(t), ids = ['normal', 'challenge'];
  await importStageRules({ ...input, ids, apply: true });
  const result = await importStageRules({ ...input, ids, apply: true, refresh: true, concurrency: 2,
    importer: async stage => { const result = await input.importer(stage); result.receipt.source.path = 'new-level.json'; return result; } });
  assert.deepEqual(result.counts, { refreshed: 2 });
  for (const id of ids) assert.equal((await loadStageRuleReceipt(input.root, id)).receipt.source.path, 'new-level.json');
  assert.equal((await readdir(join(input.root, 'data/stage-rules/levels'))).length, 2);
  await assert.rejects(readFile(join(input.root, 'data/.content-add.lock')), { code: 'ENOENT' });
});
