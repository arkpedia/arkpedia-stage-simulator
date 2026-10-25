// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { verifiedChapter16FamilyGraph } from '../tools/arkpedia/enemy-support.mjs';
const bytes = path => readFileSync(new URL('../data/' + path, import.meta.url));
const inventory = bytes('arkpedia-cn-native-source.json'), enemies = bytes('arkpedia-cn-enemy-native-source.json');
const index = JSON.parse(bytes('arkpedia-enemy-clock-source.json'));
const verify = graph => verifiedChapter16FamilyGraph(JSON.stringify(graph), inventory, enemies, index);
for (const family of ['crossbow', 'commander', 'artillery']) {
  const graph = JSON.parse(bytes(`candidates/arkpedia-ch16-${family}-source.json`));
  test(`${family} complete graph matches the pinned inventory, timing components and action closure`, () => {
    assert.doesNotThrow(() => verify(graph));
  });
  test(`${family} refuses inventory drift and a self-rehashed changed indexed component`, () => {
    const drift = structuredClone(graph); drift.source.enemyInventory.sha256 = 'changed';
    assert.throws(() => verify(drift), /inventories disagree/);
    const changed = structuredClone(graph), [path, rows] = Object.entries(changed.prefabs)[0];
    const clock = index.prefabs[path].clockComponents[0], row = rows.find(r => r.pathId === clock.pathId);
    row.originalJson += ' '; row.sha256 = createHash('sha256').update(row.originalJson).digest('hex');
    assert.throws(() => verify(changed), /differs from indexed component/);
  });
}
test('artillery action closure requires the separate lingering projectile', () => {
  const original = JSON.parse(bytes('candidates/arkpedia-ch16-artillery-source.json'));
  const graph = structuredClone(original);
  delete graph.projectiles[Object.keys(graph.projectiles).find(p => p.endsWith('_range.prefab'))];
  assert.throws(() => verify(graph), /projectile closure incomplete/);
  const template = structuredClone(original);
  delete template.templates['uacann_ma[range_damage]'];
  assert.throws(() => verify(template), /template closure incomplete/);
});
