// SPDX-License-Identifier: GPL-3.0-or-later
// Candidate-only stage inputs. The shared transport verifies every pinned byte
// before exposing the snapshot; the release and route receipts must also agree.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { loadCanonicalEnemyTables } from './canonical-data.mjs';

export const CANONICAL_STAGE_LOCKS = Object.freeze({
  '16-2': '../../data/arkpedia-canonical-stage-16-2.lock.json',
  '16-3': '../../data/arkpedia-ch16-stage.lock.json',
  '16-4': '../../data/arkpedia-ch16-stage-16-4.lock.json',
  '16-5': '../../data/arkpedia-canonical-stage-16-5.lock.json',
  '16-6': '../../data/arkpedia-canonical-stage-16-6.lock.json',
  '16-7': '../../data/arkpedia-canonical-stage-16-7.lock.json',
  '16-8': '../../data/arkpedia-canonical-stage-16-8.lock.json',
  '17-2': '../../data/arkpedia-canonical-stage-17-2.lock.json',
  '17-3': '../../data/arkpedia-canonical-stage-17-3.lock.json',
  '17-4': '../../data/arkpedia-canonical-stage-17-4.lock.json',
});

export function validateCanonicalStageSnapshot(snapshot, lock) {
  if (lock.repository !== 'arkpedia/arkpedia-data' || lock.testOnly !== true)
    throw Error('Stage source must be a test-only canonical arkpedia-data snapshot');
  const records = Object.fromEntries(Object.entries(snapshot.files).map(([name, file]) => [name, JSON.parse(file.bytes)]));
  const { manifest, routeReceipt, geometry, conditional, stage, devices, rawLevel, levelReceipt } = records;
  if (stage.code !== lock.stage || manifest.generator !== lock.producer.commit
    || routeReceipt.producer.commit !== lock.producer.commit
    || routeReceipt.upstream.commit !== lock.upstream.commit)
    throw Error('Canonical stage provenance mismatch');
  const rawSource = levelReceipt?.files?.[`raw/levels/${lock.stage}.json`];
  if (!rawLevel?.options || !Array.isArray(rawLevel.routes) || !Array.isArray(rawLevel.waves)
    || !lock.files.rawLevel || !rawSource) throw Error('Missing complete canonical level input');
  if (levelReceipt.source.commit !== lock.upstream.commit || rawSource.sha256 !== lock.files.rawLevel.sha256
    || routeReceipt.upstream.sha256 !== rawSource.sha256 || routeReceipt.upstream.path !== rawSource.path
    || routeReceipt.rawLevelPath !== lock.files.rawLevel.path)
    throw Error('Complete canonical level receipt mismatch');
  for (const [name, file] of Object.entries(lock.files)) {
    if (name === 'manifest') continue;
    if (!file.path.startsWith('source/') || manifest.sourceHashes[file.path.slice(7)] !== file.sha256)
      throw Error(`Stage input absent from canonical release receipt: ${name}`);
    if (['geometry', 'conditional'].includes(name) && routeReceipt.outputs[file.path] !== file.sha256)
      throw Error(`Stage input disagrees with route producer receipt: ${name}`);
  }
  if (!Array.isArray(conditional)) throw Error('Canonical stage conditional actions must be an array');
  for (const spawn of conditional) {
    // Conditional branch actions address extraRoutes, never deduplicated main routes.
    const branch = spawn.source === 'branch' || spawn.branch;
    const routes = branch ? geometry.extraRoutes : geometry.routes;
    if (!Number.isInteger(spawn.route) || !routes?.[spawn.route])
      throw Error(`Missing canonical ${branch ? 'branch' : 'wave'} route ${spawn.route}`);
  }
  return { schemaVersion: 1, testOnly: true, admitted: false,
    canonicalData: { repository: lock.repository, commit: lock.commit },
    upstream: lock.upstream, producer: lock.producer,
    inputs: lock.files, routeReceipt, levelReceipt, rawLevel, stage, geometry, conditional,
    devices: devices[stage.geometryKey ?? stage.slug] ?? [] };
}

export async function loadCanonicalStage({ lock, cacheDir, fetchImpl } = {}) {
  const pin = lock ?? JSON.parse(await readFile(new URL('../../data/arkpedia-ch16-stage.lock.json', import.meta.url)));
  const snapshot = await loadCanonicalEnemyTables({ lock: pin, cacheDir, fetchImpl });
  return validateCanonicalStageSnapshot(snapshot, pin);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), code = args.length ? args[1] : '16-3';
  if (args.length && (args.length !== 2 || args[0] !== '--stage') || !Object.hasOwn(CANONICAL_STAGE_LOCKS, code))
    throw Error(`Usage: canonical-stage.mjs [--stage ${Object.keys(CANONICAL_STAGE_LOCKS).join('|')}]; only pinned source intakes are allowed`);
  const lock = JSON.parse(await readFile(new URL(CANONICAL_STAGE_LOCKS[code], import.meta.url)));
  const bundle = await loadCanonicalStage({ lock, cacheDir: fileURLToPath(new URL(`../../.cache/arkpedia/canonical-stage-${code}/`, import.meta.url)) });
  await writeFile(new URL(`../../data/candidates/arkpedia-stage-${code}-source.json`, import.meta.url), JSON.stringify(bundle, null, 2) + '\n');
  console.log(`Verified canonical stage ${bundle.stage.code} at ${bundle.canonicalData.commit}; not admitted.`);
}
