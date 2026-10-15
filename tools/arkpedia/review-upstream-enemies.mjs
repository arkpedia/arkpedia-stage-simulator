// SPDX-License-Identifier: GPL-3.0-or-later
// Reproducible primary-source boundary for selective Stronghold enemy reuse.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { writeJSONAtomic } from './write-json.mjs';
const root = new URL('../../', import.meta.url), cache = new URL('.cache/arkpedia/enemy_database.json', root);
const repository = 'Kengxxiao/ArknightsGameData_YoStar', commit = '57010cb5b2afea112cae57daa756b58676ba6850';
const path = 'en_US/gamedata/levels/enemydata/enemy_database.json', gitBlob = 'ff07c033f8808d01d60624864cfea972402f75c5';
const sha = raw => createHash('sha256').update(raw).digest('hex');
const verify = raw => { assert.equal(raw.length, 10273791); assert.equal(createHash('sha1').update(Buffer.concat([
  Buffer.from(`blob ${raw.length}\0`), raw])).digest('hex'), gitBlob); };
let raw;
try { raw = await readFile(cache); } catch (e) {
  if (e.code !== 'ENOENT' || !process.argv.includes('--fetch')) throw e;
  const response = await fetch(`https://raw.githubusercontent.com/${repository}/${commit}/${path}`, { signal: AbortSignal.timeout(45000) });
  assert.ok(response.ok, 'Frozen original enemy table unavailable'); raw = Buffer.from(await response.arrayBuffer()); verify(raw);
  await mkdir(new URL('./', cache), { recursive: true }); await writeFile(cache, raw, { flag: 'wx' });
}
verify(raw);
const id = 'enemy_1026_aghost', levels = JSON.parse(raw).enemies.find(r => r.Key === id)?.Value;
assert.equal(levels.length, 1); assert.equal(levels[0].level, 0);
const data = levels[0].enemyData;
assert.match(data.description.m_value, /cannot be blocked/); assert.equal(data.skills, null); assert.equal(data.talentBlackboard, null);
assert.equal(data.spData, null); assert.equal(data.applyWay.m_value, 'NONE'); assert.equal(data.motion.m_value, 'WALK');
const a = data.attributes, value = key => { assert.equal(a[key].m_defined, true); return a[key].m_value; };
const stats = { maxHp: value('maxHp'), atk: value('atk'), def: value('def'), res: value('magicResistance'),
  aspd: value('attackSpeed'), bat: value('baseAttackTime'), moveSpeed: value('moveSpeed'),
  hpRecoveryPerSec: value('hpRecoveryPerSec'), massLevel: value('massLevel'), lpr: data.lifePointReduce.m_value,
  applyWay: data.applyWay.m_value, motion: data.motion.m_value, dmgType: 'none', rangeRadius: 0 };
const indexPath = 'data/arkpedia-enemy-clock-source.json', indexRaw = await readFile(new URL(indexPath, root)), index = JSON.parse(indexRaw);
assert.equal(index.compiledDispatchVerified, false); assert.equal(index.frameParity, false);
const prefabKey = `dyn/battle/prefabs/enemies/${id}.prefab`, prefab = index.prefabs[prefabKey];
assert.equal(prefab.hierarchySha256, 'ff0a8f123498754a55dcc93c89279c89eb1aa41470f8f6eb3902e05b4032391c');
assert.equal(prefab.rootPathId, '8419201075955883274');
assert.equal(prefab.clockComponents.length, 2);
for (const component of prefab.clockComponents) {
  for (const key of ['_commonAbilities', '_generalAbilities']) assert.deepEqual(component.fields[key] ?? [], []);
  for (const key of ['_combat', '_attack', '_attackTrigger']) if (component.fields[key]) assert.equal(component.fields[key].m_PathID, '0');
}
const receipt = { schemaVersion: 1, scope: 'Held selective upstream ability reuse; no public enemy/stage admission',
  enabledEnemies: [], compiledDispatchVerified: false, frameParity: false, nativeArtworkVerified: false,
  source: { repository, commit, path, gitBlob, bytes: raw.length, sha256: sha(raw) },
  nativeIndex: { path: indexPath, sha256: sha(indexRaw) },
  upstream: { repository: 'sganggs/Stronghold-Protocol', inheritedCommit: '19a89085a4c9a773a7b88437d7cd79c3e7131cfd',
    comparedCommit: '488db49f11daf862b67ce26fa4cf89aa6cba2466', license: 'GPL-3.0-or-later',
    inheritedPath: 'server/sim/content/enemies.js', currentPaths: ['server/sim/content/enemies/archetypes.js', 'server/sim/content/enemies/special.js'],
    reused: 'KITS[enemy_1026_aghost] and its permanent unblockable spawn buff; shared enemy dispatch hooks' },
  enemies: { [id]: { level: 0, name: data.name.m_value, description: data.description.m_value, stats,
    skills: [], talent: {}, rule: 'permanent-unblockable', prefabKey, prefab } },
  limits: ['The primary table states cannot be blocked. This maps to the existing simulator unblockable flag.',
    'The native timing index identifies the original prefab and no active ability clocks; it does not recover compiled class dispatch.',
    'No stealth restoration, enemy skills, bosses, mode-specific domains, artwork or new public stage is approved.'] };
const output = new URL('data/arkpedia-upstream-enemy-review.json', root);
if (process.argv.includes('--check')) assert.deepEqual(JSON.parse(await readFile(output)), receipt);
else await writeJSONAtomic(output, receipt);
console.log('Verified frozen Wraith Leader primary table, native prefab boundary and held upstream reuse receipt');
