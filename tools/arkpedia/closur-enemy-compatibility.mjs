// SPDX-License-Identifier: GPL-3.0-or-later
// Verify the active regular-enemy boundary before Closure's public integration.
import { readFile, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { REGULAR_ENEMIES } from '../../shared/arkpedia/enemies.js';
import { writeJSONAtomic } from './write-json.mjs';
const root = new URL('../../', import.meta.url), cache = new URL('.cache/arkpedia/enemy_database.json', root);
const commit = '57010cb5b2afea112cae57daa756b58676ba6850';
const path = 'en_US/gamedata/levels/enemydata/enemy_database.json';
const blob = 'ff07c033f8808d01d60624864cfea972402f75c5';
const verifyTable = raw => assert.equal(createHash('sha1').update(Buffer.concat([
  Buffer.from(`blob ${raw.length}\0`), raw])).digest('hex'), blob);
let raw;
try { raw = await readFile(cache); }
catch (e) {
  if (e.code !== 'ENOENT' || !process.argv.includes('--fetch')) throw e;
  const response = await fetch(`https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData_YoStar/${commit}/${path}`,
    { signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw Error('Frozen enemy table unavailable: ' + response.status);
  raw = Buffer.from(await response.arrayBuffer()); verifyTable(raw);
  await mkdir(new URL('./', cache), { recursive: true });
  const temp = new URL(cache.href + '.partial-' + randomUUID());
  try { await writeFile(temp, raw); await rename(temp, cache); } finally { await rm(temp, { force: true }); }
}
verifyTable(raw); assert.equal(raw.length, 10273791);
const table = JSON.parse(raw), indexRaw = await readFile(new URL('data/arkpedia-enemy-clock-source.json', root));
const index = JSON.parse(indexRaw), enemies = {};
assert.equal(index.runtimeBindingsVerified, false); assert.deepEqual(index.enabledOperators, []);
for (const id of ['enemy_1002_nsabr', 'enemy_1007_slime']) {
  assert.equal(REGULAR_ENEMIES[id], 'basic-stats-and-attacks');
  const levels = table.enemies.find(r => r.Key === id)?.Value;
  assert.ok(levels?.length && levels.every(r => r.enemyData.skills == null
    || Array.isArray(r.enemyData.skills) && r.enemyData.skills.length === 0));
  const key = `dyn/battle/prefabs/enemies/${id}.prefab`, p = index.prefabs[key]; assert.ok(p);
  const wrappers = p.clockComponents.filter(c => '_familyMask' in c.fields && '_trigger' in c.fields);
  const active = p.clockComponents.flatMap(c => ['_commonAbilities', '_generalAbilities']
    .flatMap(k => (c.fields[k] ?? []).filter(ref => ref.m_FileID !== 0 || ref.m_PathID !== '0')));
  assert.equal(wrappers.length, 0); assert.equal(active.length, 0);
  enemies[id] = { policy: REGULAR_ENEMIES[id], prefab: key, bundle: p.bundle, rootPathId: p.rootPathId,
    hierarchySha256: p.hierarchySha256, tableLevels: levels.map(r => r.level),
    declaredSkills: 0, enemyAbilityWrappers: 0, activeGeneralOrCommonAbilities: 0 };
}
const result = { schemaVersion: 1, scope: 'Current regular-stage enemies have no declared native enemy skill clocks. This does not approve Closure or unadmitted enemy abilities.',
  enabledOperators: [], frameParity: false,
  policy: 'source-stat-only-enemies-no-skill-clocks-v1',
  source: { globalEnemyTable: { repository: 'Kengxxiao/ArknightsGameData_YoStar', commit, path, gitBlob: blob,
    bytes: raw.length, sha256: createHash('sha256').update(raw).digest('hex') },
    nativeTimingIndex: { path: 'data/arkpedia-enemy-clock-source.json', sha256: createHash('sha256').update(indexRaw).digest('hex') } }, enemies };
const output = new URL('data/arkpedia-closur-enemy-compatibility.json', root);
if (process.argv.includes('--check')) assert.deepEqual(JSON.parse(await readFile(output)), result);
else await writeJSONAtomic(output, result);
console.log('Verified current Closure S3 enemy clock boundary:', Object.keys(enemies).join(', '));
