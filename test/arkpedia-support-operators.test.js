// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import support from '../data/arkpedia-support-operators.json' with { type: 'json' };
import stage from '../data/arkpedia-stage-15-19.json' with { type: 'json' };
import mvp from '../data/arkpedia-mvp.json' with { type: 'json' };
import { fixedSquadBuilds, defaultBuild, recordFor } from '../shared/arkpedia/loadout.js';
import { StandardBattle } from '../server/sim/arkpedia.js';

const data = { ...mvp, stage, operators: { ...mvp.operators, ...support.operators }, enemies: { ...mvp.enemies, ...stage.enemies } };

test('the five support-only operators carry upstream stats and skills', () => {
  for (const id of ['char_508_aguard', 'char_509_acast', 'char_510_amedic', 'char_511_asnipe', 'char_614_acsupo']) {
    const op = support.operators[id];
    assert.equal(op.supportOnly, true);
    assert.ok(op.phases[0].levels ? true : op.phases[0].attributesKeyFrames?.length, `${id} has no stats`);
    assert.ok(op.skills[0].levels.length > 0, `${id} has no skill levels`);
  }
});

test('15-19 builds its six-operator fixed squad', () => {
  const builds = fixedSquadBuilds(data);
  assert.equal(builds.length, 6);
  assert.deepEqual(builds.map(b => b.id), stage.fixedSquad.map(s => s.unit_id));
  assert.equal(recordFor(builds[0], data).name, 'Sharp');
  assert.doesNotThrow(() => new StandardBattle(data, { operators: builds }));
});
