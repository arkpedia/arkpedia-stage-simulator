// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('../data/arkpedia-deployable-tokens.json', import.meta.url)));

test('deployable tokens carry upstream stats and skills', () => {
  assert.equal(data.schema_version, 1);
  const road = data.tokens.trap_001_crate;
  assert.equal(road.name, 'Roadblock');
  assert.equal(road.position, 'NONE');
  assert.equal(road.phases[0].levels[0].maxHp, 100);
  assert.equal(road.phases[0].levels[0].block, 3);
  assert.equal(road.phases[0].levels[0].cost, 5);
  assert.equal(road.skills[0].name, 'Obstruct');
  assert.match(road.skills[0].description, /Deploy a Roadblock/);
});

test('the token table covers every token offered by a stage', () => {
  for (const [id, token] of Object.entries(data.tokens)) {
    assert.ok(token.name, `${id} has no name`);
    assert.ok(token.phases.length > 0, `${id} has no phase`);
    assert.ok(token.phases[0].levels.length > 0, `${id} has no stat level`);
  }
  assert.ok(Object.keys(data.tokens).length >= 100);
});
