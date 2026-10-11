// SPDX-License-Identifier: GPL-3.0-or-later
// Prepare immutable Global form data and original native Guard bundles.
// Existing shared tables/buff/projectile bundles use the standard source cache.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cache = new URL('../../.cache/arkpedia/', import.meta.url);
const out = new URL('amiya-guard-source/', cache);
const commit = '57010cb5b2afea112cae57daa756b58676ba6850';
const version = '26-09-23-17-49-43_b9cc4a';
const patch = { path: 'en_US/gamedata/excel/char_patch_table.json',
  sha: 'fc84d705f44b9c2e430069c482fbf935a995952e', size: 47115 };
const hash = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex');
async function download(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw Error(`Pinned source unavailable: ${url} (${r.status})`);
  return Buffer.from(await r.arrayBuffer());
}
await mkdir(out, { recursive: true });
let bytes;
try { bytes = await readFile(new URL('char_patch_table.json', cache)); }
catch (error) {
  if (error.code !== 'ENOENT') throw error;
  bytes = await download(`https://raw.githubusercontent.com/Kengxxiao/ArknightsGameData_YoStar/${commit}/${patch.path}`);
}
if (bytes.length !== patch.size || hash('sha1', Buffer.concat([
  Buffer.from(`blob ${bytes.length}\0`), bytes])) !== patch.sha)
  throw Error('Global patch table differs from the pinned Git blob');
await writeFile(new URL('char_patch_table.json', cache), bytes);
await writeFile(new URL('patch-table-source.json', out), `${JSON.stringify(patch)}\n`);
const hot = JSON.parse(await readFile(new URL('map-source/hot_update_list.json', cache)));
if (hot.versionId !== version) throw Error('Unexpected native client version');
for (const [name, path] of [
  ['charpack/char_1001_amiya2.ab', 'all-operator-source/char_1001_amiya2.ab'],
  ['chararts/char_1001_amiya2.ab', 'amiya-guard-source/char_1001_amiya2-chararts.ab'],
]) {
  const row = hot.abInfos.find(r => r.name === name);
  if (!row) throw Error(`Bundle absent from pinned manifest: ${name}`);
  const target = new URL(path, cache);
  try { bytes = await readFile(target); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const filename = name.replaceAll('/', '_').replace(/\.ab$/, '.dat');
    const archive = new URL(filename, out);
    await writeFile(archive, await download(`https://ark-us-static-online.yo-star.com/assetbundle/official/Android/assets/${version}/${filename}`));
    await mkdir(new URL('./', target), { recursive: true });
    execFileSync('python3', ['-c',
      'import sys,zipfile,pathlib; pathlib.Path(sys.argv[3]).write_bytes(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]))',
      fileURLToPath(archive), name, fileURLToPath(target)]);
    bytes = await readFile(target);
  }
  if (bytes.length !== row.abSize || hash('md5', bytes) !== row.md5)
    throw Error(`Original bundle checksum mismatch: ${name}`);
  console.log(`Verified ${name}`);
}
console.log('Verified immutable Global Amiya patch table');
