#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Frozen original enemy prefabs for controller/clock review; no runtime admission.
import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CN_NATIVE_PIN, parsePinnedCNManifest, verifyCNNativeBundle } from './cn-native-source.mjs';
import { writeJSONAtomic } from './write-json.mjs';

export function prepareCNEnemyPlan(manifest) {
  if (manifest.versionId !== CN_NATIVE_PIN.resourceVersion || !Array.isArray(manifest.abInfos))
    throw Error('Enemy source must use the frozen CN native manifest');
  const rows = manifest.abInfos.filter(r => /^battle\/enm_pfb.*\.ab$/.test(r.name));
  const expected = ['battle/enm_pfb_base_0.ab', ...Array.from({ length: 36 }, (_, i) => `battle/enm_pfb_${i}.ab`)];
  if (rows.length !== expected.length || new Set(rows.map(r => r.name)).size !== rows.length
    || rows.some(r => !expected.includes(r.name))) throw Error('Changed or incomplete native enemy bundle membership');
  const bundles = rows.sort((a, b) => a.name.localeCompare(b.name, 'en')).map(row => {
    if (!Number.isSafeInteger(row.abSize) || row.abSize < 1 || !/^[0-9a-f]{32}$/.test(row.md5))
      throw Error('Invalid original enemy byte identity: ' + row.name);
    const archive = row.name.replaceAll('/', '_').replace(/\.ab$/, '.dat');
    return { path: row.name, bytes: row.abSize, md5: row.md5, archive,
      url: new URL(archive, CN_NATIVE_PIN.baseURL).href };
  });
  return { schemaVersion: 1,
    scope: 'Complete frozen CN enemy prefab bundle inputs for native controller/clock extraction. No behavior, animation or playable approval.',
    enabledOperators: [], runtimeBindingsVerified: false, frameParity: false,
    source: { ...CN_NATIVE_PIN, manifestURL: new URL('hot_update_list.json', CN_NATIVE_PIN.baseURL).href },
    summary: { bundles: bundles.length, bytes: bundles.reduce((n, r) => n + r.bytes, 0) }, bundles };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = new URL('../../', import.meta.url), cache = new URL('.cache/arkpedia/cn-native-source/', root);
  const fetching = process.argv.includes('--fetch'), manifestFile = new URL('hot_update_list.json', cache);
  await mkdir(cache, { recursive: true });
  let manifestRaw;
  try { manifestRaw = await readFile(manifestFile); }
  catch (e) {
    if (!fetching || e.code !== 'ENOENT') throw e;
    const response = await fetch(new URL('hot_update_list.json', CN_NATIVE_PIN.baseURL), { signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw Error('Original enemy manifest publisher response ' + response.status);
    manifestRaw = Buffer.from(await response.arrayBuffer()); parsePinnedCNManifest(manifestRaw);
    const temp = new URL(manifestFile.href + '.partial-' + randomUUID());
    try { await writeFile(temp, manifestRaw); await rename(temp, manifestFile); }
    finally { await rm(temp, { force: true }); }
  }
  const manifest = parsePinnedCNManifest(manifestRaw), plan = prepareCNEnemyPlan(manifest);
  await mkdir(new URL('archives/', cache), { recursive: true });
  const verified = new Array(plan.bundles.length); let cursor = 0;
  const worker = async () => {
    while (cursor < plan.bundles.length) {
      const index = cursor++, row = plan.bundles[index], target = new URL('bundles/' + row.path, cache);
      let raw;
      try { raw = await readFile(target); }
      catch (e) {
        if (!fetching || e.code !== 'ENOENT') throw e;
        const response = await fetch(row.url, { signal: AbortSignal.timeout(45000) });
        if (!response.ok) throw Error('Original enemy publisher response ' + response.status + ': ' + row.url);
        const archive = new URL('archives/' + row.archive, cache), suffix = '.partial-' + randomUUID();
        const archiveTemp = new URL(archive.href + suffix), temp = new URL(target.href + suffix);
        await mkdir(new URL('./', target), { recursive: true });
        try {
          await writeFile(archiveTemp, Buffer.from(await response.arrayBuffer()));
          // Select one exact ZIP member; never extract publisher paths wholesale.
          execFileSync('python3', ['-c',
            'import sys,zipfile,pathlib; z=zipfile.ZipFile(sys.argv[1]); i=z.getinfo(sys.argv[2]); assert i.file_size==int(sys.argv[4]); pathlib.Path(sys.argv[3]).write_bytes(z.read(i))',
            fileURLToPath(archiveTemp), row.path, fileURLToPath(temp), String(row.bytes)], { stdio: 'pipe' });
          raw = await readFile(temp); verifyCNNativeBundle(row, raw);
          await rename(archiveTemp, archive); await rename(temp, target);
        } finally { await Promise.all([rm(temp, { force: true }), rm(archiveTemp, { force: true })]); }
      }
      verified[index] = verifyCNNativeBundle(row, raw);
    }
  };
  const results = await Promise.allSettled(Array.from({ length: 4 }, worker));
  const failed = results.find(r => r.status === 'rejected'); if (failed) throw failed.reason;
  plan.bundles = verified;
  await writeJSONAtomic(new URL('data/arkpedia-cn-enemy-native-source.json', root), plan);
  console.log('Verified original CN enemy bundle inputs:', JSON.stringify(plan.summary));
}
