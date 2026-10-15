// SPDX-License-Identifier: GPL-3.0-or-later
// Structural source-index contract; raw Unity proof is verified independently.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import source from '../data/arkpedia-cn-native-source.json' with { type: 'json' };
import index from '../data/arkpedia-cn-native-index.json' with { type: 'json' };
test('native root index binds its exact input receipt and every owner without approving a kit', async () => {
  const bytes = await readFile(new URL('../data/arkpedia-cn-native-source.json', import.meta.url));
  assert.equal(index.source.receiptSha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(index.source.commit, source.source.commit); assert.equal(index.source.resourceVersion, source.source.resourceVersion);
  assert.deepEqual(Object.keys(index.operators).sort(), Object.keys(source.operators).sort());
  assert.deepEqual(index.enabledOperators, []); assert.deepEqual(index.missingBindings, []); assert.deepEqual(index.ambiguousBindings, []);
  for (const flag of ['graphClosureVerified', 'animationBindingsVerified', 'frameParity', 'moduleSupport', 'nativeParticleSupport'])
    assert.equal(index[flag], false);
  assert.deepEqual(index.summary, { operators: 55, ownerRoots: 55, defaultArtworkRoots: 55,
    selectedSkills: 128, boundSkillPrefabs: 127, ownerModeSkills: 1, missingBindings: 0, ambiguousBindings: 0 });
});
test('original root/component pointers remain decimal strings rather than rounded JavaScript numbers', () => {
  let unsafeInNumber = 0;
  const pointer = p => { assert.equal(typeof p, 'string'); assert.match(p, /^-?[0-9]+$/);
    if (BigInt(p) > BigInt(Number.MAX_SAFE_INTEGER) || BigInt(p) < -BigInt(Number.MAX_SAFE_INTEGER)) unsafeInNumber++; };
  for (const [id, row] of Object.entries(index.operators)) {
    assert.equal(row.owner.bundle, `charpack/${id}.ab`); assert.equal(row.defaultArtwork.bundle, `chararts/${id}.ab`);
    const roots = [row.owner, row.defaultArtwork, ...row.skills.flatMap(s => s.bindings)];
    for (const root of roots) { assert.equal(root.type, 'GameObject'); pointer(root.pathId);
      for (const c of root.components) { assert.ok(Number.isSafeInteger(c.fileId)); pointer(c.pathId); } }
  }
  assert.ok(unsafeInNumber > 200);
});
test('every source skill retains its explicit native-prefab selection, including Jacinta null', () => {
  for (const [id, row] of Object.entries(index.operators)) {
    assert.deepEqual(row.skills.map(s => [s.id, s.prefabId]), source.operators[id].skills.flatMap(s => s.prefabIds.map(p => [s.id, p])));
    for (const s of row.skills) {
      if (s.prefabId === null) { assert.deepEqual(s.bindings, []); continue; }
      assert.equal(s.bindings.length, 1); assert.ok(s.bindings[0].container.endsWith('/' + s.prefabId + '.prefab'));
    }
  }
  assert.deepEqual(index.ownerModeSkills, [{ owner: 'char_4237_jcinta', skill: 'skcom_assist_cost[3]' }]);
});
