// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { writeSharedStageRuleReceipt, loadStageRuleReceipt } from '../tools/arkpedia/stage-rule-storage.mjs';
import { writeStageRuleReceipt } from '../tools/arkpedia/stage-rule-receipt.mjs';
import normal from '../data/stage-rules/of-ex1.json' with { type: 'json' };
import challenge from '../data/stage-rules/of-ex1_challenge_mode.json' with { type: 'json' };

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'shared-stage-rules-'));
  t.after(() => rm(root, { recursive: true, force: true })); return root;
}
test('normal and challenge bindings reuse one immutable level and reconstruct their original receipts', async t => {
  const root = await fixture(t);
  await Promise.all([writeSharedStageRuleReceipt(root, 'normal', normal), writeSharedStageRuleReceipt(root, 'challenge', challenge)]);
  assert.equal((await readdir(join(root, 'data/stage-rules/levels'))).length, 1);
  for (const [id, expected] of [['normal', normal], ['challenge', challenge]]) {
    const loaded = await loadStageRuleReceipt(root, id);
    assert.deepEqual(loaded.receipt, expected); assert.equal(loaded.sources.length, 2);
    assert.match(loaded.sources[1].path, /levels\/[a-f0-9]{64}\.json$/);
  }
  await assert.rejects(writeSharedStageRuleReceipt(root, 'normal', normal), { code: 'EEXIST' });
  assert.deepEqual((await loadStageRuleReceipt(root, 'normal')).receipt, normal);
});
test('shared evidence and binding paths are verified before compilation', async t => {
  const root = await fixture(t); await writeSharedStageRuleReceipt(root, 'normal', normal);
  const loaded = await loadStageRuleReceipt(root, 'normal'), path = join(root, loaded.sources[1].path);
  const bytes = await readFile(path); await writeFile(path, '{}');
  await assert.rejects(loadStageRuleReceipt(root, 'normal'), /checksum mismatch/);
  await assert.rejects(writeSharedStageRuleReceipt(root, 'another', normal), /corruption/);
  await writeFile(path, bytes);
  const bindingPath = join(root, 'data/stage-rules/normal.json'), binding = JSON.parse(await readFile(bindingPath));
  binding.level.path = '../escape.json'; await writeFile(bindingPath, JSON.stringify(binding));
  await assert.rejects(loadStageRuleReceipt(root, 'normal'), /Invalid shared/);
});
test('inline receipts stay compatible and missing evidence stays explicit', async t => {
  const root = await fixture(t); await writeStageRuleReceipt(root, 'normal', normal);
  const loaded = await loadStageRuleReceipt(root, 'normal');
  assert.deepEqual(loaded.receipt, normal); assert.equal(loaded.sources.length, 1);
  assert.deepEqual(await loadStageRuleReceipt(root, 'missing'), { receipt: null, sources: [] });
});
test('explicit evidence refresh preserves immutable blobs and refuses stale bindings or active publishers', async t => {
  const root = await fixture(t); await writeSharedStageRuleReceipt(root, 'normal', normal);
  const old = await loadStageRuleReceipt(root, 'normal'), path = join(root, 'data/stage-rules/normal.json');
  const bytes = await readFile(path), replaceDigest = createHash('sha256').update(bytes).digest('hex');
  const next = structuredClone(normal); next.source.path = 'verified/new-level.json';
  const lock = join(root, 'data/.content-add.lock'); await writeFile(lock, '');
  await assert.rejects(writeSharedStageRuleReceipt(root, 'normal', next, { replaceDigest }), { code: 'EEXIST' });
  assert.deepEqual(await readFile(path), bytes); await rm(lock);
  await writeSharedStageRuleReceipt(root, 'normal', next, { replaceDigest });
  assert.deepEqual((await loadStageRuleReceipt(root, 'normal')).receipt, next);
  assert.equal((await readdir(join(root, 'data/stage-rules/levels'))).length, 2);
  assert.ok(await readFile(join(root, old.sources[1].path)));
  await assert.rejects(writeSharedStageRuleReceipt(root, 'normal', normal, { replaceDigest }), /binding changed/);
  assert.deepEqual((await loadStageRuleReceipt(root, 'normal')).receipt, next);
  await assert.rejects(readFile(lock), { code: 'ENOENT' });
});
