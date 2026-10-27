// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { parseSkel } from '../assets/skel.mjs';
import { writeJSONAtomic } from './write-json.mjs';
const root = new URL('../../', import.meta.url), sources = {}, sha = b => createHash('sha256').update(b).digest('hex');
async function read(path, pin) { const raw = await readFile(new URL(path, root)); if (pin) assert.equal(sha(raw), pin); sources[path] = { path, sha256: sha(raw) }; return JSON.parse(raw); }
const review = await read('data/candidates/arkpedia-ch16-reviewed-artillery.json'), graph = await read(review.sources.graph.path, review.sources.graph.sha256);
await read(review.sources.indexed.path, review.sources.indexed.sha256);
const animation = await read('data/candidates/arkpedia-ch16-artillery-animation-source.json');
assert.equal(animation.source.graph.sha256, review.sources.graph.sha256);
await read(animation.source.inventory.path, animation.source.inventory.sha256);
const enemies = {};
for (const id of Object.keys(review.enemies)) {
  const rows = graph.prefabs[`dyn/battle/prefabs/enemies/${id}.prefab`];
  for (const r of rows) assert.equal(sha(r.originalJson), r.sha256);
  const nodes = rows.map(r => ({ ...r, data: JSON.parse(r.originalJson) })), modes = nodes.filter(r => r.data._attack && r.data._combat);
  assert.equal(modes.length, 1); const mode = modes[0];
  assert.equal(mode.data._attack.m_FileID, 0); assert.deepEqual(mode.data._attack, mode.data._combat);
  const cast = nodes.find(r => r.pathId === mode.data._attack.m_PathID), n = cast.data;
  for (const [key, value] of Object.entries({ _animKey: 'Attack', _timeMode: 0, _affectedBySlowDown: 1, _maxAnimScale: 1,
    _selectTargetSource: 2, _selectTargetTiming: 0, _waitForAttackEvent: 1, _useCachedAtkOnly: 0,
    _projectileKey: 'projectile_enemy_uacann' })) assert.equal(n[key], value, key);
  const row = animation.enemies[id], raw = Buffer.from(row.base64, 'base64');
  assert.equal(raw.length, row.bytes); assert.equal(sha(raw), row.sha256); assert.equal(sha(row.skeletonDataOriginalJson), row.skeletonDataSha256);
  assert.equal(row.prefabBinding.m_PathID, row.skeletonDataPathId);
  const d = parseSkel(raw, undefined, { includeExactDurations: true, includeEventPayloads: true });
  assert.equal(d.eventPayloads.Attack.length, 1); assert.equal(d.eventPayloads.Attack[0].name, 'OnAttack');
  enemies[id] = { modePathId: mode.pathId, castPathId: cast.pathId, originalJson: cast.originalJson,
    hit: d.eventPayloads.Attack[0].time, duration: d.exactDurations.Attack };
}
const result = { schemaVersion: 1, testOnly: true, frameParity: false, sources, enemies,
  limits: ['The same native component owns Attack and Combat; one shared cooldown is retained. TimeMode0 samples BAT/interval capped at one, and eligible elapsed cast/cooldown work consumes live slow_down. Target deployment is captured at input. Born shells/fields keep separate world clocks and source lives. Initial native FSM/compiled frame parity remains held.'] };
const out = new URL('data/candidates/arkpedia-ch16-artillery-clock-contract.json', root);
if (process.argv.includes('--check')) assert.deepEqual(JSON.parse(await readFile(out, 'utf8')), result); else await writeJSONAtomic(out, result);
console.log('Verified both artillery Attack/Combat bindings and original OnAttack clocks');
