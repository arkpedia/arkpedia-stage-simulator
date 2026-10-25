// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { deriveEnemySupport, prefabPath } from '../shared/arkpedia/enemy-support.js';
import { verifiedNative, verifiedChapter16FamilyGraph } from '../tools/arkpedia/enemy-support.mjs';
import { installFeatureDispatch } from '../server/sim/content/enemies.js';
import { installEnemyFeatures } from '../server/sim/content/arkpedia-enemy-features.js';
import { makeBattle, chessRec } from './helpers/battleHarness.js';
const bytes = p => readFileSync(new URL('../data/' + p, import.meta.url));
const read = p => JSON.parse(bytes(p));
const hash = b => createHash('sha256').update(b).digest('hex');
const records = read('candidates/arkpedia-enemy-records.canonical.json').enemies;
const key = 'enemy_10120_uaghst_2', miner = 'enemy_3010_mcreep';
const review = read('candidates/arkpedia-ch16-reviewed-phantom.json');
const index = read('arkpedia-enemy-clock-source.json');

test('Phantom source registration rejects changed native and record claims', () => {
  for (const file of Object.values(review.sources))
    assert.equal(hash(readFileSync(new URL('../' + file.path, import.meta.url))), file.sha256);
  const native = read('candidates/arkpedia-ch16-phantom-native.json');
  verifiedNative(native, index.prefabs, hash(bytes('arkpedia-enemy-clock-source.json')), read('arkpedia-mvp.json').behaviors.source);
  verifiedChapter16FamilyGraph(bytes('candidates/arkpedia-ch16-phantom-source.json'), bytes('arkpedia-cn-native-source.json'), bytes('arkpedia-cn-enemy-native-source.json'), index);
  const evidence = { ...native, chapter16Families: { phantom: { graphSha256: review.sources.graph.sha256 } } };
  const entries = { [key]: records[key] };
  assert.equal(deriveEnemySupport(entries, index.prefabs, evidence)[key].policy, 'stats-attacks-and-features');
  assert.equal(deriveEnemySupport(entries, index.prefabs, native)[key].policy, null);
  for (const mutate of [n => { n.chapter16Families.phantom.graphSha256 = 'changed'; }, n => { n.prefabs[prefabPath(key)][0].originalJson += ' '; }]) {
    const changed = structuredClone(evidence); mutate(changed);
    assert.equal(deriveEnemySupport(entries, index.prefabs, changed)[key].policy, null);
  }
  for (const mutate of [r => { r.talents.bb['BlockMcreep.block_mcreep_cnt']++; }, r => { r.abilities[0].text += ' changed'; }]) {
    const changed = structuredClone(entries); mutate(changed[key].levels[0]);
    assert.equal(deriveEnemySupport(changed, index.prefabs, evidence)[key].policy, null);
  }
});

test('automatic Phantom dispatch keeps one controller and independent movement and weapon targets', () => {
  const h = makeBattle({ content: 'generic', autoFinish: false,
    setup: b => { installFeatureDispatch(b); installEnemyFeatures(b); },
    defs: { enemies: { [key]: records[key].levels[0], [miner]: records[miner].levels[0] },
      chess: { dummy: chessRec({ id: 'dummy', stats: { maxHp: 1e6, atk: 0 } }) } },
    units: [{ chessId: 'dummy', row: 10, col: 7 }] });
  h.b.start();
  const spawn = (id, x) => {
    const e = h.spawn(id, { pos: [10, x] });
    e.base.moveSpeed = 0; e.atkCd = 1e6; e.markDirty(); return e;
  };
  const e = spawn(key, 7), nearest = spawn(miner, 7.6), latest = spawn(miner, 7.9);
  assert.equal(e.mem.ab.list.length, 1);
  const ability = e.mem.ab.list[0], operator = h.unit('dummy'), operatorHp = operator.hp;
  assert.ok(e.s.flags.unblockable); assert.ok(e.findBuff('enemy_field_army_self_mark'));
  h.run(.61);
  assert.equal(ability.engagements.size, 1); assert.equal(ability.engagement.target, nearest);
  assert.equal(e.profile.meleeTarget(), latest);
  const hp = latest.hp, nearHp = nearest.hp; e.atkCd = 0; h.run(.04);
  assert.equal(hp - latest.hp, 250); assert.equal(nearest.hp, nearHp); assert.equal(operator.hp, operatorHp);
  h.b.kill(e, null);
  assert.equal(ability.engagements.size, 0); assert.equal(nearest.mem.ch16Engagement, undefined);
  assert.deepEqual(h.b.errors, []);
});
