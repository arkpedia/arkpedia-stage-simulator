// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import support from '../data/arkpedia-enemy-support.json' with { type: 'json' };
import index from '../data/arkpedia-stages.json' with { type: 'json' };
import inventory from '../data/arkpedia-content-inventory.json' with { type: 'json' };
import { remainingMarkdown, operatorInventory, digest } from '../tools/arkpedia/content-inventory.mjs';
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import roster from '../data/arkpedia-roster-target.json' with { type: 'json' };

test('remaining work is generated from the detailed inventory and current registries', () => {
  assert.equal(readFileSync(new URL('../docs/REMAINING.md', import.meta.url), 'utf8'), remainingMarkdown(inventory));
  assert.deepEqual(inventory.summary.enemies, support.summary);
  assert.deepEqual(inventory.operators, operatorInventory({ mvp, roster }));
  assert.equal(inventory.summary.stages.catalogue, index.stages.length);
  assert.equal(inventory.summary.stages.testOnly, index.stages.filter(stage => stage.testOnly).length);
  assert.equal(inventory.summary.stages.public, index.stages.filter(stage => !stage.testOnly).length);
  assert.equal(inventory.sources.enemyRecords.nativeAbilities.sha256,
    digest(readFileSync(new URL('../data/arkpedia-enemy-native-abilities.json', import.meta.url))));
  assert.equal(Object.values(inventory.summary.byMode).reduce((sum, mode) => sum + mode.total, 0), inventory.summary.stages.total);
});
