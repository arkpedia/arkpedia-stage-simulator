#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-or-later
// Checksum-pinned CN inputs for the remaining roster. This does not register kits.
import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeJSONAtomic } from './write-json.mjs';

export const CN_NATIVE_PIN = Object.freeze({
  repository: 'Kengxxiao/ArknightsGameData',
  commit: 'a550f5e048bb94e7cdefc6eb97a4091f0c4c7add',
  clientVersion: '2.7.71', resourceVersion: '26-09-22-07-47-20_6c71fa',
  baseURL: 'https://ak.hycdn.cn/assetbundle/official/Android/assets/26-09-22-07-47-20_6c71fa/',
  manifestBytes: 3241788,
  manifestSha256: 'd1ac02a61d98e6e4c772335bb85dc44da4794a0a8bc915354b6f9ffbc7ec1f35',
});
const sharedPaths = ['battle/prefabs/[uc]skills.ab', 'battle/prefabs/[uc]projectiles.ab', 'config/buff_template_holder.ab'];
const digest = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex');
export const sha256 = bytes => digest('sha256', bytes);
const jsonHash = value => sha256(JSON.stringify(value));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function parsePinnedCNManifest(bytes, pin = CN_NATIVE_PIN) {
  if (bytes.length !== pin.manifestBytes || sha256(bytes) !== pin.manifestSha256)
    throw Error('CN native manifest differs from its immutable byte pin');
  const h = JSON.parse(bytes);
  if (h.versionId !== pin.resourceVersion || !Array.isArray(h.abInfos)
    || h.abInfos.some(r => !r || typeof r.name !== 'string')
    || new Set(h.abInfos.map(r => r.name)).size !== h.abInfos.length)
    throw Error('Invalid or duplicate CN native manifest membership');
  return h;
}
export function prepareCNNativePlan({ cn, roster, globalForms, manifest, pin = CN_NATIVE_PIN }) {
  if (cn.source.repository !== pin.repository || cn.source.commit !== pin.commit
    || roster.source.repository !== pin.repository || roster.source.commit !== pin.commit
    || manifest.versionId !== pin.resourceVersion || !same(cn.enabledOperators, []))
    throw Error('CN native/table/roster revision mismatch');
  if (!Array.isArray(globalForms.formIds) || new Set(globalForms.formIds).size !== globalForms.formIds.length
    || globalForms.commit !== cn.globalSource.commit)
    throw Error('Invalid independently reviewed Global alternate forms');
  const excluded = new Set(globalForms.formIds);
  const ids = Object.keys(cn.tables.characters).filter(id => !excluded.has(id)).sort();
  const rows = new Map(manifest.abInfos.map(row => [row.name, row]));
  if (rows.size !== manifest.abInfos.length) throw Error('Duplicate native bundle');
  const wanted = new Set(sharedPaths), operators = {};
  for (const id of ids) {
    const c = cn.tables.characters[id], target = roster.operators.find(row => row.id === id);
    if (!/^char_[0-9]+_[a-z0-9]+$/.test(id) || !target || c.isNotObtainable
      || !same(c.skills.map(s => s.skillId), target.skills)) throw Error('Changed CN native operator selection: ' + id);
    const bundles = [`charpack/${id}.ab`, `chararts/${id}.ab`];
    for (const p of bundles) wanted.add(p);
    const skills = c.skills.map(({ skillId }) => {
      const record = cn.tables.skills[skillId];
      if (record?.levels?.length !== 10) throw Error('Incomplete CN selected skill: ' + skillId);
      return { id: skillId, ranks: record.levels.length, sha256: jsonHash(record),
        prefabIds: [...new Set(record.levels.map(r => r.prefabId))].sort() };
    });
    operators[id] = { sourceName: c.name, appellation: c.appellation, rarity: c.rarity,
      archetype: c.subProfessionId, sourceCharacterSha256: jsonHash(c), skills, bundles };
  }
  const tokenGroups = manifest.abInfos.filter(row => /^pkgrps\/btl_pfb_tokens_[0-9]+\.ab$/.test(row.name)).map(r => r.name).sort();
  if (!tokenGroups.length) throw Error('CN native token groups absent');
  for (const p of tokenGroups) wanted.add(p);
  const bundles = [...wanted].sort().map(path => {
    const r = rows.get(path);
    if (!r || !Number.isSafeInteger(r.abSize) || r.abSize <= 0 || !/^[a-f0-9]{32}$/.test(r.md5))
      throw Error('Missing or invalid pinned CN bundle: ' + path);
    const archive = path.replaceAll('/', '_').replace(/\.ab$/, '.dat');
    return { path, bytes: r.abSize, md5: r.md5, archive,
      url: new URL(encodeURIComponent(archive), pin.baseURL).href };
  });
  return { schemaVersion: 1,
    scope: 'Checksum-pinned original CN owner, artwork and shared skill/projectile/template/token bundles. Source preparation only; no behavior or rendering approval.',
    enabledOperators: [], frameParity: false, nativeParticleSupport: false, moduleSupport: false,
    graphClosureVerified: false, animationBindingsVerified: false,
    source: { ...pin, manifestURL: new URL('hot_update_list.json', pin.baseURL).href,
      manifestName: manifest.manifestName, manifestVersion: manifest.manifestVersion,
      tableSource: cn.source, globalAlternateForms: globalForms },
    summary: { operatorForms: ids.length, skills: Object.values(operators).reduce((n, o) => n + o.skills.length, 0),
      skillRanks: Object.values(operators).flatMap(o => o.skills).reduce((n, s) => n + s.ranks, 0),
      bundles: bundles.length, bytes: bundles.reduce((n, r) => n + r.bytes, 0), tokenGroups: tokenGroups.length },
    operators, bundles,
  };
}
export function verifyCNNativeBundle(row, bytes) {
  if (bytes.length !== row.bytes || digest('md5', bytes) !== row.md5
    || bytes.subarray(0, 8).toString('ascii') !== 'UnityFS\0')
    throw Error('Original CN bundle checksum/header mismatch: ' + row.path);
  return { ...row, sha256: sha256(bytes) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = new URL('../../', import.meta.url), cache = new URL('.cache/arkpedia/cn-native-source/', root);
  await mkdir(new URL('bundles/', cache), { recursive: true });
  await mkdir(new URL('archives/', cache), { recursive: true });
  const fetching = process.argv.includes('--fetch');
  const download = async url => {
    const r = await fetch(url, { signal: AbortSignal.timeout(90000) });
    if (!r.ok) throw Error('Pinned CN publisher response ' + r.status + ': ' + url);
    return Buffer.from(await r.arrayBuffer());
  };
  const manifestFile = new URL('hot_update_list.json', cache);
  let rawManifest;
  try { rawManifest = await readFile(manifestFile); }
  catch (e) {
    if (!fetching || e.code !== 'ENOENT') throw e;
    rawManifest = await download(new URL('hot_update_list.json', CN_NATIVE_PIN.baseURL));
    parsePinnedCNManifest(rawManifest); await writeFile(manifestFile, rawManifest);
  }
  const manifest = parsePinnedCNManifest(rawManifest);
  // The independent table verifier compares all four complete cached Git blobs.
  execFileSync(process.execPath, [fileURLToPath(new URL('tools/arkpedia/verify-cn-source.mjs', root))], { stdio: 'pipe' });
  const cnBytes = await readFile(new URL('data/arkpedia-cn-source.json', root));
  const [roster, data] = await Promise.all(['data/arkpedia-roster-target.json', 'data/arkpedia-mvp.json']
    .map(async p => JSON.parse(await readFile(new URL(p, root)))));
  const plan = prepareCNNativePlan({ cn: JSON.parse(cnBytes), roster, globalForms: data.globalAlternateFormSource, manifest });
  plan.source.preparedTableSha256 = sha256(cnBytes);
  const verified = new Array(plan.bundles.length); let cursor = 0, completed = 0;
  const worker = async () => {
    while (cursor < plan.bundles.length) {
      const index = cursor++, row = plan.bundles[index], target = new URL('bundles/' + row.path, cache);
      let bytes;
      try { bytes = await readFile(target); }
      catch (e) {
        if (!fetching || e.code !== 'ENOENT') throw e;
        await mkdir(new URL('./', target), { recursive: true });
        const archive = new URL('archives/' + row.archive, cache), tmp = new URL(target.href + '.partial-' + randomUUID());
        await writeFile(archive, await download(row.url));
        try {
          execFileSync('python3', ['-c',
            'import sys,zipfile,pathlib; z=zipfile.ZipFile(sys.argv[1]); i=z.getinfo(sys.argv[2]); assert i.file_size==int(sys.argv[4]); pathlib.Path(sys.argv[3]).write_bytes(z.read(i))',
            fileURLToPath(archive), row.path, fileURLToPath(tmp), String(row.bytes)], { stdio: 'pipe' });
          bytes = await readFile(tmp); verifyCNNativeBundle(row, bytes); await rename(tmp, target);
        } finally { await rm(tmp, { force: true }); }
      }
      verified[index] = verifyCNNativeBundle(row, bytes); completed++;
      if (completed % 10 === 0 || completed === plan.bundles.length) console.log(`CN original bundle bytes: ${completed}/${plan.bundles.length} verified`);
    }
  };
  // On any failure, await all workers before exiting; never publish a partial receipt.
  const results = await Promise.allSettled(Array.from({ length: 4 }, worker));
  const failure = results.find(r => r.status === 'rejected'); if (failure) throw failure.reason;
  plan.bundles = verified;
  await writeJSONAtomic(new URL('data/arkpedia-cn-native-source.json', root), plan);
  console.log(JSON.stringify(plan.summary));
}
