// SPDX-License-Identifier: GPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCanonicalStage, validateCanonicalStageSnapshot } from '../tools/arkpedia/canonical-stage.mjs';
import candidate from '../data/candidates/arkpedia-stage-16-3-source.json' with { type: 'json' };

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function fixture(change = () => {}) {
  const lock = { repository: 'arkpedia/arkpedia-data', commit: 'a'.repeat(40), stage: '16-3', testOnly: true,
    producer: { commit: 'b'.repeat(40) }, upstream: { commit: 'c'.repeat(40) }, files: {} };
  const records = { stage: { code: '16-3', slug: '16-3' },
    geometry: { routes: [{ id: 'ordinary' }], extraRoutes: [{ id: 'miner' }] },
    conditional: [{ source: 'wave', route: 0 }, { source: 'branch', branch: 'miners', route: 0 }],
    devices: { '16-3': [{ key: 'trap_270_spawnp' }] },
    rawLevel: { options: { moveMultiplier: .5 }, routes: [], waves: [] },
    levelReceipt: { source: lock.upstream, files: {} },
    routeReceipt: { producer: lock.producer, upstream: lock.upstream, outputs: {} },
    manifest: { generator: lock.producer.commit, sourceHashes: {} } };
  change(records, lock);
  const files = {};
  for (const name of ['stage', 'geometry', 'conditional', 'devices', 'rawLevel', 'levelReceipt', 'routeReceipt', 'manifest']) {
    const path = name === 'manifest' ? 'release/manifest.json' : name === 'rawLevel'
      ? 'source/data/simulator/raw/levels/16-3.json' : `source/data/${name}.json`;
    const bytes = Buffer.from(JSON.stringify(records[name]));
    const file = { path, bytes: bytes.length, sha256: sha(bytes) };
    files[name] = { bytes };
    lock.files[name] = file;
    if (name !== 'manifest') records.manifest.sourceHashes[path.slice(7)] = file.sha256;
    if (['geometry', 'conditional'].includes(name)) records.routeReceipt.outputs[path] = file.sha256;
    if (name === 'rawLevel') {
      const rawSource = { path: 'en/gamedata/levels/fixture.json', sha256: file.sha256 };
      records.levelReceipt.files['raw/levels/16-3.json'] = rawSource;
      records.routeReceipt.upstream = { ...records.routeReceipt.upstream, ...rawSource };
      records.routeReceipt.rawLevelPath = path;
    }
  }
  return { lock, snapshot: { files } };
}

test('canonical stage loader verifies the whole snapshot and keeps route spaces separate', async () => {
  const { lock, snapshot } = fixture();
  const cacheDir = await mkdtemp(join(tmpdir(), 'canonical-stage-'));
  const fetched = [];
  const fetchImpl = async url => {
    fetched.push(url);
    const name = Object.keys(lock.files).find(k => url.endsWith(lock.files[k].path));
    return { ok: true, arrayBuffer: async () => snapshot.files[name].bytes };
  };
  const bundle = await loadCanonicalStage({ lock, cacheDir, fetchImpl });
  assert.equal(fetched.length, 8);
  assert.ok(fetched.every(url => url.includes(`/arkpedia/arkpedia-data/${lock.commit}/`)));
  assert.equal(bundle.geometry.routes[0].id, 'ordinary');
  assert.equal(bundle.geometry.extraRoutes[0].id, 'miner');
  assert.equal(bundle.devices[0].key, 'trap_270_spawnp');
  assert.equal(bundle.testOnly, true);
  assert.equal(bundle.admitted, false);
  assert.deepEqual(await readFile(join(cacheDir, 'geometry.json')), snapshot.files.geometry.bytes);
});

