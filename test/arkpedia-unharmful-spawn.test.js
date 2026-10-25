// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stageAdapter } from '../server/sim/arkpedia.js';
import { makeBattle } from './helpers/battleHarness.js';
const read = p => JSON.parse(readFileSync(new URL('../data/' + p, import.meta.url)));
const stage = read('arkpedia-stage-16-6.json');
const miner = 'enemy_3010_mcreep';

test('the adapter carries explicit per-action harmless flags and rejects malformed values', () => {
  const input = structuredClone(stage), entry = input.geometry.waves[0].spawns.find(s => s.enemy_id === miner);
  assert.ok(entry); entry.unharmful = true;
  const adapted = stageAdapter(input).spawns.filter(s => s.enemyKey === miner);
  assert.equal(adapted[0].holdsBattle, false);
  delete entry.unharmful;
  assert.notEqual(stageAdapter(input).spawns.filter(s => s.enemyKey === miner)[0].holdsBattle, false);
  entry.unharmful = 1; assert.throws(() => stageAdapter(input), /Invalid canonical unharmful spawn flag/);
});
test('the scheduled receipt crosses the queue into one life; the same enemy spawned normally still holds battle', () => {
  const def = stage.enemies[miner], h = makeBattle({ content: 'none', autoFinish: true,
    defs: { enemies: { [miner]: def } } });
  h.b._queueSpawn({ time: 0, enemyKey: miner, holdsBattle: false }, true);
  h.b.start(); h.run(.04); const child = h.b.enemies.find(e => e.defId === miner);
  assert.ok(child?.alive); assert.equal(child.holdsBattle, false); assert.equal(child.counted, false);
  assert.equal(h.b.result().reason, 'cleared'); assert.equal(h.b.total, 0);
  const other = makeBattle({ content: 'none', autoFinish: true, defs: { enemies: { [miner]: def } } });
  other.b._queueSpawn({ time: 0, enemyKey: miner }, true); other.b.start(); other.run(.04);
  const ordinary = other.b.enemies.find(e => e.defId === miner);
  assert.notEqual(ordinary.holdsBattle, false); assert.equal(other.b.finished, false);
  assert.deepEqual(h.b.errors, []); assert.deepEqual(other.b.errors, []);
});

for (const code of ['16-2', '16-3', '16-4', '16-5', '16-6', '16-7', '16-8', '17-2', '17-3', '17-4'])
  test(`${code} exported scheduled harmless flags equal the complete canonical native actions`, () => {
    const source = read('candidates/arkpedia-stage-' + code + '-source.json'), built = read('arkpedia-stage-' + code + '.json');
    const marked = source.rawLevel.waves.flatMap(w => w.fragments.flatMap(f => f.actions))
      .filter(a => a.actionType === 'SPAWN' && !a.hiddenGroup && a.isUnharmfulAndAlwaysCountAsKilled);
    const expected = marked.reduce((n, a) => n + (a.count || 1), 0);
    const exported = built.geometry.waves.flatMap(w => w.spawns).filter(s => s.unharmful);
    assert.equal(exported.reduce((n, s) => n + s.count, 0), expected);
    assert.equal(stageAdapter(built).spawns.filter(s => s.holdsBattle === false).length, expected);
    assert.equal(built.chapter16Source.canonicalData.commit, '245d7c601ce3a4a42adcfb84faa1bd1123d507bb');
  });