test('canonical stage receipt mismatches and missing branch routes fail closed', () => {
  for (const change of [
    records => { records.manifest.generator = 'd'.repeat(40); },
    records => { records.routeReceipt = { ...records.routeReceipt, upstream: { commit: 'd'.repeat(40) } }; },
  ]) {
    const { lock, snapshot } = fixture(change);
    assert.throws(() => validateCanonicalStageSnapshot(snapshot, lock), /provenance mismatch/);
  }
  const { lock, snapshot } = fixture(records => { records.geometry.extraRoutes = []; });
  assert.throws(() => validateCanonicalStageSnapshot(snapshot, lock), /Missing canonical branch route/);
  const badWave = fixture(records => { records.conditional[0].route = 10; });
  assert.throws(() => validateCanonicalStageSnapshot(badWave.snapshot, badWave.lock), /Missing canonical wave route/);
  const badShape = fixture(records => { records.conditional = {}; });
  assert.throws(() => validateCanonicalStageSnapshot(badShape.snapshot, badShape.lock), /must be an array/);
});

test('release and producer output receipts must both include the exact stage input hashes', () => {
  const { lock, snapshot } = fixture();
  const manifest = JSON.parse(snapshot.files.manifest.bytes);
  delete manifest.sourceHashes[lock.files.geometry.path.slice(7)];
  snapshot.files.manifest.bytes = Buffer.from(JSON.stringify(manifest));
  assert.throws(() => validateCanonicalStageSnapshot(snapshot, lock), /absent from canonical release receipt/);
  const other = fixture();
  const receipt = JSON.parse(other.snapshot.files.routeReceipt.bytes);
  receipt.outputs[other.lock.files.geometry.path] = '0'.repeat(64);
  other.snapshot.files.routeReceipt.bytes = Buffer.from(JSON.stringify(receipt));
  assert.throws(() => validateCanonicalStageSnapshot(other.snapshot, other.lock), /disagrees with route producer receipt/);
});

test('retained 16-3 canonical preview preserves miner waypoints without admitting the stage', () => {
  assert.equal(candidate.canonicalData.commit, '84f3c8334db1c505429bce848147b32ca6a1cc20');
  assert.equal(candidate.upstream.commit, 'db6f9ef8046ad17dbebe3ff1d0dd88844a5bc78c');
  assert.equal(candidate.testOnly, true);
  assert.equal(candidate.admitted, false);
  assert.deepEqual(candidate.conditional.map(s => [s.source, s.route]), [['wave', 7], ['wave', 7], ['branch', 0]]);
  const route = candidate.geometry.extraRoutes[0];
  assert.equal(route.allowDiagonalMove, true);
  assert.equal(route.visitEveryTileCenter, false);
  assert.equal(route.visitEveryNodeCenter, false);
  assert.equal(route.visitEveryCheckPoint, true);
  const offsets = route.checkpoints.filter(p => p.reachOffset).map(p => p.reachOffset);
  assert.deepEqual(offsets, [{ x: .46, y: 0 }, { x: -.46, y: -.01 }]);
  assert.equal(candidate.rawLevel.options.moveMultiplier, .5);
  const raid = Object.values(candidate.rawLevel.optionalRunes).flat().find(r => r.key === 'level_hidden_group_enable');
  assert.equal(raid.difficultyMask, 'SIX_STAR');
  assert.ok(raid.blackboard.some(b => b.valueStr === 'raid'));
});

test('complete level provenance is required independently of the compact geometry receipt', () => {
  const missing = fixture(records => { delete records.rawLevel.options; });
  assert.throws(() => validateCanonicalStageSnapshot(missing.snapshot, missing.lock), /Missing complete canonical level/);
  const wrongUpstream = fixture(records => { records.levelReceipt.source = { commit: 'd'.repeat(40) }; });
  assert.throws(() => validateCanonicalStageSnapshot(wrongUpstream.snapshot, wrongUpstream.lock), /level receipt mismatch/);
  const other = fixture();
  const receipt = JSON.parse(other.snapshot.files.levelReceipt.bytes);
  receipt.files['raw/levels/16-3.json'].sha256 = '0'.repeat(64);
  other.snapshot.files.levelReceipt.bytes = Buffer.from(JSON.stringify(receipt));
  assert.throws(() => validateCanonicalStageSnapshot(other.snapshot, other.lock), /level receipt mismatch/);
});
